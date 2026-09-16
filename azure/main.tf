terraform {
  required_version = ">= 1.7.0"

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
    time = {
      source  = "hashicorp/time"
      version = "~> 0.12"
    }
  }

  # Partial backend — configure with: terraform init -backend-config=backends/dev.hcl
  backend "azurerm" {}
}

provider "azurerm" {
  features {
    key_vault {
      purge_soft_delete_on_destroy    = true
      recover_soft_deleted_key_vaults = true
    }
  }
  subscription_id = var.subscription_id
}

data "azurerm_client_config" "current" {}

variable "subscription_id" {
  type    = string
  default = "64f857b7-e077-48c7-9f25-b59588e967b4"
}

variable "environment" {
  type    = string
  default = "dev"
  validation {
    condition     = contains(["dev", "staging", "production"], var.environment)
    error_message = "environment must be dev, staging, or production."
  }
}

variable "location" {
  type    = string
  default = "uksouth"
}

variable "project_name" {
  type    = string
  default = "crypto-trading"
}

variable "app_image_tag" {
  type    = string
  default = "latest"
}

variable "db_admin_username" {
  type    = string
  default = "paperadmin"
}

variable "db_admin_cidrs" {
  type        = list(string)
  default     = []
  description = "Optional IPv4 CIDRs allowed to reach Postgres (in addition to Azure services). Document each in azure/FIREWALL_RULES.md."
}

variable "postgres_backup_retention_days" {
  type    = number
  default = 7
}

locals {
  name = "${var.project_name}-${var.environment}"
  tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

resource "azurerm_resource_group" "app" {
  name     = local.name
  location = var.location
  tags     = local.tags
}

resource "random_password" "db" {
  length           = 24
  special          = true
  override_special = "!#$%&*()-_=+[]{}"
}

resource "random_password" "jwt" {
  length  = 48
  special = false
}

resource "random_password" "signup_invite" {
  length  = 24
  special = false
}

resource "azurerm_container_registry" "app" {
  name                = replace("${local.name}acr", "-", "")
  resource_group_name = azurerm_resource_group.app.name
  location            = azurerm_resource_group.app.location
  sku                 = "Basic"
  admin_enabled       = true
  tags                = local.tags
}

resource "azurerm_log_analytics_workspace" "app" {
  name                = "${local.name}-logs"
  location            = azurerm_resource_group.app.location
  resource_group_name = azurerm_resource_group.app.name
  sku                 = "PerGB2018"
  retention_in_days   = 30
  tags                = local.tags
}

resource "azurerm_container_app_environment" "app" {
  name                       = "${local.name}-cae"
  location                   = azurerm_resource_group.app.location
  resource_group_name        = azurerm_resource_group.app.name
  log_analytics_workspace_id = azurerm_log_analytics_workspace.app.id
  tags                       = local.tags
}

# Postgres is reachable from Azure services (Container Apps) via PG-01 firewall rule.
# Optional operator CIDRs via var.db_admin_cidrs (see azure/FIREWALL_RULES.md).
# Prefer private VNet + private DNS when networking maturity allows.
resource "azurerm_postgresql_flexible_server" "app" {
  name                          = "${local.name}-pg"
  resource_group_name           = azurerm_resource_group.app.name
  location                      = azurerm_resource_group.app.location
  version                       = "16"
  administrator_login           = var.db_admin_username
  administrator_password        = random_password.db.result
  sku_name                      = "B_Standard_B1ms"
  storage_mb                    = 32768
  zone                          = "1"
  public_network_access_enabled = true
  backup_retention_days         = var.postgres_backup_retention_days

  authentication {
    password_auth_enabled = true
  }

  tags = local.tags

  lifecycle {
    ignore_changes = [zone]
  }
}

resource "azurerm_postgresql_flexible_server_database" "app" {
  name      = "papertrading"
  server_id = azurerm_postgresql_flexible_server.app.id
  charset   = "UTF8"
  collation = "en_US.utf8"
}

# Azure sentinel 0.0.0.0/0.0.0.0 = allow Azure services (not the public internet).
resource "azurerm_postgresql_flexible_server_firewall_rule" "allow_azure" {
  name             = "AllowAzureServices"
  server_id        = azurerm_postgresql_flexible_server.app.id
  start_ip_address = "0.0.0.0"
  end_ip_address   = "0.0.0.0"
}

resource "azurerm_postgresql_flexible_server_firewall_rule" "admin_cidrs" {
  for_each = {
    for idx, cidr in var.db_admin_cidrs : format("admin-%02d", idx) => cidr
  }

  name             = each.key
  server_id        = azurerm_postgresql_flexible_server.app.id
  start_ip_address = cidrhost(each.value, 0)
  end_ip_address   = cidrhost(each.value, -1)
}

locals {
  database_url = format(
    "postgresql://%s:%s@%s:5432/%s?sslmode=require",
    var.db_admin_username,
    urlencode(random_password.db.result),
    azurerm_postgresql_flexible_server.app.fqdn,
    azurerm_postgresql_flexible_server_database.app.name,
  )
  # Key Vault names: 3–24 chars, alphanumeric + hyphen
  key_vault_name = substr(replace("${local.name}-kv", "-", ""), 0, 24)
}

resource "azurerm_user_assigned_identity" "app" {
  name                = "${local.name}-uai"
  location            = azurerm_resource_group.app.location
  resource_group_name = azurerm_resource_group.app.name
  tags                = local.tags
}

resource "azurerm_key_vault" "app" {
  name                       = local.key_vault_name
  location                   = azurerm_resource_group.app.location
  resource_group_name        = azurerm_resource_group.app.name
  tenant_id                  = data.azurerm_client_config.current.tenant_id
  sku_name                   = "standard"
  soft_delete_retention_days = 7
  purge_protection_enabled   = var.environment == "production"
  rbac_authorization_enabled = true
  tags                       = local.tags

  # Deny by default; AzureServices bypass lets Container Apps MI resolve secret refs.
  network_acls {
    default_action = "Deny"
    bypass         = "AzureServices"
  }
}

# Terraform / CI principal creates and updates secret values
resource "azurerm_role_assignment" "kv_secrets_officer" {
  scope                = azurerm_key_vault.app.id
  role_definition_name = "Key Vault Secrets Officer"
  principal_id         = data.azurerm_client_config.current.object_id
}

# Container App identity reads secret refs at runtime
resource "azurerm_role_assignment" "kv_secrets_user" {
  scope                = azurerm_key_vault.app.id
  role_definition_name = "Key Vault Secrets User"
  principal_id         = azurerm_user_assigned_identity.app.principal_id
}

resource "time_sleep" "wait_kv_rbac" {
  depends_on = [
    azurerm_role_assignment.kv_secrets_officer,
    azurerm_role_assignment.kv_secrets_user,
  ]
  create_duration = "60s"
}

resource "azurerm_key_vault_secret" "database_url" {
  name         = "database-url"
  value        = local.database_url
  key_vault_id = azurerm_key_vault.app.id
  content_type = "text/plain"
  depends_on   = [time_sleep.wait_kv_rbac]
}

resource "azurerm_key_vault_secret" "jwt_secret" {
  name         = "jwt-secret"
  value        = random_password.jwt.result
  key_vault_id = azurerm_key_vault.app.id
  content_type = "text/plain"
  depends_on   = [time_sleep.wait_kv_rbac]
}

resource "azurerm_key_vault_secret" "signup_invite" {
  name         = "signup-invite-code"
  value        = random_password.signup_invite.result
  key_vault_id = azurerm_key_vault.app.id
  content_type = "text/plain"
  depends_on   = [time_sleep.wait_kv_rbac]
}

resource "azurerm_container_app" "app" {
  name                         = "${local.name}-app"
  container_app_environment_id = azurerm_container_app_environment.app.id
  resource_group_name          = azurerm_resource_group.app.name
  revision_mode                = "Single"
  tags                         = local.tags

  identity {
    type         = "UserAssigned"
    identity_ids = [azurerm_user_assigned_identity.app.id]
  }

  registry {
    server               = azurerm_container_registry.app.login_server
    username             = azurerm_container_registry.app.admin_username
    password_secret_name = "acr-password"
  }

  secret {
    name  = "acr-password"
    value = azurerm_container_registry.app.admin_password
  }

  secret {
    name                = "database-url"
    key_vault_secret_id = azurerm_key_vault_secret.database_url.versionless_id
    identity            = azurerm_user_assigned_identity.app.id
  }

  secret {
    name                = "jwt-secret"
    key_vault_secret_id = azurerm_key_vault_secret.jwt_secret.versionless_id
    identity            = azurerm_user_assigned_identity.app.id
  }

  secret {
    name                = "signup-invite-code"
    key_vault_secret_id = azurerm_key_vault_secret.signup_invite.versionless_id
    identity            = azurerm_user_assigned_identity.app.id
  }

  template {
    min_replicas = 1
    max_replicas = 2

    container {
      name   = "dashboard"
      image  = "${azurerm_container_registry.app.login_server}/${local.name}:${var.app_image_tag}"
      cpu    = 0.25
      memory = "0.5Gi"

      env {
        name  = "NODE_ENV"
        value = "production"
      }

      env {
        name  = "PORT"
        value = "3000"
      }

      env {
        name  = "HOSTNAME"
        value = "0.0.0.0"
      }

      env {
        name  = "AUTH_COOKIE_SECURE"
        value = "true"
      }

      env {
        name  = "ALLOW_PUBLIC_SIGNUP"
        value = "false"
      }

      env {
        name        = "DATABASE_URL"
        secret_name = "database-url"
      }

      env {
        name        = "JWT_SECRET"
        secret_name = "jwt-secret"
      }

      env {
        name        = "SIGNUP_INVITE_CODE"
        secret_name = "signup-invite-code"
      }
    }
  }

  ingress {
    external_enabled = true
    target_port      = 3000
    transport        = "http"

    traffic_weight {
      latest_revision = true
      percentage      = 100
    }
  }

  depends_on = [
    azurerm_postgresql_flexible_server_firewall_rule.allow_azure,
    azurerm_postgresql_flexible_server_firewall_rule.admin_cidrs,
  ]
}

output "resource_group_name" {
  value = azurerm_resource_group.app.name
}

output "acr_login_server" {
  value = azurerm_container_registry.app.login_server
}

output "acr_username" {
  value = azurerm_container_registry.app.admin_username
}

output "acr_password" {
  value     = azurerm_container_registry.app.admin_password
  sensitive = true
}

output "dashboard_url" {
  value = "https://${azurerm_container_app.app.ingress[0].fqdn}"
}

output "postgres_fqdn" {
  value = azurerm_postgresql_flexible_server.app.fqdn
}

output "signup_invite_code" {
  value       = random_password.signup_invite.result
  sensitive   = true
  description = "Share with approved users so they can create accounts."
}

output "key_vault_name" {
  value = azurerm_key_vault.app.name
}

output "managed_identity_client_id" {
  value = azurerm_user_assigned_identity.app.client_id
}

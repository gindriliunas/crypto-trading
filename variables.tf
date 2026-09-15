variable "environment" {
  description = "Deployment environment name"
  type        = string

  validation {
    condition     = contains(["dev", "staging", "production"], var.environment)
    error_message = "environment must be one of: dev, staging, production."
  }
}

variable "aws_region" {
  description = "AWS region for resources"
  type        = string
  default     = "eu-west-2"
}

variable "project_name" {
  description = "Short project name used in resource naming"
  type        = string
  default     = "crypto-trading"
}

variable "vpc_cidr" {
  description = "VPC CIDR for the dashboard environment"
  type        = string
}

variable "app_port" {
  description = "Container listen port"
  type        = number
  default     = 3000
}

variable "app_image_tag" {
  description = "ECR image tag for the dashboard task"
  type        = string
  default     = "latest"
}

variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t4g.micro"
}

variable "db_allocated_storage" {
  description = "RDS allocated storage in GB"
  type        = number
  default     = 20
}

variable "db_name" {
  description = "Postgres database name"
  type        = string
  default     = "papertrading"
}

variable "db_username" {
  description = "Postgres master username"
  type        = string
  default     = "paperadmin"
}

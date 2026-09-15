resource "aws_cloudwatch_log_group" "app" {
  name              = "/ecs/${local.name}"
  retention_in_days = 1
}

resource "aws_ecs_cluster" "app" {
  name = local.name
}

# Pulls images from ECR and writes logs / resolves secrets at task start
resource "aws_iam_role" "ecs_execution" {
  name = "${local.name}-ecs-execution"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_execution" {
  role       = aws_iam_role.ecs_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role_policy" "ecs_execution_secrets" {
  name = "${local.name}-ecs-secrets"
  role = aws_iam_role.ecs_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = [
          aws_secretsmanager_secret.database_url.arn
        ]
      }
    ]
  })
}

# App permissions (Cognito admin APIs)
resource "aws_iam_role" "ecs_task" {
  name = "${local.name}-ecs-task"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })
}

resource "aws_iam_role_policy" "ecs_task" {
  name = "${local.name}-ecs-task"
  role = aws_iam_role.ecs_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "cognito-idp:SignUp",
          "cognito-idp:InitiateAuth",
          "cognito-idp:GetUser",
          "cognito-idp:AdminConfirmSignUp",
          "cognito-idp:AdminUpdateUserAttributes"
        ]
        Resource = [
          aws_cognito_user_pool.app.arn
        ]
      }
    ]
  })
}

# Lets ECS Express Mode create/manage ALB, certs, scaling, etc.
resource "aws_iam_role" "ecs_infrastructure" {
  name = "${local.name}-ecs-infra"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowAccessInfrastructureForECSExpressServices"
        Effect = "Allow"
        Principal = {
          Service = "ecs.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_infrastructure" {
  role       = aws_iam_role.ecs_infrastructure.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSInfrastructureRoleforExpressGatewayServices"
}

resource "aws_ecs_express_gateway_service" "app" {
  service_name            = local.name
  cluster                 = aws_ecs_cluster.app.name
  execution_role_arn      = aws_iam_role.ecs_execution.arn
  infrastructure_role_arn = aws_iam_role.ecs_infrastructure.arn
  task_role_arn           = aws_iam_role.ecs_task.arn
  cpu                     = "256"
  memory                  = "512"
  health_check_path       = "/api/health"

  primary_container {
    image          = "${aws_ecr_repository.app.repository_url}:${var.app_image_tag}"
    container_port = var.app_port

    aws_logs_configuration {
      log_group         = aws_cloudwatch_log_group.app.name
      log_stream_prefix = "express"
    }

    environment {
      name  = "NODE_ENV"
      value = "production"
    }

    environment {
      name  = "PORT"
      value = tostring(var.app_port)
    }

    environment {
      name  = "HOSTNAME"
      value = "0.0.0.0"
    }

    environment {
      name  = "AWS_REGION"
      value = var.aws_region
    }

    environment {
      name  = "COGNITO_USER_POOL_ID"
      value = aws_cognito_user_pool.app.id
    }

    environment {
      name  = "COGNITO_CLIENT_ID"
      value = aws_cognito_user_pool_client.app.id
    }

    environment {
      name  = "AUTH_COOKIE_SECURE"
      value = "true"
    }

    secret {
      name       = "DATABASE_URL"
      value_from = aws_secretsmanager_secret.database_url.arn
    }
  }

  # Public subnets: tasks get internet (ECR/Cognito/CoinGecko) and can reach private RDS in-VPC
  network_configuration {
    subnets         = aws_subnet.public[*].id
    security_groups = [aws_security_group.app.id]
  }

  scaling_target {
    min_task_count            = 1
    max_task_count            = 2
    auto_scaling_metric       = "AVERAGE_CPU"
    auto_scaling_target_value = 60
  }

  tags = {
    Name = local.name
  }

  depends_on = [
    aws_iam_role_policy_attachment.ecs_execution,
    aws_iam_role_policy.ecs_execution_secrets,
    aws_iam_role_policy.ecs_task,
    aws_iam_role_policy_attachment.ecs_infrastructure,
  ]
}

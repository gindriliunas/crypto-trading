resource "aws_ecr_repository" "app" {
  name                 = local.name
  image_tag_mutability = "MUTABLE"
  force_delete         = var.environment != "production"

  image_scanning_configuration {
    scan_on_push = true
  }
}

resource "aws_ecr_lifecycle_policy" "app" {
  repository = aws_ecr_repository.app.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Keep last 5 images"
        selection = {
          tagStatus   = "any"
          countType   = "imageCountMoreThan"
          countNumber = 5
        }
        action = {
          type = "expire"
        }
      }
    ]
  })
}

# Role used by App Runner to pull images from ECR
resource "aws_iam_role" "apprunner_access" {
  name = "${local.name}-apprunner-access"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "build.apprunner.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "apprunner_ecr" {
  role       = aws_iam_role.apprunner_access.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSAppRunnerServicePolicyForECRAccess"
}

# Role used by the running service (Cognito + Secrets Manager)
resource "aws_iam_role" "apprunner_instance" {
  name = "${local.name}-apprunner-instance"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "tasks.apprunner.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })
}

resource "aws_iam_role_policy" "apprunner_instance" {
  name = "${local.name}-apprunner-instance"
  role = aws_iam_role.apprunner_instance.id

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
      },
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

resource "aws_apprunner_vpc_connector" "app" {
  vpc_connector_name = "${local.name}-connector"
  subnets            = aws_subnet.private[*].id
  security_groups    = [aws_security_group.apprunner.id]

  tags = {
    Name = "${local.name}-connector"
  }
}

resource "aws_apprunner_service" "app" {
  service_name = local.name

  source_configuration {
    authentication_configuration {
      access_role_arn = aws_iam_role.apprunner_access.arn
    }

    auto_deployments_enabled = false

    image_repository {
      image_identifier      = "${aws_ecr_repository.app.repository_url}:${var.app_image_tag}"
      image_repository_type = "ECR"

      image_configuration {
        port = tostring(var.app_port)

        runtime_environment_variables = {
          NODE_ENV             = "production"
          PORT                 = tostring(var.app_port)
          HOSTNAME             = "0.0.0.0"
          AWS_REGION           = var.aws_region
          COGNITO_USER_POOL_ID = aws_cognito_user_pool.app.id
          COGNITO_CLIENT_ID    = aws_cognito_user_pool_client.app.id
          AUTH_COOKIE_SECURE   = "true"
        }

        runtime_environment_secrets = {
          DATABASE_URL = aws_secretsmanager_secret.database_url.arn
        }
      }
    }
  }

  instance_configuration {
    cpu               = "256"
    memory            = "512"
    instance_role_arn = aws_iam_role.apprunner_instance.arn
  }

  network_configuration {
    egress_configuration {
      egress_type       = "VPC"
      vpc_connector_arn = aws_apprunner_vpc_connector.app.arn
    }
  }

  health_check_configuration {
    protocol            = "HTTP"
    path                = "/api/health"
    interval            = 10
    timeout             = 5
    healthy_threshold   = 1
    unhealthy_threshold = 5
  }

  tags = {
    Name = local.name
  }

  depends_on = [
    aws_iam_role_policy_attachment.apprunner_ecr,
    aws_iam_role_policy.apprunner_instance,
    aws_nat_gateway.app,
  ]
}

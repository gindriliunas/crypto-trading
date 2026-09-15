data "archive_file" "cognito_auto_confirm" {
  type        = "zip"
  output_path = "${path.module}/.terraform/cognito-auto-confirm.zip"

  source {
    content  = <<-EOF
      exports.handler = async (event) => {
        event.response.autoConfirmUser = true;
        event.response.autoVerifyEmail = true;
        return event;
      };
    EOF
    filename = "index.js"
  }
}

resource "aws_iam_role" "cognito_auto_confirm" {
  name = "${local.name}-cognito-confirm"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "cognito_auto_confirm_logs" {
  role       = aws_iam_role.cognito_auto_confirm.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_lambda_function" "cognito_auto_confirm" {
  function_name    = "${local.name}-cognito-confirm"
  role             = aws_iam_role.cognito_auto_confirm.arn
  handler          = "index.handler"
  runtime          = "nodejs20.x"
  filename         = data.archive_file.cognito_auto_confirm.output_path
  source_code_hash = data.archive_file.cognito_auto_confirm.output_base64sha256
}

resource "aws_lambda_permission" "cognito_auto_confirm" {
  statement_id  = "AllowCognitoInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.cognito_auto_confirm.function_name
  principal     = "cognito-idp.amazonaws.com"
  source_arn    = aws_cognito_user_pool.app.arn
}

resource "aws_cognito_user_pool" "app" {
  name = "${local.name}-users"

  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]

  password_policy {
    minimum_length    = 8
    require_lowercase = true
    require_numbers   = true
    require_symbols   = false
    require_uppercase = true
  }

  schema {
    name                = "email"
    attribute_data_type = "String"
    required            = true
    mutable             = true

    string_attribute_constraints {
      min_length = 3
      max_length = 256
    }
  }

  lambda_config {
    pre_sign_up = aws_lambda_function.cognito_auto_confirm.arn
  }

  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }
}

resource "aws_cognito_user_pool_client" "app" {
  name         = "${local.name}-web"
  user_pool_id = aws_cognito_user_pool.app.id

  generate_secret                      = false
  prevent_user_existence_errors        = "ENABLED"
  enable_token_revocation              = true
  explicit_auth_flows                  = ["ALLOW_USER_PASSWORD_AUTH", "ALLOW_REFRESH_TOKEN_AUTH"]
  supported_identity_providers         = ["COGNITO"]
  access_token_validity                = 1
  id_token_validity                    = 1
  refresh_token_validity               = 30
  auth_session_validity                = 3

  token_validity_units {
    access_token  = "hours"
    id_token      = "hours"
    refresh_token = "days"
  }
}

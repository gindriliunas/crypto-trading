output "environment" {
  description = "Deployed environment name"
  value       = var.environment
}

output "app_data_bucket_name" {
  description = "Name of the environment-scoped app data bucket"
  value       = aws_s3_bucket.app_data.bucket
}

output "app_data_bucket_arn" {
  description = "ARN of the environment-scoped app data bucket"
  value       = aws_s3_bucket.app_data.arn
}

output "ecr_repository_url" {
  description = "ECR repository for the dashboard image"
  value       = aws_ecr_repository.app.repository_url
}

output "apprunner_service_arn" {
  description = "App Runner service ARN"
  value       = aws_apprunner_service.app.arn
}

output "apprunner_service_url" {
  description = "App Runner default service hostname"
  value       = aws_apprunner_service.app.service_url
}

output "dashboard_url" {
  description = "HTTPS URL for the dashboard (App Runner)"
  value       = "https://${aws_apprunner_service.app.service_url}"
}

output "cognito_user_pool_id" {
  description = "Cognito user pool ID"
  value       = aws_cognito_user_pool.app.id
}

output "cognito_client_id" {
  description = "Cognito app client ID"
  value       = aws_cognito_user_pool_client.app.id
}

output "rds_endpoint" {
  description = "RDS Postgres endpoint hostname"
  value       = aws_db_instance.app.address
}

output "database_secret_arn" {
  description = "Secrets Manager ARN for DATABASE_URL"
  value       = aws_secretsmanager_secret.database_url.arn
}

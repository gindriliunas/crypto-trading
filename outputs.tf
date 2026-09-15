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

output "ecs_cluster_name" {
  description = "ECS cluster name"
  value       = aws_ecs_cluster.app.name
}

output "ecs_service_name" {
  description = "ECS service name"
  value       = aws_ecs_service.app.name
}

output "alb_dns_name" {
  description = "Public ALB DNS name for the dashboard"
  value       = aws_lb.app.dns_name
}

output "dashboard_url" {
  description = "HTTP URL for the dashboard"
  value       = "http://${aws_lb.app.dns_name}"
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

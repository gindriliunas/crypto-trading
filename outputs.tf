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

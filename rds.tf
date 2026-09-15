resource "random_password" "db" {
  length           = 32
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

resource "aws_db_subnet_group" "app" {
  name       = "${local.name}-db"
  subnet_ids = aws_subnet.private[*].id

  tags = {
    Name = "${local.name}-db"
  }
}

resource "aws_db_instance" "app" {
  identifier     = "${local.name}-postgres"
  engine         = "postgres"
  engine_version = "16"

  instance_class        = var.db_instance_class
  allocated_storage     = var.db_allocated_storage
  max_allocated_storage = var.db_allocated_storage * 2

  db_name  = var.db_name
  username = var.db_username
  password = random_password.db.result

  # Not reachable from the internet: private subnets + no public IP.
  # Security group allows TCP 5432 only from the ECS security group.
  db_subnet_group_name   = aws_db_subnet_group.app.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  publicly_accessible    = false
  multi_az               = var.environment == "production"

  storage_encrypted       = true
  backup_retention_period = var.environment == "production" ? 7 : 1
  skip_final_snapshot     = var.environment != "production"
  deletion_protection     = var.environment == "production"
  apply_immediately       = var.environment != "production"

  tags = {
    Name = "${local.name}-postgres"
  }
}

resource "aws_secretsmanager_secret" "database_url" {
  name                    = "${local.name}/database-url"
  recovery_window_in_days = var.environment == "production" ? 7 : 0
}

resource "aws_secretsmanager_secret_version" "database_url" {
  secret_id = aws_secretsmanager_secret.database_url.id
  secret_string = format(
    "postgresql://%s:%s@%s:%s/%s",
    urlencode(var.db_username),
    urlencode(random_password.db.result),
    aws_db_instance.app.address,
    aws_db_instance.app.port,
    var.db_name,
  )
}

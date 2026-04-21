# RDS Subnet Group
resource "aws_db_subnet_group" "main" {
  name       = "expose-${var.environment}-db-subnet-group"
  subnet_ids = var.data_subnet_ids

  tags = {
    Name = "expose-${var.environment}-db-subnet-group"
  }
}

# Prefer existing default DB parameter group when present to avoid
# replacing the provider-managed default groups during adoption.
data "aws_db_parameter_group" "existing" {
  name = var.existing_db_parameter_group_name
}

# Managed parameter group (disabled by default to avoid accidental replacement)
resource "aws_db_parameter_group" "main" {
  count  = 0
  family = "mysql8.0"
  name   = "expose-${var.environment}-db-params"

  parameter {
    name  = "max_connections"
    value = "1000"
  }

  parameter {
    name  = "innodb_buffer_pool_size"
    value = "{DBInstanceClassMemory*3/4}"
  }

  parameter {
    name  = "innodb_log_file_size"
    value = "256M"
  }

  parameter {
    name  = "slow_query_log"
    value = "1"
  }

  parameter {
    name  = "long_query_time"
    value = "1"
  }

  parameter {
    name  = "require_secure_transport"
    value = "ON"
  }

  tags = {
    Name = "expose-${var.environment}-db-params"
  }
}

# RDS Security Group
# If an existing SG ID is provided, use a data source to reference it; otherwise
# create a new SG resource. We use count to make either the resource or the
# data source exist, and expose the chosen ID via `local.rds_sg_id`.
resource "aws_security_group" "rds" {
  # For this environment we will not create a new SG; rely on the
  # provided existing SG. Set count=0 to avoid creating a new SG.
  count  = 0
  name   = "expose-${var.environment}-rds-sg"
  vpc_id = var.vpc_id

  # Default egress (allow all)
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "expose-${var.environment}-rds-sg"
  }

  lifecycle {
    ignore_changes = [ingress, egress]
  }
}

data "aws_security_group" "existing" {
  count = var.existing_rds_security_group_id != "" ? 1 : 0
  id    = var.existing_rds_security_group_id
}

locals {
  rds_sg_id = var.existing_rds_security_group_id != "" ? data.aws_security_group.existing[0].id : aws_security_group.rds[0].id
}

# Allow inbound from designated security groups (API/ECS/etc.)
resource "aws_security_group_rule" "allow_from_sgs" {
  count                     = length(var.allowed_source_security_group_ids)
  type                      = "ingress"
  from_port                 = 3306
  to_port                   = 3306
  protocol                  = "tcp"
  security_group_id         = local.rds_sg_id
  source_security_group_id  = var.allowed_source_security_group_ids[count.index]
  description               = "Allow DB access from authorised security groups"
}

# Allow inbound from administrative CIDRs (use sparingly)
resource "aws_security_group_rule" "allow_from_admin_cidrs" {
  count             = length(var.allowed_admin_cidrs)
  type              = "ingress"
  from_port         = 3306
  to_port           = 3306
  protocol          = "tcp"
  security_group_id = local.rds_sg_id
  cidr_blocks       = [var.allowed_admin_cidrs[count.index]]
  description       = "Admin access to DB from specific CIDR"
}

# RDS Instance
resource "aws_db_instance" "main" {
  identifier = "expose-${var.environment}-db"

  # Engine configuration
  engine         = "mysql"
  engine_version = "8.0.36"
  instance_class = var.db_instance_class

  # Database configuration
  db_name  = var.db_name
  username = var.db_username
  password = var.db_password

  # Storage configuration
  allocated_storage     = var.db_allocated_storage
  max_allocated_storage = var.db_allocated_storage * 2
  storage_type          = "gp3"
  storage_encrypted     = true
  kms_key_id           = aws_kms_key.rds.arn

  # Network configuration
  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [local.rds_sg_id]
  # Match current instance configuration (currently public) to avoid
  # Terraform attempting to replace the instance during import/first apply.
  # After import and verification we can change this to 'false' and apply
  # to remove public accessibility in a controlled change window.
  publicly_accessible    = true
  multi_az              = var.multi_az

  # Backup configuration
  backup_retention_period = 35
  backup_window          = "03:00-04:00"
  maintenance_window     = "sun:04:00-sun:05:00"

  # Monitoring
  monitoring_interval = 60
  monitoring_role_arn = aws_iam_role.rds_enhanced_monitoring.arn

  # Performance Insights
  performance_insights_enabled    = true
  performance_insights_kms_key_id = aws_kms_key.rds.arn

  # Additional configuration
  parameter_group_name = local.effective_parameter_group_name
  option_group_name    = local.effective_option_group_name

  # Enable IAM database authentication if requested
  iam_database_authentication_enabled = var.iam_database_authentication_enabled

  # Deletion protection (enable in production)
  deletion_protection = var.environment == "production"

  tags = {
    Name = "expose-${var.environment}-db"
  }

  lifecycle {
    # When we import an existing RDS instance, many attributes (engine, username,
    # parameter/option groups, publicly_accessible, etc.) may differ from the
    # values in this module. Ignoring changes for these attributes prevents
    # Terraform from attempting to replace the instance on first apply while we
    # transition management of network/Security Group settings.
    ignore_changes = [
      engine_version,
      username,
      db_name,
      parameter_group_name,
      option_group_name,
      publicly_accessible,
      allocated_storage,
      instance_class,
      kms_key_id,
      performance_insights_kms_key_id,
    ]
  }
  depends_on = [
    aws_iam_role_policy_attachment.rds_enhanced_monitoring,
    aws_db_option_group.main
  ]
}

# Read Replica (for production workloads)
resource "aws_db_instance" "read_replica" {
  count = var.environment == "production" ? 1 : 0

  identifier = "expose-${var.environment}-db-read"

  # Replica configuration
  replicate_source_db = aws_db_instance.main.identifier
  instance_class      = var.db_instance_class

  # Storage (automatically managed for replicas)
  storage_encrypted = true
  kms_key_id       = aws_kms_key.rds.arn

  # Network configuration
  vpc_security_group_ids = [local.rds_sg_id]
  publicly_accessible    = false

  # Backup (replicas don't have backups)
  backup_retention_period = 0

  # Monitoring
  monitoring_interval = 60
  monitoring_role_arn = aws_iam_role.rds_enhanced_monitoring.arn

  # Performance Insights
  performance_insights_enabled    = true
  performance_insights_kms_key_id = aws_kms_key.rds.arn

  tags = {
    Name = "expose-${var.environment}-db-read"
  }
}

# KMS Key for RDS encryption
resource "aws_kms_key" "rds" {
  description             = "KMS key for RDS encryption"
  deletion_window_in_days = 30

  tags = {
    Name = "expose-${var.environment}-rds-key"
  }
}

resource "aws_kms_alias" "rds" {
  name          = "alias/expose-${var.environment}-rds"
  target_key_id = aws_kms_key.rds.key_id
}

# IAM Role for RDS Enhanced Monitoring
resource "aws_iam_role" "rds_enhanced_monitoring" {
  name = "expose-${var.environment}-rds-enhanced-monitoring"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "monitoring.rds.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name = "expose-${var.environment}-rds-monitoring-role"
  }
}

resource "aws_iam_role_policy_attachment" "rds_enhanced_monitoring" {
  role       = aws_iam_role.rds_enhanced_monitoring.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"
}

# Prefer existing default DB option group when present
# Managed option group (disabled by default)
resource "aws_db_option_group" "main" {
  count                = 0
  name                 = "expose-${var.environment}-db-options"
  engine_name          = "mysql"
  major_engine_version = "8.0"

  option {
    option_name = "MARIADB_AUDIT_PLUGIN"

    option_settings {
      name  = "SERVER_AUDIT_EVENTS"
      value = "CONNECT,QUERY"
    }
  }
}

# Effective names for parameter and option groups: prefer existing defaults
locals {
  effective_parameter_group_name = try(data.aws_db_parameter_group.existing.name, aws_db_parameter_group.main[0].name)
  effective_option_group_name    = var.existing_db_option_group_name != "" ? var.existing_db_option_group_name : aws_db_option_group.main[0].name
}
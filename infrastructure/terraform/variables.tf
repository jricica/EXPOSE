# AWS Configuration
variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-2"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "production"
}

# VPC Configuration
variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "availability_zones" {
  description = "Availability zones"
  type        = list(string)
  default     = ["us-east-2a", "us-east-2b"]
}

variable "public_subnet_cidrs" {
  description = "CIDR blocks for public subnets"
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24"]
}

variable "private_subnet_cidrs" {
  description = "CIDR blocks for private subnets"
  type        = list(string)
  default     = ["10.0.10.0/24", "10.0.20.0/24"]
}

variable "data_subnet_cidrs" {
  description = "CIDR blocks for data subnets"
  type        = list(string)
  default     = ["10.0.100.0/24", "10.0.101.0/24"]
}

# RDS Configuration
variable "db_name" {
  description = "Database name"
  type        = string
  default     = "expose"
}

variable "db_username" {
  description = "Database username"
  type        = string
  default     = "expose_user"
}

variable "db_password" {
  description = "Database password"
  type        = string
  sensitive   = true
}

variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.r5.large"
}

variable "db_allocated_storage" {
  description = "Allocated storage in GB"
  type        = number
  default     = 100
}

variable "multi_az" {
  description = "Enable Multi-AZ deployment"
  type        = bool
  default     = true
}

# Redis Configuration
variable "redis_node_type" {
  description = "Redis node type"
  type        = string
  default     = "cache.t4g.micro"
}

variable "redis_num_cache_nodes" {
  description = "Number of Redis cache nodes"
  type        = number
  default     = 1
}

# S3 Configuration
variable "s3_bucket_name" {
  description = "S3 bucket name for media storage"
  type        = string
  default     = "expose-media-bucket"
}

# ECS Configuration
variable "container_image" {
  description = "Container image URI"
  type        = string
  default     = "829350946816.dkr.ecr.us-east-2.amazonaws.com/expose-backend:latest"
}

variable "container_port" {
  description = "Container port"
  type        = number
  default     = 3000
}

variable "desired_count" {
  description = "Desired number of ECS tasks"
  type        = number
  default     = 2
}

variable "cpu" {
  description = "CPU units for ECS task"
  type        = string
  default     = "512"
}

variable "memory" {
  description = "Memory for ECS task"
  type        = string
  default     = "1024"
}

# SSL Certificate
variable "certificate_arn" {
  description = "ARN of SSL certificate in ACM"
  type        = string
  default     = ""
}

# Tightening RDS access
variable "db_allowed_security_group_ids" {
  description = "Security groups allowed to connect to RDS (e.g. ECS/ALB SGs)"
  type        = list(string)
  default     = []
}

variable "db_admin_allowed_cidrs" {
  description = "CIDR blocks allowed for short-term administrative DB access"
  type        = list(string)
  default     = []
}

variable "iam_database_authentication_enabled" {
  description = "Enable IAM DB Authentication for RDS"
  type        = bool
  default     = true
}

# Secrets
variable "jwt_secret" {
  description = "JWT secret key"
  type        = string
  sensitive   = true
}

variable "sentry_dsn" {
  description = "Sentry DSN"
  type        = string
  sensitive   = true
  default     = "https://46a5b92063fd5cb777eb8eea33f9fb4b@o4510751779192832.ingest.us.sentry.io/4510751781158912"
}

variable "rds_publicly_accessible" {
  type    = bool
  default = false
}

variable "db_allowed_security_group_ids" {
  type    = list(string)
  default = []
}
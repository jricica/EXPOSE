variable "vpc_id" {
  description = "VPC ID"
  type        = string
}

variable "vpc_cidr" {
  description = "VPC CIDR block"
  type        = string
}

variable "data_subnet_ids" {
  description = "Data subnet IDs"
  type        = list(string)
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "db_name" {
  description = "Database name"
  type        = string
}

variable "db_username" {
  description = "Database username"
  type        = string
}

variable "db_password" {
  description = "Database password"
  type        = string
  sensitive   = true
}

variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
}

variable "db_allocated_storage" {
  description = "Allocated storage in GB"
  type        = number
}

variable "multi_az" {
  description = "Enable Multi-AZ deployment"
  type        = bool
}

variable "allowed_source_security_group_ids" {
  description = "List of security group IDs allowed to connect to the DB (e.g. API/ECS/ALB SGs)"
  type        = list(string)
  default     = []
}

variable "allowed_admin_cidrs" {
  description = "List of CIDR blocks allowed for short-term administrative access (use sparingly)"
  type        = list(string)
  default     = []
}

variable "iam_database_authentication_enabled" {
  description = "Enable IAM DB Authentication"
  type        = bool
  default     = true
}
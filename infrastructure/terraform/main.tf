terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Store state in S3 (recommended for production)
  backend "s3" {
    bucket         = "expose-terraform-state"
    key            = "expose-backend/terraform.tfstate"
    region         = "us-east-2"
    encrypt        = true
    dynamodb_table = "expose-terraform-locks"
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "EXPOSE"
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  }
}

# Data source for current AWS account
data "aws_caller_identity" "current" {}

# VPC Configuration
module "vpc" {
  source = "./modules/vpc"

  vpc_cidr             = var.vpc_cidr
  environment          = var.environment
  availability_zones   = var.availability_zones
  public_subnet_cidrs  = var.public_subnet_cidrs
  private_subnet_cidrs = var.private_subnet_cidrs
  data_subnet_cidrs    = var.data_subnet_cidrs
}

# RDS MySQL Database
module "rds" {
  source = "./modules/rds"

  vpc_id               = module.vpc.vpc_id
  vpc_cidr             = var.vpc_cidr
  data_subnet_ids      = module.vpc.data_subnet_ids
  environment          = var.environment
  db_name              = var.db_name
  db_username          = var.db_username
  db_password          = var.db_password
  db_instance_class    = var.db_instance_class
  db_allocated_storage = var.db_allocated_storage
  multi_az             = var.multi_az
}

# DynamoDB Tables
module "dynamodb" {
  source = "./modules/dynamodb"

  environment = var.environment
}

# ElastiCache Redis
module "elasticache" {
  source = "./modules/elasticache"

  vpc_id            = module.vpc.vpc_id
  data_subnet_ids   = module.vpc.data_subnet_ids
  environment       = var.environment
  node_type         = var.redis_node_type
  num_cache_nodes   = var.redis_num_cache_nodes
}

# S3 Bucket for Media Storage
module "s3" {
  source = "./modules/s3"

  environment = var.environment
  bucket_name = var.s3_bucket_name
}

# ECS Cluster and Services
module "ecs" {
  source = "./modules/ecs"

  vpc_id             = module.vpc.vpc_id
  public_subnet_ids  = module.vpc.public_subnet_ids
  private_subnet_ids = module.vpc.private_subnet_ids
  environment        = var.environment
  account_id         = data.aws_caller_identity.current.account_id
  region             = var.aws_region

  # Container configuration
  container_image    = var.container_image
  container_port     = var.container_port
  desired_count      = var.desired_count
  cpu                = var.cpu
  memory             = var.memory

  # Database configuration
  db_host            = module.rds.db_endpoint
  db_name            = var.db_name
  db_username        = var.db_username
  db_password        = var.db_password

  # Redis configuration
  redis_endpoint     = module.elasticache.redis_endpoint

  # S3 configuration
  s3_bucket_name     = var.s3_bucket_name

  # Secrets
  jwt_secret         = var.jwt_secret
  sentry_dsn         = var.sentry_dsn
}

# Application Load Balancer
module "alb" {
  source = "./modules/alb"

  vpc_id            = module.vpc.vpc_id
  public_subnet_ids = module.vpc.public_subnet_ids
  environment       = var.environment
  certificate_arn   = var.certificate_arn
  ecs_security_group_id = module.ecs.ecs_security_group_id
}

# CloudFront Distribution
module "cloudfront" {
  source = "./modules/cloudfront"

  s3_bucket_domain_name = module.s3.bucket_domain_name
  s3_bucket_id         = module.s3.bucket_id
  alb_domain_name      = module.alb.alb_dns_name
  certificate_arn      = var.certificate_arn
  environment          = var.environment
}

# CloudWatch Monitoring
module "cloudwatch" {
  source = "./modules/cloudwatch"

  environment = var.environment
  ecs_cluster_name = module.ecs.cluster_name
  ecs_service_name = module.ecs.service_name
  rds_instance_id  = module.rds.db_instance_id
  alb_arn_suffix   = module.alb.alb_arn_suffix
}

# IAM Roles and Policies
module "iam" {
  source = "./modules/iam"

  environment = var.environment
  s3_bucket_arn = module.s3.bucket_arn
}

# Outputs
output "vpc_id" {
  description = "VPC ID"
  value       = module.vpc.vpc_id
}

output "rds_endpoint" {
  description = "RDS endpoint"
  value       = module.rds.db_endpoint
  sensitive   = true
}

output "alb_dns_name" {
  description = "ALB DNS name"
  value       = module.alb.alb_dns_name
}

output "cloudfront_domain_name" {
  description = "CloudFront distribution domain name"
  value       = module.cloudfront.domain_name
}

output "ecs_cluster_name" {
  description = "ECS cluster name"
  value       = module.ecs.cluster_name
}

output "s3_bucket_name" {
  description = "S3 bucket name"
  value       = module.s3.bucket_name
}
# AWS Configuration
aws_region  = "us-east-2"
environment = "development"

# VPC Configuration
vpc_cidr             = "10.0.0.0/16"
availability_zones   = ["us-east-2a", "us-east-2b"]
public_subnet_cidrs  = ["10.0.1.0/24", "10.0.2.0/24"]
private_subnet_cidrs = ["10.0.10.0/24", "10.0.20.0/24"]
data_subnet_cidrs    = ["10.0.100.0/24", "10.0.101.0/24"]

# RDS Configuration
db_name              = "expose"
db_username          = "expose_user"
db_password          = "CHANGE_THIS_STRONG_PASSWORD"
db_instance_class    = "db.t4g.micro"  # Smaller instance for development
db_allocated_storage = 20
multi_az             = false
db_allowed_security_group_ids = ["sg-07e51aa3ebaa7d2d2"]
db_admin_allowed_cidrs = ["181.174.93.109/32"]   # opcional
iam_database_authentication_enabled = true

# Redis Configuration
redis_node_type       = "cache.t4g.micro"
redis_num_cache_nodes = 1

# S3 Configuration
s3_bucket_name = "expose-media-dev"

# ECS Configuration
container_image = "829350946816.dkr.ecr.us-east-2.amazonaws.com/expose-backend:latest"
container_port  = 3000
desired_count   = 1
cpu             = "256"
memory          = "512"

# SSL Certificate (leave empty for development)
certificate_arn = ""

# Secrets (CHANGE THESE!)
jwt_secret = "CHANGE_THIS_JWT_SECRET_IN_PRODUCTION"
sentry_dsn = "https://46a5b92063fd5cb777eb8eea33f9fb4b@o4510751779192832.ingest.us.sentry.io/4510751781158912"
#!/bin/bash

# EXPOSE Infrastructure Setup Script
# This script helps set up the complete AWS infrastructure for EXPOSE backend

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
REGION="us-east-2"
ACCOUNT_ID="829350946816"
ENVIRONMENT="development"
PROJECT_NAME="expose"

echo -e "${BLUE}🚀 EXPOSE AWS Infrastructure Setup${NC}"
echo -e "${BLUE}=====================================${NC}"

# Function to check prerequisites
check_prerequisites() {
    echo -e "\n${YELLOW}📋 Checking prerequisites...${NC}"

    # Check AWS CLI
    if ! command -v aws &> /dev/null; then
        echo -e "${RED}❌ AWS CLI is not installed. Please install it first.${NC}"
        exit 1
    fi
    echo -e "${GREEN}✅ AWS CLI found$(aws --version)${NC}"

    # Check Terraform
    if ! command -v terraform &> /dev/null; then
        echo -e "${RED}❌ Terraform is not installed. Please install it from https://terraform.io${NC}"
        exit 1
    fi
    echo -e "${GREEN}✅ Terraform found$(terraform version)${NC}"

    # Check Docker
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}❌ Docker is not installed. Please install it first.${NC}"
        exit 1
    fi
    echo -e "${GREEN}✅ Docker found$(docker --version)${NC}"

    # Check AWS credentials
    if ! aws sts get-caller-identity &> /dev/null; then
        echo -e "${RED}❌ AWS credentials not configured. Run 'aws configure' first.${NC}"
        exit 1
    fi
    echo -e "${GREEN}✅ AWS credentials configured${NC}"
}

# Function to create S3 bucket for Terraform state
create_terraform_state() {
    echo -e "\n${YELLOW}📦 Creating Terraform state storage...${NC}"

    STATE_BUCKET="${PROJECT_NAME}-terraform-state"

    # Create S3 bucket
    if aws s3 ls "s3://${STATE_BUCKET}" 2>&1 | grep -q 'NoSuchBucket'; then
        aws s3 mb "s3://${STATE_BUCKET}" --region "${REGION}"
        echo -e "${GREEN}✅ Created S3 bucket: ${STATE_BUCKET}${NC}"
    else
        echo -e "${GREEN}✅ S3 bucket already exists: ${STATE_BUCKET}${NC}"
    fi

    # Create DynamoDB table for locks
    LOCK_TABLE="${PROJECT_NAME}-terraform-locks"
    if ! aws dynamodb describe-table --table-name "${LOCK_TABLE}" --region "${REGION}" &> /dev/null; then
        aws dynamodb create-table \
            --table-name "${LOCK_TABLE}" \
            --attribute-definitions AttributeName=LockID,AttributeType=S \
            --key-schema AttributeName=LockID,KeyType=HASH \
            --billing-mode PAY_PER_REQUEST \
            --region "${REGION}"
        echo -e "${GREEN}✅ Created DynamoDB lock table: ${LOCK_TABLE}${NC}"
    else
        echo -e "${GREEN}✅ DynamoDB lock table already exists: ${LOCK_TABLE}${NC}"
    fi
}

# Function to create ECR repository
create_ecr_repository() {
    echo -e "\n${YELLOW}🐳 Creating ECR repository...${NC}"

    REPO_NAME="${PROJECT_NAME}-backend"

    if ! aws ecr describe-repositories --repository-names "${REPO_NAME}" --region "${REGION}" &> /dev/null; then
        aws ecr create-repository \
            --repository-name "${REPO_NAME}" \
            --region "${REGION}" \
            --image-scanning-configuration scanOnPush=true
        echo -e "${GREEN}✅ Created ECR repository: ${REPO_NAME}${NC}"
    else
        echo -e "${GREEN}✅ ECR repository already exists: ${REPO_NAME}${NC}"
    fi

    # Login to ECR
    echo -e "${YELLOW}🔐 Logging into ECR...${NC}"
    aws ecr get-login-password --region "${REGION}" | docker login --username AWS --password-stdin "${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com"
    echo -e "${GREEN}✅ Logged into ECR${NC}"
}

# Function to setup Terraform
setup_terraform() {
    echo -e "\n${YELLOW}🏗️ Setting up Terraform...${NC}"

    cd infrastructure/terraform

    # Initialize Terraform
    terraform init
    echo -e "${GREEN}✅ Terraform initialized${NC}"

    # Copy example variables if terraform.tfvars doesn't exist
    if [ ! -f "terraform.tfvars" ]; then
        cp terraform.tfvars.example terraform.tfvars
        echo -e "${YELLOW}⚠️  Created terraform.tfvars from example. Please edit it with your values!${NC}"
        echo -e "${YELLOW}   Especially: db_password, jwt_secret${NC}"
    fi

    cd ../..
}

# Function to build and push Docker image
build_and_push_image() {
    echo -e "\n${YELLOW}🏗️ Building and pushing Docker image...${NC}"

    cd backend

    # Build image
    echo -e "${YELLOW}🔨 Building Docker image...${NC}"
    docker build -t "${PROJECT_NAME}-backend" .

    # Tag image
    IMAGE_URI="${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/${PROJECT_NAME}-backend:latest"
    docker tag "${PROJECT_NAME}-backend:latest" "${IMAGE_URI}"

    # Push image
    echo -e "${YELLOW}📤 Pushing image to ECR...${NC}"
    docker push "${IMAGE_URI}"

    echo -e "${GREEN}✅ Image pushed: ${IMAGE_URI}${NC}"

    cd ..
}

# Function to deploy infrastructure
deploy_infrastructure() {
    echo -e "\n${YELLOW}🚀 Deploying infrastructure...${NC}"

    cd infrastructure/terraform

    # Plan
    echo -e "${YELLOW}📋 Planning deployment...${NC}"
    terraform plan -out=tfplan

    # Ask for confirmation
    echo -e "\n${YELLOW}⚠️  This will create AWS resources that may incur costs.${NC}"
    read -p "Do you want to continue? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}Deployment cancelled.${NC}"
        exit 0
    fi

    # Apply
    echo -e "${YELLOW}🏗️ Applying infrastructure...${NC}"
    terraform apply tfplan

    echo -e "${GREEN}✅ Infrastructure deployed!${NC}"

    cd ../..
}

# Function to show next steps
show_next_steps() {
    echo -e "\n${GREEN}🎉 Setup complete!${NC}"
    echo -e "${BLUE}==============================${NC}"
    echo -e "${YELLOW}Next steps:${NC}"
    echo -e "1. ${BLUE}Edit infrastructure/terraform/terraform.tfvars${NC} with your actual values"
    echo -e "2. ${BLUE}Run database migrations:${NC} cd backend && npm run db:migrate:deploy"
    echo -e "3. ${BLUE}Seed the database:${NC} cd backend && npm run db:seed"
    echo -e "4. ${BLUE}Test the API:${NC} curl \$(terraform output -raw alb_dns_name)/api/health"
    echo -e "5. ${BLUE}Monitor logs:${NC} aws logs tail /aws/ecs/expose-${ENVIRONMENT}-app --follow"
    echo -e "\n${YELLOW}Useful commands:${NC}"
    echo -e "• ${BLUE}View ECS service:${NC} aws ecs describe-services --cluster expose-${ENVIRONMENT} --services expose-backend-service"
    echo -e "• ${BLUE}Scale service:${NC} aws ecs update-service --cluster expose-${ENVIRONMENT} --service expose-backend-service --desired-count 2"
    echo -e "• ${BLUE}View RDS:${NC} aws rds describe-db-instances --db-instance-identifier expose-${ENVIRONMENT}-db"
}

# Main execution
main() {
    check_prerequisites
    create_terraform_state
    create_ecr_repository
    setup_terraform

    echo -e "\n${YELLOW}Choose deployment option:${NC}"
    echo -e "1. ${BLUE}Full deployment${NC} (build image + deploy infra)"
    echo -e "2. ${BLUE}Infrastructure only${NC} (skip image build)"
    echo -e "3. ${BLUE}Image only${NC} (build and push image only)"
    read -p "Enter choice (1-3): " choice

    case $choice in
        1)
            build_and_push_image
            deploy_infrastructure
            ;;
        2)
            deploy_infrastructure
            ;;
        3)
            build_and_push_image
            ;;
        *)
            echo -e "${RED}Invalid choice. Exiting.${NC}"
            exit 1
            ;;
    esac

    show_next_steps
}

# Run main function
main "$@"
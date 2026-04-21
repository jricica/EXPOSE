#!/bin/bash

###############################################################################
# EXPOSE Deploy Script
# 
# Standardized deployment for dev, staging, and prod environments
# Usage: ./deploy.sh [dev|staging|prod] [--dry-run] [--skip-tests]
#
# This script:
# 1. Validates environment configuration
# 2. Runs tests (unless --skip-tests)
# 3. Builds Docker image
# 4. Pushes to ECR
# 5. Updates ECS/Infrastructure
# 6. Monitors deployment
###############################################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR=\"$(cd \"$(dirname \"${BASH_SOURCE[0]}\")\" && pwd)\"
PROJECT_ROOT=\"$(cd \"${SCRIPT_DIR}/..\" && pwd)\"
BACKEND_DIR=\"${PROJECT_ROOT}/backend\"
INFRASTRUCTURE_DIR=\"${PROJECT_ROOT}/infrastructure\"

ACCOUNT_ID=\"829350946816\"
REGION=\"us-east-2\"
PROJECT_NAME=\"expose\"
IMAGE_REPO=\"${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/${PROJECT_NAME}-backend\"

# Default values
ENVIRONMENT=\"\"
DRY_RUN=false
SKIP_TESTS=false
SKIP_BUILD=false
VERSION=\"\"

# Functions
log_info() {
    echo -e \"${BLUE}ℹ️  $1${NC}\"
}

log_success() {
    echo -e \"${GREEN}✅ $1${NC}\"
}

log_warn() {
    echo -e \"${YELLOW}⚠️  $1${NC}\"
}

log_error() {
    echo -e \"${RED}❌ $1${NC}\"
}

print_usage() {
    cat << EOF
Usage: $0 [dev|staging|prod] [OPTIONS]

OPTIONS:
    --dry-run           Show what would be deployed without making changes
    --skip-tests        Skip running tests
    --skip-build        Skip building image (use existing)
    --help              Show this help message

EXAMPLES:
    ./deploy.sh dev
    ./deploy.sh staging --dry-run
    ./deploy.sh prod --skip-tests

EOF
}

# Parse arguments
parse_args() {
    if [[ $# -lt 1 ]]; then
        log_error \"Environment argument required\"
        print_usage
        exit 1
    fi

    ENVIRONMENT=\"$1\"
    shift

    while [[ $# -gt 0 ]]; do
        case $1 in
            --dry-run)
                DRY_RUN=true
                log_warn \"DRY RUN MODE - No changes will be made\"
                shift
                ;;
            --skip-tests)
                SKIP_TESTS=true
                shift
                ;;
            --skip-build)
                SKIP_BUILD=true
                shift
                ;;
            --help)
                print_usage
                exit 0
                ;;
            *)
                log_error \"Unknown option: $1\"
                print_usage
                exit 1
                ;;
        esac
    done

    # Validate environment
    if [[ ! \"dev\" \"staging\" \"prod\" =~ \"$ENVIRONMENT\" ]]; then
        log_error \"Invalid environment: $ENVIRONMENT\"
        print_usage
        exit 1
    fi
}

# Validate prerequisites
validate_prerequisites() {
    log_info \"Validating prerequisites...\"

    # Check AWS CLI
    if ! command -v aws &> /dev/null; then
        log_error \"AWS CLI is not installed\"
        exit 1
    fi

    # Check Docker
    if ! command -v docker &> /dev/null; then
        log_error \"Docker is not installed\"
        exit 1
    fi

    # Check AWS credentials
    if ! aws sts get-caller-identity &> /dev/null; then
        log_error \"AWS credentials not configured\"
        exit 1
    fi

    # Check Git
    if ! command -v git &> /dev/null; then
        log_error \"Git is not installed\"
        exit 1
    fi

    log_success \"All prerequisites met\"
}

# Load environment configuration
load_env_config() {
    log_info \"Loading environment configuration for $ENVIRONMENT...\"

    ENV_FILE=\"${BACKEND_DIR}/.env.${ENVIRONMENT}\"
    if [[ ! -f \"$ENV_FILE\" ]]; then
        log_error \"Environment file not found: $ENV_FILE\"
        exit 1
    fi

    # Source the environment file
    set -a
    source \"$ENV_FILE\"
    set +a

    log_success \"Environment configuration loaded\"
}

# Get current Git commit
get_git_info() {
    GIT_COMMIT=\"\$(git -C \"${PROJECT_ROOT}\" rev-parse --short HEAD)\"
    GIT_BRANCH=\"\$(git -C \"${PROJECT_ROOT}\" rev-parse --abbrev-ref HEAD)\"
    GIT_TAG=\"\$(git -C \"${PROJECT_ROOT}\" describe --tags --exact-match 2>/dev/null || echo \"\")\"
    VERSION=\"${GIT_TAG:-${GIT_BRANCH}-${GIT_COMMIT}}\"

    log_info \"Git info: Branch=$GIT_BRANCH, Commit=$GIT_COMMIT, Version=$VERSION\"
}

# Run tests
run_tests() {
    if [[ \"$SKIP_TESTS\" == true ]]; then
        log_warn \"Skipping tests (--skip-tests)\"
        return 0
    fi

    log_info \"Running tests...\"

    cd \"${BACKEND_DIR}\"
    if npm test -- --passWithNoTests; then
        log_success \"Tests passed\"
    else
        log_error \"Tests failed\"
        exit 1
    fi
}

# Build Docker image
build_image() {
    if [[ \"$SKIP_BUILD\" == true ]]; then
        log_warn \"Skipping image build (--skip-build)\"
        IMAGE_TAG=\"${IMAGE_REPO}:${VERSION}\"
        log_info \"Using existing image: $IMAGE_TAG\"
        return 0
    fi

    log_info \"Building Docker image...\"

    IMAGE_TAG=\"${IMAGE_REPO}:${VERSION}\"
    
    if [[ \"$DRY_RUN\" == true ]]; then
        log_info \"[DRY-RUN] Would build: $IMAGE_TAG\"
        return 0
    fi

    cd \"${BACKEND_DIR}\"
    if docker build -t \"$IMAGE_TAG\" -t \"${IMAGE_REPO}:latest\" .; then
        log_success \"Image built successfully: $IMAGE_TAG\"
    else
        log_error \"Image build failed\"
        exit 1
    fi
}

# Push image to ECR
push_image() {
    log_info \"Pushing image to ECR...\"

    if [[ \"$DRY_RUN\" == true ]]; then
        log_info \"[DRY-RUN] Would push: $IMAGE_TAG\"
        return 0
    fi

    # Login to ECR
    aws ecr get-login-password --region \"$REGION\" | \
        docker login --username AWS --password-stdin \"${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com\"

    # Push image
    if docker push \"$IMAGE_TAG\" && docker push \"${IMAGE_REPO}:latest\"; then
        log_success \"Image pushed successfully\"
    else
        log_error \"Failed to push image\"
        exit 1
    fi
}

# Validate Terraform configuration
validate_terraform() {
    log_info \"Validating Terraform configuration...\"

    TFVARS_FILE=\"${INFRASTRUCTURE_DIR}/environments/terraform.tfvars.${ENVIRONMENT}\"
    if [[ ! -f \"$TFVARS_FILE\" ]]; then
        log_error \"Terraform vars file not found: $TFVARS_FILE\"
        exit 1
    fi

    cd \"${INFRASTRUCTURE_DIR}/terraform\"
    
    if [[ \"$DRY_RUN\" == true ]]; then
        log_info \"[DRY-RUN] Would validate Terraform\"
        return 0
    fi

    if terraform validate; then
        log_success \"Terraform validation passed\"
    else
        log_error \"Terraform validation failed\"
        exit 1
    fi
}

# Deploy using Terraform
deploy_infrastructure() {
    log_info \"Deploying infrastructure for $ENVIRONMENT...\"

    TFVARS_FILE=\"${INFRASTRUCTURE_DIR}/environments/terraform.tfvars.${ENVIRONMENT}\"
    
    cd \"${INFRASTRUCTURE_DIR}/terraform\"

    if [[ \"$DRY_RUN\" == true ]]; then
        log_info \"[DRY-RUN] Running terraform plan\"
        terraform plan -var-file=\"$TFVARS_FILE\" -var=\"container_image=$IMAGE_TAG\"
        return 0
    fi

    # Initialize Terraform
    terraform init -backend-config=\"key=expose-backend/${ENVIRONMENT}/terraform.tfstate\"

    # Plan
    log_info \"Planning infrastructure changes...\"
    if ! terraform plan \
        -var-file=\"$TFVARS_FILE\" \
        -var=\"container_image=$IMAGE_TAG\" \
        -out=tfplan; then
        log_error \"Terraform plan failed\"
        exit 1
    fi

    # Ask for confirmation (not in CI/CD)
    if [[ \"$CI\" != true ]]; then
        read -p \"$(echo -e ${YELLOW}Apply infrastructure changes? [y/N]${NC} )\" -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_warn \"Deploy cancelled\"
            exit 1
        fi
    fi

    # Apply
    log_info \"Applying infrastructure changes...\"
    if terraform apply -auto-approve tfplan; then
        log_success \"Infrastructure deployed successfully\"
    else
        log_error \"Terraform apply failed\"
        exit 1
    fi
}

# Monitor deployment
monitor_deployment() {
    log_info \"Monitoring deployment...\"

    # Get ECS cluster and service
    CLUSTER_NAME=\"expose-${ENVIRONMENT}\"
    SERVICE_NAME=\"expose-backend-${ENVIRONMENT}\"

    if [[ \"$DRY_RUN\" == true ]]; then
        log_info \"[DRY-RUN] Would monitor service: $SERVICE_NAME\"
        return 0
    fi

    # Wait for service to stabilize (max 5 minutes)
    TIMEOUT=300
    INTERVAL=10
    ELAPSED=0

    while [ $ELAPSED -lt $TIMEOUT ]; do
        STATUS=\$(aws ecs describe-services \
            --cluster \"$CLUSTER_NAME\" \
            --services \"$SERVICE_NAME\" \
            --region \"$REGION\" \
            --query 'services[0].deployments[0].status' \
            --output text 2>/dev/null || echo \"UNKNOWN\")

        if [[ \"$STATUS\" == \"PRIMARY\" ]]; then
            log_success \"Deployment completed successfully\"
            return 0
        fi

        echo -ne \"\\rDeployment status: $STATUS (${ELAPSED}s)\"
        sleep $INTERVAL
        ELAPSED=$((ELAPSED + INTERVAL))
    done

    log_warn \"Deployment monitoring timed out (check AWS console)\"
}

# Send notification
send_notification() {
    log_info \"Sending deployment notification...\"
    
    # Placeholder for Slack/email notification
    # Example: curl -X POST -H 'Content-type: application/json' --data '{...}' \$SLACK_WEBHOOK
    
    log_success \"Deployment completed for $ENVIRONMENT\"
}

# Main execution
main() {
    echo \"\"
    log_info \"========================================\"
    log_info \"EXPOSE Deploy Script\"
    log_info \"========================================\"
    echo \"\"

    parse_args \"$@\"
    validate_prerequisites
    load_env_config
    get_git_info
    run_tests
    build_image
    push_image
    validate_terraform
    deploy_infrastructure
    monitor_deployment
    send_notification

    echo \"\"
    log_success \"✨ Deployment to $ENVIRONMENT completed!\"
    echo \"\"
}

# Run main function
main \"$@\"

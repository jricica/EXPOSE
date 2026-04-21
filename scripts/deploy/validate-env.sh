#!/bin/bash

###############################################################################
# Validate Environment Configuration
# 
# Checks that all required files and configurations are in place for a given
# environment (dev, staging, prod)
#
# Usage: ./validate-env.sh [dev|staging|prod|all]
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

# Counters
ERRORS=0
WARNINGS=0

log_info() {
    echo -e \"${BLUE}ℹ️  $1${NC}\"
}

log_success() {
    echo -e \"${GREEN}✅ $1${NC}\"
}

log_warn() {
    echo -e \"${YELLOW}⚠️  $1${NC}\"
    WARNINGS=$((WARNINGS + 1))
}

log_error() {
    echo -e \"${RED}❌ $1${NC}\"
    ERRORS=$((ERRORS + 1))
}

# Check .env files
check_env_files() {
    local env=$1
    log_info \"Checking .env files for $env...\"

    local env_file=\"${BACKEND_DIR}/.env.${env}\"
    
    if [[ ! -f \"$env_file\" ]]; then
        log_error \"Missing: $env_file\"
        return 1
    fi

    log_success \"Found: .env.$env\"

    # Check for common required variables
    local required_vars=(
        \"NODE_ENV\"
        \"APP_NAME\"
        \"DB_HOST\"
        \"DB_NAME\"
        \"JWT_SECRET\"
        \"AWS_REGION\"
        \"S3_BUCKET\"
    )

    for var in \"${required_vars[@]}\"; do
        if grep -q \"^${var}=\" \"$env_file\"; then
            log_success \"  ✓ $var defined\"
        else
            log_error \"  ✗ Missing variable: $var\"
        fi
    done
}

# Check Terraform variables
check_terraform_vars() {
    local env=$1
    log_info \"Checking Terraform variables for $env...\"

    local tfvars_file=\"${INFRASTRUCTURE_DIR}/environments/terraform.tfvars.${env}\"
    
    if [[ ! -f \"$tfvars_file\" ]]; then
        log_error \"Missing: $tfvars_file\"
        return 1
    fi

    log_success \"Found: terraform.tfvars.$env\"

    # Check required Terraform variables
    local required_vars=(
        \"aws_region\"
        \"environment\"
        \"db_instance_class\"
        \"container_port\"
        \"desired_count\"
    )

    for var in \"${required_vars[@]}\"; do
        if grep -q \"^${var}\" \"$tfvars_file\"; then
            log_success \"  ✓ $var defined\"
        else
            log_error \"  ✗ Missing variable: $var\"
        fi
    done
}

# Check AWS credentials
check_aws_credentials() {
    log_info \"Checking AWS credentials...\"

    if aws sts get-caller-identity > /dev/null 2>&1; then
        ACCOUNT_ID=\$(aws sts get-caller-identity --query Account --output text)
        log_success \"AWS credentials valid (Account: $ACCOUNT_ID)\"
    else
        log_error \"AWS credentials not configured or invalid\"
        return 1
    fi
}

# Check Docker
check_docker() {
    log_info \"Checking Docker...\"

    if command -v docker &> /dev/null; then
        DOCKER_VERSION=\$(docker --version)
        log_success \"Docker installed ($DOCKER_VERSION)\"
    else
        log_error \"Docker is not installed\"
        return 1
    fi

    if docker ps > /dev/null 2>&1; then
        log_success \"Docker daemon is running\"
    else
        log_error \"Docker daemon is not running\"
        return 1
    fi
}

# Check branch alignment
check_branch_alignment() {
    local env=$1
    log_info \"Checking Git branch for $env environment...\"

    CURRENT_BRANCH=\$(git -C \"${PROJECT_ROOT}\" rev-parse --abbrev-ref HEAD)

    # Define expected branches
    case \"$env\" in
        dev)
            if [[ \"$CURRENT_BRANCH\" == \"develop\" ]]; then
                log_success \"On correct branch: develop\"
            else
                log_warn \"Expected branch 'develop', but on '$CURRENT_BRANCH'\"
            fi
            ;;
        staging)
            if [[ \"$CURRENT_BRANCH\" == \"staging\" ]]; then
                log_success \"On correct branch: staging\"
            else
                log_warn \"Expected branch 'staging', but on '$CURRENT_BRANCH'\"
            fi
            ;;
        prod)
            if [[ \"$CURRENT_BRANCH\" == \"main\" || \"$CURRENT_BRANCH\" == \"master\" ]]; then
                log_success \"On correct branch: main/master\"
            else
                log_warn \"Expected branch 'main/master', but on '$CURRENT_BRANCH'\"
            fi
            ;;
    esac
}

# Check uncommitted changes
check_uncommitted_changes() {
    log_info \"Checking for uncommitted changes...\"

    if [[ -z \$(git -C \"${PROJECT_ROOT}\" status --porcelain) ]]; then
        log_success \"No uncommitted changes\"
    else
        log_warn \"Uncommitted changes detected:\"
        git -C \"${PROJECT_ROOT}\" status --short | sed 's/^/    /'
    fi
}

# Validate environment
validate_environment() {
    local env=$1
    
    echo \"\"
    log_info \"========================================\"
    log_info \"Validating environment: $env\"
    log_info \"========================================\"
    echo \"\"

    check_env_files \"$env\"
    check_terraform_vars \"$env\"
    check_branch_alignment \"$env\"
    check_uncommitted_changes

    echo \"\"
}

# Validate all environments
validate_all() {
    log_info \"Validating all environments...\"

    check_aws_credentials
    check_docker

    for env in dev staging prod; do
        validate_environment \"$env\"
    done

    echo \"\"
    log_info \"========================================\"
    log_info \"Validation Summary\"
    log_info \"========================================\"
    echo \"Errors:   $ERRORS\"
    echo \"Warnings: $WARNINGS\"
    echo \"\"

    if [[ $ERRORS -gt 0 ]]; then
        log_error \"Validation failed with $ERRORS error(s)\"
        exit 1
    elif [[ $WARNINGS -gt 0 ]]; then
        log_warn \"Validation completed with $WARNINGS warning(s)\"
        exit 0
    else
        log_success \"All validations passed!\"
        exit 0
    fi
}

# Main
ENVIRONMENT=\"${1:-all}\"

case \"$ENVIRONMENT\" in
    dev|staging|prod)
        check_aws_credentials
        check_docker
        validate_environment \"$ENVIRONMENT\"
        ;;
    all)
        validate_all
        ;;
    *)
        echo \"Usage: $0 [dev|staging|prod|all]\"
        exit 1
        ;;
esac

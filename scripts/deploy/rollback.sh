#!/bin/bash

###############################################################################
# Rollback Deployment
# 
# Rolls back to the previous deployment in case of issues
#
# Usage: ./rollback.sh [dev|staging|prod]
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

ACCOUNT_ID=\"829350946816\"
REGION=\"us-east-2\"
PROJECT_NAME=\"expose\"

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
Usage: $0 [dev|staging|prod]

This script rolls back to the previous deployment.

EXAMPLES:
    ./rollback.sh dev
    ./rollback.sh staging
    ./rollback.sh prod

WARNING: This operation cannot be undone. Make sure you understand
what you're rolling back from.

EOF
}

# Parse arguments
if [[ $# -lt 1 ]]; then
    log_error \"Environment argument required\"
    print_usage
    exit 1
fi

ENVIRONMENT=\"$1\"

if [[ ! \"dev\" \"staging\" \"prod\" =~ \"$ENVIRONMENT\" ]]; then
    log_error \"Invalid environment: $ENVIRONMENT\"
    print_usage
    exit 1
fi

echo \"\"
log_warn \"========================================\"
log_warn \"ROLLBACK DEPLOYMENT\"
log_warn \"========================================\"
echo \"\"

# Get ECS cluster and service
CLUSTER_NAME=\"expose-${ENVIRONMENT}\"
SERVICE_NAME=\"expose-backend-${ENVIRONMENT}\"

log_info \"Environment: $ENVIRONMENT\"
log_info \"Cluster: $CLUSTER_NAME\"
log_info \"Service: $SERVICE_NAME\"
echo \"\"

# Confirm rollback
log_warn \"This will roll back the $ENVIRONMENT deployment to the previous version.\"
read -p \"$(echo -e ${YELLOW}Are you sure? Type 'yes' to confirm: ${NC} )\" -r
if [[ ! $REPLY == \"yes\" ]]; then
    log_warn \"Rollback cancelled\"
    exit 0
fi

echo \"\"
log_info \"Starting rollback...\"

# Get current deployment info
log_info \"Fetching current deployment information...\"

CURRENT_TASK_DEF=\$(aws ecs describe-services \
    --cluster \"$CLUSTER_NAME\" \
    --services \"$SERVICE_NAME\" \
    --region \"$REGION\" \
    --query 'services[0].taskDefinition' \
    --output text)

log_info \"Current task definition: $CURRENT_TASK_DEF\"

# Get previous task definition
TASK_FAMILY=\"\${CURRENT_TASK_DEF%:*}\"
CURRENT_REVISION=\"\${CURRENT_TASK_DEF##*:}\"
PREVIOUS_REVISION=$((CURRENT_REVISION - 1))
PREVIOUS_TASK_DEF=\"${TASK_FAMILY}:${PREVIOUS_REVISION}\"

log_info \"Rolling back to previous task definition: $PREVIOUS_TASK_DEF\"

# Verify previous task definition exists
if ! aws ecs describe-task-definition \
    --task-definition \"$PREVIOUS_TASK_DEF\" \
    --region \"$REGION\" > /dev/null 2>&1; then
    log_error \"Previous task definition not found: $PREVIOUS_TASK_DEF\"
    exit 1
fi

log_success \"Previous task definition exists\"
echo \"\"

# Update service
log_info \"Updating ECS service to use previous task definition...\"

if aws ecs update-service \
    --cluster \"$CLUSTER_NAME\" \
    --service \"$SERVICE_NAME\" \
    --task-definition \"$PREVIOUS_TASK_DEF\" \
    --region \"$REGION\" > /dev/null; then
    log_success \"Service update initiated\"
else
    log_error \"Failed to update service\"
    exit 1
fi

# Monitor rollback
log_info \"Monitoring rollback (this may take a few minutes)...\"
echo \"\"

TIMEOUT=600
INTERVAL=10
ELAPSED=0

while [ $ELAPSED -lt $TIMEOUT ]; do
    STATUS=\$(aws ecs describe-services \
        --cluster \"$CLUSTER_NAME\" \
        --services \"$SERVICE_NAME\" \
        --region \"$REGION\" \
        --query 'services[0].deployments[0].status' \
        --output text 2>/dev/null || echo \"UNKNOWN\")

    RUNNING_COUNT=\$(aws ecs describe-services \
        --cluster \"$CLUSTER_NAME\" \
        --services \"$SERVICE_NAME\" \
        --region \"$REGION\" \
        --query 'services[0].runningCount' \
        --output text 2>/dev/null || echo \"0\")

    echo -ne \"\\rDeployment status: $STATUS | Running tasks: $RUNNING_COUNT (${ELAPSED}s)\"
    
    if [[ \"$STATUS\" == \"PRIMARY\" ]]; then
        echo \"\"
        log_success \"Rollback completed successfully!\"
        echo \"\"
        log_info \"Previous deployment is now active\"
        log_info \"Task Definition: $PREVIOUS_TASK_DEF\"
        exit 0
    fi

    sleep $INTERVAL
    ELAPSED=$((ELAPSED + INTERVAL))
done

log_error \"Rollback monitoring timed out\"
log_info \"Check AWS ECS console for deployment status\"
exit 1

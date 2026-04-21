#!/bin/bash

# RDS Security Hardening - Pre-Deployment Checklist
# This script verifies everything is ready before applying Terraform changes

set -e

echo "RDS Security Hardening Pre-Deployment Checklist"
echo "=================================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

CHECKS_PASSED=0
CHECKS_FAILED=0

check() {
    local check_name="$1"
    local command="$2"
    
    if eval "$command" > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} $check_name"
        ((CHECKS_PASSED++))
    else
        echo -e "${RED}✗${NC} $check_name"
        ((CHECKS_FAILED++))
    fi
}

warning() {
    local message="$1"
    echo -e "${YELLOW}⚠${NC} $message"
}

# Check 1: Terraform installed
check "Terraform installed" "which terraform"

# Check 2: AWS CLI installed
check "AWS CLI installed" "which aws"

# Check 3: AWS credentials configured
check "AWS credentials configured" "aws sts get-caller-identity > /dev/null"

# Check 4: Terraform files exist
check "RDS module main.tf exists" "test -f infrastructure/terraform/modules/rds/main.tf"
check "RDS module variables.tf exists" "test -f infrastructure/terraform/modules/rds/variables.tf"
check "Main Terraform config exists" "test -f infrastructure/terraform/main.tf"
check "Production tfvars exists" "test -f infrastructure/environments/terraform.tfvars.prod"

# Check 5: Validate Terraform syntax
check "Terraform syntax valid" "cd infrastructure/terraform && terraform validate"

# Check 6: RDS instance exists
check "RDS instance 'social-media' exists" "aws rds describe-db-instances --db-instance-identifier social-media --region us-east-2 > /dev/null"

# Check 7: EC2 security group exists
check "EC2 security group (sg-07e51aa3ebaa7d2d2) exists" "aws ec2 describe-security-groups --group-ids sg-07e51aa3ebaa7d2d2 --region us-east-2 > /dev/null"

# Check 8: RDS security group exists
check "RDS security group (sg-00341873fbd493c8a) exists" "aws ec2 describe-security-groups --group-ids sg-00341873fbd493c8a --region us-east-2 > /dev/null"

# Check 9: VPC exists
check "VPC (vpc-02d1b45118846f809) exists" "aws ec2 describe-vpcs --vpc-ids vpc-02d1b45118846f809 --region us-east-2 > /dev/null"

echo ""
echo "Pre-Deployment Warnings:"
echo "========================"
echo ""

# Get current RDS status
RDS_STATUS=$(aws rds describe-db-instances --db-instance-identifier social-media --region us-east-2 --query 'DBInstances[0].DBInstanceStatus' --output text)
if [ "$RDS_STATUS" != "available" ]; then
    warning "RDS instance is in '$RDS_STATUS' state (expected 'available'). Wait before proceeding."
fi

# Check if publicly accessible
PUBLICLY_ACCESSIBLE=$(aws rds describe-db-instances --db-instance-identifier social-media --region us-east-2 --query 'DBInstances[0].PubliclyAccessible' --output text)
if [ "$PUBLICLY_ACCESSIBLE" = "true" ]; then
    warning "RDS is currently PUBLICLY ACCESSIBLE - this is the issue we're fixing"
fi

# Check if backup exists
BACKUP_COUNT=$(aws rds describe-db-snapshots --db-instance-identifier social-media --region us-east-2 --query 'DBSnapshots | length(@)' --output text)
if [ "$BACKUP_COUNT" -lt 1 ]; then
    warning "No snapshots found for RDS instance - consider taking a manual backup first"
fi

echo ""
echo "Summary:"
echo "========"
echo -e "Checks passed: ${GREEN}$CHECKS_PASSED${NC}"
echo -e "Checks failed: ${RED}$CHECKS_FAILED${NC}"
echo ""

if [ $CHECKS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All checks passed! Ready to proceed with hardening.${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Review RDS_QUICK_START.md"
    echo "2. Make terraform configuration changes"
    echo "3. Run: terraform plan -var-file=environments/terraform.tfvars.prod"
    echo "4. Review the plan carefully"
    echo "5. Apply Phase 1 (SG rules)"
    echo "6. Test connectivity"
    echo "7. Apply Phase 2 (publicly_accessible = false)"
    echo ""
    exit 0
else
    echo -e "${RED}✗ Some checks failed. Please fix the issues above before proceeding.${NC}"
    exit 1
fi


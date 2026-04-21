#!/bin/bash

# RDS Security Hardening Validation Script
# Validates that RDS is properly hardened after migration
# Usage: ./validate-rds-security.sh <rds-instance-id> <region>

set -e

RDS_INSTANCE_ID="${1:-social-media}"
AWS_REGION="${2:-us-east-2}"

echo "RDS Security Hardening Validation"
echo "======================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to check and print results
check_status() {
    local check_name="$1"
    local status="$2"
    local recommendation="$3"
    
    if [ "$status" = "PASS" ]; then
        echo -e "${GREEN}✓${NC} $check_name: PASS"
    elif [ "$status" = "WARN" ]; then
        echo -e "${YELLOW}⚠${NC} $check_name: WARNING"
        echo "  └─ $recommendation"
    else
        echo -e "${RED}✗${NC} $check_name: FAIL"
        echo "  └─ $recommendation"
    fi
}

echo "Fetching RDS instance details..."
echo ""

# Get RDS instance details
RDS_DATA=$(aws rds describe-db-instances \
    --db-instance-identifier "$RDS_INSTANCE_ID" \
    --region "$AWS_REGION" \
    --query 'DBInstances[0]' \
    --output json)

if [ -z "$RDS_DATA" ] || [ "$RDS_DATA" = "null" ]; then
    echo -e "${RED}✗ ERROR: Could not find RDS instance: $RDS_INSTANCE_ID${NC}"
    exit 1
fi

# Extract key attributes
PUBLICLY_ACCESSIBLE=$(echo "$RDS_DATA" | jq -r '.PubliclyAccessible')
MULTI_AZ=$(echo "$RDS_DATA" | jq -r '.MultiAZ')
STORAGE_ENCRYPTED=$(echo "$RDS_DATA" | jq -r '.StorageEncrypted')
IAM_DB_AUTH=$(echo "$RDS_DATA" | jq -r '.IAMDatabaseAuthenticationEnabled')
BACKUP_RETENTION=$(echo "$RDS_DATA" | jq -r '.BackupRetentionPeriod')
VPC_SG_IDS=$(echo "$RDS_DATA" | jq -r '.VpcSecurityGroups[].VpcSecurityGroupId')
DELETION_PROTECTION=$(echo "$RDS_DATA" | jq -r '.DeletionProtection')
ENGINE=$(echo "$RDS_DATA" | jq -r '.Engine')
ENGINE_VERSION=$(echo "$RDS_DATA" | jq -r '.EngineVersion')
INSTANCE_CLASS=$(echo "$RDS_DATA" | jq -r '.DBInstanceClass')

echo "Instance Details:"
echo "  Engine: $ENGINE $ENGINE_VERSION"
echo "  Class: $INSTANCE_CLASS"
echo "  VPC Security Groups: $VPC_SG_IDS"
echo ""
echo "Security Assessment:"
echo ""

# Check 1: Publicly Accessible
if [ "$PUBLICLY_ACCESSIBLE" = "false" ]; then
    check_status "Publicly Accessible" "PASS" ""
else
    check_status "Publicly Accessible" "FAIL" "Set publicly_accessible = false in Terraform"
fi

# Check 2: Storage Encryption
if [ "$STORAGE_ENCRYPTED" = "true" ]; then
    check_status "Storage Encryption" "PASS" ""
else
    check_status "Storage Encryption" "FAIL" "Enable encrypted storage in RDS configuration"
fi

# Check 3: IAM Database Authentication
if [ "$IAM_DB_AUTH" = "true" ]; then
    check_status "IAM DB Authentication" "PASS" ""
else
    check_status "IAM DB Authentication" "WARN" "Consider enabling IAM authentication for better security"
fi

# Check 4: Multi-AZ
if [ "$MULTI_AZ" = "true" ]; then
    check_status "Multi-AZ Deployment" "PASS" ""
else
    check_status "Multi-AZ Deployment" "WARN" "Not enabled - reduces availability but acceptable for dev/test"
fi

# Check 5: Backup Retention
if [ "$BACKUP_RETENTION" -ge 7 ]; then
    check_status "Backup Retention ($BACKUP_RETENTION days)" "PASS" ""
elif [ "$BACKUP_RETENTION" -gt 0 ]; then
    check_status "Backup Retention ($BACKUP_RETENTION days)" "WARN" "Retention is below 7 days - increase for better protection"
else
    check_status "Backup Retention" "FAIL" "Set backup retention to at least 7 days"
fi

# Check 6: Deletion Protection
if [ "$DELETION_PROTECTION" = "true" ]; then
    check_status "Deletion Protection" "PASS" ""
else
    check_status "Deletion Protection" "WARN" "Consider enabling deletion protection in production"
fi

echo ""
echo "Security Group Analysis:"
echo ""

# Analyze security groups
for sg_id in $VPC_SG_IDS; do
    echo "Security Group: $sg_id"
    
    # Get inbound rules
    INBOUND_RULES=$(aws ec2 describe-security-group-rules \
        --region "$AWS_REGION" \
        --filters "Name=group-id,Values=$sg_id" "Name=is-egress,Values=false" \
        --query 'SecurityGroupRules' \
        --output json)
    
    # Check for unrestricted inbound (0.0.0.0/0 on port 3306)
    UNRESTRICTED=$(echo "$INBOUND_RULES" | jq -r '.[] | select(.CidrIpv4=="0.0.0.0/0" or .CidrIpv6=="::/0") | .FromPort' 2>/dev/null | grep 3306)
    
    if [ -z "$UNRESTRICTED" ]; then
        echo -e "  ${GREEN}✓${NC} No unrestricted inbound (0.0.0.0/0) on port 3306"
    else
        echo -e "  ${RED}✗${NC} CRITICAL: Unrestricted inbound (0.0.0.0/0) on port 3306"
    fi
    
    # Check inbound rules
    echo "  Inbound Rules:"
    echo "$INBOUND_RULES" | jq -r '.[] | 
        if .FromPort == 3306 then
            "    - Port 3306: " + 
            (if .SourceSecurityGroupId then "SG: \(.SourceSecurityGroupId)" else 
             if .CidrIpv4 then "\(.CidrIpv4)" else 
             if .CidrIpv6 then "\(.CidrIpv6)" else "Unknown" end end end)
        else
            "    - Port \(.FromPort): \(.CidrIpv4 // .SourceSecurityGroupId // "Unknown")"
        end' 2>/dev/null || echo "    (Unable to fetch rules)"
    
    # Check egress rules
    EGRESS_RULES=$(aws ec2 describe-security-group-rules \
        --region "$AWS_REGION" \
        --filters "Name=group-id,Values=$sg_id" "Name=is-egress,Values=true" \
        --query 'SecurityGroupRules' \
        --output json)
    
    UNRESTRICTED_EGRESS=$(echo "$EGRESS_RULES" | jq -r '.[] | select(.CidrIpv4=="0.0.0.0/0" or .CidrIpv6=="::/0") | .IpProtocol' 2>/dev/null | grep "\-1")
    
    if [ -z "$UNRESTRICTED_EGRESS" ]; then
        echo -e "  ${GREEN}✓${NC} Egress restricted to VPC"
    else
        echo -e "  ${YELLOW}⚠${NC} Unrestricted egress (0.0.0.0/0) - should be restricted to VPC CIDR"
    fi
    
    echo ""
done

echo "Logging Configuration:"
echo ""

# Get enhanced monitoring status
MONITORING=$(echo "$RDS_DATA" | jq -r '.MonitoringInterval')
if [ "$MONITORING" != "null" ] && [ "$MONITORING" != "0" ]; then
    echo -e "  ${GREEN}✓${NC} Enhanced Monitoring: Enabled (interval: ${MONITORING}s)"
else
    echo -e "  ${YELLOW}⚠${NC} Enhanced Monitoring: Disabled"
fi

# Get Performance Insights
PERF_INSIGHTS=$(echo "$RDS_DATA" | jq -r '.PerformanceInsightsEnabled')
if [ "$PERF_INSIGHTS" = "true" ]; then
    echo -e "  ${GREEN}✓${NC} Performance Insights: Enabled"
else
    echo -e "  ${YELLOW}⚠${NC} Performance Insights: Disabled"
fi

# Get CloudWatch logs
ENABLED_LOGS=$(echo "$RDS_DATA" | jq -r '.EnabledCloudwatchLogsExports[]' 2>/dev/null)
if [ -z "$ENABLED_LOGS" ]; then
    echo -e "  ${YELLOW}⚠${NC} CloudWatch Logs: None enabled"
    echo "    Recommended: error, slowquery"
else
    echo -e "  ${GREEN}✓${NC} CloudWatch Logs Enabled:"
    echo "$ENABLED_LOGS" | while read -r log; do
        echo "    - $log"
    done
fi

echo ""
echo "Summary:"
echo "========="
echo ""

if [ "$PUBLICLY_ACCESSIBLE" = "false" ] && [ "$STORAGE_ENCRYPTED" = "true" ]; then
    echo -e "${GREEN}✓ RDS instance is properly hardened${NC}"
    echo ""
    echo "Next Steps:"
    echo "  1. Monitor RDS logs for connection patterns"
    echo "  2. Set up CloudWatch alarms for failed connections"
    echo "  3. Regular security audits (monthly)"
    echo "  4. Consider implementing RDS Proxy for connection pooling"
else
    echo -e "${RED}✗ RDS instance requires additional hardening${NC}"
    echo ""
    echo "Action Items:"
    echo "  1. Set publicly_accessible = false"
    echo "  2. Verify security group rules allow only authorized sources"
    echo "  3. Enable storage encryption"
    echo "  4. Enable enhanced monitoring"
fi

echo ""


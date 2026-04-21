# Post-Implementation Setup Guide

## Overview

This guide walks through setting up and validating the new environment strategy after implementation.

---

## Phase 1: Initial Validation (Local)

### Step 1: Validate Configuration Files
```bash
# Navigate to project root
cd /Users/victorsaravia/Desktop/GitHub/EXPOSE

# Verify all files were created
ls -la docs/environments/
ls -la infrastructure/environments/
ls -la scripts/deploy/
ls -la backend/.env.*

# Expected files:
# ✅ docs/environments/{STRATEGY,BRANCH_POLICY,ENV_VARIABLES,DEPLOY_PROCEDURES,README,IMPLEMENTATION_SUMMARY}.md
# ✅ infrastructure/environments/terraform.tfvars.{dev,staging,prod}
# ✅ backend/.env.{dev,staging,prod}
# ✅ scripts/deploy/{deploy,validate-env,rollback}.sh (with x permissions)
```

### Step 2: Verify Scripts Are Executable
```bash
# Check permissions
ls -l scripts/deploy/
# Should show: -rwxr-xr-x for all three scripts

# Test scripts exist and are valid bash
bash -n scripts/deploy/deploy.sh
bash -n scripts/deploy/validate-env.sh
bash -n scripts/deploy/rollback.sh
```

### Step 3: Validate Configuration Structure
```bash
# Check .env files have required variables
grep "NODE_ENV=" backend/.env.*
grep "DB_HOST=" backend/.env.*
grep "AWS_REGION=" backend/.env.*

# Should output 3 lines for each
```

### Step 4: Verify Merge Conflict Resolution
```bash
# Check that env.ts has no merge conflict markers
grep -c "<<<<<<" backend/src/config/env.ts || echo "✅ No conflicts"
grep -c "======" backend/src/config/env.ts || echo "✅ No markers"
grep -c ">>>>>>" backend/src/config/env.ts || echo "✅ No conflicts"

# Verify auth login variables are present
grep "AUTH_LOGIN" backend/src/config/env.ts | head -3
```

---

## Phase 2: AWS Setup

### Step 1: Verify AWS Credentials
```bash
# Check AWS access
aws sts get-caller-identity

# Expected output:
# {
#     "UserId": "...",
#     "Account": "829350946816",
#     "Arn": "arn:aws:iam::829350946816:user/..."
# }
```

### Step 2: Create AWS Secrets Manager Secrets

**For DEV Environment**:
```bash
aws secretsmanager create-secret \
  --name /expose/dev/db-password \
  --secret-string "dev_password_change_this" \
  --region us-east-2

aws secretsmanager create-secret \
  --name /expose/dev/jwt-secret \
  --secret-string "dev_jwt_secret_change_this" \
  --region us-east-2

aws secretsmanager create-secret \
  --name /expose/dev/sentry-dsn \
  --secret-string "https://...@o....ingest.us.sentry.io/..." \
  --region us-east-2
```

**For STAGING Environment** (use real values):
```bash
aws secretsmanager create-secret \
  --name /expose/staging/db-password \
  --secret-string "$(openssl rand -base64 32)" \
  --region us-east-2

aws secretsmanager create-secret \
  --name /expose/staging/jwt-secret \
  --secret-string "$(openssl rand -base64 32)" \
  --region us-east-2
```

**For PROD Environment** (secure random values):
```bash
aws secretsmanager create-secret \
  --name /expose/prod/db-password \
  --secret-string "$(openssl rand -base64 32)" \
  --region us-east-2 \
  --kms-key-id "alias/aws/secretsmanager"

aws secretsmanager create-secret \
  --name /expose/prod/jwt-secret \
  --secret-string "$(openssl rand -base64 32)" \
  --region us-east-2 \
  --kms-key-id "alias/aws/secretsmanager"
```

### Step 3: Verify Secrets
```bash
# List all EXPOSE secrets
aws secretsmanager list-secrets \
  --filters Key=name,Values=/expose \
  --region us-east-2

# Expected output: 6-9 secrets (/expose/{dev,staging,prod}/*)

# Test retrieving a secret
aws secretsmanager get-secret-value \
  --secret-id /expose/dev/db-password \
  --region us-east-2 \
  --query 'SecretString' \
  --output text
```

---

## Phase 3: GitHub Configuration

### Step 1: Create CODEOWNERS File (Already Done)
```bash
# Verify CODEOWNERS is in place
cat .github/CODEOWNERS

# It should define review requirements for different areas
```

### Step 2: Configure Branch Protection Rules

**For `main` branch**:
```
Go to: Settings → Branches → Add rule
Pattern: main

☑️ Require pull request reviews before merging
   - Required approving reviews: 2
   - Require review from Code Owners: ✓
   - Dismiss stale pull request approvals when new commits are pushed: ✓
   - Require status checks to pass before merging: ✓
   - Require branches to be up to date before merging: ✓
☑️ Include administrators: ✓
```

**For `staging` branch**:
```
Go to: Settings → Branches → Add rule
Pattern: staging

☑️ Require pull request reviews before merging
   - Required approving reviews: 2
   - Dismiss stale pull request approvals when new commits are pushed: ✓
   - Require status checks to pass before merging: ✓
   - Require branches to be up to date before merging: ✓
☑️ Include administrators: ✓
```

**For `develop` branch**:
```
Go to: Settings → Branches → Add rule
Pattern: develop

☑️ Require pull request reviews before merging
   - Required approving reviews: 1
   - Dismiss stale pull request approvals when new commits are pushed: ✓
   - Require status checks to pass before merging: ✓
   - Require branches to be up to date before merging: ✓
```

---

## Phase 4: Local Testing

### Step 1: Run Validation Script
```bash
# Validate all environments
./scripts/deploy/validate-env.sh all

# Should output validation results for each environment
# Check for any errors (red ❌) or warnings (yellow ⚠️)
```

### Step 2: Test Dry-Run Deploy (if infrastructure ready)
```bash
# Dry-run for dev (no changes made)
./scripts/deploy/deploy.sh dev --dry-run --skip-tests

# This should:
# ✅ Load environment variables
# ✅ Show Git info
# ✅ Validate Terraform
# ✅ Run terraform plan (no apply)
```

### Step 3: Verify Docker Compose Still Works
```bash
cd backend

# Start local development environment
docker-compose up -d

# Should see all containers starting
docker ps | grep expose

# Verify application
curl http://localhost:3000/api/health
# Should return 200 OK with health status
```

---

## Phase 5: Team Communication

### Step 1: Prepare Documentation
- [x] STRATEGY.md - Overall architecture
- [x] BRANCH_POLICY.md - Git workflow
- [x] ENV_VARIABLES.md - Configuration guide
- [x] DEPLOY_PROCEDURES.md - Deployment steps
- [x] README.md - Quick start

### Step 2: Schedule Team Training
```markdown
# Team Training Checklist

## Pre-Training (48 hours before)
- [ ] Share STRATEGY.md link
- [ ] Ask team to read BRANCH_POLICY.md
- [ ] Post in #engineering Slack channel

## During Training (1 hour)
- [ ] Overview of new strategy (15 min)
- [ ] Walkthrough branch policy (15 min)
- [ ] Demo of deployment process (15 min)
- [ ] Q&A (15 min)

## Post-Training (immediate)
- [ ] Distribute quick-start cheatsheet
- [ ] Create #environment-strategy channel
- [ ] Send links to all documentation
- [ ] Schedule follow-up questions for next day
```

### Step 3: Update Project Documentation
```bash
# Update root README.md with reference to new documentation
echo "

## Environment Strategy

For information about our multi-environment strategy, deployment procedures,
and branch policies, see:

- [Environment Strategy Overview](./docs/environments/STRATEGY.md)
- [Branch Policies & Git Workflow](./docs/environments/BRANCH_POLICY.md)
- [Environment Variables Reference](./docs/environments/ENV_VARIABLES.md)
- [Deployment Procedures](./docs/environments/DEPLOY_PROCEDURES.md)
- [Quick Start Guide](./docs/environments/README.md)

" >> README.md
```

---

## Phase 6: Production Readiness

### Step 1: Infrastructure Preparation

**Terraform Backend Setup**:
```bash
# Create S3 bucket for Terraform state (if not exists)
aws s3 mb s3://expose-terraform-state \
  --region us-east-2

# Create DynamoDB for Terraform locks (if not exists)
aws dynamodb create-table \
  --table-name expose-terraform-locks \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region us-east-2
```

**Initialize Terraform**:
```bash
cd infrastructure/terraform

# DEV
terraform init -backend-config="key=expose-backend/dev/terraform.tfstate"
terraform plan -var-file="../environments/terraform.tfvars.dev"

# STAGING
terraform init -backend-config="key=expose-backend/staging/terraform.tfstate"
terraform plan -var-file="../environments/terraform.tfvars.staging"

# PROD (don't apply yet)
terraform init -backend-config="key=expose-backend/prod/terraform.tfstate"
terraform plan -var-file="../environments/terraform.tfvars.prod"
```

### Step 2: CI/CD Setup

Create `.github/workflows/deploy.yml`:
```yaml
name: Deploy

on:
  push:
    branches: [develop, staging, main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Determine environment
        id: env
        run: |
          if [[ "${{ github.ref }}" == "refs/heads/main" ]]; then
            echo "ENVIRONMENT=prod" >> $GITHUB_OUTPUT
          elif [[ "${{ github.ref }}" == "refs/heads/staging" ]]; then
            echo "ENVIRONMENT=staging" >> $GITHUB_OUTPUT
          else
            echo "ENVIRONMENT=dev" >> $GITHUB_OUTPUT
          fi
      
      - name: Validate environment
        run: ./scripts/deploy/validate-env.sh ${{ steps.env.outputs.ENVIRONMENT }}
      
      - name: Deploy
        if: steps.env.outputs.ENVIRONMENT == 'dev'  # Auto-deploy dev only
        run: ./scripts/deploy/deploy.sh ${{ steps.env.outputs.ENVIRONMENT }}
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
```

---

## Phase 7: Rollout Plan

### Week 1: Preparation
- [ ] All files reviewed by team
- [ ] AWS secrets configured
- [ ] GitHub branch protection enabled
- [ ] Local validation successful

### Week 2: Soft Launch
- [ ] Start using new branch policy for new features
- [ ] Manual deployments using new scripts
- [ ] Gather feedback from team

### Week 3: Full Rollout
- [ ] Enforce branch policy on all branches
- [ ] Enable CI/CD workflows
- [ ] Monitor first automated deployments

### Week 4: Optimization
- [ ] Review lessons learned
- [ ] Adjust policies as needed
- [ ] Document any customizations

---

## Checklist for Completion

### Documentation
- [x] All .md files created in `/docs/environments/`
- [x] All configuration files created
- [x] All deployment scripts created and executable
- [x] CODEOWNERS file created
- [ ] Team has reviewed documentation

### AWS Setup
- [ ] AWS Secrets Manager secrets created
- [ ] Terraform backend initialized
- [ ] Infrastructure state file exists
- [ ] Service role permissions verified

### GitHub Configuration
- [ ] Branch protection rules enabled
- [ ] CODEOWNERS active
- [ ] CI/CD workflows configured
- [ ] Required status checks enabled

### Team Training
- [ ] Training session completed
- [ ] Team understands branch policy
- [ ] Team knows deployment procedures
- [ ] Q&A documented

### Validation
- [ ] Local validation scripts pass
- [ ] DEV environment validated
- [ ] STAGING environment validated
- [ ] PROD environment ready
- [ ] Dry-run deployment successful
- [ ] Rollback procedure tested

---

## Troubleshooting

### Issue: "terraform.tfvars file not found"
```bash
# Make sure you're in the right directory
cd infrastructure/terraform

# Use full path to tfvars files
terraform plan -var-file="../environments/terraform.tfvars.dev"
```

### Issue: "AWS credentials not found"
```bash
# Configure AWS credentials
aws configure

# Or use environment variables
export AWS_ACCESS_KEY_ID="..."
export AWS_SECRET_ACCESS_KEY="..."
export AWS_DEFAULT_REGION="us-east-2"
```

### Issue: "Docker daemon not running"
```bash
# Start Docker Desktop (on Mac/Windows)
# Or start Docker daemon:
sudo systemctl start docker  # Linux
```

---

## Next Steps

1. ✅ Implementation complete
2. ⏳ **TODO**: 
   - [ ] AWS Secrets Manager secrets
   - [ ] GitHub branch protection rules
   - [ ] CI/CD workflows
   - [ ] Team training
   - [ ] First deployment test
   - [ ] Gather team feedback

---

For support or questions, refer to:
- [STRATEGY.md](./docs/environments/STRATEGY.md)
- [DEPLOY_PROCEDURES.md](./docs/environments/DEPLOY_PROCEDURES.md)
- [ENV_VARIABLES.md](./docs/environments/ENV_VARIABLES.md)

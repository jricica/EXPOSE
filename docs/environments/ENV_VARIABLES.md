# Environment Configuration Guide

## Overview

This guide explains how environment variables and configuration management works in EXPOSE across different environments.

---

## 1. Configuration Hierarchy

The application loads configuration in this order (later overrides earlier):

```
1. Defaults in code (.ts files)
   ↓
2. .env.[ENVIRONMENT] files (git-tracked, no secrets)
   ↓
3. System environment variables (GitHub Actions, Docker, etc.)
   ↓
4. AWS Secrets Manager (secrets only, not git-tracked)
   ↓
5. Runtime configuration (from config service)
```

---

## 2. Local Development (`.env.dev`)

### Usage
```bash
# Automatically loaded for local development
npm run dev

# Or explicitly specify environment
NODE_ENV=development node dist/index.js
```

### Values
- All values are development-safe defaults
- Database connects to local Docker container
- Redis connects to local Docker container
- DynamoDB connects to local Docker container
- No real AWS credentials needed
- Sentry disabled

### Example
```env
NODE_ENV=development
DB_HOST=localhost
DB_PORT=5432
DB_NAME=expose
JWT_SECRET=dev_secret_change_in_production
SENTRY_ENABLED=false
```

---

## 3. Development Environment (`.env.dev` in AWS)

### Usage
```bash
# Deployed to AWS DEV cluster
./scripts/deploy/deploy.sh dev

# Or manually
AWS_PROFILE=dev NODE_ENV=development npm start
```

### Variables
- `.env.dev` values are base configuration
- Secrets loaded from: `/expose/dev/*` in AWS Secrets Manager
- Database: `expose-db-dev.rds.amazonaws.com`

### Loading Secrets (at runtime)
```javascript
import { SecretsManager } from 'aws-sdk';

const client = new SecretsManager({ region: 'us-east-2' });
const secret = await client.getSecretValue({ 
  SecretId: '/expose/dev/db-password'
}).promise();
```

---

## 4. Staging Environment (`.env.staging` in AWS)

### Usage
```bash
./scripts/deploy/deploy.sh staging

# Requires approval - staging branch deployment
```

### Variables
- `.env.staging` contains staging-specific config
- Same infrastructure pattern as production (single-AZ)
- Database: `expose-db-staging.rds.amazonaws.com`
- All secrets from: `/expose/staging/*`

### Monitoring
- Full monitoring enabled
- Sentry errors captured
- Logs retention: 30 days

---

## 5. Production Environment (`.env.prod` in AWS)

### Usage
```bash
# Main branch only, manual approval required
./scripts/deploy/deploy.sh prod
```

### Variables
- `.env.prod` contains production-specific config
- Multi-AZ infrastructure
- Database: `expose-db-prod.rds.amazonaws.com`
- All secrets from: `/expose/prod/*`

### Safety Features
- Rate limiting is strict
- Sentry tracing limited to 10%
- Health checks more frequent
- Auto-scaling enabled

---

## 6. Secret Management in AWS Secrets Manager

### Structure
```
/expose/dev/               (DEV environment)
  ├── db-password
  ├── jwt-secret
  ├── sentry-dsn
  ├── aws-s3-key
  └── aws-s3-secret

/expose/staging/           (STAGING environment)
  ├── db-password
  ├── jwt-secret
  ├── sentry-dsn
  ├── aws-s3-key
  └── aws-s3-secret

/expose/prod/              (PROD environment)
  ├── db-password
  ├── jwt-secret
  ├── sentry-dsn
  ├── aws-s3-key
  ├── aws-s3-secret
  └── kms-key-id
```

### Creating Secrets
```bash
# Create a secret in AWS Secrets Manager
aws secretsmanager create-secret \
  --name /expose/dev/db-password \
  --secret-string "password123" \
  --region us-east-2

# Update a secret
aws secretsmanager update-secret \
  --secret-id /expose/dev/db-password \
  --secret-string "newpassword" \
  --region us-east-2

# Get a secret
aws secretsmanager get-secret-value \
  --secret-id /expose/dev/db-password \
  --region us-east-2
```

### Loading Secrets in Application
```typescript
// src/config/env.ts
import { SecretsManager } from 'aws-sdk';

const secretsManager = new SecretsManager();

export async function loadSecrets(environment: string) {
  const secrets: Record<string, string> = {};
  
  const secretNames = [
    'db-password',
    'jwt-secret',
    'sentry-dsn',
    'aws-s3-key',
    'aws-s3-secret'
  ];

  for (const name of secretNames) {
    try {
      const response = await secretsManager.getSecretValue({
        SecretId: `/expose/${environment}/${name}`
      }).promise();
      
      secrets[name] = response.SecretString!;
    } catch (error) {
      console.error(`Failed to load secret: ${name}`, error);
      throw error;
    }
  }

  return secrets;
}
```

---

## 7. Environment Variables Reference

### Required Variables

| Variable | Type | Dev | Staging | Prod | Notes |
|----------|------|-----|---------|------|-------|
| `NODE_ENV` | string | development | staging | production | Affects logging, error handling |
| `DB_HOST` | string | localhost | RDS endpoint | RDS endpoint | Database hostname |
| `DB_PASSWORD` | secret | expose_password | Secrets Manager | Secrets Manager | **NEVER in .env** |
| `JWT_SECRET` | secret | dev_secret | Secrets Manager | Secrets Manager | **NEVER in .env** |
| `AWS_REGION` | string | us-east-2 | us-east-2 | us-east-2 | AWS region |
| `S3_BUCKET` | string | expose-media-dev | expose-media-staging | expose-media-prod | Storage bucket |
| `REDIS_URL` | string | redis://localhost | ElastiCache | ElastiCache | Cache endpoint |

### Optional Variables

| Variable | Type | Default | Notes |
|----------|------|---------|-------|
| `LOG_LEVEL` | string | info | debug, info, warn, error |
| `SENTRY_ENABLED` | boolean | false | Enable error tracking |
| `RATE_LIMIT_ENABLED` | boolean | true | Enable rate limiting |
| `CORS_ORIGIN` | string | * | CORS allowed origins |

---

## 8. Docker Environment Setup

### Development (docker-compose)
```bash
cd backend
docker-compose up

# .env.dev is automatically loaded
```

### Production (Docker)
```bash
# Build with build args
docker build \
  --build-arg NODE_ENV=production \
  --build-arg API_URL=https://api.expose.com \
  -t expose-backend:latest .

# Run with env variables
docker run \
  -e NODE_ENV=production \
  -e DB_HOST=rds.amazonaws.com \
  -e DB_PASSWORD=$(aws secretsmanager get-secret-value --secret-id /expose/prod/db-password) \
  expose-backend:latest
```

---

## 9. CI/CD Environment Variables

### GitHub Actions

```yaml
# .github/workflows/deploy.yml
env:
  ENVIRONMENT: ${{ github.ref == 'refs/heads/main' && 'prod' || 'dev' }}

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Load environment config
        run: |
          cp backend/.env.${{ env.ENVIRONMENT }} .env
          echo "Loaded .env.${{ env.ENVIRONMENT }}"
      
      - name: Load secrets from AWS
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
        run: |
          aws secretsmanager get-secret-value \
            --secret-id /expose/${{ env.ENVIRONMENT }}/db-password \
            --query SecretString --output text > /tmp/db-password
          
          export DB_PASSWORD=$(cat /tmp/db-password)
```

---

## 10. Validation

### Validate Environment Setup
```bash
# Validate all environments
./scripts/deploy/validate-env.sh all

# Validate specific environment
./scripts/deploy/validate-env.sh dev
./scripts/deploy/validate-env.sh staging
./scripts/deploy/validate-env.sh prod
```

### What Gets Checked
- ✅ All required `.env` files exist
- ✅ Required variables are defined
- ✅ Terraform variables are configured
- ✅ AWS credentials are valid
- ✅ Git branch matches environment
- ✅ No uncommitted changes

---

## 11. Common Issues

### Issue: `Cannot find module dotenv`
**Solution**: Install dev dependencies
```bash
npm install
npm run build
```

### Issue: `ECONNREFUSED localhost:5432`
**Solution**: Make sure Docker containers are running
```bash
docker-compose up -d
docker ps  # verify containers are running
```

### Issue: `AccessDenied` when loading secrets
**Solution**: Check AWS credentials and IAM permissions
```bash
aws sts get-caller-identity
aws secrets-manager list-secrets  # test permissions
```

### Issue: `.env.prod` not loaded in production
**Solution**: Ensure NODE_ENV is set correctly
```bash
export NODE_ENV=production
echo $NODE_ENV  # verify it's set
npm start
```

---

## 12. Security Best Practices

### DO ✅
- ✅ Keep `.env.dev` and `.env.staging` in git
- ✅ Use AWS Secrets Manager for all secrets
- ✅ Rotate secrets regularly (AWS console)
- ✅ Use different secrets per environment
- ✅ Audit secret access (CloudTrail)
- ✅ Enable MFA for production access

### DON'T ❌
- ❌ **NEVER** commit `.env.prod` with real secrets
- ❌ **NEVER** commit any passwords/API keys
- ❌ **NEVER** share AWS credentials in Slack/email
- ❌ **NEVER** use same secrets across environments
- ❌ **NEVER** hardcode secrets in code
- ❌ **NEVER** print secrets to logs

### If Secrets Leaked
1. Immediately rotate affected secret in AWS Secrets Manager
2. Update all references
3. Deploy to all affected environments
4. Audit access logs in CloudTrail
5. Document in incident log

---

## 13. Related Documentation

- [Environment Strategy](./STRATEGY.md)
- [Branch Policy](./BRANCH_POLICY.md)
- [Deployment Scripts](./DEPLOY_SCRIPTS.md)
- [Infrastructure Setup](../infrastructure/terraform/README.md)

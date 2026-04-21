# Environment Management Quick Start

## 📋 Quick Reference

### Deploy to Environment
```bash
# Development (auto-deploys on develop branch push)
./scripts/deploy/deploy.sh dev

# Staging (manual - requires approval)
./scripts/deploy/deploy.sh staging

# Production (manual - requires approval + 2 reviews)
./scripts/deploy/deploy.sh prod
```

### Validate Configuration
```bash
# Validate all environments
./scripts/deploy/validate-env.sh all

# Validate specific environment
./scripts/deploy/validate-env.sh dev
```

### Rollback
```bash
./scripts/deploy/rollback.sh [dev|staging|prod]
```

---

## 🚀 Deployment Flow

```
feature/* → develop → [Tests] → [Deploy to DEV]
                          ↓
                       staging → [Tests] → [Manual Approval] → [Deploy to STAGING]
                          ↓
                        main → [Code Review x2+] → [Manual Approval] → [Deploy to PROD]
```

---

## 🔧 Development Setup

### 1. Local Development
```bash
# Install dependencies
cd backend
npm install

# Load environment variables
cp .env.dev .env

# Start Docker containers
docker-compose up -d

# Run development server
npm run dev
```

### 2. Feature Development
```bash
# Create feature branch
git checkout -b feature/EX-123-description develop

# Make changes and commit
git commit -m "feat(scope): add new feature"

# Keep updated with develop
git fetch origin develop
git rebase origin/develop

# Push and create PR
git push origin feature/EX-123-description
```

### 3. Merge to Production
```
Merge to develop  → Automated CI/CD → Deploy to DEV
     ↓
     └→ When ready, create PR from develop to staging
            ↓
            └→ Staging tests + approval → Deploy to STAGING
                   ↓
                   └→ When ready, create PR from staging to main
                          ↓
                          └→ Production approval + deploy → Deploy to PROD
```

---

## 📁 File Structure

```
docs/environments/
├── STRATEGY.md              # Overall strategy (this document)
├── BRANCH_POLICY.md         # Git branching rules
├── ENV_VARIABLES.md         # Configuration reference
├── DEPLOY_SCRIPTS.md        # Deployment procedures
└── README.md               # Quick start

infrastructure/environments/
├── terraform.tfvars.dev     # DEV Terraform variables
├── terraform.tfvars.staging # STAGING Terraform variables
└── terraform.tfvars.prod    # PROD Terraform variables

backend/
├── .env.dev                 # DEV environment variables (git-tracked)
├── .env.staging             # STAGING environment variables (git-tracked)
├── .env.prod                # PROD environment variables (git-tracked)
└── Dockerfile               # Production Docker image

scripts/deploy/
├── deploy.sh                # Main deployment script
├── validate-env.sh          # Validate environment configuration
└── rollback.sh              # Rollback to previous deployment
```

---

## 🌳 Branches

| Branch | Purpose | Auto-Deploy | Review Required |
|--------|---------|-------------|-----------------|
| `main` | Production releases | ❌ Manual | ✅ 2+ reviews + CODEOWNERS |
| `staging` | Pre-production testing | ❌ Manual | ✅ 2 reviews |
| `develop` | Integration branch | ✅ Auto to DEV | ✅ 1 review |
| `feature/*` | Feature development | ❌ No | ✅ 1 review to develop |

---

## 🔐 Secrets Management

### Local Development
- Secrets in `.env.dev` (safe defaults)
- No real AWS credentials needed

### AWS (Staging & Production)
- All secrets in AWS Secrets Manager
- Pattern: `/expose/{environment}/{secret-name}`
- Example: `/expose/prod/db-password`

### Loading Secrets
```javascript
// Automatically loaded in backend/src/config/env.ts
import { loadSecrets } from './config/env';

const secrets = await loadSecrets(process.env.NODE_ENV);
const dbPassword = secrets['db-password'];
```

---

## ⚠️ Important Notes

### Before Deploying to Production
- [ ] All tests passing
- [ ] Code reviewed by 2+ people
- [ ] CODEOWNERS approval obtained
- [ ] Staging fully tested
- [ ] Rollback plan documented
- [ ] Backups verified
- [ ] Incident commander available

### Environment Differences

| Aspect | DEV | STAGING | PROD |
|--------|-----|---------|------|
| **Database** | Single (t4g.micro) | Single (t4g.small) | Multi-AZ (r5.large) |
| **Replicas** | 1 | 2 | 3+ |
| **Monitoring** | Basic | Complete | Complete + Alerts |
| **Backups** | Daily | Daily | Every 6h |
| **SSL** | Self-signed | Valid | ACM |

---

## 📚 Detailed Documentation

- **Strategy & Architecture**: [STRATEGY.md](./STRATEGY.md)
- **Branch Policies**: [BRANCH_POLICY.md](./BRANCH_POLICY.md)
- **Configuration Reference**: [ENV_VARIABLES.md](./ENV_VARIABLES.md)
- **Deploy Procedures**: [DEPLOY_SCRIPTS.md](./DEPLOY_SCRIPTS.md)

---

## 🆘 Troubleshooting

### Cannot Deploy
```bash
# Validate environment setup
./scripts/deploy/validate-env.sh [dev|staging|prod]

# Check AWS credentials
aws sts get-caller-identity

# Check Docker
docker ps
docker-compose up -d
```

### Database Issues
```bash
# Check local database
docker exec expose-db psql -U expose_user -d expose -c "SELECT 1"

# Run migrations
cd backend
npm run db:migrate:deploy
```

### Tests Failing
```bash
# Run locally first
cd backend
npm test

# Check linting
npm run lint

# Fix linting issues
npm run lint:fix
```

---

## 📞 Support

For questions about:
- **Strategy & Planning**: See [STRATEGY.md](./STRATEGY.md)
- **Branching & Git**: See [BRANCH_POLICY.md](./BRANCH_POLICY.md)
- **Configuration**: See [ENV_VARIABLES.md](./ENV_VARIABLES.md)
- **Deployment**: See [DEPLOY_SCRIPTS.md](./DEPLOY_SCRIPTS.md)
- **Infrastructure**: See [infrastructure/terraform/README.md](../infrastructure/terraform/README.md)

---

## ✅ Next Steps

1. Read [STRATEGY.md](./STRATEGY.md) for overall architecture
2. Review [BRANCH_POLICY.md](./BRANCH_POLICY.md) for git workflow
3. Check [ENV_VARIABLES.md](./ENV_VARIABLES.md) for configuration
4. Study [DEPLOY_SCRIPTS.md](./DEPLOY_SCRIPTS.md) for deployment procedures
5. Follow branch policy when creating PRs
6. Use deployment scripts for releases

---

Last Updated: 2026-04-20

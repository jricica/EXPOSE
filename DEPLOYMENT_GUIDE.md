# Backend Deployment Pipeline Guide

## Overview
This guide explains the complete CI/CD pipeline for deploying the backend to AWS EC2.

## Architecture
```
GitHub (main branch)
    ↓
GitHub Actions Workflow
    ↓ (build & validate)
    ↓ (tests)
    ↓ (build dist)
    ↓
EC2 Instance
    ↓ (SSH connect)
    ↓ (copy files)
    ↓ (migrations)
    ↓ (restart service)
RDS MySQL Database
```

## Prerequisites

### 1. GitHub Secrets Configuration
Configure these secrets in your GitHub repository (**Settings > Secrets and variables > Actions**):

```
EC2_HOST              = 3.144.15.174
EC2_USER              = ubuntu
EC2_SSH_KEY           = <your private SSH key>
DATABASE_URL          = mysql://root:PASSWORD@endpoint:3306/social-media
DATABASE_USER         = root
DATABASE_PASSWORD     = <password>
DATABASE_NAME         = social-media
DATABASE_HOST         = social-media.ctyigs8me0m9.us-east-2.rds.amazonaws.com
DATABASE_PORT         = 3306
PORT                  = 3000
JWT_SECRET            = <your jwt secret>
```

### 2. EC2 Setup (One-time)
Run the setup script on your EC2 instance:

```bash
# Connect to EC2
ssh -i your-key.pem ubuntu@3.144.15.174

# Clone the repository
git clone https://github.com/YOUR_ORG/EXPOSE.git
cd EXPOSE

# Run setup script
bash backend/scripts/setup-ec2.sh
```

### 3. RDS Security Group
Ensure the RDS security group allows inbound traffic from EC2:
- **Protocol:** TCP
- **Port:** 3306
- **Source:** EC2 security group ID (or 0.0.0.0/0 for testing, but restrict in production)

## Deployment Flow

### Step 1: Push to Main Branch
```bash
git push origin feature-ex-059
```

### Step 2: Create Pull Request
- Open GitHub and create a PR from your branch to `main`
- Add description and click "Create pull request"

### Step 3: Merge PR
- Click "Merge pull request"
- Confirm the merge
- GitHub Actions will automatically trigger

### Step 4: Monitor Deployment
Go to **GitHub > Actions > Deploy** to watch the workflow:
- ✅ Build step (install deps, compile TS)
- ✅ Test step (run jest tests)
- ✅ Deploy to EC2
- ✅ Run migrations
- ✅ Restart service

### Step 5: Verify Deployment
```bash
# SSH into EC2
ssh -i your-key.pem ubuntu@3.144.15.174

# Check service status
sudo systemctl status social-media-api

# View logs
sudo journalctl -u social-media-api -f

# Test API
curl http://localhost:3000/api/health
```

## Manual Deployment (If needed)

If you need to deploy without merging to main:

```bash
# Connect to EC2
ssh -i your-key.pem ubuntu@3.144.15.174

# Go to app directory
cd /var/www/social-media

# Pull latest code
git pull origin main

# Install dependencies
npm install

# Build
npm run build

# Create env file
cat > .env <<EOF
PORT=3000
DATABASE_URL=$DATABASE_URL
DATABASE_USER=$DATABASE_USER
DATABASE_PASSWORD=$DATABASE_PASSWORD
DATABASE_NAME=$DATABASE_NAME
DATABASE_HOST=$DATABASE_HOST
DATABASE_PORT=$DATABASE_PORT
JWT_SECRET=$JWT_SECRET
EOF

# Run migrations
npx prisma migrate deploy

# Restart service
sudo systemctl restart social-media-api
```

## Troubleshooting

### Workflow fails at "Install dependencies"
- Check: Do all `npm` scripts in `package.json` exist?
- Fix: Run `npm run build` locally to verify it works

### Workflow fails at "Deploy to EC2"
- Check: Is EC2_SSH_KEY correctly added as a secret?
- Check: Is EC2_HOST reachable and accepting SSH?
- Fix: Test SSH manually: `ssh -i key.pem ubuntu@EC2_HOST`

### Workflow fails at "Run migrations"
- Check: Is DATABASE_URL correctly URL-encoded?
- Check: Does RDS security group allow EC2?
- Fix: Test connection from EC2: `mysql -h $DB_HOST -u $DB_USER -p`

### Service doesn't restart
```bash
# SSH to EC2 and check
sudo journalctl -u social-media-api -n 50

# Restart manually
sudo systemctl restart social-media-api
sudo systemctl status social-media-api
```

## Rollback (if something breaks)

```bash
# SSH to EC2
ssh -i your-key.pem ubuntu@3.144.15.174

# Stop the service
sudo systemctl stop social-media-api

# Revert to previous commit
cd /var/www/social-media
git revert HEAD
git push origin main

# Rebuild and restart
npm install && npm run build
npx prisma migrate deploy
sudo systemctl start social-media-api
```

## Environment Variables Reference

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | Full MySQL connection string | `mysql://root:pass@host:3306/db` |
| `DATABASE_HOST` | RDS endpoint | `social-media.xxx.us-east-2.rds.amazonaws.com` |
| `DATABASE_USER` | MySQL user | `root` |
| `DATABASE_PASSWORD` | MySQL password | (auto-encoded in URL) |
| `DATABASE_NAME` | Database name | `social-media` |
| `DATABASE_PORT` | MySQL port | `3306` |
| `PORT` | API server port | `3000` |
| `JWT_SECRET` | JWT signing key | (random 32-byte hex) |

## Monitoring & Maintenance

### Check logs
```bash
sudo journalctl -u social-media-api -f
```

### Check disk space
```bash
df -h
```

### Check database connection
```bash
cd /var/www/social-media
node -e "const db = require('./dist/db/pool'); db.execute('SELECT 1').then(() => console.log('✅ Connected'));"
```

### Update dependencies (manual)
```bash
cd /var/www/social-media
npm update
npm run build
sudo systemctl restart social-media-api
```

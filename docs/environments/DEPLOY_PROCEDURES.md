# Deployment Procedures

## Overview

This document describes standard operating procedures for deploying EXPOSE to each environment.

---

## 1. Development (DEV) Deployment

### Trigger
- **Automatic**: On push to `develop` branch
- **Manual**: Running `./scripts/deploy/deploy.sh dev`

### Process
```
Push to develop
    ↓
GitHub Actions triggered
    ↓
Run tests + lint
    ↓
Build Docker image
    ↓
Push to ECR
    ↓
Update ECS service
    ↓
Monitor deployment (5 min)
    ↓
✅ Deployed to DEV
```

### Time to Deploy
- **Typical**: 5-10 minutes
- **Max**: 15 minutes

### Monitoring
- CloudWatch Logs
- Basic Sentry monitoring
- Health check: `/api/health`

### Success Criteria
- All tests pass
- Service is running (desired = running count)
- Health checks pass
- No errors in logs

### If Deployment Fails
```bash
# Check logs
aws logs tail /expose/dev/app

# Check ECS service
aws ecs describe-services --cluster expose-dev --services expose-backend-dev

# Rollback (if needed)
./scripts/deploy/rollback.sh dev
```

---

## 2. Staging (STAGING) Deployment

### Trigger
- **Manual**: Only from `staging` branch
- Requires PR approval from 2+ reviewers

### Pre-Deployment Checklist
- [ ] All tests passing
- [ ] Code reviewed (≥2 reviews)
- [ ] Linting passed
- [ ] Security scan passed
- [ ] Staging database backed up
- [ ] Incident commander on standby

### Process
```bash
# 1. Ensure you're on staging branch
git checkout staging
git pull origin staging

# 2. Validate configuration
./scripts/deploy/validate-env.sh staging

# 3. Deploy
./scripts/deploy/deploy.sh staging

# 4. Run smoke tests
npm run test:smoke:staging

# 5. Run E2E tests (optional)
npm run test:e2e:staging
```

### Time to Deploy
- **Typical**: 10-15 minutes
- **With tests**: 20-30 minutes

### Monitoring
```bash
# Watch logs in real-time
aws logs tail /expose/staging/app --follow

# Check service status
aws ecs describe-services \
  --cluster expose-staging \
  --services expose-backend-staging

# Check database
mysql -h $STAGING_DB_HOST -u expose_user -p expose -e "SELECT COUNT(*) FROM users;"
```

### Success Criteria
- All Docker containers running
- Zero errors in application logs
- Database migrations applied
- All endpoints responding
- Sentry showing 0 errors
- Health check passing

### Testing in Staging
```bash
# Smoke tests (basic connectivity)
npm run test:smoke:staging

# API tests
npm run test:api:staging

# Load test (optional)
npm run test:load:staging

# E2E tests (optional)
npm run test:e2e:staging
```

### If Issues Found
```bash
# Option 1: Fix and redeploy
git checkout staging
# Fix the issue
git commit -m "fix: address staging issue"
git push origin staging
./scripts/deploy/deploy.sh staging

# Option 2: Rollback to previous version
./scripts/deploy/rollback.sh staging
```

---

## 3. Production (PROD) Deployment

### Trigger
- **Manual only**: From `main` branch
- Requires PR approval from CODEOWNERS + 2 reviewers
- Must be a tagged release

### Pre-Deployment Checklist
- [ ] Feature tested in staging ≥ 24 hours
- [ ] Code reviewed by CODEOWNERS
- [ ] All tests passing (dev, staging)
- [ ] Security scan passed
- [ ] Database backup created
- [ ] Incident commander assigned
- [ ] On-call engineer notified
- [ ] Rollback plan documented
- [ ] Release notes prepared
- [ ] Monitoring dashboards ready

### Pre-Production Steps
```bash
# 1. Verify tag exists
git tag -l | grep latest-tag

# 2. Verify main branch is clean
git checkout main
git pull origin main
git status  # should be clean

# 3. Create/verify release tag (if not created)
git tag -a v1.2.3 -m "Release v1.2.3"
git push origin v1.2.3

# 4. Validate configuration
./scripts/deploy/validate-env.sh prod

# 5. Review changes vs previous version
git log v1.2.2..v1.2.3 --oneline

# 6. Backup database
aws rds create-db-snapshot \
  --db-instance-identifier expose-prod \
  --db-snapshot-identifier expose-prod-v1.2.3-backup
```

### Deployment
```bash
# 1. FINAL validation
./scripts/deploy/validate-env.sh prod

# 2. Deploy (requires confirmation)
./scripts/deploy/deploy.sh prod

# Expected output: "Deploying to prod... continue? [y/N]"
# Type 'y' and press Enter
```

### Time to Deploy
- **Typical**: 15-20 minutes
- **With monitoring**: 30-40 minutes

### Post-Deployment Validation
```bash
# 1. Health checks
curl https://api.expose.com/api/health

# 2. Critical paths testing
npm run test:critical:prod

# 3. Monitor dashboards
# Open: https://cloudwatch.aws.amazon.com/expose-prod

# 4. Check error rates
aws cloudwatch get-metric-statistics \
  --namespace AWS/ECS \
  --metric-name HTTPServerErrorCount \
  --dimensions Name=ServiceName,Value=expose-prod \
  --start-time $(date -u -d '10 minutes ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 60 \
  --statistics Sum

# 5. Check logs for errors
aws logs tail /expose/prod/app --since 5m
```

### Success Criteria
- ✅ Health check returning 200 OK
- ✅ Error rate < 0.1%
- ✅ P99 latency < 500ms
- ✅ No spike in exception rate
- ✅ Database performing normally
- ✅ All critical user flows working
- ✅ No negative user feedback

### If Critical Issues Occur

**IMMEDIATE ACTIONS** (< 5 minutes):
```bash
# 1. Declare incident
# Notify team in Slack #incidents channel

# 2. Assess severity
# Is it affecting critical functionality?

# 3. If YES - Rollback immediately
./scripts/deploy/rollback.sh prod

# 4. If NO - Investigate first
aws logs tail /expose/prod/app --follow
```

**ROLLBACK PROCEDURE**:
```bash
# 1. Initiate rollback
./scripts/deploy/rollback.sh prod

# 2. Verify rollback completed
curl https://api.expose.com/api/health

# 3. Run smoke tests
npm run test:smoke:prod

# 4. Monitor for issues
aws logs tail /expose/prod/app --follow --since 5m

# 5. Post-incident review
# Document what happened and why
```

**ROOT CAUSE ANALYSIS**:
- Meet with team within 24 hours
- Document findings in incident report
- Implement preventive measures
- Update runbooks if needed

---

## 4. Deployment Monitoring

### Key Metrics to Watch

**Application Metrics**:
- Error rate (target: < 0.1%)
- Response latency (target: p95 < 200ms, p99 < 500ms)
- Active connections
- DB connection pool usage
- Cache hit rate (Redis)

**Infrastructure Metrics**:
- CPU usage (target: < 70%)
- Memory usage (target: < 80%)
- Network I/O
- Disk usage

**Business Metrics**:
- Users active
- API requests/sec
- Revenue impact (if applicable)

### Monitoring Tools
```bash
# AWS CloudWatch
aws cloudwatch get-dashboard --dashboard-name expose-prod

# Logs
aws logs tail /expose/prod/app --follow

# ECS
aws ecs describe-services --cluster expose-prod --services expose-backend-prod

# RDS
aws rds describe-db-instances --db-instance-identifier expose-prod
```

### Alert Response

**When you receive an alert**:
1. Acknowledge in PagerDuty within 5 minutes
2. Check CloudWatch dashboard
3. Review logs in CloudWatch Logs
4. If critical, initiate incident response (see Rollback above)
5. If not critical, investigate and resolve

---

## 5. Rollback Procedures

### When to Rollback
- **CRITICAL**: API is down or 502/503 errors
- **HIGH**: Error rate > 1% or latency p99 > 1s
- **MEDIUM**: Data loss or security issue
- **LOW**: Non-critical features not working

### Rollback Command
```bash
./scripts/deploy/rollback.sh prod
```

### Rollback Validation
```bash
# 1. Check health
curl -v https://api.expose.com/api/health

# 2. Verify service is running
aws ecs describe-services \
  --cluster expose-prod \
  --services expose-backend-prod

# 3. Check logs for errors
aws logs tail /expose/prod/app --since 5m

# 4. Run critical tests
npm run test:smoke:prod
```

### Post-Rollback
1. Notify stakeholders in #incidents
2. Gather team for post-mortem
3. Identify root cause
4. Document findings
5. Fix and re-test before attempting redeployment

---

## 6. Emergency Procedures

### Incident Response

**Severity Levels**:
- **CRITICAL**: Service down, data loss, security breach
- **HIGH**: Significant user impact, errors > 1%
- **MEDIUM**: Feature broken, degraded performance
- **LOW**: Minor issues, workaround available

**CRITICAL Response**:
```
1. Declare incident in #incidents
2. Page on-call engineer
3. Rollback immediately
4. Validate service is restored
5. Post-mortem within 24 hours
```

### Contacts
- **On-call engineer**: See PagerDuty schedule
- **DevOps lead**: Victor Saravia
- **Engineering manager**: [Name]
- **CEO/Business**: [Name]

---

## 7. Maintenance Windows

### Scheduled Maintenance
- **Day**: Sunday 02:00-04:00 UTC (low-traffic time)
- **Notice**: 7 days advance notice
- **Maintenance window**: Maximum 2 hours
- **Rollback plan**: Required

### Examples
- Database migrations
- Infrastructure upgrades
- Critical security patches
- Certificate renewals

### Maintenance Checklist
- [ ] Scheduled notification sent 7 days in advance
- [ ] Maintenance window published
- [ ] Incident commander assigned
- [ ] Backup created
- [ ] Rollback plan documented
- [ ] Team on standby
- [ ] Status page updated
- [ ] Post-maintenance validation performed

---

## 8. Deployment Troubleshooting

### Common Issues

**Issue: "Deployment timed out"**
```bash
# Check ECS events
aws ecs describe-services \
  --cluster expose-prod \
  --services expose-backend-prod \
  --query 'services[0].events[:3]'

# Check container logs
aws ecs describe-tasks \
  --cluster expose-prod \
  --tasks $(aws ecs list-tasks --cluster expose-prod --query 'taskArns[0]' --output text) \
  --query 'tasks[0].containerInstanceArn'
```

**Issue: "ECS placement constraint mismatch"**
```bash
# List available instances
aws ecs list-container-instances --cluster expose-prod

# Check instance capacity
aws ecs describe-container-instances \
  --cluster expose-prod \
  --container-instances <instance-arn>
```

**Issue: "Database migration failed"**
```bash
# Check migration status
npm run db:migrate:status

# Rollback migration
npm run db:migrate:rollback

# Fix and retry
npm run db:migrate:deploy
```

---

## 9. Deployment Checklist

### Before Any Deployment
```
[ ] All tests passing locally
[ ] Linting passing
[ ] No console errors
[ ] Environment variables configured
[ ] Docker running (if local)
[ ] AWS credentials valid
[ ] On correct branch
[ ] Latest code pulled
```

### Before Staging Deployment
```
[ ] DEV fully tested
[ ] Code reviewed (≥2 reviews)
[ ] Security scan passed
[ ] Database backup created
[ ] Staging backup created
[ ] Team notified
[ ] All pre-checks passing
```

### Before Production Deployment
```
[ ] Staging tested ≥24 hours
[ ] CODEOWNERS approval obtained
[ ] Code reviewed (≥2 reviews)
[ ] Security scan passed
[ ] Database backup created
[ ] Incident commander assigned
[ ] On-call engineer on standby
[ ] Release notes prepared
[ ] Rollback plan documented
[ ] All monitoring dashboards ready
```

---

## Related Documentation

- [Environment Strategy](./STRATEGY.md)
- [Branch Policy](./BRANCH_POLICY.md)
- [Environment Variables](./ENV_VARIABLES.md)
- [Rollback Procedures](./ROLLBACK.md)
- [Incident Response](./INCIDENT_RESPONSE.md)

# Estrategia de Ambientes: DEV, STAGING, PROD

## 1. Descripción General

Esta estrategia define políticas estandarizadas para gestionar código, infraestructura, variables y secretos a través de tres ambientes: **Development (DEV)**, **Staging (STAGING)** y **Production (PROD)**.

**Objetivo**: Eliminar configuraciones manuales, evitar errores de promoción y garantizar consistencia entre ambientes.

---

## 2. Ambientes

### 2.1 Development (DEV)
- **Propósito**: Desarrollo y testing continuo
- **Ubicación**: AWS (`us-east-2`)
- **Rama**: `develop`
- **Deploy**: Automático en cada push
- **Características**:
  - BD pequeña para testing
  - Logs con nivel DEBUG
  - Sin restricciones de rate-limit
  - Auto-SSL deshabilitado
  - Monitoreo básico

### 2.2 Staging (STAGING)
- **Propósito**: Validación pre-producción
- **Ubicación**: AWS (`us-east-2`)
- **Rama**: `staging`
- **Deploy**: Manual (requiere approval)
- **Características**:
  - **Réplica exacta de PROD** (infraestructura)
  - Datos de prueba
  - Validar con traffic real
  - SSL válido
  - Monitoreo completo
  - Rollback testing

### 2.3 Production (PROD)
- **Propósito**: Ambiente en vivo
- **Ubicación**: AWS (`us-east-2`)
- **Rama**: `main`
- **Deploy**: Manual con aprobación requerida
- **Características**:
  - Máxima confiabilidad
  - Multi-AZ
  - Auto-escalado
  - Backups cada 6 horas
  - Alertas configuradas
  - SLA 99.9%

---

## 3. Flujo de Ramas y Promoción

```
┌──────────────┐
│  feature/*   │ (feature branches)
└──────┬───────┘
       │ PR → develop
       ↓
┌──────────────────────────────────────┐
│  develop (rama principal dev)         │
│  Auto-deploy a DEV                    │
└──────┬───────────────────────────────┘
       │ PR → staging
       ↓
┌──────────────────────────────────────┐
│  staging (rama pre-producción)        │
│  Deploy manual a STAGING              │
│  Validación E2E antes de prod         │
└──────┬───────────────────────────────┘
       │ PR → main (con code review)
       ↓
┌──────────────────────────────────────┐
│  main (rama de producción)            │
│  Deploy manual a PROD                 │
│  Tag semántico (v1.0.0)               │
└──────────────────────────────────────┘
```

**Políticas**:
- ✅ Cualquiera puede pushear a `feature/*`
- ✅ PRs a `develop` requieren 1 review
- ⚠️ PRs a `staging` requieren 2 reviews
- 🔒 PRs a `main` requieren CODEOWNERS + 2 reviews
- 🔒 Tags de release solo por admin

---

## 4. Infraestructura por Ambiente

### 4.1 Base de Datos (RDS MySQL)

| Métrica | DEV | STAGING | PROD |
|---------|-----|---------|------|
| Instance Class | `db.t4g.micro` | `db.t4g.small` | `db.r5.large` |
| Multi-AZ | ❌ No | ❌ No | ✅ Sí |
| Storage | 20 GB | 50 GB | 200 GB |
| Backup Retention | 7 días | 30 días | 90 días |
| Backup Window | No critical | 02:00-03:00 UTC | 02:00-03:00 UTC |
| Enhanced Monitoring | ❌ No | ⚠️ Básico | ✅ Granular |
| Performance Insights | ❌ No | ⚠️ Sí | ✅ Sí |

### 4.2 Cache (ElastiCache Redis)

| Métrica | DEV | STAGING | PROD |
|---------|-----|---------|------|
| Node Type | `cache.t4g.micro` | `cache.t4g.micro` | `cache.r7g.large` |
| Num Nodes | 1 | 1 | 2 (Multi-AZ) |
| Engine Version | 7 | 7 | 7 |
| Automatic Failover | ❌ No | ❌ No | ✅ Sí |
| Auto-backup | ❌ No | ⚠️ Daily | ✅ Hourly |

### 4.3 Application (ECS)

| Métrica | DEV | STAGING | PROD |
|---------|-----|---------|------|
| CPU | 256 | 512 | 1024 |
| Memory | 512 MB | 1024 MB | 2048 MB |
| Desired Count | 1 | 2 | 3 |
| Min Replicas | 1 | 1 | 2 |
| Max Replicas | 2 | 4 | 8 |
| Scaling Policy | Manual | Manual | CPU (40-80%) |
| Health Check | Basic | Complete | Complete + ALB |

### 4.4 Storage (S3)

| Métrica | DEV | STAGING | PROD |
|---------|-----|---------|------|
| Bucket | `expose-media-dev` | `expose-media-staging` | `expose-media-prod` |
| Versioning | ❌ No | ✅ Sí | ✅ Sí |
| Encryption | AES-256 | AES-256 | AWS KMS |
| Lifecycle | Delete after 30d | 60d retention | 365d retention |
| Public Access | Blocked | Blocked | Blocked |
| Replication | ❌ No | ❌ No | ✅ Cross-region |

### 4.5 Monitoring & Logging

| Métrica | DEV | STAGING | PROD |
|---------|-----|---------|------|
| CloudWatch Logs | ✅ Yes | ✅ Yes | ✅ Yes |
| Log Retention | 7 días | 30 días | 90 días |
| Sentry | Basic | Complete | Complete + Alerts |
| Dashboards | Basic | Complete | Executive + Ops |
| Alerting | None | Email | SMS + Slack + PagerDuty |
| Metrics Resolution | 5 min | 1 min | 1 min |

---

## 5. Variables y Configuración

### 5.1 Jerarquía de Configuración

```
Sistema Operativo (env vars)
    ↓
.env.[ENVIRONMENT] (versionado en repo, NO secretos)
    ↓
AWS Secrets Manager (secretos, por ambiente)
    ↓
Runtime (código se une todo)
```

### 5.2 Variables por Ambiente

**DEV (.env.dev)**:
```env
NODE_ENV=development
APP_NAME=EXPOSE-DEV
API_URL=https://api-dev.expose.local
WEB_URL=https://dev.expose.local
LOG_LEVEL=debug
JWT_EXPIRES_IN=7d
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
DB_HOST=expose-db-dev.c123.us-east-2.rds.amazonaws.com
DB_PORT=3306
DB_NAME=expose
DB_POOL_MIN=2
DB_POOL_MAX=5
REDIS_NODES=1
S3_BUCKET=expose-media-dev
SENTRY_ENABLED=false
SENTRY_TRACE_SAMPLE_RATE=0.1
```

**STAGING (.env.staging)**:
```env
NODE_ENV=staging
APP_NAME=EXPOSE-STAGING
API_URL=https://api-staging.expose.com
WEB_URL=https://staging.expose.com
LOG_LEVEL=info
JWT_EXPIRES_IN=7d
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=50
DB_HOST=expose-db-staging.c123.us-east-2.rds.amazonaws.com
DB_PORT=3306
DB_NAME=expose
DB_POOL_MIN=5
DB_POOL_MAX=20
REDIS_NODES=1
S3_BUCKET=expose-media-staging
SENTRY_ENABLED=true
SENTRY_TRACE_SAMPLE_RATE=0.5
```

**PROD (.env.prod)**:
```env
NODE_ENV=production
APP_NAME=EXPOSE
API_URL=https://api.expose.com
WEB_URL=https://expose.com
LOG_LEVEL=warn
JWT_EXPIRES_IN=7d
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=30
DB_HOST=expose-db-prod.c123.us-east-2.rds.amazonaws.com
DB_PORT=3306
DB_NAME=expose
DB_POOL_MIN=10
DB_POOL_MAX=50
REDIS_NODES=2
S3_BUCKET=expose-media-prod
SENTRY_ENABLED=true
SENTRY_TRACE_SAMPLE_RATE=0.1
```

### 5.3 Secretos en AWS Secrets Manager

Patrón: `/expose/{ENVIRONMENT}/{SECRET_NAME}`

**DEV**:
- `/expose/dev/db-password`
- `/expose/dev/jwt-secret`
- `/expose/dev/sentry-dsn`
- `/expose/dev/aws-s3-key`
- `/expose/dev/aws-s3-secret`

**STAGING**:
- `/expose/staging/db-password`
- `/expose/staging/jwt-secret`
- `/expose/staging/sentry-dsn`
- `/expose/staging/aws-s3-key`
- `/expose/staging/aws-s3-secret`

**PROD**:
- `/expose/prod/db-password`
- `/expose/prod/jwt-secret`
- `/expose/prod/sentry-dsn`
- `/expose/prod/aws-s3-key`
- `/expose/prod/aws-s3-secret`

---

## 6. Scripts de Deploy

Todos los scripts están en `scripts/deploy/`:

```bash
./deploy.sh dev        # Deploy a development
./deploy.sh staging    # Deploy a staging  
./deploy.sh prod       # Deploy a producción

./validate-env.sh      # Validar configuración
./rollback.sh env      # Rollback de versión anterior
./promote.sh           # Promover staging a prod
```

---

## 7. Checklist de Seguridad

### Pre-Deploy DEV
- [ ] Tests locales pasan
- [ ] Linting sin errores
- [ ] No hay secretos en el código

### Pre-Deploy STAGING
- [ ] PR tiene ≥2 reviews
- [ ] Tests pasan en CI/CD
- [ ] Migrations verificadas
- [ ] Database schema compatible
- [ ] No breaking changes

### Pre-Deploy PROD
- [ ] CODEOWNERS han revisado
- [ ] PR tiene ≥2 reviews
- [ ] Staging validado por QA
- [ ] Rollback plan documentado
- [ ] Backups realizados
- [ ] Alertas configuradas
- [ ] Incident commander disponible

---

## 8. Monitoreo y Observabilidad

### Dashboards

**DEV**: Mínimo (`dashboard-dev.json`)
- Latencia API
- Error rate
- DB connections

**STAGING**: Completo (`dashboard-staging.json`)
- Latencia API
- Error rate
- DB performance
- Cache hit ratio
- Memory usage

**PROD**: Ejecutivo + Operacional (`dashboard-prod.json`)
- SLA metrics
- Error budgets
- Revenue impact
- Infrastructure costs

### Alertas (PagerDuty)

**DEV**: Email
- DB connection errors
- API 5xx errors > 1%

**STAGING**: Email + Slack
- DB connection errors
- API 5xx errors > 0.5%
- Deployment failures

**PROD**: SMS + Slack + PagerDuty
- DB connection errors
- API 5xx errors > 0.1%
- Deployment failures
- High latency (p99 > 500ms)
- High memory usage (>80%)

---

## 9. Documentación Relacionada

- [Infraestructura Terraform](../infrastructure/terraform/README.md)
- [Variables de Ambiente](./ENV_VARIABLES.md)
- [Scripts de Deploy](./DEPLOY_SCRIPTS.md)
- [Procedimiento de Rollback](./ROLLBACK.md)
- [Incident Response](./INCIDENT_RESPONSE.md)

---

## 10. Próximos Pasos

1. ✅ Definir estrategia (este documento)
2. ⏳ Crear archivos `.env.{environment}` por rama
3. ⏳ Configurar terraform.tfvars por ambiente
4. ⏳ Implementar scripts de deploy automatizados
5. ⏳ Configurar GitHub Actions workflows
6. ⏳ Documentar runbooks de operación
7. ⏳ Capacitar al equipo

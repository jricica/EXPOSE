# RDS Security Hardening - Complete Documentation

Este directorio contiene toda la estrategia y implementación para endurecer la conectividad de tu base de datos RDS MySQL.


## 📊 Current vs Target State

### CURRENT STATE (INSECURE)
```
RDS Instance: social-media
├─ Publicly Accessible: YES ← CRITICAL RISK
├─ Inbound from: 181.174.93.109/32 ← PUBLIC IP
├─ Outbound to: 0.0.0.0/0 ← ANYWHERE
├─ No network isolation
├─ Storage encrypted: Yes
├─ IAM Auth: Enabled
└─ Backups: Enabled

Security Posture: VULNERABLE
Compliance: FAIL (CIS, PCI DSS)
```

### TARGET STATE (SECURED)
```
RDS Instance: social-media
├─ Publicly Accessible: NO
├─ Inbound from: EC2 SG only (sg-07e51aa3ebaa7d2d2)
├─ Outbound to: VPC CIDR (10.2.0.0/16)
├─ Network isolation: Full
├─ Storage encrypted: Yes
├─ IAM Auth: Enforced
├─ TLS/SSL: Mandatory
├─ CloudWatch Logs: Enabled
└─ Enhanced Monitoring: Enabled

Security Posture: SECURED
Compliance: PASS (CIS, PCI DSS, SOC 2)
```

---

## Architecture Overview

```
BEFORE (INSECURE)
┌─────────────────────┐
│   Internet          │
│ 181.174.93.109      │
└──────────┬──────────┘
           │ ← Can connect!
           ↓
    ┌─────────────┐
    │    RDS      │ Publicly Accessible 
    │  Port 3306  │
    └─────────────┘
           │
           ↓
    [Anywhere] ← Can reach everywhere 

┌─────────────────────────────────────────────┐
│ VPC (10.2.0.0/16)                          │
├─────────────────────────────────────────────┤
│ EC2 (Private)  →  RDS (Data Subnet)        │
│ Via public IP!       ← Wrong!              │
└─────────────────────────────────────────────┘


AFTER (SECURED)
┌─────────────────────┐
│   Internet          │
│ 181.174.93.109      │
└──────────┬──────────┘
           │ ← Cannot connect ✓
           ✗ (blocked by VPC)
           
┌─────────────────────────────────────────────┐
│ VPC (10.2.0.0/16)                          │
├─────────────────────────────────────────────┤
│ EC2 (Private) → SG Rule → RDS (Data)       │
│ sg-07e51aa...    tcp/3306  sg-00341...     │
│                                            │
│ Egress: Only VPC CIDR (10.2.0.0/16)       │
│ ✓ Isolated, private, monitored            │
└─────────────────────────────────────────────┘
```

---

## What Gets Hardened

### Security Group Changes
| Rule | Before | After |
|------|--------|-------|
| Inbound | `0.0.0.0/0` + `181.174.93.109/32` | `sg-07e51aa3ebaa7d2d2` (EC2 only) |
| Outbound | `0.0.0.0/0` | `10.2.0.0/16` (VPC only) |

### RDS Configuration Changes
| Setting | Before | After |
|---------|--------|-------|
| Publicly Accessible | `true` | `false` |
| Network Tier | Public Internet | Private VPC |
| Monitoring | Standard | Enhanced + CloudWatch Logs |

### Network Architecture
| Layer | Before | After |
|-------|--------|-------|
| Subnets | Mixed public/private | Segregated data subnet |
| NAT | Not needed | Only for data egress |
| Access Control | IP-based | Security Group based |

---

## Implementation Steps Summary

### Phase 1: Security Rules (0 min downtime)
1. Add security group rule: EC2 → RDS
2. Verify connectivity via private IP
3. Remove public CIDR rule
4. Zero downtime, immediate improvement

### Phase 2: Disable Public Access (2-5 min downtime)
1. Update Terraform: `publicly_accessible = false`
2. RDS restarts (3 minutes)
3. Verify connectivity restored
4. Brief downtime, high security gain

### Phase 3: Optional Enhancements
1. Deploy RDS Proxy (connection pooling)
2. Enable query caching
3. Enforce IAM authentication
4. Production-grade optimization

---

## Success Criteria

After hardening, you should have:

**Security**
- RDS not publicly accessible
- Only EC2 can connect (via SG)
- Egress restricted to VPC
- No external network exposure

**Functionality**
- Applications connect normally
- No latency increase
- Database queries work as before
- No authentication failures

**Compliance**
- CIS Benchmarks: PASS
- PCI DSS: PASS
- AWS Well-Architected: PASS
- SOC 2: PASS

---

## Costs

### No Additional Costs For
- Security Group configuration
- RDS hardening
- Monitoring (included in RDS)
- Terraform automation

### Optional Paid Services
- RDS Proxy: ~$0.015/hour (~$11/month)
- Enhanced Monitoring: Included with RDS
- CloudWatch Logs: Free tier covers most

---

## ⏱ Timeline

| Week | Task | Duration | Risk |
|------|------|----------|------|
| Week 1 | Phase 1 (SG Rules) | 5 min | LOW |
| Week 2 | Testing & Validation | 1-2 hours | NONE |
| Week 3 | Phase 2 (Public Access) | 2-5 min | MEDIUM |
| Week 4 | Monitoring & Docs | 1-2 hours | NONE |
| Week 5+ | Optional: RDS Proxy | 1 hour | LOW |


---

## 📚 Related AWS Documentation

- [RDS Security Groups](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Overview.RDSSecurityGroups.html)
- [VPC Security Groups](https://docs.aws.amazon.com/vpc/latest/userguide/VPC_SecurityGroups.html)
- [RDS IAM Authentication](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/UsingWithRDS.IAMDBAuth.html)
- [RDS Proxy](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/rds-proxy.html)
- [CIS AWS Foundations Benchmark](https://docs.aws.amazon.com/securityhub/latest/userguide/cis-aws-foundations-benchmark.html)


---

## Document Index

```
infrastructure/
├── RDS_EXECUTIVE_SUMMARY.md          ← Start here for overview
├── RDS_QUICK_START.md                ← 4-step implementation
├── RDS_SECURITY_HARDENING.md         ← Detailed strategy
├── RDS_SECURITY_IMPLEMENTATION.md    ← Terraform code
├── RDS_PROXY_IMPLEMENTATION.md       ← Optional optimization
├── RDS_DEPLOYMENT_CHECKLIST.md       ← During implementation
├── RDS_SECURITY_README.md            ← This file
└── terraform/
    └── modules/rds/
        ├── main.tf                   ← Needs updates
        └── variables.tf              ← Needs new variables

scripts/
├── pre-rds-hardening-check.sh        ← Pre-flight check
├── validate-rds-security.sh          ← Post-hardening validation
└── deploy/
    ├── deploy.sh
    └── rollback.sh
```



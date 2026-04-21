# Branch Policies and Deployment Strategy

## Overview

This document defines the branch naming conventions, merge policies, and deployment workflow for the EXPOSE project.

---

## 1. Branch Strategy (Git Flow)

### Branch Names

```
┌─────────────────────────────────────────────────────┐
│ BRANCH NAMING CONVENTIONS                           │
├─────────────────────────────────────────────────────┤
│ main                - Production releases           │
│ staging             - Pre-production testing        │
│ develop             - Integration branch            │
│ feature/*           - New features                  │
│ bugfix/*            - Bug fixes                     │
│ hotfix/*            - Production hotfixes           │
│ refactor/*          - Refactoring (no feature)      │
│ docs/*              - Documentation                 │
│ chore/*             - Dependencies, config, etc.    │
└─────────────────────────────────────────────────────┘
```

### Naming Format

- Use **kebab-case** (lowercase with hyphens)
- Include ticket number when applicable: `feature/EX-123-user-authentication`
- Be descriptive: `feature/add-email-verification` ✅ vs `feature/email` ❌

**Examples**:
```
feature/EX-061-export-functionality
bugfix/EX-042-fix-rate-limit-header
hotfix/EX-089-critical-security-patch
refactor/simplify-auth-logic
docs/update-api-documentation
chore/upgrade-dependencies
```

---

## 2. Long-lived Branches

### `main` (Production)
- **Purpose**: Release-ready code
- **Protection**: 🔒 **CRITICAL** - Requires:
  - ≥2 code reviews from different people
  - All tests passing
  - CODEOWNERS approval
  - No direct pushes (PRs only)
- **Auto-deploy**: ❌ No (manual promotion from staging)
- **Tagging**: Semantic versioning (v1.0.0, v1.1.0-beta, etc.)

### `staging` (Pre-Production)
- **Purpose**: Production-like testing environment
- **Protection**: 🔒 **PROTECTED** - Requires:
  - ≥2 code reviews
  - All tests passing
  - Only from PRs (no direct commits)
- **Auto-deploy**: Manual (with approval)
- **Merge from**: `develop` → `staging` (PRs only)

### `develop` (Integration)
- **Purpose**: Main development branch
- **Protection**: ⚠️ **STANDARD** - Requires:
  - ≥1 code review
  - All tests passing
- **Auto-deploy**: ✅ Yes (to DEV environment)
- **Merge from**: `feature/*`, `bugfix/*`, `docs/*`, etc.

---

## 3. Temporary Branches

### Feature Branches (`feature/*`)
- **From**: Branch off `develop`
- **Back to**: Create PR to `develop`
- **Lifetime**: Until merged to `develop`
- **Example**: `feature/EX-123-user-profile`

### Bugfix Branches (`bugfix/*`)
- **From**: Branch off `develop`
- **Back to**: Create PR to `develop`
- **Lifetime**: Until merged to `develop`
- **Example**: `bugfix/EX-042-null-pointer-exception`

### Hotfix Branches (`hotfix/*`)
- **From**: Branch off `main` (critical production fixes)
- **Back to**: Create PR to `main` AND create PR to `develop`
- **Lifetime**: Until merged to both branches
- **Example**: `hotfix/EX-089-payment-processing-bug`
- **Trigger**: Emergency fix for production issue

### Refactor/Chore Branches
- **From**: Branch off `develop`
- **Back to**: Create PR to `develop`
- **Example**: `refactor/simplify-middleware`

---

## 4. Merge Policies

### General Rules

```
feature/* → develop → staging → main
                          ↓        ↓
                        STAGING   PROD
```

### Pull Request Rules

| Aspect | develop | staging | main |
|--------|---------|---------|------|
| **Requires PR** | ✅ Yes | ✅ Yes | ✅ Yes |
| **Min Reviews** | 1 | 2 | 2 + CODEOWNERS |
| **Tests Required** | ✅ Yes | ✅ Yes | ✅ Yes |
| **Lint Check** | ✅ Yes | ✅ Yes | ✅ Yes |
| **Security Scan** | ✅ Basic | ✅ Full | ✅ Full + Manual |
| **Auto-merge** | ❌ Manual | ❌ Manual | ❌ Manual |

### Merge Strategy

- **Default**: **Squash and merge** (cleaner history for features)
  - Command: `git merge --squash feature/name`
  - Exception: Infrastructure/migration commits should be preserved

- **Avoid**: Regular merge commits (creates noisy history)
- **Rebasing**: Allowed for cleanliness before merging

### Commit Conventions

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types**:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Code style (formatting, no logic change)
- `refactor`: Refactoring (no feature/fix)
- `perf`: Performance improvement
- `test`: Adding tests
- `chore`: Dependencies, build, config
- `ci`: CI/CD changes

**Examples**:
```
feat(auth): add JWT token refresh mechanism
fix(api): resolve race condition in post feed
docs: update deployment procedures
refactor(database): extract query builder into service
test(user): add unit tests for password validation
chore(deps): upgrade express to v5.2.1
```

---

## 5. Deployment Flow

### DEV Environment
```
feature/* → PR → develop
                    ↓
                [Tests + Lint]
                    ↓
            [Auto-deploy to DEV]
                    ↓
            [Smoke tests pass?]
```

**Trigger**: Push to `develop` or merge PR
**Timing**: Immediate
**Manual approval**: ❌ No

### STAGING Environment
```
develop → PR → staging
            ↓
        [Code Review x2]
        [All tests]
        [Security scan]
            ↓
    [Manual approval required]
            ↓
    [Deploy to STAGING]
            ↓
    [QA Testing cycle]
```

**Trigger**: Merge PR to `staging` + manual approval
**Timing**: On-demand
**Manual approval**: ✅ Yes (2+ reviewers)

### PROD Environment
```
staging → PR → main
            ↓
        [CODEOWNERS review]
        [Code Review x2+]
        [All tests]
        [Security scan]
            ↓
    [Create release tag]
            ↓
    [Manual approval required]
            ↓
    [Deploy to PROD]
            ↓
    [Monitor dashboards]
```

**Trigger**: Merge PR to `main` + manual approval
**Timing**: On-demand
**Manual approval**: ✅ Yes (CODEOWNERS + 2 reviewers)
**Release notes**: ✅ Required

---

## 6. Hotfix Process

For critical production bugs:

```
main (v1.0.0) ──→ hotfix/EX-XXX-issue
                        ↓
                  [Fix + Tests]
                        ↓
                  PR to main ──→ Create v1.0.1
                        ↓
                  PR to develop ──→ Keep in sync
```

1. Create `hotfix/` branch from `main`
2. Fix the issue + add tests
3. Create PR to `main` (fast-track review)
4. Tag new version (v1.0.1)
5. Create PR to `develop` to keep branches in sync
6. Deploy to PROD
7. Backport to staging if needed

---

## 7. Local Development Workflow

### Initial Setup
```bash
# Clone the repository
git clone <repo-url>
cd EXPOSE

# Set up pre-commit hooks
cp scripts/git-hooks/pre-commit .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit

# Create feature branch
git checkout -b feature/EX-123-my-feature develop
```

### During Development
```bash
# Keep branch updated
git fetch origin develop
git rebase origin/develop

# Commit with conventional format
git commit -m "feat(auth): add 2FA support"

# Push to remote
git push origin feature/EX-123-my-feature
```

### Creating Pull Request
```bash
# Push your branch
git push origin feature/EX-123-my-feature

# Create PR via GitHub interface or CLI:
gh pr create --base develop --title "feat(auth): add 2FA support"

# Description should include:
# - What was changed
# - Why it was changed
# - How to test it
# - Closes #ISSUE_NUMBER
```

### Merging
```bash
# Update before merge
git fetch origin develop
git rebase origin/develop

# Squash and merge (via GitHub UI or CLI)
gh pr merge --squash
```

---

## 8. Protected Branch Settings

### GitHub Configuration

```yaml
# main branch
require_code_review_from_code_owners: true
required_approving_review_count: 2
allow_squash_merge: true
allow_rebase_merge: false
allow_merge_commit: false
require_branches_to_be_up_to_date_before_merging: true
require_status_checks_to_pass_before_merging: true
required_status_checks:
  - ci/test
  - ci/lint
  - ci/security-scan

# staging branch
required_approving_review_count: 2
require_branches_to_be_up_to_date_before_merging: true
allow_squash_merge: true
require_status_checks_to_pass_before_merging: true

# develop branch
required_approving_review_count: 1
allow_squash_merge: true
require_status_checks_to_pass_before_merging: true
```

---

## 9. Code Owners

**File**: `.github/CODEOWNERS`

```
# Default owners
* @backend-team @frontend-team

# Infrastructure
/infrastructure/ @devops-team
/terraform/ @devops-team
/scripts/deploy/ @devops-team

# Backend
/backend/src/ @backend-team
/backend/src/config/ @devops-team @backend-team

# Frontend
/frontend/src/ @frontend-team

# Documentation
/docs/ @technical-writers

# CI/CD
/.github/ @devops-team
/scripts/ @devops-team
```

---

## 10. Enforcement

### Pre-commit Hooks
- Lint check (no commits if linting fails)
- No secrets scanning
- Commit message validation

### CI/CD Checks (GitHub Actions)
- All tests must pass
- Linting must pass
- Security scanning
- Build validation

### Enforcement Tools
- **Branch protection rules**: GitHub
- **Pre-commit hooks**: Local dev machine
- **CI/CD pipeline**: GitHub Actions
- **Automated testing**: Jest/Supertest
- **Code scanning**: SAST tools

---

## 11. Quick Reference

```bash
# Create feature branch
git checkout -b feature/EX-123-description develop

# Make changes and commit
git commit -m "feat(scope): add new feature"

# Keep updated with develop
git fetch origin
git rebase origin/develop

# Push and create PR
git push origin feature/EX-123-description
# Go to GitHub and create PR to develop

# After PR is merged, clean up
git checkout develop
git pull origin develop
git branch -d feature/EX-123-description
git push origin --delete feature/EX-123-description
```

---

## 12. References

- [Git Flow Cheatsheet](https://danielkummer.github.io/git-flow-cheatsheet/)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [GitHub Flow Guide](https://guides.github.com/introduction/flow/)
- [Semantic Versioning](https://semver.org/)

# Node.js Backend Setup

## Requirements
- Node.js (v18+ recommended)
- npm (comes with Node.js)

## Installation

1. Clone the repository:
   ```sh
   git clone <repo-url>
   cd EXPOSE/backend
   ```
2. Install dependencies:
   ```sh
   npm install
   ```

## Development

- Start the server in development mode (with auto-reload):
  ```sh
  npx nodemon src/index.ts
  ```
- Or, run TypeScript directly:
  ```sh
  npx ts-node src/index.ts
  ```

## Build (if needed)
- To compile TypeScript:
  ```sh
  npx tsc
  ```

## Prisma & Database

### Setup
1. Copy `.env.example` to `.env`:
   ```sh
   cp .env.example .env
   ```
2. Update `DB_PASSWORD` with your RDS password
3. Generate Prisma client:
   ```sh
   npx prisma generate
   ```
4. Create initial migration:
   ```sh
   npx prisma migrate dev --name init
   ```

### Deployment
For production deployment to EC2/RDS:
```sh
npx prisma migrate deploy
```

## Deployment Pipeline

The project uses GitHub Actions for automated CI/CD:
- **Trigger:** Push to `main` branch
- **Build:** Compiles TypeScript and runs tests
- **Deploy:** Copies files to EC2
- **Migrate:** Runs Prisma migrations on RDS
- **Restart:** Restarts the systemd service

### First-time EC2 Setup
```bash
bash backend/scripts/setup-ec2.sh
```

### Monitor Deployment Status
```bash
bash backend/scripts/check-deployment.sh
```

See [DEPLOYMENT_GUIDE.md](../../DEPLOYMENT_GUIDE.md) for complete deployment documentation.

## Notes
- All dependencies are listed in `package.json`.
- `node_modules/`, build outputs, and environment files are ignored by git (see `.gitignore`).

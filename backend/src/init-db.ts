import { spawnSync } from 'child_process';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import * as Sentry from '@sentry/node';

dotenv.config();

const INIT_MIGRATION_ID = '20260420000000_init';

const runScript = (script: string) => {
  const result = spawnSync('npm', ['run', script], {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  if (result.status !== 0) {
    throw new Error(`Command failed: npm run ${script}`);
  }
};

async function initDb() {
  const databaseUrl = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL) : null;

  const connectionConfig = {
    host: process.env.DB_HOST || databaseUrl?.hostname || 'localhost',
    user: process.env.DB_USER || decodeURIComponent(databaseUrl?.username || 'root'),
    password: process.env.DB_PASSWORD || decodeURIComponent(databaseUrl?.password || ''),
    port: parseInt(process.env.DB_PORT || databaseUrl?.port || '3306', 10),
  };

  const dbName = process.env.DB_NAME || databaseUrl?.pathname.replace(/^\//, '') || 'expose';

  try {
    const connection = await mysql.createConnection(connectionConfig);

    // Transitional responsibility only: ensure target database exists.
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\`;`);
    await connection.end();

    const dbConnection = await mysql.createConnection({
      ...connectionConfig,
      database: dbName,
    });

    const [legacySchemaRows] = await dbConnection.query(
      `SELECT COUNT(*) as total
       FROM information_schema.tables
       WHERE table_schema = ?
       AND table_name IN ('users', 'posts', 'post_likes', 'followers')`,
      [dbName],
    );

    const [migrationsTableRows] = await dbConnection.query(
      `SELECT COUNT(*) as total
       FROM information_schema.tables
       WHERE table_schema = ?
       AND table_name = '_prisma_migrations'`,
      [dbName],
    );

    await dbConnection.end();

    const hasLegacySchema = Number((legacySchemaRows as any[])[0]?.total ?? 0) > 0;
    const hasPrismaHistory = Number((migrationsTableRows as any[])[0]?.total ?? 0) > 0;

    if (hasLegacySchema && !hasPrismaHistory) {
      console.log(
        `ℹ️ Legacy schema detectado sin historial Prisma. Marcando baseline (${INIT_MIGRATION_ID})...`,
      );
      runScript('db:migrate:baseline');
    }

    runScript('db:migrate:deploy');

    console.log(`✅ Base de datos "${dbName}" alineada mediante Prisma Migrate.`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error initializing database:', error);
    Sentry.captureException(error);
    process.exit(1);
  }
}

initDb();

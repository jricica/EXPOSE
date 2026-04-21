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
    await connection.query(`USE \`${dbName}\`;`);

    // Tabla de Usuarios - Asegurar lastLogin
    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) NOT NULL UNIQUE,
        email VARCHAR(255) NOT NULL UNIQUE,
        passwordHash VARCHAR(255) NOT NULL,
        lastLogin DATETIME DEFAULT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB;
    `);

    // Verificar si lastLogin existe, si no, añadirla
    const [userCols] = await connection.query('SHOW COLUMNS FROM users LIKE "lastLogin"');
    if ((userCols as any[]).length === 0) {
      await connection.query('ALTER TABLE users ADD COLUMN lastLogin DATETIME DEFAULT NULL AFTER passwordHash');
    }

    // Tabla de Posts - Asegurar is_deleted y media_url
    await connection.query(`
      CREATE TABLE IF NOT EXISTS posts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        userId INT NOT NULL,
        content TEXT NOT NULL,
        media_url TEXT DEFAULT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        expiresAt DATETIME NOT NULL,
        likes INT DEFAULT 0,
        is_deleted TINYINT(1) NOT NULL DEFAULT 0,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB;
    `);

    // Verificar si is_deleted existe, si no, añadirla
    const [postCols] = await connection.query('SHOW COLUMNS FROM posts LIKE "is_deleted"');
    if ((postCols as any[]).length === 0) {
      await connection.query('ALTER TABLE posts ADD COLUMN is_deleted TINYINT(1) NOT NULL DEFAULT 0');
    }

    // Asegurar índices en createdAt y expiresAt
    const [createdAtIdx] = await connection.query('SHOW INDEX FROM posts WHERE Key_name = "idx_posts_createdAt"');
    if ((createdAtIdx as any[]).length === 0) {
      await connection.query('CREATE INDEX idx_posts_createdAt ON posts(createdAt)');
    }

    const [expiresAtIdx] = await connection.query('SHOW INDEX FROM posts WHERE Key_name = "idx_posts_expiresAt"');
    if ((expiresAtIdx as any[]).length === 0) {
      await connection.query('CREATE INDEX idx_posts_expiresAt ON posts(expiresAt)');
    }


    const [mediaUrlCols] = await connection.query('SHOW COLUMNS FROM posts LIKE "media_url"');
    if ((mediaUrlCols as any[]).length === 0) {
      await connection.query('ALTER TABLE posts ADD COLUMN media_url TEXT DEFAULT NULL AFTER content');
    }

    // Tabla de Comentarios
    await connection.query(`
      CREATE TABLE IF NOT EXISTS comments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        postId INT NOT NULL,
        userId INT NOT NULL,
        content TEXT NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_comments_postId_createdAt (postId, createdAt),
        FOREIGN KEY (postId) REFERENCES posts(id) ON DELETE CASCADE,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB;
    `);

    // Perfil de Usuario - bio, display_name, avatar_url
    const [bioCols] = await connection.query('SHOW COLUMNS FROM users LIKE "bio"');
    if ((bioCols as any[]).length === 0) {
      await connection.query('ALTER TABLE users ADD COLUMN bio TEXT DEFAULT NULL AFTER email');
    }

    const [displayNameCols] = await connection.query('SHOW COLUMNS FROM users LIKE "display_name"');
    if ((displayNameCols as any[]).length === 0) {
      await connection.query('ALTER TABLE users ADD COLUMN display_name VARCHAR(100) DEFAULT NULL AFTER bio');
    }

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
      runScript('prisma:migrate:baseline');
    }

    runScript('prisma:migrate:deploy');

    console.log(`✅ Base de datos "${dbName}" alineada mediante Prisma Migrate.`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error initializing database:', error);
    Sentry.captureException(error);
    process.exit(1);
  }
}

initDb();

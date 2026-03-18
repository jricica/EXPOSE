import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import * as Sentry from '@sentry/node';
dotenv.config();

async function initDb() {
  const connectionConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    port: parseInt(process.env.DB_PORT || '3306', 10),
  };

  const dbName = process.env.DB_NAME || 'expose';

  try {
    const connection = await mysql.createConnection(connectionConfig);

    // Crear DB
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

    // Perfil de Usuario - bio, display_name, avatar_url
    const [bioCols] = await connection.query('SHOW COLUMNS FROM users LIKE "bio"');
    if ((bioCols as any[]).length === 0) {
      await connection.query('ALTER TABLE users ADD COLUMN bio TEXT DEFAULT NULL AFTER email');
    }

    const [displayNameCols] = await connection.query('SHOW COLUMNS FROM users LIKE "display_name"');
    if ((displayNameCols as any[]).length === 0) {
      await connection.query('ALTER TABLE users ADD COLUMN display_name VARCHAR(100) DEFAULT NULL AFTER bio');
    }

    const [avatarUrlCols] = await connection.query('SHOW COLUMNS FROM users LIKE "avatar_url"');
    if ((avatarUrlCols as any[]).length === 0) {
      await connection.query('ALTER TABLE users ADD COLUMN avatar_url TEXT DEFAULT NULL AFTER display_name');
    }

    // Tabla de Likes
    await connection.query(`
      CREATE TABLE IF NOT EXISTS post_likes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        postId INT NOT NULL,
        userId INT NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_like (postId, userId),
        FOREIGN KEY (postId) REFERENCES posts(id) ON DELETE CASCADE,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB;
    `);

        // Tabla de follows
    await connection.query(`
  CREATE TABLE IF NOT EXISTS followers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    follower_id INT NOT NULL,
    following_id INT NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_follow (follower_id, following_id),
    FOREIGN KEY (follower_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (following_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB;
`);

    console.log(`✅ Base de datos "${dbName}" y tablas aseguradas.`);

    await connection.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error initializing database:', error);
    Sentry.captureException(error);
    process.exit(1);
  }
}

initDb();

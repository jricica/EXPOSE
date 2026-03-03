const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
dotenv.config();

async function check() {
    const config = {
        host: process.env.DB_HOST || '127.0.0.1',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'expose',
        port: parseInt(process.env.DB_PORT || '3306', 10),
    };
    try {
        const conn = await mysql.createConnection(config);
        const [posts] = await conn.query('SELECT * FROM posts');
        console.log('Posts count:', posts.length);
        if (posts.length > 0) {
            console.log('Sample Post:', {
                id: posts[0].id,
                content: posts[0].content,
                createdAt: posts[0].createdAt,
                expiresAt: posts[0].expiresAt,
                is_deleted: posts[0].is_deleted
            });
        }
        const [now] = await conn.query('SELECT NOW() as now');
        console.log('MySQL NOW:', now[0].now);
        console.log('JS NOW:', new Date());
        await conn.end();
    } catch (e) {
        console.error(e);
    }
}
check();

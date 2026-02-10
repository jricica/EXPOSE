import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
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
        console.log(`Conectando al servidor MySQL para crear la base de datos "${dbName}"...`);
        const connection = await mysql.createConnection(connectionConfig);

        await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\`;`);
        console.log(`✅ Base de datos "${dbName}" asegurada (creada o ya existía).`);

        await connection.end();
        process.exit(0);
    } catch (error) {
        console.error('❌ Error al intentar crear la base de datos:');
        console.error(error);
        process.exit(1);
    }
}

initDb();

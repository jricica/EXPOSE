import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';

dotenv.config();

async function seed() {
    const connectionConfig = {
        host: process.env.DB_HOST || '127.0.0.1',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'expose',
        port: parseInt(process.env.DB_PORT || '3306', 10),
    };

    try {
        console.log(' Iniciando seeding de datos...');
        const connection = await mysql.createConnection(connectionConfig);

    
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash('password123', saltRounds);

        console.log(' Insertando 10 usuarios...');
        const userIds: number[] = [];
        const names = ['Adrian', 'Beatriz', 'Carlos', 'Diana', 'Eduardo', 'Fernanda', 'Gabriel', 'Helena', 'Ivan', 'Julia'];

        for (let i = 0; i < names.length; i++) {
            const username = names[i].toLowerCase();
            const email = `${username}@example.com`;

            const [existing] = await connection.query('SELECT id FROM users WHERE email = ?', [email]);
            if ((existing as any[]).length > 0) {
                userIds.push((existing as any[])[0].id);
                console.log(`Usuario ${email} ya existe, saltando...`);
                continue;
            }

            const [result] = await connection.query(
                'INSERT INTO users (username, email, passwordHash, lastLogin) VALUES (?, ?, ?, ?)',
                [username, email, passwordHash, null]
            );
            userIds.push((result as any).insertId);
            console.log(`Usuario ${email} creado.`);
        }

        console.log(' Insertando 20 posts...');
        const now = new Date();
        const contents = [
            "¡Hola a todos! Este es mi primer post en EXPOSE. 🚀",
            "Increíble día para programar algo genial.",
            "¿Alguien sabe cuál es la mejor configuración para MySQL? 🤔",
            "Trabajando en el proyecto final, ¡se ve increíble!",
            "Me encanta la interfaz de esta aplicación. Muy premium.",
            "Compartiendo un poco de mi día. ¡Ánimo!",
            "¿Cuáles son sus metas para este mes? Las mías son terminar el backend.",
            "A veces lo más simple es lo más elegante.",
            "Probando el sistema de posts de 24 horas. ¡Es genial!",
            "Café y código, el mejor combo matutino. ☕️⌨️",
            "¿Qué piensan de la inteligencia artificial? Me vuela la cabeza.",
            "¡Fin de semana! Tiempo de descansar (y quizás un poco de side projects).",
            "Aprendiendo TypeScript, ¡es un cambio de juego!",
            "Recuerden hidratarse mientras programan. 💧",
            "Mañana será un gran día para lanzar nuevos feature.",
            "Un pequeño paso para el dev, un gran salto para el deploy.",
            "¡Esta comunidad es genial! Gracias por el apoyo.",
            "Tip del día: Usa const sobre let siempre que sea posible.",
            "Escuchando música lo-fi para entrar en la zona.",
            "¡Listo para lo que venga! #devlife"
        ];

        const [columns] = await connection.query('SHOW COLUMNS FROM posts LIKE "is_deleted"');
        const hasIsDeleted = (columns as any[]).length > 0;

        for (let i = 0; i < contents.length; i++) {
            const userId = userIds[i % userIds.length];
            const content = contents[i];
            const expiresAt = new Date();
            expiresAt.setHours(expiresAt.getHours() + 24);

            if (hasIsDeleted) {
                await connection.query(
                    'INSERT INTO posts (userId, content, createdAt, expiresAt, is_deleted) VALUES (?, ?, ?, ?, ?)',
                    [userId, content, now, expiresAt, 0]
                );
            } else {
                await connection.query(
                    'INSERT INTO posts (userId, content, createdAt, expiresAt) VALUES (?, ?, ?, ?)',
                    [userId, content, now, expiresAt]
                );
            }
        }

        console.log('✅ Seeding completado con éxito!');
        await connection.end();
        process.exit(0);
    } catch (error) {
        console.error('❌ Error durante el seeding:');
        console.error(error);
        process.exit(1);
    }
}

seed();


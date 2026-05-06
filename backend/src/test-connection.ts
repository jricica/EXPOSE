import dotenv from 'dotenv';
dotenv.config();

import { loadSecrets } from './config/secrets';

async function bootstrap() {
    await loadSecrets();
    
    const { default: pool } = await import('./db/pool');

    try {
        console.log('Intentando conectar a la base de datos...');

        // Ejecutamos una consulta simple
        const [rows] = await pool.query('SELECT 1 + 1 AS result');

        console.log('✅ Conexión exitosa!');
        console.log('Resultado de prueba (1+1):', (rows as any)[0].result);

        // Cerramos el pool para que el script termine
        await pool.end();
        process.exit(0);
    } catch (error) {
        console.error('❌ Error de conexión:');
        if (error instanceof Error) {
            console.error('Mensaje:', error.message);
            // @ts-ignore
            if (error.code) console.error('Código:', error.code);
        } else {
            console.error(error);
        }
        process.exit(1);
    }
}

bootstrap();

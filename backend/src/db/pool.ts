import mysql from 'mysql2/promise';
import * as Sentry from '@sentry/node';
import { databaseConfig } from '../config/database';

// Centralizamos el acceso a la base de datos a través de este pool
const pool = mysql.createPool(databaseConfig);

/**
 * Función de utilidad para ejecutar queries con manejo de errores centralizado
 * @param sql Query SQL
 * @param params Parámetros para la query
 * @returns Resultado de la query
 */
export const query = async <T = any>(sql: string, params?: any[]): Promise<T> => {
    try {
        const [results] = await pool.execute(sql, params);
        return results as T;
    } catch (error) {
        Sentry.captureException(error, {
            extra: { sql, params },
        });
        throw error;
    }
};


export default pool;

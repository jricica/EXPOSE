import { Request, Response, NextFunction } from 'express';
import * as Sentry from '@sentry/node';

const MAX_ATTEMPTS = 5;
const BLOCK_DURATION = 15 * 60 * 1000; // 15 minutes

interface LoginEntry {
    attempts: number;
    blockedUntil: number;
}

const loginStore = new Map<string, LoginEntry>();

const getClientIp = (req: Request): string => {
    return (req.ip || req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown') as string;
};

/**
 * Middleware to check if an IP is currently blocked due to too many failed login attempts.
 */
export const checkLoginLimit = (req: Request, res: Response, next: NextFunction) => {
    const ip = getClientIp(req);
    const entry = loginStore.get(ip);

    if (entry && entry.blockedUntil > Date.now()) {
        const remainingMinutes = Math.ceil((entry.blockedUntil - Date.now()) / 60000);

        Sentry.captureMessage('login_rate_limit_blocked', {
            level: 'warning',
            extra: { ip, remainingMinutes }
        });

        return res.status(429).json({
            message: `Demasiados intentos de inicio de sesión fallidos. Tu IP ha sido bloqueada temporalmente. Por favor, intenta de nuevo en ${remainingMinutes} minutos.`,
            retryAfterMinutes: remainingMinutes
        });
    }
    next();
};

/**
 * Records a failed login attempt for the client's IP.
 * If the number of attempts reaches the limit, the IP is blocked.
 */
export const recordLoginFailure = (req: Request) => {
    const ip = getClientIp(req);
    let entry = loginStore.get(ip) || { attempts: 0, blockedUntil: 0 };

    // If they were already blocked but the time passed, reset attempts
    if (entry.blockedUntil > 0 && entry.blockedUntil <= Date.now()) {
        entry.attempts = 0;
        entry.blockedUntil = 0;
    }

    entry.attempts += 1;

    if (entry.attempts >= MAX_ATTEMPTS) {
        entry.blockedUntil = Date.now() + BLOCK_DURATION;
        console.warn(`IP ${ip} blocked due to ${MAX_ATTEMPTS} failed login attempts.`);
    }

    loginStore.set(ip, entry);
};

/**
 * Resets the failed login attempts counter for the client's IP upon a successful login.
 */
export const recordLoginSuccess = (req: Request) => {
    const ip = getClientIp(req);
    loginStore.delete(ip);
};

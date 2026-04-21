import { Request, Response, NextFunction } from 'express';
import * as Sentry from '@sentry/node';
import {
    AUTH_LOGIN_BLOCK_BASE_MS,
    AUTH_LOGIN_BLOCK_MAX_MS,
    AUTH_LOGIN_MAX_ATTEMPTS_PER_ACCOUNT,
    AUTH_LOGIN_MAX_ATTEMPTS_PER_IP,
    AUTH_LOGIN_WINDOW_MS,
} from '../config/env';

interface LoginEntry {
    attempts: number;
    windowResetAt: number;
    blockedUntil: number;
    blockLevel: number;
    lastSeenAt: number;
}

const ipLoginStore = new Map<string, LoginEntry>();
const accountLoginStore = new Map<string, LoginEntry>();

const getClientIp = (req: Request): string => {
    return (req.ip || req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown') as string;
};

const normalizeLoginIdentifier = (value: unknown): string | undefined => {
    if (typeof value !== 'string') return undefined;
    const normalized = value.trim().toLowerCase();
    return normalized.length > 0 ? normalized : undefined;
};

const getLoginIdentifierFromRequest = (req: Request): string | undefined => {
    const body = req.body ?? {};
    return normalizeLoginIdentifier(body.email ?? body.username);
};

const computeBlockDurationMs = (blockLevel: number): number => {
    const progressive = AUTH_LOGIN_BLOCK_BASE_MS * Math.pow(2, Math.max(0, blockLevel - 1));
    return Math.min(progressive, AUTH_LOGIN_BLOCK_MAX_MS);
};

const touchEntry = (entry: LoginEntry, now: number) => {
    if (entry.windowResetAt <= now) {
        entry.attempts = 0;
        entry.windowResetAt = now + AUTH_LOGIN_WINDOW_MS;
    }

    if (entry.blockedUntil <= now) {
        entry.blockedUntil = 0;
    }

    entry.lastSeenAt = now;
};

const getOrCreateEntry = (store: Map<string, LoginEntry>, key: string, now: number): LoginEntry => {
    const existing = store.get(key);
    if (existing) {
        touchEntry(existing, now);
        return existing;
    }

    const created: LoginEntry = {
        attempts: 0,
        windowResetAt: now + AUTH_LOGIN_WINDOW_MS,
        blockedUntil: 0,
        blockLevel: 0,
        lastSeenAt: now,
    };
    store.set(key, created);
    return created;
};

const getRetryAfterSeconds = (store: Map<string, LoginEntry>, key: string, now: number): number => {
    const entry = store.get(key);
    if (!entry) return 0;

    touchEntry(entry, now);

    if (entry.blockedUntil <= now) {
        return 0;
    }

    return Math.max(1, Math.ceil((entry.blockedUntil - now) / 1000));
};

const registerFailure = (
    store: Map<string, LoginEntry>,
    key: string,
    maxAttempts: number,
    now: number,
): number => {
    const entry = getOrCreateEntry(store, key, now);

    if (entry.blockedUntil > now) {
        return Math.max(1, Math.ceil((entry.blockedUntil - now) / 1000));
    }

    entry.attempts += 1;
    entry.lastSeenAt = now;

    if (entry.attempts < maxAttempts) {
        return 0;
    }

    entry.blockLevel += 1;
    entry.attempts = 0;
    entry.windowResetAt = now + AUTH_LOGIN_WINDOW_MS;

    const blockDuration = computeBlockDurationMs(entry.blockLevel);
    entry.blockedUntil = now + blockDuration;

    return Math.max(1, Math.ceil(blockDuration / 1000));
};

const resetAttempts = (store: Map<string, LoginEntry>, key: string) => {
    store.delete(key);
};

const cleanupStore = (store: Map<string, LoginEntry>, now: number) => {
    const staleThreshold = now - Math.max(AUTH_LOGIN_WINDOW_MS, AUTH_LOGIN_BLOCK_MAX_MS);
    for (const [key, entry] of store.entries()) {
        if (entry.blockedUntil > now) continue;
        if (entry.lastSeenAt < staleThreshold) {
            store.delete(key);
        }
    }
};

setInterval(() => {
    const now = Date.now();
    cleanupStore(ipLoginStore, now);
    cleanupStore(accountLoginStore, now);
}, 60_000).unref?.();

/**
 * Middleware to check if an IP is currently blocked due to too many failed login attempts.
 */
export const checkLoginLimit = (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const ip = getClientIp(req);
    const account = getLoginIdentifierFromRequest(req);

    const ipRetryAfterSeconds = getRetryAfterSeconds(ipLoginStore, ip, now);
    const accountRetryAfterSeconds = account
        ? getRetryAfterSeconds(accountLoginStore, account, now)
        : 0;
    const retryAfterSeconds = Math.max(ipRetryAfterSeconds, accountRetryAfterSeconds);

    if (retryAfterSeconds > 0) {
        const retryAfterMinutes = Math.ceil(retryAfterSeconds / 60);
        Sentry.captureMessage('login_rate_limit_blocked', {
            level: 'warning',
            extra: { ip, retryAfterSeconds, retryAfterMinutes },
            tags: { middleware: 'authRateLimit' },
        });

        res.setHeader('Retry-After', retryAfterSeconds.toString());
        return res.status(429).json({
            message: 'Demasiados intentos de inicio de sesión. Intenta de nuevo más tarde.',
            retryAfterSeconds,
            retryAfterMinutes,
        });
    }
    next();
};

/**
 * Records a failed login attempt for the client's IP.
 * If the number of attempts reaches the limit, the IP is blocked.
 */
export const recordLoginFailure = (req: Request, identifier?: string) => {
    const now = Date.now();
    const ip = getClientIp(req);
    const account = normalizeLoginIdentifier(identifier) ?? getLoginIdentifierFromRequest(req);

    const ipBlockedForSeconds = registerFailure(ipLoginStore, ip, AUTH_LOGIN_MAX_ATTEMPTS_PER_IP, now);
    const accountBlockedForSeconds = account
        ? registerFailure(accountLoginStore, account, AUTH_LOGIN_MAX_ATTEMPTS_PER_ACCOUNT, now)
        : 0;

    const blockedForSeconds = Math.max(ipBlockedForSeconds, accountBlockedForSeconds);
    if (blockedForSeconds > 0) {
        Sentry.captureMessage('login_rate_limit_block_applied', {
            level: 'warning',
            extra: {
                ip,
                blockedForSeconds,
            },
            tags: { middleware: 'authRateLimit' },
        });
    }
};

/**
 * Resets the failed login attempts counter for the client's IP upon a successful login.
 */
export const recordLoginSuccess = (req: Request, identifier?: string) => {
    const ip = getClientIp(req);
    const account = normalizeLoginIdentifier(identifier) ?? getLoginIdentifierFromRequest(req);

    resetAttempts(ipLoginStore, ip);
    if (account) {
        resetAttempts(accountLoginStore, account);
    }
};

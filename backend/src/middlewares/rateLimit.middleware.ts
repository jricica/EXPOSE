import type { NextFunction, Request, Response } from 'express';
import * as Sentry from '@sentry/node';

type RateLimitInfo = {
	key: string;
	limit: number;
	remaining: number;
	resetAt: number;
	retryAfterSeconds: number;
};

export type RateLimitConfig = {
	windowMs: number;
	max: number;
	statusCode?: number;
	message?: string | Record<string, unknown> | ((req: Request) => string | Record<string, unknown>);
	keyGenerator?: (req: Request) => string;
	skip?: (req: Request) => boolean;
	handler?: (req: Request, res: Response, next: NextFunction, info: RateLimitInfo) => void;
	headers?: boolean;
	cleanupIntervalMs?: number;
	reportToSentry?: boolean;
};

type RateLimitEntry = {
	count: number;
	resetAt: number;
};

const DEFAULT_MESSAGE = 'Too many requests, please try again later.';

const resolveMessage = (req: Request, message?: RateLimitConfig['message']) => {
	if (!message) {
		return DEFAULT_MESSAGE;
	}
	return typeof message === 'function' ? message(req) : message;
};

const getClientIp = (req: Request) => {
	return req.ip || req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
};

export const createRateLimiter = (config: RateLimitConfig) => {
	const {
		windowMs,
		max,
		statusCode = 429,
		headers = true,
		keyGenerator = getClientIp,
		skip,
		handler,
		cleanupIntervalMs,
		reportToSentry = true,
	} = config;

	const store = new Map<string, RateLimitEntry>();

	const cleanup = () => {
		const now = Date.now();
		for (const [key, entry] of store) {
			if (entry.resetAt <= now) {
				store.delete(key);
			}
		}
	};

	if (cleanupIntervalMs && cleanupIntervalMs > 0) {
		setInterval(cleanup, cleanupIntervalMs).unref?.();
	}

	return (req: Request, res: Response, next: NextFunction) => {
		if (skip?.(req)) {
			return next();
		}

		const key = keyGenerator(req);
		const now = Date.now();
		let entry = store.get(key);

		if (!entry || entry.resetAt <= now) {
			entry = { count: 0, resetAt: now + windowMs };
			store.set(key, entry);
		}

		entry.count += 1;

		const remaining = Math.max(0, max - entry.count);
		const retryAfterSeconds = Math.max(0, Math.ceil((entry.resetAt - now) / 1000));

		if (headers) {
			res.setHeader('X-RateLimit-Limit', max.toString());
			res.setHeader('X-RateLimit-Remaining', Math.max(0, max - entry.count).toString());
			res.setHeader('X-RateLimit-Reset', Math.ceil(entry.resetAt / 1000).toString());
		}

		if (entry.count > max) {
			res.setHeader('Retry-After', retryAfterSeconds.toString());

			const info: RateLimitInfo = {
				key,
				limit: max,
				remaining: 0,
				resetAt: entry.resetAt,
				retryAfterSeconds,
			};

			if (handler) {
				return handler(req, res, next, info);
			}

			if (reportToSentry) {
				Sentry.captureMessage('rate_limit_exceeded', {
					level: 'warning',
					tags: {
						middleware: 'rateLimit',
					},
					extra: {
						key,
						limit: max,
						resetAt: entry.resetAt,
						retryAfterSeconds,
						method: req.method,
						path: req.originalUrl || req.url,
						ip: getClientIp(req),
					},
				});
			}

			const message = resolveMessage(req, config.message);
			return res.status(statusCode).json({
				error: 'rate_limit_exceeded',
				message,
				retryAfterSeconds,
				limit: max,
			});
		}

		return next();
	};
};

export const defaultRateLimiter = createRateLimiter({
	windowMs: 60_000,
	max: 100,
	headers: true,
	cleanupIntervalMs: 60_000,
	reportToSentry: true,
});

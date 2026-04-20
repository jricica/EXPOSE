import { SignOptions } from 'jsonwebtoken';

/*
 * JWT configuration
 * Validated at bootstrap time
 */

export const JWT_SECRET = (() => {
  const value = process.env.JWT_SECRET;
  if (!value) {
    throw new Error('JWT_SECRET is not defined');
  }
  return value;
})();

export const JWT_ALGORITHM = 'HS256' as const;
export const JWT_ALLOWED_ALGORITHMS: ReadonlyArray<typeof JWT_ALGORITHM> = [JWT_ALGORITHM];
export const JWT_ACCESS_TOKEN_EXPIRES_IN: NonNullable<SignOptions['expiresIn']> = (() => {
  const value = process.env.JWT_ACCESS_TOKEN_EXPIRES_IN?.trim();
  if (!value) return '7d';
  return value as NonNullable<SignOptions['expiresIn']>;
})();

export const JWT_ISSUER = (() => {
  const value = process.env.JWT_ISSUER?.trim();
  return value ? value : undefined;
})();

export const JWT_AUDIENCE = (() => {
  const value = process.env.JWT_AUDIENCE?.trim();
  return value ? value : undefined;
})();

/**
 * Allowed clock skew in seconds
 * Helps with small time drift between servers
 */
export const JWT_CLOCK_TOLERANCE_SECONDS = (() => {
  const raw = process.env.JWT_CLOCK_TOLERANCE_SECONDS;
  const n = raw ? Number(raw) : 5;
  if (!Number.isFinite(n) || n < 0) return 5;
  return Math.min(Math.floor(n), 30);
})();

export const REPORTS_THRESHOLD = (() => {
  const raw = process.env.REPORTS_THRESHOLD;
  const n = raw ? Number(raw) : 5;
  return Number.isFinite(n) && n > 0 ? n : 5;
})();

export const COMMENT_REPORTS_THRESHOLD = (() => {
  const raw = process.env.COMMENT_REPORTS_THRESHOLD;
  const n = raw ? Number(raw) : 3;
  return Number.isFinite(n) && n > 0 ? n : 3;
})();

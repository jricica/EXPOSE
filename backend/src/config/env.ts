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

/**
 * Allowed clock skew in seconds
 * Helps with small time drift between servers
 */
export const JWT_CLOCK_TOLERANCE_SECONDS = 5;

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

const parsePositiveInt = (raw: string | undefined, fallback: number): number => {
  const n = raw ? Number(raw) : fallback;
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
};

/*
 * Auth login anti brute-force controls
 */
export const AUTH_LOGIN_WINDOW_MS = parsePositiveInt(process.env.AUTH_LOGIN_WINDOW_MS, 15 * 60 * 1000);
export const AUTH_LOGIN_MAX_ATTEMPTS_PER_IP = parsePositiveInt(process.env.AUTH_LOGIN_MAX_ATTEMPTS_PER_IP, 10);
export const AUTH_LOGIN_MAX_ATTEMPTS_PER_ACCOUNT = parsePositiveInt(process.env.AUTH_LOGIN_MAX_ATTEMPTS_PER_ACCOUNT, 5);
export const AUTH_LOGIN_BLOCK_BASE_MS = parsePositiveInt(process.env.AUTH_LOGIN_BLOCK_BASE_MS, 5 * 60 * 1000);
export const AUTH_LOGIN_BLOCK_MAX_MS = parsePositiveInt(process.env.AUTH_LOGIN_BLOCK_MAX_MS, 60 * 60 * 1000);

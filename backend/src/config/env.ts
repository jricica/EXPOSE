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

export const EXPIRE_JOB_INTERVAL_MINUTES = (() => {
  const raw = process.env.EXPIRE_JOB_INTERVAL_MINUTES;
  const n = raw ? Number(raw) : 5;
  return Number.isFinite(n) && n > 0 ? n : 5;
})();

export const EXPIRE_JOB_PHYSICAL_DELETE = (() => {
  const raw = process.env.EXPIRE_JOB_PHYSICAL_DELETE;
  return raw === '1' || raw === 'true';
})();


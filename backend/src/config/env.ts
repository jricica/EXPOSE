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

export const UPLOAD_DIR = process.env.UPLOAD_DIR || 'uploads';

export const MAX_FILE_SIZE = (() => {
  const raw = process.env.MAX_FILE_SIZE;
  const n = raw ? Number(raw) : 5 * 1024 * 1024; // 5MB
  return Number.isFinite(n) && n > 0 ? n : 5 * 1024 * 1024;
})();
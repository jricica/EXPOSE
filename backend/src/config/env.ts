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

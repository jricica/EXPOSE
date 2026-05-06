// Minimal email service stub. In production replace with an implementation using SES, SMTP or a provider.
import util from 'util';

export async function sendPasswordResetEmail(to: string, resetLink: string): Promise<void> {
  // If SEND_REAL_EMAILS=true implement actual sending (SES/SMTP). For now log to console.
  if (process.env.SEND_REAL_EMAILS === 'true') {
    // TODO: integrate with AWS SES or SMTP provider
    console.log(`[EMAIL][SEND_REAL_EMAILS] send password reset to ${to} -> ${resetLink}`);
    return;
  }

  // Default: log to stdout for developers
  console.log(`[EMAIL][STUB] Password reset for ${to}: ${resetLink}`);
}

export async function sendVerificationEmail(to: string, verifyLink: string): Promise<void> {
  if (process.env.SEND_REAL_EMAILS === 'true') {
    console.log(`[EMAIL][SEND_REAL_EMAILS] send verification to ${to} -> ${verifyLink}`);
    return;
  }
  console.log(`[EMAIL][STUB] Verification email for ${to}: ${verifyLink}`);
}

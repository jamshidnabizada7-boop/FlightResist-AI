import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587,
  secure: false,
  auth: process.env.SMTP_USER
    ? {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS ?? '',
      }
    : undefined,
});

/**
 * Send a verification email to the given address.
 * Falls back to logging the URL to console when SMTP is not configured (dev).
 */
export async function sendVerificationEmail(
  email: string,
  token: string,
): Promise<void> {
  const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3001';
  const verifyUrl = `${baseUrl}/verify-email?token=${token}`;

  if (!process.env.SMTP_HOST) {
    // Dev fallback — print the link so developers can click it directly.
    console.log(`[FlightResist Auth] Verification link for ${email}:\n  ${verifyUrl}`);
    return;
  }

  await transporter.sendMail({
    from: process.env.EMAIL_FROM ?? 'noreply@flightresist.app',
    to: email,
    subject: 'Verify your FlightResist AI account',
    text: `Welcome to FlightResist AI!\n\nPlease verify your email by visiting:\n${verifyUrl}\n\nThis link expires in 24 hours.`,
    html: `
      <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;">
        <h2 style="margin-bottom:16px;">FlightResist AI</h2>
        <p>Welcome! Click the link below to verify your email address.</p>
        <a href="${verifyUrl}"
           style="display:inline-block;padding:12px 24px;background:#0f172a;color:#fff;
                  text-decoration:none;border-radius:6px;margin:16px 0;">
          Verify Email
        </a>
        <p style="color:#64748b;font-size:13px;">This link expires in 24 hours.</p>
      </div>
    `,
  });
}

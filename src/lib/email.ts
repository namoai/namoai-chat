import nodemailer from "nodemailer";

type SendEmailParams = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return v;
}

export async function sendEmail({ to, subject, text, html }: SendEmailParams): Promise<void> {
  const user = requireEnv("EMAIL_USER");
  const pass = requireEnv("EMAIL_PASSWORD");

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });

  await transporter.sendMail({
    from: user,
    to,
    subject,
    text,
    html,
  });
}

function getAppBaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL;
  if (!url) {
    throw new Error("Missing required environment variable: NEXT_PUBLIC_APP_URL (or NEXTAUTH_URL)");
  }
  return String(url).replace(/\/$/, "");
}

/**
 * Send an email verification link for the given email and token.
 *
 * Verification endpoint expects: /api/auth/verify-email?token=...&email=...
 */
export async function sendVerificationEmail(email: string, token: string): Promise<void> {
  const baseUrl = getAppBaseUrl();
  const verifyUrl = `${baseUrl}/api/auth/verify-email?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;

  const subject = "メールアドレス認証のお願い";
  const text = `以下のリンクをクリックしてメールアドレスを認証してください。\n\n${verifyUrl}\n\nこのリンクの有効期限は24時間です。`;

  await sendEmail({ to: email, subject, text });
}




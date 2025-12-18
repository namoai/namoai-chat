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




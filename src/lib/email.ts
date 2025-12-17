import nodemailer from 'nodemailer';

// Gmail SMTP設定
// 注意: Gmailを使用する場合は「アプリパスワード」を使用してください
// 通常のパスワードではセキュリティ上の理由で接続が拒否される場合があります
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'namoai.namos@gmail.com',
    pass: process.env.EMAIL_PASSWORD || 'xbazodjqrgvayqhk', // アプリパスワード（スペース削除済み）
  },
});

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * メール送信関数
 */
export async function sendEmail(options: EmailOptions): Promise<void> {
  try {
    await transporter.sendMail({
      from: `"NAMOSAI" <${process.env.EMAIL_USER || 'namoai.namos@gmail.com'}>`,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    });
    console.log(`[Email] メール送信成功: ${options.to}`);
  } catch (error) {
    console.error('[Email] メール送信エラー:', error);
    throw new Error('メール送信に失敗しました');
  }
}

/**
 * メール認証リンク送信
 */
export async function sendVerificationEmail(email: string, token: string): Promise<void> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const verificationUrl = `${appUrl}/verify-email?token=${token}&email=${encodeURIComponent(email)}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .button { display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .button:hover { background-color: #0056b3; }
        .footer { margin-top: 30px; font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
        <h2>メールアドレス認証</h2>
        <p>ご登録ありがとうございます。以下のボタンをクリックしてメールアドレスを認証してください。</p>
        <a href="${verificationUrl}" class="button">メールアドレスを認証する</a>
        <p>ボタンがクリックできない場合は、以下のリンクをコピーしてブラウザに貼り付けてください：</p>
        <p style="word-break: break-all;">${verificationUrl}</p>
        <p>このリンクは24時間有効です。</p>
        <div class="footer">
          <p>このメールに心当たりがない場合は、無視してください。</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
メールアドレス認証

ご登録ありがとうございます。以下のリンクをクリックしてメールアドレスを認証してください：

${verificationUrl}

このリンクは24時間有効です。

このメールに心当たりがない場合は、無視してください。
  `;

  await sendEmail({
    to: email,
    subject: '【NAMOSAI】メールアドレス認証',
    html,
    text,
  });
}


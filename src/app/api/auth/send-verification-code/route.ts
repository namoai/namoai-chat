import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { randomBytes } from 'crypto';
import { sendEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';

/**
 * メール認証コード送信API
 * POST /api/auth/send-verification-code
 * Body: { email: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email || !email.includes('@')) {
      return NextResponse.json(
        { error: '有効なメールアドレスを入力してください。' },
        { status: 400 }
      );
    }

    const prisma = await getPrisma();

    // 既に登録されているメールアドレスかチェック
    const existingUser = await prisma.users.findUnique({
      where: { email },
    });

    if (existingUser) {
      // 既に認証済みかチェック
      if (existingUser.emailVerified) {
        return NextResponse.json(
          { error: 'このメールアドレスは既に認証済みです。' },
          { status: 400 }
        );
      }
    }

    // 6桁の認証コードを生成
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date();
    expires.setMinutes(expires.getMinutes() + 10); // 10分間有効

    // 既存のトークンがあれば削除
    await prisma.email_verification_tokens.deleteMany({
      where: { email },
    });

    // 認証コードをDBに保存
    // 新規登録の場合、userIdは既存ユーザーがいないため一時的に最小のID (1) を使用
    // 実際の認証時には email で検索するため問題ありません
    // 既存ユーザーの場合はそのuserIdを使用
    const tempUserId = existingUser?.id || 1;
    
    await prisma.email_verification_tokens.create({
      data: {
        userId: tempUserId,
        email,
        token: verificationCode, // 認証コードをトークンとして保存
        expires,
      },
    });

    // 認証コードをメールで送信
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .code { font-size: 32px; font-weight: bold; text-align: center; padding: 20px; background-color: #f5f5f5; border-radius: 8px; margin: 20px 0; letter-spacing: 8px; }
          .footer { margin-top: 30px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <h2>メールアドレス認証コード</h2>
          <p>以下の認証コードを入力してください。</p>
          <div class="code">${verificationCode}</div>
          <p>このコードは10分間有効です。</p>
          <div class="footer">
            <p>このメールに心当たりがない場合は、無視してください。</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
メールアドレス認証コード

以下の認証コードを入力してください：

${verificationCode}

このコードは10分間有効です。

このメールに心当たりがない場合は、無視してください。
    `;

    await sendEmail({
      to: email,
      subject: '【NAMOSAI】メールアドレス認証コード',
      html,
      text,
    });

    return NextResponse.json({
      message: '認証コードを送信しました。メールボックスを確認してください。',
    });
  } catch (error) {
    console.error('[Send Verification Code] エラー:', error);
    return NextResponse.json(
      { error: '認証コード送信中にエラーが発生しました。' },
      { status: 500 }
    );
  }
}


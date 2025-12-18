import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/nextauth';
import { getPrisma } from '@/lib/prisma';
import { generateTotpSecret, generateTotpUri, generateBackupCodes, hashBackupCode } from '@/lib/2fa';

export const dynamic = 'force-dynamic';

/**
 * 2FA有効化API
 * POST /api/auth/2fa/enable
 */
export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '認証が必要です。' }, { status: 401 });
    }

    const userId = parseInt(session.user.id, 10);
    const prisma = await getPrisma();

    // ユーザーを取得
    const user = await prisma.users.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return NextResponse.json({ error: 'ユーザーが見つかりません。' }, { status: 404 });
    }

    // 既に2FAが有効かチェック
    if (user.twoFactorEnabled) {
      return NextResponse.json(
        { error: '2FAは既に有効化されています。' },
        { status: 400 }
      );
    }

    // TOTPシークレットを生成
    const secret = generateTotpSecret();

    // バックアップコードを生成
    const backupCodes = generateBackupCodes(8);
    const hashedBackupCodes = backupCodes.map(code => hashBackupCode(code));

    // QRコードURIを生成
    const qrCodeUri = generateTotpUri(secret, user.email, 'NAMOSAI');

    // データベースに保存（シークレットはハッシュ化推奨だが、今回は暗号化なしで保存）
    // 本番環境では環境変数などで暗号化キーを使用することを推奨
    await prisma.users.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: true,
        twoFactorSecret: secret, // 実際には暗号化して保存すべき
        twoFactorBackupCodes: hashedBackupCodes,
      },
    });

    return NextResponse.json({
      secret,
      qrCodeUri,
      backupCodes, // クライアントに一度だけ表示
      message: '2FAが有効化されました。バックアップコードを安全に保管してください。',
    });
  } catch (error) {
    console.error('[Enable 2FA] エラー:', error);
    return NextResponse.json(
      { error: '2FA有効化中にエラーが発生しました。' },
      { status: 500 }
    );
  }
}



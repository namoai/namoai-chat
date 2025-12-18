/**
 * セキュリティ強化: 2要素認証（2FA）基本構造
 * TOTP認証の基盤実装
 */

import { createHash } from 'crypto';
import { authenticator } from 'otplib';
import { logger } from './logger';

// TOTP設定
authenticator.options = {
  window: [1, 1], // 前後1ステップ（30秒×2 = ±30秒）の許容範囲
  step: 30, // 30秒ごとにコード更新
};

/**
 * 2FA設定の状態
 */
export interface TwoFactorAuthStatus {
  enabled: boolean;
  method: 'totp' | 'sms' | null;
  backupCodes?: string[];
  createdAt?: Date;
}

/**
 * バックアップコードを生成
 */
export function generateBackupCodes(count: number = 8): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    // 8桁の数字コードを生成
    const code = Math.floor(10000000 + Math.random() * 90000000).toString();
    codes.push(code);
  }
  return codes;
}

/**
 * バックアップコードをハッシュ化（保存用）
 */
export function hashBackupCode(code: string): string {
  // 実際の実装では、bcryptや同様のハッシュ関数を使用
  // ここでは概念実装として示します
  return createHash('sha256').update(code).digest('hex');
}

/**
 * TOTPシークレットを生成
 */
export function generateTotpSecret(): string {
  // otplibのauthenticator.generateSecret()を使用
  return authenticator.generateSecret();
}

/**
 * QRコード用のURIを生成（Google Authenticatorなどで使用）
 */
export function generateTotpUri(
  secret: string,
  accountName: string,
  issuer: string = 'NAMOSAI'
): string {
  // otplibのauthenticator.keyuri()を使用
  return authenticator.keyuri(accountName, issuer, secret);
}

/**
 * TOTPコードを検証
 */
export function verifyTotpCode(secret: string, code: string): boolean {
  try {
    return authenticator.verify({ token: code, secret });
  } catch (error) {
    logger.warn('TOTP verification failed', {
      metadata: { error: error instanceof Error ? error.message : String(error) },
    });
    return false;
  }
}

/**
 * 2FA設定を有効化
 */
export async function enable2FA(
  userId: number,
  method: 'totp' | 'sms',
  secret?: string
): Promise<{ secret?: string; backupCodes: string[]; qrCodeUri?: string }> {
  const { getPrisma } = await import('./prisma');
  const prisma = await getPrisma();
  
  const backupCodes = generateBackupCodes(8);
  const hashedBackupCodes = backupCodes.map(code => hashBackupCode(code));
  
  let qrCodeUri: string | undefined;
  let finalSecret = secret;
  
  if (method === 'totp') {
    if (!finalSecret) {
      finalSecret = generateTotpSecret();
    }
    const user = await prisma.users.findUnique({ where: { id: userId }, select: { email: true } });
    qrCodeUri = generateTotpUri(finalSecret, user?.email || `user_${userId}`, 'NAMOSAI');
  }
  
  // データベースに保存
  await prisma.users.update({
    where: { id: userId },
    data: {
      twoFactorEnabled: true,
      twoFactorSecret: method === 'totp' ? finalSecret : null,
      twoFactorBackupCodes: hashedBackupCodes,
    },
  });
  
  logger.info('2FA enabled', { userId: String(userId), metadata: { method } });
  
  return {
    secret: method === 'totp' ? finalSecret : undefined,
    backupCodes,
    qrCodeUri,
  };
}

/**
 * 2FA設定を無効化
 */
export async function disable2FA(userId: number): Promise<void> {
  const { getPrisma } = await import('./prisma');
  const prisma = await getPrisma();
  
  await prisma.users.update({
    where: { id: userId },
    data: {
      twoFactorEnabled: false,
      twoFactorSecret: null,
      twoFactorBackupCodes: [],
    },
  });
  
  logger.info('2FA disabled', { userId: String(userId) });
}

/**
 * 2FAコードを検証（ログイン時など）
 */
export async function verify2FACode(
  userId: number,
  code: string
): Promise<{ valid: boolean; usedBackupCode?: boolean }> {
  const { getPrisma } = await import('./prisma');
  const prisma = await getPrisma();
  
  const user = await prisma.users.findUnique({
    where: { id: userId },
    select: {
      twoFactorEnabled: true,
      twoFactorSecret: true,
      twoFactorBackupCodes: true,
    },
  });
  
  if (!user?.twoFactorEnabled) {
    return { valid: false };
  }
  
  // TOTPコードの検証
  if (user.twoFactorSecret) {
    const isValid = verifyTotpCode(user.twoFactorSecret, code);
    if (isValid) {
      return { valid: true };
    }
  }
  
  // バックアップコードの検証
  const codeHash = hashBackupCode(code);
  const backupCodeIndex = user.twoFactorBackupCodes.indexOf(codeHash);
  if (backupCodeIndex !== -1) {
    // 使用したバックアップコードを削除
    const updatedCodes = user.twoFactorBackupCodes.filter((_, i) => i !== backupCodeIndex);
    await prisma.users.update({
      where: { id: userId },
      data: { twoFactorBackupCodes: updatedCodes },
    });
    return { valid: true, usedBackupCode: true };
  }
  
  return { valid: false };
}


/**
 * セキュリティ強化: API認証強化
 * APIキーの発行と権限分離、トークンの短寿命化・ローテーション
 */

import { randomBytes, createHmac } from 'crypto';
import { prisma } from './prisma';
import { logger } from './logger';

export interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string; // 表示用（最初の8文字）
  permissions: string[];
  expiresAt: Date | null;
  lastUsedAt: Date | null;
  createdAt: Date;
}

/**
 * APIキーを生成
 */
export function generateApiKey(): string {
  // 64文字のランダムキーを生成
  const key = randomBytes(32).toString('hex');
  return `sk_${key}`;
}

/**
 * APIキーのハッシュを生成（保存用）
 */
export function hashApiKey(key: string): string {
  const secret = process.env.API_KEY_SECRET || process.env.NEXTAUTH_SECRET || 'default-secret';
  const hmac = createHmac('sha256', secret);
  hmac.update(key);
  return hmac.digest('hex');
}

/**
 * APIキーを検証
 */
export async function verifyApiKey(key: string): Promise<{ valid: boolean; userId?: number; permissions?: string[] }> {
  if (!key.startsWith('sk_')) {
    return { valid: false };
  }

  const keyHash = hashApiKey(key);

  try {
    // データベースからAPIキーを検索
    // 注意: 実際の実装では、api_keysテーブルが必要です
    // ここでは概念実装として示します
    
    // const apiKey = await prisma.apiKey.findUnique({
    //   where: { keyHash },
    //   include: { user: true },
    // });
    
    // if (!apiKey) {
    //   return { valid: false };
    // }
    
    // // 有効期限チェック
    // if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
    //   return { valid: false };
    // }
    
    // // 最終使用日時を更新
    // await prisma.apiKey.update({
    //   where: { id: apiKey.id },
    //   data: { lastUsedAt: new Date() },
    // });
    
    // return {
    //   valid: true,
    //   userId: apiKey.userId,
    //   permissions: apiKey.permissions,
    // };
    
    // 暫定的な実装（実際のテーブルが存在しない場合）
    logger.warn('API key verification: Database table not implemented yet');
    return { valid: false };
  } catch (error) {
    logger.error('API key verification error', {
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
      } : { message: String(error) },
    });
    return { valid: false };
  }
}

/**
 * APIキーをリクエストから取得
 */
export function getApiKeyFromRequest(request: Request): string | null {
  // Authorization ヘッダーから取得
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  
  // X-API-Key ヘッダーから取得
  const apiKeyHeader = request.headers.get('x-api-key');
  if (apiKeyHeader) {
    return apiKeyHeader;
  }
  
  return null;
}

/**
 * APIキー認証ミドルウェア
 */
export async function requireApiKey(
  request: Request,
  requiredPermissions: string[] = []
): Promise<{ authorized: boolean; userId?: number; error?: string }> {
  const apiKey = getApiKeyFromRequest(request);
  
  if (!apiKey) {
    return { authorized: false, error: 'API key is required' };
  }
  
  const verification = await verifyApiKey(apiKey);
  
  if (!verification.valid) {
    return { authorized: false, error: 'Invalid API key' };
  }
  
  // 権限チェック
  if (requiredPermissions.length > 0 && verification.permissions) {
    const hasPermission = requiredPermissions.some(perm => 
      verification.permissions!.includes(perm)
    );
    
    if (!hasPermission) {
      return { authorized: false, error: 'Insufficient permissions' };
    }
  }
  
  return {
    authorized: true,
    userId: verification.userId,
  };
}

/**
 * トークンの有効期限をチェック（短寿命化）
 */
export function isTokenExpired(createdAt: Date, maxAge: number = 3600000): boolean {
  // デフォルト: 1時間（3600000ミリ秒）
  const now = new Date();
  const age = now.getTime() - createdAt.getTime();
  return age > maxAge;
}

/**
 * トークンをローテーション（新しいトークンを生成）
 */
export function rotateToken(oldToken: string): string {
  // 古いトークンを無効化し、新しいトークンを生成
  // 実際の実装では、データベースで古いトークンを無効化する必要があります
  return generateApiKey();
}


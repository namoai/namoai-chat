/**
 * 疑わしいIPアドレスの検出・ブロック
 */

import { NextRequest } from 'next/server';
import { getPrisma } from '../prisma';

// IPブロックの設定
const MAX_FAILED_ATTEMPTS = 10; // 10回失敗でブロック
const BLOCK_DURATION_MINUTES = 60; // 60分間ブロック

/**
 * IPアドレスを取得
 */
export function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }
  
  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp.trim();
  }
  
  return request.ip || 'unknown';
}

/**
 * 疑わしいIPアドレスを記録
 */
export async function recordSuspiciousActivity(
  ip: string,
  activity: 'login_failed' | 'payment_failed' | 'rate_limit_exceeded'
): Promise<void> {
  try {
    // 実際の実装では、Redisやデータベースに記録
    // ここでは簡易実装として示します
    const prisma = await getPrisma();
    
    // IPアクティビティテーブルが存在する場合（将来の実装）
    // await prisma.ipActivity.create({
    //   data: {
    //     ip,
    //     activity,
    //     timestamp: new Date(),
    //   },
    // });
    
    console.log(`[Suspicious IP] Recorded activity: ${ip} - ${activity}`);
  } catch (error) {
    console.error('[Suspicious IP] Error recording activity:', error);
  }
}

/**
 * IPアドレスがブロックされているかチェック
 */
export async function isIpBlocked(ip: string): Promise<boolean> {
  try {
    // 実際の実装では、Redisやデータベースからチェック
    // ここでは簡易実装として示します
    
    // ホワイトリスト（常に許可）
    const WHITELIST_IPS = (process.env.IP_WHITELIST || '').split(',').filter(Boolean);
    if (WHITELIST_IPS.includes(ip)) {
      return false;
    }
    
    // ブラックリスト（常にブロック）
    const BLACKLIST_IPS = (process.env.IP_BLACKLIST || '').split(',').filter(Boolean);
    if (BLACKLIST_IPS.includes(ip)) {
      return true;
    }
    
    // 将来的には、データベースから失敗回数をチェック
    // const activity = await prisma.ipActivity.count({
    //   where: {
    //     ip,
    //     activity: 'login_failed',
    //     timestamp: {
    //       gte: new Date(Date.now() - BLOCK_DURATION_MINUTES * 60 * 1000),
    //     },
    //   },
    // });
    // 
    // return activity >= MAX_FAILED_ATTEMPTS;
    
    return false;
  } catch (error) {
    console.error('[Suspicious IP] Error checking block status:', error);
    return false;
  }
}

/**
 * IPアドレスをブロック
 */
export async function blockIp(ip: string, reason: string): Promise<void> {
  try {
    console.log(`[Suspicious IP] Blocking IP: ${ip} - Reason: ${reason}`);
    
    // 実際の実装では、Redisやデータベースにブロック情報を保存
    // 環境変数に追加するか、データベースに保存
    
    // 環境変数に追加（簡易実装）
    const currentBlacklist = (process.env.IP_BLACKLIST || '').split(',').filter(Boolean);
    if (!currentBlacklist.includes(ip)) {
      const updatedBlacklist = [...currentBlacklist, ip].join(',');
      // 注意: 環境変数は実行時に変更できないため、実際にはデータベースやRedisを使用
      console.warn(`[Suspicious IP] IP should be added to IP_BLACKLIST: ${ip}`);
    }
  } catch (error) {
    console.error('[Suspicious IP] Error blocking IP:', error);
  }
}


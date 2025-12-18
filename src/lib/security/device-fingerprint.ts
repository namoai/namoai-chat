/**
 * デバイスフィンガープリンティング
 * デバイス情報を収集・保存し、ログイン時に変更を検出
 */

import { NextRequest } from 'next/server';
import { createHash } from 'crypto';

/**
 * デバイス情報の型定義
 */
export interface DeviceInfo {
  userAgent: string;
  language: string;
  platform: string;
  screenResolution?: string;
  timezone?: string;
  fingerprint: string;
}

/**
 * デバイスフィンガープリントを生成
 */
export function generateDeviceFingerprint(deviceInfo: Partial<DeviceInfo>): string {
  const components = [
    deviceInfo.userAgent || '',
    deviceInfo.language || '',
    deviceInfo.platform || '',
    deviceInfo.screenResolution || '',
    deviceInfo.timezone || '',
  ];
  
  const combined = components.join('|');
  return createHash('sha256').update(combined).digest('hex');
}

/**
 * リクエストからデバイス情報を抽出
 */
export function extractDeviceInfo(request: NextRequest): DeviceInfo {
  const userAgent = request.headers.get('user-agent') || '';
  const acceptLanguage = request.headers.get('accept-language') || '';
  
  // User-Agentからプラットフォームを抽出（簡易実装）
  let platform = 'unknown';
  if (userAgent.includes('Windows')) platform = 'Windows';
  else if (userAgent.includes('Mac')) platform = 'Mac';
  else if (userAgent.includes('Linux')) platform = 'Linux';
  else if (userAgent.includes('Android')) platform = 'Android';
  else if (userAgent.includes('iOS')) platform = 'iOS';
  
  const fingerprint = generateDeviceFingerprint({
    userAgent,
    language: acceptLanguage.split(',')[0] || 'unknown',
    platform,
  });
  
  return {
    userAgent,
    language: acceptLanguage.split(',')[0] || 'unknown',
    platform,
    fingerprint,
  };
}

/**
 * デバイス情報を保存
 */
export async function saveDeviceInfo(
  userId: number,
  deviceInfo: DeviceInfo,
  _ipAddress: string
): Promise<void> {
  try {
    // デバイス情報テーブルが存在する場合（将来の実装）
    // await prisma.deviceInfo.create({
    //   data: {
    //     userId,
    //     fingerprint: deviceInfo.fingerprint,
    //     userAgent: deviceInfo.userAgent,
    //     platform: deviceInfo.platform,
    //     language: deviceInfo.language,
    //     ipAddress,
    //     lastSeen: new Date(),
    //   },
    // });
    
    console.log(`[Device Fingerprint] Saved device info for user ${userId}: ${deviceInfo.fingerprint}`);
  } catch (error) {
    console.error('[Device Fingerprint] Error saving device info:', error);
  }
}

/**
 * デバイスが既知かチェック
 */
export async function isKnownDevice(
  _userId: number,
  _fingerprint: string
): Promise<boolean> {
  try {
    // 実際の実装では、データベースからチェック
    // const device = await prisma.deviceInfo.findFirst({
    //   where: {
    //     userId,
    //     fingerprint,
    //   },
    // });
    // 
    // return !!device;
    
    // 簡易実装: 常にfalseを返す（新規デバイスとして扱う）
    return false;
  } catch (error) {
    console.error('[Device Fingerprint] Error checking known device:', error);
    return false;
  }
}


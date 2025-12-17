/**
 * ログイン通知システム
 * ログイン成功時・新規デバイス検出時にメール通知
 */

import { sendEmail } from '../email';
import { extractDeviceInfo, isKnownDevice, saveDeviceInfo } from './device-fingerprint';
import { getClientIp } from './suspicious-ip';
import { NextRequest } from 'next/server';
import { getPrisma } from '../prisma';

/**
 * ログイン通知を送信
 */
export async function sendLoginNotification(
  userId: number,
  request: NextRequest
): Promise<void> {
  try {
    const prisma = await getPrisma();
    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: { email: true, name: true },
    });
    
    if (!user) {
      return;
    }
    
    const deviceInfo = extractDeviceInfo(request);
    const ipAddress = getClientIp(request);
    const isNewDevice = !(await isKnownDevice(userId, deviceInfo.fingerprint));
    
    // デバイス情報を保存
    await saveDeviceInfo(userId, deviceInfo, ipAddress);
    
    // ログイン通知メールを送信
    const loginTime = new Date().toLocaleString('ja-JP');
    const deviceDetails = `
デバイス情報:
- プラットフォーム: ${deviceInfo.platform}
- 言語: ${deviceInfo.language}
- IPアドレス: ${ipAddress}
- ユーザーエージェント: ${deviceInfo.userAgent.substring(0, 100)}...
    `.trim();
    
    const subject = isNewDevice
      ? '【NAMOSAI】新規デバイスからのログイン通知'
      : '【NAMOSAI】ログイン通知';
    
    const body = `
${user.name}様

${isNewDevice ? '⚠️ 新規デバイスから' : ''}ログインが検出されました。

ログイン日時: ${loginTime}
${deviceDetails}

${isNewDevice ? 'このログインに心当たりがない場合は、すぐにパスワードを変更してください。' : ''}

---
NAMOSAI セキュリティチーム
    `.trim();
    
    await sendEmail({
      to: user.email,
      subject,
      text: body,
    });
    
    console.log(`[Login Notification] Sent to ${user.email} (new device: ${isNewDevice})`);
  } catch (error) {
    console.error('[Login Notification] Error sending notification:', error);
    // 通知エラーはログインを妨げない
  }
}


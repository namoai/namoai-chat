export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/nextauth';
import { Role } from '@prisma/client';
import { safeJsonParse } from '@/lib/api-helpers';
import { isSupportedPattern } from '@/lib/security/ip-match';

/**
 * IPブロックリストを取得
 * GET /api/admin/ip-block
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (session?.user?.role !== Role.SUPER_ADMIN) {
      return NextResponse.json({ error: '権限がありません。' }, { status: 403 });
    }

    // IPブロックテーブルから取得（将来の実装）
    // 現在は環境変数から取得
    const blacklist = (process.env.IP_BLACKLIST || '').split(',').filter(Boolean);
    const whitelist = (process.env.IP_WHITELIST || '').split(',').filter(Boolean);

    return NextResponse.json({
      blacklist: blacklist.map(ip => ({
        ip,
        reason: '手動ブロック',
        blockedAt: new Date().toISOString(),
      })),
      whitelist,
    });
  } catch (error) {
    console.error('[IP Block] エラー:', error);
    return NextResponse.json({ error: '取得に失敗しました。' }, { status: 500 });
  }
}

/**
 * IPをブロック
 * POST /api/admin/ip-block
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (session?.user?.role !== Role.SUPER_ADMIN) {
      return NextResponse.json({ error: '権限がありません。' }, { status: 403 });
    }

    const parseResult = await safeJsonParse<{ ip: string; reason?: string }>(request);
    if (!parseResult.success) return parseResult.error;
    const { ip, reason } = parseResult.data;

    if (!ip) {
      return NextResponse.json({ error: 'IPアドレスが必要です。' }, { status: 400 });
    }

    // IP形式の検証（exact / wildcard / CIDR）
    if (!isSupportedPattern(ip)) {
      return NextResponse.json(
        { error: '無効なIP形式です。（例: 111.111.111.* / 111.111.111.0/24 / 111.111.111.111）' },
        { status: 400 }
      );
    }

    // 現在のブラックリストを取得
    const currentBlacklist = (process.env.IP_BLACKLIST || '').split(',').filter(Boolean);
    
    if (currentBlacklist.includes(ip)) {
      return NextResponse.json({ error: 'このIPは既にブロックされています。' }, { status: 400 });
    }

    // 実際の実装では、データベースに保存
    // const prisma = await getPrisma();
    // await prisma.ipBlock.create({
    //   data: {
    //     ip,
    //     reason: reason || '管理者による手動ブロック',
    //     blockedBy: session.user.id,
    //     blockedAt: new Date(),
    //   },
    // });

    console.log(`[IP Block] IP blocked: ${ip} - Reason: ${reason || '管理者による手動ブロック'}`);

    return NextResponse.json({
      success: true,
      message: `IPアドレス ${ip} をブロックしました。`,
      ip,
      reason: reason || '管理者による手動ブロック',
    });
  } catch (error) {
    console.error('[IP Block] エラー:', error);
    return NextResponse.json({ error: 'ブロックに失敗しました。' }, { status: 500 });
  }
}

/**
 * IPブロックを解除
 * DELETE /api/admin/ip-block
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (session?.user?.role !== Role.SUPER_ADMIN) {
      return NextResponse.json({ error: '権限がありません。' }, { status: 403 });
    }

    const parseResult = await safeJsonParse<{ ip: string }>(request);
    if (!parseResult.success) return parseResult.error;
    const { ip } = parseResult.data;

    if (!ip) {
      return NextResponse.json({ error: 'IPアドレスが必要です。' }, { status: 400 });
    }

    // 実際の実装では、データベースから削除
    // const prisma = await getPrisma();
    // await prisma.ipBlock.deleteMany({
    //   where: { ip },
    // });

    console.log(`[IP Block] IP unblocked: ${ip}`);

    return NextResponse.json({
      success: true,
      message: `IPアドレス ${ip} のブロックを解除しました。`,
      ip,
    });
  } catch (error) {
    console.error('[IP Block] エラー:', error);
    return NextResponse.json({ error: '解除に失敗しました。' }, { status: 500 });
  }
}



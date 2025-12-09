export const runtime = 'nodejs';
export const dynamic = "force-dynamic"; // ▼▼▼【重要】キャッシュを無効化して常に最新データを取得 ▼▼▼

import { NextResponse, NextRequest } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/nextauth';
import { getPrisma } from "@/lib/prisma";
import { isBuildTime, buildTimeResponse, safeJsonParse } from '@/lib/api-helpers';
import { resolveSafetyFilter } from '@/lib/age';

// GET: 現在のユーザーのセーフティフィルター設定を取得します
export async function GET() {
  if (isBuildTime()) return buildTimeResponse();
  
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: '認証が必要です。' }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);

  try {
    const prisma = await getPrisma();
    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: { safetyFilter: true, dateOfBirth: true, declaredAdult: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'ユーザーが見つかりません。' }, { status: 404 });
    }
    const { safetyFilter, ageStatus } = resolveSafetyFilter(user);
    return NextResponse.json({ safetyFilter, isMinor: ageStatus.isMinor, ageSource: ageStatus.source });
  } catch (error) {
    // ▼▼▼ 変更点: console.errorを追加してエラー内容をログに出力 ▼▼▼
    console.error('フィルター取得エラー:', error);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}

// PUT: ユーザーのセーフティフィルター設定を更新します
export async function PUT(request: NextRequest) {
  if (isBuildTime()) return buildTimeResponse();
  
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: '認証が必要です。' }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);

  try {
    const parseResult = await safeJsonParse<{ safetyFilter: boolean }>(request);
    if (!parseResult.success) return parseResult.error;
    const { safetyFilter } = parseResult.data;
    
    if (typeof safetyFilter !== 'boolean') {
      return NextResponse.json({ error: '無効な値です。' }, { status: 400 });
    }

    const prisma = await getPrisma();
    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: { safetyFilter: true, dateOfBirth: true, declaredAdult: true },
    });
    if (!user) {
      return NextResponse.json({ error: 'ユーザーが見つかりません。' }, { status: 404 });
    }
    const { ageStatus } = resolveSafetyFilter(user);
    if (ageStatus.isMinor) {
      return NextResponse.json(
        { error: '未成年のためセーフティフィルターをOFFにできません。' },
        { status: 403 }
      );
    }

    await prisma.users.update({
      where: { id: userId },
      data: { safetyFilter: safetyFilter },
    });

    return NextResponse.json({ success: true, safetyFilter });
  } catch (error) {
    // ▼▼▼ 変更点: console.errorを追加してエラー内容をログに出力 ▼▼▼
    console.error('フィルター更新エラー:', error);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
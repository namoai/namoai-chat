export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse, NextRequest } from 'next/server';
import { prisma } from "@/lib/prisma";
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/nextauth';
// ▼▼▼ 変更点: 型安全性のためにRole Enumをインポートします ▼▼▼
import { Role } from '@prisma/client';
import { isBuildTime, buildTimeResponse, safeJsonParse } from '@/lib/api-helpers';

/**
 * GET: すべてのお知らせを新しい順に取得します
 */
// この関数は公開APIなので、権限チェックは不要です。
export async function GET(): Promise<NextResponse> {
  if (isBuildTime()) return buildTimeResponse();
  
  try {
    const notices = await prisma.notices.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });
    return NextResponse.json(notices);
  } catch (error) {
    console.error('お知らせ一覧の取得エラー:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました。' },
      { status: 500 }
    );
  }
}

/**
 * POST: 新しいお知らせを作成します (管理者のみ)
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  if (isBuildTime()) return buildTimeResponse();
  
  const session = await getServerSession(authOptions);

  // ▼▼▼ 変更点: 権限チェックを MODERATOR と SUPER_ADMIN に変更します ▼▼▼
  const userRole = session?.user?.role;
  if (!userRole || (userRole !== Role.MODERATOR && userRole !== Role.SUPER_ADMIN)) {
    return NextResponse.json({ error: '権限がありません。' }, { status: 403 });
  }

  try {
    const parseResult = await safeJsonParse<{ title: string; category: string; content: string }>(request);
    if (!parseResult.success) return parseResult.error;
    const body = parseResult.data;
    const { title, category, content } = body;

    if (!title || !category || !content) {
      return NextResponse.json(
        { error: 'すべてのフィールドは必須です。' },
        { status: 400 }
      );
    }

    const newNotice = await prisma.notices.create({
      data: {
        title,
        category,
        content,
      },
    });

    return NextResponse.json(newNotice, { status: 201 });
  } catch (error) {
    console.error('お知らせ作成エラー:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました。' },
      { status: 500 }
    );
  }
}
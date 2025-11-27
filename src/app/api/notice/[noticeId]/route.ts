export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse, NextRequest } from 'next/server';
import { getPrisma } from "@/lib/prisma";
import { Prisma, Role } from "@prisma/client"; // ▼▼▼ 変更点: Role Enumをインポートします ▼▼▼
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/nextauth';
import { isBuildTime, buildTimeResponse, safeJsonParse } from '@/lib/api-helpers';

// ✅ Vercelビルドエラーを回避するため、URLから直接IDを解析するヘルパー関数
function extractNoticeIdFromRequest(request: Request): number | null {
  const url = new URL(request.url);
  const idStr = url.pathname.split('/').pop();
  if (!idStr) return null;
  const parsedId = parseInt(idStr, 10);
  return isNaN(parsedId) ? null : parsedId;
}

/**
 * GET: 特定のお知らせの詳細情報をIDで取得します
 */
export async function GET(request: NextRequest) {
  if (isBuildTime()) return buildTimeResponse();
  
  try {
    const noticeId = extractNoticeIdFromRequest(request);

    if (noticeId === null) {
      return NextResponse.json({ error: '無効なIDです。' }, { status: 400 });
    }

    const prisma = await getPrisma();
    const notice = await prisma.notices.findUnique({
      where: { id: noticeId },
    });

    if (!notice) {
      return NextResponse.json(
        { error: 'お知らせが見つかりません。' },
        { status: 404 }
      );
    }

    return NextResponse.json(notice);
  } catch (error) {
    console.error('お知らせ詳細の取得エラー:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました。' },
      { status: 500 }
    );
  }
}

/**
 * PUT: 特定のお知らせを更新します (管理者のみ)
 */
export async function PUT(request: NextRequest) {
  if (isBuildTime()) return buildTimeResponse();
  
  const session = await getServerSession(authOptions);
  // ▼▼▼ 変更点: 権限チェックを MODERATOR と SUPER_ADMIN に変更します ▼▼▼
  const userRole = session?.user?.role;
  if (!userRole || (userRole !== Role.MODERATOR && userRole !== Role.SUPER_ADMIN)) {
    return NextResponse.json({ error: '権限がありません。' }, { status: 403 });
  }

  try {
    const noticeId = extractNoticeIdFromRequest(request);
    if (noticeId === null) {
      return NextResponse.json({ error: '無効なIDです。' }, { status: 400 });
    }

    const parseResult = await safeJsonParse<{ title: string; category: string; content: string }>(request);
    if (!parseResult.success) return parseResult.error;
    const { title, category, content } = parseResult.data;
    if (!title || !category || !content) {
      return NextResponse.json({ error: 'すべてのフィールドは必須です。' }, { status: 400 });
    }

    const prisma = await getPrisma();
    const updatedNotice = await prisma.notices.update({
      where: { id: noticeId },
      data: { title, category, content },
    });

    return NextResponse.json(updatedNotice);
  } catch (error) {
    console.error('お知らせ更新エラー:', error);
    return NextResponse.json({ error: 'サーバーエラーが発生しました。' }, { status: 500 });
  }
}


/**
 * DELETE: 特定のお知らせを削除します (管理者のみ)
 */
export async function DELETE(request: NextRequest) {
  if (isBuildTime()) return buildTimeResponse();
  
  const session = await getServerSession(authOptions);
  // ▼▼▼ 変更点: 権限チェックを MODERATOR と SUPER_ADMIN に変更します ▼▼▼
  const userRole = session?.user?.role;
  if (!userRole || (userRole !== Role.MODERATOR && userRole !== Role.SUPER_ADMIN)) {
    return NextResponse.json({ error: '権限がありません。' }, { status: 403 });
  }

  try {
    const noticeId = extractNoticeIdFromRequest(request);
    if (noticeId === null) {
      return NextResponse.json({ error: '無効なIDです。' }, { status: 400 });
    }

    const prisma = await getPrisma();
    await prisma.notices.delete({
      where: { id: noticeId },
    });

    return NextResponse.json({ message: 'お知らせが正常に削除されました。' }, { status: 200 });

  } catch (error) {
    console.error('お知らせ削除エラー:', error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
       return NextResponse.json({ error: '削除対象のお知らせが見つかりません。' }, { status: 404 });
    }
    return NextResponse.json({ error: 'サーバーエラーが発生しました。' }, { status: 500 });
  }
}
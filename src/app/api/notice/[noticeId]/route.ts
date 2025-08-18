export const runtime = 'nodejs';

import { NextResponse, NextRequest } from 'next/server';
import { PrismaClient, Prisma } from '@prisma/client';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/nextauth';

const prisma = new PrismaClient();

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
  try {
    const noticeId = extractNoticeIdFromRequest(request);

    if (noticeId === null) {
      return NextResponse.json({ error: '無効なIDです。' }, { status: 400 });
    }

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
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'ADMIN') {
    return NextResponse.json({ error: '権限がありません。' }, { status: 403 });
  }

  try {
    const noticeId = extractNoticeIdFromRequest(request);
    if (noticeId === null) {
      return NextResponse.json({ error: '無効なIDです。' }, { status: 400 });
    }

    const { title, category, content } = await request.json();
    if (!title || !category || !content) {
      return NextResponse.json({ error: 'すべてのフィールドは必須です。' }, { status: 400 });
    }

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
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'ADMIN') {
    return NextResponse.json({ error: '権限がありません。' }, { status: 403 });
  }

  try {
    const noticeId = extractNoticeIdFromRequest(request);
    if (noticeId === null) {
      return NextResponse.json({ error: '無効なIDです。' }, { status: 400 });
    }

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

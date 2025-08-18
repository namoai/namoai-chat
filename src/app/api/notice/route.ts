export const runtime = 'nodejs';

import { NextResponse, NextRequest } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/nextauth';

const prisma = new PrismaClient();

/**
 * GET: すべてのお知らせを新しい順に取得します
 */
// ✅ Vercelビルドエラーを解決するため、未使用の`_request`引数を削除しました。
export async function GET(): Promise<NextResponse> {
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
  const session = await getServerSession(authOptions);

  // ログインしていない、または管理者でない場合はエラー
  if (!session?.user?.role || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: '権限がありません。' }, { status: 403 });
  }

  try {
    const body = await request.json();
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

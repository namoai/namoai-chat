import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/nextauth';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

// 自分の通報・要望・お問い合わせ一覧取得 (GET)
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: '認証が必要です。' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type'); // 'CHARACTER_REPORT', 'SUGGESTION', 'INQUIRY'
    const status = searchParams.get('status'); // 'PENDING', 'REVIEWED', 'RESOLVED', 'REJECTED'
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const skip = (page - 1) * limit;

    const userId = parseInt(session.user.id, 10);

    const where: Prisma.reportsWhereInput = {
      reporterId: userId,
    };
    if (type) where.type = type;
    if (status) where.status = status;

    const [reports, total] = await Promise.all([
      prisma.reports.findMany({
        where,
        include: {
          characters: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.reports.count({ where }),
    ]);

    return NextResponse.json({
      reports,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('お問い合わせ一覧取得エラー:', error);
    return NextResponse.json(
      { error: 'お問い合わせ一覧取得中にエラーが発生しました。' },
      { status: 500 }
    );
  }
}


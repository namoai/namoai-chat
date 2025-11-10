import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/nextauth';
import { prisma } from '@/lib/prisma';

// 通報作成 (POST)
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: '認証が必要です。' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { type, characterId, reason, content } = body;

    if (!type || !reason) {
      return NextResponse.json({ error: '通報種類と理由は必須です。' }, { status: 400 });
    }

    const userId = parseInt(session.user.id, 10);
    
    // 通報作成
    const report = await prisma.reports.create({
      data: {
        type,
        characterId: characterId ? parseInt(characterId, 10) : null,
        reporterId: userId,
        reason,
        content: content || '',
        status: 'PENDING',
      },
    });

    return NextResponse.json({ success: true, report }, { status: 201 });
  } catch (error) {
    console.error('通報作成エラー:', error);
    return NextResponse.json(
      { error: '通報受付中にエラーが発生しました。' },
      { status: 500 }
    );
  }
}

// 通報一覧取得 (GET) - 管理者用
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: '認証が必要です。' }, { status: 401 });
  }

  const userRole = session.user.role;
  if (userRole !== 'MODERATOR' && userRole !== 'CHAR_MANAGER' && userRole !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: '管理者権限が必要です。' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type'); // 'CHARACTER_REPORT', 'SUGGESTION', 'INQUIRY'
    const status = searchParams.get('status'); // 'PENDING', 'REVIEWED', 'RESOLVED', 'REJECTED'
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const skip = (page - 1) * limit;

    const where: any = {};
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
              author: {
                select: {
                  id: true,
                  nickname: true,
                },
              },
            },
          },
          reporter: {
            select: {
              id: true,
              nickname: true,
              email: true,
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
    console.error('通報一覧取得エラー:', error);
    return NextResponse.json(
      { error: '通報一覧取得中にエラーが発生しました。' },
      { status: 500 }
    );
  }
}


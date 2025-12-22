import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/nextauth';
import { getPrisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// GET: バナーを取得（all=trueの場合はすべて、それ以外はアクティブなもののみ）
export async function GET(request: NextRequest) {
  try {
    const prisma = await getPrisma();
    const url = new URL(request.url);
    const all = url.searchParams.get('all') === 'true';
    
    const banners = await prisma.banners.findMany({
      where: all ? {} : { isActive: true },
      orderBy: { displayOrder: 'asc' },
    });

    return NextResponse.json(banners);
  } catch (error) {
    console.error('[Banners API] GET エラー:', error);
    return NextResponse.json(
      { error: 'バナーの取得に失敗しました' },
      { status: 500 }
    );
  }
}

// POST: 新しいバナーを作成（管理者のみ）
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const userRole = session.user?.role;
    if (userRole !== 'MODERATOR' && userRole !== 'SUPER_ADMIN' && userRole !== 'CHAR_MANAGER') {
      return NextResponse.json({ error: '管理者権限が必要です' }, { status: 403 });
    }

    const body = await request.json();
    const { title, description, imageUrl, link, displayOrder } = body;

    if (!imageUrl) {
      return NextResponse.json({ error: '画像URLは必須です' }, { status: 400 });
    }

    const prisma = await getPrisma();
    
    const banner = await prisma.banners.create({
      data: {
        title: title || null,
        description: description || null,
        imageUrl,
        link: link || null,
        displayOrder: displayOrder ?? 0,
        isActive: true,
      },
    });

    return NextResponse.json(banner, { status: 201 });
  } catch (error) {
    console.error('[Banners API] POST エラー:', error);
    return NextResponse.json(
      { error: 'バナーの作成に失敗しました' },
      { status: 500 }
    );
  }
}

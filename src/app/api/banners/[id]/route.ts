import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/nextauth';
import { getPrisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// PUT: バナーを更新（管理者のみ）
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const userRole = session.user?.role;
    if (userRole !== 'MODERATOR' && userRole !== 'SUPER_ADMIN' && userRole !== 'CHAR_MANAGER') {
      return NextResponse.json({ error: '管理者権限が必要です' }, { status: 403 });
    }

    const { id } = await params;
    const bannerId = parseInt(id, 10);
    if (isNaN(bannerId)) {
      return NextResponse.json({ error: '無効なバナーIDです' }, { status: 400 });
    }

    const body = await request.json();
    const { title, description, imageUrl, link, displayOrder, isActive } = body;

    const prisma = await getPrisma();
    
    const banner = await prisma.banners.update({
      where: { id: bannerId },
      data: {
        ...(title !== undefined && { title: title || null }),
        ...(description !== undefined && { description: description || null }),
        ...(imageUrl !== undefined && { imageUrl }),
        ...(link !== undefined && { link: link || null }),
        ...(displayOrder !== undefined && { displayOrder }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    return NextResponse.json(banner);
  } catch (error) {
    console.error('[Banners API] PUT エラー:', error);
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2025') {
      return NextResponse.json({ error: 'バナーが見つかりません' }, { status: 404 });
    }
    return NextResponse.json(
      { error: 'バナーの更新に失敗しました' },
      { status: 500 }
    );
  }
}

// DELETE: バナーを削除（管理者のみ）
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const userRole = session.user?.role;
    if (userRole !== 'MODERATOR' && userRole !== 'SUPER_ADMIN' && userRole !== 'CHAR_MANAGER') {
      return NextResponse.json({ error: '管理者権限が必要です' }, { status: 403 });
    }

    const { id } = await params;
    const bannerId = parseInt(id, 10);
    if (isNaN(bannerId)) {
      return NextResponse.json({ error: '無効なバナーIDです' }, { status: 400 });
    }

    const prisma = await getPrisma();
    
    await prisma.banners.delete({
      where: { id: bannerId },
    });

    return NextResponse.json({ message: 'バナーを削除しました' });
  } catch (error) {
    console.error('[Banners API] DELETE エラー:', error);
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2025') {
      return NextResponse.json({ error: 'バナーが見つかりません' }, { status: 404 });
    }
    return NextResponse.json(
      { error: 'バナーの削除に失敗しました' },
      { status: 500 }
    );
  }
}

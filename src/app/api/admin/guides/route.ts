export const runtime = 'nodejs';

import { NextResponse, NextRequest } from 'next/server';
import { prisma } from "@/lib/prisma";
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/nextauth';

// GET: すべてのガイドを取得します（管理者用）
export async function GET() {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'ADMIN') {
    return NextResponse.json({ error: '権限がありません。' }, { status: 403 });
  }

  try {
    const guides = await prisma.guides.findMany({
      orderBy: [{ mainCategory: 'asc' }, { displayOrder: 'asc' }],
    });
    return NextResponse.json(guides);
  } catch (error) {
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}

// POST: 新しいガイドを作成します（管理者用）
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'ADMIN') {
    return NextResponse.json({ error: '権限がありません。' }, { status: 403 });
  }

  try {
    const data = await request.json();
    const newGuide = await prisma.guides.create({
      data: {
        mainCategory: data.mainCategory,
        subCategory: data.subCategory,
        title: data.title,
        content: data.content,
        displayOrder: parseInt(data.displayOrder, 10) || 0,
      },
    });
    return NextResponse.json(newGuide, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: '作成に失敗しました。' }, { status: 500 });
  }
}

// PUT: 既存のガイドを更新します（管理者用）
export async function PUT(request: NextRequest) {
    const session = await getServerSession(authOptions);
    if (session?.user?.role !== 'ADMIN') {
        return NextResponse.json({ error: '権限がありません。' }, { status: 403 });
    }

    try {
        const data = await request.json();
        const { id, ...updateData } = data;

        if (updateData.displayOrder) {
            updateData.displayOrder = parseInt(updateData.displayOrder, 10);
        }

        const updatedGuide = await prisma.guides.update({
            where: { id: parseInt(id, 10) },
            data: updateData,
        });
        return NextResponse.json(updatedGuide);
    } catch (error) {
        return NextResponse.json({ error: '更新に失敗しました。' }, { status: 500 });
    }
}

// DELETE: ガイドを削除します（管理者用）
export async function DELETE(request: NextRequest) {
    const session = await getServerSession(authOptions);
    if (session?.user?.role !== 'ADMIN') {
        return NextResponse.json({ error: '権限がありません。' }, { status: 403 });
    }

    try {
        const { id } = await request.json();
        await prisma.guides.delete({
            where: { id: parseInt(id, 10) },
        });
        return NextResponse.json({ message: '削除しました。' }, { status: 200 });
    } catch (error) {
        return NextResponse.json({ error: '削除に失敗しました。' }, { status: 500 });
    }
}

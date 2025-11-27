export const runtime = 'nodejs';

import { NextResponse, NextRequest } from 'next/server';
import { getPrisma } from "@/lib/prisma";
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/nextauth';
import { Role, Prisma } from '@prisma/client';
import { isBuildTime, buildTimeResponse } from '@/lib/api-helpers';

/**
 * 管理者権限（CHAR_MANAGER または SUPER_ADMIN）があるか確認します。
 */
async function requireCharManagementPermission() {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role;
  
  if (role !== Role.CHAR_MANAGER && role !== Role.SUPER_ADMIN) {
    return { 
      ok: false as const, 
      res: NextResponse.json({ message: '権限がありません。' }, { status: 403 }) 
    };
  }
  return { ok: true as const, session };
}

/**
 * GET: 管理者用のキャラクターリストを取得します（検索・ページネーション対応）
 */
export async function GET(request: NextRequest) {
  if (isBuildTime()) return buildTimeResponse();
  
  const auth = await requireCharManagementPermission();
  if (!auth.ok) return auth.res;

  const { searchParams } = new URL(request.url);
  const query = searchParams.get('search') || '';
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = 10;
  const skip = (page - 1) * limit;

  try {
    const prisma = await getPrisma();
    const whereClause: Prisma.charactersWhereInput = query ? {
      OR: [
        { name: { contains: query, mode: 'insensitive' } },
        { description: { contains: query, mode: 'insensitive' } },
      ],
    } : {};

    const [characters, total] = await prisma.$transaction([
      prisma.characters.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          author: { select: { nickname: true } },
          characterImages: { take: 1, orderBy: { displayOrder: 'asc' } },
        },
      }),
      prisma.characters.count({ where: whereClause }),
    ]);

    return NextResponse.json({
      characters,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
    });
  } catch (error) {
    console.error("管理者用キャラクターリスト取得エラー:", error);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}

/**
 * PUT: キャラクターの公開状態または公式キャラクター状態を切り替えます
 */
export async function PUT(request: NextRequest) {
    if (isBuildTime()) return buildTimeResponse();
    
    const auth = await requireCharManagementPermission();
    if (!auth.ok) return auth.res;

    try {
        const prisma = await getPrisma();
        let body;
        try {
            const text = await request.text();
            if (!text || text.trim() === '') {
                return NextResponse.json({ error: 'リクエストボディが空です。' }, { status: 400 });
            }
            body = JSON.parse(text);
        } catch (parseError) {
            console.error("JSON解析エラー:", parseError);
            return NextResponse.json({ error: '無効なJSON形式です。' }, { status: 400 });
        }

        const { id, visibility, isOfficial } = body;
        
        if (typeof id !== 'number') {
            return NextResponse.json({ error: '無効なIDです。' }, { status: 400 });
        }

        const updateData: { visibility?: string; isOfficial?: boolean } = {};
        if (typeof visibility === 'string') {
            updateData.visibility = visibility;
        }
        if (typeof isOfficial === 'boolean') {
            updateData.isOfficial = isOfficial;
        }

        if (Object.keys(updateData).length === 0) {
            return NextResponse.json({ error: '更新するデータがありません。' }, { status: 400 });
        }

        const updatedCharacter = await prisma.characters.update({
            where: { id },
            data: updateData,
        });
        return NextResponse.json(updatedCharacter);
    } catch (error) {
        console.error("キャラクター状態の更新エラー:", error);
        return NextResponse.json({ error: '更新に失敗しました。' }, { status: 500 });
    }
}

/**
 * DELETE: キャラクターを削除します
 */
export async function DELETE(request: NextRequest) {
    if (isBuildTime()) return buildTimeResponse();
    
    const auth = await requireCharManagementPermission();
    if (!auth.ok) return auth.res;

    try {
        const prisma = await getPrisma();
        let body;
        try {
            const text = await request.text();
            if (!text || text.trim() === '') {
                return NextResponse.json({ error: 'リクエストボディが空です。' }, { status: 400 });
            }
            body = JSON.parse(text);
        } catch (parseError) {
            console.error("JSON解析エラー:", parseError);
            return NextResponse.json({ error: '無効なJSON形式です。' }, { status: 400 });
        }

        const { id } = body;
        if (typeof id !== 'number') {
            return NextResponse.json({ error: '無効なIDです。' }, { status: 400 });
        }
        
        // 関連画像は onDelete: Cascade により自動で削除される想定
        await prisma.characters.delete({
            where: { id },
        });
        return NextResponse.json({ message: 'キャラクターを削除しました。' });
    } catch (error) {
        console.error("キャラクター削除エラー:", error);
        return NextResponse.json({ error: '削除に失敗しました。' }, { status: 500 });
    }
}

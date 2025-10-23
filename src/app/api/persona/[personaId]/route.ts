export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from "@/lib/prisma";
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/nextauth';

/* =============================================================================
 *  URL から ID を抽出（末尾スラッシュ等にも耐性）
 * ========================================================================== */
function extractPersonaIdFromRequest(request: Request): number | null {
  const url = new URL(request.url);
  const parts = url.pathname.split('/').filter(Boolean);
  const idStr = parts[parts.length - 1];
  if (!idStr) return null;
  const parsed = Number(idStr);
  return Number.isFinite(parsed) ? parsed : null;
}

/* =============================================================================
 *  GET: 特定のペルソナ詳細
 * ========================================================================== */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: '認証されていません。' }, { status: 401 });
  }

  try {
    const userId = Number(session.user.id);
    const personaId = extractPersonaIdFromRequest(request);
    if (personaId === null) {
      return NextResponse.json({ error: '無効なIDです。' }, { status: 400 });
    }

    const persona = await prisma.personas.findFirst({
      where: { id: personaId, authorId: userId },
    });

    if (!persona) {
      return NextResponse.json({ error: 'ペルソナが見つからないか、権限がありません。' }, { status: 404 });
    }

    return NextResponse.json(persona);
  } catch (error) {
    console.error('ペルソナ詳細取得エラー:', error);
    return NextResponse.json({ error: 'サーバーエラーが発生しました。' }, { status: 500 });
  }
}

/* =============================================================================
 *  PUT: ペルソナ更新
 *  - age は number/string/null どれでも安全に正規化
 * ========================================================================== */
export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: '認証されていません。' }, { status: 401 });
  }

  try {
    const userId = Number(session.user.id);
    const personaId = extractPersonaIdFromRequest(request);
    if (personaId === null) {
      return NextResponse.json({ error: '無効なIDです。' }, { status: 400 });
    }

    const body = await request.json();
    const { nickname, age, gender, description } = body ?? {};

    if (!nickname || !description) {
      return NextResponse.json({ error: 'ニックネームと詳細情報は必須です。' }, { status: 400 });
    }

    const existing = await prisma.personas.findFirst({
      where: { id: personaId, authorId: userId },
    });
    if (!existing) {
      return NextResponse.json({ error: 'ペルソナが見つからないか、更新権限がありません。' }, { status: 404 });
    }

    // age を number | null に正規化
    const normalizedAge: number | null =
      typeof age === 'number'
        ? age
        : (typeof age === 'string' && age.trim() !== '' ? Number(age) : null);

    const updated = await prisma.personas.update({
      where: { id: personaId },
      data: { nickname, age: normalizedAge, gender, description },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('ペルソナ更新エラー:', error);
    return NextResponse.json({ error: 'サーバーエラーが発生しました。' }, { status: 500 });
  }
}

/* =============================================================================
 *  DELETE: ペルソナ削除
 * ========================================================================== */
export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: '認証されていません。' }, { status: 401 });
  }

  try {
    const userId = Number(session.user.id);
    const personaId = extractPersonaIdFromRequest(request);
    if (personaId === null) {
      return NextResponse.json({ error: '無効なIDです。' }, { status: 400 });
    }

    const persona = await prisma.personas.findFirst({
      where: { id: personaId, authorId: userId },
    });
    if (!persona) {
      return NextResponse.json({ error: 'ペルソナが見つからないか、削除権限がありません。' }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      const user = await tx.users.findUnique({ where: { id: userId } });
      if (user?.defaultPersonaId === personaId) {
        await tx.users.update({
          where: { id: userId },
          data: { defaultPersonaId: null },
        });
      }
      await tx.personas.delete({ where: { id: personaId } });
    });

    return NextResponse.json({ message: 'ペルソナが正常に削除されました。' });
  } catch (error) {
    console.error('ペルソナ削除エラー:', error);
    return NextResponse.json({ error: 'サーバーエラーが発生しました。' }, { status: 500 });
  }
}
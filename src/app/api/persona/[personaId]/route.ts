export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from "@/lib/prisma";
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/nextauth';
import { isBuildTime, buildTimeResponse } from '@/lib/api-helpers';

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
  if (isBuildTime()) return buildTimeResponse();
  
  try {
    const prisma = await getPrisma();
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ ok: false, error: '認証されていません。' }, { status: 401 });
    }

    const userId = Number(session.user.id);
    const personaId = extractPersonaIdFromRequest(request);
    if (personaId === null) {
      return NextResponse.json({ ok: false, error: '無効なIDです。' }, { status: 400 });
    }

    const persona = await prisma.personas.findFirst({
      where: { id: personaId, authorId: userId },
    });

    if (!persona) {
      return NextResponse.json(
        { ok: false, error: 'ペルソナが見つからないか、権限がありません。' },
        { status: 404 }
      );
    }

    return new NextResponse(JSON.stringify(persona), {
      status: 200,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
      },
    });
  } catch (error) {
    console.error('[api/persona/[id]] ペルソナ詳細取得エラー:', error);
    const body = { ok: false, error: 'サーバーエラーが発生しました。', data: null };
    return new NextResponse(JSON.stringify(body), {
      status: 500,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    });
  }
}

/* =============================================================================
 *  PUT: ペルソナ更新
 * ========================================================================== */
export async function PUT(request: NextRequest) {
  if (isBuildTime()) return buildTimeResponse();
  
  try {
    const prisma = await getPrisma();
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ ok: false, error: '認証されていません。' }, { status: 401 });
    }

    const userId = Number(session.user.id);
    const personaId = extractPersonaIdFromRequest(request);
    if (personaId === null) {
      return NextResponse.json({ ok: false, error: '無効なIDです。' }, { status: 400 });
    }

    const text = await request.text();
    if (!text) {
      return NextResponse.json({ ok: false, error: 'リクエスト本文が空です。' }, { status: 400 });
    }

    let body: Record<string, unknown>;
    try {
      body = JSON.parse(text);
    } catch {
      return NextResponse.json({ ok: false, error: 'JSON形式が不正です。' }, { status: 400 });
    }

    const { nickname, age, gender, description } = body;
    if (typeof nickname !== 'string' || typeof description !== 'string') {
      return NextResponse.json({ ok: false, error: 'ニックネームと詳細情報は必須です。' }, { status: 400 });
    }

    const existing = await prisma.personas.findFirst({
      where: { id: personaId, authorId: userId },
    });
    if (!existing) {
      return NextResponse.json({ ok: false, error: 'ペルソナが見つからないか、更新権限がありません。' }, { status: 404 });
    }

    const normalizedAge: number | null =
      typeof age === 'number'
        ? age
        : typeof age === 'string' && age.trim() !== ''
        ? Number(age)
        : null;

    const updated = await prisma.personas.update({
      where: { id: personaId },
      data: { nickname, age: normalizedAge, gender: gender as string | null, description },
    });

    return new NextResponse(JSON.stringify(updated), {
      status: 200,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    });
  } catch (error) {
    console.error('[api/persona/[id]] ペルソナ更新エラー:', error);
    const body = { ok: false, error: 'サーバーエラーが発生しました。' };
    return new NextResponse(JSON.stringify(body), {
      status: 500,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    });
  }
}

/* =============================================================================
 *  DELETE: ペルソナ削除
 * ========================================================================== */
export async function DELETE(request: NextRequest) {
  if (isBuildTime()) return buildTimeResponse();
  
  try {
    const prisma = await getPrisma();
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ ok: false, error: '認証されていません。' }, { status: 401 });
    }

    const userId = Number(session.user.id);
    const personaId = extractPersonaIdFromRequest(request);
    if (personaId === null) {
      return NextResponse.json({ ok: false, error: '無効なIDです。' }, { status: 400 });
    }

    const persona = await prisma.personas.findFirst({
      where: { id: personaId, authorId: userId },
    });
    if (!persona) {
      return NextResponse.json({ ok: false, error: 'ペルソナが見つからないか、削除権限がありません。' }, { status: 404 });
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

    return new NextResponse(
      JSON.stringify({ ok: true, message: 'ペルソナが正常に削除されました。' }),
      { status: 200, headers: { 'content-type': 'application/json; charset=utf-8' } }
    );
  } catch (error) {
    console.error('[api/persona/[id]] ペルソナ削除エラー:', error);
    const body = { ok: false, error: 'サーバーエラーが発生しました。' };
    return new NextResponse(JSON.stringify(body), {
      status: 500,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    });
  }
}
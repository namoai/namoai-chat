export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from "@/lib/prisma";
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/nextauth';
import { isBuildTime, buildTimeResponse } from '@/lib/api-helpers';

/* =============================================================================
 *  GET: ログイン中ユーザーのペルソナ一覧
 * ========================================================================== */
export async function GET() {
  if (isBuildTime()) return buildTimeResponse();
  
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: '認証されていません。' }, { status: 401 });
  }

  try {
    const prisma = await getPrisma();
    const userId = Number(session.user.id);
    const userWithPersonas = await prisma.users.findUnique({
      where: { id: userId },
      select: {
        defaultPersonaId: true,
        personas: { orderBy: { createdAt: 'asc' } },
      },
    });

    if (!userWithPersonas) {
      return NextResponse.json({ error: 'ユーザーが見つかりません。' }, { status: 404 });
    }

    return NextResponse.json({
      personas: userWithPersonas.personas,
      defaultPersonaId: userWithPersonas.defaultPersonaId,
    });
  } catch (error) {
    console.error('ペルソナリストの取得エラー:', error);
    return NextResponse.json({ error: 'サーバーエラーが発生しました。' }, { status: 500 });
  }
}

/* =============================================================================
 *  POST: ペルソナ作成（age は number/string/null すべて許容）
 * ========================================================================== */
export async function POST(request: NextRequest) {
  if (isBuildTime()) return buildTimeResponse();
  
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: '認証されていません。' }, { status: 401 });
  }

  try {
    const prisma = await getPrisma();
    const userId = Number(session.user.id);
    const body = await request.json();
    const { nickname, age, gender, description } = body ?? {};

    if (!nickname || !description) {
      return NextResponse.json({ error: 'ニックネームと詳細情報は必須です。' }, { status: 400 });
    }

    const normalizedAge: number | null =
      typeof age === 'number'
        ? age
        : (typeof age === 'string' && age.trim() !== '' ? Number(age) : null);

    const newPersona = await prisma.personas.create({
      data: {
        nickname,
        age: normalizedAge,
        gender,
        description,
        authorId: userId,
      },
    });

    return NextResponse.json(newPersona, { status: 201 });
  } catch (error) {
    console.error('ペルソナ作成エラー:', error);
    return NextResponse.json({ error: 'サーバーエラーが発生しました。' }, { status: 500 });
  }
}

/* =============================================================================
 *  PATCH: 基本ペルソナ設定（所有権チェックあり）
 * ========================================================================== */
export async function PATCH(request: NextRequest) {
  if (isBuildTime()) return buildTimeResponse();
  
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: '認証されていません。' }, { status: 401 });
  }

  try {
    const prisma = await getPrisma();
    const userId = Number(session.user.id);
    const { personaId } = await request.json();

    if (typeof personaId !== 'number') {
      return NextResponse.json({ error: '無効なペルソナIDです。' }, { status: 400 });
    }

    const persona = await prisma.personas.findFirst({
      where: { id: personaId, authorId: userId },
    });
    if (!persona) {
      return NextResponse.json({ error: 'ペルソナが見つからないか、権限がありません。' }, { status: 404 });
    }

    await prisma.users.update({
      where: { id: userId },
      data: { defaultPersonaId: personaId },
    });

    return NextResponse.json({ message: '基本ペルソナが更新されました。' });
  } catch (error) {
    console.error('基本ペルソナ設定エラー:', error);
    return NextResponse.json({ error: 'サーバーエラーが発生しました。' }, { status: 500 });
  }
}
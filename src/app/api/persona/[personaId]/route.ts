export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/nextauth';

const prisma = new PrismaClient();

// ✅ Vercelビルドエラーを回避するため、URLから直接IDを解析するヘルパー関数
function extractPersonaIdFromRequest(request: Request): number | null {
  const url = new URL(request.url);
  const idStr = url.pathname.split('/').pop();
  if (!idStr) return null;
  const parsedId = parseInt(idStr, 10);
  return isNaN(parsedId) ? null : parsedId;
}

/**
 * GET: 特定のペルソナの詳細情報を取得します (編集ページ用)
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: '認証されていません。' }, { status: 401 });
  }

  try {
    const userId = parseInt(session.user.id, 10);
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


/**
 * PUT: 特定のペルソナ情報を更新します
 */
export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: '認証されていません。' }, { status: 401 });
  }

  try {
    const userId = parseInt(session.user.id, 10);
    const personaIdToUpdate = extractPersonaIdFromRequest(request);
    const body = await request.json();
    const { nickname, age, gender, description } = body;

    if (personaIdToUpdate === null) {
      return NextResponse.json({ error: '無効なIDです。' }, { status: 400 });
    }
    if (!nickname || !description) {
      return NextResponse.json({ error: 'ニックネームと詳細情報は必須です。' }, { status: 400 });
    }

    // 更新権限を確認
    const existingPersona = await prisma.personas.findFirst({
      where: { id: personaIdToUpdate, authorId: userId },
    });

    if (!existingPersona) {
      return NextResponse.json({ error: 'ペルソナが見つからないか、更新権限がありません。' }, { status: 404 });
    }

    const updatedPersona = await prisma.personas.update({
      where: { id: personaIdToUpdate },
      data: {
        nickname,
        age: age ? parseInt(age, 10) : null,
        gender,
        description,
      },
    });

    return NextResponse.json(updatedPersona);
  } catch (error) {
    console.error('ペルソナ更新エラー:', error);
    return NextResponse.json({ error: 'サーバーエラーが発生しました。' }, { status: 500 });
  }
}


/**
 * DELETE: 特定のペルソナを削除します
 */
export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: '認証されていません。' }, { status: 401 });
  }

  try {
    const userId = parseInt(session.user.id, 10);
    const personaIdToDelete = extractPersonaIdFromRequest(request);

    if (personaIdToDelete === null) {
      return NextResponse.json({ error: '無効なIDです。' }, { status: 400 });
    }

    const persona = await prisma.personas.findFirst({
      where: { id: personaIdToDelete, authorId: userId },
    });

    if (!persona) {
      return NextResponse.json({ error: 'ペルソナが見つからないか、削除権限がありません。' }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      const user = await tx.users.findUnique({ where: { id: userId } });
      if (user?.defaultPersonaId === personaIdToDelete) {
        await tx.users.update({
          where: { id: userId },
          data: { defaultPersonaId: null },
        });
      }
      await tx.personas.delete({ where: { id: personaIdToDelete } });
    });

    return NextResponse.json({ message: 'ペルソナが正常に削除されました。' });
  } catch (error) {
    console.error('ペルソナ削除エラー:', error);
    return NextResponse.json({ error: 'サーバーエラーが発生しました。' }, { status: 500 });
  }
}

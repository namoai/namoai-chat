export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/nextauth';

const prisma = new PrismaClient();

/**
 * GET: ログイン中のユーザーが所有するペルソナ一覧を取得します
 */
// ✅ Vercelビルドエラーを予防するため、未使用の引数を削除しました
export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: '認証されていません。' }, { status: 401 });
  }

  try {
    const userId = parseInt(session.user.id, 10);

    // ユーザーのペルソナ一覧と、どのペルソナが基本設定されているかを取得
    const userWithPersonas = await prisma.users.findUnique({
      where: { id: userId },
      select: {
        defaultPersonaId: true, // ユーザーの基本ペルソナID
        personas: {           // ユーザーが作成したペルソナのリスト
          orderBy: {
            createdAt: 'asc',
          },
        },
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


/**
 * POST: 新しいペルソナを作成します
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: '認証されていません。' }, { status: 401 });
  }

  try {
    const userId = parseInt(session.user.id, 10);
    const body = await request.json();
    const { nickname, age, gender, description } = body;

    if (!nickname || !description) {
      return NextResponse.json({ error: 'ニックネームと詳細情報は必須です。' }, { status: 400 });
    }

    const newPersona = await prisma.personas.create({
      data: {
        nickname,
        age: age ? parseInt(age, 10) : null,
        gender,
        description,
        authorId: userId, // ペルソナの所有者を設定
      },
    });

    return NextResponse.json(newPersona, { status: 201 });

  } catch (error) {
    console.error('ペルソナ作成エラー:', error);
    return NextResponse.json({ error: 'サーバーエラーが発生しました。' }, { status: 500 });
  }
}

/**
 * PATCH: ユーザーの基本ペルソナを設定します
 */
export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: '認証されていません。' }, { status: 401 });
  }

  try {
    const userId = parseInt(session.user.id, 10);
    const { personaId } = await request.json();

    if (typeof personaId !== 'number') {
      return NextResponse.json({ error: '無効なペルソナIDです。' }, { status: 400 });
    }
    
    // ユーザーがそのペルソナの所有者であることを確認 (セキュリティ対策)
    const persona = await prisma.personas.findFirst({
        where: {
            id: personaId,
            authorId: userId
        }
    });

    if (!persona) {
        return NextResponse.json({ error: 'ペルソナが見つからないか、権限がありません。' }, { status: 404 });
    }

    // ユーザーの基本ペルソナIDを更新
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

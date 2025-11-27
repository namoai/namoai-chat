import { NextResponse, NextRequest } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/nextauth';
import { prisma } from '@/lib/prisma';
import { notifyOnFavorite } from '@/lib/notifications'; // ★ 通知関数をインポート

/**
 * キャラクターに「いいね」を付与（POST）
 * @param request - NextRequestオブジェクト
 * @param context - ルートパラメータを含むコンテキスト
 * @returns - 作成されたいいね情報またはエラーメッセージ
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  // URLからキャラクターIDを取得
  const { id } = await context.params;
  const characterId = Number.parseInt(id ?? '', 10);

  // IDのバリデーション
  if (!Number.isFinite(characterId)) {
    return NextResponse.json({ error: '無効なキャラクターIDです。' }, { status: 400 });
  }

  // サーバーサイドでセッション情報を取得して認証を確認
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: '認証されていません。' }, { status: 401 });
  }
  const userId = Number.parseInt(String(session.user.id), 10);

  try {
    // 既にいいねしているか確認
    const existing = await prisma.favorites.findUnique({
      where: { user_id_character_id: { user_id: userId, character_id: characterId } },
    });

    // 既に存在する場合は、重複を避けるため何もしないで成功レスポンスを返す
    if (existing) {
      return NextResponse.json({ message: 'すでにいいね済みです。' }, { status: 200 });
    }

    // データベースにいいねを作成
    const created = await prisma.favorites.create({
      data: {
        user_id: userId,
        character_id: characterId,
      },
    });

    // ★ いいね通知を作成
    notifyOnFavorite(characterId, userId).catch(err => 
      console.error('通知作成エラー:', err)
    );

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error('いいね作成エラー:', error);
    return NextResponse.json({ error: 'いいねの作成に失敗しました。' }, { status: 500 });
  }
}


/**
 * キャラクターの「いいね」を解除（DELETE）
 * @param request - NextRequestオブジェクト
 * @param context - ルートパラメータを含むコンテキスト
 * @returns - 成功メッセージまたはエラーメッセージ
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  // URLからキャラクターIDを取得
  const { id } = await context.params;
  const characterId = Number.parseInt(id ?? '', 10);

  // IDのバリデーション
  if (!Number.isFinite(characterId)) {
    return NextResponse.json({ error: '無効なキャラクターIDです。' }, { status: 400 });
  }

  // サーバーサイドでセッション情報を取得して認証を確認
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: '認証されていません。' }, { status: 401 });
  }
  const userId = Number.parseInt(String(session.user.id), 10);

  try {
    // データベースからいいねを削除
    await prisma.favorites.delete({
      where: {
        user_id_character_id: {
          user_id: userId,
          character_id: characterId,
        },
      },
    });

    return NextResponse.json({ message: 'いいねを解除しました。' }, { status: 200 });
  } catch (error) {
    // 削除対象が見つからない場合もエラーになるが、クライアント側では成功として扱うため、
    // ここでは一般的なサーバーエラーのみを処理する。
    console.error('いいね解除エラー:', error);
    return NextResponse.json({ error: 'いいねの解除に失敗しました。' }, { status: 500 });
  }
}
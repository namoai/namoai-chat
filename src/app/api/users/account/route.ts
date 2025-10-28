import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/nextauth';
import { prisma } from '@/lib/prisma';

/**
 * アカウント削除API (会員退会)
 * DELETE /api/users/account
 * 
 * 現在ログイン中のユーザーのアカウントと関連データを削除します。
 * ※ キャラクターは保持され、作成者が匿名化されます。
 */
export async function DELETE() {
  try {
    // セッション確認
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: '認証されていません。' },
        { status: 401 }
      );
    }

    const userId = Number(session.user.id);

    // ユーザーが存在するか確認
    const user = await prisma.users.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'ユーザーが見つかりません。' },
        { status: 404 }
      );
    }

    // トランザクション内で関連データとユーザーを削除
    await prisma.$transaction(async (tx) => {
      // 1. ユーザーが作成したキャラクターの作成者を匿名化（キャラクターは残す）
      await tx.characters.updateMany({
        where: { author_id: userId },
        data: { author_id: null },
      });

      // 2. ユーザーのペルソナを削除
      await tx.personas.deleteMany({
        where: { authorId: userId },
      });

      // 3. ユーザーが作成したコメントを削除
      await tx.comments.deleteMany({
        where: { authorId: userId },
      });

      // 4. ユーザーのお気に入りを削除
      await tx.favorites.deleteMany({
        where: { user_id: userId },
      });

      // 5. ユーザーのフォロー関係を削除
      await tx.follows.deleteMany({
        where: {
          OR: [
            { followerId: userId },
            { followingId: userId },
          ],
        },
      });

      // 6. ユーザーのブロック関係を削除
      await tx.block.deleteMany({
        where: {
          OR: [
            { blockerId: userId },
            { blockingId: userId },
          ],
        },
      });

      // 7. ユーザーのインタラクションを削除
      await tx.interactions.deleteMany({
        where: { user_id: userId },
      });

      // 8. ユーザーのチャットメッセージとチャットルームを削除
      await tx.chat_message.deleteMany({
        where: {
          chat: {
            userId: userId,
          },
        },
      });

      await tx.chat.deleteMany({
        where: { userId: userId },
      });

      // 9. ユーザーのポイントを削除
      await tx.points.deleteMany({
        where: { user_id: userId },
      });

      // 10. NextAuth関連のセッションとアカウントを削除
      await tx.session.deleteMany({
        where: { userId: userId },
      });

      await tx.account.deleteMany({
        where: { userId: userId },
      });

      // 11. 最後にユーザー本体を削除（キャラクターは保持される）
      await tx.users.delete({
        where: { id: userId },
      });
    });

    // 削除成功
    return NextResponse.json(
      { 
        success: true,
        message: 'アカウントが正常に削除されました。キャラクターは引き続き公開されます。' 
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('アカウント削除エラー:', error);
    
    return NextResponse.json(
      { 
        error: 'アカウント削除中にエラーが発生しました。',
        details: error instanceof Error ? error.message : '不明なエラー'
      },
      { status: 500 }
    );
  }
}

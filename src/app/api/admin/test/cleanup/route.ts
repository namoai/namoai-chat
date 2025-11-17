import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/nextauth';
import { prisma } from '@/lib/prisma';
import { Role } from '@prisma/client';

/**
 * テストデータの一括削除API
 * DELETE /api/admin/test/cleanup
 * 
 * テスト用のユーザー、キャラクター、チャットルームをすべて削除します。
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

    // 管理者権限確認
    const userRole = session.user.role;
    if (userRole !== Role.SUPER_ADMIN && userRole !== Role.MODERATOR && userRole !== Role.CHAR_MANAGER) {
      return NextResponse.json(
        { error: 'この操作を実行する権限がありません。' },
        { status: 403 }
      );
    }

    // テスト用ユーザーを検索（メールアドレスまたはニックネームで判定）
    const testUsers = await prisma.users.findMany({
      where: {
        OR: [
          { email: { startsWith: 'test_' } },
          { email: { contains: '@test.com' } },
          { nickname: { startsWith: 'テストユーザー_' } },
        ],
      },
      select: {
        id: true,
        email: true,
        nickname: true,
      },
    });

    if (testUsers.length === 0) {
      return NextResponse.json({
        message: '削除するテストデータが見つかりませんでした。',
        deleted: {
          users: 0,
          characters: 0,
          chats: 0,
        },
      });
    }

    const testUserIds = testUsers.map(u => u.id);

    // テスト用キャラクターを検索（テスト用ユーザーが作成したもの + ハッシュタグに'テスト'を含むもの）
    const testCharacters = await prisma.characters.findMany({
      where: {
        OR: [
          { author_id: { in: testUserIds } },
          { hashtags: { has: 'テスト' } },
        ],
      },
      select: {
        id: true,
      },
    });

    const testCharacterIds = testCharacters.map(c => c.id);

    // テスト用チャットルームを検索（テスト用ユーザーが作成したもの）
    const testChats = await prisma.chat.findMany({
      where: {
        userId: { in: testUserIds },
      },
      select: {
        id: true,
      },
    });

    const testChatIds = testChats.map(c => c.id);

    // トランザクションで削除
    await prisma.$transaction(async (tx) => {
      // 1. テスト用チャットメッセージを削除
      if (testChatIds.length > 0) {
        await tx.chat_message.deleteMany({
          where: {
            chatId: { in: testChatIds },
          },
        });
      }

      // 2. テスト用チャットルームを削除
      if (testChatIds.length > 0) {
        await tx.chat.deleteMany({
          where: {
            id: { in: testChatIds },
          },
        });
      }

      // 3. テスト用キャラクター関連データを削除
      if (testCharacterIds.length > 0) {
        // キャラクターのコメントを削除
        await tx.comments.deleteMany({
          where: {
            characterId: { in: testCharacterIds },
          },
        });

        // キャラクターのお気に入りを削除
        await tx.favorites.deleteMany({
          where: {
            character_id: { in: testCharacterIds },
          },
        });

        // キャラクターの画像を削除（必要に応じて）
        // character_imagesはCASCADEで削除されるので明示的に削除不要

        // ロアブックを削除
        await tx.lorebooks.deleteMany({
          where: {
            characterId: { in: testCharacterIds },
          },
        });

        // 埋め込みを削除
        await tx.embeddings.deleteMany({
          where: {
            character_id: { in: testCharacterIds },
          },
        });

        // キャラクターを削除
        await tx.characters.deleteMany({
          where: {
            id: { in: testCharacterIds },
          },
        });
      }

      // 4. テスト用ユーザー関連データを削除
      if (testUserIds.length > 0) {
        // ユーザーのコメントを削除
        await tx.comments.deleteMany({
          where: {
            authorId: { in: testUserIds },
          },
        });

        // ユーザーのお気に入りを削除
        await tx.favorites.deleteMany({
          where: {
            user_id: { in: testUserIds },
          },
        });

        // ユーザーのペルソナを削除
        await tx.personas.deleteMany({
          where: {
            authorId: { in: testUserIds },
          },
        });

        // ユーザーのフォロー関係を削除
        await tx.follows.deleteMany({
          where: {
            OR: [
              { followerId: { in: testUserIds } },
              { followingId: { in: testUserIds } },
            ],
          },
        });

        // ユーザーのブロック関係を削除
        await tx.block.deleteMany({
          where: {
            OR: [
              { blockerId: { in: testUserIds } },
              { blockingId: { in: testUserIds } },
            ],
          },
        });

        // ユーザーのインタラクションを削除
        await tx.interactions.deleteMany({
          where: {
            user_id: { in: testUserIds },
          },
        });

        // ユーザーのポイントを削除
        await tx.points.deleteMany({
          where: {
            user_id: { in: testUserIds },
          },
        });

        // NextAuth関連のセッションとアカウントを削除
        await tx.session.deleteMany({
          where: {
            userId: { in: testUserIds },
          },
        });

        await tx.account.deleteMany({
          where: {
            userId: { in: testUserIds },
          },
        });

        // 通知を削除
        await tx.notifications.deleteMany({
          where: {
            OR: [
              { userId: { in: testUserIds } },
              { actorId: { in: testUserIds } },
            ],
          },
        });

        // ユーザーを削除
        await tx.users.deleteMany({
          where: {
            id: { in: testUserIds },
          },
        });
      }
    });

    return NextResponse.json({
      message: 'テストデータの削除が完了しました。',
      deleted: {
        users: testUsers.length,
        characters: testCharacterIds.length,
        chats: testChatIds.length,
      },
      details: {
        users: testUsers.map(u => ({ id: u.id, email: u.email, nickname: u.nickname })),
      },
    });
  } catch (error) {
    console.error('テストデータ削除エラー:', error);
    return NextResponse.json(
      { error: 'テストデータの削除に失敗しました。', details: error instanceof Error ? error.message : '不明なエラー' },
      { status: 500 }
    );
  }
}


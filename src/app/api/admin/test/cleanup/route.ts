export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/nextauth';
import { getPrisma } from '@/lib/prisma';
import { Role } from '@prisma/client';
import { isBuildTime, buildTimeResponse } from '@/lib/api-helpers';
import { ensureEnvVarsLoaded } from '@/lib/load-env-vars';

/**
 * テストデータの一括削除API
 * DELETE /api/admin/test/cleanup
 * 
 * テスト用のユーザー、キャラクター、チャットルームをすべて削除します。
 */
export async function DELETE() {
  if (isBuildTime()) return buildTimeResponse();
  
  try {
    // Lambda環境で環境変数をロード（リトライ機能付き）
    // Load environment variables in Lambda environment (with retry)
    await ensureEnvVarsLoaded();
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

    const prisma = await getPrisma();
    
    // テスト用ユーザーを検索（メールアドレスまたはニックネームで判定）
    // Search for test users (determined by email address or nickname)
    console.log('[cleanup] Searching for test users...');
    
    // より広範囲な検索条件を追加
    // Add broader search conditions
    const testUsers = await prisma.users.findMany({
      where: {
        OR: [
          { email: { startsWith: 'test_' } },
          { email: { contains: '@test.com' } },
          { email: { contains: 'test@' } }, // test@example.com 形式も含む
          { nickname: { startsWith: 'テストユーザー_' } },
          { nickname: { contains: 'テスト' } }, // より広範囲な検索
        ],
      },
      select: {
        id: true,
        email: true,
        nickname: true,
      },
    });

    console.log(`[cleanup] Found ${testUsers.length} test users:`, testUsers.map(u => ({ id: u.id, email: u.email, nickname: u.nickname })));

    if (testUsers.length === 0) {
      // デバッグ用: すべてのユーザーを確認（最初の10件）
      // Debug: Check all users (first 10)
      const allUsers = await prisma.users.findMany({
        take: 10,
        select: {
          id: true,
          email: true,
          nickname: true,
        },
        orderBy: {
          id: 'desc',
        },
      });
      console.log('[cleanup] Sample users in database (first 10):', allUsers);
      
      return NextResponse.json({
        message: '削除するテストデータが見つかりませんでした。',
        deleted: {
          users: 0,
          characters: 0,
          chats: 0,
        },
        debug: {
          sampleUsers: allUsers,
        },
      });
    }

    const testUserIds = testUsers.map(u => u.id);
    console.log(`[cleanup] Test user IDs: ${testUserIds.join(', ')}`);

    // テスト用キャラクターを検索（テスト用ユーザーが作成したもの + ハッシュタグに'テスト'を含むもの）
    // Search for test characters (created by test users + hashtags containing 'テスト')
    const testCharacters = await prisma.characters.findMany({
      where: {
        OR: [
          { author_id: { in: testUserIds } },
          { hashtags: { has: 'テスト' } },
          { hashtags: { has: 'test' } }, // 英語の'test'も含む
        ],
      },
      select: {
        id: true,
        name: true,
        author_id: true,
      },
    });

    console.log(`[cleanup] Found ${testCharacters.length} test characters:`, testCharacters.map(c => ({ id: c.id, name: c.name, author_id: c.author_id })));
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
    // Delete in transaction
    console.log('[cleanup] Starting deletion transaction...');
    const deletionResult = await prisma.$transaction(async (tx) => {
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

      // 3-追加. ハッシュタグが「テスト」を含む孤立キャラクターの削除
      await tx.characters.deleteMany({
        where: {
          hashtags: { has: 'テスト' },
          author_id: null,
        },
      });

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
      
      // 削除結果を返す
      // Return deletion result
      return {
        users: testUsers.length,
        characters: testCharacterIds.length,
        chats: testChatIds.length,
      };
    });

    console.log('[cleanup] Deletion transaction completed:', deletionResult);

    // 削除後の確認（デバッグ用）
    // Post-deletion verification (for debugging)
    const remainingTestUsers = await prisma.users.findMany({
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
      },
    });
    console.log(`[cleanup] Remaining test users after deletion: ${remainingTestUsers.length}`);

    return NextResponse.json({
      message: 'テストデータの削除が完了しました。',
      deleted: deletionResult,
      details: {
        users: testUsers.map(u => ({ id: u.id, email: u.email, nickname: u.nickname })),
      },
      verification: {
        remainingTestUsers: remainingTestUsers.length,
      },
    });
  } catch (error) {
    console.error('[cleanup] テストデータ削除エラー:', error);
    
    // エラーの詳細をログに記録
    // Log error details
    if (error instanceof Error) {
      console.error('[cleanup] Error name:', error.name);
      console.error('[cleanup] Error message:', error.message);
      console.error('[cleanup] Error stack:', error.stack);
      
      // Prismaエラーの場合は詳細情報を追加
      // Add details for Prisma errors
      if (error.message.includes('Prisma') || error.message.includes('database')) {
        console.error('[cleanup] Database connection error detected');
      }
    }
    
    return NextResponse.json(
      { 
        error: 'テストデータの削除に失敗しました。',
        details: error instanceof Error ? error.message : '不明なエラー',
        // 開発環境でのみスタックトレースを返す
        // Return stack trace only in development
        ...(process.env.NODE_ENV === 'development' && error instanceof Error ? { stack: error.stack } : {})
      },
      { status: 500 }
    );
  }
}


// いいね通知をテスト
import { PrismaClient } from '@prisma/client';
import { notifyOnFavorite } from '../src/lib/notifications.ts';

const prisma = new PrismaClient();

async function testFavoriteNotification() {
  try {
    console.log('🧪 いいね通知機能をテスト中...\n');

    // テスト用のユーザーとキャラクターを取得
    const character = await prisma.characters.findFirst({
      where: { author_id: { not: null } },
      select: {
        id: true,
        name: true,
        author_id: true,
        author: {
          select: { nickname: true }
        }
      }
    });

    if (!character) {
      console.log('❌ キャラクターが見つかりません');
      return;
    }

    // 作成者以外のユーザーを取得
    const otherUser = await prisma.users.findFirst({
      where: { 
        id: { not: character.author_id }
      },
      select: { id: true, nickname: true }
    });

    if (!otherUser) {
      console.log('❌ テストユーザーが見つかりません');
      return;
    }

    console.log(`📝 テストデータ:`);
    console.log(`   キャラクター: ${character.name} (ID: ${character.id})`);
    console.log(`   作成者: ${character.author?.nickname} (ID: ${character.author_id})`);
    console.log(`   いいねするユーザー: ${otherUser.nickname} (ID: ${otherUser.id})`);
    console.log('');

    // 通知関数を直接呼び出し
    console.log('🔔 notifyOnFavorite() を実行中...');
    const result = await notifyOnFavorite(character.id, otherUser.id);

    if (result) {
      console.log('✅ 通知が作成されました:');
      console.log(`   ID: ${result.id}`);
      console.log(`   タイトル: ${result.title}`);
      console.log(`   内容: ${result.content}`);
      console.log(`   リンク: ${result.link}`);
      console.log('');
      
      // データベースで確認
      const dbNotification = await prisma.notifications.findUnique({
        where: { id: result.id },
        include: {
          user: { select: { nickname: true } },
          actor: { select: { nickname: true } }
        }
      });
      
      console.log('📊 データベース確認:');
      console.log(`   受信者: ${dbNotification?.user?.nickname}`);
      console.log(`   送信者: ${dbNotification?.actor?.nickname}`);
      console.log(`   既読: ${dbNotification?.isRead}`);
      console.log('');
      console.log('🎉 通知関数は正常に動作しています！');
      console.log('');
      console.log('🔍 次のステップ: APIエンドポイントが通知関数を呼び出しているか確認');
      
    } else {
      console.log('❌ 通知が作成されませんでした');
      console.log('原因: notifyOnFavorite() が null を返しました');
    }

  } catch (error) {
    console.error('❌ エラー:', error);
    if (error.message) {
      console.error('   メッセージ:', error.message);
    }
    if (error.stack) {
      console.error('   スタック:', error.stack);
    }
  } finally {
    await prisma.$disconnect();
  }
}

testFavoriteNotification();


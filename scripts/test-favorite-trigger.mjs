// いいねを実際に作成して通知が生成されるかテスト
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testFavoriteTrigger() {
  try {
    console.log('🧪 いいねトリガーをテスト中...\n');

    // テスト用データを取得
    const character = await prisma.characters.findFirst({
      where: { author_id: { not: null } },
      select: {
        id: true,
        name: true,
        author_id: true,
        author: { select: { nickname: true } }
      }
    });

    const otherUser = await prisma.users.findFirst({
      where: { id: { not: character?.author_id } },
      select: { id: true, nickname: true }
    });

    if (!character || !otherUser) {
      console.log('❌ テストデータが不足しています');
      return;
    }

    console.log(`📝 テストデータ:`);
    console.log(`   キャラクター: ${character.name} (ID: ${character.id})`);
    console.log(`   作成者: ${character.author?.nickname} (ID: ${character.author_id})`);
    console.log(`   いいねするユーザー: ${otherUser.nickname} (ID: ${otherUser.id})`);
    console.log('');

    // 既存のお気に入りを削除
    await prisma.favorites.deleteMany({
      where: {
        user_id: otherUser.id,
        character_id: character.id
      }
    });

    console.log('🔄 既存のお気に入りを削除しました');
    
    // 通知数を確認
    const beforeCount = await prisma.notifications.count({
      where: { userId: character.author_id }
    });
    console.log(`📊 作成前の通知数: ${beforeCount}件\n`);

    // お気に入りを作成（APIと同じ処理）
    console.log('❤️ お気に入りを作成中...');
    const favorite = await prisma.favorites.create({
      data: {
        user_id: otherUser.id,
        character_id: character.id
      }
    });
    console.log(`✓ お気に入りが作成されました (ID: ${favorite.id})\n`);

    // ここで通知が作成されたか確認
    console.log('⏳ 通知が作成されるのを待っています...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    const afterCount = await prisma.notifications.count({
      where: { userId: character.author_id }
    });
    
    console.log(`📊 作成後の通知数: ${afterCount}件`);
    
    if (afterCount > beforeCount) {
      console.log('✅ 通知が正常に作成されました！');
      
      // 最新の通知を表示
      const latestNotif = await prisma.notifications.findFirst({
        where: { userId: character.author_id },
        orderBy: { createdAt: 'desc' },
        include: {
          actor: { select: { nickname: true } }
        }
      });
      
      if (latestNotif) {
        console.log('\n最新の通知:');
        console.log(`   タイプ: ${latestNotif.type}`);
        console.log(`   内容: ${latestNotif.content}`);
        console.log(`   送信者: ${latestNotif.actor?.nickname}`);
      }
    } else {
      console.log('❌ 通知が作成されませんでした！');
      console.log('\n🚨 問題: APIエンドポイントが通知関数を呼び出していません');
      console.log('原因: サーバーが古いコードをキャッシュしています');
      console.log('\n解決策:');
      console.log('1. サーバーを完全に停止 (Ctrl+C)');
      console.log('2. taskkill /F /IM node.exe');
      console.log('3. Remove-Item -Recurse -Force .next');
      console.log('4. npm run dev');
    }

  } catch (error) {
    console.error('❌ エラー:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testFavoriteTrigger();


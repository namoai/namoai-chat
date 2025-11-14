// ブロック機能をテスト
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testBlockFeature() {
  try {
    console.log('🧪 ブロック機能をテスト中...\n');

    // ユーザー1がユーザー4をブロック
    const blocker = 1; // 管理者
    const blocking = 4; // test2

    const users = await prisma.users.findMany({
      where: { id: { in: [blocker, blocking] } },
      select: { id: true, nickname: true }
    });

    console.log('📝 テストユーザー:');
    users.forEach(u => console.log(`   ${u.id}: ${u.nickname}`));
    console.log('');

    // 既存ブロックを削除
    await prisma.block.deleteMany({
      where: {
        blockerId: blocker,
        blockingId: blocking
      }
    });
    console.log('🔄 既存のブロックを削除しました\n');

    // ブロックを作成
    console.log('🚫 ブロックを作成中...');
    const block = await prisma.block.create({
      data: {
        blockerId: blocker,
        blockingId: blocking
      }
    });
    console.log('✅ ブロックが作成されました');
    console.log(`   ブロッカー: ${blocker}`);
    console.log(`   ブロック対象: ${blocking}`);
    console.log(`   作成日: ${block.createdAt}\n`);

    // ブロックリストを取得
    console.log('📋 ユーザー1のブロックリストを取得...');
    const blockedList = await prisma.block.findMany({
      where: { blockerId: blocker },
      include: {
        users_Block_blockingIdTousers: {
          select: { id: true, nickname: true, image_url: true }
        }
      }
    });

    console.log(`✅ ブロックリスト: ${blockedList.length}件`);
    blockedList.forEach((b, i) => {
      console.log(`   ${i + 1}. ${b.users_Block_blockingIdTousers?.nickname} (ID: ${b.blockingId})`);
    });

    console.log('\n🎯 API レスポンス形式:');
    const blockedUsers = blockedList.map(relation => relation.users_Block_blockingIdTousers);
    console.log(JSON.stringify({ blockedUsers }, null, 2));

  } catch (error) {
    console.error('❌ エラー:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testBlockFeature();


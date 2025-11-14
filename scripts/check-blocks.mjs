// ブロックデータを確認
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkBlocks() {
  try {
    console.log('🔍 ブロックテーブルを確認中...\n');

    // 全てのブロックを取得
    const allBlocks = await prisma.block.findMany({
      include: {
        users_Block_blockerIdTousers: {
          select: { id: true, nickname: true }
        },
        users_Block_blockingIdTousers: {
          select: { id: true, nickname: true }
        }
      }
    });

    console.log(`📊 ブロック総数: ${allBlocks.length}件\n`);

    if (allBlocks.length === 0) {
      console.log('ℹ️ ブロックが1件もありません');
    } else {
      console.log('✅ ブロックが見つかりました:\n');
      allBlocks.forEach((block, i) => {
        console.log(`${i + 1}. ${block.users_Block_blockerIdTousers?.nickname} → ${block.users_Block_blockingIdTousers?.nickname}`);
        console.log(`   ブロッカーID: ${block.blockerId}`);
        console.log(`   ブロック対象ID: ${block.blockingId}`);
        console.log(`   作成日: ${block.createdAt}`);
        console.log('');
      });
    }

    // ユーザー1のブロックリストを確認
    console.log('👤 ユーザー1（管理者）のブロックリスト:');
    const user1Blocks = await prisma.block.findMany({
      where: { blockerId: 1 },
      include: {
        users_Block_blockingIdTousers: {
          select: { id: true, nickname: true, image_url: true }
        }
      }
    });

    if (user1Blocks.length === 0) {
      console.log('   なし');
    } else {
      user1Blocks.forEach((block, i) => {
        console.log(`   ${i + 1}. ${block.users_Block_blockingIdTousers?.nickname} (ID: ${block.blockingId})`);
      });
    }

  } catch (error) {
    console.error('❌ エラーが発生しました:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkBlocks();


// リアルタイム通知のテスト - 手動で通知を作成
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function createTestNotification() {
  try {
    console.log('🧪 テスト通知を作成中...\n');

    // ユーザー1に通知を作成
    const notification = await prisma.notifications.create({
      data: {
        userId: 1,
        type: 'FOLLOW',
        title: 'テスト通知',
        content: 'これはリアルタイム通知のテストです。5秒以内に画面に表示されるはずです！',
        link: '/MyPage',
        isRead: false,
      },
    });

    console.log('✅ 通知が作成されました:');
    console.log(`   ID: ${notification.id}`);
    console.log(`   タイトル: ${notification.title}`);
    console.log(`   内容: ${notification.content}`);
    console.log(`   作成時刻: ${notification.createdAt}`);
    console.log('\n🔔 5秒以内にブラウザで赤いバッジが表示されるはずです！');
    console.log('   （ページを見ながら待ってください）');

  } catch (error) {
    console.error('❌ エラー:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestNotification();


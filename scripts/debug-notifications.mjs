// 通知デバッグ - 最新のアクティビティと通知を比較
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function debugNotifications() {
  try {
    console.log('🔍 通知システムをデバッグ中...\n');

    // 最新のお気に入り
    console.log('❤️ 最新のお気に入り (5件):');
    const latestFavorites = await prisma.favorites.findMany({
      orderBy: { created_at: 'desc' },
      take: 5,
      include: {
        users: { select: { nickname: true } },
        characters: { 
          select: { 
            name: true, 
            author_id: true,
            author: { select: { nickname: true } }
          } 
        }
      }
    });
    
    latestFavorites.forEach((fav, i) => {
      console.log(`${i + 1}. ${fav.users?.nickname} → ${fav.characters?.name}`);
      console.log(`   作成者: ${fav.characters?.author?.nickname} (ID: ${fav.characters?.author_id})`);
      console.log(`   作成日: ${fav.created_at}`);
    });
    console.log('');

    // 最新のコメント
    console.log('💬 最新のコメント (5件):');
    const latestComments = await prisma.comments.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: {
        users: { select: { nickname: true } },
        characters: { 
          select: { 
            name: true, 
            author_id: true,
            author: { select: { nickname: true } }
          } 
        }
      }
    });
    
    latestComments.forEach((comment, i) => {
      console.log(`${i + 1}. ${comment.users?.nickname} → ${comment.characters?.name}`);
      console.log(`   作成者: ${comment.characters?.author?.nickname} (ID: ${comment.characters?.author_id})`);
      console.log(`   作成日: ${comment.createdAt}`);
    });
    console.log('');

    // 最新のフォロー
    console.log('👥 最新のフォロー (5件):');
    const latestFollows = await prisma.follows.findMany({
      take: 5,
      include: {
        follower: { select: { nickname: true } },
        following: { select: { nickname: true } }
      }
    });
    
    latestFollows.forEach((follow, i) => {
      console.log(`${i + 1}. ${follow.follower?.nickname} → ${follow.following?.nickname}`);
      console.log(`   フォロワーID: ${follow.followerId}, フォロー先ID: ${follow.followingId}`);
    });
    console.log('');

    // 全ての通知
    console.log('🔔 全ての通知 (最新10件):');
    const allNotifications = await prisma.notifications.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        user: { select: { nickname: true } },
        actor: { select: { nickname: true } }
      }
    });

    if (allNotifications.length === 0) {
      console.log('❌ 通知が1件も作成されていません！');
      console.log('\n🚨 問題: 通知トリガーが実行されていません');
      console.log('原因: サーバーが古いコードをキャッシュしている可能性');
    } else {
      allNotifications.forEach((notif, i) => {
        console.log(`${i + 1}. [${notif.type}] ${notif.user?.nickname} ← ${notif.actor?.nickname || 'システム'}`);
        console.log(`   ${notif.content}`);
        console.log(`   作成日: ${notif.createdAt}`);
      });
    }

    console.log('\n📊 統計:');
    console.log(`お気に入り: ${await prisma.favorites.count()}件`);
    console.log(`コメント: ${await prisma.comments.count()}件`);
    console.log(`フォロー: ${await prisma.follows.count()}件`);
    console.log(`通知: ${allNotifications.length}件`);

    console.log('\n💡 期待される通知数: 最低でも ' + 
      (latestFavorites.filter(f => f.characters?.author_id !== f.user_id).length +
       latestComments.filter(c => c.characters?.author_id !== c.authorId).length +
       latestFollows.filter(f => f.followerId !== f.followingId).length) + '件');

  } catch (error) {
    console.error('❌ エラー:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugNotifications();


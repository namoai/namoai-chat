require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');

async function main() {
  console.log('📁 環境変数を読み込みました');
  console.log('DATABASE_URL:', process.env.DATABASE_URL ? '設定済み' : '未設定');
  console.log('IT_DATABASE_URL:', process.env.IT_DATABASE_URL ? '設定済み' : '未設定');
  
  const prisma = new PrismaClient();
  
  try {
    console.log('🔧 データベース修正を開始します...\n');
    
    // 1. Accountテーブルのシーケンスをリセット
    console.log('1. Accountテーブルのシーケンスをリセット中...');
    await prisma.$executeRawUnsafe(`
      SELECT setval(pg_get_serial_sequence('"Account"', 'id'), COALESCE((SELECT MAX(id) FROM "Account"), 0) + 1, false);
    `);
    console.log('✅ シーケンスのリセット完了\n');
    
    // 2. admin@admin.co.jp のメール認証を完了
    console.log('2. admin@admin.co.jp のメール認証を完了中...');
    const result = await prisma.users.updateMany({
      where: { email: 'admin@admin.co.jp' },
      data: { emailVerified: new Date() }
    });
    console.log(`✅ ${result.count} 件のユーザーを更新\n`);
    
    // 3. 確認
    console.log('3. ユーザー情報を確認中...');
    const users = await prisma.users.findMany({
      where: {
        email: {
          in: ['admin@admin.co.jp', 'namoai.namos@gmail.com', 'sc9985@naver.com']
        }
      },
      select: {
        id: true,
        email: true,
        role: true,
        emailVerified: true
      }
    });
    
    console.log('\n📊 ユーザー一覧:');
    console.table(users);
    
    console.log('\n✅ すべての修正が完了しました！');
  } catch (error) {
    console.error('❌ エラーが発生しました:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });


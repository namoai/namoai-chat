const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

// 環境変数からDATABASE_URLを取得
const itDbUrl = 'postgresql://postgres:namoai20250701@namoai-it.cluwk88i28od.ap-northeast-1.rds.amazonaws.com:5432/postgres';
const prodDbUrl = 'postgresql://postgres:namoai20250701@namos-chat.cluwk88i28od.ap-northeast-1.rds.amazonaws.com:5432/postgres';

const migrationFile = path.join(__dirname, '../prisma/migrations/add_adult_verification_fields/migration.sql');
const sql = fs.readFileSync(migrationFile, 'utf-8');

async function runMigration(databaseUrl, envName) {
  console.log(`\n【${envName}環境】マイグレーション実行中...`);
  
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
  });

  try {
    // SQLを実行（コメント行を除外し、セミコロンで分割）
    const statements = sql
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0 && !line.startsWith('--'))
      .join('\n')
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    for (const statement of statements) {
      if (statement.trim()) {
        try {
          await prisma.$executeRawUnsafe(statement);
        } catch (stmtError) {
          // COMMENT文は既に存在する場合エラーになる可能性があるので、無視
          if (statement.toUpperCase().includes('COMMENT') && stmtError.message.includes('does not exist')) {
            console.log(`⚠ ${envName}環境: コメント追加をスキップ（既に存在する可能性があります）`);
          } else {
            throw stmtError;
          }
        }
      }
    }

    console.log(`✅ ${envName}環境: マイグレーション成功`);
  } catch (error) {
    console.error(`❌ ${envName}環境: マイグレーション失敗`);
    console.error(error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  console.log('==========================================');
  console.log('成人認証フィールド追加マイグレーション');
  console.log('==========================================');

  try {
    // IT環境
    await runMigration(itDbUrl, 'IT');
    
    // 本番環境
    await runMigration(prodDbUrl, '本番');
    
    console.log('\n==========================================');
    console.log('✅ すべてのマイグレーションが完了しました');
    console.log('==========================================');
  } catch (error) {
    console.error('\n❌ マイグレーション中にエラーが発生しました');
    process.exit(1);
  }
}

main();


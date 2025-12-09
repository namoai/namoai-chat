// scripts/migrate-payments-to-db.mjs
// paymentsテーブルを2つのデータベースに追加するスクリプト

// AWS RDSの自己署名証明書を許可（開発環境のみ）
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pg from 'pg';

const { Client } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// データベース接続情報
const databases = [
  {
    name: 'namos-chat',
    url: 'postgresql://postgres:namoai20250701@namos-chat.cluwk88i28od.ap-northeast-1.rds.amazonaws.com:5432/postgres?sslmode=require'
  },
  {
    name: 'namoai-it',
    url: 'postgresql://postgres:namoai20250701@namoai-it.cluwk88i28od.ap-northeast-1.rds.amazonaws.com:5432/postgres?sslmode=require'
  }
];

// SQLファイルを読み込む
const sqlFile = join(__dirname, '..', 'prisma', 'migrations', 'add_payments_table.sql');
const sql = readFileSync(sqlFile, 'utf-8');

async function migrateDatabase(dbConfig) {
  // SSL接続設定（AWS RDS用）
  const url = new URL(dbConfig.url);
  url.searchParams.set('sslmode', 'require');
  
  const client = new Client({
    connectionString: url.toString(),
    ssl: {
      rejectUnauthorized: false,
      require: true
    }
  });

  try {
    console.log(`\n📦 ${dbConfig.name} データベースに接続中...`);
    await client.connect();
    console.log(`✅ ${dbConfig.name} に接続成功`);

    console.log(`🔄 paymentsテーブルを作成中...`);
    await client.query(sql);
    console.log(`✅ ${dbConfig.name} のpaymentsテーブル作成完了`);

    // テーブルが正しく作成されたか確認
    const result = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'payments'
      );
    `);

    if (result.rows[0].exists) {
      console.log(`✅ ${dbConfig.name} のpaymentsテーブルが存在することを確認`);
    } else {
      console.error(`❌ ${dbConfig.name} のpaymentsテーブルが見つかりません`);
    }

  } catch (error) {
    console.error(`❌ ${dbConfig.name} でのエラー:`, error.message);
    if (error.message.includes('already exists')) {
      console.log(`ℹ️  ${dbConfig.name} のpaymentsテーブルは既に存在します`);
    } else {
      throw error;
    }
  } finally {
    await client.end();
  }
}

async function main() {
  console.log('🚀 paymentsテーブルのマイグレーションを開始します...\n');

  for (const db of databases) {
    try {
      await migrateDatabase(db);
    } catch (error) {
      console.error(`❌ ${db.name} のマイグレーションに失敗:`, error);
      process.exit(1);
    }
  }

  console.log('\n✅ すべてのデータベースへのマイグレーションが完了しました！');
}

main().catch((error) => {
  console.error('❌ マイグレーションエラー:', error);
  process.exit(1);
});


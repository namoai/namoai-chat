#!/usr/bin/env node

/**
 * 既存のポイントデータを新しいトランザクションシステムに移行するスクリプト
 * 
 * 実行方法:
 * node scripts/migrate-existing-points.mjs
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migrateExistingPoints() {
  console.log('🚀 ポイントデータ移行を開始します...\n');

  try {
    // 既にマイグレーション済みかチェック
    const existingMigrations = await prisma.point_transactions.findFirst({
      where: { source: 'migration' },
    });

    if (existingMigrations) {
      console.log('⚠️  既にマイグレーションが実行されています。');
      console.log('⚠️  重複を防ぐため、スクリプトを終了します。\n');
      console.log('💡 もし再度マイグレーションが必要な場合は、先にmigrationソースのレコードを削除してください。\n');
      return;
    }

    // 既存のポイントレコードを取得
    const existingPoints = await prisma.points.findMany({
      where: {
        OR: [
          { free_points: { gt: 0 } },
          { paid_points: { gt: 0 } },
        ],
      },
    });

    console.log(`📊 移行対象: ${existingPoints.length} ユーザー\n`);

    let migratedFree = 0;
    let migratedPaid = 0;
    let successCount = 0;
    let errorCount = 0;

    for (const userPoint of existingPoints) {
      try {
        await prisma.$transaction(async (tx) => {
          const now = new Date();
          const expiresAt = new Date(now);
          expiresAt.setFullYear(expiresAt.getFullYear() + 1); // 1年後に失効

          // 無料ポイントの移行
          if (userPoint.free_points > 0) {
            await tx.point_transactions.create({
              data: {
                user_id: userPoint.user_id,
                type: 'free',
                amount: userPoint.free_points,
                balance: userPoint.free_points,
                source: 'migration',
                description: '既存ポイントデータからの移行',
                acquired_at: userPoint.updated_at || now,
                expires_at: expiresAt,
              },
            });
            migratedFree += userPoint.free_points;
          }

          // 有料ポイントの移行
          if (userPoint.paid_points > 0) {
            await tx.point_transactions.create({
              data: {
                user_id: userPoint.user_id,
                type: 'paid',
                amount: userPoint.paid_points,
                balance: userPoint.paid_points,
                source: 'migration',
                description: '既存ポイントデータからの移行',
                acquired_at: userPoint.updated_at || now,
                expires_at: expiresAt,
              },
            });
            migratedPaid += userPoint.paid_points;
          }
        });

        successCount++;
        console.log(`✅ ユーザーID ${userPoint.user_id}: 無料 ${userPoint.free_points}P, 有料 ${userPoint.paid_points}P を移行しました`);
      } catch (error) {
        errorCount++;
        console.error(`❌ ユーザーID ${userPoint.user_id} の移行に失敗:`, error.message);
      }
    }

    console.log('\n📈 移行結果:');
    console.log(`   成功: ${successCount} ユーザー`);
    console.log(`   失敗: ${errorCount} ユーザー`);
    console.log(`   無料ポイント合計: ${migratedFree.toLocaleString()} P`);
    console.log(`   有料ポイント合計: ${migratedPaid.toLocaleString()} P`);
    console.log(`   合計: ${(migratedFree + migratedPaid).toLocaleString()} P\n`);

    // 検証: 移行後のデータと既存データが一致するか確認
    console.log('🔍 データ整合性を検証しています...\n');

    const verificationErrors = [];

    for (const userPoint of existingPoints) {
      // 移行後のトランザクション合計を計算
      const transactions = await prisma.point_transactions.findMany({
        where: {
          user_id: userPoint.user_id,
          source: 'migration',
        },
      });

      const migratedFreeSum = transactions
        .filter(t => t.type === 'free')
        .reduce((sum, t) => sum + t.balance, 0);

      const migratedPaidSum = transactions
        .filter(t => t.type === 'paid')
        .reduce((sum, t) => sum + t.balance, 0);

      // 既存のポイント残高と比較
      if (migratedFreeSum !== userPoint.free_points || migratedPaidSum !== userPoint.paid_points) {
        verificationErrors.push({
          userId: userPoint.user_id,
          expected: { free: userPoint.free_points, paid: userPoint.paid_points },
          actual: { free: migratedFreeSum, paid: migratedPaidSum },
        });
      }
    }

    if (verificationErrors.length === 0) {
      console.log('✅ データ整合性チェック: すべてのユーザーで一致しました\n');
    } else {
      console.log(`⚠️  警告: ${verificationErrors.length} ユーザーでデータ不一致が検出されました:\n`);
      verificationErrors.forEach(err => {
        console.log(`   ユーザーID ${err.userId}:`);
        console.log(`     期待値: 無料 ${err.expected.free}P, 有料 ${err.expected.paid}P`);
        console.log(`     実際値: 無料 ${err.actual.free}P, 有料 ${err.actual.paid}P`);
      });
      console.log('');
    }

    console.log('✨ ポイントデータ移行が完了しました！\n');

    console.log('📝 次のステップ:');
    console.log('   1. データベースのマイグレーションを実行: npx prisma migrate deploy');
    console.log('   2. 新しいポイントシステムをテスト');
    console.log('   3. 問題がなければ本番環境にデプロイ\n');
  } catch (error) {
    console.error('❌ 移行処理中にエラーが発生しました:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// スクリプト実行
migrateExistingPoints();


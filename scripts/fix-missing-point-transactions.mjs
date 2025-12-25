#!/usr/bin/env node

/**
 * completed 상태인 payments 중에서 point_transactions에 레코드가 없는 경우를 복구하는 스크립트
 * 
 * 실행 방법:
 * node scripts/fix-missing-point-transactions.mjs
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixMissingPointTransactions() {
  console.log('🔧 不足しているポイントトランザクションを修復します...\n');

  try {
    // completed 상태인 payments 중에서 point_transactions에 레코드가 없는 것 찾기
    const completedPayments = await prisma.payments.findMany({
      where: {
        status: 'completed',
      },
      include: {
        users: {
          select: {
            email: true,
          },
        },
      },
    });

    console.log(`📊 確認対象: ${completedPayments.length} 件の決済\n`);

    let fixedCount = 0;
    let alreadyExistsCount = 0;
    let errorCount = 0;

    for (const payment of completedPayments) {
      try {
        // 해당 payment_id로 point_transactions가 이미 있는지 확인
        const existingTransaction = await prisma.point_transactions.findFirst({
          where: {
            payment_id: payment.id,
          },
        });

        if (existingTransaction) {
          alreadyExistsCount++;
          continue;
        }

        // grantPoints를 사용하여 포인트 추가
        // TypeScript 파일을 직접 import할 수 없으므로, point_transactions를 직접 생성
        const acquiredAt = payment.completed_at || payment.created_at;
        const expiresAt = new Date(acquiredAt);
        expiresAt.setFullYear(expiresAt.getFullYear() + 1); // 1 year expiration

        await prisma.$transaction(async (tx) => {
          // Create transaction record
          await tx.point_transactions.create({
            data: {
              user_id: payment.user_id,
              type: 'paid',
              amount: payment.points,
              balance: payment.points, // Initially, balance = amount
              source: 'purchase',
              description: `ポイント購入 - ¥${payment.amount.toLocaleString()}`,
              payment_id: payment.id,
              acquired_at: acquiredAt,
              expires_at: expiresAt,
            },
          });

          // Update points summary table for quick reference
          await tx.points.upsert({
            where: { user_id: payment.user_id },
            create: {
              user_id: payment.user_id,
              paid_points: payment.points,
            },
            update: {
              paid_points: { increment: payment.points },
            },
          });
        });

        console.log(`✅ 修復完了: Payment ID ${payment.id}, User ID ${payment.user_id} (${payment.users.email}), Points ${payment.points}`);
        fixedCount++;

      } catch (error) {
        console.error(`❌ エラー: Payment ID ${payment.id}, User ID ${payment.user_id} - ${error.message}`);
        errorCount++;
      }
    }

    console.log('\n📊 修復結果:');
    console.log(`   - 修復済み: ${fixedCount} 件`);
    console.log(`   - 既に存在: ${alreadyExistsCount} 件`);
    console.log(`   - エラー: ${errorCount} 件`);
    console.log(`   - 合計: ${completedPayments.length} 件\n`);

  } catch (error) {
    console.error('❌ スクリプト実行エラー:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

fixMissingPointTransactions();


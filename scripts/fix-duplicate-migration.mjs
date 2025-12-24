#!/usr/bin/env node

/**
 * 중복된 마이그레이션 데이터를 정리하는 스크립트
 * migration source의 중복 레코드를 제거하고 최초 마이그레이션만 유지
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixDuplicateMigration() {
  console.log('🔧 중복 마이그레이션 데이터 정리를 시작합니다...\n');

  try {
    // 모든 사용자의 migration 트랜잭션을 확인
    const users = await prisma.point_transactions.findMany({
      where: {
        source: 'migration',
      },
      select: {
        user_id: true,
      },
      distinct: ['user_id'],
    });

    console.log(`📊 확인 대상: ${users.length} 명의 사용자\n`);

    let fixedUsers = 0;
    let totalDeletedRecords = 0;
    let totalCorrectedPoints = { free: 0, paid: 0 };

    for (const { user_id } of users) {
      await prisma.$transaction(async (tx) => {
        // 해당 사용자의 migration 트랜잭션을 모두 가져옴
        const migrations = await tx.point_transactions.findMany({
          where: {
            user_id,
            source: 'migration',
          },
          orderBy: {
            created_at: 'asc', // 가장 오래된 것이 원본
          },
        });

        // 타입별로 그룹화
        const freeTransactions = migrations.filter(t => t.type === 'free');
        const paidTransactions = migrations.filter(t => t.type === 'paid');

        let deletedCount = 0;

        // 무료 포인트: 첫 번째만 유지, 나머지 삭제
        if (freeTransactions.length > 1) {
          const toDelete = freeTransactions.slice(1).map(t => t.id);
          await tx.point_transactions.deleteMany({
            where: { id: { in: toDelete } },
          });
          deletedCount += toDelete.length;
          console.log(`   - 무료 포인트: ${toDelete.length}개 중복 레코드 삭제`);
        }

        // 유료 포인트: 첫 번째만 유지, 나머지 삭제
        if (paidTransactions.length > 1) {
          const toDelete = paidTransactions.slice(1).map(t => t.id);
          await tx.point_transactions.deleteMany({
            where: { id: { in: toDelete } },
          });
          deletedCount += toDelete.length;
          console.log(`   - 유료 포인트: ${toDelete.length}개 중복 레코드 삭제`);
        }

        if (deletedCount > 0) {
          // 올바른 잔액 계산
          const correctFree = freeTransactions[0]?.balance || 0;
          const correctPaid = paidTransactions[0]?.balance || 0;

          // points 테이블 수정
          await tx.points.update({
            where: { user_id },
            data: {
              free_points: correctFree,
              paid_points: correctPaid,
            },
          });

          console.log(`✅ 사용자 ID ${user_id}: ${deletedCount}개 중복 삭제, 포인트 복구 (무료: ${correctFree}P, 유료: ${correctPaid}P)\n`);
          
          fixedUsers++;
          totalDeletedRecords += deletedCount;
          totalCorrectedPoints.free += correctFree;
          totalCorrectedPoints.paid += correctPaid;
        }
      });
    }

    console.log('\n📈 정리 결과:');
    console.log(`   수정된 사용자: ${fixedUsers}명`);
    console.log(`   삭제된 중복 레코드: ${totalDeletedRecords}개`);
    console.log(`   복구된 무료 포인트 합계: ${totalCorrectedPoints.free.toLocaleString()} P`);
    console.log(`   복구된 유료 포인트 합계: ${totalCorrectedPoints.paid.toLocaleString()} P`);
    console.log(`   총 복구 포인트: ${(totalCorrectedPoints.free + totalCorrectedPoints.paid).toLocaleString()} P\n`);

    console.log('✨ 중복 데이터 정리가 완료되었습니다!\n');

  } catch (error) {
    console.error('❌ 정리 처리중 에러 발생:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// 스크립트 실행
fixDuplicateMigration();


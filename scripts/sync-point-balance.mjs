/**
 * 포인트 잔액 동기화 스크립트
 * points 테이블의 값을 point_transactions에서 계산한 실제 잔액으로 동기화합니다.
 * 차이를 point_transactions에 기록하여 이력에 남깁니다.
 */

import { PrismaClient } from '@prisma/client';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

// .env.local 파일 로드
function loadEnvLocal() {
  const envLocalPath = join(rootDir, '.env.local');
  if (existsSync(envLocalPath)) {
    const content = readFileSync(envLocalPath, 'utf-8');
    const lines = content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0) {
          const value = valueParts.join('=').trim();
          // 따옴표 제거
          const cleanValue = value.replace(/^["']|["']$/g, '');
          if (!process.env[key.trim()]) {
            process.env[key.trim()] = cleanValue;
          }
        }
      }
    }
  }
}

// 환경 변수 로드
loadEnvLocal();

const prisma = new PrismaClient();

async function syncPointBalance() {
  try {
    console.log('🔄 포인트 잔액 동기화를 시작합니다...\n');

    // 모든 사용자의 포인트 정보 가져오기
    const allUsers = await prisma.points.findMany({
      include: {
        users: {
          select: {
            id: true,
            email: true,
            nickname: true,
          },
        },
      },
    });

    console.log(`📊 총 ${allUsers.length}명의 사용자를 확인합니다...\n`);

    let syncedCount = 0;
    let inconsistentCount = 0;
    const inconsistencies = [];

    for (const userPoint of allUsers) {
      const userId = userPoint.user_id;
      
      // point_transactions에서 실제 잔액 계산
      const now = new Date();
      const transactions = await prisma.point_transactions.findMany({
        where: {
          user_id: userId,
          balance: { gt: 0 },
          expires_at: { gt: now },
        },
      });

      const actualFreePoints = transactions
        .filter(t => t.type === 'free')
        .reduce((sum, t) => sum + t.balance, 0);

      const actualPaidPoints = transactions
        .filter(t => t.type === 'paid')
        .reduce((sum, t) => sum + t.balance, 0);

      const actualTotalPoints = actualFreePoints + actualPaidPoints;

      // points 테이블의 값과 비교
      const storedFreePoints = userPoint.free_points || 0;
      const storedPaidPoints = userPoint.paid_points || 0;
      const storedTotalPoints = storedFreePoints + storedPaidPoints;

      // 불일치 확인
      const isInconsistent = 
        storedFreePoints !== actualFreePoints ||
        storedPaidPoints !== actualPaidPoints;

      if (isInconsistent) {
        inconsistentCount++;
        inconsistencies.push({
          userId,
          email: userPoint.users?.email || 'N/A',
          nickname: userPoint.users?.nickname || 'N/A',
          stored: {
            free: storedFreePoints,
            paid: storedPaidPoints,
            total: storedTotalPoints,
          },
          actual: {
            free: actualFreePoints,
            paid: actualPaidPoints,
            total: actualTotalPoints,
          },
        });

        // 차이 계산
        const freeDiff = actualFreePoints - storedFreePoints;
        const paidDiff = actualPaidPoints - storedPaidPoints;
        const now = new Date();
        const expiresAt = new Date(now);
        expiresAt.setFullYear(expiresAt.getFullYear() + 1); // 1년 후 만료

        // 트랜잭션으로 처리
        await prisma.$transaction(async (tx) => {
          // points 테이블 업데이트
          await tx.points.update({
            where: { user_id: userId },
            data: {
              free_points: actualFreePoints,
              paid_points: actualPaidPoints,
            },
          });

          // ✅ 차이를 이력에 기록 (오류에 대한 추가/차감)
          // 무료 포인트 차이가 있으면 기록
          if (freeDiff !== 0) {
            if (freeDiff > 0) {
              // 추가: 저장된 값보다 실제 값이 더 큰 경우
              await tx.point_transactions.create({
                data: {
                  user_id: userId,
                  type: 'free',
                  amount: freeDiff,
                  balance: freeDiff,
                  source: 'admin_grant',
                  description: `포인트 잔액 동기화 (오류 수정: ${storedFreePoints}P → ${actualFreePoints}P, +${freeDiff}P 추가)`,
                  acquired_at: now,
                  expires_at: expiresAt,
                },
              });
            } else {
              // 차감: 저장된 값보다 실제 값이 더 작은 경우
              // consumePoints를 사용하거나, 음수 트랜잭션을 기록
              // 실제로는 point_transactions의 balance를 조정해야 하지만,
              // 동기화 목적이므로 차감 기록을 남기기 위해 별도 트랜잭션 생성
              // (실제 포인트는 이미 point_transactions에 반영되어 있으므로, 기록만 남김)
              await tx.point_transactions.create({
                data: {
                  user_id: userId,
                  type: 'free',
                  amount: Math.abs(freeDiff),
                  balance: 0, // 차감이므로 balance는 0
                  source: 'admin_grant',
                  description: `포인트 잔액 동기화 (오류 수정: ${storedFreePoints}P → ${actualFreePoints}P, ${freeDiff}P 차감)`,
                  acquired_at: now,
                  expires_at: expiresAt,
                },
              });
            }
          }

          // 유료 포인트 차이가 있으면 기록
          if (paidDiff !== 0) {
            if (paidDiff > 0) {
              // 추가
              await tx.point_transactions.create({
                data: {
                  user_id: userId,
                  type: 'paid',
                  amount: paidDiff,
                  balance: paidDiff,
                  source: 'admin_grant',
                  description: `포인트 잔액 동기화 (오류 수정: ${storedPaidPoints}P → ${actualPaidPoints}P, +${paidDiff}P 추가)`,
                  acquired_at: now,
                  expires_at: expiresAt,
                },
              });
            } else {
              // 차감
              await tx.point_transactions.create({
                data: {
                  user_id: userId,
                  type: 'paid',
                  amount: Math.abs(paidDiff),
                  balance: 0, // 차감이므로 balance는 0
                  source: 'admin_grant',
                  description: `포인트 잔액 동기화 (오류 수정: ${storedPaidPoints}P → ${actualPaidPoints}P, ${paidDiff}P 차감)`,
                  acquired_at: now,
                  expires_at: expiresAt,
                },
              });
            }
          }
        });

        console.log(`✅ 동기화 완료: User ID ${userId} (${userPoint.users?.email || 'N/A'})`);
        console.log(`   저장된 값: 무료 ${storedFreePoints.toLocaleString()}P, 유료 ${storedPaidPoints.toLocaleString()}P (합계: ${storedTotalPoints.toLocaleString()}P)`);
        console.log(`   실제 값: 무료 ${actualFreePoints.toLocaleString()}P, 유료 ${actualPaidPoints.toLocaleString()}P (합계: ${actualTotalPoints.toLocaleString()}P)`);
        console.log(`   차이: 무료 ${(actualFreePoints - storedFreePoints).toLocaleString()}P, 유료 ${(actualPaidPoints - storedPaidPoints).toLocaleString()}P\n`);
      } else {
        syncedCount++;
      }
    }

    console.log('\n📈 동기화 결과:');
    console.log(`   일치한 계정: ${syncedCount}명`);
    console.log(`   불일치 계정 (수정됨): ${inconsistentCount}명`);
    console.log(`   총 확인 계정: ${allUsers.length}명\n`);

    if (inconsistencies.length > 0) {
      console.log('📋 불일치 계정 상세:');
      inconsistencies.forEach((item, index) => {
        console.log(`\n${index + 1}. User ID: ${item.userId}`);
        console.log(`   이메일: ${item.email}`);
        console.log(`   닉네임: ${item.nickname}`);
        console.log(`   저장된 값: 무료 ${item.stored.free.toLocaleString()}P, 유료 ${item.stored.paid.toLocaleString()}P (합계: ${item.stored.total.toLocaleString()}P)`);
        console.log(`   실제 값: 무료 ${item.actual.free.toLocaleString()}P, 유료 ${item.actual.paid.toLocaleString()}P (합계: ${item.actual.total.toLocaleString()}P)`);
        console.log(`   차이: 무료 ${(item.actual.free - item.stored.free).toLocaleString()}P, 유료 ${(item.actual.paid - item.stored.paid).toLocaleString()}P`);
      });
      console.log('\n');
    }

    console.log('✨ 포인트 잔액 동기화가 완료되었습니다!\n');

  } catch (error) {
    console.error('❌ 동기화 처리 중 에러 발생:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// 스크립트 실행
syncPointBalance();


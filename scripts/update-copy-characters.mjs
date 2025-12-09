#!/usr/bin/env node

/**
 * IT 환경에서 "コピー"가 포함된 캐릭터 이름을 "テスト用"으로 변경하는 스크립트
 * 
 * 사용법:
 *   APP_ENV=integration node scripts/update-copy-characters.mjs
 *   또는
 *   IT_DATABASE_URL=... node scripts/update-copy-characters.mjs
 */

import { PrismaClient } from '@prisma/client';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

// .env 파일 로드
function loadEnvFile(filePath) {
  if (existsSync(filePath)) {
    const content = readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
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

loadEnvFile(resolve(process.cwd(), '.env.local'));
loadEnvFile(resolve(process.cwd(), '.env'));

// IT 환경으로 설정
process.env.APP_ENV = 'integration';

// IT_DATABASE_URL이 있으면 DATABASE_URL로 설정
if (process.env.IT_DATABASE_URL && !process.env.DATABASE_URL) {
  process.env.DATABASE_URL = process.env.IT_DATABASE_URL;
  console.log('✅ IT_DATABASE_URL을 DATABASE_URL로 설정했습니다.');
}

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL 또는 IT_DATABASE_URL 환경 변수가 필요합니다.');
  process.exit(1);
}

const prisma = new PrismaClient();

async function updateCopyCharacters() {
  try {
    console.log('🔍 "コピー"가 포함된 캐릭터를 검색 중...');
    
    // "コピー"가 포함된 모든 캐릭터 조회
    const charactersWithCopy = await prisma.characters.findMany({
      where: {
        name: {
          contains: 'コピー',
        },
      },
      select: {
        id: true,
        name: true,
      },
    });

    console.log(`\n📋 발견된 캐릭터 수: ${charactersWithCopy.length}`);
    
    if (charactersWithCopy.length === 0) {
      console.log('✅ 변경할 캐릭터가 없습니다.');
      return;
    }

    // 조회된 캐릭터 목록 출력
    console.log('\n📝 변경 대상 캐릭터:');
    charactersWithCopy.forEach((char) => {
      console.log(`  - ID: ${char.id}, 이름: ${char.name}`);
    });

    // 확인 후 업데이트
    console.log('\n🔄 이름을 "テスト用"으로 변경 중...');
    
    let updatedCount = 0;
    for (const char of charactersWithCopy) {
      await prisma.characters.update({
        where: { id: char.id },
        data: { name: 'テスト用' },
      });
      updatedCount++;
      console.log(`  ✅ ID ${char.id}: "${char.name}" → "テスト用"`);
    }

    console.log(`\n✨ 완료! 총 ${updatedCount}개의 캐릭터 이름이 변경되었습니다.`);
    
  } catch (error) {
    console.error('❌ 오류 발생:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

updateCopyCharacters();


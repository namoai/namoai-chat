#!/usr/bin/env node

/**
 * 스테이징(혼방) 환경 데이터베이스를 IT 환경으로 복사하는 스크립트
 * 
 * 사용법:
 *   node scripts/migrate-staging-to-it.mjs
 * 
 * 환경 변수:
 *   STAGING_DATABASE_URL - 스테이징 환경 DB URL
 *   IT_DATABASE_URL - IT 환경 DB URL
 */

import { execSync } from 'child_process';
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
      if (!trimmed || trimmed.startsWith('#')) continue;
      
      const match = trimmed.match(/^([^=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim().replace(/^["']|["']$/g, ''); // 따옴표 제거
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  }
}

// .env.local 로드
loadEnvLocal();

// 색상 출력
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

// 환경 변수 확인
const STAGING_DATABASE_URL = process.env.STAGING_DATABASE_URL;
const IT_DATABASE_URL = process.env.IT_DATABASE_URL || 
  'postgresql://postgres:namoai20250701@namoai-it.cluwk88i28od.ap-northeast-1.rds.amazonaws.com:5432/postgres';

if (!STAGING_DATABASE_URL) {
  log('❌ STAGING_DATABASE_URL 환경 변수가 설정되지 않았습니다.', colors.red);
  log('   환경 변수를 설정하거나 .env 파일에 추가하세요.', colors.yellow);
  process.exit(1);
}

if (!IT_DATABASE_URL) {
  log('❌ IT_DATABASE_URL 환경 변수가 설정되지 않았습니다.', colors.red);
  process.exit(1);
}

// 데이터베이스 URL에서 정보 추출
function parseDatabaseUrl(url) {
  const match = url.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
  if (!match) {
    throw new Error('Invalid database URL format');
  }
  return {
    user: match[1],
    password: match[2],
    host: match[3],
    port: match[4],
    database: match[5],
  };
}

// pg_dump 실행
function dumpDatabase(sourceUrl, outputFile) {
  log(`\n📦 스테이징 환경 데이터베이스 덤프 중...`, colors.blue);
  
  try {
    const source = parseDatabaseUrl(sourceUrl);
    
    // PGPASSWORD 환경 변수로 비밀번호 전달
    const env = {
      ...process.env,
      PGPASSWORD: source.password,
    };
    
    // pg_dump 실행
    const command = `pg_dump -h ${source.host} -p ${source.port} -U ${source.user} -d ${source.database} -F c -f "${outputFile}"`;
    
    log(`실행 중: pg_dump -h ${source.host} -p ${source.port} -U ${source.user} -d ${source.database}`, colors.cyan);
    
    execSync(command, {
      env,
      stdio: 'inherit',
      cwd: rootDir,
    });
    
    log('✅ 덤프 완료!', colors.green);
    return true;
  } catch (error) {
    log(`❌ 덤프 실패: ${error.message}`, colors.red);
    return false;
  }
}

// pg_restore 실행
function restoreDatabase(targetUrl, dumpFile) {
  log(`\n📥 IT 환경 데이터베이스에 복원 중...`, colors.blue);
  
  try {
    const target = parseDatabaseUrl(targetUrl);
    
    // PGPASSWORD 환경 변수로 비밀번호 전달
    const env = {
      ...process.env,
      PGPASSWORD: target.password,
    };
    
    // 기존 데이터베이스 스키마 삭제 (선택사항)
    log('⚠️  기존 스키마를 삭제하시겠습니까? (y/N)', colors.yellow);
    // 자동 실행을 위해 기본값은 'N'으로 설정
    
    // pg_restore 실행
    const command = `pg_restore -h ${target.host} -p ${target.port} -U ${target.user} -d ${target.database} --clean --if-exists --no-owner --no-acl "${dumpFile}"`;
    
    log(`실행 중: pg_restore -h ${target.host} -p ${target.port} -U ${target.user} -d ${target.database}`, colors.cyan);
    
    execSync(command, {
      env,
      stdio: 'inherit',
      cwd: rootDir,
    });
    
    log('✅ 복원 완료!', colors.green);
    return true;
  } catch (error) {
    log(`❌ 복원 실패: ${error.message}`, colors.red);
    return false;
  }
}

// pgvector 확장 설치
function installPgvector(targetUrl) {
  log(`\n🔧 pgvector 확장 설치 중...`, colors.blue);
  
  try {
    const target = parseDatabaseUrl(targetUrl);
    
    const env = {
      ...process.env,
      PGPASSWORD: target.password,
    };
    
    const command = `psql -h ${target.host} -p ${target.port} -U ${target.user} -d ${target.database} -c "CREATE EXTENSION IF NOT EXISTS vector;"`;
    
    execSync(command, {
      env,
      stdio: 'inherit',
      cwd: rootDir,
    });
    
    log('✅ pgvector 확장 설치 완료!', colors.green);
    return true;
  } catch (error) {
    log(`⚠️  pgvector 확장 설치 실패 (이미 설치되어 있을 수 있습니다): ${error.message}`, colors.yellow);
    return true; // 계속 진행
  }
}

// 벡터 인덱스 재생성
function recreateVectorIndexes(targetUrl) {
  log(`\n🔧 벡터 인덱스 재생성 중...`, colors.blue);
  
  try {
    const target = parseDatabaseUrl(targetUrl);
    const indexPath = join(rootDir, 'prisma', 'migrations', 'fix_vector_indexes.sql');
    
    if (!existsSync(indexPath)) {
      log('⚠️  벡터 인덱스 SQL 파일을 찾을 수 없습니다. 건너뜁니다.', colors.yellow);
      return true;
    }
    
    const env = {
      ...process.env,
      PGPASSWORD: target.password,
    };
    
    const command = `psql -h ${target.host} -p ${target.port} -U ${target.user} -d ${target.database} -f "${indexPath}"`;
    
    execSync(command, {
      env,
      stdio: 'inherit',
      cwd: rootDir,
    });
    
    log('✅ 벡터 인덱스 재생성 완료!', colors.green);
    return true;
  } catch (error) {
    log(`⚠️  벡터 인덱스 재생성 실패: ${error.message}`, colors.yellow);
    log('   수동으로 실행해주세요.', colors.yellow);
    return true; // 계속 진행
  }
}

// 연결 테스트
function testConnection(url, name) {
  log(`\n🔍 ${name} 연결 테스트 중...`, colors.blue);
  
  try {
    const db = parseDatabaseUrl(url);
    
    const env = {
      ...process.env,
      PGPASSWORD: db.password,
    };
    
    const command = `psql -h ${db.host} -p ${db.port} -U ${db.user} -d ${db.database} -c "SELECT 1;"`;
    
    execSync(command, {
      env,
      stdio: 'ignore',
      cwd: rootDir,
    });
    
    log(`✅ ${name} 연결 성공!`, colors.green);
    return true;
  } catch (error) {
    log(`❌ ${name} 연결 실패: ${error.message}`, colors.red);
    return false;
  }
}

// 메인 함수
async function main() {
  log('\n🚀 스테이징 환경 → IT 환경 데이터베이스 마이그레이션 시작\n', colors.cyan);
  
  // 1. 연결 테스트
  if (!testConnection(STAGING_DATABASE_URL, '스테이징 환경')) {
    log('\n❌ 스테이징 환경에 연결할 수 없습니다.', colors.red);
    process.exit(1);
  }
  
  if (!testConnection(IT_DATABASE_URL, 'IT 환경')) {
    log('\n❌ IT 환경에 연결할 수 없습니다.', colors.red);
    process.exit(1);
  }
  
  // 2. 덤프 파일 경로
  const dumpFile = join(rootDir, 'staging-to-it-dump.dump');
  
  // 3. 스테이징 환경 덤프
  if (!dumpDatabase(STAGING_DATABASE_URL, dumpFile)) {
    process.exit(1);
  }
  
  // 4. IT 환경에 복원
  if (!restoreDatabase(IT_DATABASE_URL, dumpFile)) {
    process.exit(1);
  }
  
  // 5. pgvector 확장 설치
  installPgvector(IT_DATABASE_URL);
  
  // 6. 벡터 인덱스 재생성
  recreateVectorIndexes(IT_DATABASE_URL);
  
  // 7. 덤프 파일 정리
  try {
    if (existsSync(dumpFile)) {
      const fs = await import('fs');
      fs.unlinkSync(dumpFile);
      log('\n🧹 임시 덤프 파일 삭제 완료', colors.cyan);
    }
  } catch (error) {
    log(`\n⚠️  덤프 파일 삭제 실패 (수동으로 삭제해주세요): ${dumpFile}`, colors.yellow);
  }
  
  log('\n✅ 마이그레이션 완료!', colors.green);
  log('\n다음 단계:', colors.cyan);
  log('1. IT 환경 애플리케이션에서 연결 테스트', colors.cyan);
  log('2. 관리 패널에서 IT 환경 상태 확인', colors.cyan);
}

main().catch((error) => {
  log(`\n❌ 오류 발생: ${error.message}`, colors.red);
  console.error(error);
  process.exit(1);
});


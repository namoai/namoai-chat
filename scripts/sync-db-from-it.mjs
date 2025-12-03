#!/usr/bin/env node

/**
 * IT 환경 데이터베이스를 로컬로 동기화하는 스크립트
 * 
 * 이 스크립트는 다음을 수행합니다:
 * 1. IT 환경의 데이터베이스에서 스키마와 데이터를 덤프
 * 2. 로컬 데이터베이스로 복원
 * 3. pgvector 확장 확인
 * 
 * 사용법:
 *   npm run db:sync:from-it
 *   또는
 *   node scripts/sync-db-from-it.mjs
 * 
 * 사전 요구사항:
 *   - pg_dump와 psql이 설치되어 있어야 합니다
 *   - IT_DATABASE_URL 환경 변수가 설정되어 있어야 합니다
 *   - 로컬 PostgreSQL이 실행 중이어야 합니다
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

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

function exec(command, options = {}) {
  try {
    return execSync(command, {
      stdio: 'inherit',
      cwd: rootDir,
      ...options,
    });
  } catch (error) {
    log(`❌ 명령 실행 실패: ${command}`, colors.red);
    throw error;
  }
}

// 환경 변수 로드
function loadEnvVars() {
  const envLocalPath = join(rootDir, '.env.local');
  if (!existsSync(envLocalPath)) {
    throw new Error('.env.local 파일이 없습니다. 먼저 npm run setup:local을 실행하세요.');
  }

  const content = readFileSync(envLocalPath, 'utf-8');
  const envVars = {};
  
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const match = trimmed.match(/^([^=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        let value = match[2].trim();
        
        // 따옴표 제거
        if ((value.startsWith('"') && value.endsWith('"')) || 
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        
        envVars[key] = value;
      }
    }
  }

  return envVars;
}

// 데이터베이스 URL 파싱
function parseDatabaseUrl(url) {
  const match = url.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
  if (!match) {
    throw new Error(`잘못된 DATABASE_URL 형식: ${url}`);
  }
  
  return {
    user: match[1],
    password: match[2],
    host: match[3],
    port: match[4],
    database: match[5],
  };
}

// 로컬 데이터베이스 확인
function checkLocalDatabase() {
  log('🔍 로컬 데이터베이스 연결을 확인합니다...', colors.blue);
  
  try {
    // Docker 사용 시
    try {
      execSync('docker ps --filter name=namos-chat-local-db --format "{{.Names}}"', {
        stdio: 'ignore',
      });
      log('✓ Docker PostgreSQL 컨테이너가 실행 중입니다.', colors.green);
      return 'docker';
    } catch {}
    
    // 로컬 PostgreSQL 사용 시
    execSync('psql -U postgres -h localhost -c "SELECT 1"', {
      stdio: 'ignore',
      env: { ...process.env, PGPASSWORD: 'postgres' },
    });
    log('✓ 로컬 PostgreSQL에 연결되었습니다.', colors.green);
    return 'local';
  } catch (error) {
    log('❌ 로컬 PostgreSQL에 연결할 수 없습니다.', colors.red);
    throw error;
  }
}

// IT 환경에서 데이터베이스 덤프
async function dumpFromIt(itDbUrl) {
  log('📥 IT 환경에서 데이터베이스를 덤프합니다...', colors.blue);
  
  const itDb = parseDatabaseUrl(itDbUrl);
  const dumpPath = join(rootDir, 'it-db-dump.sql');
  
  try {
    // pg_dump 실행
    const pgDumpCmd = `pg_dump -h ${itDb.host} -p ${itDb.port} -U ${itDb.user} -d ${itDb.database} -F c -f "${dumpPath}"`;
    
    log(`  실행 중: pg_dump -h ${itDb.host} -p ${itDb.port} -U ${itDb.user} -d ${itDb.database}`, colors.cyan);
    
    execSync(pgDumpCmd, {
      stdio: 'inherit',
      env: { ...process.env, PGPASSWORD: itDb.password },
    });
    
    log('✓ 덤프가 완료되었습니다.', colors.green);
    return dumpPath;
  } catch (error) {
    log('❌ 덤프 중 오류가 발생했습니다.', colors.red);
    if (existsSync(dumpPath)) {
      unlinkSync(dumpPath);
    }
    throw error;
  }
}

// 로컬 데이터베이스로 복원
async function restoreToLocal(dumpPath, dbType) {
  log('📤 로컬 데이터베이스로 복원합니다...', colors.blue);
  
  const localDbUrl = 'postgresql://postgres:postgres@localhost:5432/namos_chat_local';
  const localDb = parseDatabaseUrl(localDbUrl);
  
  try {
    // 기존 데이터베이스 삭제 및 재생성
    log('  기존 데이터베이스를 초기화합니다...', colors.yellow);
    
    if (dbType === 'docker') {
      execSync(
        `docker exec namos-chat-local-db psql -U postgres -c "DROP DATABASE IF EXISTS ${localDb.database};"`,
        { stdio: 'ignore' }
      );
      execSync(
        `docker exec namos-chat-local-db psql -U postgres -c "CREATE DATABASE ${localDb.database};"`,
        { stdio: 'ignore' }
      );
    } else {
      execSync(
        `psql -U postgres -h localhost -c "DROP DATABASE IF EXISTS ${localDb.database};"`,
        {
          stdio: 'ignore',
          env: { ...process.env, PGPASSWORD: 'postgres' },
        }
      );
      execSync(
        `psql -U postgres -h localhost -c "CREATE DATABASE ${localDb.database};"`,
        {
          stdio: 'ignore',
          env: { ...process.env, PGPASSWORD: 'postgres' },
        }
      );
    }
    
    log('✓ 데이터베이스가 재생성되었습니다.', colors.green);
    
    // pg_restore 실행
    log('  덤프 파일을 복원합니다...', colors.yellow);
    
    if (dbType === 'docker') {
      // Docker 컨테이너로 파일 복사
      execSync(`docker cp "${dumpPath}" namos-chat-local-db:/tmp/dump.sql`, {
        stdio: 'ignore',
      });
      
      // Docker 컨테이너 내에서 복원
      execSync(
        `docker exec -i namos-chat-local-db pg_restore -U postgres -d ${localDb.database} -c /tmp/dump.sql || docker exec -i namos-chat-local-db psql -U postgres -d ${localDb.database} < /tmp/dump.sql`,
        { stdio: 'inherit' }
      );
    } else {
      // 로컬에서 직접 복원
      try {
        execSync(
          `pg_restore -h ${localDb.host} -p ${localDb.port} -U ${localDb.user} -d ${localDb.database} -c "${dumpPath}"`,
          {
            stdio: 'inherit',
            env: { ...process.env, PGPASSWORD: 'postgres' },
          }
        );
      } catch {
        // pg_restore 실패 시 psql로 시도
        log('  pg_restore 실패, psql로 시도합니다...', colors.yellow);
        execSync(
          `psql -h ${localDb.host} -p ${localDb.port} -U ${localDb.user} -d ${localDb.database} < "${dumpPath}"`,
          {
            stdio: 'inherit',
            env: { ...process.env, PGPASSWORD: 'postgres' },
          }
        );
      }
    }
    
    log('✓ 복원이 완료되었습니다.', colors.green);
  } catch (error) {
    log('❌ 복원 중 오류가 발생했습니다.', colors.red);
    throw error;
  }
}

// pgvector 확장 확인 및 설치
function ensurePgvector(dbType) {
  log('🔧 pgvector 확장을 확인합니다...', colors.blue);
  
  try {
    if (dbType === 'docker') {
      execSync(
        'docker exec namos-chat-local-db psql -U postgres -d namos_chat_local -c "CREATE EXTENSION IF NOT EXISTS vector;"',
        { stdio: 'ignore' }
      );
    } else {
      execSync(
        'psql -U postgres -h localhost -d namos_chat_local -c "CREATE EXTENSION IF NOT EXISTS vector;"',
        {
          stdio: 'ignore',
          env: { ...process.env, PGPASSWORD: 'postgres' },
        }
      );
    }
    
    log('✓ pgvector 확장이 설치되었습니다.', colors.green);
  } catch (error) {
    log('⚠️ pgvector 확장 설치 중 오류가 발생했습니다.', colors.yellow);
    log('  (이미 설치되어 있거나 수동으로 설치해야 할 수 있습니다)', colors.yellow);
  }
}

// 메인 함수
async function main() {
  log('\n🔄 IT 환경 데이터베이스를 로컬로 동기화합니다...\n', colors.cyan);

  const dumpPath = join(rootDir, 'it-db-dump.sql');
  
  try {
    // 1. 환경 변수 로드
    const envVars = loadEnvVars();
    const itDbUrl = envVars.IT_DATABASE_URL || envVars.DATABASE_URL;
    
    if (!itDbUrl) {
      throw new Error('IT_DATABASE_URL 또는 DATABASE_URL이 설정되지 않았습니다.');
    }
    
    log(`✓ IT 데이터베이스 URL: ${itDbUrl.replace(/:[^:@]+@/, ':****@')}`, colors.green);
    
    // 2. 로컬 데이터베이스 확인
    const dbType = checkLocalDatabase();
    
    // 3. IT 환경에서 덤프
    await dumpFromIt(itDbUrl);
    
    // 4. 로컬로 복원
    await restoreToLocal(dumpPath, dbType);
    
    // 5. pgvector 확장 확인
    ensurePgvector(dbType);
    
    // 6. 덤프 파일 정리
    if (existsSync(dumpPath)) {
      unlinkSync(dumpPath);
      log('✓ 임시 덤프 파일을 삭제했습니다.', colors.green);
    }
    
    log('\n✅ 데이터베이스 동기화가 완료되었습니다!', colors.green);
    log('\n📋 다음 단계:', colors.cyan);
    log('  1. Prisma Client 재생성: npm run db:generate', colors.yellow);
    log('  2. 개발 서버 시작: npm run dev', colors.yellow);
    log('\n');

  } catch (error) {
    log('\n❌ 동기화 중 오류가 발생했습니다:', colors.red);
    console.error(error);
    
    // 덤프 파일 정리
    if (existsSync(dumpPath)) {
      unlinkSync(dumpPath);
    }
    
    process.exit(1);
  }
}

main();


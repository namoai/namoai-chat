#!/usr/bin/env node

/**
 * 로컬 개발 환경 자동 설정 스크립트
 * 
 * 이 스크립트는 다음을 수행합니다:
 * 1. PostgreSQL 데이터베이스 확인/생성
 * 2. Prisma 마이그레이션 실행
 * 3. Prisma Client 생성
 * 4. 초기 설정 확인
 * 
 * 사용법:
 *   npm run setup:local
 *   또는
 *   node scripts/setup-local.mjs
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { randomBytes } from 'crypto';

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

// .env.local 파일 확인 및 생성
function ensureEnvLocal() {
  const envLocalPath = join(rootDir, '.env.local');
  
  if (existsSync(envLocalPath)) {
    log('✓ .env.local 파일이 이미 존재합니다.', colors.green);
    
    // 기존 파일 확인 및 누락된 필수 변수 추가
    const existingContent = readFileSync(envLocalPath, 'utf-8');
    const requiredVars = {
      'APP_ENV': 'local',
      'NODE_ENV': 'development',
      'NEXTAUTH_URL': 'http://localhost:3000',
      'NEXT_PUBLIC_API_URL': 'http://localhost:3000',
    };
    
    let needsUpdate = false;
    let updatedContent = existingContent;
    
    // 필수 변수가 없으면 추가
    for (const [varName, defaultValue] of Object.entries(requiredVars)) {
      const regex = new RegExp(`^${varName}=`, 'm');
      if (!regex.test(existingContent)) {
        // DATABASE_URL은 별도 처리
        if (varName === 'DATABASE_URL') continue;
        
        updatedContent += `\n# 자동 추가된 필수 변수\n${varName}=${defaultValue}`;
        needsUpdate = true;
        log(`  + ${varName} 추가됨`, colors.yellow);
      }
    }
    
    // NEXTAUTH_SECRET이 없으면 생성
    if (!/^NEXTAUTH_SECRET=/m.test(existingContent)) {
      const nextAuthSecret = randomBytes(32).toString('base64');
      updatedContent += `\n# 자동 생성된 NEXTAUTH_SECRET\nNEXTAUTH_SECRET=${nextAuthSecret}`;
      needsUpdate = true;
      log('  + NEXTAUTH_SECRET 자동 생성됨', colors.yellow);
    }
    
    // DATABASE_URL이 없거나 기본값이면 업데이트
    let databaseUrl;
    try {
      execSync('docker ps', { stdio: 'ignore' });
      databaseUrl = 'postgresql://postgres:postgres@localhost:5432/namos_chat_local';
    } catch {
      databaseUrl = 'postgresql://postgres:postgres@localhost:5432/namos_chat_local';
    }
    
    if (!/^DATABASE_URL=/m.test(existingContent)) {
      updatedContent += `\n# 자동 추가된 DATABASE_URL\nDATABASE_URL=${databaseUrl}`;
      needsUpdate = true;
      log('  + DATABASE_URL 추가됨', colors.yellow);
    }
    
    if (needsUpdate) {
      writeFileSync(envLocalPath, updatedContent, 'utf-8');
      log('✓ .env.local 파일이 업데이트되었습니다.', colors.green);
    } else {
      log('  모든 필수 변수가 이미 설정되어 있습니다.', colors.cyan);
    }
    
    return;
  }

  log('📝 .env.local 파일을 생성합니다...', colors.blue);
  
  // Docker Compose 사용 여부 확인
  let databaseUrl;
  try {
    execSync('docker ps', { stdio: 'ignore' });
    // Docker가 실행 중이면 Docker Compose 사용
    databaseUrl = 'postgresql://postgres:postgres@localhost:5432/namos_chat_local';
    log('🐳 Docker가 감지되었습니다. Docker Compose를 사용합니다.', colors.cyan);
  } catch {
    // Docker가 없으면 로컬 PostgreSQL 사용
    databaseUrl = 'postgresql://postgres:postgres@localhost:5432/namos_chat_local';
    log('💻 로컬 PostgreSQL을 사용합니다.', colors.cyan);
  }

  // NEXTAUTH_SECRET 자동 생성
  const nextAuthSecret = randomBytes(32).toString('base64');

  const envContent = `# ============================================
# 로컬 개발 환경 설정
# Local Development Environment Configuration
# ============================================

# 기본 환경 설정
APP_ENV=local
NODE_ENV=development

# 데이터베이스 연결
DATABASE_URL=${databaseUrl}

# Next.js 설정
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXTAUTH_URL=http://localhost:3000

# ============================================
# NextAuth 설정 (필수)
# ============================================
# 자동 생성된 시크릿 (프로덕션에서는 반드시 변경하세요!)
NEXTAUTH_SECRET=${nextAuthSecret}

# ============================================
# Google OAuth 설정 (선택사항 - 로그인 기능 사용 시 필요)
# ============================================
# Google Cloud Console에서 발급받은 OAuth 2.0 클라이언트 ID/Secret
# https://console.cloud.google.com/apis/credentials
# GOOGLE_CLIENT_ID=your-google-client-id
# GOOGLE_CLIENT_SECRET=your-google-client-secret

# ============================================
# Supabase 설정 (선택사항 - Supabase 사용 시)
# ============================================
# Supabase Dashboard → Settings → API에서 확인
# https://supabase.com/dashboard
# NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
# NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
# SUPABASE_URL=https://your-project.supabase.co
# SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# ============================================
# Cloudflare R2 설정 (선택사항 - 이미지 스토리지 사용 시)
# ============================================
# Cloudflare Dashboard → R2 → Manage R2 API Tokens
# https://dash.cloudflare.com/
# CLOUDFLARE_ACCOUNT_ID=your-account-id
# CLOUDFLARE_R2_ACCESS_KEY_ID=your-access-key-id
# CLOUDFLARE_R2_SECRET_ACCESS_KEY=your-secret-access-key
# CLOUDFLARE_R2_BUCKET_NAME=chat-images
# CLOUDFLARE_R2_PUBLIC_URL=https://chat-images.your-account-id.r2.cloudflarestorage.com
# CLOUDFLARE_R2_ENDPOINT=https://your-account-id.r2.cloudflarestorage.com

# ============================================
# OpenAI 설정 (선택사항 - Embedding API 사용 시)
# ============================================
# OpenAI API Key: https://platform.openai.com/api-keys
# OPENAI_API_KEY=sk-...

# ============================================
# Google Cloud 설정 (선택사항 - Vertex AI 사용 시)
# ============================================
# Google Cloud Project ID
# GOOGLE_PROJECT_ID=your-project-id
# GOOGLE_APPLICATION_CREDENTIALS_JSON={"type":"service_account",...}
# 또는 Base64 인코딩된 JSON
# GOOGLE_APPLICATION_CREDENTIALS_JSON_BASE64=eyJ0eXAiOiJKV1QiLCJ...

# ============================================
# Redis 설정 (선택사항 - Upstash Redis 사용 시)
# ============================================
# Upstash Console: https://console.upstash.com/
# UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
# UPSTASH_REDIS_REST_TOKEN=your-redis-token

# ============================================
# 참고사항
# ============================================
# 1. 필수 항목: DATABASE_URL, NEXTAUTH_SECRET, NEXTAUTH_URL
# 2. 선택 항목: 위의 주석 처리된 항목들은 기능 사용 시에만 필요합니다
# 3. 보안: 이 파일은 .gitignore에 포함되어 Git에 커밋되지 않습니다
# 4. 프로덕션: 배포 환경에서는 각 플랫폼의 환경 변수 설정을 사용하세요
`;

  writeFileSync(envLocalPath, envContent, 'utf-8');
  log('✓ .env.local 파일이 생성되었습니다.', colors.green);
}

// Docker Compose로 PostgreSQL 시작
async function startDockerPostgres() {
  try {
    execSync('docker ps', { stdio: 'ignore' });
    log('🐳 Docker Compose로 PostgreSQL을 시작합니다...', colors.blue);
    
    const dockerComposePath = join(rootDir, 'docker-compose.local.yml');
    if (!existsSync(dockerComposePath)) {
      log('❌ docker-compose.local.yml 파일을 찾을 수 없습니다.', colors.red);
      return false;
    }

    // 컨테이너가 이미 실행 중인지 확인
    try {
      const output = execSync('docker ps --filter name=namos-chat-local-db --format "{{.Names}}"', {
        encoding: 'utf-8',
      });
      if (output.trim() === 'namos-chat-local-db') {
        log('✓ PostgreSQL 컨테이너가 이미 실행 중입니다.', colors.green);
        return true;
      }
    } catch {}

    // 컨테이너 시작
    exec(`docker-compose -f docker-compose.local.yml up -d`);
    
    // 헬스체크 대기
    log('⏳ PostgreSQL이 준비될 때까지 대기 중...', colors.yellow);
    let retries = 30;
    while (retries > 0) {
      try {
        execSync('docker exec namos-chat-local-db pg_isready -U postgres', {
          stdio: 'ignore',
        });
        log('✓ PostgreSQL이 준비되었습니다!', colors.green);
        return true;
      } catch {
        retries--;
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    log('⚠️ PostgreSQL 시작 시간이 초과되었습니다. 수동으로 확인해주세요.', colors.yellow);
    return false;
  } catch (error) {
    log('⚠️ Docker를 사용할 수 없습니다. 로컬 PostgreSQL을 사용합니다.', colors.yellow);
    return false;
  }
}

// 로컬 PostgreSQL 확인
function checkLocalPostgres() {
  log('🔍 로컬 PostgreSQL 연결을 확인합니다...', colors.blue);
  
  try {
    // psql 명령어로 연결 테스트
    execSync('psql -U postgres -h localhost -c "SELECT 1"', {
      stdio: 'ignore',
      env: { ...process.env, PGPASSWORD: 'postgres' },
    });
    log('✓ 로컬 PostgreSQL에 연결되었습니다.', colors.green);
    return true;
  } catch (error) {
    log('❌ 로컬 PostgreSQL에 연결할 수 없습니다.', colors.red);
    log('   다음 중 하나를 확인해주세요:', colors.yellow);
    log('   1. PostgreSQL이 설치되어 있고 실행 중인지', colors.yellow);
    log('   2. 비밀번호가 "postgres"인지', colors.yellow);
    log('   3. 포트 5432가 열려있는지', colors.yellow);
    return false;
  }
}

// 데이터베이스 생성
function createDatabase() {
  log('📦 데이터베이스를 생성합니다...', colors.blue);
  
  try {
    // Docker 사용 시
    try {
      execSync('docker ps --filter name=namos-chat-local-db --format "{{.Names}}"', {
        stdio: 'ignore',
      });
      
      execSync(
        'docker exec namos-chat-local-db psql -U postgres -c "CREATE DATABASE namos_chat_local;"',
        { stdio: 'ignore' }
      );
      log('✓ 데이터베이스가 생성되었습니다.', colors.green);
      return true;
    } catch {
      // 로컬 PostgreSQL 사용 시
      execSync(
        'psql -U postgres -h localhost -c "CREATE DATABASE namos_chat_local;"',
        {
          stdio: 'ignore',
          env: { ...process.env, PGPASSWORD: 'postgres' },
        }
      );
      log('✓ 데이터베이스가 생성되었습니다.', colors.green);
      return true;
    }
  } catch (error) {
    // 데이터베이스가 이미 존재하는 경우
    if (error.message.includes('already exists') || error.stderr?.toString().includes('already exists')) {
      log('✓ 데이터베이스가 이미 존재합니다.', colors.green);
      return true;
    }
    log('⚠️ 데이터베이스 생성 중 오류가 발생했습니다. (이미 존재할 수 있습니다)', colors.yellow);
    return true; // 계속 진행
  }
}

// pgvector 확장 설치
function installPgvector() {
  log('🔧 pgvector 확장을 설치합니다...', colors.blue);
  
  try {
    // Docker 사용 시
    try {
      execSync('docker ps --filter name=namos-chat-local-db --format "{{.Names}}"', {
        stdio: 'ignore',
      });
      
      execSync(
        'docker exec namos-chat-local-db psql -U postgres -d namos_chat_local -c "CREATE EXTENSION IF NOT EXISTS vector;"',
        { stdio: 'ignore' }
      );
      log('✓ pgvector 확장이 설치되었습니다.', colors.green);
      return true;
    } catch {
      // 로컬 PostgreSQL 사용 시
      execSync(
        'psql -U postgres -h localhost -d namos_chat_local -c "CREATE EXTENSION IF NOT EXISTS vector;"',
        {
          stdio: 'ignore',
          env: { ...process.env, PGPASSWORD: 'postgres' },
        }
      );
      log('✓ pgvector 확장이 설치되었습니다.', colors.green);
      return true;
    }
  } catch (error) {
    log('⚠️ pgvector 확장 설치 중 오류가 발생했습니다.', colors.yellow);
    log('   (이미 설치되어 있거나 수동으로 설치해야 할 수 있습니다)', colors.yellow);
    return true; // 계속 진행
  }
}

// Prisma 마이그레이션 실행
function runMigrations() {
  log('🔄 Prisma 마이그레이션을 실행합니다...', colors.blue);
  
  try {
    exec('npx prisma migrate dev --name init');
    log('✓ 마이그레이션이 완료되었습니다.', colors.green);
    return true;
  } catch (error) {
    log('❌ 마이그레이션 실행 중 오류가 발생했습니다.', colors.red);
    throw error;
  }
}

// Prisma Client 생성
function generatePrismaClient() {
  log('🔨 Prisma Client를 생성합니다...', colors.blue);
  
  try {
    exec('npx prisma generate');
    log('✓ Prisma Client가 생성되었습니다.', colors.green);
    return true;
  } catch (error) {
    log('❌ Prisma Client 생성 중 오류가 발생했습니다.', colors.red);
    throw error;
  }
}

// 메인 함수
async function main() {
  log('\n🚀 로컬 개발 환경 설정을 시작합니다...\n', colors.cyan);

  try {
    // 1. .env.local 파일 확인/생성
    ensureEnvLocal();

    // 2. Docker Compose로 PostgreSQL 시작 시도
    const dockerStarted = await startDockerPostgres();
    
    // 3. PostgreSQL 연결 확인
    if (!dockerStarted) {
      const localPostgresOk = checkLocalPostgres();
      if (!localPostgresOk) {
        log('\n❌ PostgreSQL 연결에 실패했습니다.', colors.red);
        log('   다음 중 하나를 선택하세요:', colors.yellow);
        log('   1. Docker Desktop을 설치하고 실행', colors.yellow);
        log('   2. PostgreSQL을 직접 설치하고 실행', colors.yellow);
        process.exit(1);
      }
    }

    // 4. 데이터베이스 생성
    createDatabase();

    // 5. pgvector 확장 설치
    installPgvector();

    // 6. Prisma 마이그레이션 실행
    runMigrations();

    // 7. Prisma Client 생성
    generatePrismaClient();

    log('\n✅ 로컬 개발 환경 설정이 완료되었습니다!', colors.green);
    log('\n다음 명령어로 개발 서버를 시작하세요:', colors.cyan);
    log('  npm run dev\n', colors.cyan);

  } catch (error) {
    log('\n❌ 설정 중 오류가 발생했습니다:', colors.red);
    console.error(error);
    process.exit(1);
  }
}

main();


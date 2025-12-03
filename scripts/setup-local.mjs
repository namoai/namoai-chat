#!/usr/bin/env node

/**
 * 로컬 개발 환경 자동 설정 스크립트
 * 
 * 이 스크립트는 다음을 수행합니다:
 * 1. npm install 실행 (의존성 설치)
 * 2. .env.local 파일 생성/업데이트 (모든 환경 변수 설정)
 * 3. gemini-credentials.json 파일 생성 (선택사항)
 * 4. PostgreSQL 데이터베이스 확인/생성
 * 5. Prisma 마이그레이션 실행
 * 6. Prisma Client 생성
 * 7. 초기 설정 확인
 * 
 * 사용법:
 *   npm run setup:local
 *   또는
 *   node scripts/setup-local.mjs
 * 
 * 환경 변수 설정:
 *   이 스크립트는 제공된 모든 환경 변수를 .env.local에 자동으로 설정합니다.
 *   integration 환경의 모든 설정이 포함됩니다.
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
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

// Integration 환경 변수 로드 (별도 파일에서 읽기)
function loadIntegrationEnvVars() {
  const secretsDir = join(rootDir, 'secrets');
  const envVarsPath = join(secretsDir, 'integration-env.json');
  
  // secrets/integration-env.json 파일이 있으면 읽기
  if (existsSync(envVarsPath)) {
    try {
      const content = readFileSync(envVarsPath, 'utf-8');
      const envVars = JSON.parse(content);
      log('✓ secrets/integration-env.json에서 환경 변수를 로드했습니다.', colors.green);
      return envVars;
    } catch (error) {
      log('⚠️ secrets/integration-env.json 파싱 실패:', colors.yellow);
      console.error(error);
    }
  } else {
    // 파일이 없으면 템플릿 생성
    log('📝 secrets/integration-env.json 파일을 생성합니다...', colors.blue);
    
    // secrets 디렉토리 생성
    if (!existsSync(secretsDir)) {
      mkdirSync(secretsDir, { recursive: true });
    }
    
    // 템플릿 파일 생성 (실제 값은 사용자가 채워야 함)
    const template = {
      APP_ENV: 'integration',
      CLOUDFLARE_ACCOUNT_ID: 'your-cloudflare-account-id',
      CLOUDFLARE_R2_ACCESS_KEY_ID: 'your-r2-access-key-id',
      CLOUDFLARE_R2_BUCKET_NAME: 'namoai',
      CLOUDFLARE_R2_ENDPOINT: 'https://your-account-id.r2.cloudflarestorage.com',
      CLOUDFLARE_R2_PUBLIC_URL: 'https://your-public-url.r2.dev',
      CLOUDFLARE_R2_SECRET_ACCESS_KEY: 'your-r2-secret-access-key',
      DATABASE_URL: 'postgresql://user:password@host:5432/database',
      ENV_BRANCH: 'develop',
      GEMINI_API_KEY: 'your-gemini-api-key',
      GOOGLE_APPLICATION_CREDENTIALS_JSON: '{"type":"service_account",...}',
      GOOGLE_APPLICATION_CREDENTIALS_JSON_BASE64: 'base64-encoded-json',
      GOOGLE_CLIENT_ID: 'your-google-client-id',
      GOOGLE_CLIENT_SECRET: 'your-google-client-secret',
      GOOGLE_CLOUD_LOCATION: 'asia-northeast1',
      GOOGLE_PROJECT_ID: 'namoai-chat',
      IT_DATABASE_URL: 'postgresql://user:password@host:5432/database',
      IT_RDS_INSTANCE_IDENTIFIER: 'namoai-it',
      NEXTAUTH_SECRET: 'your-nextauth-secret',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'your-supabase-anon-key',
      NEXT_PUBLIC_SUPABASE_URL: 'https://your-project.supabase.co',
      OPENAI_API_KEY: 'your-openai-api-key',
      SUPABASE_ANON_KEY: 'your-supabase-anon-key',
      SUPABASE_SERVICE_ROLE_KEY: 'your-supabase-service-role-key',
      SUPABASE_URL: 'https://your-project.supabase.co',
      UPSTASH_REDIS_REST_TOKEN: 'your-upstash-token',
      UPSTASH_REDIS_REST_URL: 'https://your-redis.upstash.io',
      VERTEX_LOCATION: 'asia-northeast1',
    };
    
    writeFileSync(envVarsPath, JSON.stringify(template, null, 2), 'utf-8');
    log('✓ secrets/integration-env.json 템플릿이 생성되었습니다.', colors.green);
    log('  실제 환경 변수 값으로 채워주세요.', colors.yellow);
    log('  참고: 이 파일은 .gitignore에 포함되어 Git에 커밋되지 않습니다.', colors.cyan);
    
    return {};
  }
  
  return {};
}

// .env.local 파일 확인 및 생성 (모든 환경 변수 포함)
function ensureEnvLocal(integrationEnvVars) {
  const envLocalPath = join(rootDir, '.env.local');
  
  log('📝 .env.local 파일을 설정합니다...', colors.blue);
  
  // Docker Compose 사용 여부 확인
  let databaseUrl;
  try {
    execSync('docker ps', { stdio: 'ignore' });
    // Docker가 실행 중이면 Docker Compose 사용
    databaseUrl = 'postgresql://postgres:postgres@localhost:5432/namos_chat_local';
    log('🐳 Docker가 감지되었습니다. 로컬 데이터베이스 URL을 사용합니다.', colors.cyan);
  } catch {
    // Docker가 없으면 로컬 PostgreSQL 사용
    databaseUrl = 'postgresql://postgres:postgres@localhost:5432/namos_chat_local';
    log('💻 로컬 PostgreSQL을 사용합니다.', colors.cyan);
  }

  // 기존 파일이 있으면 읽기
  let existingContent = '';
  if (existsSync(envLocalPath)) {
    existingContent = readFileSync(envLocalPath, 'utf-8');
    log('✓ 기존 .env.local 파일을 확인했습니다.', colors.green);
  }

  // 환경 변수 설정 (로컬 개발용으로 일부 수정)
  const envVars = {
    // 기본 설정 (로컬 개발용)
    APP_ENV: 'local',
    NODE_ENV: 'development',
    DATABASE_URL: databaseUrl, // 로컬 DB 사용
    NEXTAUTH_URL: 'http://localhost:3000',
    NEXT_PUBLIC_API_URL: 'http://localhost:3000',
    
    // Integration 환경 변수 (secrets/integration-env.json에서 로드)
    ...integrationEnvVars,
    
    // 로컬 개발용으로 덮어쓰기
    APP_ENV: 'local', // 로컬 환경으로 설정
    DATABASE_URL: databaseUrl, // 로컬 DB 사용
    NEXTAUTH_URL: 'http://localhost:3000',
    NEXT_PUBLIC_API_URL: 'http://localhost:3000',
  };

  // 기존 파일에서 이미 설정된 변수는 유지 (주석 제외)
  const existingVars = new Set();
  const lines = existingContent.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const match = trimmed.match(/^([^=]+)=/);
      if (match) {
        existingVars.add(match[1].trim());
      }
    }
  }

  // 환경 변수 파일 생성
  let envContent = `# ============================================
# 로컬 개발 환경 설정
# Local Development Environment Configuration
# Integration 환경 변수 기반
# ============================================
# 생성일: ${new Date().toISOString()}
# 이 파일은 자동 생성되었습니다. 수동으로 수정할 수 있습니다.
# ============================================

`;

  // 환경 변수 추가
  for (const [key, value] of Object.entries(envVars)) {
    // 기존에 설정된 변수는 주석으로 표시하고 새 값 추가
    if (existingVars.has(key)) {
      envContent += `# 기존 값이 있었지만 새 값으로 업데이트됨\n`;
    }
    
    // JSON 값은 따옴표로 감싸기
    if (key.includes('JSON') && typeof value === 'string' && value.startsWith('{')) {
      envContent += `${key}="${value.replace(/"/g, '\\"')}"\n\n`;
    } else {
      envContent += `${key}=${value}\n\n`;
    }
  }

  // 추가 설명
  envContent += `# ============================================
# 참고사항
# ============================================
# 1. DATABASE_URL은 로컬 개발용으로 자동 설정되었습니다.
# 2. Integration 환경의 실제 DB를 사용하려면 위의 DATABASE_URL을 수정하세요.
# 3. 이 파일은 .gitignore에 포함되어 Git에 커밋되지 않습니다.
# 4. 보안: 민감한 정보가 포함되어 있으므로 절대 공유하지 마세요.
`;

  writeFileSync(envLocalPath, envContent, 'utf-8');
  log('✓ .env.local 파일이 생성/업데이트되었습니다.', colors.green);
  log(`  총 ${Object.keys(envVars).length}개의 환경 변수가 설정되었습니다.`, colors.cyan);
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

// npm install 실행
function installDependencies() {
  log('📦 npm install을 실행합니다...', colors.blue);
  
  try {
    // node_modules가 이미 있으면 스킵할지 확인
    const nodeModulesPath = join(rootDir, 'node_modules');
    if (existsSync(nodeModulesPath)) {
      log('  node_modules가 이미 존재합니다. 스킵합니다.', colors.yellow);
      log('  의존성을 업데이트하려면 수동으로 "npm install"을 실행하세요.', colors.yellow);
      return true;
    }
    
    exec('npm install');
    log('✓ npm install이 완료되었습니다.', colors.green);
    return true;
  } catch (error) {
    log('❌ npm install 실행 중 오류가 발생했습니다.', colors.red);
    log('  수동으로 "npm install"을 실행해주세요.', colors.yellow);
    return false;
  }
}

// gemini-credentials.json 파일 생성 (선택사항)
function ensureGeminiCredentials(integrationEnvVars) {
  const credsPath = join(rootDir, 'gemini-credentials.json');
  
  // 이미 존재하면 스킵
  if (existsSync(credsPath)) {
    log('✓ gemini-credentials.json 파일이 이미 존재합니다.', colors.green);
    return;
  }

  // GOOGLE_APPLICATION_CREDENTIALS_JSON에서 생성
  const jsonCreds = integrationEnvVars.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  if (jsonCreds && jsonCreds !== 'your-google-credentials-json') {
    try {
      // JSON 파싱하여 파일로 저장
      const parsed = JSON.parse(jsonCreds);
      writeFileSync(credsPath, JSON.stringify(parsed, null, 2), 'utf-8');
      log('✓ gemini-credentials.json 파일이 생성되었습니다.', colors.green);
      log('  참고: 이 파일은 환경 변수 GOOGLE_APPLICATION_CREDENTIALS_JSON으로도 사용 가능합니다.', colors.cyan);
    } catch (error) {
      log('⚠️ gemini-credentials.json 생성 중 오류가 발생했습니다.', colors.yellow);
      log('  환경 변수 GOOGLE_APPLICATION_CREDENTIALS_JSON을 사용합니다.', colors.yellow);
    }
  } else {
    log('⚠️ GOOGLE_APPLICATION_CREDENTIALS_JSON이 없어 gemini-credentials.json을 생성하지 않습니다.', colors.yellow);
    log('  secrets/integration-env.json에 실제 값을 설정하면 자동으로 생성됩니다.', colors.cyan);
  }
}

// 메인 함수
async function main() {
  log('\n🚀 로컬 개발 환경 설정을 시작합니다...\n', colors.cyan);

  try {
    // 1. npm install 실행
    installDependencies();

    // 2. Integration 환경 변수 로드
    const integrationEnvVars = loadIntegrationEnvVars();
    
    // 3. .env.local 파일 확인/생성 (모든 환경 변수 포함)
    ensureEnvLocal(integrationEnvVars);

    // 4. gemini-credentials.json 파일 생성 (선택사항)
    ensureGeminiCredentials(integrationEnvVars);

    // 4. Docker Compose로 PostgreSQL 시작 시도
    const dockerStarted = await startDockerPostgres();
    
    // 5. PostgreSQL 연결 확인
    if (!dockerStarted) {
      const localPostgresOk = checkLocalPostgres();
      if (!localPostgresOk) {
        log('\n❌ PostgreSQL 연결에 실패했습니다.', colors.red);
        log('   다음 중 하나를 선택하세요:', colors.yellow);
        log('   1. Docker Desktop을 설치하고 실행', colors.yellow);
        log('   2. PostgreSQL을 직접 설치하고 실행', colors.yellow);
        log('   3. Integration 환경의 원격 DB를 사용하려면 .env.local의 DATABASE_URL을 수정하세요', colors.yellow);
        process.exit(1);
      }
    }

    // 6. 데이터베이스 생성
    createDatabase();

    // 7. pgvector 확장 설치
    installPgvector();

    // 8. Prisma 마이그레이션 실행
    runMigrations();

    // 9. Prisma Client 생성
    generatePrismaClient();

    log('\n✅ 로컬 개발 환경 설정이 완료되었습니다!', colors.green);
    log('\n📋 설정 요약:', colors.cyan);
    log('  ✓ npm install 완료', colors.green);
    log('  ✓ .env.local 파일 생성 (모든 환경 변수 포함)', colors.green);
    log('  ✓ gemini-credentials.json 파일 생성 (선택사항)', colors.green);
    log('  ✓ 데이터베이스 설정 완료', colors.green);
    log('  ✓ Prisma 마이그레이션 완료', colors.green);
    log('\n🚀 다음 명령어로 개발 서버를 시작하세요:', colors.cyan);
    log('  npm run dev\n', colors.cyan);
    log('💡 참고:', colors.yellow);
    log('  - Integration 환경의 실제 DB를 사용하려면 .env.local의 DATABASE_URL을 수정하세요', colors.yellow);
    log('  - gemini-credentials.json은 환경 변수로 대체 가능하므로 필수는 아닙니다\n', colors.yellow);

  } catch (error) {
    log('\n❌ 설정 중 오류가 발생했습니다:', colors.red);
    console.error(error);
    process.exit(1);
  }
}

main();


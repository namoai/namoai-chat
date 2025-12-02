# 🚀 로컬 개발 환경 자동 설정 가이드

이 가이드는 팀원들이 각자 컴퓨터에서 로컬 개발 환경을 쉽게 구축할 수 있도록 도와줍니다.

## 📋 사전 요구사항

다음 중 하나를 선택하세요:

### 옵션 1: Docker Desktop 사용 (권장) ⭐

1. [Docker Desktop](https://www.docker.com/products/docker-desktop/) 설치
2. Docker Desktop 실행

**장점:**
- PostgreSQL 설치 불필요
- pgvector 자동 포함
- 환경 일관성 보장
- 한 번의 명령으로 모든 설정 완료

### 옵션 2: 로컬 PostgreSQL 사용

1. [PostgreSQL](https://www.postgresql.org/download/) 설치 (버전 14 이상)
2. pgvector 확장 설치
   ```bash
   # Windows (vcpkg 사용)
   vcpkg install pgvector

   # macOS (Homebrew)
   brew install pgvector

   # Linux
   # PostgreSQL 소스에서 빌드 필요
   ```

**기본 설정:**
- 사용자명: `postgres`
- 비밀번호: `postgres` (또는 본인이 설정한 비밀번호)
- 포트: `5432`

## 🎯 빠른 시작 (3단계)

### 1단계: 저장소 클론 및 의존성 설치

```bash
git clone <repository-url>
cd namos-chat-v1-move
npm install
```

### 2단계: 로컬 환경 자동 설정

```bash
npm run setup:local
```

이 명령어가 자동으로:
- ✅ `.env.local` 파일 생성
- ✅ PostgreSQL 데이터베이스 생성
- ✅ pgvector 확장 설치
- ✅ Prisma 마이그레이션 실행
- ✅ Prisma Client 생성

### 3단계: 개발 서버 시작

```bash
npm run dev
```

브라우저에서 `http://localhost:3000` 접속!

## 📝 상세 설명

### `npm run setup:local` 스크립트가 하는 일

1. **환경 변수 파일 생성/업데이트**
   - `.env.local` 파일이 없으면 완전한 템플릿 자동 생성
   - 기존 파일이 있으면 누락된 필수 변수만 자동 추가
   - Docker 사용 여부에 따라 적절한 `DATABASE_URL` 설정
   - `NEXTAUTH_SECRET` 자동 생성 (보안을 위해)
   - 모든 필요한 환경 변수 템플릿 포함 (주석 처리됨)

2. **PostgreSQL 시작**
   - Docker가 있으면: `docker-compose.local.yml`로 컨테이너 시작
   - Docker가 없으면: 로컬 PostgreSQL 연결 확인

3. **데이터베이스 생성**
   - `namos_chat_local` 데이터베이스 생성
   - 이미 존재하면 스킵

4. **pgvector 확장 설치**
   - 벡터 검색 기능을 위한 확장 설치

5. **Prisma 마이그레이션**
   - 모든 테이블 및 스키마 생성
   - 초기 데이터베이스 구조 설정

6. **Prisma Client 생성**
   - TypeScript 타입 생성
   - 데이터베이스 접근 준비 완료

## 🐳 Docker 사용 시 추가 명령어

### PostgreSQL 컨테이너 관리

```bash
# PostgreSQL 시작
npm run db:docker:up

# PostgreSQL 중지
npm run db:docker:down

# 로그 확인
npm run db:docker:logs
```

### 데이터베이스 초기화 (필요 시)

```bash
# 컨테이너와 데이터 삭제 후 재시작
npm run db:docker:down
docker volume rm namos-chat-v1-move_postgres_data
npm run db:docker:up
npm run setup:local
```

## 🔧 수동 설정 (자동 스크립트가 실패한 경우)

### 1. .env.local 파일 수동 생성

> 💡 **팁**: `npm run setup:local`을 실행하면 자동으로 완전한 템플릿이 생성됩니다!

프로젝트 루트에 `.env.local` 파일 생성:

```bash
# .env.local
APP_ENV=local
NODE_ENV=development

# Docker 사용 시
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/namos_chat_local

# 또는 로컬 PostgreSQL 사용 시 (비밀번호가 다른 경우)
# DATABASE_URL=postgresql://postgres:your_password@localhost:5432/namos_chat_local

NEXT_PUBLIC_API_URL=http://localhost:3000
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=자동생성된시크릿키

# 기타 선택사항 (필요한 기능 사용 시 주석 해제)
# NEXT_PUBLIC_SUPABASE_URL=...
# CLOUDFLARE_ACCOUNT_ID=...
# 등등...
```

**자동 생성된 템플릿에는 다음이 포함됩니다:**
- ✅ 필수 변수 (자동 설정됨)
- ✅ NextAuth 설정 (자동 생성)
- ✅ Supabase 설정 (주석 처리, 필요 시 활성화)
- ✅ Cloudflare R2 설정 (주석 처리, 필요 시 활성화)
- ✅ Google OAuth 설정 (주석 처리, 필요 시 활성화)
- ✅ OpenAI 설정 (주석 처리, 필요 시 활성화)
- ✅ Redis 설정 (주석 처리, 필요 시 활성화)

### 2. 데이터베이스 수동 생성

```bash
# Docker 사용 시
docker exec -it namos-chat-local-db psql -U postgres -c "CREATE DATABASE namos_chat_local;"
docker exec -it namos-chat-local-db psql -U postgres -d namos_chat_local -c "CREATE EXTENSION IF NOT EXISTS vector;"

# 로컬 PostgreSQL 사용 시
psql -U postgres -c "CREATE DATABASE namos_chat_local;"
psql -U postgres -d namos_chat_local -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

### 3. Prisma 마이그레이션 수동 실행

```bash
npm run db:migrate
npm run db:generate
```

## 🛠️ 유용한 명령어

### Prisma Studio (데이터베이스 GUI)

```bash
npm run db:studio
```

브라우저에서 데이터베이스 내용을 시각적으로 확인할 수 있습니다.

### 마이그레이션 관리

```bash
# 새 마이그레이션 생성
npm run db:migrate

# Prisma Client 재생성
npm run db:generate
```

## ❓ 문제 해결

### "PostgreSQL에 연결할 수 없습니다"

**Docker 사용 시:**
```bash
# Docker가 실행 중인지 확인
docker ps

# 컨테이너가 실행 중인지 확인
docker ps --filter name=namos-chat-local-db

# 컨테이너 재시작
npm run db:docker:down
npm run db:docker:up
```

**로컬 PostgreSQL 사용 시:**
```bash
# PostgreSQL 서비스 상태 확인 (Windows)
# 서비스 관리자에서 "postgresql-x64-XX" 서비스 확인

# PostgreSQL 서비스 시작 (Windows)
net start postgresql-x64-XX

# 또는 PostgreSQL이 설치된 경로에서
pg_ctl start -D "C:\Program Files\PostgreSQL\XX\data"
```

### "pgvector 확장을 찾을 수 없습니다"

**Docker 사용 시:**
- `pgvector/pgvector:pg16` 이미지는 pgvector가 포함되어 있습니다.
- 컨테이너를 재시작해보세요.

**로컬 PostgreSQL 사용 시:**
- pgvector를 별도로 설치해야 합니다.
- [pgvector 설치 가이드](https://github.com/pgvector/pgvector#installation) 참고

### "마이그레이션 실패"

```bash
# 마이그레이션 상태 확인
npx prisma migrate status

# 마이그레이션 리셋 (주의: 모든 데이터 삭제)
npx prisma migrate reset
```

### "포트 5432가 이미 사용 중입니다"

**Docker 사용 시:**
```bash
# docker-compose.local.yml에서 포트 변경
# ports:
#   - "5433:5432"  # 5433으로 변경

# .env.local의 DATABASE_URL도 변경
# DATABASE_URL=postgresql://postgres:postgres@localhost:5433/namos_chat_local
```

**로컬 PostgreSQL 사용 시:**
- 다른 PostgreSQL 인스턴스가 실행 중일 수 있습니다.
- 서비스 관리자에서 중복 서비스 확인

## 📚 추가 리소스

- [Prisma 공식 문서](https://www.prisma.io/docs)
- [Docker Compose 문서](https://docs.docker.com/compose/)
- [pgvector GitHub](https://github.com/pgvector/pgvector)

## 💡 팁

1. **처음 설정 후**: `npm run setup:local` 한 번만 실행하면 됩니다.
2. **팀원 추가 시**: 저장소 클론 후 `npm run setup:local`만 실행하면 자동 설정됩니다.
3. **데이터베이스 초기화**: 필요 시 Docker 볼륨을 삭제하고 다시 설정할 수 있습니다.
4. **환경 변수**: `.env.local`은 Git에 커밋되지 않으므로 각자 설정합니다.

---

**문제가 계속되면 팀 채널에 문의하세요!** 🚀


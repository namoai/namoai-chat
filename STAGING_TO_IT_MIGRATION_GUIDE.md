# 스테이징 환경 → IT 환경 데이터베이스 마이그레이션 가이드

## 📋 개요

스테이징(혼방) 환경의 데이터베이스를 IT 환경으로 복사하는 가이드입니다.

**⚠️ 주의사항:**
- IT 환경의 기존 데이터는 모두 삭제됩니다
- 스테이징 환경의 모든 데이터가 IT 환경으로 복사됩니다
- 마이그레이션 전에 IT 환경 데이터베이스 백업 권장

---

## 🚀 빠른 시작

### 방법 1: npm 스크립트 사용 (권장)

```bash
# 환경 변수 설정
export STAGING_DATABASE_URL="postgresql://user:password@staging-host:5432/database"
export IT_DATABASE_URL="postgresql://postgres:namoai20250701@namoai-it.cluwk88i28od.ap-northeast-1.rds.amazonaws.com:5432/postgres"

# 마이그레이션 실행
npm run db:migrate:staging-to-it
```

### 방법 2: 직접 실행

```bash
# 환경 변수 설정
export STAGING_DATABASE_URL="postgresql://user:password@staging-host:5432/database"
export IT_DATABASE_URL="postgresql://postgres:namoai20250701@namoai-it.cluwk88i28od.ap-northeast-1.rds.amazonaws.com:5432/postgres"

# 스크립트 실행
node scripts/migrate-staging-to-it.mjs
```

---

## 📝 단계별 설명

### 1단계: 사전 준비

#### 필수 요구사항
- [ ] PostgreSQL 클라이언트 도구 설치 (`pg_dump`, `pg_restore`, `psql`)
- [ ] 스테이징 환경 데이터베이스 접근 권한
- [ ] IT 환경 데이터베이스 접근 권한
- [ ] 네트워크 접근 가능 (보안 그룹 설정 확인)

#### PostgreSQL 클라이언트 설치

**Windows:**
- [PostgreSQL 공식 설치 프로그램](https://www.postgresql.org/download/windows/) 다운로드
- 또는 Chocolatey: `choco install postgresql`

**macOS:**
```bash
brew install postgresql
```

**Linux:**
```bash
sudo apt-get install postgresql-client  # Ubuntu/Debian
sudo yum install postgresql  # CentOS/RHEL
```

### 2단계: 환경 변수 설정

#### 스테이징 환경 URL 확인

스테이징 환경의 `STAGING_DATABASE_URL`을 확인하세요:

```bash
# 예시
STAGING_DATABASE_URL=postgresql://user:password@staging-host:5432/namos_chat_staging
```

#### IT 환경 URL 설정

제공하신 IT 환경 URL:

```bash
IT_DATABASE_URL=postgresql://postgres:namoai20250701@namoai-it.cluwk88i28od.ap-northeast-1.rds.amazonaws.com:5432/postgres
```

### 3단계: 마이그레이션 실행

```bash
# 환경 변수 설정
export STAGING_DATABASE_URL="your-staging-url"
export IT_DATABASE_URL="postgresql://postgres:namoai20250701@namoai-it.cluwk88i28od.ap-northeast-1.rds.amazonaws.com:5432/postgres"

# 마이그레이션 실행
npm run db:migrate:staging-to-it
```

### 4단계: 마이그레이션 과정

스크립트가 자동으로 다음 작업을 수행합니다:

1. **연결 테스트**
   - 스테이징 환경 연결 확인
   - IT 환경 연결 확인

2. **데이터베이스 덤프**
   - 스테이징 환경에서 전체 데이터베이스 덤프 생성
   - Custom format (`-F c`) 사용

3. **데이터베이스 복원**
   - IT 환경에 덤프 파일 복원
   - 기존 스키마 삭제 후 복원 (`--clean --if-exists`)

4. **pgvector 확장 설치**
   - IT 환경에 pgvector 확장 자동 설치

5. **벡터 인덱스 재생성**
   - 벡터 검색을 위한 ivfflat 인덱스 재생성

6. **정리**
   - 임시 덤프 파일 삭제

---

## 🔧 수동 마이그레이션 (스크립트 사용 불가 시)

### 1. 덤프 생성

```bash
# 환경 변수 설정
export PGPASSWORD="staging-password"

# 덤프 생성
pg_dump -h staging-host \
        -p 5432 \
        -U staging-user \
        -d staging-database \
        -F c \
        -f staging-dump.dump
```

### 2. IT 환경에 복원

```bash
# 환경 변수 설정
export PGPASSWORD="namoai20250701"

# 복원
pg_restore -h namoai-it.cluwk88i28od.ap-northeast-1.rds.amazonaws.com \
           -p 5432 \
           -U postgres \
           -d postgres \
           --clean \
           --if-exists \
           --no-owner \
           --no-acl \
           staging-dump.dump
```

### 3. pgvector 확장 설치

```bash
export PGPASSWORD="namoai20250701"

psql -h namoai-it.cluwk88i28od.ap-northeast-1.rds.amazonaws.com \
     -p 5432 \
     -U postgres \
     -d postgres \
     -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

### 4. 벡터 인덱스 재생성

```bash
export PGPASSWORD="namoai20250701"

psql -h namoai-it.cluwk88i28od.ap-northeast-1.rds.amazonaws.com \
     -p 5432 \
     -U postgres \
     -d postgres \
     -f prisma/migrations/fix_vector_indexes.sql
```

---

## ✅ 마이그레이션 후 확인 사항

### 1. 데이터 확인

```bash
export PGPASSWORD="namoai20250701"

psql -h namoai-it.cluwk88i28od.ap-northeast-1.rds.amazonaws.com \
     -p 5432 \
     -U postgres \
     -d postgres \
     -c "SELECT COUNT(*) FROM users;"
```

### 2. 테이블 목록 확인

```bash
psql -h namoai-it.cluwk88i28od.ap-northeast-1.rds.amazonaws.com \
     -p 5432 \
     -U postgres \
     -d postgres \
     -c "\dt"
```

### 3. pgvector 확장 확인

```bash
psql -h namoai-it.cluwk88i28od.ap-northeast-1.rds.amazonaws.com \
     -p 5432 \
     -U postgres \
     -d postgres \
     -c "SELECT * FROM pg_extension WHERE extname = 'vector';"
```

### 4. 벡터 인덱스 확인

```bash
psql -h namoai-it.cluwk88i28od.ap-northeast-1.rds.amazonaws.com \
     -p 5432 \
     -U postgres \
     -d postgres \
     -c "SELECT indexname, indexdef FROM pg_indexes WHERE indexdef LIKE '%ivfflat%';"
```

---

## ❓ 문제 해결

### 문제 1: pg_dump를 찾을 수 없습니다

**해결:**
- PostgreSQL 클라이언트 도구가 설치되어 있는지 확인
- PATH 환경 변수에 PostgreSQL bin 디렉토리 추가

### 문제 2: 연결할 수 없습니다

**원인:**
- 보안 그룹 규칙 문제
- 네트워크 접근 불가

**해결:**
1. AWS RDS 보안 그룹 확인
2. 현재 IP 주소를 인바운드 규칙에 추가
3. 또는 VPN/SSH 터널 사용

### 문제 3: 권한 오류

**원인:**
- 데이터베이스 사용자 권한 부족

**해결:**
- `postgres` 사용자 또는 SUPERUSER 권한 필요
- 또는 필요한 권한만 부여:
  ```sql
  GRANT ALL PRIVILEGES ON DATABASE postgres TO postgres;
  ```

### 문제 4: 벡터 인덱스 생성 실패

**원인:**
- pgvector 확장 미설치
- 데이터가 없어서 인덱스 생성 불가

**해결:**
1. pgvector 확장 설치 확인
2. 데이터 복원 후 인덱스 재생성

---

## 📊 마이그레이션 시간 예상

- **소규모 데이터 (< 1GB)**: 약 5-10분
- **중규모 데이터 (1-10GB)**: 약 10-30분
- **대규모 데이터 (> 10GB)**: 약 30분-1시간

**요인:**
- 데이터 크기
- 네트워크 속도
- 데이터베이스 성능

---

## 🔒 보안 주의사항

1. **비밀번호 보호**
   - 환경 변수에 비밀번호를 직접 입력하지 않기
   - `.env` 파일 사용 권장 (Git에 커밋하지 않기)

2. **덤프 파일 보안**
   - 덤프 파일에는 모든 데이터가 포함됨
   - 마이그레이션 후 즉시 삭제
   - 필요 시 암호화하여 저장

3. **네트워크 보안**
   - 가능하면 VPN 또는 SSH 터널 사용
   - 공용 네트워크에서 실행 시 주의

---

## 📚 참고 자료

- [pg_dump 공식 문서](https://www.postgresql.org/docs/current/app-pgdump.html)
- [pg_restore 공식 문서](https://www.postgresql.org/docs/current/app-pgrestore.html)
- [pgvector GitHub](https://github.com/pgvector/pgvector)

---

**작성일:** 2025-01-27  
**다음 단계:** 마이그레이션 완료 후 IT 환경 애플리케이션 연결 테스트


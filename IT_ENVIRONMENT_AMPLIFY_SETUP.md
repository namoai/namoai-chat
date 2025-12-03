# IT 환경 Amplify 설정 가이드

## 📋 개요

IT 환경은 **별도의 Amplify 앱을 만들거나**, **기존 앱에 브랜치를 추가**하는 두 가지 방법이 있습니다.

**⚠️ 권장: 브랜치 추가 방법 (더 간단!)**
- 기존 Amplify 앱에 IT 환경 전용 브랜치 추가
- 브랜치별 환경 변수만 다르게 설정
- 새 앱 생성 불필요, 환경 변수 재사용 가능

**상세 가이드:** [IT_ENVIRONMENT_BRANCH_SETUP.md](./IT_ENVIRONMENT_BRANCH_SETUP.md) 참고

---

## 방법 1: 브랜치 추가 (권장) ⭐

기존 Amplify 앱에 브랜치를 추가하는 방법입니다. **이 방법이 훨씬 간단합니다!**

자세한 내용은 [IT_ENVIRONMENT_BRANCH_SETUP.md](./IT_ENVIRONMENT_BRANCH_SETUP.md)를 참고하세요.

---

## 방법 2: 별도 Amplify 앱 생성

IT 환경을 **별도의 AWS Amplify 앱**으로 구축하는 방법입니다.

**현재 상황:**
- ✅ IT 환경 RDS 데이터베이스: 구축 완료
- ✅ IT 환경 보안 그룹: 설정 완료
- ❌ IT 환경 Amplify 앱: **아직 구축 안 됨**

**목표:**
- IT 환경 전용 Amplify 앱 생성
- IT 환경 전용 URL (예: `https://it-test.namos-chat.com`)
- IT 환경 데이터베이스 연결

---

## 🏗️ 구축 방법

### 방법 1: AWS Amplify Console에서 새 앱 생성 (권장)

#### 1단계: Amplify Console 접속

1. **AWS Console** → **AWS Amplify** 서비스 접속
2. **"새 앱 호스팅"** 또는 **"앱 생성"** 클릭

#### 2단계: 소스 코드 연결

**옵션 A: GitHub/GitLab/Bitbucket 연결 (권장)**

1. **소스 제공업체 선택**: GitHub, GitLab, 또는 Bitbucket
2. **저장소 선택**: 현재 프로젝트 저장소
3. **브랜치 선택**: 
   - IT 환경 전용 브랜치 생성 (예: `it-test`, `integration`)
   - 또는 기존 브랜치 사용 (예: `develop`)

**옵션 B: 기존 앱에서 브랜치 추가**

혼방 환경 Amplify 앱이 있다면:
1. 기존 앱 선택
2. **"분기 추가"** 클릭
3. IT 환경 전용 브랜치 연결

#### 3단계: 빌드 설정

**amplify.yml 확인:**

프로젝트 루트의 `amplify.yml` 파일이 자동으로 사용됩니다. IT 환경 전용 설정이 필요하면:

```yaml
version: 1
frontend:
  phases:
    preBuild:
      commands:
        - npm ci
        - npx prisma generate
    build:
      commands:
        - npm run build
  artifacts:
    baseDirectory: .next
    files:
      - '**/*'
  cache:
    paths:
      - node_modules/**/*
      - .next/cache/**/*
      - .prisma/**/*
```

#### 4단계: 환경 변수 설정

**Amplify Console** → **앱 선택** → **환경 변수** → **환경 변수 관리**

**필수 환경 변수:**

```bash
# 환경 구분
APP_ENV=integration
NODE_ENV=production

# IT 환경 데이터베이스
DATABASE_URL=postgresql://postgres:namoai20250701@namoai-it.cluwk88i28od.ap-northeast-1.rds.amazonaws.com:5432/postgres
IT_DATABASE_URL=postgresql://postgres:namoai20250701@namoai-it.cluwk88i28od.ap-northeast-1.rds.amazonaws.com:5432/postgres

# IT 환경 RDS 제어용
IT_RDS_INSTANCE_IDENTIFIER=namoai-it
AWS_REGION=ap-northeast-1

# NextAuth
NEXTAUTH_SECRET=your-nextauth-secret
NEXTAUTH_URL=https://it-test.namos-chat.com  # IT 환경 URL

# Google OAuth (필요한 경우)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Supabase (필요한 경우)
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-key

# Cloudflare R2 (필요한 경우)
CLOUDFLARE_ACCOUNT_ID=your-account-id
CLOUDFLARE_R2_ACCESS_KEY_ID=your-access-key
CLOUDFLARE_R2_SECRET_ACCESS_KEY=your-secret-key
CLOUDFLARE_R2_BUCKET_NAME=chat-images
CLOUDFLARE_R2_PUBLIC_URL=your-r2-public-url

# OpenAI (필요한 경우)
OPENAI_API_KEY=your-openai-key

# Google Cloud (필요한 경우)
GOOGLE_PROJECT_ID=your-project-id
```

**⚠️ 중요:**
- `DATABASE_URL`과 `IT_DATABASE_URL`을 동일하게 설정 (IT 환경 DB)
- `APP_ENV=integration`으로 설정하여 IT 환경으로 인식
- `NEXTAUTH_URL`은 IT 환경의 실제 URL로 설정

#### 5단계: 도메인 설정 (선택사항)

1. **앱 설정** → **도메인 관리**
2. **도메인 추가** → IT 환경 전용 도메인 설정
   - 예: `it-test.namos-chat.com`
   - 또는 Amplify 기본 URL 사용 가능

#### 6단계: 배포

1. **저장 후 배포** 클릭
2. 빌드 및 배포 진행 상황 확인
3. 배포 완료 후 IT 환경 URL 확인

---

### 방법 2: AWS CLI로 생성

```bash
# Amplify 앱 생성
aws amplify create-app \
  --name namos-chat-it \
  --repository https://github.com/your-org/namos-chat-v1 \
  --platform WEB \
  --environment-variables APP_ENV=integration,NODE_ENV=production

# 브랜치 생성 및 배포
aws amplify create-branch \
  --app-id <app-id> \
  --branch-name it-test

# 배포 시작
aws amplify start-job \
  --app-id <app-id> \
  --branch-name it-test \
  --job-type RELEASE
```

---

## 🔄 환경별 비교

| 항목 | 로컬 | IT 환경 | 혼방(스테이징) | 프로덕션 |
|------|------|---------|----------------|----------|
| **Amplify 앱** | ❌ 없음 | ✅ 별도 앱 | ✅ 별도 앱 | ✅ 별도 앱 |
| **URL** | localhost:3000 | it-test.namos-chat.com | staging.namos-chat.com | namos-chat.com |
| **데이터베이스** | 로컬 PostgreSQL | IT RDS | 스테이징 RDS | 프로덕션 RDS |
| **APP_ENV** | local | integration | staging | production |
| **용도** | 개발 | 통합 테스트 | QA 검증 | 실제 서비스 |

---

## ✅ 체크리스트

구축 완료 후 확인 사항:

- [ ] IT 환경 Amplify 앱 생성 완료
- [ ] IT 환경 전용 브랜치 연결 완료
- [ ] 환경 변수 설정 완료 (APP_ENV=integration, DATABASE_URL 등)
- [ ] 빌드 및 배포 성공
- [ ] IT 환경 URL 접속 가능
- [ ] 데이터베이스 연결 확인
- [ ] 관리 패널에서 IT 환경 제어 가능

---

## 🔧 문제 해결

### 문제 1: 빌드 실패

**원인:**
- 환경 변수 미설정
- Prisma 마이그레이션 실패

**해결:**
1. 환경 변수 확인 (특히 `DATABASE_URL`)
2. `amplify.yml`에서 Prisma 명령어 확인
3. 빌드 로그 확인

### 문제 2: 데이터베이스 연결 실패

**원인:**
- 보안 그룹 규칙 미설정
- 잘못된 데이터베이스 URL

**해결:**
1. RDS 보안 그룹에 Amplify IP 허용
2. `DATABASE_URL` 확인
3. RDS 인스턴스 상태 확인 (실행 중인지)

### 문제 3: IT 환경이 스테이징과 동일하게 동작

**원인:**
- `APP_ENV` 환경 변수 미설정 또는 잘못 설정

**해결:**
1. Amplify 환경 변수에서 `APP_ENV=integration` 확인
2. 애플리케이션 코드에서 환경 구분 로직 확인

---

## 📚 참고 자료

- [AWS Amplify 공식 문서](https://docs.aws.amazon.com/amplify/)
- [Amplify 환경 변수 설정](https://docs.aws.amazon.com/amplify/latest/userguide/environment-variables.html)
- [Amplify 브랜치 관리](https://docs.aws.amazon.com/amplify/latest/userguide/managing-branches.html)

---

**작성일:** 2025-01-27  
**다음 단계:** IT 환경 Amplify 앱 구축 후 연결 테스트


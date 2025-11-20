# AWS 배포 가이드 (Netlify와 병행 운영)

## 🎯 목표
- Netlify 환경은 그대로 유지
- AWS 환경에서도 동일한 애플리케이션 운영
- 두 환경 모두 동일한 데이터베이스(Supabase)와 서비스 사용

---

## 📋 AWS 배포 옵션

### 옵션 1: AWS Amplify (추천 - 가장 간단)
**장점:**
- Next.js 최적화
- 자동 빌드/배포
- Git 연동
- 환경 변수 관리 쉬움

**단점:**
- 커스터마이징 제한
- 비용이 Lambda보다 약간 높을 수 있음

### 옵션 2: Lambda + API Gateway + CloudFront
**장점:**
- 세밀한 제어
- 비용 효율적 (사용량 기반)
- 확장성 우수

**단점:**
- 설정 복잡
- DevOps 지식 필요

### 옵션 3: ECS/Fargate (컨테이너)
**장점:**
- 완전한 제어
- 컨테이너 기반

**단점:**
- 가장 복잡
- 관리 부담

**→ 추천: 옵션 1 (AWS Amplify)로 시작**

---

## 🚀 AWS Amplify 배포 가이드

### 1단계: AWS Amplify 앱 생성

**AWS Amplify란?**
- AWS에서 제공하는 **웹 애플리케이션 호스팅 서비스**
- Next.js, React 등 프론트엔드 앱을 자동으로 빌드하고 배포해주는 서비스
- Netlify와 비슷한 역할 (자동 빌드/배포, CDN, 환경 변수 관리 등)

**"Host web app"이란?**
- "웹 앱을 호스팅하겠다" = "웹 앱을 배포할 Amplify 앱을 만들겠다"
- 이것이 바로 **Amplify 앱을 생성하는 과정**입니다
- "New app" → "Host web app" = 새 Amplify 앱 생성

**단계별 설명:**

1. **AWS Console 접속**
   ```
   https://console.aws.amazon.com/amplify/
   ```
   - 회사 AWS 계정으로 로그인
   - 처음 접속하면 빈 화면 또는 "Get started" 화면이 나옵니다

2. **새 앱 생성 시작**
   - 화면 오른쪽 상단에 **"New app"** 버튼 클릭
   - 또는 중앙에 있는 큰 **"New app"** 버튼 클릭
   - 클릭하면 드롭다운 메뉴가 나타납니다

3. **"Host web app" 선택 (이게 앱 생성!)**
   - 드롭다운에서 **"Host web app"** 선택
   - ⚠️ **이것이 바로 Amplify 앱을 생성하는 과정입니다!**
   - "Host web app" = "웹 앱을 호스팅할 Amplify 앱을 만들겠다"
   - (다른 옵션: "Deploy without Git" - Git 없이 수동 배포, 거의 안 씀)

4. **Git 리포지토리 연결**
   - **Git provider 선택**: 
     - GitHub (가장 많이 사용)
     - GitLab
     - Bitbucket
     - AWS CodeCommit
   - **"Connect branch"** 또는 **"Connect repository"** 버튼 클릭
   - GitHub인 경우:
     - GitHub 로그인 화면으로 이동
     - GitHub 계정 인증
     - 리포지토리 목록에서 `namos-chat-v1` 선택
   - **Branch 선택**: `main` (또는 배포할 브랜치)
   - **"Next"** 또는 **"Save and deploy"** 클릭

5. **빌드 설정 확인**
   - Amplify가 자동으로 Next.js를 감지합니다
   - `amplify.yml` 파일이 있으면 자동으로 사용
   - 없으면 기본 설정 사용 (수동으로 수정 가능)

3. **빌드 설정**
   - Amplify가 자동으로 Next.js 감지
   - 빌드 설정 확인:
   ```yaml
   version: 1
   frontend:
     phases:
       preBuild:
         commands:
           - npm ci
           - node scripts/load-gsm-secrets.js
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
   ```

### 2단계: 환경 변수 설정

**AWS Amplify Console → App settings → Environment variables**

다음 환경 변수들을 설정:

#### 필수 환경 변수
```
# Google Cloud Platform
GOOGLE_PROJECT_ID=your-gcp-project-id
GOOGLE_APPLICATION_CREDENTIALS_JSON_BASE64=<base64-encoded-service-account-json>

# Google OAuth
GOOGLE_CLIENT_ID=your-google-oauth-client-id
GOOGLE_CLIENT_SECRET=your-google-oauth-client-secret

# Supabase (또는 GCP Secret Manager에서 로드)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Database
DATABASE_URL=postgresql://postgres:password@host:5432/postgres

# OpenAI
OPENAI_API_KEY=sk-...

# NextAuth
NEXTAUTH_URL=https://your-amplify-domain.amplifyapp.com
NEXTAUTH_SECRET=your-secret-key

# Upstash Redis (선택)
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...
```

**참고:** 
- `NEXT_PUBLIC_*` 변수는 빌드 시점에 주입됨
- Secret 값들은 AWS Secrets Manager 사용 권장 (아래 참조)

### 3단계: AWS Secrets Manager 연동 (선택, 권장)

민감한 정보는 AWS Secrets Manager에 저장하고 Amplify에서 참조:

1. **Secrets Manager에 시크릿 생성**
   ```
   AWS Console → Secrets Manager → Store a new secret
   - Secret type: Other type of secret
   - Key/value pairs:
     * SUPABASE_SERVICE_ROLE_KEY
     * OPENAI_API_KEY
     * DATABASE_URL
     * GOOGLE_CLIENT_SECRET
     * NEXTAUTH_SECRET
   ```

2. **Amplify에서 Secrets Manager 참조**
   - App settings → Environment variables
   - "Reference a secret" 선택
   - Secret ARN 입력

### 4단계: 빌드 스크립트 수정

`amplify.yml` 파일 생성 (프로젝트 루트):

```yaml
version: 1
frontend:
  phases:
    preBuild:
      commands:
        - echo "Installing dependencies..."
        - npm ci
        - echo "Loading secrets from GCP Secret Manager..."
        - node scripts/load-gsm-secrets.js
    build:
      commands:
        - echo "Generating Prisma client..."
        - npx prisma generate
        - echo "Building Next.js app..."
        - npm run build
  artifacts:
    baseDirectory: .next
    files:
      - '**/*'
  cache:
    paths:
      - node_modules/**/*
      - .next/cache/**/*
```

### 5단계: 커스텀 도메인 설정 (선택)

1. **Amplify Console → Domain management**
2. **Add domain** 클릭
3. 도메인 입력 (예: `aws.yourdomain.com`)
4. DNS 설정 안내에 따라 Route 53 또는 다른 DNS에 CNAME 추가

---

## 🔄 Netlify와 AWS 동시 운영

### 환경 구분 방법

#### 방법 1: 환경 변수로 구분
```typescript
// src/lib/config.ts
export const isAWS = process.env.AWS_EXECUTION_ENV !== undefined;
export const isNetlify = process.env.NETLIFY === 'true';

export const getDeploymentEnv = () => {
  if (isAWS) return 'aws';
  if (isNetlify) return 'netlify';
  return 'local';
};
```

#### 방법 2: 도메인으로 구분
- Netlify: `app.yourdomain.com`
- AWS: `aws.yourdomain.com` 또는 `api.yourdomain.com`

### 공통 리소스 사용
- ✅ **Supabase**: 두 환경 모두 동일한 DB/Storage 사용
- ✅ **GCP Secret Manager**: 두 환경 모두 동일한 시크릿 사용
- ✅ **Upstash Redis**: 두 환경 모두 동일한 Redis 사용

### 환경별 설정 차이
- **NEXTAUTH_URL**: 각 환경의 도메인에 맞게 설정
- **빌드 명령**: 환경에 따라 약간 다를 수 있음

---

## 📝 Lambda + API Gateway 배포 (고급 옵션)

Amplify 대신 Lambda를 사용하려면:

### 1. Serverless Framework 사용

```bash
npm install -g serverless
npm install --save-dev serverless-nextjs-plugin
```

### 2. `serverless.yml` 생성

```yaml
service: namos-chat

provider:
  name: aws
  runtime: nodejs20.x
  region: ap-northeast-1
  environment:
    GOOGLE_PROJECT_ID: ${env:GOOGLE_PROJECT_ID}
    # ... 기타 환경 변수

plugins:
  - serverless-nextjs-plugin

custom:
  nextjs:
    buildCommand: npm run build
```

### 3. 배포

```bash
serverless deploy
```

---

## 🔧 환경 변수 관리 전략

### 옵션 A: 각 플랫폼에서 직접 설정
- Netlify: Netlify Dashboard → Environment variables
- AWS: Amplify Console → Environment variables
- **장점**: 간단
- **단점**: 중복 관리

### 옵션 B: GCP Secret Manager 사용 (현재 방식)
- 두 환경 모두 GCP Secret Manager에서 로드
- **장점**: 중앙 관리
- **단점**: GCP 의존성

### 옵션 C: AWS Secrets Manager 사용
- AWS 환경: Secrets Manager 사용
- Netlify: 환경 변수 또는 GCP Secret Manager 사용
- **장점**: 각 플랫폼 최적화
- **단점**: 두 곳 관리

**→ 추천: 옵션 B (GCP Secret Manager) - 현재 구조 유지**

---

## 🚀 배포 워크플로우

### Netlify 배포
```bash
git push origin main
# Netlify가 자동으로 감지하여 배포
```

### AWS 배포
```bash
git push origin main
# AWS Amplify가 자동으로 감지하여 배포
```

또는 수동 배포:
```bash
# AWS Amplify CLI 사용
amplify publish
```

---

## 📊 모니터링 및 로그

### AWS CloudWatch
- Amplify Console → Monitoring
- Lambda 함수 로그 확인
- API Gateway 로그 확인

### Netlify Analytics
- Netlify Dashboard → Analytics
- Functions 로그 확인

---

## 💰 비용 비교

### AWS Amplify
- 빌드 시간: $0.01/분
- 호스팅: 무료 티어 (제한 있음)
- 데이터 전송: $0.15/GB

### Lambda + API Gateway
- Lambda: $0.20/1M 요청
- API Gateway: $1.00/1M 요청
- CloudFront: $0.114/GB (일본 리전)

---

## ✅ 체크리스트

### AWS Amplify 설정
- [ ] AWS 계정 생성 완료
- [ ] Amplify 앱 생성
- [ ] GitHub 리포지토리 연결
- [ ] 빌드 설정 확인 (`amplify.yml`)
- [ ] 환경 변수 설정
- [ ] Secrets Manager 연동 (선택)
- [ ] 첫 배포 성공
- [ ] 커스텀 도메인 설정 (선택)

### 환경 변수
- [ ] GCP 관련 변수 설정
- [ ] Supabase 관련 변수 설정
- [ ] OpenAI API 키 설정
- [ ] NextAuth 설정
- [ ] Redis 설정 (선택)

### 테스트
- [ ] AWS 환경에서 로그인 테스트
- [ ] API 엔드포인트 테스트
- [ ] 데이터베이스 연결 테스트
- [ ] 이미지 업로드 테스트
- [ ] Netlify와 AWS 동시 운영 확인

---

## 🔍 문제 해결

### 빌드 실패
- CloudWatch Logs에서 에러 확인
- 환경 변수 누락 확인
- GCP Secret Manager 접근 권한 확인

### 환경 변수 로드 실패
- `scripts/load-gsm-secrets.js` 실행 확인
- GCP 서비스 계정 권한 확인
- Base64 인코딩 확인

### 배포 후 404 에러
- Next.js 라우팅 설정 확인
- `amplify.yml` artifacts 경로 확인

---

## 📚 참고 자료

- [AWS Amplify 문서](https://docs.aws.amazon.com/amplify/)
- [Next.js on AWS](https://nextjs.org/docs/deployment)
- [Serverless Next.js](https://github.com/serverless-nextjs/serverless-next.js)

---

## 🎯 다음 단계

1. **AWS Amplify 앱 생성** (가장 빠른 시작)
2. **환경 변수 설정**
3. **첫 배포 테스트**
4. **Netlify와 비교 테스트**
5. **트래픽 분산 전략 수립** (선택)


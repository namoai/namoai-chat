# AWS Amplify 환경 변수 설정 옵션

## ✅ GSM 없이도 가능합니다!

AWS Amplify는 **Netlify보다 훨씬 여유로운 제한**이 있어서 환경 변수를 직접 설정해도 됩니다.

## 📊 비교: Netlify vs AWS Amplify

### Netlify 제한
- **환경 변수 크기**: 약 4KB 제한
- **총 환경 변수**: 제한 있음
- **GSM 사용 이유**: 바이트 제한 때문에 큰 값(서비스 계정 JSON 등)은 GSM 사용

### AWS Amplify 제한
- **환경 변수 크기**: **약 4KB** (Netlify와 비슷)
- **하지만**: AWS Secrets Manager 연동 가능
- **또는**: 환경 변수를 여러 개로 나눠서 설정 가능

## 🎯 AWS Amplify 환경 변수 옵션

### 옵션 1: 환경 변수 직접 설정 (Netlify처럼) ✅ 추천

**장점:**
- 간단하고 빠름
- GSM 의존성 없음
- Netlify와 동일한 방식

**단점:**
- 큰 값(서비스 계정 JSON)은 Base64로 인코딩 필요
- 환경 변수 크기 제한 (약 4KB)

**설정 방법:**
1. AWS Amplify → 호스팅 → main 브랜치 → 환경 변수
2. 각 환경 변수 직접 입력

**주의:**
- `GOOGLE_APPLICATION_CREDENTIALS_JSON_BASE64`는 Base64 인코딩된 값
- 약 2-3KB 정도면 문제없음

### 옵션 2: AWS Secrets Manager 사용

**장점:**
- 더 안전 (암호화 저장)
- 크기 제한 없음
- 중앙 관리

**단점:**
- 추가 설정 필요
- AWS Secrets Manager 비용 (매우 저렴)

**설정 방법:**
1. AWS Secrets Manager에 시크릿 생성
2. Amplify에서 Secrets Manager 참조

### 옵션 3: GCP Secret Manager 계속 사용 (현재 구조 유지)

**장점:**
- 현재 코드 구조 그대로 사용
- Netlify와 동일한 방식
- 이미 설정되어 있음

**단점:**
- GCP 의존성
- 빌드 시 GSM 접근 필요

**필요한 환경 변수:**
- `GOOGLE_PROJECT_ID`
- `GOOGLE_APPLICATION_CREDENTIALS_JSON_BASE64` (GCP 서비스 계정 키)

## 💡 추천: 옵션 1 (환경 변수 직접 설정)

**이유:**
1. **간단함**: 추가 설정 불필요
2. **Netlify와 동일**: 동일한 방식으로 관리
3. **충분한 크기**: Base64 인코딩된 서비스 계정 키도 들어감
4. **빠른 시작**: 바로 설정 가능

## 📋 설정해야 할 환경 변수 목록

### 필수 (직접 설정)

```
# Google Cloud Platform
GOOGLE_PROJECT_ID=your-gcp-project-id
GOOGLE_APPLICATION_CREDENTIALS_JSON_BASE64=<base64-encoded-service-account-json>

# Google OAuth
GOOGLE_CLIENT_ID=your-google-oauth-client-id
GOOGLE_CLIENT_SECRET=your-google-oauth-client-secret

# Supabase
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
NEXTAUTH_URL=https://main.d1pjenj3kb3pau.amplifyapp.com
NEXTAUTH_SECRET=your-secret-key

# Upstash Redis (선택)
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...
```

## 🔄 코드 동작 방식

### 현재 코드 구조
```javascript
// scripts/load-gsm-secrets.js
// GCP Secret Manager에서 시크릿 로드 시도
// 실패하면 환경 변수 사용 (fallback)
```

**AWS Amplify에서:**
- 환경 변수를 직접 설정하면
- `load-gsm-secrets.js`가 GSM 접근 실패해도
- 환경 변수에서 직접 읽어서 작동 ✅

### 빌드 프로세스

**amplify.yml:**
```yaml
preBuild:
  commands:
    - node scripts/load-gsm-secrets.js  # GSM 시도, 실패해도 OK
    - npm ci
```

**동작:**
1. GSM 접근 시도 (실패해도 OK)
2. 환경 변수에서 직접 읽기
3. 정상 작동 ✅

## ⚠️ 주의사항

### Base64 인코딩 크기
- GCP 서비스 계정 JSON: 약 2-3KB
- Base64 인코딩: 약 2.7-4KB
- **4KB 제한 내에 들어감** ✅

### NEXT_PUBLIC_* 변수
- 빌드 시점에 주입됨
- 클라이언트에 노출됨
- 공개되어도 안전한 값만 사용

## 🚀 빠른 설정

### 지금 바로 할 것:

1. **AWS Amplify → 호스팅 → main → 환경 변수**
2. **위 목록의 환경 변수들 모두 추가**
3. **빌드 테스트**

GSM 없이도 완벽하게 작동합니다!

## 📝 요약

- ✅ **GSM 없이도 가능**: 환경 변수 직접 설정
- ✅ **Netlify와 동일**: 같은 방식으로 관리
- ✅ **크기 충분**: Base64 인코딩된 값도 들어감
- ✅ **코드 수정 불필요**: 현재 코드 그대로 작동

**결론: GSM 없이 환경 변수 직접 설정하는 것을 추천합니다!**


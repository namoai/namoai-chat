# AWS Amplify 환경 변수 설정 가이드

## ✅ 확인: AWS Amplify가 맞습니다!
스크린샷을 보니 `namoai-chat` Amplify 앱이 정상적으로 생성되어 있습니다.
- **프로덕션 URL**: `https://main.d1pjenj3kb3pau.amplifyapp.com`
- **리전**: `ap-southeast-2` (Sydney)
- **프레임워크**: Next.js - SSR

## 🔍 환경 변수 설정 위치 (단계별)

### ✅ 정확한 방법: 브랜치 이름 클릭

스크린샷을 보니 **브랜치 설정** 페이지에 있습니다. 다음 순서로 진행하세요:

1. **브랜치 테이블에서 `main` 브랜치 이름 클릭**
   - 테이블에서 `main` (보라색 점이 있는 것) 클릭
   - 또는 `main` 텍스트를 직접 클릭

2. **브랜치 상세 페이지로 이동**
   - 클릭하면 `main` 브랜치의 상세 설정 페이지로 이동합니다

3. **"환경 변수" 탭 찾기**
   - 상세 페이지에서 여러 탭이 보일 것입니다:
     - "일반" (General)
     - "빌드 설정" (Build settings)
     - **"환경 변수"** (Environment variables) ← 여기!
     - "리디렉션 및 재작성" (Redirects and rewrites)
     - 등등

4. **"환경 변수" 탭 클릭**

5. **"환경 변수 추가"** (Add environment variable) 버튼 클릭

### 방법 2: 호스팅 메뉴에서

1. **왼쪽 사이드바** → **"호스팅"** (Hosting) 클릭
2. **`main` 브랜치 클릭** (또는 브랜치 카드 클릭)
3. **"환경 변수"** 탭 찾기

### 방법 3: Build settings에서 설정

1. **왼쪽 사이드바** → **"호스팅"** (Hosting) 클릭
2. **브랜치 선택** (예: `main`)
3. **"작업"** (Actions) → **"빌드 설정 편집"** (Edit build settings)
4. **"환경 변수"** 섹션에서 추가

## 📋 설정해야 할 환경 변수

### 필수 환경 변수

```
# Google Cloud Platform
GOOGLE_PROJECT_ID=your-gcp-project-id
GOOGLE_APPLICATION_CREDENTIALS_JSON_BASE64=<base64-encoded-json>

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

## 🔍 찾을 수 없을 때

### AWS Amplify Console UI 변경 가능성
최신 버전에서는 메뉴 위치가 다를 수 있습니다:

1. **왼쪽 사이드바에서 찾기:**
   - "앱 설정" → "환경 변수"
   - "호스팅" → 브랜치 선택 → "환경 변수"
   - "빌드 설정" → "환경 변수"

2. **검색 기능 사용:**
   - AWS Console 상단 검색창에 "environment variables" 입력

3. **직접 URL 접근:**
   ```
   https://console.aws.amazon.com/amplify/home?region=ap-southeast-2#/d1pjenj3kb3pau/environment-variables
   ```

## 💡 대안: amplify.yml에서 설정

환경 변수를 `amplify.yml` 파일에서 직접 참조할 수도 있습니다:

```yaml
version: 1
frontend:
  phases:
    preBuild:
      commands:
        - echo "Loading environment variables..."
        - export GOOGLE_PROJECT_ID=$GOOGLE_PROJECT_ID
        # ... 기타 변수들
```

하지만 **Amplify Console에서 설정하는 것이 더 안전**합니다.

## 🚀 빠른 확인 방법

1. **왼쪽 사이드바** → **"앱 설정"** 클릭
2. 메뉴 목록 확인:
   - 일반 설정
   - 브랜치 설정 ← 여기 확인!
   - IAM 역할
   - **환경 변수** ← 이게 있어야 함!

3. **없다면:**
   - "브랜치 설정" 클릭
   - 브랜치 선택 후 환경 변수 탭 확인

## ⚠️ 주의사항

### NEXT_PUBLIC_* 변수
- 빌드 시점에 주입됨
- 클라이언트에 노출됨 (공개되어도 안전한 값만)

### Secret 값들
- `GOOGLE_APPLICATION_CREDENTIALS_JSON_BASE64`
- `OPENAI_API_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- 등은 **절대 공개되지 않도록** 주의

## 📞 문제 해결

### 환경 변수가 보이지 않을 때
1. **브라우저 새로고침** (F5)
2. **다른 브라우저로 시도**
3. **AWS Console 로그아웃 후 재로그인**
4. **리전 확인** (ap-southeast-2)

### AWS Support 문의
- 환경 변수 메뉴가 아예 없는 경우
- AWS Support에 문의


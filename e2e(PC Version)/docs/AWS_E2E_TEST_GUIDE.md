# AWS Amplify 환경에서 E2E 테스트 실행 가이드

AWS Amplify에 배포된 환경을 대상으로 E2E 테스트를 실행하는 방법입니다.

> **참고**: 이 가이드는 EC2 인스턴스 없이 로컬 환경, GitHub Actions, 또는 CodeBuild에서 Amplify 배포 URL로 테스트를 실행하는 방법을 안내합니다.

## 1. 필요 환경 변수

E2E 테스트에 필요한 환경 변수:

```bash
# 필수
PLAYWRIGHT_BASE_URL=https://your-app-id.amplify.app  # Amplify 배포 URL (예: https://main.d1234567890.amplify.app)
ADMIN_EMAIL=your-admin-email@example.com
ADMIN_PASSWORD=your-admin-password

# 또는 일반 테스트 계정 사용
TEST_EMAIL=test-user@example.com
TEST_PASSWORD=test-password

# 선택 (Basic 인증이 필요한 경우)
ADMIN_BASIC_AUTH_USER=basic-auth-username
ADMIN_BASIC_AUTH_PASSWORD=basic-auth-password
```

## 2. Amplify URL 확인 방법

1. **AWS Amplify Console** 접속
2. **앱 선택** → **앱 설정** → **일반** 
3. **앱 도메인** 확인 (예: `https://main.d1234567890.amplify.app`)

또는 커스텀 도메인이 있다면 해당 도메인 사용

## 3. 실행 방법

### 방법 1: 로컬 환경에서 Amplify URL로 실행 (가장 간단) ⭐

로컬 컴퓨터에서 AWS Amplify에 배포된 환경을 대상으로 테스트를 실행하는 방법입니다.

#### 3.1 환경 변수 설정

**Windows (PowerShell):**
```powershell
# 환경 변수 설정
$env:PLAYWRIGHT_BASE_URL="https://your-app-id.amplify.app"
$env:ADMIN_EMAIL="your-admin-email@example.com"
$env:ADMIN_PASSWORD="your-admin-password"
$env:TEST_EMAIL="test-user@example.com"
$env:TEST_PASSWORD="test-password"

# 테스트 실행
npm run test:e2e
```

**macOS/Linux:**
```bash
# 환경 변수 설정
export PLAYWRIGHT_BASE_URL=https://your-app-id.amplify.app
export ADMIN_EMAIL=your-admin-email@example.com
export ADMIN_PASSWORD=your-admin-password
export TEST_EMAIL=test-user@example.com
export TEST_PASSWORD=test-password

# 테스트 실행
npm run test:e2e
```

**또는 .env.local 파일 생성:**
```bash
# .env.local 파일
PLAYWRIGHT_BASE_URL=https://your-app-id.amplify.app
ADMIN_EMAIL=your-admin-email@example.com
ADMIN_PASSWORD=your-admin-password
TEST_EMAIL=test-user@example.com
TEST_PASSWORD=test-password
```

그리고 테스트 실행:
```bash
npm run test:e2e
```

#### 3.2 테스트 실행

```bash
# 전체 테스트 실행
npm run test:e2e

# 특정 테스트만 실행
npx playwright test e2e/admin-notices.spec.ts

# 특정 테스트 케이스만 실행
npx playwright test e2e/admin-notices.spec.ts -g "2-4-1"

# UI 모드로 실행 (디버깅용)
npm run test:e2e:ui

# 헤드 모드로 실행 (브라우저 창 표시)
npm run test:e2e:headed
```

---

### 방법 2: GitHub Actions에서 실행

#### 2.1 GitHub Secrets 설정

GitHub 저장소 → **Settings** → **Secrets and variables** → **Actions**

다음 Secrets 추가:
- `PLAYWRIGHT_BASE_URL`: Amplify 앱 URL (예: `https://main.d1234567890.amplify.app`)
- `ADMIN_EMAIL`: 관리자 이메일
- `ADMIN_PASSWORD`: 관리자 비밀번호
- `TEST_EMAIL`: 테스트 계정 이메일
- `TEST_PASSWORD`: 테스트 계정 비밀번호

#### 2.2 GitHub Actions 워크플로우 생성

`.github/workflows/e2e-amplify.yml` 파일 생성:

```yaml
name: E2E Tests on Amplify

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]
  workflow_dispatch:

jobs:
  e2e-tests:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '20'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Install Playwright browsers
      run: |
        npx playwright install chromium
        npx playwright install-deps chromium
    
    - name: Run E2E tests
      env:
        PLAYWRIGHT_BASE_URL: ${{ secrets.PLAYWRIGHT_BASE_URL }}
        ADMIN_EMAIL: ${{ secrets.ADMIN_EMAIL }}
        ADMIN_PASSWORD: ${{ secrets.ADMIN_PASSWORD }}
        TEST_EMAIL: ${{ secrets.TEST_EMAIL }}
        TEST_PASSWORD: ${{ secrets.TEST_PASSWORD }}
      run: npm run test:e2e
    
    - name: Upload test results
      uses: actions/upload-artifact@v3
      if: always()
      with:
        name: playwright-report
        path: playwright-report/
        retention-days: 30
```

---

### 방법 3: AWS CodeBuild에서 실행

#### 3.1 buildspec.yml 생성

프로젝트 루트에 `buildspec-e2e.yml` 파일 생성:

```yaml
version: 0.2

phases:
  pre_build:
    commands:
      - echo "Installing dependencies..."
      - npm ci
      - echo "Installing Playwright browsers..."
      - npx playwright install chromium
      - npx playwright install-deps chromium
  build:
    commands:
      - echo "Running E2E tests on Amplify..."
      - |
        export PLAYWRIGHT_BASE_URL=$PLAYWRIGHT_BASE_URL
        export ADMIN_EMAIL=$ADMIN_EMAIL
        export ADMIN_PASSWORD=$ADMIN_PASSWORD
        export TEST_EMAIL=$TEST_EMAIL
        export TEST_PASSWORD=$TEST_PASSWORD
        npm run test:e2e
artifacts:
  files:
    - test-results/**/*
    - playwright-report/**/*
  name: e2e-test-results
reports:
  e2e-test-report:
    files:
      - 'test-results/**/*'
    base-directory: test-results
```

#### 3.2 CodeBuild 프로젝트 생성

1. **AWS Console** → **CodeBuild** → **프로젝트 생성**

2. **환경 설정:**
   - 운영 체제: Ubuntu
   - 런타임: Standard
   - 이미지: aws/codebuild/standard:7.0 (또는 최신 버전)
   - 환경 유형: Linux

3. **환경 변수 추가:**
   ```
   PLAYWRIGHT_BASE_URL = https://your-app-id.amplify.app (Amplify 앱 URL)
   ADMIN_EMAIL = your-admin-email@example.com
   ADMIN_PASSWORD = your-admin-password (SecureString으로 설정)
   TEST_EMAIL = test-user@example.com
   TEST_PASSWORD = test-password (SecureString으로 설정)
   ```

4. **빌드 사양:**
   - 빌드 사양 파일: `buildspec-e2e.yml`

5. **소스 설정:**
   - 소스 공급자: GitHub, CodeCommit, 또는 S3
   - 저장소 선택

#### 3.3 실행

```bash
# CodeBuild 프로젝트 시작
aws codebuild start-build --project-name namos-chat-e2e-tests --region ap-northeast-1
```

---

### 방법 4: Amplify Build Settings에서 실행 (선택사항)

Amplify의 빌드 프로세스에 E2E 테스트를 통합할 수도 있습니다.

#### 4.1 amplify.yml 수정

`amplify.yml` 파일에 테스트 단계 추가:

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
    postBuild:
      commands:
        # E2E 테스트 실행 (선택사항)
        - |
          if [ "$AWS_BRANCH" = "main" ] || [ "$AWS_BRANCH" = "develop" ]; then
            echo "Installing Playwright..."
            npx playwright install chromium
            echo "Running E2E tests..."
            PLAYWRIGHT_BASE_URL=$AWS_APP_URL npm run test:e2e || true
          fi
  artifacts:
    baseDirectory: .next
    files:
      - '**/*'
  cache:
    paths:
      - node_modules/**/*
      - .next/cache/**/*
```

> **참고**: Amplify 빌드에서 테스트를 실행하면 빌드 시간이 길어질 수 있습니다. 일반적으로는 별도로 실행하는 것을 권장합니다.

---

## 4. 실행 예시

### 로컬에서 실행 (가장 간단)

```bash
# 1. 환경 변수 설정 (Windows PowerShell)
$env:PLAYWRIGHT_BASE_URL="https://main.d1234567890.amplify.app"
$env:ADMIN_EMAIL="admin@example.com"
$env:ADMIN_PASSWORD="your-password"

# 또는 .env.local 파일에 작성
# PLAYWRIGHT_BASE_URL=https://main.d1234567890.amplify.app
# ADMIN_EMAIL=admin@example.com
# ADMIN_PASSWORD=your-password

# 2. 테스트 실행
npm run test:e2e

# 3. 특정 테스트만 실행
npx playwright test e2e/admin-notices.spec.ts -g "2-4-1"

# 4. 결과 확인
npm run test:e2e:report
```

---

## 5. 테스트 결과 확인

### 5.1 리포트 확인

```bash
# HTML 리포트 열기
npm run test:e2e:report

# 또는 직접 열기
npx playwright show-report
```

### 5.2 테스트 결과 저장 (CodeBuild/GitHub Actions)

테스트 결과는 다음 위치에 저장됩니다:
- `test-results/`: 스크린샷, 비디오, 트레이스
- `playwright-report/`: HTML 리포트

---

## 6. 문제 해결

### 6.1 브라우저 설치 오류

```bash
# 의존성 설치
npx playwright install-deps chromium

# 또는 Ubuntu/Debian에서
sudo apt-get update
sudo apt-get install -y libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libasound2
```

### 6.2 타임아웃 오류

`playwright.config.ts`에서 타임아웃 증가:

```typescript
timeout: 120 * 1000, // 120초
navigationTimeout: 120 * 1000,
```

### 6.3 네트워크 연결 오류

- Amplify 앱 URL이 올바른지 확인
- DNS 해석 확인
- 방화벽/보안 그룹 설정 확인 (로컬에서 실행하는 경우)

---

## 참고

- [Playwright 공식 문서](https://playwright.dev/)
- [AWS Amplify 문서](https://docs.aws.amazon.com/amplify/)
- [AWS CodeBuild 문서](https://docs.aws.amazon.com/codebuild/)

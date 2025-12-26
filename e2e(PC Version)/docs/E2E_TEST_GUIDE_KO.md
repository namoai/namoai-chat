# E2E 테스트 완전 가이드 (한국어)

**최종 업데이트**: 2025년 12월 22일

---

## 📋 목차

1. [빠른 시작](#빠른-시작)
2. [기본 실행 방법](#기본-실행-방법)
3. [관리자 로그인 설정](#관리자-로그인-설정)
4. [2FA 대응](#2fa-대응)
5. [디버그 모드](#디버그-모드)
6. [환경 변수 설정](#환경-변수-설정)
7. [문제 해결](#문제-해결)

---

## 🚀 빠른 시작

### 1. 사전 조건 확인

```bash
# Node.js 버전 확인
node --version  # 20.19.4 이상 필요

# npm 버전 확인
npm --version   # 10.8.2 이상 필요
```

### 2. Playwright 설치

```bash
# 브라우저 설치 (최초 1회만)
npx playwright install chromium
```

### 3. 개발 서버 실행 ⚠️ 필수

**⚠️ 중요: E2E 테스트는 웹 애플리케이션이 실행 중이어야 합니다!**

**별도 터미널에서 실행** (테스트 실행 전에 반드시 필요):

```bash
# 개발 서버 실행
npm run dev
```

서버가 실행되면 `http://localhost:3000`에 접속 가능한지 확인하세요.

**참고**: 
- CI/CD 환경에서는 자동으로 서버를 시작하도록 설정할 수 있습니다 (`playwright.config.ts`의 `webServer` 설정)
- 하지만 로컬 환경에서는 수동으로 `npm run dev`를 실행해야 합니다

### 4. 환경 변수 설정

```powershell
# Windows PowerShell
$env:PLAYWRIGHT_BASE_URL="http://localhost:3000"

# 관리자 테스트를 실행하는 경우
$env:ADMIN_BASIC_AUTH_USER="admin"
$env:ADMIN_BASIC_AUTH_PASSWORD="your-basic-auth-password"
$env:ADMIN_EMAIL="admin@example.com"
$env:ADMIN_PASSWORD="your-admin-password"

# 일반 사용자 테스트를 실행하는 경우
$env:TEST_EMAIL="test@example.com"
$env:TEST_PASSWORD="testpassword123"
```

### 5. 테스트 실행

```bash
# 모든 테스트 실행
npm run test:e2e

# P0 (크리티컬) 테스트만 실행
npm run test:e2e -- e2e/points-critical.spec.ts

# 관리자 테스트만 실행
npm run test:e2e -- e2e/admin-user-management.spec.ts
```

---

## 📝 기본 실행 방법

### 모든 테스트 실행 (P0 + P1 + P2)

```bash
# ⭐ 모든 테스트 실행 (권장)
npm run test:e2e
```

**포함되는 테스트**:
- P0 (크리티컬): 6개 테스트
- P1 (중요): 40개 테스트
- P2 (일반): 24개 테스트
- **총 70개 테스트**

### 특정 우선순위만 실행

```bash
# P0 (크리티컬) 테스트만 실행
npm run test:e2e -- e2e/points-critical.spec.ts

# 관리자 테스트만 실행
npm run test:e2e -- e2e/admin-user-management.spec.ts
```

### 특정 테스트 파일만 실행

```bash
# 인증 기능만
npm run test:e2e -- e2e/user-auth.spec.ts

# 채팅 기능만
npm run test:e2e -- e2e/chat.spec.ts

# 사용자 캐릭터 기능만
npm run test:e2e -- e2e/user-character.spec.ts
```

**⚠️ 주의**: 
- 두 개의 파일만 실행하면 **P1, P2 테스트가 누락**됩니다
- 모든 테스트를 실행하려면 `npm run test:e2e` (인자 없이)를 사용하세요

### 특정 테스트 케이스만 실행

```bash
# 테스트 이름으로 필터링
npm run test:e2e -- --grep "P0-1"
```

---

## 👤 관리자 로그인 설정

### 관리자 로그인 구조

관리자 페이지 접근은 **2단계 인증**을 사용합니다:

1. **Basic 인증** (HTTP Basic Auth)
   - 관리자 페이지 (`/admin/*`) 접근 시 먼저 요구됨
   - 환경 변수: `ADMIN_BASIC_AUTH_USER`, `ADMIN_BASIC_AUTH_PASSWORD`

2. **일반 로그인** (이메일/비밀번호)
   - Basic 인증 후, 서비스 이용을 위한 세션 인증
   - 환경 변수: `ADMIN_EMAIL`, `ADMIN_PASSWORD`

3. **2FA (이메일 기반)** - 선택사항
   - 관리자 계정의 2FA를 활성화한 경우에만 필요
   - **테스트에서는 비활성화 권장**

### 환경 변수 설정

```powershell
# Windows PowerShell

# Basic 인증 (관리자 페이지 접근용)
$env:ADMIN_BASIC_AUTH_USER="admin"
$env:ADMIN_BASIC_AUTH_PASSWORD="your-basic-auth-password"

# 일반 로그인 (세션 인증용)
$env:ADMIN_EMAIL="admin@example.com"
$env:ADMIN_PASSWORD="your-admin-password"
```

### .env.local 파일 (추천)

```bash
# .env.local
PLAYWRIGHT_BASE_URL=http://localhost:3000

# Basic 인증
ADMIN_BASIC_AUTH_USER=admin
ADMIN_BASIC_AUTH_PASSWORD=your-basic-auth-password

# 일반 로그인
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=your-admin-password

# 일반 사용자 테스트용
TEST_EMAIL=test@example.com
TEST_PASSWORD=testpassword123
```

### 2FA 비활성화 (권장)

관리자 계정의 2FA를 비활성화하면 테스트가 더 안정적입니다:

```sql
-- 데이터베이스에서 직접 비활성화
UPDATE users 
SET twoFactorEnabled = false 
WHERE email = 'admin@example.com';
```

또는 관리자 페이지에서 2FA 설정을 비활성화하세요.

---

## 🔐 2FA 대응

### 문제

**관리자 계정에 2FA (2단계 인증)가 설정되어 있는데, 테스트가 가능한가요?**

**답변**: ✅ **가능합니다. 관리자 계정의 2FA를 비활성화하면 됩니다.**

### 대응 방법

#### 방법 1: 2FA 비활성화 (추천)

가장 간단한 방법:

1. 관리자 계정의 2FA (이메일 기반) 비활성화
   - 관리자 페이지에서 2FA 설정 비활성화
   - 또는 데이터베이스에서 `twoFactorEnabled`를 `false`로 설정

2. 환경 변수 설정:
   ```powershell
   # Basic 인증 (관리자 페이지 접근용)
   $env:ADMIN_BASIC_AUTH_USER="admin"
   $env:ADMIN_BASIC_AUTH_PASSWORD="your-basic-auth-password"
   
   # 일반 로그인 (세션 인증용)
   $env:ADMIN_EMAIL="admin@example.com"
   $env:ADMIN_PASSWORD="your-admin-password"
   ```

3. 테스트 실행:
   ```bash
   npm run test:e2e -- e2e/admin-user-management.spec.ts
   ```

#### 방법 2: 2FA 코드 직접 제공 (권장하지 않음)

```powershell
# 2FA 코드를 환경 변수로 제공
$env:TEST_2FA_CODE="123456"

# 테스트 실행
npm run test:e2e
```

**주의**: 
- 매번 새 코드가 필요하므로 권장하지 않음
- 이메일 기반 2FA인 경우에만 유효

---

## 🎯 디버그 모드

### UI 모드 (추천)

브라우저에서 테스트를 시각적으로 확인하며 실행할 수 있습니다:

```bash
npm run test:e2e:ui
```

**특징**:
- 테스트를 단계별로 실행 가능
- 브라우저 조작을 실시간으로 확인
- 디버깅에 최적

### 헤드 모드 (브라우저 표시)

```bash
npm run test:e2e:headed
```

**특징**:
- 브라우저 창이 표시됨
- 테스트 동작을 직접 확인 가능

### 디버그 모드

```bash
npm run test:e2e:debug
```

**특징**:
- Playwright Inspector가 실행됨
- 브레이크포인트 설정 가능
- 단계별 실행 가능

---

## ⚙️ 환경 변수 설정

### Windows (PowerShell)

```powershell
# 테스트 대상 베이스 URL
$env:PLAYWRIGHT_BASE_URL="http://localhost:3000"

# Basic 인증 (관리자 페이지 접근용)
$env:ADMIN_BASIC_AUTH_USER="admin"
$env:ADMIN_BASIC_AUTH_PASSWORD="your-basic-auth-password"

# 일반 로그인
$env:ADMIN_EMAIL="admin@example.com"
$env:ADMIN_PASSWORD="your-admin-password"

# 일반 사용자 테스트용
$env:TEST_EMAIL="test@example.com"
$env:TEST_PASSWORD="testpassword123"

# 2FA 코드 (필요한 경우만, 비활성화 권장)
# $env:TEST_2FA_CODE="123456"
```

### Windows (CMD)

```cmd
set PLAYWRIGHT_BASE_URL=http://localhost:3000
set ADMIN_BASIC_AUTH_USER=admin
set ADMIN_BASIC_AUTH_PASSWORD=your-basic-auth-password
set ADMIN_EMAIL=admin@example.com
set ADMIN_PASSWORD=your-admin-password
set TEST_EMAIL=test@example.com
set TEST_PASSWORD=testpassword123
```

### Linux/Mac (Bash)

```bash
# 환경 변수 설정
export PLAYWRIGHT_BASE_URL=http://localhost:3000
export ADMIN_BASIC_AUTH_USER=admin
export ADMIN_BASIC_AUTH_PASSWORD=your-basic-auth-password
export ADMIN_EMAIL=admin@example.com
export ADMIN_PASSWORD=your-admin-password
export TEST_EMAIL=test@example.com
export TEST_PASSWORD=testpassword123

# 환경 변수 확인
echo $PLAYWRIGHT_BASE_URL
echo $ADMIN_BASIC_AUTH_USER
echo $ADMIN_EMAIL

# 모든 환경 변수 확인
env | grep PLAYWRIGHT
env | grep ADMIN
env | grep TEST

# 특정 환경 변수 존재 여부 확인
if [ -z "$ADMIN_BASIC_AUTH_USER" ]; then
  echo "ADMIN_BASIC_AUTH_USER가 설정되지 않았습니다"
else
  echo "ADMIN_BASIC_AUTH_USER: $ADMIN_BASIC_AUTH_USER"
fi
```

### .env.local 파일 사용 (추천)

프로젝트 루트에 `.env.local` 파일 생성:

```bash
# .env.local
PLAYWRIGHT_BASE_URL=http://localhost:3000

# Basic 인증
ADMIN_BASIC_AUTH_USER=admin
ADMIN_BASIC_AUTH_PASSWORD=your-basic-auth-password

# 일반 로그인
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=your-admin-password

# 일반 사용자 테스트용
TEST_EMAIL=test@example.com
TEST_PASSWORD=testpassword123
```

**주의**: `.env.local`이 `.gitignore`에 포함되어 있는지 확인하세요.

---

## 📊 테스트 결과 확인

### HTML 리포트 보기

```bash
npm run test:e2e:report
```

브라우저에서 HTML 리포트가 열리며, 다음을 확인할 수 있습니다:
- 테스트 결과 목록
- 실패한 테스트 상세 정보
- 스크린샷
- 동영상 (실패 시)
- 트레이스 (실패 시)

### 테스트 결과 저장 위치

- **HTML 리포트**: `playwright-report/`
- **스크린샷**: `test-results/`
- **동영상**: `test-results/` (실패 시만)
- **트레이스**: `test-results/` (실패 시만)

---

## 🔧 자주 사용하는 명령어

### 병렬 실행 비활성화 (디버깅 시)

```bash
npm run test:e2e -- --workers=1
```

### 타임아웃 연장

```bash
npm run test:e2e -- --timeout=60000
```

### 특정 브라우저로 실행

```bash
# Chromium만
npm run test:e2e -- --project=chromium
```

### 실패한 테스트만 재실행

```bash
npm run test:e2e -- --last-failed
```

---

## 🐛 문제 해결

### 문제 1: 개발 서버에 연결할 수 없음 ⚠️ 가장 흔한 문제

**증상**: `ECONNREFUSED` 에러 또는 `net::ERR_CONNECTION_REFUSED`

**원인**: 개발 서버(`npm run dev`)가 실행되지 않았을 때 발생합니다.

**해결 방법**:
```bash
# 1. 별도 터미널에서 개발 서버 실행
npm run dev

# 2. 서버가 정상적으로 시작되었는지 확인
# 브라우저에서 http://localhost:3000 접속 가능한지 확인
curl http://localhost:3000

# 3. 다른 포트를 사용하는 경우, 환경 변수 설정
$env:PLAYWRIGHT_BASE_URL="http://localhost:3001"
```

**⚠️ 주의**: 
- E2E 테스트는 실제 웹 애플리케이션에 접속하는 테스트입니다
- 반드시 `npm run dev`를 먼저 실행해야 합니다
- 테스트 실행 중에는 서버가 계속 실행되어 있어야 합니다

### 문제 2: 브라우저를 찾을 수 없음

**증상**: `Executable doesn't exist` 에러

**해결 방법**:
```bash
# 브라우저 재설치
npx playwright install chromium
```

### 문제 3: 요소를 찾을 수 없음

**증상**: `Locator not found` 에러

**해결 방법**:
1. 스크린샷 확인: `test-results/` 폴더
2. 타임아웃 연장: `--timeout=60000`
3. `data-testid`가 추가되어 있는지 확인

### 문제 4: Basic 인증 실패

**증상**: 401 Unauthorized 에러

**해결 방법**:
```powershell
# 환경 변수 확인
$env:ADMIN_BASIC_AUTH_USER
$env:ADMIN_BASIC_AUTH_PASSWORD

# 환경 변수 설정
$env:ADMIN_BASIC_AUTH_USER="admin"
$env:ADMIN_BASIC_AUTH_PASSWORD="your-password"
```

### 문제 5: 2FA 코드 요구

**증상**: 2FA 코드 입력 화면이 표시됨

**해결 방법**:
1. 관리자 계정의 2FA 비활성화 (권장)
2. 또는 환경 변수 `TEST_2FA_CODE` 설정 (권장하지 않음)

### 문제 6: 로그인 실패

**증상**: 로그인 페이지에서 에러 발생

**해결 방법**:
```powershell
# 관리자 계정 정보 확인
$env:ADMIN_EMAIL="admin@example.com"
$env:ADMIN_PASSWORD="your-password"

# 계정이 정지되지 않았는지 확인
# 로그인 실패 횟수 확인
```

### 문제 7: 타임아웃 에러

**증상**: `Timeout exceeded` 에러

**해결 방법**:
```bash
# 타임아웃을 연장하여 실행
npm run test:e2e -- --timeout=120000
```

---

## 📋 실행 예시

### 예시 1: P0 테스트만 실행 (로컬)

```bash
# 1. 개발 서버 실행 (별도 터미널)
npm run dev

# 2. 환경 변수 설정 (PowerShell)
$env:PLAYWRIGHT_BASE_URL="http://localhost:3000"

# 3. P0 테스트 실행
npm run test:e2e -- e2e/points-critical.spec.ts
```

### 예시 2: 관리자 테스트 실행

```bash
# 1. 개발 서버 실행 (별도 터미널)
npm run dev

# 2. 환경 변수 설정 (PowerShell)
$env:PLAYWRIGHT_BASE_URL="http://localhost:3000"
$env:ADMIN_BASIC_AUTH_USER="admin"
$env:ADMIN_BASIC_AUTH_PASSWORD="your-password"
$env:ADMIN_EMAIL="admin@example.com"
$env:ADMIN_PASSWORD="your-password"

# 3. 관리자 테스트 실행
npm run test:e2e -- e2e/admin-user-management.spec.ts
```

### 예시 3: UI 모드로 디버깅

```bash
# 1. 개발 서버 실행 (별도 터미널)
npm run dev

# 2. UI 모드로 실행
npm run test:e2e:ui

# 3. 브라우저에서 테스트를 선택하여 실행
```

### 예시 4: 특정 테스트 케이스만 실행

```bash
# "P0-1"을 포함하는 테스트만 실행
npm run test:e2e -- --grep "P0-1"
```

---

## 🎯 CI/CD에서 실행

### GitHub Actions

`.github/workflows/e2e-tests.yml`이 자동으로 실행됩니다.

**수동 실행**:
1. GitHub 저장소의 "Actions" 탭으로 이동
2. "E2E Tests" 워크플로우 선택
3. "Run workflow" 클릭

### 로컬에서 CI 모드 시뮬레이션

```bash
# CI 환경 변수 설정
$env:CI="true"
npm run test:e2e
```

---

## 💡 팁

1. **최초 실행 시**: UI 모드 (`npm run test:e2e:ui`)를 사용하여 테스트 동작을 확인하는 것을 추천
2. **디버깅 시**: 헤드 모드 (`npm run test:e2e:headed`)로 브라우저를 표시하며 실행
3. **CI/CD**: 일반 모드 (`npm run test:e2e`)로 자동 실행
4. **특정 테스트**: `--grep` 옵션으로 필터링
5. **관리자 테스트**: Basic 인증과 일반 로그인 모두 환경 변수로 설정 필요
6. **2FA**: 관리자 계정의 2FA는 비활성화 권장

---

## ❓ 자주 묻는 질문

### Q: 테스트가 느립니다

**A**: 병렬 실행을 비활성화해보세요:
```bash
npm run test:e2e -- --workers=1
```

### Q: 테스트가 불안정합니다

**A**: 
1. 타임아웃 연장
2. `data-testid` 추가
3. `waitForLoadState('networkidle')` 추가

### Q: 스크린샷을 보고 싶습니다

**A**: 
```bash
# 실패 시 자동 저장됩니다
# HTML 리포트에서 확인
npm run test:e2e:report
```

### Q: 관리자 로그인이 안 됩니다

**A**: 
1. Basic 인증 환경 변수 확인 (`ADMIN_BASIC_AUTH_USER`, `ADMIN_BASIC_AUTH_PASSWORD`)
2. 일반 로그인 환경 변수 확인 (`ADMIN_EMAIL`, `ADMIN_PASSWORD`)
3. 2FA 비활성화 확인

### Q: 2FA 코드를 매번 입력해야 합니다

**A**: 
관리자 계정의 2FA를 비활성화하는 것을 권장합니다:
```sql
UPDATE users SET twoFactorEnabled = false WHERE email = 'admin@example.com';
```

---

## 📚 참고 자료

- [테스트 케이스 일람](./E2E_TEST_CASES_TABLE.md)
- [P0 테스트 시나리오](./E2E_TEST_SCENARIOS_P0.md)
- [테스트 시나리오 (우선순위별)](./E2E_TEST_SCENARIOS_BY_PRIORITY.md)
- [Playwright 공식 문서](https://playwright.dev/)

---

**문제가 해결되지 않는 경우**: `test-results/` 폴더의 스크린샷과 로그를 확인하세요.


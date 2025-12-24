# E2E 테스트 실행 가이드 (간단 버전)

**최종 업데이트**: 2025년 12월 22일

> ⚠️ **이 문서는 이전 버전입니다.** 통합 가이드는 [E2E_TEST_GUIDE_KO.md](./E2E_TEST_GUIDE_KO.md)를 참고하세요.

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

### 3. 개발 서버 실행

**별도 터미널에서 실행**:

```bash
# 개발 서버 실행
npm run dev
```

서버가 실행되면 `http://localhost:3000`에 접속 가능한지 확인하세요.

---

## 📝 기본 실행 방법

### 모든 테스트 실행

```bash
npm run test:e2e
```

### P0 (크리티컬) 테스트만 실행

```bash
npm run test:e2e -- e2e/points-critical.spec.ts
```

### 특정 테스트 파일만 실행

```bash
# 인증 기능만
npm run test:e2e -- e2e/user-auth.spec.ts

# 채팅 기능만
npm run test:e2e -- e2e/chat.spec.ts

# 관리자 기능만
npm run test:e2e -- e2e/admin-user-management.spec.ts
```

### 특정 테스트 케이스만 실행

```bash
# 테스트 이름으로 필터링
npm run test:e2e -- --grep "P0-1"

# 또는
npm run test:e2e -- -g "新規登録"
```

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

# 테스트용 사용자 (선택사항)
$env:TEST_EMAIL="test@example.com"
$env:TEST_PASSWORD="testpassword123"

# 관리자 계정 (관리자 테스트용)
$env:ADMIN_EMAIL="admin@example.com"
$env:ADMIN_PASSWORD="adminpassword123"
```

### Windows (CMD)

```cmd
set PLAYWRIGHT_BASE_URL=http://localhost:3000
set TEST_EMAIL=test@example.com
set TEST_PASSWORD=testpassword123
```

### Linux/Mac

```bash
export PLAYWRIGHT_BASE_URL=http://localhost:3000
export TEST_EMAIL=test@example.com
export TEST_PASSWORD=testpassword123
```

### .env 파일 사용 (추천)

프로젝트 루트에 `.env.local` 파일 생성:

```bash
# .env.local
PLAYWRIGHT_BASE_URL=http://localhost:3000
TEST_EMAIL=test@example.com
TEST_PASSWORD=testpassword123
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=adminpassword123
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

# Firefox만 (설정 필요)
npm run test:e2e -- --project=firefox
```

### 실패한 테스트만 재실행

```bash
npm run test:e2e -- --last-failed
```

---

## 🐛 문제 해결

### 문제 1: 개발 서버에 연결할 수 없음

**증상**: `ECONNREFUSED` 에러

**해결 방법**:
```bash
# 1. 개발 서버가 실행 중인지 확인
curl http://localhost:3000

# 2. 다른 포트를 사용하는 경우, 환경 변수 설정
$env:PLAYWRIGHT_BASE_URL="http://localhost:3001"
```

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

### 문제 4: 인증 에러

**증상**: 로그인 실패

**해결 방법**:
1. 테스트용 사용자가 존재하는지 확인
2. 환경 변수 `TEST_EMAIL`과 `TEST_PASSWORD`가 올바르게 설정되었는지 확인
3. 개발 서버에서 사용자를 생성했는지 확인

### 문제 5: 타임아웃 에러

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

# 2. P0 테스트 실행
npm run test:e2e -- e2e/points-critical.spec.ts
```

### 예시 2: UI 모드로 디버깅

```bash
# 1. 개발 서버 실행 (별도 터미널)
npm run dev

# 2. UI 모드로 실행
npm run test:e2e:ui

# 3. 브라우저에서 테스트를 선택하여 실행
```

### 예시 3: 특정 테스트 케이스만 실행

```bash
# "新規登録"을 포함하는 테스트만 실행
npm run test:e2e -- --grep "新規登録"
```

### 예시 4: 환경 변수 설정 후 실행 (Windows PowerShell)

```powershell
# 환경 변수 설정
$env:PLAYWRIGHT_BASE_URL="http://localhost:3000"
$env:TEST_EMAIL="test@example.com"
$env:TEST_PASSWORD="testpassword123"

# 테스트 실행
npm run test:e2e
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

## 📚 참고 자료

- [E2E 테스트 실행 가이드 (상세)](../e2e/README.md)
- [테스트 케이스 일람](./E2E_TEST_CASES_TABLE.md)
- [P0 테스트 시나리오](./E2E_TEST_SCENARIOS_P0.md)
- [Playwright 공식 문서](https://playwright.dev/)

---

## 💡 팁

1. **최초 실행 시**: UI 모드 (`npm run test:e2e:ui`)를 사용하여 테스트 동작을 확인하는 것을 추천
2. **디버깅 시**: 헤드 모드 (`npm run test:e2e:headed`)로 브라우저를 표시하며 실행
3. **CI/CD**: 일반 모드 (`npm run test:e2e`)로 자동 실행
4. **특정 테스트**: `--grep` 옵션으로 필터링

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

### Q: 테스트용 사용자를 생성하려면?

**A**: 
1. 개발 서버에서 수동으로 사용자 생성
2. 또는 `createTestUser()` 함수 구현 (현재는 모크)

---

**문제가 해결되지 않는 경우**: `test-results/` 폴더의 스크린샷과 로그를 확인하세요.


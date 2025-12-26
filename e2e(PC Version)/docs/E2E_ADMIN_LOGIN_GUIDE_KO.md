# E2E 테스트: 관리자 로그인 가이드

**최종 업데이트**: 2025년 12월 22일

> ⚠️ **이 문서는 이전 버전입니다.** 통합 가이드는 [E2E_TEST_GUIDE_KO.md](./E2E_TEST_GUIDE_KO.md)를 참고하세요.

---

## 🎯 관리자 로그인 구조

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

---

## ⚙️ 환경 변수 설정

### Windows (PowerShell)

```powershell
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
ADMIN_BASIC_AUTH_USER=admin
ADMIN_BASIC_AUTH_PASSWORD=your-basic-auth-password
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=your-admin-password

# 2FA가 활성화된 경우에만 필요 (비활성화 권장)
# TEST_2FA_CODE=123456
```

---

## 🚀 테스트 실행

### 1. Basic 인증 설정 확인

관리자 페이지는 자동으로 Basic 인증을 처리합니다 (`e2e/helpers/auth.ts`의 `setBasicAuth()` 함수 사용).

### 2. 관리자 로그인 테스트

```bash
# 모든 관리자 테스트 실행
npm run test:e2e -- e2e/admin-*.spec.ts

# 특정 관리자 테스트 실행
npm run test:e2e -- e2e/admin-user-management.spec.ts
```

### 3. 2FA 비활성화 권장

관리자 계정의 2FA를 비활성화하면 테스트가 더 안정적입니다:

```sql
-- 데이터베이스에서 직접 비활성화
UPDATE users 
SET twoFactorEnabled = false 
WHERE email = 'admin@example.com';
```

또는 관리자 페이지에서 2FA 설정을 비활성화하세요.

---

## 📝 구현 예시

### 관리자 테스트 파일 예시

```typescript
// e2e/admin-user-management.spec.ts
import { test, expect } from '@playwright/test';
import { loginWithEmail, setBasicAuth } from './helpers/auth';
import { goToUserManagement } from './helpers/admin';

test.describe('管理者：ユーザー管理', () => {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'adminpassword123';

  test.beforeEach(async ({ page }) => {
    // Basic認証を設定（管理者ページアクセス用）
    await setBasicAuth(page);
    
    // 通常のログイン（管理者アカウントの2FAは無効化推奨）
    await loginWithEmail(page, adminEmail, adminPassword);
    
    await goToUserManagement(page);
  });

  test('ユーザー一覧が表示される', async ({ page }) => {
    // テスト内容...
  });
});
```

---

## 🔧 Basic 인증 처리 방법

### Playwright에서 Basic 인증 설정

```typescript
// e2e/helpers/auth.ts (이미 구현됨)
export async function setBasicAuth(page: Page): Promise<void> {
  const basicAuthUser = process.env.ADMIN_BASIC_AUTH_USER;
  const basicAuthPassword = process.env.ADMIN_BASIC_AUTH_PASSWORD;
  
  if (basicAuthUser && basicAuthPassword) {
    await page.setHTTPCredentials({
      username: basicAuthUser,
      password: basicAuthPassword,
    });
  }
}
```

### 사용 방법

```typescript
test.beforeEach(async ({ page }) => {
  // Basic 인증 설정 (관리자 페이지 접근 전)
  await setBasicAuth(page);
  
  // 이후 일반 로그인 및 테스트 진행
  await loginWithEmail(page, adminEmail, adminPassword);
});
```

---

## ⚠️ 주의사항

### 1. Basic 인증과 일반 로그인 구분

- **Basic 인증**: HTTP Basic Auth로 관리자 페이지 접근 제한
- **일반 로그인**: 세션 기반 인증으로 서비스 이용

### 2. 2FA 비활성화 권장

- 관리자 계정의 2FA (이메일 기반)를 비활성화하면 테스트가 더 안정적
- 2FA가 활성화된 경우, 매번 새로운 코드가 필요하므로 테스트 자동화에 부적합

### 3. 환경 변수 보안

- `.env.local` 파일은 `.gitignore`에 포함되어 있어야 함
- CI/CD에서는 GitHub Secrets 사용

---

## 🐛 문제 해결

### 문제 1: Basic 인증 실패

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

### 문제 2: 2FA 코드 요구

**증상**: 2FA 코드 입력 화면이 표시됨

**해결 방법**:
1. 관리자 계정의 2FA 비활성화 (권장)
2. 또는 환경 변수 `TEST_2FA_CODE` 설정 (권장하지 않음)

### 문제 3: 로그인 실패

**증상**: 로그인 페이지에서 에러 발생

**해결 방법**:
```powershell
# 관리자 계정 정보 확인
$env:ADMIN_EMAIL="admin@example.com"
$env:ADMIN_PASSWORD="your-password"

# 계정이 정지되지 않았는지 확인
# 로그인 실패 횟수 확인
```

---

## 📚 참고

- [2FA 대응 가이드](./E2E_TEST_2FA_GUIDE_KO.md)
- [실행 가이드](./E2E_TEST_EXECUTION_GUIDE_KO.md)
- [Basic 인증 구현 코드](../src/lib/security/ip-restriction.ts)
- [미들웨어 구현](../src/middleware.ts)

---

## 🎯 요약

1. ✅ **Basic 인증 설정**: `ADMIN_BASIC_AUTH_USER`, `ADMIN_BASIC_AUTH_PASSWORD`
2. ✅ **일반 로그인 정보**: `ADMIN_EMAIL`, `ADMIN_PASSWORD`
3. ✅ **2FA 비활성화**: 관리자 계정의 2FA를 비활성화 (권장)
4. ✅ **테스트 실행**: `npm run test:e2e -- e2e/admin-*.spec.ts`

이렇게 설정하면 관리자 테스트를 안정적으로 실행할 수 있습니다.


# E2E 테스트: 관리자 로그인 및 2FA 대응 가이드

**최종 업데이트**: 2025년 12월 22일

> ⚠️ **이 문서는 이전 버전입니다.** 통합 가이드는 [E2E_TEST_GUIDE_KO.md](./E2E_TEST_GUIDE_KO.md)를 참고하세요.

---

## 🎯 중요 정보

**관리자 페이지 접근 구조**:
1. **Basic 인증** (HTTP Basic Auth) - 환경 변수 `ADMIN_BASIC_AUTH_USER`, `ADMIN_BASIC_AUTH_PASSWORD` 필요
2. **일반 로그인** (이메일/비밀번호) - 세션 기반 인증
3. **2FA (이메일 기반)** - 설정된 경우에만 필요 (비활성화 권장)

---

## 🎯 문제

**관리자 계정에 2FA (2단계 인증)가 설정되어 있는데, 테스트가 가능한가요?**

**답변**: ✅ **가능합니다. 관리자 계정의 2FA를 비활성화하면 됩니다.**

---

## 📋 대응 방법

### 방법 1: 관리자 계정의 2FA 비활성화 (추천)

**가장 간단한 방법**:

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

**주의**: 
- Basic 인증과 일반 로그인은 **별도**입니다
- Basic 인증은 관리자 페이지 접근을 제한하는 용도
- 일반 로그인은 세션 기반 인증으로 서비스 이용을 위한 용도

---

### 방법 2: 환경 변수로 2FA 코드 제공

**테스트 실행 시 2FA 코드를 환경 변수로 제공**:

```powershell
# Windows PowerShell
$env:TEST_2FA_CODE="123456"

# 테스트 실행
npm run test:e2e
```

**주의**: 
- 이 방법은 **이메일 기반 2FA**인 경우에만 유효
- 코드는 수동으로 가져와야 함
- 테스트할 때마다 새 코드가 필요 (권장하지 않음)

---

### 방법 3: TOTP (Google Authenticator) 코드 자동 생성

**TOTP 시크릿 키를 환경 변수로 제공**:

```powershell
# Windows PowerShell
$env:ADMIN_TOTP_SECRET="YOUR_TOTP_SECRET_KEY"

# 테스트 실행
npm run test:e2e
```

**구현**:
```typescript
// e2e/admin-user-management.spec.ts
import { loginWithTOTP } from './helpers/auth-2fa';

test.beforeEach(async ({ page }) => {
  const totpSecret = process.env.ADMIN_TOTP_SECRET;
  
  if (totpSecret) {
    await loginWithTOTP(page, adminEmail, adminPassword, totpSecret);
  } else {
    // 2FA가 비활성화된 경우 일반 로그인
    await loginWithEmail(page, adminEmail, adminPassword);
  }
});
```

**주의**: 
- TOTP 시크릿 키는 보안상 환경 변수나 시크릿 매니저에 저장
- CI/CD에서는 GitHub Secrets 사용

---

### 방법 4: 백업 코드 사용

**백업 코드를 환경 변수로 제공**:

```powershell
# Windows PowerShell
$env:ADMIN_BACKUP_CODE="BACKUP123456"

# 테스트 실행
npm run test:e2e
```

**구현**:
```typescript
// e2e/admin-user-management.spec.ts
import { loginWithBackupCode } from './helpers/auth-2fa';

test.beforeEach(async ({ page }) => {
  const backupCode = process.env.ADMIN_BACKUP_CODE;
  
  if (backupCode) {
    await loginWithBackupCode(page, adminEmail, adminPassword, backupCode);
  } else {
    await loginWithEmail(page, adminEmail, adminPassword);
  }
});
```

**주의**: 
- 백업 코드는 1회 사용 후 무효화됨
- 여러 번 테스트를 실행하는 경우 부적합

---

## 🎯 추천되는 구현

### 추천: 방법 1 (테스트용 계정 2FA 비활성화)

1. **테스트용 관리자 계정 생성**
   ```sql
   -- 데이터베이스에서 직접 생성, 또는 API를 통해
   INSERT INTO users (email, password, role, twoFactorEnabled) 
   VALUES ('test-admin@e2e-test.com', '$2b$...', 'SUPER_ADMIN', false);
   ```

2. **환경 변수 설정**
   ```powershell
   $env:ADMIN_EMAIL="test-admin@e2e-test.com"
   $env:ADMIN_PASSWORD="TestAdminPassword123!"
   ```

3. **테스트 실행**
   ```bash
   npm run test:e2e -- e2e/admin-user-management.spec.ts
   ```

---

## 📝 구현 예시

### 현재 구현 상태

**✅ 이미 구현됨**:
- `e2e/helpers/auth.ts`: `loginWithEmail` 함수가 2FA를 자동 감지
- `e2e/helpers/auth-2fa.ts`: 2FA 전용 헬퍼 함수 (새로 생성)
- `e2e/admin-user-management.spec.ts`: 2FA 대응 추가됨

**사용 방법**:
1. **2FA 비활성화 계정 사용** (추천)
   ```powershell
   $env:ADMIN_EMAIL="test-admin@e2e-test.com"
   $env:ADMIN_PASSWORD="password123"
   npm run test:e2e
   ```

2. **TOTP 자동 생성 사용**
   ```powershell
   $env:ADMIN_EMAIL="admin@example.com"
   $env:ADMIN_PASSWORD="password123"
   $env:ADMIN_TOTP_SECRET="YOUR_SECRET_KEY"
   npm run test:e2e
   ```

3. **2FA 코드 직접 제공**
   ```powershell
   $env:ADMIN_EMAIL="admin@example.com"
   $env:ADMIN_PASSWORD="password123"
   $env:TEST_2FA_CODE="123456"
   npm run test:e2e
   ```

---

## 🔧 테스트 환경별 추천 설정

### 로컬 환경 (local)

**추천**: 테스트용 계정 2FA 비활성화
```powershell
$env:ADMIN_EMAIL="test-admin@e2e-test.com"
$env:ADMIN_PASSWORD="TestAdminPassword123!"
```

### CI/CD 환경 (GitHub Actions)

**추천**: TOTP 자동 생성 또는 테스트용 계정 사용
```yaml
# .github/workflows/e2e-tests.yml
env:
  ADMIN_EMAIL: ${{ secrets.ADMIN_EMAIL }}
  ADMIN_PASSWORD: ${{ secrets.ADMIN_PASSWORD }}
  ADMIN_TOTP_SECRET: ${{ secrets.ADMIN_TOTP_SECRET }}
```

---

## ⚠️ 주의사항

### 보안

1. **본番 환경의 계정은 사용하지 않기**
   - 테스트용 별도 계정 사용
   - 본番 데이터에 영향을 주지 않기

2. **TOTP 시크릿 키 보안**
   - GitHub Secrets에 저장
   - `.env` 파일에 커밋하지 않기
   - 로컬 환경 변수만 사용

3. **백업 코드 관리**
   - 백업 코드는 1회 사용 후 무효화
   - 여러 테스트에 사용 불가

### 테스트 안정성

1. **2FA 비활성화 계정 사용 권장**
   - 가장 안정적
   - 테스트 속도 향상
   - 코드 복잡도 감소

2. **TOTP 자동 생성 사용 시**
   - 시간 동기화 문제 가능
   - 타임아웃 설정 주의

---

## 📚 참고

- [2FA 구현 코드](../src/lib/2fa.ts)
- [ログインページ 2FA 처리](../src/app/login/page.tsx)
- [인증 헬퍼 함수](../e2e/helpers/auth.ts)
- [2FA 헬퍼 함수](../e2e/helpers/auth-2fa.ts) (신규 생성)

---

## 🎯 요약

**추천 접근법**:
1. ✅ **테스트용 관리자 계정 생성** (2FA 비활성화)
2. ✅ **환경 변수로 계정 정보 제공**
3. ✅ **테스트에서 해당 계정 사용**

이렇게 하면 2FA가 설정되어 있어도, 테스트를 안정적으로 실행할 수 있습니다.

---

## 🚀 빠른 시작

### 가장 간단한 방법

```powershell
# 1. 테스트용 관리자 계정 생성 (2FA 비활성화)
# ... 데이터베이스나 관리자 페이지에서 생성

# 2. 환경 변수 설정
$env:ADMIN_EMAIL="test-admin@e2e-test.com"
$env:ADMIN_PASSWORD="TestAdminPassword123!"

# 3. 테스트 실행
npm run test:e2e -- e2e/admin-user-management.spec.ts
```

### TOTP 자동 생성 사용 (2FA 활성화 계정 사용 시)

```powershell
# 1. 환경 변수 설정
$env:ADMIN_EMAIL="admin@example.com"
$env:ADMIN_PASSWORD="password123"
$env:ADMIN_TOTP_SECRET="YOUR_TOTP_SECRET_KEY"

# 2. 테스트 실행
npm run test:e2e -- e2e/admin-user-management.spec.ts
```

**TOTP 시크릿 키 확인 방법**:
1. 관리자 페이지에서 2FA 설정 확인
2. QR 코드 생성 시 시크릿 키 복사
3. 또는 데이터베이스 `users.twoFactorSecret` 필드에서 확인

---

**문제가 발생하면**: `test-results/` 폴더의 스크린샷을 확인하세요.


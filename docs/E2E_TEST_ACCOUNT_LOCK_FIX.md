# E2E 테스트 계정 잠금 문제 해결

## 문제 상황

`e2e/auth.spec.ts`의 "間違ったパスワードでログインできない" 테스트가 실행될 때:
- 잘못된 패스워드로 로그인 시도
- 로그인 실패 횟수가 증가
- **10회 이상 실패 시 계정이 15분간 잠금됨**
- 테스트가 반복 실행되면 계정이 잠금되어 다른 테스트 실패

## 해결 방법

### 1. 테스트 전 계정 잠금 해제

테스트 실행 전에 관리자 계정으로 로그인하여 테스트 계정의 잠금을 해제합니다.

```typescript
// 테스트 전에 계정 잠금 해제
if (adminEmail && adminPassword) {
  await loginWithEmail(page, adminEmail, adminPassword);
  await resetAccountLockStatus(page, testEmail);
  await logout(page);
}
```

### 2. 테스트 후 계정 잠금 해제

`afterEach`에서 테스트 후에도 잠금을 해제하여 다음 테스트에 영향을 주지 않도록 합니다.

```typescript
test.afterEach(async ({ page }) => {
  // 테스트 후 계정 잠금 해제
  if (adminEmail && adminPassword) {
    try {
      await loginWithEmail(page, adminEmail, adminPassword);
      await resetAccountLockStatus(page, testEmail);
      await logout(page);
    } catch (error) {
      // 잠금 해제 실패해도 계속 진행
    }
  }
});
```

### 3. 실패 횟수 제한

잘못된 패스워드 테스트에서 **1회만 실패 시도**하도록 제한합니다.
- 10회 이상 실패 시 잠금되므로, 1회만 실패하면 안전합니다.

```typescript
// 1回だけ間違ったパスワードで試行
await passwordInput.fill('wrongpassword');
await loginButton.click();
```

## 구현된 기능

### `resetAccountLockStatus()` 함수

`e2e/helpers/auth.ts`에 추가된 함수:

```typescript
export async function resetAccountLockStatus(
  page: Page,
  email: string
): Promise<boolean>
```

**기능:**
- 관리자 계정으로 로그인한 상태에서 호출
- 지정된 이메일 계정의 잠금 상태 해제
- `loginAttempts`를 0으로 리셋
- `lockedUntil`을 null로 설정

**사용 방법:**
```typescript
// 관리자로 로그인 후
await loginWithEmail(page, adminEmail, adminPassword);

// 테스트 계정 잠금 해제
await resetAccountLockStatus(page, testEmail);

// 로그아웃
await logout(page);
```

## 계정 잠금 메커니즘

### 잠금 조건
- **최대 실패 횟수**: 10회
- **잠금 기간**: 15분
- **잠금 해제**: 시간 경과 또는 관리자 수동 해제

### 잠금 상태 확인
```typescript
// 계정 잠금 메시지 확인
const lockMessage = page.getByText(/アカウントがロックされました/i);
const isLocked = await lockMessage.isVisible({ timeout: 1000 }).catch(() => false);
```

## 테스트 실행 시나리오

### 정상 시나리오
1. 테스트 전: 관리자로 로그인 → 테스트 계정 잠금 해제
2. 테스트 실행: 잘못된 패스워드 1회 시도
3. 테스트 후: 관리자로 로그인 → 테스트 계정 잠금 해제
4. 결과: 계정이 잠금되지 않음 ✅

### 예외 시나리오
- 관리자 계정이 없는 경우: 잠금 해제 시도 실패 (경고만 출력)
- 계정이 이미 잠금된 경우: 테스트 전 해제 시도
- 10회 이상 실패한 경우: 테스트 후 해제

## 주의사항

### 환경 변수 필요
- `ADMIN_EMAIL`: 관리자 이메일
- `ADMIN_PASSWORD`: 관리자 패스워드
- `TEST_EMAIL`: 테스트 계정 이메일
- `TEST_PASSWORD`: 테스트 계정 패스워드

### 관리자 권한 필요
- 계정 잠금 해제는 관리자 권한이 필요합니다
- 관리자 계정이 없으면 잠금 해제가 실패할 수 있습니다

### 테스트 순서
- `beforeEach`: 로그아웃 상태로 초기화
- `afterEach`: 계정 잠금 해제 (안전장치)

## 참고

- [계정 잠금 로직](../src/lib/nextauth.ts) - `maxAttempts: 10`, `lockDurationMinutes: 15`
- [계정 잠금 해제 API](../src/app/api/admin/users/unlock/route.ts)
- [E2E 테스트 이슈 분석](./E2E_TEST_ISSUES_ANALYSIS.md)





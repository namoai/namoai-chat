# 계정 잠금 메커니즘 설명

## 1. 계정 잠금 조건

### 잠금 발생 조건
- **최대 실패 횟수**: 10회
- **잠금 기간**: 15분
- **잠금 상태**: `lockedUntil` 필드에 잠금 해제 시간 저장

### 코드 위치
`src/lib/nextauth.ts` (line 288-310):
```typescript
if (!isPasswordValid) {
  const newAttempts = (user.loginAttempts || 0) + 1;
  const maxAttempts = 10; // 10回失敗でロック
  const lockDurationMinutes = 15; // 15分間ロック

  if (newAttempts >= maxAttempts) {
    const lockedUntil = new Date(now.getTime() + lockDurationMinutes * 60 * 1000);
    updateData.lockedUntil = lockedUntil;
  }
}
```

---

## 2. 잠금 해제 방법

### 방법 1: 시간 경과 (효과적 해제)
- **15분이 지나면**: 다음 로그인 시도 시 잠금이 해제된 것으로 간주
- **주의**: DB의 `lockedUntil` 값은 그대로 남아있음
- **코드**: `src/lib/nextauth.ts` (line 265-269)
  ```typescript
  if (user.lockedUntil && user.lockedUntil > now) {
    // 잠금 중
  }
  // lockedUntil이 지났으면 잠금이 효과적으로 해제됨
  ```

### 방법 2: 로그인 성공 (자동 해제)
- **로그인 성공 시**: `loginAttempts`와 `lockedUntil`을 자동으로 리셋
- **코드**: `src/lib/nextauth.ts` (line 333-342)
  ```typescript
  // 認証成功: ログイン失敗回数とロック状態をリセット
  if (user.loginAttempts > 0 || user.lockedUntil) {
    await prisma.users.update({
      where: { id: user.id },
      data: {
        loginAttempts: 0,
        lockedUntil: null,
      },
    });
  }
  ```

### 방법 3: 관리자 수동 해제 (즉시 해제)
- **관리자 페이지 UI**: `/admin/users` 페이지에서 "ロック解除" 버튼
- **관리자 API**: `/api/admin/users/unlock` (SUPER_ADMIN 권한 필요)
- **코드**: `src/app/api/admin/users/unlock/route.ts`
  ```typescript
  await prisma.users.update({
    where: { id: userId },
    data: {
      lockedUntil: null,
      loginAttempts: 0,
    },
  });
  ```

---

## 3. 테스트 환경에서의 해제

### E2E 테스트에서 사용
`e2e/helpers/auth.ts`의 `resetAccountLockStatus()` 함수:

```typescript
// 관리자로 로그인 후
await loginWithEmail(page, adminEmail, adminPassword);

// 테스트 계정 잠금 해제
await resetAccountLockStatus(page, testEmail);

// 로그아웃
await logout(page);
```

### 사용 위치
- `e2e/auth.spec.ts`: 잘못된 패스워드 테스트 전/후
- 테스트 전: 계정 잠금 해제 (이전 테스트의 잔여 잠금 제거)
- 테스트 후: 계정 잠금 해제 (다음 테스트를 위한 정리)

---

## 4. 중요 사항

### ⚠️ 15분 자동 해제는 없음
- **오해**: 15분이 지나면 자동으로 DB에서 `lockedUntil`이 삭제됨
- **실제**: 15분이 지나면 다음 로그인 시도 시 잠금이 효과적으로 해제되지만, DB 값은 그대로 남아있음
- **해결**: 관리자 API로 명시적으로 해제하거나, 로그인 성공 시 자동 해제

### ✅ 관리자 잠금 해제 기능은 존재
- **API**: `/api/admin/users/unlock` (SUPER_ADMIN 권한)
- **UI**: `/admin/users` 페이지의 "ロック解除" 버튼
- **테스트**: `resetAccountLockStatus()` 함수 사용

### ✅ 로그인 성공 시 자동 해제
- 로그인 성공하면 `loginAttempts`와 `lockedUntil`이 자동으로 리셋됨
- 올바른 패스워드로 로그인하면 잠금이 해제됨

---

## 5. 테스트 시나리오

### 시나리오 1: 정상 테스트
1. 테스트 전: 관리자로 로그인 → 테스트 계정 잠금 해제
2. 테스트 실행: 잘못된 패스워드 1회 시도 (안전)
3. 테스트 후: 관리자로 로그인 → 테스트 계정 잠금 해제
4. 결과: 계정이 잠금되지 않음 ✅

### 시나리오 2: 10회 이상 실패
1. 잘못된 패스워드 10회 시도
2. 계정 잠금됨 (`lockedUntil` 설정)
3. 해제 방법:
   - **즉시**: 관리자 API로 해제
   - **15분 후**: 다음 로그인 시도 시 효과적으로 해제
   - **로그인 성공**: 올바른 패스워드로 로그인하면 자동 해제

---

## 6. 참고 자료

- [계정 잠금 로직](../src/lib/nextauth.ts) - line 263-342
- [관리자 잠금 해제 API](../src/app/api/admin/users/unlock/route.ts)
- [관리자 페이지 UI](../src/app/admin/users/page.tsx) - line 300-331
- [E2E 테스트 잠금 해제](../e2e/helpers/auth.ts) - `resetAccountLockStatus()`





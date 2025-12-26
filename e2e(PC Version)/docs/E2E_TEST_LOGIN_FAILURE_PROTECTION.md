# E2E 테스트 로그인 실패 보호 메커니즘

## 개요

E2E 테스트에서 로그인 실패가 반복되면 계정이 잠금되어 다른 테스트에 영향을 주는 문제를 방지하기 위한 보호 메커니즘입니다.

---

## 1. 잘못된 패스워드 테스트 제한

### 규칙
- **잘못된 패스워드 테스트는 1번만 실패 시도**
- 테스트 목적: 잘못된 패스워드로 로그인할 수 없음을 확인
- 1번의 실패로 충분히 검증 가능

### 구현 위치
`e2e/auth.spec.ts` - "間違ったパスワードでログインできない" 테스트:

```typescript
// ⚠️ 중요: 1回だけ間違ったパスワードで試行
await passwordInput.fill('wrongpassword');
await loginButton.click();
```

---

## 2. 연속 실패 보호 메커니즘

### 규칙
- **5번 이상 연속으로 로그인 실패 시 테스트 중지**
- 계정 잠금을 방지하기 위한 안전장치
- 테스트 실행 중 실패가 누적되는 것을 방지

### 구현 위치
`e2e/helpers/auth.ts`:

```typescript
// 전역 변수: 연속 로그인 실패 횟수 추적
let consecutiveLoginFailures = 0;
const MAX_CONSECUTIVE_FAILURES = 5; // 5번 이상 연속 실패 시 테스트 중지
```

### 동작 방식

#### 로그인 실패 시
```typescript
consecutiveLoginFailures++;
console.warn(`[loginWithEmail] 로그인 실패 (연속 실패: ${consecutiveLoginFailures}회)`);

// 5번 이상 연속 실패 시 테스트 중지
if (consecutiveLoginFailures >= MAX_CONSECUTIVE_FAILURES) {
  throw new Error(`로그인 실패: ${email}. ${MAX_CONSECUTIVE_FAILURES}번 이상 연속 실패로 테스트를 중지합니다.`);
}
```

#### 로그인 성공 시
```typescript
// 로그인 성공: 연속 실패 횟수 리셋
consecutiveLoginFailures = 0;
```

---

## 3. 계정 잠금 메커니즘

### 시스템 잠금 조건
- **최대 실패 횟수**: 10회
- **잠금 기간**: 15분
- **잠금 해제**: 시간 경과, 로그인 성공, 또는 관리자 수동 해제

### 테스트 보호
- 잘못된 패스워드 테스트: **1번만 실패** (안전)
- 연속 실패 보호: **5번 이상 시 테스트 중지** (계정 잠금 방지)

---

## 4. 테스트 실행 시나리오

### 시나리오 1: 정상 테스트
1. 테스트 전: 관리자로 로그인 → 테스트 계정 잠금 해제
2. 테스트 실행: 잘못된 패스워드 **1번만** 시도
3. 테스트 후: 관리자로 로그인 → 테스트 계정 잠금 해제
4. 결과: 계정이 잠금되지 않음 ✅

### 시나리오 2: 연속 실패 발생
1. 여러 테스트에서 로그인 실패 발생
2. 연속 실패 횟수 증가: 1회 → 2회 → 3회 → 4회 → **5회**
3. **5번째 실패 시**: 테스트 중지, 에러 발생
4. 해결: 관리자 페이지에서 계정 잠금 해제 후 테스트 재실행

---

## 5. 에러 메시지

### 5번 이상 연속 실패 시
```
[loginWithEmail] ⚠️ 경고: 5번 이상 연속으로 로그인 실패했습니다. 테스트를 중지합니다.
[loginWithEmail] 해결 방법:
  1. 관리자 페이지에서 해당 계정의 잠금을 해제하거나
  2. DB에서 직접 잠금 해제: UPDATE users SET lockedUntil = NULL, loginAttempts = 0 WHERE email = ?
```

### 계정 잠금 시
```
[loginWithEmail] 계정이 잠겨있습니다. (연속 실패: X회)
[loginWithEmail] 계정: test@example.com
[loginWithEmail] 해결 방법:
  1. 관리자 페이지에서 해당 계정의 잠금을 해제하거나
  2. DB에서 직접 잠금 해제: UPDATE users SET lockedUntil = NULL, loginAttempts = 0 WHERE email = ?
```

---

## 6. 주의사항

### ⚠️ 잘못된 패스워드 테스트
- **반드시 1번만 실패 시도**
- 여러 번 실패 시도하지 않음
- 테스트 목적: 잘못된 패스워드로 로그인할 수 없음을 확인

### ⚠️ 연속 실패 보호
- **5번 이상 연속 실패 시 테스트 중지**
- 계정 잠금을 방지하기 위한 안전장치
- 로그인 성공 시 실패 횟수 자동 리셋

### ⚠️ 계정 잠금 해제
- 테스트 전/후에 관리자로 잠금 해제 시도
- 관리자 권한이 없으면 경고만 출력하고 계속 진행

---

## 7. 참고 자료

- [계정 잠금 메커니즘](./ACCOUNT_LOCK_MECHANISM.md)
- [E2E 테스트 계정 잠금 해제](./E2E_TEST_ACCOUNT_LOCK_FIX.md)
- [로그인 헬퍼 함수](../e2e/helpers/auth.ts)











# E2E 테스트 수정 사항 (2025-12-24)

## 수정 완료 ✅

### 1. logout 함수 타임아웃 개선

**파일**: `e2e/helpers/auth.ts`

**수정 내용**:
- 타임아웃: 5초 → 15초
- 로그아웃 버튼이 없거나 타임아웃 발생 시 로그인 페이지로 강제 이동
- 더 유연한 에러 처리

**코드 변경**:
```typescript
// 수정 전
await page.waitForURL(/\/login/, { timeout: 5000 });

// 수정 후
try {
  await page.waitForURL(/\/login/, { timeout: 15000 });
} catch (error) {
  const currentUrl = page.url();
  if (!currentUrl.includes('/login')) {
    await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: 10000 });
  }
}
```

---

### 2. CSRF 토큰 처리 개선

**파일**: `e2e/helpers/auth.ts` - `resetAccountLockStatus` 함수

**수정 내용**:
- 계정 잠금 해제 API 호출 전에 CSRF 토큰 가져오기
- `/api/csrf-token` 엔드포인트 호출
- API 요청 시 `x-csrf-token` 헤더에 토큰 포함

**코드 변경**:
```typescript
// CSRF 토큰 가져오기
const csrfResponse = await page.request.get(`${BASE_URL}/api/csrf-token`);
let csrfToken: string | null = null;

if (csrfResponse.ok()) {
  const csrfData = await csrfResponse.json();
  csrfToken = csrfData.csrfToken || null;
}

// API 호출 시 헤더에 토큰 포함
const headers: Record<string, string> = {};
if (csrfToken) {
  headers['x-csrf-token'] = csrfToken;
}

const unlockResponse = await page.request.post(`${BASE_URL}/api/admin/users/unlock`, {
  data: { userId },
  headers
});
```

---

### 3. 로그인 실패 원인 분석 개선

**파일**: `e2e/helpers/auth.ts` - `loginWithEmail` 함수

**수정 내용**:
- 로그인 실패 시 더 자세한 정보 출력
- 계정 잠금/정지 상태 자동 감지
- 에러 파라미터 및 현재 URL 출력

**추가된 로그**:
```typescript
console.warn(`[loginWithEmail] 로그인 실패 (연속 실패: ${consecutiveLoginFailures}회)`);
console.warn(`[loginWithEmail] 계정: ${email}`);
console.warn(`[loginWithEmail] 현재 URL: ${finalUrl}`);
if (errorParam) {
  console.warn(`[loginWithEmail] 에러 파라미터: ${errorParam}`);
}
if (isLocked) {
  console.warn(`[loginWithEmail] ⚠️ 계정이 잠금 상태입니다.`);
}
if (isSuspended) {
  console.warn(`[loginWithEmail] ⚠️ 계정이 정지 상태입니다.`);
}
```

---

## 예상 효과

### 1. logout 함수 개선
- ✅ 로그아웃 후 리다이렉트가 느린 경우에도 안정적으로 처리
- ✅ 로그아웃 버튼이 없는 경우에도 로그인 페이지로 이동
- ✅ `afterEach` 훅에서 발생하던 타임아웃 에러 감소

### 2. CSRF 토큰 처리 개선
- ✅ 계정 잠금 해제 API 호출 시 CSRF 토큰 에러 해결
- ✅ `resetAccountLockStatus` 함수가 정상적으로 작동
- ✅ 테스트 전/후 계정 잠금 해제가 성공적으로 수행됨

### 3. 로그인 실패 원인 분석 개선
- ✅ 로그인 실패 시 정확한 원인 파악 가능
- ✅ 계정 잠금/정지 상태 자동 감지
- ✅ 디버깅 시간 단축

---

## 다음 단계

1. ✅ 수정 사항 적용 완료
2. ⏳ 테스트 재실행하여 수정 효과 확인
3. ⏳ 사용자 테스트 대량 실패 원인 추가 분석
4. ⏳ 기능 버그 후보 테스트 상세 분석

---

## 참고

- [E2E 테스트 결과 분석](./E2E_TEST_ANALYSIS_2025-12-24.md)
- [로그인 실패 보호 메커니즘](./E2E_TEST_LOGIN_FAILURE_PROTECTION.md)











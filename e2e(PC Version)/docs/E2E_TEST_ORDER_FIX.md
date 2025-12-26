# E2E 테스트 순서 수정 및 버그 수정

## 문제점

### 1. 테스트 순서 문제
- **문제**: 관리자 테스트를 먼저 실행하여 유저 계정이 잠금됨
- **원인**: 유저 테스트가 관리자 테스트 이후에 실행되어 계정 잠금 상태로 인해 실패
- **해결**: 유저 테스트를 먼저 실행하도록 테스트 순서 조정

### 2. 정지 페이지 리다이렉트 버그 ⚠️
- **문제**: 계정이 정지된 경우 `/suspended` 페이지로 리다이렉트되지 않음
- **현재 동작**: 로그인 페이지에 모달만 표시
- **기대 동작**: `/suspended` 페이지로 리다이렉트
- **위치**: `src/app/login/page.tsx` - `handleLogin` 함수

---

## 수정 사항

### 1. 정지 페이지 리다이렉트 버그 수정 ✅

**파일**: `src/app/login/page.tsx`

**수정 전**:
```typescript
if (result.error.startsWith('SUSPENDED:')) {
  const parts = result.error.split(':');
  const reason = parts[1] || '不明な理由';
  const until = parts[2] ? new Date(parts[2]).toLocaleString('ja-JP') : '不明';
  
  setModalState({
    isOpen: true,
    title: "アカウント停止中",
    message: `あなたのアカウントは停止されています。\n\n停止理由: ${reason}\n停止期限: ${until}\n\nサポートにお問い合わせください。`,
    isAlert: true,
    confirmText: "OK",
    // ...
  });
}
```

**수정 후**:
```typescript
if (result.error.startsWith('SUSPENDED:')) {
  const parts = result.error.split(':');
  const reason = parts[1] || '不明な理由';
  const until = parts[2] || '';
  
  // 정지 페이지로 리다이렉트 (버그 수정)
  const suspendedUrl = `/suspended?reason=${encodeURIComponent(reason)}${until ? `&until=${encodeURIComponent(until)}` : ''}`;
  router.push(suspendedUrl);
  return;
}
```

**효과**:
- ✅ 계정이 정지된 경우 `/suspended` 페이지로 자동 리다이렉트
- ✅ 정지 이유와 기간이 URL 파라미터로 전달됨
- ✅ `/suspended` 페이지에서 정지 정보를 표시

---

## 테스트 순서 권장사항

### 올바른 테스트 순서

1. **유저 테스트 먼저 실행**
   - 유저가 캐릭터를 작성
   - 유저가 포인트를 사용
   - 유저가 채팅을 시작
   - 등등...

2. **관리자 테스트 나중에 실행**
   - 관리자가 유저가 작성한 캐릭터를 수정
   - 관리자가 유저를 정지/해제
   - 관리자가 통계를 확인
   - 등등...

### 실행 방법

```bash
# 유저 테스트만 먼저 실행
npx playwright test e2e/user-*.spec.ts --workers=1

# 그 다음 관리자 테스트 실행
npx playwright test e2e/admin-*.spec.ts --workers=1

# 또는 전체 테스트를 순차적으로 실행 (workers=1)
npx playwright test --workers=1
```

---

## 참고

- [E2E 테스트 결과 분석](./E2E_TEST_ANALYSIS_2025-12-24.md)
- [E2E 테스트 수정 사항](./E2E_TEST_FIXES_2025-12-24.md)











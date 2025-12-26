# E2E 테스트 개선 사항

## 1. 병렬 실행 설정

### 변경 사항
- **이전**: `workers=1` (순차 실행)
- **현재**: `workers: undefined` (CPU 코어 수에 따라 자동 조정, 기본적으로 여러 개 동시 실행)

### 설정 위치
`playwright.config.ts`:
```typescript
workers: process.env.CI ? 1 : undefined, // CI環境では1、ローカル環境では複数並列実行可能
```

### 실행 방법
```bash
# 기본 실행 (여러 개 동시 실행)
npm run test:e2e

# 명시적으로 workers 수 지정
npx playwright test --workers=4

# 순차 실행 (디버깅용)
npx playwright test --workers=1
```

---

## 2. 스크롤 처리 개선

### Playwright의 기본 동작
Playwright는 기본적으로 요소를 클릭하거나 상호작용할 때 **자동으로 스크롤**합니다. 하지만 명시적으로 스크롤을 보장하는 것이 더 안정적입니다.

### 추가된 헬퍼 함수
`e2e/helpers/auth.ts`에 다음 함수들을 추가했습니다:

#### `scrollIntoViewAndClick()`
```typescript
// 요소를 뷰에 스크롤한 후 클릭
await scrollIntoViewAndClick(page, buttonLocator);
```

#### `scrollIntoViewAndFill()`
```typescript
// 요소를 뷰에 스크롤한 후 입력
await scrollIntoViewAndFill(page, inputLocator, 'value');
```

### 적용된 테스트
주요 버튼 클릭 부분에 `scrollIntoViewIfNeeded()` 추가:
- `admin-notices.spec.ts` - 저장 버튼
- `admin-terms.spec.ts` - 저장 버튼
- `admin-user-management.spec.ts` - 확인 버튼

### 사용 예시
```typescript
// 이전
await button.click();

// 개선 후
await button.scrollIntoViewIfNeeded();
await button.click();
```

---

## 3. 개선 효과

### 병렬 실행
- **실행 시간 단축**: 여러 테스트를 동시에 실행하여 전체 실행 시간 감소
- **리소스 활용**: CPU 코어를 효율적으로 사용

### 스크롤 처리
- **안정성 향상**: 화면에 보이지 않는 요소도 확실하게 찾아서 클릭
- **에러 감소**: "Element is not visible" 에러 방지

---

## 4. 주의사항

### 병렬 실행 시
- 테스트 간 데이터 충돌 가능성 (같은 계정 사용 시)
- 리소스 사용량 증가
- 디버깅이 어려울 수 있음 (순차 실행 권장)

### 스크롤 처리
- `scrollIntoViewIfNeeded()`는 요소가 이미 보이면 스크롤하지 않음
- `scrollIntoView()`는 항상 스크롤 (불필요한 스크롤 가능)

---

## 5. 권장 사항

### 개발/디버깅 시
```bash
# 순차 실행 (에러 추적 용이)
npx playwright test --workers=1
```

### CI/CD 또는 정기 실행 시
```bash
# 병렬 실행 (빠른 실행)
npx playwright test --workers=4
# 또는 기본값 사용 (자동 조정)
npm run test:e2e
```

### 스크롤이 필요한 경우
- 긴 페이지에서 하단 버튼 클릭
- 모달 내부 요소
- 스크롤 가능한 리스트 내 요소

---

## 6. 참고 자료

- [Playwright 공식 문서 - Auto-waiting](https://playwright.dev/docs/actionability)
- [Playwright 공식 문서 - Scrolling](https://playwright.dev/docs/input#scrolling-into-view)
- [Playwright 공식 문서 - Workers](https://playwright.dev/docs/test-parallel)











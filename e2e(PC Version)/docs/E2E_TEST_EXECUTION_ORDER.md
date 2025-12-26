# E2E 테스트 실행 순서 가이드

## 중요: 테스트 순서가 중요한 이유

### 문제 상황
1. **관리자 테스트를 먼저 실행**하면:
   - 관리자가 유저를 정지/잠금할 수 있음
   - 이후 유저 테스트 실행 시 계정이 잠금/정지 상태로 실패

2. **올바른 순서**:
   - 유저 테스트 먼저 → 유저가 캐릭터 작성, 채팅 등 수행
   - 관리자 테스트 나중에 → 관리자가 유저가 만든 데이터를 관리

---

## 권장 테스트 실행 순서

### 1단계: 유저 테스트 (먼저 실행)

```bash
# 유저 인증 및 기본 기능
npx playwright test e2e/user-auth.spec.ts --workers=1

# 유저 캐릭터 관련
npx playwright test e2e/user-character.spec.ts --workers=1
npx playwright test e2e/character-search.spec.ts --workers=1

# 유저 포인트 및 소셜 기능
npx playwright test e2e/user-points.spec.ts --workers=1
npx playwright test e2e/user-social.spec.ts --workers=1

# 유저 채팅 및 기타 기능
npx playwright test e2e/chat.spec.ts --workers=1
npx playwright test e2e/misc-features.spec.ts --workers=1
npx playwright test e2e/points-critical.spec.ts --workers=1

# 유저 기타 기능
npx playwright test e2e/user-persona.spec.ts --workers=1
npx playwright test e2e/user-ranking.spec.ts --workers=1
npx playwright test e2e/user-notifications.spec.ts --workers=1
npx playwright test e2e/user-notices.spec.ts --workers=1
npx playwright test e2e/user-inquiries.spec.ts --workers=1
npx playwright test e2e/user-journey.spec.ts --workers=1
```

### 2단계: 인증 테스트

```bash
npx playwright test e2e/auth.spec.ts --workers=1
```

### 3단계: 관리자 테스트 (나중에 실행)

```bash
# 관리자 기본 기능
npx playwright test e2e/admin.spec.ts --workers=1

# 관리자 유저 관리
npx playwright test e2e/admin-user-management.spec.ts --workers=1

# 관리자 캐릭터 관리
npx playwright test e2e/admin-character-management.spec.ts --workers=1

# 관리자 기타 관리
npx playwright test e2e/admin-notices.spec.ts --workers=1
npx playwright test e2e/admin-reports.spec.ts --workers=1
npx playwright test e2e/admin-terms.spec.ts --workers=1
npx playwright test e2e/admin-guides.spec.ts --workers=1
npx playwright test e2e/admin-banners.spec.ts --workers=1
npx playwright test e2e/admin-ip-management.spec.ts --workers=1
```

---

## 한 번에 실행하는 방법

### 방법 1: 파일 이름 순서 활용 (권장)

Playwright는 기본적으로 파일 이름 순서로 테스트를 실행합니다. 
파일 이름을 조정하여 순서를 제어할 수 있습니다:

```bash
# workers=1로 순차 실행 (파일 이름 순서대로)
npx playwright test --workers=1
```

### 방법 2: 그룹별 실행

```bash
# 유저 테스트 그룹
npx playwright test e2e/user-*.spec.ts e2e/character-search.spec.ts e2e/chat.spec.ts e2e/misc-features.spec.ts e2e/points-critical.spec.ts --workers=1

# 인증 테스트
npx playwright test e2e/auth.spec.ts --workers=1

# 관리자 테스트 그룹
npx playwright test e2e/admin-*.spec.ts --workers=1
```

### 방법 3: npm 스크립트 추가

`package.json`에 스크립트 추가:

```json
{
  "scripts": {
    "test:e2e:user": "playwright test e2e/user-*.spec.ts e2e/character-search.spec.ts e2e/chat.spec.ts e2e/misc-features.spec.ts e2e/points-critical.spec.ts --workers=1",
    "test:e2e:auth": "playwright test e2e/auth.spec.ts --workers=1",
    "test:e2e:admin": "playwright test e2e/admin-*.spec.ts --workers=1",
    "test:e2e:ordered": "npm run test:e2e:user && npm run test:e2e:auth && npm run test:e2e:admin"
  }
}
```

사용:
```bash
npm run test:e2e:ordered
```

---

## 주의사항

### ⚠️ workers 설정
- **`--workers=1`**: 순차 실행 (권장)
- **`--workers=undefined`**: 병렬 실행 (테스트 간 의존성 문제 발생 가능)

### ⚠️ 계정 잠금 방지
- 유저 테스트를 먼저 실행하여 계정이 정상 상태인지 확인
- 관리자 테스트에서 유저를 정지/잠금하는 경우, 테스트 후 해제 필요

### ⚠️ 데이터 의존성
- 유저가 만든 데이터(캐릭터, 채팅 등)를 관리자가 관리하는 흐름
- 테스트 순서가 잘못되면 데이터가 없어서 테스트 실패 가능

---

## 참고

- [E2E 테스트 순서 수정](./E2E_TEST_ORDER_FIX.md)
- [E2E 테스트 결과 분석](./E2E_TEST_ANALYSIS_2025-12-24.md)











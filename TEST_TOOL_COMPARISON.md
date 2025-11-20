# 🧪 테스트 도구 비교: 웹 UI vs CLI

## 📊 비교표

| 항목 | 웹 UI (현재) | CLI 스크립트 | 하이브리드 (추천) |
|------|-------------|-------------|-----------------|
| **구현 복잡도** | ⭐⭐ (이미 구현됨) | ⭐⭐⭐ (추가 구현 필요) | ⭐⭐⭐ (공통 로직 추출 필요) |
| **사용 편의성** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **자동화** | ❌ 어려움 | ✅ 쉬움 | ✅ 쉬움 |
| **CI/CD 통합** | ❌ 어려움 | ✅ 쉬움 | ✅ 쉬움 |
| **실시간 확인** | ✅ 가능 | ❌ 불가능 | ✅ 가능 (웹) |
| **로그 저장** | ❌ 어려움 | ✅ 쉬움 | ✅ 쉬움 |
| **스케줄링** | ❌ 불가능 | ✅ 가능 | ✅ 가능 |
| **유지보수** | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |

## 🎯 추천: 하이브리드 접근법

### 이유:
1. **웹 UI는 유지**: 관리자가 브라우저에서 쉽게 테스트
2. **CLI 추가**: CI/CD와 자동화를 위해 스크립트 제공
3. **공통 로직 공유**: 테스트 로직을 모듈화하여 중복 제거

### 구현 방법:

#### 1단계: 공통 테스트 로직 모듈화
```typescript
// src/lib/test-runner.ts
export const testDefinitions = { ... };
export async function runTest(test, session) { ... }
```

#### 2단계: 웹 UI에서 모듈 사용
```typescript
// src/app/admin/test/page.tsx
import { testDefinitions, runTest } from '@/lib/test-runner';
```

#### 3단계: CLI에서 모듈 사용
```javascript
// scripts/test-runner.mjs
import { testDefinitions, runTest } from '../src/lib/test-runner.ts';
```

## 📝 사용 시나리오

### 웹 UI 사용 (관리자)
```
1. 브라우저에서 /admin/test 접속
2. 로그인
3. "すべて実行" 클릭
4. 실시간으로 결과 확인
5. AI 분석 결과 확인
```

### CLI 사용 (자동화)
```bash
# 기본 실행
npm run test -- --email admin@example.com --password pass123

# JSON 출력
npm run test:json -- --email admin@example.com --password pass123

# 특정 카테고리만
npm run test:category -- --category "ポイント機能"

# AI 분석 포함
npm run test:ai -- --email admin@example.com --password pass123

# 결과 파일 저장
npm run test -- --email admin@example.com --password pass123 --output test-results.json
```

### CI/CD 통합 예시
```yaml
# .github/workflows/test.yml
name: API Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: npm run test:json -- --email ${{ secrets.TEST_EMAIL }} --password ${{ secrets.TEST_PASSWORD }} --output test-results.json
      - uses: actions/upload-artifact@v3
        with:
          name: test-results
          path: test-results.json
```

## 💡 결론

**현재 상황에서는 웹 UI를 유지하고, 필요시 CLI를 추가하는 것이 가장 실용적입니다.**

### 단계별 구현:
1. ✅ **현재**: 웹 UI 완성 (이미 구현됨)
2. 🔄 **다음**: CLI 스크립트 완성 (기본 구조 작성됨)
3. 🔄 **향후**: 공통 로직 모듈화 (리팩토링)

### 복잡도 평가:
- **웹 UI만**: ⭐⭐ (이미 완료)
- **CLI만**: ⭐⭐⭐ (새로 구현 필요)
- **하이브리드**: ⭐⭐⭐⭐ (리팩토링 필요하지만 장기적으로 유리)

**추천**: 현재는 웹 UI를 사용하고, 자동화가 필요해지면 CLI를 완성하는 방식이 좋습니다.





# E2E 테스트 수정: 테스트용 캐릭터 ID 사용 (2025-12-24)

## 수정 내용

### 1. 테스트용 캐릭터 ID 상수 추가

**파일**: `e2e/helpers/test-data.ts` (신규 생성)

테스트용 캐릭터 ID를 상수로 정의:
- `TEST_CHARACTER_IDS = [86, 81]`
- `DEFAULT_TEST_CHARACTER_ID = 86`
- `getTestCharacterUrl()` 헬퍼 함수

### 2. 캐릭터 상세 페이지 테스트 수정

**파일**: `e2e/user-character.spec.ts`

#### `1-2-3: キャラクター詳細確認`
- **변경 전**: 캐릭터 목록에서 첫 번째 캐릭터 클릭
- **변경 후**: 테스트용 캐릭터 ID (86)로 직접 접근
  ```typescript
  const testCharacterUrl = getTestCharacterUrl();
  await page.goto(testCharacterUrl);
  ```

#### `1-3-5: キャラクタークローン`
- **변경 전**: 캐릭터 목록에서 첫 번째 캐릭터 클릭
- **변경 후**: 테스트용 캐릭터 ID (86)로 직접 접근

### 3. 캐릭터 작성 테스트 수정

**파일**: `e2e/user-character.spec.ts`

#### `1-3-2: キャラクター作成 (手動入力)`
- **문제**: 입력 필드 선택자가 작동하지 않음
- **원인**: `CharacterForm`은 `name` 속성이 없고 `placeholder`나 `label`로 찾아야 함
- **수정**:
  - 이름 입력: `input[placeholder*="名前"]` 또는 `label` 기반 선택자
  - 설명 입력: `textarea[placeholder*="説明"]` 또는 `label` 기반 선택자
  - 대체 선택자 추가로 안정성 향상

### 4. 페르소나 작성 테스트 수정

**파일**: `e2e/user-persona.spec.ts`

#### `1-10-2: ペルソナ作成`
- **문제**: 입력 필드 선택자가 작동하지 않음
- **원인**: 실제 구조와 테스트 코드의 선택자가 일치하지 않음
- **수정**:
  - 닉네임: `input[type="text"][placeholder*="ニックネーム"]`
  - 나이: `input[type="number"][placeholder*="年齢"]`
  - 성별: `button:has-text("女性")` (select가 아닌 button)
  - 설명: `textarea[placeholder*="詳細情報"]`

### 5. 문의 작성 테스트 수정

**파일**: `e2e/user-inquiries.spec.ts`

#### `1-9-1: お問い合わせ作成`
- **문제**: 내용 입력 필드를 찾지 못함
- **원인**: 모달 방식으로 문의 작성 (페이지가 아닌 모달)
- **수정**:
  - 모달 열기: `button:has-text("お問い合わせを作成")` 클릭
  - 유형 선택: `select` with `option:has-text("システム問題")`
  - 제목: `input[type="text"][placeholder*="タイトル"]`
  - 내용: `textarea` (첫 번째)

---

## 참고

- [스킵 분석](./E2E_TEST_SKIP_ANALYSIS.md)
- [유저 테스트 결과](./E2E_TEST_RESULTS_USER_2025-12-24.md)











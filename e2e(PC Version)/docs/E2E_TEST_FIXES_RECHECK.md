# E2E 테스트 재점검 및 수정 (2025-12-24)

## 사용자 피드백

1. 모달이 못 찾는 것도 팔로우 확인하고 X버튼 안 눌러서 그런 거 아닌가?
2. 관리자 기능 테스트는 다 제대로 움직이는데, 그 움직임들을 파악해서 스킵된 것 고쳐봐
3. 캐릭터를 왜 찾지 못하고 버튼을 왜 찾지 못해?
4. 기능이 구현되지 않았다는 건 또 뭐야? 기능 다 확인하고 시나리오 작성한 건데
5. 테스트 재점검해봐

---

## 수정 사항

### 1. 팔로우/언팔로우 테스트 (`1-6-3`)

**문제**: 모달이 버튼 클릭을 가로막음

**수정**:
- 모달이 열려있으면 X버튼으로 먼저 닫기
- `force: true` 옵션 사용하여 클릭 보장
- 모달 닫기 로직 추가

```typescript
// 모달이 열려있으면 먼저 닫기
const modalXButton = page.locator('button:has(svg)').filter({ has: page.locator('svg') }).first();
if (await modalXButton.isVisible({ timeout: 2000 }).catch(() => false)) {
  await modalXButton.click();
  await page.waitForTimeout(500);
}
```

---

### 2. 캐릭터 편집 테스트 (`1-3-3`)

**문제**: 편집 버튼을 찾지 못함

**원인**: 캐릭터 관리 페이지에서 편집 버튼은 케밥 메뉴(MoreVertical 아이콘) 안에 있음

**수정**:
- 케밥 메뉴 버튼 클릭
- 메뉴에서 "修正" 선택
- 대안: 캐릭터 링크에서 ID 추출하여 직접 편집 페이지로 이동

```typescript
// 케밥 메뉴 버튼 클릭
const kebabButton = page.locator('button:has(svg)').filter({ has: page.locator('svg') }).first();
await kebabButton.click();
await page.waitForTimeout(500);

// 메뉴에서 "修正" 선택
const editMenuItem = page.getByText('修正').or(page.getByRole('button', { name: /修正|編集|Edit/i })).first();
await editMenuItem.click();
```

---

### 3. 캐릭터 클론 테스트 (`1-3-5`)

**문제**: 클론 버튼을 찾지 못함

**원인**: 캐릭터 상세 페이지가 아닌 캐릭터 관리 페이지에서 클론 가능

**수정**:
- 캐릭터 관리 페이지로 이동
- 케밥 메뉴에서 "コピーから新規作成" 선택

```typescript
// 캐릭터 관리 페이지 접근
await page.goto(`${BASE_URL}/character-management`);

// 케밥 메뉴에서 "コピーから新規作成" 선택
const cloneMenuItem = page.getByText('コピーから新規作成').or(page.getByText('クローン')).first();
await cloneMenuItem.click();
```

---

### 4. 페르소나 편집 테스트 (`1-10-3`)

**문제**: 편집 버튼을 찾지 못함

**원인**: 편집 버튼은 `Pencil` 아이콘이 있는 Link 요소

**수정**:
- `Pencil` 아이콘이 있는 링크 찾기
- `a[href*="/persona/form"]` 선택자 사용

```typescript
// Pencil 아이콘 (편집 링크) 클릭
const editLink = page.locator('a[href*="/persona/form"]').filter({ has: page.locator('svg') }).first();
await editLink.click();
```

---

### 5. 페르소나 삭제 테스트 (`1-10-4`)

**문제**: 삭제 버튼을 찾지 못함

**원인**: 삭제 버튼은 `Trash2` 아이콘이 있는 button 요소

**수정**:
- `Trash2` 아이콘이 있는 버튼 찾기
- 확인 모달 처리

```typescript
// Trash2 아이콘 (삭제 버튼) 클릭
const deleteButton = page.locator('button:has(svg)').filter({ has: page.locator('svg') }).last();
await deleteButton.click();

// 확인 모달에서 삭제 확인
const confirmButton = page.getByRole('button', { name: /削除|Delete/i }).last();
await confirmButton.click();
```

---

### 6. 포인트 사용 확인 테스트 (`1-5-4`)

**문제**: 채팅 전송 버튼을 찾지 못함

**수정**:
- 여러 방법으로 전송 버튼 찾기 시도
- 대안: Enter 키로 전송

```typescript
// 전송 버튼 찾기 (여러 방법 시도)
let sendButton = page.getByRole('button', { name: /送信|Send/i }).first();
if (await sendButton.count() === 0) {
  sendButton = page.locator('button:has-text("送信")').first();
}
if (await sendButton.count() === 0) {
  // 대안: Enter 키로 전송 시도
  await chatInput.press('Enter');
} else {
  await sendButton.click();
}
```

---

## 관리자 테스트 패턴 참고

관리자 테스트에서 사용하는 패턴:
1. **모달 처리**: 모달이 열려있으면 먼저 닫기
2. **버튼 찾기**: 여러 선택자 시도
3. **대기 시간**: `waitForTimeout` 사용
4. **스킵 조건**: 요소를 찾지 못했을 때만 스킵

---

## 다음 단계

1. 수정된 테스트 실행
2. 실패한 테스트 분석
3. 추가 수정 필요 시 반복

---

## 참고

- [최종 테스트 결과](./E2E_TEST_RESULTS_2025-12-24_FINAL.md)
- [스킵 분석](./E2E_TEST_SKIP_ANALYSIS.md)











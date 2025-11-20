# Better Babechat 확장 프로그램 코드 분석

## 발견된 문제점

### 1. **Manifest 문제** (이미 수정함)
- ❌ `clipboardRead` 권한 없음 → 붙여넣기 실패
- ❌ `type: "module"` → Manifest V3 호환성 문제
- ✅ 수정 완료: `manifest.json` 업데이트됨

### 2. **코드 분석 결과**

#### 핵심 셀렉터:
```javascript
MyCharactersId = "my-character-dropdown-menu-trigger"
DropDownClass = "z-50 min-w-32 overflow-hidden rounded-md border border-gray-500 bg-[#333] p-1 text-white shadow-md..."
```

#### 실행 조건:
1. URL이 `character`와 `my`를 포함해야 함
2. 드롭다운 메뉴가 정확히 **3개의 자식 노드**를 가져야 함
3. `document.getElementsByClassName(DropDownClass).item(0)`로 찾음

#### 복사/붙여넣기 로직:
```javascript
// 복사
copyToClipboard(JSON.stringify(character.data))

// 붙여넣기  
getClipboardTextModern().then(text => {
  character.set(JSON.parse(text))
})
```

## 가능한 문제 원인

### 1. **사이트 DOM 구조 변경**
- 드롭다운 클래스명이나 ID가 변경되었을 수 있음
- 자식 노드 개수가 3개가 아닐 수 있음

### 2. **권한 문제** (수정 완료)
- `clipboardRead` 권한이 없어서 `navigator.clipboard.readText()` 실패

### 3. **타이밍 문제**
- 페이지가 완전히 로드되기 전에 스크립트가 실행될 수 있음
- `setInterval`로 계속 확인하지만, 요소를 찾지 못할 수 있음

## 디버깅 방법

### 1. 콘솔에서 확인:
```javascript
// 드롭다운 트리거 찾기
document.querySelectorAll('#my-character-dropdown-menu-trigger')

// 드롭다운 메뉴 찾기
document.querySelector('.z-50.min-w-32')

// 현재 URL 확인
document.URL.includes('character') && document.URL.includes('my')
```

### 2. 확장 프로그램 로그 확인:
- 콘솔에서 `[Better Babe][DEBUG]` 메시지 확인
- `copy_dropdown` 이벤트가 발생하는지 확인

## 해결 방법

### 즉시 적용 가능:
1. ✅ `manifest.json` 수정 완료 (clipboardRead 권한 추가)
2. 확장 프로그램 새로고침 필요

### 추가 확인 필요:
1. 사이트의 실제 DOM 구조 확인
2. 셀렉터가 올바른 요소를 찾는지 확인
3. API 엔드포인트가 변경되지 않았는지 확인


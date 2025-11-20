# 빠른 수정 가이드

## 완료된 작업

1. ✅ `manifest.json` 수정 완료
   - `clipboardRead` 권한 추가
   - `index_new.js` 사용하도록 변경

2. ✅ 원본 `index.js` 백업 완료
   - `index.js` → `index.js.backup`로 이동

3. ✅ 새 버전 `index_new.js` 생성
   - 복사/붙여넣기 기능만 포함
   - API 엔드포인트 `/edit/draft` 지원
   - 강화된 드롭다운 감지 로직

## 적용 방법

1. **Chrome 확장 프로그램 새로고침**:
   - `chrome://extensions/` 접속
   - Better Babechat 확장 프로그램 찾기
   - **"새로고침"** 버튼 클릭 (중요!)

2. **페이지 새로고침**:
   - `https://babechat.ai/ko/character/my` 페이지 새로고침 (F5)

3. **드롭다운 열기**:
   - 캐릭터 목록에서 드롭다운 메뉴 열기
   - "복사", "붙여넣기" 옵션이 나타나는지 확인

## 디버깅

콘솔에서 다음 메시지들을 확인하세요:

- `[Better Babe] 초기화 시작 - 새 버전` ← 이게 보이면 새 버전이 로드된 것
- `[Better Babe] 캐릭터 관리 페이지 감지`
- `[Better Babe] 드롭다운 메뉴 발견, 기능 추가`
- `[Better Babe] 메뉴 항목 추가 완료`

## 문제 해결

### 여전히 원본 index.js가 로드되는 경우:
1. 확장 프로그램을 완전히 제거
2. 다시 로드

### 드롭다운을 찾지 못하는 경우:
콘솔에서 다음 실행:
```javascript
document.querySelectorAll('[class*="z-50"]')
```

결과를 확인하고 알려주시면 선택자를 수정하겠습니다.


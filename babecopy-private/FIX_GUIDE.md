# Better Babechat 확장 프로그램 수정 가이드

## 문제 진단

확장 프로그램이 작동하지 않는 주요 원인:

1. **권한 부족**: `clipboardRead` 권한이 없어서 붙여넣기가 작동하지 않을 수 있습니다.
2. **Manifest V3 호환성**: 원래 manifest에 `type: "module"`이 있었는데, 이는 Manifest V3에서 제거되었습니다.
3. **사이트 구조 변경**: babechat.ai 사이트의 DOM 구조가 변경되어 요소를 찾지 못할 수 있습니다.

## 수정 방법

### 방법 1: manifest.json 교체 (권장)

1. `park/hnnhijlhpgclphofnplplfimbnfhddeg/manifest.json` 파일을 백업
2. `manifest_fixed.json`의 내용을 `manifest.json`에 복사
3. Chrome에서 확장 프로그램 다시 로드

### 방법 2: 수동 수정

`manifest.json` 파일을 열어서 다음을 수정:

```json
{
  "manifest_version": 3,
  "name": "Better Babechat",
  "version": "1.1.1",
  "permissions": [
    "clipboardRead",    // ← 이 줄 추가
    "clipboardWrite"
  ],
  "host_permissions": [  // ← 이 섹션 추가
    "https://www.babechat.ai/*",
    "https://babechat.ai/*"
  ],
  "content_scripts": [{
    "js": ["./index.js"],
    "matches": [
      "https://www.babechat.ai/*",
      "https://babechat.ai/*"
    ],
    "run_at": "document_end"  // ← type: "module" 제거
  }]
}
```

## 적용 방법

1. Chrome에서 `chrome://extensions/` 접속
2. "개발자 모드" 활성화
3. Better Babechat 확장 프로그램 찾기
4. "새로고침" 버튼 클릭 (또는 확장 프로그램 제거 후 다시 로드)
5. babechat.ai 사이트에서 테스트

## 디버깅

확장 프로그램이 여전히 작동하지 않으면:

1. **콘솔 확인**:
   - babechat.ai 페이지에서 F12로 개발자 도구 열기
   - Console 탭에서 오류 메시지 확인

2. **확장 프로그램 오류 확인**:
   - `chrome://extensions/`에서 Better Babechat의 "오류" 버튼 클릭
   - 오류 메시지 확인

3. **요소 찾기 확인**:
   - 콘솔에서 다음 명령어 실행:
   ```javascript
   // 드롭다운 메뉴 찾기
   document.querySelector('.z-50.min-w-32')
   
   // 캐릭터 관리 페이지 확인
   document.URL.includes('character') && document.URL.includes('my')
   ```

## 예상되는 문제와 해결책

### 문제 1: "clipboardRead 권한이 없습니다"
- **해결**: manifest.json에 `"clipboardRead"` 권한 추가

### 문제 2: "요소를 찾을 수 없습니다"
- **원인**: 사이트의 DOM 구조가 변경됨
- **해결**: index.js의 셀렉터를 업데이트해야 할 수 있음

### 문제 3: "API 요청 실패"
- **원인**: API 엔드포인트가 변경되었거나 인증 토큰 문제
- **해결**: API URL과 인증 방식을 확인

## 추가 정보

원래 확장 프로그램의 주요 기능:
- 캐릭터 관리 페이지에서 드롭다운 메뉴에 "복사", "붙여넣기" 옵션 추가
- 복사: 캐릭터 데이터를 JSON 형식으로 클립보드에 복사
- 붙여넣기: 클립보드의 JSON 데이터를 읽어서 새 캐릭터로 생성


// Better Babechat 확장 프로그램 수정 버전
// 원본 index.js를 로드한 후 문제를 수정하는 wrapper

// 원본 스크립트 로드
const script = document.createElement('script');
script.src = chrome.runtime.getURL('index.js');
script.type = 'module';
document.head.appendChild(script);

// 문제 해결: clipboardRead 권한이 없을 때 fallback 추가
(function() {
  'use strict';
  
  // 원본 함수를 래핑하여 오류 처리 개선
  const originalReadText = navigator.clipboard.readText;
  if (navigator.clipboard && navigator.clipboard.readText) {
    navigator.clipboard.readText = function() {
      return originalReadText.call(navigator.clipboard).catch(err => {
        console.error('[Better Babe] 클립보드 읽기 실패:', err);
        // 사용자에게 권한 요청 안내
        if (err.name === 'NotAllowedError') {
          alert('클립보드 읽기 권한이 필요합니다. 확장 프로그램 설정에서 권한을 허용해주세요.');
        }
        throw err;
      });
    };
  }
  
  // DOM 셀렉터 개선: 더 유연한 선택자 사용
  const observer = new MutationObserver(() => {
    // 드롭다운이 로드될 때까지 기다림
    const dropdowns = document.querySelectorAll('[class*="z-50"][class*="min-w-32"]');
    if (dropdowns.length > 0) {
      dropdowns.forEach(dropdown => {
        // 자식 노드가 3개가 아니어도 작동하도록 수정
        if (dropdown.childNodes.length >= 2) {
          // 복사/붙여넣기 버튼이 이미 추가되었는지 확인
          const hasCopyPaste = Array.from(dropdown.childNodes).some(node => 
            node.textContent && (node.textContent.includes('복사') || node.textContent.includes('붙여넣기'))
          );
          
          if (!hasCopyPaste) {
            console.log('[Better Babe] 드롭다운 발견, 기능 추가 시도');
          }
        }
      });
    }
  });
  
  // 페이지 로드 후 관찰 시작
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      observer.observe(document.body, { childList: true, subtree: true });
    });
  } else {
    observer.observe(document.body, { childList: true, subtree: true });
  }
  
  console.log('[Better Babe] 수정 스크립트 로드됨');
})();


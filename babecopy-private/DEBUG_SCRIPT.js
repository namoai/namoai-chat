// 디버깅용 스크립트
// babechat.ai 페이지의 콘솔에서 실행하세요

console.log('=== Better Babechat 확장 프로그램 디버깅 ===');

// 1. URL 확인
console.log('1. 현재 URL:', document.URL);
console.log('   - character 포함:', document.URL.includes('character'));
console.log('   - my 포함:', document.URL.includes('my'));

// 2. 드롭다운 트리거 찾기
const triggers = document.querySelectorAll('#my-character-dropdown-menu-trigger');
console.log('2. 드롭다운 트리거 개수:', triggers.length);
triggers.forEach((trigger, i) => {
  console.log(`   트리거 ${i}:`, trigger);
  console.log(`   - data-state:`, trigger.getAttribute('data-state'));
  console.log(`   - index:`, trigger.getAttribute('index'));
});

// 3. 드롭다운 메뉴 찾기
const dropdownClass = 'z-50 min-w-32 overflow-hidden rounded-md border border-gray-500 bg-[#333] p-1 text-white shadow-md';
const dropdowns = document.getElementsByClassName(dropdownClass.split(' ')[0]);
console.log('3. 드롭다운 메뉴 찾기:');
console.log('   - 클래스로 찾은 개수:', dropdowns.length);
if (dropdowns.length > 0) {
  const dropdown = dropdowns.item(0);
  console.log('   - 첫 번째 드롭다운:', dropdown);
  console.log('   - 자식 노드 개수:', dropdown.childNodes.length);
  console.log('   - 자식 노드 3개인가?', dropdown.childNodes.length === 3);
  
  // 자식 노드 상세 확인
  Array.from(dropdown.childNodes).forEach((child, i) => {
    console.log(`   - 자식 ${i}:`, child.nodeName, child.textContent?.substring(0, 50));
  });
}

// 4. 쿠키 확인 (인증 토큰)
function getCookie(name) {
  const match = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/([\.$?*|{}\(\)\[\]\\\/\+^])/g, '\\$1') + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : undefined;
}
const token = getCookie('bc__session');
console.log('4. 인증 토큰:', token ? '존재함' : '없음');

// 5. 클립보드 권한 확인
if (navigator.clipboard) {
  console.log('5. 클립보드 API 사용 가능');
  navigator.clipboard.readText().then(text => {
    console.log('   - 클립보드 내용:', text.substring(0, 100));
  }).catch(err => {
    console.error('   - 클립보드 읽기 실패:', err);
  });
} else {
  console.log('5. 클립보드 API 사용 불가');
}

// 6. 확장 프로그램이 로드되었는지 확인
console.log('6. 확장 프로그램 로드 확인:');
console.log('   - window 객체 확인:', typeof window !== 'undefined');

console.log('=== 디버깅 완료 ===');


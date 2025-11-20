// Better Babechat - 복사/붙여넣기 기능만 추출한 새 버전
(() => {
  'use strict';

  // 설정
  const CONFIG = {
    MyCharactersId: 'my-character-dropdown-menu-trigger',
    DropDownClass: 'z-50 min-w-32 overflow-hidden rounded-md border border-gray-500 bg-[#333] p-1 text-white shadow-md',
    babe_api_url: 'https://api.babechatapi.com',
    token_key: 'bc__session',
    copy: '복사',
    paste: '붙여넣기'
  };

  // 디버깅 플래그
  const DEBUG = true;

  // 유틸리티 함수
  function getCookie(name) {
    const match = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/([\.$?*|{}\(\)\[\]\\\/\+^])/g, '\\$1') + '=([^;]*)'));
    return match ? decodeURIComponent(match[1]) : undefined;
  }

  function getParams() {
    try {
      const params = {};
      const urlParts = document.URL.split('/');
      const queryString = urlParts[urlParts.length - 1].split('?')[1];
      if (queryString) {
        queryString.split('&').forEach(param => {
          const [key, value] = param.split('=');
          params[key] = value;
        });
      }
      return params.tab ? params : { tab: 'all', sort: 'popular' };
    } catch {
      return { tab: 'all', sort: 'popular' };
    }
  }

  function reParams(params) {
    return Object.keys(params).map(key => `${key}=${params[key]}`).join('&');
  }

  // API 클래스
  class BabeAPI {
    getMyCharacters(params) {
      const xhr = new XMLHttpRequest();
      const url = `${CONFIG.babe_api_url}/ko/api/characters/my?${reParams(params)}`;
      xhr.open('GET', url, false);
      xhr.setRequestHeader('Authorization', `Bearer ${getCookie(CONFIG.token_key)}`);
      xhr.send();
      
      if (xhr.status === 200) {
        const characters = JSON.parse(xhr.responseText);
        const sort = params.sort || 'popular';
        if (sort === 'popular') {
          return characters.sort((a, b) => b.chatCount - a.chatCount);
        } else if (sort === 'likes') {
          return characters.sort((a, b) => b.likeCount - a.likeCount);
        } else if (sort === 'latest') {
          return characters.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        } else if (sort === 'oldest') {
          return characters.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        }
        return characters;
      }
      return [];
    }

    getMyCharacter(characterId) {
      // 원본 코드와 동일하게 /edit 엔드포인트만 사용
      const xhr = new XMLHttpRequest();
      const url = `${CONFIG.babe_api_url}/ko/api/characters/${characterId}/edit`;
      xhr.open('GET', url, false);
      xhr.setRequestHeader('Authorization', `Bearer ${getCookie(CONFIG.token_key)}`);
      xhr.send();
      
      if (xhr.status === 200) {
        try {
          return JSON.parse(xhr.responseText);
        } catch (e) {
          console.error('[Better Babe] 응답 파싱 실패:', e);
          return null;
        }
      }
      
      console.error('[Better Babe] 캐릭터 데이터 가져오기 실패:', characterId, xhr.status);
      console.error('[Better Babe] 응답 본문:', xhr.responseText.substring(0, 200));
      return null;
    }

    updateCharacter(characterId, data) {
      console.log('[Better Babe] updateCharacter 호출:', characterId);
      console.log('[Better Babe] 업데이트 데이터:', JSON.stringify(data, null, 2).substring(0, 500));
      
      // 원본 코드와 동일하게 /edit 엔드포인트만 사용
      const xhr = new XMLHttpRequest();
      const url = `${CONFIG.babe_api_url}/ko/api/characters/${characterId}/edit`;
      xhr.open('PUT', url, false);
      xhr.setRequestHeader('Authorization', `Bearer ${getCookie(CONFIG.token_key)}`);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.send(JSON.stringify(data));
      
      console.log('[Better Babe] /edit 응답:', xhr.status, xhr.statusText);
      console.log('[Better Babe] 응답 본문:', xhr.responseText.substring(0, 300));
      
      if (xhr.status === 200) {
        try {
          const result = JSON.parse(xhr.responseText);
          console.log('[Better Babe] 업데이트 성공');
          return result;
        } catch (e) {
          console.error('[Better Babe] 응답 파싱 실패:', e);
          // 파싱 실패해도 200이면 성공으로 간주
          return { success: true };
        }
      } else {
        console.error('[Better Babe] 캐릭터 업데이트 실패:', characterId, xhr.status);
        console.error('[Better Babe] 응답 본문:', xhr.responseText.substring(0, 500));
        return null;
      }
    }
  }

  // 클립보드 함수
  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      console.log('[Better Babe] 복사 완료');
      return true;
    } catch (err) {
      console.error('[Better Babe] 복사 실패:', err);
      // Fallback
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        document.body.removeChild(textArea);
        return true;
      } catch {
        document.body.removeChild(textArea);
        return false;
      }
    }
  }

  async function getClipboardText() {
    try {
      const text = await navigator.clipboard.readText();
      return text;
    } catch (err) {
      console.error('[Better Babe] 클립보드 읽기 실패:', err);
      alert('클립보드 읽기 권한이 필요합니다. 확장 프로그램 설정에서 권한을 허용해주세요.');
      return null;
    }
  }

  // 캐릭터 데이터 처리
  function prepareCharacterData(character) {
    const data = { ...character };
    // keywordBooks의 id 제거
    if (data.keywordBooks) {
      data.keywordBooks = data.keywordBooks.map(book => {
        const rest = { ...book };
        delete rest.id;
        return rest;
      });
    }
    return data;
  }

  function formatCharacterForUpdate(character) {
    console.log('[Better Babe] formatCharacterForUpdate 입력:', character);
    
    // keywordBooks의 id 제거
    const keywordBooks = (character.keywordBooks || []).map(book => {
      const rest = { ...book };
      delete rest.id;
      return rest;
    });
    
    // images 처리 - 원본 코드와 동일하게
    let image = '';
    let emotionImages = [];
    
    if (character.images && Array.isArray(character.images) && character.images.length > 0) {
      image = character.images[0].url || character.images[0].imageUrl || '';
      emotionImages = character.images.slice(1).map(img => img.url || img.imageUrl || '');
    } else if (character.image) {
      image = character.image;
      emotionImages = character.emotionImages || [];
    }
    
    const result = {
      name: character.name || '',
      description: character.description || '',
      image: image,
      emotionImages: emotionImages,
      characterDetails: character.characterDetails || '',
      initialAction: character.initialAction || '',
      initialMessage: character.initialMessage || '',
      isAdult: character.isAdult || false,
      visibility: 'private', // 붙여넣기 시 항상 비공개로 설정
      category: character.category || '',
      keywordBooks: keywordBooks,
      systemPrompt: character.systemPrompt || '',
      tags: character.hashtags || character.tags || [],
      details: {
        jobs: character.jobs || character.details?.jobs || [],
        interests: character.interests || character.details?.interests || [],
        likes: character.likes || character.details?.likes || [],
        dislikes: character.dislikes || character.details?.dislikes || [],
        date: character.date || character.details?.date || '',
        location: character.location || character.details?.location || '',
        height: character.height || character.details?.height || '',
        weight: character.weight || character.details?.weight || '',
        details: character.details?.details || character.details || '',
        replySuggestions: character.replySuggestions || character.details?.replySuggestions || []
      }
    };
    
    console.log('[Better Babe] formatCharacterForUpdate 출력:', JSON.stringify(result, null, 2).substring(0, 500));
    return result;
  }

  // 드롭다운 클래스
  class DropdownMenu {
    constructor() {
      this.items = [];
    }

    addDropdown(label, callback) {
      this.items.push([label, callback]);
    }

    apply(dropdownElement, characterStates) {
      if (!dropdownElement) {
        console.log('[Better Babe] 드롭다운 요소가 없습니다');
        return;
      }

      // 이미 처리된 드롭다운인지 확인
      if (dropdownElement.hasAttribute('data-better-babe-processed')) {
        console.log('[Better Babe] 이미 처리된 드롭다운입니다');
        return;
      }

      console.log('[Better Babe] 드롭다운 발견, 자식 노드 수:', dropdownElement.childNodes.length);
      console.log('[Better Babe] 드롭다운 HTML:', dropdownElement.outerHTML.substring(0, 300));

      // 기존에 추가한 항목이 있는지 확인하고 제거
      const existingItems = dropdownElement.querySelectorAll('[data-better-babe]');
      if (existingItems.length > 0) {
        console.log('[Better Babe] 기존 항목 제거:', existingItems.length);
        existingItems.forEach(item => {
          try {
            item.remove();
          } catch (e) {
            console.warn('[Better Babe] 항목 제거 실패:', e);
          }
        });
      }
      
      // 처리 시작 표시
      dropdownElement.setAttribute('data-better-babe-processing', 'true');

      // 템플릿 찾기 - 여러 방법 시도
      let template = null;
      
      // 방법 1: 첫 번째 자식 노드
      if (dropdownElement.childNodes.length > 0) {
        template = dropdownElement.childNodes[0];
      }
      
      // 방법 2: button이나 클릭 가능한 요소 찾기
      if (!template || template.nodeType !== 1) {
        template = dropdownElement.querySelector('button, a, div[role="menuitem"], div[class*="cursor-pointer"]');
      }
      
      // 방법 3: li 요소 찾기
      if (!template) {
        template = dropdownElement.querySelector('li, ul > *');
      }
      
      // 방법 4: 직접 div 생성
      if (!template) {
        template = document.createElement('div');
        template.style.padding = '8px 12px';
        template.style.color = '#fff';
      }
      
      if (!template) {
        console.error('[Better Babe] 템플릿을 찾을 수 없습니다');
        return;
      }
      
      console.log('[Better Babe] 템플릿 사용:', template.tagName || 'div', template.className);

      this.items.forEach(([label, callback], index) => {
        // 구분선 추가 (첫 번째 항목이 아닐 때만)
        if (index > 0) {
          const separator = document.createElement('div');
          separator.style.borderTop = '1px solid rgba(255,255,255,0.1)';
          separator.style.marginTop = '4px';
          separator.style.marginBottom = '4px';
          separator.style.height = '1px';
          separator.setAttribute('data-better-babe', 'separator');
          dropdownElement.appendChild(separator);
        }
        
        // 메뉴 항목 추가
        const item = template.cloneNode ? template.cloneNode(true) : document.createElement('div');
        
        // 텍스트 설정
        if (item.textContent !== undefined) {
          item.textContent = label;
        } else {
          item.innerHTML = label;
        }
        
        // 스타일 설정
        item.setAttribute('data-better-babe', 'true');
        item.style.cursor = 'pointer';
        item.style.padding = item.style.padding || '8px 12px';
        item.style.color = item.style.color || '#fff';
        item.style.display = 'block';
        item.style.width = '100%';
        item.style.textAlign = 'left';
        
        // 기존 클래스 유지하면서 스타일 추가
        if (!item.className || !item.className.includes('hover')) {
          item.style.transition = 'background-color 0.2s';
        }
        
        // 호버 효과
        const originalBg = item.style.backgroundColor || window.getComputedStyle(item).backgroundColor;
        item.addEventListener('mouseenter', () => {
          item.style.backgroundColor = 'rgba(255,255,255,0.1)';
        });
        item.addEventListener('mouseleave', () => {
          item.style.backgroundColor = originalBg || 'transparent';
        });
        
        item.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          
          console.log('[Better Babe] 클릭:', label);
          
          // 현재 열린 캐릭터 찾기
          const api = new BabeAPI();
          const params = getParams();
          const characters = api.getMyCharacters(params);
          
          console.log('[Better Babe] 전체 캐릭터 목록:', characters.length);
          
          // 드롭다운이 속한 캐릭터 찾기
          let targetCharacterId = findCharacterIdFromContext(dropdownElement);
          
          // characterStates에서 열린 것 찾기
          const openIndex = characterStates.findIndex(state => state === true);
          console.log('[Better Babe] 열린 캐릭터 인덱스:', openIndex);
          
          // 인덱스로 찾기 (fallback)
          if (!targetCharacterId && openIndex >= 0 && characters[openIndex]) {
            targetCharacterId = characters[openIndex].characterId;
            console.log('[Better Babe] 인덱스로 찾은 캐릭터 ID:', targetCharacterId);
          }
          
          // URL에서 찾기 (최후의 수단)
          if (!targetCharacterId) {
            const urlMatch = document.URL.match(/character[s]?[\/u]*\/([a-f0-9-]+)/i);
            if (urlMatch) {
              targetCharacterId = urlMatch[1];
              console.log('[Better Babe] URL에서 찾은 캐릭터 ID:', targetCharacterId);
            }
          }
          
          if (targetCharacterId) {
            console.log('[Better Babe] 캐릭터 ID로 데이터 로드:', targetCharacterId);
            const character = api.getMyCharacter(targetCharacterId);
            if (character) {
              console.log('[Better Babe] 캐릭터 데이터 로드 성공');
              // characterId가 없으면 추가
              if (!character.characterId && !character.id) {
                character.characterId = targetCharacterId;
              } else if (character.id && !character.characterId) {
                character.characterId = character.id;
              }
              console.log('[Better Babe] 캐릭터 ID 확인:', character.characterId || character.id);
              callback(character, api);
            } else {
              console.error('[Better Babe] 캐릭터 데이터 로드 실패');
              alert('캐릭터 데이터를 가져올 수 없습니다. API 엔드포인트를 확인해주세요.');
            }
          } else {
            console.error('[Better Babe] 캐릭터를 찾을 수 없습니다');
            console.log('[Better Babe] 디버그 정보:', {
              url: document.URL,
              characters: characters.length,
              openIndex: openIndex,
              dropdownParent: dropdownElement.parentElement?.outerHTML?.substring(0, 200)
            });
            alert('캐릭터를 찾을 수 없습니다. 캐릭터 관리 페이지에서 드롭다운을 열어주세요.');
          }
        });

        dropdownElement.appendChild(item);
        console.log('[Better Babe] 메뉴 항목 추가됨:', label);
      });
      
      // 처리 완료 표시
      dropdownElement.removeAttribute('data-better-babe-processing');
      dropdownElement.setAttribute('data-better-babe-processed', 'true');
      console.log('[Better Babe] 메뉴 항목 추가 완료');
    }
  }

  // 드롭다운 찾기 헬퍼 함수
  function findDropdownMenu() {
    // 여러 방법으로 드롭다운 찾기 (안전한 선택자만 사용)
    const selectors = [
      // z-50과 min-w-32 조합
      '.z-50.min-w-32',
      '[class*="z-50"][class*="min-w-32"]',
      // 더 일반적인 선택자
      '[class*="z-50"]',
      'div[role="menu"]'
    ];

    for (const selector of selectors) {
      try {
        const elements = document.querySelectorAll(selector);
        for (const el of elements) {
          const style = window.getComputedStyle(el);
          // 보이지 않는 요소는 제외
          if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
            continue;
          }
          
          // 드롭다운 메뉴는 보통 여러 자식 노드를 가지고 있고, 배경색이 어두움
          if (el.childNodes.length >= 1) {
            const bgColor = style.backgroundColor;
            const className = el.className || '';
            const hasDarkBg = bgColor.includes('rgb(51') || bgColor.includes('#333') || 
                             className.includes('bg-[') || className.includes('bg-gray') ||
                             className.includes('bg-[#333]');
            
            // z-50 클래스가 있고, 배경색이 어두우며, 자식 노드가 있는 경우
            if ((hasDarkBg || className.includes('z-50')) && className.includes('min-w-32')) {
              if (DEBUG) console.log('[Better Babe] 드롭다운 후보 발견:', selector, el);
              return el;
            }
          }
        }
      } catch (e) {
        if (DEBUG) console.warn('[Better Babe] 선택자 오류:', selector, e);
      }
    }
    
    return null;
  }

  // 캐릭터 ID 찾기 함수
  function findCharacterIdFromContext(element) {
    // 여러 방법으로 캐릭터 ID 찾기
    let current = element;
    let depth = 0;
    
    while (current && depth < 15) {
      // data-character-id 속성
      const charId = current.getAttribute?.('data-character-id') || 
                     current.getAttribute?.('data-characterid') ||
                     current.getAttribute?.('character-id');
      if (charId) {
        if (DEBUG) console.log('[Better Babe] data 속성에서 캐릭터 ID 발견:', charId);
        return charId;
      }
      
      // href에서 추출
      const href = current.getAttribute?.('href') || current.href;
      if (href) {
        const match = href.match(/character[s]?[\/u]*\/([a-f0-9-]+)/i);
        if (match) {
          if (DEBUG) console.log('[Better Babe] href에서 캐릭터 ID 발견:', match[1]);
          return match[1];
        }
      }
      
      // ID 속성에서 추출
      const id = current.id;
      if (id && id.match(/[a-f0-9-]{8,}/i)) {
        if (DEBUG) console.log('[Better Babe] id 속성에서 캐릭터 ID 발견:', id);
        return id;
      }
      
      current = current.parentElement;
      depth++;
    }
    
    return null;
  }

  // 메인 함수
  function init() {
    console.log('[Better Babe] 초기화 시작 - 새 버전 v2');

    const api = new BabeAPI();
    const dropdown = new DropdownMenu();
    
    // MutationObserver로 동적 드롭다운 감지 (더 공격적으로)
    const observer = new MutationObserver((mutations) => {
      const currentUrl = document.URL;
      if (!currentUrl.includes('character') || !currentUrl.includes('my')) {
        return;
      }
      
      // 모든 추가된 노드 확인
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType !== 1) return; // Element node만
          
          // 직접 드롭다운인지 확인
          if (node.classList && (node.classList.contains('z-50') || node.className.includes('z-50'))) {
            if (node.childNodes.length >= 1 && !node.hasAttribute('data-better-babe-processed')) {
              console.log('[Better Babe] MutationObserver: 새 드롭다운 발견 (직접)');
              setTimeout(() => {
                tryApplyDropdown(dropdown, node);
              }, 50);
            }
          }
          
          // 자식 중에 드롭다운이 있는지 확인
          const childDropdown = node.querySelector?.('.z-50, [class*="z-50"]');
          if (childDropdown && childDropdown.childNodes.length >= 1 && 
              !childDropdown.hasAttribute('data-better-babe-processed')) {
            console.log('[Better Babe] MutationObserver: 새 드롭다운 발견 (자식)');
            setTimeout(() => {
              tryApplyDropdown(dropdown, childDropdown);
            }, 50);
          }
        });
      });
    });
    
    // observer 시작
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    // 드롭다운 적용 함수
    function tryApplyDropdown(dropdownMenu, dropdownElement) {
      if (!dropdownElement) {
        return;
      }
      
      // 이미 처리되었거나 처리 중인지 확인
      if (dropdownElement.hasAttribute('data-better-babe-processed') || 
          dropdownElement.hasAttribute('data-better-babe-processing')) {
        return;
      }
      
      // 드롭다운이 실제로 보이는지 확인
      const style = window.getComputedStyle(dropdownElement);
      if (style.display === 'none' || style.visibility === 'hidden') {
        return;
      }
      
      // 자식 노드가 있어야 함
      if (dropdownElement.childNodes.length < 1) {
        return;
      }
      
      console.log('[Better Babe] 드롭다운 적용 시도');
      console.log('[Better Babe] 드롭다운 클래스:', dropdownElement.className);
      console.log('[Better Babe] 드롭다운 자식 노드 수:', dropdownElement.childNodes.length);
      
      // characterStates는 나중에 클릭 시에 찾기
      const characterStates = [];
      
      // 트리거 찾기 시도 (있으면 사용)
      const triggers = document.querySelectorAll(`#${CONFIG.MyCharactersId}, [id*="dropdown"], [id*="menu"]`);
      triggers.forEach((trigger, index) => {
        const isOpen = trigger.getAttribute('data-state') === 'open' || 
                      trigger.getAttribute('aria-expanded') === 'true';
        characterStates[index] = isOpen;
      });
      
      dropdownMenu.apply(dropdownElement, characterStates);
    }

    // 복사 기능 추가
    dropdown.addDropdown(CONFIG.copy, (character) => {
      const data = prepareCharacterData(character);
      const json = JSON.stringify(data, null, 2);
      copyToClipboard(json).then(success => {
        if (success) {
          alert('복사되었습니다!');
        } else {
          alert('복사 실패했습니다.');
        }
      });
    });

    // 붙여넣기 기능 추가
    dropdown.addDropdown(CONFIG.paste, async (character) => {
      const text = await getClipboardText();
      if (!text) return;

      try {
        const pastedData = JSON.parse(text);
        const formattedData = formatCharacterForUpdate(pastedData);
        
        // characterId 확인 및 설정
        const characterId = character.characterId || character.id;
        if (!characterId) {
          console.error('[Better Babe] characterId를 찾을 수 없습니다:', character);
          alert('캐릭터 ID를 찾을 수 없습니다.');
          return;
        }
        
        console.log('[Better Babe] 붙여넣기 시도, characterId:', characterId);
        const result = api.updateCharacter(characterId, formattedData);
        if (result) {
          alert('붙여넣기되었습니다!');
          window.location.reload();
        } else {
          alert('붙여넣기 실패했습니다.');
        }
      } catch (err) {
        console.error('[Better Babe] 붙여넣기 오류:', err);
        alert('붙여넣기 실패: 잘못된 형식입니다.');
      }
    });

    // 드롭다운 감지 및 적용 (setInterval 백업)
    let lastUrl = '';
    let appliedToDropdowns = new Set();
    
    const checkInterval = setInterval(() => {
      const currentUrl = document.URL;
      
      // URL이 변경되었거나 캐릭터 관리 페이지인 경우
      if (currentUrl !== lastUrl && currentUrl.includes('character') && currentUrl.includes('my')) {
        lastUrl = currentUrl;
        appliedToDropdowns.clear();
        console.log('[Better Babe] 캐릭터 관리 페이지 감지:', currentUrl);
      }
      
      // 캐릭터 관리 페이지에서만 작동
      if (!currentUrl.includes('character') || !currentUrl.includes('my')) {
        return;
      }
      
      // 드롭다운 찾기
      const dropdownElement = findDropdownMenu();
      
      if (dropdownElement && !appliedToDropdowns.has(dropdownElement) && 
          !dropdownElement.hasAttribute('data-better-babe-processed') &&
          !dropdownElement.hasAttribute('data-better-babe-processing')) {
        
        const style = window.getComputedStyle(dropdownElement);
        if (style.display !== 'none' && style.visibility !== 'hidden') {
          console.log('[Better Babe] setInterval: 드롭다운 발견');
          tryApplyDropdown(dropdown, dropdownElement);
          appliedToDropdowns.add(dropdownElement);
        }
      }
    }, 200); // 더 빠른 감지

    // 페이지 언로드 시 정리
    window.addEventListener('beforeunload', () => {
      clearInterval(checkInterval);
    });
  }

  // 페이지 로드 완료 후 실행
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();


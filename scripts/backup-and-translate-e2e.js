const fs = require('fs');
const path = require('path');

// 한국어를 일본어로 변환하는 함수
function translateKoreanToJapanese(text) {
  // 기본적인 한국어-일본어 매핑 (긴 단어부터 매칭)
  const translations = [
    ['업로드', 'アップロード'],
    ['프로그레스', 'プログレス'],
    ['타임아웃', 'タイムアウト'],
    ['로깅', 'ロギング'],
    ['명시적', '明示的'],
    ['스크롤', 'スクロール'],
    ['등록', '登録'],
    ['입력', '入力'],
    ['검색', '検索'],
    ['클릭', 'クリック'],
    ['확인', '確認'],
    ['대기', '待機'],
    ['완료', '完了'],
    ['스킵', 'スキップ'],
    ['에러', 'エラー'],
    ['경고', '警告'],
    ['표시', '表示'],
    ['페이지', 'ページ'],
    ['버튼', 'ボタン'],
    ['탭', 'タブ'],
    ['이미지', '画像'],
    ['태그', 'タグ'],
    ['상태', '状態'],
    ['메시지', 'メッセージ'],
    ['영역', '領域'],
    ['선택', '選択'],
    ['모달', 'モーダル'],
    ['내부', '内部'],
    ['텍스트', 'テキスト'],
    ['최대', '最大'],
    ['시도', '試行'],
    ['발견', '発見'],
    ['링크', 'リンク'],
    ['없음', 'なし'],
    ['있음', 'あり'],
    ['있을', 'ある'],
    ['메뉴', 'メニュー'],
    ['자동', '自動'],
    ['처리', '処理'],
    ['설정', '設定'],
    ['재시도', '再試行'],
    ['패턴', 'パターン'],
    ['실패', '失敗'],
    ['성공', '成功'],
    ['케이스', 'ケース'],
    ['케밥', 'ケバブ'],
    ['다음', '次'],
    ['이전', '前'],
    ['루프', 'ループ'],
    ['다시', '再度'],
    ['한번', '一度'],
    ['더', 'もっと'],
    ['열림', '開き'],
    ['열리지', '開かない'],
    ['없는', 'ない'],
    ['있는', 'ある'],
    ['있는지', 'あるか'],
    ['없는지', 'ないか'],
    ['경우', '場合'],
    ['작성자', '作成者'],
    ['돌아가서', '戻って'],
    ['돌아가', '戻って'],
    ['배너', 'バナー'],
    ['관리', '管理'],
    ['一覧', '一覧'],
    ['作成', '作成'],
    ['ボタン', 'ボタン'],
    ['画面', '画面'],
    ['から', 'から'],
    ['순서', '順序'],
    ['홈', 'ホーム'],
    ['있で면', 'あれば'],
    ['なければ', 'なければ'],
    ['서', 'で'],
    ['옵션', 'オプション'],
    ['통과', '通過'],
    ['직', '直'],
    ['회', '回'],
    ['카드', 'カード'],
    ['형태', '形態'],
    ['동일한', '同じ'],
    ['상세', '詳細'],
    ['열린', '開いた'],
    ['찾는', '探す'],
    ['가진', '持つ'],
    ['정확하게', '正確に'],
    ['위', '上'],
    ['방법', '方法'],
    ['리스트', 'リスト'],
    ['領域', '領域'],
    ['が장', '最も'],
    ['が까운', '近い'],
    ['で직', '直'],
    ['재시도', '再試行'],
    ['중', '中'],
    ['내부', '内部'],
    ['통과', '通過'],
    ['통', '通'],
    ['と', 'と'],
    ['でで', 'で'],
    ['で', 'で'],
    ['됨', 'されます'],
    ['밖에', '外に'],
    ['컨테이너', 'コンテナ'],
    ['비활성화', '無効化'],
    ['복원', '復元'],
    ['포털', 'ポータル'],
    ['렌더링', 'レンダリング'],
    ['되므', 'される'],
    ['원래', '元の'],
    ['공개', '公開'],
    ['여러', '複数'],
    ['실제', '実際'],
    ['요소', '要素'],
    ['정보', '情報'],
    ['구조', '構造'],
    ['마지막', '最後'],
    ['사용', '使用'],
    ['전에', '前に'],
    ['모든', 'すべて'],
    ['나타날', '現れる'],
    ['変更', '変更'],
    ['되었는지', 'されたか'],
    ['이', 'が'],
    ['클래스', 'クラス'],
    ['を', 'を'],
    ['が진', '持つ'],
    ['含む', '含む'],
    ['해야', 'すべき'],
    ['함', 'すべき'],
    ['含む된', '含まれた'],
    ['또는', 'または'],
    ['가장', '最も'],
    ['近い', '近い'],
    ['발견', '発見'],
    ['개', '個'],
    ['찾은', '見つけた'],
    ['가', 'が'],
    ['아닐', 'ない'],
    ['수', '数'],
    ['있습니다', 'あります'],
    ['再度', '再度'],
    ['探す', '探す'],
    ['중', '中'],
    ['Link', 'Link'],
    ['div', 'div'],
    ['SVG', 'SVG'],
    ['アイコン', 'アイコン'],
    ['を', 'を'],
    ['が진', '持つ'],
    ['内部', '内部'],
    ['開く', '開く'],
    ['まで', 'まで'],
    ['待機', '待機'],
    ['表示', '表示'],
    ['메ッセージ', 'メッセージ'],
    ['가', 'が'],
    ['表示됨', '表示されます'],
    ['移動한', '移動した'],
    ['すべき すべき', 'すべき'],
    ['찾음', '見つけた'],
    ['비공개', '非公開'],
    ['전환', '切り替え'],
    ['확실한', '確実な'],
    ['찾지', '見つけ'],
    ['못했습니다', 'できませんでした'],
    ['자체를', '自体を'],
    ['直接', '直接'],
    ['자식', '子'],
    ['토글', 'トグル'],
    ['찾았', '見つけた'],
    ['で면', 'であれば'],
    ['복귀', '復帰'],
    ['시켜야', 'すべき'],
    ['새로고침', '再読み込み'],
    ['반대', '反対'],
    ['대로', '通り'],
    ['나모아', 'ナモアイ'],
    ['프렌즈', 'フレンズ'],
    ['登録/解除', '登録/解除'],
    ['する', 'する'],
    ['を', 'を'],
    ['探す', '探す'],
    ['中', '中'],
    ['가', 'が'],
    ['表示되고', '表示され'],
    ['되고', 'され'],
    ['원상태', '元の状態'],
    ['대로', '通り'],
    ['열기', '開く'],
    ['되어', 'されて'],
    ['있지', 'いない'],
    ['않은', 'ない'],
    ['위해', 'ために'],
    ['엽니다', '開きます'],
    ['정상', '正常'],
    ['종료', '終了'],
    ['유형', '種類'],
    ['필터링', 'フィルタリング'],
    ['결과', '結果'],
    ['없을', 'ない'],
    ['수도', '数も'],
    ['테스트', 'テスト'],
    ['시작', '開始'],
    ['데이터', 'データ'],
    ['を', 'を'],
    ['見つかり', '見つかり'],
    ['ません', 'ません'],
    ['通と', '通と'],
    ['가능한', '可能な'],
    ['オプション', 'オプション'],
    ['수집', '収集'],
    ['빈', '空'],
    ['값', '値'],
    ['나', 'または'],
    ['제외', '除外'],
    ['개', '個'],
    ['하나', '一つ'],
    ['선택', '選択'],
    ['다른', '異なる'],
    ['수', '数'],
    ['있', 'ある'],
    ['で므', 'である'],
    ['+1', '+1'],
    ['고려', '考慮'],
    ['업로드', 'アップロード'],
    ['않았습니다', 'ありませんでした'],
    ['않았', 'なかった'],
    ['않습니다', 'ありません'],
    ['않음', 'ない'],
    ['않을', 'ない'],
    ['않는', 'ない'],
    ['않아', 'ない'],
    ['않고', 'なく'],
    ['않게', 'なく'],
    ['않으면', 'なければ'],
    ['않는다', 'ない'],
    ['않다', 'ない'],
    ['않아야', 'なくては'],
    ['않아서', 'なくて'],
    ['않았던', 'なかった'],
    ['않았을', 'なかった'],
    ['않았으면', 'なければ'],
    ['않았어야', 'なくては'],
    ['않았어서', 'なくて'],
    ['않았어', 'なかった'],
    ['않았어요', 'ありませんでした'],
    ['될', 'される'],
    ['할', 'する'],
    ['가', 'が'],
    ['를', 'を'],
    ['을', 'を'],
    ['와', 'と'],
    ['과', 'と'],
    ['에', 'に'],
    ['로', 'で'],
    ['으로', 'で'],
    ['의', 'の'],
    ['에서', 'で'],
    ['까지', 'まで'],
    ['때', '時'],
    ['때까지', 'まで'],
    ['이다', 'です'],
    ['입니다', 'です'],
    ['합니다', 'します'],
    ['됩니다', 'されます'],
    ['되었습니다', 'されました'],
    ['했습니다', 'しました'],
    ['있습니다', 'あります'],
    ['없습니다', 'ありません'],
  ];

  let result = text;
  
  // 긴 단어부터 매칭 (긴 단어가 짧은 단어에 포함되지 않도록)
  translations.sort((a, b) => b[0].length - a[0].length);
  
  for (const [ko, ja] of translations) {
    // 모든 한국어 문자를 찾아서 변환 (단어 경계 무시)
    const regex = new RegExp(ko.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    result = result.replace(regex, ja);
  }
  
  // 한국어 문장 패턴 변환
  result = result.replace(/되었습니다/g, 'されました');
  result = result.replace(/했습니다/g, 'しました');
  result = result.replace(/있습니다/g, 'あります');
  result = result.replace(/없습니다/g, 'ありません');
  result = result.replace(/입니다/g, 'です');
  result = result.replace(/됩니다/g, 'されます');
  result = result.replace(/합니다/g, 'します');
  
  // "~할 때" -> "~する時"
  result = result.replace(/할 때/g, 'する時');
  result = result.replace(/될 때/g, 'される時');
  result = result.replace(/할 때까지/g, 'する時まで');
  
  // "~까지" -> "~まで"
  result = result.replace(/까지/g, 'まで');
  
  // "~에서" -> "~で"
  result = result.replace(/에서/g, 'で');
  
  // "~의" -> "~の"
  result = result.replace(/의/g, 'の');
  
  // "~가" -> "~が"
  result = result.replace(/가/g, 'が');
  
  // "~를/을" -> "~を"
  result = result.replace(/[를을]/g, 'を');
  
  // "~와/과" -> "~と"
  result = result.replace(/[와과]/g, 'と');
  
  // "~에" -> "~に"
  result = result.replace(/에/g, 'に');
  
  // "~로/으로" -> "~で"
  result = result.replace(/[로으로]/g, 'で');
  
  return result;
}

// 파일 내용 변환 - 완전히 새로운 접근 방식
function translateFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    
    // 한국어가 포함되어 있는지 확인
    const koreanPattern = /[가-힣]+/;
    if (!koreanPattern.test(content)) {
      return false;
    }
    
    // 라인별로 처리하여 정확하게 변환
    const lines = content.split('\n');
    const translatedLines = [];
    let changed = false;
    
    for (let line of lines) {
      const originalLine = line;
      
      // 한국어가 포함되어 있지 않으면 그대로 유지
      if (!/[가-힣]+/.test(line)) {
        translatedLines.push(line);
        continue;
      }
      
      // 주석 라인인 경우 먼저 처리
      if (line.trim().startsWith('//')) {
        // 주석 라인 전체를 변환
        let commentLine = line;
        let prevCommentLine = '';
        let commentIterations = 0;
        while (commentLine !== prevCommentLine && commentIterations < 30) {
          prevCommentLine = commentLine;
          commentLine = translateKoreanToJapanese(commentLine);
          commentIterations++;
        }
        line = commentLine;
      } else {
        // 일반 코드 라인: 문자열 내부의 한국어를 보호하면서 변환
        // 1. 문자열 부분을 임시로 치환 (간단한 패턴)
        const stringPlaceholders = [];
        let placeholderIndex = 0;
        
        // 단일 따옴표 문자열
        line = line.replace(/'([^']*)'/g, (match, strContent) => {
          const placeholder = `__STR_S_${placeholderIndex}__`;
          stringPlaceholders.push({ placeholder, content: strContent, quote: "'" });
          placeholderIndex++;
          return placeholder;
        });
        
        // 이중 따옴표 문자열
        line = line.replace(/"([^"]*)"/g, (match, strContent) => {
          const placeholder = `__STR_D_${placeholderIndex}__`;
          stringPlaceholders.push({ placeholder, content: strContent, quote: '"' });
          placeholderIndex++;
          return placeholder;
        });
        
        // 백틱 문자열 (템플릿 리터럴)
        line = line.replace(/`([^`]*)`/g, (match, strContent) => {
          const placeholder = `__STR_B_${placeholderIndex}__`;
          stringPlaceholders.push({ placeholder, content: strContent, quote: '`' });
          placeholderIndex++;
          return placeholder;
        });
        
        // 2. 나머지 부분(주석 포함)의 한국어 변환 - 여러 번 반복하여 확실하게
        let prevLine = '';
        let iterations = 0;
        while (line !== prevLine && iterations < 30) {
          prevLine = line;
          line = translateKoreanToJapanese(line);
          iterations++;
        }
        
        // 3. 문자열 부분 복원 및 변환
        for (const { placeholder, content, quote } of stringPlaceholders) {
          if (/[가-힣]+/.test(content)) {
            // 문자열 내부의 한국어도 변환 (여러 번 반복)
            let translatedContent = content;
            let prevContent = '';
            let contentIterations = 0;
            while (translatedContent !== prevContent && contentIterations < 30) {
              prevContent = translatedContent;
              translatedContent = translateKoreanToJapanese(translatedContent);
              contentIterations++;
            }
            line = line.replace(placeholder, quote + translatedContent + quote);
          } else {
            line = line.replace(placeholder, quote + content + quote);
          }
        }
      }
      
      // 4. 최종 확인: 아직 한국어가 남아있으면 다시 변환 (여러 번)
      let finalIterations = 0;
      while (/[가-힣]+/.test(line) && finalIterations < 30) {
        line = translateKoreanToJapanese(line);
        finalIterations++;
      }
      
      if (line !== originalLine) {
        changed = true;
      }
      translatedLines.push(line);
    }
    
    const result = translatedLines.join('\n');
    
    // 변경사항이 있는지 확인
    if (changed && result !== content) {
      fs.writeFileSync(filePath, result, 'utf8');
      console.log(`  ✅ 변환 완료: ${filePath}`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`  ❌ 오류 발생: ${filePath}`, error.message);
    return false;
  }
}

// 디렉토리 재귀적으로 처리
function processDirectory(dirPath, excludePatterns = []) {
  const files = fs.readdirSync(dirPath);
  let translatedCount = 0;
  
  for (const file of files) {
    const filePath = path.join(dirPath, file);
    const stat = fs.statSync(filePath);
    
    // 제외 패턴 확인
    const shouldExclude = excludePatterns.some(pattern => {
      if (typeof pattern === 'string') {
        return filePath.includes(pattern);
      }
      return pattern.test(filePath);
    });
    
    if (shouldExclude) {
      continue;
    }
    
    if (stat.isDirectory()) {
      translatedCount += processDirectory(filePath, excludePatterns);
    } else if (file.endsWith('.ts') || file.endsWith('.js')) {
      // 문서 파일 제외 (.md 등)
      if (file.endsWith('.md') || file.endsWith('.txt')) {
        continue;
      }
      
      const translated = translateFile(filePath);
      if (translated) {
        translatedCount++;
      }
    }
  }
  
  return translatedCount;
}

// 메인 함수
function main() {
  console.log('🚀 E2E 파일 한국어→일본어 변환 시작...\n');
  
  // 1. 백업 생성
  console.log('📦 백업 생성 중...');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const backupDir = path.join(__dirname, '..', 'backups', `e2e_backup_${timestamp}`);
  
  if (!fs.existsSync(path.join(__dirname, '..', 'backups'))) {
    fs.mkdirSync(path.join(__dirname, '..', 'backups'), { recursive: true });
  }
  
  // e2e 디렉토리 복사
  const e2eDir = path.join(__dirname, '..', 'e2e');
  if (fs.existsSync(e2eDir)) {
    // 간단한 복사 함수
    function copyDir(src, dest) {
      if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
      }
      const entries = fs.readdirSync(src, { withFileTypes: true });
      for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        if (entry.isDirectory()) {
          copyDir(srcPath, destPath);
        } else {
          fs.copyFileSync(srcPath, destPath);
        }
      }
    }
    
    copyDir(e2eDir, backupDir);
    console.log(`✅ 백업 완료: ${backupDir}\n`);
  } else {
    console.log('⚠️  e2e 디렉토리를 찾을 수 없습니다.');
    return;
  }
  
  // 2. 변환 실행 (여러 번 반복하여 확실하게 변환)
  console.log('🔄 파일 변환 시작...\n');
  const excludePatterns = [
    /\.md$/,
    /\.txt$/,
    /debug\.log$/,
    /README/,
  ];
  
  let totalTranslated = 0;
  let iteration = 0;
  const maxIterations = 5; // 최대 5번 반복
  
  // 한국어가 없어질 때까지 반복
  while (iteration < maxIterations) {
    iteration++;
    console.log(`\n[반복 ${iteration}/${maxIterations}]`);
    const translatedCount = processDirectory(e2eDir, excludePatterns);
    totalTranslated += translatedCount;
    
    if (translatedCount === 0) {
      console.log('  ✅ 더 이상 변환할 한국어가 없습니다.');
      break;
    }
  }
  
  // 최종 확인: 남은 한국어 체크
  console.log('\n📊 최종 확인 중...');
  const remainingFiles = [];
  function checkRemaining(dirPath, excludePatterns) {
    const files = fs.readdirSync(dirPath);
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const stat = fs.statSync(filePath);
      
      const shouldExclude = excludePatterns.some(pattern => {
        if (typeof pattern === 'string') {
          return filePath.includes(pattern);
        }
        return pattern.test(filePath);
      });
      
      if (shouldExclude) continue;
      
      if (stat.isDirectory()) {
        checkRemaining(filePath, excludePatterns);
      } else if (file.endsWith('.ts') || file.endsWith('.js')) {
        if (file.endsWith('.md') || file.endsWith('.txt')) continue;
        
        const content = fs.readFileSync(filePath, 'utf8');
        if (/[가-힣]+/.test(content)) {
          const matches = content.match(/[가-힣]+/g) || [];
          remainingFiles.push({ file: filePath, count: matches.length });
        }
      }
    }
  }
  
  checkRemaining(e2eDir, excludePatterns);
  
  if (remainingFiles.length > 0) {
    console.log(`\n⚠️  아직 ${remainingFiles.length}개 파일에 한국어가 남아있습니다:`);
    remainingFiles.slice(0, 10).forEach(({ file, count }) => {
      console.log(`  - ${file} (${count}개)`);
    });
    if (remainingFiles.length > 10) {
      console.log(`  ... 외 ${remainingFiles.length - 10}개 파일`);
    }
  } else {
    console.log('\n✅ 모든 한국어가 변환되었습니다!');
  }
  
  console.log(`\n✨ 변환 완료! 총 ${totalTranslated}개 파일이 변환되었습니다.`);
}

// 실행
if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error('에러:', error);
    process.exit(1);
  }
}

module.exports = { translateKoreanToJapanese, translateFile };

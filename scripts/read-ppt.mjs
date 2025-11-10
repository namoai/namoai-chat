import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import JSZip from 'jszip';
import { XMLParser } from 'fast-xml-parser';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function readPPT(pptPath) {
  try {
    console.log(`\n📊 PPT 파일 분석 시작: ${path.basename(pptPath)}\n`);
    
    // .pptx 파일은 실제로 ZIP 파일입니다
    const data = fs.readFileSync(pptPath);
    const zip = await JSZip.loadAsync(data);
    
    // 슬라이드 정보 추출
    const slideFiles = Object.keys(zip.files)
      .filter(name => name.startsWith('ppt/slides/slide') && name.endsWith('.xml'))
      .sort((a, b) => {
        const numA = parseInt(a.match(/slide(\d+)/)?.[1] || '0');
        const numB = parseInt(b.match(/slide(\d+)/)?.[1] || '0');
        return numA - numB;
      });
    
    console.log(`총 슬라이드 수: ${slideFiles.length}\n`);
    
    const xmlParser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      textNodeName: '#text',
      parseAttributeValue: true
    });
    
    const slides = [];
    
    // 각 슬라이드 내용 읽기
    for (let i = 0; i < slideFiles.length; i++) {
      const slideFile = slideFiles[i];
      const slideContent = await zip.files[slideFile].async('string');
      
      // XML 파싱
      const parsed = xmlParser.parse(slideContent);
      
      // 텍스트 추출 (여러 방법 시도)
      const texts = [];
      
      // 방법 1: a:t 태그에서 직접 추출
      const extractText = (obj) => {
        if (typeof obj === 'string') {
          if (obj.trim().length > 0) texts.push(obj.trim());
        } else if (Array.isArray(obj)) {
          obj.forEach(extractText);
        } else if (obj && typeof obj === 'object') {
          Object.values(obj).forEach(extractText);
        }
      };
      
      // XML에서 텍스트 노드 찾기
      const findTextNodes = (node, path = '') => {
        if (typeof node === 'string' && node.trim().length > 0) {
          texts.push(node.trim());
        } else if (Array.isArray(node)) {
          node.forEach(item => findTextNodes(item, path));
        } else if (node && typeof node === 'object') {
          // a:t 태그 찾기
          if (node['a:t'] || node['#text']) {
            const text = node['a:t']?.['#text'] || node['#text'];
            if (text && typeof text === 'string' && text.trim().length > 0) {
              texts.push(text.trim());
            }
          }
          Object.entries(node).forEach(([key, value]) => {
            findTextNodes(value, `${path}.${key}`);
          });
        }
      };
      
      findTextNodes(parsed);
      
      // 중복 제거 및 정리
      const uniqueTexts = [...new Set(texts)].filter(t => t.length > 0);
      
      slides.push({
        slideNumber: i + 1,
        texts: uniqueTexts
      });
      
      if (uniqueTexts.length > 0) {
        console.log(`\n--- 슬라이드 ${i + 1} ---`);
        uniqueTexts.forEach((text, idx) => {
          // 너무 긴 텍스트는 잘라서 표시
          const displayText = text.length > 100 ? text.substring(0, 100) + '...' : text;
          console.log(`  ${idx + 1}. ${displayText}`);
        });
      } else {
        console.log(`\n--- 슬라이드 ${i + 1} --- (텍스트 없음 또는 이미지만 포함)`);
      }
    }
    
    // 메타데이터 읽기
    if (zip.files['docProps/core.xml']) {
      const coreXml = await zip.files['docProps/core.xml'].async('string');
      const coreParsed = xmlParser.parse(coreXml);
      
      const title = coreParsed['cp:coreProperties']?.['dc:title'] || 
                   coreParsed['coreProperties']?.['title'] ||
                   coreParsed['title'];
      const creator = coreParsed['cp:coreProperties']?.['dc:creator'] ||
                     coreParsed['coreProperties']?.['creator'] ||
                     coreParsed['creator'];
      
      if (title) console.log(`\n📄 제목: ${title}`);
      if (creator) console.log(`👤 작성자: ${creator}`);
    }
    
    // 파일 정보
    const stats = fs.statSync(pptPath);
    console.log(`\n📦 파일 크기: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
    console.log(`📅 수정일: ${stats.mtime.toLocaleString()}`);
    
    return slides;
    
  } catch (error) {
    console.error('❌ PPT 파일 읽기 오류:', error.message);
    console.error(error.stack);
    throw error;
  }
}

// 명령줄 인자로 파일 경로 받기
const pptPath = process.argv[2];

if (!pptPath) {
  console.log('📖 사용법: node scripts/read-ppt.mjs <PPT파일경로>');
  console.log('\n예시:');
  console.log('  node scripts/read-ppt.mjs "나모스챗_서비스설명서_한국어.pptx"');
  process.exit(1);
}

const fullPath = path.isAbsolute(pptPath) 
  ? pptPath 
  : path.join(__dirname, '..', pptPath);

if (!fs.existsSync(fullPath)) {
  console.error(`❌ 파일을 찾을 수 없습니다: ${fullPath}`);
  process.exit(1);
}

readPPT(fullPath);


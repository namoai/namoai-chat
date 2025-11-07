import { readFile, writeFile } from 'fs/promises';
import { marked } from 'marked';
import puppeteer from 'puppeteer';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

async function convertMarkdownToPDF(mdFilePath, pdfFilePath) {
  console.log('📖 마크다운 파일 읽는 중...');
  const markdown = await readFile(mdFilePath, 'utf-8');
  
  console.log('🔄 HTML로 변환 중...');
  const html = await marked(markdown);
  
  const styledHtml = `
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>나모스 챗 서비스 설명서</title>
  <style>
    @page {
      margin: 20mm;
      size: A4;
    }
    
    body {
      font-family: 'Malgun Gothic', '맑은 고딕', 'Apple SD Gothic Neo', sans-serif;
      line-height: 1.8;
      color: #333;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
      font-size: 11pt;
    }
    
    h1 {
      color: #2563eb;
      border-bottom: 3px solid #2563eb;
      padding-bottom: 10px;
      margin-top: 30px;
      font-size: 28pt;
      page-break-before: always;
    }
    
    h1:first-of-type {
      page-break-before: avoid;
    }
    
    h2 {
      color: #1e40af;
      border-left: 5px solid #3b82f6;
      padding-left: 15px;
      margin-top: 25px;
      font-size: 20pt;
      page-break-after: avoid;
    }
    
    h3 {
      color: #1e3a8a;
      margin-top: 20px;
      font-size: 16pt;
      page-break-after: avoid;
    }
    
    h4 {
      color: #1e40af;
      font-size: 13pt;
      margin-top: 15px;
      page-break-after: avoid;
    }
    
    p {
      margin: 10px 0;
      text-align: justify;
      orphans: 3;
      widows: 3;
    }
    
    ul, ol {
      margin: 10px 0;
      padding-left: 25px;
    }
    
    li {
      margin: 5px 0;
      orphans: 2;
      widows: 2;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
      page-break-inside: avoid;
      font-size: 10pt;
    }
    
    th, td {
      border: 1px solid #ddd;
      padding: 12px;
      text-align: left;
    }
    
    th {
      background-color: #3b82f6;
      color: white;
      font-weight: bold;
    }
    
    tr:nth-child(even) {
      background-color: #f8fafc;
    }
    
    blockquote {
      border-left: 4px solid #3b82f6;
      background-color: #eff6ff;
      padding: 15px 20px;
      margin: 20px 0;
      font-style: italic;
      page-break-inside: avoid;
    }
    
    code {
      background-color: #f1f5f9;
      padding: 2px 6px;
      border-radius: 3px;
      font-family: 'Consolas', 'Monaco', monospace;
      font-size: 9pt;
    }
    
    pre {
      background-color: #1e293b;
      color: #e2e8f0;
      padding: 15px;
      border-radius: 5px;
      overflow-x: auto;
      page-break-inside: avoid;
    }
    
    pre code {
      background-color: transparent;
      color: inherit;
      padding: 0;
    }
    
    hr {
      border: none;
      border-top: 2px solid #e2e8f0;
      margin: 30px 0;
    }
    
    strong {
      color: #1e40af;
      font-weight: bold;
    }
    
    a {
      color: #2563eb;
      text-decoration: none;
    }
    
    a:hover {
      text-decoration: underline;
    }
    
    .emoji {
      font-size: 1.2em;
    }
    
    /* 페이지 브레이크 제어 */
    .page-break {
      page-break-before: always;
    }
    
    /* 첫 페이지 스타일 */
    h1:first-of-type {
      text-align: center;
      font-size: 36pt;
      color: #1e40af;
      margin-top: 100px;
      margin-bottom: 20px;
    }
    
    h1:first-of-type + h2 {
      text-align: center;
      border: none;
      color: #64748b;
      font-size: 18pt;
      font-weight: normal;
      margin-bottom: 150px;
    }
  </style>
</head>
<body>
  ${html}
</body>
</html>
  `;
  
  console.log('🚀 PDF 생성 중...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  await page.setContent(styledHtml, { waitUntil: 'networkidle0' });
  
  await page.pdf({
    path: pdfFilePath,
    format: 'A4',
    printBackground: true,
    margin: {
      top: '20mm',
      right: '15mm',
      bottom: '20mm',
      left: '15mm'
    },
    displayHeaderFooter: true,
    headerTemplate: '<div></div>',
    footerTemplate: `
      <div style="font-size: 9pt; color: #64748b; text-align: center; width: 100%; padding: 10px 0;">
        <span class="pageNumber"></span> / <span class="totalPages"></span>
      </div>
    `
  });
  
  await browser.close();
  console.log('✅ PDF 생성 완료!');
}

// 실행
const mdPath = join(projectRoot, '나모스챗_서비스설명서_한국어.md');
const pdfPath = join(projectRoot, '나모스챗_서비스설명서_한국어.pdf');

convertMarkdownToPDF(mdPath, pdfPath)
  .then(() => {
    console.log(`\n📄 PDF 파일이 생성되었습니다: ${pdfPath}`);
  })
  .catch(err => {
    console.error('❌ 에러 발생:', err);
    process.exit(1);
  });










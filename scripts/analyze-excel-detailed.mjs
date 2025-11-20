import ExcelJS from 'exceljs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

async function analyzeExcelDetailed() {
  console.log('📖 엑셀 파일 읽는 중...');
  const excelPath = join(projectRoot, 'UI設計書_ナモアイ.xlsx');
  
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(excelPath);

  console.log('\n📊 상세 구조 분석\n');
  
  // 첫 번째 시트만 자세히 분석
  const sheet = workbook.worksheets[0];
  console.log(`\n시트명: "${sheet.name}"`);
  console.log('='.repeat(100));
  
  // 첫 30행을 자세히 출력
  console.log('\n처음 30행의 전체 내용:\n');
  for (let i = 1; i <= Math.min(30, sheet.rowCount); i++) {
    const row = sheet.getRow(i);
    console.log(`\n--- 행 ${i} ---`);
    
    for (let j = 1; j <= 5; j++) {
      const cell = row.getCell(j);
      if (cell.value) {
        let displayValue = '';
        
        // richText 처리
        if (cell.value.richText) {
          displayValue = cell.value.richText.map(rt => rt.text).join('');
        } else {
          displayValue = String(cell.value);
        }
        
        console.log(`  열${j}: "${displayValue}"`);
        
        // 스타일 정보
        if (cell.font || cell.fill || cell.alignment) {
          const style = [];
          if (cell.font?.bold) style.push('굵게');
          if (cell.font?.size) style.push(`크기:${cell.font.size}`);
          if (cell.font?.color?.argb) style.push(`색:${cell.font.color.argb}`);
          if (cell.fill?.fgColor?.argb) style.push(`배경:${cell.fill.fgColor.argb}`);
          if (cell.alignment?.horizontal) style.push(`정렬:${cell.alignment.horizontal}`);
          if (style.length > 0) {
            console.log(`       스타일: ${style.join(', ')}`);
          }
        }
      }
    }
  }

  console.log('\n' + '='.repeat(100));
  console.log('\n✅ 상세 분석 완료!');
}

analyzeExcelDetailed()
  .then(() => {
    console.log('\n🎉 엑셀 상세 분석이 완료되었습니다!');
  })
  .catch(err => {
    console.error('❌ 에러 발생:', err);
    process.exit(1);
  });


















import ExcelJS from 'exceljs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

async function analyzeExcelTables() {
  console.log('📖 엑셀 파일 읽는 중...');
  const excelPath = join(projectRoot, 'UI設計書_ナモアイ.xlsx');
  
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(excelPath);

  const sheet = workbook.worksheets[0];
  console.log(`\n시트명: "${sheet.name}"`);
  console.log('='.repeat(100));
  
  // 테이블 형식 찾기 - 행 60부터 100까지 확인 (API I/F 테이블이 있을 것으로 예상)
  console.log('\n행 60-100 사이의 테이블 구조 확인:\n');
  
  for (let i = 60; i <= 100; i++) {
    const row = sheet.getRow(i);
    let hasMultipleCells = false;
    let cellValues = [];
    
    for (let j = 1; j <= 5; j++) {
      const cell = row.getCell(j);
      if (cell.value) {
        hasMultipleCells = true;
        let displayValue = '';
        
        if (cell.value.richText) {
          displayValue = cell.value.richText.map(rt => rt.text).join('');
        } else {
          displayValue = String(cell.value);
        }
        
        cellValues.push(`열${j}: "${displayValue.substring(0, 40)}"`);
        
        // 병합 정보
        if (cell.master) {
          cellValues.push(`(병합-마스터)`);
        } else if (cell.isMerged) {
          cellValues.push(`(병합)`);
        }
      }
    }
    
    if (hasMultipleCells && cellValues.length > 1) {
      console.log(`행 ${i}:`);
      cellValues.forEach(v => console.log(`  ${v}`));
      console.log('');
    }
  }

  // 병합 셀 상세 정보
  console.log('\n' + '='.repeat(100));
  console.log('\n병합된 셀 정보:\n');
  if (sheet.model.merges) {
    Object.keys(sheet.model.merges).forEach(merge => {
      console.log(`  ${merge}`);
    });
  }

  console.log('\n✅ 분석 완료!');
}

analyzeExcelTables()
  .then(() => {
    console.log('\n🎉 테이블 구조 분석이 완료되었습니다!');
  })
  .catch(err => {
    console.error('❌ 에러 발생:', err);
    process.exit(1);
  });


















import ExcelJS from 'exceljs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

async function analyzeExcelStructure() {
  console.log('📖 엑셀 파일 읽는 중...');
  const excelPath = join(projectRoot, 'UI設計書_ナモアイ.xlsx');
  
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(excelPath);

  console.log('\n📊 엑셀 구조 분석\n');
  console.log('='.repeat(80));
  console.log(`전체 시트 수: ${workbook.worksheets.length}개\n`);

  workbook.worksheets.forEach((sheet, idx) => {
    console.log(`\n[${idx + 1}] 시트명: "${sheet.name}"`);
    console.log('-'.repeat(80));
    
    // 행 수 확인
    const rowCount = sheet.rowCount;
    console.log(`  총 행 수: ${rowCount}`);
    
    // 열 수 확인
    const colCount = sheet.columnCount;
    console.log(`  총 열 수: ${colCount}`);
    
    // 첫 10행의 내용 확인
    console.log(`\n  처음 10행 미리보기:`);
    for (let i = 1; i <= Math.min(10, rowCount); i++) {
      const row = sheet.getRow(i);
      const cells = [];
      for (let j = 1; j <= Math.min(5, colCount); j++) {
        const cell = row.getCell(j);
        let value = cell.value;
        if (value && typeof value === 'object') {
          value = JSON.stringify(value).substring(0, 30);
        } else if (value) {
          value = String(value).substring(0, 30);
        }
        cells.push(value || '');
      }
      console.log(`    행 ${i}: [${cells.join(' | ')}]`);
    }
    
    // 병합된 셀 확인
    if (sheet.model.merges && Object.keys(sheet.model.merges).length > 0) {
      console.log(`\n  병합된 셀: ${Object.keys(sheet.model.merges).length}개`);
      Object.keys(sheet.model.merges).slice(0, 3).forEach(merge => {
        console.log(`    - ${merge}`);
      });
    }
    
    // 서식 확인 (첫 5행)
    console.log(`\n  서식 정보 (처음 5행):`);
    for (let i = 1; i <= Math.min(5, rowCount); i++) {
      const row = sheet.getRow(i);
      for (let j = 1; j <= Math.min(3, colCount); j++) {
        const cell = row.getCell(j);
        if (cell.value) {
          const style = {
            font: cell.font,
            fill: cell.fill,
            border: cell.border,
            alignment: cell.alignment
          };
          if (cell.font?.bold || cell.fill?.fgColor || cell.border?.top) {
            console.log(`    행${i},열${j}: ${JSON.stringify(style, null, 2).substring(0, 100)}...`);
          }
        }
      }
    }
  });

  console.log('\n' + '='.repeat(80));
  console.log('\n✅ 분석 완료!');
}

analyzeExcelStructure()
  .then(() => {
    console.log('\n🎉 엑셀 구조 분석이 완료되었습니다!');
  })
  .catch(err => {
    console.error('❌ 에러 발생:', err);
    process.exit(1);
  });











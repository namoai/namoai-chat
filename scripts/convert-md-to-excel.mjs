import ExcelJS from 'exceljs';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

async function convertMdToExcel() {
  console.log('📖 MD 파일 읽는 중...');
  const mdPath = join(projectRoot, 'CSV 파일 UI 설계서 변환 요청.md');
  const content = await readFile(mdPath, 'utf-8');

  console.log('📊 엑셀 워크북 생성 중...');
  const workbook = new ExcelJS.Workbook();
  
  // MD 파일을 줄 단위로 분리
  const lines = content.split('\n');
  
  let currentChapter = null;
  let currentSheet = null;
  let currentRow = 1;
  let tableHeaders = [];
  let inTable = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // 챕터 감지 (###으로 시작)
    if (line.startsWith('### ') && !line.startsWith('#### ')) {
      let chapterTitle = line.replace(/^###\s+/, '').trim();
      // ** 제거
      chapterTitle = chapterTitle.replace(/\*\*/g, '');
      
      // 챕터 번호와 제목 추출
      const match = chapterTitle.match(/^第(\d+)章[：:]\s*(.+)$/);
      if (match) {
        const chapterNum = match[1];
        let chapterName = match[2].trim();
        
        // 시트 이름에 사용할 수 없는 문자 제거 (* ? : \ / [ ])
        chapterName = chapterName.replace(/[\*\?:\\\\/\[\]]/g, '');
        
        // 시트 이름은 31자 제한이 있으므로 축약
        if (chapterName.length > 25) {
          chapterName = chapterName.substring(0, 25);
        }
        
        const sheetName = `${chapterNum.padStart(2, '0')}_${chapterName}`;
        console.log(`✨ 시트 생성: ${sheetName}`);
        
        currentSheet = workbook.addWorksheet(sheetName);
        currentRow = 1;
        
        // 제목 추가
        const titleRow = currentSheet.getRow(currentRow);
        titleRow.getCell(1).value = chapterTitle;
        titleRow.getCell(1).font = { bold: true, size: 14, color: { argb: 'FF0000FF' } };
        currentRow += 2;
        
        inTable = false;
        tableHeaders = [];
      }
      continue;
    }

    // 시트가 없으면 건너뛰기
    if (!currentSheet) continue;

    // 섹션 제목 (####로 시작)
    if (line.startsWith('#### ')) {
      const sectionTitle = line.replace(/^####\s+/, '').trim();
      
      inTable = false;
      tableHeaders = [];
      
      const sectionRow = currentSheet.getRow(currentRow);
      sectionRow.getCell(1).value = sectionTitle;
      sectionRow.getCell(1).font = { bold: true, size: 12, color: { argb: 'FF006400' } };
      currentRow += 1;
      continue;
    }

    // 테이블 감지 (| 로 시작)
    if (line.startsWith('|') && line.endsWith('|')) {
      const cells = line.split('|').map(cell => cell.trim()).filter(cell => cell);
      
      // 구분선 무시 (:---- 형태)
      if (cells[0].includes('----')) {
        inTable = true;
        continue;
      }

      if (!inTable) {
        // 테이블 헤더
        tableHeaders = cells;
        const headerRow = currentSheet.getRow(currentRow);
        cells.forEach((cell, idx) => {
          headerRow.getCell(idx + 1).value = cell;
          headerRow.getCell(idx + 1).font = { bold: true };
          headerRow.getCell(idx + 1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFD3D3D3' }
          };
        });
        currentRow += 1;
        inTable = true;
      } else {
        // 테이블 데이터
        const dataRow = currentSheet.getRow(currentRow);
        cells.forEach((cell, idx) => {
          dataRow.getCell(idx + 1).value = cell;
        });
        currentRow += 1;
      }
      continue;
    }

    // 일반 텍스트
    if (line && !line.startsWith('#') && !line.startsWith('*') && !line.startsWith('-')) {
      inTable = false;
      tableHeaders = [];
      
      const textRow = currentSheet.getRow(currentRow);
      textRow.getCell(1).value = line;
      currentRow += 1;
    }

    // 빈 줄
    if (!line) {
      inTable = false;
      tableHeaders = [];
      currentRow += 1;
    }
  }

  // 모든 시트의 열 너비 자동 조정
  workbook.worksheets.forEach(sheet => {
    console.log(`📏 시트 "${sheet.name}" 열 너비 조정 중...`);
    
    // 각 열의 최대 너비 계산
    const maxWidths = [];
    sheet.eachRow((row, rowNumber) => {
      row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
        const cellValue = cell.value?.toString() || '';
        const cellWidth = cellValue.length;
        
        if (!maxWidths[colNumber - 1] || maxWidths[colNumber - 1] < cellWidth) {
          maxWidths[colNumber - 1] = cellWidth;
        }
      });
    });

    // 열 너비 설정 (최소 10, 최대 50)
    maxWidths.forEach((width, idx) => {
      const column = sheet.getColumn(idx + 1);
      column.width = Math.min(Math.max(width + 2, 10), 50);
    });
  });

  // 파일 저장
  const excelPath = join(projectRoot, 'UI設計書_ナモアイ.xlsx');
  console.log('💾 엑셀 파일 저장 중...');
  await workbook.xlsx.writeFile(excelPath);

  console.log(`\n✅ 변환 완료!`);
  console.log(`📄 파일 위치: ${excelPath}`);
  console.log(`📊 생성된 시트 수: ${workbook.worksheets.length}개`);
}

convertMdToExcel()
  .then(() => {
    console.log('\n🎉 작업이 성공적으로 완료되었습니다!');
  })
  .catch(err => {
    console.error('❌ 에러 발생:', err);
    process.exit(1);
  });


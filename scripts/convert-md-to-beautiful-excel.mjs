import ExcelJS from 'exceljs';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// 스타일 정의
const styles = {
  chapterTitle: {
    font: { bold: true, size: 11, color: { argb: 'FF1B1C1D' } }
  },
  sectionTitle: {
    font: { bold: true, size: 11, color: { argb: 'FF1B1C1D' } }
  },
  normal: {
    font: { size: 11, color: { argb: 'FF1B1C1D' } }
  },
  bullet: {
    font: { size: 11, color: { argb: 'FF000000' } }
  },
  tableHeader: {
    font: { bold: true, size: 11, color: { argb: 'FF000000' } },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } }, // 노란색
    alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
    border: {
      top: { style: 'thin', color: { argb: 'FF000000' } },
      left: { style: 'thin', color: { argb: 'FF000000' } },
      bottom: { style: 'thin', color: { argb: 'FF000000' } },
      right: { style: 'thin', color: { argb: 'FF000000' } }
    }
  },
  tableCell: {
    font: { size: 11, color: { argb: 'FF000000' } },
    alignment: { horizontal: 'left', vertical: 'top', wrapText: true },
    border: {
      top: { style: 'thin', color: { argb: 'FF000000' } },
      left: { style: 'thin', color: { argb: 'FF000000' } },
      bottom: { style: 'thin', color: { argb: 'FF000000' } },
      right: { style: 'thin', color: { argb: 'FF000000' } }
    }
  }
};

async function convertMdToBeautifulExcel() {
  console.log('📖 MD 파일 읽는 중...');
  const mdPath = join(projectRoot, 'CSV 파일 UI 설계서 변환 요청.md');
  const content = await readFile(mdPath, 'utf-8');

  console.log('📊 엑셀 워크북 생성 중...');
  const workbook = new ExcelJS.Workbook();
  
  const lines = content.split('\n');
  
  let currentSheet = null;
  let currentRow = 1;
  let inTable = false;
  let tableHeaders = [];
  let tableRows = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // ### 챕터 감지 (시트 생성)
    if (line.startsWith('### ') && !line.startsWith('#### ')) {
      let chapterTitle = line.replace(/^###\s+/, '').trim();
      chapterTitle = chapterTitle.replace(/\*\*/g, '');
      
      const match = chapterTitle.match(/^第(\d+)章[：:]\s*(.+)$/);
      if (match) {
        const chapterNum = match[1];
        let chapterName = match[2].trim();
        
        // 시트 이름에 사용할 수 없는 문자 제거
        chapterName = chapterName.replace(/[\*\?:\\\\/\[\]]/g, '');
        
        // 시트 이름 축약
        if (chapterName.length > 25) {
          chapterName = chapterName.substring(0, 25);
        }
        
        const sheetName = chapterName;
        console.log(`✨ 시트 생성: ${sheetName}`);
        
        currentSheet = workbook.addWorksheet(sheetName);
        currentRow = 1;
        
        // 열 너비 설정
        currentSheet.getColumn(1).width = 30;
        currentSheet.getColumn(2).width = 15;
        currentSheet.getColumn(3).width = 30;
        currentSheet.getColumn(4).width = 25;
        currentSheet.getColumn(5).width = 30;
        
        // 빈 줄 2개
        currentRow += 2;
        
        // 챕터 제목 추가 (첫 번째 열 전체 병합)
        currentSheet.mergeCells(currentRow, 1, currentRow, 5);
        const titleRow = currentSheet.getRow(currentRow);
        titleRow.getCell(1).value = `第${chapterNum}章: ${match[2]}`;
        titleRow.getCell(1).font = styles.chapterTitle.font;
        currentRow += 2; // 빈 줄
        
        inTable = false;
        tableHeaders = [];
        tableRows = [];
      }
      continue;
    }

    if (!currentSheet) continue;

    // #### 섹션 제목
    if (line.startsWith('#### ')) {
      // 테이블 출력
      if (inTable && tableHeaders.length > 0 && tableRows.length > 0) {
        outputTable(currentSheet, currentRow, tableHeaders, tableRows);
        currentRow += tableRows.length + 2;
        inTable = false;
        tableHeaders = [];
        tableRows = [];
      }

      const sectionTitle = line.replace(/^####\s+/, '').replace(/\*\*/g, '').trim();
      
      // 섹션 제목 (첫 번째 열 전체 병합)
      currentSheet.mergeCells(currentRow, 1, currentRow, 5);
      const sectionRow = currentSheet.getRow(currentRow);
      sectionRow.getCell(1).value = sectionTitle;
      sectionRow.getCell(1).font = styles.sectionTitle.font;
      currentRow += 2; // 빈 줄
      continue;
    }

    // 테이블 감지
    if (line.startsWith('|') && line.endsWith('|')) {
      const cells = line.split('|').map(cell => cell.trim()).filter(cell => cell);
      
      // 구분선 무시
      if (cells[0] && cells[0].includes('----')) {
        inTable = true;
        continue;
      }

      if (!inTable) {
        // 테이블 헤더
        tableHeaders = cells;
        inTable = true;
      } else {
        // 테이블 데이터
        tableRows.push(cells);
      }
      continue;
    }

    // 테이블이 끝나면 출력
    if (inTable && !line.startsWith('|')) {
      if (tableHeaders.length > 0 && tableRows.length > 0) {
        outputTable(currentSheet, currentRow, tableHeaders, tableRows);
        currentRow += tableRows.length + 2;
      }
      inTable = false;
      tableHeaders = [];
      tableRows = [];
    }

    // 불릿 포인트 (*, -)
    if (line.startsWith('* ') || line.startsWith('- ')) {
      const text = line.replace(/^[\*\-]\s+/, '').trim();
      
      // 첫 번째 열 전체 병합
      currentSheet.mergeCells(currentRow, 1, currentRow, 5);
      const bulletRow = currentSheet.getRow(currentRow);
      bulletRow.getCell(1).value = `●\t${text}`;
      bulletRow.getCell(1).font = styles.bullet.font;
      currentRow += 1;
      continue;
    }

    // 빈 줄
    if (!line) {
      currentRow += 1;
      continue;
    }

    // 일반 텍스트 (# 제외)
    if (!line.startsWith('#')) {
      // 백슬래시 제거
      const cleanedLine = line.replace(/\\/g, '');
      
      // 첫 번째 열 전체 병합
      currentSheet.mergeCells(currentRow, 1, currentRow, 5);
      const textRow = currentSheet.getRow(currentRow);
      textRow.getCell(1).value = cleanedLine;
      textRow.getCell(1).font = styles.normal.font;
      currentRow += 1;
    }
  }

  // 마지막 테이블 출력
  if (inTable && currentSheet && tableHeaders.length > 0 && tableRows.length > 0) {
    outputTable(currentSheet, currentRow, tableHeaders, tableRows);
  }

  // 파일 저장
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
  const excelPath = join(projectRoot, `UI設計書_完成版_${timestamp}.xlsx`);
  console.log('💾 엑셀 파일 저장 중...');
  await workbook.xlsx.writeFile(excelPath);

  console.log(`\n✅ 변환 완료!`);
  console.log(`📄 파일 위치: ${excelPath}`);
  console.log(`📊 생성된 시트 수: ${workbook.worksheets.length}개`);
}

function outputTable(sheet, startRow, headers, rows) {
  // 헤더 출력 (노란색 배경)
  const headerRow = sheet.getRow(startRow);
  headers.forEach((header, idx) => {
    const cell = headerRow.getCell(idx + 1);
    cell.value = header;
    cell.font = styles.tableHeader.font;
    cell.fill = styles.tableHeader.fill;
    cell.alignment = styles.tableHeader.alignment;
    cell.border = styles.tableHeader.border;
  });
  
  // 데이터 출력 (테두리 포함)
  rows.forEach((row, rowIdx) => {
    const dataRow = sheet.getRow(startRow + rowIdx + 1);
    row.forEach((cellValue, colIdx) => {
      const cell = dataRow.getCell(colIdx + 1);
      cell.value = cellValue;
      cell.font = styles.tableCell.font;
      cell.alignment = styles.tableCell.alignment;
      cell.border = styles.tableCell.border;
    });
  });
}

convertMdToBeautifulExcel()
  .then(() => {
    console.log('\n🎉 작업이 성공적으로 완료되었습니다!');
  })
  .catch(err => {
    console.error('❌ 에러 발생:', err);
    console.error(err.stack);
    process.exit(1);
  });


import ExcelJS from 'exceljs';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// 入力となる Markdown ファイルパス
// - 画面レベルの基本設計（ScreenID/URL 等）
// - 詳細なUIレイアウト構成（第2部：画面別仕様）
const INPUT_MD_PATH = join(projectRoot, '資料', 'UI_SS_設計テンプレート.md');
const SPEC_MD_PATH = join(projectRoot, '資料', 'CSV 파일 UI 설계서 변환 요청.md');

// シート名（基本設計用）
const SHEET_SCREENS = '画面一覧';
const SHEET_FUNC_SCREENS = '機能別_画面';
const SHEET_FUNC_LIST = '機能一覧';

const SCREEN_HEADERS = [
  'ScreenID',
  '画面名',
  'URL',
  '画面種別',
  '機能カテゴリ',
  '対象ロール',
  '概要',
  '備考',
];

async function generateBasicDesignExcel() {
  console.log('📖 基本設計 Markdown (画面) を読み込み中...');
  const mdContent = await readFile(INPUT_MD_PATH, 'utf-8');

  // 画面別仕様から UI 構成（レイアウト概要）を抽出
  console.log('📖 画面別仕様 Markdown (UI構成) を読み込み中...');
  const specContent = await readFile(SPEC_MD_PATH, 'utf-8');
  const layoutMap = parseUiLayoutFromSpec(specContent);

  const screens = parseScreensFromMarkdown(mdContent);
  if (!screens || screens.length === 0) {
    console.warn('⚠️ 画面定義が見つかりませんでした。テンプレートのフォーマットを確認してください。');
    return;
  }

  console.log(`✅ 画面数: ${screens.length} 件`);

  const workbook = new ExcelJS.Workbook();

  const screenSheet = workbook.addWorksheet(SHEET_SCREENS);
  const funcScreenSheet = workbook.addWorksheet(SHEET_FUNC_SCREENS);
  const funcListSheet = workbook.addWorksheet(SHEET_FUNC_LIST);

  screenSheet.addRow(SCREEN_HEADERS);

  const functionScreens = [];

  for (const screen of screens) {
    const { id: defaultId, name: defaultName, screenTable } = screen;

    let screenRowValues = null;
    if (screenTable) {
      const headerIndex = mapHeaders(screenTable.headers, SCREEN_HEADERS);
      const firstRow = screenTable.rows[0] || [];
      screenRowValues = SCREEN_HEADERS.map((h, idx) => {
        const srcIndex = headerIndex[idx];
        if (srcIndex == null) return '';
        return firstRow[srcIndex] ?? '';
      });
    } else {
      screenRowValues = [defaultId, defaultName, '', '', '', '', '', ''];
    }
    screenSheet.addRow(screenRowValues);

    const funcCategory = screenRowValues[4] || '';
    const url = screenRowValues[2] || '';
    const screenType = screenRowValues[3] || '';
    const targetRoles = screenRowValues[5] || '';
    const overview = screenRowValues[6] || '';

    functionScreens.push({
      funcCategory,
      screenId: screenRowValues[0] || defaultId,
      screenName: screenRowValues[1] || defaultName,
      url,
      screenType,
      targetRoles,
      overview,
    });
  }

  createFunctionScreensSheet(funcScreenSheet, functionScreens);
  createFunctionListSheet(funcListSheet, functionScreens);
  createScreenCardSheets(workbook, screens, layoutMap);

  styleHeaderRow(screenSheet);
  styleHeaderRow(funcScreenSheet);
  styleHeaderRow(funcListSheet);

  // 本文セルは折り返して縦方向に内容が見えるようにする
  enableWrapForBody(screenSheet);
  enableWrapForBody(funcScreenSheet);
  enableWrapForBody(funcListSheet);

  autoFitColumns(screenSheet);
  autoFitColumns(funcScreenSheet, 60);
  autoFitColumns(funcListSheet, 40);

  const timestamp = new Date().toISOString().split('T')[0];
  const outputPath = join(projectRoot, `基本設計_ナモアイ_${timestamp}.xlsx`);

  console.log('💾 基本設計 Excel ファイルを書き込み中...');
  await workbook.xlsx.writeFile(outputPath);

  console.log('\n✅ 基本設計書の生成が完了しました。');
  console.log(`📄 出力ファイル: ${outputPath}`);
}

// --- 既存の UI/SS パーサロジックを簡略版として再利用 ---

function parseScreensFromMarkdown(md) {
  const lines = md.split('\n');

  const screens = [];
  let currentScreen = null;
  let currentSection = null;
  let tableBuffer = [];
  let inTable = false;

  const flushTable = () => {
    if (!currentScreen || !currentSection || tableBuffer.length === 0) return;
    const table = parseMarkdownTable(tableBuffer);
    if (!table || table.rows.length === 0) {
      tableBuffer = [];
      return;
    }

    if (currentSection === '画面基本情報') {
      currentScreen.screenTable = table;
    }

    tableBuffer = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    if (line.startsWith('### ')) {
      flushTable();
      if (currentScreen) {
        screens.push(currentScreen);
      }

      const title = line.replace(/^###\s+/, '').trim();
      const [screenId, ...nameParts] = title.split(/\s+/);
      const screenName = nameParts.join(' ').trim() || screenId;

      currentScreen = {
        id: screenId,
        name: screenName,
        screenTable: null,
      };
      currentSection = null;
      inTable = false;
      tableBuffer = [];
      continue;
    }

    if (!currentScreen) {
      continue;
    }

    if (line.startsWith('#### ')) {
      flushTable();
      const sectionTitle = line.replace(/^####\s+/, '').trim();
      if (sectionTitle === '画面基本情報') {
        currentSection = sectionTitle;
      } else {
        currentSection = null;
      }
      inTable = false;
      continue;
    }

    if (line.startsWith('|') && line.endsWith('|')) {
      if (!currentSection) continue;
      inTable = true;
      tableBuffer.push(line);
      continue;
    }

    if (inTable && (!line.startsWith('|') || line === '')) {
      flushTable();
      inTable = false;
      continue;
    }
  }

  flushTable();
  if (currentScreen) {
    screens.push(currentScreen);
  }

  return screens;
}

function parseMarkdownTable(lines) {
  if (!lines || lines.length < 2) return null;

  const headerLine = lines[0];
  const separatorLine = lines[1];

  if (!headerLine.includes('|')) return null;
  if (!separatorLine.includes('-')) return null;

  const headers = headerLine
    .split('|')
    .map((c) => c.trim())
    .filter((c) => c.length > 0);

  const rows = [];
  for (let i = 2; i < lines.length; i++) {
    const line = lines[i];
    if (!line.includes('|')) continue;
    const cells = line
      .split('|')
      .map((c) => c.trim())
      .filter((c) => c.length > 0);
    if (cells.length === 0) continue;
    rows.push(cells);
  }

  return { headers, rows };
}

function createFunctionScreensSheet(sheet, functionScreens) {
  const headers = [
    '機能カテゴリ',
    'ScreenID',
    '画面名',
    'URL',
    '画面種別',
    '対象ロール',
    '概要',
  ];
  sheet.addRow(headers);

  const rows = [...functionScreens].sort((a, b) => {
    const fa = a.funcCategory || '';
    const fb = b.funcCategory || '';
    if (fa === fb) {
      return (a.screenId || '').localeCompare(b.screenId || '');
    }
    return fa.localeCompare(fb);
  });

  for (const row of rows) {
    sheet.addRow([
      row.funcCategory,
      row.screenId,
      row.screenName,
      row.url,
      row.screenType,
      row.targetRoles,
      row.overview,
    ]);
  }
}

function createFunctionListSheet(sheet, functionScreens) {
  const headers = [
    '機能カテゴリ',
    '画面数',
    '代表ScreenID',
    '代表画面名',
    '備考（機能概要などを記入）',
  ];
  sheet.addRow(headers);

  const byCategory = new Map();
  for (const fs of functionScreens) {
    const key = fs.funcCategory || '(未設定)';
    if (!byCategory.has(key)) {
      byCategory.set(key, []);
    }
    byCategory.get(key).push(fs);
  }

  const categories = [...byCategory.keys()].sort((a, b) => a.localeCompare(b));
  for (const cat of categories) {
    const list = byCategory.get(cat);
    const first = list[0];
    sheet.addRow([
      cat,
      list.length,
      first?.screenId || '',
      first?.screenName || '',
      '',
    ]);
  }
}

/**
 * 画面ごとのカード形式シートを生成（UIレイアウト設計用）
 */
function createScreenCardSheets(workbook, screens, layoutMap) {
  if (!screens || screens.length === 0) return;

  for (const screen of screens) {
    const id = screen.id || '';
    const name = screen.name || '';

    // 画面基本情報テーブルと仕様書から値を取り出す
    const info = extractScreenInfo(screen, layoutMap);

    // シート名: ScreenID または ScreenID_短縮名
    let baseName = (id || name || 'SCREEN').replace(/\\/g, '').replace(/\s+/g, '');
    if (baseName.length > 28) baseName = baseName.slice(0, 28);
    let sheetName = baseName;
    let idx = 1;
    while (workbook.getWorksheet(sheetName)) {
      sheetName = `${baseName}_${idx++}`;
    }

    const sheet = workbook.addWorksheet(sheetName);
    buildScreenCard(sheet, id, name, info);
    autoFitColumns(sheet, 60);
  }
}

/**
 * 単一画面のカードレイアウトを構築
 */
function buildScreenCard(sheet, screenId, screenName, info) {
  let rowIdx = 1;

  // 見出し行
  sheet.mergeCells(rowIdx, 1, rowIdx, 4);
  const headerCell = sheet.getCell(rowIdx, 1);
  headerCell.value = `${screenId || ''} ${screenName || ''}`.trim();
  headerCell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 };
  headerCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF0F766E' },
  };
  headerCell.alignment = { vertical: 'middle', horizontal: 'left' };
  rowIdx += 1;

  const addField = (label, value) => {
    const labelCell = sheet.getCell(rowIdx, 1);
    const valueCell = sheet.getCell(rowIdx, 2);
    labelCell.value = label;
    labelCell.font = { bold: true };
    valueCell.value = value || '';
    valueCell.alignment = { wrapText: true, vertical: 'top' };
    rowIdx += 1;
  };

  const addSectionHeader = (title) => {
    sheet.mergeCells(rowIdx, 1, rowIdx, 4);
    const cell = sheet.getCell(rowIdx, 1);
    cell.value = `【${title}】`;
    cell.font = { bold: true, color: { argb: 'FF111827' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE5E7EB' },
    };
    cell.alignment = { vertical: 'middle', horizontal: 'left' };
    rowIdx += 1;
  };

  // 基本情報ブロック
  addSectionHeader('基本情報');
  addField('ScreenID', cleanText(screenId || ''));
  addField('画面名', cleanText(screenName || ''));
  addField('URL', cleanText(info.url || ''));
  addField('画面種別', cleanText(info.screenType || ''));
  addField('機能カテゴリ', cleanText(info.funcCategory || ''));
  addField('対象ロール', cleanText(info.targetRoles || ''));

  // レイアウト概要ブロック
  addSectionHeader('UIレイアウト概要');
  addField('概要', cleanText(info.overview || ''));
  addField('レイアウト構成', cleanText(info.layout || ''));
  addField('備考', cleanText(info.remark || ''));

  // 今後拡張用のプレースホルダ（コンポーネント構成など）
  addSectionHeader('コンポーネント構成（将来拡張）');
  addField('メインブロック', '');
  addField('サブブロック', '');
}

/**
 * 画面基本情報テーブルから値を取り出してオブジェクトで返す
 */
function extractScreenInfo(screen, layoutMap) {
  const info = {
    url: '',
    screenType: '',
    funcCategory: '',
    targetRoles: '',
    overview: '',
    layout: '',
    remark: '',
  };

  if (!screen.screenTable) {
    // layoutMap にあればレイアウト構成だけでも入れる
    if (layoutMap) {
      const key = normalizeScreenName(screen.name || '');
      if (layoutMap.has(key)) {
        info.layout = layoutMap.get(key);
      }
    }
    return info;
  }

  const headers = screen.screenTable.headers || [];
  const row = (screen.screenTable.rows && screen.screenTable.rows[0]) || [];

  const headerIndex = mapHeaders(headers, [
    'ScreenID',
    '画面名',
    'URL',
    '画面種別',
    '機能カテゴリ',
    '対象ロール',
    '概要',
    '備考',
  ]);

  info.url = headerIndex[2] != null ? row[headerIndex[2]] || '' : '';
  info.screenType = headerIndex[3] != null ? row[headerIndex[3]] || '' : '';
  info.funcCategory = headerIndex[4] != null ? row[headerIndex[4]] || '' : '';
  info.targetRoles = headerIndex[5] != null ? row[headerIndex[5]] || '' : '';
  // 概要は基本情報テーブルの概要列を使用
  const overview = headerIndex[6] != null ? row[headerIndex[6]] || '' : '';
  if (layoutMap) {
    const key = normalizeScreenName(screen.name || '');
    if (layoutMap.has(key)) {
      info.layout = layoutMap.get(key);
    }
  }
  info.overview = overview;
  info.remark = headerIndex[7] != null ? row[headerIndex[7]] || '' : '';

  return info;
}

function styleHeaderRow(sheet) {
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: false };

  const colCount = sheet.columnCount;
  for (let col = 1; col <= colCount; col++) {
    const cell = headerRow.getCell(col);
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF111827' },
    };
    cell.border = {
      bottom: { style: 'thin', color: { argb: 'FFFFFFFF' } },
    };
  }

  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: colCount },
  };

  sheet.views = [
    {
      state: 'frozen',
      xSplit: 0,
      ySplit: 1,
    },
  ];
}

/**
 * ヘッダー以外の行について、セル内容を折り返し表示にする
 * （UI構成や概要などの長文を縦方向にしっかり見せるため）
 */
function enableWrapForBody(sheet) {
  const rowCount = sheet.rowCount;
  for (let r = 2; r <= rowCount; r++) {
    const row = sheet.getRow(r);
    row.eachCell((cell) => {
      const align = cell.alignment || {};
      cell.alignment = { ...align, wrapText: true, vertical: 'top' };
    });
  }
}

function mapHeaders(sourceHeaders, targetHeaders) {
  return targetHeaders.map((target) => {
    const idx = sourceHeaders.findIndex((h) => h === target);
    return idx === -1 ? null : idx;
  });
}

function autoFitColumns(sheet, maxWidth = 40) {
  sheet.columns.forEach((column) => {
    let maxLength = 10;
    column.eachCell({ includeEmpty: false }, (cell) => {
      const value = cell.value == null ? '' : String(cell.value);
      if (value.length > maxLength) {
        maxLength = value.length;
      }
    });
    column.width = Math.min(maxLength + 2, maxWidth);
  });
}

/**
 * 末尾に付与されている脚注用の "1" などをざっくり削除して見栄えを整える
 */
function cleanText(value) {
  if (typeof value !== 'string') return value;
  return value.replace(/\s*1(?=[^\dA-Za-z]|$)/g, '');
}

/**
 * 画面別仕様（第2部）から UI構成（レイアウト概要）を章ごとに抽出する
 * キー: 画面名（コロン以降のタイトル）を正規化した文字列
 */
function parseUiLayoutFromSpec(md) {
  const lines = md.split('\n');
  const layoutMap = new Map();

  let inPart2 = false;
  let currentTitle = null;
  let currentKey = null;
  let currentSection = null;
  let uiLayoutLines = [];

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    if (line.startsWith('## ') && line.includes('第2部')) {
      inPart2 = true;
      continue;
    }
    if (!inPart2) continue;

    // 章見出し: 第10章: ホーム (メインページ) など
    if (line.startsWith('### ') && line.includes('第') && line.includes('章')) {
      // 直前の章を保存
      if (currentKey && uiLayoutLines.length > 0) {
        layoutMap.set(currentKey, uiLayoutLines.join('\n'));
      }
      uiLayoutLines = [];
      currentSection = null;

      const cleaned = line.replace(/^###\s+/, '').replace(/\*/g, '').trim();
      const m = cleaned.match(/^第\d+章[：:]\s*(.+)$/);
      const title = m ? m[1].trim() : cleaned;
      currentTitle = title;
      currentKey = normalizeScreenName(title);
      continue;
    }

    if (!currentKey) continue;

    // セクション見出し
    if (line.startsWith('#### ')) {
      const title = line.replace(/^####\s+/, '').replace(/\*/g, '').trim();
      // UI構成 セクションを対象
      if (title.includes('UI構成')) {
        currentSection = 'UI構成';
      } else {
        currentSection = null;
      }
      continue;
    }

    if (currentSection === 'UI構成') {
      // 次の章見出し/セクション見出しまでを UI構成 として収集
      if (!line || line.startsWith('#')) continue;
      uiLayoutLines.push(line);
    }
  }

  // 最後の章を保存
  if (currentKey && uiLayoutLines.length > 0) {
    layoutMap.set(currentKey, uiLayoutLines.join('\n'));
  }

  return layoutMap;
}

/**
 * 画面名の正規化（スペースや全角括弧をざっくり除去）
 */
function normalizeScreenName(name) {
  return (name || '')
    .replace(/[\s　]/g, '')
    .replace(/[()（）]/g, '')
    .trim();
}

generateBasicDesignExcel().catch((err) => {
  console.error('❌ 基本設計書の生成中にエラーが発生しました。');
  console.error(err);
  process.exit(1);
});



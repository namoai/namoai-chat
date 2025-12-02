import ExcelJS from 'exceljs';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// 入力となる Markdown ファイルパス（画面・UI/SS 詳細設計用）
const INPUT_MD_PATH = join(projectRoot, '資料', 'UI_SS_設計テンプレート.md');

// シート名（詳細設計用）
const SHEET_SCREENS = 'UI_画面一覧';
const SHEET_FIELDS = 'UI_SS項目定義';
const SHEET_FUNC_SCREENS = '機能別_画面';
const SHEET_FUNC_LIST = '機能一覧';

// 列定義（ヘッダー名と順序を固定）
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

const FIELD_HEADERS = [
  'ScreenID',
  '画面名',
  'No',
  'フィールドID',
  '項目名（表示ラベル）',
  '項目名（論理名）',
  'UI種別',
  '必須',
  '型',
  '桁数',
  '初期値',
  '入力制御',
  'バリデーション例',
  'エラー文言例',
  '関連API',
  '備考',
];

/**
 * Markdown テキストから、画面ごとの定義を抽出する
 * 想定フォーマット：
 * ### SCREENID 画面名
 * #### 画面基本情報
 * | ScreenID | ... |
 * ...
 * #### 画面項目定義
 * | No | フィールドID | ... |
 */
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
    } else if (currentSection === '画面項目定義') {
      currentScreen.fieldTable = table;
    }

    tableBuffer = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    // 画面開始（###）
    if (line.startsWith('### ')) {
      // 直前の画面を確定
      flushTable();
      if (currentScreen) {
        screens.push(currentScreen);
      }

      const title = line.replace(/^###\s+/, '').trim();
      // 先頭トークンを ScreenID として扱い、残りを画面名とする
      const [screenId, ...nameParts] = title.split(/\s+/);
      const screenName = nameParts.join(' ').trim() || screenId;

      currentScreen = {
        id: screenId,
        name: screenName,
        screenTable: null,
        fieldTable: null,
      };
      currentSection = null;
      inTable = false;
      tableBuffer = [];
      continue;
    }

    if (!currentScreen) {
      continue;
    }

    // セクション見出し
    if (line.startsWith('#### ')) {
      flushTable();
      const sectionTitle = line.replace(/^####\s+/, '').trim();
      if (sectionTitle === '画面基本情報' || sectionTitle === '画面項目定義') {
        currentSection = sectionTitle;
      } else {
        currentSection = null;
      }
      inTable = false;
      continue;
    }

    // テーブル行
    if (line.startsWith('|') && line.endsWith('|')) {
      if (!currentSection) continue; // 対象外セクションのテーブルは無視
      inTable = true;
      tableBuffer.push(line);
      continue;
    }

    // テーブル終了
    if (inTable && (!line.startsWith('|') || line === '')) {
      flushTable();
      inTable = false;
      continue;
    }
  }

  // 最後の画面を確定
  flushTable();
  if (currentScreen) {
    screens.push(currentScreen);
  }

  return screens;
}

/**
 * Markdown の表をパースする
 * lines: ["| a | b |", "| --- | --- |", "| 1 | 2 |", ...]
 */
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

async function generateUiSsExcel() {
  console.log('📖 UI/SS 詳細設計 Markdown (画面) を読み込み中...');
  const mdContent = await readFile(INPUT_MD_PATH, 'utf-8');

  const screens = parseScreensFromMarkdown(mdContent);
  if (!screens || screens.length === 0) {
    console.warn('⚠️ 画面定義が見つかりませんでした。テンプレートのフォーマットを確認してください。');
    return;
  }

  console.log(`✅ 画面数: ${screens.length} 件`);

  const workbook = new ExcelJS.Workbook();

  // シート作成
  const screenSheet = workbook.addWorksheet(SHEET_SCREENS);
  const fieldSheet = workbook.addWorksheet(SHEET_FIELDS);
  const funcScreenSheet = workbook.addWorksheet(SHEET_FUNC_SCREENS);
  const funcListSheet = workbook.addWorksheet(SHEET_FUNC_LIST);

  // ヘッダー行作成
  screenSheet.addRow(SCREEN_HEADERS);
  fieldSheet.addRow(FIELD_HEADERS);

  // 機能別集計用
  const functionScreens = [];

  // 画面情報を埋め込み
  for (const screen of screens) {
    const { id: defaultId, name: defaultName, screenTable, fieldTable } = screen;

    // 画面基本情報テーブルから 1 行目を使用（あれば）
    let screenRowValues = null;
    if (screenTable) {
      const headerIndex = mapHeaders(screenTable.headers, SCREEN_HEADERS);
      const firstRow = screenTable.rows[0] || [];
      screenRowValues = SCREEN_HEADERS.map((h, idx) => {
        const srcIndex = headerIndex[idx];
        if (srcIndex == null) return '';
        return cleanText(firstRow[srcIndex] ?? '');
      });
    } else {
      // テーブルがない場合は ScreenID / 画面名だけでも埋める
      screenRowValues = [
        cleanText(defaultId),
        cleanText(defaultName),
        '',
        '',
        '',
        '',
        '',
        '',
      ];
    }
    screenSheet.addRow(screenRowValues);

    // 機能別画面集計用データを追加
    const funcCategory = cleanText(screenRowValues[4] || ''); // 機能カテゴリ
    const url = cleanText(screenRowValues[2] || '');
    const screenType = cleanText(screenRowValues[3] || '');
    const targetRoles = cleanText(screenRowValues[5] || '');
    const overview = cleanText(screenRowValues[6] || '');

    functionScreens.push({
      funcCategory,
      screenId: screenRowValues[0] || defaultId,
      screenName: screenRowValues[1] || defaultName,
      url,
      screenType,
      targetRoles,
      overview,
    });

    // 項目定義テーブルから行を展開
    if (fieldTable) {
      const headerIndex = mapHeaders(fieldTable.headers, [
        'No',
        'フィールドID',
        '項目名（表示ラベル）',
        '項目名（論理名）',
        'UI種別',
        '必須',
        '型',
        '桁数',
        '初期値',
        '入力制御',
        'バリデーション例',
        'エラー文言例',
        '関連API',
        '備考',
      ]);

      for (const row of fieldTable.rows) {
        const base = FIELD_HEADERS.map(() => '');
        base[0] = cleanText(defaultId);
        base[1] = cleanText(defaultName);

        // No〜備考 をマッピング（FIELD_HEADERS の 2 番目以降）
        const targetFieldHeaders = FIELD_HEADERS.slice(2);
        targetFieldHeaders.forEach((_, idx) => {
          const srcIndex = headerIndex[idx];
          if (srcIndex == null) return;
          base[2 + idx] = cleanText(row[srcIndex] ?? '');
        });

        fieldSheet.addRow(base);
      }
    }
  }

  // 機能別画面シートを作成
  createFunctionScreensSheet(funcScreenSheet, functionScreens);

  // 機能一覧シートを作成
  createFunctionListSheet(funcListSheet, functionScreens);

  // 画面ごとの UI/SS 項目カードシートを作成
  createFieldCardSheets(workbook, screens);

  // ヘッダースタイル・フィルター・固定枠
  styleHeaderRow(screenSheet);
  styleHeaderRow(fieldSheet);
  styleHeaderRow(funcScreenSheet);
  styleHeaderRow(funcListSheet);

  // ざっくり列幅自動調整
  autoFitColumns(screenSheet);
  autoFitColumns(fieldSheet, 60);
  autoFitColumns(funcScreenSheet, 60);
  autoFitColumns(funcListSheet, 40);

  const timestamp = new Date().toISOString().split('T')[0];
  const outputPath = join(projectRoot, `詳細設計_ナモアイ_${timestamp}.xlsx`);

  console.log('💾 Excel ファイルを書き込み中...');
  await workbook.xlsx.writeFile(outputPath);

  console.log('\n✅ UI/SS 設計書の生成が完了しました。');
  console.log(`📄 出力ファイル: ${outputPath}`);
}

/**
 * 機能別の画面一覧シートを生成
 */
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
    const fa = cleanText(a.funcCategory || '');
    const fb = cleanText(b.funcCategory || '');
    if (fa === fb) {
      return (a.screenId || '').localeCompare(b.screenId || '');
    }
    return fa.localeCompare(fb);
  });

  for (const row of rows) {
    sheet.addRow([
      cleanText(row.funcCategory),
      cleanText(row.screenId),
      cleanText(row.screenName),
      cleanText(row.url),
      cleanText(row.screenType),
      cleanText(row.targetRoles),
      cleanText(row.overview),
    ]);
  }
}

/**
 * 機能カテゴリ単位のサマリーシートを生成
 */
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
    const key = cleanText(fs.funcCategory || '(未設定)');
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
      cleanText(cat),
      list.length,
      cleanText(first?.screenId || ''),
      cleanText(first?.screenName || ''),
      '', // 備考は設計者が追記
    ]);
  }
}

/**
 * ヘッダー行のスタイル設定とオートフィルタ・固定
 */
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
      fgColor: { argb: 'FF1F2937' }, // ダークグレー
    };
    cell.border = {
      bottom: { style: 'thin', color: { argb: 'FFFFFFFF' } },
    };
  }

  // オートフィルタ
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: colCount },
  };

  // 上部1行を固定
  sheet.views = [
    {
      state: 'frozen',
      xSplit: 0,
      ySplit: 1,
    },
  ];
}

/**
 * 元テーブルヘッダー配列を、ターゲットヘッダー配列に対応づける
 * 戻り値: ターゲット配列のインデックスごとに、元配列のインデックス or null
 */
function mapHeaders(sourceHeaders, targetHeaders) {
  return targetHeaders.map((target) => {
    const idx = sourceHeaders.findIndex((h) => h === target);
    return idx === -1 ? null : idx;
  });
}

/**
 * 簡易的な列幅自動調整
 */
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
 * 画面ごとの UI/SS 項目カードシートを生成
 */
function createFieldCardSheets(workbook, screens) {
  if (!screens || screens.length === 0) return;

  for (const screen of screens) {
    if (!screen.fieldTable || !screen.fieldTable.rows?.length) continue;

    const id = cleanText(screen.id || '');
    const name = cleanText(screen.name || '');

    // シート名: ScreenID_項目 形式（長すぎないように調整）
    let baseName = `${id || name || 'SCREEN'}_項目`.replace(/\\/g, '').replace(/\s+/g, '');
    if (baseName.length > 28) baseName = baseName.slice(0, 28);
    let sheetName = baseName;
    let idx = 1;
    while (workbook.getWorksheet(sheetName)) {
      sheetName = `${baseName}_${idx++}`;
    }

    const sheet = workbook.addWorksheet(sheetName);
    buildFieldCardsForScreen(sheet, screen);
    autoFitColumns(sheet, 80);
  }
}

/**
 * 単一画面の UI/SS 項目カードを縦に並べる
 */
function buildFieldCardsForScreen(sheet, screen) {
  const table = screen.fieldTable;
  const headers = table.headers || [];
  const rows = table.rows || [];

  const idxNo = headers.indexOf('No');
  const idxFieldId = headers.indexOf('フィールドID');
  const idxLabel = headers.indexOf('項目名（表示ラベル）');
  const idxLogical = headers.indexOf('項目名（論理名）');
  const idxUiType = headers.indexOf('UI種別');
  const idxRequired = headers.indexOf('必須');
  const idxType = headers.indexOf('型');
  const idxLength = headers.indexOf('桁数');
  const idxInitial = headers.indexOf('初期値');
  const idxControl = headers.indexOf('入力制御');
  const idxValidation = headers.indexOf('バリデーション例');
  const idxError = headers.indexOf('エラー文言例');
  const idxApi = headers.indexOf('関連API');
  const idxRemark = headers.indexOf('備考');

  let rowIdx = 1;

  const addFieldRow = (label, value) => {
    const labelCell = sheet.getCell(rowIdx, 1);
    const valueCell = sheet.getCell(rowIdx, 2);
    labelCell.value = label;
    labelCell.font = { bold: true };
    valueCell.value = cleanText(value || '');
    valueCell.alignment = { wrapText: true, vertical: 'top' };
    rowIdx += 1;
  };

  const addCardHeader = (title) => {
    sheet.mergeCells(rowIdx, 1, rowIdx, 4);
    const cell = sheet.getCell(rowIdx, 1);
    cell.value = cleanText(title);
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4B5563' },
    };
    cell.alignment = { vertical: 'middle', horizontal: 'left' };
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

  for (const row of rows) {
    const no = idxNo >= 0 ? row[idxNo] : '';
    const fid = idxFieldId >= 0 ? row[idxFieldId] : '';
    const label = idxLabel >= 0 ? row[idxLabel] : '';

    // カード見出し行（No + フィールドID + ラベル）
    const titleParts = [];
    if (no) titleParts.push(`No.${no}`);
    if (fid) titleParts.push(String(fid));
    if (label) titleParts.push(String(label));
    const title = titleParts.join(' - ');
    addCardHeader(title);

    // 基本情報ブロック
    addSectionHeader('基本情報');
    if (idxLogical >= 0) addFieldRow('項目名（論理名）', row[idxLogical]);
    if (idxUiType >= 0) addFieldRow('UI種別', row[idxUiType]);
    if (idxRequired >= 0) addFieldRow('必須', row[idxRequired]);
    if (idxType >= 0) addFieldRow('型', row[idxType]);
    if (idxLength >= 0) addFieldRow('桁数', row[idxLength]);
    if (idxInitial >= 0) addFieldRow('初期値', row[idxInitial]);

    // 挙動・検証ブロック
    addSectionHeader('挙動・検証');
    if (idxControl >= 0) addFieldRow('入力制御', row[idxControl]);
    if (idxValidation >= 0) addFieldRow('バリデーション例', row[idxValidation]);
    if (idxError >= 0) addFieldRow('エラー文言例', row[idxError]);

    // 連携情報ブロック
    addSectionHeader('連携情報');
    if (idxApi >= 0) addFieldRow('関連API', row[idxApi]);
    if (idxRemark >= 0) addFieldRow('備考', row[idxRemark]);

    // カード間の空行
    rowIdx += 1;
  }
}

/**
 * 末尾に付与されている脚注用の "1" などをざっくり削除して見栄えを整える
 */
function cleanText(value) {
  if (typeof value !== 'string') return value;
  return value.replace(/\s*1(?=[^\dA-Za-z]|$)/g, '');
}

generateUiSsExcel().catch((err) => {
  console.error('❌ UI/SS 設計書の生成中にエラーが発生しました。');
  console.error(err);
  process.exit(1);
});



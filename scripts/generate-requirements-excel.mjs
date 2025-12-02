import ExcelJS from 'exceljs';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// 要件定義用 Markdown（第1部：機能モジュール仕様）
const MAIN_SPEC_MD_PATH = join(projectRoot, '資料', 'CSV 파일 UI 설계서 변환 요청.md');

// シート名
const SHEET_REQUIREMENTS_LIST = '要件一覧';

async function generateRequirementsExcel() {
  console.log('📖 要件定義 Markdown (第1部) を読み込み中...');
  const mainSpecContent = await readFile(MAIN_SPEC_MD_PATH, 'utf-8');

  const rawRequirements = parseRequirementsFromMainMd(mainSpecContent);
  const requirements = enrichRequirements(rawRequirements || []);

  if (!requirements || requirements.length === 0) {
    console.warn('⚠️ 要件候補が見つかりませんでした。Markdown 構造を確認してください。');
  } else {
    console.log(`✅ 要件候補: ${requirements.length} 件抽出`);
  }

  const workbook = new ExcelJS.Workbook();
  const listSheet = workbook.addWorksheet(SHEET_REQUIREMENTS_LIST);

  createRequirementsListSheet(listSheet, requirements);
  styleHeaderRow(listSheet);
  autoFitColumns(listSheet, 80);

  // 機能カテゴリごとにカード形式のシートを作成
  createRequirementsCardSheetsByFunction(workbook, requirements);

  const timestamp = new Date().toISOString().split('T')[0];
  const outputPath = join(projectRoot, `要件定義_ナモアイ_${timestamp}.xlsx`);

  console.log('💾 要件定義 Excel ファイルを書き込み中...');
  await workbook.xlsx.writeFile(outputPath);

  console.log('\n✅ 要件定義書の生成が完了しました。');
  console.log(`📄 出力ファイル: ${outputPath}`);
}

/**
 * 要件一覧シートを生成（横並びのインデックス表）
 * - 第1部の「5. 主要機能一覧」「13. 非機能要件」の箇条書きを簡易に要件として抽出
 */
function createRequirementsListSheet(sheet, requirements) {
  const headers = [
    '機能カテゴリ',
    '要件分類',
    '要件ID',
    '要件概要',
    '背景・目的',
    '前提・制約',
    '関連URL・画面',
    '受入条件（テスト観点要約）',
    '重要度',
    'ステータス',
    '参照章・節',
    '備考',
  ];
  sheet.addRow(headers);

  if (!requirements || requirements.length === 0) {
    return;
  }
 
  for (const req of requirements) {
    const catKey = cleanText(req.funcCategory || '(未設定)');
    const typeKey = cleanText(req.type || '機能要件');
    const ref = cleanText(req.reference || '');
    const background = cleanText(req.background || '');
    const preconditions = cleanText(req.preconditions || '');
    const relatedUrls = cleanText((req.relatedUrls || []).join('\n'));
    const acceptance = cleanText((req.testPoints || []).join('\n'));
    const importance = cleanText(req.importance || (typeKey === '非機能要件' ? '高' : '中'));
    const status = cleanText(req.status || '未着手');

    sheet.addRow([
      catKey,
      typeKey,
      cleanText(req.id),
      cleanText(req.text),
      background,
      preconditions,
      relatedUrls,
      acceptance,
      importance,
      status,
      ref,
      '',
    ]);
  }
}

/**
 * 要件カード形式シートを生成（縦に並べたフォーム風）
 */
function createRequirementsCardSheet(sheet, requirements) {
  if (!requirements || requirements.length === 0) {
    sheet.getCell('A1').value = '要件が見つかりませんでした。';
    return;
  }

  let rowIdx = 1;
  for (const req of requirements) {
    // カード見出し行（要件ID + 機能カテゴリ）
    const id = cleanText(req.id || buildRequirementId(req));
    sheet.mergeCells(rowIdx, 1, rowIdx, 4);
    const headerCell = sheet.getCell(rowIdx, 1);
    headerCell.value = `${id} - ${cleanText(req.funcCategory || '')}`;
    headerCell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: req.type === '非機能要件' ? 'FF7F1D1D' : 'FF1D4ED8' },
    };
    headerCell.alignment = { vertical: 'middle', horizontal: 'left' };
    rowIdx += 1;

    // 2列フォーム: ラベル / 内容
    const addField = (label, value) => {
      const labelCell = sheet.getCell(rowIdx, 1);
      const valueCell = sheet.getCell(rowIdx, 2);
      labelCell.value = label;
      labelCell.font = { bold: true };
      valueCell.value = value || '';
      valueCell.alignment = { wrapText: true, vertical: 'top' };
      rowIdx += 1;
    };

    // 小見出し用（ブロック区切り）
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

    const typeLabel = cleanText(req.type === '非機能要件' ? '非機能要件' : '機能要件');
    const importance = cleanText(req.importance || (req.type === '非機能要件' ? '高' : '中'));
    const status = cleanText(req.status || '未着手');

    // 基本情報ブロック
    addSectionHeader('基本情報');
    addField('機能カテゴリ', cleanText(req.funcCategory || ''));
    addField('要件分類', typeLabel);
    addField('要件ID', id);
    addField('重要度', importance);
    addField('ステータス', status);

    // 要件内容ブロック
    addSectionHeader('要件内容');
    addField('要件概要', cleanText(req.text || ''));

    // 背景・前提ブロック
    addSectionHeader('背景・前提');
    addField('背景・目的', cleanText(req.background || ''));
    addField('前提・制約', cleanText(req.preconditions || ''));

    // 関連情報ブロック
    addSectionHeader('関連情報');
    addField('関連URL・画面', cleanText((req.relatedUrls || []).join('\n')));

    // 受入条件ブロック
    addSectionHeader('受入条件');
    addField('受入条件（テスト観点要約）', cleanText((req.testPoints || []).join('\n')));

    // 参照ブロック
    addSectionHeader('参照');
    addField('参照章・節', cleanText(req.reference || ''));

    // 空行で区切る
    rowIdx += 1;
  }
}

/**
 * 機能カテゴリごとにカード形式のシートを作成
 */
function createRequirementsCardSheetsByFunction(workbook, requirements) {
  if (!requirements || requirements.length === 0) return;

  const byCategory = new Map();
  for (const req of requirements) {
    const key = req.funcCategory || '(未設定)';
    if (!byCategory.has(key)) byCategory.set(key, []);
    byCategory.get(key).push(req);
  }

  const categories = [...byCategory.keys()].sort((a, b) => a.localeCompare(b));

  for (const cat of categories) {
    const rawName = (cat || '(未設定)').replace(/\\/g, '').replace(/\s+/g, '');
    let baseName = rawName || '未分類';
    if (baseName.length > 28) baseName = baseName.slice(0, 28);
    let sheetName = baseName;
    let idx = 1;
    while (workbook.getWorksheet(sheetName)) {
      sheetName = `${baseName}_${idx++}`;
    }
    const sheet = workbook.addWorksheet(sheetName);
    createRequirementsCardSheet(sheet, byCategory.get(cat));
    autoFitColumns(sheet, 80);
  }
}

/**
 * 要件配列に ID・重要度・ステータスを付与して返す
 */
function enrichRequirements(requirements) {
  if (!requirements || requirements.length === 0) return [];

  const sorted = [...requirements].sort((a, b) => {
    const ka = `${a.funcCategory || ''}-${a.type || ''}-${a.chapterNo || 0}`;
    const kb = `${b.funcCategory || ''}-${b.type || ''}-${b.chapterNo || 0}`;
    return ka.localeCompare(kb);
  });

  const counters = new Map();
  const enriched = [];

  for (const req of sorted) {
    const catKey = req.funcCategory || '(未設定)';
    const typeKey = req.type || '機能要件';
    const counterKey = `${catKey}::${typeKey}`;
    const current = (counters.get(counterKey) ?? 0) + 1;
    counters.set(counterKey, current);

    const catCodeMatch = catKey.match(/^(\d+)_/);
    const catCode = catCodeMatch
      ? catCodeMatch[1]
      : req.chapterNo != null
      ? String(req.chapterNo).padStart(2, '0')
      : '00';
    const typeCode = typeKey === '非機能要件' ? 'N' : 'F';
    const id = `${catCode}-${typeCode}-${String(current).padStart(3, '0')}`;

    const importance = typeKey === '非機能要件' ? '高' : '中';
    const status = '未着手';

    enriched.push({
      ...req,
      id,
      importance,
      status,
    });
  }

  return enriched;
}

// 要件ID生成ロジック（enrich で ID がない場合のフォールバック用）
function buildRequirementId(req) {
  const catKey = req.funcCategory || '(未設定)';
  const typeKey = req.type || '機能要件';
  const catCodeMatch = catKey.match(/^(\d+)_/);
  const catCode = catCodeMatch
    ? catCodeMatch[1]
    : req.chapterNo != null
    ? String(req.chapterNo).padStart(2, '0')
    : '00';
  const typeCode = typeKey === '非機能要件' ? 'N' : 'F';
  // 連番自体は一覧作成時に決定済みなので、ここでは暫定値を返す
  // （カードシートではIDは視覚的な識別用であり、厳密な一意性は一覧側で担保）
  return `${catCode}-${typeCode}-XXX`;
}

/**
 * 第1部の Markdown から簡易に要件を抽出する
 * - 第2部（画面別仕様）以降は無視
 * - 「5. 主要機能一覧」「13. 非機能要件」配下の箇条書きを要件として扱う
 */
function parseRequirementsFromMainMd(md) {
  const lines = md.split('\n');

  const requirements = [];
  let inPart2 = false;
  let currentChapter = null;
  let currentFuncCategory = null;
  let currentChapterNo = null;
  let currentSection = null;

  // 章レベルで共有するメタ情報（背景、前提、関連URL、テスト観点）
  let chapterBackground = '';
  let chapterPreconditions = '';
  let chapterRelatedUrls = [];
  let chapterTestPoints = [];

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    if (line.startsWith('## ') && line.includes('第2部')) {
      inPart2 = true;
      break; // 第2部以降は要件抽出対象外
    }

    if (line.startsWith('### ') && line.includes('第') && line.includes('章')) {
      // 例: "### **第1章: 01_認証及びユーザー管理**"
      const cleaned = line.replace(/^###\s+/, '').replace(/\*/g, '').trim();
      const m = cleaned.match(/^第(\d+)章[：:]\s*(.+)$/);
      if (m) {
        currentChapterNo = Number(m[1]);
        currentChapter = cleaned;
        currentFuncCategory = sanitizeCategoryName(m[2].trim());
      } else {
        currentChapter = cleaned;
        currentFuncCategory = sanitizeCategoryName(cleaned);
      }
      currentSection = null;
      chapterBackground = '';
      chapterPreconditions = '';
      chapterRelatedUrls = [];
      chapterTestPoints = [];
      continue;
    }

    if (!currentChapter || inPart2) continue;

    // セクション見出し
    if (line.startsWith('#### ')) {
      const title = line.replace(/^####\s+/, '').replace(/\*/g, '').trim();
      const plain = title.replace(/\\/g, ''); // "5\. 主要機能一覧" → "5. 主要機能一覧"

      if (plain.startsWith('1.') && plain.includes('画面概要')) {
        currentSection = '画面概要';
      } else if (plain.startsWith('2.') && plain.includes('前提')) {
        currentSection = '前提・制約';
      } else if (plain.startsWith('3.') && plain.includes('関連URL')) {
        currentSection = '関連URL・遷移';
      } else if (plain.startsWith('5.') && plain.includes('主要機能一覧')) {
        currentSection = '主要機能一覧';
      } else if (plain.startsWith('13.') && plain.includes('非機能要件')) {
        currentSection = '非機能要件';
      } else if (plain.startsWith('14.') && plain.includes('テスト観点')) {
        currentSection = 'テスト観点';
      } else {
        currentSection = null;
      }
      continue;
    }

    // 章メタ情報の収集
    if (currentSection === '画面概要') {
      if (line) {
        if (line.startsWith('* ')) {
          const t = line.replace(/^\*\s+/, '').trim();
          chapterBackground += (chapterBackground ? '\n' : '') + t;
        } else if (!line.startsWith('#')) {
          chapterBackground += (chapterBackground ? '\n' : '') + line;
        }
      }
      continue;
    }

    if (currentSection === '前提・制約') {
      if (line.startsWith('* ')) {
        const t = line.replace(/^\*\s+/, '').trim();
        chapterPreconditions += (chapterPreconditions ? '\n' : '') + t;
      }
      continue;
    }

    if (currentSection === '関連URL・遷移') {
      if (line.startsWith('* ')) {
        const t = line.replace(/^\*\s+/, '').trim();
        chapterRelatedUrls.push(t);
      }
      continue;
    }

    if (currentSection === 'テスト観点') {
      if (line.startsWith('|')) {
        // 簡易的に: テーブル行の2列目（テストケース）を抜き出す
        const cells = line
          .split('|')
          .map((c) => c.trim())
          .filter((c) => c.length > 0);
        if (cells.length >= 2 && cells[0] !== '項目') {
          chapterTestPoints.push(cells[1]);
        }
      }
      continue;
    }

    // 実際の要件行の抽出
    if (currentSection === '主要機能一覧' || currentSection === '非機能要件') {
      if (line.startsWith('* ')) {
        const text = line.replace(/^\*\s+/, '').trim();
        if (!text) continue;

        const type = currentSection === '非機能要件' ? '非機能要件' : '機能要件';
        const ref = `${currentChapter} / ${currentSection}`;

        requirements.push({
          funcCategory: currentFuncCategory,
          chapter: currentChapter,
          chapterNo: currentChapterNo,
          section: currentSection,
          type,
          text,
          reference: ref,
          background: chapterBackground,
          preconditions: chapterPreconditions,
          relatedUrls: chapterRelatedUrls,
          testPoints: chapterTestPoints,
        });
      }
    }
  }

  return requirements;
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
 * 機能カテゴリ名の整形（Markdown 用のバックスラッシュ等を除去）
 */
function sanitizeCategoryName(name) {
  if (!name) return name;
  return name.replace(/\\/g, '');
}

/**
 * 末尾に付与されている脚注用の "1" などをざっくり削除して見栄えを整える
 */
function cleanText(value) {
  if (typeof value !== 'string') return value;
  // 行末や記号の直前にある「 1」「 1。」のような脚注マーカーを削除
  return value.replace(/\s*1(?=[^\dA-Za-z]|$)/g, '');
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

generateRequirementsExcel().catch((err) => {
  console.error('❌ 要件定義書の生成中にエラーが発生しました。');
  console.error(err);
  process.exit(1);
});



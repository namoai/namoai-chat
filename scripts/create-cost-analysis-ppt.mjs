import PptxGenJS from 'pptxgenjs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

async function createCostAnalysisPPT() {
  const pptx = new PptxGenJS();
  
  // プレゼンテーション設定
  pptx.layout = 'LAYOUT_16x9';
  pptx.author = 'namos-chat-v1';
  pptx.title = 'namos-chat-v1 総合費用分析';
  
  // 共通スタイル
  const styles = {
    title: { fontSize: 32, bold: true, color: '1F4788', align: 'center' },
    subtitle: { fontSize: 20, color: '4472C4', align: 'center' },
    heading1: { fontSize: 24, bold: true, color: '1F4788' },
    heading2: { fontSize: 20, bold: true, color: '4472C4' },
    heading3: { fontSize: 18, bold: true, color: '5B9BD5' },
    body: { fontSize: 14, color: '333333' },
    bodySmall: { fontSize: 12, color: '333333' },
    bullet: { fontSize: 14, color: '333333', bullet: true },
    highlight: { fontSize: 16, bold: true, color: 'C00000' },
    tableHeader: { fontSize: 13, bold: true, color: 'FFFFFF', fill: '4472C4', align: 'center', valign: 'middle' },
    tableCell: { fontSize: 12, color: '333333', align: 'center', valign: 'middle' }
  };

  // 背景グラデーション
  const bgGradient = {
    type: 'linear',
    angle: 45,
    stops: [
      { position: 0, color: 'F8F9FA' },
      { position: 100, color: 'E9ECEF' }
    ]
  };

  // スライド1: タイトル
  let slide = pptx.addSlide();
  slide.background = bgGradient;
  slide.addText('namos-chat-v1', {
    x: 0.5, y: 1.5, w: 9, h: 1,
    ...styles.title,
    fontSize: 44
  });
  slide.addText('総合費用分析及び運営戦略報告書', {
    x: 0.5, y: 2.5, w: 9, h: 0.8,
    ...styles.subtitle,
    fontSize: 28
  });
  slide.addText('AI チャットサービスの詳細な財務分析と戦略提案', {
    x: 1, y: 3.8, w: 8, h: 0.5,
    fontSize: 16,
    color: '666666',
    align: 'center'
  });
  slide.addText('為替レート: $1 USD = 150 JPY', {
    x: 1, y: 4.8, w: 8, h: 0.4,
    fontSize: 14,
    color: '999999',
    align: 'center',
    italic: true
  });

  // スライド2: 目次
  slide = pptx.addSlide();
  slide.background = bgGradient;
  slide.addText('目次', {
    x: 0.5, y: 0.5, w: 9, h: 0.6,
    ...styles.heading1
  });
  
  const toc = [
    { text: '1. 核心単位経済性分析', options: { bullet: true } },
    { text: '2. 固定費用分析', options: { bullet: true } },
    { text: '3. 損益分岐点（BEP）分析', options: { bullet: true } },
    { text: '4. 初期赤字シナリオ', options: { bullet: true } },
    { text: '5. 損益（P&L）分析', options: { bullet: true } },
    { text: '6. 費用構造詳細分析', options: { bullet: true } },
    { text: '7. 収益性シナリオ分析', options: { bullet: true } },
    { text: '8. インフラ比較（Netlify vs AWS）', options: { bullet: true } },
    { text: '9. モデル変更シナリオ', options: { bullet: true } },
    { text: '10. 最適運営戦略提案', options: { bullet: true } }
  ];
  
  slide.addText(toc, {
    x: 1.5, y: 1.5, w: 7, h: 4,
    fontSize: 16,
    color: '333333',
    lineSpacing: 36
  });

  // スライド3: エグゼクティブサマリー
  slide = pptx.addSlide();
  slide.background = bgGradient;
  slide.addText('エグゼクティブサマリー', {
    x: 0.5, y: 0.4, w: 9, h: 0.6,
    ...styles.heading1
  });
  
  slide.addText('重要な発見事項', {
    x: 0.5, y: 1.1, w: 9, h: 0.4,
    ...styles.heading2
  });
  
  const summary = [
    { text: '貢献利益率95.3% - メッセージ1件当たり8.5円の収益に対し、変動費はわずか0.4円', options: { bullet: { type: 'number' } } },
    { text: '最大のコスト要因は「自動要約機能」- LLM費用の48%を占める', options: { bullet: { type: 'number' } } },
    { text: '100名のユーザーで月間158万円の純利益を達成可能', options: { bullet: { type: 'number' } } },
    { text: '初期段階（50名無料ユーザー）の月間損失は約2.7万円のみ', options: { bullet: { type: 'number' } } },
    { text: 'Netlify→AWS移行で月間68万円のコスト削減が可能（10,000名時点）', options: { bullet: { type: 'number' } } }
  ];
  
  slide.addText(summary, {
    x: 0.8, y: 1.7, w: 8.5, h: 3.5,
    fontSize: 15,
    color: '333333',
    lineSpacing: 32
  });

  // スライド4: 核心単位経済性 - 概要
  slide = pptx.addSlide();
  slide.background = bgGradient;
  slide.addText('1. 核心単位経済性分析', {
    x: 0.5, y: 0.4, w: 9, h: 0.6,
    ...styles.heading1
  });
  
  slide.addText('サービスの収益性を決定する最も重要な指標', {
    x: 0.5, y: 1.1, w: 9, h: 0.4,
    fontSize: 16,
    color: '666666',
    align: 'center'
  });
  
  // ハイライトボックス
  slide.addShape(pptx.ShapeType.rect, {
    x: 1.5, y: 1.8, w: 7, h: 2.5,
    fill: { color: 'FFF3CD' },
    line: { color: 'FFC107', width: 2 }
  });
  
  slide.addText('メッセージ1,000件当たりの費用', {
    x: 2, y: 2, w: 6, h: 0.4,
    fontSize: 18,
    bold: true,
    color: '856404'
  });
  
  const costBreakdown = [
    { text: 'LLM - チャット (Gemini 2.5 Flash): 65.0円', options: { bullet: true } },
    { text: 'LLM - 要約 (Gemini 2.5 Pro): 337.5円', options: { bullet: true } },
    { text: 'Embedding (OpenAI): 0.8円', options: { bullet: true } },
    { text: '合計変動費: 403.3円', options: { bullet: true } }
  ];
  
  slide.addText(costBreakdown, {
    x: 2.2, y: 2.5, w: 5.6, h: 1.6,
    fontSize: 14,
    color: '333333',
    lineSpacing: 26
  });

  // スライド5: 核心単位経済性 - 詳細
  slide = pptx.addSlide();
  slide.background = bgGradient;
  slide.addText('核心単位経済性 - 詳細計算', {
    x: 0.5, y: 0.4, w: 9, h: 0.6,
    ...styles.heading1
  });
  
  const unitEconomicsTable = [
    ['指標', '値', '備考'],
    ['メッセージ1件当たり変動費', '0.403円', 'LLM + Embedding'],
    ['メッセージ1件当たり平均収益', '8.5円', '4つの価格プランの平均'],
    ['メッセージ1件当たり貢献利益', '8.097円', '収益 - 変動費'],
    ['貢献利益率', '95.3%', '8.097 / 8.5'],
  ];
  
  slide.addTable(unitEconomicsTable, {
    x: 1, y: 1.3, w: 8, h: 2.2,
    fontSize: 14,
    border: { pt: 1, color: 'CCCCCC' },
    fill: { color: 'FFFFFF' },
    color: '333333',
    align: 'center',
    valign: 'middle',
    rowH: 0.44
  });
  
  slide.addShape(pptx.ShapeType.rect, {
    x: 1.5, y: 4, w: 7, h: 1.2,
    fill: { color: 'D4EDDA' },
    line: { color: '28A745', width: 2 }
  });
  
  slide.addText('重要な洞察', {
    x: 2, y: 4.1, w: 6, h: 0.3,
    fontSize: 16,
    bold: true,
    color: '155724'
  });
  
  slide.addText('貢献利益率95.3%は、有料ユーザー獲得と同時に高い収益性を確保できることを意味します。ビジネスの主要リスクは個別メッセージコストではなく、(A)インフラ拡張費用、(B)無料ユーザーサポートによる初期赤字です。', {
    x: 2, y: 4.5, w: 6, h: 0.6,
    fontSize: 12,
    color: '333333',
    align: 'left',
    valign: 'top'
  });

  // スライド6: 固定費用
  slide = pptx.addSlide();
  slide.background = bgGradient;
  slide.addText('2. 固定費用分析', {
    x: 0.5, y: 0.4, w: 9, h: 0.6,
    ...styles.heading1
  });
  
  slide.addText('ユーザー0名でも毎月発生する最小費用', {
    x: 0.5, y: 1.1, w: 9, h: 0.4,
    fontSize: 16,
    color: '666666',
    align: 'center'
  });
  
  const fixedCostTable = [
    ['項目', 'USD/月', 'JPY/月', '備考'],
    ['Netlify Pro プラン', '$19.00', '2,850円', '基本ホスティング'],
    ['ドメイン (.com)', '$1.00', '150円', '年$12を月割'],
    ['データベース (Supabase Pro)', '$25.00', '3,750円', '最小運用プラン'],
    ['決済処理 (PayPay)', '-', '1,980円', '月間固定利用料'],
    ['合計', '$45.00', '8,730円', '']
  ];
  
  slide.addTable(fixedCostTable, {
    x: 0.8, y: 1.7, w: 8.4, h: 2.8,
    fontSize: 13,
    border: { pt: 1, color: 'CCCCCC' },
    fill: { color: 'FFFFFF' },
    color: '333333',
    align: 'center',
    valign: 'middle',
    rowH: 0.56
  });
  
  // ヘッダー行のスタイル
  slide.addShape(pptx.ShapeType.rect, {
    x: 0.8, y: 1.7, w: 8.4, h: 0.56,
    fill: { color: '4472C4' }
  });
  
  slide.addText('月間最小運営費用: 8,730円', {
    x: 2, y: 4.8, w: 6, h: 0.5,
    fontSize: 20,
    bold: true,
    color: 'C00000',
    align: 'center'
  });

  // スライド7: BEP分析 - 概要
  slide = pptx.addSlide();
  slide.background = bgGradient;
  slide.addText('3. 損益分岐点（BEP）分析', {
    x: 0.5, y: 0.4, w: 9, h: 0.6,
    ...styles.heading1
  });
  
  slide.addText('総費用と総収益が一致する地点', {
    x: 0.5, y: 1.1, w: 9, h: 0.4,
    fontSize: 16,
    color: '666666',
    align: 'center'
  });
  
  slide.addText('総変動費の再計算', {
    x: 0.8, y: 1.7, w: 8.4, h: 0.4,
    ...styles.heading3
  });
  
  const vcTable = [
    ['費目', '金額（円）'],
    ['LLM費用', '0.403'],
    ['Netlify超過分（リクエスト1件当たり）', '0.03'],
    ['決済手数料（売上の3.6%）', '0.306'],
    ['総変動費（有料メッセージ1件）', '0.739'],
    ['総貢献利益', '7.761']
  ];
  
  slide.addTable(vcTable, {
    x: 2, y: 2.2, w: 6, h: 2.8,
    fontSize: 14,
    border: { pt: 1, color: 'CCCCCC' },
    fill: { color: 'FFFFFF' },
    color: '333333',
    align: 'center',
    valign: 'middle',
    rowH: 0.56
  });

  // スライド8: BEP分析 - シナリオA
  slide = pptx.addSlide();
  slide.background = bgGradient;
  slide.addText('BEP分析 - シナリオA（全メッセージ有料）', {
    x: 0.5, y: 0.4, w: 9, h: 0.6,
    ...styles.heading2
  });
  
  slide.addText('前提条件', {
    x: 0.8, y: 1.2, w: 4, h: 0.4,
    ...styles.heading3
  });
  
  const premiseA = [
    { text: '月間固定費: 8,730円', options: { bullet: true } },
    { text: 'メッセージ当たり貢献利益: 7.761円', options: { bullet: true } },
    { text: 'ユーザー1人当たり月平均メッセージ: 7,800件', options: { bullet: true } }
  ];
  
  slide.addText(premiseA, {
    x: 1, y: 1.7, w: 4, h: 1.5,
    fontSize: 13,
    color: '333333',
    lineSpacing: 28
  });
  
  slide.addShape(pptx.ShapeType.rect, {
    x: 5.5, y: 1.2, w: 4, h: 2.5,
    fill: { color: 'E7F3FF' },
    line: { color: '4472C4', width: 2 }
  });
  
  slide.addText('計算結果', {
    x: 5.7, y: 1.4, w: 3.6, h: 0.4,
    fontSize: 16,
    bold: true,
    color: '1F4788'
  });
  
  const resultA = [
    'BEP（メッセージ数）:',
    '8,730 ÷ 7.761 = 1,125件',
    '',
    'BEP（ユーザー数）:',
    '1,125 ÷ 7,800 = 0.14名'
  ];
  
  slide.addText(resultA.join('\n'), {
    x: 5.7, y: 1.9, w: 3.6, h: 1.6,
    fontSize: 14,
    color: '333333',
    align: 'left',
    valign: 'top'
  });
  
  slide.addText('⭐ 有料ユーザー1名で固定費を超える利益が発生', {
    x: 1, y: 4.2, w: 8, h: 0.6,
    fontSize: 16,
    bold: true,
    color: 'C00000',
    align: 'center'
  });

  // スライド9: BEP分析 - シナリオB
  slide = pptx.addSlide();
  slide.background = bgGradient;
  slide.addText('BEP分析 - シナリオB（混合：30%アクティブ）', {
    x: 0.5, y: 0.4, w: 9, h: 0.6,
    ...styles.heading2
  });
  
  slide.addText('前提条件', {
    x: 0.8, y: 1.2, w: 9, h: 0.4,
    ...styles.heading3
  });
  
  const premiseB = [
    { text: 'アクティブユーザー: 30%', options: { bullet: true } },
    { text: '月間無料ポイント: 900P', options: { bullet: true } },
    { text: 'ユーザー1人当たり月平均メッセージ: 7,800件', options: { bullet: true } },
    { text: '有料メッセージ: 7,800 - 900 = 6,900件', options: { bullet: true } }
  ];
  
  slide.addText(premiseB, {
    x: 1, y: 1.7, w: 8, h: 1.5,
    fontSize: 13,
    color: '333333',
    lineSpacing: 26
  });
  
  slide.addText('計算式', {
    x: 1, y: 3.3, w: 8, h: 0.3,
    fontSize: 14,
    bold: true,
    color: '1F4788'
  });
  
  slide.addText('総収益 = (N × 0.3 × 6,900) × 8.5円 = 17,595 × N\n総費用 = 8,730 + 1,647 × N\n\nBEP: 17,595 × N = 8,730 + 1,647 × N  →  N = 0.55名', {
    x: 1.5, y: 3.7, w: 7, h: 1.2,
    fontSize: 13,
    color: '333333',
    fontFace: 'Courier New'
  });
  
  slide.addText('⭐ 総ユーザー1名でBEP達成（貢献利益率90%超）', {
    x: 1, y: 5.1, w: 8, h: 0.5,
    fontSize: 16,
    bold: true,
    color: 'C00000',
    align: 'center'
  });

  // スライド10: 初期赤字分析
  slide = pptx.addSlide();
  slide.background = bgGradient;
  slide.addText('4. 初期ローンチ赤字分析', {
    x: 0.5, y: 0.4, w: 9, h: 0.6,
    ...styles.heading1
  });
  
  slide.addText('30～50名の無料ユーザーシナリオ（収益0円）', {
    x: 0.5, y: 1.1, w: 9, h: 0.4,
    fontSize: 16,
    color: '666666',
    align: 'center'
  });
  
  const burnRateTable = [
    ['項目', '30名無料ユーザー', '50名無料ユーザー'],
    ['収益', '0円', '0円'],
    ['固定費用', '8,730円', '8,730円'],
    ['変動費用（LLM）', '10,881円', '18,135円'],
    ['Netlify超過費用', '0円', '0円'],
    ['決済手数料', '0円', '0円'],
    ['月間総費用', '19,611円', '26,865円'],
    ['月間純損失', '-19,611円', '-26,865円']
  ];
  
  slide.addTable(burnRateTable, {
    x: 1, y: 1.7, w: 8, h: 3.5,
    fontSize: 13,
    border: { pt: 1, color: 'CCCCCC' },
    fill: { color: 'FFFFFF' },
    color: '333333',
    align: 'center',
    valign: 'middle',
    rowH: 0.5
  });
  
  slide.addShape(pptx.ShapeType.rect, {
    x: 1.5, y: 5.4, w: 7, h: 0.8,
    fill: { color: 'FFF3CD' },
    line: { color: 'FFC107', width: 2 }
  });
  
  slide.addText('⚠️ 初期50名の無料ユーザー維持に月間約27,000円の費用が発生。これは有料転換前の必須初期投資費用です。', {
    x: 1.7, y: 5.5, w: 6.6, h: 0.6,
    fontSize: 13,
    color: '856404',
    align: 'center',
    valign: 'middle'
  });

  // スライド11: P&L分析
  slide = pptx.addSlide();
  slide.background = bgGradient;
  slide.addText('5. 損益（P&L）分析', {
    x: 0.5, y: 0.4, w: 9, h: 0.6,
    ...styles.heading1
  });
  
  slide.addText('ユーザー数増加に伴う月間損益予測', {
    x: 0.5, y: 1.1, w: 9, h: 0.4,
    fontSize: 16,
    color: '666666',
    align: 'center'
  });
  
  const plTable = [
    ['ユーザー数', 'シナリオ', '月間総収益', '月間総費用', '純利益/純損失', 'マージン率'],
    ['0名', '-', '0円', '8,730円', '-8,730円', 'N/A'],
    ['30名', '初期（無料）', '0円', '19,611円', '-19,611円', 'N/A'],
    ['50名', '初期（無料）', '0円', '26,865円', '-26,865円', 'N/A'],
    ['100名', '混合（30%）', '1,759,500円', '172,974円', '1,586,526円', '90.2%'],
    ['500名', '混合（30%）', '8,797,500円', '832,230円', '7,965,270円', '90.5%'],
    ['1,000名', '混合（30%）', '17,595,000円', '1,655,520円', '15,939,480円', '90.6%'],
    ['5,000名', '混合（30%）', '87,975,000円', '8,247,060円', '79,727,940円', '90.6%'],
    ['10,000名', '混合（30%）', '175,950,000円', '16,477,230円', '159,472,770円', '90.6%']
  ];
  
  slide.addTable(plTable, {
    x: 0.3, y: 1.7, w: 9.4, h: 3.6,
    fontSize: 11,
    border: { pt: 1, color: 'CCCCCC' },
    fill: { color: 'FFFFFF' },
    color: '333333',
    align: 'center',
    valign: 'middle',
    rowH: 0.45
  });

  // スライド12: P&L分析 - 洞察
  slide = pptx.addSlide();
  slide.background = bgGradient;
  slide.addText('P&L分析 - 重要な洞察', {
    x: 0.5, y: 0.4, w: 9, h: 0.6,
    ...styles.heading1
  });
  
  slide.addShape(pptx.ShapeType.rect, {
    x: 0.8, y: 1.2, w: 8.4, h: 1.2,
    fill: { color: 'FFEBEE' },
    line: { color: 'F44336', width: 2 }
  });
  
  slide.addText('❶ 初期赤字区間（0～50名）', {
    x: 1, y: 1.3, w: 8, h: 0.3,
    fontSize: 15,
    bold: true,
    color: 'C62828'
  });
  
  slide.addText('収益が発生しない状態で月2～3万円の赤字が発生。この区間を迅速に通過し、有料ユーザーを獲得することがサービス生存の鍵。', {
    x: 1, y: 1.7, w: 8, h: 0.6,
    fontSize: 13,
    color: '333333'
  });
  
  slide.addShape(pptx.ShapeType.rect, {
    x: 0.8, y: 2.6, w: 8.4, h: 1.2,
    fill: { color: 'E8F5E9' },
    line: { color: '4CAF50', width: 2 }
  });
  
  slide.addText('❷ 爆発的収益性（100名+）', {
    x: 1, y: 2.7, w: 8, h: 0.3,
    fontSize: 15,
    bold: true,
    color: '2E7D32'
  });
  
  slide.addText('100名のユーザー（うちアクティブ30名）で月間158万円以上の純利益が発生。高いポイント価格（8.5円）と低いLLM単位費用（0.4円）の成功的な組み合わせの結果。', {
    x: 1, y: 3.1, w: 8, h: 0.6,
    fontSize: 13,
    color: '333333'
  });
  
  slide.addShape(pptx.ShapeType.rect, {
    x: 0.8, y: 4, w: 8.4, h: 1.2,
    fill: { color: 'E3F2FD' },
    line: { color: '2196F3', width: 2 }
  });
  
  slide.addText('❸ 安定的拡張性', {
    x: 1, y: 4.1, w: 8, h: 0.3,
    fontSize: 15,
    bold: true,
    color: '1565C0'
  });
  
  slide.addText('ユーザー数が100名→10,000名へ100倍増加する間、マージン率は90%台で非常に安定的に維持。ビジネスモデルがトラフィック増加に伴い線形的に拡張可能であることを強く示唆。', {
    x: 1, y: 4.5, w: 8, h: 0.6,
    fontSize: 13,
    color: '333333'
  });

  // スライド13: 費用構造分析
  slide = pptx.addSlide();
  slide.background = bgGradient;
  slide.addText('6. 費用構造詳細分析', {
    x: 0.5, y: 0.4, w: 9, h: 0.6,
    ...styles.heading1
  });
  
  slide.addText('1,000名 & 10,000名ユーザー時の費用項目別比重', {
    x: 0.5, y: 1.1, w: 9, h: 0.4,
    fontSize: 16,
    color: '666666',
    align: 'center'
  });
  
  const costStructureTable = [
    ['項目', '1,000名ユーザー', '比率', '10,000名ユーザー', '比率'],
    ['総費用', '1,655,520円', '100.0%', '16,477,230円', '100.0%'],
    ['LLM - 要約 (Pro)', '789,308円', '47.7%', '7,893,077円', '47.9%'],
    ['決済手数料 (3.6%)', '633,420円', '38.3%', '6,334,200円', '38.4%'],
    ['LLM - チャット (Flash)', '151,826円', '9.2%', '1,518,262円', '9.2%'],
    ['インフラ (Netlify)', '70,350円', '4.2%', '704,100円', '4.3%'],
    ['固定費用', '5,880円', '0.4%', '5,880円', '0.04%'],
    ['Embedding', '1,872円', '0.1%', '18,720円', '0.1%']
  ];
  
  slide.addTable(costStructureTable, {
    x: 0.5, y: 1.7, w: 9, h: 3.5,
    fontSize: 11,
    border: { pt: 1, color: 'CCCCCC' },
    fill: { color: 'FFFFFF' },
    color: '333333',
    align: 'center',
    valign: 'middle',
    rowH: 0.5
  });

  // スライド14: 費用構造 - 洞察
  slide = pptx.addSlide();
  slide.background = bgGradient;
  slide.addText('費用構造 - 重要な洞察', {
    x: 0.5, y: 0.4, w: 9, h: 0.6,
    ...styles.heading1
  });
  
  const costInsights = [
    {
      title: '❶ 費用の86%は2項目に集中',
      content: 'サービスが拡張するほど、総費用は「LLM要約」（約48%）と「決済手数料」（約38%）という2つの核心要因によって決定される。',
      color: 'FFF3CD',
      borderColor: 'FFC107'
    },
    {
      title: '❷ 最適化優先順位',
      content: '費用削減のための努力は、(1) LLM要約機能の呼び出し頻度を減らすかモデルを変更すること、(2) 決済手数料を交渉することに集中すべき。',
      color: 'E8F5E9',
      borderColor: '4CAF50'
    },
    {
      title: '❸ インフラ費用の罠',
      content: 'Netlify費用比重は現在4.2%と低く見えるが、これはメッセージ当たり1回の関数呼び出しを仮定。実際のアーキテクチャがより複雑でメッセージ当たり3～4回関数を呼び出す場合、インフラ費用は3～4倍に増加しLLMチャット費用を超える可能性がある。',
      color: 'FFEBEE',
      borderColor: 'F44336'
    }
  ];
  
  let yPos = 1.2;
  costInsights.forEach(insight => {
    slide.addShape(pptx.ShapeType.rect, {
      x: 0.8, y: yPos, w: 8.4, h: 1.2,
      fill: { color: insight.color },
      line: { color: insight.borderColor, width: 2 }
    });
    
    slide.addText(insight.title, {
      x: 1, y: yPos + 0.1, w: 8, h: 0.3,
      fontSize: 14,
      bold: true,
      color: '333333'
    });
    
    slide.addText(insight.content, {
      x: 1, y: yPos + 0.45, w: 8, h: 0.7,
      fontSize: 12,
      color: '333333'
    });
    
    yPos += 1.4;
  });

  // スライド15: 収益性シナリオ分析
  slide = pptx.addSlide();
  slide.background = bgGradient;
  slide.addText('7. 収益性シナリオ分析', {
    x: 0.5, y: 0.4, w: 9, h: 0.6,
    ...styles.heading1
  });
  
  slide.addText('ユーザー参加度が収益性に及ぼす影響（1,000名ユーザー基準）', {
    x: 0.5, y: 1.1, w: 9, h: 0.4,
    fontSize: 14,
    color: '666666',
    align: 'center'
  });
  
  const engagementTable = [
    ['シナリオ', '日平均', '月有料', '月総収益', '月総費用', '月純利益', 'マージン率'],
    ['1: 低活動', '50件\n(月1,500)', '600件', '1,530,000円', '256,410円', '1,273,590円', '83.2%'],
    ['2: 中間活動', '200件\n(月6,000)', '5,100件', '13,005,000円', '1,254,810円', '11,750,190円', '90.4%'],
    ['3: 高活動', '500件\n(月15,000)', '14,100件', '35,955,000円', '3,247,860円', '32,707,140円', '90.9%']
  ];
  
  slide.addTable(engagementTable, {
    x: 0.4, y: 1.7, w: 9.2, h: 2,
    fontSize: 11,
    border: { pt: 1, color: 'CCCCCC' },
    fill: { color: 'FFFFFF' },
    color: '333333',
    align: 'center',
    valign: 'middle',
    rowH: 0.5
  });
  
  slide.addText('月900無料ポイント政策の両面性', {
    x: 0.8, y: 4, w: 8.4, h: 0.4,
    ...styles.heading3
  });
  
  const policyInsights = [
    { text: '低活動ユーザー: 無料ポイントが総使用量の60% (900/1,500)を占め、収益貢献度が非常に低い', options: { bullet: true } },
    { text: '高活動ユーザー: 無料ポイントは総使用量のわずか6% (900/15,000)。これらのユーザーが収益性の核心動力', options: { bullet: true } },
    { text: '戦略的示唆: サービスの収益性は「ヘビーユーザー」をどれだけ確保・維持するかにかかっている', options: { bullet: true } }
  ];
  
  slide.addText(policyInsights, {
    x: 1, y: 4.5, w: 8, h: 1.3,
    fontSize: 13,
    color: '333333',
    lineSpacing: 26
  });

  // スライド16: Netlify vs AWS
  slide = pptx.addSlide();
  slide.background = bgGradient;
  slide.addText('8. インフラ比較: Netlify vs AWS', {
    x: 0.5, y: 0.4, w: 9, h: 0.6,
    ...styles.heading1
  });
  
  slide.addText('サーバーレス関数費用の比較', {
    x: 0.5, y: 1.1, w: 9, h: 0.4,
    fontSize: 16,
    color: '666666',
    align: 'center'
  });
  
  const infraTable = [
    ['ユーザー数', '月間リクエスト数', 'Netlify月額', 'AWS月額(推定)', '月間節約額', '費用削減率'],
    ['1,000名', '234万', '70,350円', '1,921円', '68,429円', '97.3%'],
    ['10,000名', '2,340万', '704,100円', '19,212円', '684,888円', '97.3%']
  ];
  
  slide.addTable(infraTable, {
    x: 0.5, y: 1.7, w: 9, h: 1.5,
    fontSize: 12,
    border: { pt: 1, color: 'CCCCCC' },
    fill: { color: 'FFFFFF' },
    color: '333333',
    align: 'center',
    valign: 'middle',
    rowH: 0.5
  });
  
  slide.addText('費用詳細（Netlify）', {
    x: 0.8, y: 3.4, w: 4, h: 0.4,
    ...styles.heading3
  });
  
  slide.addText('月125,000件無料\n超過125,000件毎に $25 (3,750円)', {
    x: 1, y: 3.9, w: 3.5, h: 0.8,
    fontSize: 13,
    color: '333333'
  });
  
  slide.addText('費用詳細（AWS）', {
    x: 5.2, y: 3.4, w: 4, h: 0.4,
    ...styles.heading3
  });
  
  slide.addText('Lambda $0.20/1M\nAPI Gateway $1.00/1M\n合計 180円/1M リクエスト\n+ Lambda実行時間', {
    x: 5.4, y: 3.9, w: 3.5, h: 1.2,
    fontSize: 13,
    color: '333333'
  });

  // スライド17: Netlify vs AWS - 洞察
  slide = pptx.addSlide();
  slide.background = bgGradient;
  slide.addText('インフラ比較 - 戦略的示唆', {
    x: 0.5, y: 0.4, w: 9, h: 0.6,
    ...styles.heading1
  });
  
  slide.addShape(pptx.ShapeType.rect, {
    x: 0.8, y: 1.2, w: 8.4, h: 1.5,
    fill: { color: 'FFF3CD' },
    line: { color: 'FFC107', width: 2 }
  });
  
  slide.addText('⚠️ Netlifyは36倍高い', {
    x: 1, y: 1.4, w: 8, h: 0.4,
    fontSize: 18,
    bold: true,
    color: '856404'
  });
  
  slide.addText('Netlifyは初期開発速度と運営便宜性を提供するが、拡張時に費用が幾何級数的に増加。1,000名ユーザー基準で月7万円の費用は「DevOpsエンジニア0.1人月」より安価な可能性があるが、10,000名ユーザーの月70万円は正当化が困難。', {
    x: 1.2, y: 1.9, w: 7.6, h: 0.7,
    fontSize: 13,
    color: '333333'
  });
  
  slide.addText('移行戦略', {
    x: 0.8, y: 3, w: 8.4, h: 0.4,
    ...styles.heading2
  });
  
  const migrationStrategy = [
    { text: 'Phase 1 (0～500名): Netlifyを維持。この区間では開発速度が月7万円未満の費用より重要', options: { bullet: { type: 'number' } } },
    { text: 'Phase 2 (500名+): AWS Lambda/API Gateway/CloudFront（日本リージョン）への移行に即時着手', options: { bullet: { type: 'number' } } },
    { text: '10,000名基準で月70万円の費用差はDevOpsエンジニア雇用費用を上回る', options: { bullet: { type: 'number' } } }
  ];
  
  slide.addText(migrationStrategy, {
    x: 1, y: 3.5, w: 8, h: 1.8,
    fontSize: 14,
    color: '333333',
    lineSpacing: 32
  });

  // スライド18: モデル変更シナリオ
  slide = pptx.addSlide();
  slide.background = bgGradient;
  slide.addText('9. モデル変更シナリオ分析', {
    x: 0.5, y: 0.4, w: 9, h: 0.6,
    ...styles.heading1
  });
  
  slide.addText('LLMモデル組み合わせ変更の影響（1,000名ユーザー基準）', {
    x: 0.5, y: 1.1, w: 9, h: 0.4,
    fontSize: 14,
    color: '666666',
    align: 'center'
  });
  
  const modelTable = [
    ['シナリオ', 'チャット', '要約', '月総LLM費用', '基準(A)との差額', '基準(A)との比率'],
    ['A (現在)', 'Flash 2.5', 'Pro 2.5', '941,777円', '0円', '100.0%'],
    ['B (費用削減)', 'Flash 2.5', 'Flash 2.5', '199,412円', '-742,365円', '21.2%'],
    ['C (高級化)', 'Pro 2.5', 'Pro 2.5', '3,323,531円', '+2,381,754円', '352.9%'],
    ['D (ハイブリッド)', 'Pro 2.5', 'Flash 2.5', '2,581,166円', '+1,639,389円', '274.1%']
  ];
  
  slide.addTable(modelTable, {
    x: 0.3, y: 1.7, w: 9.4, h: 2.5,
    fontSize: 11,
    border: { pt: 1, color: 'CCCCCC' },
    fill: { color: 'FFFFFF' },
    color: '333333',
    align: 'center',
    valign: 'middle',
    rowH: 0.5
  });
  
  slide.addText('重要な発見事項', {
    x: 0.8, y: 4.4, w: 8.4, h: 0.4,
    ...styles.heading3
  });
  
  const modelInsights = [
    { text: '最強の費用削減（A→B）: 要約モデルをPro→Flashに変更するだけで月74万円を即時削減（78.8%削減）', options: { bullet: true } },
    { text: 'Proチャットの財務的リスク（A→C）: チャットモデルをProに変更すると月238万円の費用爆発', options: { bullet: true } },
    { text: '推奨: Flash チャット + Flash 要約（シナリオB）で出発し、費用を最小化', options: { bullet: true } }
  ];
  
  slide.addText(modelInsights, {
    x: 1, y: 4.9, w: 8, h: 1.2,
    fontSize: 13,
    color: '333333',
    lineSpacing: 26
  });

  // スライド19: 最適運営戦略 - 費用最適化
  slide = pptx.addSlide();
  slide.background = bgGradient;
  slide.addText('10. 最適運営戦略提案', {
    x: 0.5, y: 0.4, w: 9, h: 0.6,
    ...styles.heading1
  });
  
  slide.addText('❶ 費用最適化方案', {
    x: 0.5, y: 1.1, w: 9, h: 0.5,
    ...styles.heading2
  });
  
  slide.addShape(pptx.ShapeType.rect, {
    x: 0.8, y: 1.7, w: 8.4, h: 1.6,
    fill: { color: 'E8F5E9' },
    line: { color: '4CAF50', width: 2 }
  });
  
  slide.addText('[即時実行] 自動要約機能の再設計（月74万円削減 @ 1k users）', {
    x: 1, y: 1.85, w: 8, h: 0.35,
    fontSize: 14,
    bold: true,
    color: '2E7D32'
  });
  
  slide.addText('現在「5メッセージ毎にPro要約」は費用構造の48%を占める最大の財務負担。\n\n代案1（推奨）: モデルを「Gemini 2.5 Pro」→「Flash」に即時変更\n代案2: トリガーを変更（「チャットセッション終了時1回」または「ユーザー要請時（有料ポイント差引）」）', {
    x: 1.2, y: 2.3, w: 7.6, h: 0.9,
    fontSize: 11,
    color: '333333'
  });
  
  slide.addShape(pptx.ShapeType.rect, {
    x: 0.8, y: 3.5, w: 8.4, h: 1.6,
    fill: { color: 'E3F2FD' },
    line: { color: '2196F3', width: 2 }
  });
  
  slide.addText('[中期計画] NetlifyからAWSへのインフラ移行（月68万円削減 @ 10k users）', {
    x: 1, y: 3.65, w: 8, h: 0.35,
    fontSize: 14,
    bold: true,
    color: '1565C0'
  });
  
  slide.addText('Netlify関数はAWS Lambda/APGWに比べ36倍以上高価。\n\nPhase 1（0～500名）: Netlifyを維持（開発速度が月7万円未満の費用より重要）\nPhase 2（500名+）: AWS Lambda/APIGW/CloudFront（日本リージョン）への移行に即時着手', {
    x: 1.2, y: 4.1, w: 7.6, h: 0.9,
    fontSize: 11,
    color: '333333'
  });

  // スライド20: 最適運営戦略 - 収益最大化
  slide = pptx.addSlide();
  slide.background = bgGradient;
  slide.addText('最適運営戦略提案（続き）', {
    x: 0.5, y: 0.4, w: 9, h: 0.6,
    ...styles.heading1
  });
  
  slide.addText('❷ 収益最大化方案', {
    x: 0.5, y: 1.1, w: 9, h: 0.5,
    ...styles.heading2
  });
  
  slide.addShape(pptx.ShapeType.rect, {
    x: 0.8, y: 1.7, w: 8.4, h: 1.4,
    fill: { color: 'FFF3CD' },
    line: { color: 'FFC107', width: 2 }
  });
  
  slide.addText('[即時実行] 無料ポイント政策の調整', {
    x: 1, y: 1.85, w: 8, h: 0.35,
    fontSize: 14,
    bold: true,
    color: '856404'
  });
  
  slide.addText('「月900ポイント」は低活性ユーザー（月1,500 msg）の使用量60%をカバーし、有料転換を妨害。\n\n代案: 毎日出席ポイントを30P→10P（月300P）に削減。これは依然としてユーザーの毎日接続を誘導しつつ、低活性ユーザーも有料ポイント購入を促す。', {
    x: 1.2, y: 2.3, w: 7.6, h: 0.7,
    fontSize: 11,
    color: '333333'
  });
  
  slide.addShape(pptx.ShapeType.rect, {
    x: 0.8, y: 3.3, w: 8.4, h: 1.4,
    fill: { color: 'FFEBEE' },
    line: { color: 'F44336', width: 2 }
  });
  
  slide.addText('[初期戦略] 初期赤字（Burn Rate）管理', {
    x: 1, y: 3.45, w: 8, h: 0.35,
    fontSize: 14,
    bold: true,
    color: 'C62828'
  });
  
  slide.addText('初期50名無料ユーザーによる月2.7万円の赤字は「顧客獲得費用（CAC）」。\n\n最大3ヶ月（約8万円）の予算を設定し、この期間内に有料転換が発生しなければ、マーケティングまたはサービス魅力度を即時再検討すべき。', {
    x: 1.2, y: 3.9, w: 7.6, h: 0.7,
    fontSize: 11,
    color: '333333'
  });

  // スライド21: 最適運営戦略 - モデル&価格
  slide = pptx.addSlide();
  slide.background = bgGradient;
  slide.addText('最適運営戦略提案（続き）', {
    x: 0.5, y: 0.4, w: 9, h: 0.6,
    ...styles.heading1
  });
  
  slide.addText('❸ モデル選択戦略', {
    x: 0.5, y: 1.1, w: 9, h: 0.5,
    ...styles.heading2
  });
  
  const modelStrategy = [
    { text: '基本: Flash チャット + Flash 要約（シナリオB）でローンチし、費用を最小化', options: { bullet: true } },
    { text: '有料オプション: Pro チャット（シナリオD）は「月1,000円追加購読」または「メッセージ当たり3ポイント差引」のようなプレミアム（Upsell）商品として提供', options: { bullet: true } },
    { text: '❌ Pro モデルをデフォルトで提供してはいけない', options: { bullet: true } }
  ];
  
  slide.addText(modelStrategy, {
    x: 1, y: 1.7, w: 8, h: 1.5,
    fontSize: 14,
    color: '333333',
    lineSpacing: 30
  });
  
  slide.addText('❹ ポイント価格戦略', {
    x: 0.5, y: 3.4, w: 9, h: 0.5,
    ...styles.heading2
  });
  
  slide.addShape(pptx.ShapeType.rect, {
    x: 1.2, y: 4, w: 7.6, h: 1.3,
    fill: { color: 'E8F5E9' },
    line: { color: '4CAF50', width: 2 }
  });
  
  slide.addText('✅ 現在の価格政策は非常に優れている（維持推奨）', {
    x: 1.4, y: 4.15, w: 7.2, h: 0.35,
    fontSize: 15,
    bold: true,
    color: '2E7D32'
  });
  
  slide.addText('メッセージ当たり平均収益（8.5円）対LLM費用（0.4円）は21倍で、貢献利益率95%に達する。\n\n収益性問題は価格ではなく、「無料ユーザーの有料転換率」にある。', {
    x: 1.4, y: 4.6, w: 7.2, h: 0.6,
    fontSize: 12,
    color: '333333'
  });

  // スライド22: 結論
  slide = pptx.addSlide();
  slide.background = bgGradient;
  slide.addText('結論', {
    x: 0.5, y: 0.4, w: 9, h: 0.6,
    ...styles.heading1
  });
  
  slide.addText('namos-chat-v1 は極めて高い収益性を持つビジネスモデル', {
    x: 0.5, y: 1.2, w: 9, h: 0.5,
    fontSize: 18,
    color: '1F4788',
    align: 'center',
    bold: true
  });
  
  const conclusions1 = [
    { text: '貢献利益率95.3% - 有料ユーザー獲得直後から高収益', options: { bullet: { type: 'number' } } },
    { text: '100名ユーザーで月158万円の純利益 - 急速なスケーリングが可能', options: { bullet: { type: 'number' } } },
    { text: '初期赤字はわずか月2～3万円 - 財務的リスクは極めて低い', options: { bullet: { type: 'number' } } },
    { text: '主要コスト要因は明確 - 最適化の方向性が具体的', options: { bullet: { type: 'number' } } }
  ];
  
  const conclusions2 = [
    { text: '戦略的実行項目:', options: { bullet: { type: 'number' } } },
    { text: '  • 自動要約機能の最適化（月74万円削減可能）', options: { bullet: false } },
    { text: '  • 500名以降のAWS移行準備', options: { bullet: false } },
    { text: '  • 無料ポイント政策の調整', options: { bullet: false } },
    { text: '  • ヘビーユーザー獲得に集中したマーケティング', options: { bullet: false } }
  ];
  
  slide.addText(conclusions1, {
    x: 1, y: 1.9, w: 8, h: 1.6,
    fontSize: 14,
    color: '333333',
    lineSpacing: 26
  });
  
  slide.addText(conclusions2, {
    x: 1, y: 3.7, w: 8, h: 1.8,
    fontSize: 14,
    color: '333333',
    lineSpacing: 24
  });
  
  slide.addShape(pptx.ShapeType.rect, {
    x: 1.5, y: 5.6, w: 7, h: 0.6,
    fill: { color: '4472C4' }
  });
  
  slide.addText('ビジネスの成功は「初期50名→100名への迅速な移行」にかかっている', {
    x: 1.7, y: 5.7, w: 6.6, h: 0.4,
    fontSize: 14,
    bold: true,
    color: 'FFFFFF',
    align: 'center',
    valign: 'middle'
  });

  // スライド23: ドメイン費用分析
  slide = pptx.addSlide();
  slide.background = bgGradient;
  slide.addText('補足: ドメイン購入及び維持費用', {
    x: 0.5, y: 0.4, w: 9, h: 0.6,
    ...styles.heading1
  });
  
  slide.addText('サービス運営に必要なドメイン費用', {
    x: 0.5, y: 1.1, w: 9, h: 0.4,
    fontSize: 16,
    color: '666666',
    align: 'center'
  });
  
  const domainTable = [
    ['ドメイン種類', '初年度費用', '更新費用（年間）', '備考'],
    ['.com', '$9~$15\n(1,350~2,250円)', '$12~$18\n(1,800~2,700円)', '最も一般的なドメイン'],
    ['.jp', '¥3,000~¥4,000', '¥3,500~¥5,000', '日本向けサービスに適合'],
    ['.co.jp', '¥6,000~¥8,000', '¥6,000~¥8,000', '日本の法人専用'],
    ['.net', '$10~$13\n(1,500~1,950円)', '$13~$16\n(1,950~2,400円)', '技術系サービス向け']
  ];
  
  slide.addTable(domainTable, {
    x: 0.8, y: 1.7, w: 8.4, h: 2.5,
    fontSize: 12,
    border: { pt: 1, color: 'CCCCCC' },
    fill: { color: 'FFFFFF' },
    color: '333333',
    align: 'center',
    valign: 'middle',
    rowH: 0.5
  });
  
  slide.addText('推奨ドメインレジストラ', {
    x: 0.8, y: 4.4, w: 8.4, h: 0.4,
    ...styles.heading3
  });
  
  const registrars = [
    { text: 'Cloudflare: 低価格 + WHOIS プライバシー無料 + 高速DNS', options: { bullet: true } },
    { text: 'Namecheap: 初年度割引が豊富 + 使いやすい管理画面', options: { bullet: true } },
    { text: 'お名前.com: 日本語サポート + .jpドメインに強い', options: { bullet: true } }
  ];
  
  slide.addText(registrars, {
    x: 1, y: 4.9, w: 8, h: 1,
    fontSize: 13,
    color: '333333',
    lineSpacing: 22
  });

  // スライド24: 決済サービス比較 - 概要
  slide = pptx.addSlide();
  slide.background = bgGradient;
  slide.addText('補足: 決済サービス比較 (PayPal vs PayPay)', {
    x: 0.5, y: 0.4, w: 9, h: 0.6,
    ...styles.heading1
  });
  
  slide.addText('サービスに最適な決済手段の選択', {
    x: 0.5, y: 1.1, w: 9, h: 0.4,
    fontSize: 16,
    color: '666666',
    align: 'center'
  });
  
  const paymentComparisonTable = [
    ['項目', 'PayPal', 'PayPay'],
    ['対象地域', '全世界200カ国以上', '日本国内のみ'],
    ['変動手数料', '3.6% + 40円\n(日本国内取引)', '1.98%~3.74%\n(取引額による)'],
    ['固定月額費用', '0円\n(ビジネスアカウント)', '0円~1,980円\n(プランによる)'],
    ['通貨サポート', '25通貨以上', '日本円のみ'],
    ['国際決済', '✅ 可能', '❌ 不可'],
    ['セットアップ難易度', '中程度', '簡単（日本のみ）']
  ];
  
  slide.addTable(paymentComparisonTable, {
    x: 0.5, y: 1.7, w: 9, h: 3.5,
    fontSize: 11,
    border: { pt: 1, color: 'CCCCCC' },
    fill: { color: 'FFFFFF' },
    color: '333333',
    align: 'center',
    valign: 'middle',
    rowH: 0.5
  });

  // スライド25: 決済サービス詳細分析
  slide = pptx.addSlide();
  slide.background = bgGradient;
  slide.addText('決済サービス詳細分析', {
    x: 0.5, y: 0.4, w: 9, h: 0.6,
    ...styles.heading1
  });
  
  slide.addShape(pptx.ShapeType.rect, {
    x: 0.8, y: 1.1, w: 4, h: 2.2,
    fill: { color: 'E3F2FD' },
    line: { color: '2196F3', width: 2 }
  });
  
  slide.addText('PayPal の特徴', {
    x: 1, y: 1.25, w: 3.6, h: 0.4,
    fontSize: 16,
    bold: true,
    color: '1565C0'
  });
  
  const paypalFeatures = [
    { text: '✅ グローバル展開に最適', options: { bullet: false } },
    { text: '✅ 多通貨対応（25通貨以上）', options: { bullet: false } },
    { text: '✅ 信頼性が高い（世界最大手）', options: { bullet: false } },
    { text: '⚠️ 手数料が比較的高い（3.6%+40円）', options: { bullet: false } },
    { text: '⚠️ アカウント凍結リスク', options: { bullet: false } },
    { text: '⚠️ 日本語サポートが限定的', options: { bullet: false } }
  ];
  
  slide.addText(paypalFeatures, {
    x: 1.1, y: 1.7, w: 3.4, h: 1.5,
    fontSize: 11,
    color: '333333',
    lineSpacing: 18
  });
  
  slide.addShape(pptx.ShapeType.rect, {
    x: 5.2, y: 1.1, w: 4, h: 2.2,
    fill: { color: 'E8F5E9' },
    line: { color: '4CAF50', width: 2 }
  });
  
  slide.addText('PayPay の特徴', {
    x: 5.4, y: 1.25, w: 3.6, h: 0.4,
    fontSize: 16,
    bold: true,
    color: '2E7D32'
  });
  
  const paypayFeatures = [
    { text: '✅ 日本国内で最も人気', options: { bullet: false } },
    { text: '✅ 手数料が低い（1.98%~）', options: { bullet: false } },
    { text: '✅ 日本語サポート充実', options: { bullet: false } },
    { text: '✅ セットアップが簡単', options: { bullet: false } },
    { text: '❌ 日本国内のみ使用可能', options: { bullet: false } },
    { text: '❌ 月額固定費が発生する場合あり', options: { bullet: false } }
  ];
  
  slide.addText(paypayFeatures, {
    x: 5.5, y: 1.7, w: 3.4, h: 1.5,
    fontSize: 11,
    color: '333333',
    lineSpacing: 18
  });
  
  slide.addText('費用シミュレーション（月間売上500万円の場合）', {
    x: 0.8, y: 3.5, w: 8.4, h: 0.4,
    ...styles.heading3
  });
  
  const costSimulation = [
    ['決済サービス', '変動手数料', '固定費', '月間総費用', '年間総費用'],
    ['PayPal', '3.6% + 40円', '0円', '180,000円 + 手数料', '約216万円'],
    ['PayPay (低率プラン)', '1.98%', '1,980円', '101,880円', '約122万円'],
    ['PayPay (標準プラン)', '3.24%', '0円', '162,000円', '約194万円']
  ];
  
  slide.addTable(costSimulation, {
    x: 0.8, y: 4, w: 8.4, h: 2,
    fontSize: 11,
    border: { pt: 1, color: 'CCCCCC' },
    fill: { color: 'FFFFFF' },
    color: '333333',
    align: 'center',
    valign: 'middle',
    rowH: 0.5
  });

  // スライド26: 決済サービス推奨戦略
  slide = pptx.addSlide();
  slide.background = bgGradient;
  slide.addText('決済サービス選択 - 推奨戦略', {
    x: 0.5, y: 0.4, w: 9, h: 0.6,
    ...styles.heading1
  });
  
  slide.addShape(pptx.ShapeType.rect, {
    x: 0.8, y: 1.2, w: 8.4, h: 1.3,
    fill: { color: 'E8F5E9' },
    line: { color: '4CAF50', width: 3 }
  });
  
  slide.addText('🎯 推奨: PayPayを主力に、PayPalを補助として併用', {
    x: 1, y: 1.35, w: 8, h: 0.4,
    fontSize: 18,
    bold: true,
    color: '2E7D32'
  });
  
  slide.addText('本サービスの市場戦略（日本先行→韓国・東南アジア展開）を考慮すると、初期段階では日本市場に最適化されたPayPayを主力決済手段として採用し、将来的な国際展開に備えてPayPalを補助的に提供する戦略が最適です。', {
    x: 1.2, y: 1.8, w: 7.6, h: 0.6,
    fontSize: 13,
    color: '333333',
    align: 'left'
  });
  
  slide.addText('段階別実装戦略', {
    x: 0.8, y: 2.7, w: 8.4, h: 0.4,
    ...styles.heading2
  });
  
  const implementationStrategy = [
    { text: 'Phase 1（0～1,000名）: PayPayのみ実装', options: { bullet: { type: 'number' } } },
    { text: '  • 理由: 開発工数を削減し、日本市場に集中', options: { bullet: false } },
    { text: '  • 想定手数料: 1.98%~3.24%（PayPayプランによる）', options: { bullet: false } },
    { text: '  • 月間固定費: 0円~1,980円', options: { bullet: false } }
  ];
  
  slide.addText(implementationStrategy, {
    x: 1, y: 3.2, w: 8, h: 1,
    fontSize: 13,
    color: '333333',
    lineSpacing: 20
  });
  
  const implementationStrategy2 = [
    { text: 'Phase 2（1,000名～）: PayPalを追加実装', options: { bullet: { type: 'number' } } },
    { text: '  • 理由: 海外展開準備、在日外国人ユーザー対応', options: { bullet: false } },
    { text: '  • 想定比率: PayPay 80% / PayPal 20%', options: { bullet: false } },
    { text: '  • 平均手数料: 約2.6%（加重平均）', options: { bullet: false } }
  ];
  
  slide.addText(implementationStrategy2, {
    x: 1, y: 4.3, w: 8, h: 1,
    fontSize: 13,
    color: '333333',
    lineSpacing: 20
  });
  
  slide.addShape(pptx.ShapeType.rect, {
    x: 1.5, y: 5.5, w: 7, h: 0.7,
    fill: { color: 'FFF3CD' },
    line: { color: 'FFC107', width: 2 }
  });
  
  slide.addText('💰 費用削減効果: PayPal単独に比べ、年間約30~40万円の手数料削減が可能', {
    x: 1.7, y: 5.6, w: 6.6, h: 0.5,
    fontSize: 13,
    bold: true,
    color: '856404',
    align: 'center',
    valign: 'middle'
  });

  // スライド27: 更新された固定費用まとめ
  slide = pptx.addSlide();
  slide.background = bgGradient;
  slide.addText('更新版: 月間固定費用まとめ', {
    x: 0.5, y: 0.4, w: 9, h: 0.6,
    ...styles.heading1
  });
  
  slide.addText('詳細調査後の最終固定費用', {
    x: 0.5, y: 1.1, w: 9, h: 0.4,
    fontSize: 16,
    color: '666666',
    align: 'center'
  });
  
  const finalFixedCostTable = [
    ['項目', 'プラン/詳細', '月額費用（円）', '年間費用（円）', '備考'],
    ['ホスティング', 'Netlify Pro', '2,850', '34,200', '月125,000関数コール含む'],
    ['データベース', 'Supabase Pro', '3,750', '45,000', 'ベクトル検索対応'],
    ['ドメイン', '.com (Cloudflare)', '150', '1,800', '年$12を月割'],
    ['決済処理', 'PayPay（低率プラン）', '1,980', '23,760', '手数料1.98%'],
    ['合計', '-', '8,730', '104,760', '最小運営費用']
  ];
  
  slide.addTable(finalFixedCostTable, {
    x: 0.5, y: 1.7, w: 9, h: 2.8,
    fontSize: 12,
    border: { pt: 1, color: 'CCCCCC' },
    fill: { color: 'FFFFFF' },
    color: '333333',
    align: 'center',
    valign: 'middle',
    rowH: 0.56
  });
  
  slide.addText('重要な変更点', {
    x: 0.8, y: 4.7, w: 8.4, h: 0.4,
    ...styles.heading3
  });
  
  const finalNotes = [
    { text: 'ドメイン費用を詳細化: Cloudflareの年$12プランを採用（月150円）', options: { bullet: true } },
    { text: '決済サービスをPayPayに確定: 月額1,980円 + 変動手数料1.98%', options: { bullet: true } },
    { text: '月間固定費は8,730円で変わらず（前回分析と一致）', options: { bullet: true } },
    { text: 'PayPal併用時は固定費0円だが変動手数料が3.6%に上昇', options: { bullet: true } }
  ];
  
  slide.addText(finalNotes, {
    x: 1, y: 5.2, w: 8, h: 1.2,
    fontSize: 12,
    color: '333333',
    lineSpacing: 20
  });

  // スライド28: 月間総費用まとめ（最重要）
  slide = pptx.addSlide();
  slide.background = bgGradient;
  slide.addText('【最重要】月間総費用まとめ', {
    x: 0.5, y: 0.4, w: 9, h: 0.6,
    ...styles.heading1
  });
  
  slide.addText('ユーザー数別の月間運営費用（全て込み）', {
    x: 0.5, y: 1.1, w: 9, h: 0.4,
    fontSize: 16,
    color: '666666',
    align: 'center'
  });
  
  const totalCostSummary = [
    ['ユーザー数', 'シナリオ', '月間総費用', '内訳', '備考'],
    ['0名', '未稼働', '8,730円', '固定費のみ', 'サービス維持の最小コスト'],
    ['30名', '全員無料', '19,611円', '固定費 8,730円\n+ LLM 10,881円', '初期ローンチ段階'],
    ['50名', '全員無料', '26,865円', '固定費 8,730円\n+ LLM 18,135円', '無料ユーザーのみ'],
    ['100名', '30%活性\n(有料化)', '172,974円', '固定費 8,730円\n+ 変動費 164,244円', '収益 176万円\n純利益 159万円'],
    ['500名', '30%活性\n(有料化)', '832,230円', '固定費 8,730円\n+ 変動費 823,500円', '収益 880万円\n純利益 797万円'],
    ['1,000名', '30%活性\n(有料化)', '1,655,520円', '固定費 8,730円\n+ 変動費 1,646,790円', '収益 1,760万円\n純利益 1,594万円'],
    ['10,000名', '30%活性\n(有料化)', '16,477,230円', '固定費 8,730円\n+ 変動費 16,468,500円', '収益 1億7,595万円\n純利益 1億5,947万円']
  ];
  
  slide.addTable(totalCostSummary, {
    x: 0.3, y: 1.7, w: 9.4, h: 4,
    fontSize: 10,
    border: { pt: 1, color: 'CCCCCC' },
    fill: { color: 'FFFFFF' },
    color: '333333',
    align: 'center',
    valign: 'middle',
    rowH: 0.5
  });
  
  slide.addShape(pptx.ShapeType.rect, {
    x: 0.8, y: 5.9, w: 8.4, h: 0.4,
    fill: { color: 'C00000' }
  });
  
  slide.addText('⚠️ 注意: 変動費には LLM費用・Netlify超過分・決済手数料が全て含まれます', {
    x: 0.9, y: 5.95, w: 8.2, h: 0.3,
    fontSize: 11,
    bold: true,
    color: 'FFFFFF',
    align: 'center',
    valign: 'middle'
  });

  // スライド29: 費用構成比の可視化
  slide = pptx.addSlide();
  slide.background = bgGradient;
  slide.addText('費用構成比の可視化（1,000名ユーザー基準）', {
    x: 0.5, y: 0.4, w: 9, h: 0.6,
    ...styles.heading1
  });
  
  slide.addText('月間総費用: 1,655,520円の内訳', {
    x: 0.5, y: 1.1, w: 9, h: 0.4,
    fontSize: 18,
    bold: true,
    color: '1F4788',
    align: 'center'
  });
  
  const costBreakdownDetailed = [
    ['費用項目', '月額（円）', '構成比', '年間費用（円）', '最適化可能性'],
    ['LLM - 要約 (Pro)', '789,308', '47.7%', '9,471,696', '✅ 高（Flashへ変更）'],
    ['決済手数料', '633,420', '38.3%', '7,601,040', '⚠️ 中（PayPay交渉）'],
    ['LLM - チャット (Flash)', '151,826', '9.2%', '1,821,912', '❌ 低（既に最適）'],
    ['Netlify 超過分', '70,350', '4.2%', '844,200', '✅ 高（AWS移行）'],
    ['Supabase Pro', '3,750', '0.2%', '45,000', '❌ 低（必須）'],
    ['Netlify 基本', '2,850', '0.2%', '34,200', '⚠️ 中（AWS移行時）'],
    ['PayPay 固定費', '1,980', '0.1%', '23,760', '❌ 低（必要経費）'],
    ['Embedding', '1,872', '0.1%', '22,464', '❌ 低（微々たる額）'],
    ['ドメイン', '150', '0.01%', '1,800', '❌ 低（必須）'],
    ['合計', '1,655,520', '100.0%', '19,866,240', '-']
  ];
  
  slide.addTable(costBreakdownDetailed, {
    x: 0.4, y: 1.7, w: 9.2, h: 4.5,
    fontSize: 10,
    border: { pt: 1, color: 'CCCCCC' },
    fill: { color: 'FFFFFF' },
    color: '333333',
    align: 'center',
    valign: 'middle',
    rowH: 0.45
  });

  // スライド30: 実用的な費用シナリオ
  slide = pptx.addSlide();
  slide.background = bgGradient;
  slide.addText('実用的な費用シナリオ', {
    x: 0.5, y: 0.4, w: 9, h: 0.6,
    ...styles.heading1
  });
  
  slide.addShape(pptx.ShapeType.rect, {
    x: 0.8, y: 1.1, w: 8.4, h: 1.5,
    fill: { color: 'FFEBEE' },
    line: { color: 'F44336', width: 2 }
  });
  
  slide.addText('❶ 初期段階（0～100名）: 月2～17万円の投資期間', {
    x: 1, y: 1.3, w: 8, h: 0.3,
    fontSize: 15,
    bold: true,
    color: 'C62828'
  });
  
  slide.addText('50名無料ユーザー: 月2.7万円の赤字\n100名（30%有料化）: 月17万円の費用だが、収益176万円で黒字転換\n→ この期間を最短で通過することが最重要課題', {
    x: 1.2, y: 1.7, w: 7.6, h: 0.8,
    fontSize: 12,
    color: '333333'
  });
  
  slide.addShape(pptx.ShapeType.rect, {
    x: 0.8, y: 2.8, w: 8.4, h: 1.5,
    fill: { color: 'E8F5E9' },
    line: { color: '4CAF50', width: 2 }
  });
  
  slide.addText('❷ 成長段階（100～1,000名）: 月17～166万円', {
    x: 1, y: 3, w: 8, h: 0.3,
    fontSize: 15,
    bold: true,
    color: '2E7D32'
  });
  
  slide.addText('500名: 月83万円の費用、収益880万円、純利益797万円\n1,000名: 月166万円の費用、収益1,760万円、純利益1,594万円\n→ 安定的な利益率90%を維持しながら急成長', {
    x: 1.2, y: 3.4, w: 7.6, h: 0.8,
    fontSize: 12,
    color: '333333'
  });
  
  slide.addShape(pptx.ShapeType.rect, {
    x: 0.8, y: 4.5, w: 8.4, h: 1.5,
    fill: { color: 'E3F2FD' },
    line: { color: '2196F3', width: 2 }
  });
  
  slide.addText('❸ スケール段階（1,000～10,000名）: 月166～1,648万円', {
    x: 1, y: 4.7, w: 8, h: 0.3,
    fontSize: 15,
    bold: true,
    color: '1565C0'
  });
  
  slide.addText('10,000名: 月1,648万円の費用、収益1億7,595万円、純利益1億5,947万円\n→ 費用最適化（要約Flash化、AWS移行）で月1,000万円以上削減可能\n→ 最適化後の月間費用: 約700～800万円（純利益2億円超）', {
    x: 1.2, y: 5.1, w: 7.6, h: 0.8,
    fontSize: 12,
    color: '333333'
  });

  // ファイル保存
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
  const pptPath = join(projectRoot, `namos-chat-費用分析報告書_${timestamp}.pptx`);
  
  await pptx.writeFile({ fileName: pptPath });
  
  console.log(`\n✅ PPT作成完了!`);
  console.log(`📄 ファイル: ${pptPath}`);
  console.log(`📊 総スライド数: ${pptx.slides.length}枚`);
}

createCostAnalysisPPT().catch(console.error);


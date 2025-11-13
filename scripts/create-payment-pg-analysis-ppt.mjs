import PptxGenJS from 'pptxgenjs';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pptx = new PptxGenJS();

// プレゼンテーション設定
pptx.author = 'namos-chat-v1';
pptx.title = '日本AI成人コンテンツ決済PG総合分析';
pptx.subject = '決済代行会社調査レポート';

// スライドサイズ設定
pptx.defineLayout({ name: 'A4', width: 10, height: 7.5 });
pptx.layout = 'A4';

// 色定義
const colors = {
  primary: '2C3E50',
  secondary: '3498DB',
  accent: 'E74C3C',
  success: '27AE60',
  warning: 'F39C12',
  danger: 'C0392B',
  background: 'ECF0F1',
  text: '2C3E50',
  lightGray: 'BDC3C7',
  white: 'FFFFFF'
};

// 共通スタイル
const styles = {
  title: {
    fontSize: 32,
    bold: true,
    color: colors.primary,
    align: 'center'
  },
  subtitle: {
    fontSize: 18,
    color: colors.secondary,
    align: 'center'
  },
  heading1: {
    fontSize: 28,
    bold: true,
    color: colors.primary
  },
  heading2: {
    fontSize: 24,
    bold: true,
    color: colors.secondary
  },
  heading3: {
    fontSize: 20,
    bold: true,
    color: colors.text
  },
  body: {
    fontSize: 14,
    color: colors.text,
    lineSpacing: 24
  },
  smallText: {
    fontSize: 11,
    color: colors.text
  },
  bullet: {
    fontSize: 14,
    color: colors.text,
    bullet: true,
    lineSpacing: 20
  }
};

// ヘッダー追加関数
function addHeader(slide, text) {
  slide.addText(text, {
    x: 0.5, y: 0.3, w: 9, h: 0.5,
    fontSize: 14,
    bold: true,
    color: colors.primary,
    align: 'left'
  });
}

// 1. 表紙
const slide1 = pptx.addSlide();
slide1.background = { color: colors.primary };
slide1.addText('日本AI成人コンテンツ\n決済PG総合分析', {
  x: 0.5, y: 2, w: 9, h: 1.5,
  fontSize: 40,
  bold: true,
  color: colors.white,
  align: 'center'
});
slide1.addText('決済代行会社調査レポート', {
  x: 0.5, y: 3.8, w: 9, h: 0.5,
  fontSize: 20,
  color: colors.background,
  align: 'center'
});
slide1.addText('【機密】', {
  x: 0.5, y: 6.5, w: 9, h: 0.5,
  fontSize: 16,
  bold: true,
  color: colors.accent,
  align: 'center'
});

// 2. エグゼクティブサマリー (1/2)
const slide2 = pptx.addSlide();
addHeader(slide2, 'エグゼクティブサマリー (1/2)');
slide2.addText('現状認識', {
  x: 0.5, y: 1, w: 9, h: 0.4,
  ...styles.heading2
});
const summary1 = [
  { text: '「AIアダルトコンテンツ」は超ハイリスクカテゴリー', options: { bullet: true, breakLine: true } },
  { text: 'アダルト自体が最高審査基準 + AI生成という新リスク', options: { bullet: { indent: 20 }, breakLine: true } },
  { text: 'FANZAもAI生成コンテンツを隔離対象に指定', options: { bullet: { indent: 20 }, breakLine: true } },
  { text: '主要な課題', options: { bullet: true, breakLine: true } },
  { text: '技術連携ではなく「審査通過」が唯一の関門', options: { bullet: { indent: 20 }, breakLine: true } },
  { text: 'ディープフェイク、著作権、詐欺的コンテンツのリスク', options: { bullet: { indent: 20 }, breakLine: true } },
  { text: '主要PG（GMO, VeriTrans）は即時拒否が予想される', options: { bullet: { indent: 20 } } }
];
slide2.addText(summary1, {
  x: 0.5, y: 1.5, w: 9, h: 2.5,
  fontSize: 14,
  color: colors.text,
  lineSpacing: 22
});

slide2.addText('市場の現実', {
  x: 0.5, y: 4.2, w: 9, h: 0.4,
  ...styles.heading2
});
const summary2 = [
  { text: 'Visa/Mastercardが成人向け決済を相次いで制限', options: { bullet: true, breakLine: true } },
  { text: 'AI生成が「R18」とは別の新リスクカテゴリーとして浮上', options: { bullet: true, breakLine: true } },
  { text: '既存R18プラットフォームでさえAI対応に苦慮', options: { bullet: true } }
];
slide2.addText(summary2, {
  x: 0.5, y: 4.7, w: 9, h: 1.5,
  fontSize: 14,
  color: colors.text,
  lineSpacing: 22
});

// 3. エグゼクティブサマリー (2/2)
const slide3 = pptx.addSlide();
addHeader(slide3, 'エグゼクティブサマリー (2/2)');
slide3.addText('戦略的提言', {
  x: 0.5, y: 1, w: 9, h: 0.4,
  ...styles.heading2
});
const strategy = [
  { text: '最も実現可能な経路', options: { bullet: true, breakLine: true } },
  { text: 'ハイリスク専門PG（AXES Payment）を活用', options: { bullet: { indent: 20 }, breakLine: true } },
  { text: 'R18特化電子マネー（BitCash, C-CHECK）を優先導入', options: { bullet: { indent: 20 }, breakLine: true } },
  { text: 'キャリア決済は次善策（審査困難）', options: { bullet: { indent: 20 }, breakLine: true } },
  { text: '導入禁止対象', options: { bullet: true, breakLine: true } },
  { text: 'QR決済（PayPay, LINE Payなど）は絶対不可', options: { bullet: { indent: 20 }, breakLine: true } },
  { text: '主要PG（GMO, VeriTrans）への申請は時間の無駄', options: { bullet: { indent: 20 } } }
];
slide3.addText(strategy, {
  x: 0.5, y: 1.5, w: 9, h: 2.8,
  fontSize: 14,
  color: colors.text,
  lineSpacing: 22
});

slide3.addText('費用と期間の予想', {
  x: 0.5, y: 4.5, w: 9, h: 0.4,
  ...styles.heading2
});
const cost = [
  { text: '初期費用：50,000～300,000円（一般の「0円」は不適用）', options: { bullet: true, breakLine: true } },
  { text: '決済手数料：5～12%（ハイリスクプレミアム）', options: { bullet: true, breakLine: true } },
  { text: '審査期間：数週間～数ヶ月（最短1週間は非現実的）', options: { bullet: true } }
];
slide3.addText(cost, {
  x: 0.5, y: 5, w: 9, h: 1.5,
  fontSize: 14,
  color: colors.text,
  lineSpacing: 22
});

// 4. 目次
const slide4 = pptx.addSlide();
addHeader(slide4, '目次');
const toc = [
  { text: '第1部：ハイリスク決済代行会社（PG）の特定と分析', options: { bullet: true, breakLine: true } },
  { text: '第2部：主要PG別 日本国内代替決済（DNC）提供状況', options: { bullet: true, breakLine: true } },
  { text: '第3部：DNC決済手段のAIアダルトコンテンツポリシー', options: { bullet: true, breakLine: true } },
  { text: '第4部：審査基準および初期費用', options: { bullet: true, breakLine: true } },
  { text: '第5部：申込手続きおよび技術連携', options: { bullet: true, breakLine: true } },
  { text: '第6部：最終実行可能性の評価と勧告', options: { bullet: true, breakLine: true } },
  { text: '第7部：国内成人向けコンテンツ対応PG詳細分析', options: { bullet: true, breakLine: true } },
  { text: '第8部：総合戦略提言', options: { bullet: true } }
];
slide4.addText(toc, {
  x: 1, y: 1.2, w: 8, h: 5,
  fontSize: 16,
  color: colors.text,
  lineSpacing: 32
});

// 5. 第1部：AXES Payment
const slide5 = pptx.addSlide();
addHeader(slide5, '第1部：ハイリスクPG分析 (1/4) - AXES Payment');
slide5.addText('AXES Payment（株式会社AXES Payment）', {
  x: 0.5, y: 1, w: 9, h: 0.4,
  ...styles.heading2
});
slide5.addText('第1候補', {
  x: 8, y: 1,  w: 1.5, h: 0.4,
  fontSize: 16,
  bold: true,
  color: colors.white,
  fill: { color: colors.success },
  align: 'center'
});

const axes = [
  { text: '概要', options: { bullet: true, breakLine: true } },
  { text: 'ハイリスクカテゴリー加盟店を専門的に扱うPG', options: { bullet: { indent: 20 }, breakLine: true } },
  { text: '提供サービス', options: { bullet: true, breakLine: true } },
  { text: '3大キャリア決済（ソフトバンク、ドコモ、au）', options: { bullet: { indent: 20 }, breakLine: true } },
  { text: 'PayPayサポート', options: { bullet: { indent: 20 }, breakLine: true } },
  { text: '電子マネー決済（BitCash対応可能性）', options: { bullet: { indent: 20 }, breakLine: true } },
  { text: '強み', options: { bullet: true, breakLine: true } },
  { text: 'ハイリスク加盟店向け構造化審査プロセス', options: { bullet: { indent: 20 }, breakLine: true } },
  { text: 'ヒアリング段階を含む手動レビュー体制', options: { bullet: { indent: 20 }, breakLine: true } },
  { text: '法人書類提出を明確に要求', options: { bullet: { indent: 20 }, breakLine: true } },
  { text: '重要確認事項', options: { bullet: true, breakLine: true } },
  { text: 'BitCash/C-CHECK取扱可否を「ヒアリング」で必ず確認', options: { bullet: { indent: 20 }, color: colors.accent, bold: true } }
];
slide5.addText(axes, {
  x: 0.5, y: 1.6, w: 9, h: 5,
  fontSize: 13,
  color: colors.text,
  lineSpacing: 20
});

// 6. 第1部：GMO Payment Gateway
const slide6 = pptx.addSlide();
addHeader(slide6, '第1部：ハイリスクPG分析 (2/4) - GMO Payment Gateway');
slide6.addText('GMO Payment Gateway', {
  x: 0.5, y: 1, w: 9, h: 0.4,
  ...styles.heading2
});
slide6.addText('不推奨', {
  x: 8, y: 1, w: 1.5, h: 0.4,
  fontSize: 16,
  bold: true,
  color: colors.white,
  fill: { color: colors.danger },
  align: 'center'
});

const gmo = [
  { text: '概要', options: { bullet: true, breakLine: true } },
  { text: '日本最大級の総合PG', options: { bullet: { indent: 20 }, breakLine: true } },
  { text: 'スタートアップから大企業まで幅広い市場対象', options: { bullet: { indent: 20 }, breakLine: true } },
  { text: '提供サービス', options: { bullet: true, breakLine: true } },
  { text: 'd払い、PayPay、楽天ペイ', options: { bullet: { indent: 20 }, breakLine: true } },
  { text: 'WebMoneyを提供', options: { bullet: { indent: 20 }, breakLine: true } },
  { text: '決定的な欠落', options: { bullet: true, breakLine: true } },
  { text: 'BitCashとC-CHECKが公式リストに無い', options: { bullet: { indent: 20 }, color: colors.danger, bold: true, breakLine: true } },
  { text: 'R18デジタルコンテンツ市場を積極誘致していない証拠', options: { bullet: { indent: 20 }, breakLine: true } },
  { text: '結論', options: { bullet: true, breakLine: true } },
  { text: 'AIアダルトチャットの審査拒否確率が非常に高い', options: { bullet: { indent: 20 }, color: colors.danger, bold: true, breakLine: true } },
  { text: '申請自体が時間の無駄', options: { bullet: { indent: 20 }, color: colors.danger } }
];
slide6.addText(gmo, {
  x: 0.5, y: 1.6, w: 9, h: 5,
  fontSize: 13,
  color: colors.text,
  lineSpacing: 20
});

// 7. 第1部：VeriTrans
const slide7 = pptx.addSlide();
addHeader(slide7, '第1部：ハイリスクPG分析 (3/4) - VeriTrans');
slide7.addText('VeriTrans（株式会社DGフィナンシャルテクノロジー）', {
  x: 0.5, y: 1, w: 9, h: 0.4,
  ...styles.heading2
});
slide7.addText('不推奨', {
  x: 8, y: 1, w: 1.5, h: 0.4,
  fontSize: 16,
  bold: true,
  color: colors.white,
  fill: { color: colors.danger },
  align: 'center'
});

const veritrans = [
  { text: '概要', options: { bullet: true, breakLine: true } },
  { text: '信頼性重視の大手総合PG', options: { bullet: { indent: 20 }, breakLine: true } },
  { text: 'VeriTrans4Gソリューション', options: { bullet: { indent: 20 }, breakLine: true } },
  { text: '提供サービス', options: { bullet: true, breakLine: true } },
  { text: 'PayPay、楽天ペイなど多様なID決済', options: { bullet: { indent: 20 }, breakLine: true } },
  { text: '3大キャリア決済をサポート', options: { bullet: { indent: 20 }, breakLine: true } },
  { text: 'ブランド戦略', options: { bullet: true, breakLine: true } },
  { text: '「初期費用0円～」は低リスク加盟店向けプロモーション', options: { bullet: { indent: 20 }, breakLine: true } },
  { text: 'セキュリティ、信頼性、規模を強調', options: { bullet: { indent: 20 }, breakLine: true } },
  { text: 'ブランドリスク回避の傾向', options: { bullet: { indent: 20 }, breakLine: true } },
  { text: '結論', options: { bullet: true, breakLine: true } },
  { text: '技術的には可能だが、AIアダルトチャット承認の可能性ほぼ無し', options: { bullet: { indent: 20 }, color: colors.danger } }
];
slide7.addText(veritrans, {
  x: 0.5, y: 1.6, w: 9, h: 5,
  fontSize: 13,
  color: colors.text,
  lineSpacing: 20
});

// 8. 第1部：Metaps Payment
const slide8 = pptx.addSlide();
addHeader(slide8, '第1部：ハイリスクPG分析 (4/4) - Metaps Payment');
slide8.addText('Metaps Payment（メタップスペイメント）', {
  x: 0.5, y: 1, w: 9, h: 0.4,
  ...styles.heading2
});
slide8.addText('対象外', {
  x: 8, y: 1, w: 1.5, h: 0.4,
  fontSize: 16,
  bold: true,
  color: colors.white,
  fill: { color: colors.lightGray },
  align: 'center'
});

const metaps = [
  { text: '概要', options: { bullet: true, breakLine: true } },
  { text: '特定産業群に特化したPG', options: { bullet: { indent: 20 }, breakLine: true } },
  { text: 'チケッティング、不動産など「ピンポイントな業界」重視', options: { bullet: { indent: 20 }, breakLine: true } },
  { text: '分析結果', options: { bullet: true, breakLine: true } },
  { text: 'ハイリスクデジタルコンテンツの取扱情報なし', options: { bullet: { indent: 20 }, breakLine: true } },
  { text: 'R18電子マネー専門取扱の証拠なし', options: { bullet: { indent: 20 }, breakLine: true } },
  { text: '結論', options: { bullet: true, breakLine: true } },
  { text: '本プロジェクトとの関連性が最も低い', options: { bullet: { indent: 20 }, breakLine: true } },
  { text: '候補群から除外が合理的', options: { bullet: { indent: 20 } } }
];
slide8.addText(metaps, {
  x: 0.5, y: 1.6, w: 9, h: 3.5,
  fontSize: 13,
  color: colors.text,
  lineSpacing: 20
});

// 9. 第2部：DNC提供状況マトリックス
const slide9 = pptx.addSlide();
addHeader(slide9, '第2部：主要PG別 DNC決済手段 提供状況マトリックス');

const tableRows = [
  [
    { text: '決済手段', options: { bold: true, fill: { color: colors.secondary }, color: colors.white } },
    { text: 'カテゴリー', options: { bold: true, fill: { color: colors.secondary }, color: colors.white } },
    { text: 'AXES Payment', options: { bold: true, fill: { color: colors.secondary }, color: colors.white } },
    { text: 'GMO-PG', options: { bold: true, fill: { color: colors.secondary }, color: colors.white } },
    { text: 'VeriTrans', options: { bold: true, fill: { color: colors.secondary }, color: colors.white } }
  ],
  ['d払い', 'キャリア決済', '✅ 確認', '✅ 確認', '✅ 確認'],
  ['auかんたん決済', 'キャリア決済', '✅ 確認', '推定', '✅ 確認'],
  ['SBまとめて支払い', 'キャリア決済', '✅ 確認', '推定', '✅ 確認'],
  [
    { text: 'BitCash', options: { bold: true, color: colors.accent } },
    { text: '電子マネー (R18)', options: { bold: true, color: colors.accent } },
    { text: '⚠️ 要問合せ', options: { bold: true, color: colors.warning } },
    { text: '❌ 無し', options: { bold: true, color: colors.danger } },
    '未確認'
  ],
  [
    { text: 'C-CHECK', options: { bold: true, color: colors.accent } },
    { text: '電子マネー (R18)', options: { bold: true, color: colors.accent } },
    { text: '⚠️ 要問合せ', options: { bold: true, color: colors.warning } },
    { text: '❌ 無し', options: { bold: true, color: colors.danger } },
    '未確認'
  ],
  ['WebMoney', '電子マネー', '未確認', '✅ 確認', '未確認'],
  ['PayPay', 'QR決済', '✅ 確認', '✅ 確認', '✅ 確認'],
  ['楽天ペイ', 'QR決済', '未確認', '✅ 確認', '✅ 確認']
];

slide9.addTable(tableRows, {
  x: 0.3, y: 1.2, w: 9.4, h: 5,
  fontSize: 11,
  border: { pt: 1, color: colors.lightGray },
  align: 'center',
  valign: 'middle',
  colW: [1.5, 1.5, 2, 2, 2.4]
});

slide9.addText('❗ BitCash/C-CHECKはR18コンテンツ決済の核心手段', {
  x: 0.5, y: 6.5, w: 9, h: 0.5,
  fontSize: 13,
  bold: true,
  color: colors.accent,
  align: 'center'
});

// 10. 第3部：既存R18コンテンツ決済市場の慣行
const slide10 = pptx.addSlide();
addHeader(slide10, '第3部：既存R18コンテンツ決済市場の慣行');
slide10.addText('日本のR18コンテンツ決済の現状', {
  x: 0.5, y: 1, w: 9, h: 0.4,
  ...styles.heading2
});

const r18market = [
  { text: 'R18特化型', options: { bullet: true, breakLine: true } },
  { text: 'BitCash、C-CHECK：R18決済を主力ビジネスモデルとする', options: { bullet: { indent: 20 }, breakLine: true } },
  { text: '成人向けコンテンツ市場で確立された決済手段', options: { bullet: { indent: 20 }, breakLine: true } },
  { text: '条件付き許容', options: { bullet: true, breakLine: true } },
  { text: 'キャリア決済：厳格な「年齢確認」を条件に許可', options: { bullet: { indent: 20 }, breakLine: true } },
  { text: 'DLsiteなど大手プラットフォームで実績あり', options: { bullet: { indent: 20 }, breakLine: true } },
  { text: 'R18禁止', options: { bullet: true, breakLine: true } },
  { text: 'クレジットカード（海外ブランド）：厳しく制限', options: { bullet: { indent: 20 }, breakLine: true } },
  { text: 'PayPay、LINE Pay：R18コンテンツ厳しく禁止', options: { bullet: { indent: 20 }, breakLine: true } },
  { text: 'クリーンなブランドイメージを重視', options: { bullet: { indent: 20 } } }
];
slide10.addText(r18market, {
  x: 0.5, y: 1.6, w: 9, h: 5,
  fontSize: 13,
  color: colors.text,
  lineSpacing: 20
});

// 11. 第3部：AI生成コンテンツという新リスク
const slide11 = pptx.addSlide();
addHeader(slide11, '第3部：「AI生成コンテンツ」という新たなリスク');
slide11.addText('市場の重大な変化', {
  x: 0.5, y: 1, w: 9, h: 0.4,
  ...styles.heading2
});

slide11.addText('FANZAが「AI生成」同人作品を隔離対象に指定', {
  x: 0.5, y: 1.6, w: 9, h: 0.4,
  fontSize: 16,
  bold: true,
  color: colors.accent,
  align: 'center',
  fill: { color: colors.background }
});

const airisk = [
  { text: 'AI生成が「R18」とは別の新リスクカテゴリーとして浮上', options: { bullet: true, breakLine: true } },
  { text: '決済パートナーが懸念する3大リスク', options: { bullet: true, breakLine: true } },
  { text: '①非同意の画像生成（ディープフェイク）', options: { bullet: { indent: 20 }, breakLine: true } },
  { text: '実在人物を基にしたアダルトコンテンツ生成の法的責任', options: { bullet: { indent: 40 }, breakLine: true } },
  { text: '②著作権侵害', options: { bullet: { indent: 20 }, breakLine: true } },
  { text: 'AI学習データの著作権問題', options: { bullet: { indent: 40 }, breakLine: true } },
  { text: '③詐欺およびスパム', options: { bullet: { indent: 20 }, breakLine: true } },
  { text: '低品質AI生成物の大量流通によるプラットフォーム信頼性低下', options: { bullet: { indent: 40 }, breakLine: true } },
  { text: '詐欺的取引への繋がり', options: { bullet: { indent: 40 }, breakLine: true } },
  { text: '結論', options: { bullet: true, breakLine: true } },
  { text: 'FANZAの判断は道徳的ではなくビジネス・法務上のリスク管理', options: { bullet: { indent: 20 }, color: colors.accent, bold: true } }
];
slide11.addText(airisk, {
  x: 0.5, y: 2.2, w: 9, h: 4,
  fontSize: 13,
  color: colors.text,
  lineSpacing: 18
});

// 12. 第3部：キャリア決済のAIポリシー
const slide12 = pptx.addSlide();
addHeader(slide12, '第3部：決済手段別AIアダルトポリシー (1/3) - キャリア決済');
slide12.addText('キャリア決済（d払い、au、SoftBank）', {
  x: 0.5, y: 1, w: 9, h: 0.4,
  ...styles.heading2
});
slide12.addText('審査困難', {
  x: 8, y: 1, w: 1.5, h: 0.4,
  fontSize: 16,
  bold: true,
  color: colors.white,
  fill: { color: colors.warning },
  align: 'center'
});

const carrier = [
  { text: 'R18ポリシー', options: { bullet: true, breakLine: true } },
  { text: '「年齢確認」を前提に許容', options: { bullet: { indent: 20 }, breakLine: true } },
  { text: 'DLsiteなど大手プラットフォームで実績', options: { bullet: { indent: 20 }, breakLine: true } },
  { text: 'AIポリシー（隠れたリスク）', options: { bullet: true, breakLine: true } },
  { text: 'AppleのApp Store決済と連携', options: { bullet: { indent: 20 }, breakLine: true } },
  { text: 'Appleガイドライン：「AI生成コンテンツ」を「詐欺的表現」「露骨な性的コンテンツ」と同列に禁止', options: { bullet: { indent: 20 }, color: colors.danger, bold: true, breakLine: true } },
  { text: 'グローバルプラットフォームのガイドラインに大きく影響される', options: { bullet: { indent: 20 }, breakLine: true } },
  { text: '結論', options: { bullet: true, breakLine: true } },
  { text: 'キャリア各社は「AIアダルトチャット」を高リスクと見なす', options: { bullet: { indent: 20 }, color: colors.danger, breakLine: true } },
  { text: '新規加盟店の審査通過可能性は非常に低い', options: { bullet: { indent: 20 }, color: colors.danger, bold: true } }
];
slide12.addText(carrier, {
  x: 0.5, y: 1.6, w: 9, h: 5,
  fontSize: 13,
  color: colors.text,
  lineSpacing: 20
});

// 13. 第3部：電子マネーのAIポリシー
const slide13 = pptx.addSlide();
addHeader(slide13, '第3部：決済手段別AIアダルトポリシー (2/3) - 電子マネー');
slide13.addText('プリペイド型電子マネー（BitCash、C-CHECK）', {
  x: 0.5, y: 1, w: 9, h: 0.4,
  ...styles.heading2
});
slide13.addText('最有力', {
  x: 8, y: 1, w: 1.5, h: 0.4,
  fontSize: 16,
  bold: true,
  color: colors.white,
  fill: { color: colors.success },
  align: 'center'
});

const emoney = [
  { text: 'R18ポリシー', options: { bullet: true, breakLine: true } },
  { text: 'R18決済が存在理由であり主力市場', options: { bullet: { indent: 20 }, bold: true, breakLine: true } },
  { text: '成人向けコンテンツに完全特化', options: { bullet: { indent: 20 }, breakLine: true } },
  { text: 'AIポリシー', options: { bullet: true, breakLine: true } },
  { text: 'FANZAの先例を注視しているが、キャリア決済より遥かに寛容', options: { bullet: { indent: 20 }, breakLine: true } },
  { text: 'AI理由だけで決済停止するより、条件付き許可の可能性が高い', options: { bullet: { indent: 20 }, breakLine: true } },
  { text: '予想される条件', options: { bullet: { indent: 20 }, breakLine: true } },
  { text: 'AIによる法的責任を全て加盟店に転嫁', options: { bullet: { indent: 40 }, breakLine: true } },
  { text: '厳格なコンテンツ監視を要求', options: { bullet: { indent: 40 }, breakLine: true } },
  { text: '結論', options: { bullet: true, breakLine: true } },
  { text: 'AIアダルトチャットサービスが導入できる最も現実的かつ唯一の決済手段', options: { bullet: { indent: 20 }, color: colors.success, bold: true, fontSize: 14 } }
];
slide13.addText(emoney, {
  x: 0.5, y: 1.6, w: 9, h: 5,
  fontSize: 13,
  color: colors.text,
  lineSpacing: 20
});

// 14. 第3部：QR決済のAIポリシー
const slide14 = pptx.addSlide();
addHeader(slide14, '第3部：決済手段別AIアダルトポリシー (3/3) - QR決済');
slide14.addText('QR・スマホ決済（PayPay、LINE Pay、楽天ペイ）', {
  x: 0.5, y: 1, w: 9, h: 0.4,
  ...styles.heading2
});
slide14.addText('絶対不可', {
  x: 8, y: 1, w: 1.5, h: 0.4,
  fontSize: 16,
  bold: true,
  color: colors.white,
  fill: { color: colors.danger },
  align: 'center'
});

const qr = [
  { text: 'R18ポリシー', options: { bullet: true, breakLine: true } },
  { text: '厳格に禁止', options: { bullet: { indent: 20 }, bold: true, color: colors.danger, breakLine: true } },
  { text: '日常的な決済手段として「クリーン」なブランドを構築', options: { bullet: { indent: 20 }, breakLine: true } },
  { text: 'AIポリシー', options: { bullet: true, breakLine: true } },
  { text: 'R18が既に禁止されているため、AIアダルトは議論の余地なく禁止', options: { bullet: { indent: 20 }, color: colors.danger, breakLine: true } },
  { text: '結論', options: { bullet: true, breakLine: true } },
  { text: '絶対利用不可', options: { bullet: { indent: 20 }, color: colors.danger, bold: true, fontSize: 16, breakLine: true } },
  { text: 'PGへの申請自体をすべきではない', options: { bullet: { indent: 20 }, color: colors.danger, bold: true, breakLine: true } },
  { text: '申請は以下の悪影響をもたらす', options: { bullet: { indent: 20 }, breakLine: true } },
  { text: 'ビジネスモデルへの理解不足を露呈', options: { bullet: { indent: 40 }, breakLine: true } },
  { text: '他の決済手段（BitCashなど）の審査にも悪影響', options: { bullet: { indent: 40 }, breakLine: true } },
  { text: '審査時間の無駄', options: { bullet: { indent: 40 } } }
];
slide14.addText(qr, {
  x: 0.5, y: 1.6, w: 9, h: 5,
  fontSize: 13,
  color: colors.text,
  lineSpacing: 18
});

// 15. 第4部：審査基準
const slide15 = pptx.addSlide();
addHeader(slide15, '第4部：超ハイリスクカテゴリーの審査基準');
slide15.addText('PGリスク審査チームが集中検討する事項', {
  x: 0.5, y: 1, w: 9, h: 0.4,
  ...styles.heading2
});

const screening = [
  { text: '①法的遵守（特に児童/ディープフェイク）', options: { bullet: true, breakLine: true } },
  { text: 'AIが違法コンテンツを生成することを100%遮断する方法', options: { bullet: { indent: 20 }, bold: true, breakLine: true } },
  { text: '児童ポルノ、実在人物ディープフェイク対策', options: { bullet: { indent: 20 }, breakLine: true } },
  { text: '②著作権', options: { bullet: true, breakLine: true } },
  { text: 'AI学習データの著作権・肖像権問題の解決証明', options: { bullet: { indent: 20 }, breakLine: true } },
  { text: '③詐欺防止', options: { bullet: true, breakLine: true } },
  { text: 'ユーザーがAIを実在人物と誤認して詐欺被害に遭う防止策', options: { bullet: { indent: 20 }, breakLine: true } },
  { text: 'チャットサービスでは特に重要', options: { bullet: { indent: 20 }, breakLine: true } },
  { text: '④年齢確認', options: { bullet: true, breakLine: true } },
  { text: '法的に有効な年齢確認システムの実装', options: { bullet: { indent: 20 }, breakLine: true } },
  { text: '⑤企業実体', options: { bullet: true, breakLine: true } },
  { text: '日本法人としての明確な実体', options: { bullet: { indent: 20 } } }
];
slide15.addText(screening, {
  x: 0.5, y: 1.5, w: 9, h: 5.5,
  fontSize: 13,
  color: colors.text,
  lineSpacing: 20
});

// 16. 第4部：手数料構造比較
const slide16 = pptx.addSlide();
addHeader(slide16, '第4部：予想手数料構造の比較');

const feeRows = [
  [
    { text: '手数料項目', options: { bold: true, fill: { color: colors.secondary }, color: colors.white } },
    { text: '低リスク標準加盟店\n(例: VeriTrans)', options: { bold: true, fill: { color: colors.secondary }, color: colors.white } },
    { text: 'ハイリスク「AIアダルト」加盟店\n(予想値)', options: { bold: true, fill: { color: colors.accent }, color: colors.white } }
  ],
  [
    { text: '初期費用', options: { bold: true } },
    '0円～',
    { text: '50,000～300,000円', options: { bold: true, color: colors.accent } }
  ],
  [
    { text: '月額費用', options: { bold: true } },
    '0円～',
    { text: '5,000～30,000円', options: { bold: true, color: colors.accent } }
  ],
  [
    { text: '決済手数料', options: { bold: true } },
    '1.98%～3.25%',
    { text: '5.0%～12.0%', options: { bold: true, color: colors.accent } }
  ],
  [
    { text: 'トランザクション料', options: { bold: true } },
    '無料～',
    { text: '55円/件', options: { color: colors.accent } }
  ],
  [
    { text: 'チャージバック手数料', options: { bold: true } },
    '1,000円～',
    { text: '5,500円/件', options: { color: colors.accent } }
  ]
];

slide16.addTable(feeRows, {
  x: 0.5, y: 1.2, w: 9, h: 3.5,
  fontSize: 13,
  border: { pt: 1, color: colors.lightGray },
  align: 'center',
  valign: 'middle',
  colW: [3, 3, 3]
});

slide16.addText('「初期費用0円」のマーケティングは本事業に不適用', {
  x: 0.5, y: 5, w: 9, h: 0.8,
  fontSize: 14,
  bold: true,
  color: colors.accent,
  align: 'center',
  fill: { color: colors.background }
});

slide16.addText('ハイリスク加盟店は、PGが代わりに負担するリスクに対するプレミアムを支払う必要がある', {
  x: 0.5, y: 6, w: 9, h: 0.8,
  fontSize: 12,
  color: colors.text,
  align: 'center'
});

// 17. 第5部：申込手続き
const slide17 = pptx.addSlide();
addHeader(slide17, '第5部：標準申込ワークフロー（AXES Payment基準）');

const workflow = [
  { text: '①お問合せ', options: { bullet: true, breakLine: true } },
  { text: 'ウェブフォームまたは電話で一次受付', options: { bullet: { indent: 20 }, breakLine: true } },
  { text: 'ビジネスモデルを明確に伝える（隠さない）', options: { bullet: { indent: 20 }, color: colors.accent, bold: true, breakLine: true } },
  { text: '②受付・ヒアリング', options: { bullet: true, breakLine: true } },
  { text: 'PGの営業/リスク担当者との通話', options: { bullet: { indent: 20 }, breakLine: true } },
  { text: '最も重要な段階 - リスク質問への防御準備が必要', options: { bullet: { indent: 20 }, color: colors.accent, bold: true, breakLine: true } },
  { text: '③必要書類の送付', options: { bullet: true, breakLine: true } },
  { text: '法人登記簿謄本、印鑑証明書など', options: { bullet: { indent: 20 }, breakLine: true } },
  { text: '④審査', options: { bullet: true, breakLine: true } },
  { text: 'PGおよびDNC提供元（BitCash、キャリアなど）が審査', options: { bullet: { indent: 20 }, breakLine: true } },
  { text: '数週間～数ヶ月を要する', options: { bullet: { indent: 20 }, color: colors.warning, breakLine: true } },
  { text: '⑤開設契約金の振込', options: { bullet: true, breakLine: true } },
  { text: '審査承認時、初期費用を支払う', options: { bullet: { indent: 20 }, breakLine: true } },
  { text: '⑥システム接続・動作テスト', options: { bullet: true, breakLine: true } },
  { text: 'PG提供APIを通じた技術連携', options: { bullet: { indent: 20 }, breakLine: true } },
  { text: '⑦運用開始', options: { bullet: true, breakLine: true } },
  { text: 'サービスローンチ', options: { bullet: { indent: 20 } } }
];
slide17.addText(workflow, {
  x: 0.5, y: 1.2, w: 9, h: 5.8,
  fontSize: 12,
  color: colors.text,
  lineSpacing: 16
});

// 18. 第5部：必須書類チェックリスト
const slide18 = pptx.addSlide();
addHeader(slide18, '第5部：法人申込必須書類チェックリスト（KYB）');

const docRows = [
  [
    { text: '必須書類', options: { bold: true, fill: { color: colors.secondary }, color: colors.white } },
    { text: '備考', options: { bold: true, fill: { color: colors.secondary }, color: colors.white } }
  ],
  [
    { text: '履歴事項全部証明書\n(法人登記簿謄本)', options: { bold: true } },
    '発行3ヶ月以内の原本またはコピー'
  ],
  [
    { text: '印鑑証明書', options: { bold: true } },
    '発行3ヶ月以内の原本'
  ],
  [
    { text: 'PG指定申込書', options: { bold: true } },
    'PGが提供する様式'
  ],
  [
    { text: '振込先口座情報', options: { bold: true } },
    'PGからの売上入金を受ける法人口座'
  ],
  [
    { text: 'ウェブサイト/サービスURL', options: { bold: true, color: colors.accent } },
    { text: '「Coming Soon」ページは絶対不可\n全機能実装されたテストサイトが必須', options: { color: colors.accent, bold: true } }
  ],
  [
    { text: 'コンプライアンス文書', options: { bold: true, color: colors.accent } },
    { text: '利用規約、個人情報保護方針\nAIコンテンツポリシー文書', options: { color: colors.accent } }
  ]
];

slide18.addTable(docRows, {
  x: 0.5, y: 1.2, w: 9, h: 5,
  fontSize: 12,
  border: { pt: 1, color: colors.lightGray },
  valign: 'middle',
  colW: [3.5, 5.5]
});

slide18.addText('年齢確認、コンテンツフィルタリング、決済ページなど全機能が必須', {
  x: 0.5, y: 6.5, w: 9, h: 0.5,
  fontSize: 12,
  bold: true,
  color: colors.accent,
  align: 'center'
});

// 19. 第6部：推奨経路
const slide19 = pptx.addSlide();
addHeader(slide19, '第6部：最終実行可能性の評価 - 推奨経路');

const recommend = [
  { text: '法人主体', options: { bullet: true, breakLine: true } },
  { text: '完全な日本法人である必要がある', options: { bullet: { indent: 20 }, bold: true, breakLine: true } },
  { text: '全ての必要書類を準備', options: { bullet: { indent: 20 }, breakLine: true } },
  { text: '第1候補PG：AXES Payment', options: { bullet: true, breakLine: true } },
  { text: 'ハイリスク専門の審査プロセスを保有', options: { bullet: { indent: 20 }, breakLine: true } },
  { text: '必要なDNCカテゴリーを提供する唯一の候補', options: { bullet: { indent: 20 }, breakLine: true } },
  { text: 'BitCash/C-CHECK取扱可否を「ヒアリング」で必ず確認', options: { bullet: { indent: 20 }, color: colors.accent, bold: true, breakLine: true } },
  { text: '第2候補PG', options: { bullet: true, breakLine: true } },
  { text: 'R18コンテンツのみを専門とする小規模非主流PG', options: { bullet: { indent: 20 }, breakLine: true } },
  { text: 'ICPGW、SUI Credit、CREDIXなど（後述）', options: { bullet: { indent: 20 }, breakLine: true } },
  { text: '回避対象', options: { bullet: true, breakLine: true } },
  { text: 'GMO-PGとVeriTrans', options: { bullet: { indent: 20 }, color: colors.danger, bold: true, breakLine: true } },
  { text: 'R18新規事業者と方向性が異なる', options: { bullet: { indent: 20 }, breakLine: true } },
  { text: '申請時に即時拒否が確実視される', options: { bullet: { indent: 20 }, color: colors.danger } }
];
slide19.addText(recommend, {
  x: 0.5, y: 1.2, w: 9, h: 5.8,
  fontSize: 13,
  color: colors.text,
  lineSpacing: 18
});

// 20. 第6部：推奨DNC導入戦略
const slide20 = pptx.addSlide();
addHeader(slide20, '第6部：推奨DNC導入戦略');

slide20.addText('優先順位別導入戦略', {
  x: 0.5, y: 1, w: 9, h: 0.4,
  ...styles.heading2
});

const dncstrategy = [
  { text: '第1優先（必須）：BitCash & C-CHECK', options: { bullet: true, breakLine: true } },
  { text: 'この決済手段なしには運営は事実上不可能', options: { bullet: { indent: 20 }, bold: true, color: colors.accent, breakLine: true } },
  { text: 'AXESヒアリング時に真っ先に質問', options: { bullet: { indent: 20 }, breakLine: true } },
  { text: '「R18デジタルコンテンツ向けのBitCash/C-CHECK審査は可能か?」', options: { bullet: { indent: 20 }, color: colors.accent, breakLine: true } },
  { text: '第2優先（高難易度）：キャリア決済', options: { bullet: true, breakLine: true } },
  { text: '技術的にはPG各社がサポート', options: { bullet: { indent: 20 }, breakLine: true } },
  { text: 'AIリスクのためキャリア自体の審査通過が非常に困難', options: { bullet: { indent: 20 }, color: colors.warning, breakLine: true } },
  { text: 'PGが承認してもキャリアが拒否する可能性', options: { bullet: { indent: 20 }, color: colors.warning, breakLine: true } },
  { text: '導入禁止：QR決済（PayPay、LINE Payなど）', options: { bullet: true, breakLine: true } },
  { text: '申請自体をすべきではない', options: { bullet: { indent: 20 }, color: colors.danger, bold: true, breakLine: true } },
  { text: '審査時間を浪費し、他の決済手段の審査にも悪影響', options: { bullet: { indent: 20 }, color: colors.danger, breakLine: true } },
  { text: 'ビジネスモデル理解不足の印象を与える', options: { bullet: { indent: 20 }, color: colors.danger } }
];
slide20.addText(dncstrategy, {
  x: 0.5, y: 1.5, w: 9, h: 5.5,
  fontSize: 12,
  color: colors.text,
  lineSpacing: 18
});

// 21. 第6部：審査通過のためのリスク緩和戦略
const slide21 = pptx.addSlide();
addHeader(slide21, '第6部：審査通過のためのリスク緩和戦略');

slide21.addText('「リスクおよびコンプライアンス対応資料」を事前準備', {
  x: 0.5, y: 1, w: 9, h: 0.4,
  ...styles.heading2
});

const mitigation = [
  { text: '①AIコンテンツポリシー', options: { bullet: true, breakLine: true } },
  { text: 'AIが何を生成でき、何を絶対に生成できないかの明確な内部ポリシー', options: { bullet: { indent: 20 }, breakLine: true } },
  { text: '②コンテンツモデレーション', options: { bullet: true, breakLine: true } },
  { text: '違法/非同意コンテンツ生成を事前に防止する技術的フィルタリング', options: { bullet: { indent: 20 }, breakLine: true } },
  { text: '人的監視計画', options: { bullet: { indent: 20 }, breakLine: true } },
  { text: '③年齢確認', options: { bullet: true, breakLine: true } },
  { text: '法的基準を遵守する強力な年齢確認システムの実装証明', options: { bullet: { indent: 20 }, bold: true, breakLine: true } },
  { text: '④学習データポリシー', options: { bullet: true, breakLine: true } },
  { text: 'AI学習データの法的正当性に関する明確な立場', options: { bullet: { indent: 20 }, breakLine: true } },
  { text: '⑤利用規約・個人情報保護方針', options: { bullet: true, breakLine: true } },
  { text: 'リスク免責条項の明確化', options: { bullet: { indent: 20 }, breakLine: true } },
  { text: 'ユーザーがAIであることを明確に認識できる表示', options: { bullet: { indent: 20 } } }
];
slide21.addText(mitigation, {
  x: 0.5, y: 1.5, w: 9, h: 5.5,
  fontSize: 13,
  color: colors.text,
  lineSpacing: 20
});

// 22. 第7部：国内成人向けPG比較表
const slide22 = pptx.addSlide();
addHeader(slide22, '第7部：国内成人向けコンテンツ対応PG比較 (1/2)');

const pgRows = [
  [
    { text: '決済会社', options: { bold: true, fill: { color: colors.secondary }, color: colors.white, fontSize: 10 } },
    { text: '対応', options: { bold: true, fill: { color: colors.secondary }, color: colors.white, fontSize: 10 } },
    { text: '決済手段', options: { bold: true, fill: { color: colors.secondary }, color: colors.white, fontSize: 10 } },
    { text: '手数料', options: { bold: true, fill: { color: colors.secondary }, color: colors.white, fontSize: 10 } },
    { text: '特記事項', options: { bold: true, fill: { color: colors.secondary }, color: colors.white, fontSize: 10 } }
  ],
  [
    { text: 'ICPGW\n(日本)', options: { bold: true } },
    { text: '✅ 完全対応', options: { color: colors.success, bold: true } },
    'Visa, MC\nJCB, Amex\n¥/US$決済',
    '約6.75%～\n初期費用¥0～\n月額¥0～',
    '7営業日以内導入\n加盟店名請求可\n15年以上実績'
  ],
  [
    { text: 'SUI Credit\n(日本)', options: { bold: true } },
    { text: '✅ 特化', options: { color: colors.success, bold: true } },
    'Visa, MC, JCB\nAmex, Diners',
    '個別算定\n初期費用¥0\n月額なし',
    '審査1営業日～\n初期費用0円\n代行会社名義請求'
  ],
  [
    { text: 'CREDIX\n(日本)', options: { bold: true } },
    { text: '✅ 専門', options: { color: colors.success, bold: true } },
    'Visa, MC, JCB\nUS$対応',
    '低料率提示可\n初期費用協議\n月額協議',
    '5～10日導入\n独自審査基準\nCREDIX名義請求'
  ],
  [
    { text: 'Zeus\n(SBI)\n(日本)', options: { bold: true } },
    { text: '△ 可能', options: { color: colors.warning } },
    'Visa, MC, JCB\nコンビニ決済等',
    '5～7%台\n初期約¥100k\n月額約¥10k',
    '審査1.5～3ヶ月\nSBI系列安定性\nJCBのみ増加傾向'
  ],
  [
    { text: 'Billmont\n(日本+海外)', options: { bold: true } },
    { text: '✅ 対応', options: { color: colors.success, bold: true } },
    'Visa, MC, Amex\n164通貨対応',
    '協議制\n初期/月額協議',
    '審査3営業日～\n海外PSP迂回承認\nPCI DSS準拠'
  ]
];

slide22.addTable(pgRows, {
  x: 0.3, y: 1.2, w: 9.4, h: 5.5,
  fontSize: 10,
  border: { pt: 1, color: colors.lightGray },
  valign: 'middle',
  colW: [1.3, 1.2, 1.8, 2, 3.1]
});

// 23. 第7部：ICPGW詳細
const slide23 = pptx.addSlide();
addHeader(slide23, '第7部：国内成人向けPG詳細 (1/5) - ICPGW');
slide23.addText('ICPGW (Be Communications)', {
  x: 0.5, y: 1, w: 9, h: 0.4,
  ...styles.heading2
});
slide23.addText('推奨', {
  x: 8, y: 1, w: 1.5, h: 0.4,
  fontSize: 16,
  bold: true,
  color: colors.white,
  fill: { color: colors.success },
  align: 'center'
});

const icpgw = [
  { text: '特徴', options: { bullet: true, breakLine: true } },
  { text: '成人コンテンツへの完全対応を明記', options: { bullet: { indent: 20 }, bold: true, breakLine: true } },
  { text: '米国など海外金融ベンダーと提携し承認率向上', options: { bullet: { indent: 20 }, breakLine: true } },
  { text: '最短7営業日以内のセットアップ', options: { bullet: { indent: 20 }, breakLine: true } },
  { text: '強み', options: { bullet: true, breakLine: true } },
  { text: '顧客カード明細に加盟店名を記載可能', options: { bullet: { indent: 20 }, breakLine: true } },
  { text: '利用者の信頼度向上', options: { bullet: { indent: 20 }, breakLine: true } },
  { text: '「他の業者で断られた場合も相談してほしい」と明記', options: { bullet: { indent: 20 }, color: colors.accent, bold: true, breakLine: true } },
  { text: '15年以上の成人向け決済実績', options: { bullet: { indent: 20 }, breakLine: true } },
  { text: '費用', options: { bullet: true, breakLine: true } },
  { text: '手数料：約6.75%～（取扱商品・売上規模により変動）', options: { bullet: { indent: 20 }, breakLine: true } },
  { text: '初期費用/月額費用：¥0（条件により変動）', options: { bullet: { indent: 20 }, breakLine: true } },
  { text: 'トランザクション料金：¥55/件', options: { bullet: { indent: 20 }, breakLine: true } },
  { text: 'チャージバック：¥5,500/件', options: { bullet: { indent: 20 } } }
];
slide23.addText(icpgw, {
  x: 0.5, y: 1.6, w: 9, h: 5.4,
  fontSize: 12,
  color: colors.text,
  lineSpacing: 18
});

// 24. 第7部：SUI Credit詳細
const slide24 = pptx.addSlide();
addHeader(slide24, '第7部：国内成人向けPG詳細 (2/5) - SUI Credit');
slide24.addText('SUI Credit Service (SHIMATOMO Inc.)', {
  x: 0.5, y: 1, w: 9, h: 0.4,
  ...styles.heading2
});
slide24.addText('推奨', {
  x: 8, y: 1, w: 1.5, h: 0.4,
  fontSize: 16,
  bold: true,
  color: colors.white,
  fill: { color: colors.success },
  align: 'center'
});

const sui = [
  { text: '特徴', options: { bullet: true, breakLine: true } },
  { text: 'アダルトサイト運営者向けとして広報', options: { bullet: { indent: 20 }, bold: true, breakLine: true } },
  { text: '初期費用0円、審査最短1日完了', options: { bullet: { indent: 20 }, breakLine: true } },
  { text: 'リンク決済/メール決済などの簡易決済機能', options: { bullet: { indent: 20 }, breakLine: true } },
  { text: '強み', options: { bullet: true, breakLine: true } },
  { text: '個人事業主や海外法人でも申込可能（ハードル低い）', options: { bullet: { indent: 20 }, color: colors.accent, breakLine: true } },
  { text: '決済転換率が非常に高いと評価', options: { bullet: { indent: 20 }, breakLine: true } },
  { text: '「業界最低水準の手数料」をアピール', options: { bullet: { indent: 20 }, breakLine: true } },
  { text: 'SUI代行会社名義で請求（顧客プライバシー保護）', options: { bullet: { indent: 20 }, breakLine: true } },
  { text: '費用', options: { bullet: true, breakLine: true } },
  { text: '手数料：売上規模・内容により個別算定（非公開）', options: { bullet: { indent: 20 }, breakLine: true } },
  { text: '初期費用：¥0（無料）', options: { bullet: { indent: 20 }, breakLine: true } },
  { text: '月額基本料：なし（取引ごと課金）', options: { bullet: { indent: 20 }, breakLine: true } },
  { text: 'トランザクション：¥55/件、チャージバック：¥5,500/件', options: { bullet: { indent: 20 } } }
];
slide24.addText(sui, {
  x: 0.5, y: 1.6, w: 9, h: 5.4,
  fontSize: 12,
  color: colors.text,
  lineSpacing: 18
});

// 25. 第7部：CREDIX詳細
const slide25 = pptx.addSlide();
addHeader(slide25, '第7部：国内成人向けPG詳細 (3/5) - CREDIX');
slide25.addText('CREDIX (株式会社ZERO)', {
  x: 0.5, y: 1, w: 9, h: 0.4,
  ...styles.heading2
});
slide25.addText('推奨', {
  x: 8, y: 1, w: 1.5, h: 0.4,
  fontSize: 16,
  bold: true,
  color: colors.white,
  fill: { color: colors.success },
  align: 'center'
});

const credix = [
  { text: '特徴', options: { bullet: true, breakLine: true } },
  { text: '成人向けサイトに特化した決済代行会社', options: { bullet: { indent: 20 }, bold: true, breakLine: true } },
  { text: '国際セキュリティ基準PCI-DSS Ver.4準拠', options: { bullet: { indent: 20 }, breakLine: true } },
  { text: '5～10営業日での迅速な導入サポート', options: { bullet: { indent: 20 }, breakLine: true } },
  { text: '強み', options: { bullet: true, breakLine: true } },
  { text: '独自の審査基準で他社拒否案件も受入', options: { bullet: { indent: 20 }, color: colors.accent, bold: true, breakLine: true } },
  { text: 'BitCashなど成人向けプリペイド電子マネー対応', options: { bullet: { indent: 20 }, breakLine: true } },
  { text: '少額決済/定期決済/会員制など多様な機能', options: { bullet: { indent: 20 }, breakLine: true } },
  { text: '24時間顧客サポート体制', options: { bullet: { indent: 20 }, breakLine: true } },
  { text: 'CREDIX名義で請求（購入履歴を隠す）', options: { bullet: { indent: 20 }, breakLine: true } },
  { text: '費用', options: { bullet: true, breakLine: true } },
  { text: '手数料：柔軟な価格体系、業種/規模に合わせて低い手数料提案可能', options: { bullet: { indent: 20 }, breakLine: true } },
  { text: '初期費用：協議（開設契約金が発生）', options: { bullet: { indent: 20 }, breakLine: true } },
  { text: '月額費用：協議（規模により調整）', options: { bullet: { indent: 20 } } }
];
slide25.addText(credix, {
  x: 0.5, y: 1.6, w: 9, h: 5.4,
  fontSize: 12,
  color: colors.text,
  lineSpacing: 18
});

// 26. 第7部：Zeus詳細
const slide26 = pptx.addSlide();
addHeader(slide26, '第7部：国内成人向けPG詳細 (4/5) - Zeus');
slide26.addText('Zeus（SBIグループ）', {
  x: 0.5, y: 1, w: 9, h: 0.4,
  ...styles.heading2
});
slide26.addText('注意', {
  x: 8, y: 1, w: 1.5, h: 0.4,
  fontSize: 16,
  bold: true,
  color: colors.white,
  fill: { color: colors.warning },
  align: 'center'
});

const zeus = [
  { text: '特徴', options: { bullet: true, breakLine: true } },
  { text: '1990年代から運営の老舗オンライン決済代行', options: { bullet: { indent: 20 }, breakLine: true } },
  { text: '現在はSBIグループ傘下', options: { bullet: { indent: 20 }, breakLine: true } },
  { text: '公式に「成人向けコンテンツ決済サポート」を言及', options: { bullet: { indent: 20 }, breakLine: true } },
  { text: 'クレジットカードのほか多様な決済手段を統合提供', options: { bullet: { indent: 20 }, breakLine: true } },
  { text: '注意事項', options: { bullet: true, breakLine: true } },
  { text: 'Visa/Mastercardが日本の成人向け決済を相次いで停止', options: { bullet: { indent: 20 }, color: colors.warning, bold: true, breakLine: true } },
  { text: 'Zeus経由のVISA/MC承認率が低下、JCB中心化の傾向', options: { bullet: { indent: 20 }, color: colors.warning, breakLine: true } },
  { text: 'コンテンツ審査により一部カードブランドのみ提供される可能性', options: { bullet: { indent: 20 }, color: colors.warning, breakLine: true } },
  { text: '費用', options: { bullet: true, breakLine: true } },
  { text: '手数料：デジタルコンテンツ5～7%台（規模協議可能）', options: { bullet: { indent: 20 }, breakLine: true } },
  { text: '初期費用：約¥100,000', options: { bullet: { indent: 20 }, breakLine: true } },
  { text: '月額費用：約¥10,000', options: { bullet: { indent: 20 }, breakLine: true } },
  { text: '審査期間：1.5～3ヶ月', options: { bullet: { indent: 20 }, color: colors.warning } }
];
slide26.addText(zeus, {
  x: 0.5, y: 1.6, w: 9, h: 5.4,
  fontSize: 12,
  color: colors.text,
  lineSpacing: 18
});

// 27. 第7部：Billmont詳細
const slide27 = pptx.addSlide();
addHeader(slide27, '第7部：国内成人向けPG詳細 (5/5) - Billmont');
slide27.addText('Billmont（国内法人利用可能 海外PSP）', {
  x: 0.5, y: 1, w: 9, h: 0.4,
  ...styles.heading2
});
slide27.addText('推奨', {
  x: 8, y: 1, w: 1.5, h: 0.4,
  fontSize: 16,
  bold: true,
  color: colors.white,
  fill: { color: colors.success },
  align: 'center'
});

const billmont = [
  { text: '特徴', options: { bullet: true, breakLine: true } },
  { text: '日本語サポートを備えたグローバル決済代行', options: { bullet: { indent: 20 }, breakLine: true } },
  { text: '「海外決済代行」として国内取扱困難業種も対応', options: { bullet: { indent: 20 }, bold: true, breakLine: true } },
  { text: '全世界196カ国、164通貨での決済処理', options: { bullet: { indent: 20 }, breakLine: true } },
  { text: '審査期間最短3営業日', options: { bullet: { indent: 20 }, breakLine: true } },
  { text: '強み', options: { bullet: true, breakLine: true } },
  { text: '複数の海外アクワイアリング銀行と提携', options: { bullet: { indent: 20 }, breakLine: true } },
  { text: '国内カード会社の業種制限を迂回可能', options: { bullet: { indent: 20 }, color: colors.accent, bold: true, breakLine: true } },
  { text: 'PCI DSS準拠、3Dセキュア、AI不正防止システム導入', options: { bullet: { indent: 20 }, breakLine: true } },
  { text: 'チャージバック・詐欺リスク管理に強み', options: { bullet: { indent: 20 }, breakLine: true } },
  { text: '費用', options: { bullet: true, breakLine: true } },
  { text: '手数料：協議制（ハイリスク向けカスタム料率、2.65%～事例あり）', options: { bullet: { indent: 20 }, breakLine: true } },
  { text: '初期/月額費用：ケースバイケースで相談', options: { bullet: { indent: 20 }, breakLine: true } },
  { text: 'その他：年950ドル（VISAハイリスク登録費）など別途', options: { bullet: { indent: 20 } } }
];
slide27.addText(billmont, {
  x: 0.5, y: 1.6, w: 9, h: 5.4,
  fontSize: 12,
  color: colors.text,
  lineSpacing: 18
});

// 28. 第8部：総合戦略提言 (1/2)
const slide28 = pptx.addSlide();
addHeader(slide28, '第8部：総合戦略提言 (1/2)');
slide28.addText('実行可能な決済導入ロードマップ', {
  x: 0.5, y: 1, w: 9, h: 0.4,
  ...styles.heading2
});

const roadmap = [
  { text: 'Phase 1：準備段階（審査前）', options: { bullet: true, breakLine: true } },
  { text: '日本法人設立および全必要書類準備', options: { bullet: { indent: 20 }, breakLine: true } },
  { text: 'コンプライアンス文書作成', options: { bullet: { indent: 20 }, breakLine: true } },
  { text: 'AIコンテンツポリシー、利用規約、個人情報保護方針', options: { bullet: { indent: 40 }, breakLine: true } },
  { text: '年齢確認システムの完全実装', options: { bullet: { indent: 20 }, breakLine: true } },
  { text: 'コンテンツフィルタリングシステムの実装', options: { bullet: { indent: 20 }, breakLine: true } },
  { text: '全機能実装されたテストサイト構築', options: { bullet: { indent: 20 }, breakLine: true } },
  { text: 'Phase 2：第1候補への申請', options: { bullet: true, breakLine: true } },
  { text: 'AXES Paymentへの問合せとヒアリング', options: { bullet: { indent: 20 }, breakLine: true } },
  { text: 'BitCash/C-CHECK取扱可否を最優先確認', options: { bullet: { indent: 40 }, color: colors.accent, bold: true, breakLine: true } },
  { text: 'リスク緩和資料を準備して審査対応', options: { bullet: { indent: 20 }, breakLine: true } },
  { text: 'Phase 3：第2候補への並行申請', options: { bullet: true, breakLine: true } },
  { text: 'ICPGW、SUI Credit、CREDIXへの同時申請', options: { bullet: { indent: 20 }, breakLine: true } },
  { text: '複数PGで承認可能性を最大化', options: { bullet: { indent: 20 } } }
];
slide28.addText(roadmap, {
  x: 0.5, y: 1.5, w: 9, h: 5.5,
  fontSize: 12,
  color: colors.text,
  lineSpacing: 18
});

// 29. 第8部：総合戦略提言 (2/2)
const slide29 = pptx.addSlide();
addHeader(slide29, '第8部：総合戦略提言 (2/2)');
slide29.addText('リスク認識と現実的な期待値設定', {
  x: 0.5, y: 1, w: 9, h: 0.4,
  ...styles.heading2
});

const reality = [
  { text: '認識すべき現実', options: { bullet: true, breakLine: true } },
  { text: 'AIアダルトチャットは決済市場のリスクスペクトルの最先端', options: { bullet: { indent: 20 }, bold: true, color: colors.accent, breakLine: true } },
  { text: '市場は既にAI生成コンテンツをリスク要素と見なし自主規制開始', options: { bullet: { indent: 20 }, breakLine: true } },
  { text: '審査通過は決して保証されない', options: { bullet: { indent: 20 }, color: colors.danger, breakLine: true } },
  { text: '成功の鍵', options: { bullet: true, breakLine: true } },
  { text: '専門PGの発掘（AXES、ICPGW、SUI、CREDIXなど）', options: { bullet: { indent: 20 }, breakLine: true } },
  { text: 'サービスが「制御不可能なディープフェイク責任爆弾」ではなく「管理可能なリスク」であることを説得', options: { bullet: { indent: 20 }, bold: true, color: colors.accent, breakLine: true } },
  { text: '圧倒的に説得力のある回答資料の準備', options: { bullet: { indent: 20 }, breakLine: true } },
  { text: '覚悟すべき事項', options: { bullet: true, breakLine: true } },
  { text: '高額な初期費用（50,000～300,000円）', options: { bullet: { indent: 20 }, breakLine: true } },
  { text: '高い決済手数料（5～12%）', options: { bullet: { indent: 20 }, breakLine: true } },
  { text: '長く困難な審査プロセス（数週間～数ヶ月）', options: { bullet: { indent: 20 }, breakLine: true } },
  { text: '複数PGへの並行申請の必要性', options: { bullet: { indent: 20 } } }
];
slide29.addText(reality, {
  x: 0.5, y: 1.5, w: 9, h: 5.5,
  fontSize: 12,
  color: colors.text,
  lineSpacing: 18
});

// 30. 最終結論
const slide30 = pptx.addSlide();
slide30.background = { color: colors.primary };
addHeader(slide30, '');
slide30.addText('最終結論', {
  x: 0.5, y: 1.5, w: 9, h: 0.6,
  fontSize: 32,
  bold: true,
  color: colors.white,
  align: 'center'
});

const conclusion = [
  { text: '✅ 実行可能性：あり（但し困難を伴う）', options: { breakLine: true } },
  { text: '', options: { breakLine: true } },
  { text: '🎯 最優先戦略', options: { breakLine: true } },
  { text: 'BitCash/C-CHECK導入（AXES Paymentまたは専門PG経由）', options: { breakLine: true } },
  { text: '', options: { breakLine: true } },
  { text: '⚠️ 回避対象', options: { breakLine: true } },
  { text: 'GMO-PG、VeriTrans、QR決済への申請', options: { breakLine: true } },
  { text: '', options: { breakLine: true } },
  { text: '💰 予想費用', options: { breakLine: true } },
  { text: '初期費用50,000～300,000円 + 手数料5～12%', options: { breakLine: true } },
  { text: '', options: { breakLine: true } },
  { text: '⏱️ 審査期間', options: { breakLine: true } },
  { text: '数週間～数ヶ月（長期戦を覚悟）', options: {} }
];
slide30.addText(conclusion, {
  x: 1, y: 2.5, w: 8, h: 4,
  fontSize: 16,
  color: colors.white,
  lineSpacing: 28,
  align: 'left'
});

// PPTファイル保存
const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
const filename = `日本AI成人コンテンツ決済PG総合分析_${timestamp}.pptx`;

await pptx.writeFile({ fileName: filename });
console.log(`\n✅ PPTファイルが生成されました: ${filename}`);
console.log(`📄 総スライド数: 30枚`);
console.log(`📊 内容: AI成人コンテンツ決済PG総合分析`);


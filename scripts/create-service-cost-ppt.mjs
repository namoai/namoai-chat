import PptxGenJS from 'pptxgenjs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

async function createServiceCostPPT() {
  const pptx = new PptxGenJS();
  
  // プレゼンテーション設定
  pptx.layout = 'LAYOUT_16x9';
  pptx.author = 'namos-chat-v1';
  pptx.title = 'サービス別費用詳細分析';
  
  // 共通スタイル
  const styles = {
    title: { fontSize: 32, bold: true, color: '1F4788', align: 'center' },
    subtitle: { fontSize: 20, color: '4472C4', align: 'center' },
    heading1: { fontSize: 24, bold: true, color: '1F4788' },
    heading2: { fontSize: 20, bold: true, color: '4472C4' },
    heading3: { fontSize: 18, bold: true, color: '5B9BD5' },
    body: { fontSize: 14, color: '333333' },
    tableHeader: { fontSize: 12, bold: true, color: 'FFFFFF', fill: '4472C4', align: 'center', valign: 'middle' },
    tableCell: { fontSize: 11, color: '333333', align: 'center', valign: 'middle' }
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
  slide.addText('サービス別費用詳細分析', {
    x: 0.5, y: 2, w: 9, h: 1,
    ...styles.title,
    fontSize: 40
  });
  slide.addText('Netlify・AWS・PayPal・PayPay・ドメイン', {
    x: 0.5, y: 3, w: 9, h: 0.6,
    ...styles.subtitle,
    fontSize: 24
  });
  slide.addText('各サービスの料金体系と使用量別費用シミュレーション', {
    x: 1, y: 4, w: 8, h: 0.5,
    fontSize: 16,
    color: '666666',
    align: 'center'
  });

  // スライド2: 目次
  slide = pptx.addSlide();
  slide.background = bgGradient;
  slide.addText('目次', {
    x: 0.5, y: 0.5, w: 9, h: 0.6,
    ...styles.heading1
  });
  
  const toc = [
    { text: '1. Netlify 料金体系', options: { bullet: true } },
    { text: '2. AWS 料金体系 (Lambda + API Gateway + CloudFront)', options: { bullet: true } },
    { text: '3. インフラ比較: Netlify vs AWS', options: { bullet: true } },
    { text: '4. PayPal 料金体系', options: { bullet: true } },
    { text: '5. PayPay 料金体系', options: { bullet: true } },
    { text: '6. 決済サービス比較: PayPal vs PayPay', options: { bullet: true } },
    { text: '7. ドメイン費用詳細', options: { bullet: true } },
    { text: '8. 総合費用シミュレーション', options: { bullet: true } }
  ];
  
  slide.addText(toc, {
    x: 1.5, y: 1.5, w: 7, h: 4,
    fontSize: 16,
    color: '333333',
    lineSpacing: 38
  });

  // スライド3: Netlify 料金体系
  slide = pptx.addSlide();
  slide.background = bgGradient;
  slide.addText('1. Netlify 料金体系', {
    x: 0.5, y: 0.4, w: 9, h: 0.6,
    ...styles.heading1
  });
  
  const netlifyPlans = [
    ['プラン', '月額料金', 'サーバーレス関数', '帯域幅', '備考'],
    ['Starter (無料)', '$0', '125,000回/月\n実行時間 100時間/月', '100GB/月', '個人・小規模向け'],
    ['Pro', '$19/月\n(2,850円)', '125,000回/月\n実行時間 100時間/月', '1TB/月', '本番環境推奨'],
    ['超過料金', '-', '125,000回毎に $25\n(3,750円)', '100GB毎に $55\n(8,250円)', 'Proプラン加入者のみ']
  ];
  
  slide.addTable(netlifyPlans, {
    x: 0.5, y: 1.2, w: 9, h: 2,
    fontSize: 11,
    border: { pt: 1, color: 'CCCCCC' },
    fill: { color: 'FFFFFF' },
    color: '333333',
    align: 'center',
    valign: 'middle',
    rowH: 0.5
  });
  
  slide.addText('使用量別月額費用シミュレーション', {
    x: 0.5, y: 3.4, w: 9, h: 0.4,
    ...styles.heading3
  });
  
  const netlifySimulation = [
    ['月間リクエスト数', 'ユーザー数想定', '関数呼び出し', '月額費用（円）', '年間費用（円）'],
    ['234,000', '100名', '234,000回', '6,600円', '79,200円'],
    ['1,170,000', '500名', '1,170,000回', '36,600円', '439,200円'],
    ['2,340,000', '1,000名', '2,340,000回', '70,350円', '844,200円'],
    ['11,700,000', '5,000名', '11,700,000回', '348,600円', '4,183,200円'],
    ['23,400,000', '10,000名', '23,400,000回', '704,100円', '8,449,200円']
  ];
  
  slide.addTable(netlifySimulation, {
    x: 0.5, y: 3.9, w: 9, h: 2.5,
    fontSize: 10,
    border: { pt: 1, color: 'CCCCCC' },
    fill: { color: 'FFFFFF' },
    color: '333333',
    align: 'center',
    valign: 'middle',
    rowH: 0.5
  });

  // スライド4: Netlify 特徴
  slide = pptx.addSlide();
  slide.background = bgGradient;
  slide.addText('Netlify の特徴と注意点', {
    x: 0.5, y: 0.4, w: 9, h: 0.6,
    ...styles.heading1
  });
  
  slide.addShape(pptx.ShapeType.rect, {
    x: 0.8, y: 1.2, w: 4, h: 2.5,
    fill: { color: 'E8F5E9' },
    line: { color: '4CAF50', width: 2 }
  });
  
  slide.addText('✅ メリット', {
    x: 1, y: 1.35, w: 3.6, h: 0.4,
    fontSize: 16,
    bold: true,
    color: '2E7D32'
  });
  
  const netlifyPros = [
    { text: 'セットアップが非常に簡単', options: { bullet: false } },
    { text: 'Git連携による自動デプロイ', options: { bullet: false } },
    { text: 'グローバルCDN標準装備', options: { bullet: false } },
    { text: '開発者フレンドリーなUI', options: { bullet: false } },
    { text: 'Next.js最適化済み', options: { bullet: false } },
    { text: 'インフラ管理不要', options: { bullet: false } }
  ];
  
  slide.addText(netlifyPros, {
    x: 1.1, y: 1.8, w: 3.4, h: 1.8,
    fontSize: 12,
    color: '333333',
    lineSpacing: 22
  });
  
  slide.addShape(pptx.ShapeType.rect, {
    x: 5.2, y: 1.2, w: 4, h: 2.5,
    fill: { color: 'FFEBEE' },
    line: { color: 'F44336', width: 2 }
  });
  
  slide.addText('⚠️ デメリット', {
    x: 5.4, y: 1.35, w: 3.6, h: 0.4,
    fontSize: 16,
    bold: true,
    color: 'C62828'
  });
  
  const netlifyCons = [
    { text: '関数呼び出しが高額（AWS比36倍）', options: { bullet: false } },
    { text: 'スケール時のコスト爆発リスク', options: { bullet: false } },
    { text: '帯域幅超過料金も高額', options: { bullet: false } },
    { text: '実行時間制限（10秒）', options: { bullet: false } },
    { text: '詳細なモニタリング機能が限定的', options: { bullet: false } },
    { text: 'カスタマイズ性がAWSより低い', options: { bullet: false } }
  ];
  
  slide.addText(netlifyCons, {
    x: 5.5, y: 1.8, w: 3.4, h: 1.8,
    fontSize: 12,
    color: '333333',
    lineSpacing: 22
  });
  
  slide.addShape(pptx.ShapeType.rect, {
    x: 1.5, y: 4, w: 7, h: 1.8,
    fill: { color: 'FFF3CD' },
    line: { color: 'FFC107', width: 2 }
  });
  
  slide.addText('💡 推奨使用シナリオ', {
    x: 1.7, y: 4.15, w: 6.6, h: 0.3,
    fontSize: 15,
    bold: true,
    color: '856404'
  });
  
  const netlifyRecommendation = [
    { text: '✅ 初期段階（0～500名）: 開発速度を優先し、インフラ管理コストを削減', options: { bullet: true } },
    { text: '❌ 成長段階（500名～）: AWS移行を検討すべき（費用が36倍の差）', options: { bullet: true } },
    { text: '⚠️ 1,000名時点で月7万円、10,000名で月70万円の関数費用が発生', options: { bullet: true } }
  ];
  
  slide.addText(netlifyRecommendation, {
    x: 1.9, y: 4.6, w: 6.2, h: 1,
    fontSize: 12,
    color: '333333',
    lineSpacing: 22
  });

  // スライド5: AWS 料金体系
  slide = pptx.addSlide();
  slide.background = bgGradient;
  slide.addText('2. AWS 料金体系', {
    x: 0.5, y: 0.4, w: 9, h: 0.6,
    ...styles.heading1
  });
  
  slide.addText('Lambda・API Gateway・CloudFront の料金', {
    x: 0.5, y: 1.1, w: 9, h: 0.4,
    fontSize: 16,
    color: '666666',
    align: 'center'
  });
  
  const awsPricing = [
    ['サービス', '料金体系', '無料枠', '備考'],
    ['Lambda\n（関数実行）', 'リクエスト: $0.20/100万件\nGB-秒: $0.0000166667\n(512MB想定)', '月100万リクエスト\n40万GB-秒', '実行時間500ms想定:\n約$0.004/1000回'],
    ['API Gateway', '$1.00/100万リクエスト', '月100万件\n(12ヶ月間)', 'REST API価格'],
    ['CloudFront\n（CDN）', '日本リージョン:\n$0.114/GB', '月1TB\n(12ヶ月間)', 'データ転送料']
  ];
  
  slide.addTable(awsPricing, {
    x: 0.5, y: 1.6, w: 9, h: 2,
    fontSize: 10,
    border: { pt: 1, color: 'CCCCCC' },
    fill: { color: 'FFFFFF' },
    color: '333333',
    align: 'center',
    valign: 'middle',
    rowH: 0.5
  });
  
  slide.addText('使用量別月額費用シミュレーション（Lambda + API Gateway）', {
    x: 0.5, y: 3.8, w: 9, h: 0.4,
    ...styles.heading3
  });
  
  const awsSimulation = [
    ['月間リクエスト数', 'ユーザー数想定', 'Lambda費用', 'API Gateway', '合計（円）', '年間（円）'],
    ['234,000', '100名', '約 $0.05', '約 $0.23', '約42円', '約504円'],
    ['1,170,000', '500名', '約 $0.23', '約 $1.17', '約210円', '約2,520円'],
    ['2,340,000', '1,000名', '約 $0.47', '約 $2.34', '約421円', '約5,052円'],
    ['11,700,000', '5,000名', '約 $2.34', '約 $11.70', '約2,106円', '約25,272円'],
    ['23,400,000', '10,000名', '約 $4.68', '約 $23.40', '約4,212円', '約50,544円']
  ];
  
  slide.addTable(awsSimulation, {
    x: 0.3, y: 4.3, w: 9.4, h: 2.5,
    fontSize: 10,
    border: { pt: 1, color: 'CCCCCC' },
    fill: { color: 'FFFFFF' },
    color: '333333',
    align: 'center',
    valign: 'middle',
    rowH: 0.5
  });

  // スライド6: AWS 追加費用詳細
  slide = pptx.addSlide();
  slide.background = bgGradient;
  slide.addText('AWS 追加費用詳細', {
    x: 0.5, y: 0.4, w: 9, h: 0.6,
    ...styles.heading1
  });
  
  slide.addText('Lambda 実行時間費用（GB-秒）', {
    x: 0.5, y: 1.2, w: 4.5, h: 0.4,
    ...styles.heading3
  });
  
  const lambdaCompute = [
    ['メモリ設定', '実行時間', '100万回の費用', '月間費用\n(1,000名想定)'],
    ['512 MB', '500 ms', '$1.95', '約 $4.56\n(684円)'],
    ['1024 MB', '500 ms', '$3.90', '約 $9.12\n(1,368円)'],
    ['2048 MB', '500 ms', '$7.80', '約 $18.24\n(2,736円)']
  ];
  
  slide.addTable(lambdaCompute, {
    x: 0.5, y: 1.7, w: 4.5, h: 2,
    fontSize: 10,
    border: { pt: 1, color: 'CCCCCC' },
    fill: { color: 'FFFFFF' },
    color: '333333',
    align: 'center',
    valign: 'middle',
    rowH: 0.5
  });
  
  slide.addText('CloudFront データ転送費用', {
    x: 5.1, y: 1.2, w: 4.4, h: 0.4,
    ...styles.heading3
  });
  
  const cloudFrontCost = [
    ['月間転送量', 'GB単価', '月額費用（円）', '想定ユーザー数'],
    ['10 GB', '$0.114', '171円', '～100名'],
    ['50 GB', '$0.114', '855円', '～500名'],
    ['100 GB', '$0.114', '1,710円', '～1,000名'],
    ['500 GB', '$0.114', '8,550円', '～5,000名'],
    ['1 TB', '$0.114', '17,100円', '～10,000名']
  ];
  
  slide.addTable(cloudFrontCost, {
    x: 5.1, y: 1.7, w: 4.4, h: 2.5,
    fontSize: 10,
    border: { pt: 1, color: 'CCCCCC' },
    fill: { color: 'FFFFFF' },
    color: '333333',
    align: 'center',
    valign: 'middle',
    rowH: 0.5
  });
  
  slide.addShape(pptx.ShapeType.rect, {
    x: 0.8, y: 4.3, w: 8.4, h: 1.5,
    fill: { color: 'E3F2FD' },
    line: { color: '2196F3', width: 2 }
  });
  
  slide.addText('💰 1,000名ユーザー時の AWS 総費用（推定）', {
    x: 1, y: 4.5, w: 8, h: 0.3,
    fontSize: 15,
    bold: true,
    color: '1565C0'
  });
  
  slide.addText('Lambda リクエスト: 421円\nLambda 実行時間: 684円 (512MB想定)\nAPI Gateway: 421円\nCloudFront: 1,710円 (100GB想定)\n────────────────\n合計: 約3,236円/月 (年間 約38,832円)', {
    x: 1.5, y: 4.9, w: 7, h: 0.8,
    fontSize: 12,
    color: '333333',
    fontFace: 'Courier New'
  });

  // スライド7: AWS 特徴
  slide = pptx.addSlide();
  slide.background = bgGradient;
  slide.addText('AWS の特徴と注意点', {
    x: 0.5, y: 0.4, w: 9, h: 0.6,
    ...styles.heading1
  });
  
  slide.addShape(pptx.ShapeType.rect, {
    x: 0.8, y: 1.2, w: 4, h: 2.5,
    fill: { color: 'E8F5E9' },
    line: { color: '4CAF50', width: 2 }
  });
  
  slide.addText('✅ メリット', {
    x: 1, y: 1.35, w: 3.6, h: 0.4,
    fontSize: 16,
    bold: true,
    color: '2E7D32'
  });
  
  const awsPros = [
    { text: '圧倒的な低コスト（Netlifyの1/36）', options: { bullet: false } },
    { text: '使った分だけの従量課金', options: { bullet: false } },
    { text: '高度なカスタマイズが可能', options: { bullet: false } },
    { text: '詳細なモニタリング・ログ', options: { bullet: false } },
    { text: 'グローバルインフラ', options: { bullet: false } },
    { text: 'スケーラビリティが無限', options: { bullet: false } }
  ];
  
  slide.addText(awsPros, {
    x: 1.1, y: 1.8, w: 3.4, h: 1.8,
    fontSize: 12,
    color: '333333',
    lineSpacing: 22
  });
  
  slide.addShape(pptx.ShapeType.rect, {
    x: 5.2, y: 1.2, w: 4, h: 2.5,
    fill: { color: 'FFEBEE' },
    line: { color: 'F44336', width: 2 }
  });
  
  slide.addText('⚠️ デメリット', {
    x: 5.4, y: 1.35, w: 3.6, h: 0.4,
    fontSize: 16,
    bold: true,
    color: 'C62828'
  });
  
  const awsCons = [
    { text: '初期セットアップが複雑', options: { bullet: false } },
    { text: 'DevOps知識が必要', options: { bullet: false } },
    { text: 'インフラ管理の負担増', options: { bullet: false } },
    { text: '学習コストが高い', options: { bullet: false } },
    { text: 'デプロイ自動化に追加設定必要', options: { bullet: false } },
    { text: '料金体系が複雑', options: { bullet: false } }
  ];
  
  slide.addText(awsCons, {
    x: 5.5, y: 1.8, w: 3.4, h: 1.8,
    fontSize: 12,
    color: '333333',
    lineSpacing: 22
  });
  
  slide.addShape(pptx.ShapeType.rect, {
    x: 1.5, y: 4, w: 7, h: 1.8,
    fill: { color: 'FFF3CD' },
    line: { color: 'FFC107', width: 2 }
  });
  
  slide.addText('💡 推奨使用シナリオ', {
    x: 1.7, y: 4.15, w: 6.6, h: 0.3,
    fontSize: 15,
    bold: true,
    color: '856404'
  });
  
  const awsRecommendation = [
    { text: '✅ 成長段階（500名～）: Netlifyからの移行を強く推奨（月7万円→3千円）', options: { bullet: true } },
    { text: '✅ スケール段階（1,000名～）: 必須（月70万円→3千円の削減効果）', options: { bullet: true } },
    { text: '⚠️ DevOpsエンジニア雇用コストと比較検討が必要', options: { bullet: true } }
  ];
  
  slide.addText(awsRecommendation, {
    x: 1.9, y: 4.6, w: 6.2, h: 1,
    fontSize: 12,
    color: '333333',
    lineSpacing: 22
  });

  // スライド8: Netlify vs AWS 比較
  slide = pptx.addSlide();
  slide.background = bgGradient;
  slide.addText('3. インフラ比較: Netlify vs AWS', {
    x: 0.5, y: 0.4, w: 9, h: 0.6,
    ...styles.heading1
  });
  
  const infraComparison = [
    ['項目', 'Netlify Pro', 'AWS (Lambda+APIGW+CF)', '価格差'],
    ['100名\n(234,000 req/月)', '6,600円/月', '約500円/月', 'Netlify: 13倍高'],
    ['500名\n(1,170,000 req/月)', '36,600円/月', '約2,000円/月', 'Netlify: 18倍高'],
    ['1,000名\n(2,340,000 req/月)', '70,350円/月', '約3,236円/月', 'Netlify: 22倍高'],
    ['5,000名\n(11,700,000 req/月)', '348,600円/月', '約15,000円/月', 'Netlify: 23倍高'],
    ['10,000名\n(23,400,000 req/月)', '704,100円/月', '約25,000円/月', 'Netlify: 28倍高']
  ];
  
  slide.addTable(infraComparison, {
    x: 0.5, y: 1.2, w: 9, h: 3,
    fontSize: 11,
    border: { pt: 1, color: 'CCCCCC' },
    fill: { color: 'FFFFFF' },
    color: '333333',
    align: 'center',
    valign: 'middle',
    rowH: 0.6
  });
  
  slide.addShape(pptx.ShapeType.rect, {
    x: 1, y: 4.5, w: 8, h: 1.5,
    fill: { color: 'E8F5E9' },
    line: { color: '4CAF50', width: 3 }
  });
  
  slide.addText('🎯 移行推奨タイミング', {
    x: 1.2, y: 4.7, w: 7.6, h: 0.35,
    fontSize: 16,
    bold: true,
    color: '2E7D32'
  });
  
  const migrationTiming = [
    { text: '500名到達: 移行準備開始（月間削減額 約3.5万円）', options: { bullet: true } },
    { text: '1,000名到達: 移行完了目標（月間削減額 約6.7万円 = 年間80万円）', options: { bullet: true } },
    { text: '10,000名想定: 必須（月間削減額 約68万円 = 年間816万円）', options: { bullet: true } }
  ];
  
  slide.addText(migrationTiming, {
    x: 1.4, y: 5.2, w: 7.2, h: 0.7,
    fontSize: 12,
    color: '333333',
    lineSpacing: 18
  });

  // スライド9: PayPal 料金体系
  slide = pptx.addSlide();
  slide.background = bgGradient;
  slide.addText('4. PayPal 料金体系', {
    x: 0.5, y: 0.4, w: 9, h: 0.6,
    ...styles.heading1
  });
  
  const paypalPricing = [
    ['取引タイプ', '手数料率', '固定手数料', '合計', '備考'],
    ['国内取引', '3.6%', '+ 40円', '3.6% + 40円', '日本円→日本円'],
    ['海外取引', '4.1%', '+ 40円', '4.1% + 40円', '外貨受取'],
    ['通貨換算手数料', '3.0~4.0%', '-', '3.0~4.0%', '為替レート上乗せ'],
    ['月額固定費', '-', '-', '0円', 'ビジネスアカウント']
  ];
  
  slide.addTable(paypalPricing, {
    x: 0.5, y: 1.2, w: 9, h: 2,
    fontSize: 11,
    border: { pt: 1, color: 'CCCCCC' },
    fill: { color: 'FFFFFF' },
    color: '333333',
    align: 'center',
    valign: 'middle',
    rowH: 0.5
  });
  
  slide.addText('売上別手数料シミュレーション', {
    x: 0.5, y: 3.4, w: 9, h: 0.4,
    ...styles.heading3
  });
  
  const paypalSimulation = [
    ['月間売上', 'ユーザー数想定', '取引数', '手数料（円）', '年間手数料（円）'],
    ['1,759,500円', '100名', '約 20,700件', '約 63,462円', '約 761,544円'],
    ['8,797,500円', '500名', '約 103,500件', '約 321,090円', '約 3,853,080円'],
    ['17,595,000円', '1,000名', '約 207,000件', '約 641,820円', '約 7,701,840円'],
    ['87,975,000円', '5,000名', '約 1,035,000件', '約 3,207,900円', '約 38,494,800円'],
    ['175,950,000円', '10,000名', '約 2,070,000件', '約 6,414,600円', '約 76,975,200円']
  ];
  
  slide.addTable(paypalSimulation, {
    x: 0.3, y: 3.9, w: 9.4, h: 2.5,
    fontSize: 10,
    border: { pt: 1, color: 'CCCCCC' },
    fill: { color: 'FFFFFF' },
    color: '333333',
    align: 'center',
    valign: 'middle',
    rowH: 0.5
  });

  // スライド10: PayPay 料金体系
  slide = pptx.addSlide();
  slide.background = bgGradient;
  slide.addText('5. PayPay 料金体系', {
    x: 0.5, y: 0.4, w: 9, h: 0.6,
    ...styles.heading1
  });
  
  const paypayPricing = [
    ['プラン', '決済手数料', '月額固定費', '対応決済', '備考'],
    ['フリープラン', '3.24%', '0円', 'PayPay残高のみ', '小規模事業者向け'],
    ['パーソナルプラン', '2.40%~2.59%', '1,980円', 'PayPay残高\n+ クレカ', '月商100万円以下推奨'],
    ['ライトプラン', '2.00%~2.20%', '5,500円', 'PayPay残高\n+ クレカ', '月商300万円以下推奨'],
    ['スタンダードプラン', '1.60%~1.98%', '11,000円', 'PayPay残高\n+ クレカ', '月商500万円以上推奨']
  ];
  
  slide.addTable(paypayPricing, {
    x: 0.4, y: 1.2, w: 9.2, h: 2.5,
    fontSize: 10,
    border: { pt: 1, color: 'CCCCCC' },
    fill: { color: 'FFFFFF' },
    color: '333333',
    align: 'center',
    valign: 'middle',
    rowH: 0.5
  });
  
  slide.addText('売上別最適プランと手数料', {
    x: 0.5, y: 4, w: 9, h: 0.4,
    ...styles.heading3
  });
  
  const paypaySimulation = [
    ['月間売上', 'ユーザー数', '最適プラン', '固定費', '変動手数料', '月間総費用', '年間費用'],
    ['1,759,500円', '100名', 'パーソナル\n(2.5%)', '1,980円', '43,988円', '45,968円', '551,616円'],
    ['8,797,500円', '500名', 'ライト\n(2.1%)', '5,500円', '184,748円', '190,248円', '2,282,976円'],
    ['17,595,000円', '1,000名', 'スタンダード\n(1.8%)', '11,000円', '316,710円', '327,710円', '3,932,520円'],
    ['87,975,000円', '5,000名', 'スタンダード\n(1.6%)', '11,000円', '1,407,600円', '1,418,600円', '17,023,200円'],
    ['175,950,000円', '10,000名', 'スタンダード\n(1.6%)', '11,000円', '2,815,200円', '2,826,200円', '33,914,400円']
  ];
  
  slide.addTable(paypaySimulation, {
    x: 0.2, y: 4.5, w: 9.6, h: 2.5,
    fontSize: 9,
    border: { pt: 1, color: 'CCCCCC' },
    fill: { color: 'FFFFFF' },
    color: '333333',
    align: 'center',
    valign: 'middle',
    rowH: 0.5
  });

  // スライド11: PayPal vs PayPay 比較
  slide = pptx.addSlide();
  slide.background = bgGradient;
  slide.addText('6. 決済サービス比較: PayPal vs PayPay', {
    x: 0.5, y: 0.4, w: 9, h: 0.6,
    ...styles.heading1
  });
  
  const paymentComparison = [
    ['月間売上', 'PayPal\n手数料', 'PayPay\n手数料', '年間削減額', '削減率'],
    ['1,759,500円\n(100名)', '63,462円/月', '45,968円/月', '約 210,000円', '27.6%'],
    ['8,797,500円\n(500名)', '321,090円/月', '190,248円/月', '約 1,570,000円', '40.7%'],
    ['17,595,000円\n(1,000名)', '641,820円/月', '327,710円/月', '約 3,769,000円', '48.9%'],
    ['87,975,000円\n(5,000名)', '3,207,900円/月', '1,418,600円/月', '約 21,472,000円', '55.8%'],
    ['175,950,000円\n(10,000名)', '6,414,600円/月', '2,826,200円/月', '約 43,061,000円', '56.0%']
  ];
  
  slide.addTable(paymentComparison, {
    x: 0.5, y: 1.2, w: 9, h: 2.5,
    fontSize: 10,
    border: { pt: 1, color: 'CCCCCC' },
    fill: { color: 'FFFFFF' },
    color: '333333',
    align: 'center',
    valign: 'middle',
    rowH: 0.5
  });
  
  slide.addShape(pptx.ShapeType.rect, {
    x: 0.8, y: 4, w: 8.4, h: 2,
    fill: { color: 'E8F5E9' },
    line: { color: '4CAF50', width: 3 }
  });
  
  slide.addText('🎯 推奨: PayPay主力 + PayPal補助', {
    x: 1, y: 4.2, w: 8, h: 0.4,
    fontSize: 18,
    bold: true,
    color: '2E7D32'
  });
  
  const paymentRecommendation = [
    { text: 'Phase 1（0～1,000名）: PayPayのみ実装（開発工数削減）', options: { bullet: true } },
    { text: '• 想定: PayPay利用率 100%、手数料 1.8~2.5%', options: { bullet: false } },
    { text: 'Phase 2（1,000名～）: PayPal追加（海外展開準備）', options: { bullet: true } },
    { text: '• 想定: PayPay 80% / PayPal 20%、加重平均 約2.2%', options: { bullet: false } },
    { text: '💰 1,000名時点での年間削減効果: 約377万円', options: { bullet: true } }
  ];
  
  slide.addText(paymentRecommendation, {
    x: 1.2, y: 4.7, w: 7.6, h: 1.2,
    fontSize: 13,
    color: '333333',
    lineSpacing: 20
  });

  // スライド12: ドメイン費用詳細
  slide = pptx.addSlide();
  slide.background = bgGradient;
  slide.addText('7. ドメイン費用詳細', {
    x: 0.5, y: 0.4, w: 9, h: 0.6,
    ...styles.heading1
  });
  
  const domainPricing = [
    ['ドメイン種類', '初年度', '更新（年）', 'レジストラ例', '推奨度'],
    ['.com', '$9~$12\n(1,350~1,800円)', '$12~$15\n(1,800~2,250円)', 'Cloudflare\nNamecheap', '✅✅✅'],
    ['.net', '$10~$13\n(1,500~1,950円)', '$13~$16\n(1,950~2,400円)', 'Cloudflare\nNamecheap', '✅✅'],
    ['.jp', '¥3,000~¥4,000', '¥3,500~¥5,000', 'お名前.com\nムームードメイン', '✅✅'],
    ['.co.jp', '¥6,000~¥8,000', '¥6,000~¥8,000', 'お名前.com', '✅\n(法人のみ)'],
    ['.io', '$25~$35\n(3,750~5,250円)', '$35~$50\n(5,250~7,500円)', 'Cloudflare', '⚠️ 高額']
  ];
  
  slide.addTable(domainPricing, {
    x: 0.5, y: 1.2, w: 9, h: 2.5,
    fontSize: 10,
    border: { pt: 1, color: 'CCCCCC' },
    fill: { color: 'FFFFFF' },
    color: '333333',
    align: 'center',
    valign: 'middle',
    rowH: 0.5
  });
  
  slide.addText('推奨ドメインレジストラ比較', {
    x: 0.5, y: 4, w: 9, h: 0.4,
    ...styles.heading3
  });
  
  const registrarComparison = [
    ['レジストラ', '.com価格', 'WHOISプライバシー', 'DNS速度', '日本語サポート', '総合評価'],
    ['Cloudflare', '$9.15/年\n(1,373円)', '無料', '最速', '限定的', '✅✅✅'],
    ['Namecheap', '$9.48/年\n(1,422円)', '無料（1年目）', '高速', 'あり', '✅✅'],
    ['お名前.com', '約 1,500円/年', '有料（980円/年）', '普通', '充実', '✅✅\n(.jp推奨)'],
    ['Google Domains\n(Squarespace)', '$12/年\n(1,800円)', '無料', '高速', 'あり', '✅']
  ];
  
  slide.addTable(registrarComparison, {
    x: 0.4, y: 4.5, w: 9.2, h: 2,
    fontSize: 9,
    border: { pt: 1, color: 'CCCCCC' },
    fill: { color: 'FFFFFF' },
    color: '333333',
    align: 'center',
    valign: 'middle',
    rowH: 0.5
  });

  // スライド13: ドメイン推奨戦略
  slide = pptx.addSlide();
  slide.background = bgGradient;
  slide.addText('ドメイン選択推奨戦略', {
    x: 0.5, y: 0.4, w: 9, h: 0.6,
    ...styles.heading1
  });
  
  slide.addShape(pptx.ShapeType.rect, {
    x: 1, y: 1.3, w: 8, h: 1.5,
    fill: { color: 'E8F5E9' },
    line: { color: '4CAF50', width: 2 }
  });
  
  slide.addText('🎯 推奨: .com ドメイン + Cloudflare', {
    x: 1.2, y: 1.5, w: 7.6, h: 0.35,
    fontSize: 16,
    bold: true,
    color: '2E7D32'
  });
  
  slide.addText('理由:\n• 年間 $9.15（約1,373円）で最もコストパフォーマンスが高い\n• WHOISプライバシー保護が無料\n• CloudflareのCDNと統合可能（AWS移行時に有利）\n• グローバル認知度が最も高い', {
    x: 1.4, y: 1.95, w: 7.2, h: 0.8,
    fontSize: 12,
    color: '333333'
  });
  
  slide.addText('ドメイン取得費用（5年間想定）', {
    x: 0.5, y: 3, w: 9, h: 0.4,
    ...styles.heading3
  });
  
  const domainLongTerm = [
    ['年数', 'Cloudflare .com', 'お名前.com .jp', 'Namecheap .com', '備考'],
    ['1年目', '1,373円', '4,000円', '1,422円', '初年度'],
    ['2年目', '1,373円', '5,000円', '1,800円', '更新価格適用'],
    ['3年目', '1,373円', '5,000円', '1,800円', '-'],
    ['4年目', '1,373円', '5,000円', '1,800円', '-'],
    ['5年目', '1,373円', '5,000円', '1,800円', '-'],
    ['5年合計', '6,865円', '24,000円', '8,622円', '-']
  ];
  
  slide.addTable(domainLongTerm, {
    x: 0.8, y: 3.5, w: 8.4, h: 3,
    fontSize: 11,
    border: { pt: 1, color: 'CCCCCC' },
    fill: { color: 'FFFFFF' },
    color: '333333',
    align: 'center',
    valign: 'middle',
    rowH: 0.5
  });

  // スライド14: 総合費用シミュレーション
  slide = pptx.addSlide();
  slide.background = bgGradient;
  slide.addText('8. 総合費用シミュレーション', {
    x: 0.5, y: 0.4, w: 9, h: 0.6,
    ...styles.heading1
  });
  
  slide.addText('【シナリオA】Netlify + PayPal + .com', {
    x: 0.5, y: 1.1, w: 9, h: 0.4,
    ...styles.heading2
  });
  
  const scenarioA = [
    ['ユーザー数', 'Netlify', 'PayPal', 'ドメイン', 'Supabase', '月間合計', '年間合計'],
    ['100名', '6,600円', '63,462円', '150円', '3,750円', '73,962円', '887,544円'],
    ['500名', '36,600円', '321,090円', '150円', '3,750円', '361,590円', '4,339,080円'],
    ['1,000名', '70,350円', '641,820円', '150円', '3,750円', '716,070円', '8,592,840円'],
    ['10,000名', '704,100円', '6,414,600円', '150円', '3,750円', '7,122,600円', '85,471,200円']
  ];
  
  slide.addTable(scenarioA, {
    x: 0.4, y: 1.6, w: 9.2, h: 2,
    fontSize: 10,
    border: { pt: 1, color: 'CCCCCC' },
    fill: { color: 'FFFFFF' },
    color: '333333',
    align: 'center',
    valign: 'middle',
    rowH: 0.5
  });
  
  slide.addText('【シナリオB】AWS + PayPay + .com （推奨）', {
    x: 0.5, y: 3.8, w: 9, h: 0.4,
    ...styles.heading2,
    color: '2E7D32'
  });
  
  const scenarioB = [
    ['ユーザー数', 'AWS', 'PayPay', 'ドメイン', 'Supabase', '月間合計', '年間合計'],
    ['100名', '500円', '45,968円', '150円', '3,750円', '50,368円', '604,416円'],
    ['500名', '2,000円', '190,248円', '150円', '3,750円', '196,148円', '2,353,776円'],
    ['1,000名', '3,236円', '327,710円', '150円', '3,750円', '334,846円', '4,018,152円'],
    ['10,000名', '25,000円', '2,826,200円', '150円', '3,750円', '2,855,100円', '34,261,200円']
  ];
  
  slide.addTable(scenarioB, {
    x: 0.4, y: 4.3, w: 9.2, h: 2,
    fontSize: 10,
    border: { pt: 1, color: 'CCCCCC' },
    fill: { color: 'E8F5E9' },
    color: '333333',
    align: 'center',
    valign: 'middle',
    rowH: 0.5
  });

  // スライド15: 削減効果まとめ
  slide = pptx.addSlide();
  slide.background = bgGradient;
  slide.addText('シナリオ比較と削減効果', {
    x: 0.5, y: 0.4, w: 9, h: 0.6,
    ...styles.heading1
  });
  
  const savingsComparison = [
    ['ユーザー数', 'シナリオA\n(Netlify+PayPal)', 'シナリオB\n(AWS+PayPay)', '月間削減額', '年間削減額', '削減率'],
    ['100名', '73,962円', '50,368円', '23,594円', '283,128円', '31.9%'],
    ['500名', '361,590円', '196,148円', '165,442円', '1,985,304円', '45.8%'],
    ['1,000名', '716,070円', '334,846円', '381,224円', '4,574,688円', '53.2%'],
    ['10,000名', '7,122,600円', '2,855,100円', '4,267,500円', '51,210,000円', '59.9%']
  ];
  
  slide.addTable(savingsComparison, {
    x: 0.3, y: 1.2, w: 9.4, h: 2.5,
    fontSize: 10,
    border: { pt: 1, color: 'CCCCCC' },
    fill: { color: 'FFFFFF' },
    color: '333333',
    align: 'center',
    valign: 'middle',
    rowH: 0.5
  });
  
  slide.addShape(pptx.ShapeType.rect, {
    x: 0.8, y: 4, w: 8.4, h: 2,
    fill: { color: 'E8F5E9' },
    line: { color: '4CAF50', width: 3 }
  });
  
  slide.addText('💰 最大削減効果（10,000名時点）', {
    x: 1, y: 4.2, w: 8, h: 0.4,
    fontSize: 18,
    bold: true,
    color: '2E7D32'
  });
  
  const maxSavings = [
    { text: '月間削減額: 約427万円', options: { bullet: true } },
    { text: '年間削減額: 約5,121万円', options: { bullet: true } },
    { text: '削減率: 59.9%（費用が約40%に）', options: { bullet: true } },
    { text: '主な削減要因:', options: { bullet: true } },
    { text: '  • Netlify→AWS: 月68万円削減', options: { bullet: false } },
    { text: '  • PayPal→PayPay: 月359万円削減', options: { bullet: false } }
  ];
  
  slide.addText(maxSavings, {
    x: 1.2, y: 4.7, w: 7.6, h: 1.2,
    fontSize: 13,
    color: '333333',
    lineSpacing: 16
  });

  // スライド16: 最終推奨戦略
  slide = pptx.addSlide();
  slide.background = bgGradient;
  slide.addText('最終推奨戦略: 段階的移行プラン', {
    x: 0.5, y: 0.4, w: 9, h: 0.6,
    ...styles.heading1
  });
  
  slide.addShape(pptx.ShapeType.rect, {
    x: 0.8, y: 1.2, w: 8.4, h: 1.3,
    fill: { color: 'FFEBEE' },
    line: { color: 'F44336', width: 2 }
  });
  
  slide.addText('Phase 1: 初期段階（0～500名）', {
    x: 1, y: 1.35, w: 8, h: 0.3,
    fontSize: 15,
    bold: true,
    color: 'C62828'
  });
  
  slide.addText('構成: Netlify + PayPay + .com（Cloudflare）\n理由: 開発速度優先、インフラ管理コスト削減\n月間費用: 約5～20万円', {
    x: 1.2, y: 1.75, w: 7.6, h: 0.6,
    fontSize: 12,
    color: '333333'
  });
  
  slide.addShape(pptx.ShapeType.rect, {
    x: 0.8, y: 2.7, w: 8.4, h: 1.3,
    fill: { color: 'FFF3CD' },
    line: { color: 'FFC107', width: 2 }
  });
  
  slide.addText('Phase 2: 移行準備段階（500～1,000名）', {
    x: 1, y: 2.85, w: 8, h: 0.3,
    fontSize: 15,
    bold: true,
    color: '856404'
  });
  
  slide.addText('構成: Netlify → AWS 移行着手（PayPayは継続）\n理由: 費用が急増する前に移行準備\n月間費用: 約20～34万円（移行後）', {
    x: 1.2, y: 3.25, w: 7.6, h: 0.6,
    fontSize: 12,
    color: '333333'
  });
  
  slide.addShape(pptx.ShapeType.rect, {
    x: 0.8, y: 4.2, w: 8.4, h: 1.3,
    fill: { color: 'E8F5E9' },
    line: { color: '4CAF50', width: 2 }
  });
  
  slide.addText('Phase 3: スケール段階（1,000名～）', {
    x: 1, y: 4.35, w: 8, h: 0.3,
    fontSize: 15,
    bold: true,
    color: '2E7D32'
  });
  
  slide.addText('構成: AWS + PayPay（主力）+ PayPal（補助）+ .com\n理由: 最適化完了、グローバル展開準備\n月間費用: 約33万円（1,000名）～ 286万円（10,000名）', {
    x: 1.2, y: 4.75, w: 7.6, h: 0.6,
    fontSize: 12,
    color: '333333'
  });
  
  slide.addText('🎯 この戦略により年間5,000万円以上のコスト削減が可能', {
    x: 1.5, y: 5.7, w: 7, h: 0.4,
    fontSize: 14,
    bold: true,
    color: 'C00000',
    align: 'center'
  });

  // ファイル保存
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
  const pptPath = join(projectRoot, `サービス別費用詳細分析_${timestamp}.pptx`);
  
  await pptx.writeFile({ fileName: pptPath });
  
  console.log(`\n✅ PPT作成完了!`);
  console.log(`📄 ファイル: ${pptPath}`);
  console.log(`📊 総スライド数: ${pptx.slides.length}枚`);
}

createServiceCostPPT().catch(console.error);


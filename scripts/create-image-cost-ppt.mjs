import PptxGenJS from 'pptxgenjs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

async function createImageCostPPT() {
  const pptx = new PptxGenJS();
  
  pptx.layout = 'LAYOUT_16x9';
  pptx.author = 'namos-chat-v1';
  pptx.title = 'イメージストレージ・トラフィック費用分析';
  
  const styles = {
    title: { fontSize: 32, bold: true, color: '1F4788', align: 'center' },
    subtitle: { fontSize: 20, color: '4472C4', align: 'center' },
    heading1: { fontSize: 24, bold: true, color: '1F4788' },
    heading2: { fontSize: 20, bold: true, color: '4472C4' },
    heading3: { fontSize: 18, bold: true, color: '5B9BD5' }
  };

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
  slide.addText('🖼️ イメージストレージ・\nトラフィック費用分析', {
    x: 0.5, y: 1.8, w: 9, h: 1.2,
    ...styles.title,
    fontSize: 38
  });
  slide.addText('見落としていた重大なコスト項目', {
    x: 0.5, y: 3.2, w: 9, h: 0.6,
    fontSize: 20,
    color: 'C00000',
    align: 'center',
    bold: true
  });
  slide.addText('チャット毎にイメージを表示 = 膨大なトラフィック費用', {
    x: 1, y: 4, w: 8, h: 0.5,
    fontSize: 16,
    color: '666666',
    align: 'center'
  });

  // スライド2: 問題の認識
  slide = pptx.addSlide();
  slide.background = bgGradient;
  slide.addText('⚠️ 見落としていたコスト', {
    x: 0.5, y: 0.4, w: 9, h: 0.6,
    ...styles.heading1
  });
  
  slide.addShape(pptx.ShapeType.rect, {
    x: 0.8, y: 1.2, w: 8.4, h: 1.5,
    fill: { color: 'FFEBEE' },
    line: { color: 'F44336', width: 3 }
  });
  
  slide.addText('❌ 現在のコスト分析に含まれていないもの', {
    x: 1, y: 1.35, w: 8, h: 0.4,
    fontSize: 18,
    bold: true,
    color: 'C62828'
  });
  
  const missingCosts = [
    { text: '1. イメージストレージ費用（キャラクター画像の保存）', options: { bullet: true } },
    { text: '2. イメージ転送費用（チャット毎に画像を配信）', options: { bullet: true } },
    { text: '3. CDN費用（グローバル配信のため）', options: { bullet: true } }
  ];
  
  slide.addText(missingCosts, {
    x: 1.2, y: 1.85, w: 7.6, h: 0.7,
    fontSize: 14,
    color: '333333',
    lineSpacing: 18
  });
  
  slide.addShape(pptx.ShapeType.rect, {
    x: 0.8, y: 2.9, w: 8.4, h: 3.2,
    fill: { color: 'FFF3CD' },
    line: { color: 'FFC107', width: 2 }
  });
  
  slide.addText('📊 サービスの特性', {
    x: 1, y: 3.05, w: 8, h: 0.4,
    fontSize: 16,
    bold: true,
    color: '856404'
  });
  
  const serviceCharacteristics = [
    { text: 'キャラクター1体につき平均5～10枚の画像（表情、状況別）', options: { bullet: true } },
    { text: '画像1枚あたり: 500KB～2MB（最適化前）', options: { bullet: true } },
    { text: 'チャット1回につき平均1.5枚の画像を表示', options: { bullet: true } },
    { text: '1,000名のアクティブユーザー = 月間234万メッセージ', options: { bullet: true } },
    { text: '→ 月間351万枚の画像配信が必要', options: { bullet: true } },
    { text: '→ 最適化なしで 3.5TB/月 のトラフィック発生！', options: { bullet: false } }
  ];
  
  slide.addText(serviceCharacteristics, {
    x: 1.2, y: 3.55, w: 7.6, h: 2.4,
    fontSize: 13,
    color: '333333',
    lineSpacing: 26
  });

  // スライド3: 使用量計算
  slide = pptx.addSlide();
  slide.background = bgGradient;
  slide.addText('📐 使用量の詳細計算', {
    x: 0.5, y: 0.4, w: 9, h: 0.6,
    ...styles.heading1
  });
  
  const usageTable = [
    ['ユーザー数', 'キャラ数\n(想定)', 'ストレージ\n必要量', '月間メッセージ', '画像表示回数\n(1.5枚/msg)', '月間転送量\n(1MB/枚)'],
    ['100名', '100体', '250MB～1GB', '234,000', '351,000枚', '351GB'],
    ['500名', '500体', '1.25GB～5GB', '1,170,000', '1,755,000枚', '1.76TB'],
    ['1,000名', '1,000体', '2.5GB～10GB', '2,340,000', '3,510,000枚', '3.51TB'],
    ['5,000名', '3,000体', '7.5GB～30GB', '11,700,000', '17,550,000枚', '17.55TB'],
    ['10,000名', '5,000体', '12.5GB～50GB', '23,400,000', '35,100,000枚', '35.1TB']
  ];
  
  slide.addTable(usageTable, {
    x: 0.2, y: 1.2, w: 9.6, h: 3,
    fontSize: 9,
    border: { pt: 1, color: 'CCCCCC' },
    fill: { color: 'FFFFFF' },
    color: '333333',
    align: 'center',
    valign: 'middle',
    rowH: 0.5
  });
  
  slide.addShape(pptx.ShapeType.rect, {
    x: 1, y: 4.5, w: 8, h: 1.5,
    fill: { color: 'FFEBEE' },
    line: { color: 'F44336', width: 3 }
  });
  
  slide.addText('⚠️ 10,000名到達時: 月間35TB以上の転送が発生！', {
    x: 1.2, y: 4.7, w: 7.6, h: 0.4,
    fontSize: 18,
    bold: true,
    color: 'C00000',
    align: 'center'
  });
  
  slide.addText('これは現在の分析で計算していたLLM費用とは\n完全に別の費用項目です！', {
    x: 1.2, y: 5.2, w: 7.6, h: 0.7,
    fontSize: 14,
    color: 'C62828',
    align: 'center'
  });

  // スライド4: Supabase Storage 費用
  slide = pptx.addSlide();
  slide.background = bgGradient;
  slide.addText('Supabase Storage 料金体系', {
    x: 0.5, y: 0.4, w: 9, h: 0.6,
    ...styles.heading1
  });
  
  const supabasePricing = [
    ['プラン', 'ストレージ', '転送量/月', '超過料金', '月額'],
    ['Free', '1GB', '2GB', '利用不可', '$0'],
    ['Pro', '100GB\n(含む)', '200GB\n(含む)', 'ストレージ: $0.021/GB\n転送: $0.09/GB', '$25'],
    ['Team', '100GB\n(含む)', '200GB\n(含む)', '同上', '$599'],
    ['Enterprise', 'カスタム', 'カスタム', '要相談', 'カスタム']
  ];
  
  slide.addTable(supabasePricing, {
    x: 0.5, y: 1.2, w: 9, h: 2,
    fontSize: 10,
    border: { pt: 1, color: 'CCCCCC' },
    fill: { color: 'FFFFFF' },
    color: '333333',
    align: 'center',
    valign: 'middle',
    rowH: 0.5
  });
  
  slide.addText('ユーザー数別 月間費用（Supabase Pro）', {
    x: 0.5, y: 3.4, w: 9, h: 0.4,
    ...styles.heading3
  });
  
  const supabaseCost = [
    ['ユーザー数', 'ストレージ', 'ストレージ費用', '転送量', '転送費用', '月間合計（円）'],
    ['100名', '1GB', '基本内', '351GB', '$13.59\n(2,039円)', '約5,789円'],
    ['500名', '5GB', '基本内', '1.76TB', '$140.4\n(21,060円)', '約24,810円'],
    ['1,000名', '10GB', '基本内', '3.51TB', '$298.89\n(44,834円)', '約48,584円'],
    ['5,000名', '30GB', '基本内', '17.55TB', '$1,576.5\n(236,475円)', '約240,225円'],
    ['10,000名', '50GB', '基本内', '35.1TB', '$3,159\n(473,850円)', '約477,600円']
  ];
  
  slide.addTable(supabaseCost, {
    x: 0.3, y: 3.9, w: 9.4, h: 2.5,
    fontSize: 9,
    border: { pt: 1, color: 'CCCCCC' },
    fill: { color: 'FFFFFF' },
    color: '333333',
    align: 'center',
    valign: 'middle',
    rowH: 0.5
  });

  // スライド5: Cloudflare R2 (推奨)
  slide = pptx.addSlide();
  slide.background = bgGradient;
  slide.addText('Cloudflare R2 料金体系 （推奨！）', {
    x: 0.5, y: 0.4, w: 9, h: 0.6,
    ...styles.heading1
  });
  
  const r2Pricing = [
    ['項目', '料金', '無料枠', '備考'],
    ['ストレージ', '$0.015/GB/月', '月10GB', 'S3より約40%安い'],
    ['Class A 操作\n(書き込み)', '$4.50/100万', '月100万', 'PUT, POST, LIST等'],
    ['Class B 操作\n(読み取り)', '$0.36/100万', '月1,000万', 'GET, HEAD等'],
    ['データ転送\n(Egress)', '$0.00', '無制限！', '⭐️ 完全無料！']
  ];
  
  slide.addTable(r2Pricing, {
    x: 0.8, y: 1.2, w: 8.4, h: 2,
    fontSize: 10,
    border: { pt: 1, color: 'CCCCCC' },
    fill: { color: 'FFFFFF' },
    color: '333333',
    align: 'center',
    valign: 'middle',
    rowH: 0.5
  });
  
  slide.addText('ユーザー数別 月間費用（Cloudflare R2）', {
    x: 0.5, y: 3.4, w: 9, h: 0.4,
    ...styles.heading3
  });
  
  const r2Cost = [
    ['ユーザー数', 'ストレージ', 'ストレージ費用', 'Class B 操作', '操作費用', '転送費用', '月間合計（円）'],
    ['100名', '1GB', '基本内', '351,000', '基本内', '$0', '約0円'],
    ['500名', '5GB', '基本内', '1,755,000', '基本内', '$0', '約0円'],
    ['1,000名', '10GB', '0円', '3,510,000', '$0', '$0', '約0円'],
    ['5,000名', '30GB', '$0.30\n(45円)', '17,550,000', '$6.30\n(945円)', '$0', '約990円'],
    ['10,000名', '50GB', '$0.60\n(90円)', '35,100,000', '$12.60\n(1,890円)', '$0', '約1,980円']
  ];
  
  slide.addTable(r2Cost, {
    x: 0.2, y: 3.9, w: 9.6, h: 2.5,
    fontSize: 9,
    border: { pt: 1, color: 'CCCCCC' },
    fill: { color: 'E8F5E9' },
    color: '333333',
    align: 'center',
    valign: 'middle',
    rowH: 0.5
  });

  // スライド6: AWS S3 + CloudFront
  slide = pptx.addSlide();
  slide.background = bgGradient;
  slide.addText('AWS S3 + CloudFront 料金体系', {
    x: 0.5, y: 0.4, w: 9, h: 0.6,
    ...styles.heading1
  });
  
  const awsS3Pricing = [
    ['サービス', '料金', '備考'],
    ['S3 ストレージ', '$0.023/GB/月', '標準ストレージ'],
    ['S3 PUT リクエスト', '$0.005/1,000件', '画像アップロード時'],
    ['S3 GET リクエスト', '$0.0004/1,000件', 'CloudFrontへの転送'],
    ['CloudFront 転送\n(日本)', '$0.114/GB', '最初の10TBまで'],
    ['CloudFront リクエスト', '$0.0120/10,000件', 'HTTPS リクエスト']
  ];
  
  slide.addTable(awsS3Pricing, {
    x: 1, y: 1.2, w: 8, h: 2.5,
    fontSize: 11,
    border: { pt: 1, color: 'CCCCCC' },
    fill: { color: 'FFFFFF' },
    color: '333333',
    align: 'center',
    valign: 'middle',
    rowH: 0.5
  });
  
  slide.addText('ユーザー数別 月間費用（S3 + CloudFront）', {
    x: 0.5, y: 4, w: 9, h: 0.4,
    ...styles.heading3
  });
  
  const awsCost = [
    ['ユーザー数', 'S3 費用', 'CloudFront 転送', 'CF リクエスト', '月間合計（円）'],
    ['100名', '約$0.03\n(5円)', '$40.01\n(6,002円)', '$4.21\n(632円)', '約6,639円'],
    ['500名', '約$0.12\n(18円)', '$200.64\n(30,096円)', '$21.06\n(3,159円)', '約33,273円'],
    ['1,000名', '約$0.23\n(35円)', '$400.14\n(60,021円)', '$42.12\n(6,318円)', '約66,374円'],
    ['5,000名', '約$0.69\n(104円)', '$2,000.7\n(300,105円)', '$210.6\n(31,590円)', '約331,799円'],
    ['10,000名', '約$1.15\n(173円)', '$4,001.4\n(600,210円)', '$421.2\n(63,180円)', '約663,563円']
  ];
  
  slide.addTable(awsCost, {
    x: 0.5, y: 4.5, w: 9, h: 2.5,
    fontSize: 10,
    border: { pt: 1, color: 'CCCCCC' },
    fill: { color: 'FFFFFF' },
    color: '333333',
    align: 'center',
    valign: 'middle',
    rowH: 0.5
  });

  // スライド7: 3社比較
  slide = pptx.addSlide();
  slide.background = bgGradient;
  slide.addText('ストレージサービス比較', {
    x: 0.5, y: 0.4, w: 9, h: 0.6,
    ...styles.heading1
  });
  
  const comparisonTable = [
    ['ユーザー数', 'Supabase Storage', 'AWS S3+CloudFront', 'Cloudflare R2', '最安'],
    ['100名', '5,789円', '6,639円', '0円', 'R2'],
    ['500名', '24,810円', '33,273円', '0円', 'R2'],
    ['1,000名', '48,584円', '66,374円', '0円', 'R2'],
    ['5,000名', '240,225円', '331,799円', '990円', 'R2'],
    ['10,000名', '477,600円', '663,563円', '1,980円', 'R2']
  ];
  
  slide.addTable(comparisonTable, {
    x: 0.8, y: 1.2, w: 8.4, h: 2.5,
    fontSize: 11,
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
  
  slide.addText('🎯 推奨: Cloudflare R2', {
    x: 1, y: 4.2, w: 8, h: 0.4,
    fontSize: 20,
    bold: true,
    color: '2E7D32'
  });
  
  const r2Advantages = [
    { text: '✅ データ転送(Egress)が完全無料 → 最大の費用要因を削減！', options: { bullet: true } },
    { text: '✅ 10,000名でも月2,000円未満（Supabase比 約240倍安い）', options: { bullet: true } },
    { text: '✅ S3互換API → 移行が容易', options: { bullet: true } },
    { text: '✅ グローバルCDN標準装備', options: { bullet: true } }
  ];
  
  slide.addText(r2Advantages, {
    x: 1.2, y: 4.7, w: 7.6, h: 1.2,
    fontSize: 13,
    color: '333333',
    lineSpacing: 22
  });

  // スライド8: イメージ最適化戦略
  slide = pptx.addSlide();
  slide.background = bgGradient;
  slide.addText('💡 イメージ最適化戦略', {
    x: 0.5, y: 0.4, w: 9, h: 0.6,
    ...styles.heading1
  });
  
  slide.addShape(pptx.ShapeType.rect, {
    x: 0.8, y: 1.2, w: 8.4, h: 1.5,
    fill: { color: 'E3F2FD' },
    line: { color: '2196F3', width: 2 }
  });
  
  slide.addText('❶ 画像フォーマット最適化', {
    x: 1, y: 1.35, w: 8, h: 0.3,
    fontSize: 15,
    bold: true,
    color: '1565C0'
  });
  
  const formatOptimization = [
    { text: 'WebP形式に変換: PNG/JPEGより25～35%小さい', options: { bullet: true } },
    { text: 'AVIF形式も検討: WebPよりさらに20%小さい（ブラウザ対応確認必要）', options: { bullet: true } },
    { text: '想定削減効果: 転送量を30%削減 → 3.51TB → 2.46TB', options: { bullet: true } }
  ];
  
  slide.addText(formatOptimization, {
    x: 1.2, y: 1.75, w: 7.6, h: 0.8,
    fontSize: 12,
    color: '333333',
    lineSpacing: 18
  });
  
  slide.addShape(pptx.ShapeType.rect, {
    x: 0.8, y: 2.8, w: 8.4, h: 1.5,
    fill: { color: 'FFF3CD' },
    line: { color: 'FFC107', width: 2 }
  });
  
  slide.addText('❷ レスポンシブイメージ配信', {
    x: 1, y: 2.95, w: 8, h: 0.3,
    fontSize: 15,
    bold: true,
    color: '856404'
  });
  
  const responsiveImages = [
    { text: '複数サイズを事前生成: 320px, 640px, 1024px, オリジナル', options: { bullet: true } },
    { text: 'デバイスに応じて最適サイズを配信（srcset使用）', options: { bullet: true } },
    { text: '想定削減効果: モバイル60%として平均40%削減 → 2.46TB → 1.48TB', options: { bullet: true } }
  ];
  
  slide.addText(responsiveImages, {
    x: 1.2, y: 3.35, w: 7.6, h: 0.8,
    fontSize: 12,
    color: '333333',
    lineSpacing: 18
  });
  
  slide.addShape(pptx.ShapeType.rect, {
    x: 0.8, y: 4.4, w: 8.4, h: 1.5,
    fill: { color: 'E8F5E9' },
    line: { color: '4CAF50', width: 2 }
  });
  
  slide.addText('❸ ブラウザキャッシュ活用', {
    x: 1, y: 4.55, w: 8, h: 0.3,
    fontSize: 15,
    bold: true,
    color: '2E7D32'
  });
  
  const caching = [
    { text: 'Cache-Control: max-age=31536000 （1年）', options: { bullet: true } },
    { text: '同一ユーザーの重複ダウンロードを防止', options: { bullet: true } },
    { text: '想定削減効果: リピート率80%として60%削減 → 1.48TB → 0.59TB', options: { bullet: true } }
  ];
  
  slide.addText(caching, {
    x: 1.2, y: 4.95, w: 7.6, h: 0.8,
    fontSize: 12,
    color: '333333',
    lineSpacing: 18
  });

  // スライド9: 最適化効果
  slide = pptx.addSlide();
  slide.background = bgGradient;
  slide.addText('最適化による削減効果（1,000名基準）', {
    x: 0.5, y: 0.4, w: 9, h: 0.6,
    ...styles.heading1
  });
  
  const optimizationEffect = [
    ['最適化段階', '転送量/月', 'Supabase費用', 'AWS費用', 'Cloudflare R2'],
    ['最適化前', '3.51TB', '48,584円', '66,374円', '0円'],
    ['WebP変換後', '2.46TB (-30%)', '33,498円', '45,672円', '0円'],
    ['レスポンシブ化後', '1.48TB (-58%)', '19,338円', '27,042円', '0円'],
    ['キャッシュ活用後', '0.59TB (-83%)', '7,284円', '10,662円', '0円']
  ];
  
  slide.addTable(optimizationEffect, {
    x: 0.5, y: 1.2, w: 9, h: 2,
    fontSize: 10,
    border: { pt: 1, color: 'CCCCCC' },
    fill: { color: 'FFFFFF' },
    color: '333333',
    align: 'center',
    valign: 'middle',
    rowH: 0.5
  });
  
  slide.addShape(pptx.ShapeType.rect, {
    x: 1, y: 3.5, w: 8, h: 2.5,
    fill: { color: 'E8F5E9' },
    line: { color: '4CAF50', width: 3 }
  });
  
  slide.addText('🎯 最終推奨構成', {
    x: 1.2, y: 3.7, w: 7.6, h: 0.35,
    fontSize: 18,
    bold: true,
    color: '2E7D32'
  });
  
  const finalRecommendation = [
    { text: 'ストレージ: Cloudflare R2', options: { bullet: true } },
    { text: '画像フォーマット: WebP（AVIF fallback検討）', options: { bullet: true } },
    { text: 'レスポンシブ配信: 4サイズ事前生成', options: { bullet: true } },
    { text: 'キャッシュ: 1年間の長期キャッシュ', options: { bullet: true } },
    { text: '', options: { bullet: false } },
    { text: '💰 1,000名時の月間費用: 0円（R2無料枠内）', options: { bullet: false } },
    { text: '💰 10,000名時の月間費用: 約2,000円', options: { bullet: false } },
    { text: '💰 Supabase比で年間約571万円の削減！', options: { bullet: false } }
  ];
  
  slide.addText(finalRecommendation, {
    x: 1.4, y: 4.15, w: 7.2, h: 1.7,
    fontSize: 13,
    color: '333333',
    lineSpacing: 18
  });

  // スライド10: 総合費用への影響
  slide = pptx.addSlide();
  slide.background = bgGradient;
  slide.addText('総合費用への影響（1,000名基準）', {
    x: 0.5, y: 0.4, w: 9, h: 0.6,
    ...styles.heading1
  });
  
  slide.addText('❌ 現在の分析（イメージ費用なし）', {
    x: 0.5, y: 1.1, w: 9, h: 0.4,
    fontSize: 16,
    color: 'C62828',
    align: 'center',
    bold: true
  });
  
  const currentAnalysis = [
    ['項目', '月額費用（円）', '構成比'],
    ['LLM費用', '941,777', '56.9%'],
    ['決済手数料', '633,420', '38.3%'],
    ['インフラ (Netlify/AWS)', '70,350', '4.2%'],
    ['その他固定費', '9,973', '0.6%'],
    ['合計', '1,655,520', '100.0%']
  ];
  
  slide.addTable(currentAnalysis, {
    x: 1.5, y: 1.6, w: 7, h: 2.5,
    fontSize: 11,
    border: { pt: 1, color: 'CCCCCC' },
    fill: { color: 'FFEBEE' },
    color: '333333',
    align: 'center',
    valign: 'middle',
    rowH: 0.5
  });
  
  slide.addText('✅ 修正後（イメージ費用含む・最適化済み）', {
    x: 0.5, y: 4.3, w: 9, h: 0.4,
    fontSize: 16,
    color: '2E7D32',
    align: 'center',
    bold: true
  });
  
  const correctedAnalysis = [
    ['項目', '月額費用（円）', '構成比', '変更'],
    ['LLM費用', '941,777', '56.8%', '変更なし'],
    ['決済手数料', '633,420', '38.2%', '変更なし'],
    ['インフラ (Netlify/AWS)', '70,350', '4.2%', '変更なし'],
    ['イメージ (R2+最適化)', '0', '0.0%', '🆕追加'],
    ['その他固定費', '9,973', '0.6%', '変更なし'],
    ['合計', '1,655,520', '100.0%', '増加なし！']
  ];
  
  slide.addTable(correctedAnalysis, {
    x: 1, y: 4.8, w: 8, h: 3,
    fontSize: 10,
    border: { pt: 1, color: 'CCCCCC' },
    fill: { color: 'E8F5E9' },
    color: '333333',
    align: 'center',
    valign: 'middle',
    rowH: 0.5
  });

  // スライド11: まとめ
  slide = pptx.addSlide();
  slide.background = bgGradient;
  slide.addText('まとめ: イメージコスト対策', {
    x: 0.5, y: 0.4, w: 9, h: 0.6,
    ...styles.heading1
  });
  
  slide.addShape(pptx.ShapeType.rect, {
    x: 0.8, y: 1.2, w: 8.4, h: 1.5,
    fill: { color: 'FFEBEE' },
    line: { color: 'F44336', width: 3 }
  });
  
  slide.addText('⚠️ 放置した場合のリスク', {
    x: 1, y: 1.35, w: 8, h: 0.3,
    fontSize: 16,
    bold: true,
    color: 'C62828'
  });
  
  const risks = [
    { text: 'Supabase使用時: 1,000名で月4.8万円、10,000名で月47.8万円', options: { bullet: true } },
    { text: 'AWS使用時: 1,000名で月6.6万円、10,000名で月66.4万円', options: { bullet: true } },
    { text: '年間で最大約800万円の予期せぬ費用発生！', options: { bullet: true } }
  ];
  
  slide.addText(risks, {
    x: 1.2, y: 1.75, w: 7.6, h: 0.8,
    fontSize: 13,
    color: '333333',
    lineSpacing: 18
  });
  
  slide.addShape(pptx.ShapeType.rect, {
    x: 0.8, y: 2.8, w: 8.4, h: 2.2,
    fill: { color: 'E8F5E9' },
    line: { color: '4CAF50', width: 3 }
  });
  
  slide.addText('✅ 推奨対策を実施した場合', {
    x: 1, y: 2.95, w: 8, h: 0.3,
    fontSize: 16,
    bold: true,
    color: '2E7D32'
  });
  
  const solutions = [
    { text: 'Cloudflare R2採用 → 転送費用0円', options: { bullet: true } },
    { text: 'WebP+レスポンシブ+キャッシュ → 転送量83%削減', options: { bullet: true } },
    { text: '1,000名時: 0円、10,000名時: 約2,000円/月', options: { bullet: true } },
    { text: '年間削減効果: 約571万円（10,000名時）', options: { bullet: true } },
    { text: '', options: { bullet: false } },
    { text: '🎯 総合費用への影響: ほぼゼロ！', options: { bullet: false } }
  ];
  
  slide.addText(solutions, {
    x: 1.2, y: 3.35, w: 7.6, h: 1.5,
    fontSize: 13,
    color: '333333',
    lineSpacing: 20
  });
  
  slide.addShape(pptx.ShapeType.rect, {
    x: 1.5, y: 5.3, w: 7, h: 0.7,
    fill: { color: '4472C4' }
  });
  
  slide.addText('結論: 適切な対策により、イメージコストは\nほぼ無視できるレベルに抑えられる！', {
    x: 1.7, y: 5.4, w: 6.6, h: 0.5,
    fontSize: 14,
    bold: true,
    color: 'FFFFFF',
    align: 'center',
    valign: 'middle'
  });

  // ファイル保存
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
  const pptPath = join(projectRoot, `イメージストレージ・トラフィック費用分析_${timestamp}.pptx`);
  
  await pptx.writeFile({ fileName: pptPath });
  
  console.log(`\n✅ PPT作成完了!`);
  console.log(`📄 ファイル: ${pptPath}`);
  console.log(`📊 総スライド数: ${pptx.slides.length}枚`);
}

createImageCostPPT().catch(console.error);




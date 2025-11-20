import PptxGenJS from 'pptxgenjs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

async function createComprehensiveCostPPT() {
  const pptx = new PptxGenJS();
  
  pptx.layout = 'LAYOUT_16x9';
  pptx.author = 'namos-chat-v1';
  pptx.title = '総合インフラ費用比較';
  
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
  slide.addText('総合インフラ費用比較', {
    x: 0.5, y: 2, w: 9, h: 0.8,
    ...styles.title,
    fontSize: 40
  });
  slide.addText('Netlify・AWS・Wasabi+Cloudflare・完全AWS移行', {
    x: 0.5, y: 3, w: 9, h: 0.6,
    ...styles.subtitle,
    fontSize: 22
  });
  slide.addText('すべての選択肢を徹底比較', {
    x: 1, y: 3.8, w: 8, h: 0.5,
    fontSize: 16,
    color: '666666',
    align: 'center'
  });

  // スライド2: 比較シナリオ一覧
  slide = pptx.addSlide();
  slide.background = bgGradient;
  slide.addText('比較する5つのシナリオ', {
    x: 0.5, y: 0.4, w: 9, h: 0.6,
    ...styles.heading1
  });
  
  const scenarios = [
    ['シナリオ', '構成', '特徴', '想定利用者'],
    ['A\n現状維持', 'Netlify + Supabase Storage\n+ PayPal', '開発が最も簡単\n管理不要', '初期段階\n(0～500名)'],
    ['B\n部分最適化', 'Netlify + Cloudflare R2\n+ PayPay', 'イメージコスト削減\n開発簡単', '成長初期\n(500～1,000名)'],
    ['C\nWasabi活用', 'Netlify + Wasabi + CF CDN\n+ PayPay', 'ストレージ最安\nCDN活用', '成長段階\n(1,000～5,000名)'],
    ['D\nAWS部分移行', 'AWS Lambda/APIGW + R2\n+ PayPay', 'インフラ最適化\nDevOps必要', 'スケール段階\n(5,000名～)'],
    ['E\n完全AWS', 'AWS(EC2/ECS) + S3 + CF\n+ PayPay', '完全コントロール\nDevOps必須', '大規模運用\n(10,000名～)']
  ];
  
  slide.addTable(scenarios, {
    x: 0.3, y: 1.2, w: 9.4, h: 5,
    fontSize: 9,
    border: { pt: 1, color: 'CCCCCC' },
    fill: { color: 'FFFFFF' },
    color: '333333',
    align: 'center',
    valign: 'middle',
    rowH: 1
  });

  // スライド3: シナリオA - 現状維持
  slide = pptx.addSlide();
  slide.background = bgGradient;
  slide.addText('シナリオA: 現状維持（最も簡単）', {
    x: 0.5, y: 0.4, w: 9, h: 0.6,
    ...styles.heading1
  });
  
  slide.addText('構成: Netlify + Supabase Storage + PayPal', {
    x: 0.5, y: 1.1, w: 9, h: 0.4,
    fontSize: 14,
    color: '666666',
    align: 'center'
  });
  
  const scenarioACost = [
    ['ユーザー数', 'Netlify', 'Supabase\nStorage', 'Supabase\nDB', 'PayPal', '固定費', '月間合計', '年間合計'],
    ['100名', '6,600円', '5,789円', '3,750円', '63,462円', '150円', '79,751円', '957,012円'],
    ['500名', '36,600円', '24,810円', '3,750円', '321,090円', '150円', '386,400円', '4,636,800円'],
    ['1,000名', '70,350円', '48,584円', '3,750円', '641,820円', '150円', '764,654円', '9,175,848円'],
    ['5,000名', '348,600円', '240,225円', '3,750円', '3,207,900円', '150円', '3,800,625円', '45,607,500円'],
    ['10,000名', '704,100円', '477,600円', '3,750円', '6,414,600円', '150円', '7,600,200円', '91,202,400円']
  ];
  
  slide.addTable(scenarioACost, {
    x: 0.2, y: 1.6, w: 9.6, h: 2.5,
    fontSize: 9,
    border: { pt: 1, color: 'CCCCCC' },
    fill: { color: 'FFFFFF' },
    color: '333333',
    align: 'center',
    valign: 'middle',
    rowH: 0.5
  });
  
  const scenarioAFeatures = [
    { text: '✅ メリット:', options: { bullet: false } },
    { text: '  • セットアップが最も簡単（1日で完了可能）', options: { bullet: false } },
    { text: '  • インフラ管理が不要', options: { bullet: false } },
    { text: '  • DevOps知識が不要', options: { bullet: false } },
    { text: '', options: { bullet: false } },
    { text: '❌ デメリット:', options: { bullet: false } },
    { text: '  • 最も高額（10,000名で月760万円）', options: { bullet: false } },
    { text: '  • スケール時にコストが爆発', options: { bullet: false } },
    { text: '  • カスタマイズ性が低い', options: { bullet: false } }
  ];
  
  slide.addText(scenarioAFeatures, {
    x: 1, y: 4.3, w: 8, h: 1.8,
    fontSize: 12,
    color: '333333',
    lineSpacing: 16
  });

  // スライド4: シナリオB - 部分最適化
  slide = pptx.addSlide();
  slide.background = bgGradient;
  slide.addText('シナリオB: 部分最適化（推奨: 初期）', {
    x: 0.5, y: 0.4, w: 9, h: 0.6,
    ...styles.heading1
  });
  
  slide.addText('構成: Netlify + Cloudflare R2 + PayPay', {
    x: 0.5, y: 1.1, w: 9, h: 0.4,
    fontSize: 14,
    color: '666666',
    align: 'center'
  });
  
  const scenarioBCost = [
    ['ユーザー数', 'Netlify', 'R2\n(イメージ)', 'Supabase\nDB', 'PayPay', '固定費', '月間合計', '年間合計', 'A比削減'],
    ['100名', '6,600円', '0円', '3,750円', '45,968円', '2,130円', '58,448円', '701,376円', '21,303円'],
    ['500名', '36,600円', '0円', '3,750円', '190,248円', '2,130円', '232,728円', '2,792,736円', '153,672円'],
    ['1,000名', '70,350円', '0円', '3,750円', '327,710円', '2,130円', '403,940円', '4,847,280円', '360,714円'],
    ['5,000名', '348,600円', '990円', '3,750円', '1,418,600円', '2,130円', '1,774,070円', '21,288,840円', '2,026,555円'],
    ['10,000名', '704,100円', '1,980円', '3,750円', '2,826,200円', '2,130円', '3,538,160円', '42,457,920円', '4,062,040円']
  ];
  
  slide.addTable(scenarioBCost, {
    x: 0.15, y: 1.6, w: 9.7, h: 2.5,
    fontSize: 8,
    border: { pt: 1, color: 'CCCCCC' },
    fill: { color: 'E8F5E9' },
    color: '333333',
    align: 'center',
    valign: 'middle',
    rowH: 0.5
  });
  
  const scenarioBFeatures = [
    { text: '✅ メリット:', options: { bullet: false } },
    { text: '  • R2でイメージコストほぼゼロ', options: { bullet: false } },
    { text: '  • PayPayで決済手数料50%削減', options: { bullet: false } },
    { text: '  • セットアップ比較的簡単（2～3日）', options: { bullet: false } },
    { text: '  • 1,000名で年間約360万円削減！', options: { bullet: false } },
    { text: '', options: { bullet: false } },
    { text: '⚠️ 注意点:', options: { bullet: false } },
    { text: '  • Netlify関数費用は依然として高い', options: { bullet: false } },
    { text: '  • 5,000名以降はさらなる最適化が必要', options: { bullet: false } }
  ];
  
  slide.addText(scenarioBFeatures, {
    x: 1, y: 4.3, w: 8, h: 1.8,
    fontSize: 12,
    color: '333333',
    lineSpacing: 16
  });

  // スライド5: シナリオC - Wasabi活用
  slide = pptx.addSlide();
  slide.background = bgGradient;
  slide.addText('シナリオC: Wasabi + Cloudflare CDN', {
    x: 0.5, y: 0.4, w: 9, h: 0.6,
    ...styles.heading1
  });
  
  slide.addText('構成: Netlify + Wasabi + Cloudflare CDN + PayPay', {
    x: 0.5, y: 1.1, w: 9, h: 0.4,
    fontSize: 14,
    color: '666666',
    align: 'center'
  });
  
  slide.addText('Wasabi 料金（Cloudflare Bandwidth Alliance 適用）', {
    x: 0.5, y: 1.6, w: 9, h: 0.3,
    fontSize: 13,
    bold: true,
    color: '4472C4'
  });
  
  const wasabiPricing = [
    ['項目', '料金', '備考'],
    ['ストレージ', '$6.99/TB/月', '最低1TB（約1,048円/TB）'],
    ['データ転送（Egress）', '$0.00', 'Cloudflare経由は完全無料！'],
    ['API リクエスト', '$0.00', 'すべて無料'],
    ['最低料金', '約1,048円/月', '1TB未満でも1TB分課金']
  ];
  
  slide.addTable(wasabiPricing, {
    x: 1.5, y: 2, w: 7, h: 2,
    fontSize: 11,
    border: { pt: 1, color: 'CCCCCC' },
    fill: { color: 'FFFFFF' },
    color: '333333',
    align: 'center',
    valign: 'middle',
    rowH: 0.5
  });
  
  const scenarioCCost = [
    ['ユーザー数', 'Netlify', 'Wasabi', 'CF CDN\n(無料)', 'Supabase\nDB', 'PayPay', '固定費', '月間合計'],
    ['100名', '6,600円', '1,048円', '0円', '3,750円', '45,968円', '2,130円', '59,496円'],
    ['500名', '36,600円', '1,048円', '0円', '3,750円', '190,248円', '2,130円', '233,776円'],
    ['1,000名', '70,350円', '1,048円', '0円', '3,750円', '327,710円', '2,130円', '404,988円'],
    ['5,000名', '348,600円', '1,048円', '0円', '3,750円', '1,418,600円', '2,130円', '1,774,128円'],
    ['10,000名', '704,100円', '2,096円', '0円', '3,750円', '2,826,200円', '2,130円', '3,538,276円']
  ];
  
  slide.addTable(scenarioCCost, {
    x: 0.3, y: 4.2, w: 9.4, h: 2.5,
    fontSize: 9,
    border: { pt: 1, color: 'CCCCCC' },
    fill: { color: 'FFF3CD' },
    color: '333333',
    align: 'center',
    valign: 'middle',
    rowH: 0.5
  });

  // スライド6: シナリオD - AWS部分移行
  slide = pptx.addSlide();
  slide.background = bgGradient;
  slide.addText('シナリオD: AWS 部分移行（推奨: 成長期）', {
    x: 0.5, y: 0.4, w: 9, h: 0.6,
    ...styles.heading1
  });
  
  slide.addText('構成: AWS Lambda/APIGW + Cloudflare R2 + PayPay', {
    x: 0.5, y: 1.1, w: 9, h: 0.4,
    fontSize: 14,
    color: '666666',
    align: 'center'
  });
  
  const scenarioDCost = [
    ['ユーザー数', 'Lambda\n+APIGW', 'R2\n(イメージ)', 'Supabase\nDB', 'PayPay', '固定費', '月間合計', '年間合計', 'A比削減'],
    ['100名', '500円', '0円', '3,750円', '45,968円', '2,130円', '52,348円', '628,176円', '27,403円'],
    ['500名', '2,000円', '0円', '3,750円', '190,248円', '2,130円', '198,128円', '2,377,536円', '187,272円'],
    ['1,000名', '3,236円', '0円', '3,750円', '327,710円', '2,130円', '336,826円', '4,041,912円', '427,828円'],
    ['5,000名', '15,000円', '990円', '3,750円', '1,418,600円', '2,130円', '1,440,470円', '17,285,640円', '2,360,155円'],
    ['10,000名', '25,000円', '1,980円', '3,750円', '2,826,200円', '2,130円', '2,859,060円', '34,308,720円', '4,741,140円']
  ];
  
  slide.addTable(scenarioDCost, {
    x: 0.15, y: 1.6, w: 9.7, h: 2.5,
    fontSize: 8,
    border: { pt: 1, color: 'CCCCCC' },
    fill: { color: 'E3F2FD' },
    color: '333333',
    align: 'center',
    valign: 'middle',
    rowH: 0.5
  });
  
  const scenarioDFeatures = [
    { text: '✅ メリット:', options: { bullet: false } },
    { text: '  • Lambda/APGWでインフラコスト大幅削減', options: { bullet: false } },
    { text: '  • R2で画像転送完全無料', options: { bullet: false } },
    { text: '  • 1,000名で年間約428万円削減！', options: { bullet: false } },
    { text: '  • スケールに強い（10,000名でも月286万円）', options: { bullet: false } },
    { text: '', options: { bullet: false } },
    { text: '⚠️ 注意点:', options: { bullet: false } },
    { text: '  • DevOps知識が必要（CI/CD構築、Lambda設定等）', options: { bullet: false } },
    { text: '  • 初期セットアップに1～2週間', options: { bullet: false } }
  ];
  
  slide.addText(scenarioDFeatures, {
    x: 1, y: 4.3, w: 8, h: 1.8,
    fontSize: 12,
    color: '333333',
    lineSpacing: 16
  });

  // スライド7: シナリオE - 完全AWS
  slide = pptx.addSlide();
  slide.background = bgGradient;
  slide.addText('シナリオE: 完全AWS移行（最大制御）', {
    x: 0.5, y: 0.4, w: 9, h: 0.6,
    ...styles.heading1
  });
  
  slide.addText('構成: EC2/ECS + S3 + CloudFront + RDS + PayPay', {
    x: 0.5, y: 1.1, w: 9, h: 0.4,
    fontSize: 14,
    color: '666666',
    align: 'center'
  });
  
  slide.addText('EC2/ECS サーバー費用', {
    x: 0.5, y: 1.6, w: 9, h: 0.3,
    fontSize: 13,
    bold: true,
    color: '4472C4'
  });
  
  const ec2Pricing = [
    ['ユーザー数', 'サーバー構成', 'EC2/ECS 月額', '備考'],
    ['100～500名', 't3.small × 1\n(2vCPU, 2GB)', '約2,500円', 'リザーブドインスタンス'],
    ['1,000～5,000名', 't3.medium × 2\n(2vCPU, 4GB)', '約10,000円', 'ALB + Auto Scaling'],
    ['10,000名～', 't3.large × 3\n(2vCPU, 8GB)', '約30,000円', 'マルチAZ構成']
  ];
  
  slide.addTable(ec2Pricing, {
    x: 1, y: 2, w: 8, h: 1.5,
    fontSize: 10,
    border: { pt: 1, color: 'CCCCCC' },
    fill: { color: 'FFFFFF' },
    color: '333333',
    align: 'center',
    valign: 'middle',
    rowH: 0.5
  });
  
  const scenarioECost = [
    ['ユーザー数', 'EC2/ECS', 'S3+CF', 'RDS\n(Postgres)', 'PayPay', '固定費', '月間合計', 'A比削減'],
    ['100名', '2,500円', '6,639円', '3,000円', '45,968円', '2,130円', '60,237円', '19,514円'],
    ['500名', '2,500円', '33,273円', '7,000円', '190,248円', '2,130円', '235,151円', '151,249円'],
    ['1,000名', '10,000円', '66,374円', '15,000円', '327,710円', '2,130円', '421,214円', '343,440円'],
    ['5,000名', '10,000円', '331,799円', '30,000円', '1,418,600円', '2,130円', '1,792,529円', '2,008,096円'],
    ['10,000名', '30,000円', '663,563円', '50,000円', '2,826,200円', '2,130円', '3,571,893円', '4,028,307円']
  ];
  
  slide.addTable(scenarioECost, {
    x: 0.3, y: 3.7, w: 9.4, h: 2.5,
    fontSize: 9,
    border: { pt: 1, color: 'CCCCCC' },
    fill: { color: 'FFFFFF' },
    color: '333333',
    align: 'center',
    valign: 'middle',
    rowH: 0.5
  });

  // スライド8: 完全AWS メリット・デメリット
  slide = pptx.addSlide();
  slide.background = bgGradient;
  slide.addText('シナリオE: 完全AWS の特徴', {
    x: 0.5, y: 0.4, w: 9, h: 0.6,
    ...styles.heading1
  });
  
  slide.addShape(pptx.ShapeType.rect, {
    x: 0.8, y: 1.2, w: 8.4, h: 2.2,
    fill: { color: 'E8F5E9' },
    line: { color: '4CAF50', width: 2 }
  });
  
  slide.addText('✅ メリット', {
    x: 1, y: 1.35, w: 8, h: 0.3,
    fontSize: 16,
    bold: true,
    color: '2E7D32'
  });
  
  const ec2Pros = [
    { text: '完全なコントロール: すべてのインフラを自由にカスタマイズ可能', options: { bullet: true } },
    { text: 'パフォーマンス最適化: 専用サーバーで最高のパフォーマンス', options: { bullet: true } },
    { text: 'セキュリティ: VPC、IAM、Security Groupで細かく制御', options: { bullet: true } },
    { text: 'スケーラビリティ: Auto Scalingで自動的に負荷対応', options: { bullet: true } },
    { text: '長期的なコスト効率: 大規模になるほど有利', options: { bullet: true } }
  ];
  
  slide.addText(ec2Pros, {
    x: 1.2, y: 1.75, w: 7.6, h: 1.5,
    fontSize: 12,
    color: '333333',
    lineSpacing: 20
  });
  
  slide.addShape(pptx.ShapeType.rect, {
    x: 0.8, y: 3.6, w: 8.4, h: 2.4,
    fill: { color: 'FFEBEE' },
    line: { color: 'F44336', width: 2 }
  });
  
  slide.addText('❌ デメリット', {
    x: 1, y: 3.75, w: 8, h: 0.3,
    fontSize: 16,
    bold: true,
    color: 'C62828'
  });
  
  const ec2Cons = [
    { text: '高度なDevOps知識が必須: サーバー管理、デプロイ、監視等', options: { bullet: true } },
    { text: '初期セットアップが複雑: 3～4週間の構築期間', options: { bullet: true } },
    { text: '運用負荷が高い: セキュリティパッチ、スケーリング、障害対応', options: { bullet: true } },
    { text: 'エンジニアリソースが必要: 専任DevOpsエンジニアが推奨', options: { bullet: true } },
    { text: '小規模時は割高: 100～500名ではオーバースペック', options: { bullet: true } },
    { text: 'CloudFront費用が高い: 画像転送で月66万円（10,000名時）', options: { bullet: true } }
  ];
  
  slide.addText(ec2Cons, {
    x: 1.2, y: 4.15, w: 7.6, h: 1.7,
    fontSize: 12,
    color: '333333',
    lineSpacing: 18
  });

  // スライド9: 全シナリオ比較表
  slide = pptx.addSlide();
  slide.background = bgGradient;
  slide.addText('全シナリオ総合比較（1,000名基準）', {
    x: 0.5, y: 0.4, w: 9, h: 0.6,
    ...styles.heading1
  });
  
  const comparisonTable = [
    ['項目', 'A\n現状維持', 'B\n部分最適化', 'C\nWasabi', 'D\nAWS部分', 'E\n完全AWS'],
    ['インフラ', 'Netlify\n70,350円', 'Netlify\n70,350円', 'Netlify\n70,350円', 'Lambda\n3,236円', 'EC2\n10,000円'],
    ['イメージ', 'Supabase\n48,584円', 'R2\n0円', 'Wasabi\n1,048円', 'R2\n0円', 'S3+CF\n66,374円'],
    ['DB', 'Supabase\n3,750円', 'Supabase\n3,750円', 'Supabase\n3,750円', 'Supabase\n3,750円', 'RDS\n15,000円'],
    ['決済', 'PayPal\n641,820円', 'PayPay\n327,710円', 'PayPay\n327,710円', 'PayPay\n327,710円', 'PayPay\n327,710円'],
    ['固定費', '150円', '2,130円', '2,130円', '2,130円', '2,130円'],
    ['月間合計', '764,654円', '403,940円', '404,988円', '336,826円', '421,214円'],
    ['年間合計', '9,175,848円', '4,847,280円', '4,859,856円', '4,041,912円', '5,054,568円'],
    ['A比削減', '-', '360,714円', '359,666円', '427,828円', '343,440円']
  ];
  
  slide.addTable(comparisonTable, {
    x: 0.2, y: 1.2, w: 9.6, h: 4.5,
    fontSize: 8,
    border: { pt: 1, color: 'CCCCCC' },
    fill: { color: 'FFFFFF' },
    color: '333333',
    align: 'center',
    valign: 'middle',
    rowH: 0.5
  });
  
  slide.addText('🏆 1,000名時点の最安: シナリオD（AWS部分移行）= 月336,826円', {
    x: 1, y: 5.9, w: 8, h: 0.4,
    fontSize: 14,
    bold: true,
    color: '2E7D32',
    align: 'center'
  });

  // スライド10: 全シナリオ比較表 (10,000名)
  slide = pptx.addSlide();
  slide.background = bgGradient;
  slide.addText('全シナリオ総合比較（10,000名基準）', {
    x: 0.5, y: 0.4, w: 9, h: 0.6,
    ...styles.heading1
  });
  
  const comparison10k = [
    ['項目', 'A\n現状維持', 'B\n部分最適化', 'C\nWasabi', 'D\nAWS部分', 'E\n完全AWS'],
    ['インフラ', 'Netlify\n704,100円', 'Netlify\n704,100円', 'Netlify\n704,100円', 'Lambda\n25,000円', 'EC2\n30,000円'],
    ['イメージ', 'Supabase\n477,600円', 'R2\n1,980円', 'Wasabi\n2,096円', 'R2\n1,980円', 'S3+CF\n663,563円'],
    ['DB', 'Supabase\n3,750円', 'Supabase\n3,750円', 'Supabase\n3,750円', 'Supabase\n3,750円', 'RDS\n50,000円'],
    ['決済', 'PayPal\n6,414,600円', 'PayPay\n2,826,200円', 'PayPay\n2,826,200円', 'PayPay\n2,826,200円', 'PayPay\n2,826,200円'],
    ['固定費', '150円', '2,130円', '2,130円', '2,130円', '2,130円'],
    ['月間合計', '7,600,200円', '3,538,160円', '3,538,276円', '2,859,060円', '3,571,893円'],
    ['年間合計', '91,202,400円', '42,457,920円', '42,459,312円', '34,308,720円', '42,862,716円'],
    ['A比削減', '-', '4,062,040円', '4,061,924円', '4,741,140円', '4,028,307円']
  ];
  
  slide.addTable(comparison10k, {
    x: 0.2, y: 1.2, w: 9.6, h: 4.5,
    fontSize: 8,
    border: { pt: 1, color: 'CCCCCC' },
    fill: { color: 'FFFFFF' },
    color: '333333',
    align: 'center',
    valign: 'middle',
    rowH: 0.5
  });
  
  slide.addText('🏆 10,000名時点の最安: シナリオD（AWS部分移行）= 月2,859,060円', {
    x: 0.8, y: 5.9, w: 8.4, h: 0.4,
    fontSize: 14,
    bold: true,
    color: '2E7D32',
    align: 'center'
  });

  // スライド11: 段階別推奨戦略
  slide = pptx.addSlide();
  slide.background = bgGradient;
  slide.addText('🎯 段階別推奨戦略', {
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
  
  slide.addText('推奨: シナリオB（Netlify + R2 + PayPay）\n理由: 開発速度優先、インフラ管理不要、月6～24万円\n期間: 3～6ヶ月', {
    x: 1.2, y: 1.75, w: 7.6, h: 0.6,
    fontSize: 12,
    color: '333333'
  });
  
  slide.addShape(pptx.ShapeType.rect, {
    x: 0.8, y: 2.7, w: 8.4, h: 1.3,
    fill: { color: 'FFF3CD' },
    line: { color: 'FFC107', width: 2 }
  });
  
  slide.addText('Phase 2: 成長段階（500～1,000名）', {
    x: 1, y: 2.85, w: 8, h: 0.3,
    fontSize: 15,
    bold: true,
    color: '856404'
  });
  
  slide.addText('推奨: シナリオC（Netlify + Wasabi + CF CDN + PayPay）\n理由: コスト最適化開始、Netlify関数費用は容認、月24～40万円\n期間: 6～12ヶ月', {
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
  
  slide.addText('推奨: シナリオD（AWS Lambda + R2 + PayPay）\n理由: 最高のコストパフォーマンス、月34～286万円\nDevOpsエンジニア雇用コストを考慮しても最適', {
    x: 1.2, y: 4.75, w: 7.6, h: 0.6,
    fontSize: 12,
    color: '333333'
  });
  
  slide.addText('⚠️ シナリオE（完全AWS）は10,000名以上かつ専任DevOpsチームがある場合のみ推奨', {
    x: 1.2, y: 5.6, w: 7.6, h: 0.4,
    fontSize: 11,
    color: 'C00000',
    italic: true
  });

  // スライド12: 最終推奨
  slide = pptx.addSlide();
  slide.background = bgGradient;
  slide.addText('最終推奨: シナリオD（AWS部分移行）', {
    x: 0.5, y: 0.4, w: 9, h: 0.6,
    ...styles.heading1
  });
  
  slide.addShape(pptx.ShapeType.rect, {
    x: 0.8, y: 1.2, w: 8.4, h: 4.8,
    fill: { color: 'E8F5E9' },
    line: { color: '4CAF50', width: 3 }
  });
  
  slide.addText('🎯 AWS Lambda/APIGW + Cloudflare R2 + PayPay', {
    x: 1, y: 1.4, w: 8, h: 0.4,
    fontSize: 20,
    bold: true,
    color: '2E7D32'
  });
  
  const finalRecommendation = [
    { text: '✅ 圧倒的なコストパフォーマンス', options: { bullet: true } },
    { text: '  • 1,000名: 月34万円（シナリオA比 年間513万円削減）', options: { bullet: false } },
    { text: '  • 10,000名: 月286万円（シナリオA比 年間569万円削減）', options: { bullet: false } },
    { text: '', options: { bullet: false } },
    { text: '✅ スケーラビリティ', options: { bullet: true } },
    { text: '  • Lambda: 自動スケーリング、無制限の同時実行', options: { bullet: false } },
    { text: '  • R2: 転送費用完全無料、グローバルCDN', options: { bullet: false } },
    { text: '', options: { bullet: false } },
    { text: '✅ 実装の現実性', options: { bullet: true } },
    { text: '  • DevOps知識は必要だが、完全AWS より簡単', options: { bullet: false } },
    { text: '  • 1～2週間でセットアップ可能', options: { bullet: false } },
    { text: '  • Netlify→Lambda移行は段階的に実施可能', options: { bullet: false } },
    { text: '', options: { bullet: false } },
    { text: '💰 投資対効果', options: { bullet: true } },
    { text: '  • DevOpsエンジニア月給50万円としても年間600万円', options: { bullet: false } },
    { text: '  • 削減効果は年間513～569万円 → ほぼペイする！', options: { bullet: false } }
  ];
  
  slide.addText(finalRecommendation, {
    x: 1.2, y: 1.9, w: 7.6, h: 3.9,
    fontSize: 11,
    color: '333333',
    lineSpacing: 14
  });

  // ファイル保存
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
  const pptPath = join(projectRoot, `総合インフラ費用比較_${timestamp}.pptx`);
  
  await pptx.writeFile({ fileName: pptPath });
  
  console.log(`\n✅ PPT作成完了!`);
  console.log(`📄 ファイル: ${pptPath}`);
  console.log(`📊 総スライド数: ${pptx.slides.length}枚`);
}

createComprehensiveCostPPT().catch(console.error);









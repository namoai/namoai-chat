import pptxgen from 'pptxgenjs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// PPT 生成
const ppt = new pptxgen();

// 基本設定
ppt.layout = 'LAYOUT_16x9';
ppt.author = 'Namos Chat Team';
ppt.title = 'ナモスチャット サービス説明書';
ppt.subject = 'AIキャラクター対話プラットフォーム';

// 色設定
const colors = {
  primary: '2563EB',
  secondary: '1E40AF',
  accent: '3B82F6',
  light: 'EFF6FF',
  lightGray: 'F8FAFC',
  dark: '1E293B',
  white: 'FFFFFF',
  text: '333333',
  gradient1: '60A5FA',
  gradient2: '3B82F6'
};

// 背景パターン追加関数
function addBackgroundPattern(slide) {
  // 薄いグラデーション背景
  slide.addShape(ppt.ShapeType.rect, {
    x: 0, y: 0, w: '100%', h: '100%',
    fill: { color: colors.lightGray }
  });
  
  // 装飾円
  slide.addShape(ppt.ShapeType.ellipse, {
    x: 8, y: -1, w: 3, h: 3,
    fill: { color: colors.light, transparency: 50 },
    line: { type: 'none' }
  });
  
  slide.addShape(ppt.ShapeType.ellipse, {
    x: -1, y: 4, w: 2.5, h: 2.5,
    fill: { color: colors.accent, transparency: 80 },
    line: { type: 'none' }
  });
}

// ===== スライド1: 表紙 =====
let slide = ppt.addSlide();
slide.background = { color: colors.primary };

// 背景装飾
slide.addShape(ppt.ShapeType.ellipse, {
  x: 7, y: -2, w: 5, h: 5,
  fill: { color: colors.gradient1, transparency: 30 },
  line: { type: 'none' }
});
slide.addShape(ppt.ShapeType.ellipse, {
  x: -2, y: 3, w: 4, h: 4,
  fill: { color: colors.gradient2, transparency: 40 },
  line: { type: 'none' }
});

slide.addText('ナモスチャット', {
  x: 0.5, y: 2, w: 9, h: 1,
  fontSize: 60, bold: true, color: colors.white, align: 'center'
});
slide.addText('AIキャラクターと対話する新しい体験', {
  x: 0.5, y: 3.2, w: 9, h: 0.6,
  fontSize: 24, color: colors.light, align: 'center'
});
slide.addText('Namos Chat Service Introduction', {
  x: 0.5, y: 4, w: 9, h: 0.4,
  fontSize: 16, color: colors.light, align: 'center', italic: true
});
slide.addText('2025年11月 | Version 1.0', {
  x: 0.5, y: 5, w: 9, h: 0.3,
  fontSize: 14, color: colors.light, align: 'center'
});

// ===== スライド2: サービス紹介 =====
slide = ppt.addSlide();
addBackgroundPattern(slide);

slide.addText('サービス紹介', {
  x: 0.5, y: 0.3, w: 9, h: 0.6,
  fontSize: 36, bold: true, color: colors.primary
});

slide.addShape(ppt.ShapeType.rect, {
  x: 0.5, y: 1.1, w: 9, h: 1.3,
  fill: { color: colors.white },
  line: { color: colors.accent, width: 2 }
});

slide.addText([
  { text: 'ナモスチャットとは？\n', options: { fontSize: 20, bold: true, color: colors.secondary, breakLine: true } },
  { text: 'ユーザーが', options: { fontSize: 16, color: colors.text } },
  { text: '様々なAI世界観', options: { fontSize: 16, color: colors.accent, bold: true } },
  { text: 'と自由に対話しながら\nストーリーを作り上げていくプラットフォーム', options: { fontSize: 16, color: colors.text } }
], {
  x: 0.7, y: 1.3, w: 8.6, h: 1
});

slide.addShape(ppt.ShapeType.rect, {
  x: 0.5, y: 2.6, w: 9, h: 2.2,
  fill: { color: colors.light },
  line: { type: 'none' }
});

slide.addText([
  { text: '💡 わかりやすい例え\n\n', options: { fontSize: 18, bold: true, color: colors.secondary } },
  { text: '「YouTubeで誰もが動画を投稿・視聴するように、\n', options: { fontSize: 15, color: colors.text } },
  { text: '  ナモスチャットでは', options: { fontSize: 15, color: colors.text } },
  { text: '誰もが世界観を制作・プレイできます', options: { fontSize: 15, color: colors.accent, bold: true } },
  { text: '」\n\n', options: { fontSize: 15, color: colors.text } },
  { text: '• YouTube: クリエイターが動画制作 → 視聴者が視聴\n', options: { fontSize: 14, color: colors.text } },
  { text: '• ナモスチャット: 創作者が世界観制作 → ユーザーがプレイ', options: { fontSize: 14, color: colors.text } }
], {
  x: 0.7, y: 2.8, w: 8.6, h: 2
});

// ===== スライド3: サービスの特別さ =====
slide = ppt.addSlide();
addBackgroundPattern(slide);

slide.addText('サービスの特別さ', {
  x: 0.5, y: 0.3, w: 9, h: 0.6,
  fontSize: 36, bold: true, color: colors.primary
});

const features = [
  { icon: '🎨', title: '誰もがクリエイター', desc: 'コーディング不要で\nAI世界観を制作' },
  { icon: '🎭', title: '無限の世界観', desc: 'ファンタジー、現代\nSF、ロマンスなど' },
  { icon: '👤', title: '自分だけのアイデンティティ', desc: 'ペルソナシステムで\nカスタム体験' },
  { icon: '💬', title: '自然な会話', desc: 'Google AIで\n実際の人のように' },
  { icon: '🌐', title: '創作者経済', desc: '人気世界観は\n収益化可能' }
];

features.forEach((feature, idx) => {
  const row = Math.floor(idx / 3);
  const col = idx % 3;
  
  slide.addShape(ppt.ShapeType.rect, {
    x: 0.5 + col * 3.3, y: 1.2 + row * 2.2, w: 3, h: 2,
    fill: { color: colors.white },
    line: { color: colors.accent, width: 1 }
  });
  
  slide.addText([
    { text: feature.icon + '\n', options: { fontSize: 36 } },
    { text: feature.title + '\n', options: { fontSize: 15, bold: true, color: colors.secondary } },
    { text: feature.desc, options: { fontSize: 12, color: colors.text } }
  ], {
    x: 0.5 + col * 3.3, y: 1.4 + row * 2.2, w: 3, h: 1.8,
    align: 'center', valign: 'middle'
  });
});

// ===== スライド4: キャラクターシステム概要 =====
slide = ppt.addSlide();
addBackgroundPattern(slide);

slide.addText('1. キャラクターシステム (世界観ベース)', {
  x: 0.5, y: 0.3, w: 9, h: 0.6,
  fontSize: 30, bold: true, color: colors.primary
});

slide.addShape(ppt.ShapeType.rect, {
  x: 0.5, y: 1, w: 9, h: 1,
  fill: { color: colors.accent },
  line: { type: 'none' }
});

slide.addText('⭐ 重要: ユーザーが直接制作します！', {
  x: 0.7, y: 1.3, w: 8.6, h: 0.5,
  fontSize: 20, bold: true, color: colors.white, align: 'center'
});

slide.addText([
  { text: 'キャラクターとは？\n', options: { fontSize: 18, bold: true, color: colors.secondary } },
  { text: '単純な「1人のAI」ではありません\n', options: { fontSize: 15, color: colors.text } },
  { text: '→ ', options: { fontSize: 15, color: colors.text } },
  { text: '1つの完全な世界観 + 複数の登場人物', options: { fontSize: 15, color: colors.accent, bold: true } },
  { text: 'を含む\n   総合ストーリーテリングシステム', options: { fontSize: 15, color: colors.text } }
], {
  x: 0.5, y: 2.2, w: 9, h: 1.2
});

slide.addShape(ppt.ShapeType.rect, {
  x: 0.5, y: 3.5, w: 9, h: 1.8,
  fill: { color: colors.light },
  line: { color: colors.primary, width: 2 }
});

slide.addText([
  { text: '🌍 映画1本を作るようなもの\n\n', options: { fontSize: 17, bold: true, color: colors.secondary } },
  { text: '• 世界観 = 映画の背景設定 (時代、場所、ルール)\n', options: { fontSize: 14, color: colors.text } },
  { text: '• 登場人物 = 主人公、脇役の性格と関係\n', options: { fontSize: 14, color: colors.text } },
  { text: '• ユーザー = その世界に入り直接ストーリーを作る主人公', options: { fontSize: 14, color: colors.text } }
], {
  x: 0.7, y: 3.7, w: 8.6, h: 1.6
});

// ===== スライド5: 世界観の例 =====
slide = ppt.addSlide();
addBackgroundPattern(slide);

slide.addText('多様なジャンルの世界観', {
  x: 0.5, y: 0.3, w: 9, h: 0.6,
  fontSize: 32, bold: true, color: colors.primary
});

const genres = [
  { genre: 'ファンタジー', example: '魔法学校\n中世王国', feature: '魔法使い、騎士\n竜と冒険' },
  { genre: '現代', example: '大学、会社', feature: '日常的で\n共感できる物語' },
  { genre: 'SF', example: '宇宙ステーション\n未来都市', feature: '科学技術と\n未来社会' },
  { genre: 'ロマンス', example: '財閥学校\n芸能事務所', feature: '感性的な関係\nと葛藤' },
  { genre: 'ミステリー', example: '探偵事務所\n犯罪組織', feature: '推理と緊張感' }
];

genres.forEach((item, idx) => {
  const row = Math.floor(idx / 3);
  const col = idx % 3;
  
  slide.addShape(ppt.ShapeType.rect, {
    x: 0.5 + col * 3.3, y: 1 + row * 2.2, w: 3, h: 2,
    fill: { color: colors.white },
    line: { color: colors.accent, width: 1 }
  });
  
  slide.addText([
    { text: item.genre + '\n', options: { fontSize: 16, bold: true, color: colors.primary } },
    { text: item.example + '\n', options: { fontSize: 12, color: colors.secondary } },
    { text: '━━━\n', options: { fontSize: 8, color: colors.accent } },
    { text: item.feature, options: { fontSize: 11, color: colors.text } }
  ], {
    x: 0.6 + col * 3.3, y: 1.2 + row * 2.2, w: 2.8, h: 1.8,
    align: 'center', valign: 'middle'
  });
});

// ===== スライド6: 実際の例 - 財閥学校 =====
slide = ppt.addSlide();
addBackgroundPattern(slide);

slide.addText('実際の例: 「財閥学校ロマンス」', {
  x: 0.5, y: 0.3, w: 9, h: 0.6,
  fontSize: 30, bold: true, color: colors.primary
});

slide.addShape(ppt.ShapeType.rect, {
  x: 0.5, y: 1, w: 4.3, h: 4.3,
  fill: { color: colors.white },
  line: { color: colors.primary, width: 2 }
});

slide.addText([
  { text: '📚 世界観設定\n', options: { fontSize: 16, bold: true, color: colors.secondary } },
  { text: '• タイトル: 「青雲高等教育機関」\n', options: { fontSize: 13, color: colors.text } },
  { text: '• 背景: 財閥、政治家、芸能人の\n  子女だけが通う超高級私立学校\n', options: { fontSize: 12, color: colors.text } },
  { text: '• 特徴: 極端な身分差、3大派閥\n  (企業/政府/芸能界)、\n  特別奨学生への差別\n', options: { fontSize: 12, color: colors.text } },
  { text: '• 雰囲気: 学園コメディロマンス', options: { fontSize: 12, color: colors.text } }
], {
  x: 0.7, y: 1.2, w: 4, h: 4
});

slide.addShape(ppt.ShapeType.rect, {
  x: 5, y: 1, w: 4.5, h: 4.3,
  fill: { color: colors.light },
  line: { color: colors.accent, width: 2 }
});

slide.addText([
  { text: '👥 登場人物 (すべてAIが演技)\n', options: { fontSize: 15, bold: true, color: colors.secondary } },
  { text: '━━━━━━━━━━━━━━\n', options: { fontSize: 8, color: colors.accent } },
  { text: '• カン・ソヨン\n', options: { fontSize: 12, bold: true, color: colors.primary } },
  { text: '  青雲グループ後継者、冷たく\n  無愛想な財閥令嬢\n\n', options: { fontSize: 11, color: colors.text } },
  { text: '• イ・ナギョン\n', options: { fontSize: 12, bold: true, color: colors.primary } },
  { text: '  金融財閥の娘、嫉妬深い虚勢女\n\n', options: { fontSize: 11, color: colors.text } },
  { text: '• チョン・ユンハ\n', options: { fontSize: 12, bold: true, color: colors.primary } },
  { text: '  国務総理の孫娘、最年少国会議員\n\n', options: { fontSize: 11, color: colors.text } },
  { text: '• ユン・チェリン\n', options: { fontSize: 12, bold: true, color: colors.primary } },
  { text: '  一般家庭出身の奨学生、\n  毎日いじめられる\n\n', options: { fontSize: 11, color: colors.text } },
  { text: '• キム・ソジン\n', options: { fontSize: 12, bold: true, color: colors.primary } },
  { text: '  東アジア最大マフィア組織の後継者', options: { fontSize: 11, color: colors.text } }
], {
  x: 5.2, y: 1.2, w: 4.3, h: 4
});

// ===== スライド7: ユーザーができること =====
slide = ppt.addSlide();
addBackgroundPattern(slide);

slide.addText('ユーザーができること', {
  x: 0.5, y: 0.3, w: 9, h: 0.6,
  fontSize: 32, bold: true, color: colors.primary
});

slide.addShape(ppt.ShapeType.rect, {
  x: 0.5, y: 1, w: 4.3, h: 4.3,
  fill: { color: colors.white },
  line: { color: colors.primary, width: 2 }
});

slide.addText([
  { text: '🎮 プレイヤーとして\n', options: { fontSize: 18, bold: true, color: colors.primary } },
  { text: '━━━━━━━━━━\n', options: { fontSize: 8, color: colors.accent } },
  { text: '✅ 世界観探索\n', options: { fontSize: 14, bold: true, color: colors.secondary } },
  { text: '   他の創作者が作った数百の\n   世界観から選択\n\n', options: { fontSize: 12, color: colors.text } },
  { text: '✅ ストーリー体験\n', options: { fontSize: 14, bold: true, color: colors.secondary } },
  { text: '   選んだ世界観で自由に対話しながら\n   物語を展開\n\n', options: { fontSize: 12, color: colors.text } },
  { text: '✅ 画像送信\n', options: { fontSize: 14, bold: true, color: colors.secondary } },
  { text: '   チャットに画像を送るとAIが認識し反応\n\n', options: { fontSize: 12, color: colors.text } },
  { text: '✅ いいね＆コメント\n', options: { fontSize: 14, bold: true, color: colors.secondary } },
  { text: '   気に入った世界観に反応表示', options: { fontSize: 12, color: colors.text } }
], {
  x: 0.7, y: 1.2, w: 4, h: 4
});

slide.addShape(ppt.ShapeType.rect, {
  x: 5, y: 1, w: 4.5, h: 4.3,
  fill: { color: colors.light },
  line: { color: colors.accent, width: 2 }
});

slide.addText([
  { text: '🎨 創作者として\n', options: { fontSize: 18, bold: true, color: colors.primary } },
  { text: '━━━━━━━━━━\n', options: { fontSize: 8, color: colors.accent } },
  { text: '✅ 世界観生成\n', options: { fontSize: 14, bold: true, color: colors.secondary } },
  { text: '   自分だけの独創的な世界と登場人物を制作\n\n', options: { fontSize: 12, color: colors.text } },
  { text: '✅ 詳細設定\n', options: { fontSize: 14, bold: true, color: colors.secondary } },
  { text: '   世界観ルール、登場人物の外見/性格/\n   背景、関係図など\n\n', options: { fontSize: 12, color: colors.text } },
  { text: '✅ 画像＆キーワード\n', options: { fontSize: 14, bold: true, color: colors.secondary } },
  { text: '   キャラクター画像をアップロードし\n   キーワード設定(感情、状況別)\n\n', options: { fontSize: 12, color: colors.text } },
  { text: '✅ ロアブック作成\n', options: { fontSize: 14, bold: true, color: colors.secondary } },
  { text: '   世界観の歴史、用語、重要設定を記録\n\n', options: { fontSize: 12, color: colors.text } },
  { text: '✅ 収益化\n', options: { fontSize: 14, bold: true, color: colors.secondary } },
  { text: '   人気世界観に成長時、将来的に収益可能', options: { fontSize: 12, color: colors.text } }
], {
  x: 5.2, y: 1.2, w: 4.3, h: 4
});

// ===== スライド8: ペルソナシステム =====
slide = ppt.addSlide();
addBackgroundPattern(slide);

slide.addText('2. ペルソナシステム', {
  x: 0.5, y: 0.3, w: 9, h: 0.6,
  fontSize: 32, bold: true, color: colors.primary
});

slide.addShape(ppt.ShapeType.rect, {
  x: 0.5, y: 1, w: 9, h: 1.2,
  fill: { color: colors.accent },
  line: { type: 'none' }
});

slide.addText([
  { text: 'ペルソナとは？\n', options: { fontSize: 18, bold: true, color: colors.white } },
  { text: 'ユーザーが自分の身分やアイデンティティを設定する機能', options: { fontSize: 15, color: colors.white } }
], {
  x: 0.7, y: 1.2, w: 8.6, h: 1
});

slide.addShape(ppt.ShapeType.rect, {
  x: 0.5, y: 2.4, w: 9, h: 1,
  fill: { color: colors.light },
  line: { color: colors.primary, width: 1 }
});

slide.addText([
  { text: '💡 核心: ', options: { fontSize: 15, bold: true, color: colors.primary } },
  { text: 'ペルソナは', options: { fontSize: 14, color: colors.text } },
  { text: 'ユーザー自身の身分証明書', options: { fontSize: 14, color: colors.accent, bold: true } },
  { text: 'です\nAIはこの情報をもとにユーザーを認識し、適切に反応します', options: { fontSize: 14, color: colors.text } }
], {
  x: 0.7, y: 2.6, w: 8.6, h: 0.8
});

slide.addText('📌 例 (財閥学校世界観)', {
  x: 0.5, y: 3.6, w: 9, h: 0.4,
  fontSize: 16, bold: true, color: colors.secondary
});

const personaExamples = [
  { setting: '「私は特別奨学生だ」', reaction: 'AIが私を一般人学生として認識し反応' },
  { setting: '「私は財閥2世だ」', reaction: 'AIが私を上流階級として認識し反応' },
  { setting: '「私は転校生だ」', reaction: 'AIが私を新入生として認識し反応' }
];

personaExamples.forEach((example, idx) => {
  slide.addShape(ppt.ShapeType.rect, {
    x: 0.5, y: 4.1 + idx * 0.5, w: 4.2, h: 0.4,
    fill: { color: colors.white },
    line: { color: colors.accent, width: 1 }
  });
  
  slide.addText(example.setting, {
    x: 0.6, y: 4.15 + idx * 0.5, w: 4, h: 0.3,
    fontSize: 12, bold: true, color: colors.primary
  });
  
  slide.addShape(ppt.ShapeType.rightArrow, {
    x: 4.8, y: 4.2 + idx * 0.5, w: 0.3, h: 0.2,
    fill: { color: colors.accent },
    line: { type: 'none' }
  });
  
  slide.addShape(ppt.ShapeType.rect, {
    x: 5.3, y: 4.1 + idx * 0.5, w: 4.2, h: 0.4,
    fill: { color: colors.light },
    line: { type: 'none' }
  });
  
  slide.addText(example.reaction, {
    x: 5.4, y: 4.15 + idx * 0.5, w: 4, h: 0.3,
    fontSize: 11, color: colors.text
  });
});

// ===== スライド9: チャットシステム =====
slide = ppt.addSlide();
addBackgroundPattern(slide);

slide.addText('3. チャットシステム', {
  x: 0.5, y: 0.3, w: 9, h: 0.6,
  fontSize: 32, bold: true, color: colors.primary
});

const chatFeatures = [
  { icon: '✨', title: '自然な会話', desc: 'Google Gemini AI技術で\n実際の人のように反応\n文脈を理解し記憶' },
  { icon: '🖼️', title: '画像システム', desc: 'ユーザー⇔AI 画像送受信\nキーワード基盤\n自動画像出力' },
  { icon: '🔄', title: '会話再生成', desc: 'AIの回答が気に入らなければ\n再生成リクエスト\n複数バージョンから選択' },
  { icon: '📝', title: 'ユーザーノート', desc: 'ストーリー進行過程を\n直接記録\n次回計画メモ' },
  { icon: '🧠', title: 'メモリーシステム\n(追加予定)', desc: 'AIが重要な会話内容を\n自動的に記憶\nキャラクター別関係記録' },
  { icon: '📊', title: '状態システム', desc: 'キャラクター別好感度\n現在位置、服装\n時間帯の変化' }
];

chatFeatures.forEach((feature, idx) => {
  const row = Math.floor(idx / 3);
  const col = idx % 3;
  
  slide.addShape(ppt.ShapeType.rect, {
    x: 0.5 + col * 3.3, y: 1 + row * 2.2, w: 3, h: 2,
    fill: { color: colors.white },
    line: { color: colors.accent, width: 1 }
  });
  
  slide.addText([
    { text: feature.icon + '\n', options: { fontSize: 32 } },
    { text: feature.title + '\n', options: { fontSize: 13, bold: true, color: colors.secondary } },
    { text: '━━━\n', options: { fontSize: 8, color: colors.accent } },
    { text: feature.desc, options: { fontSize: 10, color: colors.text } }
  ], {
    x: 0.6 + col * 3.3, y: 1.1 + row * 2.2, w: 2.8, h: 1.9,
    align: 'center', valign: 'middle'
  });
});

// ===== スライド10: 画像システム詳細 =====
slide = ppt.addSlide();
addBackgroundPattern(slide);

slide.addText('画像システム詳細', {
  x: 0.5, y: 0.3, w: 9, h: 0.6,
  fontSize: 32, bold: true, color: colors.primary
});

slide.addShape(ppt.ShapeType.rect, {
  x: 0.5, y: 1, w: 4.3, h: 2,
  fill: { color: colors.white },
  line: { color: colors.primary, width: 2 }
});

slide.addText([
  { text: '📤 ユーザー → AI\n', options: { fontSize: 16, bold: true, color: colors.primary } },
  { text: '━━━━━━━━\n', options: { fontSize: 8, color: colors.accent } },
  { text: '写真を送ると\nAIが画像を認識し反応', options: { fontSize: 14, color: colors.text } }
], {
  x: 0.7, y: 1.2, w: 4, h: 1.8,
  align: 'center', valign: 'middle'
});

slide.addShape(ppt.ShapeType.rect, {
  x: 5, y: 1, w: 4.5, h: 2,
  fill: { color: colors.light },
  line: { color: colors.accent, width: 2 }
});

slide.addText([
  { text: '📥 AI → ユーザー\n', options: { fontSize: 16, bold: true, color: colors.primary } },
  { text: '━━━━━━━━\n', options: { fontSize: 8, color: colors.accent } },
  { text: 'AIが会話状況に合った\n画像を自動表示', options: { fontSize: 14, color: colors.text } }
], {
  x: 5.2, y: 1.2, w: 4.3, h: 1.8,
  align: 'center', valign: 'middle'
});

slide.addShape(ppt.ShapeType.rect, {
  x: 0.5, y: 3.2, w: 9, h: 2.1,
  fill: { color: colors.white },
  line: { color: colors.primary, width: 2 }
});

slide.addText([
  { text: '🔧 仕組み\n', options: { fontSize: 16, bold: true, color: colors.secondary } },
  { text: '━━━━━━━━━━━━━━━━━━━━━━━━\n', options: { fontSize: 8, color: colors.accent } },
  { text: '1. 制作者が予め画像をアップロードし', options: { fontSize: 13, color: colors.text, bold: true } },
  { text: 'キーワード設定\n', options: { fontSize: 13, color: colors.accent, bold: true } },
  { text: '   例: 「笑顔」「怒り」「悲しみ」「驚き」など\n\n', options: { fontSize: 12, color: colors.text } },
  { text: '2. AIが会話中に', options: { fontSize: 13, color: colors.text, bold: true } },
  { text: 'キーワードに該当する状況', options: { fontSize: 13, color: colors.accent, bold: true } },
  { text: 'で\n   自動的に画像出力\n\n', options: { fontSize: 13, color: colors.text, bold: true } },
  { text: '💡 例: 「怒り」キーワード → キャラクターが怒った表情の画像表示', options: { fontSize: 12, color: colors.text, italic: true } }
], {
  x: 0.7, y: 3.4, w: 8.6, h: 1.9
});

// ===== スライド11: 創作者の旅 =====
slide = ppt.addSlide();
addBackgroundPattern(slide);

slide.addText('創作者の旅 - 誰でも可能！', {
  x: 0.5, y: 0.3, w: 9, h: 0.6,
  fontSize: 30, bold: true, color: colors.primary
});

slide.addShape(ppt.ShapeType.rect, {
  x: 0.5, y: 1, w: 4.3, h: 1.5,
  fill: { color: colors.accent },
  line: { type: 'none' }
});

slide.addText([
  { text: '✅ 必要なもの\n', options: { fontSize: 15, bold: true, color: colors.white } },
  { text: '• 想像力 (最も重要！)\n', options: { fontSize: 13, color: colors.white } },
  { text: '• インターネットブラウザ\n\n', options: { fontSize: 13, color: colors.white } },
  { text: '❌ 不要\n', options: { fontSize: 15, bold: true, color: colors.white } },
  { text: '• コーディング知識\n', options: { fontSize: 13, color: colors.white } },
  { text: '• デザイン能力', options: { fontSize: 13, color: colors.white } }
], {
  x: 0.7, y: 1.1, w: 4, h: 1.4
});

slide.addShape(ppt.ShapeType.rect, {
  x: 5, y: 1, w: 4.5, h: 4.3,
  fill: { color: colors.white },
  line: { color: colors.primary, width: 2 }
});

slide.addText([
  { text: '📝 制作過程\n', options: { fontSize: 16, bold: true, color: colors.secondary } },
  { text: '━━━━━━━━━━━━\n', options: { fontSize: 8, color: colors.accent } },
  { text: '1️⃣ 世界観基本設定\n', options: { fontSize: 13, bold: true, color: colors.primary } },
  { text: '   タイトル、ジャンル、背景、ルール\n\n', options: { fontSize: 11, color: colors.text } },
  { text: '2️⃣ 登場人物設定\n', options: { fontSize: 13, bold: true, color: colors.primary } },
  { text: '   名前、外見、性格、関係\n\n', options: { fontSize: 11, color: colors.text } },
  { text: '3️⃣ 画像アップロード + キーワード設定\n', options: { fontSize: 13, bold: true, color: colors.primary } },
  { text: '   感情・状況別の画像\n\n', options: { fontSize: 11, color: colors.text } },
  { text: '4️⃣ AI指示設定\n', options: { fontSize: 13, bold: true, color: colors.primary } },
  { text: '   システムプロンプト作成\n\n', options: { fontSize: 11, color: colors.text } },
  { text: '5️⃣ ロアブック作成(選択)\n', options: { fontSize: 13, bold: true, color: colors.primary } },
  { text: '   世界観の歴史、用語など\n\n', options: { fontSize: 11, color: colors.text } },
  { text: '6️⃣ テストプレイ → 公開\n\n', options: { fontSize: 13, bold: true, color: colors.primary } },
  { text: '7️⃣ 人気世界観に成長 💰', options: { fontSize: 13, bold: true, color: colors.accent } }
], {
  x: 5.2, y: 1.2, w: 4.3, h: 4
});

slide.addShape(ppt.ShapeType.rect, {
  x: 0.5, y: 2.7, w: 4.3, h: 2.6,
  fill: { color: colors.light },
  line: { color: colors.accent, width: 1 }
});

slide.addText([
  { text: '📌 実例: 「財閥学校」\n', options: { fontSize: 14, bold: true, color: colors.secondary } },
  { text: '━━━━━━━━━━━━━━\n', options: { fontSize: 8, color: colors.accent } },
  { text: '1. タイトル: 「青雲高等教育機関\n   - 階級の学校」\n', options: { fontSize: 11, color: colors.text } },
  { text: '2. ジャンル: 学園ロマンス、ドラマ\n', options: { fontSize: 11, color: colors.text } },
  { text: '3. 世界観: 財閥・政治家・芸能人の\n   子女だけの超特級学校\n', options: { fontSize: 11, color: colors.text } },
  { text: '4. 登場人物8人: 各キャラクターの\n   詳細な設定\n', options: { fontSize: 11, color: colors.text } },
  { text: '5. AI指示: 「没入型学園ドラマ\n   作家のように行動」\n', options: { fontSize: 11, color: colors.text } },
  { text: '6. 公開 → 完成！', options: { fontSize: 11, bold: true, color: colors.accent } }
], {
  x: 0.7, y: 2.9, w: 4, h: 2.4
});

// ===== スライド12: ソーシャル機能 =====
slide = ppt.addSlide();
addBackgroundPattern(slide);

slide.addText('4. ソーシャル機能', {
  x: 0.5, y: 0.3, w: 9, h: 0.6,
  fontSize: 32, bold: true, color: colors.primary
});

const socialFeatures = [
  { icon: '❤️', title: 'いいね', desc: '気に入ったキャラクターに\nハート表示' },
  { icon: '💬', title: 'コメント', desc: 'キャラクターについての\n意見共有' },
  { icon: '👥', title: 'フォロー', desc: '好きな創作者を\nフォロー' },
  { icon: '🔍', title: '検索', desc: '望むテーマの\nキャラクターを検索' },
  { icon: '🏆', title: 'ランキング', desc: '人気キャラクターと\n創作者順位' },
  { icon: '🌐', title: 'コミュニティ', desc: '創作者とユーザーの\n活発な交流' }
];

socialFeatures.forEach((feature, idx) => {
  const row = Math.floor(idx / 3);
  const col = idx % 3;
  
  slide.addShape(ppt.ShapeType.rect, {
    x: 0.5 + col * 3.3, y: 1.2 + row * 2.2, w: 3, h: 2,
    fill: { color: colors.white },
    line: { color: colors.accent, width: 1 }
  });
  
  slide.addText([
    { text: feature.icon + '\n', options: { fontSize: 36 } },
    { text: feature.title + '\n', options: { fontSize: 16, bold: true, color: colors.secondary } },
    { text: '━━━\n', options: { fontSize: 8, color: colors.accent } },
    { text: feature.desc, options: { fontSize: 12, color: colors.text } }
  ], {
    x: 0.6 + col * 3.3, y: 1.3 + row * 2.2, w: 2.8, h: 1.9,
    align: 'center', valign: 'middle'
  });
});

// ===== スライド13: ポイントシステム =====
slide = ppt.addSlide();
addBackgroundPattern(slide);

slide.addText('5. ポイントシステム', {
  x: 0.5, y: 0.3, w: 9, h: 0.6,
  fontSize: 32, bold: true, color: colors.primary
});

slide.addShape(ppt.ShapeType.rect, {
  x: 0.5, y: 1, w: 4.3, h: 2,
  fill: { color: colors.white },
  line: { color: colors.primary, width: 2 }
});

slide.addText([
  { text: '💰 ポイント使用\n', options: { fontSize: 16, bold: true, color: colors.primary } },
  { text: '━━━━━━━━━\n', options: { fontSize: 8, color: colors.accent } },
  { text: 'チャットするたびに\n一定ポイント消費\n\n', options: { fontSize: 13, color: colors.text } },
  { text: 'カフェでコーヒーを飲むように、\n会話にポイント使用', options: { fontSize: 12, color: colors.text, italic: true } }
], {
  x: 0.7, y: 1.2, w: 4, h: 1.8,
  align: 'center', valign: 'middle'
});

slide.addShape(ppt.ShapeType.rect, {
  x: 5, y: 1, w: 4.5, h: 2,
  fill: { color: colors.light },
  line: { color: colors.accent, width: 2 }
});

slide.addText([
  { text: '📥 ポイント獲得方法\n', options: { fontSize: 16, bold: true, color: colors.primary } },
  { text: '━━━━━━━━━━━━\n', options: { fontSize: 8, color: colors.accent } },
  { text: '1. ', options: { fontSize: 13, bold: true, color: colors.accent } },
  { text: '無料ポイント\n', options: { fontSize: 13, bold: true, color: colors.accent } },
  { text: '   毎日出席、イベント参加\n\n', options: { fontSize: 12, color: colors.text } },
  { text: '2. ', options: { fontSize: 13, bold: true, color: colors.accent } },
  { text: '有料ポイント\n', options: { fontSize: 13, bold: true, color: colors.accent } },
  { text: '   必要な時に購入', options: { fontSize: 12, color: colors.text } }
], {
  x: 5.2, y: 1.2, w: 4.3, h: 1.8
});

slide.addShape(ppt.ShapeType.rect, {
  x: 0.5, y: 3.2, w: 9, h: 2.1,
  fill: { color: colors.white },
  line: { color: colors.primary, width: 2 }
});

slide.addText([
  { text: '✨ 公平なシステム\n', options: { fontSize: 18, bold: true, color: colors.secondary } },
  { text: '━━━━━━━━━━━━━━━━━━━━━━━━\n', options: { fontSize: 8, color: colors.accent } },
  { text: '• 無料ポイントを優先使用\n', options: { fontSize: 14, color: colors.text } },
  { text: '• 無料でも十分に楽しめる\n', options: { fontSize: 14, color: colors.text } },
  { text: '• もっと多く会話したい時だけ購入', options: { fontSize: 14, color: colors.text } }
], {
  x: 0.7, y: 3.4, w: 8.6, h: 1.9,
  align: 'center', valign: 'middle'
});

// ===== スライド14: 収益モデル =====
slide = ppt.addSlide();
addBackgroundPattern(slide);

slide.addText('収益モデル', {
  x: 0.5, y: 0.3, w: 9, h: 0.6,
  fontSize: 36, bold: true, color: colors.primary
});

const revenueModels = [
  { 
    num: '1', 
    title: 'ポイント販売', 
    subtitle: '(主な収益源)', 
    items: [
      'より多くの会話時に購入',
      '無料/有料ポイント混合',
      '無料ポイント優先消費',
      '多様なパッケージ提供'
    ]
  },
  { 
    num: '2', 
    title: '世界観マーケット', 
    subtitle: '(将来計画)', 
    items: [
      '人気創作者が有料販売',
      'プラットフォーム手数料30%',
      '創作者に収益配分',
      '創作者経済の活性化'
    ]
  },
  { 
    num: '3', 
    title: '広告', 
    subtitle: '(補助収益)', 
    items: [
      '無料ユーザー対象',
      'ゲーム/ウェブトゥーンなど',
      '関連コンテンツ広告',
      '適切な広告表示'
    ]
  }
];

revenueModels.forEach((model, idx) => {
  slide.addShape(ppt.ShapeType.rect, {
    x: 0.5 + idx * 3.3, y: 1, w: 3, h: 4.3,
    fill: { color: colors.white },
    line: { color: idx === 0 ? colors.primary : colors.accent, width: 2 }
  });
  
  slide.addShape(ppt.ShapeType.rect, {
    x: 0.5 + idx * 3.3, y: 1, w: 3, h: 0.7,
    fill: { color: idx === 0 ? colors.primary : colors.accent },
    line: { type: 'none' }
  });
  
  slide.addText([
    { text: model.num + '. ' + model.title, options: { fontSize: 15, bold: true, color: colors.white } }
  ], {
    x: 0.6 + idx * 3.3, y: 1.15, w: 2.8, h: 0.4,
    align: 'center'
  });
  
  slide.addText(model.subtitle, {
    x: 0.6 + idx * 3.3, y: 1.8, w: 2.8, h: 0.3,
    fontSize: 11, color: colors.accent, italic: true, align: 'center'
  });
  
  model.items.forEach((item, itemIdx) => {
    slide.addText('• ' + item, {
      x: 0.6 + idx * 3.3, y: 2.2 + itemIdx * 0.45, w: 2.8, h: 0.4,
      fontSize: 11, color: colors.text
    });
  });
});

// ===== スライド15: 市場機会 1 =====
slide = ppt.addSlide();
addBackgroundPattern(slide);

slide.addText('市場機会 - なぜ今なのか？', {
  x: 0.5, y: 0.3, w: 9, h: 0.6,
  fontSize: 30, bold: true, color: colors.primary
});

const marketOpportunities = [
  {
    icon: '🤖',
    title: 'AIブーム',
    points: [
      'ChatGPT以降、AIへの大衆の関心爆発',
      'AIチャットボット市場は年平均30%成長予想',
      '単純な会話を超えた創造的活用需要増加'
    ]
  },
  {
    icon: '🎨',
    title: '創作者経済爆発',
    points: [
      'YouTube、TikTokなどで「誰もがクリエイター」時代',
      '技術障壁の低下: コーディング不要でAIコンテンツ制作可能',
      '収益創出機会: 人気創作者は収入可能',
      'ウェブトゥーン/ウェブ小説市場とのシナジー'
    ]
  }
];

marketOpportunities.forEach((opp, idx) => {
  slide.addShape(ppt.ShapeType.rect, {
    x: 0.5, y: 1 + idx * 2.1, w: 9, h: 1.9,
    fill: { color: colors.white },
    line: { color: colors.primary, width: 2 }
  });
  
  slide.addText(opp.icon + '  ' + opp.title, {
    x: 0.7, y: 1.1 + idx * 2.1, w: 8.6, h: 0.4,
    fontSize: 16, bold: true, color: colors.primary
  });
  
  opp.points.forEach((point, pIdx) => {
    slide.addText('• ' + point, {
      x: 0.8, y: 1.6 + idx * 2.1 + pIdx * 0.35, w: 8.4, h: 0.3,
      fontSize: 12, color: colors.text
    });
  });
});

// ===== スライド16: 市場機会 2 =====
slide = ppt.addSlide();
addBackgroundPattern(slide);

slide.addText('市場機会 - なぜ今なのか？ (続き)', {
  x: 0.5, y: 0.3, w: 9, h: 0.6,
  fontSize: 28, bold: true, color: colors.primary
});

const marketOpportunities2 = [
  {
    icon: '🎮',
    title: 'UGC(ユーザー制作コンテンツ)トレンド',
    points: [
      'Roblox、Minecraftのようにユーザーがコンテンツ制作',
      'プラットフォームはツール提供、ユーザーが無限のコンテンツ生産',
      '自動拡張するエコシステム'
    ]
  },
  {
    icon: '💔',
    title: 'ソーシャルニーズ',
    points: [
      'コロナ以降、デジタルコミュニケーション増加',
      '孤独解消欲求',
      '新しいエンターテインメント需要'
    ]
  },
  {
    icon: '🌏',
    title: 'グローバル市場',
    points: [
      '日本市場優先: AIチャットボットへの受容度高い、オタク文化発達',
      '言語別サービス拡張容易 (韓国、東南アジアなど)',
      '文化別カスタム世界観提供',
      'アジア市場中心に拡張'
    ]
  }
];

marketOpportunities2.forEach((opp, idx) => {
  slide.addShape(ppt.ShapeType.rect, {
    x: 0.5, y: 1 + idx * 1.5, w: 9, h: 1.3,
    fill: { color: idx === 0 ? colors.light : colors.white },
    line: { color: colors.accent, width: 1 }
  });
  
  slide.addText(opp.icon + '  ' + opp.title, {
    x: 0.7, y: 1.05 + idx * 1.5, w: 8.6, h: 0.35,
    fontSize: 15, bold: true, color: colors.secondary
  });
  
  opp.points.forEach((point, pIdx) => {
    slide.addText('• ' + point, {
      x: 0.8, y: 1.45 + idx * 1.5 + pIdx * 0.28, w: 8.4, h: 0.25,
      fontSize: 11, color: colors.text
    });
  });
});

// ===== スライド17: ターゲット顧客 =====
slide = ppt.addSlide();
addBackgroundPattern(slide);

slide.addText('ターゲット顧客', {
  x: 0.5, y: 0.3, w: 9, h: 0.6,
  fontSize: 32, bold: true, color: colors.primary
});

slide.addShape(ppt.ShapeType.rect, {
  x: 0.5, y: 1, w: 4.3, h: 2.2,
  fill: { color: colors.white },
  line: { color: colors.primary, width: 2 }
});

slide.addText([
  { text: '🎮 プレイヤーとして\n', options: { fontSize: 16, bold: true, color: colors.primary } },
  { text: '━━━━━━━━━━\n', options: { fontSize: 8, color: colors.accent } },
  { text: '• 10代~30代\n', options: { fontSize: 13, bold: true, color: colors.secondary } },
  { text: '  新しいエンターテインメントを探す若い層\n\n', options: { fontSize: 12, color: colors.text } },
  { text: '• ゲーム/ウェブトゥーンファン\n', options: { fontSize: 13, bold: true, color: colors.secondary } },
  { text: '  好きな世界観でプレイしたい人々\n\n', options: { fontSize: 12, color: colors.text } },
  { text: '• 孤独を感じる人々\n', options: { fontSize: 13, bold: true, color: colors.secondary } },
  { text: '  AIとの会話で慰め', options: { fontSize: 12, color: colors.text } }
], {
  x: 0.7, y: 1.2, w: 4, h: 2
});

slide.addShape(ppt.ShapeType.rect, {
  x: 5, y: 1, w: 4.5, h: 2.2,
  fill: { color: colors.light },
  line: { color: colors.accent, width: 2 }
});

slide.addText([
  { text: '🎨 創作者として\n', options: { fontSize: 16, bold: true, color: colors.primary } },
  { text: '━━━━━━━━━━\n', options: { fontSize: 8, color: colors.accent } },
  { text: '• ウェブトゥーン/ウェブ小説作家\n', options: { fontSize: 12, bold: true, color: colors.secondary } },
  { text: '  自分の作品をAI世界観に拡張\n\n', options: { fontSize: 11, color: colors.text } },
  { text: '• アマチュア作家\n', options: { fontSize: 12, bold: true, color: colors.secondary } },
  { text: '  自分の想像を現実にしたい人々\n\n', options: { fontSize: 11, color: colors.text } },
  { text: '• ゲーム企画者\n', options: { fontSize: 12, bold: true, color: colors.secondary } },
  { text: '  ゲームアイデアを簡単にプロトタイプ化\n\n', options: { fontSize: 11, color: colors.text } },
  { text: '• 一般創作者\n', options: { fontSize: 12, bold: true, color: colors.secondary } },
  { text: '  特別な技術なく創作したい誰でも', options: { fontSize: 11, color: colors.text } }
], {
  x: 5.2, y: 1.2, w: 4.3, h: 2
});

slide.addShape(ppt.ShapeType.rect, {
  x: 0.5, y: 3.4, w: 9, h: 1.9,
  fill: { color: colors.white },
  line: { color: colors.primary, width: 1 }
});

slide.addText([
  { text: '📚 副ターゲット\n', options: { fontSize: 16, bold: true, color: colors.secondary } },
  { text: '━━━━━━━━━━━━━━━━━━━━━━━━\n', options: { fontSize: 8, color: colors.accent } },
  { text: '• 言語学習者: AIと会話しながら外国語練習\n', options: { fontSize: 13, color: colors.text } },
  { text: '• 教育者: 歴史/文学などを楽しく教えるツール\n', options: { fontSize: 13, color: colors.text } },
  { text: '• 心理カウンセリング: 安全な環境で感情表現練習', options: { fontSize: 13, color: colors.text } }
], {
  x: 0.7, y: 3.6, w: 8.6, h: 1.7
});

// ===== スライド18: 競争優位性 =====
slide = ppt.addSlide();
addBackgroundPattern(slide);

slide.addText('競争優位性', {
  x: 0.5, y: 0.3, w: 9, h: 0.6,
  fontSize: 32, bold: true, color: colors.primary
});

const advantages = [
  { icon: '🎨', title: '創作自由度', desc: '複雑な世界観と多重キャラクターシステム' },
  { icon: '📖', title: 'ストーリーテリング', desc: '単純な会話を超えた没入型叙事体験' },
  { icon: '👤', title: 'ペルソナシステム', desc: '差別化されたカスタム体験' },
  { icon: '🌐', title: 'コミュニティ', desc: '創作者とユーザーの活発な交流' },
  { icon: '🔧', title: '高度設定', desc: '登場人物、関係図、状態システムなど細かい設定' },
  { icon: '📱', title: 'モバイル最適化', desc: 'いつでもどこでも利用' },
  { icon: '🔒', title: '安全性', desc: '徹底したコンテンツ管理' },
  { icon: '🧠', title: 'AI技術', desc: 'Google Gemini AI + ベクトルDB' }
];

advantages.forEach((adv, idx) => {
  const row = Math.floor(idx / 4);
  const col = idx % 4;
  
  slide.addShape(ppt.ShapeType.rect, {
    x: 0.5 + col * 2.4, y: 1 + row * 2.2, w: 2.3, h: 2,
    fill: { color: colors.white },
    line: { color: colors.accent, width: 1 }
  });
  
  slide.addText([
    { text: adv.icon + '\n', options: { fontSize: 28 } },
    { text: adv.title + '\n', options: { fontSize: 13, bold: true, color: colors.secondary } },
    { text: '━━\n', options: { fontSize: 8, color: colors.accent } },
    { text: adv.desc, options: { fontSize: 10, color: colors.text } }
  ], {
    x: 0.6 + col * 2.4, y: 1.1 + row * 2.2, w: 2.1, h: 1.9,
    align: 'center', valign: 'middle'
  });
});

// ===== スライド19: 成長戦略 =====
slide = ppt.addSlide();
addBackgroundPattern(slide);

slide.addText('4段階成長ロードマップ', {
  x: 0.5, y: 0.3, w: 9, h: 0.6,
  fontSize: 30, bold: true, color: colors.primary
});

const roadmap = [
  { 
    phase: '1段階', 
    period: '現在~3ヶ月', 
    goal: '1,000人', 
    key: '基盤構築 (日本)',
    details: ['核心機能開発完了', 'ベータテスト進行', '初期創作者コミュニティ形成']
  },
  { 
    phase: '2段階', 
    period: '6ヶ月以内', 
    goal: '1万人', 
    key: 'PMF達成 (日本)',
    details: ['日本国内マーケティング', '日本のインフルエンサー協力', '人気漫画/ライトノベル作家誘致']
  },
  { 
    phase: '3段階', 
    period: '1年以内', 
    goal: '10万人', 
    key: '成長加速 (日本)',
    details: ['大規模マーケティング実行', 'IP(アイピー)パートナーシップ(アニメ、ゲーム)', '韓国市場進出準備']
  },
  { 
    phase: '4段階', 
    period: '2年以内', 
    goal: '50~100万人', 
    key: 'グローバル拡張',
    details: ['多言語サービス拡大', '海外市場進出(韓国、東南アジア)', 'グローバル版ローンチ']
  }
];

roadmap.forEach((stage, idx) => {
  const y = 1.1 + idx * 1.05;
  
  slide.addShape(ppt.ShapeType.rect, {
    x: 0.5, y: y, w: 9, h: 0.95,
    fill: { color: idx === 0 ? colors.accent : colors.white },
    line: { color: colors.primary, width: 2 }
  });
  
  slide.addText([
    { text: stage.phase + ' ', options: { fontSize: 14, bold: true, color: idx === 0 ? colors.white : colors.primary } },
    { text: '(' + stage.period + ')  ', options: { fontSize: 11, color: idx === 0 ? colors.white : colors.text, italic: true } },
    { text: '🎯 ' + stage.goal + '  ', options: { fontSize: 13, bold: true, color: idx === 0 ? colors.white : colors.accent } },
    { text: '| ' + stage.key, options: { fontSize: 12, bold: true, color: idx === 0 ? colors.white : colors.secondary } }
  ], {
    x: 0.7, y: y + 0.1, w: 8.6, h: 0.3
  });
  
  slide.addText('• ' + stage.details.join(' • '), {
    x: 0.7, y: y + 0.5, w: 8.6, h: 0.4,
    fontSize: 10, color: idx === 0 ? colors.white : colors.text
  });
});

// ===== スライド20: 技術的強み =====
slide = ppt.addSlide();
addBackgroundPattern(slide);

slide.addText('技術的強み', {
  x: 0.5, y: 0.3, w: 9, h: 0.6,
  fontSize: 32, bold: true, color: colors.primary
});

const techStrengths = [
  {
    icon: '🚀',
    title: '最新AI技術',
    points: ['Google Gemini AI使用', '自然で創造的な会話が可能', '画像認識機能']
  },
  {
    icon: '🧠',
    title: '高度なメモリーシステム\n(開発中)',
    points: ['ベクトルデータベース(pgvector)使用', 'AIが長い会話内容も自動的に記憶', 'キャラクター別関係図と重要イベント記録']
  },
  {
    icon: '⚡',
    title: '拡張可能な構造',
    points: ['現代的なクラウド技術', 'ユーザー急増にも安定的', '速い応答速度']
  },
  {
    icon: '🔐',
    title: 'ユーザー安全',
    points: ['不適切なコンテンツフィルタリング', '個人情報暗号化', '安全な決済システム']
  }
];

techStrengths.forEach((tech, idx) => {
  const row = Math.floor(idx / 2);
  const col = idx % 2;
  
  slide.addShape(ppt.ShapeType.rect, {
    x: 0.5 + col * 4.8, y: 1 + row * 2.2, w: 4.6, h: 2,
    fill: { color: colors.white },
    line: { color: colors.primary, width: 2 }
  });
  
  slide.addText(tech.icon + '  ' + tech.title, {
    x: 0.7 + col * 4.8, y: 1.1 + row * 2.2, w: 4.4, h: 0.4,
    fontSize: 14, bold: true, color: colors.secondary
  });
  
  tech.points.forEach((point, pIdx) => {
    slide.addText('✓ ' + point, {
      x: 0.8 + col * 4.8, y: 1.6 + row * 2.2 + pIdx * 0.35, w: 4.2, h: 0.3,
      fontSize: 11, color: colors.text
    });
  });
});

// ===== スライド21: 投資ポイント =====
slide = ppt.addSlide();
addBackgroundPattern(slide);

slide.addText('💼 投資家の皆様へ', {
  x: 0.5, y: 0.3, w: 9, h: 0.6,
  fontSize: 30, bold: true, color: colors.primary
});

const investmentPoints = [
  { icon: '📈', title: '成長する市場', desc: 'AIチャットボット市場は年平均30%成長予想' },
  { icon: '🎯', title: '明確な収益モデル', desc: 'ポイント販売 + マーケットプレイス' },
  { icon: '🚀', title: '拡張性', desc: 'UGCモデルで無限のコンテンツ自動生産' },
  { icon: '👥', title: '経験豊富なチーム', desc: '最新技術スタックとAI専門性' },
  { icon: '💡', title: '現実的目標', desc: '日本市場 1,000人 → 1万人 → 10万人 → グローバル' },
  { icon: '🎨', title: 'UGCモデル', desc: 'ユーザーが無限コンテンツ生産する生態系' },
  { icon: '🌏', title: '市場戦略', desc: '日本 → 韓国 → 東南アジア順次進出' },
  { icon: '🔧', title: '技術的強み', desc: 'Google Gemini AI + ベクトルDB + 拡張可能な構造' }
];

investmentPoints.forEach((point, idx) => {
  const row = Math.floor(idx / 2);
  const col = idx % 2;
  
  slide.addShape(ppt.ShapeType.rect, {
    x: 0.5 + col * 4.8, y: 1 + row * 1.05, w: 4.6, h: 0.95,
    fill: { color: colors.white },
    line: { color: colors.accent, width: 1 }
  });
  
  slide.addText([
    { text: point.icon + '  ', options: { fontSize: 20 } },
    { text: point.title + '\n', options: { fontSize: 13, bold: true, color: colors.secondary } },
    { text: point.desc, options: { fontSize: 11, color: colors.text } }
  ], {
    x: 0.7 + col * 4.8, y: 1.15 + row * 1.05, w: 4.4, h: 0.8,
    valign: 'middle'
  });
});

// ===== スライド22: まとめ =====
slide = ppt.addSlide();
slide.background = { color: colors.primary };

// 装飾
slide.addShape(ppt.ShapeType.ellipse, {
  x: 7, y: -1.5, w: 4, h: 4,
  fill: { color: colors.gradient1, transparency: 30 },
  line: { type: 'none' }
});
slide.addShape(ppt.ShapeType.ellipse, {
  x: -1.5, y: 3.5, w: 3.5, h: 3.5,
  fill: { color: colors.gradient2, transparency: 40 },
  line: { type: 'none' }
});

slide.addText('ナモスチャットのビジョン', {
  x: 0.5, y: 1.3, w: 9, h: 0.6,
  fontSize: 32, bold: true, color: colors.white, align: 'center'
});

slide.addShape(ppt.ShapeType.rect, {
  x: 1.5, y: 2.2, w: 7, h: 1.2,
  fill: { color: colors.white, transparency: 20 },
  line: { color: colors.white, width: 2 }
});

slide.addText([
  { text: '「すべての人が自分だけのAI友達と\n', options: { fontSize: 24, bold: true, color: colors.white } },
  { text: '会話する世界」', options: { fontSize: 24, bold: true, color: colors.light } }
], {
  x: 1.7, y: 2.4, w: 6.6, h: 0.9,
  align: 'center', valign: 'middle'
});

slide.addText([
  { text: '私たちは単純なチャットアプリを超えて、\n', options: { fontSize: 16, color: colors.light } },
  { text: '新しい形態の', options: { fontSize: 16, color: colors.light } },
  { text: 'デジタル関係と創作経済', options: { fontSize: 16, color: colors.white, bold: true } },
  { text: 'を\n作り上げています', options: { fontSize: 16, color: colors.light } }
], {
  x: 0.5, y: 3.7, w: 9, h: 0.8,
  align: 'center'
});

slide.addText('ご清聴ありがとうございました', {
  x: 0.5, y: 4.8, w: 9, h: 0.4,
  fontSize: 18, color: colors.light, align: 'center'
});

// PPT保存
const outputPath = join(projectRoot, 'ナモスチャット_サービス説明書_日本語.pptx');
await ppt.writeFile({ fileName: outputPath });

console.log('✅ 日本語PPT生成完了！');
console.log(`📄 ファイル位置: ${outputPath}`);


"use client";

import { useState, useEffect } from "react";

// キーワードデータ定義（調査資料に基づく包括的なリスト）
export const PROMPT_KEYWORDS = {
  character: [
    // 性別（基本）
    { label: '女性', value: '1girl' },
    { label: '男性', value: '1boy' },
    { label: '女の子', value: 'girl' },
    { label: '男の子', value: 'boy' },
    { label: '女性', value: 'woman' },
    { label: '男性', value: 'man' },
    // 年齢層
    { label: '赤ちゃん', value: 'baby' },
    { label: '幼児', value: 'toddler' },
    { label: '子供', value: 'child' },
    { label: '小学生', value: 'elementary school student' },
    { label: '中学生', value: 'junior high school student' },
    { label: '高校生', value: 'high school student' },
    { label: '10代', value: 'teenage' },
    { label: '若者', value: 'young adult' },
    { label: '20代', value: '20yo' },
    { label: '大人', value: 'adult' },
    { label: '中年', value: 'middle-aged' },
    { label: '高齢者', value: 'elderly' },
    // 体型
    { label: 'スレンダー', value: 'slender body' },
    { label: '細身', value: 'slim body' },
    { label: '標準体型', value: 'normal build' },
    { label: '曲線美', value: 'curvy body' },
    { label: 'ぽっちゃり', value: 'chubby body' },
    { label: '筋肉質', value: 'muscular body' },
    { label: 'アスリート体型', value: 'athletic body' },
    // 顔の特徴
    { label: '丸顔', value: 'round face' },
    { label: '細面', value: 'slender face' },
    { label: '童顔', value: 'baby face' },
    { label: '小顔', value: 'small face' },
    { label: '彫りの深い顔', value: 'sharp features' },
    { label: 'つり目', value: 'upturned eyes' },
    { label: 'たれ目', value: 'droopy eyes' },
    { label: '二重まぶた', value: 'double eyelids' },
    // ファンタジー種族
    { label: 'エルフ', value: 'elf' },
    { label: '天使', value: 'angel' },
    { label: '悪魔', value: 'demon' },
    { label: '獣耳', value: 'animal ears' },
    { label: '猫耳', value: 'cat ears' },
    { label: '狐耳', value: 'fox ears' },
    { label: 'サイボーグ', value: 'cyborg' },
    { label: '人魚', value: 'mermaid' },
    { label: '妖精', value: 'fairy' },
  ],
  hair: [
    // 長さ
    { label: 'ベリーショート', value: 'very short hair' },
    { label: 'ショートヘア', value: 'short hair' },
    { label: 'ミディアム', value: 'medium hair' },
    { label: 'セミロング', value: 'shoulder-length hair' },
    { label: 'ロングヘア', value: 'long hair' },
    { label: 'スーパーロング', value: 'very long hair' },
    // スタイル
    { label: 'ボブカット', value: 'bob cut' },
    { label: 'おかっぱ', value: 'bowl cut' },
    { label: 'ハーフアップ', value: 'half updo' },
    { label: 'アップ', value: 'updo' },
    { label: 'ポニーテール', value: 'ponytail' },
    { label: 'ツインテール', value: 'twintails' },
    { label: 'サイドテール', value: 'side ponytail' },
    { label: 'お団子', value: 'hair bun' },
    { label: 'ツインお団子', value: 'double bun' },
    { label: '三つ編み', value: 'braid' },
    { label: 'おさげ', value: 'twin braids' },
    { label: '姫カット', value: 'hime cut' },
    { label: 'アホ毛', value: 'ahoge' },
    { label: 'メカクレ', value: 'hair over eyes' },
    { label: '片目隠れ', value: 'hair over one eye' },
    { label: 'オールバック', value: 'swept back' },
    // 質感
    { label: '直毛', value: 'straight hair' },
    { label: 'ウェーブ', value: 'wavy hair' },
    { label: '巻き髪', value: 'curly hair' },
    { label: 'ドリル髪', value: 'drill hair' },
    { label: 'ボサボサ', value: 'messy hair' },
    { label: '濡れ髪', value: 'wet hair' },
    { label: '艶のある髪', value: 'silky hair' },
    { label: 'ボリューム', value: 'voluminous hair' },
    { label: 'グラデーション', value: 'gradient hair' },
    // 色
    { label: 'ピンク髪', value: 'pink hair' },
    { label: '金髪', value: 'blonde hair' },
    { label: '黒髪', value: 'black hair' },
    { label: '茶髪', value: 'brown hair' },
    { label: '青髪', value: 'blue hair' },
    { label: '紫髪', value: 'purple hair' },
    { label: '銀髪', value: 'silver hair' },
    { label: '白髪', value: 'white hair' },
    { label: '緑髪', value: 'green hair' },
    { label: '赤髪', value: 'red hair' },
  ],
  hair_color: [
    { label: '金髪', value: 'blonde hair' },
    { label: '黒髪', value: 'black hair' },
    { label: '茶髪', value: 'brown hair' },
    { label: '赤髪', value: 'red hair' },
    { label: '銀髪', value: 'silver hair' },
    { label: '白髪', value: 'white hair' },
    { label: 'ピンク髪', value: 'pink hair' },
    { label: '青髪', value: 'blue hair' },
    { label: '紫髪', value: 'purple hair' },
    { label: '緑髪', value: 'green hair' },
    { label: 'オレンジ髪', value: 'orange hair' },
    { label: '金髪ハイライト', value: 'blonde highlights' },
    { label: 'ツートンヘア', value: 'two-tone hair' },
    { label: 'グラデーションヘア', value: 'gradient hair' },
  ],
  body: [
    { label: 'スリム', value: 'slim body' },
    { label: 'グラマー', value: 'curvy body' },
    { label: '引き締まった', value: 'athletic body' },
    { label: '筋肉質', value: 'muscular body' },
    { label: '華奢', value: 'slender body' },
    { label: '小胸', value: 'small breasts' },
    { label: '中胸', value: 'medium breasts' },
    { label: '豊胸', value: 'large breasts' },
    { label: '長い脚', value: 'long legs' },
    { label: '丸みのあるヒップ', value: 'curvy hips' },
  ],
  face: [
    { label: '童顔', value: 'baby face' },
    { label: 'シャープな顔', value: 'sharp features' },
    { label: '大きな瞳', value: 'big eyes' },
    { label: 'アーモンドアイ', value: 'almond eyes' },
    { label: '長いまつ毛', value: 'long eyelashes' },
    { label: 'そばかす', value: 'freckles' },
    { label: 'ほくろ', value: 'beauty mark' },
    { label: '頬紅', value: 'blush' },
    { label: '微笑んだ唇', value: 'smiling lips' },
  ],
  clothing: [
    // トップス
    { label: 'Tシャツ', value: 't-shirt' },
    { label: 'シャツ（襟付き）', value: 'collared shirt' },
    { label: 'ブラウス', value: 'blouse' },
    { label: 'セーター', value: 'sweater' },
    { label: 'タートルネック', value: 'turtleneck' },
    { label: 'パーカー', value: 'hoodie' },
    { label: 'キャミソール', value: 'camisole' },
    { label: 'タンクトップ', value: 'tank top' },
    { label: 'オフショルダー', value: 'off-shoulder' },
    { label: 'クロップトップ', value: 'crop top' },
    // ボトムス
    { label: 'スカート', value: 'skirt' },
    { label: 'ミニスカート', value: 'miniskirt' },
    { label: 'ロングスカート', value: 'long skirt' },
    { label: 'タイトスカート', value: 'pencil skirt' },
    { label: 'パンツ', value: 'pants' },
    { label: 'ジーンズ', value: 'jeans' },
    { label: 'ショートパンツ', value: 'shorts' },
    { label: 'ホットパンツ', value: 'short shorts' },
    { label: 'レギンス', value: 'leggings' },
    // 制服・フォーマル
    { label: '制服', value: 'school uniform' },
    { label: 'セーラー服', value: 'sailor uniform' },
    { label: 'ブレザー', value: 'blazer' },
    { label: 'ドレス', value: 'dress' },
    // 和装
    { label: '着物', value: 'kimono' },
    { label: '浴衣', value: 'yukata' },
    { label: '振袖', value: 'furisode' },
    { label: '袴', value: 'hakama' },
    { label: '巫女服', value: 'miko' },
    { label: '羽織', value: 'haori' },
    // 特殊・ファンタジー
    { label: 'メイド服', value: 'maid uniform' },
    { label: '鎧', value: 'armor' },
    { label: '魔法使いのローブ', value: 'wizard robe' },
    { label: '水着', value: 'swimsuit' },
    { label: 'ビキニ', value: 'bikini' },
    { label: 'チャイナドレス', value: 'china dress' },
    { label: '軍服', value: 'military uniform' },
    { label: 'パジャマ', value: 'pajamas' },
  ],
  expression: [
    // ポジティブ
    { label: '微笑み', value: 'smile' },
    { label: '満面の笑み', value: 'grin' },
    { label: 'ドヤ顔', value: 'smug' },
    { label: 'はにかみ', value: 'bashful' },
    { label: '興奮', value: 'excited' },
    { label: '安らぎ', value: 'relaxed' },
    { label: '誘惑的', value: 'seductive smile' },
    // ネガティブ
    { label: '泣き顔', value: 'crying' },
    { label: '悲しみ', value: 'sad' },
    { label: '怒り', value: 'angry' },
    { label: '激怒', value: 'furious' },
    { label: '絶望', value: 'despair' },
    { label: '嫌悪', value: 'disgusted' },
    // アニメ的
    { label: '赤面', value: 'blush' },
    { label: '無表情', value: 'expressionless' },
    { label: 'ジト目', value: 'half-closed eyes' },
    { label: '驚き', value: 'surprised' },
    { label: 'ウィンク', value: 'wink' },
    { label: '舌出し', value: 'tongue out' },
    { label: 'ヤンデレ', value: 'yandere' },
    { label: 'あわあわ', value: 'panicked' },
  ],
  pose: [
    // 身体の向き
    { label: '立ち姿', value: 'standing' },
    { label: '座っている', value: 'sitting' },
    { label: '寝そべる', value: 'lying' },
    { label: '振り返り', value: 'looking back' },
    { label: '四つん這い', value: 'all fours' },
    { label: '仁王立ち', value: 'arms akimbo' },
    { label: '腕組み', value: 'crossed arms' },
    { label: 'あぐら', value: 'cross-legged' },
    { label: '正座', value: 'seiza' },
    { label: '体育座り', value: 'hugging knees' },
    // 手のジェスチャー
    { label: 'ピースサイン', value: 'peace sign' },
    { label: '手を振る', value: 'waving' },
    { label: '敬礼', value: 'salute' },
    { label: 'ハートマーク', value: 'heart hands' },
    { label: '指差し', value: 'pointing' },
    { label: '手招き', value: 'beckoning' },
    { label: '猫の手', value: 'cat pose' },
    { label: '手を伸ばす', value: 'reaching' },
    { label: '祈る', value: 'praying' },
    // カメラアングル
    { label: '全身', value: 'full body' },
    { label: '膝上', value: 'cowboy shot' },
    { label: '上半身', value: 'upper body' },
    { label: '顔アップ', value: 'close-up' },
    { label: '俯瞰', value: 'from above' },
    { label: 'アオリ', value: 'from below' },
    { label: '横顔', value: 'profile' },
    { label: '自分撮り', value: 'selfie' },
  ],
  background: [
    // 自然・屋外
    { label: '青空', value: 'blue sky' },
    { label: '夕焼け', value: 'sunset' },
    { label: '夜空', value: 'night sky' },
    { label: '森', value: 'forest' },
    { label: '海', value: 'ocean' },
    { label: 'ビーチ', value: 'beach' },
    { label: '花畑', value: 'flower field' },
    { label: '雪景色', value: 'snowy' },
    { label: '桜', value: 'cherry blossoms' },
    { label: '雨', value: 'rain' },
    // 都市・屋内
    { label: '街並み', value: 'cityscape' },
    { label: '夜景', value: 'night city' },
    { label: '教室', value: 'classroom' },
    { label: '部屋', value: 'bedroom' },
    { label: '図書館', value: 'library' },
    { label: 'カフェ', value: 'cafe' },
    { label: '廃墟', value: 'ruins' },
    { label: '和室', value: 'tatami room' },
    // ファンタジー・SF
    { label: '異世界', value: 'fantasy world' },
    { label: 'サイバーパンク', value: 'cyberpunk city' },
    { label: '宇宙', value: 'space' },
    { label: '神殿', value: 'temple' },
    { label: '魔法陣', value: 'magic circle' },
    { label: '水中都市', value: 'underwater city' },
    { label: 'スチームパンク', value: 'steampunk' },
  ],
  style: [
    // 絵画技法
    { label: 'アニメ塗り', value: 'anime style' },
    { label: '厚塗り', value: 'oil painting' },
    { label: '水彩画', value: 'watercolor' },
    { label: 'スケッチ', value: 'sketch' },
    { label: 'リアル', value: 'photorealistic' },
    { label: 'ピクセルアート', value: 'pixel art' },
    // ライティング
    { label: 'シネマティック', value: 'cinematic lighting' },
    { label: '逆光', value: 'backlighting' },
    { label: '柔らかい光', value: 'soft lighting' },
    { label: '木漏れ日', value: 'dappled sunlight' },
    { label: 'ボリュメトリック', value: 'volumetric lighting' },
    // 品質・雰囲気
    { label: '高品質', value: 'high quality' },
    { label: '詳細', value: 'detailed' },
    { label: '美しい', value: 'beautiful' },
    { label: 'かわいい', value: 'cute' },
    { label: '幻想的', value: 'fantasy' },
    { label: '明るい', value: 'bright' },
    { label: '暗い', value: 'dark' },
    { label: '柔らかい', value: 'soft' },
    { label: '鮮やか', value: 'vivid' },
  ],
};

export const NEGATIVE_KEYWORDS = [
  // 品質向上
  { label: '低品質', value: 'low quality' },
  { label: '最悪品質', value: 'worst quality' },
  { label: '低解像度', value: 'lowres' },
  { label: 'ぼやけ', value: 'blurry' },
  { label: '文字', value: 'text' },
  { label: '透かし', value: 'watermark' },
  { label: '署名', value: 'signature' },
  { label: 'JPEGノイズ', value: 'jpeg artifacts' },
  { label: 'エラー', value: 'error' },
  // 人体崩れ防止
  { label: '悪い解剖', value: 'bad anatomy' },
  { label: '悪い手', value: 'bad hands' },
  { label: '奇形な手', value: 'malformed hands' },
  { label: '指の欠損', value: 'missing fingers' },
  { label: '指の過多', value: 'extra fingers' },
  { label: '手足の融合', value: 'fused fingers' },
  { label: '悪い顔', value: 'bad face' },
  { label: '多重手足', value: 'extra limbs' },
  // 特定要素の排除
  // 注意: NSFWはバックエンドで自動的に追加されるため、UIからは削除
  { label: '実写', value: 'photorealistic' },
  { label: '3D', value: '3d' },
  { label: 'CGI', value: 'cgi' },
  { label: 'レンダー', value: 'render' },
  { label: 'スケッチ', value: 'sketch' },
  { label: '粗い', value: 'rough' },
  { label: '単色', value: 'monochrome' },
];

interface PromptKeywordSelectorProps {
  prompt: string;
  onPromptChange: (prompt: string) => void;
}

export function PromptKeywordSelector({ prompt, onPromptChange }: PromptKeywordSelectorProps) {
  const [keywordCategory, setKeywordCategory] = useState<string>('character');
  const [selectedKeywords, setSelectedKeywords] = useState<Set<string>>(new Set());
  const MAX_KEYWORDS = 30; // 最大30個のキーワード制限

  const handleAddKeyword = (keyword: string) => {
    // 現在のキーワード数を取得
    const currentKeywords = prompt.split(',').map((k) => k.trim()).filter((k) => k);
    
    // 既に含まれている場合は削除
    if (currentKeywords.includes(keyword)) {
      setSelectedKeywords((prev) => {
        const next = new Set(prev);
        next.delete(keyword);
        return next;
      });
      onPromptChange(currentKeywords.filter((k) => k !== keyword).join(', '));
      return;
    }
    
    // 30個の制限チェック
    if (currentKeywords.length >= MAX_KEYWORDS) {
      alert(`キーワードは最大${MAX_KEYWORDS}個まで選択できます。`);
      return;
    }
    
    setSelectedKeywords((prev) => {
      const next = new Set(prev);
      next.add(keyword);
      return next;
    });
    
    // プロンプトに追加
    onPromptChange(currentKeywords.length > 0 ? `${currentKeywords.join(', ')}, ${keyword}` : keyword);
  };

  // プロンプト変更時に選択状態を更新
  useEffect(() => {
    const currentKeywords = prompt.split(',').map((k) => k.trim()).filter((k) => k);
    const newSelected = new Set<string>();
    Object.values(PROMPT_KEYWORDS).flat().forEach((kw) => {
      if (currentKeywords.includes(kw.value)) {
        newSelected.add(kw.value);
      }
    });
    setSelectedKeywords(newSelected);
  }, [prompt]);

  // 現在のキーワード数を取得
  const currentKeywordCount = prompt.split(',').map((k) => k.trim()).filter((k) => k).length;
  const isLimitReached = currentKeywordCount >= MAX_KEYWORDS;

  return (
    <div className="mb-3 space-y-2">
      <div className="flex items-center justify-between mb-2">
        <div className="flex flex-wrap gap-1.5 overflow-x-auto pb-2 flex-1">
          {Object.keys(PROMPT_KEYWORDS).map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setKeywordCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                keywordCategory === cat
                  ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-lg shadow-pink-500/30'
                  : 'bg-gray-700/50 hover:bg-gray-600/50 text-gray-300'
              }`}
            >
              {cat === 'character'
                ? 'キャラ'
                : cat === 'hair'
                ? '髪型'
                : cat === 'hair_color'
                ? '髪色'
                : cat === 'body'
                ? '体型'
                : cat === 'face'
                ? '顔'
                : cat === 'clothing'
                ? '服装'
                : cat === 'expression'
                ? '表情'
                : cat === 'pose'
                ? 'ポーズ'
                : cat === 'background'
                ? '背景'
                : 'スタイル'}
            </button>
          ))}
        </div>
        <p className={`text-xs ml-2 whitespace-nowrap ${isLimitReached ? 'text-red-400 font-semibold' : 'text-gray-400'}`}>
          {currentKeywordCount} / {MAX_KEYWORDS}
        </p>
      </div>
      <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto pr-2">
        {PROMPT_KEYWORDS[keywordCategory as keyof typeof PROMPT_KEYWORDS].map((kw) => {
          const isSelected = selectedKeywords.has(kw.value) || prompt.includes(kw.value);
          const isDisabled = !isSelected && isLimitReached;
          return (
            <button
              key={kw.value}
              type="button"
              onClick={() => handleAddKeyword(kw.value)}
              disabled={isDisabled}
              className={`px-2.5 py-1 rounded-lg text-xs transition-all ${
                isSelected
                  ? 'bg-blue-500/80 text-white border border-blue-400'
                  : isDisabled
                  ? 'bg-gray-700/30 text-gray-500 border border-gray-700/50 cursor-not-allowed opacity-50'
                  : 'bg-gray-700/50 hover:bg-gray-600/50 text-gray-300 border border-gray-600/50'
              }`}
            >
              {kw.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface NegativeKeywordSelectorProps {
  negativePrompt: string;
  onNegativePromptChange: (negativePrompt: string) => void;
}

export function NegativeKeywordSelector({ negativePrompt, onNegativePromptChange }: NegativeKeywordSelectorProps) {
  const [selectedKeywords, setSelectedKeywords] = useState<Set<string>>(new Set());

  // ネガティブプロンプト変更時に選択状態を更新
  useEffect(() => {
    const currentKeywords = negativePrompt.split(',').map((k) => k.trim()).filter((k) => k);
    const newSelected = new Set<string>();
    NEGATIVE_KEYWORDS.forEach((kw) => {
      if (currentKeywords.includes(kw.value)) {
        newSelected.add(kw.value);
      }
    });
    setSelectedKeywords(newSelected);
  }, [negativePrompt]);

  const handleAddKeyword = (keyword: string) => {
    setSelectedKeywords((prev) => {
      const next = new Set(prev);
      if (next.has(keyword)) {
        next.delete(keyword);
      } else {
        next.add(keyword);
      }
      return next;
    });
    
    // ネガティブプロンプトに追加
    const keywords = negativePrompt.split(',').map((k) => k.trim()).filter((k) => k);
    if (keywords.includes(keyword)) {
      onNegativePromptChange(keywords.filter((k) => k !== keyword).join(', '));
    } else {
      onNegativePromptChange(keywords.length > 0 ? `${keywords.join(', ')}, ${keyword}` : keyword);
    }
  };

  return (
    <div className="mb-3">
      <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pr-2">
        {NEGATIVE_KEYWORDS.map((kw) => {
          const isSelected = selectedKeywords.has(kw.value) || negativePrompt.includes(kw.value);
          return (
            <button
              key={kw.value}
              type="button"
              onClick={() => handleAddKeyword(kw.value)}
              className={`px-2.5 py-1 rounded-lg text-xs transition-all ${
                isSelected
                  ? 'bg-red-500/80 text-white border border-red-400'
                  : 'bg-gray-700/50 hover:bg-gray-600/50 text-gray-300 border border-gray-600/50'
              }`}
            >
              {kw.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}


/**
 * セーフティフィルターがONのキャラクターに対して、性的コンテンツが含まれているかチェック
 */

// 性的コンテンツを検出するキーワードリスト（日本語・英語）
const SEXUAL_KEYWORDS = [
  // 日本語
  '性的', '性行為', 'セックス', '性交', 'エッチ', 'H', 'えっち', 'ハメ', '中出し',
  'レイプ', '強制', '輪姦', '陵辱', '調教', 'SM', 'サド', 'マゾ', '緊縛',
  'フェラ', 'オナニー', '自慰', '手淫', '口淫', 'アナル', '肛門', '風俗',
  '援助交際', '売春', 'ポルノ', 'アダルト', 'エロ', '下品', '猥褻',
  // 英語
  'sex', 'sexual', 'porn', 'pornography', 'xxx', 'nsfw', 'nude', 'naked',
  'rape', 'incest', 'fetish', 'bdsm', 'orgasm', 'climax', 'penis', 'vagina',
  'masturbation', 'oral', 'anal', 'threesome', 'gangbang', 'whore', 'prostitute',
  // その他の表現
  'r18', 'r-18', '18+', 'adult only', 'adults only'
];

/**
 * テキストに性的コンテンツが含まれているかチェック
 * @param text チェックするテキスト
 * @returns 性的コンテンツが含まれている場合true
 */
export function containsSexualContent(text: string): boolean {
  if (!text || text.trim().length === 0) return false;
  
  const normalizedText = text.toLowerCase();
  
  // キーワードチェック
  for (const keyword of SEXUAL_KEYWORDS) {
    if (normalizedText.includes(keyword.toLowerCase())) {
      return true;
    }
  }
  
  return false;
}

/**
 * 複数のテキストフィールドをチェック
 * @param fields チェックするフィールドオブジェクト
 * @returns 性的コンテンツが含まれているフィールド名の配列
 */
export function checkFieldsForSexualContent(fields: Record<string, string | null | undefined>): string[] {
  const violations: string[] = [];
  
  for (const [fieldName, fieldValue] of Object.entries(fields)) {
    if (fieldValue && containsSexualContent(fieldValue)) {
      violations.push(fieldName);
    }
  }
  
  return violations;
}


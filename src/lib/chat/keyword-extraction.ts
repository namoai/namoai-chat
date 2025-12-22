/**
 * Rule-based keyword extraction functionality
 */

/**
 * Extract keywords from text (rule-based)
 * @param text Text to extract keywords from
 * @returns Array of extracted keywords
 */
export function extractKeywords(text: string): string[] {
  const japanesePattern = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]+/g;
  const englishPattern = /\b[A-Za-z]{3,}\b/g;
  
  const japaneseWords = text.match(japanesePattern) || [];
  const englishWords = text.toLowerCase().match(englishPattern) || [];
  
  const allWords = [...japaneseWords, ...englishWords];
  const wordCount: { [key: string]: number } = {};
  
  const japaneseExclude = [
    'これ', 'それ', 'あれ', 'どれ', 'この', 'その', 'あの', 'その', '彼', '彼女', '彼は', '彼女は', 'もの', 'こと', 'ユーザー', 'ユーザ',
    'は', 'が', 'を', 'に', 'の', 'で', 'へ', 'と', 'から', 'まで', 'より', 'も', 'だけ', 'しか', 'ばかり',
    'する', 'した', 'する', 'ある', 'あった', 'いる', 'いた', 'なる', 'なった', 'なる', '見る', '見た', '見る', '言う', '言った', '言う',
    '思う', '思った', '思う', '知る', '知った', '知る', '行く', '行った', '行く', '来る', '来た', '来る',
    'やる', 'やった', 'やる', 'やめる', 'やめた', 'やめる', '始める', '始めた', '始める', '終わる', '終わった', '終わる',
    'いい', '良い', 'よい', '悪い', '大きい', '小さい', '多い', '少ない', '新しい', '古い', '高い', '低い',
    '同じ', '違う', '似ている', '近い', '遠い'
  ];
  const englishExclude = ['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'this', 'that', 'these', 'those', 'it', 'its', 'they', 'them', 'img', 'and', 'or', 'but', 'if', 'when', 'where', 'what', 'who', 'why', 'how', 'user', 'users'];
  
  allWords.forEach(word => {
    if (!/^\d+-\d+$/.test(word)) {
      const normalizedWord = /^[A-Za-z]/.test(word) ? word.toLowerCase() : word;
      
      if (japaneseExclude.includes(normalizedWord)) return;
      if (englishExclude.includes(normalizedWord)) return;
      
      if (/^[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]+(する|した|する|ある|あった|いる|いた|なる|なった|なる|見る|見た|見る|言う|言った|言う|思う|思った|思う)$/.test(normalizedWord)) {
        const baseWord = normalizedWord.replace(/(する|した|する|ある|あった|いる|いた|なる|なった|なる|見る|見た|見る|言う|言った|言う|思う|思った|思う)$/, '');
        if (baseWord.length <= 1) return;
        const commonJapaneseVerbs = ['する', 'ある', 'いる', 'なる', '見', '言', '思', '知', '行', '来', 'や', '始', '終'];
        if (commonJapaneseVerbs.includes(baseWord)) return;
      }
      
      if (/^[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]+(いい|良い|よい|悪い|大きい|小さい|多い|少ない|新しい|古い|高い|低い|同じ|違う|似ている|近い|遠い)$/.test(normalizedWord)) {
        return;
      }
      
      if (normalizedWord.match(/^(img|Img|IMG|\{img|\{Img)$/i)) return;
      if (normalizedWord.match(/^[<{}>]/)) return;
      if (/^\d+$/.test(normalizedWord)) return;
      if (normalizedWord.match(/^__META:/)) return;
      
      wordCount[normalizedWord] = (wordCount[normalizedWord] || 0) + 1;
    }
  });
  
  return Object.entries(wordCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word]) => word);
}


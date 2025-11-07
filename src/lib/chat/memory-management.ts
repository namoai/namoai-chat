/**
 * Detailed memory management functionality
 * Create and manage detailed memories from summaries
 */

import { prisma } from "@/lib/prisma";
import { getEmbedding } from "@/lib/embeddings";
import { GenerativeModel } from "@google-cloud/vertexai";

const MAX_MEMORY_LENGTH = 2000;

/**
 * Create detailed memories from summary (with splitting support)
 * Returns array of created memory IDs
 * @param chatId Chat ID
 * @param summary Summary text
 * @param keywords Keywords array
 * @param messageStartIndex Message start index
 * @param messageEndIndex Message end index
 * @returns Array of created memory IDs
 */
export async function createDetailedMemories(
  chatId: number,
  summary: string,
  keywords: string[],
  messageStartIndex: number,
  messageEndIndex: number
): Promise<number[]> {
  const createdIds: number[] = [];
  
  if (summary.length > MAX_MEMORY_LENGTH) {
    // Split if over 2000 characters
    let remainingSummary = summary;
    
    while (remainingSummary.length > 0) {
      const memoryContent = remainingSummary.substring(0, MAX_MEMORY_LENGTH);
      remainingSummary = remainingSummary.substring(MAX_MEMORY_LENGTH);
      
      // Add message range info as metadata in keywords (format: __META:start:1:end:5__)
      const metaKeywords = [`__META:start:${messageStartIndex}:end:${messageEndIndex}__`, ...keywords];
      
      const newMemory = await prisma.detailed_memories.create({
        data: {
          chatId,
          content: memoryContent,
          keywords: metaKeywords,
        },
      });
      
      createdIds.push(newMemory.id);
      
      // Generate embedding asynchronously
      (async () => {
        try {
          const embedding = await getEmbedding(memoryContent);
          const embeddingString = `[${embedding.join(',')}]`;
          await prisma.$executeRawUnsafe(
            `UPDATE "detailed_memories" SET "embedding" = $1::vector WHERE "id" = $2`,
            embeddingString,
            newMemory.id
          );
        } catch (error) {
          console.error('Detailed memory embedding generation error:', error);
        }
      })();
      
      // Exit if remaining is 2000 characters or less
      if (remainingSummary.length <= MAX_MEMORY_LENGTH) {
        if (remainingSummary.length > 0) {
          const metaKeywords = [`__META:start:${messageStartIndex}:end:${messageEndIndex}__`, ...keywords];
          const lastMemory = await prisma.detailed_memories.create({
            data: {
              chatId,
              content: remainingSummary,
              keywords: metaKeywords,
            },
          });
          createdIds.push(lastMemory.id);
        }
        break;
      }
    }
  } else {
    // Save as single memory if 2000 characters or less
    const metaKeywords = [`__META:start:${messageStartIndex}:end:${messageEndIndex}__`, ...keywords];
    
    const newMemory = await prisma.detailed_memories.create({
      data: {
        chatId,
        content: summary,
        keywords: metaKeywords,
      },
    });
    
    createdIds.push(newMemory.id);
    
    // Generate embedding asynchronously
    (async () => {
      try {
        const embedding = await getEmbedding(summary);
        const embeddingString = `[${embedding.join(',')}]`;
        await prisma.$executeRawUnsafe(
          `UPDATE "detailed_memories" SET "embedding" = $1::vector WHERE "id" = $2`,
          embeddingString,
          newMemory.id
        );
      } catch (error) {
        console.error('Detailed memory embedding generation error:', error);
      }
    })();
  }
  
  return createdIds;
}

/**
 * Update memories with AI-extracted keywords in the background
 * @param summaryModel Generative model for keyword extraction
 * @param summary Summary text
 * @param memoryIds Array of memory IDs to update
 */
export async function updateMemoriesWithAIKeywords(
  summaryModel: GenerativeModel,
  summary: string,
  memoryIds: number[]
): Promise<void> {
  if (memoryIds.length === 0) return;
  
  try {
    const keywordPrompt = `以下の会話要約から、重要なキーワードを10個まで抽出してください。

【抽出するキーワードの種類】
- 出来事・イベント（例：オーディション、コンサート、パーティー、試合）
- 行動・活動（例：歌、踊り、演奏、演説、対戦）
- 対象・テーマ（例：音楽、スポーツ、芸術、勉強、仕事）
- 人物・関係（例：プロデューサー、審査員、観客、友達、恋人）
- 感情・状態（例：緊張、興奮、喜び、悲しみ、自信）
- 場所・環境（例：ステージ、ホール、学校、家）
- 物・道具（例：マイク、ギター、楽器、衣装）

【絶対に除外する単語】
- 代名詞（例：그、그녀、그는、그녀は、彼、彼女、彼は、彼女は、당신、당신の、ユーザー）
- 助詞・助動詞（例：は、が、を、に、の、で、へ、と、から、まで、より、이、가、을、를、은、는、의、에、에서）
- 一般的すぎる動詞（例：する、した、ある、あった、いる、いた、なる、なった、見る、見た、言う、言った、思う、思った、하다、했다、있다、있었다、없다、없었다、보다、봤다、듯하다、듯했다）
- 一般的すぎる形容詞（例：いい、良い、よい、悪い、大きい、小さい、多い、少ない、新しい、古い、좋다、좋았다、나쁘다、나빴다、크다、작다）
- 技術的なタグ（例：Img、img、{img}、HTMLタグ）
- 数値や記号のみ（例：1、2、3、-、/）
- 指示語（例：これ、それ、あれ、이것、그것）

【重要なルール】
- 名詞中心で、会話の核心を表す重要な概念のみを抽出
- 抽象的すぎる単語（例：もの、こと、것、事）は除外
- キーワードはカンマ区切りで返してください
- キーワードは元の言語（日本語、英語、韓国語など）でそのまま返してください
- 10個に満たない場合は、無理に10個にしなくても構いません

会話要約：
${summary}`;

    const keywordResult = await summaryModel.generateContent(keywordPrompt);
    const keywordText = keywordResult.response.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    if (keywordText) {
      // Extract keywords from AI response
      const extractedKeywords = keywordText
        .split(',')
        .map(k => k.trim())
        .filter(k => {
          if (!k || k.length < 2 || k.length > 30) return false;
          if (k.match(/^__META:/)) return false;
          if (/^\d+$/.test(k)) return false;
          
          // Exclude common words
          const japaneseExclude = ['これ', 'それ', 'あれ', 'どれ', 'この', 'その', 'あの', '彼', '彼女', 'もの', 'こと', 'ユーザー', 'ユーザ'];
          const koreanExclude = ['그', '그녀', '그는', '그녀는', '그녀의', '이것', '그것', '것', '당신', '당신의'];
          const englishExclude = ['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'this', 'that', 'these', 'those', 'it', 'its', 'they', 'them', 'img', 'user', 'users'];
          
          if (japaneseExclude.includes(k)) return false;
          if (koreanExclude.includes(k)) return false;
          if (englishExclude.includes(k.toLowerCase())) return false;
          
          return true;
        })
        .slice(0, 10);
      
      // Update all memories with new keywords (preserve metadata)
      for (const memoryId of memoryIds) {
        try {
          const memory = await prisma.detailed_memories.findUnique({
            where: { id: memoryId },
            select: { keywords: true },
          });
          
          if (memory) {
            // Preserve metadata keywords (__META:...)
            const metaKeywords = memory.keywords.filter((k: string) => k.match(/^__META:/));
            const updatedKeywords = [...metaKeywords, ...extractedKeywords];
            
            await prisma.detailed_memories.update({
              where: { id: memoryId },
              data: { keywords: updatedKeywords },
            });
          }
        } catch (error) {
          console.error(`Failed to update memory ${memoryId} with AI keywords:`, error);
        }
      }
    }
  } catch (error) {
    console.error('AI keyword extraction error:', error);
    // Fail silently - rules-based keywords are already set
  }
}


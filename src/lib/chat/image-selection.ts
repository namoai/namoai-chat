/**
 * Image keyword matching functionality
 * Auto-select images based on keywords in AI responses
 */

export type CharacterImageInfo = {
  keyword?: string | null;
  imageUrl: string;
  isMain?: boolean;
};

/**
 * Select image by keyword matching from AI response
 * @param aiResponse AI response text
 * @param availableImages Available images list
 * @param characterName Character name (optional)
 * @returns Matched image URL (null if no match)
 */
export const selectImageByKeyword = (
  aiResponse: string,
  availableImages: CharacterImageInfo[],
  characterName?: string
): string | null => {
  if (!aiResponse || !availableImages || availableImages.length === 0) {
    return null;
  }

  const lowerResponse = aiResponse.toLowerCase();
  const nonMainImages = availableImages.filter(img => !img.isMain && img.keyword);
  
  const imageScores: Array<{ image: CharacterImageInfo; score: number }> = [];
  
  for (const img of nonMainImages) {
    if (!img.keyword) continue;
    
    const keyword = img.keyword.trim();
    if (!keyword) continue;
    
    const normalizedKeyword = /^[A-Za-z]/.test(keyword) ? keyword.toLowerCase() : keyword;
    const searchText = /^[A-Za-z]/.test(keyword) ? lowerResponse : aiResponse;
    
    let score = 0;
    
    if (/^[A-Za-z]/.test(keyword)) {
      const wordBoundaryRegex = new RegExp(`\\b${normalizedKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (wordBoundaryRegex.test(lowerResponse)) {
        score += 10;
      } else if (lowerResponse.includes(normalizedKeyword)) {
        score += 5;
      }
    } else {
      if (searchText.includes(normalizedKeyword)) {
        score += Math.min(5 + normalizedKeyword.length, 15);
      }
    }
    
    if (characterName) {
      const normalizedCharName = /^[A-Za-z]/.test(characterName) ? characterName.toLowerCase() : characterName;
      const charNameInResponse = /^[A-Za-z]/.test(characterName) 
        ? lowerResponse.includes(normalizedCharName)
        : aiResponse.includes(characterName);
      
      if (charNameInResponse && score > 0) {
        score += 3;
      }
    }
    
    if (score > 0) {
      score += Math.min(normalizedKeyword.length / 2, 5);
      imageScores.push({ image: img, score });
    }
  }
  
  imageScores.sort((a, b) => b.score - a.score);
  
  if (imageScores.length > 0) {
    const bestMatch = imageScores[0];
    console.log(`📸 Image keyword match: "${bestMatch.image.keyword}" (score: ${bestMatch.score.toFixed(1)}) -> ${bestMatch.image.imageUrl}`);
    return bestMatch.image.imageUrl;
  }
  
  return null;
};

/**
 * Add image tag to response text if keyword matched
 * @param responseText Response text
 * @param availableImages Available images list
 * @param characterName Character name (optional)
 * @returns Response text with image tag added
 */
export const addImageTagIfKeywordMatched = (
  responseText: string,
  availableImages: CharacterImageInfo[],
  characterName?: string
): string => {
  const hasImgTag = /\{img:\d+\}/.test(responseText);
  if (hasImgTag) {
    return responseText;
  }

  const matchedImageUrl = selectImageByKeyword(responseText, availableImages, characterName);
  if (!matchedImageUrl) {
    return responseText;
  }

  const nonMainImages = availableImages.filter(img => !img.isMain);
  const imageIndex = nonMainImages.findIndex(img => img.imageUrl === matchedImageUrl);
  
  if (imageIndex >= 0) {
    const imgTag = ` {img:${imageIndex + 1}}`;
    console.log(`📸 Auto-added image tag: ${imgTag}`);
    return responseText + imgTag;
  }

  return responseText;
};


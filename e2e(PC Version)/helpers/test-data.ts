/**
 * テスト用 データ 上数
 */

// テスト用 キャラクター ID (IT 環境で 使用 可能 キャラクター)
export const TEST_CHARACTER_IDS = [86, 81];

// 基本 テスト用 キャラクター ID (最初の 使用)
export const DEFAULT_TEST_CHARACTER_ID = TEST_CHARACTER_IDS[0];

/**
 * テスト用 キャラクター URL 作成
 */
export function getTestCharacterUrl(characterId?: number): string {
  const id = characterId || DEFAULT_TEST_CHARACTER_ID;
  const baseUrl = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
  return `${baseUrl}/characters/${id}`;
}





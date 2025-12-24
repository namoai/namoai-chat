/**
 * 테스트용 데이터 상수
 */

// 테스트용 캐릭터 ID (IT 환경에서 사용 가능한 캐릭터)
export const TEST_CHARACTER_IDS = [86, 81];

// 기본 테스트용 캐릭터 ID (첫 번째 사용)
export const DEFAULT_TEST_CHARACTER_ID = TEST_CHARACTER_IDS[0];

/**
 * 테스트용 캐릭터 URL 생성
 */
export function getTestCharacterUrl(characterId?: number): string {
  const id = characterId || DEFAULT_TEST_CHARACTER_ID;
  const baseUrl = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
  return `${baseUrl}/characters/${id}`;
}





/**
 * セキュリティ強化: パスワードポリシー強化
 * 文字種・長さの強制、バリデーション
 */

export interface PasswordValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  strength: 'weak' | 'medium' | 'strong' | 'very-strong';
  score: number; // 0-100
}

/**
 * パスワード強度を計算
 */
function calculatePasswordStrength(password: string): { strength: PasswordValidationResult['strength']; score: number } {
  let score = 0;
  
  // 長さによるスコア
  if (password.length >= 20) {
    score += 40; // 20文字以上: 40点
  } else if (password.length >= 16) {
    score += 30; // 16-19文字: 30点
  } else if (password.length >= 12) {
    score += 20; // 12-15文字: 20点
  } else if (password.length >= 8) {
    score += 10; // 8-11文字: 10点
  }
  // 8文字未満は0点
  
  // 文字種によるスコア
  if (/[a-z]/.test(password)) score += 10; // 小文字
  if (/[A-Z]/.test(password)) score += 10; // 大文字
  if (/[0-9]/.test(password)) score += 10; // 数字
  if (/[^a-zA-Z0-9]/.test(password)) score += 10; // 特殊文字
  
  // 複雑さによるボーナス
  const uniqueChars = new Set(password).size;
  const diversityRatio = uniqueChars / password.length;
  
  if (diversityRatio >= 0.8) score += 15; // 多様性が非常に高い
  else if (diversityRatio >= 0.6) score += 10; // 多様性が高い
  else if (diversityRatio >= 0.4) score += 5; // 多様性が中程度
  
  // 一般的な弱いパスワードパターンをチェック
  // 注意: パスワード全体が弱いパターンと完全一致する場合のみ減点
  const weakPatterns = [
    /^12345/i,
    /^password$/i,
    /^qwerty$/i,
    /^admin$/i,
    /^letmein$/i,
    /^welcome$/i,
    /^monkey$/i,
    /^12345678$/,
    /^iloveyou$/i,
  ];
  
  // パスワード全体が弱いパターンと一致する場合のみ大幅減点
  if (weakPatterns.some(pattern => pattern.test(password))) {
    score = Math.max(0, score - 30); // 弱いパターンは大幅減点
  } else {
    // 部分的な弱いパターン（例: "password"を含む）は軽減点
    const partialWeakPatterns = [
      /password/i,
      /12345/,
      /qwerty/i,
    ];
    if (partialWeakPatterns.some(pattern => pattern.test(password) && password.length > 12)) {
      score = Math.max(0, score - 10); // 部分的な弱いパターンは軽減点
    }
  }
  
  // 連続文字のペナルティ
  if (/(.)\1{2,}/.test(password)) {
    score = Math.max(0, score - 10); // 同じ文字が3回以上連続
  }
  
  // スコアを0-100に正規化
  score = Math.min(100, Math.max(0, score));
  
  let strength: PasswordValidationResult['strength'];
  if (score < 40) strength = 'weak';
  else if (score < 60) strength = 'medium';
  else if (score < 80) strength = 'strong';
  else strength = 'very-strong';
  
  return { strength, score };
}

/**
 * パスワードを検証
 */
export function validatePassword(password: string): PasswordValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // 最小長さチェック
  if (password.length < 8) {
    errors.push('パスワードは8文字以上である必要があります。');
  }
  
  // 最大長さチェック（セキュリティ上の理由）
  if (password.length > 128) {
    errors.push('パスワードは128文字以下である必要があります。');
  }
  
  // 文字種チェック
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecialChar = /[^a-zA-Z0-9]/.test(password);
  
  if (!hasLowercase) {
    errors.push('パスワードには小文字（a-z）が含まれる必要があります。');
  }
  
  if (!hasNumber) {
    errors.push('パスワードには数字（0-9）が含まれる必要があります。');
  }
  
  if (!hasSpecialChar) {
    errors.push('パスワードには特殊文字（!@#$%^&*など）が含まれる必要があります。');
  }
  
  // 一般的な弱いパスワードのチェック
  const weakPasswords = [
    'password', 'password123', '12345678', 'qwerty', 'abc123',
    'admin', 'letmein', 'welcome', 'monkey', '1234567890',
    'password1', 'password12', 'Password1', 'Password12',
  ];
  
  if (weakPasswords.includes(password.toLowerCase())) {
    errors.push('このパスワードは一般的すぎて使用できません。');
  }
  
  // ユーザー名やメールアドレスと似ているかチェック（警告のみ）
  // このチェックは呼び出し側で追加情報を提供する必要があります
  
  // 連続文字のチェック
  if (/(.)\1{3,}/.test(password)) {
    warnings.push('同じ文字が4回以上連続しています。');
  }
  
  // 連番のチェック
  if (/01234|12345|23456|34567|45678|56789|98765|87654|76543|65432|54321|43210/.test(password)) {
    warnings.push('連続した数字が含まれています。');
  }
  
  // キーボードパターンのチェック
  const keyboardPatterns = [
    /qwerty/i,
    /asdfgh/i,
    /zxcvbn/i,
    /qazwsx/i,
  ];
  
  if (keyboardPatterns.some(pattern => pattern.test(password))) {
    warnings.push('キーボードの配列パターンが検出されました。');
  }
  
  // 強度計算
  const { strength, score } = calculatePasswordStrength(password);
  
  // 強度が弱い場合は警告
  if (strength === 'weak' && errors.length === 0) {
    warnings.push('パスワードの強度が弱いです。より複雑なパスワードを推奨します。');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    strength,
    score,
  };
}

/**
 * パスワードが一般的な弱いパスワードリストに含まれているかチェック
 */
export function isCommonPassword(password: string): boolean {
  const commonPasswords = [
    'password', 'password123', '12345678', '123456789', '1234567890',
    'qwerty', 'abc123', 'monkey', '1234567', 'letmein',
    'trustno1', 'dragon', 'baseball', 'iloveyou', 'master',
    'sunshine', 'ashley', 'bailey', 'passw0rd', 'shadow',
    '123123', '654321', 'superman', 'qazwsx', 'michael',
    'football', 'welcome', 'jesus', 'ninja', 'mustang',
  ];
  
  return commonPasswords.includes(password.toLowerCase());
}

/**
 * パスワードの強度を日本語で説明
 */
export function getPasswordStrengthDescription(strength: PasswordValidationResult['strength']): string {
  switch (strength) {
    case 'weak':
      return '弱い - より複雑なパスワードを推奨します';
    case 'medium':
      return '中程度 - より強力なパスワードを推奨します';
    case 'strong':
      return '強い - 良好なパスワードです';
    case 'very-strong':
      return '非常に強い - 優秀なパスワードです';
    default:
      return '不明';
  }
}


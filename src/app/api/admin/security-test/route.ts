/**
 * セキュリティテスト用APIエンドポイント
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/nextauth';
import { Role } from '@prisma/client';
import { validateCsrfToken } from '@/lib/csrf';
import { handleError, createErrorResponse, ErrorCode } from '@/lib/error-handler';
import { logger } from '@/lib/logger';
import { SecureEnv } from '@/lib/env-security';
import { validatePassword, getPasswordStrengthDescription } from '@/lib/password-policy';
import { generateApiKey, hashApiKey } from '@/lib/api-auth';
import { generateTotpSecret, generateBackupCodes, generateTotpUri } from '@/lib/2fa';

/**
 * GET: セキュリティテストの状態を取得
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.role || session.user.role === Role.USER) {
    return createErrorResponse(ErrorCode.FORBIDDEN, '管理者権限が必要です。', 403);
  }

  try {
    // 環境変数の状態を確認（マスク済み）
    const nextAuthSecret = process.env.NEXTAUTH_SECRET || '';
    const csrfSecret = process.env.CSRF_SECRET || '';
    const nodeEnv = process.env.NODE_ENV || 'development';
    
    // セキュリティチェック
    const securityIssues: string[] = [];
    const warnings: string[] = [];
    
    // NEXTAUTH_SECRET チェック
    if (!nextAuthSecret) {
      securityIssues.push('NEXTAUTH_SECRETが設定されていません');
    } else if (nextAuthSecret === 'default-secret-change-in-production') {
      securityIssues.push('NEXTAUTH_SECRETがデフォルト値のままです（本番環境では危険）');
    } else if (nextAuthSecret.length < 32) {
      securityIssues.push(`NEXTAUTH_SECRETが短すぎます（${nextAuthSecret.length}文字、推奨: 32文字以上）`);
    } else if (nextAuthSecret.length < 64) {
      warnings.push(`NEXTAUTH_SECRETがやや短いです（${nextAuthSecret.length}文字、推奨: 64文字以上）`);
    }
    
    // CSRF_SECRET チェック
    if (!csrfSecret) {
      warnings.push('CSRF_SECRETが未設定（NEXTAUTH_SECRETを使用）');
    } else if (csrfSecret === 'default-secret-change-in-production') {
      securityIssues.push('CSRF_SECRETがデフォルト値のままです');
    } else if (csrfSecret.length < 32) {
      securityIssues.push(`CSRF_SECRETが短すぎます（${csrfSecret.length}文字）`);
    }
    
    // DATABASE_URL チェック
    const databaseUrl = process.env.DATABASE_URL || '';
    if (!databaseUrl) {
      securityIssues.push('DATABASE_URLが設定されていません');
    }
    
    // 本番環境での追加チェック
    if (nodeEnv === 'production') {
      if (!process.env.NEXTAUTH_URL) {
        warnings.push('本番環境でNEXTAUTH_URLが設定されていません');
      }
      if (!process.env.GOOGLE_CLIENT_SECRET) {
        warnings.push('本番環境でGOOGLE_CLIENT_SECRETが設定されていません');
      }
    }
    
    const envStatus = {
      hasNextAuthSecret: !!nextAuthSecret,
      hasCsrfSecret: !!csrfSecret,
      nodeEnv,
      nextAuthSecretMasked: nextAuthSecret 
        ? SecureEnv.maskForLogging(nextAuthSecret, 4)
        : '未設定',
      nextAuthSecretLength: nextAuthSecret.length,
      csrfSecretLength: csrfSecret.length,
      hasDatabaseUrl: !!databaseUrl,
      securityIssues,
      warnings,
      isSecure: securityIssues.length === 0,
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json({
      success: true,
      envStatus,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return handleError(error, request);
  }
}

/**
 * POST: セキュリティ機能をテスト
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.role || session.user.role === Role.USER) {
    return createErrorResponse(ErrorCode.FORBIDDEN, '管理者権限が必要です。', 403);
  }

  try {
    const { testType } = await request.json();

    switch (testType) {
      case 'csrf-valid':
        // CSRFトークンが正しい場合のテスト
        const csrfValid = await validateCsrfToken(request);
        if (!csrfValid) {
          return createErrorResponse(
            ErrorCode.CSRF_TOKEN_INVALID,
            'CSRFトークンが無効です。',
            403
          );
        }
        return NextResponse.json({
          success: true,
          message: 'CSRFトークン検証成功',
          testType: 'csrf-valid',
        });

      case 'csrf-invalid':
        // CSRFトークンが無効な場合のテスト（意図的に失敗させる）
        return createErrorResponse(
          ErrorCode.CSRF_TOKEN_INVALID,
          'CSRFトークンが無効です。',
          403
        );

      case 'error-handling':
        // エラーハンドリングのテスト
        throw new Error('テスト用のエラーです。このエラーは意図的に発生させています。');

      case 'logging':
        // ロギング機能のテスト
        logger.info('セキュリティテスト: 情報ログ', {
          userId: session.user.id,
          testType: 'logging',
        });
        logger.warn('セキュリティテスト: 警告ログ', {
          userId: session.user.id,
          testType: 'logging',
        });
        logger.error('セキュリティテスト: エラーログ', {
          userId: session.user.id,
          testType: 'logging',
        });
        return NextResponse.json({
          success: true,
          message: 'ログが記録されました。サーバーログを確認してください。',
          testType: 'logging',
        });

      case 'session-security':
        // セッション情報を返す（セキュリティ設定の確認用）
        return NextResponse.json({
          success: true,
          session: {
            userId: session.user.id,
            role: session.user.role,
            // セッションの有効期限情報はNextAuthが管理
          },
          testType: 'session-security',
          message: 'セッション情報を取得しました。',
        });

      case 'env-security':
        // 環境変数のセキュリティテスト（詳細な検証）
        const nextAuthSecret = process.env.NEXTAUTH_SECRET || '';
        const csrfSecret = process.env.CSRF_SECRET || '';
        const databaseUrl = process.env.DATABASE_URL || '';
        const nodeEnv = process.env.NODE_ENV || 'development';
        
        const issues: string[] = [];
        const warnings: string[] = [];
        const checks: Record<string, { status: 'ok' | 'warning' | 'error'; message: string }> = {};
        
        // NEXTAUTH_SECRET チェック
        if (!nextAuthSecret) {
          issues.push('NEXTAUTH_SECRETが設定されていません');
          checks.NEXTAUTH_SECRET = { status: 'error', message: '未設定' };
        } else if (nextAuthSecret === 'default-secret-change-in-production') {
          issues.push('NEXTAUTH_SECRETがデフォルト値のままです');
          checks.NEXTAUTH_SECRET = { status: 'error', message: 'デフォルト値（危険）' };
        } else if (nextAuthSecret.length < 32) {
          issues.push(`NEXTAUTH_SECRETが短すぎます（${nextAuthSecret.length}文字）`);
          checks.NEXTAUTH_SECRET = { status: 'error', message: `${nextAuthSecret.length}文字（推奨: 32文字以上）` };
        } else if (nextAuthSecret.length < 64) {
          warnings.push(`NEXTAUTH_SECRETがやや短いです（${nextAuthSecret.length}文字）`);
          checks.NEXTAUTH_SECRET = { status: 'warning', message: `${nextAuthSecret.length}文字（推奨: 64文字以上）` };
        } else {
          checks.NEXTAUTH_SECRET = { status: 'ok', message: `${nextAuthSecret.length}文字（良好）` };
        }
        
        // CSRF_SECRET チェック
        if (!csrfSecret) {
          warnings.push('CSRF_SECRETが未設定（NEXTAUTH_SECRETを使用）');
          checks.CSRF_SECRET = { status: 'warning', message: '未設定（NEXTAUTH_SECRETを使用）' };
        } else if (csrfSecret === 'default-secret-change-in-production') {
          issues.push('CSRF_SECRETがデフォルト値のままです');
          checks.CSRF_SECRET = { status: 'error', message: 'デフォルト値（危険）' };
        } else if (csrfSecret.length < 32) {
          issues.push(`CSRF_SECRETが短すぎます（${csrfSecret.length}文字）`);
          checks.CSRF_SECRET = { status: 'error', message: `${csrfSecret.length}文字（推奨: 32文字以上）` };
        } else {
          checks.CSRF_SECRET = { status: 'ok', message: `${csrfSecret.length}文字（良好）` };
        }
        
        // DATABASE_URL チェック
        if (!databaseUrl) {
          issues.push('DATABASE_URLが設定されていません');
          checks.DATABASE_URL = { status: 'error', message: '未設定' };
        } else {
          checks.DATABASE_URL = { status: 'ok', message: '設定済み' };
        }
        
        // 本番環境での追加チェック
        if (nodeEnv === 'production') {
          if (!process.env.NEXTAUTH_URL) {
            warnings.push('本番環境でNEXTAUTH_URLが設定されていません');
            checks.NEXTAUTH_URL = { status: 'warning', message: '未設定' };
          } else {
            checks.NEXTAUTH_URL = { status: 'ok', message: '設定済み' };
          }
        }
        
        const envTest = {
          nodeEnv,
          checks,
          issues,
          warnings,
          isSecure: issues.length === 0,
          maskedValues: {
            NEXTAUTH_SECRET: nextAuthSecret
              ? SecureEnv.maskForLogging(nextAuthSecret, 4)
              : '未設定',
            CSRF_SECRET: csrfSecret
              ? SecureEnv.maskForLogging(csrfSecret, 4)
              : '未設定（NEXTAUTH_SECRETを使用）',
          },
        };
        
        return NextResponse.json({
          success: true,
          envTest,
          testType: 'env-security',
        });

      case 'password-policy':
        // パスワードポリシーのテスト
        const testPasswords = [
          'weak123', // 弱いパスワード (7文字、条件不満足)
          'Medium123!', // 中程度 (11文字、12文字未満でエラー)
          'StrongPassword123!', // 強いパスワード (19文字、すべての条件を満たす)
          'VeryStrongPassword123!@#', // 非常に強いパスワード (24文字、すべての条件を満たす)
        ];
        
        const passwordTestResults = testPasswords.map(password => {
          const validation = validatePassword(password);
          return {
            password: password.substring(0, 3) + '***', // セキュリティのため一部のみ表示
            passwordLength: password.length, // 長さを表示
            isValid: validation.isValid,
            strength: validation.strength,
            strengthDescription: getPasswordStrengthDescription(validation.strength),
            score: validation.score,
            errors: validation.errors,
            warnings: validation.warnings,
          };
        });
        
        return NextResponse.json({
          success: true,
          passwordTestResults,
          testType: 'password-policy',
        });

      case 'api-auth':
        // API認証機能のテスト
        const testApiKey = generateApiKey();
        const hashedKey = hashApiKey(testApiKey);
        
        return NextResponse.json({
          success: true,
          apiAuthTest: {
            generatedKey: testApiKey.substring(0, 12) + '***', // 一部のみ表示
            keyLength: testApiKey.length,
            hashedKey: hashedKey.substring(0, 16) + '***', // 一部のみ表示
            message: 'APIキー生成機能が正常に動作しています。',
          },
          testType: 'api-auth',
        });

      case '2fa':
        // 2FA機能のテスト
        const totpSecret = generateTotpSecret();
        const backupCodes = generateBackupCodes(3); // テスト用に3つだけ
        const qrCodeUri = generateTotpUri(totpSecret, 'test_user', 'Namos Chat');
        
        return NextResponse.json({
          success: true,
          twoFactorTest: {
            totpSecret: totpSecret.substring(0, 8) + '***', // 一部のみ表示
            backupCodesCount: backupCodes.length,
            qrCodeUri: qrCodeUri.substring(0, 50) + '***', // 一部のみ表示
            message: '2FA機能が正常に動作しています。',
          },
          testType: '2fa',
        });

      default:
        return createErrorResponse(
          ErrorCode.VALIDATION_ERROR,
          '無効なテストタイプです。',
          400
        );
    }
  } catch (error) {
    // エラーハンドリングのテストの場合、意図的にエラーを返す
    if (request.headers.get('x-test-type') === 'error-handling') {
      return handleError(error, request, session.user.id);
    }
    return handleError(error, request);
  }
}


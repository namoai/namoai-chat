import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/nextauth';
import { Role } from '@prisma/client';
import { execSync } from 'child_process';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * npm audit fixを実行
 * POST /api/admin/security-status/fix
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (session?.user?.role !== Role.SUPER_ADMIN) {
      return NextResponse.json({ error: '権限がありません。' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const useForce = body.force === true;
    const useLegacy = body.legacy === true;

    const projectRoot = process.cwd();
    
    try {
      let command = 'npm audit fix';
      if (useForce && useLegacy) {
        command = 'npm audit fix --force --legacy-peer-deps';
      } else if (useForce) {
        command = 'npm audit fix --force';
      } else if (useLegacy) {
        command = 'npm audit fix --legacy-peer-deps';
      }
      
      let output = '';
      try {
        output = execSync(command, {
          encoding: 'utf-8',
          cwd: projectRoot,
          stdio: 'pipe',
          timeout: 300000, // 5分タイムアウト
        }) as string;
      } catch (execError: unknown) {
        // execSync는 exit code가 0이 아니면 에러를 throw하지만,
        // 실제로는 일부 패키지가 수정되었을 수 있음
        const errorObj = execError as { stdout?: string; stderr?: string; status?: number; message?: string };
        output = errorObj.stdout || errorObj.stderr || errorObj.message || '';
        
        // npm audit fix는 취약점이 남아있으면 exit code 1을 반환하지만,
        // 실제로는 일부 패키지가 수정되었을 수 있음
        // "changed X packages"가 있으면 부분적으로 성공한 것으로 간주
        if (output.includes('changed') && output.includes('packages')) {
          // 부분的に成功した場合
          const remainingVulns = output.includes('npm audit report') || output.includes('Severity:');
          return NextResponse.json({
            success: true,
            partial: remainingVulns,
            message: remainingVulns 
              ? '一部のパッケージが修正されましたが、まだ修正が必要な脆弱性が残っています。'
              : 'npm audit fixが正常に完了しました。',
            output: output,
            needsForce: output.includes('npm audit fix --force') && !useForce,
            timestamp: new Date().toISOString(),
          });
        }
        
        // 本当のエラーの場合
        throw execError;
      }

      return NextResponse.json({
        success: true,
        message: 'npm audit fixが正常に完了しました。',
        output: output,
        timestamp: new Date().toISOString(),
      });
    } catch (error: unknown) {
      const errorObj = error as { stdout?: string; stderr?: string; message?: string };
      const errorOutput = errorObj.stdout || errorObj.stderr || errorObj.message || 'Unknown error';
      
      // エラー出力が長すぎる場合は切り詰める
      const truncatedError = typeof errorOutput === 'string' && errorOutput.length > 1000
        ? errorOutput.substring(0, 1000) + '... (truncated)'
        : errorOutput;
      
      return NextResponse.json({
        success: false,
        message: 'npm audit fixの実行中にエラーが発生しました。',
        error: truncatedError,
        timestamp: new Date().toISOString(),
      }, { status: 500 });
    }
  } catch (error) {
    console.error('[Security Status Fix] エラー:', error);
    return NextResponse.json(
      { error: 'npm audit fixの実行に失敗しました。' },
      { status: 500 }
    );
  }
}


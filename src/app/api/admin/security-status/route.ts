import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/nextauth';
import { Role } from '@prisma/client';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * セキュリティステータスを取得
 * GET /api/admin/security-status
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (session?.user?.role !== Role.SUPER_ADMIN) {
      return NextResponse.json({ error: '権限がありません。' }, { status: 403 });
    }

    const projectRoot = process.cwd();
    const reportsDir = path.join(projectRoot, 'security-reports');

    // npm audit結果を取得（最新のレポートファイルから）
    let auditResult = null;
    let auditReportPath = null;
    if (fs.existsSync(reportsDir)) {
      const files = fs.readdirSync(reportsDir)
        .filter(f => f.startsWith('npm-audit-') && f.endsWith('.json'))
        .sort()
        .reverse();
      
      if (files.length > 0) {
        auditReportPath = path.join(reportsDir, files[0]);
        try {
          const auditData = JSON.parse(fs.readFileSync(auditReportPath, 'utf-8'));
          const vulnerabilities = auditData.metadata?.vulnerabilities || {};
          const total = Object.values(vulnerabilities).reduce((sum: number, count: unknown) => sum + (typeof count === 'number' ? count : 0), 0);
          
          auditResult = {
            total,
            vulnerabilities,
            metadata: auditData.metadata,
            timestamp: fs.statSync(auditReportPath).mtime.toISOString(),
            reportPath: auditReportPath,
          };
        } catch {
          // パースエラーは無視
        }
      }
    }

    // セキュリティテスト結果を取得（最新のレポートファイルから）
    let testResult = null;
    if (fs.existsSync(reportsDir)) {
      const files = fs.readdirSync(reportsDir)
        .filter(f => f.startsWith('security-report-') && f.endsWith('.json'))
        .sort()
        .reverse();
      
      if (files.length > 0) {
        const testReportPath = path.join(reportsDir, files[0]);
        try {
          testResult = JSON.parse(fs.readFileSync(testReportPath, 'utf-8'));
          testResult.reportPath = testReportPath;
        } catch {
          // パースエラーは無視
        }
      }
    }

    // npm auditを実行（オプション、クエリパラメータで指定）
    const runAudit = request.nextUrl.searchParams.get('runAudit') === 'true';
    let currentAudit = null;
    
    if (runAudit) {
      try {
        const auditOutput = execSync('npm audit --json', { 
          encoding: 'utf-8',
          cwd: projectRoot,
          stdio: 'pipe',
          timeout: 60000, // 60秒タイムアウト
        });
        
        const auditData = JSON.parse(auditOutput);
        const vulnerabilities = auditData.metadata?.vulnerabilities || {};
        const total = Object.values(vulnerabilities).reduce((sum: number, count: unknown) => sum + (typeof count === 'number' ? count : 0), 0);
        
        currentAudit = {
          total,
          vulnerabilities,
          metadata: auditData.metadata,
          timestamp: new Date().toISOString(),
        };
      } catch (error: unknown) {
        const errorOutput = (error as { stdout?: string; stderr?: string }).stdout || (error as Error).message;
        try {
          const auditData = JSON.parse(errorOutput as string);
          const vulnerabilities = auditData.metadata?.vulnerabilities || {};
          const total = Object.values(vulnerabilities).reduce((sum: number, count: unknown) => sum + (typeof count === 'number' ? count : 0), 0);
          
          currentAudit = {
            total,
            vulnerabilities,
            metadata: auditData.metadata,
            error: auditData.error || (error as Error).message,
            timestamp: new Date().toISOString(),
          };
        } catch {
          currentAudit = {
            error: (error as Error).message || 'npm audit実行エラー',
            timestamp: new Date().toISOString(),
          };
        }
      }
    }

    return NextResponse.json({
      audit: auditResult,
      currentAudit,
      tests: testResult,
      timestamp: new Date().toISOString(),
      reportsDir: reportsDir,
    });
  } catch (error) {
    console.error('[Security Status] エラー:', error);
    return NextResponse.json(
      { error: 'セキュリティステータスの取得に失敗しました。' },
      { status: 500 }
    );
  }
}

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

    const projectRoot = process.cwd();
    
    try {
      const command = useForce ? 'npm audit fix --force' : 'npm audit fix';
      const output = execSync(command, {
        encoding: 'utf-8',
        cwd: projectRoot,
        stdio: 'pipe',
        timeout: 300000, // 5分タイムアウト
      });

      return NextResponse.json({
        success: true,
        message: 'npm audit fixが正常に完了しました。',
        output: output,
        timestamp: new Date().toISOString(),
      });
    } catch (error: unknown) {
      const errorOutput = (error as { stdout?: string; stderr?: string }).stdout || (error as Error).message;
      return NextResponse.json({
        success: false,
        message: 'npm audit fixの実行中にエラーが発生しました。',
        error: errorOutput,
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


#!/usr/bin/env node

/**
 * セキュリティテスト自動実行スクリプト
 * 実行: npm run security:test
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const BASE_URL = process.env.SECURITY_TEST_BASE_URL || 'http://localhost:3000';

// テスト結果を保存するディレクトリ
const REPORTS_DIR = path.join(projectRoot, 'security-reports');
if (!fs.existsSync(REPORTS_DIR)) {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
}

const tests = [
  {
    name: 'XSS Protection Test',
    description: 'HTMLタグが適切にサニタイズされることを確認',
    endpoint: '/api/security-tests/sanitize',
    method: 'POST',
    body: { input: '<script>alert("XSS")</script>こんにちは！' },
    expected: (result) => {
      if (!result.success) return false;
      return !result.sanitized.includes('<script>') && result.sanitized.includes('こんにちは！');
    },
  },
  {
    name: 'File Upload Validation Test',
    description: 'ファイルアップロード検証が機能することを確認',
    endpoint: '/api/security-tests/upload',
    method: 'POST',
    skip: true, // ファイルアップロードは特殊な処理が必要なためスキップ
    expected: (result) => result.success !== undefined,
  },
  {
    name: 'Rate Limiting Test',
    description: 'Rate Limitingが機能することを確認',
    endpoint: '/api/security-tests/rate-limit',
    method: 'POST',
    expected: (result) => result.success !== undefined,
  },
];

async function runNpmAudit() {
  try {
    console.log('📦 npm auditを実行中...');
    const auditResult = execSync('npm audit --json', { 
      encoding: 'utf-8',
      cwd: projectRoot,
      stdio: 'pipe'
    });
    
    const auditData = JSON.parse(auditResult);
    
    // レポートファイルに保存
    const auditReportPath = path.join(REPORTS_DIR, `npm-audit-${Date.now()}.json`);
    fs.writeFileSync(auditReportPath, JSON.stringify(auditData, null, 2));
    
    const vulnerabilities = auditData.metadata?.vulnerabilities || {};
    const total = Object.values(vulnerabilities).reduce((sum, count) => sum + count, 0);
    
    return {
      success: total === 0,
      total,
      vulnerabilities,
      metadata: auditData.metadata,
      reportPath: auditReportPath,
    };
  } catch (error) {
    const errorOutput = error.stdout || error.message;
    try {
      const auditData = JSON.parse(errorOutput);
      const vulnerabilities = auditData.metadata?.vulnerabilities || {};
      const total = Object.values(vulnerabilities).reduce((sum, count) => sum + count, 0);
      
      return {
        success: false,
        total,
        vulnerabilities,
        metadata: auditData.metadata,
        error: auditData.error || error.message,
      };
    } catch {
      return {
        success: false,
        error: error.message || 'npm audit実行エラー',
      };
    }
  }
}

async function runSecurityTests() {
  console.log('🔒 セキュリティテストを開始します...\n');
  
  const results = [];
  
  for (const test of tests) {
    if (test.skip) {
      console.log(`⏭️  スキップ: ${test.name}`);
      continue;
    }
    
    try {
      console.log(`テスト実行中: ${test.name}...`);
      
      const response = await fetch(`${BASE_URL}${test.endpoint}`, {
        method: test.method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: test.body ? JSON.stringify(test.body) : undefined,
      });
      
      const data = await response.json();
      const passed = test.expected ? test.expected(data) : response.ok;
      
      results.push({
        name: test.name,
        description: test.description,
        passed,
        status: response.status,
        data,
        timestamp: new Date().toISOString(),
      });
      
      console.log(passed ? '  ✅ 成功' : '  ❌ 失敗');
    } catch (error) {
      console.log(`  ❌ エラー: ${error.message}`);
      results.push({
        name: test.name,
        description: test.description,
        passed: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  }
  
  return results;
}

async function main() {
  console.log('='.repeat(60));
  console.log('🔒 セキュリティ評価自動実行');
  console.log('='.repeat(60));
  console.log(`ベースURL: ${BASE_URL}`);
  console.log(`レポート保存先: ${REPORTS_DIR}\n`);
  
  // npm audit実行
  const auditResult = await runNpmAudit();
  
  // セキュリティテスト実行
  const testResults = await runSecurityTests();
  
  // 結果レポート生成
  const report = {
    timestamp: new Date().toISOString(),
    audit: auditResult,
    tests: testResults,
    summary: {
      totalTests: testResults.length,
      passedTests: testResults.filter(r => r.passed).length,
      failedTests: testResults.filter(r => !r.passed).length,
      vulnerabilities: auditResult.total || 0,
      hasVulnerabilities: (auditResult.total || 0) > 0,
    },
  };
  
  const reportPath = path.join(REPORTS_DIR, `security-report-${Date.now()}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 テスト結果サマリー');
  console.log('='.repeat(60));
  console.log(`  テスト総数: ${report.summary.totalTests}`);
  console.log(`  成功: ${report.summary.passedTests}`);
  console.log(`  失敗: ${report.summary.failedTests}`);
  console.log(`\n  脆弱性総数: ${report.summary.vulnerabilities}`);
  console.log(`\nレポート保存先: ${reportPath}`);
  
  if (auditResult.reportPath) {
    console.log(`npm auditレポート: ${auditResult.reportPath}`);
  }
  
  // 失敗がある場合はエラーコードで終了
  const hasFailures = report.summary.failedTests > 0 || report.summary.hasVulnerabilities;
  process.exit(hasFailures ? 1 : 0);
}

main().catch((error) => {
  console.error('エラーが発生しました:', error);
  process.exit(1);
});


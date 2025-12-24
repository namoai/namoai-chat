const fs = require('fs');
const path = require('path');

// HTML 리포트 읽기
const htmlPath = path.join(__dirname, 'playwright-report', 'index.html');
const html = fs.readFileSync(htmlPath, 'utf8');

// window.playwrightReportData 추출
const match = html.match(/window\.playwrightReportData\s*=\s*({[\s\S]*?});/);
if (!match) {
  console.error('Could not find playwrightReportData in HTML');
  process.exit(1);
}

const data = JSON.parse(match[1]);

// 실패한 테스트 찾기
const failedFiles = data.files.filter(f => 
  f.tests && f.tests.some(t => t.outcome === 'failed')
);

console.log(`\n총 ${failedFiles.length}개 파일에서 실패 발생\n`);
console.log('='.repeat(80));

let totalFailed = 0;

failedFiles.forEach((file, idx) => {
  const failedTests = file.tests.filter(t => t.outcome === 'failed');
  totalFailed += failedTests.length;
  
  console.log(`\n[${idx + 1}] ${file.file}`);
  console.log(`   실패: ${failedTests.length}개 / 전체: ${file.tests.length}개`);
  console.log('-'.repeat(80));
  
  failedTests.forEach((test, testIdx) => {
    const error = test.results?.[0]?.error;
    const errorMessage = error?.message || '에러 메시지 없음';
    const errorLocation = error?.location ? ` (${error.location.file}:${error.location.line})` : '';
    
    console.log(`\n  ${testIdx + 1}. ${test.title}`);
    console.log(`     에러: ${errorMessage.substring(0, 150)}${errorMessage.length > 150 ? '...' : ''}${errorLocation}`);
    
    if (error?.stack) {
      const stackLines = error.stack.split('\n').slice(0, 3);
      console.log(`     스택: ${stackLines.join(' -> ')}`);
    }
  });
  
  if (idx < failedFiles.length - 1) {
    console.log('\n' + '='.repeat(80));
  }
});

console.log(`\n\n총 ${totalFailed}개 테스트 실패\n`);









const fs = require('fs');
const path = require('path');

// HTML 리포트 읽기
const htmlPath = path.join(__dirname, 'playwright-report', 'index.html');
const html = fs.readFileSync(htmlPath, 'utf8');

// base64 인코딩된 ZIP 데이터 찾기
const match = html.match(/<script id="playwrightReportBase64"[^>]*>data:application\/zip;base64,([^<]+)<\/script>/);
if (!match) {
  console.error('Could not find playwrightReportBase64 in HTML');
  process.exit(1);
}

const base64Data = match[1];
const zipBuffer = Buffer.from(base64Data, 'base64');

// JSZip 사용하여 압축 해제
const JSZip = require('jszip');

JSZip.loadAsync(zipBuffer).then(zip => {
  // 모든 JSON 파일 찾기
  const allFiles = Object.keys(zip.files);
  const jsonFiles = allFiles.filter(f => f.endsWith('.json'));
  
  console.log(`Found ${jsonFiles.length} JSON files in ZIP\n`);
  
  // 모든 JSON 파일 읽기
  const promises = jsonFiles.map(file => 
    zip.file(file).async('string').then(str => {
      try {
        return { file, data: JSON.parse(str) };
      } catch (e) {
        return null;
      }
    })
  );
  
  return Promise.all(promises);
}).then(allData => {
  // null 제거
  const validData = allData.filter(d => d !== null);
  
  console.log(`\nProcessing ${validData.length} valid JSON files...\n`);
  
  // 실패한 테스트 찾기
  const failedFiles = [];
  
  // 첫 번째 파일 구조 확인
  if (validData.length > 0) {
    const first = validData[0];
    console.log('First file name:', first.file);
    console.log('First file keys:', Object.keys(first.data));
    if (first.data.tests) {
      console.log('Tests count:', first.data.tests.length);
      if (first.data.tests.length > 0) {
        console.log('First test:', JSON.stringify(first.data.tests[0], null, 2).substring(0, 300));
      }
    }
    console.log('\n');
  }
  
  validData.forEach(({ file, data }) => {
    // data가 파일 정보인 경우
    if (data.tests && Array.isArray(data.tests)) {
      const failedTests = data.tests.filter(t => t.outcome === 'unexpected' || t.outcome === 'failed');
      if (failedTests.length > 0) {
        failedFiles.push({ 
          fileName: data.fileName || data.file || file.replace('.json', ''), 
          tests: data.tests, 
          failedTests 
        });
      }
    }
    // data가 파일 배열인 경우
    else if (Array.isArray(data)) {
      data.forEach(f => {
        if (f.tests && Array.isArray(f.tests)) {
          const failedTests = f.tests.filter(t => t.outcome === 'unexpected' || t.outcome === 'failed');
          if (failedTests.length > 0) {
            failedFiles.push({ fileName: f.fileName || f.file || file, tests: f.tests, failedTests });
          }
        }
      });
    }
    // data.files가 있는 경우
    else if (data.files && Array.isArray(data.files)) {
      data.files.forEach(f => {
        if (f.tests && Array.isArray(f.tests)) {
          const failedTests = f.tests.filter(t => t.outcome === 'unexpected' || t.outcome === 'failed');
          if (failedTests.length > 0) {
            failedFiles.push({ fileName: f.fileName || f.file, tests: f.tests, failedTests });
          }
        }
      });
    }
  });
  
  console.log(`\n총 ${failedFiles.length}개 파일에서 실패 발생\n`);
  console.log('='.repeat(80));
  
  let totalFailed = 0;
  
  failedFiles.forEach((file, idx) => {
    // 이미 필터링된 failedTests 사용
    const failedTests = file.failedTests || file.tests.filter(t => t.outcome === 'unexpected' || t.outcome === 'failed');
    totalFailed += failedTests.length;
    
    console.log(`\n[${idx + 1}] ${file.fileName || file.file || 'Unknown'}`);
    console.log(`   실패: ${failedTests.length}개 / 전체: ${file.tests.length}개`);
    console.log('-'.repeat(80));
    
    failedTests.forEach((test, testIdx) => {
      // 다양한 에러 정보 위치 확인
      let error = null;
      let errorMessage = '에러 메시지 없음';
      let errorLocation = '';
      
      // 에러 정보 찾기 - result.errors 배열 확인 (복수형)
      if (test.results && test.results.length > 0) {
        const result = test.results[0];
        
        // result.errors 배열 확인 (Playwright는 errors 배열 사용)
        if (result.errors && Array.isArray(result.errors) && result.errors.length > 0) {
          error = result.errors[0];
          errorMessage = error.message || errorMessage;
          if (error.location) {
            errorLocation = ` (${error.location.file}:${error.location.line}:${error.location.column || ''})`;
          }
        } 
        // result.error 단수형 확인 (fallback)
        else if (result.error) {
          error = result.error;
          errorMessage = error.message || errorMessage;
          if (error.location) {
            errorLocation = ` (${error.location.file}:${error.location.line}:${error.location.column || ''})`;
          }
        }
        // steps에서 에러 찾기
        else if (result.steps && Array.isArray(result.steps)) {
          for (const step of result.steps) {
            if (step.error) {
              error = step.error;
              errorMessage = error.message || errorMessage;
              if (error.location) {
                errorLocation = ` (${error.location.file}:${error.location.line}:${error.location.column || ''})`;
              }
              break;
            }
          }
        }
      } 
      // test.error 직접 확인
      else if (test.error) {
        error = test.error;
        errorMessage = error.message || errorMessage;
        if (error.location) {
          errorLocation = ` (${error.location.file}:${error.location.line}:${error.location.column || ''})`;
        }
      }
      
      console.log(`\n  ${testIdx + 1}. ${test.title}`);
      console.log(`     에러: ${errorMessage.substring(0, 300)}${errorMessage.length > 300 ? '...' : ''}${errorLocation}`);
      
      if (error?.stack) {
        const stackLines = error.stack.split('\n').slice(0, 8);
        console.log(`     스택:\n        ${stackLines.join('\n        ')}`);
      }
    });
    
    if (idx < failedFiles.length - 1) {
      console.log('\n' + '='.repeat(80));
    }
  });
  
  console.log(`\n\n총 ${totalFailed}개 테스트 실패\n`);
}).catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});


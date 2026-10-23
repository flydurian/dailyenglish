#!/usr/bin/env node
'use strict';

// 클라이언트 번들/저장소에 Gemini 키가 노출되지 않았는지 검사합니다.
// 사용법: npm run key:check  (npm run build 마지막에도 자동 실행)
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const buildDir = path.join(rootDir, 'build');
const GEMINI_KEY_PATTERNS = [
  /AIza[0-9A-Za-z_-]{30,}/,
  /AQ\.[0-9A-Za-z_.-]{20,}/,
];
const problems = [];
const checks = [];

function readFile(file) {
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
}

function loadEnvKey() {
  const line = readFile(path.join(rootDir, '.env'))
    .split('\n')
    .reverse()
    .find(item => /^\s*GEMINI_API_KEY\s*=/.test(item));
  if (!line) return null;
  return line.replace(/^\s*GEMINI_API_KEY\s*=\s*/, '').trim().replace(/^['"]|['"]$/g, '') || null;
}

function walkFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    return entry.isDirectory() ? walkFiles(fullPath) : [fullPath];
  });
}

// 1. .env* 파일에 예전 클라이언트 노출 변수가 남아 있는지
for (const name of fs.readdirSync(rootDir).filter(file => /^\.env/.test(file))) {
  const content = readFile(path.join(rootDir, name));
  if (/^\s*REACT_APP_GEMINI_API_KEY\s*=/m.test(content)) {
    problems.push(`${name}: REACT_APP_GEMINI_API_KEY 는 브라우저 번들에 노출됩니다. GEMINI_API_KEY 로 바꾸세요.`);
  }
}
checks.push('.env* 파일의 클라이언트 노출 변수');

// 2. 소스 코드에서 예전 변수 참조가 남아 있는지
for (const file of walkFiles(path.join(rootDir, 'src'))) {
  if (!/\.(js|jsx|ts|tsx)$/.test(file)) continue;
  if (readFile(file).includes('REACT_APP_GEMINI_API_KEY')) {
    problems.push(`${path.relative(rootDir, file)}: REACT_APP_GEMINI_API_KEY 참조가 남아 있습니다.`);
  }
}
checks.push('src/ 의 클라이언트 키 참조');

// 3. 빌드 결과물에 키가 들어갔는지
const apiKey = process.env.GEMINI_API_KEY || loadEnvKey();
const buildFiles = walkFiles(buildDir).filter(file => /\.(js|mjs|css|html|json|map|txt)$/.test(file));

for (const file of buildFiles) {
  const content = readFile(file);
  const relative = path.relative(rootDir, file);

  if (apiKey && content.includes(apiKey)) {
    problems.push(`${relative}: 실제 Gemini API 키가 포함되어 있습니다.`);
  }

  const hasKeyShape = GEMINI_KEY_PATTERNS.some(pattern => pattern.test(content));
  if (hasKeyShape) {
    problems.push(`${relative}: Google API 키 형식 문자열이 발견되었습니다.`);
  }
}
checks.push(`빌드 결과물 ${buildFiles.length}개 파일의 키 포함 여부`);

// 4. .env 가 gitignore 대상인지
if (!readFile(path.join(rootDir, '.gitignore')).split('\n').map(line => line.trim()).includes('.env')) {
  problems.push('.gitignore 에 .env 가 없습니다.');
}
checks.push('.gitignore 의 .env 제외');

for (const check of checks) console.log(`  · 확인: ${check}`);

if (problems.length > 0) {
  console.error('\n✖ 키 노출 가능성이 발견되었습니다.\n');
  for (const problem of problems) console.error(`  - ${problem}`);
  console.error('');
  process.exit(1);
}

console.log(`\n✓ Gemini 키 노출 검사 통과${apiKey ? '' : ' (GEMINI_API_KEY 는 아직 설정되지 않음)'}\n`);

#!/usr/bin/env node

// 클라이언트 번들/저장소에 Gemini 키가 노출되지 않았는지 검사합니다.
// 사용법: npm run key:check  (npm run build 마지막에도 자동 실행)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const buildDir = path.join(rootDir, 'build');
const GEMINI_KEY_PATTERNS = [
  /AIza[0-9A-Za-z_-]{30,}/,
  /AQ\.[0-9A-Za-z_.-]{20,}/,
];
const SERVER_SECRET_ENV_NAMES = [
  'GEMINI_API_KEY',
  'GOOGLE_TTS_API_KEY',
  'UPSTASH_REDIS_REST_TOKEN',
];
const CLIENT_EXPOSED_SECRET_RE = /^\s*(?:VITE|REACT_APP)_[A-Z0-9_]*(?:API_KEY|SECRET|TOKEN|PASSWORD|PRIVATE_KEY)\s*=/m;
const SRC_FORBIDDEN_REFS = [
  'REACT_APP_GEMINI_API_KEY',
  'VITE_GEMINI_API_KEY',
  'VITE_GOOGLE_TTS_API_KEY',
  'VITE_UPSTASH_REDIS_REST_TOKEN',
];
const problems = [];
const checks = [];

function readFile(file) {
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
}

function loadEnvValue(varName) {
  const regex = new RegExp(`^\\s*${varName}\\s*=`);
  const line = readFile(path.join(rootDir, '.env'))
    .split('\n')
    .reverse()
    .find(item => regex.test(item));
  if (!line) return null;
  return line.replace(regex, '').trim().replace(/^['"]|['"]$/g, '') || null;
}

function walkFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    return entry.isDirectory() ? walkFiles(fullPath) : [fullPath];
  });
}

// 1. .env* 파일에 브라우저 번들에 노출되는 시크릿 변수(VITE_*, REACT_APP_*)가 남아 있는지
for (const name of fs.readdirSync(rootDir).filter(file => /^\.env/.test(file))) {
  const content = readFile(path.join(rootDir, name));
  const match = content.match(CLIENT_EXPOSED_SECRET_RE);
  if (match) {
    const exposedName = match[0].replace(/=.*/, '').trim();
    problems.push(`${name}: ${exposedName} 은(는) 브라우저 번들에 노출됩니다. 서버 전용 변수로 바꾸세요.`);
  }
}
checks.push('.env* 파일의 클라이언트 노출 변수(VITE_*/REACT_APP_*)');

// 2. 소스 코드에서 클라이언트 키 참조가 남아 있는지
for (const file of walkFiles(path.join(rootDir, 'src'))) {
  if (!/\.(js|jsx|ts|tsx)$/.test(file)) continue;
  const content = readFile(file);
  for (const forbidden of SRC_FORBIDDEN_REFS) {
    if (content.includes(forbidden)) {
      problems.push(`${path.relative(rootDir, file)}: ${forbidden} 참조가 남아 있습니다.`);
    }
  }
}
checks.push('src/ 의 클라이언트 키 참조');

// 3. 빌드 결과물에 서버 시크릿이 들어갔는지
const serverSecrets = SERVER_SECRET_ENV_NAMES
  .map((name) => ({ name, value: process.env[name] || loadEnvValue(name) }))
  .filter((entry) => entry.value && entry.value.length >= 8);
const buildFiles = walkFiles(buildDir).filter(file => /\.(js|mjs|css|html|json|map|txt)$/.test(file));

for (const file of buildFiles) {
  const content = readFile(file);
  const relative = path.relative(rootDir, file);

  for (const secret of serverSecrets) {
    if (content.includes(secret.value)) {
      problems.push(`${relative}: 실제 ${secret.name} 값이 포함되어 있습니다.`);
    }
  }

  const hasKeyShape = GEMINI_KEY_PATTERNS.some(pattern => pattern.test(content));
  if (hasKeyShape) {
    problems.push(`${relative}: Google API 키 형식 문자열이 발견되었습니다.`);
  }
}
checks.push(`빌드 결과물 ${buildFiles.length}개 파일의 시크릿 포함 여부`);

// 4. .env 가 gitignore 대상인지 (Vercel CLI 업로드에는 .gitignore 가 포함되지 않으므로 Vercel 빌드에서는 건너뛴다)
if (process.env.VERCEL) {
  checks.push('.gitignore 의 .env 제외 (Vercel 빌드에서는 건너뜀)');
} else {
  if (!readFile(path.join(rootDir, '.gitignore')).split('\n').map(line => line.trim()).includes('.env')) {
    problems.push('.gitignore 에 .env 가 없습니다.');
  }
  checks.push('.gitignore 의 .env 제외');
}

for (const check of checks) console.log(`  · 확인: ${check}`);

if (problems.length > 0) {
  console.error('\n✖ 키 노출 가능성이 발견되었습니다.\n');
  for (const problem of problems) console.error(`  - ${problem}`);
  console.error('');
  process.exit(1);
}

const configuredNames = serverSecrets.map((s) => s.name).join(', ');
console.log(`\n✓ 시크릿 노출 검사 통과${configuredNames ? ` (${configuredNames} 검사됨)` : ' (서버 시크릿 미설정 상태)'}\n`);

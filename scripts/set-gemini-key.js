#!/usr/bin/env node
'use strict';

// Gemini API 키를 화면에 노출하지 않고 .env 에 저장하는 스크립트입니다.
// 사용법: npm run key:set
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const envPath = path.join(rootDir, '.env');
const gitignorePath = path.join(rootDir, '.gitignore');
const MODELS_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models?pageSize=1';

function fail(message) {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
}

function readFile(file) {
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
}

function ensureEnvIgnored() {
  const ignored = readFile(gitignorePath)
    .split('\n')
    .map(line => line.trim());

  if (!ignored.includes('.env')) {
    fail('.env 가 .gitignore 에 없습니다. 키가 저장소에 커밋되지 않도록 .env 를 먼저 추가하세요.');
  }
}

function askHidden(question) {
  if (!process.stdin.isTTY) {
    fail('보안을 위해 대화형 터미널에서 실행해야 합니다. (예: 터미널에서 npm run key:set)');
  }

  return new Promise((resolve) => {
    const stdin = process.stdin;
    const stdout = process.stdout;
    let value = '';
    let finished = false;

    stdout.write(question);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');

    function cleanup() {
      if (finished) return;
      finished = true;
      stdin.removeListener('data', onData);
      stdin.setRawMode(false);
      stdin.pause();
    }

    function finish() {
      cleanup();
      stdout.write('\n');
      resolve(value.trim());
    }

    function onData(chunk) {
      // 붙여넣기(bracketed paste) 마커 제거
      const hadPasteMarker = /\u001b\[20[01]~/.test(chunk);
      chunk = chunk.replace(/\u001b\[20[01]~/g, '');

      // 화살표 키 등 제어 시퀀스는 통째로 무시
      if (!hadPasteMarker && chunk.includes('\u001b')) return;

      for (const char of chunk) {
        if (char === '\r' || char === '\n') {
          finish();
          return;
        }
        if (char === '\u0003') {
          cleanup();
          stdout.write('\n');
          process.exit(130);
        }
        if (char === '\u007f' || char === '\b') {
          value = value.slice(0, -1);
          continue;
        }
        // 출력 가능한 문자는 모두 허용합니다. (AQ. 형식 키의 마침표 포함)
        // 공백/제어문자는 normalizeKey/validateFormat 에서 처리합니다.
        if (char >= ' ' && char !== '\u007f') value += char;
      }
    }

    stdin.on('data', onData);
  });
}

// 실수로 변수명까지 붙여넣은 경우("GEMINI_API_KEY=...")와 따옴표/공백을 정리합니다.
function normalizeKey(input) {
  let key = String(input).trim();
  key = key.replace(/^(?:export\s+)?(?:REACT_APP_)?GEMINI_API_KEY\s*=\s*/i, '');
  key = key.replace(/^['"`]|['"`]$/g, '');
  key = key.replace(/\s+/g, '');
  return key;
}

function validateFormat(key) {
  if (!key) {
    fail('키가 입력되지 않았습니다.');
  }

  if (key.length < 20) {
    fail(`키가 너무 짧습니다 (${key.length}자). 복사가 중간에 끊겼는지 확인하세요.`);
  }

  // AIza... 형식과 AQ.... 형식 모두 허용합니다.
  if (!/^[A-Za-z0-9._-]+$/.test(key)) {
    fail('키에 허용되지 않는 문자가 있습니다. 키 전체를 다시 복사해 주세요.');
  }

  if (!/^(AIza|AQ\.)/.test(key)) {
    console.warn('⚠ 일반적인 Gemini 키 접두사(AIza, AQ.)가 아니지만, Google 검증을 계속합니다.');
  }
}

function loadEnvKey() {
  const line = readFile(envPath)
    .split('\n')
    .reverse()
    .find(item => /^\s*GEMINI_API_KEY\s*=/.test(item));
  if (!line) return null;
  return line.replace(/^\s*GEMINI_API_KEY\s*=\s*/, '').trim().replace(/^['"]|['"]$/g, '') || null;
}

async function verifyKey(key) {
  let response;

  try {
    response = await fetch(MODELS_ENDPOINT, {
      headers: { 'x-goog-api-key': key },
      signal: AbortSignal.timeout(20_000),
    });
  } catch (error) {
    fail(`키 검증 중 네트워크 오류가 발생했습니다: ${error.message}`);
  }

  if (response.status === 429) {
    console.warn('⚠ 할당량 제한(429)이지만 키는 유효한 것으로 보입니다. 저장을 계속합니다.');
    return;
  }

  if (!response.ok) {
    const body = (await response.text()).replaceAll(key, '***');
    if (/API_KEY_INVALID|API key not valid/i.test(body)) {
      fail('Google이 키를 유효하지 않다고 응답했습니다. 새 키를 다시 확인하세요.');
    }
    if (response.status === 401 || response.status === 403) {
      fail(
        '키 권한이 거부되었습니다. AI Studio(aistudio.google.com/apikey)에서 발급한 Gemini API 키인지 확인하세요. ' +
        'Google Cloud/Vertex Express에서 만든 키는 이 API에서 사용할 수 없습니다.'
      );
    }
    fail(`키 검증에 실패했습니다 (HTTP ${response.status}). 잠시 후 다시 시도하세요.`);
  }
}

function saveKey(key) {
  const lines = readFile(envPath).split('\n');
  const output = [];
  let replaced = false;

  for (const line of lines) {
    if (/^\s*(REACT_APP_GEMINI_API_KEY|GEMINI_API_KEY)\s*=/.test(line)) {
      if (!replaced) {
        output.push(`GEMINI_API_KEY=${key}`);
        replaced = true;
      }
      continue;
    }
    output.push(line);
  }

  while (output.length > 0 && output[output.length - 1].trim() === '') output.pop();
  if (!replaced) output.push(`GEMINI_API_KEY=${key}`);

  fs.writeFileSync(envPath, `${output.join('\n')}\n`, { mode: 0o600 });
  fs.chmodSync(envPath, 0o600);
}

async function main() {
  // --verify: .env 의 현재 키가 유효한지만 확인하고 아무것도 변경하지 않습니다.
  if (process.argv.includes('--verify')) {
    ensureEnvIgnored();
    const savedKey = loadEnvKey();
    if (!savedKey) fail('.env 에 GEMINI_API_KEY 가 없습니다. npm run key:set 으로 먼저 설정하세요.');
    const currentKey = normalizeKey(savedKey);
    validateFormat(currentKey);
    await verifyKey(currentKey);
    console.log('\n✓ 현재 .env 의 GEMINI_API_KEY 가 유효합니다.\n');
    return;
  }

  console.log('\nGemini API 키 교체');
  console.log('키는 화면에 표시되지 않으며, 브라우저 번들에는 포함되지 않습니다.\n');

  ensureEnvIgnored();

  const key = normalizeKey(await askHidden('새 Gemini API 키: '));
  if (!key) fail('키가 입력되지 않았습니다.');
  console.log(`  입력 길이: ${key.length}자`);

  validateFormat(key);
  await verifyKey(key);
  saveKey(key);

  console.log('\n✓ 키를 검증하고 .env 에 저장했습니다. (권한 600)');
  console.log('  다음 단계:');
  console.log('  1. 개발 서버를 재시작하세요: npm run dev');
  console.log('  2. Vercel 배포 환경의 GEMINI_API_KEY 도 새 키로 갱신한 뒤 재배포하세요.');
  console.log('  3. Google AI Studio에서 기존 키를 삭제(폐기)하세요.\n');
}

if (require.main === module) {
  main().catch((error) => {
    fail(error.message);
  });
}

module.exports = { normalizeKey, validateFormat, loadEnvKey };

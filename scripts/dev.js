// 개발용 스크립트: 로컬 API 서버와 CRA 개발 서버를 함께 실행합니다.
// 사용법: npm run dev
const { spawn } = require('child_process');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const children = [];
let shuttingDown = false;

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) child.kill('SIGTERM');
  }
  setTimeout(() => process.exit(code), 500).unref();
}

function run(name, args) {
  const child = spawn(process.execPath, args, {
    cwd: rootDir,
    stdio: 'inherit',
    env: process.env,
  });
  children.push(child);

  child.on('exit', (code, signal) => {
    if (shuttingDown) return;
    console.log(`[dev] ${name} 프로세스가 종료되었습니다 (code=${code}, signal=${signal})`);
    shutdown(code ?? 1);
  });

  child.on('error', (error) => {
    console.error(`[dev] ${name} 실행 실패:`, error);
    shutdown(1);
  });
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

run('api', ['server/dev-api.mjs']);
run('web', [path.join(rootDir, 'node_modules', 'react-scripts', 'scripts', 'start.js')]);

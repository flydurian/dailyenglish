// api/ 아래의 Vercel 서버리스 함수를 로컬에서 그대로 실행하는 개발용 서버입니다.
// `npm run dev` (웹 + API 동시 실행) 또는 `npm run dev:api` 로 실행합니다.
import { createServer } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// npm run dev:api 를 단독 실행해도 .env 의 DEV_API_PORT 를 사용할 수 있게 합니다.
function loadEnvFile(file) {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*?)\s*$/);
    if (!match || line.trim().startsWith('#')) continue;
    if (process.env[match[1]] === undefined) {
      process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
    }
  }
}

// CRA와 같은 우선순위(.env.development.local > .env.local > .env.development > .env)로
// 읽습니다. 이미 설정된 환경 변수는 덮어쓰지 않습니다.
for (const name of ['.env.development.local', '.env.local', '.env.development', '.env']) {
  loadEnvFile(path.join(rootDir, name));
}

const port = Number(process.env.DEV_API_PORT || 3101);
const host = process.env.DEV_API_HOST || '127.0.0.1';

// URL 경로 -> Vercel 핸들러 파일
const routes = new Map([
  ['/api/news', path.join(rootDir, 'api', 'news.js')],
  ['/api/gemini', path.join(rootDir, 'api', 'gemini.js')],
]);

const handlers = new Map(
  await Promise.all(
    [...routes].map(async ([route, file]) => {
      const mod = await import(pathToFileURL(file).href);
      return [route, mod.default];
    })
  )
);

// Vercel의 res.status().json() 형태를 흉내 냅니다.
function enhanceResponse(res) {
  res.status = (statusCode) => {
    res.statusCode = statusCode;
    return res;
  };
  res.json = (body) => {
    if (!res.hasHeader('Content-Type')) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
    }
    res.end(JSON.stringify(body));
    return res;
  };
  return res;
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (chunks.length === 0) return undefined;
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    return undefined;
  }
}

const server = createServer(async (req, res) => {
  enhanceResponse(res);

  const url = new URL(req.url, `http://${req.headers.host || `${host}:${port}`}`);
  const pathname = url.pathname.replace(/\/+$/, '') || '/';
  const handler = handlers.get(pathname);

  if (!handler) {
    res.status(404).json({ error: `Not found: ${pathname}` });
    return;
  }

  req.query = Object.fromEntries(url.searchParams);
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    req.body = await readJsonBody(req);
  }

  try {
    await handler(req, res);
  } catch (error) {
    console.error(`[dev-api] ${req.method} ${pathname} 실패:`, error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error', message: error.message });
    }
  }
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(
      `[dev-api] 포트 ${port}이(가) 이미 사용 중입니다. .env 의 DEV_API_PORT 를 다른 포트로 바꿔주세요.`
    );
  } else {
    console.error('[dev-api] 서버 오류:', error);
  }
  process.exit(1);
});

server.listen(port, host, () => {
  console.log(`[dev-api] http://${host}:${port} 에서 실행 중`);
  for (const route of handlers.keys()) console.log(`[dev-api]   GET ${route}`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}

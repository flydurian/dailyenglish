const { createProxyMiddleware } = require('http-proxy-middleware');

// 개발 모드에서 CRA(기본 3002)의 /api 요청을 로컬 dev API 서버로 넘깁니다.
// 포트는 .env 의 DEV_API_PORT 로 변경할 수 있습니다.
const target = `http://127.0.0.1:${process.env.DEV_API_PORT || 3101}`;

module.exports = function (app) {
  app.use(
    '/api',
    createProxyMiddleware({
      target,
      changeOrigin: false,
      logLevel: 'warn',
    })
  );
};

# Security Notes

Last reviewed: 2026-10-24

## Stack scope

This app is a React 18 single-page app deployed on Vercel, with two Node serverless functions:

- `api/gemini.js` — authenticated server-side proxy for Gemini text/TTS
- `api/news.js` — fixed-feed RSS proxy

There is no PHP, Apache, MySQL, or WordPress runtime, so PHP-specific advisories do not apply. The review focused on the actual attack surface: secrets, public API routes, headers, dependency supply chain, and client-side injection.

## Applied hardening

### Secrets

- `GEMINI_API_KEY` exists only in server environment variables and local `.env` (gitignored, mode `600`).
- The browser never receives the key; every Gemini call goes through `/api/gemini`.
- `npm run build` scans the client source and build output for key material.
- Git history was checked for `AIza…` / `AQ.…` key patterns; none were found in tracked history.
- If a key is ever exposed, revoke it in Google AI Studio and issue a new one before redeploying.

### Gemini API

- Model allowlist; no arbitrary model or URL.
- Origin allowlist + same-origin browser check. Cross-site requests receive `403`.
- Strict request schema:
  - text: user text parts only, safe `generationConfig` keys, max 20,000 characters
  - TTS: one text part, `responseModalities: ["AUDIO"]`, max 1,200 characters
  - unknown fields (`tools`, `systemInstruction`, arbitrary config) are rejected
- Request body cap: 80 KB.
- Rate limits (best-effort, per serverless instance):
  - text: 20 requests/minute/IP
  - TTS: 3 requests/minute/IP and 3 requests/minute globally
- TTS 429 falls back only to `gemini-3.8-flash-lite-tts`; no paid model fallback.
- No client-side TTS retry; cache prevents duplicate generation.
- Upstream error bodies are not returned to clients.

### News API

- Fixed Google News RSS URLs; `type` is restricted to `korean` / `world`.
- Removed wildcard CORS.
- RSS response capped at 1.5 MB and 50 items.
- Article URLs are accepted only with `http://` or `https://`.
- Response fields are length-capped; upstream error details are not exposed.

### Browser headers (`vercel.json`)

- Content Security Policy: self-only scripts/connections, inline styles allowed for Emotion, blob media for TTS audio, no framing.
- HSTS, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, referrer policy, permissions policy.
- `X-XSS-Protection: 0` (avoid legacy filter behavior; CSP is the control).

### Dependencies

- React / React DOM updated to 18.3.1; unused `web-vitals` removed.
- `package-lock.json` is now tracked for reproducible installs.
- The build moved from Create React App 5 to **Vite 8**; the old CRA
  dev-server/toolchain tree (62 dev-only advisories) is gone.
- `yaml@1.10.3` override remains for the Emotion build chain.
- Audit: `npm audit --omit=dev` and `npm audit --include=dev` → **0 vulnerabilities**.

## Residual risks

- The API is protected by origin checks, schema validation, and rate limits, but a static SPA cannot hold a true client secret. A determined attacker can spoof request headers. For stronger protection, put Vercel WAF / rate limiting in front of `/api/*`, or add authenticated user sessions.
- Rate limiting is in-memory per serverless instance. It is not a global quota across regions/instances; rely on Google's 429 and Vercel WAF for hard global limits.
- React 19 major updates are intentionally blocked in Dependabot until the app is migrated as one coordinated change. Vite is compatible, but React 19 needs an app-wide review rather than a single-package bump.
- TTS remains on the Gemini free tier. A Google Cloud project with a billing account attached can still incur charges; code cannot enforce billing state. Keep the project's billing account unlinked if zero spend is required.
- CSP allows `'unsafe-inline'` for styles because Emotion injects styles at runtime. Scripts remain restricted to `'self'`.

## Verification

```bash
npm audit --omit=dev
npm audit --include=dev
npm run build
npm run key:check
```

API checks performed locally:

- no `Origin` / foreign origin → `403`
- allowed origin → `200`
- invalid schema → `400`
- oversized body → `413`
- TTS returns `audio/wav`
- `/api/news` returns `200` without wildcard CORS
- built app served with the production CSP → no CSP violations

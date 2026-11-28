# 성능 · 비용 최적화 노트

모바일 체감 속도와 Gemini/Vercel 호출 비용을 줄이기 위해 적용한 내용입니다.

## 1. 서버 (Vercel)

### 함수 리전을 서울로 고정
`vercel.json`의 `regions: ["icn1"]`로 API 함수를 서울 리전에서 실행합니다. 기본 미국 리전(iad1)보다 한국 사용자 기준 왕복 지연이 줄어듭니다.

### 뉴스 API 일일 공용 캐시 + CDN 캐시
`/api/news`는 KST 날짜별 대표 기사를 메모리·Upstash Redis(`news:{type}:{YYYY-MM-DD}`, 24시간 TTL)에 고정해 같은 날 모든 사용자가 동일한 기사를 받습니다.

```
Cache-Control: public, max-age=300, s-maxage=1800, stale-while-revalidate=86400
```

- 브라우저 5분, Vercel CDN 30분 캐시 + Upstash Redis 24시간 공용 캐시 (`X-News-Cache: HIT | HIT-SHARED | MISS`)
- RSS 제목/본문/출처의 HTML 엔티티 디코딩 및 10초 타임아웃 적용
- 모든 방문자가 같은 일일 기사와 결정적 구동사 목록으로 요약을 요청하므로 후속 `/api/gemini` 공용 캐시 히트율이 극대화됨

### Gemini 응답 2계층 캐시 (인메모리 LRU + Upstash Redis 공유 캐시)
`/api/gemini`에 텍스트 응답용 2계층 캐시를 적용했습니다.

- 1차(인스턴스 메모리): 진정한 LRU(조회 시 최신화), 최대 40개, TTL 6시간 (`X-Gemini-Cache: HIT`)
- 2차(Upstash Redis 공유 캐시, `lib/sharedCache.js`): TTL 24시간, 콜드 스타트·인스턴스 간 공유 (`X-Gemini-Cache: HIT-SHARED`)
- 모델 tier + 정규화된 요청 payload의 SHA-256을 키로 사용 (TTS 바이너리는 제외)
- UTF-8 바이트 기준(`Buffer.byteLength`) 페이로드 상한 검증 및 rate-limit 버킷 FIFO 상한 축출 적용

### AI 강의 SSE 실시간 스트리밍 직결
- `stream: true` 텍스트 요청(뉴스 AI 문장 강의)은 업스트림 Gemini SSE 델타를 클라이언트로 즉시 전달 (`Content-Type: text/event-stream`)
- 첫 조각 도착 전 오류(429·타임아웃 등)는 기존 모델 체인 폴백을 그대로 수행하고, 캐시 히트 시에는 JSON으로 즉시 응답
- 스트림 완료 시 합산된 전체 결과를 메모리·Redis 캐시에 자동 저장

### TTS Opus 트랜스코딩 튜닝 & 메모리 안전성
- 음성 전용 Opus VBR(`36 kbps`, `complexity: 5`)로 조정해 명료도를 유지하면서 페이로드·WASM CPU 시간 절감
- `try/finally`로 `encoder.free()`를 보장하고, 홀수 `byteOffset` 버퍼 정렬 가드 적용

## 2. 클라이언트

### 번들 경량화 & 코드 스플리팅
- 미사용 Tailwind CSS v4 및 구 다크 테마 CSS(~1,500줄)를 제거하고 Editorial Paper 전역 스타일(2.18 kB)로 경량화
- 초기 화면(`오늘의 표현`)에 불필요한 탭·모달(`NewsCard`, `TodayWordsView`, `WordbookView`, `ReviewView`, `WordModal`, `ExplanationModal`, `ReadAlongPractice`)을 `React.lazy` + `Suspense`로 분리
- 22 kB 구동사 사전(`phrasalVerbDetails.ts`)을 카드 확장·모달 오픈 시 동적 `import()`로 지연 로드

### 일일 콘텐츠 캐시 재사용 & 안정화
- 날짜 키를 로컬 기준(`toLocalDateKey`)으로 통일하고 자정/포커스 복귀 시 자동 갱신
- 레벨별 표현·뉴스 캐시를 머지해 레벨 전환 시 기존 캐시가 유실되지 않도록 유지
- 폴백 응답(`isFallback`)은 캐시하지 않아 일시 오류로 하루 종일 폴백 문구가 고정되는 문제 방지
- `localStorage` `QuotaExceededError` 발생 시 오래된 월별 캐시 정리 후 재시도
- `useDataFetching`의 in-flight Map 및 `useTranslation`의 `runDeduped`로 중복 API 호출 차단

### 렌더링 & 메모리 최적화
- `FontSizeContext` 값 메모이제이션 + `localStorage` 영속화, `WordbookContext` `Set` 기반 $O(1)$ 조회 및 콜백 안정화
- `useAudio` 단일 재생 제어(중첩 재생 방지), `loadingKeysRef` 기반 콜백 안정화, 인메모리 오디오 캐시 12개 LRU 상한 및 `revokeObjectURL` 정리
- `audioCache.ts`의 IndexedDB 정리를 `getAll()` 대신 `timestamp` 인덱스 `openKeyCursor()`로 전환해 정리 중 오디오 Blob 메모리 적재 제거
- `ExplanationModal` 마크다운 파싱 `useMemo` 캐싱 및 스트리밍 점진 렌더링

### 무료 티어 전용 TTS 폴백과 과금 방지
- TTS 체인: `gemini-3.8-flash-tts` → `gemini-3.8-flash-lite-tts` → `gemini-3.1-flash-tts-preview` → `gemini-2.5-flash-preview-tts`
- Gemini 체인 소진 시 Upstash 월 한도 가드(전역 + IP별 HMAC 해시, 단일 타임스탬프 예약/환불)가 붙은 Google Cloud TTS로 폴백 후 브라우저 TTS로 최종 폴백
- **과금 방지의 최종 보장은 Google Cloud 프로젝트에 결제 계정이 연결되지 않은 상태**입니다.
- 앱 설정: TTS 6 RPM/IP + 6 RPM 전역, 텍스트 20 RPM/IP

### 테스트 속도 최적화
- `vitest.config.mjs` 기본 환경을 `node`로 설정하고 실제 DOM 컴포넌트 테스트(5개 파일)만 `// @vitest-environment jsdom`을 사용하도록 분리

## 3. 측정 결과

| 항목 | 결과 |
|---|---|
| CSS 번들 크기 | **2.18 kB** (gzip **1.09 kB**, 기존 49.13 kB 대비 -95.6%) |
| 초기 JS 번들 (`index.js`) | **311.52 kB** (gzip **99.22 kB**) + 8개 지연 청크 분할 |
| 테스트 실행 | **24개 파일 / 157개+ 테스트 · ~1.9s** (기존 7.0s 대비 약 3.6배 단축) |
| 첫 방문 표현·뉴스 생성 | 같은 날·레벨 기준 전 사용자 공용 캐시(`HIT-SHARED`) 공유 |
| 새로고침 후 표현·뉴스·번역 | Gemini 호출 0회 (`localStorage` 캐시) |
| 새로고침 후 같은 TTS | Gemini 호출 0회 (`IndexedDB` 캐시) |
| AI 문장 강의 | 첫 조각 도착 즉시 SSE 실시간 렌더링 |

## 4. 추가 권장 (트래픽이 크게 늘어날 때)

1. **TTS 공용 CDN 캐시**: 매일 3문장의 대표 오디오를 Blob/CDN에 저장해 TTS 비용을 사용자 수와 무관하게 고정
2. **Vercel 사용량 모니터링**: 함수 호출 수, GB-seconds, Gemini 토큰 사용량을 주간 단위로 확인
3. **사전 워밍 Cron**: 매일 KST 00:05에 Vercel Cron으로 대표 레벨(B1 등) 콘텐츠를 사전 생성해 첫 방문자 대기 시간까지 제거

# 성능 · 비용 최적화 노트

모바일 체감 속도와 Gemini/Vercel 호출 비용을 줄이기 위해 적용한 내용입니다.

## 1. 서버 (Vercel)

### 함수 리전을 서울로 고정
`vercel.json`의 `regions: ["icn1"]`로 API 함수를 서울 리전에서 실행합니다. 기본 미국 리전(iad1)보다 한국 사용자 기준 왕복 지연이 줄어듭니다.

### 뉴스 API CDN 캐시
`/api/news` 성공 응답에 다음 헤더를 추가했습니다.

```
Cache-Control: public, max-age=300, s-maxage=1800, stale-while-revalidate=86400
```

- 브라우저 5분, Vercel CDN 30분 캐시
- 같은 뉴스 요청은 함수를 다시 호출하지 않고 CDN에서 응답
- RSS 요청에 10초 타임아웃을 추가해 장애 시 함수가 길게 점유되지 않도록 함

### Gemini 응답 인메모리 LRU
`/api/gemini`에 텍스트 응답용 LRU 캐시를 추가했습니다.

- 최대 40개, TTL 6시간
- 모델 + 요청 payload의 SHA-256을 키로 사용
- TTS 오디오 응답은 크기가 커서 캐시하지 않음
- 응답 헤더 `X-Gemini-Cache: HIT | MISS | BYPASS`로 확인 가능

서버리스 인스턴스가 재사용되는 동안 동일한 일일 콘텐츠/번역 요청이 반복되면 업스트림 호출을 생략합니다.
(콜드 스타트나 다른 인스턴스에서는 공유되지 않으므로, 규모가 커지면 아래 "추가 권장" 참고)

## 2. 클라이언트

### 일일 콘텐츠 캐시 재사용
- 날짜·레벨별 표현/뉴스 캐시가 있으면 필드 유무와 관계없이 그대로 사용
- 예전에는 `situation`/`examples` 필드가 하나라도 없으면 캐시를 버리고 Gemini를 다시 호출했음
- 상세 정보는 로컬 `phrasalVerbDetails`로 보완되므로 재생성이 불필요

### 중복 요청 합치기
- `useDataFetching`에 in-flight Map을 두고 `날짜 + 레벨 + 탭` 단위로 요청을 공유
- 레벨을 빠르게 바꾸거나 StrictMode에서 effect가 재실행되어도 동일 요청은 1회만 발생

### TTS 오디오 캐시를 IndexedDB로 이전
- 기존 localStorage 캐시는 동기 I/O + 5MB 제한 + 실제 복원이 되지 않는 구조였음
- IndexedDB에 WAV Blob을 저장하고, 재생 시 메모리 → IndexedDB → Gemini TTS 순서로 확인
- 최대 25개, 7일 TTL, 초과분 자동 정리
- 탭/레벨 전환 때 오디오 캐시를 지우던 동작 제거
- 기존 `tts_audio_cache` localStorage 키는 1회 정리

### 번역 캐시 안정화
- `saveToCache`가 이전 state를 참조해 동시 번역 시 캐시가 덮어써지던 문제를 함수형 업데이트로 수정
- 번역 출력 토큰 상한을 4000 → 2000(일반), 2000 → 1200(청크)으로 조정

### 뉴스 프롬프트 입력 절단
- 기사 본문을 최대 6,000자로 제한해 입력 토큰 폭주를 방지

### 스크롤 페인트 최적화
- 고정(fixed) + `mix-blend-mode` 그레인 레이어를 제거하고 body 배경 이미지 레이어로 이동
- 모바일 스크롤 시 합성 레이어 비용 감소

## 3. 측정 결과

| 항목 | 결과 |
|---|---|
| 첫 방문 표현 생성 | Gemini TEXT 1회 |
| 새로고침 후 표현 | Gemini 호출 0회 (localStorage 캐시) |
| 첫 TTS 재생 | Gemini TTS 1회, IndexedDB 1건 저장 |
| 새로고침 후 같은 TTS | Gemini 호출 0회 (IndexedDB 캐시) |
| 번역 | 첫 요청 1회, 새로고침 후 0회 (localStorage 캐시) |
| `/api/gemini` 동일 요청 2회 | 1회차 `MISS` → 2회차 `HIT` |
| 뉴스 API | `s-maxage=1800` 헤더 확인 |
| 번들 크기 | JS 90.66 kB gzip (+0.3 kB), CSS 5.05 kB gzip |

## 4. 추가 권장 (사용자·트래픽이 늘어날 때)

1. **일일 콘텐츠를 한 번만 생성해 공유**: Vercel Cron + Edge Config/KV/Blob에 날짜·레벨별 결과를 저장하면 사용자 수와 무관하게 하루 6회 수준으로 고정 가능
2. **TTS도 공용 캐시**: 매일 3문장의 오디오를 미리 생성해 CDN에 두면 TTS 비용이 사용자 수에 비례하지 않음
3. **번역 공용 캐시**: 동일 문장 번역을 서버 KV에 저장
4. **Vercel 사용량 모니터링**: 함수 호출 수, GB-seconds, Gemini 토큰 사용량을 주간 단위로 확인
5. **번들 분리**: 기능이 더 늘어나면 모달/뉴스 탭을 `React.lazy`로 분리

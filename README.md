# Daily English Expressions 🚀

매일 3개의 영어 구동사를 학습하는 React 앱입니다. 원어민처럼 말하기 위한 하루 3개 구동사 챌린지로, 실용적이고 자주 사용되는 영어 표현을 학습할 수 있습니다.

## ✨ 주요 기능

- **일일 구동사 학습**: 매일 3개의 새로운 구동사와 예문 제공
- **뉴스 기반 학습**: 실제 뉴스 기사를 통한 실용적인 영어 학습
- **레벨별 맞춤 학습**: CEFR A1-C2 레벨에 맞는 콘텐츠 제공
- **음성 재생**: TTS를 통한 정확한 발음 학습
- **한국어 번역**: 실시간 번역 기능으로 이해도 향상
- **캐시 시스템**: 효율적인 데이터 관리로 빠른 로딩
- **단어장**: 저장한 표현과 단어를 모아 복습
- **오늘의 단어**: 오늘의 표현과 뉴스에서 중요한 단어를 한 페이지에 자동으로 모아 보기 (준비된 자료부터 표시)
- **간격 반복 복습(플래시카드)**: SRS 기반 플래시카드로 효율적인 복습
- **학습 기록(연속 학습일)**: 연속 학습일과 최근 7일 활동 확인
- **반응형 디자인**: 모바일과 데스크톱에서 최적화된 경험

## 🏗️ 최적화된 아키텍처

### 컴포넌트 구조
```
src/
├── components/          # 재사용 가능한 UI 컴포넌트
│   ├── Icons.jsx       # SVG 아이콘 컴포넌트
│   ├── Calendar.jsx    # 달력 컴포넌트
│   ├── WordModal.jsx   # 단어 상세 정보 모달
│   ├── ExpressionCard.jsx # 표현 카드 컴포넌트
│   ├── NewsCard.jsx    # 뉴스 카드 컴포넌트
│   ├── WordbookView.jsx # 저장한 표현 단어장
│   ├── TodayWordsView.jsx # 오늘의 표현·뉴스 단어 모음
│   ├── ReviewView.jsx  # 간격 반복 복습 플래시카드
│   ├── ProgressStrip.jsx # 연속 학습일·최근 7일 기록
│   └── ErrorBoundary.jsx # 에러 처리 컴포넌트
├── contexts/           # 전역 상태 컨텍스트
│   ├── WordbookContext.jsx # 단어장 상태 및 저장
│   └── ProgressContext.jsx # 학습 기록 상태 및 저장
├── hooks/              # 커스텀 React 훅
│   ├── useAudio.js     # 오디오 재생 로직
│   ├── useTranslation.js # 번역 및 요약 로직
│   └── useDataFetching.js # 데이터 가져오기 로직
├── utils/              # 유틸리티 함수
│   ├── audioUtils.js   # 오디오 처리 함수
│   ├── cacheUtils.js   # 캐시 관리 함수
│   ├── apiUtils.js     # API 호출 함수
│   ├── dateUtils.js    # 로컬 날짜 키 유틸
│   ├── wordbookUtils.js # 단어장 순수 로직
│   ├── todayWords.js   # 오늘의 단어 추출 순수 로직
│   ├── srs.js          # 간격 반복 계산
│   └── progress.js     # 학습 기록 계산
└── App.jsx             # 메인 애플리케이션 컴포넌트
```

### 성능 최적화

1. **컴포넌트 분리**: 단일 파일에서 모듈화된 구조로 변경
2. **커스텀 훅**: 로직 재사용성 향상 및 관심사 분리
3. **메모이제이션**: useCallback, useMemo를 통한 불필요한 리렌더링 방지
4. **에러 바운더리**: 애플리케이션 안정성 향상
5. **캐시 시스템**: 효율적인 데이터 관리
6. **지연 로딩**: 필요할 때만 데이터 로드

## 🚀 시작하기

### 필수 요구사항
- Node.js 22.12.0 이상
- npm 또는 yarn

### 설치 및 실행

1. **저장소 클론**
```bash
git clone <repository-url>
cd dailyenglish
```

2. **의존성 설치**
```bash
npm install
```

3. **환경 변수 설정**
```bash
cp env.example .env
```
`.env` 파일에 서버 전용 Gemini API 키를 설정하세요:
```
GEMINI_API_KEY=your_api_key_here
```
`REACT_APP_` 접두사를 붙이면 브라우저 번들에 키가 노출되므로 사용하지 않습니다. 배포 시에는 Vercel 프로젝트의 환경변수에 `GEMINI_API_KEY`를 등록하세요.

#### 🔊 Google Cloud TTS 서브 (선택)

기본 TTS는 Gemini입니다. Gemini 무료 한도(모델별 하루 10회)가 소진되면 **Google Cloud TTS**가
영국 발음 서브로 자동 이어받습니다. 아래 **필수 3개**가 모두 있을 때만 켜지고, 하나라도 없거나
사용량 저장소(Upstash)에 문제가 있으면 과금 사고를 막기 위해 구글 호출을 건너뜁니다.

| 변수 | 필수 | 설명 |
| --- | --- | --- |
| `GOOGLE_TTS_API_KEY` | ✅ | GCP에서 발급한 API 키. **Cloud Text-to-Speech API만 허용**하도록 제한하세요. |
| `UPSTASH_REDIS_REST_URL` | ✅ | 전역 월 사용량 카운터 저장소 (무료 티어로 충분) |
| `UPSTASH_REDIS_REST_TOKEN` | ✅ | 위 저장소의 토큰 |
| `GOOGLE_TTS_MONTHLY_LIMIT` | — | 앱이 스스로 멈추는 월 문자 수. 기본 `900000` (무료 100만 자 − 안전 마진 10만 자) |
| `GOOGLE_TTS_VOICE` | — | 기본 `en-GB-Chirp3-HD-Charon` |

1. GCP 콘솔에서 **결제 사용 설정** + Cloud Text-to-Speech API 사용 설정 (무료 한도만 써도 카드 등록 필요)
2. **예산 알림/상한**을 반드시 설정 (앱 카운터는 실수 방지용, 최후의 보루는 GCP 예산)
3. Vercel → Settings → Environment Variables에 위 값을 추가하고 **Redeploy**
4. 확인: 🇬🇧 재생 응답 헤더에 `X-TTS-Provider: google-cloud`가 있으면 동작 중입니다.
   Upstash에서 `tts:google:YYYY-MM` 키로 이번 달 사용 문자 수를 볼 수 있습니다.

> 카운터는 사용자별이 아니라 **앱 전체(프로젝트) 기준**입니다. 로그인·계정 없이 서버에서
> 전역 키 1개만 원자적으로 갱신하며, 월 경계는 GCP 청구와 같은 태평양 시간 기준입니다.
> 무료 한도를 넘길 수 있는 설정(예: `GOOGLE_TTS_MONTHLY_LIMIT` > 1000000)은 권장하지 않습니다.

4. **개발 서버 실행**
```bash
npm run dev
```
- 웹: http://localhost:3002 (`.env`의 `PORT`)
- 뉴스/Gemini API: http://127.0.0.1:3101 (`.env`의 `DEV_API_PORT`)

웹과 API를 따로 실행하려면:
```bash
npm run dev:api   # 터미널 1
npm start         # 터미널 2
```

5. **빌드**
```bash
npm run build
```

### 🔐 Gemini API 키 교체

새 키는 채팅이나 코드에 붙여넣지 말고, 터미널에서 아래 명령으로 입력하세요. 입력값은 화면에 표시되지 않습니다.

```bash
npm run key:set
```

- 키 형식과 유효성을 Google API로 확인한 뒤 `.env`에 `GEMINI_API_KEY`로 저장합니다. (파일 권한 600)
- `AIza...` 와 `AQ....` 형식 키를 모두 지원합니다. (Google Cloud/Vertex Express 키는 사용할 수 없습니다)
- `npm run key:verify` 로 현재 키가 유효한지 확인할 수 있습니다.
- 개발 서버를 재시작하면 적용됩니다: `npm run dev`
- 배포 환경은 **Vercel > Project Settings > Environment Variables**에서 `GEMINI_API_KEY` 값을 갱신하고 재배포하세요.
- 키 교체 후 Google AI Studio에서 기존 키를 삭제하세요.

`npm run build`는 마지막에 `npm run key:check`를 자동 실행합니다. 빌드 결과물이나 소스에 키가 섞이면 빌드가 실패합니다.

## 🛠️ 기술 스택

- **Frontend**: React 18.3.1
- **Styling**: Emotion (`@emotion/react`, `@emotion/styled`) 기반 CSS-in-JS + 전역 CSS
- **API**: Gemini API (Google AI) — Vercel Serverless Function(`/api/gemini`) 경유
- **Build Tool**: Vite 8.3.5
- **Runtime**: Node.js 22.12.0 이상
- **Deployment**: Vercel (정적 프론트엔드 + `/api` 서버리스 함수)
- **Package Manager**: npm

## 📱 주요 컴포넌트

### ExpressionCard
- 구동사와 예문 표시
- 음성 재생 및 번역 기능
- 확장 가능한 상세 정보

### NewsCard
- 뉴스 기사 표시
- 레벨별 맞춤 콘텐츠
- 학습 자료 제공

### Calendar
- 날짜 선택 기능
- 데이터가 있는 날짜 표시
- 반응형 디자인

## 🎯 사용자 경험 개선

### 접근성
- ARIA 라벨 및 키보드 네비게이션 지원
- 스크린 리더 호환성
- 고대비 모드 지원

### 성능
- 이미지 최적화
- 코드 스플리팅
- 메모리 누수 방지

### 모바일 최적화
- 터치 친화적 인터페이스
- 반응형 레이아웃
- 모바일 전용 제스처

## 🔧 개발 가이드

### 코드 스타일
- ESLint 및 Prettier 사용
- 함수형 컴포넌트 선호
- TypeScript 도입 고려

### 테스트
Vitest로 전체 테스트를 한 번에 실행합니다.
```bash
npm test
```

개발 중에는 감시 모드를 사용하세요.
```bash
npm run test:watch
```

타임존 회귀 테스트(`cache-utils`, `daily-verbs`)는 테스트 파일 안에서 각각
`America/Los_Angeles`, `America/New_York`로 TZ를 설정한 뒤 실행됩니다.
개별 파일만 실행하려면 아래 명령을 사용할 수 있습니다.
```bash
npx vitest run tests/cache-utils.test.js
npx vitest run tests/daily-verbs.test.js
```

타입 체크는 별도 명령으로 실행합니다.
```bash
npm run typecheck
```

### 빌드 최적화
```bash
npm run build
```

## 📈 성능 메트릭

- **First Contentful Paint**: < 1.5초
- **Largest Contentful Paint**: < 2.5초
- **Cumulative Layout Shift**: < 0.1
- **First Input Delay**: < 100ms

## 🤝 기여하기

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다. 자세한 내용은 `LICENSE` 파일을 참조하세요.

## 🙏 감사의 말

- Google Gemini API 팀
- React 및 Emotion 커뮤니티
- 모든 기여자들

---

**Happy Learning! 🎓**

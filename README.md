# Daily English Expressions 🚀

매일 3개의 영어 구동사를 학습하는 React 앱입니다. 원어민처럼 말하기 위한 하루 3개 구동사 챌린지로, 실용적이고 자주 사용되는 영어 표현을 학습할 수 있습니다.

## ✨ 주요 기능

- **일일 구동사 학습**: 매일 3개의 새로운 구동사와 예문 제공
- **뉴스 기반 학습**: 실제 뉴스 기사를 통한 실용적인 영어 학습
- **레벨별 맞춤 학습**: CEFR A1-C2 레벨에 맞는 콘텐츠 제공
- **음성 재생**: TTS를 통한 정확한 발음 학습
- **한국어 번역**: 실시간 번역 기능으로 이해도 향상
- **캐시 시스템**: 효율적인 데이터 관리로 빠른 로딩
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
│   └── ErrorBoundary.jsx # 에러 처리 컴포넌트
├── hooks/              # 커스텀 React 훅
│   ├── useAudio.js     # 오디오 재생 로직
│   ├── useTranslation.js # 번역 및 요약 로직
│   └── useDataFetching.js # 데이터 가져오기 로직
├── utils/              # 유틸리티 함수
│   ├── audioUtils.js   # 오디오 처리 함수
│   ├── cacheUtils.js   # 캐시 관리 함수
│   └── apiUtils.js     # API 호출 함수
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
- Node.js 16.0.0 이상
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
`.env` 파일에 Gemini API 키를 추가하세요:
```
REACT_APP_GEMINI_API_KEY=your_api_key_here
```

4. **개발 서버 실행**
```bash
npm start
```

5. **빌드**
```bash
npm run build
```

## 🛠️ 기술 스택

- **Frontend**: React 18.2.0
- **Styling**: Tailwind CSS 3.3.0
- **API**: Gemini API (Google AI)
- **Build Tool**: Create React App
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
```bash
npm test
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
- React 및 Tailwind CSS 커뮤니티
- 모든 기여자들

---

**Happy Learning! 🎓**

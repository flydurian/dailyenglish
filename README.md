# 오늘의 영어 표현 🚀

매일 3개의 영어 구동사(Phrasal Verbs)를 학습하는 React 앱입니다. Gemini API를 활용하여 레벨별 맞춤형 영어 표현을 생성하고, TTS 기능으로 발음도 함께 학습할 수 있습니다.

## ✨ 주요 기능

- **레벨별 학습**: CEFR A1~C2 레벨에 맞는 구동사 제공
- **일일 학습**: 날짜별로 다른 표현을 학습하여 지속적인 학습 동기 부여
- **음성 재생**: Gemini TTS를 통한 원어민 발음 제공
- **상세 설명**: 구동사의 의미와 주요 단어들의 한국어 설명
- **반응형 디자인**: 모바일과 데스크톱에서 모두 최적화된 UI
- **접근성**: 키보드 네비게이션과 스크린 리더 지원

## 🛠️ 기술 스택

- **Frontend**: React 18, Tailwind CSS
- **API**: Google Gemini API (텍스트 생성 및 TTS)
- **오디오 처리**: Web Audio API, WAV 변환
- **상태 관리**: React Hooks (useState, useEffect, useCallback, useMemo)

## 🚀 설치 및 실행

### 1. 저장소 클론
```bash
git clone <repository-url>
cd daily-english
```

### 2. 의존성 설치
```bash
npm install
```

### 3. 환경 변수 설정
프로젝트 루트에 `.env` 파일을 생성하고 Gemini API 키를 설정하세요:

```env
REACT_APP_GEMINI_API_KEY=your_gemini_api_key_here
```

### 4. 개발 서버 실행
```bash
npm start
```

브라우저에서 `http://localhost:3000`으로 접속하여 앱을 확인할 수 있습니다.

## 📱 사용 방법

1. **레벨 선택**: 상단의 A1~C2 버튼 중 원하는 레벨을 선택합니다.
2. **날짜 변경**: 좌우 화살표 버튼이나 달력 아이콘을 클릭하여 날짜를 변경할 수 있습니다.
3. **표현 학습**: 카드를 클릭하여 구동사의 상세 설명을 확인합니다.
4. **음성 재생**: 스피커 아이콘을 클릭하여 원어민 발음을 들을 수 있습니다.

## 🏗️ 프로젝트 구조

```
src/
├── App.jsx          # 메인 앱 컴포넌트
├── index.js         # 앱 진입점
└── index.css        # 전역 스타일 (Tailwind CSS 포함)

public/
├── index.html       # HTML 템플릿
└── manifest.json    # PWA 매니페스트

tailwind.config.js   # Tailwind CSS 설정
postcss.config.js    # PostCSS 설정
package.json         # 프로젝트 의존성 및 스크립트
```

## 🔧 주요 컴포넌트

### App.jsx
- 메인 앱 로직 및 상태 관리
- Gemini API 호출 및 오디오 처리
- 전체 UI 레이아웃

### Calendar
- 날짜 선택을 위한 모달 달력
- 월별 네비게이션
- 오늘 날짜 하이라이트

### ExpressionCard
- 개별 구동사 표현 카드
- 확장/축소 애니메이션
- 음성 재생 기능

## 🎨 UI/UX 특징

- **모던한 디자인**: Tailwind CSS를 활용한 깔끔하고 현대적인 UI
- **부드러운 애니메이션**: CSS 트랜지션과 애니메이션으로 자연스러운 사용자 경험
- **반응형 레이아웃**: 모든 디바이스에서 최적화된 화면 구성
- **접근성**: ARIA 라벨과 키보드 네비게이션 지원

## 🔒 보안 고려사항

- API 키는 환경 변수로 관리
- 클라이언트 사이드에서만 API 호출
- 오디오 데이터의 안전한 처리

## 🚀 배포

### 빌드
```bash
npm run build
```

### 정적 호스팅
빌드된 `build` 폴더를 Netlify, Vercel, GitHub Pages 등에 배포할 수 있습니다.

## 🤝 기여하기

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다. 자세한 내용은 `LICENSE` 파일을 참조하세요.

## 🙏 감사의 말

- [Google Gemini API](https://ai.google.dev/) - AI 텍스트 생성 및 TTS 제공
- [Tailwind CSS](https://tailwindcss.com/) - 유틸리티 우선 CSS 프레임워크
- [React](https://reactjs.org/) - 사용자 인터페이스 구축을 위한 JavaScript 라이브러리

---

**Happy Learning! 🎓**
# dailyenglish

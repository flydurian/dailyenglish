# Daily English — Design Directions

모바일(390 × 844) 기준 인터랙티브 디자인 시안 3종입니다.

## 보는 방법

```bash
# 저장소 루트에서
python3 -m http.server 4173 --directory design
```

- 갤러리: http://localhost:4173/
- A · Aurora Glass: http://localhost:4173/aurora.html
- B · Editorial Paper: http://localhost:4173/editorial.html
- C · Bento Pop: http://localhost:4173/bento.html
- 아이콘 시안: http://localhost:4173/icons.html

탭 전환, 레벨 선택, 번역 토글, 상세 보기, `Aa` 글자 크기 조절이 동작합니다.

## 방향 요약

| | 컨셉 | 키 컬러 | 특징 | 잘 맞는 경우 |
|---|---|---|---|---|
| A | Aurora Glass | mint → indigo on navy | 유리 카드, 은은한 오로라, 몰입형 다크 | 밤에 학습, 프리미엄한 인상 |
| B | Editorial Paper | coral on warm paper | 세리프 이탤릭, 넉넉한 여백, 읽기 중심 | 낮 시간 학습, 차분한 인상 |
| C | Bento Pop | lime / lilac / black | 고대비, 큰 탭 영역, 또렷한 위계 | 빠른 탐색, 밝고 활기찬 인상 |

## 실제 적용 시 원칙

- 최소 탭 영역 44 × 44px, 하단 `env(safe-area-inset-bottom)` 확보
- 레벨 칩은 가로 스크롤, 현재 레벨은 스크롤 밖에서도 명확히 보이게
- 카드 본문은 `text-wrap: pretty`, 긴 문장은 줄바꿈 어색함 최소화
- 모달은 모바일에서 바텀시트(상단 라운드 28px)로 전환
- `prefers-reduced-motion`에서 애니메이션 제거
- 색 대비는 본문 기준 WCAG AA 이상 유지

## 아이콘 시안

`icons.html`에서 앱 아이콘 3방향과 UI 아이콘 세트를 확인할 수 있습니다.

| | 컨셉 | 설명 |
|---|---|---|
| A | Ink Monogram | 잉크 타일 + 세리프 이탤릭 D + 코랄 도트 |
| B | Paper No. 3 | 종이 타일 + 세리프 숫자 3 + 코랄 룰 |
| C | Coral Monogram | 코랄 타일 + 크림 D + 잉크 도트 (A의 컬러웨이) |
| D | Paper Deck | 세 장의 카드가 겹친 실루엣. 글자 없이 '3'을 표현 |
| E | Margin Note | 페이지 + 코랄 북마크. 읽고 표시하는 학습의 행위 |
| F | First Light | 수평선 위 해와 세 줄기 빛. 매일의 루틴 |

- SVG 원본: `design/icons/app-a.svg` ~ `app-f.svg`
- 16 / 24 / 40 / 64 / 96px 판독성과 홈 화면 맥락을 함께 확인
- UI 아이콘은 24px 그리드, 1.6px 스트로크, 활성 시 코랄 필
- 선택 시 1024 / 512 / 192 / 180 / 32px PNG, maskable, favicon, manifest에 적용

## 적용안

**A · Ink Monogram** 적용 완료.

- `public/icons/icon-192.png`, `icon-512.png` — PWA any
- `public/icons/maskable-192.png`, `maskable-512.png` — maskable
- `public/icons/apple-touch-icon.png` — 180px Apple Touch
- `public/icons/favicon-16.png`, `favicon-32.png` — 브라우저 파비콘
- `public/favicon.ico` — 16/32/48 멀티 사이즈
- `public/manifest.json` 아이콘 목록 갱신

UI 아이콘 세트(Editorial Line)도 `src/components/Icons.jsx`에 적용 완료했습니다.

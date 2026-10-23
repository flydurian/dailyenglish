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

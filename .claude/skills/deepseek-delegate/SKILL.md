---
name: deepseek-delegate
description: Orca 안에서 DeepSeek(dsh-tui) 워커에게 일을 맡기고 Claude는 브리프·판정·보고만 할 때 사용. CLAUDE.md 방침상 코드 작성·수정·테스트·빌드·배포·확인·조사 같은 잔업은 기본적으로 이 스킬로 위임한다.
---

# DeepSeek 위임 — Claude 호출 3~4회 절차

Claude 비용은 "호출 수 × 컨텍스트"다. Claude는 코드를 읽지도 쓰지도 않고, 브리프 → 대기 → 판정 → 보고만 한다.
DeepSeek는 ds.py가 붙이는 공통 지시에 따라 조사·계획·구현·테스트·자체 리뷰·작업노트·브랜치 커밋까지 한다.

## 절차 (스크립트: `python3 -I .claude/skills/deepseek-delegate/ds.py`)

1. **호출 1 — 브리프 + 실행**: Bash `run_in_background: true`, timeout 3600000 으로
   `ds.py go --title "<제목>" --brief-file <파일>` (브리프는 같은 명령 안에서 heredoc으로 파일에 쓴다).
   effort는 기본 `high`(문서·설정·배포·일반 구현), 복잡한 로직·디버깅·보안만 `--effort max`. 설정은 `~/.dsh-tui/effort.json`에 전역 저장되어 사용자가 여는 dsh-tui 시작값도 바뀐다 (사용자 동의함).
   코드를 읽어 명세를 만들지 않는다. 필요한 정보가 있으면 그것도 DeepSeek에게 조사시킨다.
2. **대기**: "You have N orchestration message" 알림이 오면 도구 없이 한 줄로 턴을 끝낸다 (heartbeat는 ds.py가 처리).
3. **호출 2 — 판정**: 백그라운드 완료 알림이 오면 worker_done 요약을 읽고 `ds.py review --auto-merge --delivery <id>`.
   - 코드 변경이 없고 검사 PASS·경고 없음 → main에 자동 merge.
   - 코드 변경이 있으면 auto-merge가 거부된다(`reviewNeeded`). `ds.py review --diff`로 테스트·문서를 뺀 핵심 diff만 읽고,
     문제 없으면 `ds.py merge --delivery <id>` (호출 +1). 처음부터 코드 작업인 줄 알면 바로 `review --diff`를 쓴다.
   - 문제·검사 실패 → 이유를 모아 "브랜치 <이름>에서 고쳐라" 브리프로 `go` 한 번 더.
   - question → `orca orchestration reply --id <msg> --body "<답>" --json` 후 `ds.py wait` 다시.
4. **호출 3 — 보고**: 사용자에게 결과를 짧게 보고하고, 작업이 끝났으면 `/clear`를 권한다.

## 브리프 (5~10줄)

```
[제목] 한 줄 목표
배경/이유: 한두 줄
범위: 바꿔도 되는 것 / 건드리면 안 되는 것
완료 기준: 사용자 관점 결과 + 필요한 테스트·확인 (예: 테스트 추가, 프리뷰 배포 후 화면 확인)
경계 사례: 반드시 테스트로 만들 상황 1~3개 (예: 다시 시작해도 같은 날 재채점 금지)
```

- 관련된 일은 한 브리프에 묶는다 (구현·테스트·프리뷰 배포·확인). 프로덕션 배포·보안 설정 변경만 리뷰 후 따로.
- 프로덕션 배포·push·env 변경은 사용자 확인을 받은 뒤 브리프에 "사용자 확인됨"이라고 적어야 DeepSeek가 실행한다.

## 알려진 사항

- `worker-start`는 dsh-tui를 인식하지 못해 실패한다 — ds.py만 쓴다.
- DeepSeek 탭이 없거나 컨텍스트가 50%를 넘으면 `ds.py worker`로 새 탭을 만들고, 사용자에게 탭을 한 번 열어 첫 실행 안내가 보이면 Esc를 눌러 달라고 한다 (열린 적 없는 탭은 지시가 묻힐 수 있음).
- 측정 기록(2026-10-25): 명세를 직접 쓰고 diff를 읽던 방식은 혼자 할 때와 비슷하거나 더 많이 들었다. 그래서 브리프·자동 판정 방식으로 바꿨다.

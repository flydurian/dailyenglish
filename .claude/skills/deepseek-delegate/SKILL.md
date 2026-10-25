---
name: deepseek-delegate
description: Orca 안에서 DeepSeek(dsh-tui) 워커에게 구현을 맡기고 Claude가 감독·리뷰할 때 사용. 사용자가 "deepseek에게 맡겨", "딥시크 워커", "위임해서 만들어" 등을 말하거나, 구현량이 큰 작업을 Claude 사용량을 아끼며 처리하려 할 때. 위임할지 말지 판단 기준과 저비용 절차를 담고 있다.
---

# DeepSeek 위임 (저비용 절차)

2026-10-25 실측: 감독 비용(탐색·heartbeat 대기)이 Claude 입력 토큰의 약 75%를 차지해서, 위임했는데도 Claude 혼자 할 때보다 Claude 사용량이 2~3배 많았다. 이 스킬은 그 감독 비용을 없애는 절차다.

## 0. 먼저 판단: 위임할 일인가

위임한다:
- 새로 쓰거나 바꿀 코드가 대략 500줄 이상이거나 여러 파일에 걸친 구현
- 명세를 미리 확정할 수 있고, 테스트·빌드 명령으로 완료를 판정할 수 있다
- 1~2번의 디스패치로 묶을 수 있다

직접 처리한다 (위임하면 오히려 손해):
- 수십~수백 줄 수정, 버그 원인 조사, 디자인 반복처럼 대화형 판단이 많은 일
- Orca 밖(Claude 데스크탑)에서 작업 중일 때 — 작업 규칙상 orca 명령 금지

사용자가 위임을 명시했는데 직접 처리가 더 싸 보이면, 한 줄로 그 판단을 말하고 사용자의 선택을 따른다.

## 1. 비용 규칙

1. **탐색하지 않는다.** Orca·dsh-tui 설정은 이미 확인됨. 아래 `ds.py`만 쓴다. `worker-start`는 dsh-tui를 인식하지 못해 `agent_readiness` 타임아웃으로 실패하므로 쓰지 않는다.
2. **기능 하나 = 디스패치 하나.** 잘게 쪼개 순차로 여러 번 보내지 않는다. 순서가 필요하면 명세 안에 단계로 적는다.
3. **대기는 `ds.py wait`를 백그라운드로 한 번.** heartbeat는 스크립트가 자동으로 확인 처리한다. "You have N orchestration message" 알림이 와도 wait가 돌고 있으면 **아무 명령도 실행하지 말고 짧게 턴을 끝낸다.**
4. **리뷰는 좁게.** `ds.py status`(diff 요약) → 명세의 acceptance 명령 실행 → 위험한 로직의 hunk만 읽는다. 파일 전체를 출력하지 않는다.
5. **수정 지시는 모아서 한 번에.** 문제마다 따로 보내지 않는다.
6. 코디네이터 컨텍스트가 이미 크면(약 15만 토큰 이상) 사용자에게 새 세션에서 시작하자고 제안한다. DeepSeek 세션 컨텍스트가 50%를 넘으면 `ds.py worker`로 새 탭을 연다.

## 2. 절차

스크립트 경로: `.claude/skills/deepseek-delegate/ds.py` (항상 `python3 -I`로 실행)

1. 작업 규칙대로 `작업노트.md`를 읽고, 기능 브랜치를 만든다.
2. `python3 -I .claude/skills/deepseek-delegate/ds.py run --objective "<목표>"`
3. 명세를 scratchpad에 파일로 쓴다 (아래 템플릿). 모르는 코드 구조는 명세 작성에 필요한 만큼만 읽는다.
4. `python3 -I .claude/skills/deepseek-delegate/ds.py dispatch --title "<제목>" --spec <명세 파일>`
   - 기존 DeepSeek 탭 중 컨텍스트가 가장 작은 탭을 자동으로 고른다 (`--terminal <handle>`로 지정 가능).
   - DeepSeek 탭이 없으면 `ds.py worker`로 만들고, **사용자에게 그 탭을 한 번 열어 첫 실행 안내가 보이면 Esc를 눌러 달라고 요청한 뒤** dispatch한다.
     화면에 한 번도 열리지 않은 탭은 Orca 화면 모델 폭이 몇 칸이라 dsh-tui 상태를 읽을 수 없고, 지시가 첫 실행 안내에 묻힐 수 있다 (2026-10-25 확인).
   - 프롬프트 파일은 `.orca-tasks/`(git 제외)에 저장되고, heartbeat 15분 주기·커밋 금지 등 공통 지시가 자동으로 붙는다.
   - 출력의 `started`가 false면 `ds.py wait` 결과로 판단하고, 오래 조용하면 사용자에게 탭 확인을 부탁한다.
5. `python3 -I .claude/skills/deepseek-delegate/ds.py wait` — Bash `run_in_background: true`, timeout 3600000.
6. 결과 처리:
   - `question` → `orca orchestration reply --id <message id> --body "<답>" --json` → `ds.py ack <delivery>` → 다시 wait
   - `worker_done` (succeeded) → 리뷰. 문제가 있으면 수정 명세를 써서 새 dispatch, 없으면 커밋. 그 다음 `ds.py ack <delivery>`
   - `worker_done` (failed) / `escalation` → 본문을 읽고 명세를 고쳐 새 Task로 dispatch하거나 사용자에게 보고
   - `wait`가 타임아웃(종료 코드 3)이면 출력된 DeepSeek 화면을 보고 판단한다. 화면이 계속 작업 중이면 다시 wait.
7. 끝: `.orca-tasks/` 삭제, `작업노트.md` 갱신, 커밋, main에 merge (작업 규칙).

## 명세 템플릿

```
[제목] 한 줄 설명
작업 위치: <저장소 절대 경로> (브랜치 <이름>)
배경: 왜 하는지 한두 줄

## Target      생성/수정할 파일 목록
## Change      번호 매긴 구체적 변경 (함수 시그니처, 데이터 형태, UI 문구까지)
## Constraints 바꾸면 안 되는 것, 금지 사항
## Ownership   수정 가능한 파일 범위
## Observable acceptance  실행할 명령과 기대 결과 (예: node scripts/test-*.mjs 통과, npx vite build 성공)
```

순수 로직은 node로 테스트할 수 있는 파일(`src/utils/*.js`)로 분리하고 `scripts/test-*.mjs` 테스트를 같이 요구하면 리뷰 비용이 크게 줄어든다.

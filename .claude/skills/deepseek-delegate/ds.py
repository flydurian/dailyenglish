#!/usr/bin/env python3
"""DeepSeek(dsh-tui) 워커 위임 헬퍼. Orca 터미널 안에서만 사용한다.

  ds.py run --objective "<목표>"          새 Orca Run 생성·바인딩
  ds.py worker                           새 dsh-tui 탭 생성 (사용자가 탭을 한 번 열어야 함)
  ds.py dispatch --title "<제목>" --spec <명세 파일> [--deps '["task_x"]'] [--terminal <handle>]
                                         [--effort high|max]
  ds.py go --title "<제목>" (--brief "<브리프>" | --brief-file F) [--terminal <handle>]
                                         [--timeout-min 60] [--effort high|max]
                                         Run 생성(필요 시)·디스패치·대기까지 한 번에
  ds.py wait [--timeout-min 60]          worker_done/question/escalation이 올 때까지 대기 (heartbeat는 자동 확인 처리)
  ds.py review [--delivery <id>] [--auto-merge | --diff [--max-lines 300]]
                                         브랜치·diff·검사·경고 JSON
                                         (코드 변경 시 auto-merge 거부, --diff 는 핵심 diff 출력)
  ds.py merge [--delivery <id>]          검사 없이 ff-only merge·ack·정리
  ds.py ack <delivery_id>                처리한 보고 확인 처리
  ds.py status                           Run 작업 상태·DeepSeek 화면·변경 파일 요약

출력은 코디네이터 컨텍스트를 아끼기 위해 필요한 값만 짧게 낸다.
"""
import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

WAKE_TYPES = 'worker_done,escalation,question'
EFFORT_LEVELS = ('off', 'low', 'high', 'max')
KST = timezone(timedelta(hours=9))
WORKER_NOTES = """

## 총괄 공통 지시 (ds.py가 자동으로 붙임 — preamble보다 우선)
총괄(Claude)은 짧은 브리프만 준다. 나머지는 네가 끝까지 책임진다.
1. 브리프의 목표·범위·완료 기준을 읽고, 필요한 코드를 직접 조사해 계획을 세운다. 총괄에게 코드 설명을 요구하지 않는다.
2. 브리프에 브랜치가 없으면 main에서 `ds/<task id 뒤 8자>` 브랜치를 만들어 작업한다. main에 직접 커밋하지 않는다. 파일 변경이 없는 작업(배포·조사)은 브랜치·커밋 없이 보고만 한다.
3. 구현한다. 순수 로직은 node로 테스트 가능한 파일(src/utils/*.js 등)에 두고 scripts/test-*.mjs 테스트를 추가·갱신한다.
4. scripts/test-*.mjs 전부와 `npx vite build`를 실행해 통과시킨다 (`npm run build`는 public/hash.json을 바꾸므로 쓰지 않는다).
5. 자체 리뷰: `git diff main...HEAD`를 다시 읽고 확인한다 — 브리프 요구 모두 충족, 범위 밖 변경 없음, console.log 디버그 출력 없음, 비밀 값·.env 노출 없음, 새 의존성 없음(브리프가 허용한 경우 제외). 문제가 있으면 고치고 4를 다시 한다.
6. 작업노트.md에 이번 작업을 짧게 기록하고, 변경을 설명하는 메시지로 브랜치에 커밋한다 (git add는 네가 바꾼 파일만).
7. worker_done 요약(3문장): 무엇을 바꿨는지, 검증 결과, 남은 위험. --files-modified에 실제 파일. 총괄이 diff를 읽지 않고 판단할 수 있게 쓴다.
- 웹 검색·fetch 는 브리프가 요구할 때만 쓴다.
- 보고·로그 출력은 필요한 부분만 짧게.
금지: merge, push, `vercel deploy --prod`, vercel env 변경 — 브리프가 "사용자 확인됨"이라고 명시한 경우만 예외. 프리뷰 배포(`vercel deploy`)는 브리프가 요청하면 한다.
ask는 정말 막혔을 때만 쓴다. 사소한 결정은 스스로 하고 요약에 적는다. heartbeat는 작업이 15분을 넘을 때만 15분마다.
"""


def fail(message):
    print(f'ds.py: {message}', file=sys.stderr)
    sys.exit(1)


def repo_root():
    out = subprocess.run(['git', 'rev-parse', '--show-toplevel'], capture_output=True, text=True)
    if out.returncode != 0:
        fail('git 저장소 안에서 실행해야 합니다.')
    return Path(out.stdout.strip())


def git(root, *args, timeout=None):
    return subprocess.run(['git', *args], cwd=root, capture_output=True, text=True, timeout=timeout)


def current_branch(root):
    out = git(root, 'rev-parse', '--abbrev-ref', 'HEAD')
    return out.stdout.strip() if out.returncode == 0 else None


def orca(*args, timeout=None):
    proc = subprocess.run(['orca', *args, '--json'], capture_output=True, text=True, timeout=timeout)
    # check --wait는 keepalive 줄을 먼저 내보내므로 마지막 JSON 문서만 파싱한다
    lines = [line for line in proc.stdout.splitlines() if not line.startswith('{"_keepalive"')]
    text = '\n'.join(lines).strip()
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        fail(f"orca {' '.join(args[:2])} 실패: {(proc.stderr or proc.stdout).strip()[:400]}")
    if not data.get('ok', False):
        err = data.get('error') or {}
        steps = (err.get('data') or {}).get('nextSteps') or []
        fail(f"orca {' '.join(args[:2])} 거부: {err.get('code')} {err.get('message', '')[:300]} {steps}")
    return data.get('result') or {}


def screen(handle, last=12):
    result = orca('terminal', 'read', '--terminal', handle)
    return (result.get('terminal') or {}).get('tail', [])[-last:]


def find_dsh_terminal(root):
    # DeepSeek 세션이 여러 개면 컨텍스트가 가장 작은 것을 쓴다
    candidates = []
    for term in orca('terminal', 'list').get('terminals', []):
        if term.get('agentIdentity') == 'dsh' and term.get('connected') and term.get('worktreePath') == str(root):
            match = re.search(r'ctx (\d+(?:\.\d+)?)%', term.get('preview') or '')
            candidates.append((float(match.group(1)) if match else 0.0, term['handle']))
    if not candidates:
        return None, None
    ctx, handle = min(candidates)
    return handle, ctx


def compact_screen(handle, last=60):
    # 백그라운드 탭은 Orca 화면 모델의 폭이 좁아 문구가 줄마다 잘리므로 공백·줄바꿈을 지우고 비교한다
    return re.sub(r'\s+', '', ''.join(screen(handle, last)))


def press_esc(handle):
    orca('terminal', 'send', '--terminal', handle, '--text', '\x1b')


def send_instruction(handle, text):
    """지시를 보내고 DeepSeek가 실제로 작업을 시작했는지 확인한다. 첫 실행 안내가 지시를 삼켰을 때만 한 번 다시 보낸다."""
    orca('terminal', 'send', '--terminal', handle, '--enter', '--text', text)
    resent = False
    for _ in range(20):
        time.sleep(2)
        current = compact_screen(handle)
        if 'esctointerrupt' in current or 'Thinking' in current:
            return True
        if 'skiptheguide' in current and not resent:
            press_esc(handle)
            time.sleep(2)
            orca('terminal', 'send', '--terminal', handle, '--enter', '--text', text)
            resent = True
    return False


def ensure_orca():
    if os.environ.get('TERM_PROGRAM') != 'Orca':
        fail('Orca 앱 밖에서는 orca 명령을 쓰지 않습니다 (작업 규칙). Orca 터미널에서 실행하세요.')


def is_peak_kst(now=None):
    """한국시간 평일 10–13시·15–19시면 피크. 주말은 항상 비피크."""
    now = now or datetime.now(KST)
    if now.weekday() >= 5:
        return False
    return 10 <= now.hour < 13 or 15 <= now.hour < 19


def print_peak_notice():
    if is_peak_kst():
        print('피크 시간 — 급하지 않은 큰 작업은 비피크에')


def switch_effort(handle, level):
    """대상 탭의 세션 effort 를 /effort 로 바꾸고 화면에서 확인한다."""
    current = compact_screen(handle, 30).lower()
    if 'skiptheguide' in current or 'step1of4' in current:
        press_esc(handle)
        time.sleep(1.5)

    orca('terminal', 'send', '--terminal', handle, '--enter', '--text', f'/effort {level}')
    pattern = re.compile(rf'→\s*{re.escape(level)}\b', re.IGNORECASE)
    deadline = time.time() + 10
    while time.time() < deadline:
        time.sleep(0.4)
        current = compact_screen(handle, 30)
        if re.search(r'unknown\s*reasoning\s*effort|this\s*model\s*offers', current, re.IGNORECASE):
            fail(f'effort {level} 전환 거부됨 (terminal {handle})')
        if pattern.search(current):
            print(f'effort → {level} (terminal {handle})')
            return
    fail(f'effort {level} 전환을 확인하지 못했습니다 (terminal {handle})')


def cmd_run(args):
    run = orca('orchestration', 'run-create', '--objective', args.objective)['run']
    print(json.dumps({'run': run['id']}, ensure_ascii=False))


def cmd_worker(_args):
    # 탭이 화면에 한 번도 열리지 않은 터미널은 Orca 화면 모델이 몇 칸 폭이라 dsh-tui 상태를 읽거나 확인할 수 없다.
    # 그래서 새 세션은 만들기만 하고, 사용자가 탭을 열어 첫 실행 안내를 닫은 뒤 dispatch한다.
    handle = orca('terminal', 'create', '--worktree', 'current', '--title', 'deepseek-worker',
                  '--command', 'dsh-tui')['terminal']['handle']
    print(json.dumps({'terminal': handle}, ensure_ascii=False))
    print("사용자에게 요청: Orca에서 'deepseek-worker' 탭을 한 번 열고, 첫 실행 안내가 보이면 Esc를 눌러 주세요. "
          f'그 다음 dispatch --terminal {handle}')


def dispatch_task(root, title, spec, terminal=None, deps=None, effort=None):
    if not orca('orchestration', 'run-current').get('run'):
        fail('바인딩된 Run이 없습니다. 먼저 `ds.py run --objective ...`를 실행하세요.')

    if terminal:
        handle, ctx = terminal, None
    else:
        handle, ctx = find_dsh_terminal(root)
    if not handle:
        fail('DeepSeek 탭이 없습니다. `ds.py worker`로 만들고, 사용자가 탭을 연 뒤 다시 dispatch하세요.')

    if effort:
        switch_effort(handle, effort)

    create = ['orchestration', 'task-create', '--spec', spec, '--task-title', title,
              '--display-name', f'deepseek · {title}']
    if deps:
        create += ['--deps', deps]
    task_id = orca(*create)['task']['id']

    result = orca('orchestration', 'dispatch', '--task', task_id, '--to', handle, '--return-preamble')
    preamble = result.get('preamble') or ''
    if not preamble:
        fail(f'dispatch가 preamble을 돌려주지 않았습니다 (task {task_id}).')

    task_dir = root / '.orca-tasks'
    task_dir.mkdir(exist_ok=True)
    exclude = root / '.git' / 'info' / 'exclude'
    if '.orca-tasks/' not in exclude.read_text(encoding='utf-8').splitlines():
        with exclude.open('a', encoding='utf-8') as fh:
            fh.write('.orca-tasks/\n')
    prompt_path = task_dir / f'{task_id}.md'
    prompt_path.write_text(preamble + WORKER_NOTES, encoding='utf-8')

    # 여러 줄 프롬프트를 TUI에 직접 넣으면 중간에 제출될 수 있어 한 줄 지시만 보낸다
    rel = prompt_path.relative_to(root)
    started = send_instruction(
        handle,
        f'Orca에서 디스패치된 새 작업입니다. 이전 task/dispatch ID는 쓰지 말고, {rel} 파일 전체를 끝까지 읽은 뒤 '
        '그 안의 명세·총괄 공통 지시·보고 명령(ask, worker_done)을 정확히 따르세요. '
        '끝나면 worker_done을 실제 값으로 한 번만 실행하세요.')

    return {'task': task_id, 'dispatch': (result.get('dispatch') or {}).get('id'),
            'terminal': handle, 'deepseekCtxPercent': ctx, 'prompt': str(rel),
            'started': started}


def print_dispatch(result):
    print(json.dumps(result, ensure_ascii=False))
    if not result['started']:
        print(f"참고: 화면으로 작업 시작을 확인하지 못했습니다 (백그라운드 탭이면 정상일 수 있음). "
              f"ds.py wait로 보고를 기다리고, 오래 조용하면 Orca에서 terminal {result['terminal']} 탭을 열어 확인하세요.")
    ctx = result.get('deepseekCtxPercent')
    if ctx and ctx >= 50:
        print('참고: DeepSeek 세션 컨텍스트가 50% 이상입니다. 다음에는 ds.py worker로 새 세션을 여는 것을 고려하세요.')


def cmd_dispatch(args):
    root = repo_root()
    print_peak_notice()
    spec = Path(args.spec).read_text(encoding='utf-8')
    print_dispatch(dispatch_task(root, args.title, spec, terminal=args.terminal,
                                 deps=args.deps, effort=args.effort))


def cmd_go(args):
    root = repo_root()
    print_peak_notice()
    if not orca('orchestration', 'run-current').get('run'):
        orca('orchestration', 'run-create', '--objective', args.title)
    spec = args.brief if args.brief is not None else Path(args.brief_file).read_text(encoding='utf-8')
    if not spec.strip():
        fail('브리프가 비어 있습니다.')
    print_dispatch(dispatch_task(root, args.title, spec, terminal=args.terminal, effort=args.effort))
    cmd_wait(argparse.Namespace(timeout_min=args.timeout_min))


def summarize(message):
    try:
        payload = json.loads(message.get('payload') or '{}')
    except json.JSONDecodeError:
        payload = {}
    return {k: v for k, v in {
        'id': message.get('id'),
        'type': message.get('type'),
        'subject': message.get('subject'),
        'body': message.get('body'),
        'task': payload.get('taskId'),
        'dispatch': payload.get('dispatchId'),
        'outcome': payload.get('outcome'),
        'files': payload.get('filesModified'),
    }.items() if v}


def cmd_wait(args):
    deadline = time.time() + args.timeout_min * 60
    acked_heartbeats = 0
    while True:
        remaining_ms = int((deadline - time.time()) * 1000)
        if remaining_ms <= 0:
            root = repo_root()
            handle, ctx = find_dsh_terminal(root)
            print(json.dumps({'timedOut': True, 'heartbeatsAcked': acked_heartbeats,
                              'deepseekScreen': screen(handle, 8) if handle else None}, ensure_ascii=False, indent=1))
            sys.exit(3)
        result = orca('orchestration', 'check', '--wait', '--types', WAKE_TYPES,
                      '--timeout-ms', str(min(remaining_ms, 600000)))
        messages = result.get('messages') or []
        if result.get('timedOut') or not messages:
            continue
        actionable = [m for m in messages if m.get('type') != 'heartbeat']
        if not actionable:
            orca('orchestration', 'check', '--ack', result['deliveryId'])
            acked_heartbeats += len(messages)
            continue
        print(json.dumps({'delivery': result['deliveryId'], 'heartbeatsAcked': acked_heartbeats,
                          'messages': [summarize(m) for m in actionable]}, ensure_ascii=False, indent=1))
        print(f"처리 후: ds.py ack {result['deliveryId']}")
        return


def cmd_ack(args):
    result = orca('orchestration', 'check', '--ack', args.delivery)
    print(json.dumps({'acked': result.get('acknowledged')}, ensure_ascii=False))


def cmd_status(_args):
    root = repo_root()
    run = orca('orchestration', 'run-current').get('run') or {}
    tasks = orca('orchestration', 'task-list', '--brief').get('tasks', [])
    handle, ctx = find_dsh_terminal(root)
    diff = subprocess.run(['git', 'diff', '--stat'], capture_output=True, text=True, cwd=root).stdout.strip()
    untracked = subprocess.run(['git', 'ls-files', '--others', '--exclude-standard'],
                               capture_output=True, text=True, cwd=root).stdout.split()
    print(json.dumps({
        'run': run.get('id'),
        'tasks': [f"{t['id']} {t.get('status')} {t.get('task_title')}" for t in tasks if t.get('status') != 'failed'],
        'deepseek': {'terminal': handle, 'ctxPercent': ctx, 'screen': screen(handle, 6) if handle else None},
        'diffStat': diff.splitlines()[-1] if diff else None,
        'untracked': untracked,
    }, ensure_ascii=False, indent=1))


def run_checks(root):
    checks = {}
    for script in sorted((root / 'scripts').glob('test-*.mjs')):
        rel = str(script.relative_to(root))
        try:
            proc = subprocess.run(['node', rel], cwd=root, capture_output=True, text=True, timeout=180)
        except subprocess.TimeoutExpired:
            checks[rel] = {'status': 'FAIL', 'tail': ['timeout']}
            continue
        if proc.returncode == 0:
            checks[rel] = 'PASS'
        else:
            tail = [line for line in (proc.stdout + proc.stderr).splitlines() if line.strip()][-5:]
            checks[rel] = {'status': 'FAIL', 'tail': tail}

    try:
        build = subprocess.run(['npx', 'vite', 'build'], cwd=root, capture_output=True, text=True, timeout=300)
    except subprocess.TimeoutExpired:
        checks['vite build'] = {'status': 'FAIL', 'tail': ['timeout']}
        return checks
    if build.returncode == 0:
        checks['vite build'] = 'PASS'
    else:
        tail = [line for line in (build.stdout + build.stderr).splitlines() if line.strip()][-5:]
        checks['vite build'] = {'status': 'FAIL', 'tail': tail}
    return checks


def collect_warnings(root):
    warnings = []
    diff = git(root, 'diff', 'main...HEAD', '--no-color')
    added = [line for line in diff.stdout.splitlines()
             if line.startswith('+') and not line.startswith('+++')]
    console_logs = sum(1 for line in added if re.search(r'console\.log\(', line))
    if console_logs:
        warnings.append(f'console.log 추가 {console_logs}줄')

    changed = git(root, 'diff', '--name-only', 'main...HEAD').stdout.splitlines()
    for name in changed:
        if name in ('package.json', 'vercel.json', 'lib/security.js') or name.startswith('.env'):
            warnings.append(f'{name} 변경')
    return warnings


CODE_EXTENSIONS = {'.js', '.jsx', '.mjs', '.ts', '.tsx', '.py'}
DIFF_EXCLUDED_PREFIXES = ('public/', 'build/')


def is_test_script(name):
    return re.fullmatch(r'scripts/test-[^/]*\.mjs', name) is not None


def review_needed(files):
    return any(
        Path(name).suffix in CODE_EXTENSIONS and not is_test_script(name)
        for name in files
    )


def diff_targets(files):
    targets = []
    for name in files:
        if name == 'package-lock.json' or name.endswith('.md'):
            continue
        if name.startswith(DIFF_EXCLUDED_PREFIXES) or is_test_script(name):
            continue
        if Path(name).suffix in CODE_EXTENSIONS:
            targets.append(name)
    return targets


def render_review_diff(root, files, max_lines):
    targets = diff_targets(files)
    diffs = {}
    for name in targets:
        out = git(root, 'diff', '-U3', '--no-color', 'main...HEAD', '--', name)
        lines = out.stdout.rstrip('\n').splitlines()
        if lines:
            diffs[name] = lines
    if not diffs:
        return ''

    total = sum(len(lines) for lines in diffs.values())
    if total <= max_lines:
        return '\n'.join(line for lines in diffs.values() for line in lines)

    counts = {name: len(lines) for name, lines in diffs.items()}
    keep = {name: max(1, int(max_lines * count / total)) for name, count in counts.items()}
    keep = {name: min(keep[name], counts[name]) for name in counts}

    while sum(keep.values()) > max_lines:
        candidates = [name for name in keep if keep[name] > 1]
        if not candidates:
            break
        name = max(candidates, key=lambda item: keep[item])
        keep[name] -= 1

    while sum(keep.values()) < max_lines:
        changed = False
        for name in counts:
            if keep[name] < counts[name]:
                keep[name] += 1
                changed = True
                if sum(keep.values()) >= max_lines:
                    break
        if not changed:
            break

    chunks = []
    for name, lines in diffs.items():
        chunks.extend(lines[:keep[name]])
        omitted = len(lines) - keep[name]
        if omitted > 0:
            chunks.append(f'... ({omitted}줄 생략)')
    return '\n'.join(chunks)


def merge_branch(root, branch, delivery=None):
    checkout = git(root, 'checkout', 'main')
    if checkout.returncode != 0:
        return {'merged': False, 'reason': f'checkout main 실패: {checkout.stderr.strip()[:300]}'}
    merged = git(root, 'merge', '--ff-only', branch)
    if merged.returncode != 0:
        return {'merged': False, 'reason': f'ff-only merge 실패: {merged.stderr.strip()[:300]}'}
    deleted = git(root, 'branch', '-d', branch)
    acked = None
    if delivery:
        acked = orca('orchestration', 'check', '--ack', delivery).get('acknowledged')
    shutil.rmtree(root / '.orca-tasks', ignore_errors=True)
    return {'merged': True, 'branch': branch, 'deleted': deleted.returncode == 0, 'acked': acked}


def cmd_review(args):
    root = repo_root()
    branch = current_branch(root)
    has_work_branch = branch not in (None, 'main')

    log = git(root, 'log', '--oneline', 'main..HEAD').stdout.strip().splitlines() if has_work_branch else []
    stat = git(root, 'diff', '--stat', 'main...HEAD').stdout.strip().splitlines() if has_work_branch else []
    files = git(root, 'diff', '--name-only', 'main...HEAD').stdout.strip().splitlines() if has_work_branch else []
    uncommitted = [line for line in git(root, 'status', '--porcelain').stdout.splitlines()
                   if not line.startswith('??')]
    checks = run_checks(root)
    warnings = collect_warnings(root) if has_work_branch else []
    code_changed = review_needed(files)

    result = {
        'branch': branch if has_work_branch else '작업 브랜치 없음',
        'reviewNeeded': code_changed,
        'log': log,
        'diffStat': stat[-1] if stat else None,
        'files': files,
        'uncommitted': uncommitted,
        'checks': checks,
        'warnings': warnings,
    }

    if args.auto_merge:
        failed = [name for name, status in checks.items() if status != 'PASS']
        reasons = []
        if code_changed:
            reasons.append('코드 변경 — review --diff 후 merge')
        if not has_work_branch:
            reasons.append('작업 브랜치 없음')
        if failed:
            reasons.append('검사 실패: ' + ', '.join(failed))
        if uncommitted:
            reasons.append(f'미커밋 변경 {len(uncommitted)}건')
        if warnings:
            reasons.append('경고: ' + '; '.join(warnings))

        if reasons:
            result['autoMerge'] = {'merged': False, 'reason': ' / '.join(reasons)}
            print(json.dumps(result, ensure_ascii=False, indent=1))
            sys.exit(2)

        result['autoMerge'] = merge_branch(root, branch, args.delivery)
        print(json.dumps(result, ensure_ascii=False, indent=1))
        if not result['autoMerge'].get('merged'):
            sys.exit(2)
        return

    print(json.dumps(result, ensure_ascii=False, indent=1))

    if args.diff:
        if args.max_lines < 1:
            fail('--max-lines 는 1 이상이어야 합니다.')
        print('--- REVIEW DIFF ---')
        print(render_review_diff(root, files, args.max_lines))


def cmd_merge(args):
    root = repo_root()
    branch = current_branch(root)
    if branch in (None, 'main'):
        print(json.dumps({'merged': False, 'reason': '작업 브랜치 없음'}, ensure_ascii=False))
        sys.exit(2)
    merged = merge_branch(root, branch, args.delivery)
    print(json.dumps(merged, ensure_ascii=False, indent=1))
    if not merged.get('merged'):
        sys.exit(2)


def main():
    ensure_orca()
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest='command', required=True)

    p = sub.add_parser('run')
    p.add_argument('--objective', required=True)
    p.set_defaults(func=cmd_run)

    p = sub.add_parser('worker')
    p.set_defaults(func=cmd_worker)

    p = sub.add_parser('dispatch')
    p.add_argument('--title', required=True)
    p.add_argument('--spec', required=True, help='Target/Change/Constraints/Ownership/Observable acceptance 명세 파일')
    p.add_argument('--deps', help='JSON 배열, 예: \'["task_abc"]\'')
    p.add_argument('--terminal', help='보낼 DeepSeek 터미널 handle (생략하면 컨텍스트가 가장 작은 탭)')
    p.add_argument('--effort', type=str.lower, choices=('high', 'max'), default='high',
                   help='워커 세션 추론 강도 (기본 high, 복잡한 로직·디버깅·보안만 max)')
    p.set_defaults(func=cmd_dispatch)

    p = sub.add_parser('go')
    p.add_argument('--title', required=True)
    brief = p.add_mutually_exclusive_group(required=True)
    brief.add_argument('--brief', help='브리프 본문')
    brief.add_argument('--brief-file', help='브리프 파일 경로')
    p.add_argument('--terminal', help='보낼 DeepSeek 터미널 handle (생략하면 컨텍스트가 가장 작은 탭)')
    p.add_argument('--effort', type=str.lower, choices=('high', 'max'), default='high',
                   help='워커 세션 추론 강도 (기본 high, 복잡한 로직·디버깅·보안만 max)')
    p.add_argument('--timeout-min', type=int, default=60)
    p.set_defaults(func=cmd_go)

    p = sub.add_parser('wait')
    p.add_argument('--timeout-min', type=int, default=60)
    p.set_defaults(func=cmd_wait)

    p = sub.add_parser('review')
    p.add_argument('--delivery', help='성공 시 ack 할 delivery id')
    mode = p.add_mutually_exclusive_group()
    mode.add_argument('--auto-merge', action='store_true',
                      help='검사·경고 통과 시 main에 ff-only merge (코드 변경 시 거부)')
    mode.add_argument('--diff', action='store_true',
                      help='JSON 요약 뒤에 코드 파일 unified diff 출력')
    p.add_argument('--max-lines', type=int, default=300, help='--diff 총 줄 수 제한 (기본 300)')
    p.set_defaults(func=cmd_review)

    p = sub.add_parser('merge')
    p.add_argument('--delivery', help='merge 후 ack 할 delivery id')
    p.set_defaults(func=cmd_merge)

    p = sub.add_parser('ack')
    p.add_argument('delivery')
    p.set_defaults(func=cmd_ack)

    p = sub.add_parser('status')
    p.set_defaults(func=cmd_status)

    args = parser.parse_args()
    args.func(args)


if __name__ == '__main__':
    main()

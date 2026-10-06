"""Run prepared drawing harnesses outside the planning worker's nested sandbox."""
import json
import hashlib
import os
from pathlib import Path
import signal
import shutil
import sqlite3
import subprocess
import sys


def prop_content_root(root, request):
    """Resolve the same approved content directory for execution and observation."""
    import art_layout
    layout = json.loads(art_layout.verified(root, request['layout']).read_text())
    roots = {art_layout.verified(root, ref).parents[3] for ref in layout['sources']
             if ref['path'].endswith('/tiledata/hand-interior/new/items.json')}
    # Later batches can retain older item definitions as assembly references.
    # Only an approved current seed may disambiguate the active content root.
    seed = (Path(root) / request['data'] / 'seed.json').resolve()
    for ref in layout['sources']:
        if (Path(root) / ref['path']).resolve() != seed: continue
        config = json.loads(art_layout.verified(root, ref).read_text())
        if config.get('contentRoot'):
            selected = (Path(root) / config['contentRoot']).resolve()
            if selected not in roots:
                raise ValueError('현재 seed의 콘텐츠 루트가 승인된 items.json에 없습니다.')
            return selected
    if len(roots) > 1: raise ValueError('여러 소품 콘텐츠 루트가 섞인 주문서')
    return next(iter(roots)) if roots else None


def prepare(root, request, resume=False):
    root = Path(root).resolve()
    if not isinstance(request, dict):
        raise ValueError('그림 실행 요청 형식 오류')
    def local(name):
        value = request.get(name)
        if not isinstance(value, str) or not value:
            raise ValueError(f'격리 경로 {name} 누락')
        path = (root / value).resolve()
        if not path.is_relative_to(root) or path == root or not path.is_dir():
            raise ValueError(f'워크트리 안의 기존 폴더 필요: {name}')
        return str(path)
    env = dict(os.environ)
    # A unified supervisor may also own a live prop picker. This job must use its
    # own prepared worktree and choice store instead of inheriting those paths.
    env.pop('PROP_HARNESS_CONTENT_ROOT', None)
    env.pop('HIP_DB', None)
    work_base = Path(os.environ.get('SUPER_HARNESS_DATA', Path.home()/'.local/share/oprn/super-harness')) / 'work' / 'native'
    work = work_base / (root.name + '-' + hashlib.sha256(str(request.get('data', '')).encode()).hexdigest()[:12])
    work.mkdir(parents=True, exist_ok=True)
    # Isolated/older native worktrees may resolve the CLI using PATH instead
    # of the newer override variable. Make both resolve the same executable.
    cli=os.environ.get('SUPER_HARNESS_CODEX_BIN') or shutil.which('codex')
    if not cli:
        candidate=Path.home()/'.npm-global/bin/codex'
        if candidate.is_file():cli=str(candidate)
    if not cli or not Path(cli).is_file():raise ValueError('설치된 Codex 실행 파일을 찾지 못했습니다.')
    env['PATH']=str(Path(cli).parent)+os.pathsep+env.get('PATH','')
    env['SUPER_HARNESS_CODEX_BIN']=cli
    env.update(PROP_HARNESS_WORK=str(work), VEH_HARNESS_WORK=str(work),
               VEH_CODEX_BIN=cli)
    harness = request.get('harness')
    if harness == 'interior-props':
        env.update(PROP_HARNESS_DATA=local('data'), HIP_DATA=local('picks'), HIP_PICK=local('picks'))
        # Use the same installed CLI selected by the supervisor, not a shell shim.
        env['PROP_HARNESS_CODEX_BIN'] = cli
        # Prepared content can live below art-output. Resolve its approved seed,
        # never inherit the unrelated global prop picker's content directory.
        content_root = prop_content_root(root, request)
        if content_root: env['PROP_HARNESS_CONTENT_ROOT'] = str(content_root)
        with sqlite3.connect((Path(local('data')) / 'harness.sqlite').as_uri() + '?mode=ro', uri=True) as db:
            briefs = db.execute('SELECT id,brief FROM rounds').fetchall()
        for rid, brief in briefs:
            try:
                valid = (isinstance(brief, str) and '\n' not in brief
                         and (root / brief).resolve().is_relative_to(root)
                         and (root / brief / 'brief.md').is_file())
            except (OSError, ValueError):
                valid = False
            if not valid: raise ValueError(f'h{rid}: brief는 설명문이 아닌 brief.md 폴더 경로여야 합니다.')
        command = ['src/harnesses/interior-props/harness.py', 'pool']
    elif harness == 'modern-chipset':
        round_id = request.get('round')
        if not isinstance(round_id, str) or not round_id or any(c not in 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_' for c in round_id):
            raise ValueError('그림 판 id 오류')
        command = ['src/harnesses/modern-chipset/harness.py', '--data-dir', local('data'),
                   '--runs-dir', local('runs'), '--viz-dir', local('viz'), '_run', round_id]
        if not (Path(local('runs')) / round_id / 'state.json').is_file():
            raise ValueError('준비된 그림 판 state.json 없음')
    else:
        raise ValueError(f'감독 실행 경로가 아직 없는 하네스: {harness}')
    limits = request.get('repairLimits')
    if limits:
        count, attempts = limits.get('candidateCount'), limits.get('nativeAttempts')
        if not isinstance(count, int) or count < 1 or not isinstance(attempts, int) or attempts < 1:
            raise ValueError('자동 수정 실행 상한 형식 오류')
        if harness == 'modern-chipset':
            state = json.loads((Path(local('runs')) / request['round'] / 'state.json').read_text())
            if not state.get('cands') or len(state['cands']) > count:
                raise ValueError(f'수정 후보는 최대 {count}개여야 합니다. 기본 풀 재실행 금지.')
            if not resume and any(c.get('status') != 'queued' for c in state['cands'].values()):
                raise ValueError('수정 실행은 새로 준비한 queued 후보만 받습니다.')
            env['VEH_HARNESS_ATTEMPTS'] = str(attempts)
        elif harness == 'interior-props':
            database = Path(local('data')) / 'harness.sqlite'
            with sqlite3.connect(database.as_uri() + '?mode=ro', uri=True) as db:
                queued = db.execute("SELECT round,count(*) FROM runs WHERE status='queued' GROUP BY round").fetchall()
                live = db.execute("SELECT count(*) FROM runs WHERE status='running'").fetchone()[0]
            if live or not queued or any(n > count for _, n in queued):
                raise ValueError(f'수정 풀은 진행 작업 없이 품목당 최대 {count}개의 새 후보만 준비해야 합니다.')
            env['PROP_HARNESS_ATTEMPTS'] = str(attempts)
    override = request.get('modelOverride')
    if override:
        if not isinstance(override, dict) or harness != 'modern-chipset' or override.get('backend') not in ('codex', 'claude') or not isinstance(override.get('model'), str) or not override['model'].strip() or override.get('effort') not in ('low', 'medium', 'high'):
            raise ValueError('승인된 그림 모델 설정 형식 오류')
        env['VEH_HARNESS_BACKEND'] = override['backend']
        if override['backend'] == 'codex':
            env.update(VEH_CODEX_MODEL=override['model'], VEH_CODEX_EFFORT=override['effort'],
                       VEH_CODEX_BIN=cli)
        else:
            env.update(VEH_HARNESS_MODEL=override['model'], VEH_HARNESS_EFFORT=override['effort'])
    return [sys.executable, *command], env


def require_review_queue(root, request):
    """Recovery may resume independently checked pixels, never another draw."""
    if request['harness'] != 'interior-props': raise ValueError('소품 검수 재개만 허용')
    database = Path(root) / request['data'] / 'harness.sqlite'
    with sqlite3.connect(database.as_uri() + '?mode=ro', uri=True) as db:
        rows = db.execute("SELECT status,phase,ok FROM runs WHERE status!='done'").fetchall()
    if not rows or any(status != 'queued' or phase not in ('review', 'review2') or not ok
                       for status, phase, ok in rows):
        raise ValueError('재검사를 통과한 검수 대기열만 재개할 수 있습니다.')


def native_errors(root, request):
    """Process exit is not a verdict. Quality FAIL is complete; technical ERROR isn't."""
    try:
        if request['harness'] == 'interior-props':
            path = Path(root) / request['data'] / 'harness.sqlite'
            with sqlite3.connect(path.as_uri() + '?mode=ro', uri=True) as db:
                db.row_factory = sqlite3.Row
                rows = [dict(r) for r in db.execute('SELECT * FROM runs')]
        else:
            state = json.loads((Path(root) / request['runs'] / request['round'] / 'state.json').read_text())
            rows = [dict(r, id=k) for k, r in state.get('cands', {}).items()]
        if not rows: return ['실행할 후보 기록이 없습니다.']
        errors = []
        for row in rows:
            review = row.get('review') or {}
            if isinstance(review, str): review = json.loads(review)
            if not isinstance(review, dict):
                errors.append(f"후보 {row.get('id')}: 검수 결과 객체 없음"); continue
            verdict = str(review.get('verdict', '')).upper()
            if request['harness']=='interior-props' and 'pxgrid 오류:' in (row.get('error') or ''):
                errors.append(f"후보 {row.get('id')}: 원본 표기법 오류 — {row['error']}"); continue
            review_required = request['harness'] == 'modern-chipset' or str(row.get('phase', '')).startswith('review') or row.get('ok')
            if row.get('status') != 'done' or verdict == 'ERROR' or (review_required and verdict not in ('PASS', 'FAIL', 'HARD')):
                errors.append(f"후보 {row.get('id')}: {row.get('status')} / {row.get('phase', '')} — " +
                              str(row.get('error') or review.get('reasons') or '검수 결과 없음'))
        return errors
    except (OSError, ValueError, KeyError, TypeError, sqlite3.Error) as error:
        return ['실행 결과 확인 실패: ' + str(error)]


def descendants():
    parents = {}
    for path in Path('/proc').glob('[0-9]*/stat'):
        try:
            fields = path.read_text().rsplit(')', 1)[1].split()
            parents[int(path.parent.name)] = int(fields[1])
        except (OSError, ValueError, IndexError):
            continue
    found, pending = set(), [os.getpid()]
    while pending:
        parent = pending.pop()
        for pid, ppid in parents.items():
            if ppid == parent and pid not in found:
                found.add(pid); pending.append(pid)
    return found


def main():
    root, request_file, result_file = map(Path, sys.argv[1:4])
    # Adopt grandchildren so a terminated harness cannot leave drawing workers behind.
    if sys.platform == 'linux':
        import ctypes
        if ctypes.CDLL(None, use_errno=True).prctl(36, 1, 0, 0, 0) != 0:
            raise OSError('그림 자식 프로세스 관리 초기화 실패')
    def stop(signum, frame):
        signal.signal(signal.SIGTERM, signal.SIG_IGN)
        signal.signal(signal.SIGINT, signal.SIG_IGN)
        owned = descendants()
        for pid in owned:
            try: os.kill(pid, signal.SIGTERM)
            except ProcessLookupError: pass
        # Wait briefly, then force only still-owned descendants to finish.
        import time
        until = time.monotonic() + 3
        while time.monotonic() < until and descendants():
            try:
                while os.waitpid(-1, os.WNOHANG)[0]: pass
            except ChildProcessError: pass
            time.sleep(.1)
        for pid in descendants():
            try: os.kill(pid, signal.SIGKILL)
            except ProcessLookupError: pass
        raise SystemExit(128 + signum)
    signal.signal(signal.SIGTERM, stop); signal.signal(signal.SIGINT, stop)
    request = json.loads(request_file.read_text())
    import art_layout
    snapshot = result_file.with_suffix('.approved.json')
    review_resume = '--resume-review' in sys.argv[4:]
    resume = '--resume-technical' in sys.argv[4:] or review_resume
    if resume:
        approved=json.loads(snapshot.read_text())
        art_layout.require_completed(root, request, approved)
        if review_resume and '--resume-technical' not in sys.argv[4:]:
            require_review_queue(root, request)
        else:
            import native_retry
            native_retry.reset(root, request)
    else:
        approved = art_layout.require_approval(root, request)
        snapshot.write_text(json.dumps(approved,ensure_ascii=False))
    command, env = prepare(root, request, resume=resume)
    # Prepared briefs necessarily predate independent review. Pass the current
    # validated approval separately instead of mutating hash-bound instructions.
    if request['harness'] == 'modern-chipset':
        env['VEH_LAYOUT_APPROVAL'] = json.dumps({
            'fingerprint': approved['fingerprint'],
            'layout': request['layout'],
            'report': json.loads(Path(request['layoutApproval']).read_text()),
            'acceptance': approved.get('acceptance'),
        }, ensure_ascii=False)
    code = subprocess.call(command, cwd=root, env=env)
    if code == 0:
        import art_receipts
        art_receipts.refresh(root,request)
    errors = native_errors(root, request)
    code = code or (1 if errors else 0)
    result_file.write_text(json.dumps({'harness': request['harness'], 'exitCode': code, 'nativeErrors': errors}, ensure_ascii=False))
    try:
        while os.waitpid(-1, os.WNOHANG)[0]: pass
    except ChildProcessError: pass
    if descendants():
        stop(signal.SIGTERM, None)
    raise SystemExit(code)


if __name__ == '__main__':
    main()

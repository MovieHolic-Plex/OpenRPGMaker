#!/usr/bin/env python3
"""소품 하네스 — Sonnet 5.5 (medium) 여러 명이 같은 기물의 후보를 한 장씩 찍고, 사용자가 화면에서 고른다.

  python3 src/harnesses/interior-props/harness.py draw "chair E" "chair W"        # 기물마다 한 판(후보 5장) 찍기 시작(뒤에서 돈다)
  python3 src/harnesses/interior-props/harness.py draw "bed red" --note "머리판이 너무 크다" --base h3-C   # 메모·출발 후보를 주고 다시
  python3 src/harnesses/interior-props/harness.py status                          # 판·작업자 상태
  python3 src/harnesses/interior-props/harness.py pool                            # (보통 자동) 대기열을 처리하는 일꾼 — 동시 MAX_PAR 명
  python3 src/harnesses/interior-props/harness.py bake                            # 고른 것을 시트에 굽기(build_tileset → prepare-references)

고르는 화면: 고르기 서버(scripts/content/hand-interior-pick/pick_server.py) 의 /harness — http://mdc-server:18302/harness
자세한 것: src/harnesses/interior-props/README.md
"""
import argparse, fcntl, json, os, shutil, signal, subprocess, sys, time

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
sys.path.insert(0, HERE)
import store  # noqa: E402

MODEL = os.environ.get('PROP_HARNESS_MODEL', 'claude-sonnet-5-5')
EFFORT = os.environ.get('PROP_HARNESS_EFFORT', 'medium')
MAX_PAR = int(os.environ.get('PROP_HARNESS_PAR', '5'))
TIMEOUT_S = int(os.environ.get('PROP_HARNESS_TIMEOUT', str(40 * 60)))
N_DEFAULT = 5
POOL_LOCK = os.path.join(store.DATA, 'pool.lock')
LOGS = os.path.join(store.DATA, 'logs')


def claude_bin():
    return shutil.which('claude') or os.path.expanduser('~/.local/bin/claude')


def draw(items, n=N_DEFAULT, note='', base='', start_pool=True):
    import brief
    from common import objects_by_id
    by = objects_by_id(); out = []
    for item in items:
        if item not in by: raise SystemExit(f'모르는 기물: {item!r}')
        rid = store.new_round(item, n, brief.DIRECTIONS, note=note, base=base, model=MODEL, effort=EFFORT, root=ROOT)
        brief.make(rid, item, note=note, base=base)
        out.append(rid)
        print(f'h{rid}: {item} — 후보 {n}장 대기열에', flush=True)
    if start_pool: ensure_pool()
    return out


def pool_alive():
    try:
        fd = os.open(POOL_LOCK, os.O_RDWR | os.O_CREAT)
        try:
            fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB); fcntl.flock(fd, fcntl.LOCK_UN); return False
        except OSError:
            return True
        finally:
            os.close(fd)
    except OSError:
        return False


def ensure_pool():
    if pool_alive(): return
    os.makedirs(LOGS, exist_ok=True)
    subprocess.Popen([sys.executable, os.path.abspath(__file__), 'pool'], cwd=ROOT, start_new_session=True,
                     stdout=open(os.path.join(LOGS, 'pool.log'), 'a'), stderr=subprocess.STDOUT, stdin=subprocess.DEVNULL)


def _prompt(r):
    sys.path.insert(0, os.path.join(r['root'], 'scripts/content/hand-interior-pick'))
    from common import slug
    t = open(os.path.join(HERE, 'prompt.md'), encoding='utf-8').read()
    folder = os.path.join('tiledata/hand-interior/pick/candidates', slug(r['item']))
    return (t.replace('{ROOT}', r['root']).replace('{ITEM}', r['item']).replace('{FOLDER}', folder)
             .replace('{BRIEF}', r['brief']).replace('{LETTER}', r['letter']).replace('{DIRECTION}', r['direction'])
             .replace('{OUT}', f"h{r['round']}-{r['letter']}")), folder


def _start(r):
    prompt, folder = _prompt(r)
    log = os.path.join(LOGS, f"h{r['round']}-{r['letter']}.log"); os.makedirs(LOGS, exist_ok=True)
    env = dict(os.environ, PH_PROMPT=prompt, PH_CLAUDE=claude_bin(), PH_MODEL=r['model'] or MODEL, PH_EFFORT=r['effort'] or EFFORT)
    cmd = ['bash', '-lc', 'exec "$PH_CLAUDE" -p "$PH_PROMPT" --model "$PH_MODEL" --effort "$PH_EFFORT" '
                          '--dangerously-skip-permissions --output-format text']
    p = subprocess.Popen(cmd, cwd=r['root'], env=env, stdout=open(log, 'w'), stderr=subprocess.STDOUT,
                         stdin=subprocess.DEVNULL, start_new_session=True)
    store.update_run(r['id'], status='running', pid=p.pid, started=store.now(), log=log)
    return p


def _finish(r, code):
    """작업자가 끝나면: 결과 파일이 있으면 깨짐 검사(렌더 포함). 시점·취향 판정은 하지 않는다 — 고르는 건 사용자."""
    from common import slug
    base = os.path.join(r['root'], 'tiledata/hand-interior/pick/candidates', slug(r['item']), f"h{r['round']}-{r['letter']}")
    if not os.path.exists(base + '.pxg'):
        return store.update_run(r['id'], status='failed', ended=store.now(), ok=0, error=f'후보 파일 없음(종료 코드 {code})')
    ck = subprocess.run([sys.executable, 'scripts/content/hand-interior-pick/check_candidate.py', base + '.pxg'],
                        cwd=r['root'], capture_output=True, text=True)
    try:
        j = json.load(open(base + '.check.json'))
        ok = 1 if j.get('ok') else 0; err = '; '.join(j.get('hard', []))[:500]
    except (OSError, ValueError):
        ok, err = 0, (ck.stdout + ck.stderr)[-500:]
    store.update_run(r['id'], status='done', ended=store.now(), ok=ok, error=err)


def pool():
    os.makedirs(store.DATA, exist_ok=True)
    fd = os.open(POOL_LOCK, os.O_RDWR | os.O_CREAT)
    try:
        fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except OSError:
        print('이미 다른 일꾼이 돈다', flush=True); return
    sys.path.insert(0, os.path.join(ROOT, 'scripts/content/hand-interior-pick'))
    for r in store.runs(status=('running',)):   # 지난 일꾼이 죽으며 남긴 running → 다시 대기열로
        store.update_run(r['id'], status='queued', pid=None)
    live = {}
    print(store.now(), '일꾼 시작', flush=True)
    while True:
        for rid_, (p, r, t0) in list(live.items()):
            code = p.poll()
            if code is None and time.time() - t0 > TIMEOUT_S:
                try: os.killpg(p.pid, signal.SIGTERM)
                except OSError: pass
                code = 'timeout'
            if code is not None:
                del live[rid_]
                try: _finish(r, code)
                except Exception as e: store.update_run(r['id'], status='failed', ended=store.now(), ok=0, error=repr(e)[:500])
                print(store.now(), f"h{r['round']}-{r['letter']} 끝({code})", flush=True)
        queued = store.runs(status=('queued',))
        while queued and len(live) < MAX_PAR:
            r = queued.pop(0)
            try:
                live[r['id']] = (_start(r), r, time.time())
                print(store.now(), f"h{r['round']}-{r['letter']} 시작 — {r['item']}", flush=True)
            except Exception as e:
                store.update_run(r['id'], status='failed', ended=store.now(), ok=0, error=repr(e)[:500])
        if not live and not store.runs(status=('queued',)): break
        time.sleep(3)
    print(store.now(), '일꾼 끝', flush=True)


def status():
    for rd in store.rounds():
        rs = store.runs(rd['id'])
        print(f"h{rd['id']} {rd['item']} [{rd['created']}] " + ' '.join(f"{r['letter']}:{r['status']}{'' if r['ok'] is None else ('✓' if r['ok'] else '✗')}" for r in rs)
              + (f"  메모: {rd['note']}" if rd['note'] else ''))
    print('일꾼:', '도는 중' if pool_alive() else '쉼')


def bake():
    for cmd in ([sys.executable, 'scripts/content/hand-interior/build_tileset.py'], ['bun', 'scripts/content/hand-interior/prepare-references.mts']):
        print('$', ' '.join(cmd), flush=True)
        r = subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True)
        print('\n'.join((r.stdout + r.stderr).strip().split('\n')[-6:]), flush=True)
        if r.returncode: raise SystemExit(r.returncode)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sp = ap.add_subparsers(dest='cmd', required=True)
    d = sp.add_parser('draw'); d.add_argument('items', nargs='+'); d.add_argument('--n', type=int, default=N_DEFAULT)
    d.add_argument('--note', default=''); d.add_argument('--base', default='')
    sp.add_parser('pool'); sp.add_parser('status'); sp.add_parser('bake')
    a = ap.parse_args()
    sys.path.insert(0, os.path.join(ROOT, 'scripts/content/hand-interior-pick'))
    if a.cmd == 'draw': draw(a.items, a.n, a.note, a.base)
    elif a.cmd == 'pool': pool()
    elif a.cmd == 'status': status()
    elif a.cmd == 'bake': bake()


if __name__ == '__main__':
    main()

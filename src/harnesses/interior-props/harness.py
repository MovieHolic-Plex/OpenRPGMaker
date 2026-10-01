#!/usr/bin/env python3
"""소품 하네스 — Sonnet 5.5 (medium) 여러 명이 같은 기물의 후보를 한 장씩 찍고, 사용자가 화면에서 고른다.

  python3 src/harnesses/interior-props/harness.py draw "chair E" "chair W"        # 기물마다 한 판(후보 5장) 찍기 시작(뒤에서 돈다)
  python3 src/harnesses/interior-props/harness.py draw "bed red" --note "머리판이 너무 크다" --base h3-C   # 메모·출발 후보를 주고 다시
  python3 src/harnesses/interior-props/harness.py status                          # 판·작업자 상태
  python3 src/harnesses/interior-props/harness.py review 1 2                      # 이미 그려진 판을 (다시) 검수에 올린다 — 떨어지면 다시 그린다
  python3 src/harnesses/interior-props/harness.py pool                            # (보통 자동) 대기열을 처리하는 일꾼 — 동시 MAX_PAR 명
  python3 src/harnesses/interior-props/harness.py bake                            # 고른 것을 시트에 굽기(build_tileset → prepare-references)

고르는 화면: 고르기 서버(scripts/content/hand-interior-pick/pick_server.py) 의 /harness — http://mdc-server:18302/harness
자세한 것: src/harnesses/interior-props/README.md
"""
import argparse, datetime, fcntl, glob, json, os, shutil, signal, subprocess, sys, time

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
sys.path.insert(0, HERE)
import store  # noqa: E402

MODEL = os.environ.get('PROP_HARNESS_MODEL', 'claude-sonnet-5-5')
EFFORT = os.environ.get('PROP_HARNESS_EFFORT', 'medium')
MAX_PAR = int(os.environ.get('PROP_HARNESS_PAR', '16'))   # 8 명에서 429 0건·부하 16/32 코어였다(2026-10-01) → 16. 429 가 나면 낮춘다
TIMEOUT_S = int(os.environ.get('PROP_HARNESS_TIMEOUT', str(40 * 60)))
REVIEW_EFFORT = os.environ.get('PROP_HARNESS_REVIEW_EFFORT', 'high')
MAX_ATTEMPTS = int(os.environ.get('PROP_HARNESS_ATTEMPTS', '3'))   # 한 장 = 그리기 최대 3번(처음 + 다시 그리기 2번)
N_DEFAULT = 5
CANDS = 'tiledata/hand-interior/pick/candidates'
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
        dirs = brief.directions(item, base)
        rid = store.new_round(item, n, dirs, note=note, base=base, model=MODEL, effort=EFFORT, root=ROOT)
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


def _out(r):
    return f"h{r['round']}-{r['letter']}"


def _folder(r):
    sys.path.insert(0, os.path.join(r['root'], 'scripts/content/hand-interior-pick'))
    from common import slug
    return os.path.join(CANDS, slug(r['item']))


def _hist(r):
    try: return json.loads(r.get('history') or '[]')
    except ValueError: return []


def _redraw_section(r, folder):
    """다시 그리기(attempt>1)면 지난 시도의 탈락 이유를 작업자에게 그대로 준다."""
    h = _hist(r)
    if (r.get('attempt') or 1) <= 1 or not h: return ''
    last = h[-1]; prev = f"{folder}/{_out(r)}.a{last['attempt']}"
    lines = [f"", f"## 다시 그리기 — 시도 {r['attempt']}/{MAX_ATTEMPTS}", "",
             f"지난 시도(`{prev}.pxg`, 그림 `{prev}-x4.png`)가 **{'깨짐 검사' if last['stage'] == 'hard' else '독립 검수'}에서 떨어졌다.**",
             f"`{folder}/{_out(r)}.pxg` 는 지금 그 지난 시도 그대로다. **거기서 출발해 지적된 것만 고친다** — 지적 밖의 화소·디자인은 건드리지 않는다.", ""]
    if last['stage'] == 'hard':
        lines += ['깨짐 검사 불합격:'] + [f'- {e}' for e in last.get('hard', [])]
    else:
        v = last.get('review') or {}
        lines += [f"- 사유: {', '.join(v.get('codes') or []) or '-'}", f"- 검수자가 센 면: {v.get('surfaces', '')}",
                  f"- 무엇이 틀렸나: {v.get('reasons', '')}", f"- 고칠 것: {v.get('fix', '')}",
                  f"- 검수자가 본 그림: `{last.get('pack', '')}/pair-x8.png`(왼쪽 지금 · 오른쪽 지난 시도), `ctx-cand.png`(방 안)"]
    if len(h) > 1:
        lines += ['', '그 전 시도들의 탈락 이유(같은 실수 반복 금지):'] + \
                 [f"- 시도 {x['attempt']}: " + ('; '.join(x.get('hard', [])) if x['stage'] == 'hard' else
                                              f"{','.join((x.get('review') or {}).get('codes') or [])} — {(x.get('review') or {}).get('reasons', '')}")[:300]
                  for x in h[:-1]]
    return '\n'.join(lines) + '\n'


def _prompt(r):
    folder = _folder(r)
    t = open(os.path.join(HERE, 'prompt.md'), encoding='utf-8').read()
    return (t.replace('{ROOT}', r['root']).replace('{ITEM}', r['item']).replace('{FOLDER}', folder)
             .replace('{BRIEF}', r['brief']).replace('{LETTER}', r['letter']).replace('{DIRECTION}', r['direction'])
             .replace('{REDRAW}', _redraw_section(r, folder)).replace('{OUT}', _out(r))), folder


def _bg(im, s, bg=(150, 120, 90, 255)):
    from PIL import Image
    b = Image.new('RGBA', im.size, bg); b.alpha_composite(im.convert('RGBA'))
    return b.resize((im.size[0] * s, im.size[1] * s), Image.NEAREST)


def _review_pack(r):
    """검수자가 볼 그림: 지금|후보 8배 나란히, 각각 8배, 같은 방 안(4배)."""
    from PIL import Image
    import brief, context
    from common import objects_by_id, slug
    o = objects_by_id()[r['item']]; s = slug(r['item']); cand = _out(r); att = r.get('attempt') or 1
    pack = os.path.join(r['brief'], 'review', f"{r['letter']}-a{att}"); os.makedirs(pack, exist_ok=True)
    cur_im = Image.open(brief.cand_png(r['item'], brief.current_choice(r['item']))).convert('RGBA')
    c_im = Image.open(os.path.join(r['root'], CANDS, s, cand + '.png')).convert('RGBA')
    a, b = _bg(cur_im, 8), _bg(c_im, 8)
    a.save(os.path.join(pack, 'current-x8.png')); b.save(os.path.join(pack, 'cand-x8.png'))
    pair = Image.new('RGBA', (a.width + b.width + 24, max(a.height, b.height)), (40, 36, 44, 255))
    pair.alpha_composite(a, (0, pair.height - a.height)); pair.alpha_composite(b, (a.width + 24, pair.height - b.height))
    pair.save(os.path.join(pack, 'pair-x8.png'))
    cur = brief.current_choice(r['item'])
    for name, im in (('ctx-current.png', None if cur == 'v5' else cur_im), ('ctx-cand.png', c_im)):
        ctx, _room = context.context_image(o, im)
        ctx.resize((ctx.width * 4, ctx.height * 4), Image.NEAREST).save(os.path.join(pack, name))
    return pack, o


def _review_prompt(r):
    import brief
    pack, o = _review_pack(r)
    t = open(os.path.join(HERE, 'review.md'), encoding='utf-8').read()
    fam = sorted(glob.glob(os.path.join(r['brief'], 'family', '*.png')))
    anc = sorted(glob.glob(os.path.join(r['brief'], 'anchors', '*.png')))
    h = [x for x in _hist(r) if x['stage'] == 'review']
    prev = ''
    if h:
        prev = '\n## 같은 후보의 지난 검수(참고 — 그때 지적이 고쳐졌는지 본다)\n' + '\n'.join(
            f"- 시도 {x['attempt']}: {','.join((x.get('review') or {}).get('codes') or [])} — {(x.get('review') or {}).get('reasons', '')}"[:400] for x in h) + '\n'
    if os.path.exists(os.path.join(r['brief'], 'base-x4.png')):
        prev += f"\n## 출발 그림\n`{r['brief']}/base-x4.png` — 이 후보의 출발점(다른 상태·고른 그림). 같은 물건으로 읽혀야 하고, 바뀌어야 할 부분만 달라야 한다. 출발 그림과 거의 같은데 상태가 안 바뀌었으면 `READ`.\n"
    rep = {'{ROOT}': r['root'], '{ITEM}': r['item'], '{DESC}': o['description'], '{KIND}': o['kind_ko'], '{CAT}': o['category_ko'],
           '{CAND}': f"{_folder(r)}/{_out(r)}.pxg", '{ATTEMPT}': str(r.get('attempt') or 1), '{MAX}': str(MAX_ATTEMPTS),
           '{LETTER}': r['letter'], '{DIRECTION}': r['direction'], '{PACK}': pack, '{PREV}': prev,
           '{FAMILY}': ', '.join(f'`{p}`' for p in fam) or '(없음)', '{ANCHORS}': ', '.join(f'`{p}`' for p in anc) or '(없음)',
           '{NEWMODE}': NEW_REVIEW if brief.is_new(r['item']) else ''}
    for k, v in rep.items(): t = t.replace(k, v)
    return t, pack


NEW_REVIEW = '''
## 새 기물이다 — (2) 「지금보다 나빠졌나」 대신 「설명대로 읽히나」
지금 시트에는 이 물건이 없다(pair-x8 왼쪽·ctx-current 는 빈 자리). `WORSE` 는 쓰지 않고 대신 본다:
- 설명 문장의 요소(재질·색·부품)가 보이나, 방 안에서 그 물건(쓰임)으로 읽히나 — 아니면 `READ`.
- 같은 방 가구(anchors·ctx 의 다른 가구)와 윤곽·명암 단 수·크기감이 같나 — 다르면 `STYLE`(불합격 사유로 쓴다).
- 설명에 수치(전체 높이 px·윗면 행 수·비례)가 있으면 8배 그림에서 **재서** 맞는지 본다 — 어긋나면 `READ`.
- 넓적해야 할 물건(상자·탁자·샘)이 옷장처럼 키 큰 정면 상자로 그려졌으면 `FRONT`.
- 3/4 시점 계약은 그대로 적용한다.
'''


def _start(r):
    att = r.get('attempt') or 1; phase = r.get('phase') or 'draw'
    if phase == 'review':
        prompt, pack = _review_prompt(r); effort = REVIEW_EFFORT
        try: os.remove(os.path.join(pack, 'verdict.json'))
        except OSError: pass
    else:
        prompt, _ = _prompt(r); effort = r['effort'] or EFFORT
    log = os.path.join(LOGS, f"{_out(r)}.a{att}{'.review' if phase == 'review' else ''}.log"); os.makedirs(LOGS, exist_ok=True)
    env = dict(os.environ, PH_PROMPT=prompt, PH_CLAUDE=claude_bin(), PH_MODEL=r['model'] or MODEL, PH_EFFORT=effort)
    cmd = ['bash', '-lc', 'exec "$PH_CLAUDE" -p "$PH_PROMPT" --model "$PH_MODEL" --effort "$PH_EFFORT" '
                          '--dangerously-skip-permissions --output-format text']
    p = subprocess.Popen(cmd, cwd=r['root'], env=env, stdout=open(log, 'w'), stderr=subprocess.STDOUT,
                         stdin=subprocess.DEVNULL, start_new_session=True)
    store.update_run(r['id'], status='running', pid=p.pid, started=store.now(), log=log)
    return p


def _keep_attempt(r):
    """떨어진 시도를 h<판>-<글자>.a<시도>.* 로 남긴다(고르는 화면의 후보 이름 규칙에 안 걸린다). 다음 시도는 그 사본에서 출발."""
    base = os.path.join(r['root'], _folder(r), _out(r)); att = r.get('attempt') or 1
    for ext in ('.pxg', '.png', '-x4.png', '.ctx.png', '.note'):
        if os.path.exists(base + ext): shutil.copyfile(base + ext, f'{base}.a{att}{ext}')


def _again(r, entry):
    """탈락 → 다음 시도(남은 시도가 있으면). 없으면 마지막 결과를 남긴 채 끝낸다."""
    h = _hist(r) + [entry]; att = r.get('attempt') or 1
    if att < MAX_ATTEMPTS:
        _keep_attempt(r)
        store.update_run(r['id'], status='queued', phase='draw', attempt=att + 1, pid=None, history=json.dumps(h, ensure_ascii=False))
        return True
    store.update_run(r['id'], history=json.dumps(h, ensure_ascii=False))
    return False


def _finish(r, code):
    """그리기가 끝나면 깨짐 검사 → (통과) 검수 대기열 / (불합격) 다시 그리기.
    검수가 끝나면 PASS → 끝, FAIL → 이유를 들고 다시 그리기. 시도는 MAX_ATTEMPTS 번까지. 고르는 건 여전히 사용자."""
    base = os.path.join(r['root'], _folder(r), _out(r)); att = r.get('attempt') or 1
    if (r.get('phase') or 'draw') == 'review':
        pack = os.path.join(r['brief'], 'review', f"{r['letter']}-a{att}")
        try:
            v = json.load(open(os.path.join(pack, 'verdict.json'), encoding='utf-8'))
            v['verdict'] = str(v.get('verdict', '')).upper()
            if v['verdict'] not in ('PASS', 'FAIL'): raise ValueError(v.get('verdict'))
        except (OSError, ValueError) as e:
            errs = sum(1 for x in _hist(r) if x['stage'] == 'review-error' and x['attempt'] == att)
            h = _hist(r) + [dict(stage='review-error', attempt=att, error=f'검수 결과 없음({code}): {e!r}'[:300])]
            if errs < 1:   # 검수자가 결과를 못 냈으면 한 번만 다시 검수
                return store.update_run(r['id'], status='queued', phase='review', pid=None, history=json.dumps(h, ensure_ascii=False))
            return store.update_run(r['id'], status='done', ended=store.now(), history=json.dumps(h, ensure_ascii=False),
                                    review=json.dumps(dict(verdict='ERROR', reasons='검수자가 결과를 못 냈다'), ensure_ascii=False))
        v['attempt'] = att; v['pack'] = pack
        store.update_run(r['id'], review=json.dumps(v, ensure_ascii=False))
        if v['verdict'] == 'FAIL' and _again(r, dict(stage='review', attempt=att, review=v, pack=pack)): return
        return store.update_run(r['id'], status='done', ended=store.now())
    if not os.path.exists(base + '.pxg'):
        if att == 1 or code == 'timeout':
            return store.update_run(r['id'], status='failed', ended=store.now(), ok=0, error=f'후보 파일 없음(종료 코드 {code})')
    ck = subprocess.run([sys.executable, 'scripts/content/hand-interior-pick/check_candidate.py', base + '.pxg'],
                        cwd=r['root'], capture_output=True, text=True)
    try:
        j = json.load(open(base + '.check.json'))
        hard = j.get('hard', []); ok = 0 if hard or not j.get('ok') else 1
    except (OSError, ValueError):
        hard, ok = [(ck.stdout + ck.stderr)[-400:]], 0
    store.update_run(r['id'], ok=ok, error='; '.join(hard)[:500], review='')
    if not ok:
        if _again(r, dict(stage='hard', attempt=att, hard=hard)): return
        return store.update_run(r['id'], status='done', ended=store.now())
    subprocess.run([sys.executable, 'scripts/content/hand-interior-pick/context.py', base + '.pxg'], cwd=r['root'], capture_output=True)
    store.update_run(r['id'], status='queued', phase='review', pid=None)


def review(rounds_):
    """이미 그려진 후보를 검수 대기열에 올린다(이 기능 전에 그린 판, 또는 다시 보고 싶을 때)."""
    n = 0
    for rid in rounds_:
        for r in store.runs(rid):
            if r['status'] == 'done' and r['ok']:
                store.update_run(r['id'], status='queued', phase='review', pid=None); n += 1
    print(f'검수 대기열에 {n}장', flush=True)
    if n: ensure_pool()


def _alive(pid):
    try:
        os.kill(pid, 0)
    except OSError:
        return False
    try:   # 좀비(끝났는데 거둬지지 않은 것)는 죽은 것으로
        return open(f'/proc/{pid}/stat').read().split(')')[-1].split()[0] != 'Z'
    except OSError:
        return True


class _Adopted:
    """앞선 일꾼이 띄운 작업자 — 종료 코드는 모르니 끝나면 0 으로 본다(결과는 _finish 가 파일로 판정)."""
    def __init__(self, pid): self.pid = pid
    def poll(self): return None if _alive(self.pid) else 0


def pool():
    os.makedirs(store.DATA, exist_ok=True)
    fd = os.open(POOL_LOCK, os.O_RDWR | os.O_CREAT)
    try:
        fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except OSError:
        print('이미 다른 일꾼이 돈다', flush=True); return
    sys.path.insert(0, os.path.join(ROOT, 'scripts/content/hand-interior-pick'))
    live = {}
    for r in store.runs(status=('running',)):   # 지난 일꾼이 남긴 running: 작업자가 살아 있으면 이어 받고, 죽었으면 다시 대기열로
        if r['pid'] and _alive(r['pid']):
            t0 = time.time()
            try: t0 = datetime.datetime.fromisoformat(r['started']).timestamp()
            except (TypeError, ValueError): pass
            live[r['id']] = (_Adopted(r['pid']), r, t0)
        else:
            store.update_run(r['id'], status='queued', pid=None)
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


def _label(r):
    v = {}
    try: v = json.loads(r.get('review') or '{}')
    except ValueError: pass
    a = f"#{r.get('attempt') or 1}"
    if r['status'] in ('queued', 'running'): return f"{'검수' if r.get('phase') == 'review' else '그림'}{a}:{r['status']}"
    if r['status'] == 'failed': return f'실패{a}'
    if not r['ok']: return f'깨짐✗{a}'
    return {'PASS': '검수✓', 'FAIL': '검수✗', 'ERROR': '검수?'}.get(v.get('verdict'), '미검수') + a


def status():
    for rd in store.rounds():
        rs = store.runs(rd['id'])
        print(f"h{rd['id']} {rd['item']} [{rd['created']}] " + ' '.join(f"{r['letter']}:{_label(r)}" for r in rs)
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
    rv = sp.add_parser('review'); rv.add_argument('rounds', nargs='+', type=int)
    sp.add_parser('pool'); sp.add_parser('status'); sp.add_parser('bake')
    a = ap.parse_args()
    sys.path.insert(0, os.path.join(ROOT, 'scripts/content/hand-interior-pick'))
    if a.cmd == 'draw': draw(a.items, a.n, a.note, a.base)
    elif a.cmd == 'review': review(a.rounds)
    elif a.cmd == 'pool': pool()
    elif a.cmd == 'status': status()
    elif a.cmd == 'bake': bake()


if __name__ == '__main__':
    main()

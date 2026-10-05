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
import argparse, collections, datetime, fcntl, glob, json, os, shutil, signal, subprocess, sys, time

if not __package__:
    sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..')))
    __package__ = 'src.harnesses.interior-props'

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
sys.path.insert(0, HERE)
from . import derive, store  # noqa: E402

# 엔진: codex(기본, 2026-10-01 사용자 「전체 다 codex 가」 — gpt-6.1-sol medium) | claude(Sonnet 5.5)
ENGINE = os.environ.get('PROP_HARNESS_ENGINE', 'codex')
CODEX_MODEL = os.environ.get('PROP_HARNESS_CODEX_MODEL', 'gpt-6.1-sol')
MODEL = os.environ.get('PROP_HARNESS_MODEL', CODEX_MODEL if ENGINE == 'codex' else 'claude-sonnet-5-5')
EFFORT = os.environ.get('PROP_HARNESS_EFFORT', 'medium')
MAX_PAR = int(os.environ.get('PROP_HARNESS_PAR', '32'))   # codex 32 명(2026-10-03 사용자 「32개로 높이고」). 그 전 16 명(2026-10-01, 4시간 안에 335장 목표 — 12 명은 약 3.3시간, 429 0건). Claude 는 8 명에서 429 0건
TIMEOUT_S = int(os.environ.get('PROP_HARNESS_TIMEOUT', str(40 * 60)))
REVIEW_EFFORT = os.environ.get('PROP_HARNESS_REVIEW_EFFORT', 'medium' if ENGINE == 'codex' else 'high')
MAX_ATTEMPTS = int(os.environ.get('PROP_HARNESS_ATTEMPTS', '3'))   # 한 장 = 그리기 최대 3번(처음 + 다시 그리기 2번)
N_DEFAULT = 2   # 후보 둘(설명 충실·같은 방 화풍, 또는 최소 수정 둘). 셋째 자리는 고르는 화면의 「다시 뽑기」(2026-10-03 사용자)
CANDS = os.path.join(os.path.abspath(os.environ['PROP_HARNESS_CONTENT_ROOT']), 'tiledata/hand-interior/pick/candidates') if os.environ.get('PROP_HARNESS_CONTENT_ROOT') else 'tiledata/hand-interior/pick/candidates'
POOL_LOCK = os.path.join(store.DATA, 'pool.lock')
LOGS = os.path.join(store.DATA, 'logs')
WORK = os.path.join(store.DATA, 'work')   # 작업자 세션의 작업 폴더(저장소 밖 — 저장소 문맥을 안 싣는다)


def claude_bin():
    return shutil.which('claude') or os.path.expanduser('~/.local/bin/claude')


def draw(items, n=N_DEFAULT, note='', base='', start_pool=True, slot=''):
    from . import brief
    from common import objects_by_id
    from common import spec_top_lint
    by = objects_by_id(); out = []
    for item in items:
        if item not in by: raise SystemExit(f'모르는 기물: {item!r}')
    errs = [e for item in items if not by[item].get('set') for e in spec_top_lint(by[item])]   # 명세가 옆모습을 허락하면 판을 열지 않는다(2026-10-02 기관차). 파생 묶음은 칸마다 원본 명세를 따른다
    if errs: raise SystemExit('명세 검사 불합격 — 설명을 고친 뒤 다시:\n' + '\n'.join(errs))
    for item in items:
        dirs = brief.directions(item, base, slot)
        rid = store.new_round(item, n, dirs, note=note, base=base, model=MODEL, effort=EFFORT, root=ROOT)
        bd = brief.make(rid, item, note=note, base=base, slot=slot)
        if slot:   # 묶음에서 칸 하나만 다시 — 다른 칸은 출발 후보 그대로여야 한다(derive.lock_check)
            open(os.path.join(bd, 'lock.json'), 'w', encoding='utf-8').write(json.dumps({'base': base, 'slot': slot}, ensure_ascii=False))
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
    cmd = [sys.executable, os.path.abspath(__file__), 'pool']
    # 고르는 서버(systemd 서비스) 안에서 띄우면 서버를 다시 켤 때 일꾼까지 같이 죽는다(2026-10-03) → 되면 따로 된 user 서비스로
    if shutil.which('systemd-run') and os.environ.get('XDG_RUNTIME_DIR'):
        r = subprocess.run(['systemd-run', '--user', '--collect', '--quiet', f'--unit=prop-harness-pool-{int(time.time())}',
                            f'--working-directory={ROOT}', '-p', f'StandardOutput=append:{os.path.join(LOGS, "pool.log")}',
                            '-p', f'StandardError=append:{os.path.join(LOGS, "pool.log")}'] + cmd, capture_output=True)
        if r.returncode == 0: return
    subprocess.Popen(cmd, cwd=ROOT, start_new_session=True,
                     stdout=open(os.path.join(LOGS, 'pool.log'), 'a'), stderr=subprocess.STDOUT, stdin=subprocess.DEVNULL)


def _out(r):
    return f"h{r['round']}-{r['letter']}"


def _folder(r, absolute=False):
    sys.path.insert(0, os.path.join(r['root'], 'scripts/content/hand-interior-pick'))
    from common import slug
    rel = os.path.join(CANDS, slug(r['item']))
    return os.path.join(r['root'], rel) if absolute else rel


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
    folder = _folder(r, absolute=True)
    t = open(os.path.join(HERE, 'prompt.md'), encoding='utf-8').read()
    return (t.replace('{ROOT}', r['root']).replace('{ITEM}', r['item']).replace('{FOLDER}', folder)
             .replace('{BRIEF}', r['brief']).replace('{LETTER}', r['letter']).replace('{DIRECTION}', r['direction'])
             .replace('{REDRAW}', _redraw_section(r, folder)).replace('{OUT}', _out(r))), folder


def _bg(im, s, bg=(150, 120, 90, 255)):
    from PIL import Image
    b = Image.new('RGBA', im.size, bg); b.alpha_composite(im.convert('RGBA'))
    return b.resize((im.size[0] * s, im.size[1] * s), Image.NEAREST)


REVIEW_REFS = ['tiledata/atlas-pick/style-demo-view34/interior-new-bookshelf.png', 'tiledata/atlas-pick/style-demo-view34/interior-new-wardrobe.png',
               'tiledata/hand-interior/pick/candidates/sideboard_2x1/v5.png', 'tiledata/atlas-pick/style-demo-view34/interior-new-fireplace.png']


SECOND_REVIEW_MODEL = os.environ.get('PROP_HARNESS_REVIEW2_MODEL', 'claude-sonnet-5-5')


def _pack_dir(r):
    """검수 폴더. 둘째 검수(review2 — 깊은 기물만, 다른 회사 모델)는 `-2` 를 붙여 첫 검수 결과를 덮지 않는다."""
    att = r.get('attempt') or 1
    return os.path.join(r['brief'], 'review', f"{r['letter']}-a{att}" + ('-2' if r.get('phase') == 'review2' else ''))


def _is_deep(item):
    from common import objects_by_id
    o = objects_by_id().get(item) or {}
    return o.get('kind') in ('floor', 'wall') and int((o.get('footprint') or {}).get('h') or 1) >= 2


def _review_pack(r):
    """검수자가 볼 그림: 지금|후보 8배 나란히, 각각 8배, 같은 방 안(4배)."""
    from PIL import Image
    from . import brief
    import context
    from common import objects_by_id, slug
    o = objects_by_id()[r['item']]; s = slug(r['item']); cand = _out(r); att = r.get('attempt') or 1
    pack = _pack_dir(r); os.makedirs(pack, exist_ok=True)
    cur_im = Image.open(brief.cand_png(r['item'], brief.current_choice(r['item']))).convert('RGBA')
    c_im = Image.open(os.path.join(r['root'], CANDS, s, cand + '.png')).convert('RGBA')
    a, b = _bg(cur_im, 8), _bg(c_im, 8)
    a.save(os.path.join(pack, 'current-x8.png')); b.save(os.path.join(pack, 'cand-x8.png'))
    pair = Image.new('RGBA', (a.width + b.width + 24, max(a.height, b.height)), (40, 36, 44, 255))
    pair.alpha_composite(a, (0, pair.height - a.height)); pair.alpha_composite(b, (a.width + 24, pair.height - b.height))
    pair.save(os.path.join(pack, 'pair-x8.png'))
    deep = int(o['footprint']['h']) >= 2   # 깊은 기물: 깊이만큼 윗면이 긴 칩셋 가구(ref-x8) · 옆모습 틀린 그림(side-bad-x8)
    ex = lambda k: sorted(glob.glob(os.path.join(HERE, 'examples-deep', k + '-*.png')))
    def strip(paths, name):   # 기준 그림들 | 후보, 같은 배율
        ims = [_bg(Image.open(p).convert('RGBA'), 8) for p in paths] + [b]
        im = Image.new('RGBA', (sum(x.width for x in ims) + 24 * (len(ims) - 1), max(x.height for x in ims)), (40, 36, 44, 255)); x0 = 0
        for x in ims: im.alpha_composite(x, (x0, im.height - x.height)); x0 += x.width + 24
        im.save(os.path.join(pack, name))
    strip(ex('good') if deep else [os.path.join(r['root'], p) for p in REVIEW_REFS], 'ref-x8.png')
    if deep: strip(ex('bad'), 'side-bad-x8.png')
    if o.get('blockout'):   # 후보 위에 밑그림 띠 경계(빨강 = 윗면 띠, 파랑 = 남쪽 면 띠)
        from PIL import ImageDraw
        ov = b.copy(); dr = ImageDraw.Draw(ov); (t0, t1), (f0, f1) = o['blockout']['top'], o['blockout']['front']
        for y, col in ((t0, (230, 30, 30, 255)), (t1 + 1, (230, 30, 30, 255)), (f0, (40, 90, 230, 255)), (f1 + 1, (40, 90, 230, 255))):
            dr.line([(0, y * 8), (ov.width, y * 8)], fill=col, width=2)
        ov.save(os.path.join(pack, 'cand-blockout-x8.png'))
    cur = brief.current_choice(r['item'])
    for name, im in (('ctx-current.png', None if cur == 'v5' else cur_im), ('ctx-cand.png', c_im)):
        try:
            ctx, _room = context.context_image(o, im)
        except (Exception, SystemExit) as e:   # 맥락 방에 자리가 없는 기물 — 방 그림 없이 검수한다
            print(store.now(), f'{_out(r)} 맥락 그림 없음: {e}', flush=True); continue
        ctx.resize((ctx.width * 4, ctx.height * 4), Image.NEAREST).save(os.path.join(pack, name))
    return pack, o


def _review_prompt(r):
    from . import brief
    from common import top_rule_text
    pack, o = _review_pack(r)
    t = open(os.path.join(HERE, 'review.md'), encoding='utf-8').read()
    fam = sorted(glob.glob(os.path.join(r['brief'], 'family', '*.png')))
    anc = sorted(glob.glob(os.path.join(r['brief'], 'anchors', '*.png')))
    h = [x for x in _hist(r) if x['stage'] == 'review']
    prev = ''
    if h:
        prev = '\n## 같은 후보의 지난 검수(참고 — 그때 지적이 고쳐졌는지 본다)\n' + '\n'.join(
            f"- 시도 {x['attempt']}: {','.join((x.get('review') or {}).get('codes') or [])} — {(x.get('review') or {}).get('reasons', '')}"[:400] for x in h) + '\n'
    if os.path.exists(os.path.join(r['brief'], 'base-x8.png')):
        prev += f"\n## 출발 그림\n`{r['brief']}/base-x8.png` — 이 후보의 출발점(다른 상태·고른 그림). 같은 물건으로 읽혀야 하고, 바뀌어야 할 부분만 달라야 한다. 출발 그림과 거의 같은데 상태가 안 바뀌었으면 `READ`.\n"
    rep = {'{ROOT}': r['root'], '{ITEM}': r['item'], '{DESC}': o['description'], '{KIND}': o['kind_ko'], '{CAT}': o['category_ko'],
           '{CAND}': f"{_folder(r, absolute=True)}/{_out(r)}.pxg", '{ATTEMPT}': str(r.get('attempt') or 1), '{MAX}': str(MAX_ATTEMPTS),
           '{LETTER}': r['letter'], '{DIRECTION}': r['direction'], '{PACK}': pack, '{PREV}': prev,
           '{FAMILY}': ', '.join(f'`{p}`' for p in fam) or '(없음)', '{ANCHORS}': ', '.join(f'`{p}`' for p in anc) or '(없음)',
           '{NEWMODE}': (derive.review_text(o) or NEW_REVIEW) if brief.is_new(r['item']) else '', '{TOPRULE}': ('파생 묶음 — 칸마다 **원본 칸과 같은 시점·같은 윗면 두께**가 기준이다(원본 칸보다 윗면이 눈에 띄게 얇거나 옆모습이면 `FRONT`). 원본 칸 자체의 행 수는 따지지 않는다.'
                           if o.get('set') else top_rule_text(o) or '해당 없음(벽면 걸이·바닥 무늬).')}
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
    eng = ENGINE
    if phase in ('review', 'review2'):
        prompt, pack = _review_prompt(r); effort = REVIEW_EFFORT
        if phase == 'review2': eng = 'claude' if ENGINE == 'codex' else 'codex'; effort = 'high' if eng == 'claude' else 'medium'
        try: os.remove(os.path.join(pack, 'verdict.json'))
        except OSError: pass
    else:
        prompt, _ = _prompt(r); effort = r['effort'] or EFFORT
    log = os.path.join(LOGS, f"{_out(r)}.a{att}{'.' + phase if phase != 'draw' else ''}.log"); os.makedirs(LOGS, exist_ok=True)
    if phase != 'review2': store.update_run(r['id'], **{('review_engine' if phase == 'review' else 'engine'): ENGINE})   # 화면에서 Codex·Sonnet 을 가려 본다
    if eng == 'codex': return _start_codex(r, prompt, effort if phase != 'draw' else EFFORT, log)
    model = SECOND_REVIEW_MODEL if phase == 'review2' else (r['model'] or MODEL)
    env = dict(os.environ, PH_PROMPT=prompt, PH_CLAUDE=claude_bin(), PH_MODEL=model, PH_EFFORT=effort, PH_ROOT=r['root'])
    # 가벼운 세션: 작업 폴더를 저장소 밖에 두어 저장소 AGENTS.md·프로젝트 메모리·훅을 안 싣고(저장소는 --add-dir),
    # 사용자 설정(플러그인·훅)·MCP·스킬 목록을 빼고 도구를 넷만 준다. 「ok」 한 마디 기준 문맥 54k → 5k 토큰(2026-10-01 실측).
    os.makedirs(WORK, exist_ok=True)
    cmd = ['bash', '-lc', 'exec "$PH_CLAUDE" -p "$PH_PROMPT" --model "$PH_MODEL" --effort "$PH_EFFORT" '
                          '--dangerously-skip-permissions --output-format text --add-dir "$PH_ROOT" '
                          '--strict-mcp-config --mcp-config \'{"mcpServers":{}}\' --setting-sources project,local '
                          '--disable-slash-commands --tools Read Write Edit Bash']
    p = subprocess.Popen(cmd, cwd=WORK, env=env, stdout=open(log, 'w'), stderr=subprocess.STDOUT,
                         stdin=subprocess.DEVNULL, start_new_session=True)
    store.update_run(r['id'], status='running', pid=p.pid, started=store.now(), log=log)
    return p


def _start_codex(r, prompt, effort, log):
    """Codex CLI(gpt-6.1-sol) 작업자. 작업 폴더는 저장소 밖(저장소 AGENTS.md 를 안 싣는다), 저장소는 --add-dir 로 쓰기 허용.
    한 장 실측(2026-10-01): 그리기 265초 · 입력 38만(캐시 35만) · 출력 4.5천."""
    os.makedirs(WORK, exist_ok=True)
    pf = log[:-4] + '.prompt.txt'; open(pf, 'w', encoding='utf-8').write(prompt)
    cmd = [shutil.which('codex') or os.path.expanduser('~/.local/bin/codex'), 'exec', '-m', CODEX_MODEL,
           '-c', f'model_reasoning_effort="{effort}"', '--skip-git-repo-check', '-s', 'workspace-write',
           '--add-dir', r['root'], '--add-dir', os.environ.get('PROP_HARNESS_CONTENT_ROOT', r['root']), '--add-dir', store.DATA, '-C', WORK, '-']
    p = subprocess.Popen(cmd, cwd=WORK, stdin=open(pf, 'rb'), stdout=open(log, 'w'), stderr=subprocess.STDOUT,
                         start_new_session=True)
    store.update_run(r['id'], status='running', pid=p.pid, started=store.now(), log=log)
    return p


def _keep_attempt(r):
    """떨어진 시도를 h<판>-<글자>.a<시도>.* 로 남긴다(고르는 화면의 후보 이름 규칙에 안 걸린다). 다음 시도는 그 사본에서 출발."""
    base = os.path.join(r['root'], _folder(r), _out(r)); att = r.get('attempt') or 1
    for ext in ('.pxg', '.png', '-x4.png', '-x8.png', '.ctx.png', '.note'):
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


def _top_gate(r, v):
    """꼭대기 면 마지막 문(결정적). 검수자 PASS 를 FAIL 로 바꾸는 경우:
    - 검수자가 잰 윗면 행 수(top_rows)가 규칙(common.top_min — 깊이 1칸 3행, 2칸 이상 (깊이−1)×10행)보다 적다 → FRONT
    - 깊은 기물(발밑 깊이 2칸 이상)인데 검수자가 행 수를 안 냈다 → FRONT (「해당 없음」은 깊이 1칸 기물만)
    - 깊은 기물인데 검수자가 옆모습(side_elevation=true)이라 했거나 판정을 안 냈다 → FRONT
    - 검수자가 잰 윗면 y 범위(top_y)와 작업자가 메모에 적은 범위가 반도 안 겹친다 → CLAIM (한쪽이 옆면을 윗면이라 우긴다)
    검수자는 작업자 메모를 보지 않고 따로 잰다(review.md)."""
    from common import objects_by_id, top_min, parse_top_claim
    o = objects_by_id().get(r['item']) or {}
    need = top_min(o)
    if v['verdict'] != 'PASS' or need is None: return
    deep = int((o.get('footprint') or {}).get('h') or 1) >= 2
    n = v.get('top_rows'); why = None; code = 'FRONT'
    if deep and v.get('side_elevation') is not False:
        why = '발밑 깊이 2칸 이상인데 검수가 옆모습(side_elevation)이라 했다.' if v.get('side_elevation') else '발밑 깊이 2칸 이상인데 검수가 옆모습 여부(side_elevation)를 판정하지 않았다.'
    elif not isinstance(n, int):
        if deep: why = f'발밑 깊이 {o["footprint"]["h"]}칸 기물인데 꼭대기 윗면 행 수를 못 쟀다(규칙 {need}행 이상).'
    elif n < need:
        why = f'꼭대기 면 윗면 {n}행 < {need}행(하네스 규칙: 발밑 깊이 {o["footprint"]["h"]}칸).'
    else:
        ty = v.get('top_y')
        note_p = os.path.join(_folder(r, absolute=True), _out(r) + '.note')
        claim = parse_top_claim(open(note_p, encoding='utf-8').read()) if os.path.exists(note_p) else None
        if claim and isinstance(ty, list) and len(ty) == 2 and all(isinstance(x, int) for x in ty):
            a, b = sorted(ty); _, ca, cb = claim
            inter = max(0, min(b, cb) - max(a, ca) + 1)
            if inter * 2 < (cb - ca + 1):
                code = 'CLAIM'; why = f'작업자가 적은 꼭대기 윗면 y={ca}~{cb} 와 검수가 잰 y={a}~{b} 가 반도 안 겹친다 — 옆면을 윗면이라 적은 것.'
    if not why: return
    v['verdict'] = 'FAIL'; v['codes'] = sorted(set((v.get('codes') or []) + [code]))
    v['reasons'] = why + ' ' + (v.get('reasons') or '')
    v['fix'] = (v.get('fix') or '') + f" 꼭대기 면({v.get('top', '')})을 위에서 내려다본 면으로 {need}행 이상 — 지붕·상판이 띠로만 보이는 옆모습이면 남쪽 면을 줄이고 윗면을 늘린다."


def _finish(r, code):
    """그리기가 끝나면 깨짐 검사 → (통과) 검수 대기열 / (불합격) 다시 그리기.
    검수가 끝나면 PASS → 끝, FAIL → 이유를 들고 다시 그리기. 시도는 MAX_ATTEMPTS 번까지. 고르는 건 여전히 사용자."""
    base = os.path.join(r['root'], _folder(r), _out(r)); att = r.get('attempt') or 1
    phase = r.get('phase') or 'draw'
    if phase in ('review', 'review2'):
        pack = _pack_dir(r)
        try:
            v = json.load(open(os.path.join(pack, 'verdict.json'), encoding='utf-8'))
            v['verdict'] = str(v.get('verdict', '')).upper()
            if v['verdict'] not in ('PASS', 'FAIL'): raise ValueError(v.get('verdict'))
        except (OSError, ValueError) as e:
            errs = sum(1 for x in _hist(r) if x['stage'] == 'review-error' and x['attempt'] == att)
            h = _hist(r) + [dict(stage='review-error', attempt=att, error=f'검수 결과 없음({code}): {e!r}'[:300])]
            if errs < 1:   # 검수자가 결과를 못 냈으면 한 번만 다시 검수
                return store.update_run(r['id'], status='queued', phase=phase, pid=None, history=json.dumps(h, ensure_ascii=False))
            return store.update_run(r['id'], status='done', ended=store.now(), history=json.dumps(h, ensure_ascii=False),
                                    review=json.dumps(dict(verdict='ERROR', reasons='검수자가 결과를 못 냈다'), ensure_ascii=False))
        v['attempt'] = att; v['pack'] = pack
        _top_gate(r, v)
        if phase == 'review' and v['verdict'] == 'PASS' and _is_deep(r['item']):
            # 깊은 기물: 다른 회사 모델이 따로 한 번 더 본다. 둘 다 PASS 여야 통과(2026-10-02 실측: Codex 검수는 옆모습 기관차를
            # 「윗면 16행」으로 통과시켰고 Sonnet 은 같은 판의 옆모습 하나를 FRONT·MIXED 로 잡았다).
            h = _hist(r) + [dict(stage='review1', attempt=att, review=v, pack=pack)]
            return store.update_run(r['id'], status='queued', phase='review2', pid=None, review=json.dumps(v, ensure_ascii=False), history=json.dumps(h, ensure_ascii=False))
        if phase == 'review2':
            first = next((x.get('review') for x in reversed(_hist(r)) if x.get('stage') == 'review1' and x.get('attempt') == att), None)
            if first: v['first'] = {k: first.get(k) for k in ('verdict', 'top_rows', 'top_y', 'side_elevation', 'codes')}
            v['reasons'] = '[둘째 검수] ' + (v.get('reasons') or '')
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
    if ok and os.path.exists(base + '.png'):   # 파생 묶음: 원본 칸·고치지 않는 칸은 화소 그대로(derive.lock_check)
        from . import derive
        from common import objects_by_id
        lk = derive.lock_check(objects_by_id().get(r['item']) or {}, base + '.png', r.get('brief'))
        if lk: hard, ok = hard + lk, 0
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


def retry_review_errors(rounds_, queue_only=False):
    """Retry technical review failures without drawing again or changing verdicts."""
    n = 0
    for rid in rounds_:
        for r in store.runs(rid):
            if r['status'] != 'failed' or r.get('phase') not in ('review', 'review2'):
                continue
            png = os.path.join(r['root'], _folder(r), _out(r) + '.png')
            if not os.path.isfile(png):
                raise ValueError('기존 그림 없이 검수만 재개할 수 없습니다: ' + _out(r))
            # Re-run the actual checker. A pool exception used to erase ok, so
            # neither that flag nor a stale check.json proves the current pixels.
            import hashlib
            before = hashlib.sha256(open(png, 'rb').read()).hexdigest()
            base = png[:-4]
            check_path = base + '.check.json'
            if os.path.exists(check_path): os.replace(check_path, check_path + '.before-review-retry')
            ck = subprocess.run([sys.executable, 'scripts/content/hand-interior-pick/check_candidate.py', base + '.pxg'],
                                cwd=r['root'], capture_output=True, text=True)
            after = hashlib.sha256(open(png, 'rb').read()).hexdigest()
            if before != after: raise ValueError('검수 재개 중 원본 그림이 변경됨: ' + _out(r))
            checked = json.load(open(check_path))
            from common import objects_by_id
            locks = derive.lock_check(objects_by_id().get(r['item']) or {}, png, r.get('brief'))
            if ck.returncode or not checked.get('ok') or checked.get('hard') or locks:
                raise ValueError('기존 그림 기계 검사 실패: ' + _out(r))
            history = _hist(r) + [dict(stage='technical-review-retry', at=store.now(), error=r.get('error'), imageSha256=after)]
            store.update_run(r['id'], status='queued', pid=None, ok=1, error='', history=json.dumps(history, ensure_ascii=False))
            n += 1
    print(f'기존 그림 보존 · 기술 오류 검수 {n}개 재개 대기', flush=True)
    if n and not queue_only: ensure_pool()
    return n


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
    # 일꾼(그림·검수 32명)은 낮은 우선순위(nice 10)로 — 띄운 셸이 nice -10 이면 그대로 물려받아 고르는 화면 서버(nice 0)가
    # 굶었다(실측 2026-10-03: 상태 요청 0.7초 → 9초). 자식 프로세스는 이 값을 물려받는다.
    try: os.nice(max(0, 10 - os.nice(0)))
    except OSError: pass
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
                except (Exception, SystemExit) as e: store.update_run(r['id'], status='failed', ended=store.now(), ok=0, error=repr(e)[:500])
                print(store.now(), f"h{r['round']}-{r['letter']} 끝({code})", flush=True)
        # 작업지시서가 아직 없는 판(draw 가 new_round 뒤 brief.make 를 쓰는 중)은 건너뛴다 — 집어 가면 brief=None 으로 실패했다(2026-10-03 8차 16장)
        queued = [r for r in store.runs(status=('queued',)) if r.get('brief')]
        while queued and len(live) < MAX_PAR:
            r = queued.pop(0)
            try:
                live[r['id']] = (_start(r), r, time.time())
                print(store.now(), f"h{r['round']}-{r['letter']} 시작 — {r['item']}", flush=True)
            except (Exception, SystemExit) as e:
                store.update_run(r['id'], status='failed', ended=store.now(), ok=0, error=repr(e)[:500])
        if not live and not store.runs(status=('queued',)): break
        time.sleep(3)
    print(store.now(), '일꾼 끝', flush=True)


def _label(r):
    v = {}
    try: v = json.loads(r.get('review') or '{}')
    except ValueError: pass
    a = f"#{r.get('attempt') or 1}"
    if r['status'] in ('queued', 'running'): return f"{ {'review': '검수', 'review2': '둘째검수'}.get(r.get('phase'), '그림')}{a}:{r['status']}"
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


NEW_BRIEF_MARK = ('재서 지킨다', '평평한 게 정상이다')   # 2026-10-02 작업지시서(시점 절 숫자화) 표시
REDO_SKIP = {'hot spring': '오토타일 모드가 필요하다(낱개 기물로 다시 뽑아도 같은 실수)'}
REDO_NOTE = '다시 뽑기(2026-10-02 새 지시서): 「시점 (3/4)」 절과 view34/ 를 먼저 보고, 꼭대기 윗면 3행 이상을 재서 지킨다.'


def _ready_items():
    """화면의 「고를 차례」 순서(위에서부터)."""
    from . import api
    return [i['id'] for i in api.state()['items'] if i['status'] == 'ready']


def _drop_round(rd, keep):
    """안 고른 판 하나를 지운다: 일꾼(pid 로) → 후보 파일(keep 제외) → 작업지시서 폴더 → DB 행."""
    from . import brief
    from common import slug
    for r in store.runs(rd['id']):
        if r['status'] == 'running' and r['pid'] and _alive(r['pid']):
            try: os.killpg(r['pid'], signal.SIGTERM)
            except OSError: pass
    folder = os.path.join(ROOT, CANDS, slug(rd['item']))
    gone = 0
    for f in glob.glob(os.path.join(folder, f"h{rd['id']}-*")):
        if os.path.basename(f).split('.')[0].split('-x')[0] in keep: continue
        os.remove(f); gone += 1
    if rd.get('brief') and os.path.isdir(rd['brief']) and os.path.basename(rd['brief']) == f"h{rd['id']}": shutil.rmtree(rd['brief'])
    store.x('DELETE FROM runs WHERE round=?', (rd['id'],)); store.x('DELETE FROM rounds WHERE id=?', (rd['id'],))
    return gone


def redo(items, note=REDO_NOTE, dry=False):
    """안 고른 판의 후보를 지우고 새 작업지시서로 다시 뽑는다(사용자 2026-10-02 「고를 차례 위에서부터, 후보는 다 지우고」).
    지키는 것: 고른 판, 지금 고른 그림·다른 판의 출발 그림(base), 사용자가 버린 후보(새 판의 「이렇게 하지 말 것」).
    건너뛰는 것: 이미 새 지시서로 뽑은 판, REDO_SKIP."""
    from . import brief
    items = items or _ready_items()
    allr = store.rounds()
    based = {b.split('@')[0] for b in (rd.get('base') or '' for rd in allr) if b}
    out = []
    for item in items:
        if item in REDO_SKIP: print(f'{item}: 건너뜀 — {REDO_SKIP[item]}', flush=True); continue
        rds = store.rounds(item); fb = store.feedback(item)
        decided = {f['round'] for f in fb if f['verdict'] in ('pick', 'keep') and f['round']}
        keep = {f['cand'] for f in fb if f['cand']} | based | {brief.current_choice(item)}
        open_ = [rd for rd in rds if rd['id'] not in decided]
        last = rds[-1] if rds else None
        if last and last['id'] not in decided and last.get('brief') and os.path.exists(os.path.join(last['brief'], 'brief.md')) \
                and any(m in open(os.path.join(last['brief'], 'brief.md'), encoding='utf-8').read() for m in NEW_BRIEF_MARK):
            print(f'{item}: 건너뜀 — h{last["id"]} 가 이미 새 지시서', flush=True); continue
        base = next((rd['base'] for rd in reversed(rds) if '@' in (rd.get('base') or '')), '')
        if dry: print(f'{item}: 지울 판 {[rd["id"] for rd in open_]} · 출발 {base or "-"}', flush=True); continue
        gone = sum(_drop_round(rd, keep) for rd in open_)
        nb = note + (' 새 기물. 설명이 곧 명세다 — 적힌 높이·윗면 행 수를 지킨다.' if brief.is_new(item) else '')
        out += draw([item], note=nb, base=base, start_pool=False)
        print(f'  └ 지운 판 {[rd["id"] for rd in open_]} · 파일 {gone}개', flush=True)
    if out: ensure_pool()
    return out


def engines():
    """엔진 칸이 비어 있는(2026-10-02 전) 실행을 로그 첫 줄로 채운다 — Codex 로그는 「OpenAI Codex」 머리로 시작한다."""
    n = collections.Counter()
    for r in store.runs():
        for col, suf in (('engine', ''), ('review_engine', '.review')):
            if r.get(col): continue
            f = os.path.join(LOGS, f"{_out(r)}.a{r.get('attempt') or 1}{suf}.log")
            if not os.path.exists(f): continue
            with open(f, encoding='utf-8', errors='replace') as fh: head = fh.read(200)
            e = 'codex' if head.startswith('OpenAI Codex') else 'claude'
            store.update_run(r['id'], **{col: e}); n[(col, e)] += 1
    print(dict(n))


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sp = ap.add_subparsers(dest='cmd', required=True)
    d = sp.add_parser('draw'); d.add_argument('items', nargs='+'); d.add_argument('--n', type=int, default=N_DEFAULT)
    d.add_argument('--note', default=''); d.add_argument('--base', default='')
    rv = sp.add_parser('review'); rv.add_argument('rounds', nargs='+', type=int)
    rr = sp.add_parser('retry-review-errors'); rr.add_argument('rounds', nargs='+', type=int); rr.add_argument('--queue-only', action='store_true')
    sp.add_parser('pool'); sp.add_parser('status'); sp.add_parser('bake'); sp.add_parser('engines')
    rd = sp.add_parser('redo'); rd.add_argument('items', nargs='*'); rd.add_argument('--dry', action='store_true')
    a = ap.parse_args()
    sys.path.insert(0, os.path.join(ROOT, 'scripts/content/hand-interior-pick'))
    if a.cmd == 'retry-review-errors': return retry_review_errors(a.rounds, a.queue_only)
    if a.cmd == 'draw': draw(a.items, a.n, a.note, a.base)
    elif a.cmd == 'review': review(a.rounds)
    elif a.cmd == 'pool': pool()
    elif a.cmd == 'status': status()
    elif a.cmd == 'bake': bake()
    elif a.cmd == 'engines': engines()
    elif a.cmd == 'redo': redo(a.items, dry=a.dry)


if __name__ == '__main__':
    main()

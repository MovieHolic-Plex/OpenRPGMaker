#!/usr/bin/env python3
"""탈것 하네스 — Sonnet 5명이 같은 탈것을 다른 방향으로 찍고, 검사·독립 검수를 거친 뒤 사용자가 고른다.

  harness.py palette                                   harness-data/modern-chipset/vehicles.pal 다시 쓰기
  harness.py draw car side [--n 5] [--note "…"]        판을 열고 백그라운드로 그린다(바로 돌아온다). 판 id 출력
  harness.py status [판]                               판·후보 상태
  harness.py sheet <판>                                고르는 시트를 ~/claude-viz/veh-<판>.html 에 쓴다(자체완결)
  harness.py pick <판> <글자> [--note]                 사용자가 고른 후보를 기록(+ harness-data/…/picked/ 에 pxg·png 복사 + 다음 판의 anchors)
  harness.py reject <판> <글자> --why "…"              사용자가 버린 후보와 이유 기록(다음 판 「하지 말 것」)
  harness.py review <판>                               이미 그린 판을 (다시) 검수에
  harness.py bake [--dry] [--selftest] [--budget N]    합격 에셋 → 에디터용 타일셋(modern_city) 굽기: 시트 PNG + 정의 JSON + 키트 + 핀 + 리포트 (bake_tileset.py)

취향 판단은 사용자만 한다. 이 스크립트는 깨짐을 거르고, 기준차 옆에 놓은 독립 검수를 돌릴 뿐 후보를 고르지 않는다.
"""
import argparse, base64, concurrent.futures as cf, datetime, glob, io, json, os, shutil, subprocess, sys, threading, time
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
sys.path.insert(0, HERE)
import palette as PAL  # noqa: E402

DATA = os.path.join(ROOT, 'harness-data/modern-chipset')
RUNS = os.path.join(ROOT, 'qa-runs/harnesses/modern-chipset')
VIZ = os.path.expanduser('~/claude-viz')
MODEL = os.environ.get('VEH_HARNESS_MODEL', 'claude-sonnet-5-5')
EFFORT = os.environ.get('VEH_HARNESS_EFFORT', 'high')
MAX_ATTEMPTS = int(os.environ.get('VEH_HARNESS_ATTEMPTS', '3'))
TIMEOUT = int(os.environ.get('VEH_HARNESS_TIMEOUT', str(40 * 60)))
LETTERS = 'ABCDE'
DIRECTIONS_VEHICLE = {
    'A': '기준차 충실 — ref 의 윗면 조각 비율·유리 띠 각도·명암 갈림을 그대로 배워 승용 세단으로 옮긴다. 가장 보수적인 안.',
    'B': '지금 차에서 출발 — old 의 형태·비례를 유지하되 윗면(지붕·보닛·트렁크)을 면으로 키우고 접힘선·유리 띠를 넣는다.',
    'C': '둥근 차체 — 보닛·트렁크 모서리를 둥글게(ref 처럼) 이어 상자 느낌을 없앤다. 차체 윤곽이 부드럽게 흐르게.',
    'D': '낮고 날렵한 차 — 지붕을 낮추고 유리 띠를 완만하게. 윗면 조각은 ref 의 70% 이상 행 수를 지킨다.',
    'E': '자유 — 위 넷과 다른 해석 하나. 단 규칙(윗면이 면으로 읽힘·유리 띠·접힘선·1px 윤곽)은 지킨다.',
}


DIRECTIONS_GENERIC = {
    'A': '목표 충실 — city-target.png 의 같은 종류 그림이 가진 구조·비율·마감(굵은 윤곽·흰 하이라이트 테두리·면 분할)을 배워 가장 가깝게. 보수적인 안.',
    'B': '큰 면 중심 — 지붕/윗면·벽면을 크고 단순하게, 디테일은 적게. 1배(원 크기)에서 덩이로 읽히는 것을 우선.',
    'C': '디테일 풍부 — 같은 구조에서 창·문·간판·설비·이음선을 더 촘촘하게(하지만 팔레트·밀도 규칙 안에서, 잡점 금지).',
    'D': '이웃 정합 — 같은 판의 다른 종류(바닥·소품·차)와 같은 세트로 보이도록 색 램프 선택·윤곽 굵기·하이라이트를 통일하는 데 신경 쓴다.',
    'E': '자유 — 위 넷과 다른 해석 하나. 단 규칙(시점·팔레트·1px 윤곽)은 지킨다.',
}


def directions(item):
    d = seed()['items'][item].get('directions')
    return d or (DIRECTIONS_VEHICLE if seed()['items'][item].get('kind', 'vehicle') == 'vehicle' else DIRECTIONS_GENERIC)


def kind_of(item): return seed()['items'][item].get('kind', 'vehicle')


def now(): return datetime.datetime.now().isoformat(timespec='seconds')
def claude_bin(): return shutil.which('claude') or os.path.expanduser('~/.local/bin/claude')
def seed(): return json.load(open(os.path.join(DATA, 'seed.json'), encoding='utf-8'))
def ledger():
    p = os.path.join(DATA, 'ledger.json')
    return json.load(open(p, encoding='utf-8')) if os.path.exists(p) else {'picks': [], 'rejects': []}
def save_ledger(l): json.dump(l, open(os.path.join(DATA, 'ledger.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
def rdir(rid): return os.path.join(RUNS, rid)
def state_path(rid): return os.path.join(rdir(rid), 'state.json')
_lock = threading.RLock()
def load_state(rid):
    with _lock: return json.load(open(state_path(rid), encoding='utf-8'))
def upd(rid, letter=None, **kw):
    with _lock:
        s = json.load(open(state_path(rid), encoding='utf-8'))
        if letter: s['cands'][letter].update(kw)
        else: s.update(kw)
        tmp = state_path(rid) + '.tmp'
        json.dump(s, open(tmp, 'w', encoding='utf-8'), ensure_ascii=False, indent=1); os.replace(tmp, state_path(rid))


def up8(im, k=8, bg=(150, 154, 160, 255)):
    b = Image.new('RGBA', (im.width * k, im.height * k), bg); b.alpha_composite(im.resize((im.width * k, im.height * k), Image.NEAREST)); return b


def reference_img():
    return _reference_img()


def _reference_img():
    r = seed()['reference']
    return Image.open(os.path.join(ROOT, r['png'])).convert('RGBA').crop(tuple(r['box']))


CITY_REF = os.path.expanduser('~/.local/share/oprn/modern-chipset/ref/city-target.png')


def old_img(vehicle, view):
    p = os.path.join(DATA, 'old', f'{vehicle}-{view}.png')
    return Image.open(p).convert('RGBA') if os.path.exists(p) else None


def anchors(vehicle, view):
    return sorted(glob.glob(os.path.join(DATA, 'picked', f'{vehicle}-*.png')))


def make_brief(rid, vehicle, view, note):
    s = seed(); v = s['items'][vehicle]; vw = v['views'][view]; b = os.path.join(rdir(rid), 'brief'); os.makedirs(b, exist_ok=True)
    if v.get('kind', 'vehicle') == 'vehicle': up8(reference_img()).save(os.path.join(b, 'ref-x8.png'))
    old = old_img(vehicle, view)
    if old: up8(old).save(os.path.join(b, 'old-x8.png'))
    try:   # 사람 크기 기준(Actor1 주인공) — 8배 + 1m=16px 눈금
        import compose_city as _cc
        hero = _cc.actor(0, 2, 1); big = Image.new('RGBA', (hero.width * 8 + 160, hero.height * 8 + 30), (150, 154, 160, 255)); big.alpha_composite(hero.resize((hero.width * 8, hero.height * 8), Image.NEAREST), (10, 10))
        from PIL import ImageDraw as _ID; dd = _ID.Draw(big)
        for m in range(0, 3): dd.line([(hero.width * 8 + 40, hero.height * 8 + 8 - m * 16 * 8 // 2), (hero.width * 8 + 70, hero.height * 8 + 8 - m * 16 * 8 // 2)], fill=(0, 0, 0, 255), width=2)
        dd.text((hero.width * 8 + 80, hero.height * 8 - 12), '1m = 16px', fill=(0, 0, 0, 255)); big.save(os.path.join(b, 'actor-scale-x8.png'))
    except Exception as e: print('actor scale image skipped:', e)
    if os.path.exists(CITY_REF):   # 사용자가 준 목표 도시 그림(제3자 자료, 저장소 밖) — 시점·색 덩이·밀도의 기준. 화소 복사 금지.
        shutil.copyfile(CITY_REF, os.path.join(b, 'city-target.png'))
    an = []
    for p in anchors(vehicle, view):
        shutil.copy(p, os.path.join(b, 'anchor-' + os.path.basename(p))); up8(Image.open(p).convert('RGBA')).save(os.path.join(b, 'anchor-x8-' + os.path.basename(p))); an.append(os.path.basename(p))
    if v.get('kind') == 'building':   # 건물 화풍 계약 + 계약을 지킨 앵커 건물(문은 표준 문으로 덮어쓴 것)
        for p in sorted(glob.glob(os.path.join(DATA, 'anchors', 'bld_*.png'))):
            up8(Image.open(p).convert('RGBA')).save(os.path.join(b, 'style-anchor-x8-' + os.path.basename(p))); an.append('(화풍 앵커) ' + os.path.basename(p))
    L = ledger(); rej = [r for r in L['rejects'] if r['vehicle'] == vehicle and r['view'] == view]
    md = [f'# {v["title"]} · {view} — 작업지시서', '', f'- 설명: {v["desc"]} / 시점: {vw["desc"]} / 캔버스 {vw["w"]}x{vw["h"]}', '',
          '## 그림', '- `ref-x8.png` — **기준차**(modern-city-atlas 경찰차, 8배). ' + s['reference']['note'],
          '- `city-target.png` — **사용자가 준 목표 도시**(위에서 내려다본 시점: 지붕이 큰 면, 정면은 아래 1/3, 굵은 어두운 윤곽 + 흰 하이라이트 테두리, 색 덩이 소수). 시점·마감·밀도를 이 그림에서 읽는다. 색은 우리 팔레트로(채도 55%). 화소를 옮기지 마라. 차는 이 그림 속 차보다 훨씬 크게(1칸=16px=1m, 세단 약 70px).',
          '- `actor-scale-x8.png` — **사람 크기 기준**(Actor1 주인공 24×32 프레임, 몸통 약 16×24px, 눈금 1m=16px). 문·소품 크기를 여기에 맞춘다.',
          '- `old-x8.png` — 지금 쓰던 차(8배). 이 시점 규칙을 못 지켜 폐기 대상. 나빠지면 안 되는 비율·디테일은 여기서 가져와도 된다.' if old else '- (이 시점은 지금 것이 없다)']
    for a in an: md.append(f'- `anchor-x8-{a}` — 사용자가 고른 같은 탈것의 다른 시점. 화풍·색 기준.')
    if v.get('kind') == 'building': md += ['', open(os.path.join(HERE, 'style-building.md'), encoding='utf-8').read(), '- `style-anchor-x8-bld_*.png` — **화풍 앵커**: 계약을 지킨 건물 세 채. 선 두께·창·문 표현을 이대로 따른다. 문은 그림 가로 가운데에 둔다(단문 16px·이중문 24px).']
    md += ['', '## 계약'] + ['- ' + c for c in s['contract']] + ['', '## 팔레트 글자 (이 밖의 글자·색 금지)', PAL.legend(), '- `~` = 바닥 그림자(반투명, `@layer shadow` 에)']
    if rej: md += ['', '## 하지 말 것 (사용자가 버린 후보와 이유)'] + [f'- {r["why"]}' for r in rej]
    if note: md += ['', '## 사용자 메모', note]
    open(os.path.join(b, 'brief.md'), 'w', encoding='utf-8').write('\n'.join(md) + '\n')
    return b


def worker_prompt(st, letter, redraw=''):
    s = seed(); v = s['items'][st['vehicle']]; vw = v['views'][st['view']]
    t = open(os.path.join(HERE, 'prompt.md'), encoding='utf-8').read()
    folder = os.path.relpath(rdir(st['id']), ROOT)
    rep = dict(ROOT=ROOT, TITLE=v['title'], DESC=v['desc'], VIEW=st['view'], VIEWDESC=vw['desc'], W=vw['w'], H=vw['h'], BRIEF=os.path.join(rdir(st['id']), 'brief'),
               LETTER=letter, DIRECTION=directions(st['vehicle'])[letter], FOLDER=folder, KINDNOTE=v.get('brief', ''), ITEMKIND=v.get('kind', 'vehicle'), OUT=letter, REDRAW=redraw,
               PAL=os.path.relpath(os.path.join(DATA, 'palette.pal'), rdir(st['id'])))
    for k, val in rep.items(): t = t.replace('{' + k + '}', str(val))
    return t


def run_claude(prompt, log, effort, images=()):
    """VEH_HARNESS_BACKEND=codex 이면 codex exec 로, 아니면 claude -p 로 작업자를 띄운다."""
    approval = os.environ.get('VEH_LAYOUT_APPROVAL')
    if approval:
        prompt += ('\n\n감독 실행기가 현재 파일 해시를 대조한 독립 도면 승인입니다. '
                   '준비 단계의 pending 표기보다 이 현재 승인을 사용하세요. '
                   '이는 도면 승인만이며 실제 그림의 검수는 여전히 필요합니다.\n' + approval)
    if os.environ.get('VEH_HARNESS_BACKEND') == 'codex':
        cmd = ['codex', 'exec', '--dangerously-bypass-approvals-and-sandbox', '--skip-git-repo-check', '-C', ROOT,
               '-c', f'model_reasoning_effort="{os.environ.get("VEH_CODEX_EFFORT", "high")}"']
        if os.environ.get('VEH_CODEX_MODEL'): cmd += ['-m', os.environ['VEH_CODEX_MODEL']]
        for im in images: cmd += ['-i', im]
        cmd += ['-']   # 프롬프트는 stdin
        stdin_data = prompt
    else:
        env0 = dict(os.environ, PH_PROMPT=prompt, PH_CLAUDE=claude_bin(), PH_MODEL=MODEL, PH_EFFORT=effort)
        cmd = ['bash', '-lc', 'exec "$PH_CLAUDE" -p "$PH_PROMPT" --model "$PH_MODEL" --effort "$PH_EFFORT" --dangerously-skip-permissions --output-format text']
        stdin_data = None
    env = dict(os.environ, PH_PROMPT=prompt, PH_CLAUDE=claude_bin(), PH_MODEL=MODEL, PH_EFFORT=effort)
    with open(log, 'w') as f:
        p = subprocess.Popen(cmd, cwd=ROOT, env=env, stdout=f, stderr=subprocess.STDOUT,
                             stdin=subprocess.PIPE if stdin_data else subprocess.DEVNULL, start_new_session=True, text=True)
        if stdin_data:
            p.stdin.write(stdin_data); p.stdin.close()
        try: return p.wait(timeout=TIMEOUT)
        except subprocess.TimeoutExpired:
            os.killpg(p.pid, 15); return 'timeout'


def check(st, letter):
    vw = seed()['items'][st['vehicle']]['views'][st['view']]
    base = os.path.join(rdir(st['id']), letter)
    r = subprocess.run([sys.executable, os.path.join(HERE, 'check.py'), base + '.pxg', '--w', str(vw['w']), '--h', str(vw['h']), '--view', st['view'], '--kind', kind_of(st['vehicle']), '--seamless', ','.join(map(str, seed()['items'][st['vehicle']].get('seamless_cells', [])))], cwd=ROOT, capture_output=True, text=True)
    try: return json.load(open(base + '.check.json'))
    except Exception: return {'ok': False, 'hard': [(r.stdout + r.stderr)[-400:]], 'soft': {}}


def review_pack(st, letter, att):
    pack = os.path.join(rdir(st['id']), 'brief', 'review', f'{letter}-a{att}'); os.makedirs(pack, exist_ok=True)
    cand = Image.open(os.path.join(rdir(st['id']), letter + '.png')).convert('RGBA')
    ref = reference_img() if kind_of(st['vehicle']) == 'vehicle' else None; old = old_img(st['vehicle'], st['view'])
    parts = ([up8(ref)] if ref else []) + ([up8(old)] if old else []) + [up8(cand)]
    W = sum(p.width for p in parts) + 24 * (len(parts) - 1); H = max(p.height for p in parts)
    pair = Image.new('RGBA', (W, H), (150, 154, 160, 255)); x = 0
    for p in parts: pair.alpha_composite(p, (x, H - p.height)); x += p.width + 24
    pair.save(os.path.join(pack, 'pair-x8.png')); up8(cand).save(os.path.join(pack, 'cand-x8.png'))
    if os.path.exists(CITY_REF): shutil.copyfile(CITY_REF, os.path.join(pack, 'city-target.png'))
    if kind_of(st['vehicle']) == 'tilesheet':   # 칸마다 4×4 반복(3배)으로 이음·반복 티를 본다
        sc = seed()['items'][st['vehicle']].get('seamless_cells', []); cols = cand.width // 16
        tiles = [cand.crop(((i % cols) * 16, (i // cols) * 16, (i % cols) * 16 + 16, (i // cols) * 16 + 16)) for i in sc]
        sheet = Image.new('RGBA', (len(tiles) * 4 * 16 * 2 + 10 * len(tiles), 4 * 16 * 2 + 10), (150, 154, 160, 255))
        for n, t in enumerate(tiles):
            rep = Image.new('RGBA', (64, 64))
            for yy in range(4):
                for xx in range(4): rep.paste(t, (xx * 16, yy * 16))
            sheet.alpha_composite(rep.resize((128, 128), Image.NEAREST), (n * 138, 5))
        sheet.save(os.path.join(pack, 'street-x3.png')); return pack
    row = ([ref] if ref else []) + ([old] if old else []) + [cand]; k = 3
    W = sum(i.width * k for i in row) + 30 * (len(row) + 1); H = max(i.height * k for i in row) + 60
    st_ = Image.new('RGBA', (W, H), (150, 154, 160, 255)); x = 30
    for i in row:
        st_.alpha_composite(i.resize((i.width * k, i.height * k), Image.NEAREST), (x, H - 30 - i.height * k)); x += i.width * k + 30
    st_.save(os.path.join(pack, 'street-x3.png'))
    return pack


def review_prompt(st, letter, att, prev):
    pack = review_pack(st, letter, att)
    t = open(os.path.join(HERE, 'review.md'), encoding='utf-8').read()
    an = anchors(st['vehicle'], st['view'])
    rep = dict(ROOT=ROOT, TITLE=seed()['items'][st['vehicle']]['title'], VIEW=st['view'], CAND=os.path.join(rdir(st['id']), letter + '.png'), ATTEMPT=att, MAX=MAX_ATTEMPTS,
               LETTER=letter, DIRECTION=directions(st['vehicle'])[letter], PACK=pack, KINDNOTE=seed()['items'][st['vehicle']].get('brief', ''), CRITERIA=open(os.path.join(HERE, 'criteria-' + kind_of(st['vehicle']) + '.md'), encoding='utf-8').read(),
               ANCHORS=('5. 사용자가 고른 같은 탈것의 다른 시점(화풍 기준): ' + ', '.join(an)) if an else '',
               PREV=('## 지난 시도의 지적 (이번에 고쳐졌나 확인)\n' + prev) if prev else '')
    for k, val in rep.items(): t = t.replace('{' + k + '}', str(val))
    return t, pack


def do_candidate(rid, letter):
    st = load_state(rid); out = os.path.join(rdir(rid), letter); prev = ''; hist = []
    for att in range(1, MAX_ATTEMPTS + 1):
        upd(rid, letter, status='drawing', attempt=att)
        redraw = ''
        if att > 1:
            for ext in ('.pxg', '.png', '-x4.png', '.note'):
                if os.path.exists(out + ext): shutil.copyfile(out + ext, f'{out}.a{att-1}{ext}')
            redraw = (f'\n**다시 그리기 ({att}/{MAX_ATTEMPTS})**: `{os.path.relpath(out, ROOT)}.pxg` 가 지난 시도다. 복사하지 말고 그 파일을 고쳐 다시 굽는다. 지난 시도의 지적:\n{prev}\n')
        bd = os.path.join(rdir(rid), 'brief'); imgs = [p for p in (os.path.join(bd, 'ref-x8.png'), os.path.join(bd, 'old-x8.png'), out + '-x4.png' if att > 1 else '') if p and os.path.exists(p)]
        code = run_claude(worker_prompt(st, letter, redraw), os.path.join(rdir(rid), 'logs', f'{letter}.a{att}.log'), EFFORT, imgs)
        if not os.path.exists(out + '.pxg'):
            upd(rid, letter, status='failed', error=f'후보 파일 없음({code})'); return
        ck = check(st, letter)
        if not ck['ok']:
            prev = '기계 검사 불합격: ' + '; '.join(ck['hard']); hist.append(dict(stage='hard', attempt=att, hard=ck['hard']))
            upd(rid, letter, history=hist, check=ck)
            if att == MAX_ATTEMPTS: upd(rid, letter, status='done', ok=False, review=dict(verdict='HARD', reasons=prev)); return
            continue
        upd(rid, letter, status='reviewing', check=ck)
        rp, pack = review_prompt(st, letter, att, prev)
        vfile = os.path.join(pack, 'verdict.json')
        for _ in range(2):
            run_claude(rp, os.path.join(rdir(rid), 'logs', f'{letter}.a{att}.review.log'), EFFORT, [os.path.join(pack, n) for n in ('pair-x8.png', 'street-x3.png')])
            if os.path.exists(vfile): break
        try: v = json.load(open(vfile, encoding='utf-8')); v['verdict'] = str(v.get('verdict', '')).upper()
        except Exception: v = dict(verdict='ERROR', reasons='검수자가 결과를 못 냈다')
        v['attempt'] = att; hist.append(dict(stage='review', attempt=att, review=v)); upd(rid, letter, history=hist, review=v)
        if v['verdict'] == 'PASS' or v['verdict'] == 'ERROR' or att == MAX_ATTEMPTS:
            upd(rid, letter, status='done', ok=v['verdict'] == 'PASS'); return
        prev = f'검수 불합격 {v.get("codes")}: {v.get("reasons")}\n고칠 것: {v.get("fix")}'
    upd(rid, letter, status='done', ok=False)


def cmd_draw(a):
    s = seed()
    if a.backend: os.environ['VEH_HARNESS_BACKEND'] = a.backend
    if a.vehicle not in s['items'] or a.view not in s['items'][a.vehicle]['views']: sys.exit('모르는 탈것/시점: ' + a.vehicle + ' ' + a.view)
    rid = 'v' + datetime.datetime.now().strftime('%m%d-%H%M%S'); os.makedirs(os.path.join(rdir(rid), 'logs'), exist_ok=True)
    PAL.write_pal(os.path.join(DATA, 'palette.pal'))
    make_brief(rid, a.vehicle, a.view, a.note)
    letters = LETTERS[:a.n]
    json.dump(dict(id=rid, vehicle=a.vehicle, view=a.view, note=a.note, backend=os.environ.get('VEH_HARNESS_BACKEND', 'claude'), created=now(), cands={l: dict(status='queued') for l in letters}), open(state_path(rid), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    if a.fg: return run_round(rid)
    subprocess.Popen([sys.executable, os.path.abspath(__file__), '_run', rid], cwd=ROOT, start_new_session=True,
                     stdout=open(os.path.join(rdir(rid), 'logs', 'round.log'), 'w'), stderr=subprocess.STDOUT, stdin=subprocess.DEVNULL)
    print(rid)


def run_round(rid):
    st = load_state(rid)
    with cf.ThreadPoolExecutor(max_workers=len(st['cands'])) as ex:
        list(ex.map(lambda l: do_candidate(rid, l), list(st['cands'])))
    upd(rid, ended=now()); cmd_sheet(argparse.Namespace(round=rid))


def cmd_review(a):
    st = load_state(a.round)
    def one(l):
        att = (st['cands'][l].get('attempt') or 1); rp, pack = review_prompt(st, l, att, '')
        run_claude(rp, os.path.join(rdir(a.round), 'logs', f'{l}.a{att}.rereview.log'), EFFORT)
        try: v = json.load(open(os.path.join(pack, 'verdict.json'), encoding='utf-8')); upd(a.round, l, review=v, ok=str(v.get('verdict')).upper() == 'PASS')
        except Exception: pass
    with cf.ThreadPoolExecutor(max_workers=len(st['cands'])) as ex: list(ex.map(one, list(st['cands'])))
    cmd_sheet(a)


def cmd_status(a):
    rounds = [a.round] if a.round else sorted(os.listdir(RUNS)) if os.path.isdir(RUNS) else []
    for rid in rounds:
        try: st = load_state(rid)
        except Exception: continue
        print(f'{rid} {st["vehicle"]}/{st["view"]} {"끝" if st.get("ended") else "진행"}')
        for l, c in st['cands'].items():
            v = c.get('review') or {}
            print(f'  {l} {c.get("status")} 시도{c.get("attempt","-")} {"✓" if c.get("ok") else "✗" if c.get("ok") is False else " "} {v.get("verdict","")} {v.get("codes","") or ""}')


def b64(path): return 'data:image/png;base64,' + base64.b64encode(open(path, 'rb').read()).decode()


def cmd_sheet(a):
    st = load_state(a.round); rid = a.round; os.makedirs(VIZ, exist_ok=True)
    ref = reference_img() if kind_of(st['vehicle']) == 'vehicle' else None; old = old_img(st['vehicle'], st['view'])
    def img(im, k=6):
        buf = io.BytesIO(); im.resize((im.width * k, im.height * k), Image.NEAREST).save(buf, 'PNG'); return 'data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode()
    cards = ([('기준: modern-city-atlas 경찰차', img(ref), '')] if ref else []) + ([('지금 것(폐기 대상)', img(old), '')] if old else [])
    for l, c in st['cands'].items():
        p = os.path.join(rdir(rid), l + '.png')
        if not os.path.exists(p): continue
        v = c.get('review') or {}
        tag = ('✓ 검수 통과' if c.get('ok') else '✗ ' + (v.get('verdict', '미통과')) + ' ' + ','.join(v.get('codes') or []))
        why = (v.get('surfaces') or '') + (' · ' + v.get('reasons', '') if not c.get('ok') else '')
        note = open(os.path.join(rdir(rid), l + '.note'), encoding='utf-8').read().strip() if os.path.exists(os.path.join(rdir(rid), l + '.note')) else ''
        cards.append((f'{l}  {directions(st['vehicle'])[l].split(" — ")[0]}  [{tag}]', img(Image.open(p).convert('RGBA')), (note + '\n' + why).strip()))
    html = ['<!doctype html><meta charset=utf-8><title>탈것 후보 ' + rid + '</title><style>body{background:#2a2d31;color:#eee;font:14px sans-serif;margin:16px}'
            '.r{display:flex;flex-wrap:wrap;gap:20px;align-items:flex-end;background:#969aa0;padding:14px;border-radius:6px}figure{margin:0;max-width:560px}figcaption{color:#111;font-size:13px;margin:4px 0}'
            'img{image-rendering:pixelated;display:block}small{color:#222;display:block;max-width:520px}</style>',
            f'<h3>{st["vehicle"]} · {st["view"]} · 판 {rid}</h3><div class=r>']
    for cap, src, sm in cards: html.append(f'<figure><figcaption>{cap}</figcaption><img src="{src}"><small>{sm}</small></figure>')
    html.append('</div><p>고르면: <code>harness.py pick ' + rid + ' &lt;글자&gt;</code> — 버리면 <code>reject ' + rid + ' &lt;글자&gt; --why …</code></p>')
    open(os.path.join(VIZ, f'veh-{rid}.html'), 'w', encoding='utf-8').write('\n'.join(html))
    print(f'http://mdc-server:18301/veh-{rid}.html')


def cmd_pick(a):
    st = load_state(a.round); os.makedirs(os.path.join(DATA, 'picked'), exist_ok=True)
    for ext in ('.pxg', '.png'):
        shutil.copyfile(os.path.join(rdir(a.round), a.letter + ext), os.path.join(DATA, 'picked', f'{st["vehicle"]}-{st["view"]}{ext}'))
    L = ledger(); L['picks'].append(dict(round=a.round, letter=a.letter, vehicle=st['vehicle'], view=st['view'], note=a.note, at=now(), by='user')); save_ledger(L)
    print('기록: harness-data/modern-chipset/picked/' + f'{st["vehicle"]}-{st["view"]}.pxg')


def cmd_reject(a):
    st = load_state(a.round); L = ledger()
    L['rejects'].append(dict(round=a.round, letter=a.letter, vehicle=st['vehicle'], view=st['view'], why=a.why, at=now())); save_ledger(L); print('기록')


def cmd_bake(a):
    cmd = [sys.executable, os.path.join(HERE, 'bake_tileset.py')] + (['--dry'] if a.dry else []) + (['--selftest'] if a.selftest else []) + (['--budget', str(a.budget)] if a.budget else []) + (['--out-root', a.out_root] if a.out_root else [])
    sys.exit(subprocess.call(cmd, cwd=ROOT))


def main():
    ap = argparse.ArgumentParser(); sub = ap.add_subparsers(dest='cmd', required=True)
    sub.add_parser('palette')
    bk = sub.add_parser('bake', help='합격 에셋 → 에디터용 타일셋(modern_city) 굽기'); bk.add_argument('--dry', action='store_true', help='파일을 쓰지 않고 계산만'); bk.add_argument('--selftest', action='store_true', help='다시 굽기 동일·에셋 추가 시 번호 불변 시험(임시 폴더)')
    bk.add_argument('--budget', type=int, default=0, help='칸 상한(기본 10000)'); bk.add_argument('--out-root', default='', help='산출물 루트(기본 저장소 루트)')
    d = sub.add_parser('draw'); d.add_argument('vehicle'); d.add_argument('view'); d.add_argument('--n', type=int, default=5); d.add_argument('--note', default=''); d.add_argument('--fg', action='store_true'); d.add_argument('--backend', choices=['claude', 'codex'], default=None)
    r = sub.add_parser('_run'); r.add_argument('round')
    s = sub.add_parser('status'); s.add_argument('round', nargs='?')
    for n in ('sheet', 'review'): x = sub.add_parser(n); x.add_argument('round')
    p = sub.add_parser('pick'); p.add_argument('round'); p.add_argument('letter'); p.add_argument('--note', default='')
    j = sub.add_parser('reject'); j.add_argument('round'); j.add_argument('letter'); j.add_argument('--why', required=True)
    a = ap.parse_args()
    {'palette': lambda: PAL.write_pal(os.path.join(DATA, 'palette.pal')), 'draw': lambda: cmd_draw(a), '_run': lambda: run_round(a.round), 'status': lambda: cmd_status(a),
     'sheet': lambda: cmd_sheet(a), 'review': lambda: cmd_review(a), 'pick': lambda: cmd_pick(a), 'reject': lambda: cmd_reject(a), 'bake': lambda: cmd_bake(a)}[a.cmd]()


if __name__ == '__main__': main()

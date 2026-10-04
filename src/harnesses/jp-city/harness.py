#!/usr/bin/env python3
"""jp-city 하네스 — 번들 타일셋 jp_city(modern3, 16px, 3/4 시점)에 넣을 주택가·역·공원·신사 그림 후보를 Sonnet 5명이 다른 방향으로 찍고,
기계 검사·독립 검수를 거친 뒤 **사람이 고른다**. 감독은 고르지 않는다. 굽기(시트 합치기)는 이 하네스가 하지 않는다 — `pick` 결과를 남기는 데까지.

  harness.py palette                           harness-data/jp-city/{palette.pal,mats.txt} 다시 쓰기 (modern3 → pxgrid)
  harness.py validate                          시드 점검(크기·슬롯·칸·예시·참고 그림이 풀리는가)
  harness.py list [--wave houses|station|park|shrine]   시드 항목 목록(+고른 것 표시)
  harness.py anchors                           시드 anchors 크롭을 harness-data/jp-city/anchors/ 에 써서 눈으로 확인
  harness.py draw <항목> [--n 5] [--note "…"]  판을 열고 백그라운드로 그린다(바로 돌아온다). 판 id 출력
  harness.py status [판]                       판·후보 상태
  harness.py sheet <판>                        고르는 시트를 ~/claude-viz/jp-<판>.html 에 쓴다(자체완결)
  harness.py review <판>                       이미 그린 판을 (다시) 검수에
  harness.py pick <판> <글자> [--note]         사용자가 고른 후보를 기록(+ harness-data/jp-city/picked/<항목>.pxg|png 복사)
  harness.py reject <판> <글자> --why "…"      사용자가 버린 후보와 이유 기록(다음 판 「하지 말 것」)

취향 판단은 사용자만 한다. 이 스크립트는 깨짐을 거르고, 기준 그림 옆에 놓은 독립 검수를 돌릴 뿐 후보를 고르지 않는다.
"""
import argparse, base64, concurrent.futures as cf, datetime, glob, io, json, os, shutil, subprocess, sys, threading
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
sys.path.insert(0, HERE)
import palette as PAL  # noqa: E402
import anchors as ANC  # noqa: E402

DATA = os.path.join(ROOT, 'harness-data/jp-city')
RUNS = os.path.join(ROOT, 'qa-runs/harnesses/jp-city')
VIZ = os.path.expanduser('~/claude-viz')
MODEL = os.environ.get('JP_HARNESS_MODEL', 'claude-sonnet-5-5')
EFFORT = os.environ.get('JP_HARNESS_EFFORT', 'high')
MAX_ATTEMPTS = int(os.environ.get('JP_HARNESS_ATTEMPTS', '3'))
TIMEOUT = int(os.environ.get('JP_HARNESS_TIMEOUT', str(40 * 60)))
LETTERS = 'ABCDE'
GRAY = (150, 154, 160, 255)

DIRECTIONS = {
    'A': '목표 충실 — 같은 종류의 도시 화풍 목표(anchor-*·prop-*)가 가진 구조·비율·마감(1px 짙은 윤곽·밝은 처마선·면 분할)을 배워 가장 가깝게. 보수적인 안.',
    'B': '큰 면 중심 — 지붕/윗면·몸통·바닥 면을 크고 단순하게, 디테일은 적게. 원 크기(1배)에서 덩이로 먼저 읽히는 것을 우선.',
    'C': '일본식 디테일 풍부 — 같은 구조에서 이 물건다운 일본식 디테일(기와 능선·박공·시데 종이·점자블록·가라하후 등 항목 설명이 가리킨 것)을 더 촘촘히. 단 팔레트·밀도 규칙 안에서, 잡점 금지.',
    'D': '이웃 정합 — picked-*(사용자가 이미 고른 그림)·prop-*(기존 jp_city 조각)과 같은 세트로 보이게 램프 선택·윤곽 굵기·하이라이트·그림자 규칙을 맞추는 데 신경 쓴다.',
    'E': '자유 — 위 넷과 다른 해석 하나. 단 규칙(3/4 시점·modern3 팔레트·1px 윤곽·사람 금지)은 지킨다.',
}


def kofont(size=14):
    """한글이 나오는 글꼴(없으면 PIL 기본 — 그림 속 제목이 네모로 보일 뿐 동작은 같다)."""
    from PIL import ImageFont
    for p in ('/usr/share/fonts/truetype/nanum/NanumBarunGothic.ttf', '/usr/share/fonts/truetype/nanum/NanumGothic.ttf', '/usr/share/fonts/truetype/nanum/NanumSquareR.ttf'):
        if os.path.exists(p): return ImageFont.truetype(p, size)
    return ImageFont.load_default()


def now(): return datetime.datetime.now().isoformat(timespec='seconds')
def claude_bin(): return shutil.which('claude') or os.path.expanduser('~/.local/bin/claude')
def seed(): return json.load(open(os.path.join(DATA, 'seed.json'), encoding='utf-8'))
def item_of(item):
    s = seed()
    if item not in s['items']: sys.exit('모르는 항목: ' + item + ' (harness.py list 로 확인)')
    return s['items'][item]
def dims(item): w, h = item_of(item)['size']; return w * 16, h * 16
def directions(item): return item_of(item).get('directions') or DIRECTIONS
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


def up(im, k=8, bg=GRAY):
    b = Image.new('RGBA', (im.width * k, im.height * k), bg); b.alpha_composite(im.resize((im.width * k, im.height * k), Image.NEAREST)); return b


def picked_pngs(exclude=None):
    out = sorted(glob.glob(os.path.join(DATA, 'picked', '*.png')), key=os.path.getmtime, reverse=True)
    return [p for p in out if os.path.splitext(os.path.basename(p))[0] != exclude][:8]


def own_picked(item):
    p = os.path.join(DATA, 'picked', item + '.png')
    return p if os.path.exists(p) else None


def ground_img(item, key=None):
    it = item_of(item); ctx = seed().get('context', {})
    return ANC.cell_by_name(ctx[key or it.get('ground', 'sw')])


def tile_fill(size, tile):
    im = Image.new('RGBA', size)
    for y in range(0, size[1], 16):
        for x in range(0, size[0], 16): im.paste(tile, (x, y))
    return im


# ------------------------------------------------------------------ 안내 그림
def scale_ruler():
    """1칸=16px=1m 눈금과 사람 키(24px 상자)·문 높이 눈금. 사람 그림은 그리지 않는다(행인 금지)."""
    k = 8; W, H = 16 * k * 5 + 40, 40 * k + 30
    im = Image.new('RGBA', (W, H), GRAY); d = ImageDraw.Draw(im)
    for i in range(5):
        for j in range(3): d.rectangle([20 + i * 16 * k, 10 + j * 16 * k, 20 + (i + 1) * 16 * k, 10 + (j + 1) * 16 * k], outline=(60, 60, 80, 255))
    d.rectangle([20 + 16 * k * 3 + 20, 10 + (48 - 24) * k, 20 + 16 * k * 3 + 20 + 16 * k, 10 + 48 * k], outline=(170, 40, 40, 255), width=3)
    d.text((20 + 16 * k * 3 + 24, 10 + (48 - 24) * k + 4), 'person 24px', fill=(170, 40, 40, 255))
    d.line([(20 + 16 * k * 3 + 20 - 14, 10 + (48 - 30) * k), (20 + 16 * k * 3 + 20 - 14, 10 + 48 * k)], fill=(30, 100, 40, 255), width=3)
    d.text((20 + 16 * k * 3 - 80, 10 + (48 - 30) * k - 12), 'door 28-30px', fill=(30, 100, 40, 255))
    d.text((24, 12), '1 cell = 16px = 1 m (x8)', fill=(0, 0, 0, 255))
    return im


def layout_guide(item):
    """슬롯/칸 자리 그림(6배): 이름·통행 색(막힘 빨강·걸음 초록·위 지나감 노랑)."""
    it = item_of(item); cw, ch = it['size']; k = 6; C = 16 * k
    im = Image.new('RGBA', (cw * C + 1, ch * C + 1), (205, 208, 214, 255)); d = ImageDraw.Draw(im)
    for i in range(cw + 1): d.line([(i * C, 0), (i * C, ch * C)], fill=(120, 120, 140, 255))
    for j in range(ch + 1): d.line([(0, j * C), (cw * C, j * C)], fill=(120, 120, 140, 255))
    col = {'solid': (200, 60, 60, 255), 'walk': (50, 150, 70, 255), 'star': (210, 170, 20, 255)}
    for s in it.get('slots') or []:
        d.rectangle([s['x'] * C + 2, s['y'] * C + 2, (s['x'] + s['w']) * C - 2, (s['y'] + s['h']) * C - 2], outline=col.get(s.get('walk', 'solid'), (60, 60, 60, 255)), width=3)
        d.text((s['x'] * C + 6, s['y'] * C + 6), s['id'], fill=(0, 0, 0, 255))
    for nm, c in (it.get('cells') or {}).items():
        d.rectangle([c['x'] * C + 2, c['y'] * C + 2, (c['x'] + 1) * C - 2, (c['y'] + 1) * C - 2], outline=col.get(c.get('walk', 'solid')), width=3)
        d.text((c['x'] * C + 6, c['y'] * C + 6), nm + ('\n' + c['repeat'] + '-repeat' if c.get('repeat') else '') + ('\nopaque' if c.get('opaque') else ''), fill=(0, 0, 0, 255))
    return im


def compose_kit(item, cand, k=3):
    """kit 의 조립 예(examples) 전부를 맥락 위에 붙이고 통행 지도를 옆에 놓은 한 장."""
    it = item_of(item); ctx = seed().get('context', {}); cells = it['cells']; rows = []
    wcol = {'solid': (200, 60, 60, 150), 'walk': (50, 170, 80, 150), 'star': (230, 190, 30, 150)}
    for nm, ex in it['examples'].items():
        g = ex['grid']; gh, gw = len(g), len(g[0]); base = ex.get('base')
        asm = Image.new('RGBA', (gw * 16, gh * 16)); wk = Image.new('RGBA', (gw * 16, gh * 16), (70, 72, 80, 255))
        for j in range(gh):
            for i in range(gw):
                b = (base[j][i] if base else '.')
                asm.paste(ANC.cell_by_name(ctx[b if b in ctx else it.get('ground', 'sw')]), (i * 16, j * 16))
        for j in range(gh):
            for i in range(gw):
                n = g[j][i]
                if n in cells:
                    c = cells[n]; tile = cand.crop((c['x'] * 16, c['y'] * 16, c['x'] * 16 + 16, c['y'] * 16 + 16)); asm.alpha_composite(tile, (i * 16, j * 16))
                    ov = Image.new('RGBA', (16, 16), wcol[c.get('walk', 'solid')]); wk.alpha_composite(ov, (i * 16, j * 16))
                else:
                    ov = Image.new('RGBA', (16, 16), wcol['walk']); wk.alpha_composite(ov, (i * 16, j * 16))
        rows.append((nm, asm.resize((asm.width * k, asm.height * k), Image.NEAREST), wk.resize((wk.width * k, wk.height * k), Image.NEAREST)))
    W = max(r[1].width * 2 + 60 for r in rows); H = sum(r[1].height + 28 for r in rows) + 10
    out = Image.new('RGBA', (W, H), GRAY); d = ImageDraw.Draw(out); y = 6
    for nm, a, w in rows:
        d.text((8, y), f'{nm}  — 왼쪽: 조립 / 오른쪽: 통행(빨강 막힘·초록 걸음·노랑 위로 지나감, 칸 밖은 초록)', fill=(0, 0, 0, 255), font=kofont(14)); y += 18
        out.alpha_composite(a, (8, y)); out.alpha_composite(w, (a.width + 30, y)); y += a.height + 10
    return out


def object_context(item, cand, k=3):
    """오브젝트를 땅 위에 세우고 좌우에 이웃 조각(prop 참고)을 같은 배율로 놓는다 — 크기·시점 비교용."""
    it = item_of(item); cw, ch = it['size']; anch = seed().get('anchors', {})
    neigh = []
    for r in it.get('refs', []):
        if r.startswith('prop:'):
            _, im, _, _ = ANC.resolve(r, anch)
            if im is not None: neigh.append(im)
    W = (cw + 2) * 16 + sum(n.width + 16 for n in neigh[:2]); H = (ch + 2) * 16
    ground = tile_fill((W, H), ground_img(item)); base_y = H - 16
    x = 16
    for n in neigh[:1]: ground.alpha_composite(n, (x, base_y - n.height)); x += n.width + 16
    ground.alpha_composite(cand, (x, base_y - cand.height)); x += cand.width + 16
    for n in neigh[1:2]: ground.alpha_composite(n, (x, base_y - n.height))
    return ground.resize((ground.width * k, ground.height * k), Image.NEAREST)


def tile_repeat(item, cand, k=3):
    it = item_of(item); cw, ch = it['size']; sc = it.get('seamless_cells') or list(range(cw * ch)); tiles = []
    for i in sc:
        x, y = (i % cw) * 16, (i // cw) * 16; tiles.append(cand.crop((x, y, x + 16, y + 16)))
    sheet = Image.new('RGBA', (len(tiles) * 4 * 16 * 2 + 10 * len(tiles), 4 * 16 * 2 + 10), GRAY)
    for n, t in enumerate(tiles):
        rep = tile_fill((64, 64), ground_img(item)) if 'overlay' in it.get('flags', []) else Image.new('RGBA', (64, 64), (0, 0, 0, 0))
        for yy in range(4):
            for xx in range(4): rep.alpha_composite(t, (xx * 16, yy * 16))
        sheet.alpha_composite(rep.resize((128, 128), Image.NEAREST), (n * 138, 5))
    return sheet


# ------------------------------------------------------------------ 작업지시서
def make_brief(rid, item, note):
    s = seed(); it = item_of(item); b = os.path.join(rdir(rid), 'brief'); os.makedirs(b, exist_ok=True)
    w, h = dims(item); anch = s.get('anchors', {}); an = []
    for n, r in enumerate(it.get('refs', [])):
        lab, im, caution, k = ANC.resolve(r, anch)
        if im is None: print('참고 그림을 못 풀었다(건너뜀):', r); continue
        k = max(2, min(k, 1000 // max(im.width, 1))); fn = f'ref{n + 1}-{lab}-x{k}.png'; up(im, k, bg=(120, 124, 130, 255)).save(os.path.join(b, fn)); an.append((fn, caution, lab))
    up(scale_ruler(), 1).save(os.path.join(b, 'scale-x8.png'))
    if it.get('slots') or it.get('cells'): layout_guide(item).save(os.path.join(b, 'layout-x6.png'))
    pk = []
    for p in picked_pngs(exclude=item):
        fn = 'picked-x4-' + os.path.basename(p); up(Image.open(p).convert('RGBA'), 4, bg=(120, 124, 130, 255)).save(os.path.join(b, fn)); pk.append(fn)
    own = own_picked(item)
    if own: fn = 'picked-self-x4.png'; up(Image.open(own).convert('RGBA'), 4, bg=(120, 124, 130, 255)).save(os.path.join(b, fn)); pk.append(fn + ' (같은 항목 이전에 고른 것)')
    L = ledger(); rej = [r for r in L['rejects'] if r['item'] == item]
    md = [f'# {it["title"]} — 작업지시서', '', f'- 항목 `{item}` · 종류 `{it["kind"]}` · 묶음 `{it["wave"]}` · 설명: {it["desc"]}', f'- 캔버스 **{w}x{h}** ({it["size"][0]}x{it["size"][1]}칸, `@cell 16`) · 통행 의도: **{it.get("walk", "solid")}** {it.get("walk_note", "")}', '',
          '## 그림 (전부 Read 로 연다)', '- `scale-x8.png` — 1칸=16px=1m 눈금, 사람 키 24px 상자, 문 높이 28~30px 눈금. **사람 그림은 그리지 않는다.**']
    if it.get('slots') or it.get('cells'): md.append('- `layout-x6.png` — **자리 표**: 슬롯/칸 이름과 통행 색(빨강=막힘 · 초록=걸음 · 노랑=위로 지나감). 자리 밖에는 아무것도 칠하지 않는다.')
    for fn, caution, lab in an: md.append(f'- `{fn}` — {caution}')
    for fn in pk: md.append(f'- `{fn}` — 사용자가 이미 고른 그림(같은 modern3 팔레트·화풍의 이웃). 방향 D 의 기준.')
    md += ['', '## 항목 지시', it['brief']]
    if it.get('cells'):
        md += ['', '## 칸 표 (이름 · 자리 · 통행)'] + [f'- `{n}` ({c["x"]},{c["y"]}) {c.get("walk", "solid")}{" · repeat " + c["repeat"] if c.get("repeat") else ""}{" · 불투명" if c.get("opaque") else ""} — {c.get("desc", "")}' for n, c in it['cells'].items()]
        md += ['', '## 조립 예 (검수자는 이 조립 결과를 본다 — **모든 예에서 좋아 보여야 한다**)'] + [f'- `{n}`: ' + ' / '.join(' '.join(r) for r in ex['grid']) for n, ex in it['examples'].items()]
    if it.get('slots'): md += ['', '## 슬롯 표'] + [f'- `{sl["id"]}` 칸 ({sl["x"]},{sl["y"]}) {sl["w"]}x{sl["h"]}칸 · {sl.get("walk", "solid")} — {sl.get("desc", "")}' for sl in it['slots']]
    for f in ('style-common.md', f'style-{it["kind"]}.md'): md += ['', open(os.path.join(HERE, f), encoding='utf-8').read()]
    md += ['', '## 팔레트 — modern3 (이 밖의 색 금지, 반투명 금지)', '`palette.pal` 의 램프를 `@mat` 로 글자에 묶어 쓴다. 파일 머리에 아래 줄을 그대로 붙여 넣는다:', '```', PAL.mats_snippet(), '```', '', PAL.legend(), '',
           '- 윤곽 = 그 재료 램프의 **단 0 또는 1**(가장 어두운 쪽) 또는 `sumi`. 빛은 왼쪽 위, 그림자는 오른쪽 아래, 그림자는 같은 램프의 낮은 단으로 구운 **불투명** 색이다.', '- 실루엣 단계에서만 마커 `#`(= #e040c0)를 쓴다. 최종본에는 남기지 않는다.']
    if rej: md += ['', '## 하지 말 것 (사용자가 버린 후보와 이유)'] + [f'- {r["why"]}' for r in rej]
    if note: md += ['', '## 사용자 메모', note]
    open(os.path.join(b, 'brief.md'), 'w', encoding='utf-8').write('\n'.join(md) + '\n')
    return b


def worker_prompt(st, letter, redraw=''):
    it = item_of(st['item']); w, h = dims(st['item'])
    t = open(os.path.join(HERE, 'prompt.md'), encoding='utf-8').read()
    folder = os.path.relpath(rdir(st['id']), ROOT)
    rep = dict(ROOT=ROOT, ITEM=st['item'], TITLE=it['title'], DESC=it['desc'], W=w, H=h, CW=it['size'][0], CH=it['size'][1], BRIEF=os.path.join(rdir(st['id']), 'brief'),
               LETTER=letter, DIRECTION=directions(st['item'])[letter], FOLDER=folder, KINDNOTE=it['brief'], ITEMKIND=it['kind'], OUT=letter, REDRAW=redraw, WALK=it.get('walk', 'solid'),
               PAL=os.path.relpath(os.path.join(DATA, 'palette.pal'), rdir(st['id'])))
    for k, val in rep.items(): t = t.replace('{' + k + '}', str(val))
    return t


def run_claude(prompt, log, effort):
    env = dict(os.environ, PH_PROMPT=prompt, PH_CLAUDE=claude_bin(), PH_MODEL=MODEL, PH_EFFORT=effort)
    cmd = ['bash', '-lc', 'exec "$PH_CLAUDE" -p "$PH_PROMPT" --model "$PH_MODEL" --effort "$PH_EFFORT" --dangerously-skip-permissions --output-format text']
    with open(log, 'w') as f:
        p = subprocess.Popen(cmd, cwd=ROOT, env=env, stdout=f, stderr=subprocess.STDOUT, stdin=subprocess.DEVNULL, start_new_session=True, text=True)
        try: return p.wait(timeout=TIMEOUT)
        except subprocess.TimeoutExpired:
            os.killpg(p.pid, 15); return 'timeout'


def check(st, letter):
    base = os.path.join(rdir(st['id']), letter)
    r = subprocess.run([sys.executable, os.path.join(HERE, 'check.py'), base + '.pxg', '--item', st['item']], cwd=ROOT, capture_output=True, text=True)
    try: return json.load(open(base + '.check.json'))
    except Exception: return {'ok': False, 'hard': [(r.stdout + r.stderr)[-400:]], 'soft': {}}


def review_pack(st, letter, att):
    item = st['item']; it = item_of(item); pack = os.path.join(rdir(st['id']), 'brief', 'review', f'{letter}-a{att}'); os.makedirs(pack, exist_ok=True)
    cand = Image.open(os.path.join(rdir(st['id']), letter + '.png')).convert('RGBA'); anch = seed().get('anchors', {})
    up(cand).save(os.path.join(pack, 'cand-x8.png'))
    parts = []
    for r in it.get('refs', []):
        if r.startswith(('prop:', 'cand:')):
            _, im, _, _ = ANC.resolve(r, anch)
            if im is not None: parts.append(up(im))
    parts = parts[:3] + [up(cand)]; Wd = sum(p.width for p in parts) + 24 * (len(parts) - 1); Hd = max(p.height for p in parts)
    pair = Image.new('RGBA', (Wd, Hd), GRAY); x = 0
    for p in parts: pair.alpha_composite(p, (x, Hd - p.height)); x += p.width + 24
    pair.save(os.path.join(pack, 'pair-x8.png'))
    for r in it.get('refs', []):
        if r.startswith('anchor:'):
            _, im, _, _ = ANC.resolve(r, anch)
            if im is not None: up(im, 3, bg=(120, 124, 130, 255)).save(os.path.join(pack, 'district-ref-x3.png')); break
    name = 'street-x3.png'
    if it['kind'] == 'kit': compose_kit(item, cand).save(os.path.join(pack, 'kit-x3.png')); name = 'kit-x3.png'
    elif it['kind'] == 'tilesheet': tile_repeat(item, cand).save(os.path.join(pack, name))
    else: object_context(item, cand).save(os.path.join(pack, name))
    shutil.copyfile(os.path.join(pack, name), os.path.join(rdir(st['id']), letter + '.ctx.png'))
    return pack, name


def review_prompt(st, letter, att, prev):
    pack, ctxname = review_pack(st, letter, att)
    it = item_of(st['item']); t = open(os.path.join(HERE, 'review.md'), encoding='utf-8').read()
    pk = picked_pngs(exclude=st['item'])
    rep = dict(ROOT=ROOT, ITEM=st['item'], TITLE=it['title'], KIND=it['kind'], CAND=os.path.join(rdir(st['id']), letter + '.png'), ATTEMPT=att, MAX=MAX_ATTEMPTS,
               LETTER=letter, DIRECTION=directions(st['item'])[letter], PACK=pack, CTX=ctxname, KINDNOTE=it['brief'], WALK=it.get('walk', 'solid'),
               CRITERIA=open(os.path.join(HERE, 'criteria-' + it['kind'] + '.md'), encoding='utf-8').read(),
               PICKED=('6. 사용자가 이미 고른 이웃 그림(화풍 기준): ' + ', '.join(os.path.relpath(p, ROOT) for p in pk[:4])) if pk else '',
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
                if os.path.exists(out + ext): shutil.copyfile(out + ext, f'{out}.a{att - 1}{ext}')
            redraw = (f'\n**다시 그리기 ({att}/{MAX_ATTEMPTS})**: `{os.path.relpath(out, ROOT)}.pxg` 가 지난 시도다. 복사하지 말고 그 파일을 고쳐 다시 굽는다. 지난 시도의 지적:\n{prev}\n')
        run_claude(worker_prompt(st, letter, redraw), os.path.join(rdir(rid), 'logs', f'{letter}.a{att}.log'), EFFORT)
        if not os.path.exists(out + '.pxg'):
            upd(rid, letter, status='failed', error='후보 파일 없음'); return
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
            run_claude(rp, os.path.join(rdir(rid), 'logs', f'{letter}.a{att}.review.log'), EFFORT)
            if os.path.exists(vfile): break
        try: v = json.load(open(vfile, encoding='utf-8')); v['verdict'] = str(v.get('verdict', '')).upper()
        except Exception: v = dict(verdict='ERROR', reasons='검수자가 결과를 못 냈다')
        v['attempt'] = att; hist.append(dict(stage='review', attempt=att, review=v)); upd(rid, letter, history=hist, review=v)
        if v['verdict'] in ('PASS', 'ERROR') or att == MAX_ATTEMPTS:
            upd(rid, letter, status='done', ok=v['verdict'] == 'PASS'); return
        prev = f'검수 불합격 {v.get("codes")}: {v.get("reasons")}\n고칠 것: {v.get("fix")}'
    upd(rid, letter, status='done', ok=False)


# ------------------------------------------------------------------ 명령
def cmd_palette(a=None):
    os.makedirs(DATA, exist_ok=True); PAL.write_pal(os.path.join(DATA, 'palette.pal')); PAL.write_mats(os.path.join(DATA, 'mats.txt'))
    print(f'램프 {len(PAL.ramps())}개 · 색 {len(PAL.all_colors())}개 → harness-data/jp-city/palette.pal, mats.txt')


def validate_seed(verbose=True):
    s = seed(); errs = []; anch = s.get('anchors', {}); ctx = s.get('context', {})
    for k, nm in ctx.items():
        if nm not in ANC._catalog()['names']: errs.append(f'context {k}: 카탈로그에 {nm} 없음')
    for iid, it in s['items'].items():
        for key in ('kind', 'wave', 'title', 'desc', 'brief', 'size', 'walk', 'refs'):
            if key not in it: errs.append(f'{iid}: {key} 없음')
        if it.get('kind') not in ('building-part', 'prop', 'tilesheet', 'kit'): errs.append(f'{iid}: kind {it.get("kind")}')
        if it.get('walk') not in ('solid', 'walk', 'star', 'mixed'): errs.append(f'{iid}: walk {it.get("walk")}')
        cw, ch = it.get('size', [0, 0])
        if it.get('ground') and it['ground'] not in ctx: errs.append(f'{iid}: ground {it["ground"]} 가 context 에 없음')
        for sl in it.get('slots') or []:
            if sl['x'] + sl['w'] > cw or sl['y'] + sl['h'] > ch: errs.append(f'{iid}: 슬롯 {sl["id"]} 이 캔버스 밖')
        seen = {}
        for n, c in (it.get('cells') or {}).items():
            if not (0 <= c['x'] < cw and 0 <= c['y'] < ch): errs.append(f'{iid}: 칸 {n} 이 캔버스 밖')
            if (c['x'], c['y']) in seen: errs.append(f'{iid}: 칸 {n} 과 {seen[(c["x"], c["y"])]} 자리 겹침')
            seen[(c['x'], c['y'])] = n
        if it.get('kind') == 'kit':
            if not it.get('cells') or not it.get('examples'): errs.append(f'{iid}: kit 인데 cells/examples 없음')
            for en, ex in (it.get('examples') or {}).items():
                for r in ex['grid']:
                    for nm in r:
                        if nm != '.' and nm not in it['cells']: errs.append(f'{iid}: 예 {en} 의 칸 {nm} 이 cells 에 없음')
                if ex.get('base'):
                    for r in ex['base']:
                        for nm in r:
                            if nm != '.' and nm not in ctx: errs.append(f'{iid}: 예 {en} base {nm} 가 context 에 없음')
                    if len(ex['base']) != len(ex['grid']) or len(ex['base'][0]) != len(ex['grid'][0]): errs.append(f'{iid}: 예 {en} base 크기가 grid 와 다름')
        if it.get('kind') == 'tilesheet':
            for i in it.get('seamless_cells', []):
                if i >= cw * ch: errs.append(f'{iid}: seamless_cells {i} 범위 밖')
        for r in it.get('refs', []):
            lab, im, _, _ = ANC.resolve(r, anch)
            if im is None: errs.append(f'{iid}: 참고 그림 못 품 {r}')
    if verbose: print('시드 점검: 항목 %d개, 오류 %d' % (len(s['items']), len(errs)), *errs, sep='\n  ' if errs else '')
    return errs


def cmd_validate(a): sys.exit(1 if validate_seed() else 0)


def cmd_list(a):
    s = seed(); picked = {os.path.splitext(os.path.basename(p))[0] for p in glob.glob(os.path.join(DATA, 'picked', '*.png'))}; waves = {}
    for iid, it in s['items'].items(): waves.setdefault(it['wave'], []).append((iid, it))
    for wv, lst in waves.items():
        if a.wave and wv != a.wave: continue
        print(f'[{wv}] {len(lst)}개')
        for iid, it in lst: print(f'  {"★" if iid in picked else " "} {iid:22} {it["kind"]:13} {it["size"][0]}x{it["size"][1]}칸 {it["walk"]:6} {it["title"]}')


def cmd_anchors(a):
    d = os.path.join(DATA, 'anchors'); os.makedirs(d, exist_ok=True); anch = seed().get('anchors', {})
    for n in anch:
        _, im, _, _ = ANC.resolve('anchor:' + n, anch); im.save(os.path.join(d, n + '.png'))
    print(f'{len(anch)}개 → harness-data/jp-city/anchors/')


def cmd_draw(a):
    item_of(a.item)
    if validate_seed(False): sys.exit('시드 오류: harness.py validate')
    rid = 'j' + datetime.datetime.now().strftime('%m%d-%H%M%S'); os.makedirs(os.path.join(rdir(rid), 'logs'), exist_ok=True)
    cmd_palette()
    make_brief(rid, a.item, a.note)
    letters = LETTERS[:a.n]
    json.dump(dict(id=rid, item=a.item, note=a.note, created=now(), cands={l: dict(status='queued') for l in letters}), open(state_path(rid), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
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
        print(f'{rid} {st["item"]} {"끝" if st.get("ended") else "진행"}')
        for l, c in st['cands'].items():
            v = c.get('review') or {}
            print(f'  {l} {c.get("status")} 시도{c.get("attempt", "-")} {"✓" if c.get("ok") else "✗" if c.get("ok") is False else " "} {v.get("verdict", "")} {v.get("codes", "") or ""}')


def b64png(im):
    buf = io.BytesIO(); im.save(buf, 'PNG'); return 'data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode()


def cmd_sheet(a):
    st = load_state(a.round); rid = a.round; os.makedirs(VIZ, exist_ok=True); item = st['item']; it = item_of(item); anch = seed().get('anchors', {})
    def img(im, k=6): return b64png(im.resize((im.width * k, im.height * k), Image.NEAREST))
    refs = []
    for r in it.get('refs', []):
        lab, im, caution, k = ANC.resolve(r, anch)
        if im is not None: refs.append((f'참고: {lab}', img(im, min(k, 3 if im.width > 200 else 4)), caution))
    cards = []
    for l, c in st['cands'].items():
        p = os.path.join(rdir(rid), l + '.png')
        if not os.path.exists(p): continue
        v = c.get('review') or {}; ck = c.get('check') or {}
        tag = ('✓ 검수 통과' if c.get('ok') else '✗ ' + (v.get('verdict', '미통과')) + ' ' + ','.join(v.get('codes') or []))
        why = (v.get('surfaces') or '') + (' · ' + v.get('reasons', '') if not c.get('ok') else '')
        note = open(os.path.join(rdir(rid), l + '.note'), encoding='utf-8').read().strip() if os.path.exists(os.path.join(rdir(rid), l + '.note')) else ''
        ctxp = os.path.join(rdir(rid), l + '.ctx.png')
        cards.append((f'{l}  {directions(item)[l].split(" — ")[0]}  [{tag}]', img(Image.open(p).convert('RGBA')),
                      (note + '\n' + why + ('\n기계검사: ' + '; '.join(ck.get('hard') or []) if ck.get('hard') else '')).strip(), b64png(Image.open(ctxp)) if os.path.exists(ctxp) else ''))
    html = ['<!doctype html><meta charset=utf-8><title>jp-city 후보 ' + rid + '</title><style>body{background:#2a2d31;color:#eee;font:14px sans-serif;margin:16px}'
            '.r{display:flex;flex-wrap:wrap;gap:20px;align-items:flex-end;background:#969aa0;padding:14px;border-radius:6px;margin-bottom:12px}figure{margin:0;max-width:760px}figcaption{color:#111;font-size:13px;margin:4px 0}'
            'img{image-rendering:pixelated;display:block;max-width:100%}small{color:#222;display:block;max-width:560px;white-space:pre-wrap}h4{margin:10px 0 4px}</style>',
            f'<h3>{item} · {it["title"]} · {it["size"][0]}x{it["size"][1]}칸 · 묶음 {it["wave"]} · 판 {rid}</h3><p>{it["desc"]} — 통행 {it["walk"]} {it.get("walk_note", "")}</p>']
    if refs:
        html.append('<h4>참고(눈으로만)</h4><div class=r>' + ''.join(f'<figure><figcaption>{c}</figcaption><img src="{s}"><small>{m}</small></figure>' for c, s, m in refs) + '</div>')
    html.append('<h4>후보 (6배)</h4><div class=r>')
    for cap, src, sm, _ in cards: html.append(f'<figure><figcaption>{cap}</figcaption><img src="{src}"><small>{sm}</small></figure>')
    html.append('</div>')
    if any(c[3] for c in cards):
        html.append('<h4>맥락 / 조립 (3배 — ' + ('조립 예와 통행' if it['kind'] == 'kit' else '4×4 반복' if it['kind'] == 'tilesheet' else '땅 위, 이웃 조각 옆') + ')</h4><div class=r>')
        for cap, _, _, ctx in cards:
            if ctx: html.append(f'<figure><figcaption>{cap.split("  [")[0]}</figcaption><img src="{ctx}"></figure>')
        html.append('</div>')
    html.append('<p>고르면: <code>harness.py pick ' + rid + ' &lt;글자&gt;</code> — 버리면 <code>reject ' + rid + ' &lt;글자&gt; --why …</code></p>')
    open(os.path.join(VIZ, f'jp-{rid}.html'), 'w', encoding='utf-8').write('\n'.join(html))
    print(f'http://mdc-server:18301/jp-{rid}.html')


def cmd_pick(a):
    st = load_state(a.round); os.makedirs(os.path.join(DATA, 'picked'), exist_ok=True); item = st['item']
    shutil.copyfile(os.path.join(rdir(a.round), a.letter + '.png'), os.path.join(DATA, 'picked', f'{item}.png'))
    # picked/*.pxg 가 그 자리에서 다시 렌더되게 `@palette` 를 같은 폴더의 palette.pal 로 고쳐 복사한다(작업자 파일은 판 폴더 기준 상대 경로라 그대로는 깨진다)
    lines = open(os.path.join(rdir(a.round), a.letter + '.pxg'), encoding='utf-8').read().split('\n')
    open(os.path.join(DATA, 'picked', f'{item}.pxg'), 'w', encoding='utf-8').write('\n'.join('@palette palette.pal' if l.strip().startswith('@palette') else l for l in lines))
    shutil.copyfile(os.path.join(DATA, 'palette.pal'), os.path.join(DATA, 'picked', 'palette.pal'))
    L = ledger(); L['picks'].append(dict(round=a.round, letter=a.letter, item=item, note=a.note, at=now(), by='user')); save_ledger(L)
    print('기록: harness-data/jp-city/picked/' + item + '.pxg')


def cmd_reject(a):
    st = load_state(a.round); L = ledger()
    L['rejects'].append(dict(round=a.round, letter=a.letter, item=st['item'], why=a.why, at=now())); save_ledger(L); print('기록')


def main():
    ap = argparse.ArgumentParser()
    sp = ap.add_subparsers(dest='cmd', required=True)
    sp.add_parser('palette'); sp.add_parser('validate'); sp.add_parser('anchors')
    li = sp.add_parser('list'); li.add_argument('--wave', default='')
    d = sp.add_parser('draw'); d.add_argument('item'); d.add_argument('--n', type=int, default=5); d.add_argument('--note', default=''); d.add_argument('--fg', action='store_true')
    r = sp.add_parser('_run'); r.add_argument('round')
    s = sp.add_parser('status'); s.add_argument('round', nargs='?')
    for n in ('sheet', 'review'): x = sp.add_parser(n); x.add_argument('round')
    p = sp.add_parser('pick'); p.add_argument('round'); p.add_argument('letter'); p.add_argument('--note', default='')
    j = sp.add_parser('reject'); j.add_argument('round'); j.add_argument('letter'); j.add_argument('--why', required=True)
    a = ap.parse_args()
    {'palette': lambda: cmd_palette(a), 'validate': lambda: cmd_validate(a), 'anchors': lambda: cmd_anchors(a), 'list': lambda: cmd_list(a), 'draw': lambda: cmd_draw(a), '_run': lambda: run_round(a.round),
     'status': lambda: cmd_status(a), 'sheet': lambda: cmd_sheet(a), 'review': lambda: cmd_review(a), 'pick': lambda: cmd_pick(a), 'reject': lambda: cmd_reject(a)}[a.cmd]()


if __name__ == '__main__': main()

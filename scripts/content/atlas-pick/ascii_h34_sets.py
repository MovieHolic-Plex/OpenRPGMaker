"""H 방법을 세트별(jp·school·horror) 상자 물건에 돌린다: Tibo 3/4 생성 → C(세트 팔레트·10색·글자=픽셀) → E(Sonnet 손질) → .pxg.

ascii_h34.py(modern3 전용)를 일반화한 것이다. 생성 그림은 원본일 뿐이고 최종물은 C·E 를 거친 도트다.
새 후보 h34-A 만 만든다(기존 후보는 덮어쓰지 않는다).

  python3 scripts/content/atlas-pick/ascii_h34_sets.py frame <세트>
  python3 scripts/content/atlas-pick/ascii_h34_sets.py gen <세트> <장수> <라운드>       # h-method/<세트>/raw/
  python3 scripts/content/atlas-pick/ascii_h34_sets.py c <세트> <원본.png>              # h-method/<세트>/work/
  python3 scripts/content/atlas-pick/ascii_h34_sets.py e <세트> [슬러그...]              # claude -p sonnet
  python3 scripts/content/atlas-pick/ascii_h34_sets.py emit <세트> [슬러그...]          # candidates-<세트>/<슬러그>/h34-A.*
"""
import json, os, re, subprocess, sys, time
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).parent))
import ascii_pixelize as ap  # noqa: E402
import bakeoff_c as bc  # noqa: E402
from ascii_post import to_img, zoom_grid, hexrgb, PROMPT as BASE  # noqa: E402
from pxg_emit import emit as pxg_emit  # noqa: E402

ROOT = ap.ROOT
HM = ROOT / 'tiledata/atlas-pick/h-method'
K = 4
SHEET = (448, 256)
TOP, FRONT = (224, 224, 224), (150, 150, 150)

# slug: content(w,h) 목표 그림 크기, canvas 후보 캔버스, mb 바닥 여백, T 윗면 두께(목표 px), sc 틀 배율,
#       x 틀 안 상자 왼쪽(@1x), desc 생성 지시, note 한 줄
SETS = {
    'jp': {
        'style': ("Crisp pixel art game asset, 32px-tile top-down 3/4 JRPG city style (Japanese city street in front of a station): the camera looks slightly down, "
                  "objects show a flat lighter top surface and a front face facing the viewer, no perspective convergence. Light from the upper left. "
                  "Each face has 3-4 distinct tone steps, 1px dark blue-violet outline only where a light face meets a dark one. "
                  "Low saturation: muted lilac-gray shadows, warm apricot highlights, no pure black or white, no gradients, no anti-aliasing."),
        'e_theme': '현대 일본 도심 RPG 맵 소품(역 앞 번화가, 채도 낮게)',
        'cls': 'prop',
        'bottom': 176,
        'items': {
            'vending_drink': dict(content=(22, 29), canvas=(32, 32), mb=1, T=7, sc=3, x=92,
                                  desc='a white-bodied Japanese drink vending machine: light lid top face seen from above, front face with a large bright glass product window showing three rows of small coloured cans and bottles with tiny price dots, then a coin slot, a row of buttons and a dark dispensing slot at the bottom',
                                  note='음료 자판기 H 방법 — Tibo 3/4 생성 → C(jp 팔레트 10색) → Sonnet 손질'),
            'vending_ice': dict(content=(22, 29), canvas=(32, 32), mb=1, T=7, sc=3, x=290,
                                desc='a Japanese ice-cream vending machine, cold white body: light lid top face seen from above, front face with a light sky-blue upper panel holding six small coloured ice-cream picture squares, below it a frosted coin slot and buttons and a dark dispensing slot',
                                note='아이스크림 자판기 H 방법 — Tibo 3/4 생성 → C(jp 팔레트 10색) → Sonnet 손질'),
        },
    },
    'school': {
        'style': ("Crisp pixel art game asset, 16px-tile top-down 3/4 JRPG interior style: a bright Japanese school. The camera looks slightly down, "
                  "furniture shows a flat lighter top surface and a front face facing the viewer, no perspective convergence. Light from the upper left. "
                  "Cream walls, warm wooden floor, clean fresh colours with soft blue-gray metal; each face has 3-4 distinct tone steps, "
                  "thin dark outline only where a light face meets a dark one, no pure black or white, no gradients, no anti-aliasing."),
        'e_theme': '밝은 학교 실내 RPG 맵 가구(교실·과학실, 깨끗한 색)',
        'cls': 'wall-tall',
        'bottom': 176,
        'items': {
            'locker_row': dict(content=(30, 30), canvas=(32, 32), mb=0, T=5, sc=3, x=70,
                               desc='a classroom back-wall locker unit of blue-gray metal: light top face seen from above, front face with two tiers of four narrow doors, each door with vent slits, a small handle dot and a tiny white number tag; one door has a bag strap peeking out',
                               note='교실 사물함 H 방법 — Tibo 3/4 생성 → C(school 팔레트 10색) → Sonnet 손질'),
            'lab_cabinet': dict(content=(28, 31), canvas=(32, 32), mb=0, T=5, sc=3, x=278,
                                desc='a cream-coloured science-lab cabinet: light top face seen from above, front face with two glass doors above showing brown and clear bottles on two shelves, and two closed wooden doors below with small brass knobs',
                                note='약품장 H 방법 — Tibo 3/4 생성 → C(school 팔레트 10색) → Sonnet 손질'),
        },
    },
    'horror': {
        'style': ("Crisp pixel art game asset, 16px-tile top-down 3/4 JRPG interior style, in the mood of Ib and The Witch's House: an old dark Western mansion. "
                  "The camera looks slightly down, furniture shows a flat lighter top surface (with a film of dust) and a front face facing the viewer, no perspective convergence. "
                  "Light from the upper left, very dim. Desaturated dark mahogany browns, muted plum and grave-gray, tarnished green brass; each face has 3-4 distinct tone steps, "
                  "no gradients, no anti-aliasing, no bright colours, no outline glow."),
        'e_theme': '어두운 낡은 서양 저택 호러 RPG 맵 가구(Ib·마녀의 집 분위기, 채도 낮게)',
        'cls': 'wall-tall',
        'bottom': 196,
        'items': {
            'wardrobe_ajar': dict(content=(14, 30), canvas=(16, 32), mb=1, T=5, sc=4, x=110,
                                  desc='a tall dark mahogany two-door wardrobe of an old mansion: dusty lighter top face seen from above, front face with two panelled doors, the right door slightly ajar showing a pitch-black vertical gap, tarnished green-brass door knobs',
                                  note='반쯤 열린 옷장 H 방법 — Tibo 3/4 생성 → C(horror 팔레트 10색) → Sonnet 손질'),
            'dresser': dict(content=(16, 15), canvas=(16, 16), mb=1, T=5, sc=4, x=250,
                            desc='a low dark mahogany chest of drawers of an old mansion: dusty lighter top face seen from above, front face with three drawers each with two tarnished brass knobs, short legs',
                            note='서랍장 H 방법 — Tibo 3/4 생성 → C(horror 팔레트 10색) → Sonnet 손질'),
        },
    },
}

# ── 표준(§12 실제 비율) 모드: H34_STD=1 → 후보 h34-B, 작업 폴더 *-std, 그림 크기는 주인공 16x24 기준 표에서.
# content = (폭px, F+T), T = 윗면 두께(px), canvas = 칸수x16. 틀 상자는 이 비율 그대로다.
STD = os.environ.get('H34_STD') == '1'
TAG = 'h34-B' if STD else 'h34-A'
SFX = '-std' if STD else ''
# §12(1칸=16px=1m) 표준 크기. content = 그림 몸통(폭, F+T), T = 윗면 두께(압축값). size_calc.py 표와 같은 숫자.
STD_SIZES = {
    'vending_drink': dict(content=(16, 32), canvas=(16, 32), mb=0, T=4, sc=4),   # 1.0x0.8x1.8: F28 T4(원본 T 13)
    'vending_ice': dict(content=(16, 32), canvas=(16, 32), mb=0, T=4, sc=4),
    'locker_row': dict(content=(29, 32), canvas=(32, 32), mb=0, T=4, sc=4),      # 1.8x0.5x1.8: F28 T4(원본 T 8)
    'lab_cabinet': dict(content=(24, 32), canvas=(32, 32), mb=0, T=4, sc=4),     # 1.5x0.45x1.8: F28 T4(원본 T 7)
    'wardrobe_ajar': dict(content=(16, 32), canvas=(16, 32), mb=0, T=4, sc=4),   # 1.0x0.6x2.0: F28 T4(원본 F32 T10)
    'dresser': dict(content=(16, 21), canvas=(16, 32), mb=0, T=5, sc=4),         # 1.0x0.5x1.0: F16 T5(원본 T 8)
}
if STD:
    for _s in SETS.values():
        for _n, _it in _s['items'].items():
            _it.update(STD_SIZES[_n])

CORE = ("EDIT TASK. The reference is a flat gray SPRITE-SHEET FRAME on a magenta #FF00FF background: each gray box marks where ONE separate game sprite goes. "
        "In every box the LIGHT gray upper band is the object's TOP SURFACE seen from above and the MEDIUM gray lower part is its FRONT FACE below it. "
        "PAINT each box as a finished pixel-art sprite in top-down 3/4 view JRPG map sprite (RPG Maker style): the object shows its top surface seen from above AND its front face below; "
        "NO side faces (at most a 1px darker right edge); light from the top-left, so the top surface is the LIGHTEST tone. "
        "Keep the top band and the front part at the sizes the frame gives; never draw a flat front elevation without a top surface. "
        "EVERY sprite must FILL its gray box completely, touching all four edges of the box (the box IS the sprite's bounding box; no empty gray margin around it). "
        "The top band must be painted with the object's real TOP SURFACE (lid, cap, top board) as a lighter tone, clearly separated from the darker front face. "
        "Look at the object as if the camera is high above and in front, tilted down about 45 degrees: the top is seen as a thick lighter surface, at least a quarter as tall as the front face. "
        "Do NOT copy the gray band colors themselves and do NOT leave any gray band unpainted. "
        "Keep everything between boxes flat magenta #FF00FF (no shadows on the ground, no ground), and inside each box keep the empty background flat medium gray. ")

ROUND_EXTRA = {
    'r1': '',
    'r2': ' IMPORTANT: make the lighter TOP surface clearly readable as a flat plane seen from above, with a distinct light edge highlight along its front rim, and keep the front face strictly frontal (no perspective on the front).',
    'r3': ' IMPORTANT: chunky low-resolution pixel art with big clean pixels, flat tone steps only, top plane light, front face medium, tiny details simple.',
}


def cfg(s):
    return SETS[s]


def slugs(s):
    return list(SETS[s]['items'])


def hdir(s):
    d = HM / s
    (d / ('raw' + SFX)).mkdir(parents=True, exist_ok=True)
    (d / ('work' + SFX)).mkdir(parents=True, exist_ok=True)
    return d


def cand(s, slug):
    return ROOT / 'tiledata/atlas-pick' / f'candidates-{s}' / slug


def load_pal(s):
    """@rampc 팔레트 → [(rgb, ramp, tone)]; 같은 색은 처음 나온 램프. 한 글자 반투명색(~ - % …)은 제외."""
    p = cand(s, slugs(s)[0]) / 'palette.pal'
    seen, out = {}, []
    for line in p.read_text(encoding='utf-8').splitlines():
        m = re.match(r'@rampc\s+(\S+)\s+(.*)', line)
        if not m:
            continue
        for i, h in enumerate(re.findall(r'#[0-9a-fA-F]{6}', m.group(2))):
            rgb = tuple(int(h[j:j + 2], 16) for j in (1, 3, 5))
            if rgb not in seen:
                seen[rgb] = (m.group(1), i); out.append(rgb)
    return sorted(out), seen


def frame_geom(s):
    """각 물건의 틀 상자(@1x)."""
    c = cfg(s); g = {}
    for n, it in c['items'].items():
        w, h = it['content']; sc = it['sc']
        g[n] = (it['x'], c['bottom'] - h * sc, it['x'] + w * sc, c['bottom'], it['T'] * sc)
    return g


def make_frame(s):
    d = hdir(s)
    im = Image.new('RGB', SHEET, bc.MAG)
    dr = ImageDraw.Draw(im)
    for n, (x0, y0, x1, y1, t) in frame_geom(s).items():
        dr.rectangle([x0, y0, x1 - 1, y0 + t - 1], fill=TOP)
        dr.rectangle([x0, y0 + t, x1 - 1, y1 - 1], fill=FRONT)
    big = im.resize((SHEET[0] * K, SHEET[1] * K), Image.NEAREST)
    big.save(d / f'frame{SFX}.png'); im.save(d / f'frame1x{SFX}.png')


def prompt(s, rnd):
    c = cfg(s)
    core = CORE
    if STD:  # 실제 비율은 윗면이 얇다(T 4~6px). 「앞면의 1/4 이상」 문구는 틀과 어긋나므로 뺀다.
        core = core.replace("the top is seen as a thick lighter surface, at least a quarter as tall as the front face. ",
                            "the top is seen as a thin lighter surface exactly as thick as the light gray band in the frame. ")
    parts = [f"({i + 1}, left to right) {it['desc']}" for i, it in enumerate(sorted(c['items'].values(), key=lambda v: v['x']))]
    return core + c['style'] + ROUND_EXTRA.get(rnd, '') + ' Sprites in frame order: ' + '; '.join(parts) + '. No text, no logos, no people.'


def order(s):
    return sorted(slugs(s), key=lambda n: cfg(s)['items'][n]['x'])


def gen(s, n, rnd):
    d = hdir(s); make_frame(s)
    p = prompt(s, rnd)
    (d / f'prompt{SFX}-{rnd}.txt').write_text(p + '\n', encoding='utf-8')

    def one(i):
        out = d / ('raw' + SFX) / f'{rnd}-{i}.png'
        ok, dt, err = bc.tibo(p, str(d / f'frame{SFX}.png'), str(out), 'sunburst')
        print(s, rnd, i, 'ok' if ok else 'FAIL', '%.0fs' % dt, err or '', flush=True)
        with open(d / ('raw' + SFX) / 'gen-log.jsonl', 'a') as f:
            f.write(json.dumps(dict(set=s, round=rnd, i=i, ok=ok, sec=round(dt), model='sunburst', err=str(err) if err else None,
                                    t=time.strftime('%F %T'))) + '\n')
    with ThreadPoolExecutor(n) as ex:
        list(ex.map(one, range(1, n + 1)))


def boxes_lr(im):
    return sorted(ap.boxes(im), key=lambda b: b[0])


def flood_mask(crop, tol=30):
    from collections import deque
    w, h = crop.size; px = crop.load()
    def gray(c): return max(c) - min(c) < 22
    def mag(c): return c[0] > 190 and c[2] > 190 and c[1] < min(c[0], c[2]) - 40
    border = [px[x, y] for x in range(w) for y in (0, h - 1)] + [px[x, y] for y in range(h) for x in (0, w - 1)]
    q = Counter((c[0] // 6, c[1] // 6, c[2] // 6) for c in border if gray(c))
    tones = []
    for k, _ in q.most_common(8):
        c = tuple(v * 6 + 3 for v in k)
        if all(sum((a - b) ** 2 for a, b in zip(c, t)) > 24 ** 2 for t in tones):
            tones.append(c)
        if len(tones) == 3: break
    def is_bg(c):
        if mag(c): return True
        return gray(c) and any(sum((a - b) ** 2 for a, b in zip(c, t)) <= tol * tol for t in tones)
    bgm = [[False] * w for _ in range(h)]
    dq = deque()
    for x in range(w):
        for y in (0, h - 1):
            if is_bg(px[x, y]) and not bgm[y][x]: bgm[y][x] = True; dq.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            if is_bg(px[x, y]) and not bgm[y][x]: bgm[y][x] = True; dq.append((x, y))
    while dq:
        x, y = dq.popleft()
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < w and 0 <= ny < h and not bgm[ny][nx] and is_bg(px[nx, ny]):
                bgm[ny][nx] = True; dq.append((nx, ny))
    return [[not bgm[y][x] for x in range(w)] for y in range(h)], tones


def c_one(s, name, crop, pal):
    W = hdir(s) / ('work' + SFX)
    it = cfg(s)['items'][name]
    mask, _ = flood_mask(crop)
    x0, y0, x1, y1 = ap.tight(mask)
    crop = crop.crop((x0, y0, x1, y1)); mask = [r[x0:x1] for r in mask[y0:y1]]
    w, h = crop.size; tw, th = it['content']
    sc = min(tw / w, th / h)
    gw, gh = max(1, round(w * sc)), max(1, round(h * sc))
    ox, oy = (tw - gw) // 2, th - gh
    px = crop.load(); cache = {}
    q = [[ap.nearest(px[x, y], pal, cache) if mask[y][x] else None for x in range(w)] for y in range(h)]
    top = ap.pick_k(Counter(c for r in q for c in r if c), ap.K)
    q = [[(min(top, key=lambda p: ap.dist(c, p)) if c not in top else c) if c else None for c in r] for r in q]
    orde = sorted(top, key=ap.lum)
    ch = {c: ap.CHARS[i] for i, c in enumerate(orde)}
    grid = [['.'] * tw for _ in range(th)]
    for gy in range(gh):
        for gx in range(gw):
            sx0, sx1 = int(gx * w / gw), max(int(gx * w / gw) + 1, int((gx + 1) * w / gw))
            sy0, sy1 = int(gy * h / gh), max(int(gy * h / gh) + 1, int((gy + 1) * h / gh))
            cnt = Counter(q[y][x] for y in range(sy0, sy1) for x in range(sx0, sx1))
            if sum(v for c, v in cnt.items() if c) * 2 < sum(cnt.values()):
                continue
            grid[oy + gy][ox + gx] = ch[max((c for c in cnt if c), key=lambda c: cnt[c])]
    text = '\n'.join(''.join(r) for r in grid)
    legend = {v: '#%02x%02x%02x' % k for k, v in ch.items()}
    (W / f'{name}-c.txt').write_text(text + '\n', encoding='utf-8')
    to_img(text, legend).save(W / f'{name}-c.png')
    crop.save(W / f'{name}-src.png')
    return {'name': name, 'target': list(it['content']), 'src': [w, h], 'legend': legend, 'colors': len(top)}


def c_cmd(s, raw):
    d = hdir(s)
    pal, _ = load_pal(s)
    im = Image.open(raw).convert('RGB')
    bx = boxes_lr(im)
    o = order(s)
    assert len(bx) == len(o), (len(bx), bx)
    res = []
    for n, b in zip(o, bx):
        res.append(c_one(s, n, im.crop(b), pal))
        print(n, res[-1]['src'], res[-1]['target'], res[-1]['colors'])
    (d / ('work' + SFX) / 'c-result.json').write_text(json.dumps(res, ensure_ascii=False, indent=1), encoding='utf-8')
    Image.open(raw).save(d / f'raw-chosen{SFX}.png')


# ───────── E ─────────
def e_prompt(s, n, r):
    W = hdir(s) / ('work' + SFX)
    rel = lambda p: str(p.relative_to(ROOT))
    leg = ', '.join(f"'{k}'={v}" for k, v in sorted(r['legend'].items(), key=lambda kv: sum(hexrgb(kv[1]))))
    tw, th = r['target']
    txt = BASE.format(name=n, w=tw, h=th, src=rel(W / f'{n}-srcs.png'), zoom=rel(W / f'{n}-zoom.png'),
                      txt=rel(W / f'{n}-c.txt'), legend=leg, out=rel(W / f'{n}-post.txt'), notes=rel(W / f'{n}-notes.md'))
    txt = txt.replace('현대 도시 RPG 맵 소품', cfg(s)['e_theme'])
    return txt + "- 윗면(가장 밝은 단)과 앞면 구분을 지켜라. 윗면 띠를 앞면 색으로 덮거나 지우지 마라.\n"


def load_c(s):
    return json.loads((hdir(s) / ('work' + SFX) / 'c-result.json').read_text(encoding='utf-8'))


def e_prep(s, names=None):
    W = hdir(s) / ('work' + SFX); jobs = []
    for r in load_c(s):
        n = r['name']
        if names and n not in names:
            continue
        text = (W / f'{n}-c.txt').read_text(encoding='utf-8')
        zoom_grid(to_img(text, r['legend'])).save(W / f'{n}-zoom.png')
        im = Image.open(W / f'{n}-src.png'); im.thumbnail((360, 360)); im.save(W / f'{n}-srcs.png')
        (W / f'{n}-prompt.md').write_text(e_prompt(s, n, r), encoding='utf-8')
        jobs.append(n)
    return jobs


def shape_ok(s, n, path):
    tw, th = cfg(s)['items'][n]['content']
    if not path.exists():
        return False, 'no file'
    rows = path.read_text(encoding='utf-8').strip('\n').split('\n')
    if len(rows) != th or any(len(a) != tw for a in rows):
        return False, f'{len(rows)}줄 / 열 {sorted({len(a) for a in rows})} (기대 {th}줄 x {tw}열)'
    return True, ''


def e_run_one(s, n):
    W = hdir(s) / ('work' + SFX)
    p = (W / f'{n}-prompt.md').read_text(encoding='utf-8')
    post = W / f'{n}-post.txt'
    if post.exists(): post.unlink()
    cost, rcs = 0.0, []
    for attempt in range(2):
        r = subprocess.run(['claude', '-p', '--model', 'sonnet', '--effort', 'medium', '--allowedTools', 'Read,Write',
                            '--output-format', 'json', p], cwd=ROOT, capture_output=True, text=True, timeout=1800)
        tag = '' if attempt == 0 else '1'
        (W / f'{n}-run{tag}.json').write_text(r.stdout or r.stderr, encoding='utf-8')
        try: cost += json.loads(r.stdout).get('total_cost_usd') or 0
        except Exception: pass
        ok, why = shape_ok(s, n, post)
        rcs.append((r.returncode, ok, why))
        if ok: break
        if post.exists(): post.rename(W / f'{n}-post.bad{attempt}.txt')
        p += f"\n(직전 시도 실패: {why}. 이번에는 정확히 {cfg(s)['items'][n]['content'][1]}줄, 각 줄 정확히 {cfg(s)['items'][n]['content'][0]}글자로 쓰고 Write 뒤에 Read 로 줄·열 수를 확인하라.)\n"
    (W / f'{n}-cost.json').write_text(json.dumps({'cost_usd': cost, 'attempts': rcs}), encoding='utf-8')
    return n, rcs, cost


def e_cmd(s, names):
    jobs = e_prep(s, names)
    with ThreadPoolExecutor(len(jobs)) as ex:
        for n, rcs, cost in ex.map(lambda n: e_run_one(s, n), jobs):
            print(n, rcs, '$%.2f' % cost, flush=True)


# ───────── emit ─────────
def emit_cmd(s, names):
    W = hdir(s) / ('work' + SFX)
    _, seen = load_pal(s)
    c = cfg(s)
    out = []
    for r in load_c(s):
        n = r['name']
        if names and n not in names:
            continue
        it = c['items'][n]
        post = W / f'{n}-post.txt'
        ok, why = shape_ok(s, n, post)
        src = post if ok else W / f'{n}-c.txt'
        e_used = ok
        rows = src.read_text(encoding='utf-8').strip('\n').split('\n')
        tw, th = it['content']; cw, ch = it['canvas']
        ox = (cw - tw) // 2; oy = ch - th - it['mb']
        grid = [['.'] * cw for _ in range(ch)]
        for y, a in enumerate(rows):
            for x, chr_ in enumerate(a):
                grid[oy + y][ox + x] = chr_
        rws = [''.join(a) for a in grid]
        legend = {k: seen[hexrgb(v)] for k, v in r['legend'].items()}
        dst = cand(s, n)
        for ext in ('pxg', 'png', 'txt'):
            assert not (dst / f'{TAG}.{ext}').exists(), f'덮어쓰기 금지: {dst}/{TAG}.{ext}'
        (dst / f'{TAG}.pxg').write_text(pxg_emit(rws, legend, title=f'{n} {TAG} (H 방법: Tibo 3/4 → C → E)'), encoding='utf-8')
        (dst / f'{TAG}.txt').write_text('\n'.join(rws) + '\n', encoding='utf-8')
        (dst / f'{TAG}.note').write_text(it['note'] + (' — 실제 비율 표준 크기(§12)' if STD else '') + ('' if e_used else ' (E 실패 → C 그대로)') + '\n', encoding='utf-8')
        cp = subprocess.run(['python3', 'scripts/content/atlas-pick/check_candidate.py', '--set', s, str(dst / f'{TAG}.pxg')],
                            cwd=ROOT, capture_output=True, text=True)
        print(n, 'E' if e_used else 'C-only', (cp.stdout + cp.stderr).strip()[-300:])
        out.append({'name': n, 'e_used': e_used})
    return out


if __name__ == '__main__':
    cmd, s = sys.argv[1], sys.argv[2]
    if cmd == 'frame':
        make_frame(s)
    elif cmd == 'gen':
        gen(s, int(sys.argv[3]), sys.argv[4])
    elif cmd == 'c':
        c_cmd(s, sys.argv[3])
    elif cmd == 'e':
        e_cmd(s, sys.argv[3:] or None)
    elif cmd == 'emit':
        emit_cmd(s, sys.argv[3:] or None)

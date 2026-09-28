"""retro2003 2차 로스터(묶음 p2·p3) 이펙트 공용 모듈 — 2026-09-29.

lib_mage 의 인덱스 캔버스(Cel·Pal·검사)를 그대로 쓰고, 그 위에 글리프 도장·궤적·기둥·베기·마법진·낙하물 같은 조립 부품과
계약 검사·검토판(스테이지 합성)을 얹는다. 모든 도형은 정수 좌표 마스크(앤티앨리어싱·보간·외부 그림 없음), 페이드는 체커 디더뿐이다.

  · 시트는 @sheet(key, anchor, frame, frames, pal) 로 등록한다(직업 모듈 r2w3_<class>.py 가 한 직업의 시트 전부를 가진다).
  · 스킬 목록은 r2w3_skills.py 가 갖고, 묶음 파일(src/assets/retroRosterSkills/p2.ts·p3.ts)은 이 목록에서 생성한다.
  · 생성 전 묶음 파일의 frame·frames·anchor 를 읽어 등록값과 다르면 멈춘다(check_contract).
  · anchor 규약: target·user·allTargets·allAllies 64px 는 발 y=56 몸 중심 y≈40, screen 128 은 fade_oval, projectile 32 는 첫 칸이 왼쪽을 본다.

    python3 scripts/asset-gen/pixel-fx/r2w3_<class>.py               # 그 직업 시트 전부 + 검토판
    python3 scripts/asset-gen/pixel-fx/<key>.py                      # 시트 하나
"""
import math, random, re, sys
from pathlib import Path
from PIL import Image

HERE = Path(__file__).resolve().parent
if str(HERE) not in sys.path:
    sys.path.insert(0, str(HERE))
import lib_mage as LM
from lib_mage import Cel, Pal, hexrgb, ease, lerp, orbit, jag, OUT, REVIEW, BG, ROOT
from fx_edge import fade_edges, fade_oval

CX, GY, CY = 32, 56, 40
REG = {}


def sheet(key, anchor, frame, frames, pal, peak=None, side='enemy'):
    def deco(fn):
        assert key not in REG, key
        REG[key] = dict(key=key, anchor=anchor, frame=frame, frames=frames, pal=pal, draw=fn, peak=peak, side=side)
        return fn
    return deco


def rng(key, salt=0):
    return random.Random(f'{key}:{salt}')


def clamp(v, a=0.0, b=1.0):
    return max(a, min(b, v))


def ph(t, a, b):
    """t 가 a→b 구간에서 0→1."""
    return clamp((t - a) / (b - a)) if b != a else (1.0 if t >= a else 0.0)


def ramp(c0, c1, n):
    a, b = hexrgb(c0), hexrgb(c1)
    return ['#%02x%02x%02x' % tuple(round(a[i] + (b[i] - a[i]) * k / max(1, n - 1)) for i in range(3)) for k in range(n)]


def mix(*stops):
    """여러 색을 이어 붙인 램프: mix('#000','#f00',3, '#fff',2) 는 표기 단순화용이 아니라 stops=[(hex, n)]"""
    out = []
    for i in range(len(stops) - 1):
        out += ramp(stops[i], stops[i + 1], 3)[:-1]
    out.append(stops[-1])
    return out


# ── 글리프(문자 → 램프 단계) ──────────────────────────────────────────────────────────
# 글자: a 어두움 → b → c → d 밝음, k 윤곽(잉크), w 흰색, r 붉은 포인트, g 금 포인트. '.' 는 투명.
GLYPHS = {
    'card': ['.kkkkk.', 'kcdddck', 'kdrdddk', 'kdrrddk', 'kddrdck', 'kdddddk', 'kcdddck', 'kddddck', '.kkkkk.'],
    'card_back': ['.kkkkk.', 'kaaaaak', 'kabcbak', 'kacdcak', 'kabcbak', 'kacdcak', 'kabcbak', 'kaaaaak', '.kkkkk.'],
    'die': ['.kkkkkk.', 'kddddddk', 'kdkddkdk', 'kddddddk', 'kddkkddk', 'kddddddk', 'kdkddkdk', 'kccccccck'[:8], '.kkkkkk.'],
    'coin': ['..kkk..', '.kcddk.', 'kcdggdk', 'kdgddgk', 'kcdggdk', '.kbccck', '..kkk..'],
    'heart': ['.kk.kk.', 'kddkddk', 'kdddddk', 'kdcdddk', '.kdddk.', '..kdk..', '...k...'],
    'star4': ['...k...', '..kdk..', '..kdk..', 'kkddkkk', 'kdddddk', 'kkkdkkk', '..kdk..', '..kdk..', '...k...'],
    'feather': ['....kk', '...kdk', '..kddk', '.kdcdk', '.kdcdk', 'kdcdk.', 'kdck..', 'kck...', 'k.....'],
    'petal': ['.kk.', 'kddk', 'kddk', 'kcdk', '.kck', '..k.'],
    'crown': ['k.k.k.k', 'kdkdkdk', 'kddddgk', 'kdrdrdk', 'kccccck', '.kkkkk.'],
    'skull': ['.kkkkk.', 'kdddddk', 'kdkdkdk', 'kdkdkdk', '.kdddk.', '.kdkdk.', '..kkk..'],
    'moon': ['..kkk.', '.kddk.', 'kddk..', 'kdk...', 'kdk...', 'kddk..', '.kdddk', '..kkk.'],
    'drop': ['..k..', '.kdk.', '.kdk.', 'kddck', 'kdcck', '.kdk.', '..k..'],
    'gem': ['.kkkk.', 'kddccd', 'kdccdk', '.kcdk.', '..kk..'],
    'ankh': ['.kdk.', 'kd.dk', 'kd.dk', '.kdk.', 'kkdkk', 'kdddk', 'kkdkk', '..dk.', '..dk.', '..kk.'],
    'sword': ['.....kk', '....kdk', '...kddk', '..kdck.', '.kdck..', 'kgdk...', 'kgk....', 'kk.....'],
    'axe': ['.kkk...', 'kdddk..', 'kdcdkk.', 'kddcddk', '.kkkkck', '...kkck', '....kk.', '....k..'],
    'spear': ['...k....', '..kdk...', '.kdcdk..', '..kbk...', '..kbk...', '..kbk...', '..kbk...', '..kbk...'],
    'boom': ['kk.....', 'kddk...', '.kddk..', '..kddk.', '...kddk', '...kddk', '..kddk.', '.kdk...', 'kk.....'][:8],
    'shield': ['kkkkkkk', 'kddkddk', 'kdcdccd'[:7], 'kddgddk', 'kdcgcdk', '.kdgdk.', '..kdk..', '...k...'],
    'bolt': ['..kkk', '.kddk', 'kddk.', 'kdddkk', '.kddk.', '..kdk.', '..kk..'],
    'note': ['..kk', '..kdk', '..kdk', '..kd', '.kdk', 'kddk', '.kk.'],
    'flower': ['.kk.kk.', 'kddkddk', 'kdcgcdk', '.kdgdk.', 'kddkddk', '.kk.kk.'],
    'rock': ['..kkk.', '.kddck', 'kddcck', 'kdccbk', '.kbbbk', '..kkk.'],
    'key': ['.kkk...', 'kdddk..', 'kd.dkkk', 'kdddgdk', '.kkk.kk', '.....k.'],
    'bottle': ['..kk..', '..kk..', '.kddk.', 'kdcddk', 'kdcddk', 'kddddk', '.kkkk.'],
    'leaf': ['.....kk', '...kkdk', '..kddck', '.kddck.', 'kddck..', 'kdck...', 'kk.....'],
    'eye': ['.kkkkk.', 'kdcccdk', 'kcdkdck', 'kdcccdk', '.kkkkk.'],
    'wing': ['......kk', '....kkdk', '..kkddck', '.kddcck.', 'kddcck..', '.kdck...', '..kk....'],
    'scroll': ['kkkkkkk', 'kdcccdk', 'kdkkkdk', 'kdcccdk', 'kdkkkdk', 'kdcccdk', 'kkkkkkk'],
    'bag': ['..kkk..', '..kdk..', '.kdddk.', 'kdcgddk', 'kdgddck', 'kddddck', '.kkkkk.'],
    'stone': ['.kkk.', 'kdddk', 'kdcdk', 'kdddk', '.kkk.'],
    'flag': ['kkkkkk.', 'kddddk.', 'kdcddkk', 'kddddk.', 'kdkkkk.', 'kk.....', 'k......', 'k......'],
    'cross4': ['..kk..', '..kk..', 'kkddkk', 'kkddkk', '..kk..', '..kk..'],
}
# 일부 글리프 줄 길이 보정
for _k, _rows in GLYPHS.items():
    _w = max(len(r) for r in _rows)
    GLYPHS[_k] = [r.ljust(_w, '.') for r in _rows]


def stamp(c, name, x, y, cm, rot=0.0, flip=False, scale=1):
    """글리프 도장. (x, y) 는 글리프 중심. rot 은 라디안(시계 방향), 역변환 최근접 샘플링이라 구멍이 안 생긴다."""
    rows = GLYPHS[name] if isinstance(name, str) else name
    gh, gw = len(rows), len(rows[0])
    cx, cy = (gw - 1) / 2, (gh - 1) / 2
    ca, sa = math.cos(-rot), math.sin(-rot)
    ext = int(math.hypot(gw, gh) * scale / 2 + 2)
    for dy in range(-ext, ext + 1):
        for dx in range(-ext, ext + 1):
            u, v = (dx * ca - dy * sa) / scale, (dx * sa + dy * ca) / scale
            if flip: u = -u
            gx, gy = int(round(u + cx)), int(round(v + cy))
            if 0 <= gx < gw and 0 <= gy < gh:
                ch = rows[gy][gx]
                if ch != '.' and ch in cm:
                    c.px(x + dx, y + dy, cm[ch])


# ── 조립 부품 ─────────────────────────────────────────────────────────────────────────
def glow(c, x, y, r, rp, ry=None):
    c.glow(x, y, r, rp, ry)


def ring(c, x, y, r, col, w=1, ry=None):
    c.ring(x, y, r, col, w, ry)


def rays(c, cx, cy, n, r0, r1, col, rot=0.0, w=1, ry=1.0, alt=None):
    for k in range(n):
        a = rot + k * math.tau / n
        rr = r1 if (alt is None or k % 2 == 0) else alt
        c.line([(cx + math.cos(a) * r0, cy + math.sin(a) * r0 * ry), (cx + math.cos(a) * rr, cy + math.sin(a) * rr * ry)], col, w)


def column(c, cx, y0, y1, w, cols):
    """세로 빛기둥: cols 는 바깥→안쪽 색. 폭은 안쪽으로 갈수록 좁다."""
    for i, col in enumerate(cols):
        ww = w * (1 - i / len(cols))
        if ww < .5: break
        c.rect(cx - ww, y0, cx + ww - 1, y1, col)


def beam(c, x0, y0, x1, y1, w, cols):
    """비스듬한 빔: 바깥→안쪽 색, 선 폭이 줄어든다."""
    for i, col in enumerate(cols):
        ww = max(1, round(w * (1 - i / len(cols))))
        c.line([(x0, y0), (x1, y1)], col, ww)


def slash(c, cx, cy, r, a0, a1, w, cols, prog=1.0, ry=1.0):
    """초승달 베기 호. 각도는 도(deg), 0=오른쪽 90=아래(화면 좌표). prog 로 그려지는 정도(앞머리가 나아간다).
    cols: [바깥, 안, 하이라이트]."""
    n = 28
    a_end = a0 + (a1 - a0) * prog
    outer, inner = [], []
    for i in range(n + 1):
        u = i / n
        a = math.radians(a0 + (a_end - a0) * u)
        ww = w * math.sin(math.pi * clamp(u * .92 + .04))
        ro, ri = r + ww * .5, r - ww * .5
        outer.append((cx + math.cos(a) * ro, cy + math.sin(a) * ro * ry))
        inner.append((cx + math.cos(a) * ri, cy + math.sin(a) * ri * ry))
    c.poly(outer + inner[::-1], cols[0])
    if len(cols) > 1:
        mid = [((o[0] * 2 + i_[0]) / 3, (o[1] * 2 + i_[1]) / 3) for o, i_ in zip(outer, inner)]
        c.line(mid, cols[1], 1)
    if len(cols) > 2:
        c.line(outer[len(outer) // 4:-len(outer) // 4], cols[2], 1)


def sigil(c, cx, cy, r, col, ry=None, rot=0.0, spokes=6, inner=None, dots=None):
    ry = r if ry is None else ry
    c.ring(cx, cy, r, col, 1, ry)
    if inner:
        c.ring(cx, cy, r * inner, col, 1, ry * inner)
    pts = [(cx + math.cos(rot + k * math.tau / spokes) * r, cy + math.sin(rot + k * math.tau / spokes) * ry) for k in range(spokes)]
    step = 2 if spokes % 2 == 1 else 1
    if spokes in (5, 7): step = 2
    for k in range(spokes):
        a, b = pts[k], pts[(k + step) % spokes]
        c.line([a, b], col, 1)
    if dots is not None:
        for p in pts: c.px(p[0], p[1], dots)


def sparks(c, key, n, cx, cy, r0, r1, t, cols, size=1, ry=1.0, gravity=0.0, seed=0, start=0.0):
    """t=0→1 동안 중심에서 퍼져 나가는 불꽃 알갱이. cols 는 나이에 따라 밝음→어두움."""
    R = rng(key, seed)
    tt = clamp((t - start) / (1 - start)) if start else t
    for k in range(n):
        a = R.uniform(0, math.tau); sp = R.uniform(.5, 1.0)
        life = R.uniform(.6, 1.0)
        u = tt / life
        if u >= 1: continue
        r = lerp(r0, r1 * sp, ease(u))
        x, y = cx + math.cos(a) * r, cy + math.sin(a) * r * ry + gravity * u * u * 10
        col = cols[min(len(cols) - 1, int(u * len(cols)))]
        if size <= 1: c.px(x, y, col)
        else: c.rect(x, y, x + size - 1, y + size - 1, col)


def motes(c, key, n, cx, y_base, spread, height, t, cols, size=1, sway=2.0, seed=0, wrap=True):
    """아래에서 위로 떠오르는 알갱이(치유·오라)."""
    R = rng(key, seed)
    for k in range(n):
        x0 = R.uniform(-spread, spread); ph0 = R.uniform(0, 1); sp = R.uniform(.6, 1.2); wob = R.uniform(0, math.tau)
        u = (ph0 + t * sp) % 1.0 if wrap else clamp(ph0 + t * sp, 0, .999)
        y = y_base - u * height
        x = cx + x0 + math.sin(wob + u * 6) * sway
        col = cols[min(len(cols) - 1, int(u * len(cols)))] if len(cols) > 1 else cols[0]
        if size <= 1: c.px(x, y, col)
        else: c.rect(x, y, x + size - 1, y + size - 1, col)


def drift_glyphs(c, key, name, n, region, t, cm, rot_speed=0.0, fall=True, seed=0, scale=1, span=1.0, stagger=True):
    """글리프가 떨어지거나 떠오른다. region=(x0,y0,x1,y1), 위에서 아래(fall)로 흐른다."""
    R = rng(key, seed)
    x0, y0, x1, y1 = region
    for k in range(n):
        xx = R.uniform(x0, x1); ph0 = R.uniform(0, 1) if stagger else k / n; r0 = R.uniform(0, math.tau)
        u = (ph0 + t * span) % 1.0
        yy = lerp(y0, y1, u) if fall else lerp(y1, y0, u)
        stamp(c, name, xx + math.sin(r0 + u * 5) * 2, yy, cm, rot=r0 + rot_speed * t * math.tau, scale=scale)


def orbit_glyphs(c, name, cx, cy, r, n, t, cm, ry=None, speed=1.0, rot_self=0.0, scale=1, phase=0.0, front_only=False):
    for k in range(n):
        a = phase + t * math.tau * speed + k * math.tau / n
        x, y = orbit(cx, cy, r, a, ry)
        stamp(c, name, x, y, cm, rot=rot_self * t * math.tau + k, scale=scale)


def afterimage(c, pts, cols):
    """궤적: 점 목록(오래된 것 → 새 것)을 점점 굵고 밝게 잇는다."""
    n = len(pts)
    for i in range(n - 1):
        col = cols[min(len(cols) - 1, int(i / max(1, n - 1) * len(cols)))]
        c.line([pts[i], pts[i + 1]], col, 1 + (i > n // 2))


def wobble_ring(c, cx, cy, r, ry, cols, t, waves=6, amp=1.5, w=1):
    pts = []
    for k in range(48):
        a = k * math.tau / 47
        rr = r + math.sin(a * waves + t * 9) * amp
        pts.append((cx + math.cos(a) * rr, cy + math.sin(a) * rr * (ry / r if r else 1)))
    c.line(pts, cols, w)


def shade(c, cx, cy, rx, ry, col, t=1.0):
    """화면 층: 체커 디더 어둠(타원). 배틀러가 가려지지 않게 성기게."""
    tmp = Cel(c.w, c.h); tmp.disc(cx, cy, rx, col, ry)
    src = tmp.im.load(); dst = c.im.load()
    for y in range(c.h):
        for x in range(c.w):
            if src[x, y] and (x + y) % 2 == 0 and (x // 2 + y // 2) % 2 == 0: dst[x, y] = src[x, y]


def flash(c, x, y, r, cols):
    """번쩍임: 십자 + 동심 원."""
    for i, col in enumerate(cols):
        c.disc(x, y, r * (1 - i / len(cols)), col)


def ground_ring(c, cx, y, r, col, w=1, t=1.0):
    c.ring(cx, y, r, col, w, max(1, r * .32))


def bar(c, x0, y0, x1, y1, cols):
    """모서리에 하이라이트를 준 막대."""
    c.rect(x0, y0, x1, y1, cols[0])
    if len(cols) > 1: c.rect(x0 + 1, y0 + 1, x1 - 1, y1 - 1, cols[1])
    if len(cols) > 2: c.line([(x0 + 1, y0 + 1), (x1 - 1, y0 + 1)], cols[2])


# ── 계약 · 빌드 · 검토 ───────────────────────────────────────────────────────────────
def contract_from_ts(batch):
    text = (ROOT / f'src/assets/retroRosterSkills/{batch}.ts').read_text(encoding='utf8')
    out = {}
    for m in re.finditer(r'key: "(\w+)", anchor: "(\w+)", frame: (\d+), frames: (\d+)', text):
        out.setdefault(m.group(1), dict(anchor=m.group(2), frame=int(m.group(3)), frames=int(m.group(4))))
    return out


def check_contract(keys, batches=('p2', 'p3')):
    con = {}
    for b in batches:
        try: con.update(contract_from_ts(b))
        except FileNotFoundError: pass
    for k in keys:
        r = REG[k]
        spec = con.get(k)
        assert spec, f'{k}: 묶음 파일(TS)에 없다 — r2w3_emit.py 로 다시 생성하라'
        assert (spec['frame'], spec['frames'], spec['anchor']) == (r['frame'], r['frames'], r['anchor']), \
            f"{k}: 스크립트 {r['frame']}x{r['frames']} {r['anchor']} != 묶음 {spec}"


def render(key):
    r = REG[key]
    assert len(r['pal'].colors) <= 16, f"{key}: {len(r['pal'].colors)} colours"

    def draw(c, f):
        r['draw'](c, f)
        if r['anchor'] == 'screen':
            fade_oval(c, 0.35)
        elif r['anchor'] != 'projectile':
            fade_edges(c, T=4, L=4, R=4)
        else:
            fade_edges(c, T=2, B=2)
    LM.build(key, r['frame'], r['frames'], r['pal'], draw)
    return check(key)


def check(key):
    r = REG[key]
    res = LM.check(key, r['frame'], r['frames'])
    im = Image.open(OUT / f'{key}.png').convert('RGBA')
    fr = r['frame']
    cells = [im.crop((i * fr, 0, (i + 1) * fr, fr)) for i in range(r['frames'])]
    ink = [sum(1 for a in cl.getchannel('A').getdata() if a) for cl in cells]
    diffs = [sum(1 for p, q in zip(cells[i].getdata(), cells[i + 1].getdata()) if p != q) for i in range(len(cells) - 1)]
    weak = [i for i, d in enumerate(diffs) if d < max(8, .04 * min(ink[i], ink[i + 1]))]
    if weak:
        res['errors'].append(f'low motion after {weak}'); res['ok'] = False
    # 프레임 가장자리에 잉크가 닿으면 잘린 선이 무대에 보인다(fade_edges 로 지워졌는지 확인)
    if r['anchor'] not in ('projectile',):
        bad = []
        for i, cl in enumerate(cells):
            a = cl.getchannel('A'); w_, h_ = cl.size
            if any(a.getpixel((x, 0)) or a.getpixel((x, h_ - 1)) for x in range(w_)) and r['anchor'] != 'target':
                bad.append(i)
        if bad and r['anchor'] == 'screen': res['errors'].append(f'edge ink {bad}'); res['ok'] = False
    res['ink'] = ink
    return res


def preview(key, scale=None):
    r = REG[key]
    fr = r['frame']
    scale = scale or (3 if fr == 128 else 4)
    per = 4 if fr == 128 else (6 if fr == 64 else 8)
    cells = LM.cells_of(key, fr)
    s = fr * scale; gap = 4
    rows = math.ceil(len(cells) / per); cols = min(per, len(cells))
    img = Image.new('RGBA', (cols * (s + gap) + gap, rows * (s + gap + 14) + gap), (12, 14, 24, 255))
    for i, cl in enumerate(cells):
        x = gap + (i % per) * (s + gap); y = gap + (i // per) * (s + gap + 14)
        img.paste(Image.new('RGBA', (s, s), BG), (x, y + 14))
        img.alpha_composite(cl.resize((s, s), Image.NEAREST), (x, y + 14))
        LM._label(img, x, y + 2, str(i))
    assert img.width <= 1900 and img.height <= 1900, img.size
    path = REVIEW / f'r2w3-{key}-preview.png'; REVIEW.mkdir(parents=True, exist_ok=True); img.save(path)
    return path


def overview(batch, keys, name, scale64=2, per_view=None):
    """여러 시트를 한 줄씩 쌓은 개관: 32px 4배, 64px 2배, 128px 1배(가로 1900 이하)."""
    rows = []
    for i, key in enumerate(keys):
        r = REG[key]; fr = r['frame']
        sc = 1 if fr == 128 else (3 if fr == 32 else scale64)
        cells = LM.cells_of(key, fr); s = fr * sc
        row = Image.new('RGBA', (len(cells) * (s + 2) + 2, s + 16), (12, 14, 24, 255))
        LM._label(row, 2, 2, str(i), 2, (140, 220, 255, 255))
        for j, cl in enumerate(cells):
            row.paste(Image.new('RGBA', (s, s), BG), (2 + j * (s + 2), 14))
            row.alpha_composite(cl.resize((s, s), Image.NEAREST), (2 + j * (s + 2), 14))
        rows.append(row)
    w = max(rw.width for rw in rows); h = sum(rw.height for rw in rows)
    img = Image.new('RGBA', (w, h), (12, 14, 24, 255)); y = 0
    for rw in rows: img.paste(rw, (0, y)); y += rw.height
    ev = ROOT / '.omo/r2w3' / batch; ev.mkdir(parents=True, exist_ok=True)
    path = ev / f'{name}.png'
    if img.width > 1880:
        img = img.resize((1880, round(img.height * 1880 / img.width)), Image.NEAREST)
    img.save(path)
    return path


def stage_composite(batch, skills, chip, name, cols=4):
    """스킬마다 3장(초·중·후반). 무대 320×180 은 화면 2배, 아군(오른쪽, 그 직업 칩)과 적 슬라임(왼쪽). 층이 여럿이면 함께 겹친다."""
    ally_path = ROOT / f'public/assets/generated/charset-battlers/{chip}.png'
    actor = Image.open(ally_path).convert('RGBA').crop((0, 0, 48, 48)).resize((96, 96), Image.NEAREST) if ally_path.exists() else \
        Image.open(ROOT / 'public/assets/generated/charset-battlers/actor1-0.png').convert('RGBA').crop((0, 0, 48, 48)).resize((96, 96), Image.NEAREST)
    slime = Image.open(ROOT / 'public/assets/generated/pixel-enemies/slime.png').convert('RGBA').crop((0, 0, 48, 48)).resize((96, 96), Image.NEAREST)
    W, H = 320, 180
    e_feet = [(60, 152), (108, 132), (150, 156)]; a_feet = [(236, 132), (270, 152), (204, 152)]
    panels = []
    for si, sk in enumerate(skills):
        keys = [l for l in sk['layers']]
        n_ref = max(REG[k]['frames'] for k in keys)
        for stepi in (0.28, 0.5, 0.78):
            p = Image.new('RGBA', (W, H), BG)
            p.alpha_composite(Image.new('RGBA', (W, 34), (0x2a, 0x34, 0x52, 255)), (0, 146))
            for ex, ey in e_feet[:3]:
                p.alpha_composite(slime, (ex - 48, ey - 88))
            for ax, ay in a_feet[:1]:
                p.alpha_composite(actor, (ax - 48, ay - 88))
            for k in keys:
                r = REG[k]; fr = r['frame']; cells = LM.cells_of(k, fr)
                f = min(len(cells) - 1, int(stepi * len(cells)))
                cell = cells[f].resize((fr * 2, fr * 2), Image.NEAREST)
                anc = r['anchor']
                if anc == 'screen':
                    p.alpha_composite(cell, (W // 2 - fr, H // 2 - fr))
                elif anc in ('user', 'allAllies') or (anc == 'target' and r['side'] == 'ally'):
                    for ax, ay in a_feet[:1] if anc == 'user' or anc == 'target' else a_feet[:1]:
                        p.alpha_composite(cell, (ax - fr, ay - (fr - 8) * 2))
                elif anc == 'target':
                    ex, ey = e_feet[0]
                    p.alpha_composite(cell, (ex - fr, ey - (fr - 8) * 2))
                elif anc == 'allTargets':
                    for ex, ey in e_feet:
                        p.alpha_composite(cell, (ex - fr, ey - (fr - 8) * 2))
                else:
                    u = 0.15 + 0.7 * stepi
                    x = int(lerp(a_feet[0][0] - 24, e_feet[0][0] + 24, u)); y = int(lerp(96, 104, u))
                    p.alpha_composite(cells[int(stepi * 8) % len(cells)].resize((fr * 2, fr * 2), Image.NEAREST), (x - fr, y - fr))
            LM._label(p, 4, 4, str(si), 2, (140, 220, 255, 255))
            panels.append(p)
    rows = math.ceil(len(panels) / cols)
    img = Image.new('RGBA', (cols * (W + 4), rows * (H + 4)), (8, 8, 12, 255))
    for i, p in enumerate(panels): img.paste(p, ((i % cols) * (W + 4), (i // cols) * (H + 4)))
    assert img.width <= 1900
    ev = ROOT / '.omo/r2w3' / batch; ev.mkdir(parents=True, exist_ok=True)
    path = ev / f'{name}.png'
    if img.height > 1880:
        img = img.crop((0, 0, img.width, 1880))
    img.save(path)
    return path


def make(key, review=True):
    r = render(key)
    if review: preview(key)
    print(('OK  ' if r['ok'] else 'FAIL'), key, r['size'], 'colours', r['colours'], 'minFill', r['minFill'], 'minDiff', r['minDiff'], *r['errors'], flush=True)
    return r


def make_class(batch, class_key, keys, skills, chip, argv):
    only = [a for a in argv if not a.startswith('--')]
    check_contract(keys, (batch,))
    sel = [k for k in keys if not only or k in only]
    results = [make(k, review='--noreview' not in argv) for k in sel]
    if '--noreview' not in argv and not only:
        print(overview(batch, keys, f'{class_key}-sheets'))
        print(stage_composite(batch, skills, chip, f'{class_key}-stage'))
    bad = [r['key'] for r in results if not r['ok']]
    if bad: print('FAILED:', bad)
    return results

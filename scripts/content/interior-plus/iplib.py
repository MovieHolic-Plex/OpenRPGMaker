"""interior-plus — 손 도트 실내 v5(atlas_biome_interior)에 덧붙이는 박물관·배 안·투기장 조각의 그리기 도구.

팔레트는 실내 공통 팔레트 v6(tiledata/hand-interior/pick/palette/v6.pal)의 재료 램프를 그대로 쓴다(새 계열 금지).
빛은 왼쪽 위 — 윗면 밝게(5~6단), 앞면 중간(3~4단), 오른쪽·아래 그늘(1~2단), 0단 = 그 재질의 유색 윤곽.
조각 모듈(pieces/*.py)은 이 파일만 import 해서 그리고 REG 에 등록한다. 굽기는 bake.py(시트 끝에 덧붙임, 번호 핀 고정).
"""
import os, re, math, hashlib
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
TD = os.path.join(ROOT, 'tiledata', 'hand-interior', 'plus')
PAL_PATH = os.path.join(ROOT, 'tiledata', 'hand-interior', 'pick', 'palette', 'v6.pal')
T = 16


def _load_ramps():
    out = {}
    for line in open(PAL_PATH, encoding='utf-8'):
        m = re.match(r'@rampc\s+(\w+)\s+(.*)', line)
        if not m or re.fullmatch(r's\d+', m.group(1)): continue
        out[m.group(1)] = [tuple(int(h[i:i + 2], 16) for i in (1, 3, 5)) for h in re.findall(r'#[0-9a-fA-F]{6}', m.group(2))]
    return out


RAMPS = _load_ramps()
# 재료 램프 안에서 어둡게/밝게 옮기려고 색 → (램프, 단)
_WHERE = {}
for _n, _r in RAMPS.items():
    for _i, _c in enumerate(_r): _WHERE.setdefault(_c, (_n, _i))
SHADOW = (0x1c, 0x14, 0x18)


def K(m, t):
    """램프 m 의 t 단(넘치면 끝값)."""
    r = RAMPS[m]
    return r[max(0, min(len(r) - 1, int(t)))]


def shift(c, n):
    """같은 램프 안에서 n 단 옮긴 색(램프 밖 색은 그대로)."""
    if c is None: return None
    w = _WHERE.get(tuple(c[:3]))
    if not w: return c
    return K(w[0], w[1] + n)


class Cv:
    def __init__(s, w, h):
        s.w, s.h = w, h
        s.a = [[None] * w for _ in range(h)]        # (r,g,b) 또는 (r,g,b,a)

    def ok(s, x, y): return 0 <= x < s.w and 0 <= y < s.h
    def get(s, x, y): return s.a[y][x] if s.ok(x, y) else None

    def p(s, x, y, c):
        if c is not None and s.ok(x, y): s.a[y][x] = c

    def rect(s, x0, y0, x1, y1, c):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1): s.p(x, y, c)

    def hl(s, x0, x1, y, c): s.rect(x0, y, x1, y, c)
    def vl(s, x, y0, y1, c): s.rect(x, y0, x, y1, c)

    def ell(s, cx, cy, rx, ry, c, only=None):
        """채운 타원(실수 중심 허용). only(x,y)→색 함수면 그 색으로."""
        for y in range(int(math.floor(cy - ry)), int(math.ceil(cy + ry)) + 1):
            for x in range(int(math.floor(cx - rx)), int(math.ceil(cx + rx)) + 1):
                if ((x - cx) / (rx + .5)) ** 2 + ((y - cy) / (ry + .5)) ** 2 <= 1.0:
                    s.p(x, y, only(x, y) if only else c)

    def map(s, f, x0=0, y0=0, x1=None, y1=None):
        """칠한 칸마다 f(x,y,c)→c."""
        x1 = s.w - 1 if x1 is None else x1; y1 = s.h - 1 if y1 is None else y1
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                c = s.get(x, y)
                if c is not None and len(c) == 3: s.a[y][x] = f(x, y, c)

    def sprite(s, x, y, rows, pal):
        """행 문자열 그림. pal = {글자: 색}, '.' 와 ' ' 는 건너뜀."""
        for j, row in enumerate(rows):
            for i, ch in enumerate(row):
                if ch in '. ': continue
                s.p(x + i, y + j, pal[ch])

    def outline(s, dark=None, keep_bottom=True):
        """칠한 덩어리 바깥 4방 투명 칸에 그 이웃 색의 램프 0단(또는 dark) 윤곽."""
        add = []
        for y in range(s.h):
            for x in range(s.w):
                if s.a[y][x] is not None: continue
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    c = s.get(x + dx, y + dy)
                    if c is not None and len(c) == 3:
                        add.append((x, y, dark or shift(c, -9))); break
        for x, y, c in add: s.a[y][x] = c

    def edge_dark(s):
        """덩어리 가장자리 칸(바깥이 투명)을 그 재질 0~1단으로 — 윤곽을 안쪽에 그린다(칸 밖으로 안 넘친다)."""
        ed = []
        for y in range(s.h):
            for x in range(s.w):
                c = s.a[y][x]
                if c is None or len(c) != 3: continue
                if any(s.get(x + dx, y + dy) is None for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                    ed.append((x, y, shift(c, -9)))
        for x, y, c in ed: s.a[y][x] = c

    def shadow(s, x0, y0, x1, y1):
        """발밑 접지 그림자(반투명, 오른쪽 아래로) — 비어 있는 칸에만."""
        cx, cy = (x0 + x1) / 2 + 1, (y0 + y1) / 2
        rx, ry = (x1 - x0) / 2 + .5, (y1 - y0) / 2 + .5
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 2):
                if not s.ok(x, y) or s.a[y][x] is not None: continue
                d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2
                if d <= 0.55: s.a[y][x] = SHADOW + (110,)
                elif d <= 1.05: s.a[y][x] = SHADOW + (58,)

    def paste(s, o, x, y):
        for j in range(o.h):
            for i in range(o.w):
                c = o.a[j][i]
                if c is not None: s.p(x + i, y + j, c)

    def img(s):
        im = Image.new('RGBA', (s.w, s.h), (0, 0, 0, 0)); px = im.load()
        for y in range(s.h):
            for x in range(s.w):
                c = s.a[y][x]
                if c is None: continue
                px[x, y] = tuple(c[:3]) + ((c[3],) if len(c) == 4 else (255,))
        return im


# ───────────────────────── 3/4 입체 도우미 ─────────────────────────
def box(c, x, y, w, d, h, m, top=None, t0=5, f0=3, rim=True):
    """3/4 상자: (x,y) = 윗면 왼쪽 위. 윗면 d 줄(t0 단, 앞 가장자리 밝은 테), 앞면 h 줄(f0 단 → 아래로 한 단 어둡게), 오른쪽 열 그늘.
    윤곽은 재질 0~1단으로 바깥 둘레에 직접 그린다."""
    tm = top or m
    for j in range(d):
        for i in range(w):
            col = K(tm, t0 + (1 if j == 0 and i < w - 1 else 0) - (1 if i >= w - 2 else 0))
            c.p(x + i, y + j, col)
    if rim: c.hl(x + 1, x + w - 2, y + d - 1, K(tm, t0 + 1))
    for j in range(h):
        for i in range(w):
            col = K(m, f0 - (1 if j >= h - 2 else 0) - (1 if i >= w - 2 else 0) + (1 if i == 1 else 0))
            c.p(x + i, y + d + j, col)
    o = K(m, 0)
    c.hl(x, x + w - 1, y - 1, K(tm, 1)); c.hl(x, x + w - 1, y + d + h, o)
    c.vl(x - 1, y, y + d + h - 1, o); c.vl(x + w, y, y + d + h - 1, o)
    c.hl(x, x + w - 1, y + d, K(m, f0 + 2))          # 윗면과 앞면 사이 밝은 모서리


def cyl(c, cx, ytop, rx, ry, h, m, t0=5, body=(5, 4, 3, 2, 1), cap=None, outline=True):
    """3/4 원통: 윗면 타원(중심 cx, ytop+ry) + 몸통 h 줄. 몸통 색은 왼쪽(밝음)→오른쪽(어두움) body 단계."""
    cy = ytop + ry
    n = len(body)
    for y in range(int(cy), int(cy) + h + 1):
        for x in range(int(cx - rx), int(math.ceil(cx + rx)) + 1):
            u = (x - (cx - rx)) / max(1, 2 * rx)
            k = body[min(n - 1, max(0, int(u * n)))]
            if y >= cy + h:
                if ((x - cx) / (rx + .5)) ** 2 + ((y - cy - h) / (ry + .5)) ** 2 > 1: continue
            c.p(x, y, K(m, k))
    cm = cap or m
    c.ell(cx, cy, rx, ry, None, only=lambda x, y: K(cm, t0 + (1 if (x - cx) < -rx * .2 and (y - cy) < 0 else 0) - (1 if (x - cx) > rx * .5 else 0)))
    if outline:
        o = K(m, 0)
        for x in range(int(cx - rx) - 1, int(math.ceil(cx + rx)) + 2):
            pass
    return cy


def ring(c, cx, cy, rx, ry, col):
    """타원 둘레만."""
    for a in range(0, 360, 3):
        r = math.radians(a)
        c.p(int(round(cx + rx * math.cos(r))), int(round(cy + ry * math.sin(r))), col)


# ───────────────────────── 등록 ─────────────────────────
class Reg:
    def __init__(s):
        s.pieces = {}; s.floors = {}; s.walls = {}; s.pits = {}; s.order = []

    def piece(s, id, ko, cat, kind, w, h, up, gate, desc, tags, place, pair=(), use=('block',), facing=None, surface=False, rows=None, style=None):
        """kind = 사양 종류(floor·wall·hang·flat). up = 발밑 위로 솟은 px. rows = 걸이 줄 수(기본 2).
        style = object-gate 화풍 비교 종류(building·roof·wall·tree·ground·water·prop). 없으면 3/4 종류의 기본값."""
        def deco(fn):
            s.pieces[id] = dict(id=id, ko=ko, cat=cat, kind=kind, w=w, h=h, up=up, gate=gate, desc=desc, tags=list(tags), place=place,
                                pair=list(pair), use=list(use), facing=facing, surface=surface, rows=rows, style=style, fn=fn, mod=fn.__module__)
            s.order.append(id)
            return fn
        return deco

    def floor(s, id, ko, cols, rows):
        def deco(fn): s.floors[id] = dict(id=id, ko=ko, cols=cols, rows=rows, fn=fn); return fn
        return deco

    def wall(s, id, ko, cols):
        def deco(fn): s.walls[id] = dict(id=id, ko=ko, cols=cols, fn=fn); return fn
        return deco

    def pit(s, id, ko):
        """구멍(심연) 오토타일: fn(mask) → Cv 16×16. mask = 8이웃(N=1 NE=2 E=4 SE=8 S=16 SW=32 W=64 NW=128, 켜짐 = 그 이웃도 구멍),
        대각은 양옆 직교가 켜졌을 때만(47 블롭). 굽기는 47 마스크 칸을 덧붙이고 사양 pits[id] = {ko, masks, tiles}."""
        def deco(fn): s.pits[id] = dict(id=id, ko=ko, fn=fn); return fn
        return deco


REG = Reg()


def canvas_of(p):
    if p['kind'] == 'hang':
        return Cv(max(1, p['w']) * T, (p['rows'] or 2) * T)
    if p['kind'] == 'flat':
        return Cv(p['w'] * T, p['h'] * T)
    return Cv(p['w'] * T, p['h'] * T + p['up'] + (T - p['up'] % T) % T)


def render(p):
    """조각 그림(실내 공통 팔레트 v6 로 옮긴 것 — 시트에 들어가는 화소와 같다. 관문 영수증도 이 그림에 묶인다)."""
    if '_img' in p: return p['_img'].copy()
    c = canvas_of(p)
    p['fn'](c)
    im = snap(c.img())
    p['_img'] = im
    return im.copy()


def snap(im):
    import sys
    d = os.path.join(ROOT, 'scripts', 'content', 'hand-interior-pick')
    if d not in sys.path: sys.path.insert(0, d)
    from palette_snap import snap as _s
    return _s(im)[0]


def hnoise(x, y, s=0):
    """정수 해시 잡음 0..1(결·얼룩)."""
    h = (x * 374761393 + y * 668265263 + s * 2246822519) & 0xffffffff
    h = ((h ^ (h >> 13)) * 1274126177) & 0xffffffff
    return ((h ^ (h >> 16)) & 0xffff) / 65535.0


def poly(c, pts, colf):
    """다각형 채우기(짝홀 규칙). colf(x,y) → 색 또는 고정 색."""
    ys = [p[1] for p in pts]
    for y in range(int(min(ys)), int(max(ys)) + 1):
        yc = y + .5; xs = []
        for i in range(len(pts)):
            (x1, y1), (x2, y2) = pts[i], pts[(i + 1) % len(pts)]
            if (y1 <= yc < y2) or (y2 <= yc < y1):
                xs.append(x1 + (yc - y1) * (x2 - x1) / (y2 - y1))
        xs.sort()
        for a, b in zip(xs[0::2], xs[1::2]):
            for x in range(int(round(a)), int(round(b))):
                c.p(x, y, colf(x, y) if callable(colf) else colf)


def line(c, x0, y0, x1, y1, col):
    n = max(abs(x1 - x0), abs(y1 - y0), 1)
    for i in range(n + 1):
        c.p(int(round(x0 + (x1 - x0) * i / n)), int(round(y0 + (y1 - y0) * i / n)), col)


def plinth_block(c, cx, foot, top, m='marble', w=12):
    """대리석 받침(3/4): 아래 넓은 단 + 기둥 몸 + 머리 판(윗면 4줄). top = 머리 판 윗면 첫 줄, foot = 발 칸 마지막 그림 줄."""
    x0 = cx - w // 2
    box(c, x0 - 1, foot - 4, w + 2, 2, 2, m, t0=5, f0=3)                      # 받침 단
    for y in range(top + 6, foot - 4):                                           # 몸(세로 홈)
        for i in range(w - 2):
            k = 5 if i < 2 else 4 if i < 5 else 3 if i < w - 4 else 2
            if i in (3, 6) and y > top + 6: k -= 1
            c.p(x0 + 1 + i, y, K(m, k))
    c.vl(x0, top + 6, foot - 5, K(m, 1)); c.vl(x0 + w - 1, top + 6, foot - 5, K(m, 0))
    box(c, x0 - 1, top, w + 2, 4, 2, m, t0=5, f0=4)                             # 머리 판
    return top + 2


def barrel(c, cx, ytop, rx=5.5, ry=2.5, h=10, m='dwood', hoop='iron', lid=True):
    """선 통(3/4): 윗면 뚜껑 타원 + 불룩한 몸 + 휜 쇠테 둘."""
    cy = ytop + ry
    for y in range(int(cy), int(cy + h) + 1):
        t = (y - cy) / max(1, h)
        bulge = 0.6 * math.sin(math.pi * t)
        r = rx + bulge
        for x in range(int(math.floor(cx - r)), int(math.ceil(cx + r)) + 1):
            u = (x - cx) / (r + .5)
            if abs(u) > 1: continue
            if y >= cy + h - ry * math.sqrt(max(0, 1 - u * u)) * 0 and y > cy + h: continue
            k = 5 if u < -.55 else 4 if u < -.1 else 3 if u < .45 else 2
            if int(round(x - cx)) % 3 == 0 and abs(u) < .8: k -= 1      # 통널 이음
            c.p(x, y, K(m, k))
    # 아래 둥근 끝
    for x in range(int(cx - rx), int(math.ceil(cx + rx)) + 1):
        u = (x - cx) / (rx + .5)
        if abs(u) <= 1:
            for d in range(int(ry * math.sqrt(1 - u * u)) + 1): c.p(x, int(cy + h) + d, K(m, 2 if u > 0 else 3))
    for frac in (.18, .78):   # 쇠테(아래로 휜다)
        yb = cy + h * frac
        for x in range(int(math.floor(cx - rx - .6)), int(math.ceil(cx + rx + .6)) + 1):
            u = (x - cx) / (rx + 1)
            if abs(u) > 1: continue
            y = int(round(yb + ry * .9 * math.sqrt(1 - u * u)))
            c.p(x, y, K(hoop, 5 if u < -.3 else 4 if u < .3 else 2))
    if lid:
        c.ell(cx, cy, rx, ry, None, only=lambda x, y: K(m, 6 if (x - cx) < -rx * .3 else 5 if (x - cx) < rx * .4 else 4))
        for x in range(int(cx - rx) + 1, int(cx + rx)):
            if int(round(x - cx)) % 3 == 1: c.p(x, int(round(cy)), K(m, 3))
        ring(c, cx, cy, rx, ry, K(hoop, 4))
    return cy


def barrel_side(c, x0, cy, L, r, m='dwood', hoop='iron', end='left'):
    """눕힌 통: 왼쪽에 둥근 마구리(윗면 대신 끝면이 보인다), 몸은 오른쪽으로 L px. 윗면 반사 줄."""
    for x in range(x0, x0 + L):
        for y in range(int(cy - r), int(cy + r) + 1):
            v = (y - cy) / (r + .5)
            k = 5 if v < -.55 else 4 if v < -.1 else 3 if v < .5 else 2
            if (y - int(cy - r)) % 3 == 0 and abs(v) < .85: k -= 1
            c.p(x, y, K(m, k))
    for fx in (x0 + 3, x0 + L - 4):
        for y in range(int(cy - r), int(cy + r) + 1): c.p(fx, y, K(hoop, 4 if y < cy else 2))
    c.ell(x0, cy, r * .45, r, None, only=lambda x, y: K(m, 5 if y < cy else 4))
    ring(c, x0, cy, r * .45, r, K(hoop, 4))
    c.p(x0, int(cy), K(m, 2))


PIT_BITS = dict(N=1, NE=2, E=4, SE=8, S=16, SW=32, W=64, NW=128)


def pit_reduce(m):
    """대각 비트는 양옆 직교가 둘 다 켜졌을 때만 남긴다(47 블롭 정규형)."""
    if not (m & 1 and m & 4): m &= ~2
    if not (m & 16 and m & 4): m &= ~8
    if not (m & 16 and m & 64): m &= ~32
    if not (m & 1 and m & 64): m &= ~128
    return m


PIT_MASKS = sorted({pit_reduce(m) for m in range(256)})


def pit_render(pd, mask):
    """구멍 칸 그림(팔레트 v6 로 옮긴 것 — 시트에 들어가는 화소)."""
    cache = pd.setdefault('_img', {})
    if mask not in cache: cache[mask] = snap(pd['fn'](mask).img())
    return cache[mask].copy()

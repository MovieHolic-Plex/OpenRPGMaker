# 비행선 보정 패스(2026-10-08, WAVE-BRIEF-4) — 시그니처 땅 덩이 16변형 오토타일 셋. 위층 투명 덧그림(밑 널이 비친다).
#   autotile-deck-puddle : 갑판에 고인 빗물 웅덩이(걷기, 얕다) — 젖어 짙어진 널 테 · 하늘을 비추는 반투명 물 · 북쪽 안 가 그늘 · 남서 물빛 줄.
#   autotile-oil-slick   : 기름때·타르 번짐(걷기) — 갑판 굴뚝·승강구 곁, 기관실 기관 둘레. 검갈색 속에 무지갯빛 얼룩, 둘레 튄 방울.
#   autotile-coal-dust   : 석탄 가루 쏟은 자리(걷기) — 기관실 화구·석탄 더미 둘레. 짙은 잿가루 위 덩이 석탄알(윗면 빛), 가장자리는 알갱이로 흩어진다.
# 칸 번호 = 위 1 + 오른쪽 2 + 아래 4 + 왼쪽 8 (as_auto · 공용 autotile_mask 규약, 왼쪽 위 칸 0). 결정적.
# 가장자리: 4비트 오토타일은 대각 이웃을 모르므로, 오목한 모서리 칸(이웃 넷 다 있음)이 네모 혹으로 튀어나오지 않게
# 칸 모서리로 갈수록 들어감을 foot 까지 줄인다(desert-castle dc_fix.edge_taper 와 같은 생각, 여기서 따로 구현 — 공용 코드는 읽기만).
import math
import numpy as np
from PIL import Image
from as_kit import *
from as_kit import _hash

def hash2(X, Y, s):
    X = int(X) & 0xffffffff; Y = int(Y) & 0xffffffff
    h = (X * 374761393 + Y * 668265263 + (s * 982451653 & 0xffffffff)) & 0xffffffff
    h = ((h ^ (h >> 13)) * 1274126177) & 0xffffffff
    return ((h ^ (h >> 16)) & 0xffff) / 65535.0

def tnoise1(N, sc, seed):
    """길이 N 을 sc 간격으로 감긴(wrap) 1차 값 잡음 — 옆 칸과 이어진다."""
    gw = max(1, N // sc); rng = np.random.default_rng(seed); g = rng.random(gw)
    xs = (np.arange(N) + 0.5) / sc; x0 = np.floor(xs).astype(int); f = xs - x0; f = f * f * (3 - 2 * f)
    return g[x0 % gw] * (1 - f) + g[(x0 + 1) % gw] * f

def tnoise(W, H, sc, seed):
    gw, gh = max(1, W // sc), max(1, H // sc)
    rng = np.random.default_rng(seed); g = rng.random((gh, gw))
    xs = (np.arange(W) + 0.5) / sc; ys = (np.arange(H) + 0.5) / sc
    x0 = np.floor(xs).astype(int); y0 = np.floor(ys).astype(int); fx = xs - x0; fy = ys - y0
    fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy)
    x1 = (x0 + 1) % gw; y1 = (y0 + 1) % gh; x0 %= gw; y0 %= gh
    a = g[np.ix_(y0, x0)]; b = g[np.ix_(y0, x1)]; c = g[np.ix_(y1, x0)]; d = g[np.ix_(y1, x1)]
    fxx = fx[None, :]; fyy = fy[:, None]
    return (a * (1 - fxx) + b * fxx) * (1 - fyy) + (c * (1 - fxx) + d * fxx) * fyy

def edge_taper(n, inset, jag, rad, seed, foot=0.6, ramp=6.0, size=16):
    """m[y,x] = 가장 가까운 빈 쪽 가장자리에서 잰 깊이(<0 = 칸 밖, 99 = 속), side[y,x] = 그 쪽('N','E','S','W' 또는 '')."""
    X, Y = np.meshgrid(np.arange(size), np.arange(size))
    miss = {'N': not (n & 1), 'E': not (n & 2), 'S': not (n & 4), 'W': not (n & 8)}
    j = {k: tnoise1(size, 4, seed + i + 1) for i, k in enumerate('NSWE')}
    def tap(t): return np.clip(np.minimum(t + 0.5, size - 0.5 - t) / ramp, 0, 1)
    def prof(k, t): return foot + tap(t) * (inset - foot + (j[k][t] - 0.5) * 2 * jag)
    d = {'N': Y - prof('N', X), 'S': (size - 1 - Y) - prof('S', X), 'W': X - prof('W', Y), 'E': (size - 1 - X) - prof('E', Y)}
    m = np.full((size, size), 99.0); side = np.full((size, size), '', dtype='<U1')
    for k in 'NESW':
        if miss[k]:
            sel = d[k] < m; m = np.where(sel, d[k], m); side = np.where(sel, k, side)
    for a, b in (('N', 'W'), ('N', 'E'), ('S', 'W'), ('S', 'E')):
        if miss[a] and miss[b]:
            da, db = d[a], d[b]; sel = (da < rad) & (db < rad)
            rc = rad - np.hypot(rad - da, rad - db)
            sel2 = sel & (rc < m); m = np.where(sel2, rc, m)
            side = np.where(sel2, np.where(da < db, a, b), side)
    return m, side

def sheet16(cell):
    sh = Image.new('RGBA', (64, 64), (0, 0, 0, 0))
    for n in range(16): sh.alpha_composite(cell(n), ((n % 4) * 16, (n // 4) * 16))
    return sh

def _img(rgba):
    return Image.fromarray(np.asarray(rgba, dtype=np.uint8), 'RGBA').copy()

# ================================================================ 1. 갑판 빗물 웅덩이(걷기)
WET = (58, 34, 26)                     # 젖은 널(나무 램프 WD[1]~[2] 사이, 반투명으로 덮는다)
PUD = [(40, 52, 84), (62, 92, 140), (78, 116, 170), (104, 146, 200), (160, 196, 232), (230, 240, 250)]   # 하늘 비친 물(SKY7 쪽 6단)
PN = tnoise(16, 16, 8, 1207)
def puddle_cell(n, seed=1201):
    # 2026-10-08 전수 감사 보정 — 윤곽을 공용 깊이장으로 바꾼 새 판(as_fix_puddle.puddle_cell). 화가는 같다.
    from as_fix_puddle import puddle_cell as _new
    return _new(n, seed)
def puddle_sheet(): return sheet16(puddle_cell)

# ================================================================ 2. 기름때·타르 번짐(걷기)
OIL = [(30, 20, 18), (42, 30, 24), (54, 40, 30), (70, 54, 38), (92, 72, 50)]
IRI = [(70, 58, 104), (52, 86, 92), (104, 82, 52)]                  # 무지갯빛(보라·청록·호박) — 낮은 채도
ON = tnoise(16, 16, 8, 1307); ON2 = tnoise(16, 16, 8, 1308)
def oil_cell(n, seed=1301):
    m, side = edge_taper(n, 2.6, 2.0, 6.5, seed, foot=1.2, ramp=6.0)
    a = np.zeros((16, 16, 4), np.uint8)
    for y in range(16):
        for x in range(16):
            v = m[y, x]; sd = side[y, x]
            if v < -2.4:
                continue
            if v < 0:                                                  # 둘레 튄 방울(1~2px 덩이)
                h = hash2(x + n * 16, y + n * 7, seed + 1)
                if h > 0.9: a[y, x] = OIL[2] + (210,)
                elif h > 0.86 and x < 15 and m[y, x + 1] >= -0.5: a[y, x] = OIL[3] + (170,)
                continue
            if v < 0.9:                                                # 번진 가: 옅은 기름 스밈(반투명)
                a[y, x] = OIL[3] + (150,); continue
            if v < 1.7:
                a[y, x] = (OIL[1] if sd in ('S', 'E') else OIL[2]) + (225,); continue
            c = OIL[0]                                                 # 속: 검갈색 타르(한 톤)
            if (y % 8) == 3 and hash2(x // 4, y // 8, seed + 6) > 0.6:     # 드문 무지갯빛 결(4px 가로 줄, 보라 또는 청록)
                c = mix(OIL[1], IRI[0] if hash2(x // 4, 7, seed) < 0.5 else IRI[1], .6)
            if v < 2.6 and sd in ('N', 'W'): c = OIL[3]                # 빛 받는 가 한 줄(두께감)
            a[y, x] = c + (205,)
    return _img(a)
def oil_sheet(): return sheet16(oil_cell)

# ================================================================ 3. 석탄 가루(걷기)
DUST = [(34, 30, 34), (46, 42, 46), (60, 56, 62), (78, 74, 80)]
CN = tnoise(16, 16, 8, 1407)
def _lumps(seed):
    """속 석탄알(2~3px) 자리 — 16 주기 고정 목록."""
    out = []
    for i in range(2):
        out.append((int(hash2(i, 1, seed) * 16), int(hash2(i, 2, seed) * 16), 1))
    return out
LUMPS = _lumps(1411)
def coal_cell(n, seed=1401):
    m, side = edge_taper(n, 2.6, 2.2, 6.5, seed, foot=1.2, ramp=6.0)
    a = np.zeros((16, 16, 4), np.uint8)
    for y in range(16):
        for x in range(16):
            v = m[y, x]; sd = side[y, x]
            if v < -2.0:
                continue
            if v < 0:                                                  # 칸 밖: 드문 석탄 부스러기(1px)
                if hash2(x + n * 16, y, seed + 1) > 0.9: a[y, x] = DUST[2] + (235,)
                continue
            if v < 1.0:                                                # 얇게 깔린 가루 테(반투명 한 단)
                a[y, x] = DUST[1] + (150,); continue
            c = DUST[0]                                                # 속: 짙은 잿가루(한 톤 + 알갱이)
            if v < 2.2 and sd == 'S': c = DUST[0]                      # 남쪽 가: 소복한 두께 그늘
            h3 = hash2(x, y, seed + 3)
            if h3 > 0.93: c = DUST[2]
            elif h3 > 0.78: c = DUST[1]
            a[y, x] = c + (205,)
    im = _img(a); p = im.load()
    for (lx, ly, s) in LUMPS:                                          # 덩이 석탄알: 윗면 빛 한 점 + 아래 그늘
        for dy in range(s + 1):
            for dx in range(s + 1):
                x, y = (lx + dx) % 16, (ly + dy) % 16
                if m[y, x] < 2.0: continue
                c = COAL[3] if (dx == 0 and dy == 0) else (COAL[0] if dy == s else COAL[1])
                p[x, y] = tuple(c) + (255,)
    return im
def coal_sheet(): return sheet16(coal_cell)

# ================================================================ 시험 그림(check-autotile.png)
SHAPES = {
 'blob5': ["........", "..XXX...", ".XXXXX..", ".XXXXXX.", ".XXXXX..", "..XXXX..", "...X....", "........"],
 'spiral': ["..........", ".XXXXXXX..", ".X.....X..", ".X.XXX.X..", ".X.X.X.X..", ".X.X...X..", ".X.XXXXX..", ".X........", ".XXXXXXXX.", ".........."],
 'nose_L': ["..........", ".XXX......", ".XXX......", ".XXXX.....", ".XXXXXXXX.", "XXXXXXXXXX", ".XXXXXXX..", "..XX......", ".........."],
}
def stamp(sheet, rows, bgfn):
    h = len(rows); w = len(rows[0]); out = Image.new('RGBA', (w * 16, h * 16))
    for y in range(h):
        for x in range(w): out.alpha_composite(bgfn(x, y), (x * 16, y * 16))
    on = lambda x, y: 0 <= x < w and 0 <= y < h and rows[y][x] == 'X'
    for y in range(h):
        for x in range(w):
            if not on(x, y): continue
            k = (1 if on(x, y - 1) else 0) | (2 if on(x + 1, y) else 0) | (4 if on(x, y + 1) else 0) | (8 if on(x - 1, y) else 0)
            out.alpha_composite(sheet.crop(((k % 4) * 16, (k // 4) * 16, (k % 4) * 16 + 16, (k // 4) * 16 + 16)), (x * 16, y * 16))
    return out

def check_sheet(path, rows, scale=3):
    """rows = [(제목, 시트, bgfn(x,y)->16px 칸)]."""
    from PIL import ImageDraw
    blocks = []
    for (title, sh, bgfn) in rows:
        raw = Image.new('RGBA', (76, 76), (40, 40, 46, 255))
        for k in range(16): raw.alpha_composite(bgfn(k % 4, k // 4), (6 + (k % 4) * 16, 6 + (k // 4) * 16))
        raw.alpha_composite(sh, (6, 6))
        ims = [raw] + [stamp(sh, SHAPES[k], bgfn) for k in ('blob5', 'spiral', 'nose_L')]
        blocks.append((title, ims))
    hgt = max(max(i.height for i in ims) for _, ims in blocks)
    W = max(sum(i.width for i in ims) + 10 * len(ims) for _, ims in blocks)
    o = Image.new('RGBA', (W * scale + 10, len(blocks) * (hgt * scale + 24) + 6), (24, 24, 28, 255)); d = ImageDraw.Draw(o)
    for r, (title, ims) in enumerate(blocks):
        y = 6 + r * (hgt * scale + 24); d.text((8, y), title + '   [16 variants | 5x5 blob | spiral | L + nose]', fill=(235, 235, 235, 255))
        x = 6
        for im in ims:
            o.alpha_composite(im.resize((im.width * scale, im.height * scale), Image.NEAREST), (x, y + 16)); x += im.width * scale + 10 * scale
    o.convert('RGB').save(path)

# ================================================================ 적대 검수 보정(2026-10-08, qa/airship.md 1~3) — 화가를 as_fix2 로 바꾼다
# (위 옛 화가는 기록으로 남긴다. *_sheet() 는 호출 때 이 이름을 찾으므로 아래 정의가 쓰인다.)
def puddle_cell(n, seed=1201):
    from as_fix2 import puddle_cell as f; return f(n, seed)
def oil_cell(n, seed=1301):
    from as_fix2 import oil_cell as f; return f(n, seed)
def coal_cell(n, seed=1401):
    from as_fix2 import coal_cell as f; return f(n, seed)

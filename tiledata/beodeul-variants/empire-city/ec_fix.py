# 제국 도시 보정 패스(2026-10-08, WAVE-BRIEF-4) — 시그니처 땅 덩이 오토타일 셋 + 지붕·건물 변형(ec_roofs.py).
#   autotile-oil-sump   : 공장 마당 기름 구덩이(막힘). 북쪽 둑은 3/4 로 콘크리트 앞면이 보이고 기름에 그늘, 남쪽은 그을린 기름 테.
#                         속은 거의 검은 기름(남보라) + 드문 무지갯빛 막(놋쇠·청록·보라 점 띠).
#   autotile-rain-puddle: 철판 대로·판석에 고인 빗물(걷기). 젖은 테(반투명 어둠) → 북쪽 패인 그늘 · 남쪽 밝은 물가 → 하늘 비친 회청 물 + 가로 반사 줄.
#   autotile-coal-dust  : 석탄 가루 덩이(걷기). 콘크리트 마당 위로 쏟아진 검은 가루 — 가장자리 성긴 알갱이, 속 가루 결 + 석탄 덩이(윗왼 빛 점).
# 칸 번호 = 위 1 + 오른쪽 2 + 아래 4 + 왼쪽 8 (fr_base.edge_depth 규약, 기존 autotile-curb·hazard 와 같다). 결정적.
import math
import numpy as np
from PIL import Image, ImageDraw
from ec_base import *
from ec_base import _hash
import ec_ground as EG

HERE = os.path.dirname(os.path.abspath(__file__))


def _r(*cs): return [hx(c) for c in cs]
OIL = _r('#040408', '#09090f', '#100f18', '#1a1824', '#262334', '#38334a', '#57506e')      # 기름(남보라 검정)
SHEEN = [hx(c) for c in ('#6a5a2a', '#2e6a6c', '#5a3a6a', '#7a6a38')]                      # 기름 막 무지개(탁하게 — 놋쇠·청록·보라)
RAIN = _r('#0a1220', '#142238', '#1f324e', '#2c4666', '#41607e', '#64849e', '#9cb6c8')     # 빗물(하늘 비친 회청)
COAL = _r('#050507', '#0c0c10', '#141419', '#1d1d24', '#282830', '#36363f', '#4e4e5a')     # 석탄 가루
CO = A(CONC); GS = A(GST)


def H_(x, y, s): return float(hash2(x, y, s))


# ---------------------------------------------------------------- 가장자리 깊이(모서리로 갈수록 들어감이 준다 — 오목 모서리 네모 혹 없음)
def edge_taper(n, inset, jag, rad, seed, size=16, foot=0.4, ramp=4.5):
    X, Y = np.meshgrid(np.arange(size), np.arange(size))
    miss = {'N': not (n & 1), 'E': not (n & 2), 'S': not (n & 4), 'W': not (n & 8)}
    j = {k: tnoise1(size, 4, seed + i + 1) for i, k in enumerate('NSWE')}
    def tap(t): return np.clip(np.minimum(t + 0.5, size - 0.5 - t) / ramp, 0, 1)
    def prof(k, t): return foot + tap(t) * (inset - foot + (j[k][t] - 0.5) * 2 * jag)
    d = {'N': Y - prof('N', X), 'S': (size - 1 - Y) - prof('S', X), 'W': X - prof('W', Y), 'E': (size - 1 - X) - prof('E', Y)}
    m = np.full((size, size), 99.0)
    for k in 'NESW':
        if miss[k]: m = np.minimum(m, d[k])
    for a, b in (('N', 'W'), ('N', 'E'), ('S', 'W'), ('S', 'E')):
        if miss[a] and miss[b]:
            da, db = d[a], d[b]; sel = (da < rad) & (db < rad)
            m = np.where(sel, np.minimum(m, rad - np.hypot(rad - da, rad - db)), m)
    return m


def nearest(n, fn):
    """화소마다 가장 가까운 빈 쪽(N/E/S/W, '' = 속). fn(n) → 깊이장(같은 잡음이라 합친 깊이와 이어진다)."""
    ms = []
    for k, bit in (('N', 1), ('E', 2), ('S', 4), ('W', 8)):
        ms.append(np.full((16, 16), 99.0) if n & bit else fn(15 & ~bit))
    st = np.stack(ms); idx = st.argmin(0); dmin = st.min(0)
    lab = np.array(list('NESW'))[idx]
    return np.where(dmin >= 50, '', lab)


def _cell(rgb, al): return Image.fromarray(np.dstack([rgb, al]).astype(np.uint8), 'RGBA')


# ================================================================ 오토타일 1: 기름 구덩이(막힘)
OP = dict(inset=3.0, jag=1.2, rad=7.0, seed=1311)
def _om(n): return edge_taper(n, OP['inset'], OP['jag'], OP['rad'], OP['seed'], foot=0.7, ramp=8.0)
def oil_cell(n):
    m = _om(n); lab = nearest(n, _om); s = OP['seed']
    rgb = np.zeros((16, 16, 3), int); al = np.zeros((16, 16), int)
    for y in range(16):
        for x in range(16):
            v = m[y, x]; sd = lab[y, x]
            if v < -1.6: continue
            if v < 0:                                                   # 칸 밖: 튄 기름 방울 · 그을음 점(반투명)
                if H_(x + n * 16, y, s + 1) > 0.84 and sd != 'N': rgb[y, x] = OIL[2]; al[y, x] = 150
                continue
            c = None; a = 255
            if sd == 'N':                                               # 북쪽 둑(3/4): 콘크리트 윗모 · 앞면 2단 · 기름에 진 그늘
                if v < 0.8: c = CO[5]
                elif v < 1.6: c = CO[3] if H_(x, y, s + 2) > 0.25 else CO[2]
                elif v < 2.6: c = CO[2] if H_(x, y, s + 3) > 0.4 else CO[1]
                elif v < 3.4: c = OIL[1]
                elif v < 4.4: c = OIL[1] if H_(x, y, s + 4) > 0.5 else OIL[2]
            else:
                if v < 0.9: c = OIL[3]; a = 120                          # 번진 그을음 테(반투명 — 콘크리트가 비친다)
                elif v < 1.8: c = OIL[2] if H_(x, y, s + 5) > 0.3 else OIL[3]
                elif v < 2.4: c = OIL[5] if sd in ('S', 'W') else OIL[4]    # 기름가 빛 테(남·서는 하늘 반사)
                elif v < 3.4: c = OIL[3]
            if c is None:                                               # 속: 검은 기름 + 16 주기 무지개 막 줄(속 칸끼리 이어진다)
                c = OIL[2]
                u = (y + int(round(math.sin(2 * math.pi * x / 16 + 0.8) * 2.0))) % 8
                if u == 2 and H_(x // 4, y, s + 6) > 0.35: c = SHEEN[(x // 4 + y // 8) % 3]
                elif u == 3 and H_(x // 4, y, s + 6) > 0.6: c = OIL[4]
                elif u == 6 and H_(x // 3, y, s + 7) > 0.7: c = OIL[1]
                if u == 2 and H_(x, y, s + 8) > 0.94: c = OIL[6]
            rgb[y, x] = c; al[y, x] = a
    return _cell(rgb, al)


def oil_sheet(): return sheet_from_cells([oil_cell(n) for n in range(16)])


# ================================================================ 오토타일 2: 빗물 웅덩이(걷기)
RP = dict(inset=2.6, jag=2.4, rad=6.5, seed=1321)
def _rm(n): return edge_taper(n, RP['inset'], RP['jag'], RP['rad'], RP['seed'], foot=0.5, ramp=6.0)
def rain_cell(n):
    m = _rm(n); lab = nearest(n, _rm); s = RP['seed']
    rgb = np.zeros((16, 16, 3), int); al = np.zeros((16, 16), int)
    for y in range(16):
        for x in range(16):
            v = m[y, x]; sd = lab[y, x]
            if v < -2.0: continue
            if v < 0:                                                   # 젖은 얼룩(바닥이 비치는 반투명 어둠, 성글게)
                if H_(x // 2 + n * 8, y // 2, s + 1) > 0.55 - v * 0.12: rgb[y, x] = RAIN[1]; al[y, x] = 70
                continue
            c = None; a = 255
            if v < 1.1: c = RAIN[1]; a = 105                           # 젖은 테
            elif sd == 'N':
                if v < 2.0: c = RAIN[1]                                 # 패인 북쪽 그늘(물이 고인 턱)
                elif v < 2.8: c = RAIN[2]
            else:
                if v < 1.9: c = RAIN[5] if sd in ('S', 'W') else RAIN[4]    # 남·서 물가 빛 테
                elif v < 2.6 and sd == 'E': c = RAIN[2]
            if c is None:                                               # 속: 하늘 비친 물(위 짙고 아래 밝게 — 16 주기 결) + 가로 반사 줄
                c = RAIN[3] if (y % 16) < 9 else RAIN[4]
                u = (y + int(round(math.sin(2 * math.pi * x / 16) * 1.0))) % 8
                if u == 5 and H_(x // 3, y, s + 3) > 0.45: c = RAIN[5]
                elif u == 1 and H_(x // 3, y, s + 4) > 0.55: c = RAIN[2]
                if u == 5 and H_(x, y, s + 5) > 0.92: c = RAIN[6]
            rgb[y, x] = c; al[y, x] = a
    return _cell(rgb, al)


def rain_sheet(): return sheet_from_cells([rain_cell(n) for n in range(16)])


# ================================================================ 오토타일 3: 석탄 가루 덩이(걷기)
CP = dict(inset=2.4, jag=3.0, rad=7.0, seed=1331)
def _cm(n): return edge_depth(n, CP['inset'], CP['jag'], CP['rad'], CP['seed'])
def coal_cell(n):
    m = _cm(n); lab = nearest(n, _cm); s = CP['seed']
    rgb = np.zeros((16, 16, 3), int); al = np.zeros((16, 16), int)
    for y in range(16):
        for x in range(16):
            v = m[y, x]; sd = lab[y, x]
            if v < -2.4: continue
            if v < 0:                                                   # 칸 밖: 흩어진 알갱이(1px, 드물게 2px 덩이)
                h = H_(x + n * 16, y, s + 1)
                if h > 0.85 + (-v) * 0.04: rgb[y, x] = COAL[2] if h < 0.95 else COAL[4]; al[y, x] = 255
                continue
            # 가루 결(16 주기): 톤 2~3 섞임, 가장자리는 성기고(바닥이 비친다) 남쪽은 두께 그늘
            h = H_(x, y, s + 2); g = tnoise(16, 16, 4, s + 3)[y, x]
            c = COAL[3] if g > 0.55 else COAL[2]
            if h > 0.93: c = COAL[4]
            if v < 1.4:
                if H_(x, y + n * 16, s + 4) < 0.3 + (1.4 - v) * 0.25: continue
                c = COAL[1] if sd == 'S' else (COAL[4] if sd in ('N', 'W') and h > 0.6 else COAL[3])
            elif v < 2.2 and sd == 'S': c = COAL[1]
            elif v < 2.2 and sd in ('N', 'W') and h > 0.4: c = COAL[4]
            # 석탄 덩이(3x2, 윗왼 빛 · 아래 그림자) — 16 주기, 속에서만
            if v >= 2.6:
                bx, by = x // 5, y // 4
                if H_(bx, by, s + 5) > 0.7:
                    lx, ly = x % 5, y % 4
                    if (lx, ly) in ((1, 1), (2, 1), (3, 1), (1, 2), (2, 2), (3, 2)):
                        c = COAL[6] if (lx, ly) == (1, 1) else (COAL[5] if ly == 1 else COAL[4])
                    elif (lx, ly) in ((2, 3), (3, 3), (4, 2)): c = COAL[0]
            rgb[y, x] = c; al[y, x] = 255
    return _cell(rgb, al)


def coal_sheet(): return sheet_from_cells([coal_cell(n) for n in range(16)])


SHEETS = {'autotile-oil-sump': oil_sheet, 'autotile-rain-puddle': rain_sheet, 'autotile-coal-dust': coal_sheet}

# ================================================================ 오토타일 시험 그림(check-autotile.png)
SHAPES = {
 'blob5': ["........",
           "..XXX...",
           ".XXXXX..",
           ".XXXXXX.",
           ".XXXXX..",
           "..XXXX..",
           "...X....",
           "........"],
 'spiral': ["..........",
            ".XXXXXXX..",
            ".X.....X..",
            ".X.XXX.X..",
            ".X.X.X.X..",
            ".X.X...X..",
            ".X.XXXXX..",
            ".X........",
            ".XXXXXXXX.",
            ".........."],
 'nose_L': ["..........",
            ".XXX......",
            ".XXX......",
            ".XXXX.....",
            ".XXXXXXXX.",
            "XXXXXXXXXX",
            ".XXXXXXX..",
            "..XX......",
            ".........."],
}


def bg_plate(w, h): return Image.fromarray(EG.plate_rgb(w, h, 9).astype(np.uint8), 'RGB').convert('RGBA')
def bg_soot(w, h):
    Y, X = np.mgrid[0:h, 0:w]; return Image.fromarray(CO[EG.soot_conc(X, Y, 7)], 'RGB').convert('RGBA')
def bg_flag(w, h):
    Y, X = np.mgrid[0:h, 0:w]; return Image.fromarray(GS[EG.flag_k(X, Y, 3)], 'RGB').convert('RGBA')


def stamp(sheet, rows, bgf):
    h = len(rows); w = len(rows[0]); out = bgf(w * 16, h * 16)
    on = lambda x, y: 0 <= x < w and 0 <= y < h and rows[y][x] == 'X'
    for y in range(h):
        for x in range(w):
            if not on(x, y): continue
            k = (1 if on(x, y - 1) else 0) | (2 if on(x + 1, y) else 0) | (4 if on(x, y + 1) else 0) | (8 if on(x - 1, y) else 0)
            out.alpha_composite(cell_of(sheet, k), (x * 16, y * 16))
    return out


def check_sheet(path, scale=3):
    rows = [('autotile-oil-sump (on soot concrete)', oil_sheet(), bg_soot),
            ('autotile-rain-puddle (on iron plate)', rain_sheet(), bg_plate),
            ('autotile-rain-puddle (on grey flagstone)', rain_sheet(), bg_flag),
            ('autotile-coal-dust (on soot concrete)', coal_sheet(), bg_soot)]
    blocks = []
    for (title, sh, bgf) in rows:
        raw = Image.new('RGBA', (76, 76), (40, 40, 46, 255)); raw.alpha_composite(bgf(64, 64), (6, 6)); raw.alpha_composite(sh, (6, 6))
        d = ImageDraw.Draw(raw)
        for k in range(1, 4):
            d.line([(6 + k * 16, 6), (6 + k * 16, 69)], fill=(255, 0, 255, 60)); d.line([(6, 6 + k * 16), (69, 6 + k * 16)], fill=(255, 0, 255, 60))
        blocks.append((title, [raw] + [stamp(sh, SHAPES[k], bgf) for k in ('blob5', 'spiral', 'nose_L')]))
    hgt = max(max(i.height for i in ims) for _, ims in blocks)
    W = max(sum(i.width for i in ims) + 10 * len(ims) for _, ims in blocks)
    o = Image.new('RGBA', (W * scale + 10, len(blocks) * (hgt * scale + 24) + 6), (24, 24, 28, 255)); d = ImageDraw.Draw(o)
    for r, (title, ims) in enumerate(blocks):
        y = 6 + r * (hgt * scale + 24); d.text((8, y), title + '   [16 variants | 5x5 blob | spiral | L + nose]', fill=(235, 235, 235, 255))
        x = 6
        for im in ims:
            o.alpha_composite(im.resize((im.width * scale, im.height * scale), Image.NEAREST), (x, y + 16)); x += im.width * scale + 10 * scale
    o.convert('RGB').save(path)


if __name__ == '__main__':
    import sys
    check_sheet(sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, 'check-autotile.png'))

# 미래 폐허 웨이브 5 보정 — 시그니처 땅 덩이 오토타일 셋 + 시험 그림(check-autotile.png).
# 기존 오토타일(깨진 포장 crack · 녹 번짐 rust · 오염 웅덩이 toxpool)과 겹치지 않는 재질만 더한다:
#   autotile-oilpool   기름 웅덩이(막힘)  — 검은 기름 + 무지개 막·광택, 북쪽 둑 앞면, 기름에 전 흙 테
#   autotile-dustheap  먼지·잔해 흙 덩이(걷기) — 콘크리트 부스러기·벽돌 조각·먼지, 낮은 둔덕(남쪽 그늘 테)
#   autotile-weedcrete 잡초 낀 포장(걷기) — 콘크리트·아스팔트 위로 기어든 오염 풀 깔개, 속에 깨진 판 조각
# 칸 번호 = 위 1 + 오른쪽 2 + 아래 4 + 왼쪽 8 (기존 *_autotile_* 와 같은 규약). 투명 덧그림(밑 땅이 비친다).
# 가장자리 깊이장은 desert-castle 보정의 edge_taper 규칙(칸 모서리로 갈수록 들어감이 줄어 오목 모서리 네모 혹이 없다)을 복사해 쓴다.
import math, os
import numpy as np
from PIL import Image, ImageDraw
from fr_base import *
from fr_base import _hash
import ground as GR
from fr_ground import sick_grass

HERE = os.path.dirname(os.path.abspath(__file__))
OIL = [hx(c) for c in ('#040406', '#0a0a10', '#121219', '#1b1b26', '#282836', '#3e3e54', '#6e6e8c')]   # 기름(푸른 흑)
SHEEN = [hx(c) for c in ('#3a2a5a', '#2a5a6a', '#6a5a2a', '#5a3a4a')]                                # 기름 막 무지개(보라·청록·호박·자주) 어둡게
PAINT = [hx(c) for c in ('#1a0c10', '#3a1a1e', '#5a2a28', '#7a3c32', '#985244', '#b06c58', '#c88c74')]
DIRT = chip_tex(16, 224).astype(int)


def edge_taper(n, inset, jag, rad, seed, size=16, foot=0.4, ramp=4.5):
    """edge_depth 와 같은 규약, 들어감(inset+jag)이 칸 모서리로 갈수록 foot 까지 준다(4비트 오목 모서리 혹 제거)."""
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
    """화소마다 가장 가까운 빈 쪽('N','E','S','W', 속이면 '')."""
    ms = {}
    for k, bit in (('N', 1), ('E', 2), ('S', 4), ('W', 8)):
        ms[k] = np.full((16, 16), 99.0) if n & bit else fn(15 & ~bit)
    st = np.stack([ms[k] for k in 'NESW']); idx = st.argmin(0); dmin = st.min(0)
    lab = np.array(list('NESW'))[idx]
    return np.where(dmin >= 50, '', lab)


# ================================================================ 1. 기름 웅덩이(막힘)
def oil_cell(n, seed=511):
    inset, jag, rad = 2.6, 1.6, 6.5
    fn = lambda k: edge_taper(k, inset, jag, rad, seed, foot=0.6, ramp=7.0)
    m = fn(n); lab = nearest(n, fn)
    X, Y = np.meshgrid(np.arange(16), np.arange(16))
    rgb = np.zeros((16, 16, 3), np.uint8); al = np.zeros((16, 16), np.uint8)
    for y in range(16):
        for x in range(16):
            v = m[y, x]; sd = lab[y, x]
            if v < -2.4: continue
            if v < 0:                                                   # 기름에 전 흙 테(바깥으로 성겨진다) + 튄 방울
                h = hash2(x + n * 16, y, seed + 1)
                if v > -1.0 or h > 0.55 + (-v) * 0.18:
                    if h > 0.93: c = OIL[2]
                    else: c = tuple((DIRT[y, x] * (0.42 if v > -1.0 else 0.6)).astype(int))
                else: continue
            elif sd == 'N' and v < 3.0:                                 # 북쪽 둑(3/4): 흙 앞면 2px + 물 그늘
                if v < 0.9: c = tuple((DIRT[y, x] * 0.72).astype(int))
                elif v < 2.0: c = tuple((DIRT[y, x] * 0.45).astype(int))
                else: c = OIL[1]
            elif v < 1.0: c = OIL[3] if sd in ('S', 'E') else OIL[2]    # 물가 끈적한 테
            elif v < 1.8 and sd in ('S', 'W', 'E'): c = OIL[5] if hash2(x, y, seed + 2) > 0.45 else OIL[4]   # 광택 테(빛 반사)
            else:                                                       # 속: 검은 기름 + 무지개 막(16 주기 물결 띠) + 광택 점
                c = OIL[2] if tnoise(16, 16, 8, seed + 9)[y, x] > .45 else OIL[1]
                if sd == 'N' and v < 5.0 and hash2(x // 2, y, seed + 6) > 0.5: c = OIL[4]   # 둑 밑 하늘 반사 띠(액체로 읽힘)
                ph = (y + int(round(math.sin(2 * math.pi * x / 16 + 0.8) * 1.6))) % 8
                if ph == 2 and hash2(x // 3, y, seed + 3) > 0.35: c = SHEEN[(x // 4 + y // 8) % 4]
                elif ph == 3 and hash2(x // 3, y, seed + 3) > 0.55: c = OIL[3]
                elif ph == 6 and hash2(x // 2, y, seed + 4) > 0.7: c = OIL[2]
                if hash2(x, y, seed + 5) > 0.975: c = OIL[6]
            rgb[y, x] = c; al[y, x] = 255
    return Image.fromarray(np.dstack([rgb, al]), 'RGBA')


def autotile_oilpool(): return sheet_from_cells([oil_cell(n) for n in range(16)])


# ================================================================ 2. 먼지·잔해 흙 덩이(걷기)
GRAV = recolor(chip_tex(160, 160), CONC, 2.6, 5.2)[1]                   # 칩셋 잔 자갈 결 → 콘크리트 부스러기 톤


def dust_cell(n, seed=531):
    inset, jag, rad = 2.4, 1.8, 6.5
    fn = lambda k: edge_taper(k, inset, jag, rad, seed, foot=0.5, ramp=6.0)
    m = fn(n); lab = nearest(n, fn)
    rgb = np.zeros((16, 16, 3), np.uint8); al = np.zeros((16, 16), np.uint8)
    C = A(CONC); PT = A(PAINT)
    dust = tnoise(16, 16, 8, seed + 2)
    for y in range(16):
        for x in range(16):
            v = m[y, x]; sd = lab[y, x]
            if v < -2.4: continue
            h = hash2(x + n * 16, y, seed + 1)
            if v < 0:                                                   # 날린 먼지 알(바깥으로 성겨진다)
                if h > 0.84 - (v + 2.4) * 0.06: c = tuple(C[3]) if h > 0.94 else tuple((DIRT[y, x] * 0.9 + C[4] * 0.1).astype(int))
                else: continue
            else:
                lit = min(1.0, v / 5.0)                                 # 둔덕: 가운데로 갈수록 밝다
                base = DIRT[y, x] * 0.45 + C[4] * 0.55
                c = tuple(np.clip(base * (0.86 + 0.14 * lit) * (0.95 if dust[y, x] < .4 else 1.0), 0, 255).astype(int))
                if v < 1.0:                                             # 가장자리 성긴 먼지(바탕이 비친다)
                    if h < 0.4: continue
                    c = tuple(C[3])
                elif v < 2.0 and sd == 'S': c = tuple(C[2]) if h > 0.25 else tuple(C[1])      # 남쪽 둔덕 그늘 테
                elif v < 2.0 and sd == 'E': c = tuple(C[3])
                elif v < 2.0 and sd in ('N', 'W') and h > 0.45: c = tuple(C[5])               # 북·서 빛 테
            rgb[y, x] = c; al[y, x] = 255
    # 콘크리트 부스러기(2x2 덩이, 위·왼 빛 · 아래 그늘)와 드문 벽돌 조각(3x2) — 칸마다 자리를 흔든다
    rnd = np.random.default_rng(seed + n * 7)
    for i in range(7):
        x0 = int(rnd.integers(1, 14)); y0 = int(rnd.integers(1, 13))
        if m[y0, x0] < 2.0 or m[min(15, y0 + 2), min(15, x0 + 1)] < 1.0: continue
        brick = i == 0 and rnd.random() < .6
        w = 3 if brick else 2
        R = PT if brick else C
        for dy in range(3):
            for dx in range(w):
                xx, yy = x0 + dx, y0 + dy
                if xx > 15 or yy > 15: continue
                k = (5 if (dy == 0 and dx == 0) else 4) if dy == 0 else (3 if dy == 1 else None)
                if k is None:                                           # 덩이 밑 그림자 1px
                    rgb[yy, xx] = (np.array(rgb[yy, xx]) * 0.7).astype(np.uint8); continue
                rgb[yy, xx] = R[k] if not brick else R[k]; al[yy, xx] = 255
    return Image.fromarray(np.dstack([rgb, al]), 'RGBA')


def autotile_dustheap(): return sheet_from_cells([dust_cell(n) for n in range(16)])


# ================================================================ 3. 잡초 낀 포장(걷기)
LAWN = sick_grass(GR.tex(*GR.TEX['lawn']).astype(np.uint8), np.full((16, 16), .92)).astype(int)
MEAD = sick_grass(GR.tex(*GR.TEX['meadow']).astype(np.uint8), np.full((16, 16), .92)).astype(int)
SK = A(SICK)


def weed_cell(n, seed=551):
    inset, jag, rad = 2.0, 3.2, 6.0
    fn = lambda k: edge_taper(k, inset, jag, rad, seed, foot=0.6, ramp=4.0)
    m = fn(n); lab = nearest(n, fn)
    rgb = np.zeros((16, 16, 3), np.uint8); al = np.zeros((16, 16), np.uint8)
    C = A(CONC)
    mead = tnoise(16, 16, 8, seed + 1) > 0.5
    for y in range(16):
        for x in range(16):
            v = m[y, x]; sd = lab[y, x]
            if v < -2.4: continue
            h = hash2(x + n * 16, y, seed + 2)
            if v < 0:                                                   # 판 줄눈으로 새어 나온 풀잎(세로 1~2px)
                if h > 0.86: c = tuple(SK[4])
                elif h > 0.80 and y < 15 and m[y + 1, x] >= 0: c = tuple(SK[2])
                else: continue
            else:
                c = tuple(MEAD[y, x] if mead[y, x] else LAWN[y, x])
                if v < 1.2:                                             # 풀 술(들쭉날쭉, 포장이 비친다)
                    if hash2(x, y + n * 16, seed + 3) < 0.3: continue
                    c = tuple(SK[2]) if sd == 'S' else (tuple(SK[5]) if sd in ('N', 'W') else tuple(SK[3]))
                elif v < 2.2 and sd == 'S': c = tuple(SK[1])                                         # 풀 깔개 두께 그늘
                elif v < 2.2 and sd in ('N', 'W') and hash2(x, y, seed + 4) > 0.4: c = tuple(SK[5])
                if v >= 3.0 and hash2(x // 4, y // 4, seed + 6) > 0.76 and (x % 4, y % 4) in ((1, 1), (2, 2), (3, 1)):
                    c = tuple(SK[5]) if (x % 4) == 1 else tuple(SK[2])         # 잔 풀포기 V
                if 1.2 <= v < 3.4 and hash2(x // 2, y, seed + 7 + n) > 0.86:   # 풀 틈으로 비치는 포장(투명) — 가장자리 근처만
                    if hash2(x, y // 2, seed + 8) > 0.4: continue
            rgb[y, x] = c; al[y, x] = 255
    return Image.fromarray(np.dstack([rgb, al]), 'RGBA')


def autotile_weedcrete(): return sheet_from_cells([weed_cell(n) for n in range(16)])


# ================================================================ 시험 그림
SHAPES = {
 'blob5': ["........", "..XXX...", ".XXXXX..", ".XXXXXX.", ".XXXXX..", "..XXXX..", "...X....", "........"],
 'spiral': ["..........", ".XXXXXXX..", ".X.....X..", ".X.XXX.X..", ".X.X.X.X..", ".X.X...X..", ".X.XXXXX..", ".X........", ".XXXXXXXX.", ".........."],
 'nose_L': ["..........", ".XXX......", ".XXX......", ".XXXX.....", ".XXXXXXXX.", "XXXXXXXXXX", ".XXXXXXX..", "..XX......", ".........."],
}


def stamp(sheet, rows, bg):
    h = len(rows); w = len(rows[0]); out = Image.new('RGBA', (w * 16, h * 16))
    for y in range(h):
        for x in range(w): out.alpha_composite(bg, (x * 16, y * 16))
    on = lambda x, y: 0 <= x < w and 0 <= y < h and rows[y][x] == 'X'
    for y in range(h):
        for x in range(w):
            if not on(x, y): continue
            k = (1 if on(x, y - 1) else 0) | (2 if on(x + 1, y) else 0) | (4 if on(x, y + 1) else 0) | (8 if on(x - 1, y) else 0)
            out.alpha_composite(cell_of(sheet, k), (x * 16, y * 16))
    return out


def bg_tiles():
    from fr_ground import ground_concrete, ground_asphalt, ground_sickgrass
    return {'sick grass': ground_sickgrass().crop((0, 0, 16, 16)), 'concrete': ground_concrete().crop((0, 0, 16, 16)),
            'asphalt': ground_asphalt().crop((0, 0, 16, 16))}


def check_sheet(path=None, scale=3):
    path = path or os.path.join(HERE, 'check-autotile.png')
    B = bg_tiles()
    rows = [('autotile-oilpool (on sick grass)', autotile_oilpool(), B['sick grass']),
            ('autotile-oilpool (on asphalt)', autotile_oilpool(), B['asphalt']),
            ('autotile-dustheap (on sick grass)', autotile_dustheap(), B['sick grass']),
            ('autotile-dustheap (on concrete)', autotile_dustheap(), B['concrete']),
            ('autotile-weedcrete (on concrete)', autotile_weedcrete(), B['concrete']),
            ('autotile-weedcrete (on asphalt)', autotile_weedcrete(), B['asphalt'])]
    blocks = []
    for (title, sh, bg) in rows:
        raw = Image.new('RGBA', (76, 76), (40, 40, 46, 255))
        for k in range(16): raw.alpha_composite(bg, (6 + (k % 4) * 16, 6 + (k // 4) * 16))
        raw.alpha_composite(sh, (6, 6))
        blocks.append((title, [raw] + [stamp(sh, SHAPES[k], bg) for k in ('blob5', 'spiral', 'nose_L')]))
    hgt = max(max(i.height for i in ims) for _, ims in blocks)
    W = max(sum(i.width for i in ims) + 10 * len(ims) for _, ims in blocks)
    o = Image.new('RGBA', (W * scale + 10, len(blocks) * (hgt * scale + 24) + 6), (24, 24, 28, 255)); d = ImageDraw.Draw(o)
    for r, (title, ims) in enumerate(blocks):
        y = 6 + r * (hgt * scale + 24); d.text((8, y), title + '   [16 variants | 5x5 blob | spiral | L + nose]', fill=(235, 235, 235, 255))
        x = 6
        for im in ims:
            o.alpha_composite(im.resize((im.width * scale, im.height * scale), Image.NEAREST), (x, y + 16)); x += im.width * scale + 10 * scale
    o.convert('RGB').save(path)
    return path


if __name__ == '__main__':
    print(check_sheet())

#!/usr/bin/env python3
"""월드맵 6판 생성기 — 사용자가 준 목표 월드맵 그림(tiledata/atlas-pick/worldmap-v6-target.md 실측)에 맞춘 「그린 형태」.

  python3 scripts/content/atlas-pick/worldmap_v6_gen.py            # 전부
  python3 scripts/content/atlas-pick/worldmap_v6_gen.py mountain   # 일부
  → tiledata/atlas-pick/candidates-worldmap/<slug>/v6-A.pxg (그다음 worldmap_check.py)

5판과 달라진 것(목표 실측 근거):
- 잡음 질감을 버리고 「읽히는 형태」로 그린다: 풀은 2~3px 획 뭉치, 산은 45° 사선 붓질 + 남·동쪽 세로 절벽면, 나무는 층진 침엽수 한 그루씩.
- 팔레트 worldmap6.pal (목표 실측 색). 물은 해안 가까이 밝고 멀수록 진하다. 해안은 풀 턱의 어두운 테 + 둥근 자갈 한두 줄, 거품 없음.
- 길은 2~3px 가느다란 구불길, 밭은 세로 줄무늬 육각 무늬, 초원은 옅은 올리브 얼룩(가장자리 흩뿌림).
모든 화소는 좌표·문법으로 직접 찍는다. 생성 그림 밑그림·축소 이식 없음(worldmap-v6/NOTES.md 「출처 검증」).
"""
import math, random, sys, pathlib, re
HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import worldmap_v4_gen as V4
from worldmap_v4_gen import Img, paint_bundle, facing, CAND, ROOT

V4.PAL_LINE = '@palette ../../palette/worldmap6.pal'
TITLE = '6판: 목표 월드맵 실측 — 그린 형태(사선 붓질·층진 침엽수·자갈 해안)'


def _rng(seed): return random.Random(seed)


def hh(x, y, s=0):
    """좌표 해시 0..1(결정적)."""
    n = (x * 374761393 + y * 668265263 + s * 2147483647) & 0xFFFFFFFF
    n = ((n ^ (n >> 13)) * 1274126177) & 0xFFFFFFFF
    return ((n ^ (n >> 16)) & 0xFFFF) / 65535.0


# ------------------------------------------------------------------ 풀 바탕(짙은 풀 + 밝은 얼룩 변형)
def gen_plains_base():
    """짙은 풀 6단 중 앞 5단. 2~3px 가로 획과 2px 세로 풀잎이 뭉친다. 세 변형은 획 개수를 같게 해 평균 명도가 같다."""
    out = Img(48, 16)
    for v in range(3):
        rng = _rng(600 + v)
        cell = [[2] * 16 for _ in range(16)]
        def stroke(n_, tone, horiz=True, wrap=True):
            for _ in range(n_):
                x, y = rng.randrange(16), rng.randrange(16)
                ln = rng.choice([2, 2, 3])
                for k in range(ln):
                    xx, yy = ((x + k) % 16, y) if horiz else (x, (y + k) % 16)
                    cell[yy][xx] = tone
        stroke(15, 1); stroke(11, 3); stroke(5, 0); stroke(7, 4); stroke(4, 1, False); stroke(3, 4, False)
        for y in range(16):
            for x in range(16): out.put(v * 16 + x, y, ('wgrass', cell[y][x]))
    return out


def gen_meadow():
    """옅은 올리브 초원 얼룩(5단). 가장자리는 짙은 풀과 격자·해시로 섞여 부드럽게 흩어진다."""
    rng = _rng(31); cell = {}
    for y in range(16):
        for x in range(16): cell[(x, y)] = 1
    for _ in range(20):
        x, y = rng.randrange(16), rng.randrange(16)
        for k in range(rng.choice([2, 3])): cell[((x + k) % 16, y)] = 2
    for _ in range(9):
        x, y = rng.randrange(16), rng.randrange(16)
        for k in range(2): cell[((x + k) % 16, y)] = 3
    for _ in range(9):
        x, y = rng.randrange(16), rng.randrange(16); cell[(x, y)] = 0
        cell[(x, (y + 1) % 16)] = 0
    tex = lambda x, y: ('wmead', cell[(x % 16, y % 16)])
    def edge(role, x, y, d, m, ext):
        h = hh(x, y, 4)
        if d == 1: return ('wgrass', 3) if (x + y) % 2 == 0 else (('wmead', 0) if h < .6 else ('wgrass', 4))
        if d == 2: return ('wgrass', 4) if h < .3 else (('wmead', 0) if h < .7 else ('wmead', 1))
        if d == 3 and h < .25: return ('wmead', 0)
        return None
    return paint_bundle('meadow', 49, 4, 3, 5, tex, edge, title='meadow v6')[0]


# ------------------------------------------------------------------ 물 / 해안
def sea_tex(seed=13, deep=False):
    """물 4단: 바탕 2단 + 가로 2~3px 잔물결 획. 반짝임은 거의 없다(목표에 없음)."""
    rng = _rng(seed); cell = {}
    for y in range(16):
        for x in range(16): cell[(x, y)] = 2
    for _ in range(14):
        x, y = rng.randrange(16), rng.randrange(16)
        for k in range(rng.choice([2, 3, 3])): cell[((x + k) % 16, y)] = 1
    for _ in range(9 if not deep else 5):
        x, y = rng.randrange(16), rng.randrange(16)
        for k in range(rng.choice([2, 3])): cell[((x + k) % 16, y)] = 3
    for _ in range(3):
        x, y = rng.randrange(16), rng.randrange(16); cell[(x, y)] = 4
    return lambda x, y: ('wsea', cell[(x % 16, y % 16)])


def _bfs_land(img, cx, cy, maxd):
    """타일 안 투명 화소(=땅쪽)의 불투명(물)으로부터 4방향 거리."""
    x0, y0 = cx * 16, cy * 16
    dist = {}; front = []
    for y in range(16):
        for x in range(16):
            if img.g[y0 + y][x0 + x] is None: continue
            for a, b in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                X, Y = x + a, y + b
                if 0 <= X < 16 and 0 <= Y < 16 and img.g[y0 + Y][x0 + X] is None and (X, Y) not in dist:
                    dist[(X, Y)] = 1; front.append((X, Y))
    while front:
        nxt = []
        for x, y in front:
            for a, b in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                X, Y = x + a, y + b
                if 0 <= X < 16 and 0 <= Y < 16 and img.g[y0 + Y][x0 + X] is None and (X, Y) not in dist and dist[(x, y)] < maxd:
                    dist[(X, Y)] = dist[(x, y)] + 1; nxt.append((X, Y))
        front = nxt
    return dist


def pebble(x, y, sx=0):
    """둥근 자갈: 3×2 칸마다 한 알(있을 확률 .75). 왼위 밝게·아래 어둡게, 틈은 어두운 돌."""
    gx, gy = (x + sx) // 3, y // 2
    h = hh(gx, gy, 9)
    lx, ly = (x + sx) % 3, y % 2
    if h > .78: return ('wpebble', 1)
    if (lx == 0 and ly == 0) or (lx == 2 and ly == 0): return ('wpebble', 1 if lx == 2 else 3)
    if ly == 0: return ('wpebble', 4 if h < .5 else 3)
    return ('wpebble', 2 if lx == 2 else 3)


def gen_coast():
    """물은 해안 쪽이 밝고(5c8ba2) 깊이 갈수록 진하다. 땅쪽은 물 옆 자갈 두 줄 → 풀 턱의 어두운 초록갈색 테 1~2px."""
    tex = sea_tex(13)
    def water_edge(role, x, y, d, m, ext):
        h = hh(x, y, 2)
        if d == 1: return ('wsea', 5 if h < .75 else 4)
        if d == 2: return ('wsea', 4 if h < .6 else 3)
        if d == 3: return ('wsea', 3 if h < .55 else 2)
        return None
    img, P = paint_bundle('coast', 74, 3, 2, 4, tex, water_edge, title='coast_grass v6')
    for cx, cy in V4.LAYOUT.values():
        if (cx, cy) == V4.LAYOUT['body_alt']: continue
        x0, y0 = cx * 16, cy * 16
        for (x, y), d in _bfs_land(img, cx, cy, 5).items():
            h = hh(x + cx * 16, y + cy * 16, 3)
            if d <= 2: t = pebble(x + cx * 16, y + cy * 16)
            elif d == 3: t = ('wgrass', 0 if h < .55 else 1)
            elif d == 4: t = ('wgrass', 1 if h < .5 else 2) if h < .8 else None
            else: t = None
            if t is not None: img.put(x0 + x, y0 + y, t)
    return img


def gen_sea_deep():
    tex = sea_tex(17, True)
    def edge(role, x, y, d, m, ext):
        if d == 1: return ('wsea', 1)
        if d == 2 and (x + y) % 2 == 0: return ('wsea', 1)
        return None
    return paint_bundle('sea_deep', 85, 3, 2, 4, tex, edge, title='sea_deep v6')[0]


# ------------------------------------------------------------------ 길(2~3px 가느다란 구불길)
def gen_road():
    """마스크는 6~8px 띠지만 바깥 두 줄은 풀 색으로 칠해 눈에 보이는 길은 2~4px. 가운데 밝은 흙 + 어두운 테."""
    def tex(x, y):
        h = hh(x % 16, y % 16, 7)
        return ('wdirt', 1 if h < .55 else (2 if h < .85 else 0))
    def edge(role, x, y, d, m, ext):
        h = hh(x, y, 8)
        if d == 1: return ('wgrass', 2 if h < .5 else (3 if h < .8 else 1))
        if d == 2: return ('wdirt', 0 if h < .8 else 1)
        if d == 3: return ('wdirt', 1 if h < .7 else 2)
        return None
    return paint_bundle('road', 20, 4, 3, 4, tex, edge, title='road v6')[0]


# ------------------------------------------------------------------ 산(45° 사선 붓질 + 남·동 세로 절벽)
def _hatch_tex(seed):
    rng = _rng(seed); cell = {}
    for y in range(16):
        for x in range(16): cell[(x, y)] = 3
    def diag(n_, tone, lo, hi):
        for _ in range(n_):
            x, y = rng.randrange(16), rng.randrange(16)
            for k in range(rng.randint(lo, hi)): cell[((x + k) % 16, (y - k) % 16)] = tone
    diag(12, 2, 3, 5); diag(10, 4, 3, 4); diag(4, 5, 2, 3); diag(5, 2, 2, 3); diag(3, 1, 2, 3)
    ledge = {}
    for _ in range(0):                       # 지층 턱: 밝은 윗줄 + 어두운 세로 절벽 2~3줄(면적 약 17%)
        x, y = rng.randrange(16), rng.randrange(1, 13)
        ln = rng.randint(8, 13); dep = rng.choice([3, 4])
        for k in range(ln):
            xx = (x + k) % 16
            ledge[(xx, y)] = ('wrock', 6 if k % 3 else 5)
            for j in range(1, dep + 1): ledge[(xx, (y + j) % 16)] = ('wcliff', 0 if j == dep else (1 if (xx % 3) else 2))
    return lambda x, y: ledge.get((x % 16, y % 16)) or ('wrock', cell[(x % 16, y % 16)])


def gen_mountain():
    tex = _hatch_tex(58)
    def edge(role, x, y, d, m, ext):
        f = facing(x, y, ext, 1)
        h = hh(x, y, 5)
        if f < 0:                            # 남·동쪽 = 세로 절벽면(3단, 세로 결)
            if d == 1: return ('wcliff', 0 if h < .6 else 1)
            if d == 2: return ('wcliff', 1 if (x % 3) else 2)
            if d == 3: return ('wcliff', 2 if (x % 2) else 3)
        elif f > 0:                          # 북·서쪽 = 밝은 윗면 테
            if d == 1: return ('wrock', 5 if h < .55 else 4)
            if d == 2 and h < .6: return ('wrock', 4)
        else:
            if d == 1: return ('wrock', 2)
        return None
    img = paint_bundle('mountain', 41, 4, 3, 5, tex, edge, title='mountain v6')[0]
    return img


# ------------------------------------------------------------------ 산 절벽면(남면 3 + 동면 3, 칸 통째)
def gen_mountain_cliff():
    """산 덩이의 남·동쪽 가장자리와 안쪽 지층 턱에 얹는 어두운 세로 절벽면. 남면: 밝은 윗입술 2줄 + 세로 결. 동면: 왼쪽은 비우고 오른쪽 6~8px 절벽."""
    out = Img(96, 16)
    for k in range(3):
        rng = _rng(700 + k)
        for x in range(16):
            top = 2 + (1 if hh(x, k, 71) < .3 else 0)
            for y in range(16):
                if y < top - 1: t = ('wrock', 5 if hh(x, y, 72 + k) < .5 else 4)
                elif y < top: t = ('wrock', 3)
                else:
                    r = hh(x // 2, y // 4, 73 + k)
                    t = ('wcliff', 1 if (x % 3 == 0) else (2 if r < .5 else 1))
                    if y >= 13: t = ('wcliff', 0 if hh(x, y, 74) < .7 else 1)
                    if y >= 6 and x % 5 == k: t = ('wcliff', 0)
                out.put(k * 16 + x, y, t)
    for k in range(3):
        for y in range(16):
            w = 6 + (1 if hh(y, k, 75) < .4 else 0) + (1 if hh(y, k, 76) < .2 else 0)
            for x in range(16 - w):
                out.put(48 + k * 16 + x, y, ('wrock', 3 if hh(x, y, 78) < .6 else (4 if hh(x, y, 79) < .5 else 2)))
            for x in range(16 - w, 16):
                edge = x == 16 - w
                t = ('wrock', 3 if hh(x, y, 77) < .5 else 2) if edge else ('wcliff', 1 if (y % 3) else 2)
                if x >= 14: t = ('wcliff', 0)
                out.put(48 + k * 16 + x, y, t)
    return out


def gen_cliff_plateau():
    """솟은 언덕(윗면 풀·바위 섞임): 위는 올리브 갈색 얼룩, 남·동쪽 어두운 세로 벽."""
    rng = _rng(66); cell = {}
    for y in range(16):
        for x in range(16): cell[(x, y)] = ('whill', 2)
    for _ in range(18):
        x, y = rng.randrange(16), rng.randrange(16)
        for k in range(rng.choice([2, 3])): cell[((x + k) % 16, y)] = ('whill', rng.choice([1, 3]))
    for _ in range(6):
        x, y = rng.randrange(16), rng.randrange(16); cell[(x, y)] = ('wrock', 4)
    tex = lambda x, y: cell[(x % 16, y % 16)]
    def edge(role, x, y, d, m, ext):
        f = facing(x, y, ext, 1); h = hh(x, y, 6)
        if f < 0:
            if d == 1: return ('wcliff', 0)
            if d == 2: return ('wcliff', 1 if x % 2 else 2)
            if d == 3: return ('wcliff', 2 if x % 3 else 3)
        if f > 0 and d == 1: return ('wrock', 4 if h < .5 else 5)
        return None
    return paint_bundle('cliff_plateau', 71, 4, 3, 5, tex, edge, title='cliff_plateau v6')[0]


def _mount_peak(peaks, seed, snow=True):
    """32×32 봉우리 한 조각. 층층이 쌓인 윗면(45° 붓질)과 그 아래 세로 절벽면, 왼쪽 위 빛, 오른쪽이 어둡다, 정상 몇 화소만 눈."""
    rng = _rng(seed); img = Img(32, 32)
    top = [99.0] * 32; who = [0] * 32
    for x in range(32):
        for i, (cx, ay, sl) in enumerate(peaks):
            y = ay + abs(x + .5 - cx) * sl + (hh(x, i, seed) - .5) * 2.2
            if y < top[x]: top[x] = y; who[x] = i
    top = [int(round(t)) for t in top]
    for x in range(32):
        cx, ay, sl = peaks[who[x]]
        left = x + .5 < cx
        for y in range(top[x], 31):
            depth = y - top[x]
            lvl, o = divmod(depth, 8)
            hsh = hh(x, y, seed + 3)
            if o >= 6 - (1 if lvl == 0 else 0) and y < 29:                # 세로 절벽면(층 아래 2~3줄)
                t = ('wcliff', 1 if (x % 3 == 0 or hsh < .25) else 2) if not left else ('wcliff', 2 if hsh < .6 else 3)
                if o == 6 - (1 if lvl == 0 else 0): t = ('wcliff', 1)
            else:                                                       # 윗면: 사선 붓질
                stripe = ((x + y) // 2 + lvl) % 3
                base = (4 if left else 3) - lvl * 0
                if stripe == 0: base += 1 if left else -1
                if stripe == 2 and hsh < .5: base -= 1
                if depth == 0: base = 5 if left else 4
                t = ('wrock', max(1, min(5, base)))
            img.put(x, y, t)
    if snow:
        for i, (cx, ay, sl) in enumerate(peaks):
            for x in range(int(cx) - 3, int(cx) + 4):
                if 0 <= x < 32 and who[x] == i:
                    for k in range(0, 3 if abs(x - cx) < 2 else 2):
                        y = top[x] + k
                        if img.get(x, y) is not None and hh(x, y, seed + 9) < (.9 if k == 0 else .55):
                            img.put(x, y, ('wsnow', (4 if x + .5 < cx else 2) + (0 if k else 1) if k < 2 else 1))
    for x in range(32):                                                 # 아래 발치 몇 줄은 짙게(풀로 이어지는 그림자)
        for y in (28, 29, 30):
            t = img.get(x, y)
            if t is not None and isinstance(t, tuple): img.put(x, y, ('wcliff', 0 if y == 30 else 1))
    for x in range(1, 32):                                              # 동·남쪽으로 드리운 그림자
        if img.get(x, 30) is None and img.get(x - 1, 30) is not None: img.put(x, 30, '-'); img.put(x, 31, '-')
    return img


def gen_mountain_peaks():
    out = Img(96, 32)
    out.blit(_mount_peak([(15, 3, 1.5)], 3), 0, 0)
    out.blit(_mount_peak([(9, 12, 1.4), (22, 4, 1.35)], 4), 32, 0)
    out.blit(_mount_peak([(6, 15, 1.3), (16, 8, 1.4), (26, 16, 1.3)], 5, snow=False), 64, 0)
    return out


# ------------------------------------------------------------------ 침엽수(폭 8·키 14, 층진 삼각) / 활엽 / 숲 덩이
TREE_TONE = {  # 층 안의 명암(wpine 번호)
    'lit': 5, 'mid': 4, 'body': 3, 'shade': 2, 'dark': 1, 'base': 0}


def _fir(img, cx, top, kind='A', ramp='wpine'):
    """층진 침엽수. A: 세 층 폭 8·키 14 / B: 두 층 넓은 폭 10·키 12 / C: 길쭉한 가문비 폭 6·키 15.
    왼쪽 밝게·오른쪽 어둡게, 층 밑선은 어둡게, 줄기는 거의 안 보이고 밑에 어두운 한 줄 그림자."""
    tiers = {'A': [(0, 5, 2), (3, 9, 3), (7, 14, 4)], 'B': [(0, 6, 3), (4, 12, 5)], 'C': [(0, 5, 1), (3, 8, 2), (6, 11, 3), (9, 15, 3)]}[kind]
    h = tiers[-1][1]
    for (y0, y1, hw) in tiers:
        n = y1 - y0
        for k in range(n):
            w = max(0, round(hw * (k + 1) / n)) if n > 1 else hw
            if k == 0: w = max(0, hw - 2) if y0 else 0
            for dx in range(-w, w + 1):
                lum = 3
                if dx < 0: lum = 4 if k < n - 1 else 3
                elif dx > 0: lum = 2
                if k >= n - 1: lum = max(1, lum - 1)                  # 층 밑선
                if dx == 0 and k < 2: lum = 4
                if dx == -w and w > 1 and k > 0 and dx < 0 and k % 2 == 0: lum = 5   # 왼쪽 잎끝 반짝
                img.put(cx + dx, top + y0 + k, (ramp, lum))
    img.put(cx, top + h, ('wbark', 0)); img.put(cx + 1, top + h, ('wpine', 0)); img.put(cx - 1, top + h, ('wpine', 0))
    return h


def _broad(img, cx, top, r=5):
    """활엽수 둥근 수관: 왼위 밝은 잎 덩이, 오른아래 어둡게."""
    for y in range(-r, r + 1):
        for x in range(-r, r + 1):
            if x * x + y * y * 1.15 <= r * r + 1:
                dx, dy = x + .5, y + .5
                lit = -(dx * .7 + dy * .7)
                hsh = hh(cx + x, top + y, 12)
                t = 3 if lit > 3 else (2 if lit > -2 else 1)
                if hsh < .2: t = min(5, t + 1)
                if hsh > .85: t = max(0, t - 1)
                img.put(cx + x, top + r + y, ('wleaf', t))
    img.put(cx, top + 2 * r + 1, ('wbark', 0)); img.put(cx - 1, top + 2 * r + 1, ('wleaf', 0)); img.put(cx + 1, top + 2 * r + 1, ('wleaf', 0))


def gen_trees_scatter():
    """홀로 선 침엽수 셋(A·B·C 형)."""
    out = Img(48, 16)
    for i, (kind, cx, top) in enumerate((('A', 8, 0), ('C', 7, 0), ('B', 8, 2))):
        tmp = Img(16, 16); h = _fir(tmp, cx, top, kind)
        out.blit(tmp, i * 16, 0)
    return out


def _cluster(img, rows, kinds, seed, ox=0, oy=0):
    rng = _rng(seed); items = []
    for (y, xs) in rows:
        for x in xs: items.append((y, x, rng.choice(kinds)))
    for y, x, k in sorted(items):
        _fir(img, x, y, k)


def gen_conifer_crowns():
    """32×32 침엽수림 덩이: 세로 열로 촘촘하게 앞줄이 뒷줄을 가린다."""
    out = Img(96, 32)
    lay = [
        [(2, [10, 17, 24]), (6, [6, 13, 20]), (10, [10, 17, 24, 3]), (14, [7, 14, 21, 28]), (17, [4, 11, 18, 25])],
        [(1, [15]), (5, [11, 18]), (9, [7, 14, 21]), (13, [10, 17, 24, 4]), (17, [7, 14, 21, 28])],
        [(3, [8, 16, 24]), (8, [12, 20, 4]), (12, [8, 16, 24, 28]), (16, [12, 20, 4])],
    ]
    for i, rows in enumerate(lay):
        tmp = Img(32, 32); _cluster(tmp, rows, 'AAABC', 90 + i)
        out.blit(tmp, i * 32, 0)
    return out


def gen_forest_crowns():
    """32×32 활엽 숲 덩이 세 조각(짙은 잎 덩이가 서로 가림)."""
    out = Img(96, 32)
    lay = [[(16, 13), (7, 17), (24, 16), (12, 4), (21, 6)], [(9, 12), (22, 12), (15, 5), (6, 22), (25, 21), (16, 19)], [(12, 8), (23, 9), (7, 18), (18, 17), (27, 20)]]
    for i, ts in enumerate(lay):
        tmp = Img(32, 32)
        for cx, top in sorted(ts, key=lambda t: t[1]): _broad(tmp, cx, top, 5)
        out.blit(tmp, i * 32, 0)
    return out


def _tree_tex(kinds, spots, seed, ramp='wpine'):
    """16×16 주기 숲 바탕: 어두운 바탕 위에 나무를 wrap 으로 촘촘히."""
    img = Img(48, 48)
    for y in range(48):
        for x in range(48): img.put(x, y, (ramp, 1 if hh(x % 16, y % 16, seed) < .7 else 0))
    for (cx, top, k) in spots:
        for ox in (0, 16, 32):
            for oy in (0, 16, 32):
                pass
    tmp = Img(48, 48)
    items = sorted([(t, c, k) for (c, t, k) in spots for _ in (0,)])
    for oy in (-16, 0, 16):
        for ox in (-16, 0, 16):
            for top, cx, k in items:
                if kinds == 'broad': _broad(img, cx + 16 + ox, top + 16 + oy, 5)
                else: _fir(img, cx + 16 + ox, top + 16 + oy, k)
    return lambda x, y: img.get(16 + x % 16, 16 + y % 16)


def gen_conifer():
    spots = [(3, 2, 'A'), (11, 3, 'A'), (7, 8, 'C'), (14, 10, 'A'), (1, 12, 'B')]
    tex = _tree_tex('fir', spots, 3)
    def edge(role, x, y, d, m, ext):
        f = facing(x, y, ext, 1)
        if d == 1 and f < 0: return ('wpine', 0)
        return None
    return paint_bundle('conifer', 63, 4, 3, 5, tex, edge, title='conifer v6')[0]


def gen_forest():
    spots = [(3, 0, 'x'), (12, 2, 'x'), (7, 8, 'x'), (0, 9, 'x'), (14, 11, 'x')]
    tex = _tree_tex('broad', spots, 5, 'wleaf')
    def edge(role, x, y, d, m, ext):
        f = facing(x, y, ext, 1)
        if d == 1 and f < 0: return ('wleaf', 0)
        return None
    return paint_bundle('forest', 52, 4, 3, 5, tex, edge, title='forest v6')[0]


# ------------------------------------------------------------------ 밭(세로 줄무늬 육각 무늬 + 어두운 가장자리)
def _field(ramp, seed, tones, dark=0, rim=1):
    rng = _rng(seed)
    col = [tones[i % len(tones)] for i in (0, 1, 2, 1)]
    cell = {}
    for x in range(16):
        base = col[x % 4]
        y = 0
        while y < 16:
            ln = rng.choice([3, 4, 5, 6])
            t = base if rng.random() > .3 else col[(x + 1) % 4]
            for k in range(ln): cell[(x, (y + k) % 16)] = t
            y += ln
    for _ in range(4):
        x, y = rng.randrange(16), rng.randrange(16); cell[(x, y)] = tones[-1]
    tex = lambda x, y: (ramp, cell[(x % 16, y % 16)])
    def edge(role, x, y, d, m, ext):
        f = facing(x, y, ext, 1)
        if d == 1: return (ramp, dark)
        if d == 2 and f < 0: return (ramp, 1)
        if d == 2 and f > 0: return (ramp, rim)
        return None
    return tex, edge


def gen_field_wheat():
    tex, edge = _field('wfield', 12, [5, 4, 3, 2], 0, 2)
    return paint_bundle('field_wheat', 83, 3, 2, 4, tex, edge, title='field_wheat v6')[0]


def gen_field_crop():
    tex, edge = _field('wcrop', 15, [5, 4, 3, 2], 0, 1)
    return paint_bundle('field_crop', 87, 3, 2, 4, tex, edge, title='field_crop v6')[0]


# ------------------------------------------------------------------ 강가·물가 돌
def gen_shore_rocks():
    """물가 돌: 3~6px 둥근 회색 돌 한두 개. 밝은 왼위, 어두운 아래, 물속 그림자."""
    out = Img(48, 16)
    lay = [[(5, 8, 3), (11, 5, 2)], [(8, 9, 4)], [(4, 6, 2), (10, 10, 3), (12, 4, 2)]]
    for i, rocks in enumerate(lay):
        for cx, cy, r in rocks:
            for y in range(-r, r + 1):
                for x in range(-r - 1, r + 2):
                    if (x / (r + 1.0)) ** 2 + (y / float(r)) ** 2 <= 1.0:
                        lit = -(x * .6 + y * .8)
                        t = 4 if lit > r * .5 else (3 if lit > -r * .3 else 2)
                        if y == r or (y == r - 1 and abs(x) < r - 1): t = 1
                        out.put(i * 16 + cx + x, cy + y, ('wpebble', t))
            for x in range(-r, r + 2): out.put(i * 16 + cx + x, cy + r + 1, '-')
    return out


# ------------------------------------------------------------------ 성벽·성곽선
def _wall_row_h(img, x0, x1, y0):
    """가로 돌담(정면, 두께 5): 윗면 밝게 → 몸통 → 아래 그림자."""
    for x in range(x0, x1):
        m = ((x // 4) + 1) % 2
        img.put(x, y0, ('wstone', 6 if hh(x, 1, 21) < .5 else 5))
        img.put(x, y0 + 1, ('wstone', 5))
        img.put(x, y0 + 2, ('wstone', 4 if (x + 2 * m) % 4 else 3))
        img.put(x, y0 + 3, ('wstone', 3 if (x + 2 * (1 - m)) % 4 else 2))
        img.put(x, y0 + 4, ('wstone', 1))
        img.put(x, y0 + 5, '-')


def gen_wall_h():
    out = Img(16, 16); _wall_row_h(out, 0, 16, 5); return out


def gen_wall_v():
    """세로 돌담(위에서 본 얇은 벽): 3px 폭, 왼쪽 밝게·오른쪽 어둡게 + 오른쪽 그림자."""
    out = Img(16, 16)
    for y in range(16):
        out.put(6, y, ('wstone', 5)); out.put(7, y, ('wstone', 4 if y % 4 else 3)); out.put(8, y, ('wstone', 3 if y % 4 else 2)); out.put(9, y, ('wstone', 1))
        out.put(10, y, '-')
    return out


def gen_wall_tower():
    """정사각 감시탑 16×16: 2단 총안 + 어두운 문, 아래 그림자."""
    out = Img(16, 16)
    for y in range(4, 14):
        for x in range(3, 13):
            t = 4
            if x == 3: t = 5
            elif x >= 11: t = 2
            elif y % 3 == 0 and (x + y) % 2 == 0: t = 3
            out.put(x, y, ('wstone', t))
    for x in range(2, 14):
        for k in range(2): out.put(x, 3 - k, ('wstone', 6 if k == 0 else 5)) if (x - 2) % 3 != 2 else None
    for x in range(2, 14): out.put(x, 4, ('wstone', 1)) if (x - 2) % 3 == 2 else None
    for y in range(9, 13):
        for x in range(7, 9): out.put(x, y, ('wink', 0))
    for x in range(3, 13): out.put(x, 14, ('wstone', 0))
    for x in range(3, 14): out.put(x, 15, '-')
    return out


# ------------------------------------------------------------------ 3판 조각 재색(pxg 텍스트 리맵)
STEP = {
    'wsea': {1: 1, 2: 2, 3: 3, 4: 4, 5: 5},
    'wriver': {},
    'wdirt': {1: 1, 2: 2, 3: 3, 4: 3, 5: 4},
    'wgrass': {1: 1, 2: 2, 3: 3, 4: 3, 5: 4},
    'whill': {},
    'wsand': {},
    'wstone': {1: 1, 2: 2, 3: 3, 4: 4, 5: 5},
    'wrock': {},
}


def remap_v3(slug):
    src = (CAND / slug / 'v3-A.pxg').read_text(encoding='utf-8').splitlines()
    out = []
    for ln in src:
        if ln.startswith('@palette'): ln = V4.PAL_LINE
        elif ln.startswith('//'): ln = f'// {slug} v6-A ({TITLE}; v3-A 재색)'
        else:
            m = re.match(r'@mat (\S) (\w+) (\d+)$', ln)
            if m:
                k, ramp, s = m.group(1), m.group(2), int(m.group(3))
                s = STEP.get(ramp, {}).get(s, s)
                ln = f'@mat {k} {ramp} {s}'
        out.append(ln)
    return out


def write_remap(slug):
    p = CAND / slug / 'v6-A.pxg'
    p.write_text('\n'.join(remap_v3(slug)) + '\n', encoding='utf-8')
    return p


JOBS = {
    'plains_base': gen_plains_base, 'meadow': gen_meadow, 'sea_deep': gen_sea_deep, 'coast_grass': gen_coast,
    'road': gen_road, 'mountain': gen_mountain, 'mountain_cliff': gen_mountain_cliff, 'cliff_plateau': gen_cliff_plateau, 'mountain_peaks': gen_mountain_peaks,
    'conifer': gen_conifer, 'forest': gen_forest, 'conifer_crowns': gen_conifer_crowns, 'forest_crowns': gen_forest_crowns,
    'trees_scatter': gen_trees_scatter, 'field_wheat': gen_field_wheat, 'field_crop': gen_field_crop,
    'shore_rocks': gen_shore_rocks, 'wall_h': gen_wall_h, 'wall_v': gen_wall_v, 'wall_tower': gen_wall_tower,
}
REMAP = ['shoal', 'river', 'bridge_h', 'bridge_v', 'hills']
try:
    import worldmap_v6_icons
    JOBS.update(worldmap_v6_icons.ICON_JOBS)
except ImportError:
    pass


def main():
    names = sys.argv[1:] or list(JOBS) + REMAP
    for n in names:
        if n in REMAP: p = write_remap(n)
        else:
            p = CAND / n / 'v6-A.pxg'
            JOBS[n]().write(p, f'{n} v6-A ({TITLE})')
        print('wrote', p.relative_to(ROOT))


if __name__ == '__main__':
    main()

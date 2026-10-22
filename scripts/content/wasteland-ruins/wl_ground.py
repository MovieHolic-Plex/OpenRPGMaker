"""wasteland_ruins 바닥 — 황무지 흙 4 · 금 간 아스팔트 오토타일(4방향 16마스크) + 낱칸 변형 2 · 금 간 콘크리트 판 3 · 투명 덧그림(잔해 3·잡초 3·기름 웅덩이).

마스크 비트 N=1 E=2 S=4 W=8 (그 방향 이웃이 아스팔트면 켠다). 마스크 m 칸은 조각 안 (m%4, m//4).
이웃이 없는 쪽은 아스팔트가 흙으로 부서져 끝난다(들쭉날쭉한 가장자리, 남쪽은 1화소 앞면 + 흙 그림자).
바닥 칸끼리 이음: 모든 흙·아스팔트 칸은 가장자리 3화소 띠를 같은 바탕 결(seed 0)로 칠하고 안쪽만 변형마다 다르다.
"""
from wl_kit import *

TERRAIN, FLAT = 'terrain', 'flat'
N, E, Sb, W = 1, 2, 4, 8
AUTO = {}


def edge_d(x, y): return min(x, y, 15 - x, 15 - y)


def dirt_cell(c, ox, oy, seed):
    for y in range(16):
        for x in range(16):
            c.P(ox + x, oy + y, dirt_px(x, y, 0))


# ------------------------------------------------------------------ 흙 4
def _dirt(v):
    def draw(c):
        dirt_cell(c, 0, 0, 11 + v * 7)
        sh = K('dirt', 1)
        if v == 0:
            pebble(c, 4, 5, 2, shade=sh); pebble(c, 10, 9, 1, shade=sh); pebble(c, 7, 11, 1, 'dirt', 7, 6, 4, sh)
            c.P(12, 4, K('dirt', 6)); c.P(5, 12, K('dirt', 2))
        elif v == 1:                                         # 마른 땅 갈라짐
            crack(c, [(3, 6), (6, 7), (8, 6), (11, 8), (13, 7)], K('dirt', 1), K('dirt', 5))
            crack(c, [(8, 6), (8, 9), (6, 12)], K('dirt', 1), K('dirt', 5))
            crack(c, [(11, 8), (12, 11)], K('dirt', 2), None)
            pebble(c, 4, 10, 1, shade=sh)
        elif v == 2:                                         # 바퀴 자국 두 줄(옅게) + 자갈
            for x in range(3, 13):
                if hsh(x, 1, 4) % 4: c.P(x, 5, K('dirt', 2)); c.P(x, 6, K('dirt', 5))
                if hsh(x, 2, 4) % 4: c.P(x, 10, K('dirt', 2)); c.P(x, 11, K('dirt', 5))
            pebble(c, 11, 7, 2, shade=sh); pebble(c, 5, 8, 1, 'conc', 6, 4, 2, sh)
        else:                                                # 마른 풀 포기 + 작은 돌 + 녹 조각
            tuft(c, 6, 9, 'burlap'); pebble(c, 10, 5, 2, shade=sh); pebble(c, 11, 11, 1, shade=sh)
            c.HL(3, 12, 2, K('rust', 3)); c.P(5, 12, K('rust', 1)); c.HL(3, 13, 3, sh)
    return draw


def tiled(ids, grid):
    """표본: grid = 행 문자열(글자 → ids 의 키). 조각 그림을 칸으로 깔아 붙인다."""
    def mk(f=0):
        h, w = len(grid), len(grid[0])
        a = np.zeros((h * 16, w * 16, 4), np.uint8)
        for j, row in enumerate(grid):
            for i, ch in enumerate(row):
                pid, cx, cy = ids[ch]
                src = render(PIECES[pid])
                a[j * 16:(j + 1) * 16, i * 16:(i + 1) * 16] = src[cy * 16:(cy + 1) * 16, cx * 16:(cx + 1) * 16]
        return a
    return mk


def decal_sample(pid, grid=('abXa', 'aaab', 'Xaca'), extra=((3, 1),)):
    """덧그림 표본: 흙 칸(4×3)을 깔고 X 칸(+ extra 칸)에 덧그림을 얹는다 — 실제 쓰임(흙 위 드문드문)대로 보인다."""
    def mk(f=0):
        a = tiled(DIRT_IDS, [r.replace('X', 'a') for r in grid])(f)
        d = render(PIECES[pid], f); m = d[..., 3] > 0
        cells = [(i, j) for j, r in enumerate(grid) for i, ch in enumerate(r) if ch == 'X'] + list(extra)
        for (i, j) in cells:
            blk = a[j * 16:(j + 1) * 16, i * 16:(i + 1) * 16]
            op = d[..., 3] == 255; blk[op] = d[op]
            sh = m & ~op                                           # 반투명 그림자: 흙 위에 섞어 굽는다(표본만, 관문 그림은 불투명)
            al = d[..., 3:4].astype(np.float32) / 255.0
            blk[sh, :3] = (blk[sh, :3] * (1 - al[sh]) + d[sh, :3] * al[sh]).astype(np.uint8)
        return a
    return mk


DIRT_IDS = {'a': ('dirt-a', 0, 0), 'b': ('dirt-b', 0, 0), 'c': ('dirt-c', 0, 0), 'd': ('dirt-d', 0, 0)}
_dirt_grid = {'a': ['aaaa', 'aaaa', 'aaaa'], 'b': ['abaa', 'aaab', 'baaa'], 'c': ['aaca', 'caaa', 'aaac'], 'd': ['daaa', 'aada', 'adaa']}
for _v, _l in enumerate('abcd'):
    piece('dirt-' + _l, '황무지 흙 ' + 'ABCD'[_v], 1, 1, TERRAIN, en='dusty packed wasteland earth ground tile' + ('' if _v == 0 else ' variant %d laid among plain earth' % (_v + 1)),
          group='ground', tags=['흙', '황무지', '바닥'], desc='먼지 낀 다져진 황무지 흙. A 가 기본, B 갈라진 땅, C 바퀴 자국, D 마른 풀·녹 조각 — 변형은 드물게 섞는다.',
          sample=tiled(DIRT_IDS, _dirt_grid[_l]))(_dirt(_v))


# ------------------------------------------------------------------ 아스팔트
def asph_px(x, y, seed):
    """금 간 아스팔트 한 화소: 몸 3단(값 잡음 ±1) + 박힌 골재(밝은 알 5·6) + 패인 점(1) + 먼지 덮인 곳(갈회 4·6)."""
    f = field(x, y, seed + 40)
    d = h2(x & 15, y & 15, seed + 2) % 31
    t = 3
    if f > 0.70: t = 4
    elif f < 0.30: t = 2
    if d in (0, 1): t = 5
    elif d == 2: t = 6
    elif d in (3, 4): t = 1
    elif d == 5: t = t - 1
    elif d == 6 and f > 0.55: t = 6
    return K('asph', t)


def asph_cell(c, ox, oy, seed):
    for y in range(16):
        for x in range(16):
            c.P(ox + x, oy + y, asph_px(x, y, 0))


def jag(i, side, m):
    """이웃 없는 쪽(side)에서 흙이 먹어 들어온 깊이(화소): 2..6, 가장자리를 따라 천천히 바뀐다(옆 칸과 이어지게 끝 0,15 는 고정 4)."""
    if i <= 0 or i >= 15: return 2
    v = vnoise(i, side * 5, 77 + side, 4, 16)
    return 1 + int(v * 2.99)


def at_asphalt(c, m, ox, oy):
    asph_cell(c, ox, oy, 0 if m == 15 else 3 + m)
    P = lambda x, y, col: c.P(ox + x, oy + y, col)
    G = lambda x, y: c.get(ox + x, oy + y)
    # 흙으로 부서진 가장자리: 칸마다 «흙 깊이» 를 계산
    dep = [[0] * 16 for _ in range(16)]
    for y in range(16):
        for x in range(16):
            dd = 0
            if not m & N: dd = max(dd, jag(x, 0, m) - y)
            if not m & Sb: dd = max(dd, jag(x, 2, m) - (15 - y))
            if not m & W: dd = max(dd, jag(y, 3, m) - x)
            if not m & E: dd = max(dd, jag(y, 1, m) - (15 - x))
            dep[y][x] = dd
    soil = lambda x, y: dep[y][x] > 0
    for y in range(16):
        for x in range(16):
            if soil(x, y): P(x, y, dirt_px(x, y, 0))
    for y in range(16):
        for x in range(16):
            if soil(x, y): continue
            up = y > 0 and soil(x, y - 1); dn = y < 15 and soil(x, y + 1)
            lf = x > 0 and soil(x - 1, y); rt = x < 15 and soil(x + 1, y)
            if dn: P(x, y, K('asph', 0))                 # 남쪽 끝: 깨진 앞면(가장 어두운 단)
            elif up or lf: P(x, y, K('asph', 5))         # 빛 받는 깨진 모서리
            elif rt: P(x, y, K('asph', 1))
    for y in range(1, 16):                                # 흙 위 그늘: 아스팔트 앞면 바로 아래 흙 한 줄
        for x in range(16):
            if soil(x, y) and not soil(x, y - 1): P(x, y, K('dirt', 1))
    # 흙 쪽 떨어져 나온 아스팔트 조각(이웃 없는 가장자리에만)
    k = 0
    for (x, y) in ((3, 1), (11, 0), (1, 9), (14, 6), (6, 14), (12, 14)):
        k += 1
        if soil(x, y) and soil(x + 1, y) and (y == 0 or soil(x, y - 1) or y < 2) and hsh(m, k, 5) % 2:
            P(x, y, K('asph', 3)); P(x + 1, y, K('asph', 2)); P(x, y + 1 if y < 15 else y, K('dirt', 1)) if y < 15 and soil(x, y + 1) else None
    # 균열(안쪽에만): 마스크마다 손으로 고른 꺾은선 몇 개
    CR = [
        [(5, 6), (7, 8), (7, 10), (9, 11)],
        [(9, 4), (8, 6), (10, 8)],
        [(4, 9), (6, 9), (8, 12)],
        [(10, 5), (11, 8), (10, 10), (11, 12)],
    ]
    for j, pts in enumerate(CR):
        if m in range(16): continue      # 오토타일 칸엔 고정 균열을 넣지 않는다(긴 길에서 같은 무늬가 줄지어 반복된다) — 균열은 asphalt-b/-c 변형이 맡는다
        if all(not soil(x, y) and 2 <= x <= 13 and 2 <= y <= 13 for x, y in pts):
            crack(c, [(ox + x, oy + y) for x, y in pts], K('asph', 0), K('asph', 4))
    # 균열 사이 잡초 한 포기(드물게)
    if False and not soil(8, 9) and not soil(8, 6):
        tuft(c, ox + 8, oy + 9, 'grass')


def autosheet(fn):
    def draw(c):
        for m in range(16): fn(c, m, (m % 4) * 16, (m // 4) * 16)
    return draw


# 오토타일 표본: 흙 위 길 — 교차로·막다른 길·T자·굽이·넓은 판·외딴 칸까지 16마스크가 모두 나온다.
AUTO_LAYOUT = [
    '...........',
    '.#...#...#.',
    '.##..#..##.',
    '.#.#####.#.',
    '.....#.....',
    '.....#.....',
    '...#.#..##.',
    '.#####..##.',
    '...........',
    '..###..#...',
    '...#.......',
    '...........',
]


def auto_masks(layout):
    H, Wd = len(layout), len(layout[0]); out = {}
    on = lambda x, y: 0 <= x < Wd and 0 <= y < H and layout[y][x] in '#bc'
    for y in range(H):
        for x in range(Wd):
            if on(x, y): out[(x, y)] = (N if on(x, y - 1) else 0) | (E if on(x + 1, y) else 0) | (Sb if on(x, y + 1) else 0) | (W if on(x - 1, y) else 0)
    return out


def auto_sample(f=0):
    lay = AUTO_LAYOUT; H, Wd = len(lay), len(lay[0])
    a = np.zeros((H * 16, Wd * 16, 4), np.uint8)
    ms = auto_masks(lay)
    da = render(PIECES['dirt-a']); at = render(PIECES['asphalt'])
    for y in range(H):
        for x in range(Wd):
            if (x, y) in ms:
                m = ms[(x, y)]; src = at[(m // 4) * 16:(m // 4 + 1) * 16, (m % 4) * 16:(m % 4 + 1) * 16]
            else: src = da
            a[y * 16:(y + 1) * 16, x * 16:(x + 1) * 16] = src
    return a


piece('asphalt', '금 간 아스팔트 (오토타일)', 4, 4, TERRAIN, en='cracked broken asphalt road crumbling into dirt, laid as a road network with crossroads and dead ends',
      group='ground', tags=['아스팔트', '도로', '오토타일'], desc='금 간 옛 아스팔트 도로. 이웃이 도로가 아닌 쪽은 흙으로 부서져 끝난다. 붓·채우기가 이웃에 맞는 칸을 고른다.',
      sample=auto_sample)(autosheet(at_asphalt))
AUTO['asphalt'] = dict(name='금 간 아스팔트', kind=TERRAIN)
assert len(set(auto_masks(AUTO_LAYOUT).values())) == 16, sorted(set(auto_masks(AUTO_LAYOUT).values()))


def _asph_var(v):
    def draw(c):
        asph_cell(c, 0, 0, 50 + v)
        if v == 0:                                           # 패인 구멍(깨진 아스팔트 조각 둘레 + 고인 흙탕물) + 잡초
            c.ell(8, 8, 5, 4, K('asph', 0))
            c.ell(8, 9, 4, 3, K('dirt', 2)); c.HL(5, 6, 7, K('asph', 0))
            c.ell(8, 9, 3, 2, K('oil', 2)); c.P(7, 9, K('oil', 4)); c.P(9, 10, K('oil', 1)); c.P(10, 9, K('oil', 3))
            c.HL(4, 12, 9, K('asph', 6)); c.P(3, 11, K('asph', 5)); c.P(13, 11, K('asph', 5))      # 앞 가장자리 빛(뒤가 패여 그늘)
            for (x, y, w, h) in ((2, 4, 3, 2), (12, 5, 3, 2), (10, 13, 3, 2)): chunk5(c, x, y, w, h + 1, 'asph', 1, seed=x)
            crack(c, [(1, 9), (3, 9), (4, 8)], K('asph', 0), K('asph', 5)); crack(c, [(13, 8), (15, 7)], K('asph', 0), K('asph', 5))
            tuft(c, 13, 15, 'grass'); tuft(c, 2, 15, 'dry')
        else:                                                # 땜질 자국(새 아스팔트 판 + 이음 턱) + 칸을 가로지르는 한 줄 갈래 균열 + 균열에서만 자란 잡초 + 닳은 차선 조각 하나
            for y in range(1, 8):                                # 땜질 판: 더 어둡고 고른 새 아스팔트, 이음 턱(위·왼 빛, 아래·오른 그늘)
                for x in range(8, 15):
                    c.P(x, y, K('asph', 2 if h2(x, y, 61) % 7 else 3))
            c.HL(8, 1, 7, K('asph', 4)); c.VL(8, 1, 7, K('asph', 4)); c.HL(8, 8, 7, K('asph', 1)); c.VL(15, 1, 8, K('asph', 1))
            c.P(9, 2, K('asph', 6)); c.P(12, 5, K('asph', 1)); c.P(10, 6, K('asph', 3))
            for (x, y) in ((1, 4), (2, 4), (3, 5), (4, 5)): c.P(x, y, K('paint', 1))          # 닳은 차선 조각 하나(가장자리 끊김)
            c.P(2, 5, K('paint', 0)); c.P(0, 4, K('asph', 4)); c.P(5, 5, K('asph', 4))
            core = [(0, 12), (2, 11), (4, 11), (5, 10), (7, 10), (8, 9), (10, 9), (11, 10), (13, 10), (15, 11)]
            for (a, b) in zip(core, core[1:]):                   # 균열: 2화소 폭 어두운 속 + 아래 밝은 턱
                c.line(a[0], a[1], b[0], b[1], K('asph', 0)); c.line(a[0], a[1] + 1, b[0], b[1] + 1, K('asph', 1))
                c.line(a[0], a[1] + 2, b[0], b[1] + 2, K('asph', 5))
            for br in ([(5, 10), (5, 13), (4, 15)], [(10, 9), (11, 7)], [(13, 10), (14, 13)]):
                crack(c, br, K('asph', 0), K('asph', 5))
            for (x, y) in ((1, 13), (6, 12), (12, 12)): c.P(x, y, K('dirt', 2)); c.P(x + 1, y, K('dirt', 3))   # 균열 속 흙
            tuft(c, 2, 11, 'grass'); tuft(c, 9, 9, 'grass')
            for (x, y) in ((6, 10), (12, 10)): c.P(x, y, K('grass', 3)); c.P(x, y - 1, K('grass', 5))
            c.P(4, 2, K('oil', 1)); c.P(5, 2, K('oil', 2)); c.P(3, 1, K('asph', 1))
    return draw


ASPH_IDS = {'a': ('asphalt', 3, 3), 'b': ('asphalt-b', 0, 0), 'c': ('asphalt-c', 0, 0)}
piece('asphalt-b', '아스팔트 패인 구멍', 1, 1, TERRAIN, en='cracked asphalt road tile with a water-filled pothole and weeds, laid among plain asphalt',
      group='ground', tags=['아스팔트', '도로'], desc='도로 안쪽(사방이 도로인 칸)에 드물게 섞는 패인 구멍 변형.',
      sample=tiled(ASPH_IDS, ['abac', 'aaab', 'caaa']))(_asph_var(0))
piece('asphalt-c', '아스팔트 균열·잡초', 1, 1, TERRAIN, en='asphalt road tile with a long crack, weeds growing in it and a faded lane-paint fragment, laid among plain asphalt',
      group='ground', tags=['아스팔트', '도로'], desc='도로 안쪽에 드물게 섞는 균열·잡초·바랜 차선 변형.',
      sample=tiled(ASPH_IDS, ['aaaa', 'acab', 'aaaa']))(_asph_var(1))


# ------------------------------------------------------------------ 콘크리트 판
def slab_base(c, v):
    """금 간 콘크리트 판: 몸(값 잡음 3단) + 골재 알(밝음·어두움) + 판 이음(위·왼 어두운 줄 + 빛 줄, 아래·오른 그늘) + 때 얼룩."""
    for y in range(16):
        for x in range(16):
            f = field(x, y, 90 + v * 3)
            d = h2(x, y, 91 + v) % 23
            t = 4 if f < 0.6 else 5
            if f < 0.3: t = 3
            if d in (0, 1): t = 6
            elif d == 2: t = 7
            elif d in (3, 4): t = 2
            elif d == 5: t -= 1
            c.P(x, y, K('conc', t))
    c.HL(0, 0, 16, K('conc', 1)); c.VL(0, 0, 16, K('conc', 1))            # 판 이음(위·왼 어두운 줄)
    c.HL(1, 1, 15, K('conc', 6)); c.VL(1, 1, 15, K('conc', 6))            # 판 모서리 빛
    c.HL(1, 15, 15, K('conc', 3)); c.VL(15, 1, 15, K('conc', 3))          # 판 아래·오른 그늘
    c.HL(2, 14, 13, K('conc', 3)) if v != 1 else None


def _slab(v):
    def draw(c):
        slab_base(c, v)
        if v == 0:
            crack(c, [(3, 9), (6, 8), (8, 10)], K('conc', 1), K('conc', 7)); c.ell(11, 5, 2, 1, K('conc', 3)); c.P(12, 5, K('conc', 2)); c.P(13, 13, K('conc', 1)); c.P(14, 13, K('conc', 7))
            for (x, y) in ((10, 10), (11, 10), (10, 11)): c.P(x, y, K('conc', 3))          # 얼룩
            c.P(12, 4, K('conc', 2)); c.P(12, 5, K('conc', 6))
        elif v == 1:                                          # 깨진 모서리 + 드러난 흙 + 잡초
            for y in range(9, 16):
                for x in range(9, 16):
                    if x + y > 22 - (hsh(x, y, 4) % 2): c.P(x, y, dirt_px(x, y, 0))
            for y in range(9, 16):
                for x in range(9, 16):
                    if c.get(x, y) in MAT['conc'] and (x + 1 + y > 22 or x + y + 1 > 22):
                        if c.get(x + 1, y) not in MAT['conc'] or c.get(x, y + 1) not in MAT['conc']: c.P(x, y, K('conc', 2))
            tuft(c, 13, 14, 'grass')
            crack(c, [(3, 11), (6, 9), (9, 9)], K('conc', 1), K('conc', 6))
        else:                                                 # 두 조각으로 갈라져 한쪽이 기울어 내려앉음 + 기름 얼룩
            for y in range(2, 15):
                for x in range(16):
                    if x > 7 + (y // 3) % 2 and c.get(x, y) in MAT['conc']:
                        c.P(x, y, K('conc', max(2, MAT['conc'].index(c.get(x, y)) - 1)))
            for y in range(1, 15): c.P(7 + (y // 3) % 2, y, K('conc', 0)); c.P(6 + (y // 3) % 2, y, K('conc', 6))
            c.ell(11, 10, 2, 1, K('soot', 3)); c.P(10, 10, K('soot', 2)); c.P(12, 9, K('soot', 4))
    return draw


SLAB_IDS = {'a': ('slab-a', 0, 0), 'b': ('slab-b', 0, 0), 'c': ('slab-c', 0, 0)}
for _v, _l in enumerate('abc'):
    piece('slab-' + _l, '금 간 콘크리트 판 ' + 'ABC'[_v], 1, 1, TERRAIN, en='cracked old concrete slab floor tile' + ('' if _v == 0 else ' variant %d laid among plain slabs' % (_v + 1)),
          group='ground', tags=['콘크리트', '광장', '바닥'], desc='옛 광장·건물 바닥의 금 간 콘크리트 판. A 기본, B 깨진 모서리·잡초, C 내려앉은 판·기름 얼룩.',
          sample=tiled(SLAB_IDS, [['aaba', 'caaa', 'aaac'], ['abaa', 'aacb', 'baaa'], ['aaca', 'caaa', 'aaac']][_v]))(_slab(_v))


# ------------------------------------------------------------------ 투명 덧그림(flat)
def layer(c, fn, outline=True, top=False, col=None):
    """따로 그린 겹(덩이·풀)을 c 위에 덮는다 — 윤곽은 그 겹 둘레에만(밑 흙 자리 둘레엔 두지 않는다)."""
    l = Cv(c.w, c.h); fn(l)
    if outline: l.outline(col=col, top=top)
    m = l.a[..., 3] == 255; c.a[m] = l.a[m]


def soil_patch(c, cx, cy, rx, ry, seed=0, mat='dirt', lo=1, crumbs=True):
    """불규칙한 흙 자리(덧그림 밑바탕): 가장자리는 둘레 흙(4단)에 녹아들고 속은 젖어 어둡다(lo..lo+2) + 알갱이. 윤곽 없음."""
    n = len(MAT[mat])
    for y in range(16):
        for x in range(16):
            d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 + (field(x, y, seed + 70) - 0.5) * 0.6
            if d > 1.0: continue
            t = lo if d < 0.35 else lo + 1 if d < 0.7 else lo + 2
            k = h2(x, y, seed + 3) % 11
            if k == 0: t += 2
            elif k == 1: t = max(0, t - 1)
            elif k == 2 and d > 0.6: t += 1
            c.P(x, y, K(mat, min(n - 1, t)))
    if crumbs:
        for i in range(5):
            x = (cx + (h2(i, 1, seed) % (2 * rx + 3)) - rx - 1); y = (cy + (h2(i, 2, seed) % (2 * ry + 3)) - ry - 1)
            if not c.has(x, y) and 0 <= x < 16 and 0 <= y < 16: c.P(x, y, K(mat, lo + 2)); c.P(x, y + 1, K(mat, lo)) if y + 1 < 16 and not c.has(x, y + 1) else None


def _rubble(v):
    def draw(c):
        if v == 0:                                            # 콘크리트 덩이 무리(뒤 → 앞): 칸의 2/3 를 덮는다
            for (x, y, w, h, t) in ((2, 2, 6, 5, 2), (8, 1, 5, 4, 2), (11, 4, 4, 5, 2), (0, 6, 5, 4, 2), (4, 6, 7, 6, 3), (11, 9, 4, 4, 2), (1, 11, 5, 4, 2), (7, 11, 5, 4, 2)):
                chunk5(c, x, y, w, h, 'conc', t, seed=x + y)
            rebar(c, 6, 7, 5, 3); rebar(c, 12, 5, 4, -1)
            for (x, y) in ((13, 14), (5, 10), (10, 3)): c.P(x, y, K('glass', 5))
            c.outline()
        elif v == 1:                                          # 붉은 벽돌 가루 자리 위에 흩어진 벽돌(낱장마다 윗면 2~3행 + 앞면 2행) · 반쪽 벽돌 · 모르타르 덩이
            soil_patch(c, 8, 8, 7, 6, seed=11, mat='brust', lo=4)
            def bricks(l):
                for (x, y, w, h, t, mat) in ((1, 2, 5, 4, 2, 'brick'), (9, 1, 5, 4, 2, 'brick'), (6, 5, 4, 4, 2, 'conc'), (11, 6, 4, 5, 3, 'brick'),
                                             (1, 8, 4, 4, 2, 'brick'), (6, 10, 5, 4, 2, 'brick'), (12, 12, 3, 3, 1, 'conc')):
                    chunk5(l, x, y, w, h, mat, t, seed=x * 3 + y)
                    if mat == 'brick': l.P(x + 1, y + t, K('brick', 1)); l.P(x + w - 2, y + t + 1, K('brick', 2))   # 줄눈 흠
                l.P(3, 3, K('conc', 6)); l.P(11, 2, K('conc', 5)); l.P(13, 8, K('conc', 6))                           # 붙은 모르타르
            layer(c, bricks, col=K('brick', 1))
            for (x, y) in ((5, 14), (10, 15), (0, 12), (15, 4)): c.P(x, y, K('brick', 3))
            for (x, y) in ((8, 4), (4, 13)): c.P(x, y, K('conc', 6)); c.P(x, y + 1, K('brust', 1))
        else:                                                 # 기름 밴 흙 자리 + 휜 녹슨 철판(윗면 4행·앞 끝면 2행) + 유리 조각 + 끊긴 전선 + 콘크리트 덩이
            soil_patch(c, 8, 9, 7, 6, seed=23, mat='dirt', lo=2)
            def scrap(l):
                for i in range(9):                            # 철판: 동쪽이 한 행 내려앉은 휜 판
                    yy = 3 + (1 if i > 5 else 0)
                    for j, t in enumerate((6, 5, 5, 4)): l.P(2 + i, yy + j, K('metal', t - (1 if (i + j) % 4 == 0 else 0)))
                    l.P(2 + i, yy + 4, K('metal', 2)); l.P(2 + i, yy + 5, K('metal', 1))
                l.P(2, 3, K('metal', 7)); l.P(3, 3, K('metal', 7)); l.P(9, 4, K('metal', 7))
                rust_patch(l, 2, 6, 9, 4, seed=5, dens=0.6, on=set(MAT['metal']))
                for (x, y) in ((4, 4), (7, 5)): l.P(x, y, K('rust', 4))
                chunk5(l, 11, 7, 5, 4, 'conc', 2, seed=4); chunk5(l, 6, 11, 4, 4, 'conc', 2, seed=5); chunk5(l, 0, 10, 4, 4, 'brick', 2, seed=8)
                chunk5(l, 12, 1, 3, 3, 'conc', 1, seed=7)
            layer(c, scrap, col=K('metal', 1))
            for (x, y) in ((12, 12), (2, 15), (14, 14), (10, 1)):
                c.P(x, y, K('glass', 6)); c.P(x + 1, y, K('glass', 4)); c.P(x, y + 1, K('glass', 2)) if y < 15 else None
            c.line(1, 1, 4, 2, K('rubber', 2)); c.line(4, 2, 6, 1, K('rubber', 3)); c.P(6, 0, K('rust', 5))
            c.P(11, 14, K('oil', 1)); c.P(12, 14, K('oil', 3)); c.P(10, 13, K('oil', 2))
        m = c.a[..., 3] == 255
        c.shadow([(x + 1, y + 1) for y in range(16) for x in range(16) if m[y, x]])
    return draw


for _v, _l in enumerate('abc'):
    piece('rubble-' + _l, '잔해 ' + ['콘크리트 덩이', '깨진 벽돌', '유리·쇳조각'][_v], 1, 1, FLAT,
          en=['small broken concrete chunks with a rebar stub lying on the ground',
              'scattered broken bricks and mortar lumps lying on a patch of red brick dust on the ground',
              'a bent rusty metal sheet, broken concrete lumps, glass shards and a torn cable lying on an oil-stained patch of earth'][_v],
          group='ground', tags=['잔해', '덧그림'], desc='바닥 위 투명 잔해 덧그림 — 걷는다, 캐릭터 밑에 그린다.',
          sample=None if _v == 0 else decal_sample('rubble-' + _l))(_rubble(_v))


def clump(c, x, y, w, h, mat, seed=0, dens=0.9, rows=3, step=1):
    """풀 덩이: 잎 줄기(1화소, 높이 2~h, 기울기 -1..1)를 줄마다 엇갈린 열에 세운다 — 밑동 어둡고 끝 밝게(재질 전 단). 뒤 줄부터 그려 앞 줄이 덮는다."""
    n = len(MAT[mat]); blades = []
    for row in range(rows):
        for i in range(row % 2 if step > 1 else 0, w, step):
            if h2(i, row, seed) % 100 > dens * 100: continue
            hh = max(2, h - row * 2 - h2(i, row, seed + 1) % 4)
            lean = (h2(i, row, seed + 2) % 3) - 1
            blades.append((y + h - 1 - row * 2, x + i, hh, lean))
    for k, (by, bx, hh, lean) in enumerate(sorted(blades)):
        off = -2 if h2(bx, by, seed + 9) % 3 == 0 else 0           # 그늘 속 잎(두 단 어둡게) — 덩이가 한 덩어리 채움으로 읽히지 않게
        for j in range(hh):
            xx = bx + (lean * j) // 3; yy = by - j
            f = j / max(1, hh - 1)
            t = 0 if f < 0.12 else 1 if f < 0.3 else 2 if f < 0.5 else 3 if f < 0.68 else 4 if f < 0.84 else n - 2 if f < 0.97 else n - 1
            c.P(xx, yy, K(mat, max(0, min(t + (off if j > 0 else 0), n - 1))))


def rosette(c, cx, cy, seed=0):
    """위에서 본 넓은 잎 잡초(민들레 꼴): 잎 5장이 방사, 잎마다 위·왼 빛 → 끝 어둡게, 가운데 그늘."""
    for k, (dx, dy) in enumerate(((-3, -1), (3, -1), (-2, 2), (2, 2), (0, -3))):
        for s_ in range(1, 4):
            x = cx + (dx * s_) // 3; y = cy + (dy * s_) // 3
            c.P(x, y, K('plant', 8 - s_ * 2 + (1 if k == 4 else 0))); c.P(x + (1 if dx >= 0 else -1), y, K('plant', 5 - s_))
    c.P(cx, cy, K('plant', 1)); c.P(cx, cy - 1, K('plant', 7))


def fan(c, bx, by, h, mat, seed=0, n=7, spread=3, droop=False):
    """부채꼴 풀 포기: 뿌리 (bx,by) 에서 잎 n 장이 퍼진다(바깥 잎일수록 눕고 짧다). 잎마다 밑동 어둡게 → 끝 밝게, 가운데 잎이 앞(나중)에 그려진다."""
    r = len(MAT[mat]); blades = []
    for k in range(n):
        u = (k / max(1, n - 1)) * 2 - 1                        # -1..1
        hh = max(2, round(h * (1 - 0.2 * abs(u))) - h2(k, bx, seed) % 3)
        blades.append((abs(u), u, hh, k))
    for (_, u, hh, k) in sorted(blades, reverse=True):        # 바깥 잎 먼저(V 꼴: 바깥 잎이 길게 밖으로 눕는다)
        dark = h2(k, by, seed + 1) % 3 == 0
        x0 = bx + round(u * 1.2)                               # 밑동 폭 3
        for j in range(hh):
            f = j / max(1, hh - 1)
            x = x0 + round(u * spread * f); y = by - j
            if droop and f > 0.85: x += 1 if u >= 0 else -1; y += 1
            t = 0 if f < 0.15 else 1 if f < 0.35 else 2 if f < 0.55 else 3 if f < 0.72 else r - 3 if f < 0.86 else r - 2 if f < 0.96 else r - 1
            c.P(x, y, K(mat, max(0, t - (2 if dark and j > 0 else 0))))
    c.P(bx - 1, by + 1, K('dirt', 1)); c.P(bx, by + 1, K('dirt', 1)); c.P(bx + 1, by + 1, K('dirt', 2))


def _weeds(v):
    def draw(c):
        if v == 0:                                            # 흩어진 초록 잡초 포기(부채꼴) 넷 + 넓은 잎 포기 둘 — 사이로 흙이 보인다
            rosette(c, 4, 4, 1); rosette(c, 12, 13, 2)
            for (x, y, h, n, sp, sd) in ((10, 8, 7, 9, 3, 3), (3, 14, 6, 8, 3, 5), (14, 4, 4, 5, 1, 6), (8, 15, 4, 6, 2, 7)):
                fan(c, x, y, h, 'grass', sd, n, sp)
            c.P(6, 1, K('paint', 1)); c.P(1, 8, K('paint', 2))
        elif v == 1:                                          # 마른 풀 포기(부채꼴, 이삭 끝이 처진다) 셋 + 초록 새싹 + 부스러진 흙
            for (x, y, h, n, sp, sd) in ((11, 8, 7, 10, 3, 11), (4, 13, 7, 10, 3, 12), (13, 15, 4, 6, 1, 13)):
                fan(c, x, y, h, 'dry', sd, n, sp, droop=True)
            for (x, y) in ((9, 1), (14, 2), (1, 6), (7, 6)): c.P(x, y, K('dry', 5)); c.P(x, y + 1, K('dry', 3))      # 이삭 알
            fan(c, 7, 15, 3, 'grass', 14, 4, 1); fan(c, 1, 3, 3, 'grass', 15, 3, 1)
            for (x, y) in ((10, 12), (15, 9), (3, 1)): c.P(x, y, K('dirt', 5)); c.P(x, y + 1, K('dirt', 2))
        else:                                                 # 대각 균열을 따라 난 흙 줄 + 잡초 띠 + 들꽃
            for i in range(16):                               # 균열 흙 줄(2~3폭)
                x = i; y = 14 - (i * 11) // 15
                for d in (-1, 0, 1):
                    t = 1 if d == 0 else 3
                    if 0 <= y + d < 16: c.P(x, y + d, K('dirt', t if h2(x, y + d, 5) % 5 else t + 1))
                if i % 3 == 0 and y + 2 < 16: c.P(x, y + 2, K('dirt', 4))
            for (x, y, w, h, s_) in ((0, 7, 6, 8, 7), (4, 4, 6, 8, 8), (9, 1, 6, 7, 9)):
                clump(c, x, y, w, h, 'grass', s_, 0.7, 3, 1)
            rosette(c, 12, 11, 6); rosette(c, 3, 3, 7)
            for (x, y, col) in ((2, 8, 'azalea'), (7, 5, 'ginkgo'), (12, 2, 'ginkgo'), (10, 7, 'wpaint'), (5, 10, 'ginkgo')):
                c.P(x, y, K(col, 3)); c.P(x + 1, y, K(col, 1)); c.P(x, y - 1, K(col, 2))
    return draw


for _v, _l in enumerate('abc'):
    piece('weeds-' + _l, '잡초 ' + 'ABC'[_v], 1, 1, FLAT,
          en=['scattered small tufts of green weeds and two broad-leaved rosettes growing from bare earth',
              'scattered tufts of dry yellow-brown grass with drooping seed heads and a few green shoots on bare earth',
              'a line of weeds, rosettes and tiny wild flowers growing along a diagonal crack of earth'][_v],
          group='ground', tags=['잡초', '덧그림'], desc='균열·흙 위 잡초 덧그림 — 걷는다.',
          sample=None if _v == 2 else decal_sample('weeds-' + _l))(_weeds(_v))


@piece('puddle', '기름 웅덩이', 1, 1, FLAT, en='oily rain puddle in a churned muddy hollow on the ground with tyre ruts, a rainbow sheen and sky reflections', group='ground', tags=['웅덩이', '덧그림'],
       desc='진흙 둘레 기름 낀 빗물 웅덩이 덧그림 — 걷는다.', sample=decal_sample('puddle', ('abaa', 'aXab', 'aaca'), ((3, 2),)))
def _puddle(c):
    soil_patch(c, 8, 8, 8, 7, seed=41, lo=2, crumbs=False)       # 칸을 거의 채우는 젖은 진흙(둘레 흙에 녹아든다)
    water = set()
    for y in range(16):
        for x in range(16):
            a = ((x - 6) / 4.6) ** 2 + ((y - 7) / 3.0) ** 2; b = ((x - 10.5) / 3.6) ** 2 + ((y - 10) / 2.4) ** 2   # 두 갈래로 고인 물
            if min(a, b) + (field(x, y, 47) - 0.5) * 0.7 < 1: water.add((x, y))
    for (x, y) in water:                                        # 물: 뒤 둑 그늘(2) → 몸(3) → 앞 물가 하늘빛(4)
        up = (x, y - 1) not in water; dn = (x, y + 1) not in water
        t = 2 if up else 4 if dn else 3
        c.P(x, y, K('oil', t))
        if dn and y + 1 < 16: c.P(x, y + 1, K('dirt', 5 if (x % 3) else 6))    # 앞 물가 젖은 흙 빛
        if up and y - 1 >= 0 and c.get(x, y - 1) is not None: c.P(x, y - 1, K('dirt', 1))   # 뒤 둑 턱(어둡게)
    for (x, y) in ((4, 8), (5, 7), (7, 6), (10, 10), (11, 9)):                       # 하늘 반짝(사선 두 줄)
        if (x, y) in water: c.P(x, y, K('oil', 5))
    for (x, y) in ((5, 8), (11, 10)):
        if (x, y) in water: c.P(x, y, K('wpaint', 2))
    for (x, y, col, t) in ((7, 8, 'teal', 4), (8, 8, 'azalea', 2), (9, 9, 'ginkgo', 2), (12, 11, 'teal', 3)):
        if (x, y) in water: c.P(x, y, K(col, t))                # 기름 무지개 막
    for (x, y, s_) in ((1, 5, 2), (13, 3, 2), (2, 12, 1), (12, 13, 2)): pebble(c, x, y, s_, 'conc', 6, 4, 2, K('dirt', 1))
    for (x, y) in ((6, 3), (10, 13), (3, 8)): c.P(x, y, K('dirt', 0)); c.P(x + 1, y, K('dirt', 4))   # 발자국 같은 진흙 패임

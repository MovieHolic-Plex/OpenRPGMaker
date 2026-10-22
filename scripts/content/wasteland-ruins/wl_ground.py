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


def tiled(ids, grid):
    """표본: grid = 행 문자열(글자 → ids 의 키). 조각 그림을 칸으로 깔아 붙인다."""
    def mk(f=0):
        h, w = len(grid), len(grid[0])
        a = np.zeros((h * 16, w * 16, 4), np.uint8)
        for j, row in enumerate(grid):
            for i, ch in enumerate(row):
                pid, cx, cy = ids[ch]
                src = render(PIECES[pid])
                if cx is None: cx, cy = i % PIECES[pid]['w'], j % PIECES[pid]['h']      # 이음 판(4×4): 자리 (x mod 4, y mod 4) 칸
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



# ------------------------------------------------------------------ 흙 4 (64×64 이음 판 — 칸 (x mod 4, y mod 4) 자리에 깐다)
FP = 64                                                     # 바닥 이음 주기(화소) = 4칸


def wrapnoise(x, y, seed, cell):
    """주기 FP 로 감싼 값 잡음 0..1(격자 cell)."""
    return vnoise(x % FP, y % FP, seed, cell, FP)


def dirt64_tone(x, y):
    """흙 바탕 단(0..7): 큰 얼룩(주기 64, 격자 16·8) 3단 + 2×2 알갱이 덩이(낱화소 잡음 아님) + 드문 모래알."""
    f = 0.55 * wrapnoise(x, y, 201, 16) + 0.45 * wrapnoise(x, y, 207, 8)
    t = 4                                                     # 회갈색 바탕(아스팔트 가장자리 흙과 같은 단)
    if f < 0.30: t = 3
    if f < 0.16: t = 2
    if f > 0.72: t = 5
    gx, gy = (x + (y // 2) % 2) // 2, y // 2                  # 엇갈린 2×2 덩이
    d = h2(gx % (FP // 2), gy % (FP // 2), 211) % 7          # 2×2 덩이 셋 중 하나꼴로 ±1 — 5×5 평면이 생기지 않게(낱화소 잡음 아님)
    if d in (0, 1): t = 5 if t == 4 else t + 1
    elif d in (2, 3): t -= 1
    k = h2(x % FP, y % FP, 215) % 71
    if k == 0: t = 6                                          # 드문 밝은 모래알
    elif k == 1 and t > 2: t -= 2                             # 드문 어두운 알
    return max(1, min(6, t))


# 바탕에 공유되는 결(칸 경계를 넘는다): 긴 마른 금, 젖은 얼룩, 자갈 — 좌표는 64 판 안(감싼다)
DIRT_CRACKS = [[(2, 21), (8, 20), (13, 22), (19, 22), (25, 24)], [(13, 22), (14, 27)],
               [(40, 44), (46, 43), (52, 44), (58, 42), (66, 43)],
               [(29, 59), (34, 61), (38, 66)]]
DIRT_BLOTS = [(46, 12, 6, 3), (12, 47, 7, 4), (60, 30, 5, 3)]   # (cx, cy, rx, ry) 젖은 얼룩(두 단 어둡게 가장자리 한 단)
DIRT_PEBBLES = [(7, 6, 2), (31, 14, 1), (54, 23, 2), (23, 39, 2), (40, 31, 1), (5, 58, 1), (47, 55, 2), (62, 3, 1), (15, 30, 1), (35, 50, 1)]


def dirt_field(c, ox, oy):
    """64×64 흙 이음 판 전체를 c 의 (ox,oy) 에 칠한다(바탕 + 공유 결)."""
    tone = {}
    for y in range(FP):
        for x in range(FP):
            tone[(x, y)] = dirt64_tone(x, y)
    for (cx, cy, rx, ry) in DIRT_BLOTS:
        for y in range(cy - ry - 1, cy + ry + 2):
            for x in range(cx - rx - 1, cx + rx + 2):
                d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 + (wrapnoise(x, y, 221, 4) - 0.5) * 0.8
                if d < 1: tone[(x % FP, y % FP)] = max(2, tone[(x % FP, y % FP)] - (2 if d < 0.25 else 1))
    for (x, y), t in tone.items(): c.P(ox + x, oy + y, K('dirt', t))
    def P(x, y, col): c.P(ox + x % FP, oy + y % FP, col)
    for pts in DIRT_CRACKS:                                   # 금: 어두운 줄 + 아래 밝은 턱(감싼다)
        for (a, b) in zip(pts, pts[1:]):
            n = max(abs(b[0] - a[0]), abs(b[1] - a[1]), 1)
            for i in range(n + 1):
                x = round(a[0] + (b[0] - a[0]) * i / n); y = round(a[1] + (b[1] - a[1]) * i / n)
                P(x, y, K('dirt', 2)); P(x, y + 1, K('dirt', 6))
    for (x, y, sz) in DIRT_PEBBLES:                           # 자갈: 위 빛 · 아래 그늘 줄(불투명)
        if sz == 1: P(x, y, K('conc', 5)); P(x + 1, y, K('conc', 3)); P(x, y + 1, K('dirt', 1)); P(x + 1, y + 1, K('dirt', 2))
        else:
            for (dx, dy, col) in ((1, 0, K('conc', 6)), (2, 0, K('conc', 5)), (0, 1, K('conc', 6)), (1, 1, K('conc', 5)), (2, 1, K('conc', 4)), (3, 1, K('conc', 3)),
                                  (0, 2, K('conc', 4)), (1, 2, K('conc', 3)), (2, 2, K('conc', 3)), (3, 2, K('conc', 2)), (1, 3, K('dirt', 1)), (2, 3, K('dirt', 1)), (3, 3, K('dirt', 2))):
                P(x + dx, y + dy, col)


def _dirt64(v):
    """v=0 바탕 판. v=1..3 은 같은 바탕 + 칸 안에서만 끝나는 낱칸 결(칸마다 다른 자리) — 어느 자리에 섞어도 바탕이 이어진다."""
    def draw(c):
        dirt_field(c, 0, 0)
        if v == 0: return
        sh = K('dirt', 1)
        for cy in range(4):
            for cx in range(4):
                ox, oy = cx * 16, cy * 16; r = h2(cx, cy, 300 + v)
                jx, jy = 3 + r % 6, 3 + (r >> 4) % 6               # 칸마다 다른 자리(가장자리 3화소 안쪽)
                if v == 1:                                    # 마른 땅 갈라짐(다각 금)
                    a = (ox + jx, oy + jy + 3); b_ = (ox + jx + 4, oy + jy + 1 + r % 3); d_ = (ox + jx + 7, oy + jy + 4)
                    crack(c, [a, b_, d_], K('dirt', 2), K('dirt', 6)); crack(c, [b_, (b_[0] - 1 + (r >> 8) % 3, b_[1] + 3)], K('dirt', 2), K('dirt', 6))
                    if r % 3 == 0: crack(c, [d_, (d_[0] + 2, d_[1] + 3)], K('dirt', 2), None)
                elif v == 2:                                  # 자갈 무리 + 녹 조각
                    pebble(c, ox + jx, oy + jy, 2, shade=sh); pebble(c, ox + jx + 4, oy + jy + 3, 1, shade=sh)
                    if r % 2: pebble(c, ox + jx + 1, oy + jy + 6, 1, 'conc', 6, 4, 2, sh)
                    if r % 3 == 1: c.HL(ox + jx + 5, oy + jy + 7, 2, K('rust', 3)); c.P(ox + jx + 7, oy + jy + 7, K('rust', 1)); c.HL(ox + jx + 5, oy + jy + 8, 3, sh)
                else:                                         # 마른 풀 포기 + 부스러기
                    tuft(c, ox + jx + 2, oy + jy + 6, 'burlap')
                    if r % 2: tuft(c, ox + jx + 6, oy + jy + 8, 'dry')
                    c.P(ox + jx, oy + jy + 8, K('dirt', 6)); c.P(ox + jx, oy + jy + 9, sh)
    return draw


DIRT_IDS = {'a': ('dirt-a', None, None), 'b': ('dirt-b', None, None), 'c': ('dirt-c', None, None), 'd': ('dirt-d', None, None)}
_dirt_grid = {'a': ['aaaaaa', 'aaaaaa', 'aaaaaa', 'aaaaaa', 'aaaaaa'], 'b': ['aabaaa', 'aaaaba', 'baaaaa', 'aaabaa', 'abaaab'],
              'c': ['aaacaa', 'caaaaa', 'aaaaca', 'acaaaa', 'aaacaa'], 'd': ['adaaaa', 'aaaada', 'aadaaa', 'daaaad', 'aaadaa']}
for _v, _l in enumerate('abcd'):
    piece('dirt-' + _l, '황무지 흙 ' + 'ABCD'[_v], 4, 4, TERRAIN,
          en='dusty packed wasteland earth ground, a seamless 4x4-tile field with soft tonal patches, long dry cracks and pebbles running across tile borders' +
             ['', ', mixed with tiles of dried mud cracks', ', mixed with tiles of gravel and rust flakes', ', mixed with tiles of dry grass tufts'][_v],
          group='ground', tags=['흙', '황무지', '바닥'],
          desc='먼지 낀 다져진 황무지 흙 이음 판(4×4칸, 주기 64화소) — 맵 칸 (x,y) 에는 판의 (x mod 4, y mod 4) 칸을 깐다. A 바탕, B 갈라짐·C 자갈·녹·D 마른 풀은 같은 자리 칸을 드물게(10~20%) 바꿔 끼운다.',
          sample=tiled(DIRT_IDS, _dirt_grid[_l]))(_dirt64(_v))


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
    da_full = render(PIECES['dirt-a']); at = render(PIECES['asphalt'])
    for y in range(H):
        for x in range(Wd):
            if (x, y) in ms:
                m = ms[(x, y)]; src = at[(m // 4) * 16:(m // 4 + 1) * 16, (m % 4) * 16:(m % 4 + 1) * 16]
            else: src = da_full[(y % 4) * 16:(y % 4 + 1) * 16, (x % 4) * 16:(x % 4 + 1) * 16]
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
        else:                                                # 매끈한 타르 속 + 거북등 균열 무리 + 작은 패인 구멍 + 바랜 차선 조각(끊긴 점선)
            for y in range(16):                                  # 속(가장자리 3화소 안쪽)은 골재 잡음 대신 매끈한 타르 결(2·3단 큰 얼룩)
                for x in range(16):
                    if edge_d(x, y) < 3: continue
                    f = field(x, y, 77)
                    t = 3 if f > 0.55 else 2
                    if h2(x, y, 78) % 41 == 0: t = 5
                    c.P(x, y, K('asph', t))
            lines = [[(2, 9), (5, 8), (8, 10), (11, 9), (13, 10)],                     # 줄기 금(가로 물결) + 열린 그물(닫힌 고리 없이)
                     [(5, 8), (4, 11), (6, 13)], [(8, 10), (8, 13)], [(11, 9), (12, 12), (13, 13)],
                     [(4, 11), (7, 11)], [(8, 12), (11, 12)], [(3, 6), (5, 8)]]
            for pts in lines:                                    # 어두운 줄 + 아래 밝은 턱
                for (p0, p1) in zip(pts, pts[1:]):
                    n = max(abs(p1[0] - p0[0]), abs(p1[1] - p0[1]), 1)
                    for i in range(n + 1):
                        x = round(p0[0] + (p1[0] - p0[0]) * i / n); y = round(p0[1] + (p1[1] - p0[1]) * i / n)
                        c.P(x, y, K('asph', 0))
            for y in range(15, 0, -1):
                for x in range(16):
                    if c.get(x, y - 1) == K('asph', 0) and c.get(x, y) != K('asph', 0): c.P(x, y, K('asph', 4))
            for (x, y) in ((6, 10), (10, 11), (6, 12)): c.P(x, y, K('asph', 1))      # 조각 판 내려앉음
            c.P(9, 11, K('dirt', 2)); c.P(12, 11, K('grass', 3)); c.P(12, 10, K('grass', 5))
            for (x, y, t) in ((11, 3, 1), (12, 3, 0), (13, 3, 1), (11, 4, 2), (12, 4, 3), (13, 4, 2)):   # 작은 패인 구멍(뒤 그늘 · 고인 물 · 앞 빛 턱)
                c.P(x, y, K('asph', 0) if t == 0 else K('asph', 1) if t == 1 else K('oil', 2 if t == 2 else 4))
            c.HL(11, 5, 3, K('asph', 5))
            for x in range(3, 11):                               # 바랜 차선: 고른 2행 띠(윗줄 밝음 · 아랫줄 어두움), 드물게 닳아 타르가 비친다
                if h2(x, 3, 81) % 6: c.P(x, 3, K('paint', 1))
                if h2(x, 4, 81) % 7: c.P(x, 4, K('paint', 0))
    return draw


ASPH_IDS = {'a': ('asphalt', 3, 3), 'b': ('asphalt-b', 0, 0), 'c': ('asphalt-c', 0, 0)}
piece('asphalt-b', '아스팔트 패인 구멍', 1, 1, TERRAIN, en='cracked asphalt road tile with a water-filled pothole and weeds, laid among plain asphalt',
      group='ground', tags=['아스팔트', '도로'], desc='도로 안쪽(사방이 도로인 칸)에 드물게 섞는 패인 구멍 변형.',
      sample=tiled(ASPH_IDS, ['abac', 'aaab', 'caaa']))(_asph_var(0))
piece('asphalt-c', '아스팔트 균열·잡초', 1, 1, TERRAIN, en='asphalt road tile with smooth worn tar, a patch of alligator cracking, a small water-filled pothole and a worn broken lane-paint fragment, laid among plain asphalt',
      group='ground', tags=['아스팔트', '도로'], desc='도로 안쪽에 드물게 섞는 균열·잡초·바랜 차선 변형.',
      sample=tiled(ASPH_IDS, ['aaaa', 'acab', 'aaaa']))(_asph_var(1))


# ------------------------------------------------------------------ 콘크리트 판
# 깨진 콘크리트 판 이음 판(64×64, 칸 (x mod 4, y mod 4) 자리): 판 이음은 2~3칸마다, 열마다 엇갈린다(칸 격자와 안 맞음).
SLAB_VSEAMS = [0, 37]                                       # 세로 이음 x (감싼다)
SLAB_HSEAMS = {0: [3, 33], 37: [18, 50]}                   # 판 열(시작 x) → 가로 이음 y 들
SLAB_CRACKS = [[(5, 12), (11, 15), (16, 14), (22, 18), (27, 17)], [(16, 14), (18, 9)], [(44, 27), (49, 32), (55, 31), (61, 36), (68, 35)],
               [(9, 44), (13, 49), (12, 55), (17, 60)], [(46, 58), (52, 61), (57, 60)]]
SLAB_HOLES = [(30, 26, 4, 3), (58, 8, 3, 2), (21, 52, 3, 2)]  # 떨어져 나간 덩이(흙이 보인다) — 칸 경계를 넘는 것 포함


def slab_col(x):
    x %= FP
    return max(v for v in SLAB_VSEAMS if v <= x)


def slab_field(c, ox, oy):
    def P(x, y, col): c.P(ox + x % FP, oy + y % FP, col)
    for y in range(FP):
        for x in range(FP):
            col = slab_col(x)
            f = 0.6 * wrapnoise(x, y, 231 + col, 16) + 0.4 * wrapnoise(x, y, 237, 8)   # 판마다 다른 큰 때 얼룩
            t = 5 if f > 0.42 else 4
            if f > 0.70: t = 6
            if f < 0.20: t = 3
            gx, gy = (x + (y // 2) % 2) // 2, y // 2
            d = h2(gx % 32, gy % 32, 241) % 7                   # 2×2 덩이 ±1(셋 중 하나꼴)
            if d in (0, 1): t += 1
            elif d in (2, 3): t -= 1
            if h2(x % FP, y % FP, 245) % 53 == 0: t = 2              # 드문 골재 구멍
            c.P(ox + x, oy + y, K('conc', max(2, min(7, t))))
    for vx in SLAB_VSEAMS:                                    # 세로 이음: 서쪽 판 끝 그늘 · 줄눈 · 동쪽 판 모서리 빛(1화소 흔들림)
        for y in range(FP):
            w = 1 if h2(vx, y // 5, 251) % 3 == 0 else 0
            P(vx - 1 + w, y, K('conc', 3)); P(vx + w, y, K('conc', 1)); P(vx + 1 + w, y, K('conc', 6))
    for col, ys in SLAB_HSEAMS.items():                       # 가로 이음: 위 판 아래 그늘 · 줄눈 · 아래 판 윗 모서리 빛
        nxt = min([v for v in SLAB_VSEAMS if v > col] + [FP])
        for hy in ys:
            for x in range(col + 2, nxt):
                w = 1 if h2(x // 5, hy, 253) % 3 == 0 else 0
                P(x, hy - 1 + w, K('conc', 3)); P(x, hy + w, K('conc', 1)); P(x, hy + 1 + w, K('conc', 6))
    for pts in SLAB_CRACKS:                                   # 금(판을 가로지르고 칸 경계를 넘는다)
        for (a, b) in zip(pts, pts[1:]):
            n = max(abs(b[0] - a[0]), abs(b[1] - a[1]), 1)
            for i in range(n + 1):
                x = round(a[0] + (b[0] - a[0]) * i / n); y = round(a[1] + (b[1] - a[1]) * i / n)
                P(x, y, K('conc', 1)); P(x, y + 1, K('conc', 7))
    for (cx, cy, rx, ry) in SLAB_HOLES:                       # 떨어져 나간 덩이: 흙 + 깨진 둘레(위 그늘 · 아래 빛 턱)
        pts = [(x, y) for y in range(cy - ry - 1, cy + ry + 2) for x in range(cx - rx - 1, cx + rx + 2)
               if ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 + (wrapnoise(x, y, 257, 4) - 0.5) * 0.9 < 1]
        S = set(pts)
        for (x, y) in pts: P(x, y, K('dirt', dirt64_tone(x, y)))
        for (x, y) in pts:
            if (x, y - 1) not in S: P(x, y, K('dirt', 1))
            if (x, y + 1) not in S: P(x, y + 1, K('conc', 7))
            if (x - 1, y) not in S: P(x - 1, y, K('conc', 2))


def _slab64(v):
    """v=0 바탕 판. v=1 은 칸 안 잡초·작은 구멍, v=2 는 칸 안 기름 얼룩·부스러기 — 같은 자리 칸과 바꿔 끼운다."""
    def draw(c):
        slab_field(c, 0, 0)
        if v == 0: return
        for cy in range(4):
            for cx in range(4):
                ox, oy = cx * 16, cy * 16; r = h2(cx, cy, 310 + v)
                jx, jy = 3 + r % 7, 3 + (r >> 4) % 7
                if v == 1:
                    for i in range(5): c.P(ox + jx + i, oy + jy + 6 + (i % 2), K('conc', 1)); c.P(ox + jx + i, oy + jy + 7 + (i % 2), K('conc', 7))   # 작은 금
                    fan(c, ox + jx + 2, oy + jy + 6, 5, 'grass', r % 97, 7, 2)
                    if r % 2: fan(c, ox + jx + 6, oy + jy + 7, 4, 'dry', r % 89, 5, 1)
                else:
                    rx = 3 + r % 2; cxx, cyy = ox + jx + 2, oy + jy + 2          # 기름 얼룩: 바깥 옅은 테(conc 3) · 속(soot 3·4) · 무지개 한 점
                    c.ell(cxx, cyy, rx, 2, K('conc', 3)); c.ell(cxx, cyy, rx - 1, 1, K('soot', 4)); c.HL(cxx - 1, cyy, 2, K('soot', 3))
                    c.P(cxx + 1, cyy - 1, K('oil', 4)); c.P(cxx - 2, cyy + 1, K('soot', 5))
                    pebble(c, ox + jx + 5, oy + jy + 4, 1, 'conc', 7, 5, 3, K('conc', 2))
    return draw


SLAB_IDS = {'a': ('slab-a', None, None), 'b': ('slab-b', None, None), 'c': ('slab-c', None, None)}
_slab_grid = {'a': ['aaaaaa', 'aaaaaa', 'aaaaaa', 'aaaaaa', 'aaaaaa'], 'b': ['aabaaa', 'aaaaba', 'baaaaa', 'aaabaa', 'abaaab'],
              'c': ['aaacaa', 'caaaaa', 'aaaaca', 'acaaaa', 'aaacaa']}
for _v, _l in enumerate('abc'):
    piece('slab-' + _l, '금 간 콘크리트 판 ' + 'ABC'[_v], 4, 4, TERRAIN,
          en='broken old concrete pavement: irregular large pads with seams every two to three tiles, long cracks and missing chunks crossing tile borders, a seamless 4x4-tile field' +
             ['', ', mixed with tiles of weeds in small cracks', ', mixed with tiles of oil stains and grit'][_v],
          group='ground', tags=['콘크리트', '광장', '바닥'],
          desc='옛 광장·건물 바닥의 깨진 콘크리트 판 이음 판(4×4칸, 주기 64화소) — 맵 칸 (x,y) 에는 판의 (x mod 4, y mod 4) 칸을 깐다. A 바탕, B 잡초·C 기름 얼룩은 같은 자리 칸을 드물게 바꿔 끼운다.',
          sample=tiled(SLAB_IDS, _slab_grid[_l]))(_slab64(_v))


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
            for (x, y, col) in ((2, 8, 'wpaint'), (7, 5, 'ginkgo'), (12, 2, 'ginkgo'), (10, 7, 'wpaint'), (5, 10, 'ginkgo')):
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

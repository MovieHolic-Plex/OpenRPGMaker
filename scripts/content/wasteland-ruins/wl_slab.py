"""wasteland_ruins 깨진 콘크리트 판 r60b — 곧은 줄눈(맵 단위 판 짜임) + 판마다 다른 단 + 칸 안 표시 + 흙 쪽 부서짐 · 길 쪽 연석.

r58·r59(128화소 판 안에 그린 줄눈)와 r60a(가장자리 맞춤 구불 줄눈)는 적대 검수에서 떨어졌다: 128 주기 얼룩, 판석·조각 포장으로 읽힘,
금이 줄눈과 같은 모양, 구멍이 벌레·리벳으로 읽힘, 보도와 아스팔트 사이 흙 틈. r60b 는 줄눈을 «판 짜임»으로 맵 단위에서 정한다:

- 가로 줄눈 줄: 맵 y 위로 2~4칸마다(해시), 그 사이 띠마다 세로 줄눈이 2~4칸마다(띠마다 어긋남) — 2~4칸 네모 판, 줄눈은 길고 곧다.
  줄눈은 칸 경계(칸 윗줄·왼줄 화소)에 눕는다. 이웃이 판이 아닌 쪽에는 줄눈이 없다(한 칸 보도 띠는 가로지르는 줄눈만 생긴다).
- `slab-ground` (terrain, 8×24칸): 줄눈 없는 결 8×8 판을 단 셋(어두움·가운데·밝음)으로. 판(줄눈으로 둘린 네모)마다 단 하나를 해시로 고른다.
  결은 2~3화소 골재 덩이(한 단)뿐 — 넓은 얼룩이 없어 128 주기가 드러나지 않는다.
- `slab-joints` (flat): 칸 덧그림. 순서(구성기 slabJointFinish 와 같다):
  1) 속 칸: 줄눈 상태 js(bit0 = 윗줄 줄눈, bit1 = 왼줄 줄눈) 0..3 마다 DECORS 중 쓸 수 있는 것 차례로.
  2) 둘레 칸: 네 변 종류 코드 c = N*27 + E*9 + S*3 + W (0 판 · 1 흙 · 2 길), c = 1..80 마다, jN ∈ (0,1 if N 판), jW ∈ (0,1 if W 판), 변형 v ∈ 0..1.
  칸 순번 i 의 자리 = (i % 16, i // 16).
그림 규칙: 줄눈 = 1화소 짙은 회청 홈 + 그 아래(가로)·오른쪽(세로) 한 화소 밝은 판 끝(곧은 실선이라 점선이 아니다).
금 = 줄눈보다 밝고 차가운 회색 1화소, 빛 테 없음, 끝은 한 단 밝게 잦아든다. 구멍 = 줄눈 옆 들쭉날쭉 패임(3/4: 안쪽 윗벽 가장 어둡고 바닥 흙, 아래 테 밝게).
흙 쪽 = 판 끝이 흙으로 부서진다(남쪽은 판 두께 두 줄). 길 쪽 = 연석(윗면 밝은 테, 남쪽 길이면 두 줄 앞면).
"""
from wl_kit import *
from wl_ground import TERRAIN, FLAT, tiled, DIRT8_IDS

SP = 128
COLS = 16
GR = MAT['body']               # 0 676a77 · 1 757886 · 2 848794 · 3 9496a1 · 4 a1a3ac · 5 afb1b8 · 6 bcbdc3
G_BASE = 3
TONES = (-1, 0, 1)
J_COL, J_DEEP = S['slate'][1], S['slate'][0]
J_DIRT = (S['bark'][1], S['bark'][2])
CRACK, CRACK_END = S['slate'][2], GR[1]
DIRT = MAT['dirt']
DECORS = ('plain0', 'plain1', 'crack0', 'crack1', 'crack2', 'crack3', 'spall0', 'spall1', 'weed0', 'weed1', 'chip', 'heave', 'stain0', 'stain1', 'patch')


def decor_ok(d, js):
    if d.startswith(('spall', 'weed')): return js > 0
    if d == 'chip': return js == 3
    if d == 'heave': return bool(js & 1)
    return True


def tile_order():
    out = []
    for js in range(4):
        for d in DECORS:
            if decor_ok(d, js): out.append(('in', js, d))
    for c in range(1, 81):
        n, e, s, w = c // 27, (c // 9) % 3, (c // 3) % 3, c % 3
        for jn in ((0, 1) if n == 0 else (0,)):
            for jw in ((0, 1) if w == 0 else (0,)):
                for v in (0, 1): out.append(('rim', (n, e, s, w), jn | (jw << 1), v))
    return out


ORDER = tile_order()
ROWS = (len(ORDER) + COLS - 1) // COLS
IN_INDEX = {}
RIM_INDEX = {}
for _i, _t in enumerate(ORDER):
    if _t[0] == 'in': IN_INDEX.setdefault(_t[1], {})[_t[2]] = _i
    else: RIM_INDEX[(_t[1], _t[2], _t[3])] = _i


# ------------------------------------------------------------------ 아래층: 결 + 판 단
_GT = {}


def ground_tone(x, y):
    """결 단(GR 색인, 판 단 더하기 전). 2~3화소 골재 덩이만 — 어두운 덩이 한 단, 드문 밝은 덩이 한 단.
    덩이는 칸(16화소) 경계를 넘지 않는다: 칸 64개가 서로 독립이라 구성기가 칸마다 아무 칸이나 해시로 골라도 이음이 없고, 주기가 생기지 않는다."""
    if not _GT:
        for yy in range(SP):
            for xx in range(SP): _GT[(xx, yy)] = G_BASE
        shapes = ([(0, 0), (1, 0), (0, 1), (1, 1)], [(0, 0), (1, 0), (2, 0), (1, 1)], [(0, 0), (1, 0), (0, 1)], [(0, 0), (0, 1), (1, 1), (1, 2)])
        for k in range(1400):
            r = h2(k, 17, 6101)
            cx, cy = (r % 64) % 8, (r % 64) // 8
            pts = shapes[(r >> 6) % 4]
            mx, my = max(p[0] for p in pts), max(p[1] for p in pts)
            x0 = cx * 16 + (r >> 8) % (16 - mx); y0 = cy * 16 + h2(k, 19, 6103) % (16 - my)
            light = k % 5 == 0
            deep = not light and k % 4 == 1                 # 깊은 골재(두 단 어둠) — 덩이 가운데 한 화소
            bright = light and k % 3 == 0                   # 밝은 골재 알(두 단 밝음) — 덩이 가운데 한 화소
            for j, (dx, dy) in enumerate(pts):
                p = (x0 + dx, y0 + dy)
                if _GT[p] == G_BASE: _GT[p] = (G_BASE + (2 if bright and j == 0 else 1)) if light else (G_BASE - 2 if deep and j == 0 else G_BASE - 1)
        for k in range(60):                                 # 닳은 자리: 칸 안 4~6화소 두 줄 덩이, 한 단 밝음(선이 아니라 닳은 면)
            r = h2(k, 23, 6107)
            cx, cy = (r % 64) % 8, (r % 64) // 8
            ln = 4 + (r >> 6) % 3
            x0 = cx * 16 + 1 + (r >> 8) % (14 - ln); y0 = cy * 16 + 1 + h2(k, 29, 6109) % 12
            for i in range(ln):
                for j in (0, 1):
                    if j == 1 and (i == 0 or i == ln - 1): continue
                    _GT[(x0 + i, y0 + j)] = G_BASE + 1
    return _GT[(x % SP, y % SP)]


def ground_cell(x, y, seed):
    """맵 칸 (x,y) 가 쓰는 slab-ground 칸(0..63, 단 안 순번). 칸이 서로 독립이라 해시로 고른다(구성기와 같은 규칙)."""
    return h2(x * 3 + 11, y * 7 + 13, seed + 509) % 64


@piece('slab-ground', '깨진 콘크리트 판 바탕 (단 셋)', 8, 24, TERRAIN,
       en='old city concrete ground seen from above, shown on a sample board as it is used: the joint-free poured concrete texture (light grey with small 2-3 px '
          'aggregate clumps and a few soft worn spots, in three slightly different greys, one per slab) laid as plazas and sidewalks on dirt beside an asphalt road, '
          'with its separate joint/crack/broken-edge decal layer drawn on top for context',
       group='ground', tags=['콘크리트', '광장', '보도', '바닥'],
       desc='깨진 콘크리트 판의 아래층(줄눈 없음). 8×8칸 결 판을 단 셋(rows 0~7 어두움 · 8~15 가운데 · 16~23 밝음)으로 둔다. '
            '칸 64개는 서로 독립(골재 덩이가 칸 경계를 넘지 않음). 맵 칸 (x,y) 에는 판 단 t 와 n = ground_cell(x,y) 로 rows[n//8 + 8t].tiles[n%8] — 주기 없음. 줄눈으로 둘린 판마다 단 하나. 위 평면층에 slab-joints.',
       sample=lambda f=0: board_sample(seed=5))
def _ground(c):
    for t, d in enumerate(TONES):
        for y in range(SP):
            for x in range(SP): c.P(x, t * SP + y, GR[ground_tone(x, y) + d])


# ------------------------------------------------------------------ 판 짜임(맵 단위, 구성기와 같은 규칙)
def _lines(n, seed, k, start_mod, lo, span):
    out, p, j = [], -(h2(k, start_mod, seed) % 3), 0
    while p < n:
        out.append(p); p += lo + h2(k * 61 + j, start_mod + 1, seed) % span; j += 1
    return out


class Layout:
    """맵 W×H 의 판 짜임: rows = 가로 줄눈 y 들, cols[band] = 그 띠의 세로 줄눈 x 들."""
    def __init__(s, W, H, seed):
        s.rows = _lines(H, seed + 501, 0, 0, 2, 3)
        s.band = [0] * H
        for y in range(H): s.band[y] = max(i for i, p in enumerate(s.rows) if p <= y) if any(p <= y for p in s.rows) else 0
        s.cols = [set(_lines(W, seed + 503, k + 1, 2, 2, 3)) for k in range(len(s.rows))]
        s.colsl = [sorted(c) for c in s.cols]
        s.rowset = set(s.rows); s.seed = seed

    def jN(s, x, y): return y in s.rowset
    def jW(s, x, y): return x in s.cols[s.band[y]]

    def tone(s, x, y):
        k = s.band[y]; cs = s.colsl[k]
        j = max([i for i, p in enumerate(cs) if p <= x] or [0])
        r = h2(k * 97 + 3, j * 89 + 5, s.seed + 507) % 10
        return 0 if r < 2 else 1 if r < 8 else 2


def decor_of(x, y, js, seed):
    r = h2(x * 7 + 3, y * 11 + 5, seed + 431) % 100
    q = h2(x * 13 + 1, y * 5 + 9, seed + 433)
    if r < 36: d = 'plain1' if q % 4 == 0 else 'plain0'
    elif r < 56: d = 'stain%d' % (q % 2)
    elif r < 74: d = 'crack%d' % (q % 4)
    elif r < 84: d = 'spall%d' % (q % 2)
    elif r < 93: d = 'weed%d' % (q % 2)
    else: d = 'chip' if js == 3 else 'heave'
    return d if decor_ok(d, js) else 'plain0'


def cell_tile(slab, road, L, x, y, seed):
    """칸 (x,y) 의 slab-joints 칸 순번. slab/road = 칸 → bool."""
    def side(dx, dy):
        p = (x + dx, y + dy)
        return 0 if slab(*p) else 2 if road(*p) else 1
    sides = (side(0, -1), side(1, 0), side(0, 1), side(-1, 0))
    js = (1 if L.jN(x, y) and sides[0] == 0 else 0) | (2 if L.jW(x, y) and sides[3] == 0 else 0)
    if sides == (0, 0, 0, 0): return IN_INDEX[js][decor_of(x, y, js, seed)]
    v = 1 if h2(x * 5 + 1, y * 3 + 7, seed + 437) % 4 == 0 else 0
    return RIM_INDEX[(sides, js, v)]


# ------------------------------------------------------------------ 칸 그림
def _in(x, y, m=0): return m <= x <= 15 - m and m <= y <= 15 - m


def _joints(c, js, dirty, seed):
    """줄눈 = 네 화소 베벨: 위(왼) 판의 그늘진 끝(GR2) · 짙은 회청 홈(slate1) · 이 판의 빛 받은 끝(GR6) · 잦아드는 빛(GR5/GR4).
    모두 이 칸 안(윗줄 0~3 · 왼줄 0~3)이라 이웃 칸을 몰라도 줄눈 양쪽 판 끝이 모델링된다."""
    J = set()
    H, V = js & 1, js & 2
    if H:
        for x in range(16): c.P(x, 0, GR[1])
    if V:
        for y in range(16): c.P(0, y, GR[1])
    if H: J |= {(x, 1) for x in range(16)}
    if V: J |= {(1, y) for y in range(16)}
    for (x, y) in J:
        d = dirty and h2(x // 4 if y == 1 else y // 4, 1 if y == 1 else 2, seed + 7) % 3 == 0
        c.P(x, y, J_DIRT[(x + y) % 2] if d else J_COL)
    if H:
        for x in range(2 if V else 0, 16): c.P(x, 2, GR[6])
        for x in range(3 if V else 0, 16):
            if h2(x, 3, seed + 9) % 3: c.P(x, 3, GR[5])
    if V:
        for y in range(3 if H else 0, 16): c.P(2, y, GR[5])
        for y in range(4 if H else 0, 16):
            if h2(3, y, seed + 9) % 3 == 0: c.P(3, y, GR[4])
    if H and V: c.P(0, 0, GR[1]); c.P(1, 0, J_COL); c.P(0, 1, J_COL)
    out = set(J)
    for k in range(4):
        if H: out |= {(x, k) for x in range(16)}
        if V: out |= {(k, y) for y in range(16)}
    return out


def _stain(c, J, seed, light=False):
    """판 위 얼룩: 젖은 그늘(어두운 덩이 둘레 한 단) 또는 덧바른 자리(밝은 네모, 아래·오른 끝 그늘). 칸 안 5~9화소."""
    r = h2(seed, 9, 53)
    if light:
        x0, y0 = 4 + r % 2, 5 + (r >> 3) % 2
        w, hh = 10 + (r >> 6) % 2, 9
        x1, y1 = min(14, x0 + w) - 1, min(14, y0 + hh) - 1
        for y in range(y0 - 1, y1 + 2):
            for x in range(x0 - 1, x1 + 2):
                if (x, y) in J or not _in(x, y, 3): continue
                corner = (x in (x0 - 1, x1 + 1)) and (y in (y0 - 1, y1 + 1))
                if corner: continue
                edge = x in (x0 - 1, x1 + 1) or y in (y0 - 1, y1 + 1)
                c.P(x, y, GR[1] if edge and (y == y0 - 1 or x == x0 - 1) else GR[2] if edge else
                    GR[5] if (y == y0 or x == x0) else GR[4] if h2(x, y, seed + 2) % 5 else GR[3])
        return
    pts = {}
    for k in range(4 + (r >> 6) % 3):                     # 젖은 얼룩: 둥근 덩이 여럿, 가운데로 갈수록 어둡다
        q = h2(k, r, seed + 1)
        bx, by = 5 + q % 6, 5 + (q >> 4) % 6
        rad = 2.0 + ((q >> 8) % 3) * 0.6
        for y in range(16):
            for x in range(16):
                d = ((x - bx) ** 2 + (y - by) ** 2) ** 0.5
                if d <= rad: pts[(x, y)] = max(pts.get((x, y), 0), 2 if d <= rad - 1.4 else 1)
    for (x, y), v in pts.items():
        if (x, y) in J or not _in(x, y, 3): continue
        if v == 1 and h2(x, y, seed + 4) % 4 == 0: continue
        c.P(x, y, GR[1] if v == 2 else GR[2])


def _unused_stain_tail(c, J, pts):
    for (x, y) in pts:
        if (x, y) in J or not _in(x, y, 3): continue
        nb = sum((x + dx, y + dy) in pts for dx in (-1, 0, 1) for dy in (-1, 0, 1))
        c.P(x, y, GR[0] if nb == 9 else GR[1] if nb >= 6 else GR[2])


def _crack(c, J, seed):
    """금: 가지 없는 머리카락 금 한 줄 — 칸을 거의 가로(또는 세로)로 11~14화소 흘러가며 2~3화소마다 한 화소 꺾인다.
    r60a·r60b 첫 판의 Y 자·갈고리 금은 기호로 읽혔다(검수). 줄눈(짙은 회청 곧은 홈)과 달리 판 색보다 두 단 어두운 회색, 빛 테 없음, 양 끝 한 단 옅게."""
    r = h2(seed, 3, 41)
    horiz = r % 2 == 0
    a = 3 + (r >> 1) % 10                 # 가로 금이면 시작 y, 세로 금이면 시작 x
    u0 = 1 + (r >> 5) % 3
    n = 11 + (r >> 7) % 4
    pts, v, drift = [], a, 1 if (r >> 9) % 2 else -1
    step = 0
    for k in range(n):
        u = u0 + k
        if u > 14: break
        step += 1
        if step >= 2 + h2(k, r, seed + 1) % 2:
            step = 0
            if h2(k, r, seed + 2) % 4 == 0: drift = -drift
            nv = v + drift
            if 2 <= nv <= 13:
                pts.append((u, v) if horiz else (v, u))
                v = nv
        pts.append((u, v) if horiz else (v, u))
    m = len(pts)
    for k, p in enumerate(pts):
        if p in J or not _in(*p, 1): continue
        c.P(p[0], p[1], GR[1] if k in (0, m - 1) else GR[0])


def _spall(c, J, js, seed):
    """줄눈을 따라 떨어져 나간 자리(7~10×4~6, 들쭉날쭉 덩이): 안쪽 윗벽(그늘, 짙은 회청 → 판 그늘) · 바닥 흙에 회색 자갈 알 ·
    아래·오른 테는 깨진 밝은 판 끝, 바깥 둘레 몇 화소는 금 간 판(한 단 어둠). 3/4: 위쪽 벽이 보이고 아래 벽은 테만."""
    r = h2(seed, 5, 43)
    along_h = js & 1 and (not js & 2 or r % 2)
    w, hh = 7 + (r >> 4) % 4, 4 + (r >> 6) % 3
    if along_h: x0, y0 = 3 + r % (12 - w + 1 if w < 12 else 1), 2
    else: x0, y0 = 2, 4 + r % (12 - hh)
    hole = set()
    for k in range(4 + (r >> 9) % 2):                      # 둥근 덩이 네댓 개를 합친 패임 — 네모·뚜껑 모양이 아니다
        q = h2(k, r, seed + 2)
        bx, by = x0 + q % w, y0 + 1 + (q >> 4) % max(1, hh - 1)
        rad = 1.6 + ((q >> 8) % 3) * 0.5
        for y in range(int(by - rad) - 1, int(by + rad) + 2):
            for x in range(int(bx - rad) - 1, int(bx + rad) + 2):
                if (x - bx) ** 2 + (y - by) ** 2 <= rad * rad and _in(x, y, 1): hole.add((x, y))
    for (x, y) in hole:
        up = (x, y - 1) not in hole
        up2 = (x, y - 2) not in hole
        if up: c.P(x, y, J_DEEP if (x, y - 1) in J or h2(x, y, seed + 5) % 3 == 0 else S['slate'][2])
        elif up2: c.P(x, y, GR[0])
        else:                                              # 패인 바닥 = 드러난 굵은 골재(회색 알), 흙은 드문 알갱이만
            q = h2(x, y, seed + 3) % 10
            c.P(x, y, GR[3] if q < 2 else GR[2] if q < 4 else GR[0] if q < 6 else DIRT[3] if q == 6 else GR[1])
    for (x, y) in hole:
        for (nx, ny, col) in ((x, y + 1, GR[6]), (x + 1, y, GR[5]), (x - 1, y, GR[2])):
            if (nx, ny) not in hole and (nx, ny) not in J and _in(nx, ny, 1): c.P(nx, ny, col)
    for k in range(3):
        q = h2(k, r, seed + 8)
        p = (x0 + w + q % 2, y0 + hh // 2 + k - 1) if along_h else (x0 + (q % w), y0 + hh + q % 2)
        if p not in hole and p not in J and _in(*p, 1): c.P(p[0], p[1], GR[1])


def _weed(c, J, js, seed):
    """줄눈에서 자란 풀(잎 4~5장, 키 2~4, 비대칭)."""
    r = h2(seed, 7, 47)
    if js & 1 and (not js & 2 or r % 2): bx, by = 4 + r % 8, 2
    else: bx, by = 2, 6 + r % 7
    blades = [(-4, 2), (-3, 3), (-2, 4), (-1, 5), (0, 6), (1, 5), (2, 4), (3, 3), (4, 2)][(r >> 4) % 2:]
    for k, (dx, hgt) in enumerate(blades):
        hgt = max(2, hgt - h2(k, r, seed) % 2)
        for j in range(hgt):
            x = bx + dx + (dx * j) // 3; y = by - j + 1
            if not _in(x, y, 0): continue
            t = 1 if j == 0 else 2 if j < hgt - 1 else 4
            if (k + r) % 3 == 0: t = max(1, t - 1)
            c.P(x, y, K('grass', t))


def _chip(c, seed):
    """판 귀 떨어짐(줄눈 만나는 귀 오른아래): 3~4화소 삼각 패임, 판 그늘 단."""
    n = 3 + seed % 2
    for i in range(n):
        for j in range(n - i):
            x, y = 2 + i, 2 + j
            c.P(x, y, J_COL if i + j <= 1 else GR[0] if i + j <= 2 else GR[1])
    c.P(2 + n, 2, GR[5]); c.P(2, 2 + n, GR[4])


def _heave(c, seed):
    """들뜬 판 끝: 윗줄 줄눈 6~9화소 토막이 벌어지고 그 밑 판 끝 두 줄이 밝다."""
    a = 2 + seed % 5; b = min(14, a + 6 + (seed >> 3) % 4)
    for x in range(a, b):
        c.P(x, 1, J_DEEP); c.P(x, 2, GR[6]); c.P(x, 3, GR[5])


def _rim_profile(seed, side):
    """변 하나의 흙 깊이 16개: 끝(0·15)은 2(이웃 칸과 같다), 속은 4~8화소 덩이마다 1~4."""
    out, t = [], 0
    while t < 16:
        ln = 3 + h2(t, side, seed) % 5
        d = 1 + h2(t, side + 5, seed) % 3
        for j in range(ln):
            q = h2(t + j, side + 9, seed) % 7
            out.append(max(1, min(4, d + (1 if q == 0 else -1 if q == 1 else 0))))
        t += ln
    out = out[:16]
    out[0] = out[15] = 2
    out[1] = min(3, max(1, out[1])); out[14] = min(3, max(1, out[14]))
    return out


def _draw_edges(c, sides, seed):
    n, e, s, w = sides
    dirt = set()
    prof = {k: _rim_profile(seed, i) for i, k in enumerate('nesw')}
    for t in range(16):
        if n == 1:
            for k in range(prof['n'][t]): dirt.add((t, k))
        if s == 1:
            for k in range(prof['s'][t] + 1): dirt.add((t, 15 - k))
        if w == 1:
            for k in range(prof['w'][t]): dirt.add((k, t))
        if e == 1:
            for k in range(prof['e'][t]): dirt.add((15 - k, t))
    for (x, y) in dirt:
        c.P(x, y, DIRT[1] if (x, y - 1) not in dirt and y > 0 and (x, y - 1) not in dirt and s == 1 and y >= 10 else
            DIRT[3] if h2(x, y, seed + 61) % 4 else DIRT[5] if h2(x, y, seed + 62) % 2 else DIRT[2])
    for y in range(16):
        for x in range(16):
            if (x, y) in dirt: continue
            if (x, y + 1) in dirt:                                         # 남쪽 끝: 판 두께 두 줄
                c.P(x, y, GR[0])
                if (x, y - 1) not in dirt and y > 0: c.P(x, y - 1, GR[1] if h2(x, y, seed + 64) % 3 else GR[2])
            elif (x, y - 1) in dirt: c.P(x, y, GR[5])                      # 북쪽 깨진 끝(빛)
            elif (x - 1, y) in dirt: c.P(x, y, GR[4])
            elif (x + 1, y) in dirt: c.P(x, y, GR[1])
    # 길 쪽 연석
    if n == 2:
        for x in range(16):
            if (x, 0) not in dirt: c.P(x, 0, GR[6])
    if s == 2:
        for x in range(16):
            if (x, 13) not in dirt: c.P(x, 13, GR[6])
            c.P(x, 14, GR[1]); c.P(x, 15, GR[0])
    if w == 2:
        for y in range(16):
            if (0, y) not in dirt and not (s == 2 and y >= 14): c.P(0, y, GR[6])
    if e == 2:
        for y in range(16):
            if (15, y) not in dirt and not (s == 2 and y >= 14): c.P(15, y, GR[2])


def draw_tile(c, ox, oy, spec):
    sub = Cv(16, 16)
    if spec[0] == 'in':
        _, js, d = spec
        seed = 9001 + js * 101 + DECORS.index(d) * 13
        J = _joints(sub, js, d == 'plain1', seed)
        if d.startswith('crack'): _crack(sub, J, seed + int(d[-1]) * 7)
        elif d.startswith('spall'): _spall(sub, J, js, seed + int(d[-1]) * 11)
        elif d.startswith('weed'): _weed(sub, J, js, seed + int(d[-1]) * 5)
        elif d == 'chip': _chip(sub, seed)
        elif d == 'heave': _heave(sub, seed)
        elif d.startswith('stain'): _stain(sub, J, seed + int(d[-1]) * 3)
        elif d == 'patch': _stain(sub, J, seed, light=True)
    else:
        _, sides, js, v = spec
        seed = 9501 + sum(q * 3 ** i for i, q in enumerate(sides)) * 17 + js * 5 + v * 211
        J = _joints(sub, js, v == 1, seed)
        if v == 1:                                          # 둘레 칸 변형 1: 판 얼굴에 얼룩이나 금 하나(보도 띠가 맨 판으로만 이어지지 않게)
            _stain(sub, J, seed + 2)
        _draw_edges(sub, sides, seed)
    c.a[oy:oy + 16, ox:ox + 16] = sub.a


@piece('slab-joints', '깨진 콘크리트 판 줄눈·가장자리 덧그림', COLS, ROWS, FLAT,
       en='old city concrete pavement seen from above: long straight saw-cut slab joints (a bevel: shaded lip of the upper/left slab, dark groove, lit lip of the lower/right slab) laid as 2-4 tile '
          'panels in staggered rows, thin dark hairline cracks (finer and more broken than the joints), a few spalled holes showing earth along joints, weeds in joints, a chipped corner '
          'a heaved slab edge and damp stains; slab edges crumble into dirt (the south edge shows the slab thickness) and meet the asphalt road as a clean kerb; transparent decal over plain concrete',
       group='ground', tags=['콘크리트', '줄눈', '덧그림', '보도', '광장'],
       desc='깨진 콘크리트 판의 줄눈·표시·가장자리 덧그림(위 평면층). 붓으로 찍지 않는다 — 구성기가 맵 판 짜임(가로 줄눈 2~4칸마다, 띠마다 세로 줄눈 2~4칸)과 '
            '네 이웃 종류(판·흙·길)로 칸을 고른다. 아래층은 slab-ground.',
       sample=lambda f=0: board_sample(SAMPLE_PLAN_B, seed=195))
def _joint_sheet(c):
    for i, spec in enumerate(ORDER): draw_tile(c, (i % COLS) * 16, (i // COLS) * 16, spec)


# ------------------------------------------------------------------ 표본 판(구성기 규칙 그대로)
SAMPLE_PLAN = [
    '......................',
    '..##################..',
    '..##################..',
    '..##################..',
    '..######.....#######..',
    '..######.....#######..',
    '..##################..',
    '..##################..',
    '......................',
    '######################',
    'RRRRRRRRRRRRRRRRRRRRRR',
    'RRRRRRRRRRRRRRRRRRRRRR',
    '######################',
    '...#........#.........',
]
SAMPLE_PLAN_B = [
    '......................',
    '.##############.......',
    '.##############..####.',
    '.##############..####.',
    '.#####....#####..####.',
    '.#####....#####.......',
    '.##############.......',
    '......................',
    '######################',
    'RRRRRRRRRRRRRRRRRRRRRR',
    'RRRRRRRRRRRRRRRRRRRRRR',
    '######################',
    '.......#.......#......',
    '..##############......',
]


def board_sample(plan=SAMPLE_PLAN, seed=5):
    H, W = len(plan), len(plan[0])
    slab = lambda x, y: 0 <= x < W and 0 <= y < H and plan[y][x] == '#'
    road = lambda x, y: 0 <= x < W and 0 <= y < H and plan[y][x] == 'R'
    dirt = tiled(DIRT8_IDS, [''.join('b' if h2(i, j, 6) % 16 < 10 else 'c' if h2(i, j, 6) % 16 < 13 else 'd' for i in range(W)) for j in range(H)])()
    asph = render(PIECES['asphalt-ph']) if 'asphalt-ph' in PIECES else None
    G = render(PIECES['slab-ground']); Jm = render(PIECES['slab-joints'])
    L = Layout(W, H, seed)
    a = dirt.copy()
    for y in range(H):
        for x in range(W):
            blk = a[y * 16:(y + 1) * 16, x * 16:(x + 1) * 16]
            if road(x, y) and asph is not None: blk[:] = _asphalt_full(asph, x, y)
            if not slab(x, y): continue
            t, n = L.tone(x, y), ground_cell(x, y, seed)
            blk[:] = G[(t * 8 + n // 8) * 16:(t * 8 + n // 8) * 16 + 16, (n % 8) * 16:(n % 8) * 16 + 16]
            i = cell_tile(slab, road, L, x, y, seed)
            src = Jm[(i // COLS) * 16:(i // COLS) * 16 + 16, (i % COLS) * 16:(i % COLS) * 16 + 16]
            op = src[..., 3] == 255
            blk[op] = src[op]
    return a


def _asphalt_full(asph, x, y):
    """asphalt-ph 의 마스크 15 위상 칸(구성기 paint 와 같은 자리 (x%P)+(y%P)*P)."""
    import wl_ground as G_
    P = G_.APH
    k = (x % P) + (y % P) * P
    return asph[15 * 16:16 * 16, k * 16:k * 16 + 16]                      # 조각 안 칸 (위상 k, 마스크 15)

"""wasteland_ruins 깨진 콘크리트 판 r60 — 두 층: 이음 없는 콘크리트 결(아래층) + 가장자리 맞춤(Wang) 줄눈 덧그림(위 평면층).

r58·r59(128화소 위상 판 안에 줄눈을 그려 넣은 판)는 세 번 모두 적대 검수에서 떨어졌다: 128 주기 줄눈 무늬가 보이고, 같은 얼룩이 모든 변형에 있고,
판석(ashlar)처럼 읽히고, 결이 화강암 점무늬였다. r60 은 줄눈을 결에서 떼어 낸다.

- `slab-ground` (terrain, 8×8칸, 주기 128): 줄눈 없는 콘크리트 결. 2~3화소 덩이가 ±1단, 넓은 젖은 자리 −1단. 낱화소 흰 점·갈색 점 없음.
- `slab-joints` (flat, 16열 × 21행 = 칸 327): 칸 네 변마다 «줄눈이 그 변을 건너는 자리» 부호(0 = 안 건넘, 1·2·3 = 세 자리 중 하나)를 받고,
  네 부호 (N, E, S, W) 조합마다 칸 안 줄눈 그림. 맞닿은 두 칸은 같은 변 부호를 쓰니 줄눈이 칸 경계에서 끊기지 않고 이어진다.
  구성기가 변마다 해시로 부호를 정하므로(0 이 52%) 줄눈 짜임은 맵 어디서도 되풀이되지 않고, 줄눈은 칸 경계를 따라 눕지 않는다.
  건넘이 하나뿐인 칸은 줄눈이 잦아들어 실금으로 끝난다(깨진 콘크리트의 금). 건넘 0 칸은 빈 칸·실금·얕은 벗겨짐.
  칸 순서(구성기와 같은 규칙): 조합 = N*64 + E*16 + S*4 + W, 조합마다 변형 수 nv(k) (k = 0 아닌 부호 수: 0→6, 1→2, 2→2, 3·4→1),
  조합 순서대로 변형을 이어 놓고, 그 순번 i 의 칸이 조각 안 (i % 16, i // 16).
그림 규칙: 줄눈 = 1화소 짙은 회청(conc 1), 군데군데 흙 낀 토막. 줄눈 아래·오른쪽 한 화소 = 판 윗끝 빛(+1단), 위·왼쪽 = 그늘(−1단) — 끊김 없는 실선.
금 = 줄눈보다 밝은 회갈(conc 3), 가늘고 끝이 잦아든다. 깨진 귀 = 흙이 드러난 구멍(3/4: 안쪽 윗벽이 가장 어둡다). 잡초 = 줄눈에서 자란 작은 포기.
"""
from wl_kit import *
from wl_ground import TERRAIN, FLAT, wrapnoise, blobs, fan, tiled, DIRT8_IDS

SP = 128
NCODE = 4
H_OFF = (None, 3, 8, 12)       # 가로 변(N·S)을 건너는 줄눈의 x
V_OFF = (None, 4, 9, 13)       # 세로 변(W·E)을 건너는 줄눈의 y
COLS = 16

GR = MAT['body']               # 바탕 램프(차가운 중립 회색): 0 676a77 · 1 757886 · 2 848794 · 3 9496a1 · 4 a1a3ac · 5 afb1b8 · 6 bcbdc3
G_BASE = 3
J_COL = K('conc', 1)
J_DIRT = (S['bark'][1], S['bark'][2])
LIT, SHADE = GR[5], GR[1]
CRACK, CRACK_LIT = K('conc', 2), GR[5]


def nv(k): return 6 if k == 0 else 2 if k in (1, 2) else 1


def combos():
    """[(조합, 변형)] 칸 순서 — 구성기 slabJointTile 과 같다."""
    out = []
    for c in range(NCODE ** 4):
        n, e, s, w = c // 64, (c // 16) % 4, (c // 4) % 4, c % 4
        k = (n > 0) + (e > 0) + (s > 0) + (w > 0)
        for v in range(nv(k)): out.append(((n, e, s, w), v))
    return out


def rim_combos():
    """둘레 칸 [(조합, 흙 쪽 마스크)]: 마스크 m(N=1 E=2 S=4 W=8, 그 쪽 이웃이 판이 아님) 1~15 마다, 흙 쪽 부호는 0, 나머지 변 부호 조합 하나씩."""
    out = []
    for m in range(1, 16):
        free = [i for i, bit in enumerate((1, 2, 4, 8)) if not m & bit]
        for c in range(NCODE ** len(free)):
            code = [0, 0, 0, 0]
            for j, i in enumerate(free): code[i] = (c // NCODE ** j) % NCODE
            out.append((tuple(code), m, 0))
    for m in (5, 10):                                   # 한 칸 폭 띠: 띠를 가로지르는 곧은 줄눈(보도 판 이음) 두 가지
        out += [((0, 0, 0, 0), m, 1), ((0, 0, 0, 0), m, 2)]
    return out


COMBOS = combos()
RIMS = rim_combos()
ROWS = (len(COMBOS) + len(RIMS) + COLS - 1) // COLS


# ------------------------------------------------------------------ 아래층: 콘크리트 결
_GT = {}


def ground_tone(x, y):
    if not _GT:
        B = blobs(SP, 6011, 5)
        keys = sorted({v[0] for v in B.values()}, key=lambda k: hsh(k[0], k[1], 6013))
        R = {k: i / len(keys) for i, k in enumerate(keys)}
        for yy in range(SP):
            for xx in range(SP):
                k = B[(xx, yy)][0]
                r = R[k]
                wear = 0.55 * wrapnoise(xx, yy, 6017, 32, SP) + 0.45 * wrapnoise(xx, yy, 6019, 64, SP)
                damp = wrapnoise(xx, yy, 6023, 32, SP)
                t = G_BASE
                if r < 0.04 + 0.10 * wear: t = G_BASE + 1
                elif r > 0.95 - 0.05 * (1 - wear): t = G_BASE - 1
                if damp < 0.20 and r > 0.3: t -= 1                                   # 넓은 젖은 자리(덩이째 한 단 어둡게)
                g = h2((xx + (yy // 2) % 2) // 2 % (SP // 2), yy // 2 % (SP // 2), 6029) % 13   # 2×2 골재 덩이(낱화소 점 아님), 한 단만
                if g == 0: t -= 1
                elif g == 1 and t <= G_BASE: t += 1
                _GT[(xx, yy)] = max(1, min(5, t))
    return _GT[(x % SP, y % SP)]


@piece('slab-ground', '깨진 콘크리트 판 바탕', 8, 8, TERRAIN,
       en='plain weathered city concrete ground seen from above, a seamless 8x8-tile field: flat light grey concrete with soft wear and damp patches '
          'and small 2-3 px aggregate clumps one tone apart; the slab joints and cracks are a separate decal layer on top',
       group='ground', tags=['콘크리트', '광장', '보도', '바닥'],
       desc='깨진 콘크리트 판의 아래층 결(줄눈 없음, 8×8칸·주기 128화소). 맵 칸 (x,y) 에는 판의 (x mod 8, y mod 8) 칸을 깔고, 위 평면층에 slab-joints 줄눈 덧그림을 얹는다.',
       sample=lambda f=0: board_sample(seed=5))
def _ground(c):
    for y in range(SP):
        for x in range(SP): c.P(x, y, GR[ground_tone(x, y)])


# ------------------------------------------------------------------ 위층: 줄눈 칸
def _walk(a, b, seed, wob=0.12):
    """a→b 8방향 걸음(목표로 가까워지는 걸음 중에서 흔들어 고른다). 양 끝 포함."""
    (x, y), out = a, [a]
    i = 0
    while (x, y) != b and i < 64:
        dx, dy = (b[0] > x) - (b[0] < x), (b[1] > y) - (b[1] < y)
        opts = []
        if dx and dy: opts = [(dx, dy), (dx, 0), (0, dy)]
        elif dx: opts = [(dx, 0), (dx, 1), (dx, -1)]
        else: opts = [(0, dy), (1, dy), (-1, dy)]
        r = h2(x * 31 + i, y * 17, seed) % 100
        step = opts[0] if r >= wob * 100 else opts[1 + r % 2]
        nx, ny = x + step[0], y + step[1]
        if abs(b[0] - nx) + abs(b[1] - ny) > abs(b[0] - x) + abs(b[1] - y) + 1: nx, ny = x + opts[0][0], y + opts[0][1]
        x, y = nx, ny; out.append((x, y)); i += 1
    return out


def _cross_pts(code):
    """변 부호 → [(변, 경계 화소, 한 칸 안쪽 화소)]. 경계에서 두 화소는 변에 수직으로 들어온다(이웃 칸 줄눈과 곧게 잇는다)."""
    n, e, s, w = code
    out = []
    if n: out.append(('n', (H_OFF[n], 0), (H_OFF[n], 1)))
    if s: out.append(('s', (H_OFF[s], 15), (H_OFF[s], 14)))
    if w: out.append(('w', (0, V_OFF[w]), (1, V_OFF[w])))
    if e: out.append(('e', (15, V_OFF[e]), (14, V_OFF[e])))
    return out


def _inside(x, y, m=0): return m <= x <= 15 - m and m <= y <= 15 - m


def joint_layout(code, v):
    """(줄눈 화소 집합, 금 화소 목록, 손질 정보)."""
    seed = 7001 + sum(c * 4 ** i for i, c in enumerate(code)) * 7 + v * 131
    cr = _cross_pts(code)
    J, cracks = set(), []
    if len(cr) >= 2:
        if len(cr) == 2:
            (_, a0, a1), (_, b0, b1) = cr
            mx = (a1[0] + b1[0]) // 2 + (h2(seed, 1, 3) % 5) - 2
            my = (a1[1] + b1[1]) // 2 + (h2(seed, 2, 3) % 5) - 2
            mid = (max(3, min(12, mx)), max(3, min(12, my)))
            for p in _walk(a1, mid, seed) + _walk(mid, b1, seed + 1): J.add(p)
        else:
            jx, jy = 5 + h2(seed, 3, 5) % 6, 5 + h2(seed, 4, 5) % 6
            for i, (_, p0, p1) in enumerate(cr):
                for p in _walk(p1, (jx, jy), seed + 11 * i): J.add(p)
        for (_, p0, p1) in cr: J.add(p0); J.add(p1)
    elif len(cr) == 1:                                                    # 줄눈이 잦아들어 금으로 끝난다
        side, p0, p1 = cr[0]
        J.add(p0); J.add(p1)
        d = dict(n=(0, 1), s=(0, -1), w=(1, 0), e=(-1, 0))[side]
        ln = 6 + h2(seed, 5, 7) % 5
        end = (max(2, min(13, p1[0] + d[0] * ln + (h2(seed, 6, 7) % 7 - 3) * (d[0] == 0))),
               max(2, min(13, p1[1] + d[1] * ln + (h2(seed, 7, 7) % 7 - 3) * (d[1] == 0))))
        pts = _walk(p1, end, seed + 3, 0.45)
        J.update(pts[:2]); cracks.append(pts[2:])
    else:
        if v in (3, 4):                                                   # 칸 안 실금(양 끝이 잦아든다)
            a = (2 + h2(seed, 8, 9) % 4, 2 + h2(seed, 9, 9) % 5)
            b = (10 + h2(seed, 10, 9) % 4, 9 + h2(seed, 11, 9) % 5)
            if v == 4: a, b = (a[0], b[1]), (b[0], a[1])
            pts = _walk(a, b, seed + 5, 0.5)
            br = pts[len(pts) // 2]
            cracks.append(pts)
            cracks.append(_walk(br, (max(2, min(13, br[0] + (3 if v == 3 else -3))), min(13, br[1] + 4)), seed + 9, 0.5))
    return J, cracks, seed


def _bevel(c, J):
    for y in range(16):
        for x in range(16):
            if (x, y) in J: continue
            if (x, y - 1) in J or (x - 1, y) in J: c.P(x, y, LIT)
            elif (x, y + 1) in J or (x + 1, y) in J: c.P(x, y, SHADE)


def _draw_joints(c, J, seed):
    for (x, y) in J:
        dirt = h2(x // 3, y // 3, seed + 17) % 7 == 0 and _inside(x, y, 2)
        c.P(x, y, J_DIRT[(x + y) % 2] if dirt else J_COL)


def _draw_crack(c, pts, seed):
    n = len(pts)
    for i, (x, y) in enumerate(pts):
        if not _inside(x, y, 1): continue
        fade = i >= n - 2 and n > 4
        if fade and h2(x, y, seed) % 2: continue                          # 끝이 잦아든다
        c.P(x, y, CRACK)
    for (x, y) in pts[1:-2]:
        if _inside(x, y + 1, 1) and (x, y + 1) not in pts and h2(x, y, seed + 1) % 3: c.P(x, y + 1, CRACK_LIT)


def _chip(c, J, seed):
    """줄눈 위 한 자리에서 판 귀가 깨져 흙이 드러났다(4~6화소): 안쪽 윗벽 가장 어둡고, 바닥 흙, 아래 테 한 화소 빛."""
    cand = sorted([p for p in J if _inside(p[0], p[1], 4)], key=lambda p: h2(p[0], p[1], seed))
    if not cand: return False
    x0, y0 = cand[0]
    hole = {(x0 + dx, y0 + dy) for dx in range(-2, 3) for dy in range(0, 3) if abs(dx) + dy <= 2 + (h2(dx, dy, seed) % 2)}
    hole = {p for p in hole if _inside(p[0], p[1], 1)}
    for (x, y) in hole:
        top = (x, y - 1) not in hole
        c.P(x, y, S['bark'][0] if top else S['bark'][2] if h2(x, y, seed + 3) % 3 else S['bark'][1])
    for (x, y) in hole:
        if (x, y + 1) not in hole and _inside(x, y + 1, 1) and h2(x, y, seed + 5) % 2: c.P(x, y + 1, LIT)
    return True


def _weed(c, J, seed):
    cand = sorted([p for p in J if _inside(p[0], p[1], 4) and p[1] >= 6], key=lambda p: h2(p[0], p[1], seed + 2))
    if not cand: return False
    x, y = cand[0]
    fan(c, x, y, 3 + seed % 2, 'grass', seed % 97, 4, 1)
    return True


def _heave(c, J, seed):
    """들뜬 판 끝: 가로로 누운 줄눈 토막 5~8화소에서 아래 판 윗끝이 들렸다 — 틈은 가장 짙고 들린 끝 두 줄이 밝다."""
    runs = [p for p in J if (p[0] + 1, p[1]) in J and (p[0] - 1, p[1]) in J and _inside(p[0], p[1], 2)]
    if not runs: return False
    x0, y0 = sorted(runs, key=lambda p: h2(p[0], p[1], seed + 4))[0]
    for x in range(x0 - 3, x0 + 4):
        if (x, y0) in J and _inside(x, y0 + 2, 1):
            c.P(x, y0, K('conc', 0)); c.P(x, y0 + 1, K('conc', 7)); c.P(x, y0 + 2, K('conc', 6))
    return True


def _spall(c, seed):
    """얕게 벗겨진 자리: 한 단 밝은 속 + 윗 가장자리만 끊긴 짙은 선."""
    cx, cy = 5 + h2(seed, 1, 13) % 6, 5 + h2(seed, 2, 13) % 6
    A = {(x, y) for y in range(cy - 2, cy + 3) for x in range(cx - 4, cx + 4)
         if ((x - cx) / 3.6) ** 2 + ((y - cy) / 2.0) ** 2 + (h2(x, y, seed) % 3) * 0.12 < 1}
    for (x, y) in A:
        if (x, y - 1) not in A: c.P(x, y, SHADE if h2(x, y, seed + 1) % 4 else None)
        elif h2(x // 2, y, seed + 2) % 4: c.P(x, y, LIT)


_RIM_SIDES = ((1, 'n'), (2, 'e'), (4, 's'), (8, 'w'))


def _rim_depth(side, t, seed):
    """변 side 의 t(0..15) 자리 흙 깊이(0~4). 칸 끝(t = 0·15)은 늘 1 — 이웃 둘레 칸과 이어진다."""
    if t in (0, 15): return 1
    k = h2(t // 3, {'n': 1, 'e': 2, 's': 3, 'w': 4}[side], seed + 51)
    base = 1 + k % 3
    if t in (1, 14): base = min(base, 2)
    return base + (1 if h2(t, 7, seed + 53) % 5 == 0 and 2 < t < 13 else 0)


def rim_mask_pixels(m, seed):
    """흙 쪽 마스크 m 의 흙 화소 집합(칸 좌표)."""
    out = set()
    for bit, side in _RIM_SIDES:
        if not m & bit: continue
        for t in range(16):
            d = _rim_depth(side, t, seed)
            for k in range(d):
                out.add({'n': (t, k), 's': (t, 15 - k), 'w': (k, t), 'e': (15 - k, t)}[side])
    return out


def _draw_rim(c, m, seed):
    """판 끝이 흙으로 부서져 끝난다: 흙 화소 + 깨진 판 끝 한 줄(빛 쪽 위·왼은 밝게, 남쪽은 1화소 앞면 그늘). 3/4: 남쪽 끝은 판 두께가 보인다."""
    D = rim_mask_pixels(m, seed)
    dirt = MAT['dirt']
    for (x, y) in D:
        c.P(x, y, dirt[3] if h2(x, y, seed + 61) % 4 else dirt[5] if h2(x, y, seed + 62) % 2 else dirt[2])
    for y in range(16):
        for x in range(16):
            if (x, y) in D: continue
            if (x, y + 1) in D: c.P(x, y, GR[0]); continue              # 판 남쪽 끝 앞면(두께)
            if (x, y - 1) in D or (x - 1, y) in D or (x + 1, y) in D: c.P(x, y, GR[4] if h2(x, y, seed + 63) % 3 else GR[2])
    for (x, y) in D:
        if y > 0 and (x, y - 1) not in D: c.P(x, y, dirt[1])                  # 판 끝 밑 흙 그늘(판이 위에 있는 흙 화소)


def draw_cell(c, ox, oy, code, v, rim=0, cut=0):
    J, cracks, seed = joint_layout(code, v)
    if cut:
        o = 6 + 3 * (cut - 1) + h2(rim, cut, 71) % 2
        J = {(o, t) for t in range(16)} if rim == 5 else {(t, o) for t in range(16)}
        if cut == 2: cracks = [[(o + 1 + k // 2, 4 + k) for k in range(5)]] if rim == 5 else [[(4 + k, o + 1 + k // 2) for k in range(5)]]
    if rim:
        D = rim_mask_pixels(rim, seed)
        J = {p for p in J if p not in D}
        cracks = [[p for p in pts if p not in D] for pts in cracks]
    k = sum(1 for q in code if q)
    sub = Cv(16, 16)
    _bevel(sub, J)
    for pts in cracks: _draw_crack(sub, pts, seed)
    _draw_joints(sub, J, seed)
    if k == 0 and v == 5: _spall(sub, seed)
    if k == 1 and v == 1: _weed(sub, J, seed)
    if k == 2 and v == 1:
        m = h2(seed, 9, 11) % 3
        ok = (_chip if m == 0 else _weed if m == 1 else _heave)(sub, J, seed)
        if not ok: _chip(sub, J, seed) or _weed(sub, J, seed)
    if rim: _draw_rim(sub, rim, seed)
    c.a[oy:oy + 16, ox:ox + 16] = sub.a


@piece('slab-joints', '깨진 콘크리트 판 줄눈 덧그림 (가장자리 맞춤)', COLS, ROWS, FLAT,
       en='broken old city concrete pavement seen from above: an irregular network of thin dark slab joints and fractures that never repeats, '
          'each joint with a lit edge below and a shaded edge above, joints dying out into fine cracks, a few broken slab corners showing earth, '
          'one heaved slab edge and small weeds in joints, drawn as a transparent decal over plain concrete',
       group='ground', tags=['콘크리트', '줄눈', '덧그림', '보도', '광장'],
       desc='깨진 콘크리트 판의 줄눈 덧그림(위 평면층). 붓으로 찍지 않는다 — 구성기가 칸 네 변의 줄눈 건넘 부호(0~3)로 칸을 고른다: '
            '조합 N*64+E*16+S*4+W 마다 변형 nv(k)개(k = 0 아닌 부호 수, 0→6·1→2·2→2·3·4→1)를 조합 순서로 이어 놓은 순번 i 의 칸이 (i%16, i//16). '
            '맞닿은 칸은 같은 변 부호를 써서 줄눈이 이어진다. 아래층은 slab-ground.',
       sample=lambda f=0: board_sample(SAMPLE_PLAN_B, seed=11))
def _joints(c):
    for i, (code, v) in enumerate(COMBOS):
        draw_cell(c, (i % COLS) * 16, (i // COLS) * 16, code, v)
    for j, (code, m, cut) in enumerate(RIMS):
        i = len(COMBOS) + j
        draw_cell(c, (i % COLS) * 16, (i // COLS) * 16, code, 0, m, cut)


# ------------------------------------------------------------------ 구성기와 같은 규칙의 표본 판
def edge_code(kind, x, y, seed):
    r = h2(x * 2 + (1 if kind == 'h' else 0), y * 2 + (0 if kind == 'h' else 1), seed + 401) % 100
    return 0 if r < 52 else 1 + (r - 52) * 3 // 48


def slab_codes(slab, x, y, seed):
    """칸 (x,y) 의 (N,E,S,W) 부호. 한 칸 폭 띠(위아래가 판이 아닌 칸)는 길이 방향 줄눈을 막는다(가는 조각이 생기지 않게)."""
    H, W = len(slab), len(slab[0])
    on = lambda i, j: 0 <= i < W and 0 <= j < H and slab[j][i]
    hstrip = lambda i, j: on(i, j) and not on(i, j - 1) and not on(i, j + 1)
    vstrip = lambda i, j: on(i, j) and not on(i - 1, j) and not on(i + 1, j)
    def hcode(i, j):                                   # 칸 (i,j-1)·(i,j) 사이 가로 변
        if vstrip(i, j) and vstrip(i, j - 1): return 0
        return edge_code('h', i, j, seed)
    def vcode(i, j):                                   # 칸 (i-1,j)·(i,j) 사이 세로 변
        if hstrip(i, j) and hstrip(i - 1, j): return 0
        return edge_code('v', i, j, seed)
    return hcode(x, y), vcode(x + 1, y), hcode(x, y + 1), vcode(x, y)


INDEX = {}
for _i, (_cd, _v) in enumerate(COMBOS): INDEX.setdefault(_cd, []).append(_i)
RIM_INDEX = {(cd, m, cut): len(COMBOS) + j for j, (cd, m, cut) in enumerate(RIMS)}


def cell_index(slab, x, y, seed):
    H, W = len(slab), len(slab[0])
    on = lambda i, j: 0 <= i < W and 0 <= j < H and slab[j][i]
    m = (0 if on(x, y - 1) else 1) | (0 if on(x + 1, y) else 2) | (0 if on(x, y + 1) else 4) | (0 if on(x - 1, y) else 8)
    cd = list(slab_codes(slab, x, y, seed))
    if m:
        for i, bit in enumerate((1, 2, 4, 8)):
            if m & bit: cd[i] = 0
        cut = 0
        if m in (5, 10) and not any(cd):
            r = h2(x * 5 + 3, y * 7 + 1, seed + 419) % 10
            cut = 1 if r < 2 else 2 if r < 3 else 0
        return RIM_INDEX[(tuple(cd), m, cut)]
    vs = INDEX[tuple(cd)]
    return vs[h2(x * 3 + 1, y * 5 + 2, seed + 409) % len(vs)]


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
    '......................',
    '...#........#.........',
    '...#........#.........',
    '...#........#.........',
]


SAMPLE_PLAN_B = [
    '......................',
    '.###########..........',
    '.###########....###...',
    '.###########....###...',
    '.#########......###...',
    '.#########............',
    '......................',
    '......................',
    '######################',
    '......................',
    '..##############......',
    '..##############......',
    '..##############......',
    '......................',
]


def board_sample(plan=SAMPLE_PLAN, seed=5):
    """흙 위에 광장(가운데 흙 구덩이)·한 칸 보도 띠 둘(가로·세로)을 깐 표본 — 구성기 규칙 그대로."""
    H, W = len(plan), len(plan[0])
    slab = [[ch == '#' for ch in r] for r in plan]
    dirt = tiled(DIRT8_IDS, [''.join('b' if h2(i, j, 6) % 16 < 10 else 'c' if h2(i, j, 6) % 16 < 13 else 'd' for i in range(W)) for j in range(H)])()
    G = render(PIECES['slab-ground']); Jm = render(PIECES['slab-joints'])
    a = dirt.copy()
    for y in range(H):
        for x in range(W):
            if not slab[y][x]: continue
            a[y * 16:(y + 1) * 16, x * 16:(x + 1) * 16] = G[(y % 8) * 16:(y % 8) * 16 + 16, (x % 8) * 16:(x % 8) * 16 + 16]
            i = cell_index(slab, x, y, seed)
            blk = Jm[(i // COLS) * 16:(i // COLS) * 16 + 16, (i % COLS) * 16:(i % COLS) * 16 + 16]
            op = blk[..., 3] == 255
            a[y * 16:(y + 1) * 16, x * 16:(x + 1) * 16][op] = blk[op]
    return a

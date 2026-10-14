"""snow_north 8방 오토타일(canon 47 + 몸통 변형 2 = 49칸) — «둘레보다 낮은 땅» 하나의 문법.

눈 위에서 보면 길·호수·풀밭·진창·얼음 구멍은 모두 둘레 눈보다 낮다(눈이 두껍게 쌓였다). 그래서 칸 안쪽 경계를
변마다 다른 깊이(inset)만큼 안으로 들이고, 경계 바깥 띠에 눈 둑을 그린다:
  - 북쪽 변(바깥이 북): 눈 둑의 앞면(남쪽을 보는 벽)이 보인다 → face 줄 + 맨 위 밝은 테 + 안쪽 땅에 둑 그림자.
  - 남쪽 변: 둑 윗면 끝만 보인다 → 밝은 테 한 줄 + 경계 먹선 대신 한 단 어두운 선.
  - 서쪽 변: 동쪽을 보는 둑 벽 = 그늘(어둡게). 동쪽 변: 서쪽을 보는 둑 벽 = 빛(밝게).
경계 깊이는 변을 따라 흔들리되(바람에 쌓인 눈 둑), 칸 끝(s=0, 15)에서는 늘 기본 깊이라 어떤 이웃과도 이어진다.
볼록 모서리는 둥글게, 오목 모서리(대각만 바깥)는 이웃 칸 띠와 같은 깊이의 네모를 둥글게 깎아 잇는다.

질감 함수는 세계 좌표(16 주기)라 이어 칠해도 이음새가 없다: fn(wx, wy) -> (재질, 단).
"""
import math
from px import C, h32

DIRS = dict(N=1, E=2, S=4, W=8, NE=16, SE=32, SW=64, NW=128)


def canon(m):
    n, e, s, w = m & 1, m & 2, m & 4, m & 8
    out = m & 15
    if n and e: out |= m & 16
    if s and e: out |= m & 32
    if s and w: out |= m & 64
    if n and w: out |= m & 128
    return out


CANON = sorted({canon(m) for m in range(256)})
assert len(CANON) == 47


def bump(s, seed, amp):
    """변을 따라가는 흔들림: s=0..2, 13..15 는 0(칸 끝에서 기본 깊이), 가운데는 seed 에 따라 0..amp 정수."""
    if amp <= 0 or s < 3 or s > 12: return 0
    k = h32(seed, 0, 17) % 4
    shapes = (
        [0, 0, 0, 1, 2, 3, 3, 3, 2, 1, 1, 0, 0, 0, 0, 0],
        [0, 0, 0, 1, 1, 2, 1, 0, 0, 1, 2, 2, 1, 0, 0, 0],
        [0, 0, 1, 2, 3, 3, 2, 1, 0, 0, 0, 1, 1, 0, 0, 0],
        [0, 0, 0, 0, 1, 1, 2, 3, 3, 3, 2, 1, 0, 0, 0, 0],
    )
    v = shapes[k][s]
    return min(amp, v)


class Depression:
    """cfg: inset dict N/E/S/W(기본 깊이), amp(흔들림 최대), face(북쪽 둑 앞면 줄 수), R(볼록 모서리 반지름),
    in_fn/out_fn 질감, style(eff, D, s, x, y, wx, wy) -> (재질, 단) | None(None 이면 기본 규칙)."""

    def __init__(s, gid, in_fn, out_fn, inset=None, amp=1, face=3, R=4, shadow=2, seed=0, out_mat='snow', deco=None):
        s.gid, s.in_fn, s.out_fn = gid, in_fn, out_fn
        s.inset = inset or dict(N=5, E=3, S=2, W=3)
        s.amp, s.face, s.R, s.shadow, s.seed, s.out_mat, s.deco = amp, face, R, shadow, seed, out_mat, deco

    def depth(s, m, x, y, tx=0, ty=0):
        """(D, eff) — D = 경계 안쪽으로 들어간 거리(음수 = 바깥 눈), eff = 가장 가까운 경계 종류(N/E/S/W)."""
        I = s.inset
        out = {n for n in DIRS if not (m & DIRS[n])}
        best = (99.0, None)
        cx, cy = x + 0.5, y + 0.5
        sd = {}
        for side in 'NESW':
            if side not in out: continue
            if side == 'N': sv, along, ax = cy, x, tx
            elif side == 'S': sv, along, ax = 16 - cy, x, tx
            elif side == 'W': sv, along, ax = cx, y, ty
            else: sv, along, ax = 16 - cx, y, ty
            w = I[side] + bump(along, (ax * 31 + (ty if side in 'NS' else tx) * 7 + 'NESW'.index(side) * 1013 + s.seed) & 0xffff, s.amp)
            d = sv - w
            sd[side] = sv - I[side]
            if d < best[0]: best = (d, side)
        R = s.R
        for a, b in (('N', 'W'), ('N', 'E'), ('S', 'W'), ('S', 'E')):
            if a in out and b in out:
                ccx = I['W'] + R if b == 'W' else 16 - I['E'] - R
                ccy = I['N'] + R if a == 'N' else 16 - I['S'] - R
                inx = cx < ccx if b == 'W' else cx > ccx
                iny = cy < ccy if a == 'N' else cy > ccy
                if inx and iny:
                    d = R - math.hypot(cx - ccx, cy - ccy)
                    if d < best[0]:
                        best = (d, a if abs(cy - ccy) >= abs(cx - ccx) else b)
        for diag in ('NE', 'NW', 'SE', 'SW'):
            v, h = diag[0], diag[1]
            if diag not in out or v in out or h in out: continue
            # 오목 모서리: 대각 칸이 이웃 띠 깊이만큼 커진 네모(밖) — 그 네모의 안쪽 꼭짓점을 둥글게.
            qx = 16 - I['E'] if h == 'E' else I['W']
            qy = I['N'] if v == 'N' else 16 - I['S']
            dx = (qx - cx) if h == 'E' else (cx - qx)
            dy = (cy - qy) if v == 'N' else (qy - cy)
            if dx > 0 and dy > 0: d = math.hypot(dx, dy) - 1.2; eff = v if dy < dx else h
            elif dx > 0: d = dx; eff = h
            elif dy > 0: d = dy; eff = v
            else: d = -min(-dx, -dy); eff = v if -dy < -dx else h
            if d < best[0]: best = (d, eff)
        return best

    def cell(s, m, tx=0, ty=0, body=None):
        """canon 마스크 m 의 칸 한 장(C). tx, ty = 이 칸의 세계 칸 좌표(질감 위상)."""
        c = C(16, 16)
        for y in range(16):
            for x in range(16):
                wx, wy = tx * 16 + x, ty * 16 + y
                D, eff = s.depth(m, x, y, tx, ty)
                px_ = s.paint(D, eff, x, y, wx, wy, body)
                c.P(x, y, *px_)
        if s.deco: s.deco(c, m, s, tx, ty)
        return c

    def paint(s, D, eff, x, y, wx, wy, body=None):
        om = s.out_mat
        if eff is None or D >= s.shadow + 0.5:
            return (body or s.in_fn)(wx, wy)
        if D >= 0:     # 안쪽 땅 — 북쪽 둑 그늘
            mat, t = (body or s.in_fn)(wx, wy)
            if eff == 'N': return (mat, max(0, t - (2 if D < 1 else 1)))
            if eff == 'W' and D < 1: return (mat, max(0, t - 1))
            if eff == 'S' and D < 1: return (mat, max(0, t - 1))
            return (mat, t)
        e = -D           # 바깥 눈까지 거리(0 < e)
        if eff == 'N':
            f = s.face
            if e <= f:
                # 둑 앞면: 아래(경계 쪽)가 어둡고 위로 갈수록 밝게, 세로 결 몇 줄
                k = int(e)
                t = 1 + min(3, k)
                if h32(wx, 0, 5) % 5 == 0 and k >= 1: t -= 1
                return (om, t)
            if e <= f + 1: return (om, 6)          # 둑 윗면 앞 모서리(빛)
            return s.out_fn(wx, wy)
        if eff == 'S':
            if e <= 1: return (om, 3)
            if e <= 2: return (om, 6)
            return s.out_fn(wx, wy)
        if eff == 'W':
            if e <= 1: return (om, 2)
            if e <= 2: return (om, 4)
            return s.out_fn(wx, wy)
        # E: 서쪽을 보는 벽 — 빛
        if e <= 1: return (om, 4)
        if e <= 2: return (om, 6)
        return s.out_fn(wx, wy)

    def build(s, body_fns=()):
        """{canon: C} + 몸통 변형들 [C]. 칸 위상은 (0,0) — 질감은 16 주기라 어디 놓아도 같다."""
        cells = {m: s.cell(m) for m in CANON}
        bodies = [s.cell(15 | 16 | 32 | 64 | 128, body=b) for b in body_fns]
        return cells, bodies


def variant_map(local_of):
    return {str(m): local_of(canon(m)) for m in range(256)}


def sample_mask():
    """47 모양이 모두 나오는 손 짠 견본 지도(bool[H][W]) — 관문용 조립 그림과 검수 시트에 쓴다."""
    rows = [
        "..................",
        ".###.#...#..#.....",
        ".#.####.#...#.#.#.",
        "..##.######..###..",
        ".###.####.#.#..##.",
        "..#.#####.#######.",
        ".#####.##########.",
        "..#.###.#.#######.",
        ".#.#####..##.#..#.",
        ".#...##.#########.",
        ".###.####..##.#.#.",
        ".#.###.####.#.##..",
        "..................",
    ]
    return [[ch == '#' for ch in r] for r in rows]


def mask_at(g, x, y):
    H, W = len(g), len(g[0])
    inn = lambda i, j: 0 <= i < W and 0 <= j < H and g[j][i]
    m = 0
    for n, (dx, dy) in dict(N=(0, -1), E=(1, 0), S=(0, 1), W=(-1, 0), NE=(1, -1), SE=(1, 1), SW=(-1, 1), NW=(-1, -1)).items():
        if inn(x + dx, y + dy): m |= DIRS[n]
    return canon(m)


def render_mask(dep, cells, g, out_cell, bodies=()):
    """견본 지도 그리기(칸 그림 그대로 붙인다 — 칸 화소가 조립 그림에 화소 그대로 들어간다)."""
    H, W = len(g), len(g[0])
    c = C(W * 16, H * 16)
    used = set()
    for y in range(H):
        for x in range(W):
            if g[y][x]:
                m = mask_at(g, x, y)
                cc = cells[m]
                if m == 255 and bodies and h32(x, y, 3) % 4 == 0: cc = bodies[h32(x, y, 4) % len(bodies)]
                used.add(m)
            else:
                cc = out_cell
            c.paste(cc, x * 16, y * 16)
    return c, used

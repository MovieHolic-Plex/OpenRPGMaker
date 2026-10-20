"""modern_city 바닥 칸 — 코드 손 도트(16px, 3/4 탑뷰, 빛은 왼쪽 위). 2026-10-20 사용자 승인 시안
(~/claude-viz/modern-tiles-proto/ground/src/draw.py)을 굽기용으로 옮겼다. 생성 이미지 없음.

아스팔트·노면 표시·횡단보도·측구·연석(8방향, SDF)·점자 블록·잔디·잔디 경계석.
보도는 시안이 바둑판(블록마다 톤이 크게 달라 체크무늬)으로 읽혀 다시 그렸다: 8×4 러닝 본드 · 톤 폭을 좁게(반 단계) ·
드물게 닳은 블록 하나. 칸 경계에 걸친 블록은 바탕 톤만 써서 칸 사이에서 블록이 끊기지 않는다.

모든 함수는 결정적이다(같은 인자 → 같은 화소). 반환은 16×16 RGBA PIL 그림.
"""
import math
import random
import zlib

from PIL import Image

T = 16

# ---------------------------------------------------------------- 팔레트(시안 그대로, modern_city 원래 바닥색이 기준 단계)
A3H = (44, 66, 89)
A = [(17, 25, 37), (25, 37, 52), (32, 48, 66), (40, 61, 83), (48, 71, 95), (58, 83, 108), (72, 98, 122)]
A_PATCH = (35, 54, 74)
S = [(37, 46, 51), (52, 64, 70), (66, 80, 86), (81, 98, 104), (93, 112, 118), (108, 127, 132), (126, 145, 149)]
C = [(44, 50, 56), (78, 86, 92), (104, 113, 118), (136, 145, 148), (166, 174, 175), (196, 203, 202), (221, 226, 224)]
G = [(23, 43, 36), (32, 58, 48), (45, 78, 64), (64, 105, 88), (79, 127, 105), (99, 147, 117), (130, 170, 125)]
W = [(236, 240, 236), (205, 213, 211), (158, 168, 170)]
Y = [(236, 194, 102), (210, 165, 76), (160, 120, 54)]
TY = [(120, 92, 30), (178, 140, 48), (214, 176, 70), (240, 210, 112)]
DIRT = [(70, 58, 44), (96, 80, 60), (122, 104, 78)]
CLOVER = (214, 222, 204)

# 보도(다시 그림) — 바탕 S3 둘레 반 단계 톤만. 이음은 S1 과 S2 사이.
SW_BASE = S[3]
SW_TONES = {0: S[3], 1: (85, 103, 109), -1: (77, 93, 99), -2: (71, 86, 92)}   # 바탕 · 반 단계 밝음 · 반 단계 어둠 · 닳은 블록(드묾)
SW_JOINT = (64, 78, 84)
SW_HJOINT = (72, 87, 93)


def lit(c, k):
    """같은 톤 계열 안에서 k 단계 밝게(+) / 어둡게(-). 보도 블록 테두리용(작은 폭)."""
    return tuple(max(0, min(255, int(round(v + k * 6)))) for v in c)


def new(fill=None):
    return [[fill for _ in range(T)] for _ in range(T)]


def to_img(t):
    im = Image.new('RGBA', (T, T), (0, 0, 0, 0))
    px = im.load()
    for y in range(T):
        for x in range(T):
            c = t[y][x]
            if c is not None:
                px[x, y] = c if len(c) == 4 else c + (255,)
    return im


def from_img(im):
    im = im.convert('RGBA'); px = im.load()
    return [[px[x, y] if px[x, y][3] else None for x in range(T)] for y in range(T)]


def put(t, x, y, c, wrap=True):
    if wrap:
        t[y % T][x % T] = c
    elif 0 <= x < T and 0 <= y < T:
        t[y][x] = c


def jitter_points(seed, cell=4, prob=0.7):
    r = random.Random(seed)
    pts = []
    for cy in range(0, T, cell):
        for cx in range(0, T, cell):
            if r.random() < prob:
                pts.append((cx + r.randrange(cell), cy + r.randrange(cell), r.random()))
    return pts


def h01(*a):
    return (zlib.crc32(repr(a).encode()) & 0xffffff) / 0xffffff


# ---------------------------------------------------------------- 아스팔트
ASPHALT_VARIANTS = {0: '바탕', 1: '바퀴 자국 결', 2: '덧씌운 보수 판', 3: '실링한 균열', 4: '기름 얼룩', 5: '바탕(결 배치 2)', 6: '바탕(결 배치 3)', 7: '바탕(결 배치 4)'}


def asphalt(var=0):
    t = new(A[3])
    for x, y, k in jitter_points(150 + var, cell=8, prob=0.9):
        for dx, dy in [(0, 0), (1, 0), (0, 1), (2, 1), (1, 1)][: 3 + int(k * 3)]:
            put(t, x + dx, y + dy, A3H)
    for x, y, k in jitter_points(100 + var, cell=4, prob=0.6):
        if k < 0.55:
            put(t, x, y, A[4]); put(t, x, y + 1, A[2])
        elif k < 0.8:
            put(t, x, y, A[4]); put(t, x + 1, y, A[4]); put(t, x, y + 1, A[2]); put(t, x + 1, y + 1, A[2])
        else:
            put(t, x, y, A[2])
    if var == 1:
        r = random.Random(7)
        for yy in (4, 11):
            for x in range(T):
                if r.random() < 0.55 and t[yy][x] == A[3]:
                    t[yy][x] = A[4] if r.random() < 0.3 else A3H
    if var == 2:
        x0, y0, x1, y1 = 3, 5, 12, 12
        for y in range(y0, y1):
            for x in range(x0, x1):
                c = t[y][x]
                t[y][x] = A_PATCH if c == A[3] else (A[3] if c == A[4] else A[2])
        for x in range(x0, x1):
            t[y0 - 1][x] = A[4] if x % 3 else A[3]; t[y1][x] = A[2]
        for y in range(y0, y1):
            t[y][x0 - 1] = A[4] if y % 3 else A[3]; t[y][x1] = A[2]
    if var == 3:
        path = [(1, 14), (2, 13), (3, 13), (4, 12), (5, 11), (6, 11), (7, 10), (8, 10), (9, 9), (10, 8), (11, 8), (12, 7), (13, 6), (14, 6)]
        for x, y in path:
            t[y][x] = A[1]
            if y - 1 >= 0 and t[y - 1][x] != A[1]:
                t[y - 1][x] = A[2]
        for x, y in [(8, 11), (9, 12), (9, 13)]:
            t[y][x] = A[1]
    if var == 4:
        for y in range(T):
            for x in range(T):
                d = ((x - 8) ** 2) / 20 + ((y - 8) ** 2) / 9
                if d < 0.45:
                    t[y][x] = A[1]
                elif d < 1.0:
                    t[y][x] = A[2] if t[y][x] != A[4] else A[3]
        t[6][6] = A[4]; t[6][7] = A[4]
    return t


# ---------------------------------------------------------------- 노면 표시 다시 칠하기(옛 표시 모양 그대로, 시안 페인트 결)
def classify_marking(rgb):
    """옛 칸 화소 → 'Y'(노랑) / 'W'(흰) / None(아스팔트). 옛 아스팔트는 남색 계열, 표시는 밝고 채도가 다르다."""
    r, g, b = rgb[:3]
    if r > 150 and g > 110 and b < 120 and r - b > 60:
        return 'Y'
    if r > 150 and g > 150 and b > 150:
        return 'W'
    return None


def restyle_markings(old, var=0, seed=0):
    """옛 도로 칸(그림) → 새 아스팔트 + 같은 자리 표시. 표시 면은 밝은 색, 각 세로 줄의 맨 아래 화소는 그늘색,
    알갱이 그늘 위는 한 단계 어둡게, 드물게 닳은 점. 표시 아래 아스팔트 한 줄은 그늘(A2)."""
    t = asphalt(var)
    px = old.convert('RGBA').load()
    m = [[classify_marking(px[x, y]) for x in range(T)] for y in range(T)]
    r = random.Random(1000 + seed)
    for y in range(T):
        for x in range(T):
            k = m[y][x]
            if not k:
                continue
            ramp = Y if k == 'Y' else W
            under = t[y][x]
            bottom = y == T - 1 or m[y + 1][x] != k
            c = ramp[1] if (k == 'Y' and False) else ramp[0]
            if k == 'Y':
                c = Y[1] if (y > 0 and m[y - 1][x] == k) else Y[0]   # 2px 노랑 선은 윗줄 밝게
                if bottom and not (y > 0 and m[y - 1][x] == k):
                    c = Y[1]                                          # 1px 선은 몸색
            elif bottom:
                c = W[1]
            if under == A[2]:
                c = ramp[1] if k == 'W' else Y[2] if c == Y[1] else Y[1]
            if r.random() < 0.035:
                c = ramp[1] if k == 'W' else Y[2]
            t[y][x] = c
    for y in range(T - 1):   # 표시 아래 그늘 한 줄
        for x in range(T):
            if m[y][x] and not m[y + 1][x] and t[y + 1][x] in (A[3], A[4], A3H):
                t[y + 1][x] = A[2]
    return t


# ---------------------------------------------------------------- 측구(연석 앞 차도 칸)
def gutter_overlay(t, side, extent=None):
    """t(차도 칸)에 측구를 칠한다. side: 'N'(위가 남향 연석 앞면) · 'S'(아래가 북향 연석) · 'W'(왼쪽이 동향 연석) · 'E'(오른쪽).
    extent: (a, b) 측구가 깔리는 구간(가로 측구는 x, 세로 측구는 y). None 이면 칸 전체. 끝은 둥글게 줄어든다."""
    a, b = extent or (0, T)
    if side == 'N':
        for x in range(a, b):
            fade = x in (a, b - 1) and extent is not None
            t[0][x] = A[0]
            t[1][x] = C[1]
            t[2][x] = (C[2] if x % 8 else C[1]) if not fade else C[1]
            t[3][x] = (C[2] if x % 8 else C[1]) if not fade else A[1]
            t[4][x] = A[1]
            if t[5][x] in (A[3], A[4], A3H):
                t[5][x] = A[2]
        for x in (3, 4, 11):
            if a <= x < b and x not in (a, b - 1):
                t[2][x] = C[3]
    elif side == 'S':
        for x in range(a, b):
            if t[12][x] in (A[3], A[4], A3H):
                t[12][x] = A[2]
            t[13][x] = C[2] if x % 8 else C[1]
            t[14][x] = C[2] if x % 8 else C[1]
            t[15][x] = C[1]
        for x in (5, 12):
            if a <= x < b:
                t[13][x] = C[3]
    elif side in ('W', 'E'):
        xs = (0, 1, 2) if side == 'W' else (15, 14, 13)
        for y in range(a, b):
            t[y][xs[0]] = C[1] if side == 'W' else C[1]
            t[y][xs[1]] = C[2] if y % 8 else C[1]
            t[y][xs[2]] = A[1] if side == 'W' else C[2] if y % 8 else C[1]
            if side == 'E':
                xx = 12
                if t[y][xx] in (A[3], A[4], A3H):
                    t[y][xx] = A[2]
        for y in (5, 12):
            if a <= y < b:
                t[y][xs[1]] = C[3]
    return t


# ---------------------------------------------------------------- 보도(다시 그림 — 8×4 러닝 본드, 좁은 톤 폭)
def _block_tone(var, row, bx):
    """칸 안 블록(행 row 0..3, 블록 시작 x) 톤. 칸 경계를 넘는 블록(시작 x=12)은 늘 바탕."""
    if bx >= 12 or bx < 0:
        return 0
    h = h01('sw', var, row, bx)
    if var == 0:
        return 0 if h < 0.82 else (1 if h < 0.92 else -1)
    if var in (5, 6):
        return 0 if h < 0.7 else (1 if h < 0.85 else -1)
    if var == 2:   # 닳은 블록 하나(드문 변형)
        return -2 if (row, bx) == (1, 4) else (0 if h < 0.8 else -1)
    return 0 if h < 0.75 else (1 if h < 0.88 else -1)


def sidewalk(var=0):
    """보도 판석 8×4 러닝 본드. 줄(4px)마다 이음이 4px 엇갈린다(짝수 줄 x=0·8, 홀수 줄 x=4·12).
    블록: 위 줄·왼쪽 열 반 단계 밝게, 아래 줄 오른쪽 끝·오른쪽 열 반 단계 어둡게, 이음 1px.
    var 0 바탕 · 1 바탕(톤 배치 2) · 2 닳은 블록 하나 · 3 금 간 블록 · 4 껌 자국 · 5,6 톤 배치만 다름."""
    t = new(SW_BASE)
    for row in range(4):
        y0 = row * 4
        off = 0 if row % 2 == 0 else 4
        for bx in (off - 8, off, off + 8):
            tone = SW_TONES[_block_tone(var, row, bx)]
            for yy in range(4):
                for xx in range(8):
                    x = bx + xx
                    if not 0 <= x < T:
                        continue
                    y = y0 + yy
                    if xx == 7:
                        c = SW_JOINT
                    elif yy == 3:
                        c = SW_HJOINT if xx < 6 else SW_JOINT
                    elif yy == 0 and 1 <= xx < 5:
                        c = lit(tone, 1)
                    elif xx == 0 and yy < 3:
                        c = lit(tone, 1.5)
                    elif xx == 6 and yy > 0:
                        c = lit(tone, -1)
                    else:
                        c = tone
                    t[y][x] = c
    # 면 결: 블록 몇에 밝은 점 + 아래 그늘 한 쌍(작게)
    r = random.Random(300 + var)
    for _ in range(7):
        x, y = 1 + r.randrange(14), 1 + 4 * r.randrange(4)
        if t[y][x] not in (SW_JOINT,) and y + 1 < T and t[y + 1][x] not in (SW_JOINT,):
            t[y][x] = lit(t[y][x], 1); t[y + 1][x] = lit(t[y + 1][x], -1)
    if var == 3:   # 금 간 블록
        for x, y in [(9, 4), (10, 5), (11, 6)]:
            t[y][x] = SW_JOINT
    if var == 4:   # 껌 자국
        for x, y in [(3, 9), (12, 2), (10, 13)]:
            t[y][x] = S[2]
    return t


SIDEWALK_VARIANTS = {0: '바탕', 1: '바탕(톤 배치 2)', 2: '닳은 블록 하나', 3: '금 간 블록', 4: '껌 자국', 5: '바탕(톤 배치 3)', 6: '바탕(톤 배치 4)'}


def tactile():
    """점자 블록(노란 점형) — 횡단보도 앞 보도."""
    t = new(TY[1])
    for y in range(T):
        for x in range(T):
            if x % 8 == 7 or y % 8 == 7:
                t[y][x] = TY[0]
    for by in (0, 8):
        for bx in (0, 8):
            for dy in (1, 4):
                for dx in (1, 4):
                    x, y = bx + dx, by + dy
                    t[y][x] = TY[3]; t[y][x + 1] = TY[2]; t[y + 1][x] = TY[2]; t[y + 1][x + 1] = TY[0]
    return t


# ---------------------------------------------------------------- 연석(8방향): 보도 칸 안에 연석을 그린다. 경계는 SDF.
# 경계 위 바깥 법선(도로 쪽)이 남쪽이면 윗면 2 + 앞면 3 + 밑 윤곽 1 이 보이고(남향 앞면), 북쪽이면 윤곽 + 윗면만, 동서면 윗면 띠만.
SOUTH_BANDS = [C[1], C[2], C[2], C[3], C[5], C[6], SW_JOINT]   # d=0(경계, 도로 쪽) → 안쪽
NORTH_BANDS = [C[0], C[6], C[5], C[3], SW_JOINT]
SIDE_BANDS_E = [C[0], C[3], C[5], C[6], SW_JOINT]               # 동쪽이 도로: 바깥 윤곽 → 윗면
SIDE_BANDS_W = [C[0], C[4], C[6], C[5], SW_JOINT]


def _curb_geom(kind):
    """kind → (sdf(x,y): 보도 안쪽으로 양수인 거리, normal(x,y): 도로 쪽 단위 벡터). 화소 중심 (x+.5, y+.5)."""
    if kind == 'S':
        return (lambda x, y: 16 - (y + .5)), (lambda x, y: (0, 1))
    if kind == 'N':
        return (lambda x, y: (y + .5)), (lambda x, y: (0, -1))
    if kind == 'E':
        return (lambda x, y: 16 - (x + .5)), (lambda x, y: (1, 0))
    if kind == 'W':
        return (lambda x, y: (x + .5)), (lambda x, y: (-1, 0))
    # 볼록 모서리: 보도 = 반지름 16 사분원(중심 = 보도 쪽 칸 꼭짓점)
    cx = 0 if 'E' in kind else 16
    cy = 0 if 'S' in kind else 16

    def sdf(x, y):
        return 16 - math.hypot(x + .5 - cx, y + .5 - cy)

    def nrm(x, y):
        dx, dy = x + .5 - cx, y + .5 - cy
        L = math.hypot(dx, dy) or 1
        return dx / L, dy / L
    return sdf, nrm


def curb(kind, var=0):
    """보도 칸 + 연석. kind: 'S'(남쪽이 도로) 'N' 'E' 'W' 'SE' 'SW' 'NE' 'NW'(볼록 모서리 — 그 두 방향이 도로)."""
    t = sidewalk(var)
    sdf, nrm = _curb_geom(kind)
    for y in range(T):
        for x in range(T):
            d = sdf(x, y)
            if d < 0:
                t[y][x] = None   # 도로 쪽(모서리 칸) — 아래에서 아스팔트로 채운다
                continue
            nx, ny = nrm(x, y)
            bands = SOUTH_BANDS if ny > 0.42 else NORTH_BANDS if ny < -0.42 else (SIDE_BANDS_E if nx > 0 else SIDE_BANDS_W)
            i = int(d)
            if i < len(bands):
                t[y][x] = bands[i]
    if kind == 'S':   # 화강석 알갱이 + 연석 이음
        r = random.Random(40 + var)
        for x in range(T):
            if r.random() < 0.18:
                t[11][x] = C[4]
            if r.random() < 0.12:
                t[13][x] = C[1]
        for y in range(10, 16):
            t[y][0] = C[1] if y < 12 else C[0]
    elif kind == 'N':
        for y in range(0, 4):
            t[y][0] = C[1]
        t[1][0] = C[4]
    elif kind in ('E', 'W'):
        xj = 15 if kind == 'E' else 0
        for x in range(T):
            pass
        for xx in range(4):
            x = 15 - xx if kind == 'E' else xx
            if t[0][x] in (C[3], C[4], C[5], C[6]):
                t[0][x] = C[1]
    if len(kind) == 2:   # 모서리: 바깥(도로)은 아스팔트, 남향 앞면이 끝나는 곳엔 접촉 그늘
        a = asphalt(0)
        for y in range(T):
            for x in range(T):
                if t[y][x] is None:
                    t[y][x] = a[y][x]
        # 남향 앞면 바로 아래(도로 쪽) 한 화소 접촉 그늘
        for y in range(T - 1):
            for x in range(T):
                if sdf(x, y) >= 0 and sdf(x, y + 1) < 0 and nrm(x, y)[1] > 0.42:
                    t[y + 1][x] = A[0]
    return t


# ---------------------------------------------------------------- 잔디
GRASS_VARIANTS = {0: '바탕', 1: '바탕(덩이 배치 2)', 2: '큰 그늘 덩이', 3: '맨땅 조금', 4: '토끼풀 꽃', 5: '볕 든 자리', 6: '볕 든 자리 둘'}


def grass(var=0):
    t = new(G[3])
    blobs = {0: [(4, 11, 2.6)], 1: [(10, 10, 2.4)], 2: [(8, 8, 5.0), (2, 2, 2.0)], 3: [(13, 13, 2.4)], 5: [(2, 6, 2.8)], 6: []}.get(var, [])
    lights = {0: [(10, 12, 3.0)], 1: [(4, 4, 3.4)], 5: [(9, 3, 2.8)], 6: [(6, 10, 3.6), (14, 2, 2.4)], 3: [(3, 3, 2.6)]}.get(var, [])
    for bx, by, rad in lights:
        for y in range(T):
            for x in range(T):
                dx = min(abs(x - bx), T - abs(x - bx)); dy = min(abs(y - by), T - abs(y - by))
                d = (dx * dx + dy * dy) ** 0.5
                if d < rad - 1 or (d < rad + 0.5 and (x + y) % 2 == 0):
                    t[y][x] = G[4]
    for bx, by, rad in blobs:
        for y in range(T):
            for x in range(T):
                dx = min(abs(x - bx), T - abs(x - bx)); dy = min(abs(y - by), T - abs(y - by))
                d = (dx * dx + dy * dy) ** 0.5
                if d < rad * 0.7 or (d < rad and (x + y) % 2 == 1):
                    t[y][x] = G[2]
    for x, y, k in jitter_points(600 + var, cell=4, prob=0.4):
        base = t[y % T][x % T]
        dark = base == G[2]
        lit_ = base == G[4]
        tip = G[3] if dark else (G[5] if lit_ else G[4])
        if k > 0.92:
            tip = G[4] if dark else G[5]
        if k < 0.5:
            put(t, x, y, tip); put(t, x - 1, y + 1, tip); put(t, x + 1, y + 1, tip); put(t, x, y + 1, G[1] if dark else (G[3] if lit_ else G[2]))
        else:
            put(t, x, y, tip); put(t, x, y + 1, G[1] if dark else (G[3] if lit_ else G[2]))
    if var == 4:
        for x, y in [(3, 4), (11, 12), (13, 7)]:
            put(t, x, y, CLOVER); put(t, x, y + 1, G[2])
    if var == 3:
        for x, y in [(6, 9), (7, 9), (8, 9), (5, 10), (6, 10), (7, 10), (8, 10), (9, 10), (6, 11), (7, 11), (8, 11)]:
            t[y][x] = DIRT[1]
        for x, y in [(6, 9), (7, 9), (5, 10)]:
            t[y][x] = DIRT[2]
        for x, y in [(6, 11), (7, 11), (8, 11), (9, 10)]:
            t[y][x] = DIRT[0]
    return t


def grass_edge_south(var=0):
    """잔디 칸, 남쪽이 보도: 경계석(윗면·앞면) + 잎끝이 경계석 위로 넘어온다."""
    t = grass(var)
    for x in range(T):
        t[12][x] = G[2] if t[12][x] in (G[3], G[4], G[5]) else t[12][x]
        t[13][x] = C[5]
        t[14][x] = C[3]
        t[15][x] = C[1]
    for x in (0, 8):
        t[13][x] = C[3]; t[14][x] = C[1]
    for x in (2, 3, 6, 11, 14):
        t[13][x] = G[4]; t[12][x] = G[5]
    t[14][3] = G[2]; t[14][11] = G[2]
    return t


def sidewalk_under_grass(var=0):
    """보도 칸, 북쪽이 잔디: 경계석 앞면이 드리운 그늘 두 줄(끝이 들쭉날쭉)."""
    t = sidewalk(var)
    r = random.Random(70 + var)
    for x in range(T):
        t[0][x] = S[1]
        if t[1][x] != SW_JOINT:
            t[1][x] = lit(t[1][x], -2) if r.random() < 0.8 else S[2]
        if r.random() < 0.35 and t[2][x] != SW_JOINT:
            t[2][x] = lit(t[2][x], -1)
    return t


def grass_edge_north(var=0):
    """잔디 칸, 북쪽이 보도: 경계석 윗면 + 경계석이 남쪽 잔디에 드리운 그늘."""
    t = grass(var)
    for x in range(T):
        t[0][x] = C[1]
        t[1][x] = C[5]
        t[2][x] = G[1]
        t[3][x] = G[2] if x % 3 else G[1]
    return t

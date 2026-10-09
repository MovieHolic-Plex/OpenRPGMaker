# 광산 갱도 (mine-tunnels) 공용 재료: 팔레트(버들항 돌·나무 램프 + 따뜻한 갱도 바위), 이음새 없는 바닥, 벽 앞면, 천장, 오토타일.
import os, sys, math
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', '_lib3'))
sys.path.insert(0, HERE)
from dlib import *
import dlib
import px2
from px2 import PAL, GRAIN, _hash, vnoise
import numpy as np
from wavekit import *

# ---- 램프 (0=윤곽 .. 6=밝음)
WARM = (112, 88, 80)
RK = [mix(c, WARM, .40) for c in ST]                           # 갱도 바위: 돌 램프를 따뜻한 갈색 쪽으로
IRON = [(14, 16, 24), (32, 36, 48), (58, 64, 80), (94, 102, 120), (140, 148, 166), (190, 198, 212)]
IR7 = [IRON[0]] + IRON
CRY_B = [(8, 40, 56), (14, 82, 104), (24, 132, 152), (60, 188, 196), (130, 232, 226), (206, 252, 244), (250, 255, 252)]      # 청록 결정
CRY_V = [(30, 16, 56), (64, 36, 110), (104, 62, 160), (150, 100, 206), (194, 150, 238), (228, 200, 252), (250, 240, 255)]    # 보라 결정
CRY_A = [(60, 24, 6), (122, 58, 12), (190, 104, 20), (236, 158, 34), (252, 206, 84), (255, 238, 170), (255, 252, 226)]      # 호박 결정
GOLD = [(46, 26, 8), (94, 56, 12), (148, 98, 22), (200, 148, 40), (236, 190, 70), (252, 226, 130), (255, 248, 200)]
ORE = [(18, 20, 28), (34, 40, 54), (56, 66, 84), (84, 98, 120), (120, 136, 160), (164, 180, 200), (208, 222, 236)]       # 철광석 (푸른 회색)
COPR = [(36, 18, 12), (84, 44, 28), (132, 70, 38), (170, 96, 52), (204, 124, 66), (232, 158, 96), (250, 204, 150)]       # 구리+청록 녹
DIRT = [mix((44, 34, 32), (138, 108, 80), t / 6.) for t in range(7)]
WOODX = list(WD) if len(WD) == 7 else [WD[0]] + list(WD)

def cl(v, lo=0, hi=6): return max(lo, min(hi, v))
def px(cv, x, y, c): cv.px(x, y, c)

# ------------------------------------------------------------------ 이음새 없는 바닥 (주기 48px)
PER = 48
def pn(X, Y, sc, seed): return vnoise(X, Y, sc, seed, per=PER // sc)
def _floor(fn, seed):
    im = new(PER, PER); p = im.load()
    for y in range(PER):
        for x in range(PER): p[x, y] = tuple(fn(x, y)) + (255,)
    return im

def floor_rock(seed=11):
    """갱도 바위 바닥: 어두운 따뜻한 회갈색, 작은 균열·자갈."""
    def f(X, Y):
        n = pn(X, Y, 8, seed) * .6 + pn(X, Y, 4, seed + 1) * .4
        c = RK[2] if n < .36 else (RK[3] if n < .70 else RK[4])
        r = _hash(X, Y, seed + 2)
        if r < .06: c = RK[1]
        elif r > .955: c = RK[5]
        # 균열: 두 주기 잡음의 능선
        k = abs(pn(X, Y, 12, seed + 5) - .5)
        if k < .018: c = RK[1]
        k2 = abs(pn(X + 5, Y + 9, 6, seed + 6) - .5)
        if k2 < .016 and pn(X, Y, 4, seed + 7) > .45: c = RK[1]
        # 자갈 점 (밝은 조각 + 아래 그림자)
        g = _hash(X // 2, Y // 2, seed + 8)
        if g > .975: c = RK[5]
        return c
    return _floor(f, seed)

def floor_gravel(seed=21):
    """굵은 자갈 바닥: 둥근 돌멩이가 빽빽."""
    pts = []
    import random
    rr = random.Random(seed)
    for i in range(70): pts.append((rr.randrange(PER), rr.randrange(PER), rr.uniform(2.0, 3.6), rr.choice((3, 4, 4, 5))))
    def f(X, Y):
        base = RK[2] if pn(X, Y, 6, seed) < .5 else RK[3]
        c = base
        best = None
        for (cx, cy, R, t) in pts:
            for ox in (-PER, 0, PER):
                for oy in (-PER, 0, PER):
                    dx = X - (cx + ox); dy = Y - (cy + oy)
                    if abs(dx) > R + 1 or abs(dy) > R + 1: continue
                    d = (dx / R) ** 2 + (dy / (R * .8)) ** 2
                    if d <= 1:
                        sh = t + (1 if (dx + dy) < -R * .5 else 0) - (1 if (dx + dy) > R * .6 else 0) - (1 if d > .72 else 0)
                        if best is None or cy + oy > best[0]: best = (cy + oy, RK[cl(sh, 1, 6)])
        if best: c = best[1]
        elif _hash(X, Y, seed + 3) < .08: c = RK[1]
        return c
    return _floor(f, seed)

def floor_packed(seed=31):
    """다져진 운반로: 따뜻한 흙, 바퀴 자국 느낌의 가로 결, 잔 자갈."""
    def f(X, Y):
        n = pn(X, Y, 8, seed) * .55 + pn(X, Y * 1, 3, seed + 1) * .45
        c = DIRT[2] if n < .38 else (DIRT[3] if n < .68 else DIRT[4])
        # 가로 바퀴 결
        if (Y % 12 in (3,)) and pn(X, Y, 6, seed + 3) > .55: c = DIRT[2]
        r = _hash(X, Y, seed + 4)
        if r < .05: c = DIRT[1]
        elif r > .96: c = RK[5]
        elif r > .93: c = DIRT[5]
        return c
    return _floor(f, seed)

def floor_wet(seed=41):
    """젖은 바위 바닥: 어둡고 푸른 기, 물빛 반짝."""
    def f(X, Y):
        n = pn(X, Y, 8, seed) * .6 + pn(X, Y, 4, seed + 1) * .4
        base = mix(RK[1], (30, 56, 70), .55); mid = mix(RK[2], (40, 78, 92), .5); hi = mix(RK[3], (60, 110, 120), .5)
        c = base if n < .34 else (mid if n < .72 else hi)
        r = _hash(X, Y, seed + 2)
        if r > .975: c = (130, 200, 206)
        elif r > .95: c = hi
        elif r < .05: c = mix(RK[0], (20, 40, 50), .5)
        # 물 줄무늬
        if pn(X, Y * 3, 6, seed + 9) > .72 and _hash(X // 3, Y, seed + 10) > .4: c = mix(c, (96, 164, 176), .35)
        return c
    return _floor(f, seed)

FLOOR_FN = {'rock': floor_rock, 'gravel': floor_gravel, 'packed': floor_packed, 'wet': floor_wet}
_FT = {}
def floor_sample(kind):
    if kind not in _FT: _FT[kind] = FLOOR_FN[kind]()
    return _FT[kind]
def _floor_cell(kind):
    def f(cx, cy):
        key = (kind, cx % 3, cy % 3)
        if key not in _FT: _FT[key] = floor_sample(kind).crop(((cx % 3) * T, (cy % 3) * T, (cx % 3) * T + T, (cy % 3) * T + T))
        return _FT[key]
    return f
for _k in FLOOR_FN: dlib.FLOORS['m' + _k] = _floor_cell(_k)

# ------------------------------------------------------------------ 벽 앞면 (갱도: 거친 바위 / 갱목 널 덧댐)
def _top_bottom(c, Y, H, capL, capR, X, rock=True):
    if Y == 0: c = RK[5]
    elif Y == 1: c = mix(c, RK[5], .35)
    elif Y == 2: c = mul(c, .72)
    elif Y == 3: c = mul(c, .84)
    if Y == H - 1: c = (24, 18, 22)
    elif Y == H - 2: c = mul(c, .5)
    elif Y == H - 3: c = mul(c, .78)
    if capL and X % 16 == 0: c = mix(c, RK[5], .3)
    if capR and X % 16 == 15: c = mul(c, .55)
    return c

def face_rock_px(X, Y, H, seed, capL, capR):
    base = mix(RK[1], RK[2], .62)
    n = vnoise(X * 1.0, Y * .45, 4.5, seed + 50); m = vnoise(X * .5, Y * 1.4, 3.2, seed + 51)
    v = n * .62 + m * .38
    if v < .30: c = mix(base, RK[0], .5)
    elif v < .48: c = mix(base, RK[1], .3)
    elif v < .68: c = base
    elif v < .82: c = mix(base, RK[3], .4)
    else: c = mix(base, RK[4], .5)
    lay = (Y + int(vnoise(X, 0, 6, seed + 52) * 5)) % 7
    if lay == 0: c = mix(c, RK[1], .45)
    if _hash(X, Y, seed + 53) < .04: c = mix(c, RK[4], .3)
    if _hash(X, Y, seed + 54) > .975: c = mix(c, RK[0], .5)
    # 가끔 광맥 점 (청록/구리 빛)
    if vnoise(X * 1.3, Y, 7, seed + 60) > .86 and _hash(X, Y, seed + 61) < .5: c = mix(c, CRY_B[4], .55)
    return _top_bottom(c, Y, H, capL, capR, X)

def face_timber_px(X, Y, H, seed, capL, capR):
    """갱목 널을 덧댄 앞면: 세로 널(폭 4), 16칸마다 굵은 기둥, 가로 보 하나, 못."""
    col = X // 4; lx = X % 4
    w = WOODX
    base = mix(w[2], w[3], .4)
    h = _hash(col, 0, seed + 3)
    c = w[1] if h < .35 else (w[2] if h < .75 else w[3])
    if lx == 0: c = w[1]
    elif lx == 1: c = mix(c, w[5], .22)
    # 널의 결 (세로 줄무늬 잡음)
    if _hash(X, Y // 3, seed + 5) < .12: c = mix(c, w[1], .4)
    if _hash(X, Y, seed + 6) > .975: c = mix(c, w[5], .4)
    # 굵은 기둥 (16px 마다)
    px16 = X % 16
    if px16 in (0, 1, 2, 3, 4, 5) and (X // 16) % 3 == 1 + (seed % 2):
        c = w[3] if px16 < 3 else w[2]
        if px16 == 0: c = w[1]
        if px16 == 1: c = w[4]
    # 가로 보 (앞면 한가운데 근처, 높이 3)
    by = (H // 2) - 2
    if by <= Y < by + 3:
        c = w[4] if Y == by else (w[3] if Y == by + 1 else w[1])
        if _hash(X // 6, 0, seed + 8) > .5 and X % 6 == 3 and Y == by + 1: c = IRON[3]      # 못
    # 기둥·보 위에 위쪽 어둠, 흙 틈
    if _hash(X, Y, seed + 12) > .992: c = RK[3]
    return _top_bottom(c, Y, H, capL, capR, X)

_orig_face_px = dlib.face_px
def _face_px(style, X, Y, H, seed, capL, capR):
    if style == 'mine': return face_rock_px(X, Y, H, seed, capL, capR)
    if style == 'minet': return face_timber_px(X, Y, H, seed, capL, capR)
    return _orig_face_px(style, X, Y, H, seed, capL, capR)
dlib.face_px = _face_px
for _s in ('mine', 'minet'): dlib.FACE_BASE[_s] = RK[3]

# ------------------------------------------------------------------ 천장 (속은 어두운 보랏빛 흙, 열린 쪽 가장자리 BAND px 는 윗면)
VOIDM = [(16, 12, 20), (22, 17, 26), (30, 24, 34)]
BANDM = 8
_cm = {}
def ceiling_mine(open8, seed=0, cave=True, pal=None):
    key = (open8, seed % 4)
    if key in _cm: return _cm[key]
    N, E, S, W, NE, SE, SW, NW = open8
    t = BANDM
    def depth(x, y):
        best = None
        def up(d, side):
            nonlocal best
            if best is None or d < best[0]: best = (d, side)
        if N and y < t: up(y, 'N')
        if S and y >= 16 - t: up(15 - y, 'S')
        if W and x < t: up(x, 'W')
        if E and x >= 16 - t: up(15 - x, 'E')
        if not N and not W and NW and x < t and y < t: up(max(x, y), 'N')
        if not N and not E and NE and x >= 16 - t and y < t: up(max(15 - x, y), 'N')
        if not S and not W and SW and x < t and y >= 16 - t: up(max(x, 15 - y), 'S')
        if not S and not E and SE and x >= 16 - t and y >= 16 - t: up(max(15 - x, 15 - y), 'S')
        return best
    def f(x, y):
        X = x + (seed % 4) * 16; Y = y + (seed % 4) * 8
        b = depth(x, y)
        if b is None:
            n = vnoise(X, Y, 5, 142); r = _hash(X, Y, 141)
            c = VOIDM[0] if n < .5 else VOIDM[1]
            if r > .96: c = VOIDM[2]
            return c
        d, side = b
        n = vnoise(X, Y, 3.0, 131)
        c = mix(RK[3], RK[4], n)
        if _hash(X, Y, 133) < .07: c = RK[2]
        elif _hash(X, Y, 132) > .93: c = RK[5]
        if d == 0: c = RK[6] if side in ('N', 'W') else mix(c, RK[5], .45)
        elif d == 1: c = mix(c, RK[5], .18)
        inner = t - 1
        if d == inner: c = (36, 28, 36)
        elif d == inner - 1: c = mix(c, (36, 28, 36), .3)
        return c
    im = mk(f); _cm[key] = im; return im
dlib.ceiling = ceiling_mine

# ------------------------------------------------------------------ 물 (갱도 물웅덩이: 푸른 어두운 물)
WMINE = [(8, 22, 30), (14, 40, 52), (22, 62, 74), (34, 94, 106), (70, 140, 148), (150, 206, 208)]
dlib.WPAL['mine'] = WMINE

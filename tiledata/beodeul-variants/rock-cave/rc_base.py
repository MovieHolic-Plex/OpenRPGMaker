# 일반 암석 동굴(rock-cave) 공용 재료.
# 버들항 파이프라인을 그대로 쓴다: px2.C 볼륨 페인터(grain + 6단 양자화 + 윤곽), pz.fin 색 윤곽, 버들항 돌·잎·나무·물 램프,
# terrain.render 절벽의 「세로 갈비(rib) + 갈라진 틈」 결, dlib/gc 던전 지도(벽 앞면·천장 띠).
# 새 재료는 동굴 바위(회갈색) 7단 램프 하나뿐이고 버들항 돌 램프(ST)를 따뜻한 회갈 쪽으로 옮겨 만든다.
# 바닥은 넓은 얼룩 없이 「한 주조 + 점·잔돌·실금」 손 도트 결(버들항 자갈길·흙길과 같은 밀도)로 찍는다.
import os, sys, math
HERE = os.path.dirname(os.path.abspath(__file__))
VAR = os.path.abspath(os.path.join(HERE, '..'))
sys.path.insert(0, os.path.join(VAR, 'graveyard-crypt'))
sys.path.insert(0, os.path.join(VAR, '_lib3'))
from gc_kit import *                      # noqa  T, ST, LF, WD, GD, PL, DK, Cv, Mk, vol, new, mk, mix, mul, pad16, fin, Kit, autotile_sheet …
from gc_kit import _hash, _pn1
import gc_ext
from gc_ext import mk_floor, SAMPLES, autotile_mask, atile_img
import gc_map
from gc_map import KMap, foot
import dlib
import px2
from px2 import PAL, GRAIN, vnoise
import numpy as np

# ------------------------------------------------------------------ 램프 (0 = 윤곽 … 6 = 밝음)
# 버들항 돌 램프(ST: 푸른 회색)를 회갈색으로 옮긴다: 그림자는 보랏빛, 밝은 쪽은 노란빛(버들항 색상 이동 규칙).
_WARM = [(40, 30, 34), (62, 50, 54), (88, 76, 74), (114, 100, 92), (142, 128, 112), (172, 158, 138), (204, 192, 170)]
RK = [mix(ST[i], _WARM[i], .72) for i in range(7)]
RK[0] = (30, 24, 30)
WET = [mix(RK[i], (40, 70, 78), .38) for i in range(7)]               # 물가 젖은 바위
WT = [(10, 22, 30), (16, 38, 50), (24, 58, 70), (36, 86, 96), (70, 130, 136), (140, 190, 190), (210, 236, 232)]   # 동굴 물 (버들항 물 램프를 어둡게)
MOSSR = [(18, 30, 22), (30, 50, 32), (46, 72, 42), (66, 96, 52), (92, 122, 64), (124, 150, 82)]   # 차분한 이끼(버들항 잎 램프를 회색 쪽으로)
DIRT = [mix(hx(c), RK[i], .42) for i, c in enumerate(PAL['dirt'])]       # 버들항 흙 램프를 동굴 바위 쪽으로 (입구 흙)
BONE = [hx(c) for c in PAL['bone']]
WOOD7 = [hx(c) for c in PAL['wood']]
IRON7 = [hx(c) for c in PAL['iron']]
GOLD7 = [hx(c) for c in PAL['gold']]
FIRE7 = [hx(c) for c in PAL['fire']]
LEAF7 = [hx(c) for c in PAL['leaf']]
def _hexs(r): return ['#%02x%02x%02x' % tuple(c) for c in r]
PAL['crock'] = _hexs(RK); GRAIN['crock'] = (0.20, 1.6)               # px2.C 볼륨 페인터용 동굴 바위 재료
PAL['cwet'] = _hexs(WET); GRAIN['cwet'] = (0.10, 2.0)
PAL['cmoss'] = _hexs([MOSSR[0]] + MOSSR); GRAIN['cmoss'] = (0.22, 1.5)
px2.PAL.update(PAL)

def ck(k): return RK[max(0, min(6, int(k)))]

# ------------------------------------------------------------------ 바닥 (48x48 주기, 3x3 칸으로 이어 붙여도 이음새 없음)
# 같은 그리기 함수를 두 주기로 쓴다: 조각 표본은 주기 48(3x3 칸 이음새 없음), 지도는 주기 768(지도 전체가 한 장 — 무늬 반복 없음).
class Peb:
    """주기 P 안에 흩은 잔돌. 8px 칸 버킷으로 찾는다."""
    def __init__(s, seed, n48, rmin, rmax, P):
        import random
        rr = random.Random(seed * 1000 + P); s.P = P; s.b = {}
        n = int(n48 * (P / 48.0) ** 2)
        for _ in range(n):
            p = (rr.uniform(0, P), rr.uniform(0, P), rr.uniform(rmin, rmax), rr.uniform(.75, 1.0), rr.random())
            for bx in range(int((p[0] - 5) // 8), int((p[0] + 5) // 8) + 1):
                for by in range(int((p[1] - 5) // 8), int((p[1] + 5) // 8) + 1):
                    s.b.setdefault((bx % (P // 8), by % (P // 8)), []).append(p)
    def at(s, X, Y):
        """3/4 잔돌 한 화소의 단(1..6) 또는 그림자(-2). 위·왼쪽이 밝은 윗면, 아래 1/3 은 어두운 앞면, 테두리는 윤곽."""
        P = s.P; best = None
        for (cx, cy, r, sq, v) in s.b.get(((X // 8) % (P // 8), (Y // 8) % (P // 8)), ()):
            for ox in (-P, 0, P):
                dx = X + .5 - (cx + ox)
                if abs(dx) > r + 2: continue
                for oy in (-P, 0, P):
                    dy = Y + .5 - (cy + oy); ry = r * sq * .8
                    if abs(dy) > ry + 2: continue
                    d = (dx / r) ** 2 + (dy / ry) ** 2
                    if d <= 1:
                        lit = (dx + dy * 1.2) < -r * .3
                        if dy > ry * .3: t = 2
                        elif lit: t = 5 if v > .35 else 4
                        else: t = 4 if v > .5 else 3
                        if d > .62: t = (t - 1) if (dy < 0 and dx < r * .4) else 1
                        if best is None or best[0] == -99 or cy + oy > best[0]: best = (cy + oy, t)
                    elif d <= 1.9 and dy > ry * .2 and dx > -r * .5:
                        if best is None: best = (-99, -2)
        return best

def floor_rock_fn(seed=11, pal=None, wet=False, P=48):
    pal = pal or RK
    peb = Peb(seed, 18, 1.4, 2.8, P)
    q = lambda X, Y, sc, sd: pn(X, Y, sc, sd, P)
    def f(X, Y):
        k = 3.0 if wet else 3.7
        k += (q(X, Y, 16, seed) - .5) * .5                                   # 아주 약한 큰 결(넓은 얼룩 금지)
        k += (q(X, Y, 3, seed + 1) - .5) * .7
        r = _hash(X, Y, seed + 2)
        if r < .07: k -= 1
        elif r > .955: k += 1
        if _hash(X // 2, Y, seed + 3) > .985: k += 1.4                        # 반짝 결정 점
        # 실금: 주기 잡음 능선. 어두운 줄 + 아래쪽 한 화소 밝음 (짧게 끊긴다)
        if q(X, Y, 6, seed + 6) > .5:
            c1 = abs(q(X, Y, 12, seed + 5) - .5); c2 = abs(q(X, Y - 1, 12, seed + 5) - .5)
            if c1 < .014: k = 1.8
            elif c2 < .014: k += .9
        b = peb.at(X, Y)
        if b:
            t = b[1]
            k = (k - 1.2) if t == -2 else min(6, t + 1)
        kk = int(round(k))
        if wet:
            if _hash(X, Y, seed + 9) > .975: return WT[5]
            if q(X, Y * 3, 8, seed + 10) > .74 and _hash(X // 3, Y, seed + 11) > .4: kk += 1
        return pal[max(1, min(6, kk))]
    return f

def floor_gravel_fn(seed=21, P=48):
    peb = Peb(seed, 64, 1.6, 3.4, P)
    def f(X, Y):
        k = 2.6 + (pn(X, Y, 8, seed, P) - .5) * .8
        r = _hash(X, Y, seed + 2)
        if r < .1: k -= 1
        elif r > .95: k += 1
        b = peb.at(X, Y)
        if b:
            t = b[1]
            k = 1.6 if t == -2 else min(6, t + 1)
        return RK[max(1, min(6, int(round(k))))]
    return f

FLOOR_MAKERS = {'rc_rock': lambda P: floor_rock_fn(11, P=P), 'rc_rock2': lambda P: floor_rock_fn(17, P=P),
                'rc_wet': lambda P: floor_rock_fn(41, WET, wet=True, P=P), 'rc_gravel': lambda P: floor_gravel_fn(21, P=P)}
for _k, _f in FLOOR_MAKERS.items(): mk_floor(_k, _f(48))

# ------------------------------------------------------------------ 벽 앞면 (버들항 절벽: 세로 갈비 + 틈, 결은 동굴 바위)
FACE = 'rcave'
def rock_face_px(X, Y, H, seed, capL, capR):
    xx = X + int(3 * vnoise(0, Y * .08, 9, 78)); rw = 7
    rib = int(xx / rw + _hash(xx // rw, 0, 3) * .6); u = (xx % rw) / rw
    k = 1.9 + (.5 - u) * 1.7 + (_hash(rib, Y // 9, 4) - .5) * .9
    k += (vnoise(X, Y * .5, 3.0, seed + 51) - .5) * 1.0
    if u > .86: k = 1.0                                                         # 갈비 사이 틈
    lay = (Y + int(vnoise(X, 0, 6, seed + 52) * 6)) % 11                       # 층리 가로 금 (끊김)
    if lay == 0 and _hash(X // 4, Y // 11, seed + 53) > .3: k -= 1.2
    elif lay == 1 and _hash(X // 4, Y // 11, seed + 53) > .3: k += .6
    r = _hash(X, Y, seed + 54)
    if r < .05: k += 1
    elif r > .965: k -= 1
    k += .5 * (Y / max(1, H))                                                  # 아래로 갈수록 반사광으로 조금 밝다
    c = RK[max(1, min(4, int(round(k))))]
    # 차분한 이끼: 갈비 밝은 쪽, 아래 1/3 에 드문드문
    mo = vnoise(X * 1.2, Y * 1.6, 3.0, seed + 60)
    if Y > H * .55 and u < .5 and mo > .74 - .12 * (Y / H) and _hash(X, Y, seed + 61) < .8:
        c = MOSSR[2] if mo < .8 else MOSSR[3]
    # 물 스민 줄 (세로 젖은 띠)
    if _hash(X // 2, 0, seed + 62) < .06 and Y > 3 and _hash(X // 2, Y, seed + 63) < .6: c = mul(c, .78)
    # 천장 띠 밑 그림자 / 바닥 접지
    if Y == 0: c = RK[1]
    elif Y < 3: c = mul(c, .62)
    elif Y < 5: c = mul(c, .82)
    if Y == H - 1: c = RK[0]
    elif Y == H - 2: c = mul(c, .55)
    elif Y == H - 3: c = mul(c, .78)
    if capL and X % 16 < 2: c = mix(c, RK[4], .35 if X % 16 == 0 else .15)
    if capR and X % 16 > 13: c = mul(c, .5 if X % 16 == 15 else .72)
    return c

dlib.FACE_BASE[FACE] = RK[2]
_prev_face = dlib.face_px
def _face_px(style, X, Y, H, seed, capL, capR):
    if style == FACE: return rock_face_px(X, Y, H, seed, capL, capR)
    return _prev_face(style, X, Y, H, seed, capL, capR)
dlib.face_px = _face_px

# ------------------------------------------------------------------ 천장 (솟은 바위 덩어리: 열린 쪽 가장자리 BAND px 는 바위 윗면, 속은 어둠)
BAND = 8
VOIDC = [(20, 15, 20), (26, 20, 26), (34, 27, 33)]
_cc = {}
def ceil_rc(open8, seed=0):
    key = (open8, seed % 4)
    if key in _cc: return _cc[key]
    N, E, S, W, NE, SE, SW, NW = open8
    t = BAND
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
            c = VOIDC[0] if n < .55 else VOIDC[1]
            if r > .97: c = VOIDC[2]
            return c
        d, side = b
        # 바위 윗면: 버들항 잔돌 결 (주조 4 + 점)
        k = 4 + (vnoise(X, Y, 3.0, 131) - .5) * 1.2
        r = _hash(X, Y, 133)
        if r < .09: k -= 1
        elif r > .93: k += 1
        if _hash(X // 2, Y // 2, 134) > .9 and _hash(X, Y, 135) < .5: k -= 1      # 잔 구멍
        if d == 0: k = 6 if side in ('N', 'W') else 5
        elif d == 1: k += .5
        if d == t - 1: return RK[0]
        if d == t - 2: k -= 1.5
        return RK[max(1, min(6, int(round(k))))]
    im = mk(f); _cc[key] = im; return im

# ------------------------------------------------------------------ 오토타일 3종
def _rag(i, seed, amp=2.0, base=0): return base + int(round(amp * _pn1(i, seed)))

def pebble(cv, x, y, w, h, ramp=None, seed=0):
    """작은 3/4 돌멩이 (w x h, 그림자 한 줄 포함 h+1): 윗면 밝음(왼쪽 위 가장 밝다), 아래 줄 앞면, 오른쪽 어두움, 아래 그림자."""
    R = ramp or RK
    for yy in range(h):
        for xx in range(w):
            if (xx in (0, w - 1)) and (yy in (0, h - 1)) and w > 2 and h > 2: continue     # 모서리 깎기
            if yy == h - 1: k = 2
            elif yy == 0: k = 6 if xx <= w // 3 else 5
            else: k = 4 if xx < w - 1 else 3
            if xx == w - 1 and yy > 0: k -= 1
            if _hash(x + xx, y + yy, seed) < .12: k -= 1
            cv.px(x + xx, y + yy, R[max(1, min(6, k))])
    for xx in range(1, w + 1): cv.px(x + xx, y + h, R[1]) if cv.p[min(cv.w - 1, x + xx), min(cv.h - 1, y + h)][3] == 0 else None

def crack_cell(m, N, E, S, W):
    """균열 자갈밭(바닥 위 투명 덧그림, 걷기): 무너져 내린 잔돌과 굵은 자갈이 깔리고 짧은 금이 간 바닥.
    이웃이 있는 쪽은 자갈이 가장자리까지 이어지고, 없는 쪽은 들쭉날쭉 성글어지며 끝난다."""
    cv = Cv(16, 16)
    def dep(x, y):
        d = 99
        if not W: d = min(d, x - _rag(y, 7, 2.5, 1))
        if not E: d = min(d, 15 - x - _rag(y, 8, 2.5, 1))
        if not N: d = min(d, y - _rag(x, 9, 2.5, 1))
        if not S: d = min(d, 15 - y - _rag(x, 10, 2.5, 1))
        return d
    # 짧은 금 조각 (칸 안에서 끝난다 — 칸마다 반복돼도 격자선이 안 생기게 위치·방향을 바꾼다)
    for (x0, y0, dx, dy, ln) in ((3, 4, 1, 1, 5), (10, 10, 1, -1, 4)):
        for i in range(ln):
            x = x0 + dx * i + (1 if i == 2 else 0); y = y0 + dy * i // 1
            if dep(x, y) >= 2:
                cv.px(x, y, RK[1]); cv.px(x, y + 1, RK[4])
    # 잔돌 (2x1 ~ 3x2), 한가운데는 빽빽, 가장자리는 성글게
    spots = [(1, 1, 3, 2), (6, 0, 2, 1), (11, 2, 3, 2), (0, 7, 2, 1), (5, 6, 3, 2), (12, 7, 2, 1), (2, 12, 3, 2), (8, 12, 2, 1), (12, 13, 3, 2),
             (8, 3, 2, 1), (4, 10, 2, 1), (14, 10, 2, 1), (9, 8, 2, 2)]
    for i, (x, y, w, h) in enumerate(spots):
        d = dep(x + w // 2, y + h // 2)
        keep = d >= 2 or (d >= 0 and _hash(i, m, 404) < .45)
        if keep: pebble(cv, x, y, w, h, seed=i)
    # 모래알 점
    for y in range(16):
        for x in range(16):
            if cv.p[x, y][3] == 0 and dep(x, y) >= 0 and _hash(x, y, 405) < .07:
                cv.px(x, y, RK[2] if _hash(x, y, 406) < .6 else RK[5])
    return cv.im

def _corner_cut(x, y, N, E, S, W, r=4.5, ins=(0, 0, 0, 0)):
    """이웃이 없는 두 변이 만나는 볼록 모서리를 둥글게 깎는다. True = 깎여 나감."""
    iN, iE, iS, iW = ins
    corners = []
    if not N and not W: corners.append((iW + r, iN + r, x < iW + r and y < iN + r))
    if not N and not E: corners.append((15 - iE - r, iN + r, x > 15 - iE - r and y < iN + r))
    if not S and not W: corners.append((iW + r, 15 - iS - r, x < iW + r and y > 15 - iS - r))
    if not S and not E: corners.append((15 - iE - r, 15 - iS - r, x > 15 - iE - r and y > 15 - iS - r))
    for (cx, cy, inq) in corners:
        if inq and math.hypot(x + .5 - cx, y + .5 - cy) > r: return True
    return False

# 바위 덩이 무늬(주기 16): 칸 안 점 6개 + 이웃 칸 복사 → 이웃한 칸끼리 덩이가 이어진다
_LUMPS = [(3.0, 2.5, 4.6), (11.5, 1.0, 3.0), (13.5, 8.5, 5.4), (5.0, 10.0, 5.8), (9.5, 14.5, 2.6), (0.5, 15.5, 2.4), (8.5, 6.0, 2.2)]
def _lump(x, y):
    """(덩이 안 단, 덩이 경계?) — 가장 가까운 덩이 중심 기준 3/4 음영."""
    best = None
    for (cx, cy, r) in _LUMPS:
        for ox in (-16, 0, 16):
            for oy in (-16, 0, 16):
                dx = x + .5 - (cx + ox); dy = y + .5 - (cy + oy)
                d = math.hypot(dx, dy) / r
                if best is None or d < best[0]: best = (d, dx / r, dy / r)
    d, dx, dy = best
    k = 4.0 - 1.5 * dx - 1.3 * dy - .7 * d * d + (pn(x, y, 4, 437, 16) - .5) * 1.2
    if d > .94: k = 1.6                                                     # 덩이 사이 틈
    return k

def ledge_cell(m, N, E, S, W):
    """암반 턱(막힘, 바닥 위): 낮게 솟은 울퉁불퉁한 바위 덩이 무리. 윗면은 둥근 바위 덩이(빛 왼쪽 위), 남쪽 끝은 6px 앞면,
    볼록 모서리는 둥글게, 이웃이 없는 쪽은 들쭉날쭉. 벽 앞면 밑동에 이어 칠하면 곧은 벽선을 깨는 바위 자락이 된다."""
    im = new(); p = im.load()
    FH = 5
    for y in range(16):
        for x in range(16):
            eW = _rag(y, 11, 2.5, 1) if not W else -9
            eE = _rag(y, 12, 2.5, 1) if not E else -9
            eN = _rag(x, 13, 2.5, 1) if not N else -9
            eS = _rag(x, 14, 1.6, 0) if not S else -9
            if x < eW or 15 - x < eE or y < eN or 15 - y < eS: continue
            if _corner_cut(x, y, N, E, S, W, 5.0, (max(eN, 0), max(eE, 0), max(eS, 0), max(eW, 0))): continue
            k = _lump(x, y)
            if _hash(x, y, 432) < .07: k -= 1
            if not S and 15 - y - eS < FH:                                    # 앞면
                fy = FH - 1 - (15 - y - eS)
                u = ((x + int(_pn1(y, 15) * 3)) % 5) / 5.0
                k = 2.4 + (.5 - u) * 1.4
                if u > .8: k = 1
                if fy == 0: k = min(k + 1.5, 4)
                elif fy == FH - 1: k = 0
            else:
                if not E and 15 - x - eE <= 1: k = min(k, 2)
            p[x, y] = tuple(RK[max(0, min(6, int(round(k))))]) + (255,)
    o = im.copy(); q = o.load()
    for y in range(16):
        for x in range(16):
            if p[x, y][3] == 0: continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                xx, yy = x + dx, y + dy
                if 0 <= xx < 16 and 0 <= yy < 16 and p[xx, yy][3] == 0:
                    q[x, y] = tuple(RK[0] if dy >= 0 and dx >= 0 else RK[1]) + (255,); break
    return o

_RIP = [(2, 1, 6), (5, 9, 5), (8, 4, 4), (10, 12, 6), (13, 6, 5), (15, 14, 3)]
def water_px(x, y, seed=0):
    """칸 주기 16 으로 이어지는 물: 부드러운 두 단 바탕 + 엇갈린 가로 잔물결 줄."""
    n = pn(x, y, 8, 61, 16) * .6 + pn(x, y, 4, 62, 16) * .4
    k = 1 if n < .48 else 2
    for (ry, rx, ln) in _RIP:
        if y == ry and (x - rx) % 16 < ln:
            k = 4 if (x - rx) % 16 == 0 else 3
        elif y == ry + 1 and (x - rx) % 16 < ln - 1 and (x - rx) % 16 > 0: k = max(k, 2)
    if _hash(x, y, 63) > .992: k = 5
    return WT[k]

def pool_cell(m, N, E, S, W):
    """지하수 웅덩이·시냇물(막힘): 속은 어두운 물 + 가로 잔물결. 북쪽 물가는 바위 둑 앞면(3/4), 남쪽은 밝은 물가 테두리,
    서쪽 밝음, 동쪽 어두움. 이웃 없는 쪽은 들쭉날쭉(바닥이 비친다)."""
    im = new(); p = im.load()
    for y in range(16):
        for x in range(16):
            eW = _rag(y, 21, 3, 0) if not W else -9
            eE = _rag(y, 22, 3, 0) if not E else -9
            eN = _rag(x, 23, 2, 0) if not N else -9
            eS = _rag(x, 24, 3, 1) if not S else -9
            dW, dE, dN, dS = x - eW, 15 - x - eE, y - eN, 15 - y - eS
            if min(dW, dE, dN, dS) < 0: continue
            if _corner_cut(x, y, N, E, S, W, 6.0, (max(eN, 0), max(eE, 0), max(eS, 0), max(eW, 0))): continue
            c = water_px(x, y)
            if not N and dN < 5:                                               # 둑 앞면 → 물에 닿는 어두운 띠
                c = (RK[4], RK[3], RK[2], WT[0], mix(c, WT[0], .5))[dN]
            if not S:
                if dS == 0: c = RK[5]
                elif dS == 1: c = WT[4]
                elif dS == 2: c = mix(c, WT[4], .4)
            if not W and dN >= 3:
                if dW == 0: c = RK[4]
                elif dW == 1: c = mix(c, WT[0], .4)
            if not E and dN >= 3:
                if dE == 0: c = RK[2]
                elif dE == 1: c = mix(c, WT[0], .5)
            p[x, y] = tuple(c) + (255,)
    return im

def sheets():
    return dict(crack=autotile_sheet(crack_cell), ledge=autotile_sheet(ledge_cell), pool=autotile_sheet(pool_cell))

# ------------------------------------------------------------------ 지도 렌더 (바닥 경계를 화소 단위로 흐트러뜨린다)
def _hsh(X, Y, s):
    X = np.asarray(X).astype(np.int64) & 0xffffffff; Y = np.asarray(Y).astype(np.int64) & 0xffffffff
    h = (X * 374761393 + Y * 668265263 + (s * 982451653 & 0xffffffff)) & 0xffffffff
    h = ((h ^ (h >> 13)) * 1274126177) & 0xffffffff
    return ((h ^ (h >> 16)) & 0xffff) / 65535.0
def _vn(X, Y, sc, seed):
    fx = np.asarray(X, dtype=np.float64) / sc; fy = np.asarray(Y, dtype=np.float64) / sc
    x0 = np.floor(fx); y0 = np.floor(fy); tx = fx - x0; ty = fy - y0
    tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty); x0 = x0.astype(np.int64); y0 = y0.astype(np.int64)
    a = _hsh(x0, y0, seed); b = _hsh(x0 + 1, y0, seed); c = _hsh(x0, y0 + 1, seed); d = _hsh(x0 + 1, y0 + 1, seed)
    return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty

class CaveMap(KMap):
    """KMap + 동굴 천장 + 바닥 종류 경계를 화소 단위로 흐트러뜨림(칸 격자 무늬가 안 보이게)."""
    def __init__(s, W, H, name):
        super().__init__(W, H, name)
        s.cave = True
        s.ceil_fn = ceil_rc
    def _blend_floor(s):
        """바닥: 종류마다 주기 768 의 같은 그리기 함수로 지도 전체를 한 장으로 칠한다(반복 무늬 없음).
        칸 경계는 잡음으로 흔들어 종류가 화소 단위로 맞물린다."""
        Wp, Hp = s.W * T, s.H * T
        kinds = sorted({k for row in s.fl for k in row if k})
        fns = {k: FLOOR_MAKERS[k](768) for k in kinds}
        PY, PX = np.mgrid[0:Hp, 0:Wp]
        wx = PX + (_vn(PX, PY, 7.0, 3) - .5) * 10 + (_hsh(PX, PY, 4) - .5) * 1.5
        wy = PY + (_vn(PX, PY, 7.0, 5) - .5) * 10 + (_hsh(PX, PY, 6) - .5) * 1.5
        tx = np.clip((wx // T).astype(int), 0, s.W - 1); ty = np.clip((wy // T).astype(int), 0, s.H - 1)
        fl = np.array([[kinds.index(k) + 1 if k else 0 for k in row] for row in s.fl])
        own = fl[PY // T, PX // T]; war = fl[ty, tx]
        pick = np.where((own > 0) & (war > 0), war, own)
        out = np.zeros((Hp, Wp, 3), np.uint8)
        ys, xs = np.nonzero(pick)
        for y, x in zip(ys.tolist(), xs.tolist()):
            out[y, x] = fns[kinds[pick[y, x] - 1]](x, y)
        return Image.fromarray(out, 'RGB').convert('RGBA')
    def render(s):
        fim = s._blend_floor()
        prev = dlib.floor_tile
        dlib.floor_tile = lambda kind, x, y: fim.crop((x * T, y * T, x * T + T, y * T + T))
        try: return super().render()
        finally: dlib.floor_tile = prev

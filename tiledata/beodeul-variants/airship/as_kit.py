# 비행선 갑판 + 내부(airship) 공용 재료.
# tower-interior 의 ti_kit(→ graveyard-crypt gc_kit/gc_ext/gc_map → _lib3 dlib)을 읽기만 하고, 버들항 나무 램프(terrain.WD)·
# 버들항 칩셋 널판 결(terrain.CH 288,80)·놋쇠(BR)·쇠(IR)·하늘(SKY)을 그대로 쓴다. 새 재료(갑판 널·선실 널·기관실 널·
# 캔버스 천·삼 밧줄·선체 앞면·나무 벽판·나무 천장 띠·구름)는 같은 7단 규칙(0 윤곽 .. 6 밝음)으로 칠한다. 3/4, 빛 왼쪽 위, 1칸 = 16px.
import os, sys, math
_ME = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(_ME, '..', 'tower-interior'))
from ti_kit import *                                    # noqa (T, ST, WD, BR, IR, SKY, GLD, CRM, SL, GL, RD, Cv, Mk, vol, fin, Kit, KMap, foot …)
from ti_kit import _hash, _pn1
import ti_kit as TK
import dlib, terrain, pz
HERE = _ME

WD = terrain.WD                                          # 버들항 나무 7단 (0 윤곽 보라 .. 6 밝음)
I7 = [IR[0]] + IR                                        # 쇠 7단
CNV = [(58, 40, 40), (104, 84, 72), (146, 126, 106), (184, 166, 140), (212, 198, 170), (232, 222, 198), (248, 242, 226)]   # 캔버스 천
ROPE = [(46, 30, 18), (88, 62, 34), (124, 94, 54), (160, 128, 78), (192, 162, 104), (218, 194, 138), (236, 220, 170)]    # 삼 밧줄
MAH = [(30, 14, 22), (58, 26, 22), (86, 40, 28), (112, 56, 34), (138, 76, 44), (164, 100, 60), (196, 134, 84)]           # 선실 붉은 널(마호가니)
EMB = [(60, 20, 10), (150, 50, 16), (220, 110, 30), (250, 180, 60), (255, 230, 140), (255, 250, 220)]                     # 불씨·화구
COAL = [(10, 10, 14), (22, 22, 28), (36, 36, 44), (54, 54, 64), (80, 80, 92), (120, 120, 132)]
SOOT = (34, 26, 24)
SKY7 = [(78, 120, 180)] + list(SKY)                      # 하늘 7단

def lum(c): return .3 * c[0] + .59 * c[1] + .11 * c[2]

# ------------------------------------------------------------------ 버들항 칩셋 널판 결 (세로 널 48x48 → 톤 1..6)
_PL = terrain.CH.crop((288, 80, 336, 128)).convert('RGB').load()
def grain(lx, ly):
    r, g, b = _PL[lx % 48, ly % 48]; v = r + g + b
    return 1 if v < 150 else (2 if v < 210 else (3 if v < 260 else (4 if v < 310 else (5 if v < 360 else 6))))

def line(cv, x0, y0, x1, y1, c):
    """Bresenham 선."""
    x0, y0, x1, y1 = int(round(x0)), int(round(y0)), int(round(x1)), int(round(y1))
    dx = abs(x1 - x0); dy = -abs(y1 - y0); sx = 1 if x0 < x1 else -1; sy = 1 if y0 < y1 else -1; err = dx + dy
    while True:
        cv.px(x0, y0, c(x0, y0) if callable(c) else c)
        if x0 == x1 and y0 == y1: break
        e2 = 2 * err
        if e2 >= dy: err += dy; x0 += sx
        if e2 <= dx: err += dx; y0 += sy

def rope_line(cv, x0, y0, x1, y1, sag=0.0, k=3, ramp=ROPE):
    """늘어진 밧줄(가운데가 sag px 처지는 2차 곡선). 꼬임 결: 2px 마다 한 단 밝게."""
    n = int(max(abs(x1 - x0), abs(y1 - y0)) * 1.4) + 2
    last = None
    for i in range(n + 1):
        t = i / n
        x = x0 + (x1 - x0) * t; y = y0 + (y1 - y0) * t + sag * 4 * t * (1 - t)
        p = (int(round(x)), int(round(y)))
        if p == last: continue
        last = p
        cv.px(p[0], p[1], ramp[clamp(k + (1 if (p[0] + p[1]) % 3 == 0 else 0), 1, 6)])

# ------------------------------------------------------------------ 바닥 3종 (48x48 주기 표본)
def deck_px(X, Y):
    """비행선 갑판: 버들항 잔교처럼 4px 널(3px 널 + 1px 이음) 이 배 길이(동서)로 눕는다. 널은 48px 마다 한 번 끊기고(마디는 줄마다 어긋남)
    마디 곁에 못 두 점, 칩셋 널판 결(±1 단), 드문 타르 얼룩."""
    row = Y // 4; ly = Y % 4
    off = int(_hash(row % 12, 0, 701) * 48)
    xx = (X + off) % 48
    if ly == 3: return WD[3]
    if xx == 0: return WD[3]
    h = _hash(row % 12, 0, 702)
    t = 5 if h < .7 else 4
    g = grain(Y % 4 * 9 + row * 3, X + row * 23) - 3
    if g >= 2: t += 1
    elif g <= -2: t -= 1
    if ly == 0: t = min(6, t + 1)
    c = WD[clamp(t, 1, 6)]
    if h >= .7: c = mix(c, WD[5], .45)
    if (xx in (2, 45)) and ly == 1: c = WD[3]                                       # 못
    if pn(X, Y, 6, 705) < .08 and _hash(X, Y, 706) < .5: c = mix(c, WD[1], .3)        # 타르 얼룩
    return c
mk_floor('as_deck', deck_px)

def cabin_px(X, Y):
    """선실 바닥: 윤낸 마호가니 널 8px(7 + 이음 1), 32px 마디가 어긋나고 못 둘, 잔 결 · 반들거림."""
    row = Y // 8; ly = Y % 8
    off = int(_hash(row % 6, 0, 711) * 16) * 2
    xx = (X + off) % 48; seg = xx // 24; lx = xx % 24
    if ly == 7: return MAH[1]
    if lx == 0: return MAH[1]
    h = _hash(row % 6, seg, 712)
    t = 4 if h < .5 else (3 if h < .82 else 5)
    g = grain(Y % 8 * 5 + row * 3, X + row * 29) - 3
    if g >= 2: t += 1
    elif g <= -2: t -= 1
    if ly == 0: t = min(6, t + 1)
    if ly == 6: t = max(1, t - 1)
    c = MAH[clamp(t, 1, 6)]
    if ly in (3, 4) and lx in (2, 22): c = MAH[1]
    if ly == 1 and (X + Y * 3) % 23 == 0: c = MAH[6]                                 # 광택
    return c
mk_floor('as_cabin', cabin_px)

def engine_px(X, Y):
    """기관실 바닥: 기름 먹어 잿빛이 도는 6px 널(16px 마디가 줄마다 어긋남), 그을음·기름 얼룩."""
    row = Y // 6; ly = Y % 6
    off = int(_hash(row % 8, 0, 722) * 12)
    seg = ((X + off) % 48) // 16; lx = (X + off) % 16
    if ly == 5: return WD[1]
    if lx == 0 and _hash(row % 8, seg, 723) < .7: return WD[1]
    h = _hash(row % 8, seg, 724)
    t = 4 if h < .55 else (5 if h < .8 else 3)
    g = grain(Y % 6 * 7 + row * 3, X + row * 31) - 3
    if g >= 2: t += 1
    elif g <= -2: t -= 1
    if ly == 0: t += 1
    c = mix(WD[clamp(t, 1, 6)], (120, 104, 84), .12)
    n = pn(X, Y, 8, 725)
    if n > .8: c = mix(c, SOOT, .3)                                                 # 그을음
    elif n < .14: c = mix(c, (60, 52, 40), .3)                                      # 기름 얼룩
    return c
mk_floor('as_engine', engine_px)

# ------------------------------------------------------------------ 하늘·구름 (갑판 밖)
SKY_H = 512.0
def sky_px(X, Y, cloud_bias=0.0):
    """위가 진하고 아래로 밝아지는 세 단 하늘(좁은 디더 경계) + 큰 덩이 적운: 윗가 한 줄 흰빛, 속은 두 단, 아랫가 그늘 한 단.
    맵 아래쪽(선체 밑)일수록 구름이 많고 위쪽은 드물다. 잔 조각이 생기지 않게 낮은 주파수 잡음만 쓴다."""
    t = Y / SKY_H
    tt = t * 3 + (.5 if (X + Y) % 2 else 0) * .12
    c = SKY7[2] if tt < 1.0 else (SKY7[3] if tt < 2.0 else SKY7[4])
    thr = .70 - .2 * max(0.0, (t - .5) / .5) - cloud_bias
    def cl(xx, yy): return vnoise(xx * .45, yy * 1.1, 30, 811) * .8 + vnoise(xx * .7, yy, 12, 812) * .2
    n = cl(X, Y)
    if n > thr:
        up = cl(X, Y - 2); dn = cl(X, Y + 3)
        if up <= thr: c = SKY7[6]
        elif dn <= thr: c = SKY7[4]
        else: c = SKY7[6] if n > thr + .06 and cl(X - 3, Y - 3) > thr + .03 else SKY7[5]
    return c

def sky_sample():
    return mk(lambda x, y: sky_px(x, y + 380), 48, 48)

# ------------------------------------------------------------------ 선체 앞면(갑판 남쪽 가장자리 아래 3줄)
def hull_px(X, Y, H=48):
    """비행선 선체 앞면: 맨 위 놋쇠 걸레받이 띠 2px, 5px 외판(위는 밝고 아래로 어두워짐), 가운데 놋쇠 띠(리벳), 64px 마다 둥근 놋쇠 현창,
    아래로 갈수록 배 밑으로 말려 들어가 어두워지고 맨 아래 한 줄 윤곽."""
    if Y < 2: return BR[5] if Y == 0 else BR[3]
    if Y == 2: return WD[1]
    # 현창
    px_ = X % 64
    cx, cy = 31.5, 9.5
    d = math.hypot(px_ + .5 - cx - .5, Y + .5 - cy - .5)
    if d < 5.2:
        if d < 3.4:
            c = SKY7[5] if (px_ - 30) + (Y - 8) < 0 else SKY7[3]
            if px_ == 30 and Y == 7: c = SKY7[6]
            if d > 2.6: c = mix(c, GL[1], .5)
            return c
        return BR[6] if (px_ < cx and Y < cy) else (BR[4] if d < 4.3 else BR[2])
    if 17 <= Y <= 19:                                                               # 놋쇠 띠
        c = BR[5] if Y == 17 else (BR[4] if Y == 18 else BR[2])
        if Y == 18 and X % 12 == 3: c = BR[6]
        return c
    strake = (Y - 3) // 5; ly = (Y - 3) % 5
    base = 5 - min(3, Y // 12)
    off = int(_hash(strake, 0, 731) * 40)
    lx = (X + off) % 40
    t = base
    if ly == 4: t = base - 2
    elif ly == 0: t = base + 1
    if lx == 0 and ly < 4: t = base - 2
    g = grain(Y % 5 * 8 + strake * 3, X + strake * 37) - 3
    if g >= 2: t += 1
    elif g <= -2: t -= 1
    c = WD[clamp(t, 1, 6)]
    if Y >= H - 8: c = mul(c, .82)
    if Y >= H - 4: c = mul(c, .7)
    if Y == H - 1: c = DK
    return c

def hull_tile(x, n, H=48):
    """선체 앞면 칸 하나: n = 위에서 몇 번째 줄(0..)."""
    return mk(lambda xx, yy: hull_px(x * 16 + xx, n * 16 + yy, H))

def hull_sample():
    im = new(48, 48)
    for j in range(3):
        for i in range(3): im.alpha_composite(hull_tile(i, j), (i * 16, j * 16))
    return im

# ------------------------------------------------------------------ 실내 벽 앞면 두 종 (dlib.face_px 에 끼운다)
dlib.FACE_BASE['as_cabin'] = WD[3]
dlib.FACE_BASE['as_ribs'] = WD[2]
_prev_face = dlib.face_px
def _face_px(style, X, Y, H, seed, capL, capR):
    if style == 'as_cabin':
        c = cabin_face(X, Y, H)
    elif style == 'as_ribs':
        c = ribs_face(X, Y, H)
    else:
        return _prev_face(style, X, Y, H, seed, capL, capR)
    if Y == 0: c = WD[5]
    elif Y == 1: c = mix(c, WD[5], .3)
    elif Y == 2: c = mul(c, .62)
    elif Y == 3: c = mul(c, .78)
    elif Y == 4: c = mul(c, .9)
    if Y == H - 1: c = DK
    elif Y == H - 2: c = mul(c, .5)
    elif Y == H - 3: c = mul(c, .78)
    if capL and X % 16 == 0: c = mix(c, WD[6], .3)
    if capL and X % 16 == 1: c = mix(c, WD[6], .1)
    if capR and X % 16 == 15: c = mul(c, .55)
    if capR and X % 16 == 14: c = mul(c, .8)
    return c
dlib.face_px = _face_px

def cabin_face(X, Y, H):
    """선실 벽: 위는 세로 널 판벽(6px), 가운데 몰딩 띠, 아래 굽도리 판(24px 틀 + 들어간 판), 걸레받이."""
    rail = H - 20
    if Y < rail:
        b = X // 6; lx = X % 6
        t = 3 if _hash(b, 0, 741) < .55 else 4
        if lx == 5: t = 1
        elif lx == 0: t += 1
        g = grain(X % 6 * 7 + b * 3, Y + b * 19) - 3
        if g >= 2: t += 1
        elif g <= -2: t -= 1
        c = WD[clamp(t, 1, 6)]
        if pn(X, Y, 6, 742) > .8: c = mul(c, .9)
        return mul(c, .92)
    ly = Y - rail
    if ly == 0: return WD[5]
    if ly == 1: return BR[4]
    if ly == 2: return WD[2]
    if ly >= 15: return WD[2] if ly < 17 else WD[1]                                # 걸레받이
    px_ = X % 24; py = ly - 3                                                       # 굽도리 판(0..11)
    if px_ < 3 or px_ > 21 or py < 1 or py > 10:
        c = WD[3]
        if px_ == 0: c = WD[4]
        if py == 0: c = WD[2]
    else:
        c = WD[3]
        if px_ == 3 or py == 1: c = WD[1]                                          # 들어간 판 그늘(왼쪽·위)
        elif px_ == 21 or py == 10: c = WD[4]
        elif px_ == 4 or py == 2: c = WD[2]
    return mul(c, .95)

def ribs_face(X, Y, H):
    """기관실 벽(선체 안쪽): 가로 외판 8px 위로 32px 마다 굽은 늑골(나무 기둥) + 쇠 무릎 받침, 리벳, 그을음."""
    rx = (X + int(round(2.0 * math.sin(math.pi * Y / H)))) % 32
    if 12 <= rx <= 18:                                                              # 늑골
        c = WD[4] if rx == 12 else (WD[5] if rx == 13 else (WD[3] if rx < 17 else WD[2]))
        if rx == 18: c = WD[1]
        if 6 <= Y <= 12 and rx in (13, 17): c = I7[4] if rx == 13 else I7[2]       # 쇠 무릎
        if Y in (8, 10) and rx == 15: c = I7[5]
        return c
    row = Y // 8; ly = Y % 8
    off = int(_hash(row, 0, 751) * 32)
    lx = (X + off) % 48
    t = 3 if _hash(row, (X + off) // 48, 752) < .6 else 2
    if ly == 7 or lx == 0: t = 1
    elif ly == 0: t += 1
    g = grain(Y % 8 * 5 + row * 3, X + row * 41) - 3
    if g >= 2: t += 1
    elif g <= -2: t -= 1
    c = mul(WD[clamp(t, 1, 6)], .82)
    if ly == 3 and X % 8 == 2: c = I7[3]                                            # 리벳
    if pn(X, Y, 8, 753) > .72: c = mix(c, SOOT, .35)
    return c

def face_sample(style, w, h):
    return compose_(w, h, lambda i, j: dlib.face_tile(style, None, j, int(_hash(i + 3, j, 3) * 6), i == 0, i == w - 1, h * T))

# ------------------------------------------------------------------ 나무 천장 (벽 너머 = 위 갑판의 두께 띠, 그 안쪽은 어둠)
WVOID = [(16, 10, 14), (22, 14, 18), (28, 20, 22)]
_wc_cache = {}
def wood_ceiling(open8, seed=0):
    key = (open8, seed % 4)
    if key in _wc_cache: return _wc_cache[key]
    N, E, S, W, NE, SE, SW, NW = open8
    t = 8
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
            r = _hash(X, Y, 761)
            return WVOID[0] if r < .55 else (WVOID[1] if r < .93 else WVOID[2])
        d, side = b
        # 띠 = 위 갑판 널 두께: 널 결(가로 4px)
        ly = Y % 4
        c = WD[4] if _hash(Y // 4, X // 24, 762) < .6 else WD[3]
        if ly == 3: c = WD[2]
        if d == 0: c = WD[6] if side in ('N', 'W') else mix(c, WD[5], .45)
        elif d == 1: c = mix(c, WD[5], .2)
        if d == t - 1: c = DK
        elif d == t - 2: c = mix(c, DK, .3)
        return c
    im = mk(f); _wc_cache[key] = im; return im

def ceiling_sample():
    def cf(i, j):
        o8 = (j > 0, i < 2, j < 2, i > 0, j > 0 and i < 2, j < 2 and i < 2, j < 2 and i > 0, j > 0 and i > 0)
        return wood_ceiling((False,) * 8 if (i == 1 and j == 1) else o8, i + j)
    return compose_(3, 3, cf)

# ------------------------------------------------------------------ 작은 그리기 도우미
def wbox(cv, x0, y0, x1, y1, top, ramp=WD, seed=0, boards=4, vertical=False):
    """3/4 나무 상자: 윗면 top 행(밝음, 널 결) + 앞면(가로/세로 널, 왼쪽 밝고 오른쪽 어둡다), 맨 아래 윤곽 쪽."""
    for y in range(y0, y1):
        for x in range(x0, x1):
            if y < y0 + top:
                k = 6 if (y == y0 or x == x0) else 5
                if x >= x1 - 1: k = 4
                if not vertical and (y - y0) % boards == boards - 1 and y < y0 + top - 1: k -= 1
            else:
                k = 5 if x < x0 + 2 else (4 if x < x1 - 3 else 3)
                if y == y0 + top: k -= 1
                if vertical and (x - x0) % boards == boards - 1: k = 2
                if not vertical and (y - y0 - top) % boards == boards - 1: k = 2
                if y >= y1 - 1: k = 2
            if _hash(x, y, seed + 4) < .05: k += 1 if _hash(y, x, seed + 5) < .5 else -1
            cv.px(x, y, ramp[clamp(k, 1, len(ramp) - 1)])

def vcyl(cv, x0, x1, y0, y1, ramp, cap=2, seed=0, bands=(), band_ramp=None):
    """세로 원통(돛대·굴뚝·기둥): 열마다 cyl_k 명암. 위 cap 행은 둥근 윗면(밝게). bands = 놋쇠 띠 y 목록."""
    for y in range(y0, y1):
        for x in range(x0, x1):
            k = cyl_k(x, x0, x1)
            if y < y0 + cap: k = min(6, k + 1)
            if y in bands:
                br = band_ramp or BR
                cv.px(x, y, br[clamp(k, 1, 6)]); continue
            if _hash(x, y, seed + 7) < .05: k -= 1
            cv.px(x, y, ramp[clamp(k, 1, len(ramp) - 1)])

def hcyl(cv, x0, x1, y0, y1, ramp, seed=0, ends=True):
    """가로 원통(누운 관·통·축): 행마다 명암(위 밝고 아래 어둡다), 양 끝 한 열 어둡게."""
    h = y1 - y0
    for y in range(y0, y1):
        t = (y + .5 - y0) / h
        k = 4 if t < .12 else (6 if t < .3 else (5 if t < .5 else (4 if t < .7 else (3 if t < .88 else 2))))
        for x in range(x0, x1):
            kk = k
            if ends and (x == x0): kk = min(6, k + 1) if t < .5 else k
            if ends and x == x1 - 1: kk = max(1, k - 2)
            if _hash(x, y, seed + 3) < .04: kk -= 1
            cv.px(x, y, ramp[clamp(kk, 1, len(ramp) - 1)])

def ellipse_fill(cv, cx, cy, rx, ry, fn):
    for y in range(int(cy - ry - 1), int(cy + ry + 2)):
        for x in range(int(cx - rx - 1), int(cx + rx + 2)):
            dx = (x + .5 - cx) / rx; dy = (y + .5 - cy) / ry
            d = dx * dx + dy * dy
            if d <= 1: cv.px(x, y, fn(x, y, dx, dy, d))

def ring(cv, cx, cy, rx, ry, w, fn):
    """타원 고리(두께 w px)."""
    for y in range(int(cy - ry - 1), int(cy + ry + 2)):
        for x in range(int(cx - rx - 1), int(cx + rx + 2)):
            dx = (x + .5 - cx) / rx; dy = (y + .5 - cy) / ry
            d = math.sqrt(dx * dx + dy * dy)
            if 1 - w / max(rx, ry) <= d <= 1: cv.px(x, y, fn(x, y, dx, dy))

def barrel(cv, x0, y0, w, h, seed=0, top=3):
    """세운 통: 윗면 타원 + 배 불룩한 앞면 널(세로) + 쇠테 둘."""
    cx = x0 + w / 2.0
    for y in range(y0 + top // 2, y0 + h):
        bulge = math.sin(math.pi * (y - y0) / h) * .8
        for x in range(int(x0 - bulge), int(x0 + w + bulge + .5)):
            k = cyl_k(x, x0 - bulge, x0 + w + bulge)
            if (x - x0) % 3 == 2: k -= 1
            if y in (y0 + top + 1, y0 + h - 3): cv.px(x, y, I7[clamp(k - 1, 1, 6)]); continue
            if y == y0 + h - 1: k = 2
            cv.px(x, y, WD[clamp(k, 1, 6)])
    ellipse_fill(cv, cx, y0 + top / 2.0, w / 2.0, top / 2.0 + .4, lambda x, y, dx, dy, d: WD[6] if d > .55 and dy < 0 else (WD[5] if d > .55 else WD[4]))

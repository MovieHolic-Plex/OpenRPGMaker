# 마왕성 재료: 바닥(주기 48 표본)·벽 앞면·천장 재색·오토타일 3종 (카펫, 용암 해자, 가시 울타리)
from df_kit import *
from df_kit import _hash, _pn1
import gc_ext

# ------------------------------------------------------------------ 바닥
def _obs_flag(base_k, dark_k, seed):
    def fn(X, Y):
        return flagp(X, Y, seed, mix(OB[base_k], OB[base_k + 1], .35), OB[dark_k])
    return fn
def black_slab(X, Y):
    c = flagp(X, Y, 401, mix(OB[3], OB[4], .15), OB[1])
    if pn(X, Y, 6, 402) > .8: c = mix(c, (80, 30, 48), .25)               # 붉은 얼룩
    return c
mk_floor('bf_slab', black_slab)
def obsidian(X, Y):
    """흑요석: 큰 정사각 마름돌, 번들거리는 사선 반사."""
    lx = X % 24; ly = Y % 24
    if lx == 23 or ly == 23: return OB[0]
    c = mix(OB[2], OB[3], .3 + .5 * _hash(X // 24, Y // 24, 411))
    if (lx + ly) % 24 in (4, 5, 6) and _hash(X // 24, Y // 24, 412) < .6: c = mix(c, OB[5], .5)
    if lx == 0 or ly == 0: c = mix(c, OB[5], .3)
    if _hash(X, Y, 413) < .04: c = OB[4]
    return c
mk_floor('bf_obs', obsidian)
ASH = [(30, 26, 34), (48, 42, 52), (70, 62, 72), (96, 86, 96), (122, 108, 116)]
def ash_ground(X, Y):
    n = pn(X, Y, 6, 421); r = _hash(X, Y, 422)
    c = ASH[1] if n < .4 else (ASH[2] if n < .78 else ASH[3])
    if r < .1: c = ASH[0]
    elif r > .95: c = ASH[4]
    if pn(X, Y, 3, 423) > .86: c = mix(c, (150, 60, 40), .35)              # 식어 가는 불씨 자국
    return c
mk_floor('bf_ash', ash_ground)
def dais_floor(X, Y):
    c = flagp(X, Y, 431, mix(OB[3], RDK[1], .35), OB[1])
    return c
mk_floor('bf_dais', dais_floor)

# ------------------------------------------------------------------ 벽 앞면 (스타일 추가)
dlib.FACE_BASE['black'] = mix(OB[1], OB[2], .5)
dlib.FACE_BASE['rampart'] = mix(OB[2], OB[3], .45)
_prev_face = dlib.face_px
def _face_px(style, X, Y, H, seed, capL, capR):
    if style not in ('black', 'rampart'): return _prev_face(style, X, Y, H, seed, capL, capR)
    base = dlib.FACE_BASE[style]
    c = dlib.ash(X, Y, seed, base, mul(base, .55), bw=16, bh=8, k=1.0)
    if style == 'black':
        if vnoise(X, Y, 4, seed + 31) > .8: c = mix(c, (92, 40, 56), .3)          # 붉은 균열 얼룩
        if _hash(X // 2, Y // 2, seed + 7) > .985: c = mix(c, RDK[3], .6)
    else:
        if vnoise(X, Y, 3.5, seed + 33) > .78: c = mix(c, OB[5], .3)
        if Y > 4 and Y % 16 == 9 and _hash(X // 16, Y, seed) < .35: c = mul(c, .8)
    if Y == 0: c = OB[6] if style == 'rampart' else OB[5]
    elif Y == 1: c = mix(c, OB[5], .35)
    elif Y == 2: c = mul(c, .76)
    elif Y == 3: c = mul(c, .88)
    if Y == H - 1: c = OB[0]
    elif Y == H - 2: c = mul(c, .5)
    elif Y == H - 3: c = mul(c, .8)
    if capL and X % 16 == 0: c = mix(c, OB[5], .35)
    if capL and X % 16 == 1: c = mix(c, OB[5], .12)
    if capR and X % 16 == 15: c = mul(c, .55)
    if capR and X % 16 == 14: c = mul(c, .8)
    return c
dlib.face_px = _face_px

# ------------------------------------------------------------------ 천장 재색 (돌 램프 → 마왕성 보라돌 램프)
def recolor(im, ramp, lo=20, hi=225):
    o = im.copy(); p = o.load()
    for y in range(o.height):
        for x in range(o.width):
            r, g, b, a = p[x, y]
            if not a: continue
            L = (r * .3 + g * .59 + b * .11)
            t = max(0.0, min(1.0, (L - lo) / (hi - lo))) * (len(ramp) - 1)
            i = int(t); f = t - i
            c = mix(ramp[i], ramp[min(len(ramp) - 1, i + 1)], f)
            p[x, y] = tuple(c) + (a,)
    return o
def black_ceiling(open8, seed):
    key = ('bceil', open8, seed % 4)
    if key not in dlib._fl_cache: dlib._fl_cache[key] = recolor(dlib.ceiling(open8, seed, False), [(10, 6, 16), (18, 14, 26), OB[1], OB[2], OB[3], OB[4], OB[5]], 14, 215)
    return dlib._fl_cache[key]
def ceiling_sample_black():
    def cf(i, j):
        o8 = (j > 0, i < 2, j < 2, i > 0, j > 0 and i < 2, j < 2 and i < 2, j < 2 and i > 0, j > 0 and i > 0)
        return black_ceiling((False,) * 8 if (i == 1 and j == 1) else o8, i + j)
    return gc_ext.compose_(3, 3, cf)

# ------------------------------------------------------------------ 오토타일
def carpet_sheet():
    """붉은 카펫 16변형: 이웃이 없는 쪽은 금실 테두리와 술, 있는 쪽은 이어진다."""
    def cell(m, N, E, S, W):
        im = new(); p = im.load()
        for y in range(T):
            for x in range(T):
                c = RDK[3] if (x + y) % 8 else RDK[4]
                if (x % 8 == 3 and y % 8 in (3, 4)) or (x % 8 in (3, 4) and y % 8 == 3): c = RDK[2] if (x + y) % 2 else RDK[5]   # 마름모 무늬
                d = 99
                if not W: d = min(d, x)
                if not E: d = min(d, 15 - x)
                if not N: d = min(d, y)
                if not S: d = min(d, 15 - y)
                if d == 0: c = GLD[3]
                elif d == 1: c = GLD[5] if (x + y) % 3 else GLD[4]
                elif d == 2: c = RDK[1]
                elif d == 3: c = RDK[2] if (x + y) % 2 else RDK[3]
                p[x, y] = tuple(c) + (255,)
                # 술(바깥 아래쪽 끝) : 아래가 비면 끝 두 줄이 갈라진다
                if not S and y >= 14 and x % 2 == 0: p[x, y] = (0, 0, 0, 0)
        return im
    return autotile_sheet(cell)

def lava_inner(x, y):
    """16칸 주기로 이어지는 흐름 줄무늬(사선) — 칸이 반복돼도 점무늬로 읽히지 않게 가로로 길게 흐르는 결."""
    w = math.sin((x * 2 * math.pi / 16) + math.sin(y * 2 * math.pi / 16) * 1.3) + math.sin((y * 2 * math.pi / 8) * 1.0 + x * 2 * math.pi / 16 * 2) * .5
    k = 1 if w < -.5 else (2 if w < .35 else 3)
    if w > 1.15: k = 4
    return LAV[k]
def lava_border(d):
    return {0: OB[0], 1: OB[1], 2: (88, 30, 20)}.get(d)
def lava_sheet(): return edge_overlay(lava_inner, lava_border, 2, 1, 61)

def thorn_cell(m, N, E, S, W):
    """가시 덤불 울타리: 굵은 검은 가시 줄기가 이웃 쪽으로 뻗는다(위층, 막힘)."""
    cv = Cv(16, 16)
    def stem(x0, y0, x1, y1, th=2):
        n = int(max(abs(x1 - x0), abs(y1 - y0))) + 1
        for i in range(n + 1):
            x = x0 + (x1 - x0) * i // n; y = y0 + (y1 - y0) * i // n
            for t in range(th):
                cv.px(x, y + t, OB[4] if t == 0 else OB[2])
            cv.px(x, y + th, OB[0])
            if i % 3 == 1:
                cv.px(x, y - 2, RDK[4] if i % 6 == 1 else OB[6]); cv.px(x, y - 1, OB[5])
                cv.px(x + 1, y + th + 1, OB[3]); cv.px(x + 2, y + th + 2, OB[5])
    stem(7, 15, 7, 3, 3); cv.px(7, 1, RDK[5]); cv.px(7, 2, OB[6]); cv.px(5, 6, OB[5]); cv.px(4, 5, OB[6]); cv.px(10, 9, OB[5]); cv.px(11, 8, OB[6]); cv.px(5, 11, OB[5]); cv.px(4, 10, RDK[4])
    if E: stem(9, 8, 15, 7, 2); stem(9, 12, 15, 12, 3)
    if W: stem(0, 7, 6, 8, 2); stem(0, 12, 6, 12, 3)
    if N: stem(7, 0, 7, 4, 3)
    if S: stem(7, 12, 7, 15, 3)
    return pz.fin(cv.im, .8)
def thorn_sheet(): return autotile_sheet(thorn_cell)

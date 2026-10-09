# 공동묘지·마왕성 공용 확장: dlib 에 바닥·벽 앞면·천장 재료를 더한다 (dlib 파일은 건드리지 않고 이 모듈이 런타임에 끼운다).
from gc_kit import *
from gc_kit import _hash, _pn1
import dlib

def tint(im, fn):
    o = im.copy(); p = o.load()
    for y in range(o.height):
        for x in range(o.width):
            r, g, b, a = p[x, y]
            if a: p[x, y] = tuple(fn((r, g, b))) + (a,)
    return o

# ------------------------------------------------------------------ 바닥 (48x48 주기 표본 = 3x3 칸을 이어 붙여도 이음새 없음)
SAMPLES = {}
def mk_floor(tag, fn):
    """fn(X, Y) -> RGB, X·Y 는 0..47. 잡음은 pn()(주기 48)만 쓴다. 지도에서는 칸 좌표 % 3 으로 표본의 칸을 그대로 쓴다."""
    sample = mk(fn, 48, 48); SAMPLES[tag] = sample
    def f(cx, cy): return sample.crop((cx % 3 * 16, cy % 3 * 16, cx % 3 * 16 + 16, cy % 3 * 16 + 16))
    dlib.FLOORS[tag] = f; return sample

def flagp(X, Y, seed, base, dark, bw=16, bh=8):
    """판석: 줄마다 어긋난 마디(주기 48 에 맞게 열 번호를 접는다)."""
    row = Y // bh; ly = Y % bh
    jx = int(_hash(0, row, seed + 5) * 10) + 3 + (row % 2) * 2
    lx = X % bw
    if ly == bh - 1: return dark
    if lx == jx % bw: return dark
    col = (X // bw + (1 if lx > jx % bw else 0)) % (48 // bw)
    h = _hash(col, row, seed + 9)
    c = base if h < .55 else (mix(base, ST[5], .16) if h < .8 else mix(base, dark, .25))
    if ly == 0 or lx == (jx + 1) % bw: c = mix(c, ST[5], .22)
    r = _hash(X, Y, seed + 12)
    if r < .05: c = mix(c, ST[5], .3)
    elif r > .97: c = mix(c, dark, .5)
    return c

MIST = [(26, 44, 38), (38, 62, 50), (52, 82, 60), (70, 104, 72), (96, 130, 92)]
def grass_mist(X, Y):
    n = pn(X, Y, 4, 301); r = _hash(X, Y, 302)
    c = MIST[1] if n < .5 else MIST[2]
    if r < .10: c = MIST[0]
    elif r > .93: c = MIST[3]
    if _hash(X // 2, Y // 2, 303) > .985: c = (150, 150, 120)                  # 시든 꽃
    f = pn(X, Y, 16, 304)
    if f > .7: c = mix(c, (130, 160, 150), .14)                                # 푸른 안개 번짐
    return c
mk_floor('gy_grass', grass_mist)

def cobble_path(X, Y):
    row = Y // 8; off = (row % 2) * 6; xx = (X + off) % 48; col = xx // 12; lx = xx % 12; ly = Y % 8
    if ly == 7 or lx == 11: return ST[1]
    h = _hash(col, row, 311)
    c = ST[3] if h < .45 else (mix(ST[3], ST[4], .5) if h < .8 else ST[2])
    if ly == 0 or lx == 0: c = mix(c, ST[4], .4)
    if _hash(X, Y, 312) < .05: c = ST[2]
    if pn(X, Y, 6, 313) > .78: c = mix(c, (64, 98, 58), .45)
    return c
mk_floor('gy_path', cobble_path)

DIRT = [(34, 24, 22), (62, 44, 34), (92, 66, 46), (122, 90, 60), (150, 114, 78)]
def churned(X, Y):
    n = pn(X, Y, 6, 321); r = _hash(X, Y, 322)
    c = DIRT[1] if n < .38 else (DIRT[2] if n < .78 else DIRT[3])
    if r < .1: c = DIRT[0]
    elif r > .94: c = DIRT[4]
    return c
mk_floor('gy_dirt', churned)

def crypt_slab(X, Y):
    return flagp(X, Y, 331, mix(ST[4], ST[3], .35), ST[2])
mk_floor('cr_slab', crypt_slab)

def crypt_cracked(X, Y):
    c = crypt_slab(X, Y)
    cr = pn(X, Y, 6, 341)
    if .485 < cr < .505 and _hash(X, Y, 343) < .8: c = ST[1]
    if pn(X, Y, 4, 342) > .8: c = mix(c, (60, 92, 56), .55)                  # 이끼
    return c
mk_floor('cr_cracked', crypt_cracked)

def crypt_band(X, Y):
    c = crypt_slab(X, Y)
    if Y % 48 in (23, 24): c = mix(c, DK, .5)
    return c
mk_floor('cr_band', crypt_band)

# ------------------------------------------------------------------ 벽 앞면 (스타일 추가)
dlib.FACE_BASE['crypt'] = mix(ST[1], ST[2], .25)
dlib.FACE_BASE['cemwall'] = mix(ST[2], ST[3], .55)
_orig_face = dlib.face_px
def _face_px(style, X, Y, H, seed, capL, capR):
    if style not in ('crypt', 'cemwall'): return _orig_face(style, X, Y, H, seed, capL, capR)
    base = dlib.FACE_BASE[style]
    c = dlib.ash(X, Y, seed, base, mul(base, .55), bw=16, bh=8, k=1.0)
    if style == 'crypt':
        c = mul(c, .9)
        if vnoise(X, Y, 4, seed + 30) > .78: c = mix(c, (96, 112, 96), .3)
        # 아래로 갈수록 젖은 이끼
        wet = max(0.0, (Y - (H - 20)) / 20.0)
        if wet > .3 and vnoise(X * 1.3, Y * 2, 3, seed + 20) > .78 - .1 * wet: c = mix(c, LF[1], .5)
    else:
        if vnoise(X, Y, 3.5, seed + 33) > .76: c = mix(c, LF[2], .45)
        if Y < 4 and Y >= 1: c = mix(c, ST[4], .3)
    if Y == 0: c = ST[5] if style == 'cemwall' else ST[4]
    elif Y == 1: c = mix(c, ST[5], .35)
    elif Y == 2: c = mul(c, .76)
    elif Y == 3: c = mul(c, .88)
    if Y == H - 1: c = DK
    elif Y == H - 2: c = mul(c, .5)
    elif Y == H - 3: c = mul(c, .8)
    if capL and X % 16 == 0: c = mix(c, ST[5], .35)
    if capL and X % 16 == 1: c = mix(c, ST[5], .12)
    if capR and X % 16 == 15: c = mul(c, .55)
    if capR and X % 16 == 14: c = mul(c, .8)
    return c
dlib.face_px = _face_px

def face_sample(style, w, h):
    from dcheck import compose
    return compose(w, h, lambda i, j: dlib.face_tile(style, None, j, int(_hash(i + 3, j, 3) * 6), i == 0, i == w - 1, h * T))

def floor_sample(kind, w=3, h=3):
    return SAMPLES[kind].copy()
def compose_(cols, rows, fn):
    im = new(cols * T, rows * T)
    for j in range(rows):
        for i in range(cols): im.alpha_composite(fn(i, j), (i * T, j * T))
    return im

def ceiling_sample(**kw):
    def cf(i, j):
        o8 = (j > 0, i < 2, j < 2, i > 0, j > 0 and i < 2, j < 2 and i < 2, j < 2 and i > 0, j > 0 and i > 0)
        return dlib.ceiling((False,) * 8 if (i == 1 and j == 1) else o8, i + j, False, kw.get('pal'))
    return compose_(3, 3, cf)

# ------------------------------------------------------------------ 오토타일 시트를 지도에 쓰기
def autotile_mask(cells, x, y):
    return (1 if (x, y - 1) in cells else 0) | (2 if (x + 1, y) in cells else 0) | (4 if (x, y + 1) in cells else 0) | (8 if (x - 1, y) in cells else 0)
def atile_img(sheet, m): return sheet.crop((m % 4 * T, m // 4 * T, m % 4 * T + T, m // 4 * T + T))

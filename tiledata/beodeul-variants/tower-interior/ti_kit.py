# 탑 내부·계단 던전(tower-interior) 공용 재료.
# graveyard-crypt 의 gc_kit/gc_ext/gc_map/gc_page(웨이브 B 공용 도우미)를 읽기만 하고, 버들항 성(castle6)의 밝은 마름돌(ash)·
# 아치 창·방패·깃발 그리기 함수를 그대로 가져다 쓴다. 새 재료(밝은 회색 탑 판석·홀 마름모 타일·꼭대기 별 모자이크·기계실 쇠판)는
# 버들항 돌 램프 ST(0 윤곽 .. 6 밝음)·쇠 램프 IRON 같은 7단 규칙으로 칠한다. 3/4 시점, 빛 왼쪽 위, 1칸 = 16px.
import os, sys, math
HERE0 = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE0, '..', 'graveyard-crypt'))
from gc_kit import *                                   # noqa  (T, ST, WD, GD, PL, DK, Cv, Mk, vol, new, mk, mix, mul, pz, fin, Kit …)
from gc_kit import _hash, _pn1
import gc_ext, gc_map, gc_page
from gc_ext import SAMPLES, mk_floor, flagp, autotile_mask, atile_img, compose_
from gc_map import KMap, foot
import dlib
HERE = HERE0
CITY = os.path.abspath(os.path.join(HERE0, '..', '..', '..', 'scripts', 'content', 'lib', 'city_v6'))
if CITY not in sys.path: sys.path.insert(0, CITY)
import castle6 as C6                                   # 버들항 성 마름돌·아치 창·방패
import roman as RM                                     # 버들항 깃발(banner_hanging)

SL = C6.SL          # 버들항 성 지붕 슬레이트 보라 램프(0 윤곽 .. 6 밝음) — 카펫·깃발·천
GL = C6.GL          # 버들항 창유리(청록) 4단
GLD = C6.GOLD       # 버들항 금(7단)
CRM = C6.CRM        # 버들항 회벽·크림
IR = IRON           # 쇠 6단(dprops)
BR = [(40, 24, 12), (86, 52, 18), (138, 88, 26), (184, 128, 40), (222, 174, 70), (246, 220, 130), (255, 244, 196)]   # 놋쇠 7단
SKY = [(96, 140, 196), (120, 164, 214), (148, 188, 226), (178, 208, 234), (214, 230, 244), (240, 246, 252)]
BL = [(14, 20, 44), (26, 40, 88), (40, 64, 130), (64, 100, 170), (104, 146, 206), (160, 196, 236), (214, 234, 252)]  # 푸른 수정·마력

# ------------------------------------------------------------------ 바닥 (48x48 주기 표본: 3x3 칸을 이어 붙여도 이음새 없음)
def tower_flag(X, Y):
    """밝은 회색 탑 판석: 24x16 마름돌을 줄마다 반장 어긋나게. 줄눈 ST3, 돌마다 톤이 다르고 위·왼쪽 모서리가 밝다, 점·긁힌 자국."""
    row = Y // 16; ly = Y % 16; off = (row % 2) * 12
    xx = (X + off) % 48; col = xx // 24; lx = xx % 24
    if ly == 15 or lx == 23: return ST[3]
    h = _hash(col, row, 501)
    base = mix(mix(ST[4], ST[5], .38), C6.WARM, .12) if h < .45 else (mix(mix(ST[4], ST[5], .2), C6.WARM, .1) if h < .78 else mix(ST[4], C6.WARM, .34))
    c = base
    if ly == 0 or lx == 0: c = mix(base, ST[6], .45)
    elif ly == 14 or lx == 22: c = mix(base, ST[3], .45)
    else:
        r = _hash(X, Y, 502)
        if r < .045: c = mix(base, ST[3], .55)                   # 점(작은 구멍)
        elif r > .972: c = mix(base, ST[6], .55)
        if pn(X, Y, 6, 503) > .79: c = mix(c, ST[3], .16)        # 닳은 얼룩(돌 한 단 아래)
        # 드문 가는 금: 돌마다 시작점·기울기·길이가 다르다(열 장 중 한 장꼴)
        hc = _hash(col, row, 504)
        if hc < .12:
            x0c = 3 + int(_hash(col, row, 505) * 16); y0c = 3 + int(_hash(col, row, 506) * 6)
            slope = (-1 if _hash(col, row, 507) < .5 else 1)
            t = ly - y0c
            if 0 <= t < 3 + int(_hash(col, row, 508) * 5) and lx == x0c + slope * (t // 2): c = mix(base, ST[3], .55)
    return c
mk_floor('tw_flag', tower_flag)

def hall_tile(X, Y):
    """1층 홀: 큰 정사각 마름돌 두 톤 바둑판 + 모서리마다 슬레이트 보라 마름모 상감(버들항 성 지붕색)."""
    lx = X % 16; ly = Y % 16; cx = X // 16; cy = Y // 16
    dx = min(lx, 15 - lx); dy = min(ly, 15 - ly)
    if lx == 15 or ly == 15: c = ST[3]
    else:
        c = mix(ST[4], ST[5], .55) if (cx + cy) % 2 == 0 else mix(ST[4], ST[5], .18)
        if lx == 0 or ly == 0: c = mix(c, ST[6], .45)
        elif lx == 14 or ly == 14: c = mix(c, ST[3], .4)
        r = _hash(X, Y, 511)
        if r < .035: c = mix(c, ST[3], .5)
        elif r > .975: c = mix(c, ST[6], .5)
    # 네 판이 만나는 점에 마름모 상감(반지름 3)
    ex = (X + 1) % 16; ey = (Y + 1) % 16
    ddx = min(ex, 16 - ex); ddy = min(ey, 16 - ey)
    if ddx + ddy <= 2 and (int(round((X + 1) / 16.0)) + int(round((Y + 1) / 16.0))) % 3 == 0:
        c = SL[4] if ddx + ddy == 1 else SL[2]
        if ddx + ddy == 0: c = SL[5]
    return c
mk_floor('tw_hall', hall_tile)

def summit_mosaic(X, Y):
    """꼭대기 방: 작은 마름돌(12x12) 판에 금빛 줄눈 띠가 섞인 바닥. 판석보다 따뜻하고 결이 잘다."""
    lx = X % 12; ly = Y % 12; cx = X // 12; cy = Y // 12
    if lx == 11 or ly == 11:
        return mix(ST[3], GLD[3], .25)
    h = _hash(cx % 4, cy % 4, 521)
    c = mix(ST[4], CRM[4], .25) if h < .5 else (mix(ST[4], ST[5], .4) if h < .8 else mix(ST[4], CRM[3], .35))
    if lx == 0 or ly == 0: c = mix(c, ST[6], .4)
    elif lx == 10 or ly == 10: c = mix(c, ST[3], .35)
    r = _hash(X, Y, 522)
    if r < .04: c = mix(c, ST[3], .5)
    elif r > .975: c = mix(c, ST[6], .5)
    # 4판마다 가운데 작은 금 점
    if (cx % 4 == 1 and cy % 4 == 1 or cx % 4 == 3 and cy % 4 == 3) and lx in (5, 6) and ly in (5, 6): c = GLD[4] if lx == 5 and ly == 5 else GLD[3]
    return c
mk_floor('tw_mosaic', summit_mosaic)

def iron_plate(X, Y):
    """기계실: 리벳 박은 쇠판(24x16) + 판 사이 홈. 쇠 램프 6단, 기름 얼룩."""
    row = Y // 16; ly = Y % 16; off = (row % 2) * 12
    xx = (X + off) % 48; col = xx // 24; lx = xx % 24
    if ly == 15 or lx == 23: return IR[1]
    h = _hash(col, row, 531)
    c = IR[3] if h < .5 else mix(IR[3], IR[4], .35)
    if ly == 0 or lx == 0: c = IR[4] if h < .5 else mix(IR[4], IR[5], .4)
    elif ly == 14 or lx == 22: c = IR[2]
    # 체크 무늬 미끄럼 방지 돌기(사선)
    elif (lx + ly) % 6 == 0 and (lx - ly) % 4 == 0: c = mix(c, IR[5], .55)
    elif (lx + ly) % 6 == 1 and (lx - ly) % 4 == 1: c = mix(c, IR[1], .45)
    if (lx in (2, 20)) and (ly in (2, 12)): c = IR[5]                       # 리벳
    if (lx in (3, 21)) and (ly in (3, 13)): c = IR[1]
    if pn(X, Y, 8, 533) > .8: c = mix(c, (52, 44, 34), .35)                  # 기름 얼룩
    return c
mk_floor('tw_iron', iron_plate)

# 서재 바닥은 버들항 널(dlib 'plank')을 그대로 쓴다(새로 내보내지 않음).

# ------------------------------------------------------------------ 벽 앞면: 버들항 성 마름돌(castle6.ash)을 한 단 어둡게 + 아래 걸레받이 띠
dlib.FACE_BASE['tower'] = mix(ST[4], ST[5], .3)
_prev_face = dlib.face_px
def _face_px(style, X, Y, H, seed, capL, capR):
    if style != 'tower': return _prev_face(style, X, Y, H, seed, capL, capR)
    c = C6.ash(X, Y + 3, k=.7, seed=seed)                               # 버들항 밝은 마름돌, 실내라 두 단 어둡게(바닥보다 어둡다)
    if vnoise(X, Y, 5, seed + 61) > .82: c = mix(c, ST[3], .18)         # 묵은 얼룩
    if Y >= H - 9 and Y < H - 3:                                        # 걸레받이(굵은 받침돌 한 줄)
        lyy = Y - (H - 9)
        c = C6.ash(X, lyy, k=.58, bw=24, bh=6, seed=seed + 5)
        if lyy == 0: c = mix(ST[5], ST[6], .3)
    if Y == 0: c = ST[5]
    elif Y == 1: c = mix(c, ST[5], .35)
    elif Y == 2: c = mul(c, .72)
    elif Y == 3: c = mul(c, .84)
    elif Y == 4: c = mul(c, .93)
    if Y == H - 1: c = DK
    elif Y == H - 2: c = mul(c, .5)
    elif Y == H - 3: c = mul(c, .78)
    if capL and X % 16 == 0: c = mix(c, ST[6], .35)
    if capL and X % 16 == 1: c = mix(c, ST[6], .12)
    if capR and X % 16 == 15: c = mul(c, .55)
    if capR and X % 16 == 14: c = mul(c, .8)
    return c
dlib.face_px = _face_px

def face_sample(style, w, h):
    return compose_(w, h, lambda i, j: dlib.face_tile(style, None, j, int(_hash(i + 3, j, 3) * 6), i == 0, i == w - 1, h * T))

def ceiling_sample():
    def cf(i, j):
        o8 = (j > 0, i < 2, j < 2, i > 0, j > 0 and i < 2, j < 2 and i < 2, j < 2 and i > 0, j > 0 and i > 0)
        return dlib.ceiling((False,) * 8 if (i == 1 and j == 1) else o8, i + j, False)
    return compose_(3, 3, cf)

# ------------------------------------------------------------------ 작은 도우미
def cyl_k(x, x0, x1):
    """원통 6단 명암(빛 왼쪽 위): 왼쪽 끝 반사 -> 밝음 -> 오른쪽 그늘 -> 반사광 한 줄."""
    t = (x + .5 - x0) / float(x1 - x0)
    if t < .1: return 4
    if t < .26: return 6
    if t < .42: return 5
    if t < .62: return 4
    if t < .8: return 3
    if t < .93: return 2
    return 3

def topell(cv, cx, cy, rx, ry, ramp, k_hi=6, k_lo=4, seed=0):
    """3/4 윗면 타원: 왼쪽 위 밝고, 테두리 한 단 어둡다."""
    for y in range(int(cy - ry - 1), int(cy + ry + 2)):
        for x in range(int(cx - rx - 1), int(cx + rx + 2)):
            dx = (x + .5 - cx) / rx; dy = (y + .5 - cy) / ry
            d = dx * dx + dy * dy
            if d > 1: continue
            k = k_hi if (dx < -.25 and dy < .2) else k_hi - 1
            if d > .62: k = k_lo if dy < .2 else k_lo - 1
            if _hash(x, y, seed + 9) < .05: k -= 1
            cv.px(x, y, ramp[clamp(k, 0, len(ramp) - 1)])

def stone_box(cv, x0, y0, x1, y1, top, ramp=ST, seed=0, k0=0):
    """3/4 돌 상자: 윗면 top 행(밝음) + 앞면(왼쪽 밝고 오른쪽 어둡다, 맨 아래 한 줄 윤곽 쪽)."""
    for y in range(y0, y1):
        for x in range(x0, x1):
            if y < y0 + top:
                k = 6 if (y == y0 or x == x0) else 5
                if x >= x1 - 1: k = 4
            else:
                k = 5 if x < x0 + 2 else (4 if x < x1 - 3 else 3)
                if y == y0 + top: k -= 1
                if y >= y1 - 1: k = 2
            if _hash(x, y, seed + 4) < .06: k += 1 if _hash(y, x, seed + 5) < .5 else -1
            cv.px(x, y, ramp[clamp(k + k0, 1, len(ramp) - 1)])

def light_alpha(im, color, a):
    """반투명 빛: 그림의 칠해진 화소를 color, 알파 a 로."""
    o = new(im.width, im.height); p = o.load(); q = im.load()
    for y in range(im.height):
        for x in range(im.width):
            if q[x, y][3]: p[x, y] = tuple(color) + (a,)
    return o

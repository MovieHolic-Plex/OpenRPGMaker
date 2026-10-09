# 최종 탑(final-tower) 공용 바탕.
#  - 지도·조각 등록·벽 앞면·천장·바닥 표본 틀: graveyard-crypt 의 gc_kit/gc_ext/gc_map (탑 내부·마왕성과 같은 틀)을 읽기만 한다.
#  - 기계 재질: 미래 폐허(future-ruins)의 「기계 재질 규약」 톤 캔버스(fr_mat.TC)·판 줄눈·리벳·녹 번짐·관·전선을 그대로 쓴다.
#  - 허공: 시간의 틈(time-rift)의 허공 램프·성운·별(tr_void.void_image)을 그대로 쓴다.
#  - 새 재료(탑 청보라 돌·뼈·추상 유기 덩이·발광 보라)만 같은 7단 램프 규칙(0 = 색 윤곽, 1~6 = 밝기)으로 더한다.
# 3/4 시점(윗면 + 앞면, 옆면 없음), 빛 왼쪽 위, 1칸 = 16px. 결정적(같은 입력 = 같은 그림). 생성 이미지·트레이싱 없음.
import os, sys, math
HERE = os.path.dirname(os.path.abspath(__file__))
VAR = os.path.abspath(os.path.join(HERE, '..'))
for sub in ('graveyard-crypt', 'future-ruins', 'time-rift'):
    p = os.path.join(VAR, sub)
    if p not in sys.path: sys.path.append(p)
sys.path.insert(0, HERE)
from gc_kit import *                                   # noqa  (T, ST, PL, DK, Cv, Kit, mix, mul, hx, new, mk, pz, fin, pn, autotile_sheet …)
from gc_kit import _hash, _pn1
import gc_ext
from gc_ext import SAMPLES, mk_floor, flagp, autotile_mask, atile_img, compose_
from gc_map import KMap, foot
import dlib
from dlib import vnoise
import numpy as np
from PIL import Image, ImageDraw
import fr_base as FB
import fr_mat as FM
from fr_mat import TC, panels, rustify, pipe_h, pipe_v, cyl_k, cable, box, glass_pane, hazard
import tr_void as TV
HERE = os.path.dirname(os.path.abspath(__file__))      # gc_kit 가 덮어쓴 HERE 를 다시 고정

def _r(*cs): return [hx(c) for c in cs]
STEEL = FB.STEEL; RUST = FB.RUST; BRASS = FB.BRASS; GLASS = FB.GLASS; CABLE = FB.CABLE; CYAN = FB.SIGNAL['cyan']
# ---------------------------------------------------------------- 새 재료 7단 램프 (0 윤곽 · 1 가장 어두움 … 6 빛)
FT = _r('#0e0e1e', '#181a30', '#242844', '#34395c', '#4a5178', '#666e96', '#8c93b6')     # 탑 돌(청보라): 벽·바닥·단
BONE = _r('#1c1428', '#3e3040', '#6a5c62', '#958676', '#bcae98', '#dcd0b6', '#f4ecd8')   # 뼈(상아, 그늘은 식은 보라)
FLESH = _r('#160610', '#300c1e', '#4e142c', '#6c1e3a', '#8a2c48', '#a8445a', '#c46a74')  # 검붉은 유기 덩이(추상, 눈·얼굴 없음)
VIOL = _r('#160a2c', '#30145e', '#52229a', '#7c38cc', '#a866ea', '#d4a6f8', '#faefff')   # 발광 보라(시간의 틈 gviol 과 같다)
VOIDR = TV.VOID                                                                            # 허공 남색(시간의 틈)

# 톤 캔버스(fr_mat.TC)에 새 재질을 더한다 — fr_mat 의 재질 표·LUT 를 늘린다(파일은 건드리지 않는다).
for name, ramp in (('bone', BONE), ('flesh', FLESH), ('ftst', FT), ('viol', VIOL)):
    if name not in FM.MID:
        FM.MATS.append(name); FM.MID[name] = len(FM.MATS) - 1; FM.RAMP_OF[name] = ramp
_L = np.zeros((len(FM.MATS), 7, 3), np.uint8)
for n, i in FM.MID.items():
    if n in FM.RAMP_OF:
        r = FM.RAMP_OF[n]
        for k in range(7): _L[i, k] = r[min(k, len(r) - 1)]
FM.LUT = _L

def clamp(k, lo=1, hi=6): return max(lo, min(hi, int(k)))
def rc(r, k): return r[max(0, min(len(r) - 1, int(round(k))))]
BAYER = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16.0

# ================================================================ 바닥 표본 (48x48 주기, 3x3 이음새 없음)
def ft_slab(X, Y):
    """탑 판석: 청보라 돌 판석(gc_ext.flagp 줄마다 어긋난 마디), 드물게 뼛가루 점·발광 티끌."""
    c = flagp(X, Y, 611, mix(FT[3], FT[4], .45), FT[1])
    if pn(X, Y, 6, 612) > .8: c = mix(c, FT[2], .3)                       # 닳은 얼룩(한 단 아래)
    h = _hash(X, Y, 613)
    if h > .9975: c = BONE[3]                                             # 뼛가루 점(드물게)
    elif h < .0012: c = VIOL[4]                                           # 발광 티끌(아주 드물게)
    return c
mk_floor('ft_slab', ft_slab)

def ft_plate(X, Y):
    """강철 갑판: 16x16 강철판(기계 재질 규약 — 아래·오른쪽 1px 홈 톤 1, 위·왼쪽 1px +1, 모서리 2px 안 리벳),
    판마다 톤 ±1(12%), 긁힌 자국·옅은 녹. 미래 폐허 강철판보다 한 단 어둡고 차다(탑 안)."""
    lx = X % 16; ly = Y % 16; col = X // 16; row = Y // 16
    h = _hash(col % 3, row % 3, 621)
    k = 3 + (1 if h > .88 else (-1 if h < .1 else 0))
    if ly == 15 or lx == 15: k = 1
    elif ly == 0 or lx == 0: k += 1
    elif ly == 14 or lx == 14: k -= 1
    if lx in (2, 13) and ly in (2, 13): k = 5
    elif lx in (3, 14) and ly in (3, 14): k = 1
    elif (lx + ly * 3) % 11 == 0 and 4 < lx < 12 and 5 < ly < 11 and h > .5: k -= 1      # 미끄럼 돌기 자국
    if _hash(X, Y, 622) < .03: k += 1
    c = STEEL[clamp(k, 0, 6)]
    if pn(X, Y, 6, 623) > .79 and k >= 2: c = mix(c, RUST[3], .32)       # 옅은 녹
    if 3 < ly < 12 and lx > 3 and lx < 12 and _hash(col % 3, row % 3, 624) < .25 and (lx - ly) == int(_hash(col % 3, row % 3, 625) * 4): c = mix(c, STEEL[5], .4)   # 긁힘
    return c
mk_floor('ft_plate', ft_plate)

def ft_grate(X, Y):
    """격자 바닥: 강철 틀(16 칸) 안 가로 살 3px 간격, 살 사이 깊은 어둠에 드물게 청록 빛(아래층 기계)."""
    lx = X % 16; ly = Y % 16
    if lx in (0, 15) or ly in (0, 15):
        k = 4 if (lx == 0 or ly == 0) else 1
        if lx in (0, 15) and ly in (0, 15): k = 2
        return STEEL[k]
    if ly % 3 == 1: return STEEL[4] if lx < 14 else STEEL[3]                 # 살 윗면
    if ly % 3 == 2: return STEEL[2]                                       # 살 앞 모
    depth = pn(X, Y, 12, 631)
    if depth > .72 and _hash(X, Y, 632) < .55: return CYAN[1] if _hash(X, Y, 633) < .8 else CYAN[2]
    return (8, 10, 18)
mk_floor('ft_grate', ft_grate)

def ft_core(X, Y):
    """핵 방 바닥: 24x24 짙은 청보라 판(윤나는 사선 반사), 48 마다 판 이음에 가는 보라 빛 상감과 교차점 빛 점."""
    lx = X % 24; ly = Y % 24; bx = X // 24; by = Y // 24
    if lx == 23 or ly == 23:
        ex_ = min((X + 1) % 48, 48 - (X + 1) % 48); ey_ = min((Y + 1) % 48, 48 - (Y + 1) % 48)
        glow_seam = ((X % 48 == 47) and ey_ < 3) or ((Y % 48 == 47) and ex_ < 3)   # 교차점 둘레 아주 짧은 빛 상감
        if glow_seam: return VIOL[2]
        return FT[1]
    hh = _hash(bx, by, 641)
    c = mix(FT[3], FT[4], .25 + .45 * hh)
    if lx == 0 or ly == 0: c = mix(c, FT[5], .45)
    elif lx == 22 or ly == 22: c = mix(c, FT[2], .5)
    if (lx + ly) % 24 in (5, 6) and hh < .65 and 2 < lx < 21: c = mix(c, FT[5], .4)      # 윤나는 사선 반사
    if _hash(X, Y, 642) < .035: c = mix(c, FT[2], .6)
    elif _hash(X, Y, 643) > .985: c = mix(c, FT[6], .5)
    ex = (X + 1) % 48; ey = (Y + 1) % 48
    if min(ex, 48 - ex) + min(ey, 48 - ey) == 0: c = VIOL[4]               # 교차점 빛 점
    return c
mk_floor('ft_core', ft_core)

# ================================================================ 벽 앞면 (dlib.face_px 에 스타일 둘을 끼운다)
dlib.FACE_BASE['ftstone'] = mix(FT[1], FT[2], .55)
dlib.FACE_BASE['ftmech'] = STEEL[2]
_prev_face = dlib.face_px
def _face_cap(c, X, Y, H, capL, capR, top):
    if Y == 0: c = top
    elif Y == 1: c = mix(c, top, .35)
    elif Y == 2: c = mul(c, .74)
    elif Y == 3: c = mul(c, .86)
    elif Y == 4: c = mul(c, .94)
    if Y == H - 1: c = FT[0]
    elif Y == H - 2: c = mul(c, .5)
    elif Y == H - 3: c = mul(c, .78)
    if capL and X % 16 == 0: c = mix(c, top, .35)
    if capL and X % 16 == 1: c = mix(c, top, .12)
    if capR and X % 16 == 15: c = mul(c, .55)
    if capR and X % 16 == 14: c = mul(c, .8)
    return c

def _face_px(style, X, Y, H, seed, capL, capR):
    if style == 'ftstone':
        row = Y // 8; off = (row % 2) * 8; col = (X + off) // 16
        lx = (X + off) % 16; ly = Y % 8
        hb = _hash(col, row, seed + 41)
        c = mix(FT[2], FT[3], .55) if hb < .5 else (FT[3] if hb < .8 else mix(FT[1], FT[2], .6))   # 마름돌마다 톤(청보라 램프 안에서만)
        if ly == 0 or lx == 0: c = mix(c, FT[4], .4)
        elif ly == 6 or lx == 14: c = mix(c, FT[1], .3)
        r_ = _hash(X, Y, seed + 43)
        if r_ < .04: c = mix(c, FT[4], .5)
        elif r_ > .97: c = mix(c, FT[1], .6)
        if ly == 7 or lx == 15: c = FT[1]
        if (ly == 7 or lx == 15) and _hash(col, row, seed + 91) < .07 and 6 < Y < H - 10:      # 줄눈에 새는 보라 빛
            c = VIOL[3] if _hash(X, Y, 92) < .7 else VIOL[4]
        if vnoise(X, Y, 4, seed + 93) > .8: c = mix(c, FT[0], .25)       # 묵은 그을음
        if H - 9 <= Y < H - 3:                                           # 강철 걸레받이 띠(리벳)
            yy = Y - (H - 9)
            c = STEEL[3] if yy > 0 else STEEL[5]
            if yy == 5: c = STEEL[1]
            if X % 12 == 4 and yy == 2: c = STEEL[6]
            if X % 12 == 5 and yy == 3: c = STEEL[1]
            if pn(X, Y, 5, seed + 94) > .78 and 0 < yy < 5: c = mix(c, RUST[3], .45)
        return _face_cap(c, X, Y, H, capL, capR, FT[5])
    if style == 'ftmech':
        pw, ph = 32, 16
        row = Y // ph; off = (row % 2) * 16; lx = (X + off) % pw; ly = Y % ph; col = (X + off) // pw
        h = _hash(col, row, seed + 81)
        k = 3 + (1 if h > .85 else (-1 if h < .2 else 0))
        if ly == ph - 1 or lx == pw - 1: k = 1
        elif ly == 0 or lx == 0: k += 1
        elif ly == ph - 2 or lx == pw - 2: k -= 1
        rv = (ly in (2, 13) and (lx in (2, 29) or (lx % 6 == 2 and lx < 29)))
        if rv: k = 6
        elif ly in (3, 14) and (lx in (3, 30) or (lx % 6 == 3 and lx < 30)): k = 1
        c = STEEL[clamp(k, 0, 6)]
        if k >= 2 and not rv:                                            # 리벳 밑 녹물 줄(아래로 흐름)
            if ly > 3 and lx % 6 == 2 and _hash(col * 7 + lx, row, seed + 82) < .22 and ly < 3 + 2 + int(_hash(lx, row, seed + 83) * 9):
                c = mix(c, RUST[3], .7)
            elif pn(X, Y, 6, seed + 84) > .8: c = mix(c, RUST[2], .45)
        if H - 7 <= Y < H - 3: c = STEEL[2] if Y > H - 7 else STEEL[4]   # 바닥 턱
        return _face_cap(c, X, Y, H, capL, capR, STEEL[5])
    return _prev_face(style, X, Y, H, seed, capL, capR)
dlib.face_px = _face_px

def face_sample(style, w, h):
    return compose_(w, h, lambda i, j: dlib.face_tile(style, None, j, int(_hash(i + 3, j, 3) * 6), i == 0, i == w - 1, h * T))

# ================================================================ 천장 (버들항 던전 천장 dlib.ceiling 을 청보라로 다시 칠한다)
def recolor(im, ramp, lo=14, hi=220):
    a = np.array(im).astype(float); L = a[..., 0] * .3 + a[..., 1] * .59 + a[..., 2] * .11
    t = np.clip((L - lo) / (hi - lo), 0, 1) * (len(ramp) - 1); i = np.floor(t).astype(int); f = t - i
    R = np.array(ramp, float); i2 = np.minimum(i + 1, len(ramp) - 1)
    rgb = R[i] * (1 - f[..., None]) + R[i2] * f[..., None]
    out = a.copy(); out[..., :3] = rgb
    return Image.fromarray(out.astype(np.uint8), 'RGBA')

CEIL_RAMP = [(8, 8, 18), (14, 14, 28), FT[1], FT[2], FT[3], FT[4], FT[5]]
def ft_ceiling(open8, seed):
    key = ('ftceil', open8, seed % 4)
    if key not in dlib._fl_cache: dlib._fl_cache[key] = recolor(dlib.ceiling(open8, seed, False), CEIL_RAMP)
    return dlib._fl_cache[key]

def ceiling_sample():
    def cf(i, j):
        o8 = (j > 0, i < 2, j < 2, i > 0, j > 0 and i < 2, j < 2 and i < 2, j < 2 and i > 0, j > 0 and i > 0)
        return ft_ceiling((False,) * 8 if (i == 1 and j == 1) else o8, i + j)
    return compose_(3, 3, cf)

# ================================================================ 작은 도우미
def tc_fin(tc, k=.6, shadow=None):
    im = pz.fin(tc.img(), k)
    if shadow: im = shadow_under(im, *shadow)
    return im

def glow_img(w, h, cx, cy, rx, ry, color, amax=110, steps=4):
    """단계 알파 빛 번짐(바이어 디더) — 투명 그림."""
    Y, X = np.mgrid[0:h, 0:w]
    d = np.sqrt(((X + .5 - cx) / rx) ** 2 + ((Y + .5 - cy) / ry) ** 2)
    v = np.clip(1 - d, 0, 1)
    b = np.tile(BAYER, (h // 4 + 1, w // 4 + 1))[:h, :w]
    q = np.floor(v * steps + b * .999) / steps
    arr = np.zeros((h, w, 4), np.uint8); arr[..., :3] = color[:3]; arr[..., 3] = (q * amax).astype(np.uint8)
    return Image.fromarray(arr, 'RGBA')

def flipx(im): return im.transpose(Image.FLIP_LEFT_RIGHT)

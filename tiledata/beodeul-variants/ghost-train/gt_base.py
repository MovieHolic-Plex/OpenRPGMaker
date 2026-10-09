# 유령 열차(ghost-train) 공용 바탕.
# 버들항 파이프라인을 읽기만 한다:
#   야외 = _lib-5/bd5.Scene(칩셋 풀 섞기 ground.render · 칩셋 참나무/덤불 · 흙길 오토타일 · 깊은 숲 전나무 parts5)
#   기계 재질 = future-ruins fr_base/fr_mat 의 톤 캔버스(TC)·강철판·관·리벳 규약(plan.md 「기계 재질 규약」)
#   목재·놋쇠·실내 = airship as_kit(버들항 나무 램프 terrain.WD, 칩셋 널판 결 grain(), 놋쇠 BR, 천장 띠)
# 이 장소에만 필요한 재료(푸른 유령불, 안개, 객차 외판 니스칠 목재)만 같은 7단 규칙(0 윤곽, 1..6 밝기, 빛 왼쪽 위)으로 더한다.
# 공용 파일은 고치지 않는다 — 램프 추가·면 스타일 추가는 이 모듈이 실행 중에 끼운다. 다시 돌리면 같은 그림.
import os, sys, math, json
HERE = os.path.dirname(os.path.abspath(__file__))
VAR = os.path.abspath(os.path.join(HERE, '..'))
ROOT = os.path.abspath(os.path.join(VAR, '..', '..'))
for p in ('airship', 'future-ruins', '_lib-5'):
    q = os.path.join(VAR, p)
    if q not in sys.path: sys.path.insert(0, q)
if HERE not in sys.path: sys.path.insert(0, HERE)
import numpy as np
from PIL import Image, ImageDraw
import as_kit as AK                      # noqa  (WD, BR, IR, I7, MAH, CNV, ROPE, grain, wbox, vcyl, hcyl, barrel, ...)
import fr_base as FB
import fr_mat as FM
import bd5 as B5
import parts5 as P5
import pz, terrain
from px2 import _hash, vnoise

T = 16
WD, BR, MAH, ST, DK, LF, RD, PL, GD = AK.WD, AK.BR, AK.MAH, AK.ST, AK.DK, AK.LF, AK.RD, AK.PL, AK.GD
I7 = AK.I7
SL = AK.SL
GL = AK.GL
STEEL, BRASS, RUST, GLASS, CABLE = FB.STEEL, FB.BRASS, FB.RUST, FB.GLASS, FB.CABLE
SIG = FB.SIGNAL
mix, mul, clamp, new, mk = AK.mix, AK.mul, AK.clamp, AK.new, AK.mk

def hx(s): s = s.lstrip('#'); return tuple(int(s[i:i + 2], 16) for i in (0, 2, 4))
def R(*cs): return [hx(c) for c in cs]

# ---------------------------------------------------------------- 새 재질 7단 (0 윤곽 .. 6 빛)
GHOST = R('#060a1e', '#0e1c46', '#183a82', '#2e6ac4', '#5ea2ec', '#a6d6ff', '#eef8ff')     # 푸른 유령불
SPIRIT = R('#141c2c', '#2a3a52', '#46607e', '#6a88a8', '#94b2cc', '#c0d8ea', '#e8f4fc')    # 창 속 인영(희미한 청회)
VARN = R('#1b1024', '#2a1610', '#3e2214', '#56301a', '#6e4224', '#88582e', '#a8743e')      # 니스칠 객차 외판(버들항 나무를 한 단 붉게·짙게)
GREEN = R('#0c1614', '#16261e', '#223a2a', '#2e4c36', '#3e6244', '#567c56', '#7c9c72')     # 바랜 짙은 초록 도장(객차 아래 띠·기관차 운전실)
SOOT = R('#08080c', '#121218', '#1c1c24', '#282832', '#363642', '#4a4a58', '#64647a')      # 그을린 쇠(보일러·굴뚝·연기 상자)
FOG = R('#2a3440', '#46525e', '#66727e', '#8a96a0', '#acb6be', '#ccd4d8', '#e6eaee')       # 안개(반투명 덧그림 색)
COAL = AK.COAL
GRAVEL = R('#1e1e24', '#34333a', '#4a4850', '#625e62', '#7e7874', '#9c958c', '#bdb4a6')    # 자갈(칩셋 돌 결을 따뜻한 회색으로)

# fr_mat 톤 캔버스에 새 재질을 더한다(공용 파일은 그대로, 이 프로세스 안에서만).
for _n, _r in (('ghost', GHOST), ('spirit', SPIRIT), ('varn', VARN), ('green', GREEN), ('soot', SOOT), ('mahog', MAH),
               ('fogc', FOG), ('gravel', GRAVEL), ('slate', SL), ('coal', [COAL[0]] + COAL)):
    if _n not in FM.MID:
        FM.MATS.append(_n); FM.MID[_n] = len(FM.MATS) - 1; FM.RAMP_OF[_n] = _r
FM.LUT = np.zeros((len(FM.MATS), 7, 3), np.uint8)
for _n, _i in FM.MID.items():
    if _n in FM.RAMP_OF:
        _r = FM.RAMP_OF[_n]
        for _k in range(7): FM.LUT[_i, _k] = _r[min(_k, len(_r) - 1)]
TC = FM.TC

# ---------------------------------------------------------------- 작은 도우미
def pad16(im): return FB.pad16(im)
def flip(im): return im.transpose(Image.FLIP_LEFT_RIGHT)
def fin(im, k=.62): return pz.fin(im, k)

def glow(size, col, a=60, squash=1.0):
    """둥근 빛무리(가운데 진하고 바깥으로 옅다). squash < 1 이면 납작한 타원(바닥에 비친 빛)."""
    h = max(2, int(size * squash)); im = new(size, h); p = im.load()
    for y in range(h):
        for x in range(size):
            d = math.hypot((x + .5 - size / 2) / (size / 2), (y + .5 - h / 2) / (h / 2))
            if d < 1:
                al = int(a * (1 - d) ** 1.6)
                if al > 0: p[x, y] = tuple(col) + (al,)
    return im

def lit(cv_im, x, y, col, a):
    """한 점에 반투명 색을 얹는다."""
    p = cv_im.load()
    if 0 <= x < cv_im.width and 0 <= y < cv_im.height:
        r, g, b, al = p[x, y]
        if al:
            t = a / 255.0
            p[x, y] = (int(r + (col[0] - r) * t), int(g + (col[1] - g) * t), int(b + (col[2] - b) * t), al)

# ---------------------------------------------------------------- 야외 색 고르기(안개 낀 숲의 저녁): 맵에만 쓰고 조각은 원래 색
def ghost_grade(img, k=1.0, region=None):
    """초록을 청록 쪽으로 돌리고 채도·밝기를 낮춘 뒤 아주 옅은 청회 안개를 섞는다. 점·결(밝기 순서)은 그대로.
    region = (x0, y0, x1, y1) px 이면 그 안만."""
    a = np.array(img.convert('RGBA')).astype(np.float64)
    sub = a if region is None else a[region[1]:region[3], region[0]:region[2]]
    rgb = sub[..., :3] / 255.0
    mx = rgb.max(-1); mn = rgb.min(-1); v = mx; s = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
    # 색상(hue)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    d = np.maximum(mx - mn, 1e-6)
    h = np.where(mx == r, ((g - b) / d) % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) / 6.0
    green = (h > 0.15) & (h < 0.48) & (s > 0.18)
    h = np.where(green, h + 0.035 * k, h)
    s = s * np.where(green, 1 - 0.34 * k, 1 - 0.18 * k)
    v = v * (1 - 0.16 * k)
    # hsv -> rgb
    i = np.floor(h * 6).astype(int) % 6; f = h * 6 - np.floor(h * 6)
    p_ = v * (1 - s); q = v * (1 - f * s); t = v * (1 - (1 - f) * s)
    out = np.zeros_like(rgb)
    for idx, (rr, gg, bb) in enumerate(((v, t, p_), (q, v, p_), (p_, v, t), (p_, q, v), (t, p_, v), (v, p_, q))):
        m = i == idx
        out[..., 0] = np.where(m, rr, out[..., 0]); out[..., 1] = np.where(m, gg, out[..., 1]); out[..., 2] = np.where(m, bb, out[..., 2])
    haze = np.array(FOG[3]) / 255.0
    out = out * (1 - 0.10 * k) + haze * 0.10 * k
    sub[..., :3] = np.clip(np.rint(out * 255), 0, 255)
    return Image.fromarray(a.astype(np.uint8), 'RGBA')

def recolor_img(im, ramp, lo=1, hi=6):
    """그림의 밝기 순서를 그대로 둔 채 다른 램프로 옮긴다(칩셋 결 보존)."""
    a = np.array(im.convert('RGBA')); sel = a[..., 3] > 0
    if not sel.any(): return im.copy()
    L = 0.3 * a[..., 0] + 0.59 * a[..., 1] + 0.11 * a[..., 2]
    vals = np.unique(L[sel]); rank = np.searchsorted(vals, L) / max(1, len(vals) - 1)
    t = np.clip(np.rint(lo + rank * (hi - lo)), 0, 6).astype(int)
    rr = np.array(ramp, np.uint8)[t]
    a[..., :3] = np.where(sel[..., None], rr, a[..., :3])
    return Image.fromarray(a, 'RGBA')

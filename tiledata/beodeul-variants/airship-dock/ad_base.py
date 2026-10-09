# 비행선 정박 부두(airship-dock) 공용 바탕 — 장르 steampunk(tiledata/beodeul-kits/genres/steampunk.md).
# 버들항 파이프라인을 읽기만 한다:
#   칩셋 풀·흙·자갈·포석 결 = city_v6 ground.tex / terrain.CH (버들항 칩셋 그대로, 7단 팔레트)
#   기계 재질 = future-ruins fr_base·fr_mat 톤 캔버스(TC)·강철판·관·리벳 규약 (장르 규격 1항: BRASS·RUST·STEEL·WD·RD·ST)
#   구름 = sky-city sc_sky 덩이 구름(CL 램프·SK 하늘) · 16변형 가장자리 = airship as_blob.edge_taper
# 이 장소에만 필요한 재질(바랜 부두 널·기낭 천·석탄)만 같은 7단 규칙(0 윤곽, 1..6 밝기, 빛 왼쪽 위)으로 더한다.
# 공용·다른 장소 파일은 고치지 않는다(재질표 추가는 이 프로세스 안에서만). 다시 돌리면 같은 그림.
import os, sys, math, json
HERE = os.path.dirname(os.path.abspath(__file__))
VAR = os.path.abspath(os.path.join(HERE, '..'))
ROOT = os.path.abspath(os.path.join(VAR, '..', '..'))
for p in ('airship', 'future-ruins', 'sky-city', '_lib-5'):
    q = os.path.join(VAR, p)
    if q not in sys.path: sys.path.insert(0, q)
if HERE not in sys.path: sys.path.insert(0, HERE)
import numpy as np
from PIL import Image, ImageDraw
import as_kit as AK                       # noqa (WD, BR, I7, CNV, ROPE, COAL, grain, rope_line ...)
import as_blob as AB                      # edge_taper, hash2, tnoise, tnoise1, stamp, check_sheet
import fr_base as FB
import fr_mat as FM
from fr_mat import TC, panels, rustify, pipe_h, pipe_v, cable, box, glass_pane
import sc_sky as SKM
import sc_base as SCB
import pz, terrain, ground
from px2 import _hash, vnoise

T = 16
WD, ST, RD, PL, LF = FB.WD, FB.ST, FB.RD, FB.PL, FM.LEAF7
STEEL, BRASS, RUST, GLASS, CABLE = FB.STEEL, FB.BRASS, FB.RUST, FB.GLASS, FB.CABLE
AMBER = FB.SIGNAL['amber']
CL, SK = SCB.CL, SCB.SK
mix, mul, new, hx = FB.mix, FB.mul, FB.new, FB.hx
hash2, tnoise, tnoise1 = AB.hash2, AB.tnoise, AB.tnoise1
def clamp(k, lo=1, hi=6): return max(lo, min(hi, int(k)))
def R(*cs): return [hx(c) for c in cs]

# ---------------------------------------------------------------- 새 재질 7단 (0 윤곽 .. 6 빛)
CNV = R('#3a2828', '#685444', '#8e7a62', '#b09c7e', '#cab89a', '#e0d2b4', '#f2ead4')     # 기낭 천(바랜 아마포, 버들항 크림 쪽)
OCH = R('#2a1410', '#5a2a1a', '#7e4224', '#a05c30', '#bc7a44', '#d49c60', '#ead0a0')     # 기낭 덧댄 천(구리빛 황토)
ROPE = AK.ROPE
COAL = R('#08080c', '#14141a', '#202028', '#2e2e38', '#40404c', '#585866', '#7a7a88')
PLANK = R('#1b1024', '#2c2220', '#463830', '#5e4c3e', '#78644e', '#94805e', '#b8a47c')   # 비바람에 바랜 부두 널(ghost-train 플랫폼 널과 같은 결)
TAR = R('#100c14', '#1c1820', '#2a2430', '#3a3440', '#4c4652', '#625c68', '#7e7884')     # 타르 칠 지붕 펠트
BRICK = R('#2b1a24', '#48222a', '#66302e', '#844238', '#a05a44', '#b8765a', '#d09878')   # 바랜 붉은 벽돌(버들항 벽돌을 한 단 탁하게)
SLATE = AK.SL                                                                         # 버들항 성 지붕 슬레이트
SOOTY = R('#0e0a0e', '#1e1618', '#2e2224', '#3e3030', '#52403c', '#6a5650', '#86726a')   # 그을린 벽돌·재

def add_mat(name, ramp):
    if name in FM.MID: return
    FM.MATS.append(name); FM.MID[name] = len(FM.MATS) - 1; FM.RAMP_OF[name] = ramp
    lut = np.zeros((len(FM.MATS), 7, 3), np.uint8); lut[:len(FM.LUT)] = FM.LUT
    for k in range(7): lut[FM.MID[name], k] = ramp[min(k, len(ramp) - 1)]
    FM.LUT = lut
for _n, _r in (('canvas', CNV), ('ochre', OCH), ('rope', ROPE), ('coal', COAL), ('plank', PLANK), ('tar', TAR),
               ('sooty', SOOTY), ('cloud', CL), ('sky', SK), ('brick', BRICK), ('slate', SLATE)):
    add_mat(_n, _r)

def fin(im, k=.62): return pz.fin(im.img() if isinstance(im, TC) else im, k)
def pad16(im): return FB.pad16(im)
def flip(im): return im.transpose(Image.FLIP_LEFT_RIGHT)
def mk(fn, w=16, h=16):
    a = np.zeros((h, w, 4), np.uint8)
    for y in range(h):
        for x in range(w):
            c = fn(x, y)
            if c is not None: a[y, x, :3] = c[:3]; a[y, x, 3] = 255
    return Image.fromarray(a, 'RGBA')

def recolor_arr(rgb, ramp, lo=1, hi=6):
    """칩셋 결(밝기 순서)을 그대로 둔 채 다른 램프로 옮긴다."""
    L = 0.3 * rgb[..., 0] + 0.59 * rgb[..., 1] + 0.11 * rgb[..., 2]
    vals = np.unique(L); rank = np.searchsorted(vals, L) / max(1, len(vals) - 1)
    t = np.clip(np.rint(lo + rank * (hi - lo)), 0, 6).astype(int)
    return np.array(ramp, np.uint8)[t]

def shadow(im, cx, cy, rx, ry, a=60):
    """물체 밑 접지 그림자(옅게, 버들항 소품과 같다)."""
    return FB.shadow_under(im, cx, cy, rx, ry, a)

def glow(size, col, a=60, squash=1.0):
    h = max(2, int(size * squash)); im = new(size, h); p = im.load()
    for y in range(h):
        for x in range(size):
            d = math.hypot((x + .5 - size / 2) / (size / 2), (y + .5 - h / 2) / (h / 2))
            if d < 1:
                al = int(a * (1 - d) ** 1.6)
                if al > 0: p[x, y] = tuple(col) + (al,)
    return im

def sheet16(cell): return AB.sheet16(cell)

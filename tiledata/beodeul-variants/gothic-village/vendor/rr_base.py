# (동결 사본) rain-ruin-town/rr_base.py — 고딕 마을이 그리기 함수를 쓰려고 복사. 경로는 gv_base 가 잡는다.
# 비 내리는 수직 폐허 도시(rain-ruin-town) 공용 바탕 — 결정적.
# 버들항 파이프라인(city_v6: pj/pv/ph2/castle6/roman/terrain/ground)과 폐허 마을 동결 사본(vendor/rv_*)의 그리기 함수로
# 먼저 「낮 재료」로 그리고, 밤비 등급 night() 로 한 번에 어둡고 푸르게 옮긴다(채널별 단조 변환이라 7단 밝기 순위가 그대로).
# 그 다음 밤에만 있는 것(켜진 창·등불·젖은 윗면의 빛 맺힘)을 밤 공간 램프로 덧칠한다. 비 줄기는 그리지 않는다(런타임 몫).
import os, sys, math
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, 'vendor'))
sys.path.insert(0, os.path.join(HERE, '..', '_lib-5'))
from rv_base import *                      # noqa: F401,F403  bd5(Scene·terrain·ground·pz·px2) + 폐허 마을 재료(CH·ASH·ROT·DK·LAWN …)
from rv_base import _hash
import numpy as np
from PIL import Image
import rv_house as RH
import pv, pj, ph2, roman, castle6, terrain, pz

# ---------------------------------------------------------------- 밤비 등급
NK = np.array((0.37, 0.44, 0.63)); NL = np.array((8.0, 12.0, 27.0)); NG = 0.92; ND = 0.25

def night_arr(a):
    """RGB float 배열 -> 밤비 톤. 감마 살짝 올림 → 채도 22% 덜기 → 채널 곱(푸르게) + 남색 바닥."""
    a = 255.0 * (np.clip(a, 0, 255) / 255.0) ** NG
    l = (0.3 * a[..., 0] + 0.59 * a[..., 1] + 0.11 * a[..., 2])[..., None]
    a = a * (1 - ND) + l * ND
    return np.clip(a * NK + NL, 0, 255)

def night(im):
    """RGBA 그림 전체를 밤비 톤으로(알파 유지)."""
    a = np.array(im.convert('RGBA')).astype(np.float64)
    a[..., :3] = night_arr(a[..., :3])
    return Image.fromarray(np.rint(a).astype(np.uint8), 'RGBA').copy()

def N(c):
    """색 하나를 밤 공간으로."""
    return tuple(int(round(v)) for v in night_arr(np.array([[c[:3]]], np.float64))[0, 0])

# ---------------------------------------------------------------- 밤 공간 램프 (0=윤곽, 1~6 밝아짐)
LIT = [hx(c) for c in ('#3a1c06', '#7a3e0e', '#b8681a', '#e89c30', '#f8c656', '#fde48a', '#fff7cc')]   # 켜진 창·등불
SHEEN = [hx(c) for c in ('#162038', '#26385a', '#3c5478', '#5a7698', '#7e9ab8', '#a8c0d8', '#d4e2f0')]  # 젖은 윗면 빛 맺힘(하늘빛)
PUD = [hx(c) for c in ('#060c1c', '#0c1830', '#142644', '#1e3858', '#2c4e72', '#46688c', '#7c9cbc')]     # 웅덩이 물(어두운 하늘 반사)
IRON = [hx(c) for c in ('#07090f', '#12161f', '#1e2430', '#2c3442', '#3e4858', '#5a6676', '#8494a6')]   # 젖은 쇠(밤 공간)
NMOSS = [N(c) for c in R('moss')]
NST = [N(c) for c in ST]
NWD = [N(c) for c in WD]

def lum3(c): return 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]

def is_glass(c):
    """칩셋 창유리(남색·청록): 파랑이 빨강보다 크고 초록이 빨강 이상(보랏빛 슬레이트·벽 줄눈은 초록 < 빨강이라 빠진다)."""
    r, g, b = c[:3]
    return b > r + 12 and g >= r and lum3((r, g, b)) < 190

SLATE = [hx(c) for c in ('#1a1e26', '#283240', '#36434f', '#485763', '#5d6d79', '#7d8d97', '#a9b6bd')]   # 낮 슬레이트(청회색)
def slate(im):
    """칩셋 보랏빛 슬레이트 지붕 화소(파랑 >> 초록, 빨강 > 초록)를 청회색 슬레이트 7단으로 옮긴다(밝기 순위 유지). 낮 그림에."""
    a = np.array(im.convert('RGBA')).astype(np.int32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    m = (b > g + 30) & (r >= g - 4) & (a[..., 3] > 0)
    l = 0.3 * r + 0.59 * g + 0.11 * b
    t = np.clip(np.select([l < 34, l < 46, l < 58, l < 80, l < 105, l < 150], [0, 1, 2, 3, 4, 5], 6), 0, 6)
    S = np.array(SLATE)
    a[..., :3] = np.where(m[..., None], S[t], a[..., :3])
    return Image.fromarray(a.astype(np.uint8), 'RGBA').copy()

def lit_window(px, W, Hh, x0, y0, w, h, seed=1, mullion=True):
    """켜진 창(밤 공간): 안쪽 불빛 램프 — 위가 밝고 아래로 따뜻하게 짙어짐, 창살 그림자, 아래 모 한 줄 어둡게."""
    for y in range(y0, y0 + h):
        for x in range(x0, x0 + w):
            f = (y - y0) / max(1, h - 1)
            t = 6 if f < 0.2 else (5 if f < 0.55 else 4)
            if H(x, y, seed) > 0.86: t = max(3, t - 1)
            if mullion and (x == x0 + w // 2 or y == y0 + h // 2): t = 2
            if y == y0 + h - 1: t = min(t, 3)
            put(px, W, Hh, x, y, LIT[t])

def relight_glass(im_day, im_night, box, seed=1):
    """낮 그림의 창유리(칩셋 청록·남색 유리 화소)를 찾아 밤 그림 그 자리를 불빛 램프로 칠한다. box=(x0,y0,x1,y1) 안만.
    유리 밝기 순위를 불빛 단으로 옮긴다(어두운 유리 = 짙은 주황, 밝은 반짝임 = 거의 흰 노랑)."""
    d = im_day.load(); n = im_night.load(); x0, y0, x1, y1 = box
    for y in range(max(0, y0), min(im_day.height, y1)):
        for x in range(max(0, x0), min(im_day.width, x1)):
            r, g, b, a = d[x, y]
            if a < 200: continue
            if is_glass((r, g, b)):     # 유리(푸른·청록 계열)
                l = lum3((r, g, b))
                t = 3 if l < 40 else (4 if l < 70 else (5 if l < 130 else 6))
                if H(x, y, seed) > 0.9: t = max(3, t - 1)
                n[x, y] = LIT[t] + (255,)

def glow(px, W, Hh, cx, cy, r, k=0.35, col=None):
    """둥근 불빛 번짐(밤 그림 위): 가운데에서 멀어질수록 약해지는 더하기. 2화소 계단(뭉개지지 않게)."""
    col = col or LIT[5]
    for y in range(int(cy - r), int(cy + r) + 1):
        for x in range(int(cx - r), int(cx + r) + 1):
            d = math.hypot(x + 0.5 - cx, (y + 0.5 - cy) * 1.15)
            if d > r: continue
            p = get(px, W, Hh, x, y)
            if p[3] < 10: continue
            f = k * (1 - d / r)
            f = round(f * 6) / 6.0                                   # 단계 번짐(손 도트 결)
            if f <= 0: continue
            put(px, W, Hh, x, y, tuple(min(255, int(p[i] + (col[i] - p[i]) * f)) for i in range(3)), p[3])

def sheen_top(px, W, Hh, pts, seed, k=0.6):
    """젖은 윗면의 빛 맺힘: 주어진 화소(밤 공간)를 하늘빛으로 끌어올린다(밝기 순위 유지)."""
    for (x, y) in pts:
        p = get(px, W, Hh, x, y)
        if p[3] < 200: continue
        t = max(2, min(6, int(lum3(p) / 255 * 6) + 2))
        put(px, W, Hh, x, y, mix(p[:3], SHEEN[t], k))

def wet_edges(im, seed, dens=0.5, k=0.55):
    """밤 그림의 '윗모'(위가 투명하거나 훨씬 어두운 밝은 화소 = 빛 받는 윗면 가장자리)에 듬성듬성 빛 맺힘."""
    px = im.load(); W, Hh = im.size; pts = []
    for y in range(1, Hh):
        for x in range(W):
            p = px[x, y]
            if p[3] < 200: continue
            q = px[x, y - 1]
            if (q[3] < 100 or lum3(q) < lum3(p) - 18) and H(x, y, seed) < dens: pts.append((x, y))
    sheen_top(px, W, Hh, pts, seed, k)
    return im

def drip_stains(px, W, Hh, x0, x1, y0, y1, seed, k=0.14, dens=0.18):
    """빗물 얼룩(밤 그림): 처마 밑에서 아래로 흘러내린 거무스름한 세로 줄 + 이끼 낀 밑동."""
    for x in range(x0, x1):
        if H(x, seed, 3) > dens: continue
        ln = int((y1 - y0) * (0.25 + 0.7 * H(x, seed, 1)))
        for y in range(y0, y0 + ln):
            p = get(px, W, Hh, x, y)
            if p[3] > 200: put(px, W, Hh, x, y, mul(p, 1 - k * (1 - (y - y0) / max(1, ln))))

def moss_foot(px, W, Hh, x0, x1, ybase, seed, h=6, dens=0.5):
    """밑동 이끼(밤 공간): 벽 아래 몇 줄에 짙은 이끼 화소가 덩이로(위로 갈수록 드묾)."""
    for y in range(ybase - h, ybase + 1):
        f = (ybase - y) / max(1, h)
        for x in range(x0, x1):
            p = get(px, W, Hh, x, y)
            if p[3] < 200: continue
            if vnoise(x, y, 3.0, seed) > 0.42 + 0.45 * f and H(x, y, seed + 1) < dens + 0.4 * (1 - f):
                t = 2 + int(H(x, y, seed + 2) * 3)
                put(px, W, Hh, x, y, mix(p[:3], NMOSS[t], 0.75))

def ntufts(px, W, Hh, x0, x1, ybase, seed, dens=0.45, hmax=4):
    """밑동 잔풀(밤 공간 잔디)."""
    NL_ = [N(c) for c in LAWN]
    for x in range(x0, x1):
        if H(x, seed) > dens: continue
        hgt = 1 + int(H(x, seed, 1) * hmax)
        for j in range(hgt):
            t = 5 if j >= hgt - 1 else (3 if j > 0 else 1)
            put(px, W, Hh, x, ybase - j, NL_[t])

def outline_in(im, k=0.62): return pz.fin(im, k)

def pad_to(im, w, h, align='bl'):
    o = Image.new('RGBA', (w, h))
    o.alpha_composite(im, (0, h - im.height))
    return o

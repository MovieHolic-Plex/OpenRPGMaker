# (동결 사본) ruined-village/rv_base.py — 고딕 마을이 그리기 함수를 쓰려고 복사. 경로는 gv_base 가 잡는다.
# 폐허 마을 공용 바탕 — 버들항 파이프라인(city_v6) 재료·팔레트를 불러오고, 새 재료(그을음·재·썩은 나무·마른 풀)를
# 같은 7단 규칙(0=윤곽, 1~6 밝아짐)으로 더한다. 결정적.
import os, sys, math
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, 'vendor'))
sys.path.insert(0, os.path.join(HERE, '..', '_lib-5'))
from bd5 import *                         # noqa: F401,F403  Scene, terrain, ground, terrain7, pz, px2, palette(적용됨)
import numpy as np
from PIL import Image
import wl                                 # 16변형 가장자리 깊이장·조각 저장(동결 사본)
import pv, pj, ph2, roman, castle6
from px2 import C, _hash, vnoise, PAL, GRAIN
from wl import hx, P, tnoise, hash2, tone_img

# ---- 새 재료(7단)
PAL['char'] = ['#070504', '#140e0b', '#221813', '#33241b', '#4a3526', '#634a35', '#7e6248']   # 숯이 된 나무
PAL['ash'] = ['#1c1b1d', '#323033', '#4b484a', '#666260', '#827d76', '#a09a90', '#c0baad']      # 재·그을린 돌
PAL['rot'] = ['#1a120c', '#36251a', '#523a28', '#6e5038', '#8a684a', '#a6825e', '#c09c76']      # 비바람에 바랜 썩은 판자
PAL['hay'] = ['#2a220e', '#4e4118', '#76622a', '#9a8340', '#b9a25a', '#d3bd76', '#ebd89a']      # 마른 풀
PAL['bronze'] = ['#140c05', '#2e1d0a', '#4a3110', '#664519', '#835b25', '#a27636', '#c29652']   # 종 청동
PAL['verd'] = ['#0c1e1a', '#16362e', '#235246', '#357061', '#4f8e7c', '#76ae9a', '#a6ceba']     # 청동 녹
PAL['fog'] = ['#3e4650', '#56606a', '#6e7884', '#89939e', '#a6aeb8', '#c4cad2', '#e2e6ea']
for k, v in (('char', (0.10, 1.4)), ('ash', (0.14, 1.8)), ('rot', (0.12, 1.3)), ('hay', (0.16, 1.4)), ('bronze', (0.05, 2)), ('verd', (0.10, 1.6)), ('fog', (0.0, 2))):
    GRAIN[k] = v

def R(mat): return [hx(c) for c in PAL[mat]]
WD = [tuple(c[:3]) for c in pv.WD]       # 버들항 나무(창틀·문·서까래)
ST = [tuple(c[:3]) for c in pv.ST]       # 버들항 돌
CH, ASH, ROT, DK, LEAF, MOSS, HAY, CLAY = R('char'), R('ash'), R('rot'), R('dark'), R('leaf'), R('moss'), R('hay'), R('clay')
LAWN = [hx(c) for c in ('#3f7a2c', '#4b8232', '#579f35', '#58a035', '#73b83e', '#8fd24a')]
GLASS = [hx('#071528'), hx('#212d42'), hx('#3fa2ae'), hx('#a7d4db')]
SHADOW = (14, 30, 8)

def mix(a, b, t): return tuple(int(round(a[i] * (1 - t) + b[i] * t)) for i in range(3))
def mul(c, k): return tuple(max(0, min(255, int(v * k))) for v in c[:3])
def lum(c): return 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]
def H(*k):
    v = 0
    for i, kk in enumerate(k): v = v * 131 + int(kk) * (7 + i * 13)
    return _hash(v, 5, 7717)

def put(px, W, Hh, x, y, c, a=255):
    if 0 <= x < W and 0 <= y < Hh: px[x, y] = tuple(c[:3]) + (a,)
def get(px, W, Hh, x, y):
    return px[x, y] if 0 <= x < W and 0 <= y < Hh else (0, 0, 0, 0)

def fin(im, k=0.62):
    """버들항 건물·소품 마감: 실루엣 가장자리 안쪽 1화소를 어둡게(밖으로 자라는 검은 테 없음)."""
    return pz.fin(im, k)

def char_px(c, k, seed, x, y):
    """그을음: 밝기를 낮추고 갈색-검정으로 끌어당긴다. k 0..1."""
    l = lum(c) / 255.0
    tgt = CH[max(1, min(5, int(l * 6)))]
    t = k * (0.75 + 0.25 * H(x, y, seed))
    return mix(c, tgt, min(1.0, t))

def soot(px, W, Hh, x0, x1, y0, y1, seed, base=0.55, up=True):
    """창·문 위로 올라간 그을음 띠: 아래쪽 진하고 위로 갈수록 옅고 가늘다(불꽃이 핥은 자국)."""
    for y in range(y0, y1):
        f = (y - y0) / max(1, y1 - y0)
        k = base * (f if up else 1 - f)
        cx = (x0 + x1) / 2.0; hw = (x1 - x0) / 2.0 * (0.45 + 0.55 * (f if up else 1 - f))
        for x in range(x0 - 2, x1 + 2):
            if abs(x + 0.5 - cx) > hw + (vnoise(x, y, 2.0, seed) - 0.5) * 3: continue
            p = get(px, W, Hh, x, y)
            if p[3] < 200: continue
            put(px, W, Hh, x, y, char_px(p, k, seed, x, y))

def tufts(px, W, Hh, x0, x1, ybase, seed, dens=0.55, hmax=4, dry=0.0):
    """밑동 잔풀(초원 하이로드와 같은 획). dry: 마른 풀 섞는 비율."""
    for x in range(x0, x1):
        if H(x, seed) > dens: continue
        hgt = 1 + int(H(x, seed, 1) * hmax)
        lean = -1 if H(x, seed, 2) < 0.3 else (1 if H(x, seed, 2) > 0.8 else 0)
        dryp = H(x, seed, 7) < dry
        for j in range(hgt):
            xx = x + (lean if j >= hgt - 1 and hgt > 2 else 0)
            t = 5 if j >= hgt - 1 else (4 if j > 0 else 2)
            if H(x, seed, 3) < 0.25: t = min(5, t + 1)
            put(px, W, Hh, xx, ybase - j, HAY[t] if dryp else LAWN[t])

def weeds_on(px, W, Hh, pts, seed, dry=0.4):
    """지붕·담 위에 자란 잡초 몇 포기: (x,y) 밑동."""
    for i, (x, y) in enumerate(pts):
        for k in range(-2, 3):
            hgt = 1 + int(H(i, k, seed) * 3) - abs(k) // 2
            dryp = H(i, k, seed, 3) < dry
            for j in range(max(1, hgt)):
                t = 5 if j == hgt - 1 else (4 if j else 2)
                put(px, W, Hh, x + k, y - j, HAY[t] if dryp else LAWN[t])

def cobweb(px, W, Hh, x0, y0, r, seed, corner='tl', a=110):
    """모서리 거미줄: 가는 흰 실 — 바퀴살 3가닥 + 처진 고리 2개, 화소 하나 건너 하나(덩이 금지)."""
    sx = 1 if corner[1] == 'l' else -1; sy = 1 if corner[0] == 't' else -1
    col = (236, 240, 242)
    def dot(x, y, t):
        p = get(px, W, Hh, x, y)
        if p[3] > 0: put(px, W, Hh, x, y, mix(p[:3], col, t))
        else: put(px, W, Hh, x, y, col, a)
    for k in range(3):
        ang = (k + 0.5) / 3 * (math.pi / 2)
        for t in range(1, r + 1):
            dot(x0 + sx * int(round(math.cos(ang) * t)), y0 + sy * int(round(math.sin(ang) * t)), 0.4)
    for rr in (r * 0.5, r * 0.95):
        n = max(6, int(rr * 2.2))
        for k in range(0, n, 1):
            ang = k / (n - 1) * (math.pi / 2)
            sag = math.sin(ang * 2) * rr * 0.18
            if k % 2: continue
            dot(x0 + sx * int(round(math.cos(ang) * (rr - sag))), y0 + sy * int(round(math.sin(ang) * (rr - sag))), 0.32)

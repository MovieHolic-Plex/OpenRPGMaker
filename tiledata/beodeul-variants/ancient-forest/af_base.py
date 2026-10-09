# 고대 숲 (ancient-forest) 공용 재료. 3/4 시점, 빛 왼쪽 위, 버들항 잎·나무 램프(칩셋 색) + 발광 색 몇 개.
import os, sys, math, random
MYDIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(MYDIR, '..', '_lib3')); sys.path.insert(0, os.path.join(MYDIR, '..', 'mine-tunnels')); sys.path.insert(0, MYDIR)
from dlib import *
import dlib
import px2, pz
from px2 import PAL, _hash, vnoise, C
import numpy as np
from wavekit import *
HERE = MYDIR            # dlib 의 from-import 가 HERE 를 _lib3 로 덮어쓰므로 다시 지정

LEAF = [hx(c) for c in PAL['leaf']]            # 7단 (0=윤곽)
BARK = [hx(c) for c in PAL['bark']] if len(PAL['bark']) == 7 else [hx(c) for c in PAL['wood']]
STN = [hx(c) for c in PAL['stone']]
MOSS = [hx(c) for c in PAL['leaf']]
# 숲 바닥용: 짙은 이끼·낙엽 흙 램프 (칩셋 잎·흙 색에서)
FLOOR_G = [mix(c, (20, 40, 36), .25) for c in LEAF]                                   # 어두운 이끼
FQ = [(20, 36, 30), (28, 50, 38), (38, 66, 46), (46, 78, 52), (54, 88, 58), (63, 99, 64), (76, 114, 74)]     # 조용한 숲 바닥(채도 낮고 어둡다)
LQ = [(30, 24, 22), (46, 36, 30), (68, 54, 40), (86, 68, 48), (102, 82, 56), (118, 96, 66), (136, 112, 80)]   # 차분한 흙길
LOAM = [mix((36, 26, 20), (150, 110, 66), t / 6.) for t in range(7)]                  # 낙엽 흙
GLOW_G = [(6, 40, 40), (10, 80, 74), (20, 130, 110), (60, 190, 150), (130, 240, 190), (200, 255, 225), (250, 255, 245)]   # 발광 버섯(청록 초록)
GLOW_B = [(14, 24, 70), (28, 52, 130), (50, 96, 190), (96, 150, 232), (160, 200, 250), (210, 232, 255), (245, 250, 255)]  # 푸른 발광 꽃
SHROOM_P = [(40, 14, 56), (84, 28, 104), (130, 50, 150), (176, 84, 190), (218, 130, 224), (244, 188, 240), (255, 232, 252)]
ANC = [mix(c, (8, 56, 60), .08) for c in LEAF]                                                  # 고대 나무: 더 푸른 짙은 잎
MOSSROCK = [mix(c, LEAF[3], .38) for c in STN]                                        # 이끼 낀 돌
def cl(v, lo=0, hi=6): return max(lo, min(hi, v))
def fin(cv, k=.62): return pz.fin(cv.im if hasattr(cv, 'im') else cv, k)
def sh(im, cx, cy, rx, ry, a=70):
    from dprops import shadow as _s
    return _s(im, cx, cy, rx, ry, a)

# ------------------------------------------------------------------ 이음새 없는 바닥 (주기 48)
PER = 48
def pn(X, Y, sc, seed): return vnoise(X, Y, sc, seed, per=PER // sc)
def _floor(fn):
    im = new(PER, PER); p = im.load()
    for y in range(PER):
        for x in range(PER): p[x, y] = tuple(fn(x, y)) + (255,)
    return im

def _tone3(n, cuts): 
    return sum(1 for c_ in cuts if n >= c_)

def floor_moss(seed=11):
    """조용한 이끼 바닥: 2~4칸 단위 큰 명암 덩이(3·4·5단), 점은 드물게(1% 안팎, 한 단 차이)."""
    def f(X, Y):
        n = pn(X, Y, 24, seed) * .55 + pn(X, Y, 12, seed + 1) * .33 + pn(X, Y, 6, seed + 2) * .12
        t = 3 + _tone3(n, (.46, .82))
        r = _hash(X, Y, seed + 3)
        if r < .008: t -= 1
        elif r > .992: t += 1
        return FQ[t]
    return _floor(f)

def floor_deep(seed=21):
    """깊은 그늘 이끼: 한 단 더 어둡고(2·3·4단) 더 조용하다."""
    def f(X, Y):
        n = pn(X, Y, 24, seed) * .6 + pn(X, Y, 12, seed + 1) * .3 + pn(X, Y, 6, seed + 2) * .1
        t = 2 + _tone3(n, (.50, .86))
        r = _hash(X, Y, seed + 3)
        if r < .006: t -= 1
        elif r > .994: t += 1
        return FQ[t]
    return _floor(f)

def floor_loam(seed=31):
    """차분한 흙길: 큰 명암 덩이(3·4·5단 갈색), 낙엽 점은 거의 없다."""
    def f(X, Y):
        n = pn(X, Y, 24, seed) * .5 + pn(X, Y, 12, seed + 1) * .36 + pn(X, Y, 6, seed + 2) * .14
        t = 3 + _tone3(n, (.46, .84))
        r = _hash(X, Y, seed + 3)
        if r < .008: t -= 1
        elif r > .995: t += 1
        return LQ[t]
    return _floor(f)

def floor_glade(seed=51):
    """공터 풀밭: 조용한 밝은 풀(4·5단) 큰 면, 드문 연한 꽃점(0.4%)."""
    def f(X, Y):
        n = pn(X, Y, 24, seed) * .6 + pn(X, Y, 12, seed + 1) * .32 + pn(X, Y, 6, seed + 2) * .08
        t = 4 + _tone3(n, (.50,))
        r = _hash(X, Y, seed + 3)
        if r < .006: t -= 1
        elif r > .996: return (196, 214, 150)
        return FQ[t]
    return _floor(f)

def floor_flag(seed=41):
    """이끼 낀 유적 판석 (16x8 어긋난 판석, 줄눈에만 이끼가 번진다). 안뜰 바닥: 벽보다 어둡고 매끈하다."""
    def f(X, Y):
        row = Y // 8; off = ((row % 2) * 8 + (row // 2 % 3) * 5) % 16; bx = (X + off) // 16
        lx = (X + off) % 16; ly = Y % 8
        h = _hash(bx % 3, row % 6, seed)
        c = MOSSROCK[1] if h < .4 else (MOSSROCK[2] if h < .8 else MOSSROCK[1])
        if lx == 15 or ly == 7:
            c = MOSSROCK[0]
            if pn(X, Y, 6, seed + 4) > .62: c = FLOOR_G[2]            # 줄눈 이끼
        elif lx == 0 or ly == 0: c = MOSSROCK[3]
        r = _hash(X, Y, seed + 9)
        if r > .985: c = MOSSROCK[3]
        elif r < .05: c = MOSSROCK[0]
        if pn(X, Y, 12, seed + 5) > .70 and _hash(X, Y, seed + 6) < .55: c = FLOOR_G[2] if _hash(X, Y, seed + 7) < .6 else FLOOR_G[3]   # 드문 이끼 덩이
        return c
    return _floor(f)

FLOOR_FN = {'glade': floor_glade, 'moss': floor_moss, 'deep': floor_deep, 'loam': floor_loam, 'flag': floor_flag}
_FT = {}
def floor_sample(kind):
    if kind not in _FT: _FT[kind] = FLOOR_FN[kind]()
    return _FT[kind]

# ------------------------------------------------------------------ 잎덩이 (큰 돔 + 작은 잎 뭉치 → 칩셋 잎 램프로 양자화)
def _lumps(w, h, seed, cell=4, rmin=2.1, rmax=3.3):
    """잎 뭉치 높이장: 격자마다 흔들린 돔 하나(반지름 rmin~rmax). 반환 (높이, 뭉치 아이디 해시)."""
    rnd = random.Random(seed)
    ys, xs = np.mgrid[0:h, 0:w].astype(float)
    best = np.zeros((h, w)); hid = np.zeros((h, w))
    for gy in range(-1, h // cell + 2):
        for gx in range(-1, w // cell + 2):
            cx = gx * cell + rnd.uniform(0, cell); cy = gy * cell + rnd.uniform(0, cell); r = rnd.uniform(rmin, rmax); hv = rnd.random()
            d2 = ((xs + .5 - cx) ** 2 + (ys + .5 - cy) ** 2) / (r * r)
            b = np.sqrt(np.clip(1 - d2, 0, 1)) * (.8 + .2 * hv)
            m = b > best; best = np.where(m, b, best); hid = np.where(m, hv, hid)
    return best, hid

def leaf_canopy(w, h, clumps, seed=1, amb=.2, hue=0, ramp=None, shade_bias=0.0, holes=.06):
    """clumps: [(cx,cy,rx,ry)] 큰 덩이 합집합. 반환 (RGBA 이미지, 마스크). 빛 왼쪽 위."""
    ramp = ramp or LEAF
    ys, xs = np.mgrid[0:h, 0:w].astype(float)
    big = np.zeros((h, w)); mask = np.zeros((h, w), bool)
    rnd = random.Random(seed + 5)
    for (cx, cy, rx, ry) in clumps:
        d2 = ((xs + .5 - cx) / rx) ** 2 + ((ys + .5 - cy) / ry) ** 2
        wob = (np.array([[vnoise(x, y, 3.0, seed + 31) for x in range(w)] for y in range(h)]) - .5) * .36
        inside = d2 + wob < 1
        b = np.sqrt(np.clip(1 - d2, 0, 1))
        mask |= inside; big = np.maximum(big, np.where(inside, b, 0))
    lump, hid = _lumps(w, h, seed)
    H = big * 5.0 + lump * 1.7
    gy, gx = np.gradient(H)
    nx, ny = -gx, -gy; nz = np.ones_like(H) * .9
    L = np.sqrt(nx * nx + ny * ny + nz * nz)
    lx, ly, lz = -.55, -.65, .75
    nl = math.sqrt(lx * lx + ly * ly + lz * lz)
    dot = (nx * lx + ny * ly + nz * lz) / (L * nl)
    v = amb + (1 - amb) * np.clip(dot * 1.15 - .15, 0, 1) + shade_bias
    # 위쪽 뭉치일수록 밝게, 가장자리(아래·오른쪽)는 어둡게
    ysn = (ys / max(1.0, h)) 
    v += (big - .5) * .22
    v += (lump - .55) * .34
    v -= (ysn - .45) * .45 * (ysn > .45)   # 아래쪽 수관은 어둡게
    v -= .16
    tone = np.clip(np.rint(v * 4.9 + .7), 1, 6).astype(int)
    # 잎 뭉치 사이 어두운 틈
    gap = (lump < .12) & mask
    tone = np.where(gap, np.minimum(tone, 1), tone)
    rr = np.array([[ _hash(x, y, seed + 77) for x in range(w)] for y in range(h)])
    tone = np.where((rr < .05) & mask, np.clip(tone + 1, 1, 6), tone)
    tone = np.where((rr > .96) & mask, np.clip(tone - 1, 1, 6), tone)
    out = np.zeros((h, w, 4), np.uint8)
    pal = np.array(ramp, np.uint8)
    out[..., :3] = pal[tone]; out[..., 3] = np.where(mask, 255, 0)
    return Image.fromarray(out, 'RGBA'), mask

def bark_c(w, h, seed): return C(w, h, seed)

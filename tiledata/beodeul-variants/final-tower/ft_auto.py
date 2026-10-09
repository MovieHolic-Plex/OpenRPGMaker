# 최종 탑 오토타일 — 잔해 가장자리(바닥 위 부스러기 덧그림)와 발광 균열. 칸 번호 = 위 1 + 오른쪽 2 + 아래 4 + 왼쪽 8.
# 둘 다 「지도에서는 전역 좌표로 그린 층」과 「시트(16 주기)」를 같은 함수로 만든다(시트는 이웃 칸끼리 이음새 없이 이어진다).
import math
import numpy as np
from scipy import ndimage as ndi
from ft_base import *
from ft_base import _hash
from ft_debris import *

RUB_KINDS = [('plate', .36), ('stone', .32), ('bone', .06), ('glass', .08), ('rust', .07), ('vert', .05), ('pipe', .06)]

def _cellmask(cells, Wc, Hc):
    M = np.zeros((Hc * T, Wc * T), bool)
    for (x, y) in cells: M[y * T:(y + 1) * T, x * T:(x + 1) * T] = True
    return M

def rubble_layer(cells, Wc, Hc, seed=7, periodic=False, ox=0, oy=0):
    """잔해 덧그림: 칸 집합 안을 작은 조각(판·마름돌·뼈 토막·유리·나사)으로 덮고, 이웃 없는 쪽은 들쭉날쭉하게 성겨진다.
    periodic=True 면 조각 자리를 16 주기로 잡는다(시트). 걷기, 아래층."""
    Hp, Wp = Hc * T, Wc * T
    M = _cellmask(cells, Wc, Hc)
    d = ndi.distance_transform_edt(M)
    tc = TC(Wp, Hp, seed)
    step = 4 if periodic else 5
    pts = []
    for gy in range(0, Hp, step):
        for gx in range(0, Wp, step):
            kx, ky = ((gx + ox) % 16, (gy + oy) % 16) if periodic else (gx + ox, gy + oy)
            jx = gx + int(_hash(kx, ky, seed) * 4) - 2; jy = gy + int(_hash(ky, kx, seed + 1) * 4) - 2
            if not (0 <= jx < Wp and 0 <= jy < Hp) or not M[jy, jx]: continue
            kxx, kyy = ((jx + ox) % 16, (jy + oy) % 16) if periodic else (jx + ox, jy + oy)
            thr = 1.0 + 4.0 * _hash(kxx // 3, kyy // 3, seed + 2)
            if d[jy, jx] < thr: continue
            if _hash(kxx, kyy, seed + 6) < (.62 if periodic else .35): continue                # 성기게(바닥이 군데 보인다)
            pts.append((jy, jx, kxx, kyy))
    pts.sort()
    for (jy, jx, kx, ky) in pts:
        r = np.random.default_rng(int(_hash(kx, ky, seed + 5) * 1e9))
        c = random_chunk(r, (3.5 + 3 * r.random()) if periodic else (5 + 4 * r.random()), [('plate', .6), ('rust', .1), ('stone', .3)] if periodic else RUB_KINDS)
        paste_ol(tc, c, jx - c.w // 2, jy - c.h + 2, 0 if periodic else -1)
    # 사이 틈 부스러기 점
    Y, X = np.mgrid[0:Hp, 0:Wp]
    KX = ((X + ox) % 16) if periodic else X + ox; KY = ((Y + oy) % 16) if periodic else Y + oy
    grit = M & (d > 1.0 + 2.5 * FB.hash2(KX // 3, KY // 3, seed + 8)) & (FB.hash2(KX, KY, seed + 9) < (.26 if periodic else .12)) & (tc.m == 0)
    for (y, x) in zip(*np.nonzero(grit)): tc.px(x, y, 'ftst' if _hash(x, y, 3) < .7 else 'steel', 2 if _hash(y, x, 4) < .6 else 3)
    return tc_fin(tc, .8)

def _sheet(fn):
    sh = new(64, 64)
    for n in range(16):
        cells = {(1, 1)}
        if n & 1: cells.add((1, 0))
        if n & 2: cells.add((2, 1))
        if n & 4: cells.add((1, 2))
        if n & 8: cells.add((0, 1))
        lay = fn(cells, 3, 3)
        sh.alpha_composite(lay.crop((16, 16, 32, 32)), (n % 4 * T, n // 4 * T))
    return sh

def rubble_sheet(seed=7):
    return _sheet(lambda c, w, h: rubble_layer(c, w, h, seed, periodic=True, ox=-16, oy=-16))

# ---------------------------------------------------------------- 발광 균열
def _crack_pts(x0, y0, x1, y1, seed, n=4, amp=2.0):
    pts = [(x0, y0)]
    for i in range(1, n):
        t = i / n
        px_ = x0 + (x1 - x0) * t; py_ = y0 + (y1 - y0) * t
        nx, ny = -(y1 - y0), (x1 - x0); L = math.hypot(nx, ny) or 1
        o = (_hash(int(px_ * 7), int(py_ * 7), seed) - .5) * 2 * amp
        pts.append((px_ + nx / L * o, py_ + ny / L * o))
    pts.append((x1, y1)); return pts

def crack_cell(n, gx, gy, seed=3, periodic=True):
    """한 칸의 균열: 칸 가운데 마디에서 이웃 쪽 가장자리 가운데로 갈라진다. 외톨이(0)는 짧은 세 갈래 별 금."""
    kx, ky = (0, 0) if periodic else (gx, gy)
    cx = 8 + int(_hash(kx, ky, seed) * 3) - 1; cy = 8 + int(_hash(ky, kx, seed + 1) * 3) - 1
    ends = []
    ex = lambda k: 7 + int(_hash(k, 1, seed + 2) * 3)                 # 이웃과 같은 자리(가장자리 점)
    if n & 1: ends.append((ex(gx * 0 if periodic else gx), -.5))
    if n & 4: ends.append((ex(gx * 0 if periodic else gx), 16.5))
    if n & 8: ends.append((-.5, ex(gy * 0 + 100 if periodic else gy + 100)))
    if n & 2: ends.append((16.5, ex(gy * 0 + 100 if periodic else gy + 100)))
    if not ends: ends = [(cx - 5, cy - 3), (cx + 5, cy - 1), (cx + 1, cy + 5)]
    lines = [_crack_pts(cx, cy, e[0], e[1], seed + i * 7 + (gx * 3 + gy) * (0 if periodic else 1)) for i, e in enumerate(ends)]
    im = new(); a = np.zeros((16, 16), int)                           # 0 없음 1 빛무리 2 빛 3 금
    for pts in lines:
        for (p, q) in zip(pts, pts[1:]):
            L = int(max(abs(q[0] - p[0]), abs(q[1] - p[1])) * 2) + 1
            for i in range(L + 1):
                t = i / L; x = p[0] + (q[0] - p[0]) * t; y = p[1] + (q[1] - p[1]) * t
                xi, yi = int(round(x)), int(round(y))
                for (dx, dy, v) in ((0, 0, 3), (1, 0, 2), (0, 1, 2), (-1, 0, 1), (0, -1, 1), (1, 1, 1), (2, 0, 1)):
                    xx, yy = xi + dx, yi + dy
                    if 0 <= xx < 16 and 0 <= yy < 16: a[yy, xx] = max(a[yy, xx], v)
    p = im.load()
    for y in range(16):
        for x in range(16):
            v = a[y, x]
            if v == 3: p[x, y] = FT[0] + (255,)
            elif v == 2: p[x, y] = VIOL[4] + (255,)
            elif v == 1 and (x + y) % 2 == 0: p[x, y] = VIOL[3] + (130,)
    for (x, y) in ((cx, cy),):
        if 0 <= x < 16 and 0 <= y < 16: p[x, y] = VIOL[5] + (255,)
    return im

def crack_sheet(seed=3):
    sh = new(64, 64)
    for n in range(16): sh.alpha_composite(crack_cell(n, 0, 0, seed, True), (n % 4 * T, n // 4 * T))
    return sh

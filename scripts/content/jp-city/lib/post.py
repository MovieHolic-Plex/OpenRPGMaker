"""후처리 패스 — 버들항의 잉크 느낌. 전부 modern3 램프 안에서 한 단씩만 움직인다."""
import os, sys, random
import numpy as np
import jpenv
from modern_style_bible_proof import K, Cv, RAMPS, rgb
LUT = {}
for n, r in RAMPS.items():
    for i, h in enumerate(r): LUT.setdefault(rgb(h), (n, i))
def step(c, dt):
    n = LUT.get(tuple(int(v) for v in c[:3]))
    if not n: return tuple(int(v) for v in c[:3])
    r = RAMPS[n[0]]; return rgb(r[max(0, min(len(r) - 1, n[1] + dt))])
def fam(a, x, y):
    if a[y, x, 3] == 0: return None
    n = LUT.get(tuple(int(v) for v in a[y, x, :3])); return n[0] if n else '?'

def contour(a, strength=1):
    """램프(재질)가 바뀌는 경계: 아래·오른쪽 쪽 픽셀(그림자 쪽)을 -1단, 위·왼쪽 쪽 픽셀 중 밝은 재질은 +1단."""
    h, w = a.shape[:2]; out = a.copy()
    for y in range(h):
        for x in range(w):
            f = fam(a, x, y)
            if f is None: continue
            up = fam(a, x, y - 1) if y else None; lf = fam(a, x - 1, y) if x else None
            if (up and up != f) or (lf and lf != f):
                out[y, x, :3] = step(a[y, x], -strength)
    return out

def dither_band(a, y0, y1, dt, phase=0, x0=0, x1=None, fams=None):
    """체커 디더로 한 단 어둡게 — 바닥 때·처마 밑 그늘."""
    x1 = x1 or a.shape[1]; out = a.copy()
    for y in range(y0, y1):
        for x in range(x0, x1):
            if a[y, x, 3] and (x + y + phase) % 2 == 0 and (fams is None or fam(a, x, y) in fams): out[y, x, :3] = step(a[y, x], dt)
    return out

def speckle(a, seed, fams, p=0.05, dt=(-1, 1)):
    rnd = random.Random(seed); out = a.copy(); h, w = a.shape[:2]
    for y in range(h):
        for x in range(w):
            f = fam(a, x, y)
            if f in fams and rnd.random() < p:
                out[y, x, :3] = step(a[y, x], rnd.choice(dt))
    return out

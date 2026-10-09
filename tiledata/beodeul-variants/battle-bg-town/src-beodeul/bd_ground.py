# 버들항 v5 로마풍 바닥 함수 복사본 — 원본 scripts/content/lib/city_v6/roman.py 의 tex_travertine·tex_flag(그대로 옮김).
# 칩셋 램프(terrain.ST)와 _hash 는 버들항 파이프라인(city_v6)에서 읽기만 한다.
import os, sys
sys.dont_write_bytecode = True
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..', '..'))
V6 = os.path.join(ROOT, 'scripts', 'content', 'lib', 'city_v6')
if V6 not in sys.path: sys.path.insert(0, V6)
import numpy as np
import palette
from px2 import _hash
import terrain
def hx(s): s = s.lstrip('#'); return tuple(int(s[i:i + 2], 16) for i in (0, 2, 4))
def mix(a, b, t): return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))
ST = terrain.ST
TRV = [hx(c) for c in ['#3a2c20', '#6c5c4c', '#9e8d83', '#bcaaa0', '#d2c6b0', '#e2d6c0', '#f2ead8']]   # travertine


def tex_travertine(X, Y):
    # large flags 32x24 in running bond; faces calm (tone 4 with sparse tone 5 flecks and a few pores), joints tone 3
    row = Y // 24; off = (row % 2) * 16; col = (X + off) // 32; lx = (X + off) % 32; ly = Y % 24
    if ly == 23 or lx == 31: return TRV[2] if (lx == 31 and ly == 23) else TRV[3]
    h = _hash(col, row, 71); base = TRV[4] if h < 0.7 else TRV[5]
    if ly == 0 or lx == 0: return mix(base, TRV[6], 0.5)
    r = _hash(X, Y, 72)
    if r < 0.05: return TRV[5] if base == TRV[4] else TRV[4]
    if r > 0.992: return TRV[3]
    return base


def tex_flag(X, Y, seed=5):
    # calm grey flagstones: rows 12..16 px tall, flags 14..26 wide, faces one tone with sparse grain, dark joints
    rh = (13, 15, 12, 16, 14); acc = 0; row = 0
    per = sum(rh); yy = Y % per; base_row = (Y // per) * len(rh)
    for i, h in enumerate(rh):
        if yy < acc + h: row = base_row + i; ly = yy - acc; hh = h; break
        acc += h
    x = X + int(_hash(row, 0, seed) * 40); w = 0; col = 0
    xs = x % 96; edges = [0]; k = 0
    while edges[-1] < 96:
        edges.append(edges[-1] + 14 + int(_hash(row % 10, k, seed + 1) * 12)); k += 1
    edges[-1] = 96
    for i in range(len(edges) - 1):
        if edges[i] <= xs < edges[i + 1]: col = i; lx = xs - edges[i]; w = edges[i + 1] - edges[i]; break
    if ly == hh - 1 or lx == w - 1: return ST[3]
    hh_ = _hash(col, row, seed + 2); c = mix(ST[4], ST[5], 0.12 + 0.3 * hh_)
    if ly == 0 or lx == 0: c = mix(c, ST[5], 0.35)
    if _hash(X, Y, seed + 3) < 0.035: c = mix(c, ST[5], 0.5)
    return c


def field(fn, w, h, ox=0, oy=0):
    out = np.zeros((h, w, 3), np.uint8)
    for y in range(h):
        for x in range(w): out[y, x] = fn(x + ox, y + oy)[:3]
    return out

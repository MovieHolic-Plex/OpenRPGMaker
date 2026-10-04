import sys, math; sys.path.insert(0, '.')
from s2lib import *

def line(c, x0, y0, x1, y1, ch):
    dx, dy = abs(x1 - x0), abs(y1 - y0); sx = 1 if x0 < x1 else -1; sy = 1 if y0 < y1 else -1
    err = dx - dy
    while True:
        c.put(x0, y0, ch)
        if (x0, y0) == (x1, y1): break
        e2 = 2 * err
        if e2 > -dy: err -= dy; x0 += sx
        if e2 < dx: err += dx; y0 += sy

def poly(c, pts, ch):
    """스캔라인 채움(꼭짓점 좌표는 칸 중심 기준 정수)."""
    ys = [p[1] for p in pts]
    n = len(pts)
    for y in range(min(ys), max(ys) + 1):
        xs = []
        for i in range(n):
            (xa, ya), (xb, yb) = pts[i], pts[(i + 1) % n]
            if ya == yb: continue
            if min(ya, yb) <= y <= max(ya, yb):
                if y == max(ya, yb) and y != min(ya, yb) and False: continue
                xs.append(xa + (xb - xa) * (y - ya) / (yb - ya))
        if not xs: continue
        lo, hi = math.floor(min(xs) + 0.5), math.floor(max(xs) + 0.5)
        for x in range(lo, hi + 1): c.put(x, y, ch)
    for i in range(n): line(c, *pts[i], *pts[(i + 1) % n], ch)

def ring(c, cx, cy, r0, r1, ch):
    for y in range(int(cy - r1) - 1, int(cy + r1) + 2):
        for x in range(int(cx - r1) - 1, int(cx + r1) + 2):
            d = math.hypot(x - cx, y - cy)
            if r0 <= d < r1: c.put(x, y, ch)

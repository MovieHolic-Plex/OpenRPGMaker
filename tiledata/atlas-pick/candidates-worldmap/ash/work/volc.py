"""ash·lava 공용: 손 지정 배치(바위·금·반점 좌표)로 16x16 토러스 속을 만들고 묶음으로 조립."""
import sys, os
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '../../mountain/work'))
from w3lib import *

A_ = lambda t: ('wash', t)
L_ = lambda t: ('wlava', t)
SA = lambda t: ('wsand', t)
GR = lambda t: ('wgrass', t)

def torus_from(base):
    T = Torus(); [T.put(x, y, base) for y in range(16) for x in range(16)]; return T

def rock(T, x, y, w, h, lit, mid, dark):
    """굳은 돌: 왼위 밝고 오른아래 어두운 덩이. 모서리 한 칸 깎음."""
    for j in range(h):
        for i in range(w):
            if (i in (0, w - 1)) and (j in (0, h - 1)): continue
            if j == h - 1 or i == w - 1: c = dark
            elif j == 0 or i == 0: c = lit
            else: c = mid
            T.put(x + i, y + j, c)

def line(T, pts, c, c2=None):
    """꺾은선 금 — 점 사이를 한 칸씩 잇는다(대각 허용)."""
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        n = max(abs(x1 - x0), abs(y1 - y0))
        for k in range(n + 1):
            x = x0 + round((x1 - x0) * k / n) if n else x0
            y = y0 + round((y1 - y0) * k / n) if n else y0
            T.put(x, y, c)

def dots(T, pts, c):
    for (x, y) in pts: T.put(x, y, c)

def grid(T): return [[T.g[y][x] for x in range(16)] for y in range(16)]

def ellipse_ext(cx, cy, rx, ry):
    def ext(key, x, y): return ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2 <= 1
    return ext

def swap_rim(cellgrid, frm, to, mod, k):
    """가장자리 띠의 frm 램프 픽셀 일부를 to 램프로 바꿔 타다 남은 풀 얼룩을 만든다(칸 안 좌표 규칙)."""
    for y in range(64):
        for x in range(48):
            p = cellgrid[y][x]
            if isinstance(p, tuple) and p[0] == frm and (x % 16 * 5 + y % 16 * 3) % mod == k:
                cellgrid[y][x] = (to, p[1])

def build(bodyA, bodyB, isoT, prof, rim, iso_ell, shadow=None):
    ext = make_masks(prof)
    out = blank(48, 64)
    texA = lambda x, y: bodyA[y % 16][x % 16]
    def put(cx, cy, cell):
        for y in range(16):
            for x in range(16): out[cy * 16 + y][cx * 16 + x] = cell[y][x]
    layout = [['iso', 'alt', 'inner'], ['corner_nw', 'edge_n', 'corner_ne'], ['edge_w', 'body', 'edge_e'], ['corner_sw', 'edge_s', 'corner_se']]
    for cy in range(4):
        for cx in range(3):
            r = layout[cy][cx]
            if r == 'iso':
                put(cx, cy, rim_cell('body', lambda x, y: isoT[y % 16][x % 16], iso_ell, rim, shadow))
            elif r == 'alt': put(cx, cy, [row[:] for row in bodyB])
            elif r == 'body': put(cx, cy, [row[:] for row in bodyA])
            else: put(cx, cy, rim_cell(r, texA, ext, rim, shadow))
    return out

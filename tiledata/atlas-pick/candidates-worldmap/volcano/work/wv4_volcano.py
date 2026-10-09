"""wv4 volcano — 32x32 아이콘(물체층). 잘린 원뿔 + 분화구 용암 + 비탈 용암 줄기 하나 + 위 연기.
 CLI: python3 tiledata/atlas-pick/candidates-worldmap/volcano/work/wv4_volcano.py [ABC]"""
import sys, os, math
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '../../mountain/work'))
from w3lib import to_pxg
BASE = os.path.abspath(os.path.join(HERE, '../..'))
W_ = H_ = 32
RAMP = ['wash']
WA = lambda t: (RAMP[0], t)
LV = lambda t: ('wlava', t)
CN = lambda t: ('mconc', t)
WH = lambda t: ('mwhite', t)
GN = lambda t: ('mgran', t)

def hsh(x, y, s=0): return ((x * 73856093) ^ (y * 19349663) ^ (s * 83492791)) & 0xffff

CFG = {
 # cx, 분화구 중심 y, 윗 반폭, 밑 반폭, 곡률, 분화구 ry, 비탈 명암(밝음·중간·어둠)
 'A': dict(cx=15, yc=10, top=6, base=15, p=1.5, ry=3, lit=(5, 4, 2), out=1, glow=(2, 3, 4), lavaw=2, ramp='wash',
           smoke=[(16, 3, 3, 'c'), (11, 4, 2, 'c'), (21, 4, 2, 'c')], shadow='A'),
 'B': dict(cx=14, yc=9, top=5, base=14, p=1.15, ry=3, lit=(5, 3, 1), out=1, glow=(3, 4, 5), lavaw=2, ramp='wash',
           smoke=[(15, 2, 3, 'w'), (10, 3, 2, 'w'), (20, 3, 3, 'w'), (14, 5, 2, 'w')], shadow='B'),
 'C': dict(cx=15, yc=11, top=10, base=15, p=0.85, ry=4, lit=(5, 4, 2), out=1, glow=(3, 4, 5), lavaw=3, ramp='wrock',
           smoke=[(22, 3, 3, 'g'), (8, 4, 3, 'g'), (15, 2, 4, 'g'), (27, 6, 2, 'g')], shadow='C'),
}

def build(letter):
    c = CFG[letter]
    RAMP[0] = c['ramp']
    cx, yc, top, base, p, ry = c['cx'], c['yc'], c['top'], c['base'], c['p'], c['ry']
    g = [[None] * W_ for _ in range(H_)]
    def put(x, y, v):
        if 0 <= x < W_ and 0 <= y < H_: g[y][x] = v
    y_bot = 29
    def hw(y):
        t = (y - yc) / (y_bot - yc)
        w = top + (base - top) * (max(0, t) ** p)
        if y > y_bot - 3:
            k = (y - (y_bot - 3)) / 3.0
            w *= math.sqrt(max(0.0, 1 - k * k * 0.9))
        return int(round(w))
    hi, mid, lo = c['lit']
    # ---- 비탈 몸통 ----
    for y in range(yc, y_bot + 1):
        w = hw(y)
        ridge = -int(round(w * 0.3))
        for dx in range(-w, w + 1):
            x = cx + dx
            if dx == -w: v = WA(c['out'] + 1 if letter == 'A' else c['out'])
            elif dx == w: v = WA(c['out'])
            else:
                if dx < ridge - 1: tn = hi
                elif dx <= ridge + 1: tn = mid + (1 if letter == 'B' else 0)
                else: tn = mid if dx < w * 0.45 else lo
                tn = min(tn, 5 if RAMP[0] == 'wash' else 6)
                # 바닥으로 갈수록 대비 낮춤(A)·어둡게(B)
                if y >= y_bot - 2: tn = max(1, tn - 1)
                # 골(세로 결) — 위에서 아래로 뻗는 어두운 줄
                for gx, y0, y1 in ((-int(w * .55), yc + 3, y_bot - 3), (int(w * .15), yc + 5, y_bot - 5), (int(w * .62), yc + 4, y_bot - 4)):
                    if dx == gx + ((y - y0) // 6) * (1 if gx > 0 else -1) and y0 <= y <= y1 and (y + gx) % 5 != 0:
                        tn = max(0, tn - 1)
                # 돌 얼룩
                h = hsh(x, y, 7)
                if h % 11 == 0 and dx > -w + 1: tn = min(5, tn + 1)
                elif h % 13 == 0: tn = max(0, tn - 1)
                v = WA(tn)
            put(x, y, v)
    # 아랫단 다시 깎기: 밑 두 줄은 더 어둡게 접지선
    for x in range(W_):
        if g[y_bot][x] is not None and g[y_bot][x][0] == RAMP[0]: g[y_bot][x] = WA(0)
    # ---- 용암 줄기(분화구 앞에서 오른쪽 비탈로 굽이쳐 내림) ----
    lw = c['lavaw']
    sx = cx + 2
    path = []
    xcur = float(sx)
    y_end = y_bot - 4
    for y in range(yc + ry, y_end + 1):
        t = (y - yc - ry) / max(1, (y_end - yc - ry))
        xcur = sx + 3.2 * math.sin(t * 2.6) + t * (base * 0.35)
        path.append((y, xcur, lw + (1 if t > .45 else 0) - (1 if t > .85 else 0)))
    for i, (y, xc, wd) in enumerate(path):
        x0 = int(round(xc)) - wd // 2
        for k in range(wd):
            x = x0 + k
            edge = k == 0 or k == wd - 1
            if letter == 'A': tn = 2 if edge else 3
            else: tn = 2 if edge else (4 if k == 1 else 3)
            if i % 5 == 3 and not edge: tn = min(5, tn + 1)
            if g[y][x] is not None and g[y][x][0] == RAMP[0] or g[y][x] is not None and g[y][x][0] == 'wlava':
                put(x, y, LV(tn))
        # 줄기 겉 테두리(어두운 붉은색)
        for x in (x0 - 1, x0 + wd):
            if g[y][x] is not None and g[y][x][0] == RAMP[0]: put(x, y, LV(0) if letter != 'A' else LV(1))
    # 줄기 끝 덩이
    ye, xe, _ = path[-1]
    for dx, dy, tn in ((-1, 1, 1), (0, 1, 2), (1, 1, 2), (2, 1, 1), (0, 2, 1), (1, 2, 1)):
        x = int(round(xe)) + dx; y = ye + dy
        if g[y][x] is not None and g[y][x][0] == RAMP[0]: put(x, y, LV(tn))
    # ---- 분화구 테(윗면 타원) ----
    rx = top + 1
    for y in range(yc - ry - 1, yc + ry + 2):
        for x in range(cx - rx - 1, cx + rx + 2):
            e = ((x - cx) / (rx + .3)) ** 2 + ((y - yc) / (ry + .3)) ** 2
            if e <= 1.0:
                inner = ((x - cx) / (rx - 2.2)) ** 2 + ((y - yc - .3) / (ry - 1.4)) ** 2
                if inner <= 1.0:
                    # 용암 못: 가운데 밝게
                    d = math.sqrt(inner)
                    gl = c['glow']
                    tn = gl[2] if d < .45 else (gl[1] if d < .8 else gl[0])
                    if (x + y) % 4 == 0 and d < .8: tn = min(5, tn + 1)
                    put(x, y, LV(tn))
                else:
                    # 테: 윗쪽·왼쪽이 밝다
                    if e > .82: tn = 0
                    else:
                        tn = hi if (x < cx and y <= yc) else (mid if y <= yc else lo)
                        if y > yc: tn = mid if x < cx else lo
                    put(x, y, WA(tn))
    # 분화구 앞 입술 위로 줄기 시작 흠
    put(cx + 2, yc + ry, LV(2)); put(cx + 3, yc + ry, LV(2))
    # ---- 연기 ----
    for (sx_, sy, r, kind) in c['smoke']:
        for y in range(sy - r, sy + r + 1):
            for x in range(sx_ - r, sx_ + r + 1):
                d = math.hypot(x - sx_, (y - sy) * 1.1)
                if d > r + .3: continue
                lit = (x - sx_) + (y - sy)          # 왼위가 밝다
                if kind == 'c':                     # A: 낮은 대비
                    tn = CN(4) if lit < -r * .4 else (CN(3) if lit < r * .5 else CN(2))
                elif kind == 'w':                   # B: 밝게, 밑은 회색
                    tn = WH(3) if lit < -r * .5 else (WH(1) if lit < r * .4 else GN(2))
                else:                               # C: 화강 회색 3단
                    tn = WH(2) if lit < -r * .5 else (GN(4) if lit < r * .5 else GN(2))
                put(x, y, tn)
    # ---- 그림자(오른쪽 아래) ----
    xs = [x for x in range(W_) if g[29][x] is not None or g[28][x] is not None]
    lo_x, hi_x = min(xs), max(xs)
    if c['shadow'] in ('B', 'C'):
        for x in range(lo_x + 12, min(W_, hi_x + 2)):
            if g[30][x] is None: g[30][x] = '~'
        for x in range(lo_x + 16, min(W_, hi_x + 1)):
            if g[31][x] is None: g[31][x] = '-'
    else:
        for x in range(lo_x + 14, min(W_, hi_x + 1)):
            if g[30][x] is None: g[30][x] = '-'
    if c['shadow'] == 'B':
        rx2 = top + 1
        for y in range(yc - ry - 3, yc - ry + 1):
            for x in range(cx - rx2 + 1, cx + rx2):
                if g[y][x] is None and (x + y) % 2 == 0: g[y][x] = '%'
    return g

if __name__ == '__main__':
    for k in (sys.argv[1] if len(sys.argv) > 1 else 'ABC'):
        open(os.path.join(BASE, 'volcano', f'wv4-{k}.pxg'), 'w').write(to_pxg(build(k), f'volcano wv4-{k}'))

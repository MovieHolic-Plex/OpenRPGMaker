"""조선 데모 칩셋 — 코드 도트 도구와 팔레트.

버들항(city_v6)과 같은 규칙: 16px 칸, 3/4 정면 시점, 빛은 왼쪽 위, 색 램프(어두움→밝음)와 1px 얼룩.
버들항의 땅 램프(잎·물·돌·나무·회벽)는 그대로 가져오고, 조선 소재(기와·황토·단청)만 새 램프로 더한다.
"""
import numpy as np

T = 16

def hx(c):
    return tuple(int(c[i:i + 2], 16) for i in (1, 3, 5))

# 램프: [외곽선, 어두움 1~6 밝음]. 앞 5개 소재는 버들항 RAMPS_CHIP/OUT_CHIP 값 그대로.
R = {
    'wood':   ['#1b1024', '#312210', '#452a17', '#633712', '#6f4725', '#885a26', '#b77541'],
    'stone':  ['#1c2626', '#2b3934', '#3e403d', '#595b58', '#929491', '#c4c6c3', '#dee0dd'],
    'water':  ['#071528', '#143a27', '#1c4a44', '#21584e', '#3fa2ae', '#7d98a2', '#a7d4db'],
    'leaf':   ['#071528', '#143a27', '#205030', '#4b8232', '#58a035', '#73b83e', '#8fd24a'],
    'plaster': ['#2b203f', '#51283d', '#9e8d83', '#bcaaa0', '#d9d2be', '#ecd6c6', '#f7fdff'],
    'thatch': ['#312210', '#452a17', '#714210', '#845c1f', '#aa7a08', '#c9a24a', '#ecdb95'],
    'red':    ['#2b203f', '#562945', '#9e2514', '#a40100', '#dd2912', '#e0482a', '#ec9900'],
    # 조선 새 램프 — 그림자는 차갑게(보라·청), 빛은 따뜻하게
    'giwa':   ['#0e111a', '#1a1f2b', '#2a3140', '#3d4757', '#566174', '#7c879b', '#aab4c4'],
    'earth':  ['#2a1c14', '#3b2918', '#5a3f26', '#7d5a38', '#a07a4e', '#c29a68', '#dcbb88'],
    'green':  ['#0a1c1a', '#0f2a24', '#17463a', '#1f6652', '#2f8a6c', '#4fb08a', '#8adcb0'],
    'blue':   ['#0a1230', '#10204a', '#1a3470', '#274c9a', '#3a6cc4', '#6a98e0', '#a8c8f4'],
    'orange': ['#3a1408', '#7a2a10', '#b84a14', '#e0701c', '#f0902c', '#f8b04c', '#fcd070'],
    'pine':   ['#071528', '#0f2a24', '#17402c', '#235a34', '#2f7a3c', '#46984a', '#6ab45c'],
}
RGB = {k: [hx(c) for c in v] for k, v in R.items()}


def hsh(x, y, s=0):
    h = (x * 73856093) ^ (y * 19349663) ^ (s * 83492791)
    h ^= h >> 13
    h = (h * 0x5bd1e995) & 0xffffffff
    h ^= h >> 15
    return h & 0xffff


def rnd(x, y, s=0):
    return hsh(x, y, s) / 65535.0


class Cv:
    """RGBA 캔버스. 좌표는 (x, y), y 는 아래로."""

    def __init__(s, w, h):
        s.w, s.h = w, h
        s.a = np.zeros((h, w, 4), np.uint8)

    def put(s, x, y, c, al=255):
        if 0 <= x < s.w and 0 <= y < s.h:
            s.a[y, x, :3] = c
            s.a[y, x, 3] = al

    def get(s, x, y):
        return tuple(s.a[y, x])

    def rect(s, x0, y0, x1, y1, c):
        """x0..x1-1, y0..y1-1"""
        for y in range(max(0, y0), min(s.h, y1)):
            for x in range(max(0, x0), min(s.w, x1)):
                s.a[y, x, :3] = c
                s.a[y, x, 3] = 255

    def hl(s, x0, x1, y, c):
        s.rect(x0, y, x1, y + 1, c)

    def vl(s, x, y0, y1, c):
        s.rect(x, y0, x + 1, y1, c)

    def paste(s, o, x, y):
        for yy in range(o.h):
            for xx in range(o.w):
                p = o.a[yy, xx]
                if p[3] == 0:
                    continue
                X, Y = x + xx, y + yy
                if 0 <= X < s.w and 0 <= Y < s.h:
                    if p[3] == 255:
                        s.a[Y, X] = p
                    else:
                        q = s.a[Y, X].astype(float)
                        al = p[3] / 255.0
                        s.a[Y, X, :3] = (q[:3] * (1 - al) + p[:3] * al).astype(np.uint8)
                        s.a[Y, X, 3] = max(q[3], p[3])

    def hflip(s):
        o = Cv(s.w, s.h)
        o.a = s.a[:, ::-1].copy()
        return o

    def img(s):
        from PIL import Image
        return Image.fromarray(s.a, 'RGBA')


def fillpoly(cv, pts, fn):
    """다각형 안쪽 화소마다 fn(x, y) -> 색 또는 None. 스캔라인."""
    ys = [p[1] for p in pts]
    for y in range(min(ys), max(ys) + 1):
        xs = []
        n = len(pts)
        for i in range(n):
            (x0, y0), (x1, y1) = pts[i], pts[(i + 1) % n]
            if y0 == y1:
                continue
            if min(y0, y1) <= y < max(y0, y1):
                xs.append(x0 + (y - y0) * (x1 - x0) / (y1 - y0))
        xs.sort()
        for i in range(0, len(xs) - 1, 2):
            for x in range(int(round(xs[i])), int(round(xs[i + 1]))):
                c = fn(x, y)
                if c is not None:
                    cv.put(x, y, c)


def speck(cv, x0, y0, x1, y1, base, ramp, i, s=0, lo=0.18, hi=0.1):
    """base 위에 같은 램프의 한 단 어두운/밝은 1px 얼룩."""
    r = RGB[ramp]
    for y in range(y0, y1):
        for x in range(x0, x1):
            v = rnd(x, y, s)
            if v < lo:
                cv.put(x, y, r[max(1, i - 1)])
            elif v > 1 - hi:
                cv.put(x, y, r[min(6, i + 1)])
            else:
                cv.put(x, y, r[i])

"""조선 데모 칩셋 — 코드 도트 도구와 팔레트.

버들항(city_v6)과 같은 규칙: 16px 칸, 3/4 정면 시점, 빛은 왼쪽 위, 색 램프(어두움→밝음)와 1px 얼룩.
버들항의 땅 램프(잎·물·돌·나무·회벽)는 그대로 가져오고, 조선 소재(기와·황토·단청)만 새 램프로 더한다.
"""
import numpy as np

T = 16

def hx(c):
    return tuple(int(c[i:i + 2], 16) for i in (1, 3, 5))

# 팔레트는 harness/palette.json(버들항 시트에서 잠금)만 쓴다. 이 파일에 색을 직접 적지 않는다.
import json as _json, os as _os
_PAL = _json.load(open(_os.path.join(_os.path.dirname(__file__), 'harness', 'palette.json')))
R = dict(_PAL['ramps'])
R['thatch'] = R['straw']          # 초가·멍석·새끼줄
R['green'] = R['dgreen']          # 단청 녹
R['blue'] = R['dblue']            # 단청 청
R['orange'] = R['persimmon']      # 감
RGB = {k: [hx(c) for c in v] for k, v in R.items()}
ALLOWED = {hx(c) for c in _PAL['allowed']}
SHADOW = hx(_PAL['shadow'])
VIOLATIONS = {}                   # 허용 밖 색 -> 화소 수 (게이트가 읽는다)


def _chk(c):
    c = tuple(int(v) for v in c[:3])
    if c not in ALLOWED:
        VIOLATIONS[c] = VIOLATIONS.get(c, 0) + 1


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
            _chk(c)
            s.a[y, x, :3] = c
            s.a[y, x, 3] = al

    def get(s, x, y):
        return tuple(s.a[y, x])

    def rect(s, x0, y0, x1, y1, c):
        """x0..x1-1, y0..y1-1"""
        _chk(c)
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

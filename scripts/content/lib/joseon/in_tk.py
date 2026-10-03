"""조선 실내 조각 공통 도구 (접두 in_).

기존 tk.py(팔레트 잠금·Cv)·build.py(inset 외곽선)·props5.py(상자·원통·옹기) 위에 얹는다. 색은 tk.RGB 램프로만 고른다.
시점은 실내 v5(atlas_biome_interior)와 같다: 정면-위 3/4, 빛은 왼쪽 위, 윗면은 3~6px, 앞면은 전체 높이.
가구 목재는 마루 바닥(wood 3·4 단)보다 한 단 밝게(5·6 단) 그려 바닥에 묻히지 않게 한다.
"""
from tk import *
import build as B

WD, ER, PL, ST, GI, RD, SW, PS, DG, DB = (RGB[k] for k in ('wood', 'earth', 'plaster', 'stone', 'giwa', 'red', 'straw', 'persimmon', 'dgreen', 'dblue'))
LF = RGB['leaf']

_SNAP = {}


def dark(c, f):
    """색 c 를 f 배(0~1) 어둡게 한 뒤 잠긴 팔레트에서 가장 가까운 색으로."""
    k = (tuple(c[:3]), round(f, 3))
    if k not in _SNAP:
        _SNAP[k] = B._snap_dark(tuple(int(v * f) for v in c[:3]))
    return _SNAP[k]


_REV = {}
for _k, _v in RGB.items():
    if _k in ('thatch', 'green', 'blue', 'orange'):
        continue
    for _i, _c in enumerate(_v):
        _REV.setdefault(tuple(_c), []).append((_k, _i))


def step(c, n=1, prefer=None):
    """색 c 를 같은 램프에서 n 단 어둡게(n<0 이면 밝게). 램프에 없는 색이면 dark() 로."""
    c = tuple(int(v) for v in c[:3])
    hits = _REV.get(c)
    if not hits:
        return dark(c, 0.8 ** n)
    hit = next((h for h in hits if h[0] == prefer), hits[0])
    ramp = RGB[hit[0]]
    return tuple(ramp[max(0, min(6, hit[1] - n))])


def mk(w, h):
    return Cv(w, h)


def tile(cv, x, y):
    """cv 의 (x,y) 칸(16×16)을 새 Cv 로 잘라 낸다."""
    t = Cv(T, T)
    t.a = cv.a[y * T:(y + 1) * T, x * T:(x + 1) * T].copy()
    return t


def r_(cv, x, y, w, h, c):
    """x,y 에서 w×h 사각형."""
    cv.rect(x, y, x + w, y + h, c)


def fillrow(cv, x0, x1, y, cols):
    for x in range(x0, x1):
        cv.put(x, y, cols[(x - x0) % len(cols)])


def block(cv, x, y, w, top_d, front_h, ramp=WD, top=(6, 5), face=(5, 4, 3), lip=None, out=True):
    """3/4 직육면체: 윗면 top_d 줄 + 앞면 front_h 줄. (x,y) = 윗면 왼쪽 위.
    윗면은 맨 윗줄·왼쪽 끝이 가장 밝고, 앞면은 왼쪽 밝음 → 오른쪽 어두움, 맨 아랫줄 그림자."""
    for r in range(top_d):
        for c in range(w):
            t = top[0] if (r == 0 or c == 0) else top[1]
            if r == top_d - 1 and top_d > 2:
                t = top[1]
            cv.put(x + c, y + r, ramp[t])
    if lip is not None and top_d >= 2:
        for c in range(w):
            cv.put(x + c, y + top_d - 1, ramp[lip])
    for r in range(front_h):
        for c in range(w):
            f = c / max(1, w - 1)
            t = face[0] if f < 0.3 else (face[1] if f < 0.75 else face[2])
            if r == 0:
                t = min(6, t + 1) if f < 0.3 else t
            if r == front_h - 1:
                t = max(1, t - 2)
            cv.put(x + c, y + top_d + r, ramp[t])


def rim(cv, x0, y0, x1, y1, c):
    """사각형 테두리 1px."""
    cv.hl(x0, x1, y0, c); cv.hl(x0, x1, y1 - 1, c); cv.vl(x0, y0, y1, c); cv.vl(x1 - 1, y0, y1, c)


def speck_rect(cv, x0, y0, x1, y1, ramp, idx, s=0, lo=0.14, hi=0.06):
    r = ramp
    for y in range(y0, y1):
        for x in range(x0, x1):
            q = rnd(x, y, s)
            if q < lo:
                cv.put(x, y, r[max(0, idx - 1)])
            elif q > 1 - hi:
                cv.put(x, y, r[min(6, idx + 1)])
            else:
                cv.put(x, y, r[idx])


def grain(cv, x0, y0, x1, y1, ramp, idx, s=0, n=0.10):
    """가로 결: 2~3px 짧은 줄을 드문드문 한 단 어둡게."""
    for y in range(y0, y1):
        for x in range(x0, x1):
            if rnd(x // 3, y, s) < n and cv.a[y, x, 3] == 255:
                cv.put(x, y, ramp[idx])


def under_shadow(cv, x0, x1, y, c):
    """가구 밑 접지 그림자 1줄(불투명 어두운 색)."""
    cv.hl(x0, x1, y, c)


def line(cv, x0, y0, x1, y1, c):
    dx, dy = abs(x1 - x0), abs(y1 - y0)
    sx = 1 if x0 < x1 else -1
    sy = 1 if y0 < y1 else -1
    err = dx - dy
    while True:
        cv.put(x0, y0, c)
        if x0 == x1 and y0 == y1:
            break
        e2 = 2 * err
        if e2 > -dy:
            err -= dy; x0 += sx
        if e2 < dx:
            err += dx; y0 += sy


def disc(cv, cx, cy, r, c):
    for y in range(int(cy - r) - 1, int(cy + r) + 2):
        for x in range(int(cx - r) - 1, int(cx + r) + 2):
            if (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r:
                cv.put(x, y, c)


def outline(cv):
    B.outline(cv)

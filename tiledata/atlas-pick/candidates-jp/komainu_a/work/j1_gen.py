import sys, os, math
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../house_roof/work'))
from j1_lib import C
ROOT = os.path.join(os.path.dirname(__file__), '../..')
W, H = 16, 32
L = (-0.55, -0.6, 0.58)

def ell_shape(c, cx, cy, rx, ry, ramp='ishi', gain=3.0, mid=2.6, lo=1, hi=5, only=None, mask=None):
    """정수 칸에 타원을 채우며 왼쪽 위 빛으로 단을 정한다(난수 없음)."""
    for y in range(c.H):
        for x in range(c.W):
            nx = (x - cx) / rx; ny = (y - cy) / ry
            d = nx * nx + ny * ny
            if d > 1.0: continue
            nz = math.sqrt(max(0.0, 1 - d))
            lam = -(nx * L[0] + ny * L[1]) * 0 + (L[0] * nx + L[1] * ny) * -1 * -1
            lam = -(L[0] * nx + L[1] * ny) * -1
            lam = (L[0] * nx + L[1] * ny) * -1 + L[2] * nz
            t = int(round(mid + gain * (lam - 0.55)))
            t = max(lo, min(hi, t))
            if mask and not mask(x, y): continue
            c.px(x, y, ramp, t)

def outline(c, tone=0, ramp='ishi', only_ramps=('ishi',)):
    todo = []
    for y in range(c.H):
        for x in range(c.W):
            v = c.at(x, y)
            if v is None: continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                if c.at(x + dx, y + dy) is None and 0 <= x + dx < c.W and 0 <= y + dy < c.H + 1:
                    todo.append((x, y)); break
    for x, y in todo:
        v = c.at(x, y)
        if isinstance(v, tuple) and v[0] in only_ramps: c.px(x, y, v[0], max(0, min(v[1], 2) - 2 + tone))

def outline_out(c, tone=0):
    """외곽 바깥 한 줄에 어두운 선을 두른다(빈 칸 → 선)."""
    add = []
    for y in range(c.H):
        for x in range(c.W):
            if c.at(x, y) is not None: continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                v = c.at(x + dx, y + dy)
                if isinstance(v, tuple) and v[0] in ('ishi', 'moss'):
                    add.append((x, y)); break
    for x, y in add: c.px(x, y, 'ishi', tone)

def pedestal(c, strong, y0=24, moss=True):
    top_t = 5 if strong else 4
    c.rect(0, y0, 16, 2, 'ishi', top_t)              # 윗면
    c.hl(0, y0, 16, 'ishi', 6 if strong else 5)
    c.rect(0, y0 + 2, 16, 5, 'ishi', 3)              # 앞면
    c.vl(0, y0 + 2, 5, 'ishi', 4); c.vl(1, y0 + 2, 5, 'ishi', 4)
    c.vl(14, y0 + 2, 5, 'ishi', 2); c.vl(15, y0 + 2, 5, 'ishi', 1)
    c.hl(0, y0 + 2, 16, 'ishi', 2)                   # 처마 그늘
    c.hl(0, y0 + 7, 16, 'ishi', 1)                   # 밑단
    if strong:
        c.hl(0, y0 + 3, 16, 'ishi', 2)
        c.hl(2, y0 + 6, 13, 'ishi', 2)
    if moss:
        for (x, y, t) in ((2, y0 + 6, 2), (3, y0 + 6, 3), (4, y0 + 6, 2), (3, y0 + 5, 2), (11, y0 + 6, 2), (12, y0 + 6, 1), (12, y0 + 5, 2)):
            c.px(x, y, 'moss', t)

def komainu(open_mouth, right, strong, horn=False, style='A'):
    c = C(W, H)
    f = (lambda x: x) if right else (lambda x: 15 - x)
    g = 3.6 if strong else 2.6
    pedestal(c, strong)
    # 꼬리(불꽃 모양) — 뒤쪽
    tx = f(2)
    ell_shape(c, tx, 17, 2.6, 5.0, gain=g)
    ell_shape(c, f(1) if right else f(1), 13, 1.8, 2.8, gain=g)
    # 엉덩이·몸통
    ell_shape(c, f(6), 19, 4.6, 5.0, gain=g)
    ell_shape(c, f(9), 16, 4.4, 5.6, gain=g)
    # 앞다리
    for lx in ((10, 11), (13, 14)) if right else ((5, 4), (2, 1)):
        a, b = min(lx), max(lx)
        for y in range(17, 24):
            for x in range(a, b + 1):
                t = 3 if x == a else 2
                if right and x == a: t = 4
                if (not right) and x == a: t = 4
                c.px(x, y, 'ishi', t)
        c.px(a, 23, 'ishi', 4); c.px(b, 23, 'ishi', 2)
    # 갈기 덩이
    for (mx, my, r) in ((4, 8, 3.0), (6, 5, 3.2), (9, 3.4, 3.0), (5, 12, 2.8), (7, 9, 3.4)):
        ell_shape(c, f(mx), my, r, r, gain=g, lo=2)
    # 머리(얼굴)
    ell_shape(c, f(11), 8.5, 4.4, 4.2, gain=g, lo=2)
    ell_shape(c, f(13), 11, 2.8, 2.2, gain=g, lo=2)          # 주둥이
    # 갈기 곱슬 무늬(진한 획)
    for (cx, cy) in ((4, 6), (6, 3), (5, 10), (7, 7)):
        for (dx, dy, t) in ((0, 0, 1), (1, 0, 1), (1, 1, 1), (0, 1, 2)):
            x = f(cx + dx)
            if c.at(x, cy + dy) is not None: c.px(x, cy + dy, 'ishi', t)
    # 눈·코·입
    ex = f(12); c.px(ex, 7, 'ishi', 0); c.px(f(11), 6, 'ishi', 1); c.px(f(12), 6, 'ishi', 1); c.px(f(13), 6, 'ishi', 1)
    c.px(f(15), 9, 'ishi', 0)                              # 코
    if open_mouth:
        for x in (12, 13, 14): c.px(f(x), 11, 'ishi', 0)
        for x in (12, 13, 14, 15): c.px(f(x), 12, 'ishi', 0)
        c.px(f(13), 11, 'ishi', 6); c.px(f(15), 11, 'ishi', 6)        # 위 어금니
        for x in (12, 13, 14): c.px(f(x), 13, 'ishi', 2)
        c.px(f(13), 13, 'ishi', 5); c.px(f(15), 13, 'ishi', 3)
    else:
        for x in (12, 13, 14, 15): c.px(f(x), 11, 'ishi', 0)
        for x in (12, 13, 14): c.px(f(x), 12, 'ishi', 2)
    if horn:
        c.px(f(11), 3, 'ishi', 5); c.px(f(11), 2, 'ishi', 6); c.px(f(11), 1, 'ishi', 6); c.px(f(12), 3, 'ishi', 3)
    outline_out(c)
    return c

def gen(k, right, mouth, horn, strong):
    return komainu(mouth, right, strong, horn)

if __name__ == '__main__':
    komainu(True, True, False).save('/tmp/j1_k_test.pxg')
    # 후보 출력
    D = os.path.join(os.path.dirname(__file__), '..')
    komainu(True, True, False).save(os.path.join(D, 'j1-A.pxg'))

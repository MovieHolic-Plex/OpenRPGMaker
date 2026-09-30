import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from j1_lib import C
OUT = os.path.dirname(os.path.dirname(__file__))
W, H = 64, 32
K = lambda t: ('kawara', t)

def eave(c, tones, y0=26, x0=0, x1=64, tail=None):
    hi, mid, lo, gap = tones
    for x in range(x0, x1):
        i = (x - x0) % 4
        c.px(x, y0, 'kawara', hi if i == 0 else mid if i < 3 else lo)
        c.px(x, y0 + 1, 'kawara', mid if i < 3 else lo)
        if i in (1, 2): c.px(x, y0 + 2, 'kawara', lo if i == 2 else mid)
        else: c.px(x, y0 + 2, 'sumi', gap)          # 둥근 기와 사이로 비치는 처마 널

def fascia(c, y, t, s1, s0):
    c.hl(0, y, W, 'sumi', t)
    c.hl(0, y + 1, W, 'mconc', s1); c.hl(0, y + 2, W, 'mconc', s0)

def courses(c, x0, x1, y0, tones, seamtone, litcols=0, litadd=0, yhi=None):
    for k, (hi, body, gr) in enumerate(tones):
        y = y0 + 4 * k
        for x in range(x0, x1):
            lit = litadd if (x - x0) < litcols else 0
            c.px(x, y, 'kawara', min(6, hi + lit)); c.px(x, y + 1, 'kawara', min(6, body + lit))
            c.px(x, y + 2, 'kawara', min(6, body + lit)); c.px(x, y + 3, 'kawara', gr)
        off = 3 if k % 2 else 0                     # 기와 세로 이음: 단마다 엇갈림
        for x in range(x0 + 3 + off, x1, 6):
            c.px(x, y + 1, 'kawara', seamtone); c.px(x, y + 2, 'kawara', seamtone)

def gable(c, left, tw, tr, top0, base, bar):
    """박공 삼각벽: 열 x 마다 위 가장자리가 4줄씩 내려간다. left=True 면 왼쪽(빛 받음)."""
    n = 5
    for i in range(n):
        x = i if left else W - 1 - i
        top = top0 + 4 * (n - 1 - i)
        for y in range(top, 26):
            if y < top + 2: c.px(x, y, 'sumi', bar)
            else: c.px(x, y, 'washi', tw if left else tr)
        if i % 2 == 0 and top + 2 < 25:                # 판벽 줄
            for y in range(top + 3, 26): c.px(x, y, 'hinoki', 2 if left else 1) if False else None

def A():
    c = C(W, H)
    # 용마루
    for x in range(5, 59):
        for y, t in ((1, 5), (2, 4), (3, 3), (4, 1)): c.px(x, y, 'kawara', t)
    for x in (5, 58): c.clear(x, 1)
    for x in range(9, 58, 8):
        for y in (1, 2, 3): c.px(x, y, 'kawara', 2)
    courses(c, 5, 59, 5, [(4, 3, 1)] * 5, 2)
    c.hl(5, 25, 54, 'kawara', 0)
    gable(c, True, 3, 1, 3, 0, 3); gable(c, False, 3, 1, 3, 0, 3)
    eave(c, (5, 4, 2, 1)); fascia(c, 29, 3, 1, 0)
    return c

def B():
    c = C(W, H)
    for x in range(5, 59):
        for y, t in ((1, 6), (2, 5), (3, 3), (4, 0)): c.px(x, y, 'kawara', t)
    for x in (5, 58): c.clear(x, 1)
    for x in range(9, 58, 8):
        for y in (1, 2, 3): c.px(x, y, 'kawara', 3)
    courses(c, 5, 59, 5, [(6, 5, 2), (5, 4, 2), (4, 3, 1), (3, 2, 1), (2, 1, 0)], 1, litcols=2, litadd=1)
    c.hl(5, 25, 54, 'kawara', 0)
    gable(c, True, 4, 0, 3, 0, 2); gable(c, False, 4, 0, 3, 0, 2)
    eave(c, (6, 4, 2, 0)); c.hl(0, 29, W, 'sumi', 2)
    c.hl(0, 30, W, '~'); c.hl(0, 31, W, '-')
    for x in range(W): c.px(x, 29, 'sumi', 1 if x >= 8 else 2)
    return c

def Cc():
    c = C(W, H)
    # 모임지붕: 용마루 짧고 양 끝 치미(오니가와라)
    for x in range(14, 50):
        for y, t in ((2, 5), (3, 4), (4, 3), (5, 1)): c.px(x, y, 'kawara', t)
    for (x0, s) in ((11, 1), (49, 1)):
        for y, t in ((0, 5), (1, 4), (2, 4), (3, 3), (4, 2), (5, 1)):
            w = 3 if y == 0 else 4
            for x in range(x0, x0 + w + (1 if y >= 3 else 0)): c.px(x, y, 'kawara', t)
        c.px(x0 + 1, 3, 'taxi', 3)
    # 옆 지붕면(빛 받는 왼쪽 밝게, 오른쪽 어둡게)와 앞 지붕면
    def ytop(x): return 3 + int(round((14 - x) * 9 / 14))
    def ydiag(x): return 25 - int(round(x * 22 / 14))
    for i in range(0, 14):
        for side in (0, 1):
            x = i if side == 0 else W - 1 - i
            for y in range(ytop(i), ydiag(i) + 1):
                row = (y - 3) % 4
                t = (3, 2, 2, 1)[row] if side == 0 else (2, 1, 1, 0)[row]
                c.px(x, y, 'kawara', t)
            c.px(x, ydiag(i), 'kawara', 0)                 # 내림마루선
    for y in range(6, 26):
        xl = 14 - int(round((y - 3) * 14 / 22)) if y >= 3 else 14
        xl = max(0, min(14, xl)); xr = W - 1 - xl
        k, r = divmod(y - 5, 4)
        t = (5, 4, 4, 1)[r] if y < 25 else 0
        for x in range(xl, xr + 1):
            if y > ydiag(x if x < 32 else W - 1 - x) - 1 or True: pass
    # 앞면: 대각선 아래 = 내림마루 안쪽
    for y in range(6, 26):
        r = (y - 5) % 4
        t = (5, 4, 4, 1)[r]
        if y == 25: t = 0
        for x in range(W):
            xm = x if x < 32 else W - 1 - x
            if y > ydiag(xm) - 0 or (xm >= 14 and y >= 6):
                if y >= ydiag(min(xm, 14)) + (0 if xm < 14 else 0):
                    c.px(x, y, 'kawara', t)
    for y in range(6, 25):
        r = (y - 5) % 4; k = (y - 5) // 4
        if r in (1, 2):
            for x in range(3 + (3 if k % 2 else 0), W, 6):
                if c.at(x, y) and c.at(x, y)[1] > 2: c.px(x, y, 'kawara', 3)
    eave(c, (5, 4, 2, 1)); fascia(c, 29, 3, 1, 0)
    return c

if __name__ == '__main__':
    for n, f in (('A', A), ('B', B), ('C', Cc)):
        f().save(os.path.join(OUT, f'j1-{n}.pxg'))

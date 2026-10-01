"""땅 칸: 잔디·흙길(16 이음)·마당·판석·시냇물(16 이음, 돌 둑)·논·밭."""
from tk import *

JIT = [1, 1, 2, 2, 2, 1, 1, 1, 2, 2, 1, 1, 1, 2, 2, 1]   # 양 끝이 같아 이웃 칸과 이어진다
N, E, S, W = 1, 2, 4, 8


def grass(v, base=None):
    c = Cv(T, T)
    r = RGB['leaf']
    for y in range(T):
        for x in range(T):
            q = rnd(x, y, 100 + v)
            col = r[4]
            if q < 0.20:
                col = r[3]
            elif q > 0.90:
                col = r[5]
            elif q > 0.985:
                col = r[6]
            c.put(x, y, col)
    # 풀잎 점 (2px 세로)
    for k in range(3):
        x, y = hsh(k, v, 7) % 15, hsh(v, k, 9) % 14
        c.put(x, y, r[5]); c.put(x, y + 1, r[3])
    if v == 1:   # 들꽃
        for x, y in ((4, 5), (11, 11)):
            c.put(x, y, hx('#f7fdff')); c.put(x + 1, y, hx('#ecdb95'))
    if v == 3:
        for x, y in ((9, 3),):
            c.put(x, y, hx('#e0482a')); c.put(x + 1, y + 1, hx('#ecdb95'))
    return c


def _edge_depth(mask, x, y):
    """바깥(풀) 쪽으로 열린 변마다 경계까지의 깊이를 돌려준다. 0 이면 길 안."""
    d = 0
    if not mask & N: d = max(d, JIT[x] + 1 - y)
    if not mask & S: d = max(d, JIT[x] + 1 - (T - 1 - y))
    if not mask & W: d = max(d, JIT[y] + 1 - x)
    if not mask & E: d = max(d, JIT[y] + 1 - (T - 1 - x))
    # 모서리 둥글림
    for (a, b, cx, cy) in ((N, W, x, y), (N, E, T - 1 - x, y), (S, W, x, T - 1 - y), (S, E, T - 1 - x, T - 1 - y)):
        if not mask & a and not mask & b and cx + cy < 3:
            d = max(d, 1)
    return d


def road(mask, v=0, ruts=True):
    """흙길. mask: 이어지는 쪽(N=1,E=2,S=4,W=8). 이어지지 않는 변은 풀밭으로 번진다."""
    c = Cv(T, T)
    e = RGB['earth']
    g = RGB['leaf']
    for y in range(T):
        for x in range(T):
            q = rnd(x, y, 200 + v)
            col = e[5]
            if q < 0.16: col = e[4]
            elif q > 0.93: col = e[6]
            # 수레바퀴 자국: 길 한가운데 어두운 두 줄
            if ruts and (mask & (E | W)) and y in (6, 9) and rnd(x, y, 5) < 0.55: col = e[4]
            if ruts and (mask & (N | S)) and x in (6, 9) and rnd(x, y, 6) < 0.55: col = e[4]
            d = _edge_depth(mask, x, y)
            if d > 0:
                if d == 1: col = e[3]                       # 길 가장자리 그늘
                elif d == 2: col = g[2]                      # 풀 그늘
                else: col = g[4] if rnd(x, y, 100) > 0.2 else g[3]
            c.put(x, y, col)
    # 자갈
    for k in range(2):
        x, y = 3 + hsh(k, mask, 3) % 10, 3 + hsh(mask, k, 4) % 10
        if _edge_depth(mask, x, y) == 0 and _edge_depth(mask, x + 1, y) == 0:
            c.put(x, y, RGB['stone'][4]); c.put(x + 1, y, RGB['stone'][3])
    return c


def yard(v):
    """마당(다진 흙, 이음 없음)."""
    c = Cv(T, T)
    e = RGB['earth']
    for y in range(T):
        for x in range(T):
            q = rnd(x, y, 300 + v)
            col = e[5]
            if q < 0.18: col = e[4]
            elif q > 0.92: col = e[6]
            c.put(x, y, col)
    for k in range(2 + v % 2):
        x, y = hsh(k, v, 13) % 14, hsh(v, k, 15) % 15
        c.put(x, y, RGB['stone'][4]); c.put(x + 1, y, RGB['stone'][3])
    return c


def paving(v):
    """판석(화강암 네모 돌)."""
    c = Cv(T, T)
    s = RGB['stone']
    for y in range(T):
        for x in range(T):
            q = rnd(x, y, 400 + v)
            col = s[5]
            if q < 0.2: col = s[4]
            elif q > 0.92: col = s[6]
            c.put(x, y, col)
    # 줄눈: 8×8 이 아니라 16×(8) 큰 돌 둘, 어긋나게
    off = 0 if v % 2 == 0 else 6
    c.hl(0, T, 0, s[3]); c.hl(0, T, 8, s[3])
    c.vl(off, 0, 8, s[3]); c.vl((off + 8) % T, 8, T, s[3])
    c.hl(0, T, 1, s[6]); c.hl(0, T, 9, s[6])
    return c


def stream(mask, v=0, tick=0):
    """시냇물. mask: 물이 이어지는 쪽. 이어지지 않는 변에는 돌 둑."""
    c = Cv(T, T)
    w = RGB['water']
    st = RGB['stone']
    g = RGB['leaf']
    for y in range(T):
        for x in range(T):
            col = w[3]
            q = rnd(x, y, 500 + v)
            if q < 0.22: col = w[2]
            d = _edge_depth(mask, x, y)
            if d > 0:
                # 바깥에서 안으로: 풀 그늘 → 돌 둑(윗면 밝고 앞면 어두움) → 물
                if d >= 4: col = g[4] if rnd(x, y, 100) > 0.2 else g[3]
                elif d == 3: col = g[2]
                elif d == 2: col = st[5] if rnd(x, y, 7) > 0.3 else st[4]
                else: col = st[3]
            else:
                # 둑 바로 옆은 어둡게
                near = _edge_depth(mask, x + (1 if not mask & E else 0) - (1 if not mask & W else 0), y + (1 if not mask & S else 0) - (1 if not mask & N else 0))
                if near > 0: col = w[2]
            c.put(x, y, col)
    # 잔물결(가로 2px 밝은 줄)
    for k in range(2):
        x, y = 2 + hsh(k, mask, v + 1) % 11, 3 + hsh(mask, k, v + 2) % 10
        if _edge_depth(mask, x, y) == 0 and _edge_depth(mask, x + 2, y) == 0:
            c.put(x, y, w[4]); c.put(x + 1, y, w[4]); c.put(x + 2, y, w[5])
    # 둑돌 사이 줄눈
    for y in range(T):
        for x in range(T):
            d = _edge_depth(mask, x, y)
            if d == 2 and (x + y * 3) % 5 == 0: c.put(x, y, st[3])
    return c


def paddy(v):
    """논(물 댄 논에 모가 줄지어)."""
    c = Cv(T, T)
    w = RGB['water']; g = RGB['leaf']
    for y in range(T):
        for x in range(T):
            c.put(x, y, w[4] if rnd(x, y, 600 + v) > 0.12 else w[3])
    for gy in (3, 10):
        for gx in (2, 7, 12):
            c.put(gx, gy, g[5]); c.put(gx, gy + 1, g[4]); c.put(gx - 1, gy + 1, g[3]); c.put(gx + 1, gy + 1, g[3]); c.put(gx, gy + 2, g[2])
    c.hl(0, T, 0, RGB['earth'][4]); c.hl(0, T, 15, RGB['earth'][4])
    return c


def field(v):
    """밭이랑."""
    c = Cv(T, T)
    e = RGB['earth']; g = RGB['leaf']
    for y in range(T):
        for x in range(T):
            col = e[3] if (y % 5) in (0, 1) else e[4]
            if (y % 5) == 0: col = e[2]
            if rnd(x, y, 700 + v) > 0.9: col = e[5]
            c.put(x, y, col)
    for y in (2, 7, 12):
        for x in range(1, T - 1, 3):
            c.put(x, y, g[5]); c.put(x + 1, y, g[4]); c.put(x, y - 1, g[4]); c.put(x + 1, y + 1, g[3])
    return c


def yard_edge(mask):
    """마당(수레 자국 없는 흙바닥 이음)."""
    return road(mask, v=3, ruts=False)


def paddy_edge(mask):
    """논: 물 댄 칸에 모가 줄지어 있고, 이어지지 않는 변에는 논두렁(흙둑)."""
    c = Cv(T, T)
    w = RGB['water']; g = RGB['leaf']; e = RGB['earth']
    for y in range(T):
        for x in range(T):
            col = w[3] if rnd(x, y, 610 + mask) > 0.16 else w[4]
            c.put(x, y, col)
    for gy in (3, 10):
        for gx in (2, 7, 12):
            c.put(gx, gy, g[5]); c.put(gx, gy + 1, g[4]); c.put(gx - 1, gy + 1, g[3]); c.put(gx + 1, gy + 1, g[3]); c.put(gx, gy + 2, g[2])
    for bit, sl in ((N, (lambda i: (i, 0), lambda i: (i, 1), lambda i: (i, 2))), (S, (lambda i: (i, 15), lambda i: (i, 14), lambda i: (i, 13))),
                    (W, (lambda i: (0, i), lambda i: (1, i), lambda i: (2, i))), (E, (lambda i: (15, i), lambda i: (14, i), lambda i: (13, i)))):
        if mask & bit:
            continue
        for i in range(T):
            (x0, y0), (x1, y1), (x2, y2) = sl[0](i), sl[1](i), sl[2](i)
            c.put(x0, y0, e[5] if rnd(i, bit, 3) > 0.3 else e[4]); c.put(x1, y1, e[4]); c.put(x2, y2, w[2])
    return c

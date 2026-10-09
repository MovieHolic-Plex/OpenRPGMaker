# 고대 숲 오토타일 (16변형): 이끼 번짐(lower)·덩굴(upper)·이끼 낀 낮은 돌담(fence)
from af_base import *
from af_base import _hash, _lumps
import numpy as np

def _edge_d(n, e, s, w):
    d = np.full((16, 16), 99.0)
    for y in range(16):
        for x in range(16):
            v = 99.0
            if not w: v = min(v, x + .5)
            if not e: v = min(v, 15.5 - x)
            if not n: v = min(v, y + .5)
            if not s: v = min(v, 15.5 - y)
            d[y, x] = v
    return d

def moss_cell(n, e, s, w, seed=3):
    """이끼 번짐 덮개(걷는 땅 위, 하층): 이웃 없는 가장자리로 갈수록 성기고 들쭉날쭉. 속 칸은 가득. 주기 16 잡음이라 이웃과 이어진다."""
    c = Cv(16, 16); d = _edge_d(n, e, s, w); iso = not (n or e or s or w)
    lump, _ = _lumps(16, 16, seed + 1, cell=4, rmin=1.6, rmax=2.6)
    for y in range(16):
        for x in range(16):
            if d[y, x] < 99:
                th = 2.0 + (vnoise(x, y, 4, seed + 3, per=4) - .5) * 4.6 + (_hash(x, y, seed) - .5) * 1.4
                if d[y, x] <= th: continue
            if iso:
                dx = (x + .5 - 8) / 5.6; dy = (y + .5 - 8) / 4.6 + (vnoise(x, y, 3, seed, per=5) - .5) * .5
                if dx * dx + dy * dy > 1: continue
            v = lump[y, x]
            t = 2 + int(v * 2.0) - (1 if _hash(x, y, seed + 5) < .16 else 0) + (1 if (x + y) < 10 and v > .7 else 0)
            if d[y, x] < 99 and d[y, x] < 3.4: 
                if _hash(x, y, seed + 6) < .30: continue          # 가장자리 성김
            c.px(x, y, FQ[cl(t + 2, 3, 6)])
    return c.im

def vine_cell(n, e, s, w, seed=5):
    """덩굴 덮개(상층, 걸을 수 있음): 늘어진 줄기 + 잎 뭉치. 이웃 없는 쪽은 성기고 줄기가 가늘게 늘어진다. 잡음이 16 주기라 이웃과 끊김 없이 이어진다."""
    c = Cv(16, 16); d = _edge_d(n, e, s, w); iso = not (n or e or s or w)
    stems = [x for x in range(16) if _hash(x, 0, seed + 20) < .34]
    for y in range(16):
        for x in range(16):
            edge = d[y, x] < 99
            th = 2.4 + (vnoise(x, y, 4, seed + 3, per=4) - .5) * 5.2 if edge else -1
            if edge and d[y, x] <= th: continue
            v = vnoise(x, y, 4, seed + 4, per=4) * .6 + vnoise(x, y, 2, seed + 5, per=8) * .4
            if iso:
                dx = (x + .5 - 8) / 5.0; dy = (y + .5 - 8) / 4.4 + (vnoise(x, y, 3, seed, per=5) - .5) * .6
                if dx * dx + dy * dy > 1: continue
            dens = .52 + (.0 if not edge else min(.2, (d[y, x] - th) * .05))
            if v < 1 - dens and _hash(x, y, seed + 7) < .75: continue
            t = 2 + int(v * 3.0) + (1 if (x + y) % 4 == 0 and v > .5 else 0) + (1 if y % 16 < 6 else 0)
            c.px(x, y, ANC[cl(t, 1, 6)] if _hash(x, y, seed + 9) > .06 else LEAF[6])
    for x in stems:                                    # 줄기: 칸 전체 높이로 이어진다
        for y in range(16):
            if edge_ok(d, x, y) and (c.p[x, y][3] == 0 or True):
                c.px(x, y, LEAF[2] if (y + x) % 3 else LEAF[3])
                if y % 5 == 2 and x > 0: c.px(x - 1, y, LEAF[4])
                if y % 5 == 4 and x < 15: c.px(x + 1, y, LEAF[3])
    return pz.fin(c.im, .66)

def edge_ok(d, x, y):
    return d[y, x] >= 99 or d[y, x] > 1.0 + (_hash(x, 3, 91) * 5.0 if d[y, x] < 99 else 0)

def ruinwall_cell(n, e, s, w, seed=7):
    """이끼 낀 낮은 돌담 (울타리 역할, 모두 막힘). 3/4: 윗면(밝음) + 앞면 6줄. 이웃 방향으로 팔이 뻗는다."""
    c = Cv(16, 16); st = MOSSROCK
    top = np.zeros((16, 16), bool)
    x0, x1, y0, y1 = 4, 12, 1, 8
    top[y0:y1, x0:x1] = True
    if n: top[0:y0, x0:x1] = True
    if s: top[y1:16, x0:x1] = True
    if e: top[y0:y1, x1:16] = True
    if w: top[y0:y1, 0:x0] = True
    if s:   # 남쪽 이웃과 이어질 때 윗면은 계속 이어지고, 칸 안 아래쪽 아주 끝까지 윗면
        top[y1:16, x0:x1] = True
    # 앞면: 윗면 아래가 윗면 아님 → 6줄 앞면
    face = np.zeros((16, 16), bool)
    FH = 6
    for y in range(16):
        for x in range(16):
            if top[y, x] and (y + 1 >= 16 or not top[y + 1, x]):
                for k in range(1, FH + 1):
                    if y + k < 16 and not top[y + k, x]: face[y + k, x] = True
    for y in range(16):
        for x in range(16):
            if top[y, x]:
                k = 5 if (y == 0 or not top[y - 1, x]) else 4
                if x == 0 or not top[y, x - 1]: k = 6 if k == 5 else 5
                if _hash(x, y, seed) < .1: k += 1 if _hash(y, x, 2) < .5 else -1
                c.px(x, y, st[cl(k, 3, 6)])
            elif face[y, x]:
                fy = 0
                yy = y
                while yy - 1 >= 0 and face[yy - 1, x]: yy -= 1; fy += 1
                k = 4 - (1 if fy >= 3 else 0) - (1 if fy >= 5 else 0)
                row = (y + (x // 8) * 4) % 6
                if (x + 4 * (y // 3)) % 8 == 0: k -= 1
                if (x == 0 or not (top[y, x - 1] or face[y, x - 1])): k += 1
                if (x == 15 or not (top[y, x + 1] or face[y, x + 1])): k -= 1
                if _hash(x, y, seed + 3) < .08: k += 1 if _hash(y, x, 4) < .5 else -1
                c.px(x, y, st[cl(k, 1, 5)])
    # 윗면 줄눈
    for y in range(16):
        for x in range(16):
            if top[y, x] and (x + (y // 3) * 5) % 9 == 0 and y not in (0,) and not (y > 0 and not top[y - 1, x]): c.px(x, y, st[2])
    im = fin(c, .6)
    # 이끼는 윗면에 덩이로 (이웃과 이어지게 칸 좌표 대신 16 주기 해시)
    p = im.load()
    for y in range(16):
        for x in range(16):
            if p[x, y][3] and top[y, x] and vnoise(x, y, 4, seed + 31, per=4) > .56:
                p[x, y] = tuple(LEAF[cl(3 + int(vnoise(x, y, 2, seed + 32, per=8) * 2.4), 2, 5)]) + (255,)
            elif p[x, y][3] and face[y, x] and y > 8 and _hash(x, y, seed + 33) < .05: p[x, y] = tuple(LEAF[3]) + (255,)
    return im

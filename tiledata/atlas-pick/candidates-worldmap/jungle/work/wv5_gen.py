"""jungle wv5 — 밀림 A/B/C. 숲과 같은 수관 결(도장 표)을 어둡고 짙게, 야자 잎 별꼴을 섞어 윤곽을 들쭉날쭉하게."""
import os, sys, importlib.util
HERE0 = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE0, '..', '..', 'forest', 'work'))
from wv5lib import *
spec = importlib.util.spec_from_file_location('forest_gen', os.path.join(HERE0, '..', '..', 'forest', 'work', 'wv5_gen.py'))
fg = importlib.util.module_from_spec(spec); spec.loader.exec_module(fg)
OUT = os.path.join(HERE0, '..')
BK = fg.BK
# 숲 수관 숫자(0~5) -> 밀림 색: 테는 wleaf 0/1, 속은 wmead 짙은 단
TONE = {0: ('wleaf', 0), 1: ('wleaf', 1), 2: ('wmead', 0), 3: ('wmead', 1), 4: ('wmead', 2), 5: ('wmead', 3)}
def recolor(st, tone=TONE):
    px = {k: (tone[v[1]] if v[0] == 'wleaf' else v) for k, v in st['px'].items()}
    return dict(w=st['w'], h=st['h'], px=px, anchor=st['anchor'])

def line(a, b, ctrl, n=14):
    pts = []
    for i in range(n + 1):
        t = i / n
        x = (1 - t) ** 2 * a[0] + 2 * (1 - t) * t * ctrl[0] + t * t * b[0]
        y = (1 - t) ** 2 * a[1] + 2 * (1 - t) * t * ctrl[1] + t * t * b[1]
        p = (round(x), round(y))
        if not pts or pts[-1] != p: pts.append(p)
    return pts

def star(fronds, W=11, H=11, c=(5, 5), light=4, mid=3, dark=1, hub=2, rim=('wleaf', 0), w0=3):
    """야자 잎 별꼴. fronds=[(끝점, 굽힘점)]. 허브에서 끝으로 가늘어지는 잎, 윗면 밝고 밑면 어둡고, 아래에 가장 어두운 테."""
    px = {}
    def put(x, y, v, over=False):
        if 0 <= x < W and 0 <= y < H and (over or (x, y) not in px): px[(x, y)] = v
    for (tip, ctrl) in fronds:
        pts = line(c, tip, ctrl, 20)
        n = len(pts)
        for i, (x, y) in enumerate(pts):
            th = max(1, round(w0 * (1 - i / n) + 0.4))
            vert = abs(tip[1] - c[1]) <= abs(tip[0] - c[0]) + 1     # 옆으로 뻗은 잎은 세로로 두껍다
            for k in range(th):
                if vert:
                    off = k - (th - 1) // 2
                    v = light if (k == 0 and th > 1) or th == 1 else (dark if k == th - 1 else mid)
                    put(x, y + off, ('wmead', v))
                else:
                    off = k - (th - 1) // 2
                    v = light if k == 0 else (dark if k == th - 1 else mid)
                    put(x + off, y, ('wmead', v))
    for dx in (-1, 0, 1):
        for dy in (-1, 0, 1): put(c[0] + dx, c[1] + dy, ('wmead', hub if (dx + dy) <= 0 else dark), over=True)
    put(c[0] - 1, c[1] - 1, ('wmead', light), over=True)
    for (x, y) in list(px):
        if (x, y + 1) not in px and px[(x, y)][1] >= 2: put(x, y + 1, rim)
        if (x + 1, y) not in px and px[(x, y)][1] <= 2: put(x + 1, y, rim)
    return dict(w=W, h=H, px=px, anchor=c)

# 5갈래: 왼 처짐 · 왼위 · 위 · 오른위 · 오른 처짐
STAR1 = star([((0, 6), (1, 3)), ((1, 1), (2, 3)), ((5, 0), (5, 2)), ((9, 1), (8, 3)), ((10, 6), (9, 3))], light=4, mid=3, dark=1)
STAR2 = star([((0, 5), (1, 2)), ((2, 0), (3, 3)), ((6, 0), (6, 2)), ((10, 2), (8, 3)), ((10, 7), (9, 4))], light=4, mid=3, dark=1)
STAR3 = star([((0, 7), (1, 3)), ((1, 0), (3, 4)), ((5, 0), (4, 2)), ((9, 0), (7, 4)), ((10, 5), (9, 2))], light=3, mid=2, dark=1)
J1, J2, J3 = recolor(fg.A1), recolor(fg.A2), recolor(fg.A3)
# 밀림은 줄기가 가늘고 휜다: 1px 두 칸 -> 옆으로 한 칸 비껴 내려간다
def trunkJ(cv, x, y, xb, yb):
    d = 1 if ((x // 8) + (y // 8)) % 2 else -1
    cv.put(x, y + 5, BK['q']); cv.put(x, y + 6, BK['p']); cv.put(x + d, y + 7, BK['s'])
ROWS = [(4, [4, 12]), (12, [0, 8])]
def P4(a, b, c, d): return lambda xb, yb: {(4, 4): a, (12, 4): b, (0, 12): c, (8, 12): d}[(xb, yb)]
# A : 둥근 수관과 별꼴이 엇갈려 섞임
pickA, pickA2 = P4(J1, STAR1, STAR2, J2), P4(STAR2, J3, J1, STAR3)
isoA = [(J1, 4, 5), (STAR1, 11, 5), (J2, 8, 10)]

# B : 깊이 — 별꼴 위주로 빽빽, 아주 짙은 바탕
BJ1 = recolor(fg.B1, {0: ('wleaf', 0), 1: ('wleaf', 0), 2: ('wleaf', 1), 3: ('wmead', 0), 4: ('wmead', 1), 5: ('wmead', 3)})
BJ2 = recolor(fg.B2, {0: ('wleaf', 0), 1: ('wleaf', 0), 2: ('wleaf', 1), 3: ('wmead', 0), 4: ('wmead', 1), 5: ('wmead', 3)})
STARB = star([((0, 6), (1, 3)), ((1, 1), (2, 3)), ((5, 0), (5, 2)), ((9, 1), (8, 3)), ((10, 6), (9, 3))], light=4, mid=3, dark=1, hub=3, w0=4)
STARB2 = star([((0, 5), (1, 2)), ((2, 0), (3, 3)), ((6, 0), (6, 2)), ((10, 2), (8, 3)), ((10, 7), (9, 4))], light=4, mid=3, dark=1, hub=3, w0=4)
pickB, pickB2 = P4(STARB, BJ1, BJ2, STARB2), P4(BJ2, STARB2, STARB, BJ1)
isoB = [(STARB, 4, 5), (BJ1, 11, 5), (STARB2, 8, 10)]

# C : 다른 해석 — 바나나잎: 넓적한 잎 세 장이 부채꼴로 처지는 수관
def leafy(tips, c=(5, 5)):
    st = star(tips, light=4, mid=3, dark=1, hub=2, w0=4)
    return st
LC1 = leafy([((0, 7), (0, 3)), ((2, 0), (2, 3)), ((7, 0), (6, 3)), ((10, 7), (10, 3))])
LC2 = leafy([((0, 6), (1, 2)), ((4, 0), (3, 3)), ((9, 1), (8, 3)), ((10, 8), (10, 4))])
pickC, pickC2 = P4(LC1, LC2, LC2, LC1), P4(LC2, LC1, LC1, LC2)
isoC = [(LC1, 4, 5), (LC2, 11, 5), (LC1, 8, 10)]

if __name__ == '__main__':
    build_bundle(OUT, 'A', ROWS, pickA, pickA2, isoA, trunkJ, ('wleaf', 0),
        'jungle A — 숲 수관 결을 짙게 + 야자 잎 별꼴 섞기', 'A: 숲 A 와 같은 수관 도장을 wleaf 테·wmead 짙은 단으로 어둡게, 야자 잎 5갈래 별꼴을 엇갈려 섞어 윤곽이 삐죽. 줄기는 1px 휜다.')
    build_bundle(OUT, 'B', ROWS, pickB, pickB2, isoB, trunkJ, ('wleaf', 0),
        'jungle B — 깊이: 별꼴 위주로 빽빽, 아주 짙은 그늘', 'B: 별꼴 잎을 두 줄 두께로 겹쳐 빽빽하게, 잎 밑은 가장 어두운 초록. 볼륨은 정수리만 밝게.', y_max=84)
    build_bundle(OUT, 'C', ROWS, pickC, pickC2, isoC, trunkJ, ('wleaf', 1),
        'jungle C — 바나나잎: 넓은 잎이 부채꼴로 처지는 수관', 'C: 둥근 수관 없이 넓은 잎 4장이 위로 뻗었다 처지는 부채꼴만 겹쳐 깐다.')

"""3면 우진각 지붕(3/4): 앞 경사 + 왼 경사 + 오른 경사. 추녀마루(능선 끝 → 처마 모서리)가 세 면의 경계.
앞면은 가로 기와 줄, 좌우면은 세로 기와 줄(처마와 나란히). 명암: 왼 +1 / 앞 0 / 오른 -2. (버들항 지붕 문법)"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from jp import *

def hip3(c, x, y, w, T, mat='kawara', rl=None, tb=None):
    rl = rl if rl is not None else int(w * 0.30)
    tb = tb if tb is not None else int(T * 0.30)
    xl = lambda j: rl * (1 - j / T)
    rows = T // 4
    for j in range(T):
        for i in range(w):
            a = xl(j); b = w - a
            face = None
            if i < a:
                yb = tb * (1 - i / rl) if i < rl else 0
                if j >= yb: face = 'L'
            elif i >= b:
                ib = w - 1 - i
                yb = tb * (1 - ib / rl) if ib < rl else 0
                if j >= yb: face = 'R'
            else: face = 'F'
            if face is None: continue
            if face == 'F':
                r = j // 4; off = 3 if r % 2 else 0; u = (i + off) % 6; v = j % 4
                t = 3 if r < rows * .25 else 2 if r < rows * .6 else 1
                if r >= rows - 1: t = 0
                col = K(mat, t - 3) if v == 3 else K(mat, t - 2) if u == 5 else K(mat, t + 2) if (v == 0) else K(mat, t + 1) if (u == 0 or (v == 1 and u < 3)) else K(mat, t)
            else:
                # 좌우 면: 세로 줄(처마와 나란함). 폭 4 열, 열마다 6px 엇갈림. 바깥(처마) 쪽이 어둡다
                d = i if face == 'L' else w - 1 - i                # 처마(바깥)에서의 거리
                cidx = d // 4; off = 3 if cidx % 2 else 0; u = d % 4; v = (j + off) % 6
                base = 3 if face == 'L' else 0
                t = base - (1 if d < 5 else 0)
                col = K(mat, t - 3) if u == 0 else K(mat, t - 2) if v == 5 else K(mat, t + 2) if (v == 0) else K(mat, t + 1) if (u == 3 or (v == 1 and u < 3)) else K(mat, t)
            c.P(x + i, y + j, col)
    # 능선(밝은 줄 + 마루 기와)
    for i in range(rl, w - rl):
        c.P(x + i, y, K(mat, 5)); c.P(x + i, y + 1, K(mat, 4)); c.P(x + i, y + 2, K(mat, -1))
    for i in range(rl + 1, w - rl - 2, 6): c.R(x + i, y - 1, 4, 2, K(mat, 5))
    # 추녀마루(두 대각선): 밝은 캡 2px + 옆 그림자
    for j in range(T):
        a = int(xl(j)); b = w - 1 - a
        c.P(x + a, y + j, K(mat, 5)); c.P(x + a + 1, y + j, K(mat, 4)); c.P(x + a - 1, y + j, K(mat, -3)); c.P(x + a + 2, y + j, K(mat, -2))
        c.P(x + b, y + j, K(mat, 3)); c.P(x + b - 1, y + j, K(mat, 2)); c.P(x + b + 1, y + j, K(mat, -3)); c.P(x + b - 2, y + j, K(mat, -2))
    # 뒤 처마선(좌우 면의 위쪽 경계): 어두운 줄
    for i in range(0, rl):
        yb = int(tb * (1 - i / rl)); c.P(x + i, y + yb, K(mat, -3)); c.P(x + w - 1 - i, y + yb, K(mat, -3))
    # 바깥 세로 처마선 + 앞 처마 끝(튀어나온 어두운 띠)
    for j in range(tb, T): c.P(x, y + j, K(mat, -3)); c.P(x + 1, y + j, K(mat, -2)); c.P(x + w - 1, y + j, K(mat, -3)); c.P(x + w - 2, y + j, K(mat, -3))
    c.HL(x - 1, y + T - 1, w + 2, K(mat, -3)); c.HL(x, y + T - 2, w, K(mat, -2)); c.HL(x, y + T - 3, w, K(mat, -1))
    for k in range(4): c.HL(x + 1, y + T + k, w - 2, K('conc', -3 + k // 2))     # 벽 위 처마 그림자

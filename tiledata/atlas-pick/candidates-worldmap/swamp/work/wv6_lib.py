#!/usr/bin/env python3
"""wv6 공용 도구 — 덩이(3x4 묶음) 모양 규칙을 코드로, 색은 손으로 정한 표로. 작업자 wv6 전용.
모양: 기슭선 깊이 표(칸 바깥에서 잰 투명 폭, 이음 열 0·7·8·15 = J), 바깥 모서리 원(J·대각 D 에 맞춰 찾음), 안쪽 모서리 홈 = 반지름 J 사분원.
파일럿(coast_grass/work/pilot_coast.py)과 같은 사분면 합성. 다른 점: 덩이 바깥은 투명('.')이라 「땅」 자리가 비어 있다.
"""
import os
import numpy as np
from scipy import ndimage

T = 16
AT = {'isolated': (0, 0), 'body_alt': (1, 0), 'inner': (2, 0), 'corner_nw': (0, 1), 'edge_n': (1, 1), 'corner_ne': (2, 1),
      'edge_w': (0, 2), 'body': (1, 2), 'edge_e': (2, 2), 'corner_sw': (0, 3), 'edge_s': (1, 3), 'corner_se': (2, 3)}
CONFIG = {
    'body': [[1, 1, 1], [1, 1, 1], [1, 1, 1]],
    'edge_n': [[0, 0, 0], [1, 1, 1], [1, 1, 1]], 'edge_s': [[1, 1, 1], [1, 1, 1], [0, 0, 0]],
    'edge_w': [[0, 1, 1], [0, 1, 1], [0, 1, 1]], 'edge_e': [[1, 1, 0], [1, 1, 0], [1, 1, 0]],
    'corner_nw': [[0, 0, 0], [0, 1, 1], [0, 1, 1]], 'corner_ne': [[0, 0, 0], [1, 1, 0], [1, 1, 0]],
    'corner_sw': [[0, 1, 1], [0, 1, 1], [0, 0, 0]], 'corner_se': [[1, 1, 0], [1, 1, 0], [0, 0, 0]],
    'inner': [[0, 1, 0], [1, 1, 1], [0, 1, 0]],
    'isolated': [[0, 0, 0], [0, 1, 0], [0, 0, 0]],
}
Q = {'nw': ((0, -1), (-1, 0), (-1, -1), 0, 0), 'ne': ((0, -1), (1, 0), (1, -1), 8, 0),
     'sw': ((0, 1), (-1, 0), (-1, 1), 0, 8), 'se': ((0, 1), (1, 0), (1, 1), 8, 8)}

# 손으로 정한 기슭선 깊이 표(J=3). 이음 열 0·7·8·15 = 3, 이웃 차 <= 1, 진폭 ±1, 평지 길이 섞임.
P3 = {
    'a': [3, 3, 4, 4, 4, 4, 3, 3, 3, 3, 3, 2, 2, 3, 3, 3],
    'b': [3, 3, 3, 2, 2, 3, 3, 3, 3, 3, 4, 4, 4, 3, 3, 3],
    'c': [3, 3, 3, 4, 4, 4, 3, 3, 3, 2, 2, 3, 3, 3, 3, 3],
    'd': [3, 3, 2, 2, 3, 3, 3, 3, 3, 3, 3, 4, 4, 4, 3, 3],
    'e': [3, 2, 2, 2, 3, 3, 3, 3, 3, 4, 4, 3, 3, 3, 3, 3],
    'f': [3, 3, 3, 3, 4, 4, 3, 3, 3, 3, 2, 2, 2, 3, 3, 3],
    'g': [3, 4, 4, 3, 3, 3, 3, 3, 3, 3, 3, 2, 2, 2, 3, 3],
    'h': [3, 3, 3, 3, 3, 2, 2, 3, 3, 4, 4, 4, 3, 3, 3, 3],
}
def down(p): return [max(2, v - 1) for v in p]   # J=2 판(2~3)

def circle(J, D):
    """바깥 모서리 원: 사분면 안쪽 꼭짓점 쪽 좌표(fx,fy) 기준 중심 (c,c), 반지름² r2 — 이음 열 깊이 J, 대각 깊이 D 를 만족하는 것 중 가장 큰 원."""
    best = None
    for c in np.arange(J + 3, 16, 0.5):
        for r2 in range(20, 200):
            def out(fx, fy): return (fx + 0.5 - c) ** 2 + (fy + 0.5 - c) ** 2 > r2
            sj = next((k for k in range(8) if not out(7, k)), 99)
            dg = next((k for k in range(8) if not out(k, k)), 99)
            if sj == J and dg == D:
                best = (c, r2) if best is None or r2 > best[1] else best
    return best

class Shape:
    def __init__(self, prof, J=3, D=5, circ=None):
        self.prof = prof; self.J = J
        self.circ = circ or ((10.0, 52) if (J, D) == (3, 5) else circle(J, D))
        assert self.circ, (J, D)
        self.r2in = J * J if J == 3 else 4

    def quarter_out(self, role, q, x, y):
        lx, ly = x % 8, y % 8
        if role in ('edge_n', 'edge_s', 'edge_w', 'edge_e'):
            s = role[-1]
            if s == 'n': return y < self.prof['n'][x]
            if s == 's': return (15 - y) < self.prof['s'][x]
            if s == 'w': return x < self.prof['w'][y]
            return (15 - x) < self.prof['e'][y]
        fx = lx if q[1] == 'w' else 7 - lx; fy = ly if q[0] == 'n' else 7 - ly
        if role.startswith('corner_'):
            c, r2 = self.circ
            return (fx + 0.5 - c) ** 2 + (fy + 0.5 - c) ** 2 > r2
        if role == 'inner':
            return (fx + 0.5) ** 2 + (fy + 0.5) ** 2 <= self.r2in
        return False

    def compose(self, mask):
        out = np.zeros((48, 48), bool)
        on = lambda x, y: mask[y][x] == 1 if 0 <= x < 3 and 0 <= y < 3 else False
        for cy in range(3):
            for cx in range(3):
                if not on(cx, cy): out[cy * T:(cy + 1) * T, cx * T:(cx + 1) * T] = True; continue
                for q, ((vx, vy), (hx, hy), (dx, dy), ox, oy) in Q.items():
                    v, h, d = on(cx + vx, cy + vy), on(cx + hx, cy + hy), on(cx + dx, cy + dy)
                    if not v and not h: r = 'corner_' + q
                    elif not v: r = 'edge_n' if q[0] == 'n' else 'edge_s'
                    elif not h: r = 'edge_w' if q[1] == 'w' else 'edge_e'
                    elif not d: r = 'inner'
                    else: r = 'body'
                    for yy in range(8):
                        for xx in range(8):
                            out[cy * T + oy + yy, cx * T + ox + xx] = self.quarter_out(r, q, ox + xx, oy + yy)
        return out

def context(shape, role):
    """role 칸(가운데)의 화소별 정보: 바깥(투명) 마스크, 가장 가까운 바깥까지 걸음 거리 d(1 = 바깥과 맞닿음), 네 이웃이 바깥인가."""
    out = shape.compose(CONFIG['body' if role == 'body_alt' else role])
    d = ndimage.distance_transform_cdt(~out, metric='taxicab')
    return out, d

def _run(out, X, Y, dx, dy, lim=5):
    for k in range(1, lim + 1):
        x, y = X + dx * k, Y + dy * k
        if not (0 <= x < 48 and 0 <= y < 48) or out[y, x]: return k
    return lim + 1

def render(shape, paint, rim=None, body_alt_shift=(8, 5)):
    """paint(role, x, y, info) -> (ramp, step) | None (몸통 화소).  rim(role, x, y, info) -> (ramp, step) | None (덩이 바깥 화소; 기본 투명).
    info: d(바깥까지 걸음 거리, 1=맞닿음), dn/ds/dw/de(그 방향으로 바깥까지 걸음 수, 1=바로 옆; 6=멀다), alt, X, Y(48x48 마당 좌표), out."""
    grid = [[None] * 48 for _ in range(64)]
    for role, (cx, cy) in AT.items():
        out, d = context(shape, role)
        db = ndimage.distance_transform_cdt(out, metric='taxicab')
        for y in range(16):
            for x in range(16):
                X, Y = x + 16, y + 16
                info = dict(d=int(d[Y, X]), db=int(db[Y, X]), out=out, X=X, Y=Y, alt=(role == 'body_alt'),
                            dn=_run(out, X, Y, 0, -1), ds=_run(out, X, Y, 0, 1), dw=_run(out, X, Y, -1, 0), de=_run(out, X, Y, 1, 0))
                if out[Y, X]:
                    grid[cy * T + y][cx * T + x] = rim(role, x, y, info) if rim else None
                    continue
                bx, by = (x, y)
                if role == 'body_alt': bx, by = (x + body_alt_shift[0]) % 16, (y + body_alt_shift[1]) % 16
                grid[cy * T + y][cx * T + x] = paint(role, bx, by, info)
    return grid

def emit(grid, path, title, extra_cmt=''):
    keys = sorted({c for row in grid for c in row if c})
    letters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
    assert len(keys) <= len(letters)
    lk = {k: letters[i] for i, k in enumerate(keys)}
    L = [f'// {title} (work/ 아래 생성 스크립트가 만든다; 손으로 고칠 땐 이 격자를 직접 고친다)',
         '@size 48 64', '@cell 16', '@palette palette.pal', '@layer main']
    for k, l in lk.items(): L.append(f'@mat {l} {k[0]} {k[1]}')
    L.append('@mblock 0 0')
    for row in grid: L.append(''.join(lk[c] if c else '.' for c in row))
    open(path, 'w').write('\n'.join(L) + '\n')
    return path

def grid_from(rows):
    return rows

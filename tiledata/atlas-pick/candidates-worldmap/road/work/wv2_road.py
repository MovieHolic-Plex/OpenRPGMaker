#!/usr/bin/env python3
"""wv2 road A/B/C — 흙길 3x4 묶음(line). 몸통 = wdirt, 테 = wgrass(다른 램프)."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../meadow/work'))
from wv2_lib import *
D = lambda s: ('wdirt', s)
G = lambda s: ('wgrass', s)
OUT = os.path.join(os.path.dirname(__file__), '..')

def gx(ctx, x, y):   # 몸통 칸 무늬가 칸끼리 이어지도록 칸 좌표 기준
    return x, y

def paintA(ctx, role, x, y):
    alt = role == 'body_alt'
    s = 11 if alt else 3
    if ctx.in_body(x, y):
        d = ctx.din[y + 16, x + 16]; side = ctx.edge_side(x, y)
        h = H(x, y + (16 if alt else 0), 1) if role in ('body', 'body_alt') else H(x + 16 * AT[role][0], y + 16 * AT[role][1], 1)
        if d == 1 and side in ('n', 'w'): return D(2 if h < 70 else 3)
        if d == 1: return D(3 if h < 60 else 4)
        if h < 6: return D(2)
        if h < 16: return D(4)
        if h < 19: return D(5)
        return D(3)
    if ctx.in_sil(x, y):   # 풀 테: 몸통에 붙은 1~2px, 불규칙하게 파먹음
        d = ctx.dout[y + 16, x + 16]; h = H(x + 16 * AT[role][0], y + 16 * AT[role][1], 5)
        if d == 1: return G(3) if h < 55 else G(4)
        return G(4) if h < 45 else None
    return None

def paintB(ctx, role, x, y):
    if ctx.in_body(x, y):
        d = ctx.din[y + 16, x + 16]; side = ctx.edge_side(x, y)
        h = H(x + 16 * AT[role][0], y + 16 * AT[role][1], 2)
        if side == 'n' and d <= 2: return D(1 if d == 1 else 2)      # 풀 그늘 아래
        if side == 'w' and d <= 1: return D(2)
        if side == 's' and d == 1: return D(4)
        if side == 'e' and d == 1: return D(4)
        if d >= 3 and (x + 2 * y) % 5 == 0 and h < 40: return D(4)
        if h < 5: return D(2)
        if h < 12: return D(4)
        return D(3)
    if ctx.in_sil(x, y):
        d = ctx.dout[y + 16, x + 16]; h = H(x + 16 * AT[role][0], y + 16 * AT[role][1], 6)
        side = ctx.rim_side(x, y)
        if d == 1: return G(2) if side in ('n', 'w') else G(3)
        return G(4) if h < 60 else G(3)
    return None

def paintC(ctx, role, x, y):
    # 다른 해석: 밝게 다져진 길 — 몸통은 wdirt 4단 주로, 가장자리만 어두워지는 완만한 둥근 면, 풀 테는 밝은 잎(5단)
    if ctx.in_body(x, y):
        d = ctx.din[y + 16, x + 16]
        h = H(x + 16 * AT[role][0], y + 16 * AT[role][1], 3)
        if d == 1: return D(3)
        if d == 2 and h < 50: return D(3)
        if h < 4: return D(3)
        if h < 9: return D(5)
        return D(4)
    if ctx.in_sil(x, y):
        d = ctx.dout[y + 16, x + 16]; h = H(x + 16 * AT[role][0], y + 16 * AT[role][1], 7)
        if d == 1: return G(5) if h < 35 else G(4)
        return G(4) if h < 30 else (G(5) if h < 40 else None)
    return None

if __name__ == '__main__':
    for k, (p, prof, rim, note) in {
        'A': (paintA, 1, (2, 1, 1, 1), 'World.png 식 흙 블록: 흙 3단 + 잔돌 점, 풀 테가 흙 위로 1~2px 불규칙하게 파먹음. 대비 낮게'),
        'B': (paintB, 2, (2, 1, 1, 1), '깊이 강조: 북·서 가장자리는 풀 그늘 아래 어두운 흙, 남·동은 밝은 흙, 풀 테도 위쪽이 어둡다'),
        'C': (paintC, 3, (2, 2, 1, 1), '다른 해석: 밝게 다져진 길(4단 주) 가장자리만 3단으로 눌림, 풀 테는 밝은 잎(4·5단)으로 가볍게')}.items():
        bundle(os.path.join(OUT, f'wv2-{k}.pxg'), f'road wv2-{k}', PROFS[prof], rim, p)
        open(os.path.join(OUT, f'wv2-{k}.note'), 'w').write(note + '\n')

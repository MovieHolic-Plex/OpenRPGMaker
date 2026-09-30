#!/usr/bin/env python3
"""wv2 river A/B/C — 평원 위 강 3x4 묶음(line). 몸통 = wriver 물, 둑 = wdirt(몸통 가장자리 1~2px 혹진 선), 물 쪽 밝은 테 = wsea 1px(다른 램프)."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../meadow/work'))
from wv2_lib import *
R = lambda s: ('wriver', s)
D = lambda s: ('wdirt', s)
S = lambda s: ('wsea', s)
OUT = os.path.join(os.path.dirname(__file__), '..')

def along(ctx, x, y, salt, n=16):
    """둑 혹 해시: 가장자리를 따라가는 좌표만 쓴다(같은 변 칸끼리 이음새가 안 생김)."""
    side = ctx.rim_side(x, y)
    return wrapH(x if side in ('n', 's') else y, 0, salt, n)

def bump(x, y, ctx, salt, p):
    """3번째 줄(혹)은 칸 안쪽(1..14)에서만, 확률 p%."""
    return 0 < x < 15 and 0 < y < 15 and along(ctx, x, y, salt) < p

def rimpx(ctx, x, y, tint, salt, p3):
    """물 바깥 테: 1px = wsea(tint 단), 2px = wdirt 둑, 3px = 혹."""
    d = ctx.dout[y + 16, x + 16]; side = ctx.rim_side(x, y)
    if d == 1: return S(tint(side))
    if d == 2: return D(2 if along(ctx, x, y, salt + 1) < 50 else 1)
    if d == 3 and bump(x, y, ctx, salt, p3): return D(2)
    return None

def flow(x, y, salt, thr=2, L=3):
    return any(wrapH(x - k, y, salt) < thr for k in range(L))

def paintA(ctx, role, x, y):
    if ctx.in_body(x, y):
        if flow(x, y, 8, 2, 3): return R(5)
        return R(3) if wrapH(x, y + 5, 9) < 92 else R(2)
    if ctx.in_sil(x, y): return rimpx(ctx, x, y, lambda s: 4, 3, 40)
    return None

def paintB(ctx, role, x, y):
    # 깊이 강조: 북·서 둑은 어둡고 그늘, 남·동 둑은 밝은 흙, 물은 가운데로 갈수록 밝다
    if ctx.in_body(x, y):
        d = ctx.din[y + 16, x + 16]; side = ctx.edge_side(x, y)
        if d == 1 and side in ('n', 'w'): return R(1)
        if flow(x, y, 15, 1, 4): return R(5)
        if d <= 2: return R(2)
        return R(3) if wrapH(x, y, 16) < 90 else R(4)
    if ctx.in_sil(x, y):
        d = ctx.dout[y + 16, x + 16]; side = ctx.rim_side(x, y)
        if d == 1: return S(3 if side in ('n', 'w') else 5)
        if d == 2: return D(1) if side in ('n', 'w') else D(3 if along(ctx, x, y, 13) < 50 else 2)
        if d == 3 and bump(x, y, ctx, 12, 45): return D(1) if side in ('n', 'w') else D(2)
    return None

def paintC(ctx, role, x, y):
    # 다른 해석: 얇고 깨끗한 중간 흙 둑 + 두꺼운 밝은 테, 흐름 획 대신 반짝 점 무늬
    if ctx.in_body(x, y):
        d = ctx.din[y + 16, x + 16]
        if wrapH(x, y, 23) < 3: return R(5)
        if wrapH(x - 1, y, 23) < 3 or wrapH(x + 1, y, 23) < 3: return R(4)
        return R(3) if wrapH(x, y, 24) < 93 else R(2)
    if ctx.in_sil(x, y):
        d = ctx.dout[y + 16, x + 16]
        if d == 1: return S(5)
        if d == 2: return D(2)
        if d == 3 and bump(x, y, ctx, 21, 22): return D(2)
    return None

if __name__ == '__main__':
    for k, (p, prof, rim, note) in {
        'A': (paintA, 1, (3, 3, 3, 3), 'World.png 물가 그대로: 몸통 가장자리에 어두운 wdirt 둑 1~2px 혹진 선, 물 쪽에 wsea 밝은 테 1px, 속은 wriver 3단에 짧은 밝은 흐름 획 몇 개'),
        'B': (paintB, 2, (3, 3, 3, 3), '깊이 강조: 북·서 둑은 어둡고 그 아래 물이 그늘지며, 남·동 둑은 밝은 흙에 밝은 물 테. 물은 가운데로 갈수록 밝아진다'),
        'C': (paintC, 3, (3, 3, 3, 3), '다른 해석: 가늘고 깨끗한 중간 흙 둑 1px + 두꺼운 밝은 물 테, 흐름 획 대신 짧은 반짝 점 무늬')}.items():
        bundle(os.path.join(OUT, f'wv2-{k}.pxg'), f'river wv2-{k}', PROFS[prof], rim, p)
        open(os.path.join(OUT, f'wv2-{k}.note'), 'w').write(note + '\n')

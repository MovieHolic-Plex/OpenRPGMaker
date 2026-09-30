#!/usr/bin/env python3
"""wv2 meadow A/B/C — 평원 위 짙은 풀밭 덩이 3x4 묶음(flat). 몸통 = wmead, 풀잎 끝 테 = wgrass(다른 램프)."""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from wv2_lib import *
M = lambda s: ('wmead', s)
G = lambda s: ('wgrass', s)
OUT = os.path.join(os.path.dirname(__file__), '..')

def key(role, x, y): return x + 16 * AT[role][0], y + 16 * AT[role][1]

def blade(x, y, salt):
    """몸통 칸 무늬가 칸끼리 이어지도록 16 주기 해시: 세로 2px 풀 획 자리(위 밝음+아래 어둠)."""
    return wrapH(x, y, salt) < 3

def paintA(ctx, role, x, y):
    # World.png 「짙은 풀」: 몸통 wmead 2·3 두 단 + 짧은 세로 풀 획, 가장자리 풀잎 끝이 삐져나옴
    kx, ky = key(role, x, y)
    if ctx.in_body(x, y):
        alt = 8 if role == 'body_alt' else 0
        if blade(x, y + alt, 1): return M(4)
        if blade(x, y - 1 + alt, 1): return M(1)
        return M(2) if wrapH(x, y + 3, 3 + alt) < 62 else M(3)
    d = ctx.dout[y + 16, x + 16]
    if ctx.in_sil(x, y) and d == 1 and H(kx, ky, 4) < 45: return G(4)
    if ctx.in_sil(x, y) and d == 2 and H(kx, ky, 5) < 14 and ctx.b(x, y + 1) is False and (ctx.b(x, y + 2) or ctx.b(x + 2, y) or ctx.b(x - 2, y) or ctx.b(x, y - 2)): return G(3)
    return None

def paintB(ctx, role, x, y):
    # 깊이 강조: 북·서 가장자리 안쪽 어둡게, 남·동 안쪽 밝게, 풀잎 끝 바깥은 밝은 잎(5단)
    kx, ky = key(role, x, y)
    if ctx.in_body(x, y):
        d = ctx.din[y + 16, x + 16]; side = ctx.edge_side(x, y)
        if d <= 2 and side in ('n', 'w'): return M(1)
        if d <= 2 and side in ('s', 'e'): return M(4 if d == 1 else 3)
        if blade(x, y, 6): return M(4)
        if blade(x, y - 1, 6): return M(1)
        return M(2) if wrapH(x, y, 7) < 50 else M(3)
    d = ctx.dout[y + 16, x + 16]
    if ctx.in_sil(x, y) and d == 1 and H(kx, ky, 8) < 50: return G(5) if H(kx, ky, 9) < 50 else G(4)
    if ctx.in_sil(x, y) and d == 2 and H(kx, ky, 10) < 12 and (ctx.b(x, y + 2) or ctx.b(x + 2, y) or ctx.b(x - 2, y) or ctx.b(x, y - 2)): return G(4)
    return None

def paintC(ctx, role, x, y):
    # 다른 해석: 키 큰 풀밭 — 세로 획이 길고(3px) 촘촘, 가장자리는 뾰족 잎끝이 위로 솟는다
    kx, ky = key(role, x, y)
    if ctx.in_body(x, y):
        salt = 11 + (5 if role == 'body_alt' else 0)
        for dy, tone in ((0, 4), (1, 3), (2, 1)):     # 3px 세로 획: 위 밝음 · 가운데 · 아래 어둠. 시작점은 해시(격자 아님)
            if wrapH(x, y - dy, salt) < 4: return M(tone)
        return M(2) if wrapH(x + 5, y + 2, 20) < 70 else M(3)
    d = ctx.dout[y + 16, x + 16]
    if ctx.in_sil(x, y) and d == 1 and H(kx, 0, 13) < 38 and ctx.b(x, y + 1): return G(5) if H(kx, ky, 14) < 40 else G(4)
    if ctx.in_sil(x, y) and d == 1 and H(kx, ky, 15) < 25: return G(3)
    if ctx.in_sil(x, y) and d == 2 and H(kx, 0, 16) < 12 and ctx.b(x, y + 2) and ctx.b(x+1, y + 2) is False: return G(4)
    return None

if __name__ == '__main__':
    for k, (p, prof, rim, note) in {
        'A': (paintA, 1, (2, 2, 2, 2), 'World.png 「짙은 풀」 블록: wmead 두 단 바탕 + 짧은 세로 풀 획, 가장자리에 wgrass 풀잎 끝이 1~2px 삐져나옴'),
        'B': (paintB, 2, (2, 2, 2, 2), '깊이 강조: 북·서 안쪽 가장자리는 어둡게 눌리고 남·동은 밝게 돋는다. 잎끝은 밝은 wgrass 5단'),
        'C': (paintC, 3, (2, 2, 2, 2), '다른 해석: 키 큰 풀밭 — 3px 세로 획을 촘촘히, 가장자리는 위로 솟는 뾰족 잎끝')}.items():
        bundle(os.path.join(OUT, f'wv2-{k}.pxg'), f'meadow wv2-{k}', PROFS[prof], rim, p)
        open(os.path.join(OUT, f'wv2-{k}.note'), 'w').write(note + '\n')

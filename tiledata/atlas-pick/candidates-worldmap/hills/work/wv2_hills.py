#!/usr/bin/env python3
"""wv2 hills A/B/C — 풀 덮인 낮은 언덕 무리 3x4 묶음(mass). 둔덕은 16px 격자, 줄마다 8px 엇갈림, 앞 둔덕이 뒤 밑동을 가린다.
몸통 재료 = whill(비탈) + wgrass 어두운 단(그늘). 텍스처는 16 주기라 칸끼리 이음새가 없다."""
import sys, os, math
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../meadow/work'))
from wv2_lib import *
W_ = lambda s: ('whill', s)
G = lambda s: ('wgrass', s)
OUT = os.path.join(os.path.dirname(__file__), '..')

def lumps(x, y, hw, hh, dyb, ex=2.0):
    """(x,y) 화소를 덮는 둔덕들 [(뒤→앞 순서)] 의 (u, v, front_index): u=-1..1 가로, v=0..1 밑에서 위(높이 비율)."""
    out = []
    for rr in (y // 8, y // 8 + 1, y // 8 + 2):
        off = 8 if rr % 2 == 0 else 0
        yb = 8 * rr + dyb
        for k in (-1, 0, 1, 2):
            cx = off + 16 * k + (x // 16) * 16 * 0
            X = x % 16
            for sh in (-16, 0, 16):
                c = off + sh
                u = (X + .5 - c) / hw
                v = (yb + 1 - (y + .5)) / hh
                if v < 0: continue
                if abs(u) ** ex + v ** ex <= 1.0 or (abs(u) ** ex + (v) ** ex) <= 1.0:
                    if abs(u) ** ex + v ** ex <= 1.0: out.append((rr, u, v))
            break
    return out

def hill_at(x, y, hw, hh, dyb, ex=2.0):
    """가장 앞(rr 가장 큰) 둔덕. None = 둔덕 사이 바닥."""
    hit = lumps(x, y, hw, hh, dyb, ex)
    return max(hit, key=lambda t: t[0]) if hit else None

def paintA(ctx, role, x, y):
    if not ctx.in_body(x, y): return None
    d = ctx.din[y + 16, x + 16]; side = ctx.edge_side(x, y)
    h = hill_at(x, y, 6.6, 8.5, 7)
    if d == 1 and side in ('s', 'e'): return G(1)
    if h is None: return G(2) if H(x, y, 3) < 85 else W_(1)
    rr, u, v = h
    # 왼쪽 위 빛: 밝기 = 왼쪽·위일수록 높다
    lum = -0.55 * u + 0.75 * v - 0.25
    yb_edge = v < 0.13                       # 밑동 한 줄은 그늘
    if yb_edge: return G(2) if u > -0.3 else W_(2)
    if u > 0.55 and v < 0.55: return W_(2)
    if lum > 0.62: return W_(5)
    if lum > 0.30: return W_(4)
    if lum > -0.05: return W_(3)
    return W_(2)

def paintB(ctx, role, x, y):
    if not ctx.in_body(x, y): return None
    d = ctx.din[y + 16, x + 16]; side = ctx.edge_side(x, y)
    h = hill_at(x, y, 6.6, 8.5, 7)
    if d == 1 and side in ('s', 'e'): return G(1)
    if d == 1 and side in ('n', 'w'): return W_(4)
    if h is None: return G(1) if H(x, y, 4) < 70 else G(2)
    rr, u, v = h
    if v < 0.16: return G(1) if u > -0.4 else G(2)               # 밑동 그늘 두 줄 쯤
    if u > 0.35 and v < 0.75: return G(2) if (u > 0.6 or v < 0.35) else W_(2)     # 오른쪽 비탈은 풀 그늘 단
    lum = -0.8 * u + 0.7 * v - 0.15
    if lum > 0.75: return W_(5)
    if lum > 0.45: return W_(4)
    if lum > 0.05: return W_(3)
    return W_(2)

def paintC(ctx, role, x, y):
    # 다른 해석: 넓고 납작한 둔덕(초타원) + 능선 밝은 한 줄, 면은 2톤 평면(부드러운 그라데이션 없음)
    if not ctx.in_body(x, y): return None
    d = ctx.din[y + 16, x + 16]; side = ctx.edge_side(x, y)
    h = hill_at(x, y, 7.0, 7.4, 7, 2.6)
    if d == 1 and side in ('s', 'e'): return G(1)
    if h is None: return G(2)
    rr, u, v = h
    top = hill_at(x, y - 1, 7.0, 7.4, 7, 2.6)
    crest = (top is None or top[0] != rr)            # 위가 다른 둔덕/바닥이면 능선
    if v < 0.12: return G(2)
    if crest: return W_(5) if u < 0.4 else W_(4)
    if u > 0.25: return W_(2)
    return W_(3) if H(x, y, 5) < 92 else W_(4)

if __name__ == '__main__':
    for k, (p, prof, rim, note) in {
        'A': (paintA, 1, (0, 0, 0, 0), 'World.png 산맥 블록의 배치 원리(16px 격자·줄마다 8px 엇갈림·앞 둔덕이 뒤 밑동을 가림)로 낮고 둥근 풀 언덕: 왼쪽 위 밝고 오른쪽 아래 어두운 whill 4단'),
        'B': (paintB, 2, (0, 0, 0, 0), '깊이 강조: 오른쪽 비탈과 밑동을 wgrass 어두운 단으로 깊게 눌러 둔덕이 솟아 보이게, 밝은 쪽은 whill 5단'),
        'C': (paintC, 3, (0, 0, 0, 0), '다른 해석: 넓고 납작한 둔덕에 능선 한 줄, 면은 두 톤 평면(그라데이션 없음)')}.items():
        bundle(os.path.join(OUT, f'wv2-{k}.pxg'), f'hills wv2-{k}', PROFS[prof], rim, p)
        open(os.path.join(OUT, f'wv2-{k}.note'), 'w').write(note + '\n')

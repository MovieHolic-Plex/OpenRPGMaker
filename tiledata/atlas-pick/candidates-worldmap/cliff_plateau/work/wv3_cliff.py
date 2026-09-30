"""wv3 cliff_plateau 묶음 생성기 (2판). 사용: python3 wv3_cliff.py cliff_plateau <A|B|C>"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from wv3_bundle import *

R = lambda t: ('wrock', t)
G = lambda t: ('whill', t)
W_ = lambda t: ('wgrass', t)
D_ = lambda t: ('wdirt', t)

def run(M, y, x, dy, dx):
    """(y,x) 에서 방향으로 연속 불투명 화소 수(자기 포함). 배열 밖은 투명이 아니라 '끝없음'으로 본다."""
    n = 0; h, w = M.shape
    while 0 <= y < h and 0 <= x < w and M[y, x]:
        n += 1; y += dy; x += dx
    if not (0 <= y < h and 0 <= x < w): n += 99
    return n

TUFT = {(2, 3), (9, 1), (13, 6), (5, 10), (11, 13), (1, 14), (7, 7)}
HIL = {(4, 5), (12, 10), (8, 14), (14, 2)}

def top_tex(lx, ly, v):
    p = (lx % 16, ly % 16)
    if v == 'C':
        base = W_(3)
        if p in TUFT: return W_(2)
        if p in HIL: return W_(4)
        if p in {(6, 4), (7, 4), (6, 5), (10, 12), (11, 12)}: return R(4) if p[0] in (6, 10) else R(3)   # 작은 돌멩이
        return base
    base = G(4) if v == 'A' else G(4)
    if p in TUFT: return G(3)
    if p in HIL: return G(5)
    return base

def shade(M, y, x, lx, ly, v):
    """M 안 (y,x) 불투명 화소의 색. lx,ly = 칸 안 좌표(주기 16 무늬용)."""
    ks = run(M, y, x, 1, 0); kn = run(M, y, x, -1, 0)
    kw = run(M, y, x, 0, -1); ke = run(M, y, x, 0, 1)
    FH = 7 if v != 'C' else 8            # 절벽 앞면 높이
    face = ks <= FH
    # 윤곽
    if ks == 1 or ((kw == 1 or ke == 1) and face): return R(0)
    if kw == 1 or ke == 1 or kn == 1:
        return G(0) if v != 'C' else G(0)
    if face:
        # 위에서 아래로 밝음 → 어두움
        k = ks                              # 7(위) .. 2(아래)
        if v == 'C':
            # 가로 결 (8 높이: 두 층, 사이에 턱)
            tone = {8: 5, 7: 4, 6: 4, 5: 3, 4: 3, 3: 2, 2: 2}[k] if k <= 8 else 4
            if k == 5: return R(1)          # 층 사이 어두운 줄
            # 층마다 어긋난 세로 이음
            off = 0 if k > 5 else 2
            if (lx + off) % 8 == 0: return R(1)
            if (lx + off) % 8 == 1 and k in (8, 7, 4, 3): return R(tone + 1 if tone < 6 else 6)
            return R(tone)
        tone = {7: 5, 6: 4, 5: 4, 4: 3, 3: 3, 2: 2}[k]
        if v == 'B': tone = {7: 5, 6: 4, 5: 3, 4: 3, 3: 2, 2: 1}[k]
        m = lx % 4
        if m == 2 and 2 <= k <= 5: return R(max(1, tone - 2))      # 세로 골
        if m == 1 and 2 <= k <= 5: return R(min(6, tone + 1))      # 골 옆 빛
        if k == 7: return R(5 if m != 2 else 4)                    # 윗턱 (밝게)
        return R(tone)
    # 옆면 2~3px (윗면 높이 위쪽)
    if kw <= 3 and not face:
        return R({2: 4, 3: 3}[kw]) if v != 'B' else R({2: 4, 3: 3}[kw])
    if ke <= 3 and not face:
        return R({2: 2, 3: 3}[ke]) if v != 'B' else R({2: 2, 3: 2}[ke])
    if kn == 2:
        return G(5) if v != 'C' else W_(4)                           # 북쪽 테 안쪽 한 줄 빛
    # 윗면 술에서 절벽 윗턱과 만나는 자리: 앞면 바로 위 줄은 살짝 어둡게
    if ks == FH + 1:
        return G(3) if v != 'C' else W_(2)
    return top_tex(lx, ly, v)

def main(slug, v):
    prof = dict(N=[0]*16, S=[0]*16, W=[0]*16, E=[0]*16, R=7.9, RN=3.0)
    opaque = make_opaque(prof)

    def paint(gx, gy, lx, ly, M, d, alt):
        return shade(M, gy, gx, lx, ly, v)
    def shadow(gx, gy, lx, ly, M, d):
        if v != 'B': return None
        if M[gy-1, gx-1] or M[gy-1, gx] or M[gy, gx-1]: return '~'
        if gy >= 2 and gx >= 2 and (M[gy-2, gx-2] or M[gy-2, gx-1] or M[gy-1, gx-2]): return '-'
        return None
    # 홀로 선 고원: 칸 가득한 둥근 상자
    iso_m = np.zeros((16, 16), bool)
    def rr(x, y, x0, y0, x1, y1, r):
        if not (x0 <= x <= x1 and y0 <= y <= y1): return False
        cx = min(max(x, x0 + r), x1 - r); cy = min(max(y, y0 + r), y1 - r)
        return (x - cx) ** 2 + (y - cy) ** 2 <= (r + .3) ** 2
    ymax = 13 if v == 'B' else 15
    for y in range(16):
        for x in range(16):
            iso_m[y, x] = rr(x, y, 0, 1, 15 if v != 'B' else 14, ymax, 3 if v != 'C' else 4)
    iso = [[shade(iso_m, y, x, x, y, v) if iso_m[y, x] else None for x in range(16)] for y in range(16)]
    if v == 'B':
        for y in range(16):
            for x in range(16):
                if not iso_m[y, x] and ((y > 0 and x > 0 and iso_m[y-1, x-1]) or (y > 0 and iso_m[y-1, x]) or (x > 0 and iso_m[y, x-1])):
                    iso[y][x] = '~'
    grid = build(opaque, paint, iso, shadow=shadow)
    txt = to_pxg(grid, f'{slug} wv3-{v}')
    out = os.path.join(os.path.dirname(os.path.dirname(HERE)), slug, f'wv3-{v}.pxg')
    open(out, 'w').write(txt); print('wrote', out)

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])

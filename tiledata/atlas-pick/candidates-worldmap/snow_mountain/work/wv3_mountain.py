"""wv3 mountain / snow_mountain 묶음 생성기 (2판). 사용: python3 wv3_mountain.py <slug> <A|B|C>"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from wv3_bundle import *

R = lambda t: ('wrock', t)
S_ = lambda t: ('wsnow', t)
G = lambda t: ('whill', t)

HW_A = [1, 1, 2, 2, 3, 4, 4, 5, 5, 6, 6, 7, 7, 7]    # 14행, 폭 3~15
HW_C_BIG = [1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7]  # 14행
HW_C_SM = [1, 1, 2, 2, 3, 3, 4, 5, 5]                 # 9행

def peak_shader(snow, style):
    def sh(p, dx, r, hw, H):
        ridge = min(2, r // 5) if r >= 2 else 0
        edge = abs(dx) == hw
        snowline = (3 + (dx * 3 + r) % 3 * 0) if snow else -1
        # 눈선: 홈을 따라 들쭉날쭉 (위 1/3)
        if snow:
            jag = [0, 1, 0, 2, 1, 0, 1, 2][(dx + 8) % 8]
            sl = (H * 6) // 13 + jag - 1
        else:
            sl = -1
        if r == H - 1 or edge:
            return R(0)
        lit = dx < ridge
        if snow and r <= sl:
            if dx == ridge and r >= 1: return S_(2)
            if lit:
                return S_(6) if (abs(dx) >= hw - 2 or r <= 1) else S_(5)
            return S_(3) if abs(dx) <= hw - 2 else S_(2)
        if dx == ridge and r >= 1:
            return R(1)
        if lit:
            if abs(dx) == hw - 1: return R(6)          # 안쪽 밝은 선
            if r <= 2: return R(5)
            g = (r in (6, 7) and dx == -3 + ridge // 1 - 0) or (r in (9, 10) and dx == -5)
            if g: return R(3)
            if style == 'B': return R(6) if (r <= 3 and dx < ridge - 1) else (R(5) if abs(dx) >= hw - 3 else R(4))
            return R(5) if abs(dx) >= hw - 3 else R(4)
        else:
            if abs(dx) == hw - 1: return R(1)
            g = (r in (5, 6, 7) and dx == ridge + 2 + (r - 5)) or (r in (8, 9) and dx == 5)
            if g: return R(1)
            if style == 'B': return R(2) if abs(dx) <= 2 + r // 4 else R(1)
            return R(3) if abs(dx) <= 2 + r // 4 else R(2)
    return sh

def foot(gx, gy):
    return R(2) if (gx + gy) % 4 else R(3)

def peaks_for(variant):
    if variant == 'C':
        return [dict(cx=8, top=0, hw=HW_A), dict(cx=3, top=8, hw=HW_C_SM), dict(cx=13, top=8, hw=HW_C_SM)]
    return [dict(cx=8, top=0, hw=HW_A), dict(cx=0, top=8, hw=HW_A)]

def covered(peaks, txs, tys):
    s = set()
    for ty in tys:
        for tx in txs:
            for p in peaks:
                for r, w in enumerate(p['hw']):
                    for dx in range(-w, w + 1):
                        x, y = p['cx'] + 16 * tx + dx, p['top'] + 16 * ty + r
                        if 0 <= x < 16 and 0 <= y < 16: s.add((x, y))
    return s

def profiles(peaks):
    c0 = covered(peaks, (-1, 0, 1), (0,)); c1 = covered(peaks, (-1, 0, 1), (-1, 0))
    N = [min([y for (x, y) in c0 if x == X] + [8]) for X in range(16)]
    N = [min(8, v) for v in N]
    S = [min(8, 15 - max([y for (x, y) in c1 if x == X] + [-1])) for X in range(16)]
    W = [min(8, min([x for (x, y) in c1 if y == Y] + [8])) for Y in range(16)]
    E = [min(8, 15 - max([x for (x, y) in c1 if y == Y] + [-1])) for Y in range(16)]
    return dict(N=N, S=S, W=W, E=E)

def make_opaque_mtn(prof, rn=3.0):
    N, S, W, E = prof['N'], prof['S'], prof['W'], prof['E']
    def opaque(role, q, x, y):
        if role.startswith('edge_'):
            s = role[-1]
            if s == 'n': return y >= N[x]
            if s == 's': return (15 - y) >= S[x]
            if s == 'w': return x >= W[y]
            return (15 - x) >= E[y]
        if role.startswith('corner_'):
            X = x if q[1] == 'w' else 15 - x
            Y = y if q[0] == 'n' else 15 - y
            # 북서 모서리 기준: 세로/가로 프로파일을 거울로 써서 이음매를 맞춘다
            ok = (X >= W[15 - Y]) and (Y >= N[15 - X])
            # 바깥 꼭짓점 둥글리기
            if X < 3 and Y < 3 and (X + Y) < 2: ok = False
            return ok
        if role == 'inner':
            fx = x % 16 if q[1] == 'w' else 15 - x % 16
            fy = y % 16 if q[0] == 'n' else 15 - y % 16
            fx = fx % 16; fy = fy % 16
            return (fx + .5) ** 2 + (fy + .5) ** 2 > rn * rn
        return True
    return opaque

def build_body(peaks, shader):
    cv = stamp_peaks(peaks, shader)
    body = [[None] * 16 for _ in range(16)]
    for y in range(16):
        for x in range(16):
            body[y][x] = cv.get((x + 16, y + 16)) or cv.get((x, y)) or cv.get((x + 32, y + 32)) or None
    for ty in (0,):
        pass
    # 캔버스는 타일 세 겹이므로 가운데 칸을 따로 뽑는다
    for y in range(16):
        for x in range(16):
            body[y][x] = cv.get((x, y)) or foot(x, y)
    return body

def main(slug, v):
    snow = slug == 'snow_mountain'
    peaks = peaks_for(v)
    shader = peak_shader(snow, v)
    body = build_body(peaks, shader)
    prof = profiles(peaks)
    opaque = make_opaque_mtn(prof)
    # 홀로 선 봉우리: 칸 가득한 봉우리 하나
    iso_peaks = [dict(cx=8, top=1, hw=HW_A)]
    if v == 'C': iso_peaks = [dict(cx=7, top=0, hw=HW_A), dict(cx=12, top=7, hw=HW_C_SM[:8])]
    cv = {}
    allp = sorted(iso_peaks, key=lambda p: p['top'] + len(p['hw']))
    for p in allp:
        for r, w in enumerate(p['hw']):
            for dx in range(-w, w + 1):
                c = shader(p, dx, r, w, len(p['hw']))
                if c and 0 <= p['cx'] + dx < 16 and p['top'] + r < 16: cv[(p['cx'] + dx, p['top'] + r)] = c
    iso = [[cv.get((x, y)) for x in range(16)] for y in range(16)]

    def paint(gx, gy, lx, ly, M, d, alt):
        if M[gy, gx] and d[gy, gx] == 1:
            return R(0)                                   # 윤곽
        c = body[ly][lx]
        return c
    def shadow(gx, gy, lx, ly, M, d):
        if v != 'B': return None
        if M[gy - 1, gx - 1] or M[gy - 1, gx] or M[gy, gx - 1]: return '~'
        if gy >= 2 and gx >= 2 and (M[gy - 2, gx - 2] or M[gy - 2, gx - 1] or M[gy - 1, gx - 2]): return '-'
        return None
    grid = build(opaque, paint, iso, shadow=shadow)
    # 홀로 선 칸에도 발 그림자 (B)
    if v == 'B':
        for y in range(16):
            for x in range(16):
                if grid[y][x] is None:
                    if (x > 0 and y > 0 and grid[y - 1][x - 1]) or (y > 0 and grid[y - 1][x]) or (x > 0 and grid[y][x - 1]):
                        grid[y][x] = '~'
    txt = to_pxg(grid, f'{slug} wv3-{v}')
    out = os.path.join(os.path.dirname(os.path.dirname(HERE)), slug, f'wv3-{v}.pxg')
    open(out, 'w').write(txt); print('wrote', out)

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])

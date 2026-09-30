"""wv3 big_mountain 아이콘 생성기 (2판, 32x32). 사용: python3 wv3_big.py big_mountain <A|B|C>"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from wv3_bundle import *

R = lambda t: ('wrock', t)
S_ = lambda t: ('wsnow', t)
N = 32

def cone(v):
    """마다 (cx, top, hw리스트, 능선 f 목록, 눈 행수). 좌표는 32칸 캔버스."""
    if v == 'A':
        hw = [1,1,2,2,3,3,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13,14,14,15]
        return [dict(cx=15, top=1, hw=hw, ridges=[-.6, -.2, .25, .62], main=-.2, snow=6)]
    if v == 'B':
        hw = [1,1,2,2,3,3,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13,14,14,15]
        return [dict(cx=15, top=1, hw=hw, ridges=[-.65, -.3, .05, .42, .75], main=.05, snow=8)]
    # C: 주봉 하나 + 오른쪽 어깨 봉우리 (더 과장된 아이콘)
    hw = [1,1,1,2,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13,14,14]
    hw2 = [1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10]
    return [dict(cx=22, top=9, hw=hw2, ridges=[-.5, 0., .5], main=0., snow=0),
            dict(cx=13, top=0, hw=hw, ridges=[-.65, -.3, .1, .5], main=-.3, snow=9)]

def shade(p, dx, r, w, H, v):
    """ dx: 중심 기준, r: 행, w: 그 행 반폭. """
    if r == H - 1 or abs(dx) == w: return R(0)
    f = dx / max(w, 1)
    ridges, main = p['ridges'], p['main']
    # 능선 가까움 (행 폭에 비례해 방사형으로 벌어진다)
    near = min(abs(f - g) * max(w, 1) for g in ridges)
    onmain = abs(f - main) * max(w, 1) < 0.8 and r >= 2
    lit = f < main
    if p['snow'] and r < p['snow'] + ((dx + 16) % 3 == 0) - ((dx + 16) % 5 == 0):
        if onmain: return S_(2)
        if lit: return S_(6) if (abs(dx) >= w - 2 or r <= 1) else S_(5)
        return S_(3) if abs(dx) <= w - 2 else S_(2)
    if onmain: return R(1)
    if lit:
        if abs(dx) == w - 1: return R(6)
        if near < 0.75 and r >= 3: return R(3)
        return R(5) if (r < 4 or abs(dx) >= w - 3) else R(4)
    else:
        if abs(dx) == w - 1: return R(1)
        if near < 0.75 and r >= 3: return R(1)
        if v == 'B': return R(2) if (r % 7 or abs(dx) > w - 3) else R(1)
        return R(3) if abs(dx) <= 1 + r // 5 else R(2)

def main(slug, v):
    cv = {}
    peaks = sorted(cone(v), key=lambda p: p['top'] + len(p['hw']))
    for p in peaks:
        H = len(p['hw'])
        for r, w in enumerate(p['hw']):
            y = p['top'] + r
            for dx in range(-w, w + 1):
                x = p['cx'] + dx
                if 0 <= x < N and 0 <= y < N: cv[(x, y)] = shade(p, dx, r, w, H, v)
    # 발치: 마지막 두 줄에 둥근 뿌리(바깥 윤곽만 정리)
    grid = [[cv.get((x, y)) for x in range(N)] for y in range(N)]
    if v != 'A':
        for y in range(N):
            for x in range(N):
                if grid[y][x] is None:
                    if (x > 0 and y > 0 and grid[y-1][x-1] not in (None, '~', '-')) or (y > 0 and grid[y-1][x] not in (None, '~', '-')) or (x > 0 and grid[y][x-1] not in (None, '~', '-')):
                        if x > 1 and y > 0 and grid[y][x-1] in ('~',) or grid[y][x-1] not in ('~', '-'):
                            grid[y][x] = '~'
        for y in range(N):
            for x in range(N):
                if grid[y][x] is None and y >= 1 and x >= 2 and grid[y][x-1] == '~' and grid[y-1][x-1] not in ('~', '-', None) is False:
                    pass
    else:
        # A: 발치 그림자만 얇게
        for y in range(N):
            for x in range(N):
                if grid[y][x] is None and y > 0 and isinstance(grid[y-1][x], tuple) and y == max(yy for (xx, yy) in cv) + 1:
                    grid[y][x] = '~'
    txt = to_pxg(grid, f'{slug} wv3-{v}')
    out = os.path.join(os.path.dirname(os.path.dirname(HERE)), slug, f'wv3-{v}.pxg')
    open(out, 'w').write(txt); print('wrote', out)

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])

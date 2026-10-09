import sys, os
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', '..', 'wall_paper_torn', 'work'))
from h4lib import Cv, P
CH = os.path.join(HERE, '..', '..')
T = lambda t: P('tin', t)
W = lambda t: P('ward', t)
R = lambda t: P('rust', t)
V = lambda t: P('void', t)

def wheel(c, cx, cy, rx, ry, ramp, hi, lo):
    c.ell(cx, cy, rx, ry, P('grave', 1))
    c.ring(cx, cy, rx, ry, ramp(hi), 1.0)
    # 아래·오른쪽 림은 한 단 어둡게
    for y in range(c.h):
        for x in range(c.w):
            v = c.get(x, y)
            if v == ramp(hi) and ((x + .5 - cx) > 0.4 * rx or (y + .5 - cy) > 0.5 * ry):
                c.set(x, y, ramp(lo))
    ix, iy = int(cx), int(cy)
    for k in range(-int(ry) + 1, int(ry)):
        if c.get(ix, iy + k) == P('grave', 1): c.set(ix, iy + k, P('grave', 3))
    for k in range(-int(rx) + 1, int(rx)):
        if c.get(ix + k, iy) == P('grave', 1): c.set(ix + k, iy, P('grave', 3))
    c.set(ix, iy, ramp(hi - 1)); c.set(ix - 1, iy - 1, P('grave', 0)); c.set(ix + 1, iy + 1, P('grave', 0))

def chair(d):
    c = Cv(16, 16); lit = d == 'B'
    hi, lo = (6, 2) if lit else (5, 3)
    if d == 'C':
        # 옆모습: 큰 뒷바퀴 하나, 뒤로 젖힌 등받이, 튀어나온 발판
        wheel(c, 6.5, 9.5, 5.2, 5.4, T, hi, lo)
        c.rect(6, 6, 11, 8, W(3)); c.hl(6, 11, 6, W(4)); c.hl(6, 11, 8, W(1))       # 앉는 천
        c.line(6, 6, 3, 0, T(4)); c.line(7, 6, 4, 0, T(3)); c.hl(1, 4, 0, T(5)); c.hl(1, 4, 1, T(3)) if False else None  # 등받이 기둥과 손잡이
        c.rect(4, 2, 6, 6, W(2))   # 등받이 천
        c.line(11, 8, 12, 12, T(4)); c.line(12, 12, 15, 13, T(3)); c.hl(13, 15, 14, T(2))  # 발판 다리
        c.set(11, 7, T(4)); c.hl(9, 11, 5, T(4))  # 팔걸이
        c.ell(11.5, 14.5, 1.6, 0.8, V(2))
        c.set(2, 14, R(3)); c.set(3, 13, R(4)); c.set(9, 13, R(3))
        # 천 위 핏자국 손자국
        c.set(8, 7, P('blood', 3)); c.set(9, 7, P('blood', 2))
        return c
    # 앞쪽에서 살짝 비스듬히
    wheel(c, 3.0, 9.8, 2.7, 5.0, T, hi, lo)
    # 오른쪽 바퀴는 기울고 녹슮
    wheel(c, 13.0, 10.2, 2.6, 4.6, R, 5, 3)
    if d == 'A':
        c.set(13, 6, R(2)); c.set(12, 14, T(2))
    # 등받이
    c.rect(5, 3, 10, 8, W(3)); c.hl(5, 10, 3, W(4)); c.vl(5, 3, 8, W(4)); c.vl(10, 3, 8, W(1)); c.hl(5, 10, 8, W(1))
    c.rect(6, 4, 9, 7, W(2)) if d != 'B' else c.rect(6, 4, 9, 7, W(2))
    if lit:
        c.vl(6, 4, 7, W(3)); c.hl(6, 9, 4, W(4))
    # 손잡이 두 개
    c.rect(4, 1, 5, 2, T(hi)); c.rect(10, 1, 11, 2, T(lo + 1)); c.vl(5, 2, 3, T(lo)); c.vl(10, 2, 3, T(lo))
    c.set(4, 1, T(hi + 1 if hi < 6 else 6))
    # 앉는 천
    c.rect(5, 9, 10, 11, W(4 if lit else 3)); c.hl(5, 10, 9, W(5 if lit else 4)); c.hl(5, 10, 11, W(2)); c.vl(10, 9, 11, W(1))
    if d == 'A':
        c.set(7, 10, W(2)); c.set(8, 10, W(2)); c.set(8, 9, W(1))   # 낡은 눌림
    # 팔걸이
    c.hl(4, 5, 8, T(3)); c.hl(10, 11, 8, T(2))
    # 발판
    c.rect(6, 13, 9, 14, T(4)); c.hl(6, 9, 13, T(hi)); c.hl(6, 9, 14, T(lo)); c.vl(9, 13, 14, T(1))
    c.vl(6, 12, 12, T(3)); c.vl(9, 12, 12, T(2))
    if d == 'B':
        for x in range(2, 16):
            if not c.get(x, 15): c.set(x, 15, '~')
        for x in range(6, 16):
            if not c.get(x, 14): c.set(x, 14, '-')
        c.set(1, 3, '?'); c.set(2, 2, '?'); c.set(1, 4, '?')
    return c

N = {
 'A': '앞에서 살짝 비스듬히: 세로 타원 바퀴 둘(오른쪽은 기울어 녹), 바랜 회녹 앉는 천과 등받이, 손잡이 둘, 발판. 천에 낡은 눌림',
 'B': '왼쪽 위 빛: 왼쪽 바퀴·손잡이·천 윗변 밝게, 오른쪽 어둡게, 발판 아래 ~ - 그림자, 왼쪽 위 ? 달빛',
 'C': '옆모습 실루엣: 큰 바퀴 하나, 뒤로 길게 젖힌 등받이와 손잡이, 앞으로 튀어나온 발판, 앉는 천에 핏빛 손자국',
}
for d in 'ABC':
    chair(d).emit(f'{CH}/wheelchair/h4-{d}.pxg', f'wheelchair h4-{d}')
    open(f'{CH}/wheelchair/h4-{d}.note', 'w', encoding='utf-8').write(N[d] + '\n')

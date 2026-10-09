"""wv3 gate_fort 아이콘 생성기 (16x16). 사용: python3 wv3_gate.py gate_fort <A|B|C>"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from wv3_bundle import *
HERE = os.path.dirname(os.path.abspath(__file__))
N = 16
W = lambda t: ('wstone', t)
M = lambda t: ('mout', t)

def build_icon(v):
    g = [[None] * N for _ in range(N)]
    def put(x, y, c):
        if 0 <= x < N and 0 <= y < N: g[y][x] = c
    def rect(x0, y0, x1, y1, c):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1): put(x, y, c)
    if v == 'A':
        tx0, tx1, ttop = 3, 12, 2      # 문루
        sx, stop = 0, 6               # 벽 토막
        # 벽 토막: 윤곽 1 + 면 3, 왼쪽이 밝다
        for (a, b) in ((0, 2), (13, 15)):
            rect(a, stop, b, 15, W(3))
        rect(0, stop, 0, 15, W(4)); rect(15, stop, 15, 15, W(2))
        # 흉벽 토막
        for x in (0, 1, 14, 15): rect(x, stop - 1, x, stop, W(5))
        rect(0, stop - 1, 1, stop - 1, W(5)); rect(14, stop - 1, 15, stop - 1, W(4))
        # 문루 몸통
        rect(tx0, ttop + 2, tx1, 15, W(3))
        rect(tx0, ttop + 2, tx0 + 1, 15, W(4)); rect(tx1 - 1, ttop + 2, tx1, 15, W(2))
        rect(tx0, ttop + 2, tx1, ttop + 2, W(5))
        for x in (3, 4, 7, 8, 11, 12):
            rect(x, ttop, x, ttop + 1, W(5) if x < 8 else W(4))
        for x in (5, 6, 9, 10): put(x, ttop + 1, W(2))
        # 돌 이음
        for y in (7, 10, 13):
            for x in range(tx0, tx1 + 1):
                if g[y][x] is not None and x not in range(5, 11): put(x, y, W(2))
            for x in (0, 1, 2, 13, 14, 15):
                if y > stop + 1: put(x, y, W(2))
        # 문 아치 mout
        rect(6, 9, 9, 15, M(0)); rect(5, 10, 10, 15, M(0))
        for y in range(9, 16):
            put(4, y, W(1)) if y >= 10 else None; put(11, y, W(1)) if y >= 10 else None
        for x in (5, 6, 7, 8, 9, 10): put(x, 8 if x in range(6, 10) else 9, W(1))
        # 바깥 윤곽
        outline(g, W(1))
    elif v == 'B':
        # 더 깊은 명암 + 공중 돌출(처마 그림자) + 내리닫이 창살
        for (a, b) in ((0, 2), (13, 15)):
            rect(a, 6, b, 15, W(3))
        rect(0, 6, 1, 15, W(4)); rect(2, 6, 2, 15, W(3)); rect(13, 6, 13, 15, W(3)); rect(14, 6, 15, 15, W(2))
        for x in (0, 1, 14, 15): rect(x, 5, x, 6, W(5) if x < 8 else W(3))
        rect(3, 4, 12, 15, W(3))
        rect(3, 4, 5, 15, W(4)); rect(10, 4, 12, 15, W(2))
        rect(3, 3, 12, 4, W(4)); rect(10, 3, 12, 4, W(3))
        for x in (3, 4, 7, 8, 11, 12):
            rect(x, 1, x, 2, W(5) if x < 8 else W(3))
            put(x, 1, W(6) if x < 8 else W(4))
        for x in (5, 6, 9, 10): put(x, 2, W(2))
        rect(3, 5, 12, 5, W(2))
        for y in (8, 11, 14):
            for x in range(3, 13):
                if not (5 <= x <= 10 and y > 7): put(x, y, W(2))
        # 아치 + 창살
        rect(6, 8, 9, 15, M(0)); rect(5, 9, 10, 15, M(0))
        for y in range(10, 16, 2):
            for x in range(6, 10): put(x, y, W(2))
        for x in (6, 9):
            for y in range(9, 16): put(x, y, W(2)) if y % 2 == 1 else None
        outline(g, W(0))
        for x in range(4, 12): put(x, 8, W(1)) if g[8][x] is not None and g[8][x] != M(0) else None
    else:
        # C: 과장 아이콘 — 낮은 벽 토막에 통통한 문루, 둥근 아치와 창구멍
        for (a, b) in ((0, 3), (12, 15)):
            rect(a, 8, b, 15, W(3))
        rect(0, 8, 1, 15, W(4)); rect(14, 8, 15, 15, W(2))
        for x in (0, 1, 2, 13, 14, 15): put(x, 7, W(5) if x < 8 else W(4))
        for x in (0, 2, 13, 15): put(x, 6, W(5) if x < 8 else W(4))
        rect(2, 4, 13, 15, W(3))
        rect(2, 4, 4, 15, W(4)); rect(11, 4, 13, 15, W(2))
        rect(2, 3, 13, 4, W(5)); rect(11, 3, 13, 4, W(4))
        for x in (2, 3, 6, 7, 8, 9, 12, 13):
            rect(x, 1, x, 2, W(5) if x < 8 else W(4))
        for x in (4, 5, 10, 11): put(x, 2, W(2))
        # 창구멍 두 개
        for (x, y) in ((4, 6), (11, 6)): rect(x, y, x, y + 1, M(1))
        # 둥근 아치
        rect(6, 9, 9, 15, M(0)); rect(5, 10, 10, 15, M(0))
        rect(4, 11, 4, 15, W(2)); rect(11, 11, 11, 15, W(1))
        rect(6, 8, 9, 8, W(2))
        for y in (8, 11, 14):
            for x in range(2, 14):
                if g[y][x] is not None and g[y][x] != M(0) and not (5 <= x <= 10 and y >= 8): put(x, y, W(2))
        outline(g, W(1))
    return g

def outline(g, c):
    h = len(g); w = len(g[0])
    cells = [(x, y) for y in range(h) for x in range(w) if g[y][x] is not None]
    S = set(cells)
    for (x, y) in cells:
        for dx, dy in ((-1, 0), (1, 0), (0, -1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < w and 0 <= ny < h and (nx, ny) not in S: g[ny][nx] = c
    # 좌우 가장자리 칸은 바깥이 없으므로 윤곽을 안쪽에 두지 않는다

def main(slug, v):
    g = build_icon(v)
    txt = to_pxg(g, f'{slug} wv3-{v}')
    out = os.path.join(os.path.dirname(os.path.dirname(HERE)), slug, f'wv3-{v}.pxg')
    open(out, 'w').write(txt); print('wrote', out)

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])

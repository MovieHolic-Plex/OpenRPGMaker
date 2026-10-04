import sys, os, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from h4lib import Cv, P
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
PAPER = 'paper'; DAM = 'damask'; ROT = 'rot'; DUST = 'dust'; MOSS = 'hmoss'; VOID = 'void'

MOTIF = ["...a...",
         "..aba..",
         ".abcba.",
         "..aba..",
         "...a..."]
EYE = [".aaaaa.",
       "ab.c.ba",
       "abcvcba",
       ".abbba."]

def base(direction, lit=0):
    c = Cv(32, 32)
    # 종이 바탕 y=1..22, 위 테두리 y=0
    rnd = random.Random({'A': 11, 'B': 22, 'C': 33}[direction])
    for y in range(1, 23):
        for x in range(32):
            t = 4
            if x % 8 == 0: t = 3            # 세로 결(줄무늬 벽지)
            if rnd.random() < 0.06: t += 1
            elif rnd.random() < 0.05: t -= 1
            c.set(x, y, P(PAPER, t))
    c.hl(0, 31, 0, P(ROT, 2))
    # 위쪽 얼룩 그늘(천장 물때)
    for x in range(32):
        c.set(x, 1, P(PAPER, 3)); 
        if x % 3 == 0: c.set(x, 2, P(PAPER, 3))
    # 무늬
    lg_m = {'a': P(DAM, 2), 'b': P(DAM, 3), 'c': P(DAM, 4)}
    lg_e = {'a': P(DAM, 1), 'b': P(DAM, 3), 'c': P(PAPER, 6), 'v': P(VOID, 1)}
    for k in range(2):
        xo = 16 * k
        if direction == 'C':
            for (cx, cy) in ((3, 3), (3, 14), (11, 8), (11, 19)):
                c.paint(xo + cx - 3, cy - 1, EYE, lg_e)
        else:
            for (cx, cy) in ((3, 4), (3, 15), (11, 9), (11, 20)):
                c.paint(xo + cx - 3, cy - 2, MOTIF, lg_m)
            if direction == 'B':
                pass
    # 작은 점 무늬(사이)
    for k in range(2):
        for (cx, cy) in ((7, 4), (7, 15), (15, 9), (15, 20)):
            if direction != 'C': c.set(16 * k + cx, cy, P(DAM, 3))
    # 벽널 y=23..31
    c.hl(0, 31, 23, P(ROT, 5))
    c.hl(0, 31, 24, P(ROT, 2))
    for y in range(25, 31):
        for x in range(32):
            m = x % 4
            t = [4, 3, 3, 1][m]
            if direction == 'B': t = [5, 4, 3, 1][m]
            if y == 25 and t > 1: t = max(2, t - 1)
            c.set(x, y, P(ROT, t))
    c.hl(0, 31, 31, P(ROT, 1))
    return c

def shift(c, fn):
    for k, v in list(c.p.items()):
        if isinstance(v, tuple):
            d = fn(k[0], k[1], v)
            if d: c.p[k] = P(v[0], v[1] + d)

def poly_rows(rows):  # {y:(l,r)}
    m = set()
    for y, (l, r) in rows.items():
        for x in range(l, r + 1): m.add((x, y))
    return m

def plaster(c, m, direction):
    rnd = random.Random(5)
    for (x, y) in m:
        t = 3
        if rnd.random() < 0.15: t = 4
        elif rnd.random() < 0.12: t = 2
        c.set(x, y, P(DUST, t))
    # 종이 모서리 그늘(위·왼쪽 안쪽 한 줄 어둡게)
    for (x, y) in m:
        if (x - 1, y) not in m or (x, y - 1) not in m: c.set(x, y, P(DUST, 1))

def torn(direction):
    c = base(direction)
    if direction == 'A':
        hole = poly_rows({1: (22, 26), 2: (21, 27), 3: (20, 27), 4: (20, 28), 5: (19, 28), 6: (19, 27), 7: (19, 26), 8: (20, 25), 9: (21, 24), 10: (22, 23)})
        flap = poly_rows({7: (21, 26), 8: (20, 27), 9: (21, 27), 10: (22, 27), 11: (23, 26), 12: (24, 25)})
    elif direction == 'B':
        hole = poly_rows({1: (20, 27), 2: (19, 28), 3: (18, 28), 4: (18, 29), 5: (18, 29), 6: (18, 28), 7: (19, 27), 8: (20, 26), 9: (21, 25), 10: (22, 24)})
        flap = poly_rows({6: (19, 27), 7: (19, 28), 8: (20, 28), 9: (21, 28), 10: (22, 27), 11: (23, 27), 12: (24, 26), 13: (25, 26)})
    else:
        hole = None; flap = set()
    if direction != 'C':
        # 그림자(B 는 진하게 오른쪽 아래로)
        if direction == 'B':
            for (x, y) in flap:
                for dx, dy in ((1, 1), (2, 1), (2, 2), (3, 2), (3, 3)):
                    q = (x + dx, y + dy)
                    if q not in flap and q not in hole and c.get(*q) and c.get(*q)[0] in (PAPER, DAM, ROT):
                        v = c.get(*q); c.set(*q, P(v[0], v[1] - 3))
        plaster(c, hole - flap, direction)
        # 갈라진 금
        for (x, y) in ((22, 2), (22, 3), (23, 4), (23, 5)):
            if (x, y) in hole and (x, y) not in flap: c.set(x, y, P(DUST, 0))
        # 종이 찢긴 흰 섬유 가장자리(왼쪽·위)
        for (x, y) in hole:
            for dx, dy in ((-1, 0), (0, -1)):
                q = (x + dx, y + dy)
                if q not in hole and c.get(*q) and c.get(*q)[0] in (PAPER, DAM): c.set(*q, P(PAPER, 6))
        # 말린 자락 뒷면
        for (x, y) in flap:
            edge_r = (x + 1, y) not in flap; edge_d = (x, y + 1) not in flap
            t = 6 if direction == 'B' and x < 24 else 5
            if edge_r or edge_d: t = 2
            if (x, y - 1) not in flap: t = 6      # 접힌 위 모서리 빛
            c.set(x, y, P(PAPER, t))
        # 자락 뒷면 주름
        for (x, y) in ((22, 9), (23, 10)):
            if (x, y) in flap: c.set(x, y, P(PAPER, 4))
    else:
        # C: 세로로 길게 벗겨져 늘어진 벽지 띠 셋 — 살갗처럼 매달린다. 드러난 회반죽엔 검은 균열
        strips = [(5, 9, 15), (13, 17, 20), (22, 26, 12)]   # (좌x, 우x, 아래끝y)
        allhole = set()
        for (xl, xr, ye) in strips:
            for y in range(1, 23):
                for x in range(xl, xr + 1):
                    c.set(x, y, P(DUST, 3 if (x + y) % 5 else 4))
                    allhole.add((x, y))
        # 균열
        for (x, y) in ((7, 3), (7, 4), (8, 5), (8, 6), (7, 7), (7, 8), (15, 4), (15, 5), (16, 6), (16, 7), (16, 8), (15, 9), (24, 3), (24, 4), (25, 5), (25, 6)):
            c.set(x, y, P(DUST, 0))
        for (xl, xr, ye) in strips:
            # 위 그늘
            for x in range(xl, xr + 1): c.set(x, 1, P(DUST, 1)); c.set(x, 2, P(DUST, 2))
            # 늘어진 종이 띠(뒷면), 아래로 갈수록 좁아지며 말림
            for y in range(3, ye + 1):
                w = (xr - xl + 1) - (2 if y > ye - 4 else 0) - (2 if y > ye - 2 else 0)
                xs = xl + ((xr - xl + 1) - w) // 2 + (1 if xl == 13 else 0)
                for x in range(xs, xs + w):
                    t = 5
                    if x == xs: t = 6
                    if x == xs + w - 1: t = 2
                    if y == ye: t = 2
                    c.set(x, y, P(PAPER, t))
    return c

def stain(direction):
    c = base(direction)
    rnd = random.Random(9)
    # 두 줄 물때: (기준x, 위 y, 아래 y)
    streaks = [(9, 1, 21), (24, 1, 19)] if direction != 'C' else [(6, 1, 22), (14, 1, 22), (23, 1, 22)]
    for (sx, y0, y1) in streaks:
        w = 2
        for y in range(y0, y1 + 1):
            off = 0 if y < 6 else (1 if y < 12 else 0) if sx == 9 else (0 if y < 9 else -1)
            wobble = [0, 0, 1, 1, 0, 0, -1, 0][y % 8] if direction != 'B' else 0
            x0 = sx + off + wobble
            ww = 3 if y < y1 - 6 else 2
            if direction == 'B': ww = 4 if y < y1 - 6 else 3
            for x in range(x0, x0 + ww):
                v = c.get(x, y)
                if v and v[0] in (PAPER, DAM):
                    dd = 2 if (x == x0 or x == x0 + ww - 1) else 3
                    if direction == 'B': dd = 3 if (x == x0 or x == x0 + ww - 1) else 4
                    if direction == 'C': dd = 3
                    c.set(x, y, P(v[0], v[1] - dd))
        # 줄 끝 곰팡이
        for (dx, dy) in ((0, 0), (1, 0), (2, 0), (-1, -1), (0, -1), (1, -1), (0, -2), (2, -1), (1, 1)):
            x, y = sx + dx + (0 if sx == 9 else -1), y1 + dy + (0 if y1 == 21 else 2)
            if 1 <= y <= 22 and 0 <= x < 32:
                c.set(x, y, P(MOSS, 3 if (dx + dy) % 2 else 2))
    # 곰팡이 점(벽널 위 갓돌 쪽에 몰림)
    spots = [(3, 20), (4, 20), (4, 21), (13, 21), (14, 20), (18, 21), (19, 21), (28, 20), (29, 21), (30, 20), (30, 21)]
    if direction == 'B': spots = [(x, y) for (x, y) in spots if x > 12] + [(20, 19), (21, 19)]
    if direction == 'C': spots = [(x, y) for (x, y) in spots] + [(9, 22), (10, 22), (18, 22), (27, 22)]
    for (x, y) in spots: c.set(x, y, P(MOSS, 2 if (x + y) % 2 else 3))
    if direction == 'C':
        # 물때 줄이 눈에서 흘러내린 눈물 — 눈 밑에서 시작해 한 칸 더 길게
        pass
    return c

def lit(c, direction):
    if direction == 'B':
        shift(c, lambda x, y, v: (1 if (x < 12 and y < 12) else 0) + (-1 if (x > 20 and y > 10 and v[0] in (PAPER, DAM)) else 0) + (-1 if y > 15 and v[0] in (PAPER, DAM) else 0))
    return c

NOTES = {
 ('torn', 'A'): 'v5 벽(종이 22줄 + 벽널 8줄 + 갓돌) 그대로 낡힘: 다마스크 마름모, 종이 이음선, 위 물때 그늘, 오른쪽에 찢긴 한 자락이 말려 내려와 회반죽이 드러남',
 ('torn', 'B'): '왼쪽 위 빛: 왼쪽 위 종이·벽널은 한 단 밝게, 오른쪽 아래는 어둡게, 찢긴 자락이 크고 오른쪽 아래로 짙은 그림자(3줄)를 드리움',
 ('torn', 'C'): '무늬를 눈(눈동자 void)으로 재해석하고 벽지가 세 줄 길게 벗겨져 살갗처럼 늘어짐 — 드러난 회반죽에 검은 균열',
 ('stain', 'A'): 'torn A 와 같은 벽·무늬에 위→아래 물때 두 줄(세로 얼룩, 물결)과 줄 끝·갓돌 위 곰팡이 점',
 ('stain', 'B'): 'torn B 와 같은 빛 방식: 왼쪽 위 밝게·오른쪽 아래 어둡게, 굵고 짙은 물때 두 줄과 곰팡이가 오른쪽에 몰림',
 ('stain', 'C'): 'torn C 와 같은 눈 무늬 벽: 눈 밑에서 흘러내리는 눈물 같은 물때 세 줄, 줄 끝 곰팡이',
}
for d in 'ABC':
    for kind, fn, slug in (('torn', torn, 'wall_paper_torn'), ('stain', stain, 'wall_paper_stain')):
        c = lit(fn(d), d)
        c.emit(f'{ROOT}/{slug}/h4-{d}.pxg', f'{slug} h4-{d}')
        open(f'{ROOT}/{slug}/h4-{d}.note', 'w', encoding='utf-8').write(NOTES[(kind, d)] + '\n')

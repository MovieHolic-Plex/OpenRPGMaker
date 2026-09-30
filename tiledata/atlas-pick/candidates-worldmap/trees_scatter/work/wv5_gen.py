"""trees_scatter wv5 — 외딴 나무 셋(활엽·고목·야자) A/B/C. 손으로 적은 도장 3칸(48x16).
글자: 숫자=칸의 램프 단, p q r s = wbark 1 2 3 0, u v w x y z = wash 0 5 4 3 2 1, i j k m n o = wmead 5 4 3 0 1 2"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from wv5lib import *
OUT = os.path.join(HERE, '..')
MP = {'p': ('wbark', 1), 'q': ('wbark', 2), 'r': ('wbark', 3), 's': ('wbark', 0),
      'u': ('wash', 0), 'v': ('wash', 5), 'w': ('wash', 4), 'x': ('wash', 3), 'y': ('wash', 2), 'z': ('wash', 1),
      'i': ('wmead', 5), 'j': ('wmead', 4), 'k': ('wmead', 3), 'm': ('wmead', 0), 'n': ('wmead', 1), 'o': ('wmead', 2)}

def C16(rows, ramp='wleaf'):
    rows = [r.ljust(16, '.') for r in rows] + ['.' * 16] * (16 - len(rows))
    assert all(len(r) == 16 for r in rows) and len(rows) == 16, [len(r) for r in rows]
    return parse(rows, ramp, anchor=(0, 0), maps=MP)

def pad(crown, left=2):
    return [('.' * left + r) for r in crown]

def build(name, cells, title, note):
    cv = Cv(48, 16)
    for k, st in enumerate(cells):
        for (x, y), v in st['px'].items(): cv.put(k * 16 + x, y, v)
    for k in range(3):   # 그림자는 칸 안에서만
        sub = Cv(16, 16)
        for y in range(16):
            for x in range(16): sub.a[y][x] = cv.a[y][k * 16 + x]
        shadow_pass(sub, near=((1, 1), (1, 0), (0, 1)), far=((2, 2), (2, 1)))
        for y in range(16):
            for x in range(16): cv.a[y][k * 16 + x] = sub.a[y][x]
    open(os.path.join(OUT, f'wv5-{name}.pxg'), 'w').write(to_pxg(cv.a, title))
    open(os.path.join(OUT, f'wv5-{name}.note'), 'w').write(note.strip() + '\n')

# ===================== 활엽수 =====================
CA = ["...222100..", ".245555430.", "24555554320", "24555543320", "14554443210", "13544433210",
      "13444332210", ".133332210.", "..0232210..", "...00000..."]
TA = [".......qp", ".......qs", "......qqps"]
DA_LEAF = C16([''] + pad(CA) + pad(TA, 0))
CB = ["...245542...", ".2455555443.", "245551554332", "345555543322", "134555443210", "1345144432 1".replace(" ", ""),
      "12333332210.", ".1222322100.", "..0122221000".replace("..0122221000", "..01222100.."), "...000000..."]
TB = [".......rp", ".......qs", "......qrps"]
DB_LEAF = C16([''] + pad(CB) + pad(TB, 0))
CC = ["..2442..22..", ".245542.2442", "245555424542", "245555432431", "134555432320", ".1345543321.",
      "..134443210.", "..12333321..", "...0122210..", "....00000..."]
TC = [".......q.p", ".......rp", ".......qs", "......qrps"]
DC_LEAF = C16([''] + pad(CC) + pad(TC, 0))

# ===================== 고목 (줄기 윤곽 + 가지 선, 명암은 가장자리 규칙: 위·왼=밝음, 아래·오른=어둠) =====================
def seg(a, b):
    (x0, y0), (x1, y1) = a, b; n = max(abs(x1 - x0), abs(y1 - y0)) or 1
    return [(round(x0 + (x1 - x0) * i / n), round(y0 + (y1 - y0) * i / n)) for i in range(n + 1)]
def snag(trunk, branches, cols, holes=()):
    """trunk: {y:(x0,x1)}, branches: [(a,b,굵기)] 굵기 2 는 오른쪽 한 화소 더."""
    cv = Cv(16, 16); hi, mid, lo, out = cols
    for y, (x0, x1) in trunk.items():
        for x in range(x0, x1 + 1): cv.put(x, y, mid)
    for (a, b, t) in branches:
        pts = seg(a, b)
        for i, (x, y) in enumerate(pts):
            cv.put(x, y, mid)
            if t == 2 and i < len(pts) * 0.65: cv.put(x + 1, y, mid)
    for (x, y) in holes: cv.put(x, y, ('hole',))
    e = lambda x, y: cv.get(x, y) is None
    res = Cv(16, 16)
    for y in range(16):
        for x in range(16):
            if cv.a[y][x] is None: continue
            if cv.a[y][x] == ('hole',): res.a[y][x] = out; continue
            up, lf, dn, rt = e(x, y - 1), e(x - 1, y), e(x, y + 1), e(x + 1, y)
            if dn and rt: res.a[y][x] = out
            elif dn or rt: res.a[y][x] = lo
            elif up or lf: res.a[y][x] = hi
            else: res.a[y][x] = mid
    return res
def to_st(cv): return dict(w=16, h=16, px={(x, y): cv.a[y][x] for y in range(16) for x in range(16) if cv.a[y][x] is not None}, anchor=(0, 0))
BKc = lambda n: ('wbark', n); ASc = lambda n: ('wash', n)
TR = {14: (4, 10), 13: (5, 10), 12: (5, 9), 11: (6, 9), 10: (6, 9), 9: (6, 9), 8: (6, 9), 7: (6, 9)}
def deadA():
    return snag(TR, [((6, 7), (2, 1), 2), ((9, 7), (13, 0), 2), ((7, 6), (6, 2), 1), ((4, 4), (1, 4), 1), ((11, 3), (14, 4), 1), ((5, 3), (4, 1), 1)],
                (BKc(3), BKc(2), BKc(1), BKc(0)))
def deadB():
    tr = {14: (5, 10), 13: (6, 10), 12: (6, 9), 11: (7, 9), 10: (7, 9), 9: (7, 9), 8: (7, 9), 7: (7, 9), 6: (7, 8)}
    return snag(tr, [((7, 6), (4, 2), 1), ((8, 6), (11, 1), 1), ((7, 8), (2, 6), 1), ((9, 8), (14, 7), 1), ((8, 5), (8, 0), 1), ((5, 3), (2, 2), 1), ((10, 3), (13, 4), 1)],
                (ASc(4), ASc(3), ASc(2), ASc(0)))
def deadC():
    tr = {14: (3, 10), 13: (4, 10), 12: (5, 10), 11: (6, 10), 10: (7, 10), 9: (7, 10), 8: (8, 11), 7: (8, 11), 6: (9, 11), 5: (9, 11)}
    return snag(tr, [((10, 5), (13, 1), 2), ((9, 4), (5, 1), 1), ((8, 8), (3, 8), 2), ((3, 8), (2, 12), 1), ((12, 4), (14, 6), 1)],
                (BKc(3), BKc(2), BKc(1), BKc(0)), holes=[(7, 11), (7, 12), (8, 12), (8, 13)])
DEAD_A, DEAD_B, DEAD_C = to_st(deadA()), to_st(deadB()), to_st(deadC())

# ===================== 야자 =====================
def frond(cv, a, c, b, L=3, M=2, D=0, wmax=1, ramp='wmead', tip=0):
    """이차 곡선 잎. 법선 방향으로 굵기 2*wmax+1 → 끝에서 1. 위쪽=밝음, 아래쪽=어둠"""
    n = 40; prev = None
    for i in range(n + 1):
        t = i / n
        x = (1 - t) ** 2 * a[0] + 2 * (1 - t) * t * c[0] + t * t * b[0]; y = (1 - t) ** 2 * a[1] + 2 * (1 - t) * t * c[1] + t * t * b[1]
        dx = 2 * (1 - t) * (c[0] - a[0]) + 2 * t * (b[0] - c[0]); dy = 2 * (1 - t) * (c[1] - a[1]) + 2 * t * (b[1] - c[1])
        ln = math.hypot(dx, dy) or 1; nx, ny = -dy / ln, dx / ln
        if ny > 0 or (ny == 0 and nx > 0): nx, ny = -nx, -ny     # 법선이 위쪽을 향하게
        w = wmax if t < 0.55 else (wmax if t < 0.8 and wmax > 1 else 0)
        for k in range(-w, w + 1):
            px, py = round(x + k * nx), round(y + k * ny)
            v = (ramp, L) if k < 0 else ((ramp, M) if k == 0 else (ramp, D + 1))
            if t > 0.93: v = (ramp, tip + 1)
            if cv.get(px, py) is None or k == 0: cv.put(px, py, v)
def palm(fronds, trunk, hub, **kw):
    cv = Cv(16, 16)
    for f in fronds: frond(cv, *f[:3], **{**kw, **(f[3] if len(f) > 3 else {})})
    for (x, y, v) in trunk: cv.put(x, y, v)
    for (x, y) in hub: cv.put(x, y, ('wmead', 1))
    return cv
STR = [(8, 5, 2), (8, 6, 2), (7, 7, 3), (8, 7, 1), (7, 8, 2), (7, 9, 2), (8, 9, 1), (7, 10, 3), (7, 11, 2), (8, 11, 1), (7, 12, 2), (7, 13, 2), (8, 13, 1), (6, 14, 2), (7, 14, 2), (8, 14, 0)]
STR = [(x, y, BKc(n)) for (x, y, n) in STR]
def palmA():   # 방사 다섯 갈래, 끝이 처진다
    return palm([((8, 5), (1, -2), (0, 9)), ((8, 5), (15, -2), (16, 9)), ((8, 5), (3, 2), (0, 5), dict(wmax=1)), ((8, 5), (13, 2), (16, 5)), ((8, 5), (8, -1), (8, 0))], STR, [(8, 4), (7, 4), (9, 4), (8, 5)], L=4, M=3, D=1, wmax=1)
def palmB():   # 늘어진 우산 — 잎 일곱 갈래가 모두 아래로 처지고 코코넛 두 알, 줄기는 왼쪽으로 기움
    tr = [(9, 4, 2), (9, 5, 2), (8, 6, 3), (9, 6, 1), (8, 7, 2), (8, 8, 2), (7, 9, 3), (8, 9, 1), (7, 10, 2), (7, 11, 2), (8, 11, 1), (7, 12, 2), (7, 13, 2), (6, 14, 2), (7, 14, 2), (8, 14, 0)]
    cv = palm([((9, 4), (2, -1), (0, 10)), ((9, 4), (16, -1), (16, 9)), ((9, 4), (4, -3), (3, 4)), ((9, 4), (14, -3), (15, 4)), ((9, 4), (9, -4), (9, 1)), ((9, 4), (5, 3), (2, 10)), ((9, 4), (13, 3), (14, 10))],
              [(x, y, BKc(n)) for (x, y, n) in tr], [(9, 4), (8, 4), (10, 4)], L=5, M=3, D=1, wmax=1)
    for (x, y) in ((8, 5), (10, 5)): cv.put(x, y, BKc(0))
    return cv
def palmC():   # 부채꼴 — 짧고 굵은 줄기에서 잎 여섯이 위로 솟고 마디 고리 무늬
    tr = [(x, y, BKc(2)) for y in range(7, 14) for x in (7, 8)] + [(6, 14, BKc(2)), (7, 14, BKc(2)), (8, 14, BKc(1)), (9, 14, BKc(0))]
    tr += [(7, y, BKc(3)) for y in range(7, 14)] + [(8, y, BKc(1)) for y in range(7, 14)] + [(x, y, BKc(0)) for y in (8, 10, 12) for x in (7, 8)]
    return palm([((8, 6), (2, 3), (0, 4)), ((8, 6), (14, 3), (16, 4)), ((8, 6), (4, 0), (2, 0)), ((8, 6), (12, 0), (14, 0)), ((8, 6), (7, -2), (5, -1)), ((8, 6), (9, -2), (11, -1))],
                tr, [(8, 6), (7, 6), (9, 6), (8, 7)], L=5, M=3, D=2, wmax=1)
PALM_A, PALM_B, PALM_C = to_st(palmA()), to_st(palmB()), to_st(palmC())
if __name__ == '__main__':
    x = sys.argv[1] if len(sys.argv) > 1 else 'A'
    cells = {'A': [DA_LEAF, DEAD_A, PALM_A], 'B': [DB_LEAF, DEAD_B, PALM_B], 'C': [DC_LEAF, DEAD_C, PALM_C]}[x]
    build(x, cells, f'trees_scatter wv5-{x}', 'tmp')

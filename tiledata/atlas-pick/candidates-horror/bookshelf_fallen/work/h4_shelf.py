import sys, os
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', '..', 'wall_paper_torn', 'work'))
from h4lib import Cv, P
CH = os.path.join(HERE, '..', '..')

def inpoly(pts, x, y):
    s = None
    for i in range(len(pts)):
        a = pts[i]; b = pts[(i + 1) % len(pts)]
        cr = (b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0])
        if cr == 0: continue
        sg = cr > 0
        if s is None: s = sg
        elif s != sg: return False
    return True

def fill(c, pts, fn):
    for y in range(c.h):
        for x in range(c.w):
            if inpoly(pts, x + .5, y + .5):
                v = fn(x, y)
                if v: c.set(x, y, v)

def book(c, x, y, w, h, ramp, tone=3, dark=1):
    c.rect(x, y, x + w - 1, y + h - 1, P(ramp, tone))
    c.hl(x, x + w - 1, y + h - 1, P(ramp, tone - 2))
    c.hl(x, x + w - 1, y, P(ramp, tone + 1))
    c.vl(x + w - 1, y, y + h - 1, P(ramp, tone - 2))
    c.set(x + 1, y + 1, P('sheet', 4)) if w > 3 and h > 2 else None

def open_book(c, x, y, tilt=0):
    # 펼친 책 8x5
    for i in range(8):
        for j in range(5):
            t = 5 if j < 4 else 2
            if i == 3 or i == 4: t = 3
            c.set(x + i, y + j + (1 if i > 4 and tilt else 0), P('sheet', t))
    c.hl(x, x + 7, y - 1, P('vred', 2)) if False else None
    for i in (1, 2, 5, 6):
        if True: c.set(x + i, y + 1, P('sheet', 3)); c.set(x + i, y + 3, P('sheet', 3))
    c.hl(x, x + 7, y + 5 if tilt == 0 else y + 5, P('vred', 1))

def shelf(d):
    c = Cv(32, 32)
    W, H = (22, 16) if d != 'C' else (20, 18)
    x0, y0 = (3, 5) if d != 'C' else (5, 3)
    sh = 4 if d != 'C' else 3
    lit = d == 'B'
    def off(v): return (H - 1 - v) // sh
    m = set()
    for v in range(H):
        for u in range(W):
            m.add((x0 + u + off(v), y0 + v))
    for v in range(H):
        for u in range(W):
            x, y = x0 + u + off(v), y0 + v
            t = 4 if not lit else (5 if u < W // 2 else 4)
            if u in (7, 14) : t -= 1
            if u in (8, 15) and not lit: t += 0
            fr = u < 2 or u >= W - 2 or v < 2 or v >= H - 2
            if fr: t = 5 if not lit else (6 if (u < 2 or v < 2) else 4)
            if u == 2 or u == W - 3 or v == 2 or v == H - 3:
                if not fr: t = 3          # 틀 안쪽 홈
            if v in (H // 2, H // 2 + 1) and 2 < u < W - 3: t = 5 if v == H // 2 else 2   # 가로 보강대
            c.set(x, y, P('mahog', t))
    # 윤곽
    def is_m(x, y): return (x, y) in m
    for (x, y) in list(m):
        if not is_m(x - 1, y) or not is_m(x, y - 1): c.set(x, y, P('mahog', 6 if lit else 5)) if (y == y0 or (not is_m(x - 1, y) and x >= 0)) and False else None
    # 옆면 두께: 아래 3줄, 오른쪽 2칸
    for (x, y) in list(m):
        if not is_m(x, y + 1):
            for k in range(1, 4): c.set(x, y + k, P('mahog', {1: 3, 2: 2, 3: 1}[k]))
        if not is_m(x + 1, y):
            for k in range(1, 3):
                if not c.get(x + k, y): c.set(x + k, y, P('mahog', {1: 3, 2: 2}[k]))
    # 위·왼 윤곽선
    for (x, y) in list(m):
        if not is_m(x, y - 1) : c.set(x, y - 1, P('mahog', 2))
        if not is_m(x - 1, y): c.set(x - 1, y, P('mahog', 2))
    # 튀어나온 칸막이 끝(아래 두께 밑으로 판 끝 두 개)
    for u in (6, 15):
        x = x0 + u + off(H - 1)
        for k in range(4, 6):
            for dx in (0, 1): c.set(x + dx, y0 + H - 1 + k, P('mahog', 4 if k == 4 else 2))
        for dx in (0, 1): c.set(x + dx, y0 + H + 5 if False else y0 + H - 1 + 6, P('mahog', 2))
    # 못
    for (u, v) in ((4, 4), (17, 4), (4, 12), (17, 12)) if d != 'C' else ((4, 4), (15, 4)):
        c.set(x0 + u + off(v), y0 + v, P('vbrass', 3))
    if d == 'C':
        # 널 틈에서 뻗은 손: 틈(void) 세로 + 손가락
        cx = x0 + 9 + off(6)
        for y in range(y0 + 3, y0 + 13): c.set(cx, y, P('void', 0)); c.set(cx + 1, y, P('void', 1))
        for i, fx in enumerate((cx - 3, cx - 1, cx + 2, cx + 4)):
            ln = (5, 7, 7, 5)[i]
            for y in range(y0 + 8, y0 + 8 + ln): c.set(fx, y, P('void', 0 if i % 2 else 1))
            c.set(fx, y0 + 8 + ln, P('bisque', 3))
        for x in range(cx - 3, cx + 5): c.set(x, y0 + 8, P('void', 0))
    top = None
    return c, top

def scatter(c, d, top):
    if d == 'C':
        pass
    # 쏟아진 책
    spots = [(1, 24, 5, 3, 'vred'), (7, 27, 4, 3, 'vblue'), (13, 25, 5, 3, 'vgreen'), (20, 28, 4, 3, 'vred'), (26, 25, 4, 3, 'vblue'), (3, 29, 3, 2, 'vgreen')]
    if d == 'B': spots = [(1, 25, 5, 3, 'vred'), (8, 28, 4, 3, 'vblue'), (14, 26, 5, 3, 'vgreen'), (21, 28, 4, 3, 'vred'), (27, 26, 4, 3, 'vblue')]
    if d == 'C': spots = [(2, 23, 4, 3, 'vred'), (5, 27, 5, 3, 'vblue'), (11, 29, 4, 2, 'vgreen'), (18, 27, 4, 3, 'vred'), (25, 24, 5, 3, 'vblue')]
    for (x, y, w, h, r) in spots:
        book(c, x, y, w, h, r, 3, 1)
    ox, oy = (12, 25) if d != 'C' else (20, 22)
    if d != 'C': open_book(c, 19, 26 if d == 'B' else 25)
    else: open_book(c, 12, 26)

def shadow_b(c):
    m = {k for k, v in c.p.items() if isinstance(v, tuple)}
    for (x, y) in sorted(m):
        for dx, dy in ((1, 1), (2, 1), (2, 2), (3, 2), (3, 3)):
            q = (x + dx, y + dy)
            if q not in c.p and 0 <= q[0] < 32 and 0 <= q[1] < 32:
                c.set(*q, '~' if dx + dy <= 4 else '-')

NOTE = {
 'A': '앞으로 넘어진 2칸 책장: 등판이 위로 보이고(널판 이음 세로), 아래·오른쪽 옆면 두께가 보이며 칸막이 끝이 튀어나옴, 바닥에 쏟아진 색 책 6권과 펼친 책 하나',
 'B': '왼쪽 위 강한 빛: 등판 왼쪽 위 밝게·오른쪽 어둡게, 옆면 더 어둡게, 판 아래 오른쪽으로 ~ - 그림자, 책 5권과 펼친 책',
 'C': '등판 널 틈에서 창백하지 않은 검은 손이 뻗어 나오는 재해석: 판이 더 세워지고, 틈은 void, 손가락 넷이 늘어짐, 책은 손 방향으로 길게 흩어짐',
}
for d in 'ABC':
    c, top = shelf(d)
    if d == 'B': shadow_b(c)
    # 그림자 먼저 뒤, 책은 그 위
    scatter(c, d, top)
    c.emit(f'{CH}/bookshelf_fallen/h4-{d}.pxg', f'bookshelf_fallen h4-{d}')
    open(f'{CH}/bookshelf_fallen/h4-{d}.note', 'w', encoding='utf-8').write(NOTE[d] + '\n')

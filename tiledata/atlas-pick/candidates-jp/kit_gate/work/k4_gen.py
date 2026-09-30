"""B·C 공용 생성기: 몸통 폭·색조·그림자 세기를 바꿔 방향을 나눈다."""
from k4_lib import *
def build(name, cfg):
    S = Sheet()
    M = lambda n: ('mmetal', n); C = lambda n: ('mconc', n); W = lambda n: ('mwhite', n)
    GL = lambda n: ('mglass', n); DG = lambda n: ('mdglass', n); B = lambda n: ('kblue', n)
    GR = lambda n: ('kgreen', n); R = lambda n: ('akachin', n); PV = lambda n: ('mpave', n)
    OR = lambda n: ('korange', n); LQ = lambda n: ('lacq', n); GN = lambda n: ('mgran', n)
    x0, x1 = cfg['x0'], cfg['x1']            # 몸통 왼·오른 (포함)
    body = cfg['body']                       # 몸통 앞면 색 (ramp,tone)
    hi = cfg['hi']; lo = cfg['lo']; edge = cfg['edge']; topc = cfg['top']
    sw = cfg['shadow']                       # 그림자 폭(오른쪽)
    inner = list(range(x0 + 2, x1 - 1))
    # 바닥
    p = S.part('floor')
    A, Bc = cfg['floor']
    for y in range(16):
        for x in range(16): p.px(x, y, A if ((x // 8) + (y // 8)) % 2 == 0 else Bc)
    for i in range(16):
        for k in (7, 15): p.px(k, i, cfg['joint']); p.px(i, k, cfg['joint'])
    for (x, y) in cfg['specks']: p.px(x, y, cfg['speck'])
    def shadow(p, y):
        for i in range(sw): p.px(x1 + 1 + i, y, '~' if i == 0 else '-')
    def top(p, y, cap=False):
        p.px(x0, y, edge); p.px(x0 + 1, y, topc[0])
        for x in range(x0 + 2, x1 - 1): p.px(x, y, topc[1])
        p.px(x1 - 1, y, topc[2]); p.px(x1, y, edge)
    p = S.part('gm_t')
    p.row(1, x0 + 2, x1 - 2, edge)
    p.px(x0 + 1, 2, edge); p.px(x1 - 1, 2, edge); p.row(2, x0 + 2, x1 - 2, topc[1]); p.px(x0 + 2, 2, topc[0])
    for y in range(3, 16): top(p, y)
    for y in range(2, 16): shadow(p, y)
    p = S.part('gm_m')
    for y in range(16): top(p, y); shadow(p, y)
    p.row(7, x0 + 2, x1 - 2, topc[2])
    def front(p, kind):
        for y in range(0, 3): top(p, y); shadow(p, y)
        p.px(x0, 3, edge); p.px(x1, 3, edge); p.row(3, x0 + 1, x1 - 1, cfg['lip']); shadow(p, 3)
        for y in range(4, 13):
            p.px(x0, y, edge); p.px(x0 + 1, y, hi); p.row(y, x0 + 2, x1 - 2, body); p.px(x1 - 1, y, lo); p.px(x1, y, edge); shadow(p, y)
        p.row(13, x0, x1, edge); shadow(p, 13)
        for j in range(cfg['fshadow']): p.row(14 + j, x0 + 1 + j, x1 + sw - j * 0, '~' if j == 0 else '-') if 14 + j < 16 else None
        cx = (x0 + x1) // 2
        l = cx - 2
        if kind == 'in':
            p.rect(l, 5, 5, 4, DG(1)); p.row(5, l, l + 4, DG(0))
            for dx, dy in ((2, 5), (2, 6), (1, 7), (2, 7), (3, 7), (2, 8), (1, 6), (3, 6)): p.px(l + dx - 0, dy, GR(4) if dy < 8 else GR(3))
            p.rect(l + 1, 10, 3, 2, B(3)); p.row(10, l + 1, l + 3, B(4)); p.px(l + 2, 11, W(3))
        elif kind == 'out':
            p.rect(l, 5, 5, 5, DG(1))
            ring = ['.rrr.', 'rwwwr', 'rwwwr', 'rwwwr', '.rrr.']
            p.art(l, 5, ring, {'r': R(4), 'w': W(3)}); p.px(l + 2, 7, R(3)); p.row(7, l + 1, l + 3, R(3))
            p.row(11, l + 1, l + 3, edge)
        else:
            p.rect(l, 5, 5, 5, B(1)); p.rect(l + 1, 6, 3, 3, B(3)); p.row(6, l + 1, l + 3, B(4)); p.px(l + 2, 8, W(3)); p.px(l + 2, 7, W(2))
    for s_, k_ in (('gm_b_in', 'in'), ('gm_b_out', 'out'), ('gm_b_ic', 'ic')): front(S.part(s_), k_)
    # 통로
    p = S.part('lane_t')
    for dx in (0, 15):
        p.px(dx, 14, M(5)); p.px(dx, 15, M(2))
    p.px(1 if cfg['wingsh'] else 0, 15, '-'); p.px(14, 15, '-') if cfg['wingsh'] else None
    p = S.part('lane_m')
    for y in range(16):
        p.px(0, y, '-')
        if cfg['wingsh']: p.px(15, y, '-')
    p = S.part('lane_b')
    wl = cfg['wing']
    for x in range(wl):
        for xx in (x, 15 - x):
            p.px(xx, 6, GL(6)); p.px(xx, 7, GL(4)); p.px(xx, 8, M(1))
    for x in range(wl + 1):
        for xx in (x, 15 - x): p.px(xx, 9, '-')
    p.px(0, 5, '-'); p.px(15, 5, '-')
    # 끝 막음
    def endcap(p, left):
        for y in range(1, 30):
            if y == 1: p.row(1, x0 + 2, x1 - 2, edge); continue
            if y == 2: top(p, 2); p.px(x0, 2, ('mmetal', 0)); p.px(x1, 2, ('mmetal', 0)); shadow(p, y); continue
            p.px(x0, y, edge); p.px(x1, y, edge)
            frame = y in (3, 15, 16, 28, 29)
            p.px(x0 + 1, y, hi); p.px(x1 - 1, y, lo)
            for x in range(x0 + 2, x1 - 1): p.px(x, y, M(4) if frame else GL(5 if x < (x0 + x1) // 2 else 4))
            if not frame: p.px(x0 + 2, y, GL(6))
            shadow(p, y)
        p.row(29, x0, x1, edge); p.row(30, x0 + 1, x1 + sw, '~'); p.row(31, x0 + 2, x1 + sw, '-')
    endcap(S.part('end_l'), True); endcap(S.part('end_r'), False)
    # 칸막이
    p = S.part('fence')
    for x in range(16):
        p.px(x, 1, edge)
        for y in range(2, 18): p.px(x, y, cfg['fpan'] if y > 2 else W(3))
        p.px(x, 18, W(1)); p.px(x, 19, M(5))
        for y in range(20, 27): p.px(x, y, GL(4) if y > 20 else M(4))
        p.px(x, 27, M(2)); p.px(x, 28, edge); p.px(x, 29, '~'); p.px(x, 30, '-')
    for y in range(2, 18): p.px(7, y, C(3)); p.px(8, y, W(3))
    for y in range(20, 27): p.px(7, y, M(2)); p.px(8, y, GL(6))
    # 안내판
    def sign(p, kind):
        l = kind == 'l'; r = kind == 'r'
        a = 2 if l else 0; b = 13 if r else 15
        for x in range(a, b + 1):
            p.px(x, 4, LQ(3)); p.px(x, 5, LQ(1))
            for y in (6, 7, 8, 9, 10): p.px(x, y, LQ(0))
            p.px(x, 11, LQ(2)); p.px(x, 12, '-')
            if x % 4 in (1, 2): p.px(x, 7, OR(4)); p.px(x, 9, OR(3))
            if x % 4 == 1: p.px(x, 8, OR(4))
        if l:
            for y in range(0, 4): p.px(4, y, M(3))
        if r:
            for y in range(0, 4): p.px(11, y, M(3))
    for k_ in 'lmr': sign(S.part('disp_' + k_), k_)
    S.save(name, 'kit_gate ' + name)

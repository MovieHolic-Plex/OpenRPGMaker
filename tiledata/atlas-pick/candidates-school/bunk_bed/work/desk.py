import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from s3k import C
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
def out(slug, X): return ROOT + '/%s/s3-%s.pxg' % (slug, X)

def desk(W, R, books, cushion, lampc, notebook, style='A', chair_metal=False):
    c = C(32, 32)
    P = lambda s: (R, s)
    # 선반(hutch)
    c.rect(1, 0, 30, 10, P(1))                              # 뒤판(어둡게)
    c.hl(1, 0, 30, P(5)); c.hl(1, 1, 30, P(3))              # 윗판
    c.vl(1, 0, 10, P(4)); c.vl(2, 1, 9, P(3)); c.vl(30, 0, 10, P(2)); c.vl(29, 1, 9, P(1))
    c.hl(1, 8, 30, P(5)); c.hl(1, 9, 30, P(2))              # 선반 바닥판
    x = 13
    hs = [5, 6, 4, 6, 5, 4, 6]
    for i, (col, w) in enumerate(books):
        h = hs[i % len(hs)]
        c.rect(x, 8 - h, w, h, (col, 3)); c.vl(x, 8 - h, h, (col, 4)); c.vl(x + w - 1, 8 - h, h, (col, 1))
        c.hl(x, 8 - h, w, (col, 5)); c.hl(x + 1, 8 - h + 2, w - 2, (col, 5)) if w > 2 else None
        x += w
    # 책상 윗면
    c.rect(0, 10, 32, 6, P(4)); c.hl(0, 10, 32, P(6)); c.hl(0, 11, 32, P(5))
    for xx in (7, 19): c.hl(xx, 13, 5, P(3))
    c.hl(0, 15, 32, P(2))
    # 앞 상판 두께
    c.hl(0, 16, 32, P(3)); c.hl(0, 17, 32, P(1))
    # 다리
    for x0 in (1, 28):
        c.vl(x0, 18, 12, P(3)); c.vl(x0+1, 18, 12, P(4) if x0 < 10 else P(2)); c.vl(x0+2, 18, 12, P(1)) if x0 > 10 else None
    c.vl(x0 := 1, 18, 12, P(4)); c.vl(2, 18, 12, P(3)); c.vl(29, 18, 12, P(2)); c.vl(30, 18, 12, P(1))
    # 서랍 덩이(오른쪽)
    c.rect(21, 18, 8, 10, P(3)); c.hl(21, 18, 8, P(4)); c.vl(21, 18, 10, P(4)); c.vl(28, 18, 10, P(2))
    c.hl(22, 22, 6, P(1)); c.hl(22, 27, 6, P(1))
    c.hl(23, 20, 4, P(5)); c.hl(23, 25, 4, P(5))
    # 책상 위 소품
    nb, nb2 = notebook
    c.rect(11, 11, 8, 4, ('washi', 4)); c.hl(11, 11, 8, ('washi', 5)); c.hl(11, 14, 8, ('washi', 2))
    c.hl(12, 12, 5, (nb, 3)); c.hl(12, 13, 6, (nb, 2)); c.vl(11, 11, 4, (nb2, 3))
    c.px(19, 12, ('viron', 5)); c.px(20, 12, ('viron', 5))                                     # 연필
    # 스탠드
    lb, lh, ln = lampc
    c.rect(4, 14, 6, 2, (ln, 2)); c.hl(4, 14, 6, (ln, 4)); c.hl(5, 15, 4, (ln, 1))
    c.vl(6, 9, 5, (ln, 3)); c.vl(7, 9, 5, (ln, 1))
    c.hl(6, 8, 4, (ln, 3)); c.hl(7, 7, 5, (lb, 4)); c.hl(8, 6, 4, (lb, 3)); c.hl(9, 5, 3, (lb, 2))
    c.hl(9, 8, 3, (lh, 5)); c.px(11, 9, (lh, 6))                                              # 불빛 점
    # 의자(책상 앞)
    if not chair_metal:
        c.rect(11, 20, 10, 5, (cushion, 3)); c.hl(11, 20, 10, (cushion, 5)); c.hl(12, 21, 8, (cushion, 4)); c.hl(11, 24, 10, (cushion, 1))
        c.vl(11, 20, 5, (cushion, 4)); c.vl(20, 20, 5, (cushion, 1))
        c.rect(10, 25, 12, 2, (R, 4)); c.hl(10, 25, 12, (R, 5)); c.hl(10, 26, 12, (R, 2))
        for xx in (10, 20): c.vl(xx, 27, 3, (R, 2)); c.vl(xx+1, 27, 3, (R, 1))
    else:
        c.rect(11, 20, 10, 5, (cushion, 3)); c.hl(11, 20, 10, (cushion, 5)); c.hl(11, 24, 10, (cushion, 1)); c.vl(20, 20, 5, (cushion, 2))
        c.rect(10, 25, 12, 2, ('viron', 4)); c.hl(10, 25, 12, ('viron', 5)); c.hl(10, 26, 12, ('viron', 2))
        c.vl(15, 27, 2, ('viron', 3)); c.hl(12, 29, 8, ('viron', 3)); c.hl(12, 30, 8, ('viron', 1))
    return c

def fin(c, X, note, shadow=True):
    for j in range(28, 32):
        pass
    c.shadow(2, 30, 29, 2)
    c.save(out('dorm_desk', X), note)

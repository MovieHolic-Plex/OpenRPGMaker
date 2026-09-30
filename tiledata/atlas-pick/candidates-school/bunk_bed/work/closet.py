import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from s3k import C
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
def out(slug, X): return ROOT + '/%s/s3-%s.pxg' % (slug, X)

def closet(R, hs, style):
    c = C(16, 32); P = lambda s: (R, s)
    hs_ = hs  # 위 장 높이
    # 윗면 1px
    c.hl(0, 0, 16, P(6)); c.px(0, 0, P(4)); 
    # 몸통 뼈대
    c.rect(0, 1, 16, 28, P(3))
    c.vl(0, 1, 28, P(4)); c.vl(15, 1, 28, P(1)); c.vl(1, 1, 28, P(5) if style != 'B' else P(4))
    # 위 장(붙박이 위칸)
    c.hl(0, 1, 16, P(5)); c.hl(1, 2, 14, P(4))
    c.rect(2, 3, 12, hs_ - 3, P(3)); c.hl(2, 3, 12, P(4)); c.hl(2, hs_ - 1, 12, P(2)); c.vl(13, 3, hs_ - 3, P(2)); c.vl(2, 3, hs_-3, P(4))
    c.px(11, hs_ - 4, P(6) if style != 'C' else ('viron', 6)); c.px(11, hs_ - 3, P(1))
    # 가로 띠
    c.hl(0, hs_, 16, P(2)); c.hl(0, hs_ + 1, 16, P(5)); c.hl(0, hs_ + 2, 16, P(1))
    return c

def doors(c, R, hs, style, uni=('uniform', 3), hcol=None, hcol2=None):
    P = lambda s: (R, s)
    y0 = hs + 3; y1 = 27
    for (x0, x1) in ((2, 7), (9, 14)):
        c.rect(x0, y0, x1 - x0 + 1, y1 - y0 + 1, P(3))
        c.hl(x0, y0, x1 - x0 + 1, P(5)); c.vl(x0, y0, y1 - y0 + 1, P(4)); c.vl(x1, y0, y1 - y0 + 1, P(2)); c.hl(x0, y1, x1 - x0 + 1, P(1))
        # 판넬 홈
        c.rect(x0 + 1, y0 + 2, x1 - x0 - 1, 7, P(3)); c.hl(x0 + 1, y0 + 2, x1 - x0 - 1, P(2)); c.vl(x1 - 1, y0 + 2, 7, P(4)) if False else None
        c.hl(x0 + 1, y0 + 8, x1 - x0 - 1, P(4))
    # 가운데 틈 (교복이 보임)
    c.vl(8, y0, y1 - y0 + 1, uni)
    c.vl(8, y0, 2, P(0)); 
    for j in range(y0 + 3, y1, 4): c.px(8, j, (uni[0], 5))
    # 손잡이 둘
    hy = y0 + 9
    c.rect(6, hy, 1, 3, hcol or ('vbrass', 5)); c.px(6, hy, ('vbrass', 6)) if hcol is None else None
    c.rect(10, hy, 1, 3, hcol or ('vbrass', 5)); c.px(10, hy, ('vbrass', 6)) if hcol is None else None
    # 받침
    c.rect(0, 28, 16, 2, P(1)); c.hl(0, 28, 16, P(3)); c.hl(0, 29, 16, P(0))

def fin(c, X, note):
    c.px(0,0,'.'); c.px(15,0,'.'); c.px(0,1,c.get(0,1)) 
    c.shadow(1, 30, 14, 2)
    c.save(out('dorm_closet', X), note)

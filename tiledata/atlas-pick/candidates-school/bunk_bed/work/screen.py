import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from s3k import C
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
def out(slug, X): return ROOT + '/%s/s3-%s.pxg' % (slug, X)
P = lambda r, s: (r, s)

def wheel(c, x, y):
    c.rect(x, y, 2, 3, P('viron', 3)); c.px(x, y, P('viron', 5)); c.vl(x + 1, y, 3, P('viron', 1))
    c.hl(x - 1, y + 3, 4, P('vblack', 2)) if False else None

def panel(c, x0, w, ytop, ybot, frame, cur_hi, cur_mid, cur_lo, hem=None, lit=True):
    # 프레임
    c.rect(x0, ytop, w, 2, P(frame, 4)); c.hl(x0, ytop, w, P(frame, 6)); c.hl(x0, ytop + 1, w, P(frame, 3))
    c.rect(x0, ybot - 1, w, 2, P(frame, 4)); c.hl(x0, ybot - 1, w, P(frame, 5)); c.hl(x0, ybot, w, P(frame, 1))
    c.vl(x0, ytop, ybot - ytop + 1, P(frame, 5)); c.vl(x0 + w - 1, ytop, ybot - ytop + 1, P(frame, 2))
    # 커튼
    c.rect(x0 + 1, ytop + 2, w - 2, ybot - ytop - 3, cur_mid)
    c.vl(x0 + 1, ytop + 2, ybot - ytop - 3, cur_hi)
    c.vl(x0 + w - 2, ytop + 2, ybot - ytop - 3, cur_lo)
    # 주름 세로선 하나 (가운데)
    mid = x0 + w // 2
    c.vl(mid, ytop + 3, ybot - ytop - 5, cur_lo)
    if hem: c.hl(x0 + 1, ytop + 2, w - 2, hem); c.hl(x0 + 1, ytop + 3, w - 2, hem)
    # 바퀴
    wheel(c, x0 + w // 2 - 1, ybot + 1)

def four(frame, hi, mid, lo, hem=None, zig=True, deep=False):
    c = C(32, 32)
    for i in range(4):
        x0 = 2 + 7 * i
        yt = 3 + (1 if (i % 2 and zig) else 0)
        panel(c, x0, 7, yt, 25 - (1 if (i % 2 and zig) else 0) + (1 if False else 0), frame, hi, mid if i % 2 == 0 else lo, lo if i % 2 == 0 else mid, hem)
    # 다리 둘 사이 가로 (가장자리에 손잡이)
    return c

def fin(c, X, note, sx=3, sw=27):
    c.shadow(sx, 30, sw, 2)
    c.px(0, 31, '.'); c.px(31, 31, '.')
    c.save(out('privacy_screen', X), note)

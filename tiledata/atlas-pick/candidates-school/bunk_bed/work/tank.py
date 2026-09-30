import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from s3k import C
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
def out(slug, X): return ROOT + '/%s/s3-%s.pxg' % (slug, X)

def legs(c, L, xs, y0, y1, cross=True):
    for x in xs:
        c.vl(x, y0, y1 - y0, (L, 5)); c.vl(x + 1, y0, y1 - y0, (L, 3)); c.vl(x + 2, y0, y1 - y0, (L, 1))
        c.hl(x - 1, y1, 5, (L, 2)); c.hl(x - 1, y1 + 1, 5, (L, 0))
    if cross:
        a, b = xs[0], xs[-1]
        n = b - a
        for i in range(n):
            y = y0 + 2 + (i * (y1 - y0 - 4)) // n
            c.px(a + 3 + i, y, (L, 3)) if a + 3 + i < b else None
        for i in range(n):
            y = y1 - 2 - (i * (y1 - y0 - 4)) // n
            c.px(a + 3 + i, y, (L, 2)) if a + 3 + i < b else None

def box_tank(R, L, lit, dark, seam, cover, ladder=True, hot=False):
    c = C(48, 48)
    T = lambda s: (R, s)
    # 윗면 (넓은 띠)
    x0, x1 = 3, 40
    c.rect(x0, 4, x1 - x0 + 1, 11, T(lit))
    c.hl(x0, 4, x1 - x0 + 1, T(lit + 1 if lit < 6 else 6)); c.vl(x0, 4, 11, T(lit + 1 if lit < 6 else 6))
    c.hl(x0, 14, x1 - x0 + 1, T(dark + 1)); c.vl(x1, 4, 11, T(dark + 2))
    # 윗면 이음선
    c.vl(15, 5, 9, T(lit - 1)); c.vl(27, 5, 9, T(lit - 1)); c.hl(x0 + 1, 9, 36, T(lit - 1))
    # 맨홀 뚜껑(윗면 가운데)
    c.rect(19, 6, 10, 6, (cover, 3)); c.hl(20, 6, 8, (cover, 5)); c.hl(19, 7, 1, (cover, 5)); c.hl(20, 11, 8, (cover, 1)); c.vl(28, 7, 4, (cover, 2))
    c.hl(21, 8, 6, (cover, 4)); c.hl(21, 9, 6, (cover, 2)); c.px(23, 9, (cover, 5)); c.px(24, 9, (cover, 5))
    # 앞면
    c.rect(x0, 15, x1 - x0 + 1, 22, T(lit - 1))
    c.vl(x0, 15, 22, T(lit)); c.vl(x1, 15, 22, T(dark)); c.vl(x1 - 1, 15, 22, T(dark + 1))
    c.hl(x0, 15, x1 - x0 + 1, T(lit + 1 if lit < 6 else 6))
    c.hl(x0, 36, x1 - x0 + 1, T(dark - 1 if dark > 0 else 0))
    # 패널 이음
    for sx in (15, 27):
        c.vl(sx, 16, 20, T(seam)); c.vl(sx + 1, 16, 20, T(lit))
    for sy in (22, 29):
        c.hl(x0 + 1, sy, x1 - x0 - 2, T(seam)); c.hl(x0 + 1, sy + 1, x1 - x0 - 2, T(lit))
    # 리벳
    for sx in (5, 17, 29, 38):
        for sy in (18, 24, 31, 34):
            c.px(sx, sy, T(min(lit + 2, 6) if lit + 2 <= 6 else 6))
    # 다리
    legs(c, L, (5, 18, 31, 37), 37, 45)
    # 사다리(오른쪽)
    if ladder:
        c.vl(43, 15, 30, (L, 4)); c.vl(44, 15, 30, (L, 2)); c.vl(46, 15, 30, (L, 4)); c.vl(47, 15, 30, (L, 2))
        for y in range(17, 44, 4): c.hl(45, y, 1, (L, 3)); c.px(44, y, (L, 5))
        c.hl(41, 15, 3, (L, 4))
    return c

def fin(c, X, note, sx=3, sw=44):
    c.shadow(sx, 46, sw, 2)
    c.save(out('water_tank', X), note)

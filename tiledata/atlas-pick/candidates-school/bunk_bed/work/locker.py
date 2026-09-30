import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from s3k import C
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
def out(slug, X): return ROOT + '/%s/s3-%s.pxg' % (slug, X)

def door(c, x, y, h, ramp, seam, body, hi, lo, vent, handle, tag, num=True):
    c.rect(x, y, 8, h, (ramp, body))
    c.vl(x, y, h, (ramp, seam))
    c.vl(x + 1, y, h, (ramp, hi))
    c.vl(x + 6, y, h, (ramp, lo)) 
    c.vl(x + 7, y, h, (ramp, seam))
    c.hl(x + 1, y, 6, (ramp, hi))
    c.hl(x + 1, y + h - 1, 6, (ramp, lo))
    for i in range(3):
        c.hl(x + 2, y + 2 + i * 2, 4, (ramp, vent))
    c.px(x + 5, y + h // 2 + 1, handle)
    c.px(x + 5, y + h // 2 + 2, handle) if False else None
    c.px(x + 3, y + h - 4, tag); c.px(x + 4, y + h - 4, tag)

def frame(ramp, seam, body, hi, lo, vent, handle, tag, topb, topb_hi, base, cloth=None, extra=None):
    c = C(32, 32)
    # 윗면 띠 y=3,4
    c.rect(0, 3, 32, 2, (ramp, topb)); c.hl(0, 3, 32, (ramp, topb_hi))
    for r, y in enumerate((5, 17)):
        for i in range(4):
            door(c, i * 8, y, 11, ramp, seam, body, hi, lo, vent, handle, tag)
    c.hl(0, 16, 32, (ramp, seam))
    c.hl(0, 28, 32, (ramp, base)); c.hl(0, 29, 32, (ramp, seam))
    if extra: extra(c)
    if cloth: cloth(c)
    return c

def shade(c):
    for x in range(32):
        c.px(x, 30, '~'); c.px(x, 31, '-')

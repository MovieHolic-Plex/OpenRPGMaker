import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from s3k import C
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
def out(slug, X): return ROOT + '/%s/s3-%s.pxg' % (slug, X)
G = lambda s: ('gmat', s)

def slab(c, x, y, w, ht, hf, top, hi, lo, front, fdark, rim, quilt=3, strap=None):
    # 윗면 (ht 줄) + 앞면 (hf 줄)
    c.rect(x, y, w, ht, G(top))
    c.hl(x, y, w, G(hi)); c.vl(x, y, ht, G(hi))
    c.vl(x + w - 1, y, ht, G(lo))
    c.hl(x + 1, y + ht - 1, w - 2, G(lo)) if False else None
    # 누빔 세로선
    for i in range(1, quilt + 1):
        qx = x + (w * i) // (quilt + 1)
        c.vl(qx, y + 1, ht - 1, G(lo))
        c.vl(qx - 1, y + 1, ht - 1, G(hi)) if False else None
    # 앞면
    c.rect(x, y + ht, w, hf, G(front))
    c.hl(x, y + ht, w, G(rim))
    c.hl(x, y + ht + hf - 1, w, G(fdark))
    c.vl(x + w - 1, y + ht, hf, G(fdark))
    c.px(x, y + ht + hf - 1, G(fdark))
    # 모서리 둥글림
    c.px(x, y, '.'); c.px(x + w - 1, y, '.')
    c.px(x, y + ht + hf - 1, '.'); c.px(x + w - 1, y + ht + hf - 1, '.')
    if strap:
        sx, sc = strap
        c.rect(sx, y + ht, 5, hf - 1, sc[0]); c.hl(sx, y + ht + hf - 2, 5, sc[1])
        c.rect(sx + 1, y + ht + 1, 3, hf - 3, '.') if hf >= 5 else None
        c.hl(sx + 1, y + ht + 1, 3, ('vblack', 1)) if hf >= 5 else None

"""Deterministic recolour of the current armchair (atlas_biome_interior tile 3677) — no new drawing (2026-10-29).

  python3 scripts/content/hand-interior/armchair/derive.py <out dir>

The current armchair is the user-approved sofa v5 (tiles 3678-3679) squeezed to one seat: the same rows and the same
six colour roles (outline, lightest top, light, mid, dark, mid-dark). Only its red ramp is wrong — it jumps from saturated
red to pale pink, so the lit tops read as floating pink stickers — and the outline colour is also drawn INSIDE the
silhouette, boxing every part. Reads the sheet, keeps the silhouette mask, and writes:

  green.png      roles mapped 1:1 to the sofa's own colours (sofa palette only), inner outline pixels -> the sofa's dark tone
  green-feet.png green.png + the sofa's two dark-wood feet on the empty bottom row (sofa pixels, under the outer corners)
  wine.png       same roles on palette v6's wine ramp (s6) at the sofa's ramp steps (no pink jump), inner outline -> dark, sofa feet
"""
import os, sys, colorsys
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..'))
SHEET = os.path.join(ROOT, 'public/assets/atlas-interior/interior-chipset.png')
TPR = 48


def tile(s, n):
    return s.crop(((n % TPR) * 16, (n // TPR) * 16, (n % TPR) * 16 + 16, (n // TPR) * 16 + 16))


def roles(im):
    """colour -> role index in order of first appearance (row-major), the sheet's own construction order."""
    out = {}
    for p in im.getdata():
        if p[3] and p[:3] not in out: out[p[:3]] = len(out)
    return out


def luma(c):
    r, g, b = [x / 255 for x in c]
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def v6():
    import re
    cols = []
    for line in open(os.path.join(ROOT, 'tiledata/hand-interior/pick/palette/v6.pal'), encoding='utf-8'):
        if line.startswith('@rampc'):
            cols += [tuple(int(h[i:i + 2], 16) for i in (1, 3, 5)) for h in re.findall(r'#[0-9a-fA-F]{6}', line)]
    return sorted(set(cols))


def main(out):
    os.makedirs(out, exist_ok=True)
    s = Image.open(SHEET).convert('RGBA')
    old = tile(s, 3677)
    sofa = Image.new('RGBA', (32, 16)); sofa.paste(tile(s, 3678), (0, 0)); sofa.paste(tile(s, 3679), (16, 0))
    ro, rs = roles(old), roles(sofa)
    inv_s = {v: k for k, v in rs.items()}
    # role check: the first six sofa roles line up with the armchair's six (outline, lightest, light, mid, dark, mid-dark)
    if len(ro) != 6 or len(rs) < 8: raise SystemExit(f'unexpected colour roles: old {len(ro)}, sofa {len(rs)}')
    OUTLINE, DARK = 0, 4
    W, H = old.size
    op = lambda x, y: 0 <= x < W and 0 <= y < H and old.getpixel((x, y))[3] > 0

    def inner(x, y):
        return all(op(x + dx, y + dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))

    def recolour(colour_of_role):
        im = Image.new('RGBA', (W, H))
        for y in range(H):
            for x in range(W):
                p = old.getpixel((x, y))
                if not p[3]: continue
                r = ro[p[:3]]
                if r == OUTLINE and inner(x, y): r = DARK
                im.putpixel((x, y), colour_of_role(r) + (255,))
        return im

    def feet(im):
        im = im.copy()
        for x in range(W):   # the sofa's bottom row (feet) at its outer corners, mirrored onto the armchair's corners
            for sx, dx in ((1, 1), (2, 2), (29, 13), (30, 14)):
                p = sofa.getpixel((sx, 15))
                if p[3] and x == dx: im.putpixel((dx, 15), p)
        return im

    green = recolour(lambda r: inv_s[r])
    green.save(os.path.join(out, 'green.png'))
    feet(green).save(os.path.join(out, 'green-feet.png'))
    # wine: the sofa's roles sit on green ramp steps 0,5,4,3,1,2 (outline, lightest, light, mid, dark, mid-dark). Put the
    # same roles on palette v6's wine ramp s6 (dark -> light, no pink jump) — the red ramp is what made the pink stickers.
    WINE = ['#3d0a10', '#611221', '#781126', '#952136', '#b23b3b', '#d15d59']   # s6, six evenly lighter steps
    step = {0: 0, 1: 5, 2: 4, 3: 3, 4: 1, 5: 2}
    wine = {r: tuple(int(WINE[step[r]][i:i + 2], 16) for i in (1, 3, 5)) for r in range(6)}
    feet(recolour(lambda r: wine[r])).save(os.path.join(out, 'wine.png'))
    print('roles', {r: '#%02x%02x%02x' % inv_s[r] for r in range(6)}, 'wine', {r: '#%02x%02x%02x' % c for r, c in wine.items()})


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else 'tiledata/hand-interior/armchair/derived')

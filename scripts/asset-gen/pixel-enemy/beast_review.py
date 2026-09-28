"""Strict review for the beasts batch sheets (bat-vampire ... plant-carnivore).

Checks per sheet: cell*3 square, alpha 0/255, <=16 colours, no empty cell, every pair
of cells differs by >=12 px, baseline (ground species touch y=cell-4 in every cell,
airborne species only in dead). Also writes .omo/pixel-enemy-beasts-gallery.png.
Usage: python3 beast_review.py [slug ...]
"""
import sys
sys.dont_write_bytecode = True
from PIL import Image, ImageDraw
from pe_lib import ROOT, NAMES, BG

SPECIES = {  # slug: (cell, airborne)
    'bat-vampire': (48, True), 'bee-giant': (48, True), 'scorpion-sand': (48, False),
    'mantis-blade': (48, False), 'boar-tusk': (64, False), 'bear-brown': (64, False),
    'snake-viper': (48, False), 'crab-rock': (48, False), 'hound-hell': (64, False),
    'plant-carnivore': (64, False),
}
# cells allowed to leave the floor even for ground species (leaps)
LEAP = {'snake-viper': {'attack'}, 'hound-hell': {'attack'}, 'mantis-blade': set(), 'scorpion-sand': set()}


def cells(sheet, cell):
    return [sheet.crop((i % 3 * cell, i // 3 * cell, i % 3 * cell + cell, i // 3 * cell + cell)) for i in range(9)]


def review(name):
    cell, air = SPECIES[name]
    sheet = Image.open(ROOT / f'public/assets/generated/pixel-enemies/{name}.png').convert('RGBA')
    assert sheet.size == (cell * 3, cell * 3), sheet.size
    alpha = set(sheet.getchannel('A').tobytes())
    assert alpha <= {0, 255}, alpha
    colors = {c for _, c in sheet.getcolors(cell * cell * 9) if c[3]}
    assert len(colors) <= 16, len(colors)
    fr = cells(sheet, cell)
    base = cell - 4
    bottoms = {}
    for n, im in zip(NAMES, fr):
        box = im.getbbox()
        assert box, f'{name}:{n} empty'
        bottoms[n] = box[3] - 1
        floating = (air and n != 'dead') or n in LEAP.get(name, set())
        if floating:
            assert box[3] - 1 <= base, (name, n, box)
        else:
            assert box[3] - 1 == base, f'{name}:{n} bottom {box[3] - 1} != {base}'
    if air:
        assert all(bottoms[n] < base for n in NAMES if n != 'dead'), (name, bottoms)
    minimum = None
    for i in range(9):
        for j in range(i + 1, 9):
            a, b = fr[i].tobytes(), fr[j].tobytes()
            diff = sum(1 for k in range(0, len(a), 4) if a[k:k + 4] != b[k:k + 4])
            assert diff >= 12, f'{name}: {NAMES[i]} vs {NAMES[j]} only {diff}px'
            minimum = diff if minimum is None else min(minimum, diff)
    print(f'{name}: {sheet.width}x{sheet.height} alpha={sorted(alpha)} colors={len(colors)} '
          f'nonempty=9 min_cell_diff={minimum}px base={base} bottoms={list(bottoms.values())}')
    return fr, cell


def gallery(slugs, out, scale=2):
    """One row per species: 9 cells at 2x on #202840, labelled."""
    rows = []
    for s in slugs:
        fr, cell = review(s)
        row = Image.new('RGB', (9 * 64 * scale + 110, 64 * scale), BG)
        d = ImageDraw.Draw(row)
        d.text((4, 4), s, fill='#d6cddc')
        for i, im in enumerate(fr):
            c = Image.new('RGBA', (64, 64), BG)
            c.alpha_composite(im, ((64 - cell) // 2, 64 - cell))
            row.paste(c.convert('RGB').resize((64 * scale, 64 * scale), Image.Resampling.NEAREST), (110 + i * 64 * scale, 0))
            d.line((110 + i * 64 * scale, 0, 110 + i * 64 * scale, 64 * scale), fill='#39465e')
        rows.append(row)
    g = Image.new('RGB', (rows[0].width, sum(r.height for r in rows)), BG)
    y = 0
    for r in rows:
        g.paste(r, (0, y)); y += r.height
    g.save(out)
    return g


if __name__ == '__main__':
    slugs = sys.argv[1:] or list(SPECIES)
    if len(slugs) == len(SPECIES):
        g = gallery(slugs, ROOT / '.omo/pixel-enemy-beasts-gallery.png')
        for k in range(2):  # halves stay under 1900px for direct viewing
            half = g.crop((0, k * g.height // 2, g.width, (k + 1) * g.height // 2))
            half.save(ROOT / f'.omo/pixel-enemy-beasts-gallery-{k + 1}.png')
        print('gallery', g.size)
    else:
        for s in slugs:
            review(s)


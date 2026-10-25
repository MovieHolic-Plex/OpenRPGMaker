"""Rebuild the shared woodland groups from the redrawn tree bodies.

The four woodland recipes in beodeul_ground (north, north-open, west, east) are groups of the three tree bodies
(tiledata/beodeul-ground/tree-studies/current-<id>-body.png, made by beodeul-tree-studies.mjs from the city tree kits)
placed at the catalog anchors, back to front by foot. Each body is 64 px wide with an 8 px left margin, so a body goes
to (pixelX - 8, pixelY). Writes public/assets/beodeul-ground/woodland-<key>.png and the recipe's cells in the ground
chipset (cell numbers unchanged). Run build-beodeul-warm-trees.py afterwards.
"""
from pathlib import Path
import json, numpy as np
from PIL import Image
R = Path(__file__).resolve().parents[3]
cat = json.loads((R / 'src/assets/beodeulGroundCatalog.json').read_text())
per = cat['tilesPerRow']
sheet_p = R / 'public/assets/beodeul-ground/chipset.png'
sheet = np.array(Image.open(sheet_p).convert('RGBA'))
body = {k: np.array(Image.open(R / f'tiledata/beodeul-ground/tree-studies/current-{k}-body.png').convert('RGBA'))
        for k in ('03a8f7', '3e8732', '1a786c')}
report = {}
for key in ('north', 'north-open', 'west', 'east'):
    r = next(x for x in cat['recipes'] if x['id'] == 'bdg-woodland-' + key)
    H, W = r['height'] * 16, r['width'] * 16
    o = np.zeros((H, W, 4), np.uint8)
    for a in sorted(r['anchors'], key=lambda a: a['foot'][1]):
        b = body[a['kit'].removeprefix('bd-tree-')]
        x, y = a['pixelX'] - 8, a['pixelY']
        y0, x0, y1, x1 = max(0, y), max(0, x), min(H, y + b.shape[0]), min(W, x + b.shape[1])
        s = b[y0 - y:y1 - y, x0 - x:x1 - x]; m = s[..., 3] > 0
        o[y0:y1, x0:x1][m] = s[m]
    lost = 0
    for j, row in enumerate(r['rows']):
        for i, n in enumerate(row):
            t = o[j * 16:j * 16 + 16, i * 16:i * 16 + 16]
            if isinstance(n, int) and n >= 0:
                sheet[(n // per) * 16:(n // per + 1) * 16, (n % per) * 16:(n % per + 1) * 16] = t
            else:
                lost += int((t[..., 3] > 0).sum()); t[...] = 0
    Image.fromarray(o).save(R / f'public/assets/beodeul-ground/woodland-{key}.png')
    report[key] = dict(pixels=int((o[..., 3] > 0).sum()), lostOutsideCells=lost)
Image.fromarray(sheet).save(sheet_p)
print(json.dumps(report))

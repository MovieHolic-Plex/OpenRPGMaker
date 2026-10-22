"""Redraw the cast shadows of the tree and bush kits in beodeul_nature for the redrawn trees, in place.

build-beodeul-nature.py measures each kit's shadow from the kit's alpha. The trees changed shape, so their old shadows
showed as dark crescents beside the new crowns. This reuses that script's shadow_for() on the current city kits and
writes the result into the cells the catalog already lists for each tree kit (cell numbers and dx/dy unchanged, so
saved maps pick up the new shadow). A cell shared by several kits keeps only the shadow they all cast there (the
intersection), so no kit gets a shadow that its own tree does not cast. Cells also used by non-tree kits are left alone.
  python3 scripts/content/beodeul-redraw/reshadow_trees.py
"""
from pathlib import Path
import json, re, numpy as np
from PIL import Image
R = Path(__file__).resolve().parents[3]
src = (R / 'scripts/content/build-beodeul-nature.py').read_text()
ns = {'__file__': str(R / 'scripts/content/build-beodeul-nature.py')}
exec(src.split('\nshadows = {}')[0], ns)          # constants, kit_image(), shadow_for() — nothing is written
T = 16
cat_p = R / 'src/assets/beodeulNatureCatalog.json'; cat = json.loads(cat_p.read_text())
png_p = R / 'public/assets/beodeul-nature/chipset.png'; sheet = np.array(Image.open(png_p).convert('RGBA'))
cols = cat['tilesPerRow']
TREE = re.compile(r'^bd-(tree-|mpart-bush-|prop-tree_planter$)')
tree_ids = [k for k in cat['shadows'] if TREE.search(k)]
other = {n for k, s in cat['shadows'].items() if k not in tree_ids for r in s['rows'] for n in r if n >= 0}
want = {}                                      # cell -> list of new alpha tiles
for kid in tree_ids:
    old = cat['shadows'][kid]
    ns['tiles'].clear(); ns['index'].clear()
    new = ns['shadow_for'](ns['KITS'][kid])
    if new is None: continue
    # place the new shadow on the old grid: the grid origin is (dx, dy) cells from the kit
    H, W = len(old['rows']), len(old['rows'][0])
    canvas = np.zeros((H * T, W * T, 4), np.uint8)
    oy, ox = (new['dy'] - old['dy']) * T, (new['dx'] - old['dx']) * T
    for j, row in enumerate(new['rows']):
        for i, n in enumerate(row):
            if n < 0: continue
            y, x = oy + j * T, ox + i * T
            if 0 <= y and y + T <= H * T and 0 <= x and x + T <= W * T: canvas[y:y + T, x:x + T] = ns['tiles'][n]
    for j, row in enumerate(old['rows']):
        for i, n in enumerate(row):
            if n >= 0 and n not in other: want.setdefault(n, []).append(canvas[j * T:(j + 1) * T, i * T:(i + 1) * T])
changed = 0
for n, ts in want.items():
    a = np.min(np.stack([t[..., 3] for t in ts]), 0)
    t = np.zeros((T, T, 4), np.uint8); t[..., :3] = ns['SHADOW_RGB']; t[..., 3] = a
    t[a == 0] = 0
    cell = sheet[(n // cols) * T:(n // cols + 1) * T, (n % cols) * T:(n % cols + 1) * T]
    if not (cell == t).all(): cell[...] = t; changed += 1
Image.fromarray(sheet, 'RGBA').save(png_p, optimize=True)
print(json.dumps(dict(treeKits=len(tree_ids), cells=len(want), changed=changed, skippedShared=len(other & {n for k in tree_ids for r in cat['shadows'][k]['rows'] for n in r if n >= 0}))))

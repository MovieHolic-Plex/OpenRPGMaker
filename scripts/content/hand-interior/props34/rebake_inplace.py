"""Paste the props34 redraws over the tiles they already own in the atlas_biome_interior sheet (no new tiles, no id moves).

  python3 scripts/content/hand-interior/props34/rebake_inplace.py [--check]

Each object's cells [dx, dy, tile, layer] come from src/assets/handInteriorSpec.json; animated cells (animationStrips
baseTile) get frame k at tile+k. Art is already snapped to the shared interior palette v6 by redraw.build().
Fails if a redraw paints pixels outside its registered cells. --check only reports which tiles would change.
"""
import os, sys
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import redraw as R


def main(check=False):
    # paste onto the sheet on disk (interior-plus bake may have rewritten its appended tail); the redraws themselves
    # are derived from the sheet at BASE_REF, so re-running is idempotent
    sheet = Image.open(os.path.join(R.ROOT, R.SHEET_PATH)).convert('RGBA')
    changed = []
    for oid, frames in R.build().items():
        cells, x0, y0, W, H = R.geom(oid)
        own = {((c[0] - x0), (c[1] - y0)) for c in cells}
        for k, f in enumerate(frames):
            for ty in range(H // 16):
                for tx in range(W // 16):
                    t = f.crop((tx * 16, ty * 16, tx * 16 + 16, ty * 16 + 16))
                    if (tx, ty) not in own and t.getbbox(): raise SystemExit(f'{oid}: paints unregistered cell {(tx, ty)}')
            for c in cells:
                anim = c[2] in R.STRIPS
                if k and not anim: continue
                idx = c[2] + (k if anim else 0)
                t = f.crop(((c[0] - x0) * 16, (c[1] - y0) * 16, (c[0] - x0) * 16 + 16, (c[1] - y0) * 16 + 16))
                x, y = (idx % R.TPR) * 16, (idx // R.TPR) * 16
                if list(sheet.crop((x, y, x + 16, y + 16)).getdata()) != list(t.getdata()):
                    changed.append((oid, idx))
                sheet.paste(t, (x, y))
    print(f'{len(changed)} tiles changed in {len({c[0] for c in changed})} props')
    if not check:
        sheet.save(os.path.join(R.ROOT, R.SHEET_PATH), optimize=True)
        print('wrote', R.SHEET_PATH)
    return changed


if __name__ == '__main__':
    main('--check' in sys.argv)

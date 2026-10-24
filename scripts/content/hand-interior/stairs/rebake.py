"""Paste the stair redraws (draw.py) over the tiles the kits already own in the atlas_biome_interior sheet.

  python3 scripts/content/hand-interior/stairs/rebake.py [--check]

No new tiles, no id moves, no definition change: each kit's cells [dx, dy, tile, layer] come from
src/assets/handInteriorSpec.json. Fails if a drawing paints outside its registered cells, uses a colour outside the
shared interior palette v6, or if any tile outside the kits' own cells would change.

3/4 gate (hard rule, same as props34/rebake_inplace.py): a kit is pasted only if its drawing has an object-gate receipt
that passes gate_rooms.state (signed human/delegated allow, calibrated PASS, or provisional PASS under the current
profile). Anything else keeps the old art and is listed. There is no bypass switch.
Set OBJECT_GATE_DATA to the gate data directory that holds the receipts.
"""
import json, os, re, sys
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import draw as D
ROOT = D.ROOT
sys.path.insert(0, os.path.join(ROOT, 'scripts/content/interior-plus'))
sys.path.insert(0, os.path.join(ROOT, 'src/harnesses/_core'))
SHEET_PATH = os.path.join(ROOT, 'public/assets/atlas-interior/interior-chipset.png')
SPEC = json.load(open(os.path.join(ROOT, 'src/assets/handInteriorSpec.json')))['objects']
TPR = 48
KIND = 'flat_furniture'


def palette():
    cols = set()
    for line in open(os.path.join(ROOT, 'tiledata/hand-interior/pick/palette/v6.pal'), encoding='utf-8'):
        if line.startswith('@rampc'):
            cols.update(tuple(int(h[i:i + 2], 16) for i in (1, 3, 5)) for h in re.findall(r'#[0-9a-fA-F]{6}', line))
    return cols


def geom(oid):
    cells = SPEC[oid]['cells']
    x0 = min(c[0] for c in cells); y0 = min(c[1] for c in cells)
    return cells, x0, y0


def paste(sheet, oid, im):
    """Paste one drawing onto a sheet image in memory; returns the tile ids it changed."""
    cells, x0, y0 = geom(oid)
    own = {(c[0] - x0, c[1] - y0) for c in cells}
    for ty in range(im.height // 16):
        for tx in range(im.width // 16):
            if (tx, ty) not in own and im.crop((tx * 16, ty * 16, tx * 16 + 16, ty * 16 + 16)).getbbox():
                raise SystemExit(f'{oid}: paints unregistered cell {(tx, ty)}')
    changed = []
    for c in cells:
        t = im.crop(((c[0] - x0) * 16, (c[1] - y0) * 16, (c[0] - x0) * 16 + 16, (c[1] - y0) * 16 + 16))
        x, y = (c[2] % TPR) * 16, (c[2] // TPR) * 16
        if sheet.crop((x, y, x + 16, y + 16)).tobytes() != t.tobytes(): changed.append(c[2])
        sheet.paste(t, (x, y))
    return changed


def kind_of(oid):
    return 'flat_furniture'


def check_palette(oid, im, pal):
    bad = {p[:3] for p in im.getdata() if p[3] and p[:3] not in pal}
    if bad: raise SystemExit(f'{oid}: {len(bad)} colours outside palette v6: {sorted(bad)[:5]}')


def main(check=False, kinds=None):
    import gate_rooms
    kinds = kinds or {}
    pal = palette()
    sheet = Image.open(SHEET_PATH).convert('RGBA')
    before = sheet.copy()
    allowed = set()
    changed, held = [], []
    for oid, im in D.build().items():
        check_palette(oid, im, pal)
        st, why = gate_rooms.state(im, kinds.get(oid, 'flat_furniture'))
        if not st: held.append((oid, why)); continue
        allowed.update(c[2] for c in SPEC[oid]['cells'])
        changed += [(oid, t) for t in paste(sheet, oid, im)]
    # nothing outside the pasted kits' own tiles may change
    for i in range(TPR * (sheet.height // 16)):
        if i in allowed: continue
        x, y = (i % TPR) * 16, (i // TPR) * 16
        if sheet.crop((x, y, x + 16, y + 16)).tobytes() != before.crop((x, y, x + 16, y + 16)).tobytes():
            raise SystemExit(f'tile {i} outside the stair kits changed')
    print(f'{len(changed)} tiles changed in {len({c[0] for c in changed})} kits')
    for oid, why in held: print(f'  kept old art (3/4 gate): {oid}: {why}')
    if not check:
        sheet.save(SHEET_PATH, optimize=True); print('wrote', os.path.relpath(SHEET_PATH, ROOT))
    return changed, held


if __name__ == '__main__':
    KINDS = json.load(open(os.path.join(HERE, 'kinds.json'))) if os.path.exists(os.path.join(HERE, 'kinds.json')) else {}
    main('--check' in sys.argv, KINDS)

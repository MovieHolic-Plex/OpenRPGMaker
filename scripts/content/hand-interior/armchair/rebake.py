"""(2026-10-29: no drawing has passed yet — candidates in tiledata/hand-interior/armchair/, verdicts.json.)
Paste the object-gen armchair redraw over the one tile the armchair already owns in the atlas_biome_interior sheet.

  OBJECT_GATE_DATA=<gate data dir> python3 scripts/content/hand-interior/armchair/rebake.py [--check]

In place only (user report 2026-10-29: 「1인 소파가 너무 별로」): same id, same cell [0,0,3677,3], same tile count, same
sheet size, no definition change. Growing the bundled sheet breaks saved projects (passability length mismatch), so
this script refuses any change outside tile 3677.

The drawing is tiledata/hand-interior/armchair/armchair.png (object-gen pick, palette v6). 3/4 gate (hard rule, same as
stairs/rebake.py): pasted only if the drawing has an object-gate receipt that passes gate_rooms.state for kind 'seat'
(signed human/delegated allow, calibrated PASS, or provisional PASS under the current profile). No bypass switch.
"""
import json, os, re, sys
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..'))
sys.path.insert(0, os.path.join(ROOT, 'scripts/content/interior-plus'))
sys.path.insert(0, os.path.join(ROOT, 'src/harnesses/_core'))
SHEET_PATH = os.path.join(ROOT, 'public/assets/atlas-interior/interior-chipset.png')
ART = os.path.join(ROOT, 'tiledata/hand-interior/armchair/armchair.png')
SPEC = json.load(open(os.path.join(ROOT, 'src/assets/handInteriorSpec.json')))['objects']
OID, KIND, TPR = 'armchair', 'seat', 48


def palette():
    cols = set()
    for line in open(os.path.join(ROOT, 'tiledata/hand-interior/pick/palette/v6.pal'), encoding='utf-8'):
        if line.startswith('@rampc'):
            cols.update(tuple(int(h[i:i + 2], 16) for i in (1, 3, 5)) for h in re.findall(r'#[0-9a-fA-F]{6}', line))
    return cols


def main(check=False):
    import gate_rooms
    im = Image.open(ART).convert('RGBA')
    cells = SPEC[OID]['cells']
    if im.size != (16, 16) or cells != [[0, 0, 3677, 3]]: raise SystemExit(f'{OID}: expected one 16x16 cell at tile 3677, got {im.size} {cells}')
    pal = palette()
    bad = {p[:3] for p in im.getdata() if p[3] and p[:3] not in pal}
    if bad: raise SystemExit(f'{OID}: {len(bad)} colours outside palette v6: {sorted(bad)[:5]}')
    if any(p[3] not in (0, 255) for p in im.getdata()): raise SystemExit(f'{OID}: translucent pixels')
    st, why = gate_rooms.state(im, KIND)
    if not st: raise SystemExit(f'kept old art (3/4 gate): {OID}: {why}')
    sheet = Image.open(SHEET_PATH).convert('RGBA')
    before = sheet.copy()
    t = cells[0][2]; x, y = (t % TPR) * 16, (t // TPR) * 16
    sheet.paste(im, (x, y))
    for i in range(TPR * (sheet.height // 16)):
        if i == t: continue
        a, b = (i % TPR) * 16, (i // TPR) * 16
        if sheet.crop((a, b, a + 16, b + 16)).tobytes() != before.crop((a, b, a + 16, b + 16)).tobytes():
            raise SystemExit(f'tile {i} outside the armchair changed')
    if sheet.size != before.size: raise SystemExit('sheet size changed')
    print(f'{OID}: tile {t} {"would change" if check else "changed"} ({st}); sheet {sheet.size}, {TPR * (sheet.height // 16)} tiles')
    if not check:
        sheet.save(SHEET_PATH, optimize=True); print('wrote', os.path.relpath(SHEET_PATH, ROOT))


if __name__ == '__main__':
    main('--check' in sys.argv)

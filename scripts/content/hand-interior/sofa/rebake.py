"""Paste the user-picked object-gen sofa (r1 C2, 2026-10-30) over the two tiles the sofa already owns (3678, 3679).

  OBJECT_GATE_DATA=<gate data dir> python3 scripts/content/hand-interior/sofa/rebake.py [--check]

In place only: same id, same cells [[0,0,3678,3],[1,0,3679,3]], same tile count and sheet size, no definition change
(growing the bundled sheet breaks saved projects). Refuses any change outside 3678-3679. The drawing must pass
gate_rooms.state for kind 'seat' (signed human/delegated allow, calibrated PASS or provisional PASS). Decision record:
tiledata/hand-interior/sofa/decisions/. Same set as the armchair (scripts/content/hand-interior/armchair/).
"""
import json, os, re, sys
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..'))
sys.path.insert(0, os.path.join(ROOT, 'scripts/content/interior-plus'))
sys.path.insert(0, os.path.join(ROOT, 'src/harnesses/_core'))
SHEET_PATH = os.path.join(ROOT, 'public/assets/atlas-interior/interior-chipset.png')
ART = os.path.join(ROOT, 'tiledata/hand-interior/sofa/sofa.png')
SPEC = json.load(open(os.path.join(ROOT, 'src/assets/handInteriorSpec.json')))['objects']
OID, KIND, TPR = 'sofa', 'seat', 48


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
    if im.size != (32, 16) or cells != [[0, 0, 3678, 3], [1, 0, 3679, 3]]: raise SystemExit(f'{OID}: expected 32x16 over tiles 3678-3679, got {im.size} {cells}')
    pal = palette()
    bad = {p[:3] for p in im.getdata() if p[3] and p[:3] not in pal}
    if bad: raise SystemExit(f'{OID}: {len(bad)} colours outside palette v6: {sorted(bad)[:5]}')
    if any(p[3] not in (0, 255) for p in im.getdata()): raise SystemExit(f'{OID}: translucent pixels')
    st, why = gate_rooms.state(im, KIND)
    if not st: raise SystemExit(f'kept old art (3/4 gate): {OID}: {why}')
    sheet = Image.open(SHEET_PATH).convert('RGBA')
    before = sheet.copy()
    own = set()
    for dx, dy, t, _ in cells:
        own.add(t); sheet.paste(im.crop((dx * 16, dy * 16, dx * 16 + 16, dy * 16 + 16)), ((t % TPR) * 16, (t // TPR) * 16))
    for i in range(TPR * (sheet.height // 16)):
        if i in own: continue
        a, b = (i % TPR) * 16, (i // TPR) * 16
        if sheet.crop((a, b, a + 16, b + 16)).tobytes() != before.crop((a, b, a + 16, b + 16)).tobytes():
            raise SystemExit(f'tile {i} outside the sofa changed')
    if sheet.size != before.size: raise SystemExit('sheet size changed')
    print(f'{OID}: tiles {sorted(own)} {"would change" if check else "changed"} ({st}); sheet {sheet.size}, {TPR * (sheet.height // 16)} tiles')
    if not check:
        sheet.save(SHEET_PATH, optimize=True); print('wrote', os.path.relpath(SHEET_PATH, ROOT))


if __name__ == '__main__':
    main('--check' in sys.argv)

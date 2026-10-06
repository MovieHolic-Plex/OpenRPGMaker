"""Read-only art comparison, labels/backgrounds/nearest enlargement only."""
from pathlib import Path
from PIL import Image, ImageDraw
import hashlib
import json

ROOT = Path(__file__).resolve().parent
BEFORE = ROOT / 'revisions/before-hand-ground-repair'
report = {}
for name, sub in [('skill_b', 'actions'), ('dead', 'poses')]:
    old = (BEFORE / f'{name}.pxgrid').read_text()
    new = (ROOT / sub / f'{name}.pxgrid').read_text()
    a, b = old.splitlines(), new.splitlines()
    differences = [(x, y) for y in range(96) for x in range(96)
                   if a[y][x] != b[y][x]]
    report[name] = {
        'beforeGridSha256': hashlib.sha256(old.encode()).hexdigest(),
        'currentGridSha256': hashlib.sha256(new.encode()).hexdigest(),
        'currentPngSha256': hashlib.sha256((ROOT / 'png' / f'{name}.png').read_bytes()).hexdigest(),
        'changedPixels': len(differences),
        'changedBounds': [min(x for x, y in differences), min(y for x, y in differences),
                          max(x for x, y in differences), max(y for x, y in differences)],
        'bodyGroundRunsY92': b[92],
    }

for kind, color in [('light', '#e2dbc9'), ('dark', '#252534'), ('checker', '#d0cdce')]:
    plate = Image.new('RGBA', (384, 112), color)
    if kind == 'checker':
        for y in range(96):
            for x in range(384):
                if (x // 8 + y // 8) % 2:
                    plate.putpixel((x, y), (160, 157, 162, 255))
    draw = ImageDraw.Draw(plate)
    for i, (name, before) in enumerate([('skill_b', True), ('skill_b', False),
                                         ('dead', True), ('dead', False)]):
        path = (BEFORE if before else ROOT / 'png') / f'{name}.png'
        plate.alpha_composite(Image.open(path).convert('RGBA'), (i * 96, 0))
        # A diagnostic baseline beside each cell; it never enters art pixels.
        draw.line((i * 96 + 1, 92, i * 96 + 9, 92), fill='#d39b47')
        draw.text((i * 96 + 2, 97), f'{name} {"old" if before else "new"}',
                  fill='#fff1d7' if kind == 'dark' else '#251d2b')
    plate.save(ROOT / 'diagnostics' / f'hand-ground-{kind}-1x.png')
    plate.resize((1152, 336), Image.Resampling.NEAREST).save(
        ROOT / 'diagnostics' / f'hand-ground-{kind}-3x.png')

(ROOT / 'diagnostics/hand-ground-scope.json').write_text(json.dumps({
    'note': 'Observed source differences and file hashes, no approval or review verdict.',
    'frames': report,
}, indent=2) + '\n')
print(json.dumps(report, indent=2))

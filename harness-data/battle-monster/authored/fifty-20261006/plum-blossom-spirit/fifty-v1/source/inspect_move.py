"""Source differences and diagnostic rendering only; no art modification."""
from pathlib import Path
from PIL import Image, ImageDraw
import hashlib
import json

ROOT = Path(__file__).resolve().parent
BEFORE = ROOT / 'revisions/before-move-leg-repair'
old = (BEFORE / 'move.pxgrid').read_text().splitlines()
new = (ROOT / 'poses/move.pxgrid').read_text().splitlines()
changes = [{'x': x, 'y': y, 'before': old[y][x], 'after': new[y][x]}
           for y in range(96) for x in range(96) if old[y][x] != new[y][x]]
old_hashes = json.loads((BEFORE / 'source-hashes.json').read_text())
current_hashes = {name: hashlib.sha256((ROOT / name).read_bytes()).hexdigest()
                  for name in old_hashes}
report = {
    'note': 'Measured file differences only; no independent verdict or user approval.',
    'changes': changes,
    'changedSourceFiles': [name for name in old_hashes
                           if old_hashes[name] != current_hashes[name]],
    'beforeSourceSha256': old_hashes,
    'currentSourceSha256': current_hashes,
    'movePngSha256': hashlib.sha256((ROOT / 'png/move.png').read_bytes()).hexdigest(),
    'attackGifSha256': hashlib.sha256((ROOT / 'gif/attack.gif').read_bytes()).hexdigest(),
}
(ROOT / 'diagnostics/move-leg-scope.json').write_text(
    json.dumps(report, indent=2) + '\n')

for kind, color in [('light', '#e2dbc9'), ('dark', '#252534'), ('checker', '#d0cdce')]:
    plate = Image.new('RGBA', (192, 110), color)
    if kind == 'checker':
        for y in range(96):
            for x in range(192):
                if (x // 8 + y // 8) % 2:
                    plate.putpixel((x, y), (160, 157, 162, 255))
    draw = ImageDraw.Draw(plate)
    for i, path in enumerate([BEFORE / 'move.png', ROOT / 'png/move.png']):
        plate.alpha_composite(Image.open(path).convert('RGBA'), (i * 96, 0))
        draw.text((i * 96 + 2, 97), 'move before' if i == 0 else 'move repaired',
                  fill='#fff1d7' if kind == 'dark' else '#251d2b')
    plate.save(ROOT / 'diagnostics' / f'move-leg-{kind}-1x.png')
    plate.resize((576, 330), Image.Resampling.NEAREST).save(
        ROOT / 'diagnostics' / f'move-leg-{kind}-3x.png')
print(json.dumps({'changes': changes, 'changedSourceFiles': report['changedSourceFiles']}, indent=2))

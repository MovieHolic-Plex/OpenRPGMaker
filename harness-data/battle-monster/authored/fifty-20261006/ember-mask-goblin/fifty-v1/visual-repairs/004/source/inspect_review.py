"""Render literal before/current grids on backgrounds; no authored pixels."""
from pathlib import Path
from PIL import Image, ImageDraw
import json
import hashlib

ROOT = Path(__file__).resolve().parent
palette = json.loads((ROOT / 'palette.json').read_text())
colors = {ch: tuple(bytes.fromhex(rgb[1:])) + (255,) for ch, rgb in palette.items()}
names = [('poses', 'windup'), ('poses', 'move'), ('poses', 'dead'), ('actions', 'skill_c')]

def read_image(path):
    rows = path.read_text().splitlines()
    im = Image.new('RGBA', (96, 96))
    im.putdata([colors[ch] if ch != '.' else (0, 0, 0, 0) for row in rows for ch in row])
    return im

for theme, bg in [('light', (230, 220, 201, 255)), ('dark', (27, 31, 39, 255)), ('checker', None)]:
    sheet = Image.new('RGB', (4 * 410, 2 * 332), (42, 45, 53))
    draw = ImageDraw.Draw(sheet)
    for column, (folder, name) in enumerate(names):
        for row, (label, root) in enumerate([
            ('before', ROOT / 'history' / 'before-review-repair'), ('current', ROOT)
        ]):
            im = read_image(root / folder / (name + '.pxgrid'))
            tile = Image.new('RGBA', (96, 96), bg or (170, 170, 178, 255))
            if bg is None:
                pixels = tile.load()
                for y in range(96):
                    for x in range(96):
                        if (x // 8 + y // 8) % 2:
                            pixels[x, y] = (210, 210, 217, 255)
            tile.alpha_composite(im)
            x = column * 410 + 6
            y = row * 332 + 25
            draw.text((x, y - 18), name + ' / ' + label + ' / 1x + 3x', fill='white')
            sheet.paste(tile.convert('RGB'), (x, y))
            sheet.paste(tile.resize((288, 288), Image.Resampling.NEAREST).convert('RGB'), (x + 104, y))
    sheet.save(ROOT / ('repair-' + theme + '.png'))

# Final current attack/skill sequence, replacing the interim detail sheet.
sequence = ['windup', 'move', 'attack', 'recover', 'dead', 'skill_a', 'skill_b', 'skill_c']
sheet = Image.new('RGB', (4 * 392, 2 * 414), (225, 217, 201))
draw = ImageDraw.Draw(sheet)
for i, name in enumerate(sequence):
    im = Image.open(ROOT / 'png' / (name + '.png')).convert('RGBA')
    x, y = (i % 4) * 392, (i // 4) * 414
    draw.text((x + 8, y + 8), name, fill=(25, 25, 25))
    tile = Image.new('RGBA', (96, 96), (225, 217, 201, 255))
    tile.alpha_composite(im)
    sheet.paste(tile.resize((384, 384), Image.Resampling.NEAREST).convert('RGB'), (x, y + 25))
sheet.save(ROOT / 'repair-detail.png')

# File facts only. No review verdict or approval is generated.
archive = ROOT / 'history' / 'before-review-repair'
facts = {}
for folder in ['poses', 'actions']:
    for path in sorted((ROOT / folder).glob('*.pxgrid')):
        before = (archive / folder / path.name).read_bytes()
        current = path.read_bytes()
        before_rows, current_rows = before.decode().splitlines(), current.decode().splitlines()
        changed = [(x, y) for y in range(96) for x in range(96) if before_rows[y][x] != current_rows[y][x]]
        facts[path.stem] = {
            'before_sha256': hashlib.sha256(before).hexdigest(),
            'current_sha256': hashlib.sha256(current).hexdigest(),
            'changed_pixels': len(changed),
            'changed_bounds': [min(x for x, y in changed), min(y for x, y in changed),
                               max(x for x, y in changed), max(y for x, y in changed)] if changed else None,
        }
report = {
    'palette_unchanged': (archive / 'palette.json').read_bytes() == (ROOT / 'palette.json').read_bytes(),
    'changed_frames': [name for name, item in facts.items() if item['changed_pixels']],
    'preserved_frames': [name for name, item in facts.items() if not item['changed_pixels']],
    'frames': facts,
}
(ROOT / 'repair-facts.json').write_text(json.dumps(report, indent=2) + '\n')
print('Read-only before/current sheets and actual file differences saved.')

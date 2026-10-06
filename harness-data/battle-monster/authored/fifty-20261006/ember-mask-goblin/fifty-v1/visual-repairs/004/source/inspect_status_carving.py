"""Read-only status observations and file facts, no reviewer verdict."""
from pathlib import Path
from PIL import Image, ImageDraw
import hashlib
import json

ROOT = Path(__file__).resolve().parent
ARCHIVE = ROOT / 'history' / 'before-status-carving'
palette = json.loads((ROOT / 'palette.json').read_text())
colors = {ch: tuple(bytes.fromhex(rgb[1:])) + (255,) for ch, rgb in palette.items()}
names = ['poison_a', 'poison_b', 'stun_a', 'stun_b', 'sleep_a', 'sleep_b']

def read(path):
    rows = path.read_text().splitlines()
    im = Image.new('RGBA', (96, 96))
    im.putdata([colors[ch] if ch != '.' else (0, 0, 0, 0) for row in rows for ch in row])
    return im

for theme, bg in [('light', (230, 220, 201, 255)), ('dark', (27, 31, 39, 255)), ('checker', None)]:
    sheet = Image.new('RGB', (3 * 398, 2 * 328), (42, 45, 53))
    draw = ImageDraw.Draw(sheet)
    for i, name in enumerate(names):
        tile = Image.new('RGBA', (96, 96), bg or (170, 170, 178, 255))
        if bg is None:
            px = tile.load()
            for y in range(96):
                for x in range(96):
                    if (x // 8 + y // 8) % 2:
                        px[x, y] = (210, 210, 217, 255)
        tile.alpha_composite(read(ROOT / 'actions' / (name + '.pxgrid')))
        x, y = (i % 3) * 398 + 3, (i // 3) * 328 + 25
        draw.text((x, y - 19), name + ' / 1x + 3x', fill='white')
        sheet.paste(tile.convert('RGB'), (x, y))
        sheet.paste(tile.resize((288, 288), Image.Resampling.NEAREST).convert('RGB'), (x + 101, y))
    sheet.save(ROOT / ('status-carving-' + theme + '.png'))

# Native face crops are only enlarged for coordinate observation.
sheet = Image.new('RGB', (6 * 208, 2 * 238), (230, 220, 201))
draw = ImageDraw.Draw(sheet)
for column, name in enumerate(names):
    for row, (label, base) in enumerate([('before', ARCHIVE), ('current', ROOT)]):
        im = read(base / 'actions' / (name + '.pxgrid'))
        crop = im.crop((48, 36, 73, 62))
        tile = Image.new('RGBA', crop.size, (230, 220, 201, 255))
        tile.alpha_composite(crop)
        x, y = column * 208 + 3, row * 238 + 26
        sheet.paste(tile.resize((200, 208), Image.Resampling.NEAREST).convert('RGB'), (x, y))
        draw.text((x, y - 19), name + ' ' + label, fill=(30, 30, 30))
sheet.save(ROOT / 'status-carving-faces.png')

facts = {}
for folder in ['poses', 'actions']:
    for path in sorted((ROOT / folder).glob('*.pxgrid')):
        old = (ARCHIVE / folder / path.name).read_bytes()
        new = path.read_bytes()
        before, after = old.decode().splitlines(), new.decode().splitlines()
        changes = [{'x': x, 'y': y, 'before': before[y][x], 'after': after[y][x]}
                   for y in range(96) for x in range(96) if before[y][x] != after[y][x]]
        facts[path.stem] = {
            'before_sha256': hashlib.sha256(old).hexdigest(),
            'current_sha256': hashlib.sha256(new).hexdigest(),
            'png_sha256': hashlib.sha256((ROOT / 'png' / (path.stem + '.png')).read_bytes()).hexdigest(),
            'changed_pixels': len(changes),
            'changed_bounds': [min(p['x'] for p in changes), min(p['y'] for p in changes),
                               max(p['x'] for p in changes), max(p['y'] for p in changes)] if changes else None,
            'changes': changes,
        }
report = {
    'palette_unchanged': (ARCHIVE / 'palette.json').read_bytes() == (ROOT / 'palette.json').read_bytes(),
    'changed_frames': [name for name, item in facts.items() if item['changed_pixels']],
    'preserved_frames': [name for name, item in facts.items() if not item['changed_pixels']],
    'frames': facts,
}
(ROOT / 'status-carving-facts.json').write_text(json.dumps(report, indent=2) + '\n')
print('Saved 1x/3x background plates, before/current face crops and actual source differences.')
for name in names:
    item = facts[name]
    print(name, item['changed_pixels'], item['changed_bounds'])

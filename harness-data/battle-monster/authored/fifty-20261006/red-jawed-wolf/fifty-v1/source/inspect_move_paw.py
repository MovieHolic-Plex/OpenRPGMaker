"""Read-only art diagnostics: native/nearest display and source comparison."""
from pathlib import Path
import hashlib
import json
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent
BEFORE = ROOT / 'history/before-move-paw-repair'
OUT = ROOT / 'preview'
palette = json.loads((ROOT / 'palette.json').read_text())
colors = {s: tuple(bytes.fromhex(c[1:])) + (255,) for s, c in palette.items()}

def decode(path):
    rows = path.read_text().splitlines()
    im = Image.new('RGBA', (64, 64))
    im.putdata([colors[s] if s != '.' else (0, 0, 0, 0) for row in rows for s in row])
    return im

sheet = Image.new('RGB', (672, 882), '#434653')
labels = ImageDraw.Draw(sheet)
examples = [('move before', BEFORE / 'poses/move.pxgrid'),
            ('move current', ROOT / 'poses/move.pxgrid'),
            ('attack preserved', ROOT / 'poses/attack.pxgrid')]
for j, (theme, bg) in enumerate([('light', '#d9d8cc'), ('dark', '#252838'), ('checker', '#9499a3')]):
    for i, (name, path) in enumerate(examples):
        tile = Image.new('RGBA', (64, 64), bg)
        if theme == 'checker':
            draw = ImageDraw.Draw(tile)
            for cy in range(0, 64, 8):
                for cx in range(0, 64, 8):
                    if (cx // 8 + cy // 8) % 2:
                        draw.rectangle((cx, cy, cx + 7, cy + 7), fill='#c2c4ca')
        tile.alpha_composite(decode(path))
        x, y = i * 224 + 10, j * 294 + 24
        labels.text((x, y - 18), f'{name} / {theme}', fill='white')
        sheet.paste(tile, (x, y))
        sheet.paste(tile.resize((192, 192), Image.Resampling.NEAREST), (x, y + 76))
sheet.save(OUT / 'move-paw-repair.png')

report = {'changed_frames': {}, 'unchanged_frames': [], 'frame_contracts': {}}
for folder in ('poses', 'actions'):
    for path in sorted((ROOT / folder).glob('*.pxgrid')):
        relative = path.relative_to(ROOT)
        rows = path.read_text().splitlines()
        old = (BEFORE / relative).read_text().splitlines()
        changes = [{'x': x, 'y': y, 'before': a, 'after': b}
                   for y, (r1, r2) in enumerate(zip(old, rows))
                   for x, (a, b) in enumerate(zip(r1, r2)) if a != b]
        if changes:
            report['changed_frames'][path.stem] = {'count': len(changes), 'pixels': changes}
        else:
            report['unchanged_frames'].append(path.stem)
        ink = [(x, y) for y, row in enumerate(rows) for x, s in enumerate(row) if s != '.']
        report['frame_contracts'][path.stem] = {
            'rows': len(rows), 'widths': sorted({len(row) for row in rows}),
            'transparent_border': all(s == '.' for s in rows[0] + rows[-1]) and all(row[0] == row[-1] == '.' for row in rows),
            'lowest_ink_y': max(y for x, y in ink),
            'valid_symbols': set(''.join(rows)).issubset(set(palette) | {'.'}),
        }
report['palette_byte_preserved'] = (ROOT / 'palette.json').read_bytes() == (BEFORE / 'palette.json').read_bytes()
report['current_move_sha256'] = hashlib.sha256((ROOT / 'poses/move.pxgrid').read_bytes()).hexdigest()
(OUT / 'move-paw-repair-readback.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps({'changed_pixels': {n: r['count'] for n, r in report['changed_frames'].items()},
                  'unchanged_frames': len(report['unchanged_frames']),
                  'palette_byte_preserved': report['palette_byte_preserved']}, ensure_ascii=False))

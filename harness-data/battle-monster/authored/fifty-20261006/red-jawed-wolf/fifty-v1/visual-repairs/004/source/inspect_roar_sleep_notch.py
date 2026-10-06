"""Read literal source, display native/nearest pixels and record local facts.

No pixel repair, automatic filling, verdicts or reviewer records.
"""
from pathlib import Path
import hashlib
import json
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent
BEFORE = ROOT / 'history/before-roar-sleep-notch-repair'
OUT = ROOT / 'preview'
palette = json.loads((ROOT / 'palette.json').read_text())
colors = {s: tuple(bytes.fromhex(c[1:])) + (255,) for s, c in palette.items()}

def decode(path):
    rows = path.read_text().splitlines()
    im = Image.new('RGBA', (64, 64))
    im.putdata([colors[s] if s != '.' else (0, 0, 0, 0) for r in rows for s in r])
    return im

themes = [('light', '#d9d8cc'), ('dark', '#252838'), ('checker', '#9499a3')]
for group, names, folder in [('roar-sleep', ['skill_b', 'sleep_a', 'sleep_b'], 'actions'),
                              ('idle-notch', ['idle_a', 'idle_b', 'idle_c'], 'poses')]:
    sheet = Image.new('RGB', (6 * 212, 3 * 292), '#434653')
    labels = ImageDraw.Draw(sheet)
    for j, (theme, bg) in enumerate(themes):
        for i, name in enumerate(names):
            for k, (label, base) in enumerate([('before', BEFORE), ('current', ROOT)]):
                tile = Image.new('RGBA', (64, 64), bg)
                if theme == 'checker':
                    d = ImageDraw.Draw(tile)
                    for cy in range(0, 64, 8):
                        for cx in range(0, 64, 8):
                            if (cx // 8 + cy // 8) % 2:
                                d.rectangle((cx, cy, cx + 7, cy + 7), fill='#c2c4ca')
                tile.alpha_composite(decode(base / folder / (name + '.pxgrid')))
                x, y = (i * 2 + k) * 212 + 8, j * 292 + 22
                labels.text((x, y - 17), f'{name} {label} / {theme}', fill='white')
                sheet.paste(tile, (x, y))
                sheet.paste(tile.resize((192, 192), Image.Resampling.NEAREST), (x, y + 72))
    sheet.save(OUT / (group + '-repair.png'))

report = {'changed_frames': {}, 'unchanged_frames': [], 'frame_contracts': {}}
for folder in ('poses', 'actions'):
    for path in sorted((ROOT / folder).glob('*.pxgrid')):
        rows = path.read_text().splitlines()
        old = (BEFORE / path.relative_to(ROOT)).read_text().splitlines()
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
report['current_source_sha256'] = {str(p.relative_to(ROOT)): hashlib.sha256(p.read_bytes()).hexdigest()
    for p in sorted(list((ROOT / 'poses').glob('*.pxgrid')) + list((ROOT / 'actions').glob('*.pxgrid')) + [ROOT / 'palette.json'])}
(OUT / 'roar-sleep-notch-readback.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps({'changed_pixels': {n: r['count'] for n, r in report['changed_frames'].items()},
                  'unchanged_frames': len(report['unchanged_frames']),
                  'palette_byte_preserved': report['palette_byte_preserved'],
                  'contracts': report['frame_contracts']}, ensure_ascii=False))

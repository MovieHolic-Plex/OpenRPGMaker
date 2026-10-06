"""Decode existing literal grids for before/after visual inspection only."""
from pathlib import Path
import hashlib
import json
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent
BEFORE = ROOT / 'history/before-skill-back-outline-repair'
OUT = ROOT / 'preview'
PALETTE = json.loads((ROOT / 'palette.json').read_text())
COLORS = {s: tuple(bytes.fromhex(c[1:])) + (255,) for s, c in PALETTE.items()}

def decode(path):
    rows = path.read_text(encoding='ascii').splitlines()
    im = Image.new('RGBA', (64, 64))
    im.putdata([COLORS[s] if s != '.' else (0, 0, 0, 0) for row in rows for s in row])
    return im

def main():
    sheet = Image.new('RGB', (664, 888), '#434653')
    labels = ImageDraw.Draw(sheet)
    for j, (theme, bg) in enumerate([('light', '#d9d8cc'), ('dark', '#252838'), ('checker', '#9499a3')]):
        for i, (label, base) in enumerate([('before', BEFORE), ('current', ROOT)]):
            tile = Image.new('RGBA', (64, 64), bg)
            if theme == 'checker':
                d = ImageDraw.Draw(tile)
                for y in range(0, 64, 8):
                    for x in range(0, 64, 8):
                        if (x // 8 + y // 8) % 2:
                            d.rectangle((x, y, x + 7, y + 7), fill='#c2c4ca')
            tile.alpha_composite(decode(base / 'actions/skill_b.pxgrid'))
            x, y = i * 332 + 8, j * 296 + 24
            labels.text((x, y - 17), f'skill_b {label} / {theme}: native + 3x', fill='white')
            sheet.paste(tile, (x, y))
            sheet.paste(tile.resize((192, 192), Image.Resampling.NEAREST), (x, y + 72))
            # Enlargement of the inspected region only, never a source edit.
            crop = tile.crop((13, 28, 25, 39))
            sheet.paste(crop.resize((96, 88), Image.Resampling.NEAREST), (x + 204, y + 72))
            labels.text((x + 204, y + 164), 'x13..24', fill='white')
            labels.text((x + 204, y + 178), 'y28..38', fill='white')
    sheet.save(OUT / 'skill-back-outline-repair.png')
    report = {'changed_frames': {}, 'unchanged_frames': [], 'frame_contracts': {}}
    for folder in ('poses', 'actions'):
        for path in sorted((ROOT / folder).glob('*.pxgrid')):
            rows = path.read_text(encoding='ascii').splitlines()
            old_path = BEFORE / path.relative_to(ROOT)
            old = old_path.read_text(encoding='ascii').splitlines()
            edits = [{'x': x, 'y': y, 'before': a, 'after': b}
                     for y, (r1, r2) in enumerate(zip(old, rows))
                     for x, (a, b) in enumerate(zip(r1, r2)) if a != b]
            if edits:
                report['changed_frames'][path.stem] = edits
            else:
                report['unchanged_frames'].append(path.stem)
            ink = [(x, y) for y, row in enumerate(rows) for x, s in enumerate(row) if s != '.']
            report['frame_contracts'][path.stem] = {
                'rows': len(rows), 'widths': sorted(set(map(len, rows))),
                'transparent_border': all(s == '.' for s in rows[0] + rows[-1]) and all(row[0] == row[-1] == '.' for row in rows),
                'lowest_ink_y': max(y for x, y in ink),
                'valid_symbols': set(''.join(rows)).issubset(set(PALETTE) | {'.'}),
                'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
            }
    report['palette_byte_preserved'] = (ROOT / 'palette.json').read_bytes() == (BEFORE / 'palette.json').read_bytes()
    report['note'] = 'Local source facts; no independent review or user approval.'
    (OUT / 'skill-back-outline-readback.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps({'changed_frames': report['changed_frames'], 'unchanged_frames': len(report['unchanged_frames']), 'palette_byte_preserved': report['palette_byte_preserved']}))

if __name__ == '__main__':
    main()

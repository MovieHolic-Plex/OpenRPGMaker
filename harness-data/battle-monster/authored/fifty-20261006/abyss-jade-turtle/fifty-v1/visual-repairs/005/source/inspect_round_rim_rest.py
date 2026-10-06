"""Read-only visual comparison and literal-file diagnostics for this revision.

Pillow displays our saved native pixels; resizing is diagnostic nearest only.
No source artwork is generated, repaired, or inferred here.
"""
from pathlib import Path
import json
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent
OUT = ROOT / 'previews'
PALETTE = json.loads((ROOT / 'palette.json').read_text())
COLORS = {k: tuple(bytes.fromhex(v[1:])) + (255,) for k, v in PALETTE.items()}
COLORS['.'] = (0, 0, 0, 0)
BEFORE = ROOT / 'revisions' / 'before-round-rim-rest'
TARGETS = ['attack', 'stun_a', 'stun_b', 'sleep_a', 'sleep_b']


def image_from_grid(path):
    rows = path.read_text().splitlines()
    result = Image.new('RGBA', (128, 128))
    result.putdata([COLORS[c] for row in rows for c in row])
    return result


def background(kind):
    result = Image.new('RGBA', (128, 128), '#EEE9D9' if kind == 'light' else '#121D29')
    if kind == 'checker':
        d = ImageDraw.Draw(result)
        for y in range(0, 128, 8):
            for x in range(0, 128, 8):
                d.rectangle((x, y, x + 7, y + 7), fill='#697583' if (x // 8 + y // 8) % 2 else '#9AA5AE')
    return result


for name in TARGETS:
    folder = 'poses' if name == 'attack' else 'actions'
    art = image_from_grid(ROOT / folder / (name + '.pxgrid'))
    diagnostic = Image.new('RGB', (1200, 570), '#253340')
    d = ImageDraw.Draw(diagnostic)
    for i, kind in enumerate(['light', 'dark', 'checker']):
        display = background(kind)
        display.alpha_composite(art)
        x = 400 * i + 8
        d.text((x, 5), name + ' / ' + kind + ' / native 1x', fill='white')
        diagnostic.paste(display, (x, 24))
        d.text((x, 164), 'nearest 3x', fill='white')
        diagnostic.paste(display.resize((384, 384), Image.Resampling.NEAREST), (x, 184))
    diagnostic.save(OUT / (name + '-round-rim-rest.png'))

comparison = Image.new('RGB', (800, len(TARGETS) * 420), '#253340')
d = ImageDraw.Draw(comparison)
for i, name in enumerate(TARGETS):
    folder = 'poses' if name == 'attack' else 'actions'
    for j, (stage, root) in enumerate([('before', BEFORE), ('after', ROOT)]):
        display = background('light')
        display.alpha_composite(image_from_grid(root / folder / (name + '.pxgrid')))
        d.text((j * 400 + 8, i * 420 + 4), name + ' / ' + stage, fill='white')
        comparison.paste(display.resize((384, 384), Image.Resampling.NEAREST), (j * 400 + 8, i * 420 + 28))
comparison.save(OUT / 'round-rim-rest-before-after.png')

report = {'palette_colors': len(PALETTE), 'frames': []}
seen = {}
duplicates = []
for folder in ['poses', 'actions']:
    for path in sorted((ROOT / folder).glob('*.pxgrid')):
        rows = path.read_text().splitlines()
        ink = [(x, y) for y, row in enumerate(rows) for x, c in enumerate(row) if c != '.']
        old_rows = (BEFORE / folder / path.name).read_text().splitlines()
        pixels = ''.join(rows)
        if pixels in seen:
            duplicates.append([seen[pixels], path.stem])
        seen[pixels] = path.stem
        changed = [(x, y) for y, row in enumerate(rows) for x, c in enumerate(row) if c != old_rows[y][x]]
        report['frames'].append({
            'name': path.stem, 'rows': len(rows), 'row_widths': sorted(set(map(len, rows))),
            'unknown_symbols': sorted(set(''.join(rows)) - set(COLORS)),
            'border_ink': sum(c != '.' for c in rows[0] + rows[-1]) + sum(row[0] != '.' or row[-1] != '.' for row in rows),
            'lowest_ink_y': max(y for x, y in ink), 'changed_pixels': len(changed),
            'change_extent': [min(x for x, y in changed), min(y for x, y in changed), max(x for x, y in changed), max(y for x, y in changed)] if changed else None,
        })
report['identical_frame_pairs'] = duplicates
report['palette_unchanged_from_before'] = (ROOT / 'palette.json').read_bytes() == (BEFORE / 'palette.json').read_bytes()
report['gif_holds_ms'] = {}
for motion in ['idle', 'attack', 'hit', 'dead', 'skill', 'poison', 'stun', 'sleep']:
    gif = Image.open(OUT / (motion + '.gif'))
    durations = []
    for i in range(gif.n_frames):
        gif.seek(i)
        durations.append(gif.info['duration'])
    report['gif_holds_ms'][motion] = durations
(OUT / 'round-rim-rest-file-diagnostics.json').write_text(json.dumps(report, indent=2) + '\n')
print('Literal-file diagnostics:', len(report['frames']), 'frames;', len(PALETTE), 'colors; identical pairs:', duplicates)
for frame in report['frames']:
    if frame['changed_pixels']:
        print(frame['name'], frame['changed_pixels'], 'changed pixels;', frame['change_extent'])
print('Palette unchanged:', report['palette_unchanged_from_before'])
print('GIF holds:', report['gif_holds_ms'])

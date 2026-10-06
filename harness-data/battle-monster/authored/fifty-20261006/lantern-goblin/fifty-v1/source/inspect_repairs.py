"""Read literal source; render before/after diagnostics and compute actual diffs.

Only labels, backgrounds and nearest-neighbor diagnostic magnification are
drawn here. This helper never writes, transforms or repairs a source frame.
"""
from pathlib import Path
import hashlib
import json
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent
BEFORE = ROOT / 'originals' / 'before-anatomy-emission-repair'
COLORS = {symbol: tuple(bytes.fromhex(color[1:])) + (255,)
          for symbol, color in json.loads((ROOT / 'palette.json').read_text()).items()}
DETAILS = [
    ('actions/sleep_a.pxgrid', (48, 70, 69, 85)),
    ('actions/sleep_b.pxgrid', (39, 70, 69, 85)),
    ('poses/dead.pxgrid', (61, 77, 84, 94)),
    ('actions/skill_b.pxgrid', (66, 43, 85, 59)),
]


def read_frame(path):
    rows = path.read_text().splitlines()
    im = Image.new('RGBA', (96, 96))
    im.putdata([COLORS[c] if c != '.' else (0, 0, 0, 0)
                for row in rows for c in row])
    return rows, im


def background(name):
    color = {'light': (238, 227, 203, 255),
             'dark': (24, 28, 36, 255),
             'checker': (195, 195, 200, 255)}[name]
    im = Image.new('RGBA', (96, 96), color)
    if name == 'checker':
        draw = ImageDraw.Draw(im)
        for y in range(0, 96, 8):
            for x in range(0, 96, 8):
                if (x // 8 + y // 8) % 2:
                    draw.rectangle((x, y, x + 7, y + 7), fill=(145, 145, 151, 255))
    return im


def make_details():
    # Three backgrounds per before/after column; both native and 3x views.
    for label, root in [('before', BEFORE), ('after', ROOT)]:
        sheet = Image.new('RGB', (1188, 4 * 332), (40, 40, 45))
        draw = ImageDraw.Draw(sheet)
        for i, (relative, _) in enumerate(DETAILS):
            _, frame = read_frame(root / relative)
            for j, bg_name in enumerate(['light', 'dark', 'checker']):
                tile = background(bg_name)
                tile.alpha_composite(frame)
                x, y = j * 396 + 4, i * 332 + 28
                sheet.paste(tile.resize((288, 288), Image.Resampling.NEAREST), (x, y))
                sheet.paste(tile, (x + 292, y))
                draw.text((x, y - 19), f'{Path(relative).stem} {bg_name} {label} 1x + 3x', fill='white')
        sheet.save(ROOT / 'previews' / f'anatomy-{label}.png')

    # Coordinate labels surround a 10x diagnostic crop, never an art asset.
    detail = Image.new('RGB', (820, 4 * 238), (40, 40, 45))
    draw = ImageDraw.Draw(detail)
    for i, (relative, box) in enumerate(DETAILS):
        left, top, right, bottom = box
        for j, (label, root) in enumerate([('before', BEFORE), ('after', ROOT)]):
            _, frame = read_frame(root / relative)
            tile = background('checker')
            tile.alpha_composite(frame)
            x, y = j * 410 + 36, i * 238 + 52
            detail.paste(tile.crop(box).resize(((right - left) * 10, (bottom - top) * 10),
                                             Image.Resampling.NEAREST), (x, y))
            draw.text((j * 410 + 5, i * 238 + 5),
                      f'{Path(relative).stem} {label}: x{left}..{right-1}, y{top}..{bottom-1}', fill='white')
            for xx in range(left, right):
                draw.text((x + (xx - left) * 10 + 1, y - 26), str(xx // 10), fill='white')
                draw.text((x + (xx - left) * 10 + 1, y - 14), str(xx % 10), fill='white')
            for yy in range(top, bottom):
                draw.text((x - 23, y + (yy - top) * 10), str(yy), fill='white')
    detail.save(ROOT / 'previews' / 'anatomy-coordinate-details.png')


def record_diffs():
    records = {}
    active = sorted(list((ROOT / 'poses').glob('*.pxgrid')) +
                    list((ROOT / 'actions').glob('*.pxgrid')) + [ROOT / 'palette.json'])
    for path in active:
        relative = path.relative_to(ROOT)
        previous = BEFORE / relative
        record = {
            'beforeSHA256': hashlib.sha256(previous.read_bytes()).hexdigest(),
            'currentSHA256': hashlib.sha256(path.read_bytes()).hexdigest(),
        }
        if path.suffix == '.pxgrid':
            old, new = previous.read_text().splitlines(), path.read_text().splitlines()
            diff = [{'x': x, 'y': y, 'before': a, 'after': b}
                    for y, (old_row, new_row) in enumerate(zip(old, new))
                    for x, (a, b) in enumerate(zip(old_row, new_row)) if a != b]
            record['changedPixels'] = len(diff)
            record['literalChanges'] = diff
            if diff:
                record['bboxInclusive'] = [min(p['x'] for p in diff), min(p['y'] for p in diff),
                                          max(p['x'] for p in diff), max(p['y'] for p in diff)]
        records[str(relative)] = record
    (ROOT / 'previews' / 'anatomy-diff.json').write_text(json.dumps(records, indent=2) + '\n')
    for name, record in records.items():
        if record.get('changedPixels'):
            print(name, record['changedPixels'], record['bboxInclusive'])
    print('Other active grids and palette unchanged:',
          sum(record['beforeSHA256'] == record['currentSHA256'] for record in records.values()))


if __name__ == '__main__':
    make_details()
    record_diffs()

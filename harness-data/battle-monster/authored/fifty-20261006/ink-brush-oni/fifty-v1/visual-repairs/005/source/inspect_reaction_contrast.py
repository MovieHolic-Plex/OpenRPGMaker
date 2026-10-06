"""Read-only native-art diagnostics. Writes only source/previews images/report.

Pixel decoding, labeled before/after sheets and nearest diagnostic crops only.
Never edits, moves, fills or filters the native artwork.
"""
from pathlib import Path
import json
import hashlib
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent
OUT = ROOT / 'previews'
BEFORE = ROOT / 'originals/before-windup-hit-contrast-repair'
PAL = json.loads((ROOT / 'palette.json').read_text())
CASES = [
    ('windup', 'poses', (20, 43, 63, 63)),
    ('idle_a', 'poses', (57, 60, 75, 81)),
    ('hit', 'poses', (20, 43, 87, 83)),
    ('skill_b', 'actions', (73, 27, 95, 67)),
]


def read_grid(path):
    im = Image.new('RGBA', (96, 96))
    for y, row in enumerate(path.read_text().splitlines()):
        for x, ch in enumerate(row):
            if ch != '.':
                im.putpixel((x, y), tuple(bytes.fromhex(PAL[ch][1:])) + (255,))
    return im


def background(mode):
    bg = Image.new('RGBA', (96, 96), (235, 231, 218, 255)
                   if mode == 'light' else (34, 37, 43, 255))
    if mode == 'checker':
        for y in range(96):
            for x in range(96):
                val = 105 if (x // 8 + y // 8) % 2 else 160
                bg.putpixel((x, y), (val, val, val, 255))
    return bg


for mode in ['light', 'dark', 'checker']:
    board = Image.new('RGB', (1320, 1320), (45, 47, 52))
    draw = ImageDraw.Draw(board)
    for i, (name, folder, box) in enumerate(CASES):
        y = i * 330 + 22
        draw.text((10, y - 17), f'{name}: before / current; native, 3x, 3x detail',
                  fill=(245, 245, 240))
        for col, root in enumerate([BEFORE, ROOT]):
            im = background(mode)
            im.alpha_composite(read_grid(root / folder / (name + '.pxgrid')))
            x = col * 660 + 10
            board.paste(im.convert('RGB'), (x, y))
            board.paste(im.resize((288, 288), Image.Resampling.NEAREST)
                        .convert('RGB'), (x + 108, y))
            crop = im.crop(box)
            # Explicit diagnostic enlargement; source pixels are unchanged.
            board.paste(crop.resize((crop.width * 3, crop.height * 3),
                                    Image.Resampling.NEAREST).convert('RGB'),
                        (x + 410, y + 5))
    board.save(OUT / ('reaction-contrast-' + mode + '.png'))

report = {'palette_unchanged': (ROOT / 'palette.json').read_bytes() ==
          (BEFORE / 'palette.json').read_bytes(), 'frames': {}}
for folder in ['poses', 'actions']:
    for path in sorted((ROOT / folder).glob('*.pxgrid')):
        rows = path.read_text().splitlines()
        old = (BEFORE / folder / path.name).read_text().splitlines()
        changes = []
        for y, (a, b) in enumerate(zip(old, rows)):
            for x, (ca, cb) in enumerate(zip(a, b)):
                if ca != cb:
                    changes.append({'x': x, 'y': y, 'before': ca, 'after': cb})
        report['frames'][path.stem] = {
            'changed_pixels': len(changes), 'changes': changes,
            'grid_sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
        }
(OUT / 'reaction-contrast-report.json').write_text(
    json.dumps(report, indent=2) + '\n')
print('Explicit changes:', {n: r['changed_pixels']
                            for n, r in report['frames'].items()})

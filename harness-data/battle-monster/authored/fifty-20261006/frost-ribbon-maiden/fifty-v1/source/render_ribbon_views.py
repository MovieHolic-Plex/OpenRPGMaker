"""Decode source grids and render diagnostic before/after views only."""
from pathlib import Path
from PIL import Image, ImageDraw
import hashlib
import json

ROOT = Path(__file__).resolve().parent
OUT = ROOT / 'preview'
PALETTE = json.loads((ROOT / 'palette.json').read_text())
COLORS = {k: tuple(bytes.fromhex(v[1:])) + (255,) for k, v in PALETTE.items()}
COLORS['.'] = (0, 0, 0, 0)
paths = [ROOT / 'checkpoints/ribbon-tip-before/move.pxgrid', ROOT / 'poses/move.pxgrid']
rows = [p.read_text().splitlines() for p in paths]
frames = []
for grid in rows:
    frame = Image.new('RGBA', (96, 96))
    frame.putdata([COLORS[c] for row in grid for c in row])
    frames.append(frame)

def background(kind):
    im = Image.new('RGBA', (96, 96), (230, 230, 220, 255) if kind == 'light' else (23, 28, 42, 255))
    if kind == 'checker':
        im.putdata([(174, 184, 194, 255) if (x // 8 + y // 8) % 2 else (220, 225, 228, 255)
                    for y in range(96) for x in range(96)])
    return im

for scale in (1, 3):
    width, height = 2 * (96 * scale + 16), 3 * (96 * scale + 28)
    sheet = Image.new('RGB', (width, height), (55, 62, 76))
    draw = ImageDraw.Draw(sheet)
    for by, kind in enumerate(('light', 'dark', 'checker')):
        for bx, frame in enumerate(frames):
            im = background(kind)
            im.alpha_composite(frame)
            x, y = bx * (96 * scale + 16) + 8, by * (96 * scale + 28) + 22
            draw.text((x, y - 16), kind + (' before' if bx == 0 else ' after'), fill='white')
            sheet.paste(im.resize((96 * scale, 96 * scale), Image.Resampling.NEAREST), (x, y))
    sheet.save(OUT / f'ribbon-tip-before-after-{scale}x.png')

detail = Image.new('RGB', (480, 412), (55, 62, 76))
draw = ImageDraw.Draw(detail)
for by, kind in enumerate(('light', 'dark', 'checker')):
    for bx, frame in enumerate(frames):
        im = background(kind)
        im.alpha_composite(frame)
        # Crop/nearest enlargement is solely for examining the source coordinates.
        crop = im.crop((50, 78, 76, 92)).resize((208, 112), Image.Resampling.NEAREST)
        x, y = bx * 240 + 8, by * 136 + 22
        detail.paste(crop, (x, y))
        draw.text((x, y - 16), f'{kind} ' + ('before' if bx == 0 else 'after') + ' x50..75 y78..91', fill='white')
detail.save(OUT / 'ribbon-tip-detail-8x.png')

changes = [{'x': x, 'y': y, 'before': rows[0][y][x], 'after': rows[1][y][x]}
           for y in range(96) for x in range(96) if rows[0][y][x] != rows[1][y][x]]
report = {'pose': 'move', 'changedPixels': len(changes), 'pixels': changes,
          'beforeSha256': hashlib.sha256(paths[0].read_bytes()).hexdigest(),
          'afterSha256': hashlib.sha256(paths[1].read_bytes()).hexdigest(),
          'scope': 'Local silk tip only; hashes describe files, not review or approval.'}
(OUT / 'ribbon-tip-diagnostics.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report, indent=2))

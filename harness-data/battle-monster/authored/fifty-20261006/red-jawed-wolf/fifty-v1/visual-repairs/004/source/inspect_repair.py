"""Display original/current literal grids at native size and nearest 3x.
Reads art only. Background rectangles and labels are diagnostic UI.
"""
from pathlib import Path
import json
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent
palette = json.loads((ROOT / 'palette.json').read_text())
colors = {s: tuple(bytes.fromhex(c[1:])) + (255,) for s, c in palette.items()}

def read(path):
    rows = path.read_text().splitlines()
    im = Image.new('RGBA', (64, 64))
    im.putdata([colors[s] if s != '.' else (0, 0, 0, 0) for row in rows for s in row])
    return im

sheet = Image.new('RGB', (840, 990), '#434653')
labels = ImageDraw.Draw(sheet)
for j, (background, fill) in enumerate([('light', '#d9d8cc'), ('dark', '#252838'), ('checker', '#9499a3')]):
    for i, name in enumerate(['dead', 'sleep_a', 'sleep_b']):
        folder = 'poses' if name == 'dead' else 'actions'
        x, y = i * 280 + 8, j * 330 + 24
        labels.text((x, y - 18), f'{name} / {background} / before > current', fill='white')
        for k, base in enumerate([ROOT / 'history/before-anatomy-repair', ROOT]):
            tile = Image.new('RGBA', (64, 64), fill)
            if background == 'checker':
                td = ImageDraw.Draw(tile)
                for cy in range(0, 64, 8):
                    for cx in range(0, 64, 8):
                        if (cx // 8 + cy // 8) % 2:
                            td.rectangle((cx, cy, cx + 7, cy + 7), fill='#c2c4ca')
            tile.alpha_composite(read(base / folder / (name + '.pxgrid')))
            sheet.paste(tile, (x + k * 72, y))
            if k == 1:
                sheet.paste(tile.resize((192, 192), Image.Resampling.NEAREST), (x, y + 80))
sheet.save(ROOT / 'preview/anatomy-repair.png')

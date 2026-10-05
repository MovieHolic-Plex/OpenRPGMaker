"""Explicit hand-chosen native pixel runs and a read-only preview renderer.

Default: render current attack. --apply: apply the recorded literal runs first.
No pose generation, transformations, shape drawing, or computed shading.
"""
from pathlib import Path
import json
import sys
from PIL import Image

SOURCE = Path(__file__).resolve().parents[1]
ATTACK = SOURCE / 'poses' / 'attack.pxgrid'
# (x, y, literal symbols); coordinates are zero-based.
RUNS = [
    # Straight bright edge ends at a single native pixel (62,34).
    # Individually chosen lower rows narrow toward that upper point.
    (57, 34, 'wwwwww'),
    (57, 35, 'mmmmv.'),
    (57, 36, 'vvv...'),
    (57, 37, 'v.....'),
    # Existing mouth at (41..43,38) and skin contact remain untouched.
    # Outline o, upper-left plane h, black body k.
    (40, 39, 'ohko'),
    (41, 40, 'ohkko'),
    (42, 41, 'ohkko'),
    (43, 42, 'ohkko'),
    (44, 43, 'ohko'),
    (45, 44, 'oko'),
    (46, 45, 'oo'),
]

rows = ATTACK.read_text().splitlines()
if '--apply' in sys.argv:
    chosen = [list(row) for row in rows]
    changes = []
    for x, y, symbols in RUNS:
        for offset, symbol in enumerate(symbols):
            xx = x + offset
            old = chosen[y][xx]
            if old != symbol:
                changes.append(f'({xx},{y}) {old}->{symbol}')
            chosen[y][xx] = symbol
    rows = [''.join(row) for row in chosen]
    ATTACK.write_text('\n'.join(rows) + '\n')
    print('Explicit changed pixels:', len(changes))
    print('\n'.join(changes))

palette = json.loads((SOURCE / 'palette.json').read_text())
rgba = {symbol: tuple(bytes.fromhex(color[1:])) + (255,)
        for symbol, color in palette.items()}
frame = Image.new('RGBA', (64, 64), (0, 0, 0, 0))
for y, row in enumerate(rows):
    for x, symbol in enumerate(row):
        if symbol != '.':
            frame.putpixel((x, y), rgba[symbol])
frame.save(SOURCE / 'inspection' / 'attack-repaired.png')

# Enlargement is for inspection only. Native source pixels are unchanged.
for name, base in [('light', (226, 223, 214)),
                   ('dark', (35, 38, 46)),
                   ('checker', None)]:
    background = Image.new('RGBA', (64, 64), base + (255,) if base else (0,0,0,255))
    if base is None:
        for y in range(64):
            for x in range(64):
                value = 151 if (x // 8 + y // 8) % 2 == 0 else 109
                background.putpixel((x,y), (value,value,value,255))
    background.alpha_composite(frame)
    native = background.convert('RGB')
    native.save(SOURCE / 'inspection' / f'attack-{name}-1x.png')
    enlarged = native.resize((192,192), Image.Resampling.NEAREST)
    enlarged.save(SOURCE / 'inspection' / f'attack-{name}-3x.png')

# Compact comparison board: native top, exact nearest 3x bottom.
board = Image.new('RGB', (624, 288), (127,127,127))
for col, name in enumerate(['light', 'dark', 'checker']):
    board.paste(Image.open(SOURCE / 'inspection' / f'attack-{name}-1x.png'), (col*208+72,8))
    board.paste(Image.open(SOURCE / 'inspection' / f'attack-{name}-3x.png'), (col*208+8,88))
board.save(SOURCE / 'inspection' / 'attack-repair-review.png')

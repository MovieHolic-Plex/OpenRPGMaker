"""Read literal grids only; never import or run the draft artist helpers."""
from pathlib import Path
import json
import sys
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent
ORDER = ['idle_a', 'idle_b', 'idle_c', 'windup', 'move', 'attack',
         'recover', 'hit', 'dead', 'skill_a', 'skill_b', 'skill_c',
         'poison_a', 'poison_b', 'stun_a', 'stun_b', 'sleep_a', 'sleep_b']
source = ROOT / 'history/before-quality-repair' if '--before' in sys.argv else ROOT
out = ROOT / 'progress' / ('repair-before' if '--before' in sys.argv else 'repair-v2')
out.mkdir(parents=True, exist_ok=True)
palette = {key: tuple(bytes.fromhex(value[1:])) + (255,)
           for key, value in json.loads((source / 'palette.json').read_text()).items()}
sheet = Image.new('RGB', (768, 1536), '#737579')
draw = ImageDraw.Draw(sheet)
for i, name in enumerate(ORDER):
    group = 'poses' if i < 9 else 'actions'
    rows = (source / group / (name + '.pxgrid')).read_text().splitlines()
    if len(rows) != 64 or any(len(row) != 64 for row in rows):
        raise ValueError('Expected full native 64 rows: ' + name)
    im = Image.new('RGBA', (64, 64))
    for y, row in enumerate(rows):
        for x, symbol in enumerate(row):
            if symbol != '.':
                if not (1 <= x <= 62 and 1 <= y <= 60):
                    raise ValueError('Transparent margin violation: ' + name)
                im.putpixel((x, y), palette[symbol])
    im.save(out / (name + '.png'))
    tx, ty = (i % 3) * 256, (i // 3) * 256
    draw.text((tx + 8, ty + 5), name + ' / native + 3x', fill='#f0eee4')
    for by in range(8):
        for bx in range(8):
            shade = 145 if (bx + by) % 2 else 116
            draw.rectangle((tx + 8 + bx * 24, ty + 55 + by * 24,
                            tx + 31 + bx * 24, ty + 78 + by * 24),
                           fill=(shade, shade, shade))
    sheet.paste(im, (tx + 8, ty + 22), im)
    large = im.resize((192, 192), Image.Resampling.NEAREST)
    sheet.paste(large, (tx + 8, ty + 55), large)
    for label, background in [('light', '#e6e8de'), ('dark', '#171a24')]:
        panel = Image.new('RGBA', (64, 64), background)
        panel.alpha_composite(im)
        panel.resize((512, 512), Image.Resampling.NEAREST).save(out / (name + '-' + label + '.png'))
sheet.save(out / 'suite.png')
print('Rendered 18 original-color PNGs and native/3x sheet into ' + str(out))

"""Decode already authored grids for native and nearest inspection only."""
from pathlib import Path
import json
from PIL import Image, ImageDraw

root = Path(__file__).parent
palette = json.loads((root / 'palette.json').read_text())
colors = {key: tuple(bytes.fromhex(value[1:])) + (255,)
          for key, value in palette.items()}
names = ['skill_a', 'skill_b', 'skill_c', 'poison_a', 'poison_b',
         'stun_a', 'stun_b', 'sleep_a', 'sleep_b']
sheet = Image.new('RGB', (1584, 1872), '#393f46')
draw = ImageDraw.Draw(sheet)
for index, name in enumerate(names):
    data = (root / 'actions' / (name + '.pxgrid')).read_text().splitlines()
    im = Image.new('RGBA', (64, 64))
    im.putdata([colors.get(symbol, (0, 0, 0, 0))
                for row in data for symbol in row])
    left = (index % 3) * 528
    top = (index // 3) * 624
    draw.text((left + 10, top + 22), name + '  1x / nearest 8x', fill='#f3eee1')
    sheet.paste(im, (left + 450, top + 8), im)
    # Background checks are presentation only; they never write source pixels.
    for cy in range(8):
        for cx in range(8):
            fill = '#62686b' if (cx + cy) % 2 else '#858b8c'
            draw.rectangle((left + 8 + cx * 64, top + 96 + cy * 64,
                            left + 71 + cx * 64, top + 159 + cy * 64), fill=fill)
    enlarged = im.resize((512, 512), Image.Resampling.NEAREST)
    sheet.paste(enlarged, (left + 8, top + 96), enlarged)
sheet.save(root / 'progress' / 'inspection-8x.png')

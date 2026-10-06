"""Read saved before/after literals and show them. Never authors art pixels."""
from pathlib import Path
import json
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent
colors = {k: tuple(bytes.fromhex(v[1:])) + (255,) for k, v in json.loads((ROOT / 'palette.json').read_text()).items()}
colors['.'] = (0, 0, 0, 0)
sheet = Image.new('RGB', (800, 1260), '#253340')
labels = ImageDraw.Draw(sheet)
for i, (folder, name) in enumerate([('poses', 'idle_a'), ('poses', 'attack'), ('actions', 'skill_b')]):
    for column, version in enumerate(['before', 'after']):
        path = ROOT / folder / (name + '.pxgrid')
        if version == 'before':
            path = ROOT / 'revisions' / 'before-dome-impact-mouth' / folder / path.name
        rows = path.read_text().splitlines()
        art = Image.new('RGBA', (128, 128))
        art.putdata([colors[c] for row in rows for c in row])
        display = Image.new('RGBA', (128, 128), '#EEE9D9')
        display.alpha_composite(art)
        x, y = 8 + 400 * column, 28 + 420 * i
        sheet.paste(display.resize((384, 384), Image.Resampling.NEAREST), (x, y))
        labels.text((x, y - 20), name + ' / ' + version + ' / nearest 3x', fill='white')
sheet.save(ROOT / 'previews' / 'repair-before-after.png')

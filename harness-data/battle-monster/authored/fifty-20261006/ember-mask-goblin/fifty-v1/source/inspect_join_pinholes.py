"""Render native/nearest inspection only; never write pixel sources."""
from pathlib import Path
from PIL import Image, ImageDraw
import json

ROOT = Path(__file__).resolve().parent
PALETTE = json.loads((ROOT / 'palette.json').read_text())
COLORS = {c: tuple(bytes.fromhex(rgb[1:])) + (255,) for c, rgb in PALETTE.items()}
TARGETS = [('actions/skill_c.pxgrid', 54, 39), ('poses/dead.pxgrid', 69, 65)]

def read_grid(path):
    rows = path.read_text().splitlines()
    im = Image.new('RGBA', (96, 96))
    im.putdata([COLORS.get(c, (0, 0, 0, 0)) for row in rows for c in row])
    return im

def background(theme):
    im = Image.new('RGBA', (96, 96),
                   {'light': (240, 230, 213, 255), 'dark': (27, 31, 39, 255),
                    'checker': (170, 170, 178, 255)}[theme])
    if theme == 'checker':
        im.putdata([(210, 210, 217, 255) if (x//8 + y//8) % 2 else
                    (170, 170, 178, 255) for y in range(96) for x in range(96)])
    return im

for theme in ['light', 'dark', 'checker']:
    sheet = Image.new('RGB', (732, 760), (55, 57, 64))
    draw = ImageDraw.Draw(sheet)
    for i, (relative, x, y) in enumerate(TARGETS):
        current = background(theme)
        current.alpha_composite(read_grid(ROOT / relative))
        before = background(theme)
        before.alpha_composite(read_grid(ROOT / 'history' / 'before-join-pinhole-repair' / relative))
        top = i * 380 + 28
        draw.text((12, top-20), f'{Path(relative).stem} ({x},{y}): . -> o / {theme}', fill='white')
        sheet.paste(current.convert('RGB'), (12, top))
        sheet.paste(current.convert('RGB').resize((288, 288), Image.Resampling.NEAREST), (120, top))
        draw.text((428, top), 'before / nearest 8x', fill='white')
        draw.text((578, top), 'after / nearest 8x', fill='white')
        box = (x-7, y-7, x+8, y+8)
        for offset, tile in [(428, before), (578, current)]:
            sheet.paste(tile.crop(box).convert('RGB').resize((120, 120), Image.Resampling.NEAREST),
                        (offset, top+24))
        draw.text((428, top+152), 'Target: center of each crop', fill='white')
    sheet.save(ROOT / f'join-pinhole-{theme}.png')

facts = json.loads((ROOT / 'join-pinhole-changes.json').read_text())
facts['current_pngs'] = {}
import hashlib
for relative, x, y in TARGETS:
    path = ROOT / 'png' / (Path(relative).stem + '.png')
    facts['current_pngs'][Path(relative).stem] = {
        'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
        'pixel_rgba': list(Image.open(path).convert('RGBA').getpixel((x, y)))}
(ROOT / 'join-pinhole-changes.json').write_text(json.dumps(facts, indent=2) + '\n')
print('Three native/3x background sheets and before/after detail crops written in source.')

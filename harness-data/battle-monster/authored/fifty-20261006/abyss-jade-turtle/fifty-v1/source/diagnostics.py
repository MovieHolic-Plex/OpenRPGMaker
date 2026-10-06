"""Display the saved art at native scale and nearest 3x on three backgrounds.

Only reads PNGs/grids and draws diagnostic backgrounds/labels. Does not select,
fill, move, shade, or write any art pixels.
"""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent
OUT = ROOT / 'previews'


def backdrop(kind):
    result = Image.new('RGBA', (128, 128), '#EEE9D9' if kind == 'light' else '#121D29')
    if kind == 'checker':
        draw = ImageDraw.Draw(result)
        for y in range(0, 128, 8):
            for x in range(0, 128, 8):
                draw.rectangle((x, y, x + 7, y + 7), fill='#697583' if (x // 8 + y // 8) % 2 else '#9AA5AE')
    return result


for name in ['idle_a', 'windup', 'move', 'attack', 'recover', 'skill_a', 'skill_b', 'skill_c', 'sleep_a', 'sleep_b']:
    art = Image.open(OUT / (name + '.png')).convert('RGBA')
    sheet = Image.new('RGB', (1200, 570), '#253340')
    draw = ImageDraw.Draw(sheet)
    for index, kind in enumerate(['light', 'dark', 'checker']):
        display = backdrop(kind)
        display.alpha_composite(art)
        x = 400 * index + 8
        draw.text((x, 5), name + ' / ' + kind + ' / native 1x', fill='white')
        sheet.paste(display, (x, 24))
        draw.text((x, 164), 'nearest 3x', fill='white')
        sheet.paste(display.resize((384, 384), Image.Resampling.NEAREST), (x, 184))
    sheet.save(OUT / (name + '-repair-backgrounds.png'))

# Only a diagnostic crop of the candidate's own saved PNGs, never references.
face_names = ['idle_a', 'windup', 'hit', 'sleep_a', 'sleep_b', 'dead', 'skill_b', 'skill_c']
faces = Image.new('RGB', (1536, 220), '#EEE9D9')
face_labels = ImageDraw.Draw(faces)
for i, name in enumerate(face_names):
    display = backdrop('light')
    display.alpha_composite(Image.open(OUT / (name + '.png')).convert('RGBA'))
    detail = display.crop((80, 59, 128, 110)).resize((192, 204), Image.Resampling.NEAREST)
    faces.paste(detail, (i * 192, 16))
    face_labels.text((i * 192 + 2, 2), name, fill='#102E3B')
faces.save(OUT / 'face-diagnostic-4x.png')

# Read-only comparison of the final grids to the saved pre-repair literals.
for name in ['skill_b', 'sleep_b']:
    before = (ROOT / 'revisions' / 'before-targeted-repair' / 'actions' / (name + '.pxgrid')).read_text().splitlines()
    after = (ROOT / 'actions' / (name + '.pxgrid')).read_text().splitlines()
    different = [(x, y) for y, row in enumerate(after) for x, pixel in enumerate(row) if pixel != before[y][x]]
    print(name, 'changed pixels', len(different), 'extent',
          (min(x for x, y in different), min(y for x, y in different), max(x for x, y in different), max(y for x, y in different)))
    ink = [(x, y) for y, row in enumerate(after) for x, pixel in enumerate(row) if pixel != '.']
    print(name, 'ink extent', (min(x for x, y in ink), min(y for x, y in ink), max(x for x, y in ink), max(y for x, y in ink)))

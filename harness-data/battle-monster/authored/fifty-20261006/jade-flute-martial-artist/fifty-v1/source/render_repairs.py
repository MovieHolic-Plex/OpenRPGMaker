"""Display current repaired pixels at 1x/3x on three diagnostic backgrounds."""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent
OUT = ROOT / 'preview'
names = ['skill_a', 'skill_b', 'sleep_a', 'sleep_b']
sheet = Image.new('RGB', (864, 864), (60, 65, 73))
labels = ImageDraw.Draw(sheet)
for row, (bgname, color) in enumerate([
    ('light', (230, 225, 209)),
    ('dark', (35, 42, 54)),
    ('checker', None),
]):
    for col, name in enumerate(names):
        tile = Image.new('RGBA', (64, 64), color or (157, 161, 166))
        if color is None:
            pixels = tile.load()
            for y in range(64):
                for x in range(64):
                    if (x // 8 + y // 8) % 2:
                        pixels[x, y] = (205, 206, 204, 255)
        tile.alpha_composite(Image.open(OUT / (name + '.png')).convert('RGBA'))
        x, y = col * 216 + 8, row * 288
        labels.text((x, y + 4), name + ' / ' + bgname, fill='white')
        sheet.paste(tile.convert('RGB'), (x, y + 22))
        sheet.paste(tile.convert('RGB').resize((192, 192), Image.Resampling.NEAREST),
                    (x, y + 90))
sheet.save(OUT / 'repair-1x-3x.png')

"""Read-only artwork diagnostics: backgrounds, labels, nearest magnification.

Never writes native art. Output stays in source/previews.
"""
from pathlib import Path
from PIL import Image, ImageDraw
import json

ROOT = Path(__file__).resolve().parent
OUT = ROOT / 'previews'
PALETTE = json.loads((ROOT / 'palette.json').read_text())
NAMES = ['idle_a', 'idle_b', 'idle_c', 'windup', 'move', 'attack',
         'recover', 'hit', 'dead', 'skill_a', 'skill_b', 'skill_c',
         'poison_a', 'poison_b', 'stun_a', 'stun_b', 'sleep_a', 'sleep_b']


def read_grid(path):
    im = Image.new('RGBA', (96, 96))
    for y, row in enumerate(path.read_text().splitlines()):
        for x, ch in enumerate(row):
            if ch != '.':
                im.putpixel((x, y), tuple(bytes.fromhex(PALETTE[ch][1:])) + (255,))
    return im


def background(mode):
    im = Image.new('RGBA', (96, 96), (235, 231, 218, 255)
                   if mode == 'light' else (34, 37, 43, 255))
    if mode == 'checker':
        for y in range(96):
            for x in range(96):
                v = 105 if (x // 8 + y // 8) % 2 else 160
                im.putpixel((x, y), (v, v, v, 255))
    return im


for mode in ['light', 'dark', 'checker']:
    native = Image.new('RGB', (720, 360), (45, 47, 52))
    draw = ImageDraw.Draw(native)
    for i, name in enumerate(NAMES):
        im = background(mode)
        im.alpha_composite(Image.open(OUT / (name + '.png')))
        x, y = i % 6 * 120 + 12, i // 6 * 120 + 20
        native.paste(im.convert('RGB'), (x, y))
        draw.text((x, y - 15), name, fill=(245, 245, 240))
    native.save(OUT / ('native-' + mode + '.png'))

changed = [('recover', 'poses', (58, 58, 79, 72)),
           ('hit', 'poses', (58, 58, 79, 72)),
           ('skill_b', 'actions', (77, 25, 95, 62)),
           ('skill_c', 'actions', (72, 10, 90, 49))]
for mode in ['light', 'dark', 'checker']:
    board = Image.new('RGB', (840, 680), (45, 47, 52))
    draw = ImageDraw.Draw(board)
    for i, (name, folder, crop) in enumerate(changed):
        x, y = i % 2 * 420 + 8, i // 2 * 340 + 20
        before = read_grid(ROOT / 'originals' / 'before-grip-ink-repair' /
                           folder / (name + '.pxgrid'))
        after = Image.open(OUT / (name + '.png')).convert('RGBA')
        draw.text((x, y - 15), name + ' before / after, native + 4x detail',
                  fill=(245, 245, 240))
        for col, art in enumerate([before, after]):
            bg = background(mode)
            bg.alpha_composite(art)
            board.paste(bg.convert('RGB'), (x + col * 204, y))
            detail = bg.crop(crop)
            board.paste(detail.resize((detail.width * 4, detail.height * 4),
                                     Image.Resampling.NEAREST).convert('RGB'),
                        (x + col * 204, y + 106))
    board.save(OUT / ('repair-' + mode + '.png'))

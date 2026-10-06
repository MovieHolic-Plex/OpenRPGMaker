"""Read final PNGs; labels and nearest 3x crops are diagnostic only."""
from pathlib import Path
from PIL import Image, ImageDraw
ROOT = Path(__file__).resolve().parent
OUT = ROOT / 'preview'
focus = [
    ('idle_a', (15, 92, 108, 125)),
    ('poison_a', (92, 89, 113, 119)),
    ('poison_b', (91, 89, 112, 120)),
    ('skill_a', (100, 55, 123, 75)),
    ('skill_b', (96, 57, 124, 75)),
    ('dead', (25, 75, 119, 125)),
    ('recover', (70, 96, 111, 125)),
    ('attack', (93, 94, 127, 115)),
]
board = Image.new('RGB', (1040, 8 * 192), (32, 39, 51))
draw = ImageDraw.Draw(board)
for n, (name, box) in enumerate(focus):
    im = Image.open(OUT / (name + '.png'))
    y = n * 192
    board.paste(im, (0, y + 24), im)
    draw.text((3, y + 3), name + ' 1x', fill='white')
    clip = im.crop(box)
    zoom = clip.resize((clip.width * 3, clip.height * 3), Image.Resampling.NEAREST)
    for k, bg in enumerate(((235, 229, 215), (25, 31, 44), None)):
        tile = Image.new('RGB', zoom.size, bg or (133, 144, 151))
        if bg is None:
            td = ImageDraw.Draw(tile)
            for cy in range(0, tile.height, 12):
                for cx in range(0, tile.width, 12):
                    if (cx // 12 + cy // 12) % 2:
                        td.rectangle((cx, cy, cx + 11, cy + 11), fill=(184, 189, 192))
        tile.paste(zoom, (0, 0), zoom)
        x = 135 + k * 300
        board.paste(tile, (x, y + 24))
        draw.text((x, y + 5), '3x ' + str(box), fill='white')
board.save(OUT / 'joint-focus-3x.png')

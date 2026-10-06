"""Read PNG pixels for native and nearest 3x visual study only."""
from pathlib import Path
from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent / 'preview'
focus = [
    ('idle_a', (86, 82, 110, 108)),
    ('idle_b', (86, 82, 110, 108)),
    ('idle_c', (86, 82, 110, 108)),
    ('skill_a', (62, 44, 82, 60)),
    ('skill_c', (86, 82, 110, 108)),
    ('stun_a', (86, 82, 112, 108)),
    ('stun_b', (86, 82, 112, 108)),
    ('sleep_a', (38, 103, 76, 126)),
    ('sleep_b', (38, 103, 76, 126)),
]
board = Image.new('RGB', (768, len(focus) * 152), (47, 54, 66))
draw = ImageDraw.Draw(board)
for n, (name, box) in enumerate(focus):
    y = n * 152
    im = Image.open(OUT / (name + '.png')).convert('RGBA')
    draw.text((3, y + 3), name + ' native', fill='white')
    board.paste(im, (0, y + 20), im)
    zoom = im.crop(box).resize(((box[2] - box[0]) * 3, (box[3] - box[1]) * 3), Image.Resampling.NEAREST)
    for k, (label, bg) in enumerate([('light', (235,229,215)), ('dark', (25,31,44)), ('checker', None)]):
        x = 144 + k * 204
        tile = Image.new('RGB', (196,128), bg or (130,141,149))
        td = ImageDraw.Draw(tile)
        if bg is None:
            for cy in range(0,128,12):
                for cx in range(0,196,12):
                    if (cx//12 + cy//12) % 2:
                        td.rectangle((cx,cy,cx+11,cy+11), fill=(184,189,192))
        tile.paste(zoom, (0,0), zoom)
        board.paste(tile, (x,y+20))
        draw.text((x,y+3), label + ' 3x ' + str(box[:2]), fill='white')
board.save(OUT / 'anatomy-core-focus-3x.png')

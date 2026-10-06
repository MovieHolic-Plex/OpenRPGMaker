"""Read saved PNGs for labelled native/nearest 3x before and after study."""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent
OUT = ROOT / 'preview'
FOCUS = [('move', (93, 77, 116, 104)),
         ('skill_b', (86, 85, 112, 112)),
         ('stun_a', (90, 49, 121, 83)),
         ('stun_b', (90, 49, 121, 83))]
board = Image.new('RGB', (800, 8 * 156), (47, 54, 66))
draw = ImageDraw.Draw(board)
for n, (name, box) in enumerate(FOCUS):
    for version in range(2):
        y = (n * 2 + version) * 156
        base = ROOT / 'before-contour-repair' / 'preview' if version == 0 else OUT
        im = Image.open(base / (name + '.png')).convert('RGBA')
        draw.text((4, y + 3), name + (' before' if version == 0 else ' current'), fill='white')
        board.paste(im, (0, y + 22), im)
        zoom = im.crop(box).resize(((box[2]-box[0])*3, (box[3]-box[1])*3), Image.Resampling.NEAREST)
        for k, bg in enumerate(((235,229,215), (25,31,44), None)):
            x = 150 + k * 215
            tile = Image.new('RGB', (200,128), bg or (130,141,149))
            if bg is None:
                td = ImageDraw.Draw(tile)
                for cy in range(0,128,12):
                    for cx in range(0,200,12):
                        if (cx//12 + cy//12) % 2:
                            td.rectangle((cx,cy,cx+11,cy+11), fill=(184,189,192))
            tile.paste(zoom, (0,0), zoom)
            board.paste(tile, (x,y+22))
            draw.text((x, y+3), ['light','dark','checker'][k] + ' 3x ' + str(box[:2]), fill='white')
board.save(OUT / 'contour-focus-3x.png')

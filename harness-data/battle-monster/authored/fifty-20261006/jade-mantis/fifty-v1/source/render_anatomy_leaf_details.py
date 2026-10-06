"""Read current PNGs; crop/enlarge only for diagnostic display and labels."""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent
board = Image.new('RGB', (960, 510), '#18232c')
draw = ImageDraw.Draw(board)
regions = [('hit', (28, 22, 48, 35)),
           ('skill_b', (52, 16, 64, 25)),
           ('skill_b', (52, 33, 64, 43))]
for i, (name, box) in enumerate(regions):
    frame = Image.open(ROOT/'preview'/(name+'.png')).convert('RGBA')
    detail = frame.crop(box).resize(((box[2]-box[0])*12, (box[3]-box[1])*12),
                                    Image.Resampling.NEAREST)
    board.paste(detail, (i*320+24, 50), detail)
    draw.text((i*320+24, 15), f'{name} region {box}', fill='#e1edbf')
    zoom = frame.resize((256, 256), Image.Resampling.NEAREST)
    board.paste(zoom, (i*320+24, 232), zoom)
board.save(ROOT/'preview/anatomy-leaf-details.png')

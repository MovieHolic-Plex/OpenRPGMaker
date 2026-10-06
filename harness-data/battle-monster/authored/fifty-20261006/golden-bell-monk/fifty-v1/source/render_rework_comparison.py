"""Display only: literal before/after grids at 1x and nearest 3x."""
from pathlib import Path
import json
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent
PAL = {s: tuple(bytes.fromhex(c[1:]))+(255,) for s,c in json.loads((ROOT/'palette.json').read_text()).items()}
PAL['.'] = (0, 0, 0, 0)
PANELS = [
    ('attack before', ROOT/'rework-before/attack.pxgrid'),
    ('move unchanged', ROOT/'poses/move.pxgrid'),
    ('attack revised', ROOT/'poses/attack.pxgrid'),
    ('dead before', ROOT/'rework-before/dead.pxgrid'),
    ('dead revised', ROOT/'poses/dead.pxgrid'),
]

def render():
    sheet = Image.new('RGB', (5*224, 3*312), (55, 57, 61))
    draw = ImageDraw.Draw(sheet)
    for j, (bg, rgb) in enumerate([('light',(236,227,208)), ('dark',(36,40,48)), ('checker',None)]):
        for i, (label, path) in enumerate(PANELS):
            native = Image.new('RGBA', (64, 64))
            native.putdata([PAL[c] for line in path.read_text().splitlines() for c in line])
            tile = Image.new('RGBA', (64, 64), rgb+(255,) if rgb else (0,0,0,255))
            if rgb is None:
                for y in range(64):
                    for x in range(64):
                        value = 170 if (x//8+y//8)%2 else 220
                        tile.putpixel((x,y), (value,value,value,255))
            tile.alpha_composite(native)
            x=i*224+12; y=j*312+28
            draw.text((x,y-20), bg+' / '+label, fill=(248,240,220))
            sheet.paste(tile,(x+64,y))
            sheet.paste(tile.resize((192,192),Image.Resampling.NEAREST),(x,y+80))
    sheet.save(ROOT/'preview/rework-comparison.png')

if __name__ == '__main__': render()

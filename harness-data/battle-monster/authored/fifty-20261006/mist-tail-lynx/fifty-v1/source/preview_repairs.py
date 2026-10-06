"""Diagnostic display only: existing native grids on three backgrounds.
No source grid mutation. Nearest enlargement is for inspection only.
"""
from pathlib import Path
import json
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent
PAL = json.loads((ROOT / 'palette.json').read_text())
RGB = {s: tuple(bytes.fromhex(c[1:])) for s, c in PAL.items()}

def read(path):
    rows = path.read_text().splitlines()
    im = Image.new('RGBA', (64,64))
    im.putdata([(0,0,0,0) if s == '.' else (*RGB[s],255)
                for row in rows for s in row])
    return im

def main():
    refs = [
        ('old idle_a', ROOT/'revisions/forelegs-breath-before/poses/idle_a.pxgrid'),
        ('new idle_a', ROOT/'poses/idle_a.pxgrid'),
        ('new recover', ROOT/'poses/recover.pxgrid'),
        ('sleep_a exhale', ROOT/'actions/sleep_a.pxgrid'),
        ('old sleep_b', ROOT/'revisions/forelegs-breath-before/actions/sleep_b.pxgrid'),
        ('new sleep_b inhale', ROOT/'actions/sleep_b.pxgrid'),
    ]
    for label, bg in [('light',(233,225,206)), ('dark',(24,28,36)), ('checker',None)]:
        board = Image.new('RGB',(6*208,292), bg or (40,43,49))
        draw = ImageDraw.Draw(board)
        for i,(name,path) in enumerate(refs):
            x=i*208+8
            draw.text((x,4),name,fill=(120,110,100) if label=='light' else (235,230,215))
            if bg is None:
                for yy in range(64):
                    for xx in range(64):
                        c=(76,80,88) if (xx//8+yy//8)%2 else (108,112,116)
                        draw.point((x+xx,22+yy),fill=c)
                        draw.rectangle((x+xx*3,94+yy*3,x+xx*3+2,94+yy*3+2),fill=c)
            im=read(path)
            board.paste(im,(x,22),im)
            big=im.resize((192,192),Image.Resampling.NEAREST)
            board.paste(big,(x,94),big)
        board.save(ROOT/'preview'/f'repair-focus-{label}.png')

if __name__=='__main__':
    main()

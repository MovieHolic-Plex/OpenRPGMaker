"""Literal grid decoder and nearest-neighbour diagnostic output only."""
from pathlib import Path
from PIL import Image, ImageDraw
import json, hashlib
ROOT = Path(__file__).resolve().parent

def read(name):
    palette=json.loads((ROOT/'palette.json').read_text())
    path=ROOT/('poses' if (ROOT/'poses'/f'{name}.pxgrid').exists() else 'actions')/f'{name}.pxgrid'
    rows=path.read_text().splitlines()
    assert len(rows)==128 and all(len(r)==128 for r in rows), name
    im=Image.new('RGBA',(128,128))
    for y,row in enumerate(rows):
        for x,s in enumerate(row):
            if s!='.':
                h=palette[s]
                im.putpixel((x,y),tuple(bytes.fromhex(h[1:]))+(255,))
    return im

def background(kind):
    im=Image.new('RGBA',(128,128), '#e9dfc7' if kind=='light' else '#242532')
    if kind=='checker':
        p=im.load()
        for y in range(128):
            for x in range(128):
                p[x,y]=(63,65,73,255) if (x//8+y//8)%2 else (87,87,94,255)
    return im

def preview(names, filename):
    sheet=Image.new('RGB',(128*4*3, (128*4+26)*len(names)), '#171821')
    draw=ImageDraw.Draw(sheet)
    for i,n in enumerate(names):
        im=read(n)
        for j,bg in enumerate(['light','dark','checker']):
            plate=background(bg); plate.alpha_composite(im)
            sheet.paste(plate.resize((512,512), Image.Resampling.NEAREST),(j*512,i*538+26))
            draw.text((j*512+8,i*538+7),n+' / '+bg,fill='white')
    sheet.save(ROOT/filename)

if __name__=='__main__':
    import sys
    names=sys.argv[1:] or ['idle_a']
    (ROOT/'preview').mkdir(exist_ok=True)
    for n in names: read(n).save(ROOT/'preview'/f'{n}.png')
    preview(names,'preview/diagnostic.png')

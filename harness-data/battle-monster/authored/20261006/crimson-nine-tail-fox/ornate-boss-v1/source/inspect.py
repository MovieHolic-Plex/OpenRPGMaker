from pathlib import Path
from PIL import Image,ImageDraw
import json
ROOT=Path(__file__).parent
pal=json.loads((ROOT/'palette.json').read_text())
files=list((ROOT/'poses').glob('*.pxgrid'))+list((ROOT/'actions').glob('*.pxgrid'))
sheet=Image.new('RGB',(384*3,414*((len(files)+2)//3)), '#34333d')
draw=ImageDraw.Draw(sheet)
for i,p in enumerate(files):
    rows=p.read_text().splitlines()
    if len(rows)!=96 or any(len(r)!=96 for r in rows): raise ValueError((p.name,[len(r) for r in rows],len(rows)))
    points=[(x,y) for y,r in enumerate(rows) for x,c in enumerate(r) if c!='.']
    box=(min(x for x,y in points),min(y for x,y in points),max(x for x,y in points),max(y for x,y in points))
    print(p.stem,box)
    im=Image.new('RGBA',(96,96));im.putdata([(0,0,0,0) if c=='.' else tuple(bytes.fromhex(pal[c][1:]))+(255,) for row in rows for c in row])
    im.save(ROOT/'progress'/(p.stem+'.png'))
    im=im.resize((384,384),Image.Resampling.NEAREST)
    x=(i%3)*384;y=(i//3)*414
    sheet.paste(im,(x,y),im);draw.text((x+8,y+390),p.stem,fill='white')
sheet.save(ROOT/'progress/sheet.png')

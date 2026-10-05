from pathlib import Path
from PIL import Image,ImageDraw
import json
root=Path(__file__).parent
palette=json.loads((root/'palette.json').read_text())
files=list((root/'poses').glob('*.pxgrid'))+list((root/'actions').glob('*.pxgrid'))
order=['idle_a','idle_b','idle_c','windup','move','attack','recover','hit','dead','skill_a','skill_b','skill_c','poison_a','poison_b','stun_a','stun_b','sleep_a','sleep_b']
files.sort(key=lambda p:order.index(p.stem))
sheet=Image.new('RGB',(768,((len(files)+2)//3)*298),'#deded5'); d=ImageDraw.Draw(sheet)
for j,path in enumerate(files):
    rows=path.read_text().splitlines()
    assert len(rows)==64 and all(len(r)==64 for r in rows),path
    im=Image.new('RGBA',(64,64))
    ink=[]
    for y,row in enumerate(rows):
        for x,c in enumerate(row):
            if c!='.':
                assert c in palette,(path,c)
                assert 1<=x<=62 and 1<=y<=60,(path,x,y)
                h=palette[c][1:]; im.putpixel((x,y),tuple(int(h[k:k+2],16) for k in (0,2,4))+(255,));ink.append((x,y))
    if path.stem=='idle_a':assert max(y for x,y in ink)==60
    im.save(root/'progress'/f'{path.stem}.png')
    x=(j%3)*256; y=(j//3)*298
    for cy in range(8):
        for cx in range(8):
            d.rectangle((x+cx*32,y+30+cy*32,x+cx*32+31,y+30+cy*32+31),fill='#929a9a' if (cx+cy)%2 else '#b9bfba')
    d.text((x+8,y+6),path.stem,fill='#20252d')
    sheet.paste(im.resize((256,256),Image.Resampling.NEAREST),(x,y+30),im.resize((256,256),Image.Resampling.NEAREST))
    sheet.paste(im,(x+180,y),im)
sheet.save(root/'progress/contact-sheet.png')
print(f'{len(files)} literal grids decoded; dimensions, palette and margins inspected.')

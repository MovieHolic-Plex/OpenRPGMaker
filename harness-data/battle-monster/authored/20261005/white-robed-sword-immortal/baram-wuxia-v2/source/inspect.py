from pathlib import Path
import json
from PIL import Image,ImageDraw
ROOT=Path(__file__).resolve().parent
pal=json.loads((ROOT/'palette.json').read_text())
def render(path):
    rows=path.read_text().splitlines()
    assert len(rows)==64 and all(len(r)==64 for r in rows),path
    im=Image.new('RGBA',(64,64))
    for y,row in enumerate(rows):
        for x,c in enumerate(row):
            if c!='.':
                assert c in pal,(path,c)
                assert 1<=x<=62 and 1<=y<=60,(path,x,y)
                im.putpixel((x,y),tuple(bytes.fromhex(pal[c][1:]))+(255,))
    return im
names=['idle_a','idle_b','idle_c','windup','move','attack','recover','hit','dead','skill_a','skill_b','skill_c','poison_a','poison_b','stun_a','stun_b','sleep_a','sleep_b']
files=[ROOT/('poses' if i<9 else 'actions')/(n+'.pxgrid') for i,n in enumerate(names)]
files=[p for p in files if p.exists()]
sheet=Image.new('RGB',(720,((len(files)+2)//3)*280),(55,59,64));d=ImageDraw.Draw(sheet)
for i,path in enumerate(files):
    im=render(path); im.save(ROOT/'progress'/(path.stem+'.png'))
    x=(i%3)*240;y=(i//3)*280
    d.text((x+8,y+6),path.stem,fill=(240,234,220))
    for by in range(8):
        for bx in range(8):
            c=(100,105,107) if (bx+by)%2 else (116,120,119)
            d.rectangle((x+12+bx*24,y+76+by*24,x+35+bx*24,y+99+by*24),fill=c)
    sheet.paste(im,(x+12,y+22),im)
    large=im.resize((192,192),Image.Resampling.NEAREST)
    sheet.paste(large,(x+12,y+76),large)
sheet.save(ROOT/'progress/contact.png')
im=render(ROOT/'poses/idle_a.pxgrid');im.save(ROOT/'progress/idle.png')
im.resize((512,512),Image.Resampling.NEAREST).save(ROOT/'progress/idle-8x.png')
im.crop((18,8,43,30)).resize((200,176),Image.Resampling.NEAREST).save(ROOT/'progress/face.png')
print('Decoded',len(files),'literal grids; palette',len(pal),'colors.')

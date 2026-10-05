from pathlib import Path
import json
from PIL import Image, ImageDraw
ROOT=Path(__file__).parent
PALETTE={'O':'#11141D','N':'#1C2330','D':'#273746','B':'#344E60','M':'#4B6979','L':'#78949E','s':'#A66C50','a':'#D39B71','t':'#EEC29A','r':'#6A4739','W':'#E1E5D8','w':'#9FACAD','v':'#617989','I':'#C7E4E7','p':'#453953','P':'#9A83B8','g':'#596C46','G':'#ADBE75'}
def write(name, spec, folder='poses'):
    rows=['.'*64 for _ in range(64)]
    for line in spec.strip().splitlines():
        y,x,pixels=line.split();y=int(y);x=int(x)
        assert set(pixels)<=set(PALETTE)|{'.'},(name,y)
        assert 0<=x and x+len(pixels)<=64,(name,y,x,len(pixels))
        rows[y]=rows[y][:x]+pixels+rows[y][x+len(pixels):]
    out=ROOT/folder;out.mkdir(exist_ok=True)
    (out/(name+'.pxgrid')).write_text('\n'.join(rows)+'\n')
def render():
    paths=list((ROOT/'poses').glob('*.pxgrid'))+list((ROOT/'actions').glob('*.pxgrid'))
    out=ROOT/'progress';out.mkdir(exist_ok=True)
    previews=[]
    for path in paths:
        rows=path.read_text().splitlines()
        assert len(rows)==64 and all(len(r)==64 for r in rows),path
        im=Image.new('RGBA',(64,64))
        for y,row in enumerate(rows):
            for x,c in enumerate(row):
                if c!='.':
                    assert 1<=x<=62 and 1<=y<=60,(path,x,y)
                    im.putpixel((x,y),tuple(bytes.fromhex(PALETTE[c][1:]))+(255,))
        im.save(out/(path.stem+'.png'))
        previews.append((path.stem,im))
    if (out/'idle_a.png').exists():
        im=Image.open(out/'idle_a.png');im.save(out/'idle.png')
        im.resize((512,512),Image.Resampling.NEAREST).save(out/'idle-8x.png')
        im.crop((22,8,47,32)).resize((200,192),Image.Resampling.NEAREST).save(out/'face.png')
    order=['idle_a','idle_b','idle_c','windup','move','attack','recover','hit','dead','skill_a','skill_b','skill_c','poison_a','poison_b','stun_a','stun_b','sleep_a','sleep_b']
    previews.sort(key=lambda p:order.index(p[0]))
    sheet=Image.new('RGB',(768,((len(previews)+2)//3)*236),(102,105,110));draw=ImageDraw.Draw(sheet)
    for i,(name,im) in enumerate(previews):
        x=(i%3)*256;y=(i//3)*236
        draw.text((x+8,y+4),name,fill=(239,237,222))
        for yy in range(8):
            for xx in range(8):
                shade=132 if (xx+yy)%2 else 151
                draw.rectangle((x+xx*24,y+30+yy*24,x+xx*24+23,y+53+yy*24),fill=(shade,shade,shade))
        sheet.paste(im.resize((192,192),Image.Resampling.NEAREST),(x,y+30),im.resize((192,192),Image.Resampling.NEAREST))
        sheet.paste(im,(x+192,y+30),im)
    sheet.save(out/'suite.png')
(ROOT/'palette.json').write_text(json.dumps(PALETTE,indent=2)+'\n')

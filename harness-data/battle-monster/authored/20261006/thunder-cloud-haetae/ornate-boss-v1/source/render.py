"""Decode the delivered literal source. Nearest enlargement is diagnostic only."""
from pathlib import Path
from PIL import Image,ImageDraw
import json
ROOT=Path(__file__).parent
PAL=json.loads((ROOT/'palette.json').read_text())
RGB={k:tuple(bytes.fromhex(v[1:]))+(255,) for k,v in PAL.items()}
POSES=['idle_a','idle_b','idle_c','windup','move','attack','recover','hit','dead']
ACTIONS=['skill_a','skill_b','skill_c','poison_a','poison_b','stun_a','stun_b','sleep_a','sleep_b']
IMAGES={}
REPORT={}
for name in POSES+ACTIONS:
    path=ROOT/('poses' if name in POSES else 'actions')/(name+'.pxgrid')
    rows=path.read_text().splitlines()
    assert len(rows)==96 and all(len(r)==96 for r in rows),name
    assert set(''.join(rows))<=set(PAL)|{'.'},name
    points=[(x,y) for y,row in enumerate(rows) for x,p in enumerate(row) if p!='.']
    box=[min(x for x,y in points),min(y for x,y in points),max(x for x,y in points),max(y for x,y in points)]
    assert box[0]>=1 and box[1]>=1 and box[2]<=94 and box[3]<=92,(name,box)
    if name=='idle_a': assert any(rows[92][x]!='.' for x in range(11,26))
    im=Image.new('RGBA',(96,96))
    im.putdata([RGB.get(p,(0,0,0,0)) for row in rows for p in row])
    im.save(ROOT/'progress'/f'{name}.png')
    im.resize((384,384),Image.Resampling.NEAREST).save(ROOT/'progress'/f'{name}-4x.png')
    IMAGES[name]=im
    REPORT[name]={'bbox':box,'inkPixels':len(points),'colors':len(set(''.join(rows))-{'.'})}
for title,names in [('poses',POSES),('actions',ACTIONS)]:
    sheet=Image.new('RGB',(288,330),'#9DA7AC')
    d=ImageDraw.Draw(sheet)
    for i,name in enumerate(names):
        x=(i%3)*96;y=(i//3)*110
        sheet.paste(IMAGES[name],(x,y),IMAGES[name])
        d.text((x+3,y+97),name,fill='#15232C')
    sheet.save(ROOT/'progress'/f'{title}-sheet-native.png')
    sheet.resize((864,990),Image.Resampling.NEAREST).save(ROOT/'progress'/f'{title}-sheet-3x.png')
TIMES={
 'idle':(['idle_a','idle_b','idle_c','idle_b'],[260,260,260,260]),
 'attack':(['idle_a','windup','move','attack','recover','idle_a'],[360,240,140,120,220,340]),
 'hit':(['idle_a','hit','recover','idle_a'],[450,240,220,450]),
 'dead':(['idle_a','hit','dead'],[500,180,1400]),
 'skill':(['idle_a','skill_a','skill_b','skill_c','idle_a'],[350,320,160,300,450]),
 'poison':(['poison_a','poison_b'],[400,400]),
 'stun':(['stun_a','stun_b'],[360,360]),
 'sleep':(['sleep_a','sleep_b'],[600,600]),
}
for group,(names,holds) in TIMES.items():
    ims=[]
    for name in names:
        im=Image.new('RGB',(96,96),'#9DA7AC')
        im.paste(IMAGES[name],(0,0),IMAGES[name])
        ims.append(im.resize((768,768),Image.Resampling.NEAREST))
    ims[0].save(ROOT/'progress'/f'{group}-native8.gif',save_all=True,append_images=ims[1:],duration=holds,loop=0,disposal=2,optimize=False)
(ROOT/'progress'/'dimensions.json').write_text(json.dumps(REPORT,indent=2)+'\n')
print(f'Decoded {len(IMAGES)} distinct native grids; palette {len(PAL)} entries; transparent margins and y<=92 confirmed.')

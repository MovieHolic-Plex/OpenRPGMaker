"""Read literal 128x128 sources and bake exact palette pixels; diagnostics only."""
from pathlib import Path
from PIL import Image,ImageDraw
import json
ROOT=Path(__file__).resolve().parent
P=json.loads((ROOT/'palette.json').read_text())
COLORS={s:tuple(bytes.fromhex(rgb[1:]))+(255,) for s,rgb in P.items()}
COLORS['.']=(0,0,0,0)
NAMES=['idle_a','idle_b','idle_c','windup','move','attack','recover','hit','dead','skill_a','skill_b','skill_c','poison_a','poison_b','stun_a','stun_b','sleep_a','sleep_b']
OUT=ROOT/'preview'; OUT.mkdir(exist_ok=True)
frames={}
for n in NAMES:
    path=ROOT/('poses' if n in NAMES[:9] else 'actions')/(n+'.pxgrid')
    if not path.exists(): continue
    rows=path.read_text().splitlines()
    if len(rows)!=128 or any(len(row)!=128 for row in rows): raise ValueError((n,'dimensions'))
    im=Image.new('RGBA',(128,128)); im.putdata([COLORS[s] for row in rows for s in row]); im.save(OUT/(n+'.png'));frames[n]=im
    pixels=[(x,y) for y,row in enumerate(rows) for x,s in enumerate(row) if s!='.']
    bounds=(min(x for x,y in pixels),min(y for x,y in pixels),max(x for x,y in pixels),max(y for x,y in pixels))
    print(n,bounds)
    if bounds[0]<1 or bounds[1]<1 or bounds[2]>126 or bounds[3]>124: raise ValueError((n,'border'))
    if n=='idle_a' and bounds[3]!=124: raise ValueError('idle_a ground')
# Same exact pixels on three backgrounds, with native and nearest-neighbor views.
for n,im in frames.items():
    plate=Image.new('RGB',(1152,430),'#dedacb'); d=ImageDraw.Draw(plate)
    for j,bg in enumerate(('#f2eedf','#132033','checker')):
        back=Image.new('RGBA',(128,128),bg if bg!='checker' else '#797d88')
        if bg=='checker':
            bd=ImageDraw.Draw(back)
            for y in range(0,128,8):
                for x in range(0,128,8):
                    if (x//8+y//8)%2: bd.rectangle((x,y,x+7,y+7),fill='#aeb4be')
        back.alpha_composite(im)
        plate.paste(back.convert('RGB').resize((384,384),Image.Resampling.NEAREST),(j*384,30))
        d.text((j*384+6,6),n+' / '+bg,fill='#172432')
    plate.save(OUT/(n+'-inspection.png'))
# Native overview and annotated enlarged sheet (not sprite assets).
for scale in (1,3):
    sheet=Image.new('RGB',(3*128*scale,6*(128*scale+20)),'#24354c');d=ImageDraw.Draw(sheet)
    for idx,n in enumerate(NAMES):
        if n not in frames: continue
        x=(idx%3)*128*scale;y=(idx//3)*(128*scale+20)
        d.text((x+4,y+3),n,fill='#e9eee7')
        sheet.paste(frames[n].resize((128*scale,128*scale),Image.Resampling.NEAREST),(x,y+20),frames[n].resize((128*scale,128*scale),Image.Resampling.NEAREST))
    sheet.save(OUT/('overview-'+str(scale)+'x.png'))
# Full final source at native 1x on all three requested backgrounds.
for bgname,bg in [('light','#f2eedf'),('dark','#132033'),('checker','#797d88')]:
    native=Image.new('RGB',(384,888),bg);label=ImageDraw.Draw(native)
    for idx,n in enumerate(NAMES):
        if n not in frames:continue
        x=(idx%3)*128;y=(idx//3)*148
        back=Image.new('RGBA',(128,128),bg)
        if bgname=='checker':
            bd=ImageDraw.Draw(back)
            for cy in range(0,128,8):
                for cx in range(0,128,8):
                    if (cx//8+cy//8)%2:bd.rectangle((cx,cy,cx+7,cy+7),fill='#aeb4be')
        back.alpha_composite(frames[n]);native.paste(back.convert('RGB'),(x,y+20))
        label.text((x+3,y+3),n,fill='#172432' if bgname!='dark' else '#e9eee7')
    native.save(OUT/('native-'+bgname+'.png'))

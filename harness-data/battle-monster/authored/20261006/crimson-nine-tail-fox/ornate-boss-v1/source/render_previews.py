from pathlib import Path
import json
from PIL import Image,ImageDraw
ROOT=Path(__file__).parent
pal=json.loads((ROOT/'palette.json').read_text())
symbols=['.']+list(pal)
lookup={c:i for i,c in enumerate(symbols)}
rgb=[0,0,0]+[v for color in pal.values() for v in bytes.fromhex(color[1:])]
rgb+= [0]*(768-len(rgb))
def get(name):
    f=ROOT/'poses'/(name+'.pxgrid')
    if not f.exists(): f=ROOT/'actions'/(name+'.pxgrid')
    rows=f.read_text().splitlines()
    im=Image.new('P',(96,96));im.putpalette(rgb)
    im.putdata([lookup[c] for r in rows for c in r])
    im.info['transparency']=0
    return im
clips={
'idle':(['idle_a','idle_b','idle_c','idle_b'],[230,230,230,230]),
'attack':(['idle_a','windup','move','attack','recover','idle_a'],[230,200,100,150,180,230]),
'hit':(['idle_a','hit','recover','idle_a'],[350,180,230,350]),
'dead':(['idle_a','hit','dead'],[350,180,1600]),
'skill':(['idle_a','skill_a','skill_b','skill_c','recover','idle_a'],[230,280,180,240,180,230]),
'poison':(['poison_a','poison_b'],[400,400]),
'stun':(['stun_a','stun_b'],[330,330]),
'sleep':(['sleep_a','sleep_b'],[550,550])}
for name,(frames,holds) in clips.items():
    ims=[get(f) for f in frames]
    ims[0].save(ROOT/'progress'/(name+'.gif'),save_all=True,append_images=ims[1:],duration=holds,loop=0,transparency=0,disposal=2,optimize=False)
    bigger=[im.resize((384,384),Image.Resampling.NEAREST) for im in ims]
    bigger[0].save(ROOT/'progress'/(name+'-4x.gif'),save_all=True,append_images=bigger[1:],duration=holds,loop=0,transparency=0,disposal=2,optimize=False)
order=['idle_a','idle_b','idle_c','windup','move','attack','recover','hit','dead','skill_a','skill_b','skill_c','poison_a','poison_b','stun_a','stun_b','sleep_a','sleep_b']
sheet=Image.new('RGB',(1152,2484),'#34333d');draw=ImageDraw.Draw(sheet)
for i,name in enumerate(order):
    im=get(name).convert('RGBA').resize((384,384),Image.Resampling.NEAREST)
    x=i%3*384;y=i//3*414
    sheet.paste(im,(x,y),im);draw.text((x+8,y+391),name,fill='white')
sheet.save(ROOT/'progress/contact-sheet.png')
for name in order:
    im=get(name).convert('RGBA')
    im.save(ROOT/'progress'/(name+'.png'))
    im.resize((384,384),Image.Resampling.NEAREST).save(ROOT/'progress'/(name+'-4x.png'))
print('18 native PNGs, 18 nearest 4x PNGs, eight native GIFs and eight 4x GIFs rendered from final literal grids.')

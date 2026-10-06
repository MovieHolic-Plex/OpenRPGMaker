"""Read literal native rows; render one pixel per symbol. Diagnostic enlargement
uses nearest-neighbor only. GIFs contain only the authored native frames.
This script performs no art construction or automatic repairs."""
from pathlib import Path
import json
from PIL import Image, ImageDraw
ROOT=Path(__file__).resolve().parent
pal=json.loads((ROOT/'palette.json').read_text())
colors={k:tuple(bytes.fromhex(v[1:]))+(255,) for k,v in pal.items()}
frames={}
for folder in ['poses','actions']:
 for p in sorted((ROOT/folder).glob('*.pxgrid')):
  rows=p.read_text().splitlines()
  assert len(rows)==96 and all(len(r)==96 for r in rows),p
  assert set(''.join(rows))<=set(pal)|{'.'},p
  img=Image.new('RGBA',(96,96))
  img.putdata([colors.get(c,(0,0,0,0)) for row in rows for c in row])
  box=img.getbbox()
  assert box and box[0]>=1 and box[1]>=1 and box[2]<=95 and box[3]<=93,(p,box)
  if p.stem=='idle_a': assert box[3]==93,box
  frames[p.stem]=img
  (ROOT/'png').mkdir(exist_ok=True)
  img.save(ROOT/'png'/(p.stem+'.png'))
order=['idle_a','idle_b','idle_c','windup','move','attack','recover','hit','dead','skill_a','skill_b','skill_c','poison_a','poison_b','stun_a','stun_b','sleep_a','sleep_b']
order=[n for n in order if n in frames]
for style in ['light','dark','checker']:
 sheet=Image.new('RGB',(6*304,((len(order)+5)//6)*320),(234,229,214) if style=='light' else (32,34,44))
 draw=ImageDraw.Draw(sheet)
 for i,name in enumerate(order):
  x=(i%6)*304+8;y=(i//6)*320+24
  if style=='checker':
   for yy in range(0,288,12):
    for xx in range(0,288,12):
     draw.rectangle((x+xx,y+yy,x+xx+11,y+yy+11),fill=(81,86,99) if (xx//12+yy//12)%2 else (116,120,128))
  big=frames[name].resize((288,288),Image.Resampling.NEAREST)
  sheet.paste(big,(x,y),big)
  draw.text((x,y-18),name,fill=(25,26,33) if style=='light' else (244,230,206))
 sheet.save(ROOT/('contact-'+style+'.png'))
native=Image.new('RGBA',(96*6,96*((len(order)+5)//6)))
for i,n in enumerate(order): native.paste(frames[n],((i%6)*96,(i//6)*96))
native.save(ROOT/'contact-native.png')
# Global palette preserves all source colors; transparent index 0.
gif_palette=[0,0,0]+[v for c in colors.values() for v in c[:3]]
gif_palette += [0]*(768-len(gif_palette))
index={k:i+1 for i,k in enumerate(pal)}
def gif_frame(name):
 p=ROOT/('poses' if (ROOT/'poses'/(name+'.pxgrid')).exists() else 'actions')/(name+'.pxgrid')
 out=Image.new('P',(96,96));out.putpalette(gif_palette)
 out.putdata([index.get(c,0) for c in ''.join(p.read_text().splitlines())])
 return out
motions={
 'idle':(['idle_a','idle_b','idle_c','idle_b'],[240,240,240,240]),
 'attack':(['idle_a','windup','move','attack','recover','idle_a'],[280,220,120,150,220,320]),
 'hit':(['idle_a','hit','recover','idle_a'],[320,280,220,340]),
 'dead':(['idle_a','hit','dead'],[300,180,1100]),
 'skill':(['idle_a','skill_a','skill_b','skill_c','idle_a'],[280,380,340,280,340]),
 'poison':(['poison_a','poison_b'],[480,480]),
 'stun':(['stun_a','stun_b'],[500,500]),
 'sleep':(['sleep_a','sleep_b'],[700,700])}
(ROOT/'gif').mkdir(exist_ok=True)
for name,(seq,holds) in motions.items():
 if all(n in frames for n in seq):
  imgs=[gif_frame(n) for n in seq]
  imgs[0].save(ROOT/'gif'/(name+'.gif'),save_all=True,append_images=imgs[1:],duration=holds,loop=0,transparency=0,disposal=2,optimize=False)
print('Rendered:',', '.join(order))
# Native 3x3 sheets preserve the requested RM2003 cell order.
for sheet_name,names in [('poses',['idle_a','idle_b','idle_c','windup','move','attack','recover','hit','dead']),('actions',['skill_a','skill_b','skill_c','poison_a','poison_b','stun_a','stun_b','sleep_a','sleep_b'])]:
 if all(n in frames for n in names):
  sheet=Image.new('RGBA',(288,288))
  for i,n in enumerate(names):sheet.paste(frames[n],((i%3)*96,(i//3)*96))
  sheet.save(ROOT/(sheet_name+'.png'))

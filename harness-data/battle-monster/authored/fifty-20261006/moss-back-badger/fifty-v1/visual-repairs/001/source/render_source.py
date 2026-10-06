"""Read literal grids, render exact pixels, diagnostics and timed GIFs.
Nearest-neighbor enlargement is diagnostic only, never used as source art.
"""
from pathlib import Path
from PIL import Image, ImageDraw
import json
ROOT=Path(__file__).resolve().parent
P=json.loads((ROOT/'palette.json').read_text())
RGB={k:tuple(bytes.fromhex(v[1:])) for k,v in P.items()}
FRAMES={}
for folder in ('poses','actions'):
 for path in sorted((ROOT/folder).glob('*.pxgrid')):
  rows=path.read_text().splitlines()
  assert len(rows)==64 and all(len(row)==64 for row in rows),path
  im=Image.new('RGBA',(64,64))
  for y,row in enumerate(rows):
   for x,p in enumerate(row):
    if p!='.': im.putpixel((x,y),RGB[p]+(255,))
  im.save(ROOT/'previews'/(path.stem+'.png'))
  FRAMES[path.stem]=im
names=list(FRAMES)
# Three backgrounds, actual 1x thumbnail and 4x nearest neighbor.
for bg,label in [((239,230,209),'light'),((27,31,36),'dark'),(None,'checker')]:
 sheet=Image.new('RGB',(6*276,((len(names)+5)//6)*346),(48,49,51))
 d=ImageDraw.Draw(sheet)
 for i,name in enumerate(names):
  tile=Image.new('RGB',(64,64),bg or (149,155,161))
  if bg is None:
   for y in range(64):
    for x in range(64):
     if (x//8+y//8)%2: tile.putpixel((x,y),(211,216,220))
  tile.paste(FRAMES[name],(0,0),FRAMES[name])
  x=(i%6)*276+10;y=(i//6)*346+20
  d.text((x,y-16),name,fill='white')
  sheet.paste(tile.resize((256,256),Image.Resampling.NEAREST),(x,y))
  sheet.paste(tile,(x,y+260))
 sheet.save(ROOT/'previews'/('contact-'+label+'.png'))
# Fixed exact palette; GIF index zero transparent. No adaptive quantization.
colors=[(0,0,0)]+list(RGB.values())
flat=[c for rgb in colors for c in rgb]+[0]*(768-3*len(colors))
lookup={rgb:i+1 for i,rgb in enumerate(RGB.values())}
def gif(name,seq,durations):
 if not all(n in FRAMES for n in seq):return
 frames=[]
 for n in seq:
  out=Image.new('P',(64,64),0);out.putpalette(flat)
  out.putdata([lookup[p[:3]] if p[3] else 0 for p in FRAMES[n].get_flattened_data()])
  frames.append(out)
 frames[0].save(ROOT/'previews'/(name+'.gif'),save_all=True,append_images=frames[1:],duration=durations,loop=0,transparency=0,disposal=2,optimize=False)
GIFS={
'idle':(['idle_a','idle_b','idle_c','idle_b'],[240]*4),
'attack':(['idle_a','windup','move','attack','recover','idle_a'],[240,220,90,140,180,240]),
'hit':(['idle_a','hit','recover','idle_a'],[280,220,180,280]),
'dead':(['idle_a','hit','dead'],[240,180,1100]),
'skill':(['skill_a','skill_b','skill_c','idle_a'],[360,240,240,360]),
'poison':(['poison_a','poison_b'],[400,400]),
'stun':(['stun_a','stun_b'],[360,360]),
'sleep':(['sleep_a','sleep_b'],[600,600])}
for name,(seq,ms) in GIFS.items():gif(name,seq,ms)
print('Rendered',len(FRAMES),'native PNGs; GIFs:', ', '.join(n for n,(s,_) in GIFS.items() if all(f in FRAMES for f in s)))

# Inspect the files actually encoded as GIF: decode every frame, compare
# its native RGBA to its named grid, and retain a contact strip.
from PIL import ImageSequence
strip=Image.new('RGB',(6*170,8*178),(39,43,47))
draw=ImageDraw.Draw(strip)
for row,(name,(seq,ms)) in enumerate(GIFS.items()):
 if not all(n in FRAMES for n in seq): continue
 with Image.open(ROOT/'previews'/(name+'.gif')) as encoded:
  decoded=[f.convert('RGBA').copy() for f in ImageSequence.Iterator(encoded)]
  assert len(decoded)==len(seq),(name,len(decoded),len(seq))
  for i,(im,n) in enumerate(zip(decoded,seq)):
   assert im.tobytes()==FRAMES[n].tobytes(),(name,i,'GIF differs from source')
   tile=Image.new('RGB',(64,64),(224,217,198))
   tile.paste(im,(0,0),im)
   x=i*170+6;y=row*178+28
   draw.text((x,y-24),name+' / '+n,fill='white')
   draw.text((x,y-12),str(ms[i])+' ms',fill='white')
   strip.paste(tile.resize((128,128),Image.Resampling.NEAREST),(x,y))
strip.save(ROOT/'previews'/'gif-decoded.png')
# Native packed sheets are presentation artifacts only.
for folder,order in [('poses',['idle_a','idle_b','idle_c','windup','move','attack','recover','hit','dead']),('actions',['skill_a','skill_b','skill_c','poison_a','poison_b','stun_a','stun_b','sleep_a','sleep_b'])]:
 if not all(n in FRAMES for n in order): continue
 sheet=Image.new('RGBA',(192,192))
 for i,n in enumerate(order):sheet.paste(FRAMES[n],((i%3)*64,(i//3)*64))
 sheet.save(ROOT/'previews'/(folder+'-native.png'))
print('GIF decode matches all named native frames.')

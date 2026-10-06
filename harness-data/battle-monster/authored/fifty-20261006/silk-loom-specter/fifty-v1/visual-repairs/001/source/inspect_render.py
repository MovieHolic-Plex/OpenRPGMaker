"""Read generated images and GIFs for visual diagnosis. No source mutations."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageSequence
from collections import deque
import json, hashlib
ROOT=Path(__file__).resolve().parent
from render import frames, order, motions
report={'source_frames':{},'gifs':{},'enclosed_transparency':{}}
for n in order:
 im=frames[n]
 p=ROOT/('poses' if (ROOT/'poses'/(n+'.pxgrid')).exists() else 'actions')/(n+'.pxgrid')
 report['source_frames'][n]={'bounds_exclusive':im.getbbox(),'grid_sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'png_sha256':hashlib.sha256((ROOT/'png'/(n+'.png')).read_bytes()).hexdigest()}
 # Identify interior alpha components; never change those pixels.
 alpha=im.getchannel('A');visited=set();holes=[]
 for y in range(96):
  for x in range(96):
   if alpha.getpixel((x,y)) or (x,y) in visited:continue
   q=deque([(x,y)]);visited.add((x,y));pts=[];edge=False
   while q:
    xx,yy=q.popleft();pts.append((xx,yy))
    if xx in (0,95) or yy in (0,95):edge=True
    for nx,ny in [(xx-1,yy),(xx+1,yy),(xx,yy-1),(xx,yy+1)]:
     if 0<=nx<96 and 0<=ny<96 and not alpha.getpixel((nx,ny)) and (nx,ny) not in visited:
      visited.add((nx,ny));q.append((nx,ny))
   if not edge: holes.append(pts)
 report['enclosed_transparency'][n]=holes
for n,(seq,holds) in motions.items():
 gif=Image.open(ROOT/'gif'/(n+'.gif'));decoded=[];actual_holds=[]
 for i,fr in enumerate(ImageSequence.Iterator(gif)):
  got=fr.convert('RGBA');expected=frames[seq[i]]
  assert got.tobytes()==expected.tobytes(),(n,i,'RGBA differs')
  actual_holds.append(fr.info['duration']);decoded.append(got.copy())
 assert len(decoded)==len(seq) and actual_holds==holds,(n,actual_holds)
 report['gifs'][n]={'frames':seq,'holds_ms':actual_holds,'decoded_rgba_matches_source':True,'sha256':hashlib.sha256((ROOT/'gif'/(n+'.gif')).read_bytes()).hexdigest()}
 strip=Image.new('RGB',(len(decoded)*296,320),(233,227,211));d=ImageDraw.Draw(strip)
 for i,fr in enumerate(decoded):
  d.text((i*296+4,4),seq[i]+' '+str(holds[i])+'ms',fill=(25,26,33))
  big=fr.resize((288,288),Image.Resampling.NEAREST);strip.paste(big,(i*296+4,24),big)
 (ROOT/'gif-frames').mkdir(exist_ok=True)
 strip.save(ROOT/'gif-frames'/(n+'.png'))
 # Each authored native frame also gets a 1x comparison strip.
 strip1=Image.new('RGB',(len(decoded)*96,96),(233,227,211))
 for i,fr in enumerate(decoded):strip1.paste(fr,(i*96,0),fr)
 strip1.save(ROOT/'gif-frames'/(n+'-native.png'))
# A light native sheet and two face/connection diagnostic sheets.
ns=Image.new('RGB',(576,288),(233,227,211))
for i,n in enumerate(order):ns.paste(frames[n],((i%6)*96,(i//6)*96),frames[n])
ns.save(ROOT/'contact-native-light.png')
for group,names in [('status',['poison_a','poison_b','stun_a','stun_b','sleep_a','sleep_b']),('motion',['windup','move','attack','hit','dead','skill_b'])]:
 sheet=Image.new('RGB',(6*392,408),(233,227,211));d=ImageDraw.Draw(sheet)
 for i,n in enumerate(names):
  d.text((i*392+4,4),n,fill=(25,26,33));big=frames[n].resize((384,384),Image.Resampling.NEAREST);sheet.paste(big,(i*392+4,24),big)
 sheet.save(ROOT/('detail-'+group+'.png'))
(ROOT/'render-info.json').write_text(json.dumps(report,indent=2)+'\n')
print('GIFs read back: 8; decoded native frames:',sum(len(seq) for seq,holds in motions.values()))
for n,holes in report['enclosed_transparency'].items():
 if holes:print(n,'enclosed transparent regions:',holes)
print('All 18 native frames differ:',len(set(x['grid_sha256'] for x in report['source_frames'].values()))==18)

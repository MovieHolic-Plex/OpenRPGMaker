"""Source/PNG/GIF readback diagnostics; no repository test runner or visual verdict."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageSequence
import json, hashlib
ROOT=Path(__file__).resolve().parent
pal=json.loads((ROOT/'palette.json').read_text())
summary={'palette_colors':len(pal),'cell':128,'frames':{},'gifs':{}}
paths=sorted([*(ROOT/'poses').glob('*.pxgrid'),*(ROOT/'actions').glob('*.pxgrid')])
for p in paths:
 rows=p.read_text().splitlines()
 pts=[(x,y) for y,r in enumerate(rows) for x,c in enumerate(r) if c!='.']
 im=Image.open(ROOT/'png'/(p.stem+'.png')).convert('RGBA')
 summary['frames'][p.stem]={'rows':len(rows),'row_widths':sorted(set(map(len,rows))),'bounds':[min(x for x,y in pts),min(y for x,y in pts),max(x for x,y in pts),max(y for x,y in pts)],'ground_ink_y124':sum(c!='.' for c in rows[124]),'alpha':sorted(set(im.getchannel('A').getdata())),'source_sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'png_sha256':hashlib.sha256((ROOT/'png'/(p.stem+'.png')).read_bytes()).hexdigest()}
sequences={'idle':['idle_a','idle_b','idle_c','idle_b'],'attack':['idle_a','windup','move','attack','recover','idle_a'],'hit':['idle_a','hit','recover'],'dead':['hit','dead'],'skill':['skill_a','skill_b','skill_c','recover'],'poison':['poison_a','poison_b'],'stun':['stun_a','stun_b'],'sleep':['sleep_a','sleep_b']}
# Re-open the saved GIF bytes and retain actual decoded frames, with authored holds.
allstrips=[]
for name,seq in sequences.items():
 gif=Image.open(ROOT/'gif'/(name+'.gif'))
 ims=[];durations=[];same=[]
 for i,decoded in enumerate(ImageSequence.Iterator(gif)):
  im=decoded.convert('RGBA');ims.append(im.copy());durations.append(decoded.info.get('duration'))
  original=Image.open(ROOT/'png'/(seq[i]+'.png')).convert('RGBA')
  # Fully transparent RGB is not a displayed color; compare alpha and opaque RGB exactly.
  same.append(all(a[3]==b[3] and (a[3]==0 or a[:3]==b[:3]) for a,b in zip(im.getdata(),original.getdata())))
 strip=Image.new('RGB',(128*len(ims),152),'#ece3d0')
 for i,im in enumerate(ims):
  strip.paste(im,(128*i,0),im)
  ImageDraw.Draw(strip).text((128*i+3,130),f'{seq[i]} {durations[i]}ms',fill='#242534')
 strip.save(ROOT/'png'/('gif-'+name+'-readback-1x.png'))
 summary['gifs'][name]={'frame_count':len(ims),'sequence':seq,'duration_ms':durations,'matches_native_png':same,'sha256':hashlib.sha256((ROOT/'gif'/(name+'.gif')).read_bytes()).hexdigest()}
 allstrips.append((name,strip))
film=Image.new('RGB',(768,8*174),'#ece3d0')
for i,(name,strip) in enumerate(allstrips):
 ImageDraw.Draw(film).text((3,i*174),name,fill='#242534');film.paste(strip,(0,i*174+20))
film.save(ROOT/'png'/'gif-readback-all-1x.png')
(ROOT/'READBACK.json').write_text(json.dumps(summary,indent=2)+'\n')
print('18 source bounds:',{n:v['bounds'] for n,v in summary['frames'].items()})
print('8 GIF decoded frame matches:',{n:all(v['matches_native_png']) for n,v in summary['gifs'].items()})
print('Distinct source frames:',len(set(v['source_sha256'] for v in summary['frames'].values())))

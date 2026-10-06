"""Decode literal pxgrid into native PNG/GIF; nearest-neighbour only for diagnostics."""
from pathlib import Path
import json
from PIL import Image, ImageDraw
ROOT=Path(__file__).resolve().parent
OUT=ROOT/'preview'; OUT.mkdir(exist_ok=True)
pal=json.loads((ROOT/'palette.json').read_text())
colors={k:tuple(bytes.fromhex(v[1:]))+(255,) for k,v in pal.items()}
frames={}
for p in sorted(list((ROOT/'poses').glob('*.pxgrid'))+list((ROOT/'actions').glob('*.pxgrid'))):
 rows=p.read_text().splitlines()
 assert len(rows)==64 and all(len(r)==64 for r in rows), p
 im=Image.new('RGBA',(64,64)); im.putdata([colors.get(ch,(0,0,0,0)) for r in rows for ch in r])
 im.save(OUT/(p.stem+'.png')); frames[p.stem]=im
order=['idle_a','idle_b','idle_c','windup','move','attack','recover','hit','dead','skill_a','skill_b','skill_c','poison_a','poison_b','stun_a','stun_b','sleep_a','sleep_b']
for bgname,bg in [('light',(230,225,209)),('dark',(35,42,54)),('checker',None)]:
 sheet=Image.new('RGB',(6*272,3*296),(63,68,77)); draw=ImageDraw.Draw(sheet)
 for idx,name in enumerate(order):
  if name not in frames: continue
  tile=Image.new('RGBA',(64,64),bg if bg else (157,161,166))
  if bg is None:
   d=ImageDraw.Draw(tile)
   for y in range(0,64,8):
    for x in range(0,64,8):
     if (x//8+y//8)%2: d.rectangle((x,y,x+7,y+7),fill=(205,206,204))
  tile.alpha_composite(frames[name]); x=(idx%6)*272; y=(idx//6)*296
  sheet.paste(tile.convert('RGB').resize((256,256),Image.Resampling.NEAREST),(x,y+20))
  sheet.paste(tile.convert('RGB'),(x+198,y+230)); draw.text((x+4,y+3),name,fill='white')
 sheet.save(OUT/('sheet-'+bgname+'.png'))
# Native scale sheet, three backgrounds with identical authored pixels.
native=Image.new('RGB',(6*72,3*90),(230,225,209)); d=ImageDraw.Draw(native)
for idx,name in enumerate(order):
 if name not in frames: continue
 native.paste(frames[name],((idx%6)*72,(idx//6)*90+17),frames[name]); d.text(((idx%6)*72,(idx//6)*90+3),name,fill=(15,25,35))
native.save(OUT/'native.png')
MOTIONS={
 'idle':(['idle_a','idle_b','idle_c','idle_b'],[240,240,240,240]),
 'attack':(['idle_a','windup','move','attack','recover','idle_a'],[240,240,120,180,180,280]),
 'hit':(['idle_a','hit','hit','recover','idle_a'],[240,160,200,200,280]),
 'dead':(['idle_a','hit','dead'],[240,180,1000]),
 'skill':(['idle_a','skill_a','skill_b','skill_c','idle_a'],[240,420,360,320,260]),
 'poison':(['poison_a','poison_b'],[500,500]),
 'stun':(['stun_a','stun_b'],[500,500]),
 'sleep':(['sleep_a','sleep_b'],[720,720])}
# Fixed palette preserves every source colour. Index 0 is transparent.
gif_palette=[0,0,0]+[v for rgb in colors.values() for v in rgb[:3]]
gif_palette += [0]*(768-len(gif_palette))
index={k:i+1 for i,k in enumerate(pal)}
for motion,(names,durations) in MOTIONS.items():
 if not all(n in frames for n in names): continue
 images=[]
 for name in names:
  p=(ROOT/('poses' if name in order[:9] else 'actions')/(name+'.pxgrid'))
  im=Image.new('P',(64,64)); im.putpalette(gif_palette)
  im.putdata([index.get(ch,0) for row in p.read_text().splitlines() for ch in row]); images.append(im)
 images[0].save(OUT/(motion+'.gif'),save_all=True,append_images=images[1:],duration=durations,loop=0,transparency=0,disposal=2,optimize=False)
 # Reopen animation for diagnostic strip, preserving decoded frame order.
 gif=Image.open(OUT/(motion+'.gif')); strip=Image.new('RGB',(gif.n_frames*192,220),(230,225,209)); sd=ImageDraw.Draw(strip)
 for n in range(gif.n_frames):
  gif.seek(n); rgba=gif.convert('RGBA'); tile=Image.new('RGBA',(64,64),(230,225,209)); tile.alpha_composite(rgba)
  strip.paste(tile.convert('RGB').resize((192,192),Image.Resampling.NEAREST),(n*192,20)); sd.text((n*192+4,3),f'{motion} {n} {gif.info.get("duration")} ms',fill=(20,30,40))
 strip.save(OUT/(motion+'-decoded.png'))
print(f'{len(frames)} native frames; {sum(all(n in frames for n in m[0]) for m in MOTIONS.values())} GIF motions')
# Native packed sheets are a decode of literal cells, not new poses.
for sheetname,names in [('poses-sheet',order[:9]),('actions-sheet',order[9:])]:
 packed=Image.new('RGBA',(192,192))
 for i,name in enumerate(names):
  if name in frames: packed.paste(frames[name],((i%3)*64,(i//3)*64))
 packed.save(OUT/(sheetname+'.png'))
for name in frames:
 diagnostic=Image.new('RGBA',(64,64),(230,225,209)); diagnostic.alpha_composite(frames[name])
 diagnostic.resize((512,512),Image.Resampling.NEAREST).save(OUT/(name+'-8x.png'))
for group,names in enumerate([['idle','attack','hit','dead'],['skill','poison','stun','sleep']]):
 if not all((OUT/(n+'-decoded.png')).exists() for n in names): continue
 strips=[Image.open(OUT/(n+'-decoded.png')) for n in names]
 contact=Image.new('RGB',(max(s.width for s in strips),len(strips)*224),(55,62,72))
 for i,strip in enumerate(strips): contact.paste(strip,(0,i*224))
 contact.save(OUT/(f'motions-{group+1}.png'))
# Actual bytes only: hashes and dimensions describe artifacts without a review verdict.
import hashlib
report={'paletteColors':len(pal),'frames':{},'motions':{}}
for name,im in frames.items():
 p=ROOT/('poses' if name in order[:9] else 'actions')/(name+'.pxgrid')
 rows=p.read_text().splitlines()
 ink=[(x,y) for y,row in enumerate(rows) for x,ch in enumerate(row) if ch!='.']
 report['frames'][name]={'gridSha256':hashlib.sha256(p.read_bytes()).hexdigest(),
  'pngSha256':hashlib.sha256((OUT/(name+'.png')).read_bytes()).hexdigest(),
  'size':[64,64],'inkBounds':[min(x for x,y in ink),min(y for x,y in ink),max(x for x,y in ink),max(y for x,y in ink)]}
for name,(names,durations) in MOTIONS.items():
 p=OUT/(name+'.gif')
 if not p.exists():continue
 gif=Image.open(p); actual=[]; originals=[]
 for logical,hold in zip(names,durations):
  if originals and originals[-1][0]==logical: originals[-1][1]+=hold
  else: originals.append([logical,hold])
 for i,(logical,hold) in enumerate(originals):
  gif.seek(i); rgba=gif.convert('RGBA')
  # Compare transparent pixels by alpha and opaque pixels by complete RGBA.
  equal=all((a[3]==b[3] and (a[3]==0 or a==b)) for a,b in zip(rgba.getdata(),frames[logical].getdata()))
  actual.append({'frame':i,'source':logical,'durationMs':gif.info.get('duration'),'sourcePixelsEqual':equal})
 report['motions'][name]={'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'size':[64,64],'decoded':actual}
(OUT/'artifact-info.json').write_text(json.dumps(report,indent=2)+'\n')

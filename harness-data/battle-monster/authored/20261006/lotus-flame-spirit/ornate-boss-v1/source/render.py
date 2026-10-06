"""Decode literal source and make inspection PNGs / eight animation groups."""
from pathlib import Path
from PIL import Image, ImageDraw
import json, hashlib
root=Path(__file__).resolve().parent
out=root/'progress';out.mkdir(exist_ok=True)
pal=json.loads((root/'palette.json').read_text())
colors={k:tuple(bytes.fromhex(v[1:]))+(255,) for k,v in pal.items()}
poses=['idle_a','idle_b','idle_c','windup','move','attack','recover','hit','dead']
actions=['skill_a','skill_b','skill_c','poison_a','poison_b','stun_a','stun_b','sleep_a','sleep_b']
images={};records=[]
for folder,names in [('poses',poses),('actions',actions)]:
 for n in names:
  rows=(root/folder/f'{n}.pxgrid').read_text().splitlines()
  assert len(rows)==96 and all(len(r)==96 for r in rows), n
  assert set(''.join(rows))<=set(pal)|{'.'}, n
  assert all(c=='.' for c in rows[0]+rows[-1]), n
  assert all(r[0]=='.' and r[-1]=='.' for r in rows), n
  coords=[(x,y) for y,r in enumerate(rows) for x,c in enumerate(r) if c!='.']
  assert max(y for x,y in coords)<=92, n
  im=Image.new('RGBA',(96,96));im.putdata([colors.get(c,(0,0,0,0)) for r in rows for c in r])
  im.save(out/f'{n}.png');images[n]=im
  records.append({'frame':n,'bounds':[min(x for x,y in coords),min(y for x,y in coords),max(x for x,y in coords),max(y for x,y in coords)],'ink':len(coords),'sha256':hashlib.sha256(('\n'.join(rows)+'\n').encode()).hexdigest()})
assert len({r['sha256'] for r in records})==18
(out/'source-dimensions.json').write_text(json.dumps({'cell':96,'paletteColors':len(pal),'frames':records},indent=2)+'\n')
images['idle_a'].save(out/'idle.png')
images['idle_a'].resize((384,384),Image.Resampling.NEAREST).save(out/'idle-4x.png')
for names,title in [(poses,'poses'),(actions,'actions')]:
 sheet=Image.new('RGBA',(288,288),(36,37,48,255))
 for i,n in enumerate(names):sheet.alpha_composite(images[n],(i%3*96,i//3*96))
 sheet.save(out/f'{title}-native.png')
 sheet.resize((1152,1152),Image.Resampling.NEAREST).save(out/f'{title}-4x.png')
# Labelled diagnostic sheet; labels are outside sprite cells.
sheet=Image.new('RGB',(600,348),(36,37,48));draw=ImageDraw.Draw(sheet)
for i,n in enumerate(poses+actions):
 x=i%6*100;y=i//6*116
 sheet.paste(images[n],(x+2,y+18),images[n]);draw.text((x+2,y+3),n,fill=(224,219,203))
sheet.save(out/'all-18-native.png')
sheet.resize((1800,1044),Image.Resampling.NEAREST).save(out/'all-18-3x.png')
# Light background is an additional transparency/outline diagnostic.
light=Image.new('RGBA',(288,288),(235,228,216,255))
for i,n in enumerate(poses):light.alpha_composite(images[n],(i%3*96,i//3*96))
light.resize((1152,1152),Image.Resampling.NEAREST).save(out/'poses-light-4x.png')
groups={
 'idle':(['idle_a','idle_b','idle_c'],[280,280,280]),
 'attack':(['idle_a','windup','move','attack','recover','idle_a'],[280,180,100,120,200,280]),
 'hit':(['idle_a','hit','recover','idle_a'],[280,160,220,280]),
 'dead':(['idle_a','hit','dead'],[280,200,900]),
 'skill':(['idle_a','skill_a','skill_b','skill_c','idle_a'],[280,240,200,240,280]),
 'poison':(['poison_a','poison_b'],[420,420]),
 'stun':(['stun_a','stun_b'],[360,360]),
 'sleep':(['sleep_a','sleep_b'],[600,600])}
for name,(sequence,holds) in groups.items():
 for scale in (1,8):
  frames=[]
  for n in sequence:
   frame=Image.new('RGBA',(96,96),(36,37,48,255));frame.alpha_composite(images[n])
   if scale>1:frame=frame.resize((96*scale,96*scale),Image.Resampling.NEAREST)
   frames.append(frame.convert('RGB'))
  frames[0].save(out/f'{name}-{scale}x.gif',save_all=True,append_images=frames[1:],duration=holds,loop=0,disposal=2,optimize=False)
print(json.dumps({'frames':len(records),'palette':len(pal),'unique':len({r['sha256'] for r in records}),'idleBounds':records[0]['bounds'],'maxInkY':max(r['bounds'][3] for r in records),'maxInkX':max(r['bounds'][2] for r in records)},ensure_ascii=False))

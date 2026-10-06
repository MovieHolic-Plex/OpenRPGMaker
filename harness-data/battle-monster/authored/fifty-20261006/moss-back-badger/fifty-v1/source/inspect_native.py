"""Read-only grid inspection and diagnostic enlargements. No art generation."""
from pathlib import Path
from PIL import Image, ImageDraw
import json, hashlib
ROOT=Path(__file__).resolve().parent
palette=json.loads((ROOT/'palette.json').read_text())
report={'scope':'Native file inspection only; no review decision or user selection','frames':{},'changed_frames':[]}
contents=[]
for folder in ('poses','actions'):
 for path in sorted((ROOT/folder).glob('*.pxgrid')):
  rows=path.read_text().splitlines()
  assert len(rows)==64 and all(len(r)==64 for r in rows)
  assert all(c=='.' or c in palette for r in rows for c in r)
  assert set(rows[0]+rows[-1])=={'.'} and all(r[0]==r[-1]=='.' for r in rows)
  lowest=max(y for y,row in enumerate(rows) if any(p!='.' for p in row))
  assert lowest<=60
  if path.stem=='idle_a':assert lowest==60
  before=(ROOT/'original-draft'/folder/path.name).read_text().splitlines()
  changed=sum(a!=b for ra,rb in zip(before,rows) for a,b in zip(ra,rb))
  report['frames'][path.stem]={'changed_pixels':changed,'lowest_ink_y':lowest,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()}
  if changed:report['changed_frames'].append(path.stem)
  contents.append(path.read_bytes())
assert len(contents)==len(set(contents))==18
assert (ROOT/'palette.json').read_bytes()==(ROOT/'original-draft/palette.json').read_bytes()
(ROOT/'repair-report.json').write_text(json.dumps(report,indent=2)+'\n')
names=('idle_a','idle_b','idle_c','attack','sleep_a','sleep_b')
canvas=Image.new('RGB',(6*410,3*478),(43,45,48))
draw=ImageDraw.Draw(canvas)
for j,(bg,label) in enumerate([((239,230,209),'light'),((27,31,36),'dark'),(None,'checker')]):
 for i,name in enumerate(names):
  tile=Image.new('RGB',(64,64),bg or (149,155,161))
  if bg is None:
   for y in range(64):
    for x in range(64):
     if (x//8+y//8)%2:tile.putpixel((x,y),(211,216,220))
  im=Image.open(ROOT/'previews'/(name+'.png')).convert('RGBA')
  tile.paste(im,(0,0),im)
  x=i*410+10;y=j*478+22
  draw.text((x,y-17),name+' / '+label,fill='white')
  canvas.paste(tile.resize((384,384),Image.Resampling.NEAREST),(x,y))
  canvas.paste(tile,(x,y+388))
canvas.save(ROOT/'previews/repair-details.png')
print('18 distinct 64px grids, unchanged palette, transparent borders, lowest ink <=60; idle_a at 60.')
print('Changed:',', '.join(report['changed_frames']))

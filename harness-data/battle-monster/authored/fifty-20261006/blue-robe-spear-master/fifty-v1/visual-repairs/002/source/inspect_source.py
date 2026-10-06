"""Read-only art diagnostics. Never fill holes or reconnect pixels automatically."""
from pathlib import Path
from collections import deque, Counter
from PIL import Image, ImageDraw
import json, hashlib
ROOT=Path(__file__).resolve().parent
report={}
for folder in ('poses','actions'):
 for path in (ROOT/folder).glob('*.pxgrid'):
  rows=path.read_text().splitlines();ink={(x,y) for y,r in enumerate(rows) for x,c in enumerate(r) if c!='.'}
  todo=set(ink);components=[]
  while todo:
   p=todo.pop();q=[p];component={p}
   while q:
    x,y=q.pop()
    for dx,dy in ((-1,-1),(0,-1),(1,-1),(-1,0),(1,0),(-1,1),(0,1),(1,1)):
     v=x+dx,y+dy
     if v in todo:todo.remove(v);component.add(v);q.append(v)
   components.append({'pixels':len(component),'bbox':[min(x for x,y in component),min(y for x,y in component),max(x for x,y in component),max(y for x,y in component)]})
  empty={(x,y) for y in range(64) for x in range(64) if (x,y) not in ink}
  outside={(0,0)};q=[(0,0)]
  while q:
   x,y=q.pop()
   for dx,dy in ((-1,0),(1,0),(0,-1),(0,1)):
    v=x+dx,y+dy
    if v in empty and v not in outside:outside.add(v);q.append(v)
  holes=sorted(empty-outside,key=lambda p:(p[1],p[0]))
  report[path.stem]={'rowCount':len(rows),'rowWidths':sorted(set(map(len,rows))),'bbox':[min(x for x,y in ink),min(y for x,y in ink),max(x for x,y in ink),max(y for x,y in ink)],'colorCount':len(set(''.join(rows))-set('.')),'components8':sorted(components,key=lambda c:-c['pixels']),'enclosedTransparentCoordinates4':holes,'sourceSha256':hashlib.sha256(path.read_bytes()).hexdigest()}
(ROOT/'rendered'/'diagnostics.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({name:{'bbox':r['bbox'],'components':r['components8'],'holes':r['enclosedTransparentCoordinates4']} for name,r in report.items()},ensure_ascii=False))
# Exact native PNG atlases; placement alone, no interpolation or new frames.
poses=['idle_a','idle_b','idle_c','windup','move','attack','recover','hit','dead']
actions=['skill_a','skill_b','skill_c','poison_a','poison_b','stun_a','stun_b','sleep_a','sleep_b']
for name,seq,nrows in [('poses',poses,3),('actions',actions,3),('suite',poses+actions,6)]:
 out=Image.new('RGBA',(192,64*nrows))
 for i,frame in enumerate(seq):
  with Image.open(ROOT/'rendered'/(frame+'.png')) as im:out.paste(im,(i%3*64,i//3*64))
 out.save(ROOT/'rendered'/(name+'-native.png'))
# Open each encoded GIF and lay out its decoded frames and actual holds.
scenes=json.loads((ROOT/'motions'/'timing.json').read_text())
for theme,bg in [('light',(237,225,198)),('dark',(33,39,50))]:
 out=Image.new('RGB',(6*208,8*222),bg);draw=ImageDraw.Draw(out)
 for row,(name,(seq,holds)) in enumerate(scenes.items()):
  with Image.open(ROOT/'motions'/(name+'.gif')) as gif:
   for i,frame in enumerate(seq):
    gif.seek(i);im=gif.convert('RGBA')
    tile=Image.new('RGB',(64,64),bg);tile.paste(im,(0,0),im)
    x=i*208+8;y=row*222+24
    out.paste(tile.resize((192,192),Image.Resampling.NEAREST),(x,y))
    draw.text((x,y-19),name+'/'+frame+' '+str(gif.info['duration'])+'ms',fill=(99,99,99) if theme=='light' else (240,240,235))
 out.save(ROOT/'rendered'/('gif-storyboard-'+theme+'.png'))

"""Read-only source observations. Never modifies pixels or records approval."""
from pathlib import Path
from collections import deque
import json,hashlib
ROOT=Path(__file__).resolve().parent
observations={}
for folder in ('poses','actions'):
 for path in (ROOT/folder).glob('*.pxgrid'):
  rows=path.read_text().splitlines()
  ink={(x,y) for y,row in enumerate(rows) for x,c in enumerate(row) if c!='.'}
  unseen=set(ink);components=[]
  while unseen:
   seed=unseen.pop();q=[seed];points=[seed]
   while q:
    x,y=q.pop()
    for dx,dy in ((1,0),(-1,0),(0,1),(0,-1),(1,1),(-1,1),(1,-1),(-1,-1)):
     p=(x+dx,y+dy)
     if p in unseen:unseen.remove(p);q.append(p);points.append(p)
   components.append({'pixels':len(points),'bounds':[min(x for x,y in points),min(y for x,y in points),max(x for x,y in points),max(y for x,y in points)]})
  original=ROOT/'original'/folder/path.name
  before=original.read_text().splitlines() if original.exists() else rows
  observations[path.stem]={'rows':len(rows),'widths':sorted(set(map(len,rows))),'bounds':[min(x for x,y in ink),min(y for x,y in ink),max(x for x,y in ink),max(y for x,y in ink)],'colors':len(set(''.join(rows))- {'.'}),'unknownSymbols':sorted(set(''.join(rows))-set(json.loads((ROOT/'palette.json').read_text()))-{'.'}),'borderInk':sorted([list(p) for p in ink if p[0] in (0,127) or p[1] in (0,127)]),'baselinePixels':sum(y==124 for x,y in ink),'changedPixels':sum(a!=b for row,prior in zip(rows,before) for a,b in zip(row,prior)),'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'components':sorted(components,key=lambda c:-c['pixels'])}
(ROOT/'preview'/'source-observations.json').write_text(json.dumps(observations,indent=2)+'\n')
for name,obs in observations.items():
 print(name,'bounds',obs['bounds'],'small isolated groups',[p for p in obs['components'][1:] if p['pixels']<16])

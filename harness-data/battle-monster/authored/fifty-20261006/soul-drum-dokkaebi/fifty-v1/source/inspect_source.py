"""Read-only pixel diagnostics. Never modifies grids or performs repairs."""
from pathlib import Path
import hashlib,json
R=Path(__file__).resolve().parent
out={}
for p in sorted(list((R/'poses').glob('*.pxgrid'))+list((R/'actions').glob('*.pxgrid'))):
 rr=p.read_text().splitlines();ink={(x,y) for y,r in enumerate(rr) for x,s in enumerate(r) if s!='.'};todo=set(ink);comps=[]
 while todo:
  xy=todo.pop();q=[xy];pts=[xy]
  while q:
   x,y=q.pop()
   for dx,dy in [(1,0),(-1,0),(0,1),(0,-1),(1,1),(1,-1),(-1,1),(-1,-1)]:
    z=x+dx,y+dy
    if z in todo:todo.remove(z);q.append(z);pts.append(z)
  comps.append({'pixels':len(pts),'bounds':[min(x for x,y in pts),min(y for x,y in pts),max(x for x,y in pts),max(y for x,y in pts)]})
 transparent={(x,y) for y,r in enumerate(rr) for x,s in enumerate(r) if s=='.'};holes=[]
 while transparent:
  xy=transparent.pop();q=[xy];pts=[xy];edge=False
  while q:
   x,y=q.pop();edge=edge or x in (0,95) or y in (0,95)
   for dx,dy in [(1,0),(-1,0),(0,1),(0,-1)]:
    z=x+dx,y+dy
    if z in transparent:transparent.remove(z);q.append(z);pts.append(z)
  if not edge:holes.append({'pixels':len(pts),'bounds':[min(x for x,y in pts),min(y for x,y in pts),max(x for x,y in pts),max(y for x,y in pts)]})
 out[p.stem]={'rows':len(rr),'widths':sorted(set(map(len,rr))),'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'inkBounds':[min(x for x,y in ink),min(y for x,y in ink),max(x for x,y in ink),max(y for x,y in ink)],'components':sorted(comps,key=lambda x:-x['pixels']),'enclosedTransparentAreas':holes}
report={'paletteColors':len(json.loads((R/'palette.json').read_text())),'frames':out,'distinctGrids':len({v['sha256'] for v in out.values()}),'imagesSha256':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted((R/'preview').glob('*.png'))}}
(R/'preview'/'source-readback.json').write_text(json.dumps(report,indent=2)+'\n')
for n,v in out.items():print(n, 'ink',v['inkBounds'],'components',[c['pixels'] for c in v['components']],'holes',v['enclosedTransparentAreas'])

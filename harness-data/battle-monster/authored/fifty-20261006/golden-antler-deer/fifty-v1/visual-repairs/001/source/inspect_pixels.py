"""Read-only cluster diagnostics; never fills, joins, translates or edits pixels."""
from pathlib import Path
import json
ROOT=Path(__file__).resolve().parent
report={}
for folder in ['poses','actions']:
 for path in (ROOT/folder).glob('*.pxgrid'):
  rows=path.read_text().splitlines()
  ink={(x,y) for y,r in enumerate(rows) for x,c in enumerate(r) if c!='.'}
  pending=set(ink); comps=[]
  while pending:
   start=min(pending,key=lambda p:(p[1],p[0])); pending.remove(start); group={start}; stack=[start]
   while stack:
    x,y=stack.pop()
    for dx,dy in [(1,0),(-1,0),(0,1),(0,-1),(1,1),(-1,-1),(1,-1),(-1,1)]:
     n=(x+dx,y+dy)
     if n in pending: pending.remove(n);group.add(n);stack.append(n)
   comps.append({'pixels':len(group),'bbox':[min(x for x,y in group),min(y for x,y in group),max(x for x,y in group),max(y for x,y in group)],'symbols':''.join(sorted(set(rows[y][x] for x,y in group)))})
  # Flood only in read-only diagnostics to identify enclosed transparent pixels.
  blank={(x,y) for y in range(64) for x in range(64)}-ink
  pending=set(blank);holes=[]
  while pending:
   start=pending.pop(); group={start};stack=[start]
   while stack:
    x,y=stack.pop()
    for dx,dy in [(1,0),(-1,0),(0,1),(0,-1)]:
     n=(x+dx,y+dy)
     if n in pending:pending.remove(n);group.add(n);stack.append(n)
   if not any(x in [0,63] or y in [0,63] for x,y in group): holes.append(sorted(group,key=lambda p:(p[1],p[0])))
  report[path.stem]={'components':comps,'enclosed_transparency':holes,'lowest_ink':max(y for x,y in ink),'border_ink':[(x,y) for x,y in ink if x in [0,63] or y in [0,63]],'ink_pixels':len(ink)}
(ROOT/'previews'/'cluster-report.json').write_text(json.dumps(report,indent=2)+'\n')
for name,v in report.items():
 print(name,'lowest',v['lowest_ink'],'components',v['components'],'holes',v['enclosed_transparency'])

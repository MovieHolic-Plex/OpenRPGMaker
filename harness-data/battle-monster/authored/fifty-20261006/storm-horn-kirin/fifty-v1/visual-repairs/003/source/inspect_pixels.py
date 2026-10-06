"""Read-only native-pixel diagnostics. Reports margins/components/holes; never fills pixels."""
from pathlib import Path
import json
ROOT=Path(__file__).resolve().parent
reports={}
for path in list((ROOT/'poses').glob('*.pxgrid'))+list((ROOT/'actions').glob('*.pxgrid')):
 rows=path.read_text().splitlines()
 ink={(x,y) for y,r in enumerate(rows) for x,c in enumerate(r) if c!='.'}
 pending=set(ink);parts=[]
 while pending:
  q=[pending.pop()];part=[]
  while q:
   x,y=q.pop();part.append((x,y))
   for dx,dy in ((-1,-1),(-1,0),(-1,1),(0,-1),(0,1),(1,-1),(1,0),(1,1)):
    pos=(x+dx,y+dy)
    if pos in pending:pending.remove(pos);q.append(pos)
  parts.append({'pixels':len(part),'bbox':[min(x for x,y in part),min(y for x,y in part),max(x for x,y in part),max(y for x,y in part)]})
 parts.sort(key=lambda a:-a['pixels'])
 border=[(x,y) for x,y in ink if x<1 or x>126 or y<1 or y>124]
 report={'rows':len(rows),'widths':sorted(set(map(len,rows))),'paletteSymbols':sorted(set(''.join(rows))-{'.'}),'ink':len(ink),'borderInk':border,'components':parts}
 reports[path.stem]=report
 print(path.stem,'ink',len(ink),'border',border,'secondary',parts[1:])
(ROOT/'previews'/'native-diagnostics.json').write_text(json.dumps(reports,indent=2)+'\n')

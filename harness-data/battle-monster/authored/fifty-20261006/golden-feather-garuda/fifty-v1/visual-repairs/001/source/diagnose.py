"""Read-only native source observations. Never repairs pixels or assigns approval."""
from pathlib import Path
from collections import deque
import json
R=Path(__file__).parent
pal=json.loads((R/'palette.json').read_text());records=[]
for f in sorted(list((R/'poses').glob('*.pxgrid'))+list((R/'actions').glob('*.pxgrid'))):
    rows=f.read_text().splitlines();pixels={(x,y) for y,row in enumerate(rows) for x,k in enumerate(row) if k!='.'}
    todo=set(pixels);groups=[]
    while todo:
        pt=todo.pop();group=[pt];queue=deque([pt])
        while queue:
            x,y=queue.popleft()
            for dx,dy in ((1,0),(-1,0),(0,1),(0,-1),(1,1),(-1,1),(1,-1),(-1,-1)):
                v=(x+dx,y+dy)
                if v in todo:todo.remove(v);queue.append(v);group.append(v)
        groups.append({'pixels':len(group),'bounds':[min(x for x,y in group),min(y for x,y in group),max(x for x,y in group),max(y for x,y in group)]})
    records.append({'frame':f.stem,'rows':len(rows),'widths':sorted(set(map(len,rows))),'colors':len(set(''.join(rows))-set('.')),'bounds':[min(x for x,y in pixels),min(y for x,y in pixels),max(x for x,y in pixels),max(y for x,y in pixels)],'components8':sorted(groups,key=lambda a:-a['pixels'])})
(R/'diagnostics.json').write_text(json.dumps({'paletteColors':len(pal),'frames':records},indent=2)+'\n')
for row in records:print(row['frame'],row['bounds'],[g['pixels'] for g in row['components8']])

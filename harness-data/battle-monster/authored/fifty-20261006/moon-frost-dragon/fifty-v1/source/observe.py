"""Read-only source observations, not an art verdict or automatic repair."""
from pathlib import Path
import json,hashlib
ROOT=Path(__file__).resolve().parent
palette=json.loads((ROOT/'palette.json').read_text())
report={'paletteColors':len(palette),'paletteSha256':hashlib.sha256((ROOT/'palette.json').read_bytes()).hexdigest(),'frames':{}}
for folder in ('poses','actions'):
 for f in sorted((ROOT/folder).glob('*.pxgrid')):
  rows=f.read_text().splitlines()
  used=set(''.join(rows));ink={(x,y) for y,row in enumerate(rows) for x,s in enumerate(row) if s!='.'}
  todo=set(ink);groups=[]
  while todo:
   seed=todo.pop();q=[seed];g=[seed]
   while q:
    x,y=q.pop()
    for dx,dy in ((-1,-1),(0,-1),(1,-1),(-1,0),(1,0),(-1,1),(0,1),(1,1)):
     point=(x+dx,y+dy)
     if point in todo:todo.remove(point);q.append(point);g.append(point)
   groups.append({'pixels':len(g),'bounds':[min(x for x,y in g),min(y for x,y in g),max(x for x,y in g),max(y for x,y in g)]})
  info={'rows':len(rows),'rowWidths':sorted(set(map(len,rows))),'symbols':''.join(sorted(used)),
        'unknownSymbols':''.join(sorted(used-set(palette)-{'.'})),
        'sourceSha256':hashlib.sha256(f.read_bytes()).hexdigest(),
        'components':sorted(groups,key=lambda c:c['pixels'],reverse=True)}
  report['frames'][f.stem]=info
  print(f.stem,'rows',info['rows'],'widths',info['rowWidths'],'components >4',[(g['pixels'],g['bounds']) for g in info['components'] if g['pixels']>4])
for a,b in [('idle_a','idle_b'),('idle_a','idle_c'),('poison_a','poison_b'),('stun_a','stun_b'),('sleep_a','sleep_b')]:
 folder='poses' if a.startswith('idle') else 'actions'
 ra=(ROOT/folder/(a+'.pxgrid')).read_text().splitlines();rb=(ROOT/folder/(b+'.pxgrid')).read_text().splitlines()
 report.setdefault('pairDifferences',{})[a+'/'+b]={'changedPixels':sum(x!=y for ar,br in zip(ra,rb) for x,y in zip(ar,br)),
 'silhouettePixels':sum((x=='.')!=(y=='.') for ar,br in zip(ra,rb) for x,y in zip(ar,br))}
report['uniqueSourceHashes']=len({v['sourceSha256'] for v in report['frames'].values()})
(ROOT/'preview/connectivity-observation.json').write_text(json.dumps(report,indent=2)+'\n')
print('frames',len(report['frames']),'distinct literal grids',report['uniqueSourceHashes'])

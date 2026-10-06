"""Read current literal sources and export observations. No review or approval mutation."""
from pathlib import Path
import json,hashlib
s=Path(__file__).resolve().parent
h=s/'history/before-body-socket-repair'
pal=json.loads((s/'palette.json').read_text())
inspection=json.loads((s/'INSPECTION.json').read_text())
changes={};contracts={};hashes=[]
for group in ('poses','actions'):
    for p in sorted((s/group).glob('*.pxgrid')):
        rows=p.read_text().splitlines()
        old=(h/group/p.name).read_text().splitlines()
        data=p.read_bytes();sha=hashlib.sha256(data).hexdigest();hashes.append(sha)
        symbols=set(''.join(rows));ink=[(x,y) for y,r in enumerate(rows) for x,c in enumerate(r) if c!='.']
        xy=[(x,y) for y in range(128) for x in range(128) if rows[y][x]!=old[y][x]]
        contracts[p.stem]={
          'ascii':data.isascii(),'canvas128':len(rows)==128 and all(len(r)==128 for r in rows),
          'paletteOnly':not(symbols-set(pal)-{'.'}),
          'transparentBorder':set(rows[0]+rows[-1])=={'.'} and all(r[0]==r[-1]=='.' for r in rows),
          'lowestInkY':max(y for x,y in ink),'lowerMargin':max(y for x,y in ink)<=124,
          'inkAtBaseline':sum(c!='.' for c in rows[124])}
        changes[p.stem]={'sourceSha256':sha,'beforeSourceSha256':hashlib.sha256((h/group/p.name).read_bytes()).hexdigest(),
          'changedNativePixels':len(xy),'boundsInclusive':
            [min(x for x,y in xy),min(y for x,y in xy),max(x for x,y in xy),max(y for x,y in xy)] if xy else None}
result={'observationsOnly':True,'baseline':'history/before-body-socket-repair',
 'paletteUnchanged':(s/'palette.json').read_bytes()==(h/'palette.json').read_bytes(),
 'all18Distinct':len(set(hashes))==18,'contracts':contracts,'changes':changes,
 'gifs':inspection['gifs'],
 'limitations':'Native file/export observations only. Artistic acceptance, model provenance and user selection are not established by this report.'}
(s/'REPAIR_EXPORT.json').write_text(json.dumps(result,indent=2)+'\n')
print('Literal files:',len(hashes),'distinct:',len(set(hashes)),'palette unchanged:',result['paletteUnchanged'])
print('Changed native pixels:',{n:v['changedNativePixels'] for n,v in changes.items()})
print('Lowest ink:',{n:c['lowestInkY'] for n,c in contracts.items()})
print('All file observations satisfied:',all(all(c[k] for k in ('ascii','canvas128','paletteOnly','transparentBorder','lowerMargin')) for c in contracts.values()))

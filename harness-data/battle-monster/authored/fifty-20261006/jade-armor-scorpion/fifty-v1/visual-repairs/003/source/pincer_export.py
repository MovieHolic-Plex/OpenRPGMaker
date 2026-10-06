"""Read-only source diagnostics and current export metadata; no artistic verdict."""
from pathlib import Path
import hashlib,json
s=Path(__file__).resolve().parent
h=s/'history/before-pincer-repair'
pal=json.loads((s/'palette.json').read_text())
report=json.loads((s/'INSPECTION.json').read_text())
changes={};contracts={};seen=[]
for group in ('poses','actions'):
    for p in sorted((s/group).glob('*.pxgrid')):
        r=p.read_text().splitlines();old=(h/group/p.name).read_text().splitlines()
        symbols=set(''.join(r))
        bounds=report['frames'][p.stem]['boundsInclusive']
        contracts[p.stem]={
            'ascii':p.read_bytes().isascii(),
            'canvas128':len(r)==128 and all(len(row)==128 for row in r),
            'paletteOnly':not(symbols-set(pal)-{'.'}),
            'transparentBorder':all(c=='.' for c in r[0]+r[-1]) and all(row[0]==row[-1]=='.' for row in r),
            'lowestInkY':bounds[3],
            'lowerMargin':bounds[3]<=124,
            'inkAtBaseline':sum(c!='.' for c in r[124])}
        seen.append(hashlib.sha256(p.read_bytes()).hexdigest())
        xy=[(x,y) for y in range(128) for x in range(128) if r[y][x]!=old[y][x]]
        changes[p.stem]={'changedNativePixels':len(xy),'boundsInclusive':
            [min(x for x,y in xy),min(y for x,y in xy),max(x for x,y in xy),max(y for x,y in xy)] if xy else None,
            'beforeSourceSha256':hashlib.sha256((h/group/p.name).read_bytes()).hexdigest()}
report['repair']={'baseline':'history/before-pincer-repair','changes':changes,
    'paletteUnchanged':(s/'palette.json').read_bytes()==(h/'palette.json').read_bytes(),
    'all18Distinct':len(set(seen))==18,
    'contracts':contracts,
    'note':'File export observations only, not independent review, model provenance or user approval.'}
(s/'REPAIR_EXPORT.json').write_text(json.dumps(report,indent=2)+'\n')
print('18 full ASCII grids; palette unchanged:',report['repair']['paletteUnchanged'])
print('Distinct grids:',len(set(seen)))
print('Changed:',{k:v['changedNativePixels'] for k,v in changes.items() if v['changedNativePixels']})
print('Unchanged:',[k for k,v in changes.items() if not v['changedNativePixels']])
print('Source margins:',{k:(v['lowestInkY'],v['inkAtBaseline']) for k,v in contracts.items()})
for name,c in contracts.items():
    if not all(c[k] for k in ('ascii','canvas128','paletteOnly','transparentBorder','lowerMargin')):
        raise ValueError((name,c))
if contracts['idle_a']['lowestInkY']!=124:raise ValueError('idle_a baseline')
if not all(all(v['nativeRgbaEqual']) for v in report['gifs'].values()):raise ValueError('GIF export mismatch')

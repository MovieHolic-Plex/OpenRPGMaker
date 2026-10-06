"""Read-only pixel/GIF diagnostics, not a harness verdict or approval."""
from pathlib import Path
import json, hashlib
from PIL import Image
ROOT=Path(__file__).resolve().parent
palette=json.loads((ROOT/'palette.json').read_text())
report={'kind':'local-source-diagnostics','paletteColors':len(palette),'frames':[],'gifs':[],'review':'No independent review or user selection recorded here.'}
for p in sorted(ROOT.glob('*/*.pxgrid')):
    raw=p.read_bytes(); rows=raw.decode('ascii').splitlines()
    pts={(x,y) for y,r in enumerate(rows) for x,c in enumerate(r) if c!='.'}
    todo=set(pts); comps=[]
    while todo:
        q=todo.pop(); stack=[q]; comp=[q]
        while stack:
            x,y=stack.pop()
            for dx,dy in [(1,0),(-1,0),(0,1),(0,-1)]:
                n=x+dx,y+dy
                if n in todo: todo.remove(n);stack.append(n);comp.append(n)
        comps.append({'pixels':len(comp),'bounds':[min(x for x,y in comp),min(y for x,y in comp),max(x for x,y in comp),max(y for x,y in comp)]})
    png=ROOT/'previews'/(p.stem+'.png'); im=Image.open(png).convert('RGBA')
    report['frames'].append({'name':p.stem,'rows':len(rows),'widths':sorted(set(map(len,rows))),'unknownSymbols':sorted(set(''.join(rows))-set(palette)-{'.'}),'inkBounds':[min(x for x,y in pts),min(y for x,y in pts),max(x for x,y in pts),max(y for x,y in pts)],'alpha':sorted(set(im.getchannel('A').getdata())),'gridSha256':hashlib.sha256(raw).hexdigest(),'pngSha256':hashlib.sha256(png.read_bytes()).hexdigest(),'components4':sorted(comps,key=lambda c:-c['pixels'])})
for p in sorted((ROOT/'previews').glob('*.gif')):
    im=Image.open(p); holds=[]; bounds=[]
    for i in range(im.n_frames):
        im.seek(i); holds.append(im.info.get('duration')); bounds.append(im.convert('RGBA').getchannel('A').getbbox())
    report['gifs'].append({'name':p.name,'size':list(im.size),'frames':im.n_frames,'durationMs':holds,'decodedAlphaBounds':bounds,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
(ROOT/'inspection.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print('Read',len(report['frames']),'literal grids and',len(report['gifs']),'GIFs; actual data written to source/inspection.json')
print('Large body components:',[(f['name'],sum(c['pixels']>100 for c in f['components4'])) for f in report['frames']])

"""Read-only artwork measurements; records are not reviewer results."""
from pathlib import Path
from PIL import Image
import json
import hashlib

R = Path(__file__).parent
palette = json.loads((R/'palette.json').read_text())
records = []
for kind in ('poses', 'actions'):
    for p in sorted((R/kind).glob('*.pxgrid')):
        current = p.read_text().splitlines()
        before = (R/'before-feather-revision'/kind/p.name).read_text().splitlines()
        ink = [(x, y) for y, row in enumerate(current) for x, k in enumerate(row) if k != '.']
        im = Image.open(R/'png'/(p.stem+'.png')).convert('RGBA')
        records.append({
            'frame': p.stem,
            'sourceSha256': hashlib.sha256(p.read_bytes()).hexdigest(),
            'pngSha256': hashlib.sha256((R/'png'/(p.stem+'.png')).read_bytes()).hexdigest(),
            'rows': len(current), 'widths': sorted(set(map(len, current))),
            'unknownSymbols': sorted(set(''.join(current))-set(palette)-{'.'}),
            'alphaValues': sorted(set(im.getchannel('A').getdata())),
            'borderInkPixels': sum(x in (0,127) or y in (0,127) for x,y in ink),
            'lowestInkY': max(y for x,y in ink),
            'inkAtY124': [[x, current[124][x]] for x,y in ink if y == 124],
            'changedPixels': sum(a != b for ar, br in zip(current,before) for a,b in zip(ar,br)),
        })
gifs = []
for p in sorted((R/'gif').glob('*.gif')):
    im = Image.open(p)
    gifs.append({'file':p.name,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),
                 'size':list(im.size),'frames':im.n_frames})
report = {'purpose':'File and pixel observations, not visual approval',
          'paletteColors':len(palette), 'paletteUnchanged':(R/'palette.json').read_bytes()==(R/'before-feather-revision'/'palette.json').read_bytes(),
          'uniqueFrameSources':len({a['sourceSha256'] for a in records}),
          'frames':records,'gifs':gifs}
(R/'feather-revision-observations.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({'frames':len(records),'distinct':report['uniqueFrameSources'],
                  'modified':[a['frame'] for a in records if a['changedPixels']],
                  'preserved':[a['frame'] for a in records if not a['changedPixels']],
                  'paletteColors':len(palette),'paletteUnchanged':report['paletteUnchanged'],
                  'widths':sorted({w for a in records for w in a['widths']}),
                  'rows':sorted({a['rows'] for a in records}),
                  'borderInk':sum(a['borderInkPixels'] for a in records),
                  'lowestInk':sorted({a['lowestInkY'] for a in records}),
                  'gifs':len(gifs)},ensure_ascii=False))

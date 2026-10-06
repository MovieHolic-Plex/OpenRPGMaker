"""Read-only file observations for this revision, never a reviewer verdict."""
from pathlib import Path
from PIL import Image
import json
import hashlib

R = Path(__file__).parent
P = json.loads((R/'palette.json').read_text())
records = []
for kind in ('poses', 'actions'):
    for p in sorted((R/kind).glob('*.pxgrid')):
        rows = p.read_text().splitlines()
        before = (R/'before-anatomy-repair'/kind/p.name).read_text().splitlines()
        ink = [(x, y) for y, row in enumerate(rows) for x, c in enumerate(row) if c != '.']
        im = Image.open(R/'png'/(p.stem+'.png')).convert('RGBA')
        records.append({
            'frame': p.stem,
            'sourceSha256': hashlib.sha256(p.read_bytes()).hexdigest(),
            'pngSha256': hashlib.sha256((R/'png'/(p.stem+'.png')).read_bytes()).hexdigest(),
            'rows': len(rows), 'widths': sorted(set(map(len, rows))),
            'unknownSymbols': sorted(set(''.join(rows))-set(P)-{'.'}),
            'borderInkPixels': sum(x in (0,127) or y in (0,127) for x, y in ink),
            'lowestInkY': max(y for x, y in ink),
            'inkAtY124': [x for x, y in ink if y == 124],
            'alphaValues': sorted(set(im.getchannel('A').get_flattened_data())),
            'changedPixels': sum(a != b for ar, br in zip(rows, before) for a, b in zip(ar, br)),
        })
gifs = []
for p in sorted((R/'gif').glob('*.gif')):
    im = Image.open(p)
    gifs.append({'file': p.name, 'size': list(im.size), 'frames': im.n_frames,
                 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()})
result = {
    'purpose': 'Native file observations; not inspection approval or user selection',
    'paletteColors': len(P),
    'paletteUnchanged': (R/'palette.json').read_bytes() == (R/'before-anatomy-repair/palette.json').read_bytes(),
    'uniqueFrameSources': len({r['sourceSha256'] for r in records}),
    'frames': records, 'gifs': gifs,
}
(R/'anatomy-repair-observations.json').write_text(json.dumps(result, indent=2)+'\n')
print(json.dumps({
    'frames': len(records), 'distinct': result['uniqueFrameSources'],
    'changed': {r['frame']:r['changedPixels'] for r in records if r['changedPixels']},
    'preserved': [r['frame'] for r in records if not r['changedPixels']],
    'paletteUnchanged': result['paletteUnchanged'], 'paletteColors': len(P),
    'rows': sorted({r['rows'] for r in records}),
    'widths': sorted({w for r in records for w in r['widths']}),
    'borderInk': sum(r['borderInkPixels'] for r in records),
    'lowestInk': sorted({r['lowestInkY'] for r in records}),
    'unknownSymbols': sorted({c for r in records for c in r['unknownSymbols']}),
    'gifs': len(gifs),
}, ensure_ascii=False))

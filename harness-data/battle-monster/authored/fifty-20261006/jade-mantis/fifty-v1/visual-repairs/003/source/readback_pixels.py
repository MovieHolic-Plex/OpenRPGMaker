"""Report literal source and rendered asset facts. Does not write any verdict."""
from pathlib import Path
import hashlib
import json
from PIL import Image

ROOT = Path(__file__).resolve().parent
palette = json.loads((ROOT/'palette.json').read_text())
records = {}
for folder in ('poses', 'actions'):
    for path in sorted((ROOT/folder).glob('*.pxgrid')):
        rows = path.read_text(encoding='ascii').splitlines()
        old = (ROOT/'original'/folder/path.name).read_text().splitlines()
        previous = (ROOT/'revisions/before-scissors'/folder/path.name).read_text().splitlines()
        points = [(x, y) for y, row in enumerate(rows)
                  for x, c in enumerate(row) if c != '.']
        with Image.open(ROOT/'preview'/f'{path.stem}.png') as im:
            alphas = sorted(set(im.convert('RGBA').getchannel('A').getdata()))
            png_size = list(im.size)
        records[path.stem] = {
            'rows': len(rows), 'widths': sorted(set(map(len, rows))),
            'unknownSymbols': sorted(set(''.join(rows)) - set(palette) - {'.'}),
            'lowestInkY': max(y for x, y in points),
            'transparentBorder': all(c == '.' for c in rows[0]+rows[-1])
                                 and all(r[0] == r[-1] == '.' for r in rows),
            'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
            'changedPixels': sum(a != b for r, s in zip(rows, old)
                                 for a, b in zip(r, s)),
            'changedPixelsFromPreviousDraft': sum(a != b for r, s in zip(rows, previous)
                                                  for a, b in zip(r, s)),
            'nativePngSize': png_size, 'pngAlphaValues': alphas,
        }
report = {
    'purpose': 'Source/export readback facts; no reviewer verdict or user selection.',
    'paletteColors': len(palette),
    'paletteUnchanged': (ROOT/'palette.json').read_bytes()
                        == (ROOT/'original/palette.json').read_bytes(),
    'uniqueGrids': len({r['sha256'] for r in records.values()}),
    'frames': records,
}
(ROOT/'preview/source-readback.json').write_text(json.dumps(report, indent=2)+'\n')
print(json.dumps({'frames': len(records), 'uniqueGrids': report['uniqueGrids'],
                  'paletteColors': report['paletteColors'],
                  'paletteUnchanged': report['paletteUnchanged'],
                  'rowCounts': sorted({r['rows'] for r in records.values()}),
                  'rowWidths': sorted({w for r in records.values() for w in r['widths']}),
                  'lowestInkY': sorted({r['lowestInkY'] for r in records.values()}),
                  'transparentBorders': all(r['transparentBorder'] for r in records.values()),
                  'pngAlphaValues': sorted({a for r in records.values() for a in r['pngAlphaValues']})}, indent=2))

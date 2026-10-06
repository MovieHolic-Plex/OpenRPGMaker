"""Read source/PNG/GIF facts. No pixel repair, tests, gate or approval record."""
from pathlib import Path
import hashlib
import json
from PIL import Image

ROOT = Path(__file__).resolve().parent
BEFORE = ROOT / 'before-contour-repair'
OUT = ROOT / 'preview'
palette = json.loads((ROOT / 'palette.json').read_text())
report = {'paletteColors': len(palette),
          'paletteUnchanged': (ROOT / 'palette.json').read_bytes() == (BEFORE / 'palette.json').read_bytes(),
          'frames': {}, 'gifs': {}}
images = {}
for folder in ('poses', 'actions'):
    for path in sorted((ROOT / folder).glob('*.pxgrid')):
        rows = path.read_text().splitlines()
        prior_path = BEFORE / folder / path.name
        old = prior_path.read_text().splitlines()
        ink = [(x,y) for y,row in enumerate(rows) for x,c in enumerate(row) if c != '.']
        changes = [(x,y) for y,(row,prior) in enumerate(zip(rows,old))
                   for x,(a,b) in enumerate(zip(row,prior)) if a != b]
        with Image.open(OUT / (path.stem + '.png')) as png:
            images[path.stem] = png.convert('RGBA')
            alpha = sorted(set(png.getchannel('A').getdata()))
        report['frames'][path.stem] = {
            'rows': len(rows), 'widths': sorted(set(map(len, rows))),
            'unknownSymbols': sorted(set(''.join(rows)) - set(palette) - {'.'}),
            'bounds': [min(x for x,y in ink), min(y for x,y in ink), max(x for x,y in ink), max(y for x,y in ink)],
            'borderInk': sum(x in (0,127) or y in (0,127) for x,y in ink),
            'baselinePixels': sum(y == 124 for x,y in ink), 'alpha': alpha,
            'changedPixels': len(changes),
            'changedBounds': [min(x for x,y in changes), min(y for x,y in changes), max(x for x,y in changes), max(y for x,y in changes)] if changes else None,
            'gridUnchanged': path.read_bytes() == prior_path.read_bytes(),
            'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
            'pngSha256': hashlib.sha256((OUT / (path.stem + '.png')).read_bytes()).hexdigest()}

sequences = {
    'idle': ['idle_a','idle_b','idle_c','idle_b'],
    'attack': ['idle_a','windup','move','attack','recover','idle_a'],
    'hit': ['idle_a','hit','recover','idle_a'],
    'dead': ['idle_a','hit','dead'],
    'skill': ['idle_a','skill_a','skill_b','skill_c','idle_a'],
    'poison': ['poison_a','poison_b'],
    'stun': ['stun_a','stun_b'],
    'sleep': ['sleep_a','sleep_b']}
for name, sequence in sequences.items():
    path = OUT / (name + '.gif')
    with Image.open(path) as gif:
        holds, differences = [], []
        for i in range(gif.n_frames):
            gif.seek(i)
            holds.append(gif.info.get('duration'))
            expected = Image.new('RGB', (128,128), (36,42,53))
            im = images[sequence[i]]
            expected.paste(im, (0,0), im)
            decoded = gif.convert('RGB')
            differences.append(sum(a != b for a,b in zip(decoded.getdata(), expected.getdata())))
        report['gifs'][name] = {'sequence': sequence, 'holdsMs': holds,
                               'decodedPixelDifferences': differences,
                               'sha256': hashlib.sha256(path.read_bytes()).hexdigest()}
report['uniqueGridHashes'] = len({v['sha256'] for v in report['frames'].values()})
report['unchangedGrids'] = [n for n,v in report['frames'].items() if v['gridUnchanged']]
(OUT / 'contour-observations.json').write_text(json.dumps(report, indent=2) + '\n')
print('Palette:', report['paletteColors'], 'colors; unchanged:', report['paletteUnchanged'])
for name, info in report['frames'].items():
    print(name, 'rows/widths', info['rows'], info['widths'], 'changed', info['changedPixels'],
          'bounds', info['changedBounds'], 'lowest ink', info['bounds'][3],
          'border ink', info['borderInk'], 'unknown', info['unknownSymbols'], 'alpha', info['alpha'])
print('Unique grids:', report['uniqueGridHashes'], 'unchanged grids:', len(report['unchangedGrids']))
for name, info in report['gifs'].items():
    print(name, 'actual holds', info['holdsMs'], 'decoded differences', info['decodedPixelDifferences'])

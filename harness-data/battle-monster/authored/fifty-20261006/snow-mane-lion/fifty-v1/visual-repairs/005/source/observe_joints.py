"""Read-only file observations for this revision; no verdict or pixel repair."""
from pathlib import Path
from collections import deque
import hashlib
import json
from PIL import Image

ROOT = Path(__file__).resolve().parent
OUT = ROOT / 'preview'
palette = json.loads((ROOT / 'palette.json').read_text())
report = {'paletteColors': len(palette), 'paletteUnchanged': (ROOT / 'palette.json').read_bytes() == (ROOT / 'before-joint-repair/palette.json').read_bytes(), 'frames': {}, 'gifs': {}}
images = {}
for folder in ('poses', 'actions'):
    for path in sorted((ROOT / folder).glob('*.pxgrid')):
        rows = path.read_text().splitlines()
        old = (ROOT / 'before-joint-repair' / folder / path.name).read_text().splitlines()
        ink = {(x, y) for y, row in enumerate(rows) for x, c in enumerate(row) if c != '.'}
        todo = set(ink)
        components = []
        while todo:
            points = [todo.pop()]
            queue = deque(points)
            while queue:
                x, y = queue.popleft()
                for dx, dy in ((-1,0),(1,0),(0,-1),(0,1),(-1,-1),(-1,1),(1,-1),(1,1)):
                    p = (x+dx, y+dy)
                    if p in todo:
                        todo.remove(p)
                        queue.append(p)
                        points.append(p)
            components.append({'pixels': len(points), 'bounds': [min(x for x,y in points), min(y for x,y in points), max(x for x,y in points), max(y for x,y in points)]})
        with Image.open(OUT / (path.stem + '.png')) as png:
            images[path.stem] = png.convert('RGBA')
            alpha = sorted(set(png.getchannel('A').getdata()))
        report['frames'][path.stem] = {
            'rows': len(rows), 'widths': sorted(set(map(len, rows))),
            'unknownSymbols': sorted(set(''.join(rows)) - set(palette) - {'.'}),
            'bounds': [min(x for x,y in ink), min(y for x,y in ink), max(x for x,y in ink), max(y for x,y in ink)],
            'borderInk': sum(x in (0,127) or y in (0,127) for x,y in ink),
            'baselinePixels': sum(y == 124 for x,y in ink), 'alpha': alpha,
            'changedPixels': sum(a != b for r,q in zip(rows,old) for a,b in zip(r,q)),
            'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
            'pngSha256': hashlib.sha256((OUT / (path.stem + '.png')).read_bytes()).hexdigest(),
            'components': sorted(components, key=lambda c: -c['pixels'])}
sequences = {
    'idle': ['idle_a','idle_b','idle_c','idle_b'],
    'attack': ['idle_a','windup','move','attack','recover','idle_a'],
    'hit': ['idle_a','hit','recover','idle_a'],
    'dead': ['idle_a','hit','dead'],
    'skill': ['idle_a','skill_a','skill_b','skill_c','idle_a'],
    'poison': ['poison_a','poison_b'], 'stun': ['stun_a','stun_b'], 'sleep': ['sleep_a','sleep_b']}
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
        report['gifs'][name] = {'sequence': sequence, 'holdsMs': holds, 'decodedPixelDifferences': differences, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()}
report['uniqueGridHashes'] = len({v['sha256'] for v in report['frames'].values()})
(OUT / 'joint-revision-observations.json').write_text(json.dumps(report, indent=2) + '\n')
for name, info in report['frames'].items():
    print(name, 'changed', info['changedPixels'], 'bottom', info['bounds'][3], 'baseline ink', info['baselinePixels'], 'small groups', [c for c in info['components'][1:] if c['pixels'] < 16])
print('Actual GIF decoded pixel differences:', {n: v['decodedPixelDifferences'] for n,v in report['gifs'].items()})

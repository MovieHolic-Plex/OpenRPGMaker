"""Read literal files and rendered cels, record observations and real hashes only."""
from pathlib import Path
import hashlib
import json
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent
OUT = ROOT / 'preview'
palette = json.loads((ROOT / 'palette.json').read_text())
digest = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
report = {'paletteColors': len(palette), 'paletteUnchanged': (ROOT / 'palette.json').read_bytes() == (ROOT / 'before-mane-repair/palette.json').read_bytes(), 'paletteSha256': digest(ROOT / 'palette.json'), 'frames': {}, 'gifs': {}}
for folder in ('poses', 'actions'):
    for path in sorted((ROOT / folder).glob('*.pxgrid')):
        rows = path.read_text().splitlines()
        old = (ROOT / 'before-mane-repair' / folder / path.name).read_text().splitlines()
        ink = [(x,y) for y,row in enumerate(rows) for x,p in enumerate(row) if p != '.']
        changes = [(x,y) for y,(row,prior) in enumerate(zip(rows,old)) for x,(p,q) in enumerate(zip(row,prior)) if p != q]
        png = OUT / (path.stem + '.png')
        with Image.open(png) as im:
            alphas = sorted(set(im.getchannel('A').getdata()))
        report['frames'][path.stem] = {
            'rows': len(rows), 'widths': sorted(set(map(len,rows))),
            'unknownSymbols': sorted(set(''.join(rows)) - set(palette) - {'.'}),
            'borderInk': [[x,y] for x,y in ink if x in (0,127) or y in (0,127)],
            'lowestInkY': max(y for x,y in ink),
            'bodyBaselinePixels': sum(y == 124 for x,y in ink),
            'changedPixelsThisRevision': len(changes),
            'changeBounds': [min(x for x,y in changes), min(y for x,y in changes), max(x for x,y in changes), max(y for x,y in changes)],
            'sourceSha256': digest(path), 'beforeSourceSha256': digest(ROOT / 'before-mane-repair' / folder / path.name),
            'pngSha256': digest(png), 'pngAlphaValues': alphas,
        }
sequences = {
    'idle': ['idle_a','idle_b','idle_c','idle_b'],
    'attack': ['idle_a','windup','move','attack','recover','idle_a'],
    'hit': ['idle_a','hit','recover','idle_a'],
    'dead': ['idle_a','hit','dead'],
    'skill': ['idle_a','skill_a','skill_b','skill_c','idle_a'],
    'poison': ['poison_a','poison_b'],
    'stun': ['stun_a','stun_b'],
    'sleep': ['sleep_a','sleep_b'],
}
for name,names in sequences.items():
    path = OUT / (name + '.gif')
    cels = []
    with Image.open(path) as gif:
        for n in range(gif.n_frames):
            gif.seek(n)
            actual = gif.convert('RGB')
            with Image.open(OUT / (names[n] + '.png')) as png:
                expected = Image.new('RGB', (128,128), (36,42,53))
                expected.paste(png, (0,0), png)
            cels.append({'pose': names[n], 'holdMs': gif.info.get('duration'), 'pixelsDifferentFromNativeOnGifBackground': sum(p != q for p,q in zip(actual.getdata(),expected.getdata()))})
    report['gifs'][name] = {'sha256': digest(path), 'cels': cels}
report['distinctGrids'] = len({o['sourceSha256'] for o in report['frames'].values()})
(OUT / 'mane-revision-observations.json').write_text(json.dumps(report, indent=2) + '\n')

# Final close-ups decode our own source images, not reference art.
for name in ('dead', 'recover'):
    with Image.open(OUT / (name + '.png')) as im:
        bg = Image.new('RGB', (512,512), (36,42,53))
        enlarged = im.resize((512,512), Image.Resampling.NEAREST)
        bg.paste(enlarged, (0,0), enlarged)
        bg.save(OUT / (name + '-4x.png'))
board = Image.new('RGB',(768,532),(36,42,53))
draw = ImageDraw.Draw(board)
for index,name in enumerate(('idle_a','recover','dead','sleep_a','sleep_b','skill_b')):
    x=index%3*256; y=index//3*266
    draw.text((x+4,y+3),name+' / native + 3x',fill='white')
    with Image.open(OUT / (name + '.png')) as im:
        board.paste(im,(x,y+12),im)
        # Focus regions are only diagnostic crops of existing authored native pixels.
        box = {'idle_a':(43,43,90,83),'recover':(93,89,114,111),'dead':(78,94,110,123),'sleep_a':(80,87,112,122),'sleep_b':(80,87,112,122),'skill_b':(75,44,109,76)}[name]
        crop = im.crop(box)
        zoom = crop.resize((crop.width*3,crop.height*3),Image.Resampling.NEAREST)
        board.paste(zoom,(x+4,y+144),zoom)
board.save(OUT/'revision-focus.png')
print('Recorded', len(report['frames']), 'native files,', report['distinctGrids'], 'distinct grids, and',len(report['gifs']), 'actual GIF files.')
print('Changed pixels this revision:', {name:o['changedPixelsThisRevision'] for name,o in report['frames'].items()})
print('GIF decoded pixel differences:', {name:sum(c['pixelsDifferentFromNativeOnGifBackground'] for c in o['cels']) for name,o in report['gifs'].items()})

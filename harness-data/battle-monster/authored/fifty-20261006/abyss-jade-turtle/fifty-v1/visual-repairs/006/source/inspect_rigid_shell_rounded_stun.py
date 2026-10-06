"""Read native rows for visual comparisons and file observations; no art edits."""
from pathlib import Path
import json
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent
OUT = ROOT / 'previews'
BACKUP = ROOT / 'revisions/before-rigid-shell-rounded-stun'
palette = json.loads((ROOT / 'palette.json').read_text())
colors = {s: tuple(bytes.fromhex(c[1:])) + (255,) for s, c in palette.items()}
colors['.'] = (0, 0, 0, 0)

def decode(path):
    im = Image.new('RGBA', (128, 128))
    im.putdata([colors[s] for row in path.read_text().splitlines() for s in row])
    return im

def background(kind):
    im = Image.new('RGBA', (128, 128), '#EEE9D9' if kind == 'light' else '#121D29')
    if kind == 'checker':
        d = ImageDraw.Draw(im)
        for y in range(0, 128, 8):
            for x in range(0, 128, 8):
                d.rectangle((x, y, x+7, y+7), fill='#697583' if (x//8+y//8)%2 else '#9AA5AE')
    return im

stats = {}
comparison = Image.new('RGB', (800, 1275), '#253340')
cd = ImageDraw.Draw(comparison)
for index, (name, folder) in enumerate([('attack', 'poses'), ('stun_a', 'actions'), ('stun_b', 'actions')]):
    current = decode(ROOT / folder / (name+'.pxgrid'))
    old = decode(BACKUP / folder / (name+'.pxgrid'))
    sheet = Image.new('RGB', (1200, 576), '#253340')
    d = ImageDraw.Draw(sheet)
    for i, kind in enumerate(['light', 'dark', 'checker']):
        panel = background(kind); panel.alpha_composite(current)
        sheet.paste(panel, (i*400+8, 24))
        d.text((i*400+8, 6), name+' / '+kind+' / native 1x', fill='white')
        sheet.paste(panel.resize((384, 384), Image.Resampling.NEAREST), (i*400+8, 184))
        d.text((i*400+8, 164), 'nearest 3x', fill='white')
    sheet.save(OUT / (name+'-rigid-shell-rounded-stun.png'))
    for i, (version, im) in enumerate([('before', old), ('after', current)]):
        panel = background('light'); panel.alpha_composite(im)
        comparison.paste(panel.resize((384, 384), Image.Resampling.NEAREST), (i*400+8, index*425+26))
        cd.text((i*400+8, index*425+8), name+' / '+version, fill='white')
    diffs = [(x, y) for y in range(128) for x in range(128) if old.getpixel((x, y)) != current.getpixel((x, y))]
    stats[name] = {'changedPixels': len(diffs), 'changedBounds': [min(x for x,y in diffs), min(y for x,y in diffs), max(x for x,y in diffs), max(y for x,y in diffs)]}
comparison.save(OUT / 'rigid-shell-rounded-stun-before-after.png')
faces = Image.new('RGB', (720, 300), '#EEE9D9')
fd = ImageDraw.Draw(faces)
for i, name in enumerate(['stun_a', 'stun_b']):
    panel = background('light')
    panel.alpha_composite(decode(ROOT/'actions'/(name+'.pxgrid')))
    faces.paste(panel.crop((85,95,122,122)).resize((333,243), Image.Resampling.NEAREST), (i*360,24))
    fd.text((i*360,4), name+' x85..121 y95..121 / 9x', fill='#09171F')
faces.save(OUT/'stun-face-inspection.png')
stats['paletteUnchanged'] = (ROOT/'palette.json').read_bytes() == (BACKUP/'palette.json').read_bytes()
stats['files'] = {}
for folder in ['poses', 'actions']:
    for path in sorted((ROOT/folder).glob('*.pxgrid')):
        rows = path.read_text().splitlines()
        ink = [(x, y) for y, row in enumerate(rows) for x, c in enumerate(row) if c != '.']
        stats['files'][path.stem] = {'rows': len(rows), 'rowLengths': sorted(set(map(len, rows))), 'inkBounds': [min(x for x,y in ink), min(y for x,y in ink), max(x for x,y in ink), max(y for x,y in ink)], 'unknownSymbols': sorted(set(''.join(rows))-set(colors)), 'opaqueBorderPixels': sum(x in (0,127) or y in (0,127) for x,y in ink)}
stats['gifHoldsMs'] = {}
for name in ['idle', 'attack', 'hit', 'dead', 'skill', 'poison', 'stun', 'sleep']:
    gif = Image.open(OUT/(name+'.gif'))
    holds = []
    for i in range(gif.n_frames):
        gif.seek(i); holds.append(gif.info.get('duration'))
    stats['gifHoldsMs'][name] = holds
(OUT/'rigid-shell-rounded-stun-observations.json').write_text(json.dumps(stats, ensure_ascii=False, indent=2)+'\n')
print(json.dumps({k:v for k,v in stats.items() if k != 'files'}, indent=2))

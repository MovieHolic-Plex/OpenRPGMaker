"""Read-only file observations and PNG/GIF diagnostic displays of literal art."""
from pathlib import Path
import hashlib
import json
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent
OUT = ROOT / 'previews'
BACKUP = ROOT / 'revisions/before-shell-bash'
palette = json.loads((ROOT / 'palette.json').read_text())
colors = {s: tuple(bytes.fromhex(c[1:])) + (255,) for s, c in palette.items()}
colors['.'] = (0, 0, 0, 0)

def decode(path):
    im = Image.new('RGBA', (128, 128))
    im.putdata([colors[c] for row in path.read_text().splitlines() for c in row])
    return im

def backdrop(kind):
    im = Image.new('RGBA', (128, 128), '#EEE9D9' if kind == 'light' else '#121D29')
    if kind == 'checker':
        d = ImageDraw.Draw(im)
        for y in range(0, 128, 8):
            for x in range(0, 128, 8):
                d.rectangle((x, y, x+7, y+7), fill='#697583' if (x//8+y//8)%2 else '#9AA5AE')
    return im

before = decode(BACKUP / 'poses/attack.pxgrid')
after = decode(ROOT / 'poses/attack.pxgrid')
comparison = Image.new('RGB', (800, 570), '#253340')
d = ImageDraw.Draw(comparison)
for i, (label, art) in enumerate([('before', before), ('after', after)]):
    panel = backdrop('light'); panel.alpha_composite(art)
    d.text((i*400+8, 5), 'attack / '+label+' / native 1x', fill='white')
    comparison.paste(panel, (i*400+8, 24))
    d.text((i*400+8, 164), 'nearest 3x', fill='white')
    comparison.paste(panel.resize((384,384), Image.Resampling.NEAREST), (i*400+8, 184))
comparison.save(OUT / 'shell-bash-before-after.png')

detail = backdrop('light'); detail.alpha_composite(after)
detail.crop((78,86,124,126)).resize((552,480), Image.Resampling.NEAREST).save(OUT / 'shell-bash-neck-foot-detail.png')
names = ['windup','move','attack','recover']
sequence = Image.new('RGB', (1600,570), '#253340')
sd = ImageDraw.Draw(sequence)
for i, name in enumerate(names):
    panel = backdrop('checker'); panel.alpha_composite(decode(ROOT / 'poses' / (name+'.pxgrid')))
    sequence.paste(panel, (i*400+8,24))
    sequence.paste(panel.resize((384,384), Image.Resampling.NEAREST), (i*400+8,184))
    sd.text((i*400+8,5), name+' / native 1x', fill='white')
    sd.text((i*400+8,164), 'nearest 3x', fill='white')
sequence.save(OUT / 'shell-bash-sequence.png')

old_hashes = json.loads((BACKUP / 'original-file-hashes.json').read_text())
observations = {'files': {}, 'unchangedOriginalFiles': [], 'changedOriginalFiles': []}
for relative, old_hash in old_hashes.items():
    current_hash = hashlib.sha256((ROOT / relative).read_bytes()).hexdigest()
    key = 'unchangedOriginalFiles' if current_hash == old_hash else 'changedOriginalFiles'
    observations[key].append(relative)
for folder in ['poses','actions']:
    for path in sorted((ROOT / folder).glob('*.pxgrid')):
        rows = path.read_text().splitlines()
        ink = [(x,y) for y,row in enumerate(rows) for x,c in enumerate(row) if c != '.']
        observations['files'][path.stem] = {
            'rows': len(rows), 'rowLengths': sorted(set(map(len,rows))),
            'unknownSymbols': sorted(set(''.join(rows)) - set(colors)),
            'inkBounds': [min(x for x,y in ink), min(y for x,y in ink), max(x for x,y in ink), max(y for x,y in ink)],
            'opaqueBorderPixels': sum(x in (0,127) or y in (0,127) for x,y in ink),
            'lowestInkY': max(y for x,y in ink),
            'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
        }
old_rows = (BACKUP / 'poses/attack.pxgrid').read_text().splitlines()
new_rows = (ROOT / 'poses/attack.pxgrid').read_text().splitlines()
diff = [(x,y) for y in range(128) for x in range(128) if old_rows[y][x] != new_rows[y][x]]
observations['attackChangedPixels'] = len(diff)
observations['attackChangedBounds'] = [min(x for x,y in diff),min(y for x,y in diff),max(x for x,y in diff),max(y for x,y in diff)]
observations['attackGroundedSoleXAtY124'] = [x for x,c in enumerate(new_rows[124]) if c != '.']
observations['gifHoldsMs'] = {}
for name in ['idle','attack','hit','dead','skill','poison','stun','sleep']:
    gif = Image.open(OUT / (name+'.gif'))
    holds = []
    for i in range(gif.n_frames):
        gif.seek(i); holds.append(gif.info.get('duration'))
    observations['gifHoldsMs'][name] = holds
(OUT / 'shell-bash-file-observations.json').write_text(json.dumps(observations,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:v for k,v in observations.items() if k != 'files'},ensure_ascii=False,indent=2))

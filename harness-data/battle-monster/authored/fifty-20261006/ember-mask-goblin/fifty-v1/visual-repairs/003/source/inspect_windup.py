"""Read-only before/current 1x+3x observation plates and actual differences."""
from pathlib import Path
from PIL import Image, ImageDraw
import json, hashlib
ROOT = Path(__file__).resolve().parent
archive = ROOT / 'history' / 'before-backward-windup'
palette = json.loads((ROOT / 'palette.json').read_text())
colors = {ch: tuple(bytes.fromhex(rgb[1:])) + (255,) for ch, rgb in palette.items()}
def read(path):
    rows = path.read_text().splitlines()
    im = Image.new('RGBA', (96, 96))
    im.putdata([colors[ch] if ch != '.' else (0, 0, 0, 0) for row in rows for ch in row])
    return im
for theme, bg in [('light', (230,220,201,255)), ('dark', (27,31,39,255)), ('checker', None)]:
    sheet = Image.new('RGB', (5*398, 328), (42,45,53))
    draw = ImageDraw.Draw(sheet)
    entries = [('before', archive / 'poses' / 'windup.pxgrid')]
    entries += [(name, ROOT / 'poses' / (name+'.pxgrid')) for name in ['windup','move','attack','recover']]
    for i, (name, path) in enumerate(entries):
        tile = Image.new('RGBA', (96,96), bg or (170,170,178,255))
        if bg is None:
            px = tile.load()
            for y in range(96):
                for x in range(96):
                    if (x//8+y//8)%2: px[x,y]=(210,210,217,255)
        tile.alpha_composite(read(path))
        x = i*398+3
        draw.text((x,6),name+' / 1x + 3x',fill='white')
        sheet.paste(tile.convert('RGB'), (x,25))
        sheet.paste(tile.resize((288,288),Image.Resampling.NEAREST).convert('RGB'), (x+101,25))
    sheet.save(ROOT / ('backward-windup-'+theme+'.png'))
facts = {}
for folder in ['poses','actions']:
    for p in sorted((ROOT/folder).glob('*.pxgrid')):
        old = (archive/folder/p.name).read_bytes()
        current = p.read_bytes()
        before, after = old.decode().splitlines(), current.decode().splitlines()
        differences = [(x,y) for y in range(96) for x in range(96) if before[y][x]!=after[y][x]]
        facts[p.stem] = {'before_sha256':hashlib.sha256(old).hexdigest(),
                         'current_sha256':hashlib.sha256(current).hexdigest(),
                         'changed_pixels':len(differences),
                         'changed_bounds':[min(x for x,y in differences),min(y for x,y in differences),max(x for x,y in differences),max(y for x,y in differences)] if differences else None}
(ROOT/'backward-windup-facts.json').write_text(json.dumps({'palette_unchanged':(archive/'palette.json').read_bytes()==(ROOT/'palette.json').read_bytes(),'frames':facts},indent=2)+'\n')
print('Saved observation plates and source differences; no verdict.')

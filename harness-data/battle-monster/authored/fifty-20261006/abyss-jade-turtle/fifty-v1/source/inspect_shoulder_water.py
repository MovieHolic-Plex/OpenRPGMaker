"""Read literal artwork and render labeled comparisons. Never alters grids."""
from pathlib import Path
import json
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent
OUT = ROOT / 'previews'
palette = json.loads((ROOT / 'palette.json').read_text())
colors = {s: tuple(bytes.fromhex(c[1:])) + (255,) for s, c in palette.items()}
colors['.'] = (0, 0, 0, 0)

def decode(path):
    rows = path.read_text().splitlines()
    im = Image.new('RGBA', (128, 128))
    im.putdata([colors[c] for row in rows for c in row])
    return im

def bg(kind):
    im = Image.new('RGBA', (128, 128), '#EEE9D9' if kind == 'light' else '#121D29')
    if kind == 'checker':
        draw = ImageDraw.Draw(im)
        for y in range(0, 128, 8):
            for x in range(0, 128, 8):
                draw.rectangle((x,y,x+7,y+7), fill='#697583' if (x//8+y//8)%2 else '#9AA5AE')
    return im

stats = {}
comparison = Image.new('RGB', (800, 850), '#253340')
cd = ImageDraw.Draw(comparison)
for index, (name, folder) in enumerate([('attack', 'poses'), ('skill_b', 'actions')]):
    current = decode(ROOT / folder / (name+'.pxgrid'))
    old = decode(ROOT / 'revisions/before-shoulder-water' / folder / (name+'.pxgrid'))
    sheet = Image.new('RGB', (1200, 576), '#253340')
    draw = ImageDraw.Draw(sheet)
    for i, kind in enumerate(['light', 'dark', 'checker']):
        panel = bg(kind)
        panel.alpha_composite(current)
        sheet.paste(panel, (i*400+8,24))
        draw.text((i*400+8,6), name+' / '+kind+' / native 1x',fill='white')
        sheet.paste(panel.resize((384,384),Image.Resampling.NEAREST), (i*400+8,184))
        draw.text((i*400+8,164),'nearest 3x',fill='white')
    sheet.save(OUT / (name+'-shoulder-water.png'))
    for i, (version, im) in enumerate([('before', old), ('after', current)]):
        panel = bg('light');panel.alpha_composite(im)
        comparison.paste(panel.resize((384,384),Image.Resampling.NEAREST), (i*400+8,index*425+26))
        cd.text((i*400+8,index*425+8), name+' / '+version,fill='white')
    diffs = [(x,y) for y in range(128) for x in range(128) if old.getpixel((x,y)) != current.getpixel((x,y))]
    stats[name] = {'changedPixels': len(diffs), 'changedBounds': [min(x for x,y in diffs),min(y for x,y in diffs),max(x for x,y in diffs),max(y for x,y in diffs)]}
comparison.save(OUT / 'shoulder-water-before-after.png')
stats['paletteUnchanged'] = (ROOT/'palette.json').read_bytes() == (ROOT/'revisions/before-shoulder-water/palette.json').read_bytes()
stats['attackFeetRows109to127Unchanged'] = (ROOT/'poses/attack.pxgrid').read_text().splitlines()[109:] == (ROOT/'revisions/before-shoulder-water/poses/attack.pxgrid').read_text().splitlines()[109:]
stats['files'] = {}
for folder in ['poses','actions']:
    for path in sorted((ROOT/folder).glob('*.pxgrid')):
        rows = path.read_text().splitlines()
        ink = [(x,y) for y,row in enumerate(rows) for x,c in enumerate(row) if c!='.']
        stats['files'][path.stem] = {'rows':len(rows),'rowLengths':sorted(set(map(len,rows))), 'inkBounds':[min(x for x,y in ink),min(y for x,y in ink),max(x for x,y in ink),max(y for x,y in ink)], 'unknownSymbols':sorted(set(''.join(rows))-set(colors))}
stats['gifHoldsMs'] = {}
for name in ['idle','attack','hit','dead','skill','poison','stun','sleep']:
    gif = Image.open(OUT/(name+'.gif'))
    holds = []
    for i in range(gif.n_frames):
        gif.seek(i);holds.append(gif.info.get('duration'))
    stats['gifHoldsMs'][name] = holds
(OUT/'shoulder-water-observations.json').write_text(json.dumps(stats,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:v for k,v in stats.items() if k!='files'},indent=2))

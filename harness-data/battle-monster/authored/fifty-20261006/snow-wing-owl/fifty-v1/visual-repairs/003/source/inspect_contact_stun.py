"""Read saved literals and make labeled before/after inspection images only."""
import hashlib
import json
from PIL import Image, ImageDraw
from render import ROOT, COLORS, POSES, ACTIONS, read_image, background

backup = ROOT / 'before-contact-stun-repair'
report = {}
for name in POSES + ACTIONS:
    folder = 'poses' if name in POSES else 'actions'
    path = ROOT / folder / (name + '.pxgrid')
    before = (backup / folder / path.name).read_text().splitlines()
    after = path.read_text().splitlines()
    differences = [(x,y) for y in range(64) for x in range(64)
                   if before[y][x] != after[y][x]]
    report[name] = {
        'changedPixels': len(differences),
        'changedBounds': [min(x for x,y in differences), min(y for x,y in differences),
                          max(x for x,y in differences), max(y for x,y in differences)]
                         if differences else None,
        'currentGridSha256': hashlib.sha256(path.read_bytes()).hexdigest(),
        'sameFileBytes': path.read_bytes() == (backup / folder / path.name).read_bytes(),
    }
(ROOT / 'inspection' / 'contact-stun-readback.json').write_text(json.dumps(report, indent=2)+'\n')

names = ['attack', 'stun_a', 'stun_b']
for kind in ['light', 'dark', 'checker']:
    sheet = background(kind, 590, 3*242)
    draw = ImageDraw.Draw(sheet)
    ink = '#24313f' if kind == 'light' else '#ffffff'
    for i,name in enumerate(names):
        folder = 'poses' if name == 'attack' else 'actions'
        rows = (backup / folder / (name+'.pxgrid')).read_text().splitlines()
        original = Image.new('RGBA', (64,64))
        original.putdata([COLORS.get(c,(0,0,0,0)) for row in rows for c in row])
        for j,im in enumerate([original, read_image(name)]):
            x,y = j*294, i*242
            draw.text((x+6,y+5), name+(' before' if j==0 else ' after')+' / 1x + 3x', fill=ink)
            sheet.alpha_composite(im, (x+6,y+32))
            sheet.alpha_composite(im.resize((192,192), Image.Resampling.NEAREST), (x+82,y+32))
    sheet.convert('RGB').save(ROOT / 'inspection' / ('contact-stun-'+kind+'.png'))

print(json.dumps({name:report[name] for name in names}, ensure_ascii=False))
print('Unchanged other frames:', sum(report[name]['sameFileBytes'] for name in POSES+ACTIONS if name not in names))

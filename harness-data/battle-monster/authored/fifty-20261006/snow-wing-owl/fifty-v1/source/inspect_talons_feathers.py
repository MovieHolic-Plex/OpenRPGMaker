"""Read-back diagnostics only: existing pixels, labels, nearest enlargement."""
import hashlib
import json
from PIL import Image, ImageDraw
from render import ROOT, COLORS, POSES, ACTIONS, read_image, background

backup = ROOT / 'before-talons-feathers-repair'
report = {}
for name in POSES + ACTIONS:
    folder = 'poses' if name in POSES else 'actions'
    path = ROOT / folder / (name+'.pxgrid')
    before = (backup / folder / path.name).read_text().splitlines()
    after = path.read_text().splitlines()
    changes = [(x,y) for y in range(64) for x in range(64) if before[y][x] != after[y][x]]
    report[name] = {
        'changedPixels': len(changes),
        'changedBounds': [min(x for x,y in changes), min(y for x,y in changes),
                          max(x for x,y in changes), max(y for x,y in changes)] if changes else None,
        'gridSha256': hashlib.sha256(path.read_bytes()).hexdigest(),
        'unchangedBytes': path.read_bytes() == (backup / folder / path.name).read_bytes(),
    }
report['paletteUnchangedBytes'] = (ROOT/'palette.json').read_bytes() == (backup/'palette.json').read_bytes()
(ROOT/'inspection'/'talons-feathers-readback.json').write_text(json.dumps(report,indent=2)+'\n')

for kind in ['light', 'dark', 'checker']:
    sheet = background(kind, 700, 488)
    draw = ImageDraw.Draw(sheet)
    ink = '#24313f' if kind == 'light' else '#ffffff'
    for i,name in enumerate(['attack','skill_b']):
        folder = 'poses' if name == 'attack' else 'actions'
        rows = (backup / folder / (name+'.pxgrid')).read_text().splitlines()
        before = Image.new('RGBA',(64,64))
        before.putdata([COLORS.get(c,(0,0,0,0)) for row in rows for c in row])
        for j,im in enumerate([before,read_image(name)]):
            x,y = j*350,i*244
            draw.text((x+6,y+5),name+(' before' if j == 0 else ' after')+' / native 1x + 3x',fill=ink)
            sheet.alpha_composite(im,(x+6,y+32))
            sheet.alpha_composite(im.resize((192,192),Image.Resampling.NEAREST),(x+88,y+32))
    sheet.convert('RGB').save(ROOT/'inspection'/('talons-feathers-'+kind+'.png'))

sheet = background('checker',640,488)
draw = ImageDraw.Draw(sheet)
draw.text((8,8),'attack x=35..62 / y=49..59 (diagnostic 10x)',fill='#ffffff')
sheet.alpha_composite(read_image('attack').crop((35,49,63,60)).resize((280,110),Image.Resampling.NEAREST),(8,32))
draw.text((8,165),'skill_b x=46..62 / y=9..44 (diagnostic 8x)',fill='#ffffff')
sheet.alpha_composite(read_image('skill_b').crop((46,9,63,45)).resize((136,288),Image.Resampling.NEAREST),(8,184))
sheet.convert('RGB').save(ROOT/'inspection'/'talons-feathers-details.png')
print(json.dumps({name:report[name] for name in ['attack','skill_b']},indent=2))
print('Other native frames unchanged:',sum(report[name]['unchangedBytes'] for name in POSES+ACTIONS if name not in ['attack','skill_b']))
print('Palette unchanged:',report['paletteUnchangedBytes'])

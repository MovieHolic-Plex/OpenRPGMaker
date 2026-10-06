"""Read literal originals/current files and draw inspection crops only."""
import json
from PIL import Image, ImageDraw
from render import ROOT, COLORS, POSES, ACTIONS, background, read_image

originals = {}
name = None
for line in (ROOT / 'original-before-repair' / 'authored-rows.txt').read_text().splitlines():
    if line.startswith('['):
        name = line[1:-1]
        originals[name] = [list('.' * 64) for _ in range(64)]
    elif line and line[0].isdigit():
        y, x, run = line.split()
        originals[name][int(y)][int(x):int(x)+len(run)] = run

report = {}
for name in POSES + ACTIONS:
    folder = 'poses' if name in POSES else 'actions'
    current = (ROOT / folder / (name+'.pxgrid')).read_text().splitlines()
    old = [''.join(row) for row in originals[name]]
    changed = [(x,y) for y in range(64) for x in range(64) if old[y][x] != current[y][x]]
    report[name] = {
        'differentPixels': len(changed),
        'changedBounds': [min(x for x,y in changed), min(y for x,y in changed),
                          max(x for x,y in changed), max(y for x,y in changed)] if changed else None,
    }
(ROOT / 'inspection' / 'repair-readback.json').write_text(json.dumps(report,indent=2)+'\n')

canvas = background('light',520,300)
draw = ImageDraw.Draw(canvas)
for i,(name,box) in enumerate([('attack',(34,48,64,59)),('skill_b',(43,24,64,55))]):
    old = Image.new('RGBA',(64,64))
    old.putdata([COLORS.get(c,(0,0,0,0)) for row in originals[name] for c in row])
    for j,im in enumerate([old,read_image(name)]):
        x = j*260
        draw.text((x+4,i*140+3),name+(' original' if j==0 else ' repaired'),fill='#24313f')
        crop = im.crop(box)
        canvas.alpha_composite(crop.resize((crop.width*4,crop.height*4),Image.Resampling.NEAREST),
                               (x+6,i*140+19))
canvas.convert('RGB').save(ROOT / 'inspection' / 'repair-details.png')

measurements = json.loads((ROOT / 'inspection' / 'measurements.json').read_text())
print('Original/current literal pixel differences:', json.dumps(report))
print('PNG different pixels:', sum(f['pngDifferentPixels'] for f in measurements['frames'].values()))
print('GIF different visible pixels:', sum(f['differentVisiblePixels']
    for frames in measurements['gifReadback'].values() for f in frames))

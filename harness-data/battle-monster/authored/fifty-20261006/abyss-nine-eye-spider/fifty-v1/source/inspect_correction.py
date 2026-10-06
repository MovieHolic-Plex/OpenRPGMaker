"""Display saved native grids; label/crop/nearest-enlarge for inspection only.

No image pixels are transferred back into source grids. Source facts are not
a reviewer decision or a user selection.
"""
from pathlib import Path
from PIL import Image, ImageDraw
import json
import hashlib

ROOT = Path(__file__).resolve().parent
P = ROOT / 'preview'
names = ['windup','move','attack','recover','poison_a','poison_b','sleep_a','sleep_b']
native = Image.new('RGB', (8*144,3*150), '#e6dfcf')
d = ImageDraw.Draw(native)
for i, name in enumerate(names):
    im = Image.open(P/(name+'.png')).convert('RGBA')
    for j, bg in enumerate(['#e6dfcf','#252733','#989aa0']):
        x, y = i*144, j*150
        d.rectangle((x,y,x+143,y+149), fill=bg)
        if j == 2:
            for yy in range(128):
                for xx in range(128):
                    if (xx//8+yy//8)%2:
                        d.point((x+xx,y+18+yy), fill='#c9c7c4')
        d.text((x+2,y+2),name,fill='#15121f' if j==0 else '#faf0da')
        native.paste(im,(x,y+18),im)
native.save(P/'correction-native.png')
detail = Image.new('RGB',(800,800),'#e6dfcf')
d = ImageDraw.Draw(detail)
for i,(name,box) in enumerate([
    ('attack',(63,57,115,99)),('attack',(98,106,121,122)),
    ('poison_a',(54,60,94,106)),('poison_b',(54,60,94,106)),
]):
    im = Image.open(P/(name+'.png')).crop(box).resize(
        ((box[2]-box[0])*6,(box[3]-box[1])*6),Image.Resampling.NEAREST)
    x,y = i%2*400,i//2*400
    detail.paste(im,(x,y+30),im)
    d.text((x+3,y+4),name+' '+str(box),fill='#15121f')
detail.save(P/'correction-detail.png')

comparison = Image.new('RGB',(800,1600),'#e6dfcf')
d = ImageDraw.Draw(comparison)
for i,name in enumerate(['attack','poison_a','poison_b','sleep_a']):
    for j,folder in enumerate([ROOT/'before-review-correction'/'preview',P]):
        im = Image.open(folder/(name+'.png')).resize((384,384),Image.Resampling.NEAREST)
        comparison.paste(im,(j*400,i*400+16),im)
        d.text((j*400+2,i*400+2),name+(' before' if j==0 else ' current'),fill='#15121f')
comparison.save(P/'correction-comparison.png')

palette = json.loads((ROOT/'palette.json').read_text())
report = {'palette_unchanged': (ROOT/'palette.json').read_bytes()==(ROOT/'before-review-correction'/'palette.json').read_bytes(),
          'colors':len(palette),'frames':{}}
for path in sorted([*(ROOT/'poses').glob('*.pxgrid'),*(ROOT/'actions').glob('*.pxgrid')]):
    rows = path.read_text().splitlines()
    previous = (ROOT/'before-review-correction'/path.relative_to(ROOT)).read_text().splitlines()
    ink = [(x,y) for y,row in enumerate(rows) for x,c in enumerate(row) if c!='.']
    differences = [(x,y) for y,row in enumerate(rows) for x,c in enumerate(row) if c!=previous[y][x]]
    report['frames'][path.stem] = {
        'rows':len(rows),'widths':sorted(set(map(len,rows))),
        'symbols':sorted(set(''.join(rows))),
        'ink_bounds':[min(x for x,y in ink),min(y for x,y in ink),max(x for x,y in ink),max(y for x,y in ink)],
        'transparent_border':all(x not in (0,127) and y not in (0,127) for x,y in ink),
        'changed_pixels':len(differences),
        'changed_bounds':[min(x for x,y in differences),min(y for x,y in differences),max(x for x,y in differences),max(y for x,y in differences)] if differences else None,
        'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),
    }
report['distinct_grid_hashes'] = len(set(f['sha256'] for f in report['frames'].values()))
report['sleep_removed_pixels'] = {str(y): (ROOT/'actions/sleep_a.pxgrid').read_text().splitlines()[y][88] for y in (107,108)}
(P/'correction-facts.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({'palette_unchanged':report['palette_unchanged'],
 'frames':len(report['frames']),'distinct_grid_hashes':report['distinct_grid_hashes'],
 'changed':{n:f['changed_pixels'] for n,f in report['frames'].items() if f['changed_pixels']},
 'ink_bottoms':sorted(set(f['ink_bounds'][3] for f in report['frames'].values())),
 'removed_sleep_pixels':report['sleep_removed_pixels']},indent=2))

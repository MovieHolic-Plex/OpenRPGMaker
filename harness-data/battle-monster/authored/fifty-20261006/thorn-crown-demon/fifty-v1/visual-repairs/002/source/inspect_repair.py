"""Read-only pixel diagnostics and labelled preview layouts.

No grid creation, shape rendering, pose transforms or automatic repairs.
Nearest-neighbour enlargement is exclusively for the inspection sheets.
"""
from pathlib import Path
import hashlib
import json
from PIL import Image, ImageDraw
from render import ROOT, NAMES

report = {'scope': 'source only', 'frames': {}, 'paletteUnchanged': False}
report['paletteUnchanged'] = (
    (ROOT / 'palette.json').read_bytes()
    == (ROOT / 'before-arm-repair/palette.json').read_bytes())
for name in NAMES:
    folder = 'poses' if name in NAMES[:9] else 'actions'
    p = ROOT / folder / (name + '.pxgrid')
    rows = p.read_text().splitlines()
    original = (ROOT / 'before-arm-repair' / folder / p.name).read_text().splitlines()
    changes = [(x, y) for y, row in enumerate(rows)
               for x, symbol in enumerate(row) if symbol != original[y][x]]
    ink = [(x, y) for y, row in enumerate(rows)
           for x, symbol in enumerate(row) if symbol != '.']
    info = {
        'rows': len(rows), 'rowWidths': sorted(set(map(len, rows))),
        'changedPixels': len(changes),
        'inkExtentsInclusive': [min(x for x,y in ink), min(y for x,y in ink),
                               max(x for x,y in ink), max(y for x,y in ink)],
        'edgeInk': [[x,y] for x,y in ink if x in (0,95) or y in (0,95)],
        'bottomInkY': max(y for x,y in ink),
        'sha256': hashlib.sha256(p.read_bytes()).hexdigest(),
    }
    if changes:
        info['changeExtentsInclusive'] = [min(x for x,y in changes), min(y for x,y in changes),
                                         max(x for x,y in changes), max(y for x,y in changes)]
    report['frames'][name] = info
(ROOT / 'rendered/REPAIR-READBACK.json').write_text(json.dumps(report, indent=2) + '\n')

# Both native and enlarged views on all three backgrounds.
for scale in (1, 3):
    for bg in ('light', 'dark', 'checker'):
        cell = 96 * scale
        stride = cell + 22
        base = (238,231,217) if bg == 'light' else (27,26,34)
        sheet = Image.new('RGB', (6*cell, 3*stride), base)
        draw = ImageDraw.Draw(sheet)
        for i, name in enumerate(NAMES):
            x, y = i%6*cell, i//6*stride
            if bg == 'checker':
                step = 8*scale
                for by in range(0, cell, step):
                    for bx in range(0, cell, step):
                        c = (190,181,173) if (bx//step+by//step)%2 else (220,211,203)
                        draw.rectangle((x+bx,y+by,x+bx+step-1,y+by+step-1), fill=c)
            im = Image.open(ROOT / 'rendered' / (name+'.png')).convert('RGBA')
            if scale != 1:
                im = im.resize((cell,cell), Image.Resampling.NEAREST)
            sheet.paste(im, (x,y), im)
            draw.text((x+2,y+cell+3),name,fill=(120,114,116) if bg=='light' else (220,213,203))
        sheet.save(ROOT / 'rendered' / f'all-{bg}-{scale}x.png')

names = ['idle_a','idle_b','idle_c','move','attack','recover']
detail = Image.new('RGB',(6*384,430),(230,224,214))
draw = ImageDraw.Draw(detail)
for i,name in enumerate(names):
    im = Image.open(ROOT / 'rendered' / (name+'.png')).convert('RGBA')
    enlarged = im.crop((44,40,92,88)).resize((384,384),Image.Resampling.NEAREST)
    detail.paste(enlarged,(i*384,0),enlarged)
    draw.text((i*384+3,391),name+' crop x44 y40',fill=(45,35,45))
detail.save(ROOT / 'rendered/repair-after-detail.png')
print(json.dumps({'changed': {name: frame['changedPixels'] for name,frame in report['frames'].items()
                              if frame['changedPixels']},
                  'preservedFrames': sum(frame['changedPixels']==0 for frame in report['frames'].values()),
                  'paletteUnchanged': report['paletteUnchanged']},indent=2))

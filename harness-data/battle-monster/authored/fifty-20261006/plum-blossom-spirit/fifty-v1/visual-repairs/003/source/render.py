"""Read literal grids, export native PNG/GIF and diagnostic nearest-neighbor panels.

No art generation, frame motion, color synthesis or automatic grid correction.
"""
from pathlib import Path
from PIL import Image, ImageDraw
import json, hashlib

ROOT = Path(__file__).resolve().parent
PAL = json.loads((ROOT/'palette.json').read_text())
POSES = ['idle_a','idle_b','idle_c','windup','move','attack','recover','hit','dead']
ACTIONS = ['skill_a','skill_b','skill_c','poison_a','poison_b','stun_a','stun_b','sleep_a','sleep_b']
ORDER = POSES + ACTIONS
CLIPS = {
    'idle': [('idle_a',240),('idle_b',240),('idle_c',240)],
    'attack': [('idle_a',240),('windup',260),('move',140),('attack',180),('recover',220),('idle_a',300)],
    'hit': [('idle_a',240),('hit',260),('recover',220),('idle_a',300)],
    'dead': [('idle_a',240),('hit',200),('dead',1100)],
    'skill': [('idle_a',240),('skill_a',420),('skill_b',260),('skill_c',380),('idle_a',300)],
    'poison': [('poison_a',380),('poison_b',380)],
    'stun': [('stun_a',440),('stun_b',440)],
    'sleep': [('sleep_a',600),('sleep_b',600)],
}

def backdrop(kind, size):
    im = Image.new('RGBA', size, '#e2dbc9' if kind=='light' else '#252534')
    if kind=='checker':
        for y in range(size[1]):
            for x in range(size[0]):
                im.putpixel((x,y), (160,157,162,255) if (x//8+y//8)%2 else (208,205,206,255))
    return im

images, indexed, report = {}, {}, {}
palette_bytes = [0,0,0]
for color in PAL.values():
    palette_bytes.extend(bytes.fromhex(color[1:]))
palette_bytes += [0] * (768-len(palette_bytes))
symbols = {c:i+1 for i,c in enumerate(PAL)}
for name in ORDER:
    path = ROOT/('poses' if name in POSES else 'actions')/f'{name}.pxgrid'
    raw = path.read_text()
    grid = raw.splitlines()
    assert len(grid)==96 and all(len(row)==96 for row in grid), name
    assert set(''.join(grid)) <= set(PAL)|{'.'}, name
    assert all(c=='.' for c in grid[0]+grid[-1]), name
    assert all(row[0]==row[-1]=='.' for row in grid), name
    bottom = max(y for y,row in enumerate(grid) if any(c!='.' for c in row))
    assert bottom<=92, (name,bottom)
    if name=='idle_a': assert bottom==92
    im = Image.new('RGBA',(96,96))
    pi = Image.new('P',(96,96))
    pi.putpalette(palette_bytes)
    for y,row in enumerate(grid):
        for x,c in enumerate(row):
            if c!='.':
                im.putpixel((x,y),tuple(bytes.fromhex(PAL[c][1:]))+(255,))
                pi.putpixel((x,y),symbols[c])
    im.save(ROOT/'png'/f'{name}.png')
    images[name],indexed[name] = im,pi
    report[name] = {'gridSha256':hashlib.sha256(raw.encode()).hexdigest(),
                    'rgbaSha256':hashlib.sha256(im.tobytes()).hexdigest(),
                    'lowestInkY':bottom,'colorsUsed':len(set(''.join(grid))-{'.'})}

sheet = Image.new('RGBA',(288,576))
for i,name in enumerate(ORDER):
    sheet.alpha_composite(images[name],(i%3*96,i//3*96))
sheet.save(ROOT/'png'/'all-18.png')
for kind in ['light','dark','checker']:
    plate = backdrop(kind,(288,624))
    d=ImageDraw.Draw(plate)
    for i,name in enumerate(ORDER):
        x,y=i%3*96,i//3*104
        plate.alpha_composite(images[name],(x,y))
        d.text((x+2,y+94),name,fill='#251d2b' if kind!='dark' else '#fff1d7')
    plate.save(ROOT/'diagnostics'/f'all-18-{kind}-1x.png')
    plate.resize((864,1872),Image.Resampling.NEAREST).save(ROOT/'diagnostics'/f'all-18-{kind}-3x.png')

for clip,seq in CLIPS.items():
    ims = [indexed[name].copy() for name,ms in seq]
    ims[0].save(ROOT/'gif'/f'{clip}.gif',save_all=True,append_images=ims[1:],
                duration=[ms for name,ms in seq],loop=0,transparency=0,disposal=2,optimize=False)
    # Decode the actual GIF for the filmstrip; don't substitute the input PNGs.
    gif = Image.open(ROOT/'gif'/f'{clip}.gif')
    strip=backdrop('checker',(96*len(seq),104))
    d=ImageDraw.Draw(strip)
    for i,(name,ms) in enumerate(seq):
        gif.seek(i)
        frame=gif.convert('RGBA')
        strip.alpha_composite(frame,(i*96,0))
        d.text((i*96+2,94),f'{name} {gif.info.get("duration")}ms',fill='#251d2b')
    strip.resize((strip.width*3,312),Image.Resampling.NEAREST).save(ROOT/'diagnostics'/f'gif-{clip}-decoded.png')

(ROOT/'diagnostics'/'format-report.json').write_text(json.dumps({
    'cell':96,'paletteColors':len(PAL),'frames':report,'clips':CLIPS,
    'note':'Format and export diagnostics only. No independent visual verdict or user selection.'
},indent=2)+'\n')
print('Wrote 18 native PNGs, 3×6 sheet, 8 native GIFs and three diagnostic backgrounds.')

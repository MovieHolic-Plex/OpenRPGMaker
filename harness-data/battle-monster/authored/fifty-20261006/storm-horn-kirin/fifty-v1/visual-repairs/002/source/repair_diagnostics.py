"""Read-only comparison/format facts. Backgrounds and enlargement are diagnostics.

No artwork generation or pixel repair occurs in this file. All pixel decisions
are literal runs in the three repair records and full rows in the native grids.
"""
from pathlib import Path
import hashlib
import json
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent
OUT = ROOT / 'previews'
NAMES = ['idle_a', 'idle_b', 'idle_c', 'windup', 'move', 'attack',
         'recover', 'hit', 'dead', 'skill_a', 'skill_b', 'skill_c',
         'poison_a', 'poison_b', 'stun_a', 'stun_b', 'sleep_a', 'sleep_b']
FOCUS = ['idle_a', 'idle_b', 'idle_c', 'recover', 'skill_a',
         'windup', 'attack', 'sleep_a', 'sleep_b']

def read_grid(name, prior=False):
    base = ROOT / 'prior-draft' if prior else ROOT
    folder = 'poses' if name in NAMES[:9] else 'actions'
    return (base / folder / (name + '.pxgrid')).read_text().splitlines()

def paint(rows, palette):
    im = Image.new('RGBA', (128, 128))
    im.putdata([palette[c] if c != '.' else (0, 0, 0, 0)
                for row in rows for c in row])
    return im

def background(size, bg):
    im = Image.new('RGB', size, '#EEE7DA' if bg == 'light' else '#1D2636')
    if bg == 'checker':
        d = ImageDraw.Draw(im)
        for y in range(0, size[1], 8):
            for x in range(0, size[0], 8):
                d.rectangle((x, y, x+7, y+7),
                            fill='#384454' if (x//8+y//8) % 2 else '#647084')
    return im

def main():
    palette_json = json.loads((ROOT/'palette.json').read_text())
    palette = {k: tuple(bytes.fromhex(v[1:]))+(255,) for k,v in palette_json.items()}
    current = {name: read_grid(name) for name in NAMES}
    old = {name: read_grid(name, True) for name in NAMES}
    facts = {'paletteUnchanged': (ROOT/'palette.json').read_bytes() ==
             (ROOT/'prior-draft/palette.json').read_bytes(), 'frames': {}}
    for name, rows in current.items():
        ink = [(x,y) for y,row in enumerate(rows) for x,c in enumerate(row) if c!='.']
        facts['frames'][name] = {
            'changedPixels': sum(a!=b for ra,rb in zip(old[name],rows) for a,b in zip(ra,rb)),
            'rows': len(rows), 'rowWidths': sorted(set(map(len, rows))),
            'unknownSymbols': sorted(set(''.join(rows))-set(palette_json)-{'.'}),
            'borderInk': [(x,y) for x,y in ink if x<1 or x>126 or y<1 or y>124],
            'lowestInkY': max(y for x,y in ink),
            'gridSha256': hashlib.sha256(('\n'.join(rows)+'\n').encode()).hexdigest(),
        }
    (OUT/'repair-facts.json').write_text(json.dumps(facts,indent=2)+'\n')
    for bg in ['light','dark','checker']:
        textcolor = '#18232B' if bg=='light' else 'white'
        native=background((864,450),bg);d=ImageDraw.Draw(native)
        for i,name in enumerate(NAMES):
            x,y=(i%6)*144,(i//6)*150
            im=paint(current[name],palette);native.paste(im,(x,y+18),im)
            d.text((x+2,y+2),name,fill=textcolor)
        native.save(OUT/(bg+'-1x.png'))
        compare=background((864,810),bg);d=ImageDraw.Draw(compare)
        for i,name in enumerate(FOCUS):
            x,y=(i%3)*288,(i//3)*270
            for side,rows in enumerate([old[name],current[name]]):
                im=paint(rows,palette);compare.paste(im,(x+side*144,y+18),im)
                d.text((x+side*144+2,y+2),name+(' prior' if side==0 else ' current'),fill=textcolor)
        compare.save(OUT/('repair-comparison-'+bg+'-1x.png'))
        four=background((1576,430),bg);d=ImageDraw.Draw(four)
        for i,name in enumerate(['windup','attack','sleep_a','sleep_b']):
            im=paint(current[name],palette).resize((384,384),Image.Resampling.NEAREST)
            four.paste(im,(i*394,24),im);d.text((i*394+3,5),name,fill=textcolor)
        four.save(OUT/('repair-'+bg+'-3x.png'))
    print('Rendered read-only native comparisons and current file facts.')

if __name__ == '__main__':
    main()

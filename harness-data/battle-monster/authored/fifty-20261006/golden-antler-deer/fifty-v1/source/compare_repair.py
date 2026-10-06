"""Read-only comparison of literal grids. Output is diagnostic PNG/JSON only.
Nearest-neighbor enlargement and text labels never feed back into source grids.
"""
from pathlib import Path
import json
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent
palette = json.loads((ROOT / 'palette.json').read_text())
rgb = {s: tuple(bytes.fromhex(color[1:])) for s, color in palette.items()}
originals = ROOT / 'original-before-three-quarter-repair'
out = ROOT / 'previews'
names = ['idle_a','idle_b','idle_c','windup','move','attack','recover','hit','dead',
         'skill_a','skill_b','skill_c','poison_a','poison_b','stun_a','stun_b','sleep_a','sleep_b']

def decode(rows):
    im = Image.new('RGBA', (64,64))
    im.putdata([(0,0,0,0) if s == '.' else (*rgb[s],255) for row in rows for s in row])
    return im

report = {'palette_bytes_preserved': (ROOT/'palette.json').read_bytes() == (originals/'palette.json').read_bytes(),
          'frames': {}}
for name in names:
    folder = 'poses' if name in names[:9] else 'actions'
    old = (originals/folder/(name+'.pxgrid')).read_text().splitlines()
    new = (ROOT/folder/(name+'.pxgrid')).read_text().splitlines()
    changed = [(x,y) for y in range(64) for x in range(64) if old[y][x] != new[y][x]]
    ink = [(x,y) for y in range(64) for x in range(64) if new[y][x] != '.']
    report['frames'][name] = {
        'changed_native_pixels': len(changed),
        'changed_bbox_inclusive': [min(x for x,y in changed), min(y for x,y in changed),
                                   max(x for x,y in changed), max(y for x,y in changed)],
        'rows':len(new), 'row_widths':sorted(set(map(len,new))),
        'lowest_ink_y':max(y for x,y in ink),
        'border_ink':[(x,y) for x,y in ink if x in (0,63) or y in (0,63)]}
    # Paired native and 4x images for each frame.
    sheet = Image.new('RGB',(536,368),'#eee6d7')
    d = ImageDraw.Draw(sheet)
    for i,(label,rows) in enumerate([('original',old),('revision',new)]):
        im=decode(rows)
        d.text((i*268+4,4),name+' / '+label,fill='#302326')
        sheet.paste(im,(i*268+4,24),im)
        enlarged=im.resize((256,256),Image.Resampling.NEAREST)
        sheet.paste(enlarged,(i*268+4,104),enlarged)
    sheet.save(out/(name+'-comparison.png'))
(out/'repair-report.json').write_text(json.dumps(report,indent=2)+'\n')
print('Saved paired diagnostic PNGs for',len(names),'frames; palette bytes preserved:',report['palette_bytes_preserved'])

if __name__ == '__main__':
    # Work is performed above: this helper never writes art originals.
    pass

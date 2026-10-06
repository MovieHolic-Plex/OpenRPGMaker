"""Read-only art measurements and actual GIF decode sheets; does not judge quality."""
from pathlib import Path
from PIL import Image,ImageDraw
import json,hashlib
ROOT=Path(__file__).resolve().parent
palette=json.loads((ROOT/'palette.json').read_text())
results={}
for p in sorted([*ROOT.glob('poses/*.pxgrid'),*ROOT.glob('actions/*.pxgrid')]):
    rows=p.read_text().splitlines()
    assert len(rows)==96 and all(len(row)==96 for row in rows)
    assert set(''.join(rows))<=set(palette)|{'.'}
    ink={(x,y) for y,row in enumerate(rows) for x,ch in enumerate(row) if ch!='.'}
    assert all(1<=x<=94 and 1<=y<=92 for x,y in ink)
    if p.stem=='idle_a':assert max(y for x,y in ink)==92
    remain=set(ink);parts=[]
    while remain:
        seed=remain.pop();stack=[seed];pts=[seed]
        while stack:
            x,y=stack.pop()
            for dx,dy in [(1,0),(-1,0),(0,1),(0,-1)]:
                q=(x+dx,y+dy)
                if q in remain:remain.remove(q);stack.append(q);pts.append(q)
        parts.append({'pixels':len(pts),'bounds':[min(x for x,y in pts),min(y for x,y in pts),max(x for x,y in pts),max(y for x,y in pts)]})
    parts.sort(key=lambda a:-a['pixels'])
    results[p.stem]={'ink':len(ink),'bounds':[min(x for x,y in ink),min(y for x,y in ink),max(x for x,y in ink),max(y for x,y in ink)],'components4':parts,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}
assert len(results)==18 and len({r['sha256'] for r in results.values()})==18
(ROOT/'pixel-diagnostics.json').write_text(json.dumps(results,indent=2)+'\n')
canvas=Image.new('RGB',(6*198,8*225),(36,40,48));draw=ImageDraw.Draw(canvas)
info={}
for row,name in enumerate(['idle','attack','hit','dead','skill','poison','stun','sleep']):
    with Image.open(ROOT/'gifs'/f'{name}.gif') as gif:
        holds=[]
        for i in range(gif.n_frames):
            gif.seek(i);holds.append(gif.info['duration'])
            tile=Image.new('RGBA',(96,96),(226,216,199,255));tile.alpha_composite(gif.convert('RGBA'))
            x=i*198+3;y=row*225+27
            canvas.paste(tile.convert('RGB').resize((192,192),Image.Resampling.NEAREST),(x,y))
            draw.text((x,y-20),f'{name} {i+1} / {holds[-1]}ms',fill='white')
        info[name]={'frames':gif.n_frames,'holds_ms':holds}
canvas.save(ROOT/'gif-decoded-contact.png')
(ROOT/'gif-decoded.json').write_text(json.dumps(info,indent=2)+'\n')
# Native all-motion contact for quick order inspection, no scaling.
native=Image.new('RGB',(6*106,8*119),(226,216,199));draw=ImageDraw.Draw(native)
for row,name in enumerate(info):
    with Image.open(ROOT/'gifs'/f'{name}.gif') as gif:
        for i in range(gif.n_frames):
            gif.seek(i)
            tile=Image.new('RGBA',(96,96),(226,216,199,255));tile.alpha_composite(gif.convert('RGBA'))
            x=i*106+3;y=row*119+19
            native.paste(tile.convert('RGB'),(x,y));draw.text((x,y-16),f'{name} {i+1}',fill=(30,30,30))
native.save(ROOT/'gif-decoded-native.png')
print('18 distinct 96x96 literal sources; 18 palette entries; idle_a sole y=92. Eight GIFs decoded.')
for name in ['poison_b','stun_a','stun_b']:
    print(name,'component sizes', [part['pixels'] for part in results[name]['components4']])

"""Read literal grids; bake exact RGBA, nearest-neighbour diagnosis and GIFs only."""
from pathlib import Path
from PIL import Image, ImageDraw
import json
ROOT=Path(__file__).resolve().parent
palette=json.loads((ROOT/'palette.json').read_text())
colors={ch:tuple(bytes.fromhex(rgb[1:]))+(255,) for ch,rgb in palette.items()}
frames={}
for p in sorted(list((ROOT/'poses').glob('*.pxgrid'))+list((ROOT/'actions').glob('*.pxgrid'))):
    rows=p.read_text().splitlines()
    assert len(rows)==96 and all(len(r)==96 for r in rows),p
    im=Image.new('RGBA',(96,96))
    im.putdata([colors.get(ch,(0,0,0,0)) for row in rows for ch in row])
    im.save(ROOT/'png'/f'{p.stem}.png')
    frames[p.stem]=im
order=['idle_a','idle_b','idle_c','windup','move','attack','recover','hit','dead','skill_a','skill_b','skill_c','poison_a','poison_b','stun_a','stun_b','sleep_a','sleep_b']
names=[n for n in order if n in frames]
for theme,bg in [('light',(230,220,201,255)),('dark',(27,31,39,255)),('checker',None)]:
    sheet=Image.new('RGBA',(6*208,((len(names)+5)//6)*232),(40,43,51,255))
    draw=ImageDraw.Draw(sheet)
    for i,n in enumerate(names):
        tile=Image.new('RGBA',(96,96),bg or (170,170,178,255))
        if bg is None:
            tp=tile.load()
            for y in range(96):
                for x in range(96):
                    if (x//8+y//8)%2:tp[x,y]=(210,210,217,255)
        tile.alpha_composite(frames[n])
        x=(i%6)*208+8;y=(i//6)*232+26
        draw.text((x,y-19),n,fill='white')
        sheet.alpha_composite(tile.resize((192,192),Image.Resampling.NEAREST),(x,y))
    sheet.convert('RGB').save(ROOT/f'contact-{theme}.png')
# 1x all poses, no scaling of art.
sheet=Image.new('RGBA',(6*112,3*122),(230,220,201,255));draw=ImageDraw.Draw(sheet)
for i,n in enumerate(names):
    x=(i%6)*112+8;y=(i//6)*122+22
    draw.text((x,y-16),n,fill=(30,30,30))
    sheet.alpha_composite(frames[n],(x,y))
sheet.convert('RGB').save(ROOT/'contact-native.png')
SCENES={
'idle':(['idle_a','idle_b','idle_c','idle_b'],[240]*4),
'attack':(['idle_a','windup','move','attack','recover','idle_a'],[600,200,100,120,220,900]),
'hit':(['idle_a','hit','idle_a'],[700,180,900]),
'dead':(['idle_a','hit','dead'],[700,150,1700]),
'skill':(['idle_a','skill_a','skill_b','skill_c','idle_a'],[700,260,160,240,900]),
'poison':(['poison_a','poison_b'],[420,420]),
'stun':(['stun_a','stun_b'],[300,300]),
'sleep':(['sleep_a','sleep_b'],[650,650])}
rgb=[(0,0,0)]+[v[:3] for v in colors.values()];lookup={c:i for i,c in enumerate(rgb[1:],1)}
flat=[v for c in rgb for v in c]+[0]*(768-len(rgb)*3)
indexed={}
for n,im in frames.items():
    ix=Image.new('P',im.size);ix.putpalette(flat)
    ix.putdata([lookup[p[:3]] if p[3] else 0 for p in im.getdata()]);indexed[n]=ix
for scene,(seq,holds) in SCENES.items():
    if not all(n in frames for n in seq):continue
    path=ROOT/'gifs'/f'{scene}.gif'
    indexed[seq[0]].save(path,save_all=True,append_images=[indexed[n] for n in seq[1:]],duration=holds,loop=0,transparency=0,disposal=2,optimize=False)
    with Image.open(path) as gif:
        assert gif.n_frames==len(seq),(scene,gif.n_frames)
        for i,n in enumerate(seq):
            gif.seek(i)
            assert gif.convert('RGBA').tobytes()==frames[n].tobytes(),(scene,i)
            assert gif.info['duration']==holds[i]
print('Rendered',len(frames),'literal frames; GIF pixels and holds reread where complete.')

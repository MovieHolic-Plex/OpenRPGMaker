"""Decode literal grids; PNG/GIF and labelled nearest-neighbour diagnostics only."""
from pathlib import Path
import json
from PIL import Image, ImageDraw
ROOT=Path(__file__).resolve().parent
OUT=ROOT/'preview';OUT.mkdir(exist_ok=True)
palette=json.loads((ROOT/'palette.json').read_text())
def read(path):
    rows=path.read_text().splitlines()
    assert len(rows)==128 and all(len(r)==128 for r in rows),path
    im=Image.new('RGBA',(128,128))
    im.putdata([tuple(bytes.fromhex(palette[p][1:]))+(255,) if p!='.' else (0,0,0,0) for row in rows for p in row])
    return im
images={}
for folder in ('poses','actions'):
    for path in (ROOT/folder).glob('*.pxgrid'):
        im=read(path);images[path.stem]=im;im.save(OUT/(path.stem+'.png'))
for name,im in images.items():
    board=Image.new('RGB',(768,276))
    draw=ImageDraw.Draw(board)
    for index,bg in enumerate(((235,229,215),(25,31,44),None)):
        tile=Image.new('RGB',(256,256),bg or (130,141,149))
        if bg is None:
            td=ImageDraw.Draw(tile)
            for y in range(0,256,16):
                for x in range(0,256,16):
                    if (x//16+y//16)%2:td.rectangle((x,y,x+15,y+15),fill=(184,189,192))
        enlarged=im.resize((256,256),Image.Resampling.NEAREST)
        tile.paste(enlarged,(0,0),enlarged)
        board.paste(tile,(index*256,20));draw.text((index*256+4,4),name,fill='white')
    board.save(OUT/(name+'-backgrounds.png'))
order=['idle_a','idle_b','idle_c','windup','move','attack','recover','hit','dead','skill_a','skill_b','skill_c','poison_a','poison_b','stun_a','stun_b','sleep_a','sleep_b']
for scale in (1,2):
    board=Image.new('RGB',(6*128*scale,3*(128*scale+20)),(36,42,53));draw=ImageDraw.Draw(board)
    for n,name in enumerate(order):
        if name not in images:continue
        x=n%6*128*scale;y=n//6*(128*scale+20)
        im=images[name].resize((128*scale,128*scale),Image.Resampling.NEAREST)
        board.paste(im,(x,y+20),im);draw.text((x+3,y+3),name,fill=(244,238,221))
    board.save(OUT/f'contact-{scale}x.png')
SEQUENCES={
'idle':(['idle_a','idle_b','idle_c','idle_b'],[240,240,240,240]),
'attack':(['idle_a','windup','move','attack','recover','idle_a'],[300,240,100,150,180,300]),
'hit':(['idle_a','hit','recover','idle_a'],[360,240,200,360]),
'dead':(['idle_a','hit','dead'],[360,180,1000]),
'skill':(['idle_a','skill_a','skill_b','skill_c','idle_a'],[300,320,300,240,300]),
'poison':(['poison_a','poison_b'],[400,400]),
'stun':(['stun_a','stun_b'],[420,420]),
'sleep':(['sleep_a','sleep_b'],[650,650])}
for name,(frames,holds) in SEQUENCES.items():
    if not all(f in images for f in frames):continue
    sequence=[]
    for f in frames:
        bg=Image.new('RGB',(128,128),(36,42,53));bg.paste(images[f],(0,0),images[f]);sequence.append(bg)
    sequence[0].save(OUT/(name+'.gif'),save_all=True,append_images=sequence[1:],duration=holds,loop=0,disposal=2,optimize=False)
print('Rendered',len(images),'literal grids')
# Same authored pixels on all three review backgrounds, at native and 2x.
for theme,bg in [('light',(235,229,215)),('dark',(25,31,44)),('checker',None)]:
    for scale in (1,2):
        board=Image.new('RGB',(6*128*scale,3*(128*scale+20)),(47,54,66));draw=ImageDraw.Draw(board)
        for n,name in enumerate(order):
            if name not in images:continue
            x=n%6*128*scale;y=n//6*(128*scale+20)
            tile=Image.new('RGB',(128*scale,128*scale),bg or (130,141,149))
            if bg is None:
                td=ImageDraw.Draw(tile)
                for cy in range(0,128*scale,8*scale):
                    for cx in range(0,128*scale,8*scale):
                        if (cx//(8*scale)+cy//(8*scale))%2:td.rectangle((cx,cy,cx+8*scale-1,cy+8*scale-1),fill=(184,189,192))
            im=images[name].resize((128*scale,128*scale),Image.Resampling.NEAREST)
            tile.paste(im,(0,0),im);board.paste(tile,(x,y+20));draw.text((x+3,y+3),name,fill=(244,238,221))
        board.save(OUT/f'contact-{theme}-{scale}x.png')
sheet=Image.new('RGBA',(384,768))
for n,name in enumerate(order):
    if name in images:sheet.paste(images[name],(n%3*128,n//3*128))
sheet.save(OUT/'native-sheet.png')
for label,names in [('poses',order[:9]),('actions',order[9:])]:
    native=Image.new('RGBA',(384,384))
    for n,name in enumerate(names):
        native.paste(images[name],(n%3*128,n//3*128))
    native.save(OUT/f'native-{label}.png')
# Read the actual saved GIFs to inspect their real cels and hold times.
for group,names in [('motion',['idle','attack','hit','dead']),('status',['skill','poison','stun','sleep'])]:
    board=Image.new('RGB',(768,4*152),(36,42,53));draw=ImageDraw.Draw(board)
    for row,name in enumerate(names):
        with Image.open(OUT/(name+'.gif')) as gif:
            for n in range(gif.n_frames):
                gif.seek(n);cel=gif.convert('RGB')
                board.paste(cel,(n*128,row*152+24))
                draw.text((n*128+3,row*152+4),f'{name}:{n} {gif.info.get("duration")}ms',fill=(244,238,221))
    board.save(OUT/f'gif-decoded-{group}.png')

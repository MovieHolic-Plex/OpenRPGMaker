#!/usr/bin/env python3
"""Rebuild native field art and decode submitted GIFs for visual review."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageOps, ImageSequence
import hashlib, json, importlib.util

ROOT=Path(__file__).resolve().parent
OUT=ROOT/'site'/'assets'
OUT.mkdir(parents=True, exist_ok=True)
spec=importlib.util.spec_from_file_location('recipe',ROOT/'recipes'/'flurrykit.py')
r=importlib.util.module_from_spec(spec);spec.loader.exec_module(r)
source=ROOT/'references'/'poochyena.png'
receipt=json.loads((ROOT/'references'/'source.json').read_text())
assert hashlib.sha256(source.read_bytes()).hexdigest()==receipt['sha256'], 'Source changed'
im=Image.open(source)
assert im.size==(288,32) and im.mode=='P'
symbols='.123456789ABCDEF'
palette={symbols[i]:tuple(im.getpalette()[i*3:i*3+3])+(255,) for i in range(16)}
palette['.']=(0,0,0,0)
for i,v in r.PALETTE.items():palette[symbols[i]]=tuple(bytes.fromhex(v[1:]))+(255,)
original_palette={symbols[i]:tuple(im.getpalette()[i*3:i*3+3])+(255,) for i in range(16)}
original_palette['.']=(0,0,0,0)

def bake(rows,pal):
    f=Image.new('RGBA',(32,32));f.putdata([pal[c] for row in rows for c in row]);return f

sources={};frames={};patch_log=[]
for i in range(9):
    raw=[''.join(symbols[im.getpixel((i*32+x,y))] for x in range(32)) for y in range(32)]
    rows=raw.copy();start=r.HEAD_STARTS[i]
    def patch(x,y,text):
        assert 0<=x and x+len(text)<=32 and 0<=y<32
        assert set(text)<=set(symbols)
        rows[y]=rows[y][:x]+text+rows[y][x+len(text):]
        patch_log.append({'sourceFrame':i,'x':x,'y':y,'pixels':text})
    if i in [0,3,4,1,5,6]:
        head=r.FRONT if i in [0,3,4] else r.BACK
        for dy,row in enumerate(head):
            assert len(row)==16,(i,dy,row,len(row))
            patch(8,start+dy,row)
    else:
        for x,dy,row in r.SIDE_PATCHES:patch(x,start+dy,row)
    # Source-dependent protected lower leg area. A 32px monster is not a human16x32.
    protected=range(start+12,32)
    assert all(rows[y]==raw[y] for y in protected),'Foot gait was edited'
    assert rows!=raw
    sources[i]=raw;frames[i]=rows

def frame(direction,pose,original=False):
    i=r.SOURCE_MAPPING[direction][pose]
    f=bake(sources[i] if original else frames[i],original_palette if original else palette)
    return ImageOps.mirror(f) if direction=='right' else f

atlas=Image.new('RGBA',(96,128));directions=['down','left','right','up']
for y,d in enumerate(directions):
    for x in range(3):atlas.paste(frame(d,x),(x*32,y*32))
assert len(set(atlas.getdata()))<=16
atlas.save(OUT/'flurrykit.png')
duration=[150,150,150,150];sequence=[0,1,2,1]
for d in directions:
    cels=[]
    for pose in sequence:
        f=Image.new('RGB',(32,32),'#9fba98');f.paste(frame(d,pose),mask=frame(d,pose).getchannel('A'));cels.append(f.resize((128,128),Image.Resampling.NEAREST))
    cels[0].save(OUT/(d+'.gif'),save_all=True,append_images=cels[1:],duration=duration,loop=0,optimize=False,disposal=2)
# Comparison: original and derivative side by side, four directions in rows.
panels=[]
for pose in sequence:
    panel=Image.new('RGB',(256,448),'#e8eee5');draw=ImageDraw.Draw(panel)
    draw.text((16,10),'SOURCE',fill='#35485f');draw.text((144,10),'SNOW CAT',fill='#35485f')
    for row,d in enumerate(directions):
        for col,original in enumerate([True,False]):
            f=frame(d,pose,original).resize((96,96),Image.Resampling.NEAREST)
            panel.paste(f,(16+col*128,32+row*100),f)
    panels.append(panel)
panels[0].save(OUT/'comparison.gif',save_all=True,append_images=panels[1:],duration=duration,loop=0,optimize=False,disposal=2)
decoded=Image.new('RGB',(512,512),'#9fba98')
gif_facts={}
for y,d in enumerate(directions):
    gif=Image.open(OUT/(d+'.gif'))
    assert gif.n_frames==4
    gif_facts[d]={'frames':gif.n_frames,'durationMs':[]}
    for x,f in enumerate(ImageSequence.Iterator(gif)):
        gif_facts[d]['durationMs'].append(f.info['duration'])
        expected=Image.new('RGB',(32,32),'#9fba98');native=frame(d,sequence[x]);expected.paste(native,mask=native.getchannel('A'))
        assert f.convert('RGB').tobytes()==expected.resize((128,128),Image.Resampling.NEAREST).tobytes(), 'GIF changed native pixels'
        decoded.paste(f.convert('RGB'),(128*x,128*y))
    assert gif_facts[d]['durationMs']==duration
decoded.save(OUT/'decoded.png')
grid={'palette':{k:list(v) for k,v in palette.items()},'sourceRows':sources,'editedRows':frames,'patches':patch_log,'mapping':r.SOURCE_MAPPING}
(OUT/'pixels.json').write_text(json.dumps(grid,indent=2)+'\n')
(OUT/'sprite.json').write_text(json.dumps({'version':1,'speciesId':'mx_species_flurrykit','nativeCell':[32,32],'sheet':[96,128],'directions':directions,'poses':['stepA','idle','stepB'],'walkSequence':sequence,'durationMs':duration,'anchor':[16,32],'source':receipt,'status':'pending-human-review'},indent=2)+'\n')
(OUT/'art-checks.json').write_text(json.dumps({'sourceSha256':receipt['sha256'],'nativeCell':[32,32],'colorsIncludingTransparency':len(set(atlas.getdata())),'protectedFeet':'unchanged palette indices below each source head +12','gif':gif_facts,'visualApproval':False},indent=2)+'\n')
print('Rendered native32x32 atlas, 4 walk GIFs, source comparison and decoded contact sheet. Human review pending.')

"""Decode literal grids; make native images, diagnostic nearest zooms and GIFs.
No art generation, no alpha repairs, no interpolation of animation frames.
"""
from pathlib import Path
from PIL import Image,ImageDraw
import json,hashlib
ROOT=Path(__file__).resolve().parent
P=json.loads((ROOT/'palette.json').read_text())
NAMES=['idle_a','idle_b','idle_c','windup','move','attack','recover','hit','dead','skill_a','skill_b','skill_c','poison_a','poison_b','stun_a','stun_b','sleep_a','sleep_b']
OUT=ROOT/'preview';OUT.mkdir(exist_ok=True)
ims={};info={}
for n in NAMES:
    f=ROOT/('poses' if NAMES.index(n)<9 else 'actions')/(n+'.pxgrid')
    if not f.exists(): continue
    rows=f.read_text().splitlines()
    assert len(rows)==64 and all(len(r)==64 for r in rows),n
    assert all(c=='.' or c in P for r in rows for c in r),n
    im=Image.new('RGBA',(64,64))
    pix=im.load()
    for y,row in enumerate(rows):
        for x,c in enumerate(row):
            if c!='.': pix[x,y]=tuple(bytes.fromhex(P[c][1:]))+(255,)
    im.save(OUT/(n+'.png'));ims[n]=im
    info[n]={'bbox':im.getbbox(),'source_sha256':hashlib.sha256(f.read_bytes()).hexdigest()}
    assert im.getbbox()[0]>=1 and im.getbbox()[1]>=1 and im.getbbox()[2]<=63 and im.getbbox()[3]<=61,n
assert len(P)<=18
for tag,bg in [('light','#e7ded1'),('dark','#242332'),('checker',None)]:
    sheet=Image.new('RGB',(6*272,3*294),(45,43,54))
    d=ImageDraw.Draw(sheet)
    for i,n in enumerate(NAMES):
        if n not in ims:continue
        backdrop=Image.new('RGBA',(64,64),bg or '#c9c5c4')
        if bg is None:
            dr=ImageDraw.Draw(backdrop)
            for yy in range(0,64,8):
                for xx in range(0,64,8):
                    if (xx//8+yy//8)%2: dr.rectangle((xx,yy,xx+7,yy+7),fill='#99949b')
        backdrop.alpha_composite(ims[n]); x=(i%6)*272+8;y=(i//6)*294+24
        sheet.paste(backdrop.resize((256,256),Image.Resampling.NEAREST).convert('RGB'),(x,y))
        d.text((x,y-18),n,fill='white')
    sheet.save(OUT/('contact-'+tag+'.png'))
# Native, no resized artwork.
native=Image.new('RGB',(6*82,3*88),'#ddd5c6');dr=ImageDraw.Draw(native)
for i,n in enumerate(NAMES):
    if n not in ims:continue
    x=(i%6)*82+9;y=(i//6)*88+17
    native.paste(ims[n],(x,y),ims[n]);dr.text((x,y-13),n,fill='#222222')
native.save(OUT/'contact-native.png')
# Fixed source palette GIF; zero index transparent, no quantization.
gifpalette=[0,0,0]
keys=list(P)
for k in keys: gifpalette+=list(bytes.fromhex(P[k][1:]))
gifpalette += [0]*(768-len(gifpalette))
def gif_frame(n):
    f=ROOT/('poses' if NAMES.index(n)<9 else 'actions')/(n+'.pxgrid')
    rows=f.read_text().splitlines()
    a=Image.new('P',(64,64));a.putpalette(gifpalette)
    a.putdata([0 if c=='.' else keys.index(c)+1 for r in rows for c in r])
    return a
MOTIONS={
'idle':(['idle_a','idle_b','idle_c','idle_b'],[240,240,240,240]),
'attack':(['idle_a','windup','move','attack','recover','idle_a'],[240,180,110,140,180,260]),
'hit':(['idle_a','hit','recover','idle_a'],[260,220,180,340]),
'dead':(['idle_a','hit','dead'],[240,170,1000]),
'skill':(['idle_a','skill_a','skill_b','skill_c','idle_a'],[240,280,180,220,300]),
'poison':(['poison_a','poison_b'],[420,420]),
'stun':(['stun_a','stun_b'],[400,400]),
'sleep':(['sleep_a','sleep_b'],[650,650])}
for name,(seq,holds) in MOTIONS.items():
    if not all(n in ims for n in seq):continue
    fs=[gif_frame(n) for n in seq]
    fs[0].save(OUT/(name+'.gif'),save_all=True,append_images=fs[1:],duration=holds,loop=0,transparency=0,disposal=2,optimize=False)
(ROOT/'preview'/'image-info.json').write_text(json.dumps(info,indent=2)+'\n')
print('Rendered',len(ims),'literal frames;',len(P),'colors. Extents:',{n:a['bbox'] for n,a in info.items()})
# Actual decoded GIF frames become temporal strips for inspection. Holds are labeled in ms.
for name,(seq,holds) in MOTIONS.items():
    if not all(n in ims for n in seq): continue
    g=Image.open(OUT/(name+'.gif'))
    temporal=Image.new('RGB',(len(seq)*200,222),'#dfd7c7');dt=ImageDraw.Draw(temporal)
    decoded=[]
    for i,n in enumerate(seq):
        g.seek(i); frame=g.convert('RGBA');decoded.append(frame)
        # GIF decoder supplies composited transparency; compare only native frames.
        assert frame.tobytes()==ims[n].tobytes(),(name,i,'GIF changed pixels')
        dt.text((i*200+4,5),f'{n} / {g.info.get("duration")} ms',fill='#222222')
        back=Image.new('RGBA',(64,64),'#dfd7c7');back.alpha_composite(frame)
        temporal.paste(back.resize((192,192),Image.Resampling.NEAREST).convert('RGB'),(i*200+4,25))
    temporal.save(OUT/(name+'-gif-frames.png'))
# Native sheet layout used by the candidate: base 3x3, actions 3x3, all 3x6.
for name,names in [('poses-sheet',NAMES[:9]),('actions-sheet',NAMES[9:]),('suite-sheet',NAMES)]:
    sh=Image.new('RGBA',(192,64*((len(names)+2)//3)))
    for i,n in enumerate(names):
        if n in ims: sh.paste(ims[n],((i%3)*64,(i//3)*64))
    sh.save(OUT/(name+'.png'))
print('Decoded and opened through temporal PNGs: all eight GIFs; native pixels match the grids.')

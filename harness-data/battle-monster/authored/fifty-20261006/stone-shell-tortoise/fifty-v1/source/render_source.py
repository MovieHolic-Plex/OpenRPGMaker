"""Decode the native literal grids, bake exact-color PNG/GIF and diagnostic views.
No authored pixels are calculated or modified by this renderer.
"""
from pathlib import Path
from PIL import Image, ImageDraw
import json
ROOT=Path(__file__).resolve().parent
palette=json.loads((ROOT/'palette.json').read_text())
colors={k:tuple(bytes.fromhex(v[1:]))+(255,) for k,v in palette.items()}
frames={}
out=ROOT/'preview'
out.mkdir(exist_ok=True)
for path in sorted(list((ROOT/'poses').glob('*.pxgrid'))+list((ROOT/'actions').glob('*.pxgrid'))):
    rows=path.read_text().splitlines()
    if len(rows)!=64 or any(len(r)!=64 for r in rows): raise ValueError(path)
    im=Image.new('RGBA',(64,64))
    im.putdata([colors[c] if c!='.' else (0,0,0,0) for r in rows for c in r])
    frames[path.stem]=im
    im.save(out/(path.stem+'.png'))
# Diagnostic backgrounds and nearest-neighbor enlargement only.
ordered=['idle_a','idle_b','idle_c','windup','move','attack','recover','hit','dead','skill_a','skill_b','skill_c','poison_a','poison_b','stun_a','stun_b','sleep_a','sleep_b']
ordered=[n for n in ordered if n in frames]
for kind,bg in [('light','#e8e3d5'),('dark','#1c2027'),('checker','#92999e')]:
    sheet=Image.new('RGB',(6*276,3*296),bg)
    d=ImageDraw.Draw(sheet)
    for i,name in enumerate(ordered):
        x=(i%6)*276;y=(i//6)*296
        d.text((x+7,y+4),name,fill='#ffffff' if kind=='dark' else '#161a22')
        backdrop=Image.new('RGB',(64,64),bg)
        if kind=='checker':
            bd=ImageDraw.Draw(backdrop)
            for yy in range(0,64,8):
                for xx in range(0,64,8):
                    if (xx//8+yy//8)%2:bd.rectangle((xx,yy,xx+7,yy+7),fill='#c4c9cc')
        backdrop.paste(frames[name],mask=frames[name].getchannel('A'))
        sheet.paste(backdrop.resize((256,256),Image.Resampling.NEAREST),(x+7,y+23))
    sheet.save(out/('sheet-'+kind+'.png'))
native=Image.new('RGB',(6*96,3*88),'#e8e3d5')
nd=ImageDraw.Draw(native)
for i,name in enumerate(ordered):
    x=i%6*96;y=i//6*88
    nd.text((x+2,y+2),name,fill='#252b29')
    native.paste(frames[name],(x+16,y+20),frames[name])
native.save(out/'sheet-native.png')
for sheet_name,names in [('poses',ordered[:9]),('actions',ordered[9:])]:
    packed=Image.new('RGBA',(192,192))
    for i,name in enumerate(names): packed.paste(frames[name],(i%3*64,i//3*64))
    packed.save(out/(sheet_name+'.png'))
SCENES={
'idle':(['idle_a','idle_b','idle_c','idle_b'],[240]*4),
'attack':(['idle_a','windup','move','attack','recover','idle_a'],[600,200,100,120,220,900]),
'hit':(['idle_a','hit','idle_a'],[700,180,900]),
'dead':(['idle_a','hit','dead'],[700,150,1700]),
'skill':(['idle_a','skill_a','skill_b','skill_c','idle_a'],[700,260,160,240,900]),
'poison':(['poison_a','poison_b'],[420,420]),
'stun':(['stun_a','stun_b'],[300,300]),
'sleep':(['sleep_a','sleep_b'],[650,650])}
# Keep exact source palette values, including transparency index zero.
flat=[0,0,0]+[v for c in colors.values() for v in c[:3]]
flat += [0]*(768-len(flat))
indices={c:i+1 for i,c in enumerate(colors.values())}
indexed={}
for name,im in frames.items():
    pim=Image.new('P',(64,64));pim.putpalette(flat)
    pim.putdata([indices[p] if p[3] else 0 for p in im.getdata()])
    indexed[name]=pim
for name,(order,holds) in SCENES.items():
    if not all(n in indexed for n in order):continue
    dest=out/(name+'.gif')
    indexed[order[0]].save(dest,save_all=True,append_images=[indexed[n] for n in order[1:]],duration=holds,transparency=0,loop=0,disposal=2,optimize=False)
    with Image.open(dest) as gif:
        storyboard=Image.new('RGB',(len(order)*212,244),'#252b35')
        sd=ImageDraw.Draw(storyboard)
        for i,n in enumerate(order):
            gif.seek(i)
            duration=gif.info['duration']
            decoded=gif.convert('RGBA')
            if decoded.tobytes()!=frames[n].tobytes():raise ValueError(('GIF decode',name,i))
            if duration!=holds[i]:raise ValueError(('GIF duration',name,i,duration))
            sd.text((i*212+6,5),n+' '+str(duration)+'ms',fill='#e8e3d5')
            enlarged=decoded.resize((192,192),Image.Resampling.NEAREST)
            storyboard.paste(enlarged,(i*212+6,24),enlarged)
        storyboard.save(out/(name+'-gif-frames.png'))
    print(name, len(order), 'native frames decoded')
print('Rendered',len(frames),'literal 64x64 sources; palette',len(colors))

from pathlib import Path
import json
from PIL import Image,ImageDraw
R=Path(__file__).parent
pal=json.loads((R/'palette.json').read_text())
names=['idle_a','idle_b','idle_c','windup','move','attack','recover','hit','dead','skill_a','skill_b','skill_c','poison_a','poison_b','stun_a','stun_b','sleep_a','sleep_b']
ims={}
for name in names:
    p=R/('actions' if name in names[9:] else 'poses')/(name+'.pxgrid')
    if not p.exists(): continue
    rows=p.read_text().splitlines()
    im=Image.new('RGBA',(128,128))
    for y,row in enumerate(rows):
        for x,c in enumerate(row):
            if c!='.': im.putpixel((x,y),tuple(bytes.fromhex(pal[c][1:]))+(255,))
    ims[name]=im
    im.save(R/'progress'/(name+'.png'))
for group,ns in [('battle',names[:9]),('actions',names[9:])]:
    ns=[n for n in ns if n in ims]
    if not ns: continue
    sheet=Image.new('RGB',(3*264,((len(ns)+2)//3)*284),'#242634')
    d=ImageDraw.Draw(sheet)
    for i,n in enumerate(ns):
        x=(i%3)*264+4;y=(i//3)*284+23
        im=ims[n].resize((256,256),Image.Resampling.NEAREST)
        sheet.paste(im,(x,y),im)
        d.text((x+4,y-18),n,fill='#e6dfcc')
    sheet.save(R/'progress'/(group+'-sheet.png'))
# Exact-index native GIF decode. No quantization, interpolation or pose synthesis.
from hashlib import sha256
symbols=list(pal)
colors=[0,0,0]
for c in symbols: colors.extend(bytes.fromhex(pal[c][1:]))
colors.extend([0]*(768-len(colors)))
indexed={}
info={}
for n,im in ims.items():
    p=R/('actions' if n in names[9:] else 'poses')/(n+'.pxgrid')
    rows=p.read_text().splitlines()
    pi=Image.new('P',(128,128),0)
    pi.putpalette(colors)
    pi.putdata([0 if c=='.' else symbols.index(c)+1 for row in rows for c in row])
    pi.info['transparency']=0
    indexed[n]=pi
    pts=[(x,y) for y,row in enumerate(rows) for x,c in enumerate(row) if c!='.']
    info[n]={'canvas':[len(rows[0]),len(rows)],'inkBounds':[min(x for x,y in pts),min(y for x,y in pts),max(x for x,y in pts),max(y for x,y in pts)],'colors':len(set(''.join(rows))-{'.'}),'sha256':sha256(p.read_bytes()).hexdigest()}
sequences={
'idle':(['idle_a','idle_b','idle_c'],[300,300,300]),
'attack':(['windup','move','attack','recover','idle_a'],[240,120,140,250,250]),
'hit':(['hit','recover','idle_a'],[180,240,300]),
'dead':(['hit','dead'],[160,1000]),
'skill':(['skill_a','skill_b','skill_c','idle_a'],[340,160,360,300]),
'poison':(['poison_a','poison_b'],[450,450]),
'stun':(['stun_a','stun_b'],[350,350]),
'sleep':(['sleep_a','sleep_b'],[700,700])}
for n,(ns,durations) in sequences.items():
    if not all(k in indexed for k in ns): continue
    indexed[ns[0]].save(R/'progress'/(n+'-native.gif'),save_all=True,append_images=[indexed[k] for k in ns[1:]],duration=durations,loop=0,transparency=0,disposal=2,optimize=False)
(R/'progress/geometry.json').write_text(json.dumps(info,indent=2)+'\n')
print('Decoded',len(ims),'literal 128x128 grids;',len(set(v['sha256'] for v in info.values())),'unique source frames.')
print('idle_a',info['idle_a']['inkBounds'],'; 8 native indexed GIFs saved.')

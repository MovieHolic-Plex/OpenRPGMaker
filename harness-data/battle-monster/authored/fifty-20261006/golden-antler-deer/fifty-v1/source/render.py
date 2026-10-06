"""Decode literal native grids; previews alone use nearest-neighbour magnification.
Never writes or modifies any source pixel. No reference-image input.
"""
from pathlib import Path
from PIL import Image, ImageDraw
import json, hashlib
ROOT=Path(__file__).resolve().parent
OUT=ROOT/'previews'
OUT.mkdir(exist_ok=True)
BASE=['idle_a','idle_b','idle_c','windup','move','attack','recover','hit','dead']
EXTRA=['skill_a','skill_b','skill_c','poison_a','poison_b','stun_a','stun_b','sleep_a','sleep_b']
TIMELINES={
'idle':(['idle_a','idle_b','idle_c','idle_b'],[240,240,240,240]),
'attack':(['idle_a','windup','move','attack','recover','idle_a'],[260,180,110,150,180,320]),
'hit':(['idle_a','hit','recover','idle_a'],[260,240,160,380]),
'dead':(['idle_a','hit','dead'],[260,180,1000]),
'skill':(['idle_a','skill_a','skill_b','skill_c','idle_a'],[240,320,180,280,320]),
'poison':(['poison_a','poison_b'],[440,440]),
'stun':(['stun_a','stun_b'],[480,480]),
'sleep':(['sleep_a','sleep_b'],[620,620])}
pal=json.loads((ROOT/'palette.json').read_text())
rgb={k:tuple(bytes.fromhex(v[1:])) for k,v in pal.items()}
ims={}; measurements={}
for name in BASE+EXTRA:
    p=ROOT/('poses' if name in BASE else 'actions')/(name+'.pxgrid')
    if not p.exists(): continue
    rows=p.read_text().splitlines()
    if len(rows)!=64 or any(len(r)!=64 for r in rows): raise ValueError(name+' wrong canvas')
    im=Image.new('RGBA',(64,64))
    im.putdata([(0,0,0,0) if s=='.' else (*rgb[s],255) for r in rows for s in r])
    im.save(OUT/(name+'.png')); ims[name]=im
    measurements[name]={'bbox':im.getbbox(),'sha256_grid':hashlib.sha256(p.read_bytes()).hexdigest()}

def background(kind,size):
    im=Image.new('RGBA',size, '#eee6d7' if kind=='light' else '#20232d')
    if kind=='checker':
        d=ImageDraw.Draw(im)
        for y in range(0,size[1],8):
            for x in range(0,size[0],8):
                d.rectangle((x,y,x+7,y+7),fill='#636772' if (x//8+y//8)%2 else '#42454f')
    return im

for kind in ['light','dark','checker']:
    for scale in [1,4]:
        tile=64*scale; label=20
        sheet=background(kind,(6*(tile+8),3*(tile+label+8)))
        d=ImageDraw.Draw(sheet)
        for i,name in enumerate(BASE+EXTRA):
            if name not in ims: continue
            x=(i%6)*(tile+8)+4; y=(i//6)*(tile+label+8)+label
            d.text((x,y-label+3),name,fill='#20232d' if kind=='light' else '#eee6d7')
            preview=ims[name] if scale==1 else ims[name].resize((tile,tile),Image.Resampling.NEAREST)
            sheet.alpha_composite(preview,(x,y))
        sheet.convert('RGB').save(OUT/('sheet-'+kind+'-'+str(scale)+'x.png'))
# Native transparent basic 3x3 and extra 3x3 sheets.
for names,filename in [(BASE,'poses-native.png'),(EXTRA,'actions-native.png')]:
    im=Image.new('RGBA',(192,192))
    for i,name in enumerate(names):
        if name in ims: im.alpha_composite(ims[name],((i%3)*64,(i//3)*64))
    im.save(OUT/filename)
# Complete native 3-column / 6-row suite, without scaling or synthesizing pixels.
suite=Image.new('RGBA',(192,384))
for i,name in enumerate(BASE+EXTRA):
    suite.alpha_composite(ims[name],((i%3)*64,(i//3)*64))
suite.save(OUT/'suite-native.png')
# Palette indices are copied directly to GIF. Index zero is transparency.
gifpal=[0,0,0]
for color in rgb.values(): gifpal.extend(color)
gifpal.extend([0]*(768-len(gifpal)))
indices={k:i+1 for i,k in enumerate(pal)}
for motion,(names,durations) in TIMELINES.items():
    if any(name not in ims for name in names): continue
    gifframes=[]
    for name in names:
        p=ROOT/('poses' if name in BASE else 'actions')/(name+'.pxgrid')
        gi=Image.new('P',(64,64)); gi.putpalette(gifpal)
        gi.putdata([0 if c=='.' else indices[c] for row in p.read_text().splitlines() for c in row])
        gi.info['transparency']=0; gifframes.append(gi)
    dest=OUT/(motion+'.gif')
    gifframes[0].save(dest,save_all=True,append_images=gifframes[1:],duration=durations,loop=0,transparency=0,disposal=2,optimize=False)
    decoded=Image.open(dest)
    readback=[]
    for i,name in enumerate(names):
        decoded.seek(i)
        rgba=decoded.convert('RGBA')
        # RGB in fully transparent pixels may be unspecified; compare visible pixels and alpha.
        same=all(a[3]==b[3] and (a[3]==0 or a==b) for a,b in zip(rgba.get_flattened_data(),ims[name].get_flattened_data()))
        readback.append({'pose':name,'duration_ms':decoded.info['duration'],'visible_rgba_matches':same})
    measurements[motion+'_gif']={'frames':readback}
    strip=background('dark',(len(names)*264,284)); d=ImageDraw.Draw(strip)
    for i,name in enumerate(names):
        strip.alpha_composite(ims[name].resize((256,256),Image.Resampling.NEAREST),(264*i+4,24))
        d.text((264*i+4,4),name+' '+str(durations[i])+'ms',fill='white')
    strip.convert('RGB').save(OUT/(motion+'-sequence.png'))
(OUT/'decode-report.json').write_text(json.dumps(measurements,indent=2)+'\n')
print('Rendered',len(ims),'literal native frames;',sum(all(n in ims for n in t[0]) for t in TIMELINES.values()),'motion GIFs. Palette:',len(pal))

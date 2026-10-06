"""Decode existing literal grids. Only previews are enlarged/labeled."""
from pathlib import Path
from PIL import Image, ImageDraw
import json, hashlib

ROOT=Path(__file__).resolve().parent
PREVIEW=ROOT/'preview'
PREVIEW.mkdir(exist_ok=True)
palette=json.loads((ROOT/'palette.json').read_text())
colors={k:tuple(bytes.fromhex(v[1:]))+(255,) for k,v in palette.items()}
colors['.']=(0,0,0,0)
frames={}
report={}
order=['idle_a','idle_b','idle_c','windup','move','attack','recover','hit','dead',
       'skill_a','skill_b','skill_c','poison_a','poison_b','stun_a','stun_b','sleep_a','sleep_b']
for name in order:
    path=next(iter(ROOT.glob('*/'+name+'.pxgrid')),None)
    if path is None: continue
    lines=path.read_text().splitlines()
    assert len(lines)==96 and all(len(r)==96 for r in lines), name
    assert not (set(''.join(lines))-set(colors)),name
    im=Image.new('RGBA',(96,96))
    im.putdata([colors[c] for row in lines for c in row])
    box=im.getbbox()
    assert box[0]>=1 and box[1]>=1 and box[2]<=95 and box[3]<=93,(name,box)
    if name=='idle_a': assert box[3]==93,box
    im.save(PREVIEW/(name+'.png'))
    frames[name]=im
    report[name]={'bbox':box,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),
                  'rgbaSha256':hashlib.sha256(im.tobytes()).hexdigest(),
                  'pngSha256':hashlib.sha256((PREVIEW/(name+'.png')).read_bytes()).hexdigest()}
assert len({v['rgbaSha256'] for v in report.values()})==len(report)

def back(kind):
    im=Image.new('RGBA',(96,96),(230,230,220,255) if kind=='light' else (23,28,42,255))
    if kind=='checker':
        im.putdata([(174,184,194,255) if (x//8+y//8)%2 else (220,225,228,255)
                    for y in range(96) for x in range(96)])
    return im

for kind in ['light','dark','checker']:
    sheet=Image.new('RGB',(6*304,3*320),(55,62,76))
    native=Image.new('RGB',(6*104,3*116),(55,62,76))
    ds=ImageDraw.Draw(sheet);dn=ImageDraw.Draw(native)
    for k,name in enumerate(frames):
        im=back(kind); im.alpha_composite(frames[name])
        x=(k%6)*304;y=(k//6)*320
        sheet.paste(im.resize((288,288),Image.Resampling.NEAREST),(x+8,y+24))
        ds.text((x+8,y+6),name,fill='white')
        xn=(k%6)*104;yn=(k//6)*116
        native.paste(im,(xn+4,yn+16));dn.text((xn+4,yn+2),name,fill='white')
    sheet.save(PREVIEW/('sheet-'+kind+'-3x.png'))
    native.save(PREVIEW/('sheet-'+kind+'-1x.png'))

for name in ['dead','attack','recover','skill_b','sleep_a']:
    if name not in frames:continue
    im=back('light');im.alpha_composite(frames[name])
    out=im.convert('RGB').resize((768,768),Image.Resampling.NEAREST)
    ds=ImageDraw.Draw(out)
    for x in range(0,96,4):ds.text((x*8,0),str(x),fill='#a94545')
    for y in range(0,96,4):ds.text((0,y*8),str(y),fill='#a94545')
    out.save(PREVIEW/(name+'-coords.png'))

scenes={
 'idle':(['idle_a','idle_b','idle_c','idle_b'],[240]*4),
 'attack':(['idle_a','windup','move','attack','recover','idle_a'],[600,200,100,120,220,900]),
 'hit':(['idle_a','hit','idle_a'],[700,180,900]),
 'dead':(['idle_a','hit','dead'],[700,150,1700]),
 'skill':(['idle_a','skill_a','skill_b','skill_c','idle_a'],[700,260,160,240,900]),
 'poison':(['poison_a','poison_b'],[420,420]),
 'stun':(['stun_a','stun_b'],[300,300]),
 'sleep':(['sleep_a','sleep_b'],[650,650])}
rgb=[tuple(bytes.fromhex(v[1:])) for v in palette.values()]
indices={c:i+1 for i,c in enumerate(rgb)}
gifpal=[0,0,0]+[v for c in rgb for v in c];gifpal += [0]*(768-len(gifpal))
for scene,(names,holds) in scenes.items():
    if not all(n in frames for n in names):continue
    encoded=[]
    for n in names:
        im=Image.new('P',(96,96));im.putpalette(gifpal)
        im.putdata([indices[p[:3]] if p[3] else 0 for p in frames[n].get_flattened_data()])
        encoded.append(im)
    dest=PREVIEW/(scene+'.gif')
    encoded[0].save(dest,save_all=True,append_images=encoded[1:],duration=holds,
                   transparency=0,disposal=2,loop=0,optimize=False)
    decoded=Image.open(dest)
    for k,n in enumerate(names):
        decoded.seek(k)
        assert decoded.convert('RGBA').tobytes()==frames[n].tobytes(),(scene,k)
        assert decoded.info['duration']==holds[k],(scene,k)
    # Read the actual GIF back for a contact strip. This is a diagnostic view,
    # using nearest-neighbor enlargement of already-authored frames only.
    strip=Image.new('RGB',(len(names)*208,224),(43,49,63));ds=ImageDraw.Draw(strip)
    for k,n in enumerate(names):
        decoded.seek(k)
        bg=back('dark');bg.alpha_composite(decoded.convert('RGBA'))
        strip.paste(bg.resize((192,192),Image.Resampling.NEAREST),(k*208+8,24))
        ds.text((k*208+8,5),n+' '+str(holds[k])+'ms',fill='white')
    strip.save(PREVIEW/('gif-'+scene+'-frames.png'))
(PREVIEW/'timing.json').write_text(json.dumps(scenes,indent=2)+'\n')
(PREVIEW/'source-diagnostics.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({'frames':len(frames),'colors':len(palette),
                  'gifs':sum(all(n in frames for n in names) for names,holds in scenes.values()),
                  'idle_a_bbox':report['idle_a']['bbox']},indent=2))

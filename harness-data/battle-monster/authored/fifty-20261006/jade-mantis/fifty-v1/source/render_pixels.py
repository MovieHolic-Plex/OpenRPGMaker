"""Read literal grids, render diagnostic PNGs and exact-palette GIFs only."""
from pathlib import Path
import json
from PIL import Image, ImageDraw
ROOT=Path(__file__).resolve().parent
OUT=ROOT/'preview'
OUT.mkdir(exist_ok=True)
P=json.loads((ROOT/'palette.json').read_text())
COLORS={k:tuple(bytes.fromhex(v[1:]))+(255,) for k,v in P.items()}
ORDER=['idle_a','idle_b','idle_c','windup','move','attack','recover','hit','dead','skill_a','skill_b','skill_c','poison_a','poison_b','stun_a','stun_b','sleep_a','sleep_b']
frames={}
for name in ORDER:
    folder='poses' if ORDER.index(name)<9 else 'actions'
    path=ROOT/folder/f'{name}.pxgrid'
    if not path.exists(): continue
    rows=path.read_text().splitlines()
    if len(rows)!=64 or any(len(r)!=64 for r in rows): raise ValueError(path)
    im=Image.new('RGBA',(64,64))
    im.putdata([COLORS.get(c,(0,0,0,0)) for row in rows for c in row])
    im.save(OUT/f'{name}.png')
    frames[name]=im
    print(name, 'ink',im.getbbox(), 'pixels',sum(c!='.' for r in rows for c in r))
if frames:
    sheet=Image.new('RGBA',(192,384))
    for i,name in enumerate(ORDER):
        if name in frames: sheet.alpha_composite(frames[name],((i%3)*64,(i//3)*64))
    sheet.save(OUT/'sheet.png')
    for bg in ['light','dark','checker']:
        board=Image.new('RGB',(3*280,6*232), '#e9e3d6' if bg=='light' else '#18232c')
        draw=ImageDraw.Draw(board)
        if bg=='checker':
            for y in range(0,1392,16):
                for x in range(0,840,16):
                    draw.rectangle((x,y,x+15,y+15),fill='#737b7c' if (x//16+y//16)%2 else '#a7ada6')
        for i,name in enumerate(ORDER):
            if name not in frames: continue
            x=(i%3)*280+12; y=(i//3)*232+24
            draw.text((x,y-17),name, fill='#000000' if bg!='dark' else '#e8efec')
            zoom=frames[name].resize((192,192),Image.Resampling.NEAREST)
            board.paste(zoom,(x,y),zoom)
            draw.text((x+196,y+52),'1x',fill='#000000' if bg!='dark' else '#e8efec')
            board.paste(frames[name],(x+196,y+72),frames[name])
        board.save(OUT/f'contact-{bg}.png')
    idle=frames['idle_a']
    board=Image.new('RGB',(768,280),'#e9e3d6')
    board.paste('#18232c',(256,0,512,280))
    d=ImageDraw.Draw(board)
    for y in range(0,280,16):
        for x in range(512,768,16):
            d.rectangle((x,y,x+15,y+15),fill='#737b7c' if (x//16+y//16)%2 else '#a7ada6')
    for x in (0,256,512):
        z=idle.resize((256,256),Image.Resampling.NEAREST)
        board.paste(z,(x,0),z); board.paste(idle,(x+180,216),idle)
    board.save(OUT/'idle-study.png')
MOTIONS={
'idle':(['idle_a','idle_b','idle_c','idle_b'],[240,240,240,240]),
'attack':(['idle_a','windup','move','attack','recover','idle_a'],[240,220,100,130,220,240]),
'hit':(['idle_a','hit','recover','idle_a'],[250,180,200,300]),
'dead':(['idle_a','hit','dead'],[240,180,1100]),
'skill':(['idle_a','skill_a','skill_b','skill_c','idle_a'],[240,350,170,300,240]),
'poison':(['poison_a','poison_b'],[420,420]),
'stun':(['stun_a','stun_b'],[450,450]),
'sleep':(['sleep_a','sleep_b'],[650,650])}
# Index zero is transparent; each authored RGB is inserted without quantization.
gifpalette=[0,0,0]+[n for color in COLORS.values() for n in color[:3]]
gifpalette+= [0]*(768-len(gifpalette))
index={k:i+1 for i,k in enumerate(P)}
for motion,(names,holds) in MOTIONS.items():
    if any(name not in frames for name in names): continue
    ims=[]
    for name in names:
        folder='poses' if ORDER.index(name)<9 else 'actions'
        rows=(ROOT/folder/f'{name}.pxgrid').read_text().splitlines()
        im=Image.new('P',(64,64)); im.putpalette(gifpalette)
        im.putdata([index.get(c,0) for row in rows for c in row]); im.info['transparency']=0
        ims.append(im)
    ims[0].save(OUT/f'{motion}.gif',save_all=True,append_images=ims[1:],duration=holds,loop=0,transparency=0,disposal=2,optimize=False)

# Re-open the saved GIFs; display their decoded frames in temporal order.
# This is visual readback of exported assets, not pose synthesis.
readback=Image.new('RGB',(912,8*180),'#18232c')
draw=ImageDraw.Draw(readback)
records={}
for m,(names,holds) in MOTIONS.items():
    row=list(MOTIONS).index(m)
    path=OUT/f'{m}.gif'
    if not path.exists(): continue
    decoded=[]
    with Image.open(path) as gif:
        for i,name in enumerate(names):
            gif.seek(i)
            frame=gif.convert('RGBA')
            # Fully transparent RGB is immaterial; compare visible pigments
            # and exact alpha after decoding the saved GIF.
            a=list(frame.getdata()); b=list(frames[name].getdata())
            same=all(x[3]==y[3] and (x[3]==0 or x==y) for x,y in zip(a,b))
            if not same: raise ValueError(f'GIF readback differs: {m} {i}')
            hold=gif.info.get('duration')
            if hold!=holds[i]: raise ValueError(f'GIF hold differs: {m} {i}')
            x=i*152+10; y=row*180+24
            draw.text((x,y-17),f'{m}: {name}',fill='#eef2e8')
            zoom=frame.resize((128,128),Image.Resampling.NEAREST)
            readback.paste(zoom,(x,y),zoom)
            draw.text((x,y+134),f'{hold} ms',fill='#b9c6bb')
            decoded.append({'pose':name,'durationMs':hold,'matchesSource':same})
        records[m]=decoded
readback.save(OUT/'motions-readback.png')
(OUT/'render-notes.json').write_text(json.dumps(records,indent=2)+'\n')

html='''<!doctype html><html lang="ko"><meta charset="utf-8">
<title>옥날사마귀 — 18자세 · 8동작</title>
<style>
body{margin:24px;background:#18232c;color:#e8efe8;font:16px system-ui}
h1{font-size:24px}button{padding:8px 16px;margin-right:8px;cursor:pointer}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:16px;max-width:1150px}
figure{margin:0;padding:12px;border:1px solid #59635c;border-radius:8px}
.stage{width:256px;height:256px;max-width:100%;background:#18232c}
.stage img{width:100%;height:100%;image-rendering:pixelated;object-fit:contain}
.native{width:64px;height:64px;image-rendering:pixelated}figcaption{margin-bottom:8px}
a{color:#b4e3ce}.light .stage{background:#e9e3d6}.checker .stage{background:repeating-conic-gradient(#737b7c 0 25%,#a7ada6 0 50%) 0/16px 16px}
</style><h1>옥날사마귀</h1><p>원본 64px · 18자세 · 8동작</p>
<p><button onclick="document.body.className='dark'">어두운 바탕</button><button onclick="document.body.className='light'">밝은 바탕</button><button onclick="document.body.className='checker'">체커 바탕</button></p><div class="grid">'''
labels={'idle':'대기','attack':'공격','hit':'피격','dead':'쓰러짐','skill':'옥엽절','poison':'독','stun':'기절','sleep':'수면'}
for m in MOTIONS:
    html+=f'<figure><figcaption>{labels[m]}</figcaption><div class="stage"><img src="{m}.gif" alt="{labels[m]}"></div><img class="native" src="{m}.gif" alt="원본 크기"></figure>'
html+='</div><p><a href="contact-light.png">밝은 바탕 자세표</a> · <a href="contact-dark.png">어두운 바탕 자세표</a> · <a href="contact-checker.png">체커 자세표</a></p></html>'
(OUT/'index.html').write_text(html)

# Diagnostic nearest-neighbor display only. Native source frames stay 64px.
detail = Image.new('RGB', (1152, 820), '#e9e3d6')
d = ImageDraw.Draw(detail)
for i, name in enumerate(['skill_a', 'skill_b', 'skill_c', 'attack', 'idle_a', 'windup']):
    x, y = (i % 3)*384, (i // 3)*410
    z = frames[name].resize((384, 384), Image.Resampling.NEAREST)
    detail.paste(z, (x, y+24), z)
    d.text((x+10, y+5), name, fill='black')
detail.save(OUT/'repair-details.png')
closeup = Image.new('RGB', (1152, 430), '#e9e3d6')
d = ImageDraw.Draw(closeup)
for i, name in enumerate(['idle_a', 'attack', 'windup']):
    z = frames[name].resize((384, 384), Image.Resampling.NEAREST)
    closeup.paste(z, (i*384, 30), z)
    d.text((i*384+8, 5), name, fill='black')
closeup.save(OUT/'repair-closeup.png')
z = frames['attack'].resize((512, 512), Image.Resampling.NEAREST)
attack_study = Image.new('RGB', z.size, '#e9e3d6')
attack_study.paste(z, (0, 0), z)
attack_study.save(OUT/'attack-study.png')

import runpy
runpy.run_path(str(ROOT/'readback_pixels.py'))
runpy.run_path(str(ROOT/'render_revision_inspection.py'))

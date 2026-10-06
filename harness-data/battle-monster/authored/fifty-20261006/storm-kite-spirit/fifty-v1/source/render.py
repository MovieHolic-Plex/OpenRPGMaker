"""Read literal grids and bake native PNGs, diagnostic sheets and fixed-palette GIFs.
Only diagnostics are enlarged. Nothing here authors or modifies source pixels.
"""
from pathlib import Path
import json, hashlib
from PIL import Image, ImageDraw, ImageFont
ROOT=Path(__file__).resolve().parent
P=json.loads((ROOT/'palette.json').read_text())
RGB={k:tuple(bytes.fromhex(v[1:])) for k,v in P.items()}
OUT=ROOT/'preview'
OUT.mkdir(exist_ok=True)
IMAGES={}
INFO={}
for folder in ('poses','actions'):
    for f in sorted((ROOT/folder).glob('*.pxgrid')):
        rows=f.read_text().splitlines()
        if len(rows)!=96 or any(len(r)!=96 for r in rows): raise ValueError(f)
        im=Image.new('RGBA',(96,96))
        ink=[]
        for y,row in enumerate(rows):
            for x,ch in enumerate(row):
                if ch!='.':
                    if not (1<=x<=94 and 1<=y<=92): raise ValueError((f,x,y))
                    im.putpixel((x,y),RGB[ch]+(255,))
                    ink.append((x,y))
        im.save(OUT/(f.stem+'.png'))
        IMAGES[f.stem]=im
        INFO[f.stem]={'bbox':im.getbbox(),'ink':len(ink),'source_sha256':hashlib.sha256(f.read_bytes()).hexdigest()}
ORDER=['idle_a','idle_b','idle_c','windup','move','attack','recover','hit','dead','skill_a','skill_b','skill_c','poison_a','poison_b','stun_a','stun_b','sleep_a','sleep_b']
ORDER=[n for n in ORDER if n in IMAGES]
# Diagnostic backgrounds only, never used as source pixels.
def backing(kind):
    im=Image.new('RGBA',(96,96),('#EFE5CB' if kind=='light' else '#141821'))
    if kind=='check':
        for y in range(96):
            for x in range(96): im.putpixel((x,y),(65,70,79,255) if (x//8+y//8)%2 else (106,111,120,255))
    return im
for bg in ('light','dark','check'):
    for scale in (1,3):
        w,h=96*scale+16,96*scale+24
        sheet=Image.new('RGB',(w*6,h*((len(ORDER)+5)//6)), '#20242C')
        draw=ImageDraw.Draw(sheet)
        for i,n in enumerate(ORDER):
            cell=backing(bg)
            cell.alpha_composite(IMAGES[n])
            cell=cell.resize((96*scale,96*scale),Image.Resampling.NEAREST)
            xx=(i%6)*w+8; yy=(i//6)*h+20
            sheet.paste(cell.convert('RGB'),(xx,yy))
            draw.text((xx,yy-15),n,fill='#EFE5CB')
        sheet.save(OUT/('sheet-'+bg+'-'+str(scale)+'x.png'))
if all(n in IMAGES for n in ORDER[:9]):
    sheet=Image.new('RGBA',(288,288))
    for i,n in enumerate(ORDER[:9]):sheet.alpha_composite(IMAGES[n],((i%3)*96,(i//3)*96))
    sheet.save(OUT/'poses.png')
if len(ORDER)==18:
    sheet=Image.new('RGBA',(288,288))
    for i,n in enumerate(ORDER[9:]):sheet.alpha_composite(IMAGES[n],((i%3)*96,(i//3)*96))
    sheet.save(OUT/'actions.png')
MOTIONS={
'idle':(['idle_a','idle_b','idle_c','idle_b'],[240,240,240,240]),
'attack':(['idle_a','windup','move','attack','recover','idle_a'],[240,260,120,180,200,260]),
'hit':(['idle_a','hit','recover','idle_a'],[280,320,200,280]),
'dead':(['hit','dead'],[280,1100]),
'skill':(['idle_a','skill_a','skill_b','skill_c','idle_a'],[240,400,220,340,280]),
'poison':(['poison_a','poison_b'],[440,440]),
'stun':(['stun_a','stun_b'],[480,480]),
'sleep':(['sleep_a','sleep_b'],[700,700])}
keys=list(P)
pal=[0,0,0]+[c for k in keys for c in RGB[k]]
pal += [0]*(768-len(pal))
for name,(names,durations) in MOTIONS.items():
    if not all(n in IMAGES for n in names):continue
    frames=[]
    for n in names:
        im=Image.new('P',(96,96),0);im.putpalette(pal)
        for y in range(96):
            for x in range(96):
                rgba=IMAGES[n].getpixel((x,y))
                if rgba[3]:im.putpixel((x,y),keys.index(next(k for k,v in RGB.items() if v==rgba[:3]))+1)
        frames.append(im)
    path=OUT/(name+'.gif')
    frames[0].save(path,save_all=True,append_images=frames[1:],duration=durations,loop=0,transparency=0,disposal=2,optimize=False)
    gif=Image.open(path)
    for i,n in enumerate(names):
        gif.seek(i)
        rendered=gif.convert('RGBA')
        if rendered.tobytes()!=IMAGES[n].tobytes():raise ValueError(('GIF pixel mismatch',name,i))
(ROOT/'preview'/'pixel-report.json').write_text(json.dumps(INFO,indent=2)+'\n')
print('Baked',len(IMAGES),'native PNGs; exact GIF round trips; no source mutation')
# Open the GIF files themselves and make contact strips from their decoded frames.
# Their holds are annotated, so visual inspection uses the delivered sequence.
for group, names in [('combat',['idle','attack','hit','dead']),('status',['skill','poison','stun','sleep'])]:
    strip=Image.new('RGB',(6*208,4*224),'#20242C')
    draw=ImageDraw.Draw(strip)
    for yy,name in enumerate(names):
        path=OUT/(name+'.gif')
        if not path.exists():continue
        gif=Image.open(path)
        for j in range(gif.n_frames):
            gif.seek(j)
            cell=backing('light' if yy%2==0 else 'check')
            cell.alpha_composite(gif.convert('RGBA'))
            strip.paste(cell.convert('RGB').resize((192,192),Image.Resampling.NEAREST),(j*208+8,yy*224+24))
            draw.text((j*208+8,yy*224+6),f'{name} {j+1} / {gif.info.get("duration")}ms',fill='#EFE5CB')
    strip.save(OUT/('gif-contact-'+group+'.png'))
# Honest hashes of actual current rendered files; no review or model metadata.
for n in INFO:
    INFO[n]['png_sha256']=hashlib.sha256((OUT/(n+'.png')).read_bytes()).hexdigest()
(OUT/'pixel-report.json').write_text(json.dumps(INFO,indent=2)+'\n')

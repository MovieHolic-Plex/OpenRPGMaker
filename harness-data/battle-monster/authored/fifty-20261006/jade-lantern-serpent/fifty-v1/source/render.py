"""Decode literal pxgrids; labels/backgrounds/nearest zoom are diagnostics only."""
from pathlib import Path
from PIL import Image, ImageDraw
import json, hashlib, sys
ROOT=Path(__file__).resolve().parent
OUT=ROOT/'artifacts'
OUT.mkdir(exist_ok=True)
pal=json.loads((ROOT/'palette.json').read_text())
colors={s:tuple(bytes.fromhex(c[1:]))+(255,) for s,c in pal.items()}
colors['.']=(0,0,0,0)
names=['idle_a','idle_b','idle_c','windup','move','attack','recover','hit','dead','skill_a','skill_b','skill_c','poison_a','poison_b','stun_a','stun_b','sleep_a','sleep_b']
frames={}
report={}
for name in names:
    path=ROOT/('poses' if name in names[:9] else 'actions')/(name+'.pxgrid')
    if not path.exists(): continue
    rows=path.read_text().splitlines()
    if len(rows)!=96 or any(len(r)!=96 for r in rows): raise ValueError(name+' grid dimensions')
    im=Image.new('RGBA',(96,96)); im.putdata([colors[c] for r in rows for c in r])
    im.save(OUT/(name+'.png')); frames[name]=im
    report[name]={'bbox':im.getbbox(),'sha256':hashlib.sha256(im.tobytes()).hexdigest()}
    if im.getbbox()[0]<1 or im.getbbox()[1]<1 or im.getbbox()[2]>95 or im.getbbox()[3]>93: raise ValueError(name+' margin')
if 'idle_a' in frames and frames['idle_a'].getbbox()[3]!=93: raise ValueError('idle ground')
(OUT/'geometry.json').write_text(json.dumps(report,indent=2)+'\n')
# Native plus magnified views on three backgrounds. No final artwork resizing.
for name, im in frames.items():
    sheet=Image.new('RGB',(900,330),'#777777'); draw=ImageDraw.Draw(sheet)
    for idx,bg in enumerate(('#eee5d4','#142034','checker')):
        tile=Image.new('RGBA',(288,288),bg if bg!='checker' else '#a0a0a0')
        if bg=='checker':
            p=tile.load()
            for y in range(288):
                for x in range(288): p[x,y]=(180,180,180,255) if (x//12+y//12)%2 else (115,115,115,255)
        tile.alpha_composite(im.resize((288,288),Image.Resampling.NEAREST))
        sheet.paste(tile.convert('RGB'),(idx*300,30)); draw.text((idx*300+5,8),name+' 3x '+bg,fill='white')
    sheet.save(OUT/(name+'-inspection.png'))
if len(frames)>1:
    native=Image.new('RGB',(3*128,6*118),'#ddd4bf'); d=ImageDraw.Draw(native)
    large=Image.new('RGB',(3*304,6*310),'#142034'); dl=ImageDraw.Draw(large)
    for index,name in enumerate(names):
        if name not in frames:continue
        x,y=(index%3)*128,(index//3)*118
        native.paste(frames[name],(x+16,y+18),frames[name]); d.text((x+5,y+2),name,fill='#142034')
        x,y=(index%3)*304,(index//3)*310
        z=frames[name].resize((288,288),Image.Resampling.NEAREST)
        large.paste(z,(x+8,y+20),z); dl.text((x+8,y+3),name,fill='#ddd4bf')
    native.save(OUT/'all-native.png'); large.save(OUT/'all-3x.png')
# Exact indexed palette for each GIF, never quantize or interpolate the source.
scenes=[('idle',['idle_a','idle_b','idle_c','idle_b'],[240]*4),
('attack',['idle_a','windup','move','attack','recover','idle_a'],[600,200,100,120,220,900]),
('hit',['idle_a','hit','idle_a'],[700,180,900]),
('dead',['idle_a','hit','dead'],[700,150,1700]),
('skill',['idle_a','skill_a','skill_b','skill_c','idle_a'],[700,260,160,240,900]),
('poison',['poison_a','poison_b'],[420,420]),('stun',['stun_a','stun_b'],[300,300]),('sleep',['sleep_a','sleep_b'],[650,650])]
rgb=[tuple(bytes.fromhex(c[1:])) for c in pal.values()]
lookup={c:i+1 for i,c in enumerate(rgb)}
gifpal=[0,0,0]+[v for c in rgb for v in c]; gifpal += [0]*(768-len(gifpal))
indexed={}
for name,im in frames.items():
    out=Image.new('P',(96,96));out.putpalette(gifpal)
    out.putdata([lookup[p[:3]] if p[3] else 0 for p in im.getdata()]);out.info['transparency']=0;indexed[name]=out
for name,seq,times in scenes:
    if not all(f in frames for f in seq):continue
    path=OUT/(name+'.gif')
    indexed[seq[0]].save(path,save_all=True,append_images=[indexed[f] for f in seq[1:]],duration=times,loop=0,transparency=0,disposal=2,optimize=False)
    with Image.open(path) as decoded:
        for i,f in enumerate(seq):
            decoded.seek(i)
            if decoded.convert('RGBA').tobytes()!=frames[f].tobytes():raise ValueError(name+' GIF decode mismatch')
print(json.dumps(report,indent=2))

# Native deliverable sheets have no labels, backgrounds or enlarged artwork.
for sheet_name,sequence in [('poses',names[:9]),('actions',names[9:]),('suite',names)]:
    if not all(n in frames for n in sequence):continue
    sheet=Image.new('RGBA',(288,96*((len(sequence)+2)//3)))
    for i,n in enumerate(sequence):sheet.paste(frames[n],((i%3)*96,(i//3)*96))
    sheet.save(OUT/(sheet_name+'-sheet.png'))
# Inspect the GIF decoder output itself, with holds labeled above each native cel.
atlas=Image.new('RGB',(6*120,8*126),'#ddd4bf'); ad=ImageDraw.Draw(atlas)
timing=[]
for row,(name,sequence,holds) in enumerate(scenes):
    path=OUT/(name+'.gif')
    if not path.exists():continue
    timing.append({'name':name,'poses':sequence,'holdsMs':holds,'loopMs':sum(holds)})
    strip=Image.new('RGB',(120*len(sequence),126),'#142034'); sd=ImageDraw.Draw(strip)
    with Image.open(path) as decoded:
        if decoded.n_frames!=len(sequence):raise ValueError('GIF frame count '+name)
        for i,n in enumerate(sequence):
            decoded.seek(i); cel=decoded.convert('RGBA')
            if decoded.info['duration']!=holds[i]:raise ValueError('GIF hold '+name)
            strip.paste(cel,(i*120+12,28),cel)
            sd.text((i*120+3,2),n,fill='#ddd4bf');sd.text((i*120+3,14),str(holds[i])+' ms',fill='#ddd4bf')
            atlas.paste(cel,(i*120+12,row*126+28),cel)
            ad.text((i*120+3,row*126+2),name+' / '+n,fill='#142034')
            ad.text((i*120+3,row*126+14),str(holds[i])+' ms',fill='#142034')
    strip.save(OUT/(name+'-decoded-strip.png'))
atlas.save(OUT/'motions-decoded-native.png')
(OUT/'timing.json').write_text(json.dumps(timing,indent=2)+'\n')
# Three checker contact pages preserve native dimensions and make alpha gaps visible.
for page in range(3):
    subset=names[page*6:page*6+6]
    contact=Image.new('RGB',(3*304,2*312),'#707070'); d=ImageDraw.Draw(contact)
    for i,n in enumerate(subset):
        if n not in frames:continue
        tile=Image.new('RGBA',(288,288));pix=tile.load()
        for y in range(288):
            for x in range(288):pix[x,y]=(180,180,180,255) if (x//12+y//12)%2 else (115,115,115,255)
        tile.alpha_composite(frames[n].resize((288,288),Image.Resampling.NEAREST))
        x,y=(i%3)*304,(i//3)*312
        contact.paste(tile.convert('RGB'),(x+8,y+20));d.text((x+8,y+4),n,fill='white')
    contact.save(OUT/('checker-'+str(page+1)+'.png'))

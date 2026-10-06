"""Decode literal grids and display at native size or nearest enlargement only."""
from pathlib import Path
from PIL import Image,ImageDraw
import json,hashlib
R=Path(__file__).resolve().parent
palette=json.loads((R/'palette.json').read_text()); colors={k:tuple(bytes.fromhex(v[1:]))+(255,) for k,v in palette.items()}; colors['.']=(0,0,0,0)
frames={}
for p in sorted(list((R/'poses').glob('*.pxgrid'))+list((R/'actions').glob('*.pxgrid'))):
    rows=p.read_text().splitlines()
    if len(rows)!=128 or any(len(row)!=128 for row in rows): raise ValueError(str(p))
    im=Image.new('RGBA',(128,128)); im.putdata([colors[c] for row in rows for c in row]);frames[p.stem]=im
    (R/'preview').mkdir(exist_ok=True);im.save(R/'preview'/(p.stem+'.png'))
order=['idle_a','idle_b','idle_c','windup','move','attack','recover','hit','dead','skill_a','skill_b','skill_c','poison_a','poison_b','stun_a','stun_b','sleep_a','sleep_b']
order=[n for n in order if n in frames]
for bg in ['light','dark','checker']:
    sheet=Image.new('RGB',(3*400,((len(order)+2)//3)*420),'#e6dfcf' if bg=='light' else '#272936')
    d=ImageDraw.Draw(sheet)
    for i,n in enumerate(order):
        x=(i%3)*400;y=(i//3)*420
        if bg=='checker':
            for yy in range(0,384,24):
                for xx in range(0,384,24): d.rectangle((x+xx,y+24+yy,x+xx+23,y+24+yy+23),fill='#9698a2' if (xx//24+yy//24)%2 else '#c9c7c4')
        d.text((x+8,y+5),n,fill='#15121f' if bg=='light' else '#faf4de')
        im=frames[n].resize((384,384),Image.Resampling.NEAREST);sheet.paste(im,(x,y+24),im)
    sheet.save(R/'preview'/('sheet-'+bg+'.png'))
# Native views are unscaled, three backgrounds for anatomy inspection.
native=Image.new('RGB',(3*144,len(order)*150),'#dfd8c9');d=ImageDraw.Draw(native)
for i,n in enumerate(order):
    for j,bg in enumerate(['light','dark','checker']):
        x=j*144;y=i*150
        d.rectangle((x,y,x+143,y+149),fill='#dfd8c9' if bg=='light' else '#252733')
        if bg=='checker':
            for yy in range(0,128,8):
                for xx in range(0,128,8): d.rectangle((x+xx,y+18+yy,x+xx+7,y+18+yy+7),fill='#999ca1' if (xx//8+yy//8)%2 else '#cecbc4')
        d.text((x,y+2),n,fill='#14121f' if j==0 else '#faf0da');native.paste(frames[n],(x,y+18),frames[n])
native.save(R/'preview'/'native.png')
scenes={'idle':(['idle_a','idle_b','idle_c','idle_b'],[240]*4),'attack':(['idle_a','windup','move','attack','recover','idle_a'],[600,200,100,120,220,900]),'hit':(['idle_a','hit','idle_a'],[700,180,900]),'dead':(['idle_a','hit','dead'],[700,150,1700]),'skill':(['idle_a','skill_a','skill_b','skill_c','idle_a'],[700,260,160,240,900]),'poison':(['poison_a','poison_b'],[420,420]),'stun':(['stun_a','stun_b'],[300,300]),'sleep':(['sleep_a','sleep_b'],[650,650])}
# Fixed palette encoding preserves every authored RGB, including transparent index 0.
pal=[0,0,0]+[v for c in palette.values() for v in bytes.fromhex(c[1:])];pal += [0]*(768-len(pal)); lookup={k:i+1 for i,k in enumerate(palette)};lookup['.']=0
indexed={}
for n in frames:
    path=(R/('actions' if n.startswith(('skill','poison','stun','sleep')) else 'poses')/(n+'.pxgrid'))
    im=Image.new('P',(128,128));im.putpalette(pal);im.putdata([lookup[c] for c in path.read_text() if c!='\n']);im.info['transparency']=0;indexed[n]=im
for n,(seq,holds) in scenes.items():
    if not all(p in frames for p in seq):continue
    imgs=[indexed[p] for p in seq];imgs[0].save(R/'preview'/(n+'.gif'),save_all=True,append_images=imgs[1:],duration=holds,transparency=0,disposal=2,loop=0,optimize=False)
    with Image.open(R/'preview'/(n+'.gif')) as gif:
        for i,p in enumerate(seq):
            gif.seek(i)
            if gif.convert('RGBA').tobytes()!=frames[p].tobytes():raise ValueError('GIF decode '+n)
(R/'preview'/'timing.json').write_text(json.dumps(scenes,indent=2)+'\n')
print('Rendered',len(frames),'literal frames;',len(palette),'colors')
# Native 3x3 packed contact sheets: layout only, no art changes.
for kind,names in [('poses',order[:9]),('actions',order[9:])]:
    sheet=Image.new('RGBA',(384,384),(0,0,0,0))
    for i,n in enumerate(names):sheet.paste(frames[n],((i%3)*128,(i//3)*128))
    sheet.save(R/'preview'/(kind+'.png'))
# Re-read real GIF frames for an inspection strip, with labels outside the art.
for name,(seq,holds) in scenes.items():
    if not all(p in frames for p in seq):continue
    strip=Image.new('RGB',(len(seq)*140,156),'#ded8cb');d=ImageDraw.Draw(strip)
    with Image.open(R/'preview'/(name+'.gif')) as gif:
        for i,n in enumerate(seq):
            gif.seek(i);im=gif.convert('RGBA');strip.paste(im,(140*i,20),im);d.text((140*i+2,4),n,fill='#15121f')
    strip.save(R/'preview'/(name+'-decoded.png'))
for bg in ['light','dark','checker']:
    sheet=Image.open(R/'preview'/('sheet-'+bg+'.png'))
    for i in range(3):sheet.crop((0,i*840,1200,(i+1)*840)).save(R/'preview'/(bg+'-part-'+str(i+1)+'.png'))
native=Image.open(R/'preview'/'native.png');native.crop((0,2400,432,2700)).save(R/'preview'/'sleep-native.png')
# Factual source digests only; not a harness binding or an approval record.
paths=[R/'palette.json']+sorted((R/'poses').glob('*.pxgrid'))+sorted((R/'actions').glob('*.pxgrid'))
(R/'preview'/'source-hashes.json').write_text(json.dumps({str(p.relative_to(R)):hashlib.sha256(p.read_bytes()).hexdigest() for p in paths},indent=2)+'\n')
# Complete final inspection views; all pixels come from the saved grids/GIFs.
strips=[Image.open(R/'preview'/(n+'-decoded.png')).convert('RGB') for n in scenes]
overview=Image.new('RGB',(max(im.width for im in strips),len(strips)*156),'#ded8cb')
for i,im in enumerate(strips):overview.paste(im,(0,i*156))
overview.save(R/'preview'/'all-gifs-decoded.png')
for i in range(3):native.crop((0,i*900,432,(i+1)*900)).save(R/'preview'/('native-part-'+str(i+1)+'.png'))
detail=Image.new('RGB',(600,380),'#dfd8c9');d=ImageDraw.Draw(detail)
for i,n in enumerate(['sleep_a','sleep_b']):
    im=frames[n].crop((84,80,113,108)).resize((232,224),Image.Resampling.NEAREST)
    detail.paste(im,(i*300,24),im);d.text((i*300+5,4),n,fill='#15121f')
detail.save(R/'preview'/'sleep-knee-detail.png')
baseline=R/'original-before-repair'
if baseline.is_dir():
    report={}
    for n in order:
        folder='actions' if n.startswith(('skill','poison','stun','sleep')) else 'poses'
        p=R/folder/(n+'.pxgrid');rows=p.read_text().splitlines()
        old=(baseline/folder/(n+'.pxgrid')).read_text().splitlines()
        pixels=[(x,y) for y,row in enumerate(rows) for x,c in enumerate(row) if c!='.']
        diff=[(x,y) for y,row in enumerate(rows) for x,c in enumerate(row) if c!=old[y][x]]
        report[n]={'canvas':[len(rows[0]),len(rows)],'row_widths':sorted(set(map(len,rows))),
                   'ink_bounds':[min(x for x,y in pixels),min(y for x,y in pixels),max(x for x,y in pixels),max(y for x,y in pixels)],
                   'border_transparent':all(x not in (0,127) and y not in (0,127) for x,y in pixels),
                   'changed_pixels':len(diff),
                   'changed_bounds':[min(x for x,y in diff),min(y for x,y in diff),max(x for x,y in diff),max(y for x,y in diff)] if diff else None}
    (R/'preview'/'repair-summary.json').write_text(json.dumps(report,indent=2)+'\n')

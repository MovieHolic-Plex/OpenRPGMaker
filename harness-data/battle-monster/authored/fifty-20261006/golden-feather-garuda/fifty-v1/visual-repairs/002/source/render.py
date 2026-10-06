"""Read literal grids; encode PNGs/GIFs and diagnostic nearest-neighbor views."""
from pathlib import Path
from PIL import Image, ImageDraw
import json
R=Path(__file__).parent
P=json.loads((R/'palette.json').read_text())
imgs={}
for f in sorted(list((R/'poses').glob('*.pxgrid'))+list((R/'actions').glob('*.pxgrid'))):
    rows=f.read_text().splitlines()
    im=Image.new('RGBA',(128,128))
    for y,row in enumerate(rows):
        for x,k in enumerate(row):
            if k!='.': im.putpixel((x,y),tuple(bytes.fromhex(P[k][1:]))+(255,))
    imgs[f.stem]=im
    (R/'png').mkdir(exist_ok=True);im.save(R/'png'/f'{f.stem}.png')

def bg(kind,size):
    im=Image.new('RGB',size,{'dark':'#18202B','light':'#EFE6D5','checker':'#A4A8AF'}[kind])
    if kind=='checker':
        px=im.load()
        for y in range(size[1]):
            for x in range(size[0]):px[x,y]=(190,194,201) if (x//8+y//8)%2 else (132,139,148)
    return im
for name,im in imgs.items():
    sheet=Image.new('RGB',(128*3,128), '#18202B')
    for i,k in enumerate(['dark','light','checker']):
        tile=bg(k,(128,128));tile.paste(im,(0,0),im);sheet.paste(tile,(128*i,0))
    sheet.save(R/'png'/f'{name}-backgrounds.png')
    sheet.resize((1152,384),Image.Resampling.NEAREST).save(R/'png'/f'{name}-inspection.png')
order=['idle_a','idle_b','idle_c','windup','move','attack','recover','hit','dead','skill_a','skill_b','skill_c','poison_a','poison_b','stun_a','stun_b','sleep_a','sleep_b']
contact=Image.new('RGB',(128*6,148*3),'#202733');d=ImageDraw.Draw(contact)
for idx,name in enumerate(order):
    if name in imgs:
        x=(idx%6)*128;y=(idx//6)*148;contact.paste(imgs[name],(x,y),imgs[name]);d.text((x+4,y+129),name,fill='#FFFFFF')
contact.save(R/'png'/'contact-native.png')
contact.resize((1536,888),Image.Resampling.NEAREST).save(R/'png'/'contact-inspection.png')
# Exact RGB palette encoding; GIF never invents colors or art.
seqs={'idle':(['idle_a','idle_b','idle_c','idle_b'],[240]*4),'attack':(['idle_a','windup','move','attack','recover','idle_a'],[240,180,110,170,200,240]),'hit':(['idle_a','hit','idle_b'],[240,220,240]),'dead':(['idle_a','hit','dead'],[240,180,1100]),'skill':(['idle_a','skill_a','skill_b','skill_c','idle_a'],[240,360,240,300,240]),'poison':(['poison_a','poison_b'],[360,360]),'stun':(['stun_a','stun_b'],[420,420]),'sleep':(['sleep_a','sleep_b'],[640,760])}
colors=[tuple(bytes.fromhex(s[1:])) for s in P.values()]
index={rgb:i+1 for i,rgb in enumerate(colors)}
pal=[0,0,0]+[v for rgb in colors for v in rgb];pal += [0]*(768-len(pal))
(R/'gif').mkdir(exist_ok=True)
for name,(seq,holds) in seqs.items():
    if not all(k in imgs for k in seq):continue
    fs=[]
    for k in seq:
        f=Image.new('P',(128,128));f.putpalette(pal)
        f.putdata([index[rgb[:3]] if rgb[3] else 0 for rgb in imgs[k].getdata()]);fs.append(f)
    fs[0].save(R/'gif'/f'{name}.gif',save_all=True,append_images=fs[1:],duration=holds,loop=0,transparency=0,disposal=2,optimize=False)
print('Rendered',len(imgs),'literal frames')
# Native 3x3 sheets use the project's specified frame order.
for label,names in [('poses',['idle_a','idle_b','idle_c','windup','move','attack','recover','hit','dead']),('actions',['skill_a','skill_b','skill_c','poison_a','poison_b','stun_a','stun_b','sleep_a','sleep_b'])]:
    sheet=Image.new('RGBA',(384,384))
    for idx,name in enumerate(names):sheet.paste(imgs[name],((idx%3)*128,(idx//3)*128))
    sheet.save(R/'png'/f'{label}-sheet.png')
# Reopen actual GIFs, preserve native decoded pixels, and expose the motion timeline.
records={}
film=Image.new('RGB',(128*6,152*8),'#222C38');draw=ImageDraw.Draw(film)
for row,(name,(seq,holds)) in enumerate(seqs.items()):
    gif=Image.open(R/'gif'/f'{name}.gif');entries=[]
    strip=Image.new('RGB',(128*len(seq),148),'#222C38');sd=ImageDraw.Draw(strip)
    for idx,k in enumerate(seq):
        gif.seek(idx);rgba=gif.convert('RGBA')
        differences=sum(a!=b for a,b in zip(rgba.get_flattened_data(),imgs[k].get_flattened_data()))
        entries.append({'source':k,'durationMs':gif.info.get('duration'),'differentPixels':differences})
        strip.paste(rgba,(idx*128,0),rgba);sd.text((idx*128+3,131),f'{k} {gif.info.get("duration")}ms',fill='white')
        film.paste(rgba,(idx*128,row*152),rgba);draw.text((idx*128+3,row*152+130),f'{k} {gif.info.get("duration")}ms',fill='white')
    strip.save(R/'png'/f'gif-{name}-native.png')
    strip.resize((len(seq)*256,296),Image.Resampling.NEAREST).save(R/'png'/f'gif-{name}-inspection.png')
    records[name]={'frames':entries,'decodedSize':list(gif.size)}
film.save(R/'png'/'gif-timelines-native.png')
film.resize((1536,2432),Image.Resampling.NEAREST).save(R/'png'/'gif-timelines-inspection.png')
(R/'gif-reload.json').write_text(json.dumps(records,indent=2)+'\n')
print('Reopened',len(records),'GIFs; native decoded differences',sum(x['differentPixels'] for g in records.values() for x in g['frames']))
# All 18 cels on all three diagnostic backgrounds at 1x.
for page in range(3):
    sheet=Image.new('RGB',(384,148*6),'#252E3C');d=ImageDraw.Draw(sheet)
    for row,name in enumerate(order[page*6:page*6+6]):
        for col,kind in enumerate(['dark','light','checker']):
            tile=bg(kind,(128,128));tile.paste(imgs[name],(0,0),imgs[name]);sheet.paste(tile,(col*128,row*148))
        d.text((4,row*148+130),name,fill='white')
    sheet.save(R/'png'/f'all-backgrounds-{page+1}-native.png')
    sheet.resize((768,1776),Image.Resampling.NEAREST).save(R/'png'/f'all-backgrounds-{page+1}-inspection.png')

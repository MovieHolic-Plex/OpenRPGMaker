"""Read full literal grids, convert palette symbols 1:1, render diagnostic displays.
Nearest-neighbor enlargement is used ONLY on labelled review images.
"""
from pathlib import Path
from PIL import Image, ImageDraw
import json, hashlib
ROOT=Path(__file__).resolve().parent
pal=json.loads((ROOT/'palette.json').read_text())
colors={k:tuple(bytes.fromhex(v[1:]))+(255,) for k,v in pal.items()}
colors['.']=(0,0,0,0)
frames={}
report={}
order=['idle_a','idle_b','idle_c','windup','move','attack','recover','hit','dead','skill_a','skill_b','skill_c','poison_a','poison_b','stun_a','stun_b','sleep_a','sleep_b']
for name in order:
    p=ROOT/('poses' if name in order[:9] else 'actions')/(name+'.pxgrid')
    if not p.exists():continue
    rows=p.read_text().splitlines()
    if len(rows)!=128 or any(len(row)!=128 for row in rows): raise ValueError((name,'dimensions'))
    im=Image.new('RGBA',(128,128)); im.putdata([colors[c] for row in rows for c in row]); frames[name]=im
    im.save(ROOT/'preview'/(name+'.png'))
    bbox=im.getbbox()
    if bbox[0]<1 or bbox[1]<1 or bbox[2]>127 or bbox[3]>125: raise ValueError((name,'margin',bbox))
    if name=='idle_a' and bbox[3]!=125:raise ValueError((name,'baseline',bbox))
    report[name]={'bbox':bbox,'ink':sum(c!='.' for row in rows for c in row),'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}
    tile=Image.new('RGB',(128*3,148),'#252C3A')
    for col,bg in enumerate(['#252C3A','#F1E8D5','checker']):
        b=Image.new('RGBA',(128,128),bg if bg!='checker' else '#717986')
        if bg=='checker':
            d=ImageDraw.Draw(b)
            for y in range(0,128,8):
                for x in range(0,128,8):
                    if (x//8+y//8)%2:d.rectangle((x,y,x+7,y+7),fill='#9199A5')
        b.alpha_composite(im);tile.paste(b.convert('RGB'),(col*128,20))
    ImageDraw.Draw(tile).text((4,4),name,fill='white')
    tile.resize((1152,444),Image.Resampling.NEAREST).save(ROOT/'preview'/(name+'-review.png'))
for batch in range(0,len(order),6):
    names=[n for n in order[batch:batch+6] if n in frames]
    if not names:continue
    sheet=Image.new('RGB',(3*256,2*280),'#252C3A');d=ImageDraw.Draw(sheet)
    native=Image.new('RGB',(3*128,2*148),'#F1E8D5'); nd=ImageDraw.Draw(native)
    for i,name in enumerate(names):
        x=(i%3)*256;y=(i//3)*280;d.text((x+4,y+4),name,fill='white')
        sheet.paste(frames[name].resize((256,256),Image.Resampling.NEAREST),(x,y+20),frames[name].resize((256,256),Image.Resampling.NEAREST))
        nx=i%3*128;ny=i//3*148;nd.text((nx+2,ny+2),name,fill='#142934');native.paste(frames[name],(nx,ny+20),frames[name])
    sheet.save(ROOT/'preview'/('contact-'+str(batch//6)+'.png'));native.save(ROOT/'preview'/('native-'+str(batch//6)+'.png'))
# Exact indexed source colors and transparent index 0, no quantization.
seqs={
'idle':(['idle_a','idle_b','idle_c','idle_b'],[240,240,240,240]),
'attack':(['idle_a','windup','move','attack','recover','idle_a'],[600,280,120,160,220,650]),
'hit':(['idle_a','hit','recover','idle_a'],[600,240,220,600]),
'dead':(['idle_a','hit','dead'],[500,180,1200]),
'skill':(['idle_a','skill_a','skill_b','skill_c','idle_a'],[700,350,220,300,900]),
'poison':(['poison_a','poison_b'],[480,480]),
'stun':(['stun_a','stun_b'],[480,480]),
'sleep':(['sleep_a','sleep_b'],[720,720])}
indexed_palette=[0,0,0]+[c for value in pal.values() for c in bytes.fromhex(value[1:])]
indexed_palette+=[0]*(768-len(indexed_palette))
keys={c:i for i,c in enumerate(['.']+list(pal))}
for name,(sequence,holds) in seqs.items():
    if any(n not in frames for n in sequence): continue
    images=[]
    for pose in sequence:
        p=ROOT/('poses' if pose in order[:9] else 'actions')/(pose+'.pxgrid')
        im=Image.new('P',(128,128));im.putpalette(indexed_palette);im.putdata([keys[c] for row in p.read_text().splitlines() for c in row]);im.info['transparency']=0;images.append(im)
    path=ROOT/'preview'/'motions'/(name+'.gif')
    images[0].save(path,save_all=True,append_images=images[1:],duration=holds,loop=0,transparency=0,disposal=2,optimize=False)
    decoded=Image.open(path)
    for i,pose in enumerate(sequence):
        decoded.seek(i)
        if decoded.convert('RGBA').tobytes()!=frames[pose].tobytes():raise ValueError((name,i,'GIF differs'))
        if decoded.info['duration']!=holds[i]:raise ValueError((name,i,'hold differs'))
    report[name+'-gif']={'sequence':sequence,'holdsMs':holds,'decodedFrames':decoded.n_frames}
(ROOT/'preview'/'render-report.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))

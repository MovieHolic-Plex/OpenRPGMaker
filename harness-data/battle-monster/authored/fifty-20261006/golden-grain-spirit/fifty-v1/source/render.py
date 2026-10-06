"""Literal pxgrid decoder and diagnostic display. Never edits source pixels."""
from pathlib import Path
import json
from PIL import Image, ImageDraw
ROOT = Path(__file__).resolve().parent
PAL = json.loads((ROOT/'palette.json').read_text())
OUT = ROOT/'previews'
OUT.mkdir(exist_ok=True)
names = ['idle_a','idle_b','idle_c','windup','move','attack','recover','hit','dead','skill_a','skill_b','skill_c','poison_a','poison_b','stun_a','stun_b','sleep_a','sleep_b']
frames = {}
raws = {}
for name in names:
    p = ROOT/('poses' if name in names[:9] else 'actions')/(name+'.pxgrid')
    if not p.exists(): continue
    rows = p.read_text().splitlines()
    raws[name] = rows
    im = Image.new('RGBA',(96,96))
    for y,row in enumerate(rows):
        for x,c in enumerate(row):
            if c != '.':
                h = PAL[c].lstrip('#')
                im.putpixel((x,y), tuple(int(h[i:i+2],16) for i in (0,2,4))+(255,))
    im.save(OUT/(name+'.png'))
    frames[name]=im
# Display resizes are ONLY nearest-neighbor diagnostic enlargement.
for bgname,bg in [('light','#e9e0cc'),('dark','#212932'),('checker',None)]:
    sheet = Image.new('RGB',(6*304,3*324),'#404047')
    draw = ImageDraw.Draw(sheet)
    for i,(name,im) in enumerate(frames.items()):
        tile=Image.new('RGBA',(96,96),bg or '#bbb6b4')
        if bg is None:
            td=ImageDraw.Draw(tile)
            for y in range(0,96,8):
                for x in range(0,96,8):
                    if (x//8+y//8)%2: td.rectangle((x,y,x+7,y+7),fill='#ded9d7')
        tile.alpha_composite(im)
        x,y=(i%6)*304,(i//6)*324
        sheet.paste(tile.resize((288,288),Image.Resampling.NEAREST),(x+8,y+24))
        draw.text((x+8,y+6),name,fill='white')
    sheet.save(OUT/('sheet-'+bgname+'.png'))
# native-size contact sheet, labels outside native cells
native=Image.new('RGB',(6*112,3*120),'#e9e0cc')
d=ImageDraw.Draw(native)
for i,(name,im) in enumerate(frames.items()):
    x,y=i%6*112,i//6*120
    native.paste(im,(x+8,y+20),im)
    d.text((x+3,y+3),name,fill='#302b28')
native.save(OUT/'sheet-native.png')
clips={
'idle':(['idle_a','idle_b','idle_c','idle_b'],[240,240,240,240]),
'attack':(['idle_a','windup','move','attack','recover','idle_a'],[240,260,120,140,240,360]),
'hit':(['idle_a','hit','recover','idle_a'],[300,200,240,300]),
'dead':(['hit','dead'],[200,1100]),
'skill':(['idle_a','skill_a','skill_b','skill_c','idle_a'],[240,360,220,300,360]),
'poison':(['poison_a','poison_b'],[460,460]),
'stun':(['stun_a','stun_b'],[520,520]),
'sleep':(['sleep_a','sleep_b'],[700,700])}
for clip,(seq,holds) in clips.items():
    if any(n not in frames for n in seq): continue
    ims=[]
    for n in seq:
        # Native indexed GIF, transparent dot index zero and exact authored palette.
        a=Image.new('P',(96,96),0)
        keys=list(PAL)
        colors=[0,0,0]
        for c in keys:
            h=PAL[c].lstrip('#'); colors += [int(h[i:i+2],16) for i in (0,2,4)]
        a.putpalette(colors+[0]*(768-len(colors)))
        a.putdata([0 if c=='.' else keys.index(c)+1 for row in raws[n] for c in row])
        a.info['transparency']=0
        ims.append(a)
    ims[0].save(OUT/(clip+'.gif'),save_all=True,append_images=ims[1:],duration=holds,loop=0,disposal=2,optimize=False,transparency=0)
print('Rendered',len(frames),'native PNGs and diagnostic sheets; clips available', [k for k,(s,_) in clips.items() if all(n in frames for n in s)])

# Decode the actual GIF files for animation contact inspection, no source editing.
contact=Image.new('RGB',(6*208,8*232),'#e9e0cc')
cd=ImageDraw.Draw(contact)
for j,(clip,(seq,holds)) in enumerate(clips.items()):
    g=Image.open(OUT/(clip+'.gif'))
    for i in range(g.n_frames):
        g.seek(i)
        a=g.convert('RGBA')
        b=Image.new('RGBA',(96,96),'#e9e0cc'); b.alpha_composite(a)
        x,y=i*208,j*232
        contact.paste(b.resize((192,192),Image.Resampling.NEAREST),(x+8,y+30))
        cd.text((x+8,y+8),clip+' / '+seq[i]+' / '+str(holds[i])+'ms',fill='#302b28')
contact.save(OUT/'animation-contact.png')
# Exact 3 by 3 native atlas assembly for local review only; harness owns publishing.
for atlas,group in [('poses',names[:9]),('actions',names[9:])]:
    a=Image.new('RGBA',(288,288))
    for i,n in enumerate(group): a.paste(frames[n],((i%3)*96,(i//3)*96))
    a.save(OUT/(atlas+'-sheet.png'))
# Native faces and explicit diagnostic crop coordinates, display only.
face=Image.new('RGB',(880,600),'#e9e0cc'); fd=ImageDraw.Draw(face)
faceboxes={'idle_a':(32,34,62,47),'skill_b':(32,32,62,45),'sleep_a':(34,54,63,66),'sleep_b':(34,54,63,66),'dead':(23,81,45,92)}
for i,(n,box) in enumerate(faceboxes.items()):
    im=frames[n]; x=(i%3)*288; y=(i//3)*288
    fd.text((x+8,y+8),n+' / native',fill='#302b28'); face.paste(im,(x+8,y+30),im)
    b=Image.new('RGBA',(96,96),'#e9e0cc'); b.alpha_composite(im)
    z=b.crop(box).resize(((box[2]-box[0])*7,(box[3]-box[1])*7),Image.Resampling.NEAREST)
    face.paste(z,(x+8,y+145)); fd.text((x+8,y+135),'face / 7x nearest',fill='#302b28')
face.save(OUT/'face-details.png')

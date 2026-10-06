"""Decode literal grids, display diagnostic backgrounds and export GIFs.
Never produces or repairs art pixels. PNG/GIF frame cells stay native 128px.
"""
from pathlib import Path
import json
from PIL import Image, ImageDraw
ROOT=Path(__file__).resolve().parent
palette=json.loads((ROOT/'palette.json').read_text())
COLORS={k:tuple(bytes.fromhex(v[1:]))+(255,) for k,v in palette.items()}
COLORS['.']=(0,0,0,0)
OUT=ROOT/'previews'
OUT.mkdir(exist_ok=True)
frames={}
for path in sorted((ROOT/'poses').glob('*.pxgrid'))+sorted((ROOT/'actions').glob('*.pxgrid')):
    rows=path.read_text().splitlines()
    if len(rows)!=128 or any(len(r)!=128 for r in rows): raise ValueError(path)
    im=Image.new('RGBA',(128,128)); im.putdata([COLORS[c] for row in rows for c in row])
    im.save(OUT/(path.stem+'.png'));frames[path.stem]=im
    print(path.stem,im.getbbox())

def background(kind):
    im=Image.new('RGBA',(128,128),'#EEE9D9' if kind=='light' else '#121D29')
    if kind=='checker':
        d=ImageDraw.Draw(im)
        for y in range(0,128,8):
            for x in range(0,128,8):
                d.rectangle((x,y,x+7,y+7),fill='#697583' if (x//8+y//8)%2 else '#9AA5AE')
    return im

names=list(frames)
for kind in ['light','dark','checker']:
    sheet=Image.new('RGB',(6*140,((len(names)+5)//6)*154),'#253340')
    d=ImageDraw.Draw(sheet)
    for i,name in enumerate(names):
        bg=background(kind);bg.alpha_composite(frames[name])
        x=(i%6)*140+6;y=(i//6)*154+20
        sheet.paste(bg,(x,y));d.text((x,y-16),name,fill='white')
    sheet.save(OUT/(kind+'-native.png'))
    sheet.resize((sheet.width*3,sheet.height*3),Image.Resampling.NEAREST).save(OUT/(kind+'-3x.png'))
if 'idle_a' in frames:
    for kind in ['light','dark','checker']:
        bg=background(kind);bg.alpha_composite(frames['idle_a'])
        bg.resize((512,512),Image.Resampling.NEAREST).save(OUT/('idle-a-'+kind+'-4x.png'))
MOTIONS={
'idle':(['idle_a','idle_b','idle_c','idle_b'],[240,240,240,240]),
'attack':(['idle_a','windup','move','attack','recover','idle_a'],[320,300,120,200,240,320]),
'hit':(['idle_a','hit','recover','idle_a'],[360,220,240,400]),
'dead':(['idle_a','hit','dead'],[450,200,1200]),
'skill':(['idle_a','skill_a','skill_b','skill_c','idle_a'],[350,420,240,360,400]),
'poison':(['poison_a','poison_b'],[460,460]),
'stun':(['stun_a','stun_b'],[500,500]),
'sleep':(['sleep_a','sleep_b'],[720,820])}
# Exact indexed palette; index 0 is transparent. No adaptive quantization.
rgb=[0,0,0]
for c in palette.values():rgb+=list(bytes.fromhex(c[1:]))
rgb+= [0]*(768-len(rgb))
indices={symbol:i+1 for i,symbol in enumerate(palette)};indices['.']=0
for motion,(order,holds) in MOTIONS.items():
    if any(n not in frames for n in order):continue
    seq=[]
    for name in order:
        path=ROOT/('poses' if (ROOT/'poses'/(name+'.pxgrid')).exists() else 'actions')/(name+'.pxgrid')
        im=Image.new('P',(128,128));im.putpalette(rgb)
        im.putdata([indices[c] for c in ''.join(path.read_text().splitlines())]);seq.append(im)
    seq[0].save(OUT/(motion+'.gif'),save_all=True,append_images=seq[1:],duration=holds,loop=0,transparency=0,disposal=2,optimize=False)
    actual=Image.open(OUT/(motion+'.gif'))
    for i,name in enumerate(order):
        actual.seek(i)
        decoded=actual.convert('RGBA')
        for a,b in zip(decoded.getdata(),frames[name].getdata()):
            if a[3]!=b[3] or (b[3] and a!=b):raise ValueError((motion,i,'GIF pixels differ'))
    # Time strip makes every actual GIF frame available for visual inspection.
    strip=Image.new('RGB',(len(order)*140,154),'#253340');d=ImageDraw.Draw(strip)
    for i,name in enumerate(order):
        actual.seek(i);bg=background('checker');bg.alpha_composite(actual.convert('RGBA'))
        strip.paste(bg,(i*140+6,20));d.text((i*140+6,3),name,fill='white')
    strip.resize((strip.width*2,308),Image.Resampling.NEAREST).save(OUT/(motion+'-gif-strip.png'))
# Native contract sheets; no artwork resizing is used for asset export.
pose_order=['idle_a','idle_b','idle_c','windup','move','attack','recover','hit','dead']
action_order=['skill_a','skill_b','skill_c','poison_a','poison_b','stun_a','stun_b','sleep_a','sleep_b']
for sheet_name,order in [('poses-sheet',pose_order),('actions-sheet',action_order)]:
    sheet=Image.new('RGBA',(384,384),(0,0,0,0))
    for i,name in enumerate(order):sheet.paste(frames[name],((i%3)*128,(i//3)*128))
    sheet.save(OUT/(sheet_name+'.png'))

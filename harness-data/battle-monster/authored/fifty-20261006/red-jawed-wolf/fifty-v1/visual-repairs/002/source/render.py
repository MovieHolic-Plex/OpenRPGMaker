"""Decode literal pxgrids. Diagnostic labels/nearest zoom only; never authors pixels."""
from pathlib import Path
import json, hashlib
from PIL import Image, ImageDraw
ROOT=Path(__file__).resolve().parent
OUT=ROOT/'preview'; OUT.mkdir(exist_ok=True)
palette=json.loads((ROOT/'palette.json').read_text())
colors={s:tuple(bytes.fromhex(c[1:]))+(255,) for s,c in palette.items()}
frames={}
for path in sorted((ROOT/'poses').glob('*.pxgrid'))+sorted((ROOT/'actions').glob('*.pxgrid')):
    rows=path.read_text().splitlines()
    if len(rows)!=64 or any(len(r)!=64 for r in rows): raise ValueError(path)
    im=Image.new('RGBA',(64,64)); im.putdata([colors[s] if s!='.' else (0,0,0,0) for r in rows for s in r])
    im.save(OUT/(path.stem+'.png')); frames[path.stem]=im
order=('idle_a','idle_b','idle_c','windup','move','attack','recover','hit','dead','skill_a','skill_b','skill_c','poison_a','poison_b','stun_a','stun_b','sleep_a','sleep_b')
order=[x for x in order if x in frames]
for theme,bg in [('light','#d9d8cc'),('dark','#252838'),('checker',None)]:
    sheet=Image.new('RGB',(6*264,((len(order)+5)//6)*290),'#434653'); draw=ImageDraw.Draw(sheet)
    for i,name in enumerate(order):
        tile=Image.new('RGBA',(64,64),bg or '#9499a3')
        if bg is None:
            td=ImageDraw.Draw(tile)
            for y in range(0,64,8):
                for x in range(0,64,8):
                    if (x//8+y//8)%2: td.rectangle((x,y,x+7,y+7),fill='#c2c4ca')
        tile.alpha_composite(frames[name])
        x=(i%6)*264+4; y=(i//6)*290+22
        sheet.paste(tile.resize((256,256),Image.Resampling.NEAREST),(x,y))
        draw.text((x,y-18),name,fill='white')
    sheet.save(OUT/('sheet-'+theme+'.png'))
# True-size contact sheet.
native=Image.new('RGBA',(6*76,((len(order)+5)//6)*86),'#d9d8cc'); d=ImageDraw.Draw(native)
for i,name in enumerate(order):
    x=(i%6)*76+6; y=(i//6)*86+18
    native.alpha_composite(frames[name],(x,y)); d.text((x,y-13),name,fill='#222222')
native.save(OUT/'sheet-native.png')
SCENES={
'idle':(('idle_a','idle_b','idle_c','idle_b'),(240,240,240,240)),
'attack':(('idle_a','windup','move','attack','recover','idle_a'),(600,200,100,120,220,900)),
'hit':(('idle_a','hit','idle_a'),(700,180,900)),
'dead':(('idle_a','hit','dead'),(700,150,1700)),
'skill':(('idle_a','skill_a','skill_b','skill_c','idle_a'),(700,260,160,240,900)),
'poison':(('poison_a','poison_b'),(420,420)),
'stun':(('stun_a','stun_b'),(300,300)),
'sleep':(('sleep_a','sleep_b'),(650,650))}
indexed={}
rgb=[tuple(bytes.fromhex(c[1:])) for c in palette.values()]
gifpal=[0,0,0]+[a for c in rgb for a in c]; gifpal += [0]*(768-len(gifpal))
lookup={c:i+1 for i,c in enumerate(rgb)}
for name,im in frames.items():
    p=Image.new('P',(64,64));p.putpalette(gifpal);p.putdata([lookup[q[:3]] if q[3] else 0 for q in im.get_flattened_data()]);indexed[name]=p
for name,(seq,holds) in SCENES.items():
    if not all(x in frames for x in seq): continue
    dest=OUT/(name+'.gif')
    indexed[seq[0]].save(dest,save_all=True,append_images=[indexed[x] for x in seq[1:]],duration=list(holds),loop=0,disposal=2,transparency=0,optimize=False)
    with Image.open(dest) as im:
        for i,p in enumerate(seq):
            im.seek(i)
            if im.convert('RGBA').tobytes()!=frames[p].tobytes(): raise ValueError((name,i,'GIF decode differs'))
# Diagnostics only: dimensions, bounds, unique hashes; no automatic art repair.
report={}
for name,im in frames.items():
    report[name]={'bounds':im.getbbox(),'sha256_rgba':hashlib.sha256(im.tobytes()).hexdigest()}
(OUT/'diagnostics.json').write_text(json.dumps(report,indent=2)+'\n')
print(f'{len(frames)} literal frames rendered; GIF byte readback completed.')

# Native 3x3 sheets for the base/action contracts; no resize of delivered sheets.
for title,names in [('poses',order[:9]),('actions',order[9:])]:
    sheet=Image.new('RGBA',(192,192))
    for i,name in enumerate(names):sheet.alpha_composite(frames[name],((i%3)*64,(i//3)*64))
    sheet.save(OUT/(title+'-sheet.png'))

# Open encoded GIFs and lay decoded frames in order with actual holds for inspection.
proof={}
for group,names in [('basic',('idle','attack','hit','dead')),('actions',('skill','poison','stun','sleep'))]:
    contact=Image.new('RGB',(6*200,4*218),'#252838');d=ImageDraw.Draw(contact)
    for j,name in enumerate(names):
        seq,holds=SCENES[name]; path=OUT/(name+'.gif')
        with Image.open(path) as encoded:
            if encoded.n_frames!=len(seq):raise ValueError((name,'frame count'))
            proof[name]={'sequence':seq,'holds_ms':holds,'decoded_frames':encoded.n_frames,'native_size':list(encoded.size),'rgba_matches_source':True}
            for i,(pose,hold) in enumerate(zip(seq,holds)):
                encoded.seek(i); im=encoded.convert('RGBA')
                if encoded.info.get('duration')!=hold:raise ValueError((name,i,'hold differs'))
                tile=Image.new('RGBA',(64,64),'#d9d8cc');tile.alpha_composite(im)
                x=i*200+4;y=j*218+22
                contact.paste(tile.resize((192,192),Image.Resampling.NEAREST),(x,y))
                d.text((x,y-17),f'{name}: {pose} {hold}ms',fill='white')
    contact.save(OUT/('gif-'+group+'-contact.png'))
(OUT/'gif-readback.json').write_text(json.dumps(proof,indent=2)+'\n')
# Facts for local candidate review; no harness verdict or user selection is written.
facts={'palette_symbols':len(palette),'frames':len(frames),'unique_frame_rgba':len({v['sha256_rgba'] for v in report.values()}),
       'native_cell':[64,64],'idle_a_lowest_ink_y':report['idle_a']['bounds'][3]-1,
       'alpha_values':sorted({px[3] for im in frames.values() for px in im.get_flattened_data()}),
       'frame_bounds':{n:v['bounds'] for n,v in report.items()},'gif_count':len(proof)}
(OUT/'source-facts.json').write_text(json.dumps(facts,indent=2)+'\n')
manifest={str(p.relative_to(ROOT)):hashlib.sha256(p.read_bytes()).hexdigest()
          for p in sorted(list((ROOT/'poses').glob('*.pxgrid'))+list((ROOT/'actions').glob('*.pxgrid'))+[ROOT/'palette.json'])}
(OUT/'source-sha256.json').write_text(json.dumps(manifest,indent=2)+'\n')

"""Read literal grids; render native PNG, labeled nearest-neighbor diagnostics and GIFs."""
from pathlib import Path
from PIL import Image, ImageDraw
import json, hashlib
ROOT=Path(__file__).resolve().parent
OUT=ROOT/'previews'; OUT.mkdir(exist_ok=True)
pal=json.loads((ROOT/'palette.json').read_text())
colors={k:tuple(bytes.fromhex(v[1:]))+(255,) for k,v in pal.items()}
frames={}
for folder in ['poses','actions']:
    for file in sorted((ROOT/folder).glob('*.pxgrid')):
        rows=file.read_text().splitlines()
        if len(rows)!=64 or any(len(r)!=64 for r in rows): raise ValueError(str(file)+' not 64x64')
        im=Image.new('RGBA',(64,64)); ink=[]
        for y,row in enumerate(rows):
            for x,c in enumerate(row):
                if c!='.':
                    im.putpixel((x,y),colors[c]); ink.append((x,y))
        if any(x in (0,63) or y<1 or y>60 for x,y in ink): raise ValueError(str(file)+' margin')
        im.save(OUT/(file.stem+'.png')); frames[file.stem]=im
        print(file.stem,'bounds',im.getbbox(),'ink',len(ink))
order=['idle_a','idle_b','idle_c','windup','move','attack','recover','hit','dead','skill_a','skill_b','skill_c','poison_a','poison_b','stun_a','stun_b','sleep_a','sleep_b']
visible=[n for n in order if n in frames]
for bgname,bg in [('light',(237,228,209)),('dark',(30,34,44)),('checker',None)]:
    sheet=Image.new('RGB',(6*208,3*228),bg or (190,195,201)); draw=ImageDraw.Draw(sheet)
    for i,n in enumerate(visible):
        x=(i%6)*208; y=(i//6)*228
        if bg is None:
            for cy in range(0,192,8):
                for cx in range(0,192,8):
                    color=(165,172,183) if (cy//8+cx//8)%2 else (218,220,224)
                    draw.rectangle((x+cx,y+20+cy,x+cx+7,y+20+cy+7),fill=color)
        draw.text((x+4,y+4),n,fill=(110,117,127) if bgname=='dark' else (20,25,32))
        sheet.paste(frames[n].resize((192,192),Image.Resampling.NEAREST),(x,y+20),frames[n].resize((192,192),Image.Resampling.NEAREST))
    sheet.save(OUT/('sheet-'+bgname+'.png'))
native=Image.new('RGB',(6*96,3*88),(218,220,224)); d=ImageDraw.Draw(native)
for i,n in enumerate(visible):
    x=(i%6)*96;y=(i//6)*88;d.text((x,y),n,fill=(20,25,32));native.paste(frames[n],(x+12,y+18),frames[n])
native.save(OUT/'sheet-native.png')
if len(frames)==18:
    motions={
      'idle':(['idle_a','idle_b','idle_c','idle_b'],[240]*4),
      'attack':(['idle_a','windup','move','attack','recover','idle_a'],[260,240,100,170,250,320]),
      'hit':(['idle_a','hit','recover','idle_a'],[320,260,240,360]),
      'dead':(['hit','dead'],[220,1500]),
      'skill':(['skill_a','skill_b','skill_c','idle_a'],[360,280,380,400]),
      'poison':(['poison_a','poison_b'],[460,460]),
      'stun':(['stun_a','stun_b'],[480,480]),
      'sleep':(['sleep_a','sleep_b'],[850,850])}
    gifpal=[0,0,0]
    for c in colors.values(): gifpal.extend(c[:3])
    gifpal.extend([0]*(768-len(gifpal)))
    indexes={color:i+1 for i,color in enumerate(colors.values())}
    for name,(names,holds) in motions.items():
        cels=[]
        for n in names:
            cel=Image.new('P',(64,64),0);cel.putpalette(gifpal)
            cel.putdata([indexes[frames[n].getpixel((x,y))] if frames[n].getpixel((x,y))[3] else 0 for y in range(64) for x in range(64)]);cels.append(cel)
        cels[0].save(OUT/(name+'.gif'),save_all=True,append_images=cels[1:],duration=holds,loop=0,transparency=0,disposal=2,optimize=False)
    (OUT/'timing.json').write_text(json.dumps(motions,indent=2)+'\n')
    # Re-open actual GIF bytes; contact sheets show stored frames rather than in-memory ones.
    observations={}
    for name,(names,holds) in motions.items():
        path=OUT/(name+'.gif'); gif=Image.open(path)
        contact=Image.new('RGB',(len(names)*204,226),(222,225,229)); cd=ImageDraw.Draw(contact)
        native_contact=Image.new('RGB',(len(names)*96,88),(222,225,229)); nd=ImageDraw.Draw(native_contact)
        mismatches=[]; readholds=[]
        for i,n in enumerate(names):
            gif.seek(i); cel=gif.convert('RGBA');readholds.append(gif.info.get('duration'))
            # RGB values below zero alpha are irrelevant; compare each visible pixel and alpha.
            changed=0
            for y in range(64):
                for x in range(64):
                    actual=cel.getpixel((x,y));expected=frames[n].getpixel((x,y))
                    if actual[3]!=expected[3] or (expected[3] and actual!=expected):changed+=1
            mismatches.append(changed)
            cd.text((i*204+4,4),n+' / '+str(readholds[-1])+' ms',fill=(22,27,34))
            big=cel.resize((192,192),Image.Resampling.NEAREST);contact.paste(big,(i*204+4,24),big)
            nd.text((i*96+2,2),n,fill=(22,27,34));native_contact.paste(cel,(i*96+10,19),cel)
        contact.save(OUT/(name+'-gif-readback.png'));native_contact.save(OUT/(name+'-gif-native.png'))
        observations[name]={'storedFrames':gif.n_frames,'storedHoldsMs':readholds,'differentVisiblePixelsPerFrame':mismatches,'gifSha256':hashlib.sha256(path.read_bytes()).hexdigest()}
    records={}
    for folder in ['poses','actions']:
        for p in sorted((ROOT/folder).glob('*.pxgrid')):
            records[str(p.relative_to(ROOT))]=hashlib.sha256(p.read_bytes()).hexdigest()
    records['palette.json']=hashlib.sha256((ROOT/'palette.json').read_bytes()).hexdigest()
    print('GIF readback:',json.dumps({n:v['differentVisiblePixelsPerFrame'] for n,v in observations.items()}))
    # 3x3 RM2003 sheet, and a separate 3x3 action sheet. Native pixels only.
    for label,names in [('poses',order[:9]),('actions',order[9:])]:
        sheet=Image.new('RGBA',(192,192))
        for i,n in enumerate(names):sheet.paste(frames[n],((i%3)*64,(i//3)*64))
        sheet.save(OUT/(label+'-native.png'))
    png_records={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(OUT.glob('*.png'))}
    (OUT/'readback.json').write_text(json.dumps({'artifactObservationOnly':True,'sourceSha256':records,'pngSha256':png_records,'gifReadback':observations},indent=2)+'\n')

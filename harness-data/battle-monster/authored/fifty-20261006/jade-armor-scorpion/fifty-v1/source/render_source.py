"""Read native ASCII; render exact RGBA, diagnostic nearest zooms and GIF exposures only."""
from pathlib import Path
from PIL import Image,ImageDraw
import json
ROOT=Path(__file__).resolve().parent
pal=json.loads((ROOT/'palette.json').read_text())
rgba={s:tuple(bytes.fromhex(h[1:]))+(255,) for s,h in pal.items()}
frames={}
out=ROOT/'previews'; out.mkdir(exist_ok=True)
for path in sorted((ROOT/'poses').glob('*.pxgrid'))+sorted((ROOT/'actions').glob('*.pxgrid')):
    rows=path.read_text().splitlines()
    if len(rows)!=128 or any(len(r)!=128 for r in rows): raise ValueError(f'Canvas {path.name}')
    im=Image.new('RGBA',(128,128)); im.putdata([rgba[c] if c!='.' else (0,0,0,0) for row in rows for c in row])
    im.save(out/(path.stem+'.png'));frames[path.stem]=im
# Backgrounds are inspection aids; no native art is changed.
def background(kind,size):
    bg=Image.new('RGBA',size,{'light':'#E6DECE','dark':'#19202A','checker':'#A9AAA9'}[kind])
    if kind=='checker':
        d=ImageDraw.Draw(bg)
        for y in range(0,size[1],8):
            for x in range(0,size[0],8):
                if (x//8+y//8)%2==0:d.rectangle((x,y,x+7,y+7),fill='#D6D4CB')
    return bg
order=['idle_a','idle_b','idle_c','windup','move','attack','recover','hit','dead','skill_a','skill_b','skill_c','poison_a','poison_b','stun_a','stun_b','sleep_a','sleep_b']
for kind in ('light','dark','checker'):
    for zoom in (1,3):
        w,h=128*zoom+16,128*zoom+30
        sheet=Image.new('RGB',(w*6,h*3),'#323940')
        d=ImageDraw.Draw(sheet)
        for i,name in enumerate(order):
            if name not in frames:continue
            x,y=(i%6)*w,(i//6)*h
            tile=background(kind,(128,128));tile.alpha_composite(frames[name])
            sheet.paste(tile.convert('RGB').resize((128*zoom,128*zoom),Image.Resampling.NEAREST),(x+8,y+22))
            d.text((x+8,y+5),name,fill='#FFFFFF')
        sheet.save(out/(f'contact-{kind}-{zoom}x.png'))
if len(frames)==18:
    seqs={
     'idle':(['idle_a','idle_b','idle_c','idle_b'],[240]*4),
     'attack':(['idle_a','windup','move','attack','recover','idle_a'],[650,260,120,160,240,650]),
     'hit':(['idle_a','hit','recover','idle_a'],[600,280,240,600]),
     'dead':(['idle_a','hit','dead'],[650,200,1500]),
     'skill':(['idle_a','skill_a','skill_b','skill_c','idle_a'],[700,300,180,340,900]),
     'poison':(['poison_a','poison_b'],[420,420]),
     'stun':(['stun_a','stun_b'],[500,500]),
     'sleep':(['sleep_a','sleep_b'],[650,650])}
    colors=[(0,0,0)]+[tuple(bytes.fromhex(h[1:])) for h in pal.values()]
    rgbidx={v:i for i,v in enumerate(colors)}
    gifpal=[v for c in colors for v in c]+[0]*(768-len(colors)*3)
    for name,(names,durations) in seqs.items():
        ims=[]
        for n in names:
            im=Image.new('P',(128,128));im.putpalette(gifpal)
            im.putdata([rgbidx[p[:3]] if p[3] else 0 for p in frames[n].get_flattened_data()])
            ims.append(im)
        ims[0].save(out/(name+'.gif'),save_all=True,append_images=ims[1:],duration=durations,loop=0,transparency=0,disposal=2,optimize=False)
    (out/'timing.json').write_text(json.dumps(seqs,indent=2)+'\n')
print('Rendered',len(frames),'native PNGs in',out)

# Compact zoom sheets retain true integer-sized pixels inside the image viewer.
for kind in ('light','dark','checker'):
    im=Image.open(out/(f'contact-{kind}-3x.png'))
    im.crop((0,0,1200,1242)).save(out/(f'left-{kind}-3x.png'))
    im.crop((1200,0,2400,1242)).save(out/(f'right-{kind}-3x.png'))

if len(frames)==18:
    # Decode the actual GIF files for visual inspection and lossless native correspondence.
    # This is an export diagnostic, not an independent artistic verdict or repository test.
    import hashlib
    report={'cell':128,'paletteSymbols':len(pal),'frames':{},'gifs':{},'independentReview':'not performed here','userApproval':'not recorded'}
    for name,im in frames.items():
        box=im.getbbox()
        r=(ROOT/('poses' if name in order[:9] else 'actions')/(name+'.pxgrid')).read_bytes()
        report['frames'][name]={'sourceSha256':hashlib.sha256(r).hexdigest(),'boundsInclusive':[box[0],box[1],box[2]-1,box[3]-1],'inkPixels':sum(1 for p in im.get_flattened_data() if p[3]),'pngSha256':hashlib.sha256((out/(name+'.png')).read_bytes()).hexdigest()}
    decoded=Image.new('RGB',(864,1248),'#353F45');dd=ImageDraw.Draw(decoded)
    for j,(name,(names,durations)) in enumerate(seqs.items()):
        gif=Image.open(out/(name+'.gif'));holds=[];exact=[]
        for i,n in enumerate(names):
            gif.seek(i);im=gif.convert('RGBA');holds.append(gif.info['duration'])
            exact.append(im.tobytes()==frames[n].tobytes())
            bg=background('light',(128,128));bg.alpha_composite(im)
            decoded.paste(bg.convert('RGB'),(i*144+8,j*156+23))
            dd.text((i*144+8,j*156+5),f'{name} {i+1}',fill='white')
        report['gifs'][name]={'frames':names,'actualHoldsMs':holds,'nativeRgbaEqual':exact,'sha256':hashlib.sha256((out/(name+'.gif')).read_bytes()).hexdigest()}
    decoded.save(out/'gif-decoded-sequences-1x.png')
    (ROOT/'INSPECTION.json').write_text(json.dumps(report,indent=2)+'\n')
    print('GIF decode correspondence:',{n:all(r['nativeRgbaEqual']) for n,r in report['gifs'].items()})

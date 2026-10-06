"""Read literal pxgrids and render diagnostics only. No authored pixel synthesis."""
from pathlib import Path
import json
from PIL import Image, ImageDraw
ROOT=Path(__file__).resolve().parent
pal=json.loads((ROOT/'palette.json').read_text())
rgba={s:tuple(bytes.fromhex(c[1:]))+(255,) for s,c in pal.items()}
frames={}
for group in ('poses','actions'):
    for file in sorted((ROOT/group).glob('*.pxgrid')):
        rows=file.read_text().splitlines()
        if len(rows)!=64 or any(len(r)!=64 for r in rows):
            raise ValueError(f'Canvas size: {file}')
        im=Image.new('RGBA',(64,64))
        for y,row in enumerate(rows):
            for x,s in enumerate(row):
                if s!='.': im.putpixel((x,y),rgba[s])
        frames[file.stem]=im
        im.save(ROOT/'previews'/(file.stem+'.png'))
# Each frame on light/dark/checker, native and nearest-neighbor diagnostic scale.
for name,im in frames.items():
    sheet=Image.new('RGB',(768,312),'#81858B')
    d=ImageDraw.Draw(sheet)
    for i,bg in enumerate(('#E8DDD1','#242733','checker')):
        native=Image.new('RGBA',(64,64),bg if bg!='checker' else '#A7A6A8')
        if bg=='checker':
            bd=ImageDraw.Draw(native)
            for y in range(0,64,8):
                for x in range(0,64,8):
                    if (x//8+y//8)%2: bd.rectangle((x,y,x+7,y+7),fill='#767782')
        native.alpha_composite(im)
        sheet.paste(native.convert('RGB'),(i*256+96,22))
        sheet.paste(native.convert('RGB').resize((192,192),Image.Resampling.NEAREST),(i*256+32,104))
        d.text((i*256+12,4),name+' / '+bg,fill='white')
    sheet.save(ROOT/'previews'/(name+'-diagnostic.png'))
# Contact sheet: separate native pictures and diagnostic enlargement.
names=['idle_a','idle_b','idle_c','windup','move','attack','recover','hit','dead',
       'skill_a','skill_b','skill_c','poison_a','poison_b','stun_a','stun_b','sleep_a','sleep_b']
sheet=Image.new('RGB',(1152,690),'#D6CDC2'); d=ImageDraw.Draw(sheet)
for i,name in enumerate(names):
    x=(i%6)*192;y=(i//6)*230
    d.text((x+6,y+4),name,fill='#171C29')
    im=frames[name]
    sheet.paste(im,(x+64,y+22),im)
    expanded=im.resize((128,128),Image.Resampling.NEAREST)
    sheet.paste(expanded,(x+32,y+94),expanded)
sheet.save(ROOT/'previews/all-18.png')
# Indexed GIF palette uses the original 18 RGB values directly, no quantization.
keys=['.']+list(pal)
indices={s:i for i,s in enumerate(keys)}
flat=[0,0,0]
for s in keys[1:]: flat.extend(bytes.fromhex(pal[s][1:]))
flat.extend([0]*(768-len(flat)))
indexed={}
for group in ('poses','actions'):
    for file in (ROOT/group).glob('*.pxgrid'):
        im=Image.new('P',(64,64));im.putpalette(flat)
        im.putdata([indices[s] for row in file.read_text().splitlines() for s in row])
        im.info['transparency']=0
        indexed[file.stem]=im
motions={
'idle':[('idle_a',240),('idle_b',240),('idle_c',240),('idle_b',240)],
'attack':[('idle_a',180),('windup',260),('move',100),('attack',150),('recover',200),('idle_a',220)],
'hit':[('idle_a',240),('hit',180),('recover',220),('idle_a',240)],
'dead':[('hit',180),('dead',1200)],
'skill':[('idle_a',180),('skill_a',320),('skill_b',160),('skill_c',300),('idle_a',240)],
'poison':[('poison_a',420),('poison_b',420)],
'stun':[('stun_a',360),('stun_b',360)],
'sleep':[('sleep_a',700),('sleep_b',800)]
}
(ROOT/'motions').mkdir(exist_ok=True)
reports={}
for motion,order in motions.items():
    path=ROOT/'motions'/(motion+'.gif')
    indexed[order[0][0]].save(path,save_all=True,append_images=[indexed[n] for n,ms in order[1:]],
       duration=[ms for n,ms in order],loop=0,transparency=0,disposal=2,optimize=False)
    # Read the saved GIF's actual frames for diagnostics, including actual holds.
    gif=Image.open(path)
    strip=Image.new('RGB',(len(order)*192,224),'#D6CDC2');sd=ImageDraw.Draw(strip)
    actual=[]
    for i,(name,ms) in enumerate(order):
        gif.seek(i); decoded=gif.convert('RGBA')
        # Transparent RGB values are immaterial; visible RGBA must remain exact.
        decoded_bytes=[p if p[3] else (0,0,0,0) for p in decoded.getdata()]
        native_bytes=[p if p[3] else (0,0,0,0) for p in frames[name].getdata()]
        if decoded_bytes!=native_bytes: raise ValueError(f'GIF render altered {motion}/{i}')
        hold=gif.info.get('duration',0)
        sd.text((i*192+4,4),f'{i}: {name} / {hold} ms',fill='#171C29')
        strip.paste(decoded,(i*192+64,22),decoded)
        big=decoded.resize((128,128),Image.Resampling.NEAREST)
        strip.paste(big,(i*192+32,92),big)
        actual.append({'frame':name,'durationMs':hold,'visiblePixelsMatchSource':True})
    strip.save(ROOT/'previews'/(motion+'-gif-decoded.png'))
    reports[motion]=actual
import hashlib
inventory=[]
for group in ('poses','actions'):
    for file in sorted((ROOT/group).glob('*.pxgrid')):
        im=frames[file.stem]
        points=[(x,y) for y in range(64) for x in range(64) if im.getpixel((x,y))[3]]
        bounds=[min(x for x,y in points),min(y for x,y in points),max(x for x,y in points),max(y for x,y in points)]
        inventory.append({'source':str(file.relative_to(ROOT)),'rows':64,'columns':64,'inkBounds':bounds,
         'sourceSha256':hashlib.sha256(file.read_bytes()).hexdigest(),
         'pngSha256':hashlib.sha256((ROOT/'previews'/(file.stem+'.png')).read_bytes()).hexdigest()})
(ROOT/'render-inventory.json').write_text(json.dumps({'paletteColors':len(pal),'frames':inventory,'gifDecode':reports},indent=2)+'\n')
print(f'Rendered {len(inventory)} literal frames and {len(motions)} GIFs; saved GIF pixels match source.')
for filename,order in [('poses-sheet.png',names[:9]),('actions-sheet.png',names[9:])]:
    atlas=Image.new('RGBA',(192,192))
    for i,name in enumerate(order): atlas.paste(frames[name],((i%3)*64,(i//3)*64))
    atlas.save(ROOT/filename)

"""Read literal pxgrids; render native PNGs and diagnostics, never author pixels."""
from pathlib import Path
import json, hashlib
from PIL import Image, ImageDraw
ROOT=Path(__file__).resolve().parent
pal=json.loads((ROOT/'palette.json').read_text())
colors={k:tuple(bytes.fromhex(v[1:]))+(255,) for k,v in pal.items()}
frames={}
for sub in ('poses','actions'):
    for f in sorted((ROOT/sub).glob('*.pxgrid')):
        rows=f.read_text().splitlines()
        assert len(rows)==96 and all(len(r)==96 for r in rows), f
        assert all(c=='.' or c in pal for r in rows for c in r),f
        im=Image.new('RGBA',(96,96))
        im.putdata([(0,0,0,0) if c=='.' else colors[c] for row in rows for c in row])
        bbox=im.getbbox(); assert bbox and bbox[0]>=1 and bbox[1]>=1 and bbox[2]<=95 and bbox[3]<=93,(f,bbox)
        if f.stem=='idle_a': assert bbox[3]==93,(f,bbox)
        frames[f.stem]=im
        im.save(ROOT/'previews'/(f.stem+'.png'))
        print(f.stem,bbox)
# Native and nearest-neighbor light/dark/checker inspection plates.
for name,im in frames.items():
    plate=Image.new('RGB',(672,324),(44,48,57))
    d=ImageDraw.Draw(plate)
    for j,bg in enumerate(((238,232,219),(22,26,35),None)):
        tile=Image.new('RGBA',(96,96),bg or (0,0,0,255))
        if bg is None:
            td=ImageDraw.Draw(tile)
            for yy in range(0,96,8):
                for xx in range(0,96,8):
                    td.rectangle((xx,yy,xx+7,yy+7),fill=(139,145,150,255) if (xx//8+yy//8)%2 else (195,198,196,255))
        tile.alpha_composite(im)
        plate.paste(tile.convert('RGB'),(j*224,22))
        plate.paste(tile.resize((192,192),Image.Resampling.NEAREST).convert('RGB'),(j*224,124))
        d.text((j*224+100,30),name,fill=(245,235,210))
    plate.save(ROOT/'previews'/(name+'-inspect.png'))
order=['idle_a','idle_b','idle_c','windup','move','attack','recover','hit','dead','skill_a','skill_b','skill_c','poison_a','poison_b','stun_a','stun_b','sleep_a','sleep_b']
present=[n for n in order if n in frames]
sheet=Image.new('RGB',(6*204,3*222),(38,43,54)); sd=ImageDraw.Draw(sheet)
for j,n in enumerate(present):
    x=(j%6)*204; y=(j//6)*222
    sd.text((x+6,y+3),n,fill=(242,232,210))
    sheet.paste(frames[n].resize((192,192),Image.Resampling.NEAREST),(x+6,y+22),frames[n].resize((192,192),Image.Resampling.NEAREST))
sheet.save(ROOT/'previews'/'all-poses.png')

motions={
 'idle': [('idle_a',240),('idle_b',240),('idle_a',240),('idle_c',240)],
 'attack': [('idle_a',120),('windup',200),('move',110),('attack',160),('recover',190),('idle_a',240)],
 'hit': [('idle_a',140),('hit',280),('recover',190),('idle_a',240)],
 'dead': [('hit',160),('dead',1000)],
 'skill': [('idle_a',160),('skill_a',300),('skill_b',200),('skill_c',260),('idle_a',220)],
 'poison': [('poison_a',400),('poison_b',440)],
 'stun': [('stun_a',380),('stun_b',380)],
 'sleep': [('sleep_a',650),('sleep_b',650)]
}
# Original palette table: index zero is transparent; all native ink opaque.
keys=['.']+list(pal)
lookup={c:i for i,c in enumerate(keys)}
flat=[0,0,0]
for k in pal: flat.extend(bytes.fromhex(pal[k][1:]))
flat.extend([0]*(768-len(flat)))
gif_report={}
for motion, seq in motions.items():
 if not all(n in frames for n,t in seq): continue
 indexed=[]
 for n,t in seq:
    sub='actions' if n.startswith(('skill','poison','stun','sleep')) else 'poses'
    rows=(ROOT/sub/(n+'.pxgrid')).read_text().splitlines()
    out=Image.new('P',(96,96));out.putpalette(flat)
    out.putdata([lookup[c] for row in rows for c in row])
    out.info['transparency']=0
    indexed.append(out)
 gif=ROOT/'previews'/(motion+'.gif')
 indexed[0].save(gif,save_all=True,append_images=indexed[1:],duration=[t for n,t in seq],loop=0,transparency=0,disposal=2,optimize=False)
 # Decode the actual GIF and show its exact frames in a labeled filmstrip.
 actual=Image.open(gif)
 strip=Image.new('RGB',(len(seq)*204,334),(41,46,56));sd=ImageDraw.Draw(strip)
 durations=[]
 for j,(n,ms) in enumerate(seq):
    actual.seek(j);rgba=actual.convert('RGBA')
    # RGB values under alpha 0 are immaterial. Opaque native pixels must match.
    src=list(frames[n].getdata());dec=list(rgba.getdata())
    assert all(a[3]==b[3] and (a[3]==0 or a==b) for a,b in zip(src,dec)),(motion,j,'GIF altered ink')
    durations.append(actual.info.get('duration'))
    sd.text((j*204+5,5),f'{n} {ms}ms',fill=(240,232,211))
    strip.paste(rgba,(j*204+5,25),rgba)
    enlarged=rgba.resize((192,192),Image.Resampling.NEAREST)
    strip.paste(enlarged,(j*204+5,131),enlarged)
 strip.save(ROOT/'previews'/(motion+'-gif-frames.png'))
 gif_report[motion]={'frames':seq,'decodedDurationsMs':durations,'nativeSize':[96,96],'sha256':hashlib.sha256(gif.read_bytes()).hexdigest(),'opaquePixelsMatchSource':True}
# Complete native sheets, including original 3x3 base pose layout.
base=Image.new('RGBA',(288,288))
for i,n in enumerate(order[:9]):
 if n in frames: base.alpha_composite(frames[n],((i%3)*96,(i//3)*96))
base.save(ROOT/'previews'/'poses-native.png')
actions=Image.new('RGBA',(288,288))
for i,n in enumerate(order[9:]):
 if n in frames: actions.alpha_composite(frames[n],((i%3)*96,(i//3)*96))
actions.save(ROOT/'previews'/'actions-native.png')
report={'paletteColors':len(pal),'grids':{},'gifs':gif_report}
for f in sorted(ROOT.glob('*/*.pxgrid')):
 report['grids'][str(f.relative_to(ROOT))]={'sha256':hashlib.sha256(f.read_bytes()).hexdigest(),'inkBounds':list(frames[f.stem].getbbox())}
(ROOT/'previews'/'render-manifest.json').write_text(json.dumps(report,indent=2)+'\n')

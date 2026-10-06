"""Read explicitly authored row spans; pad transparency; encode native pixels.
No shape tools, automatic pose edits, filling, tracing or interpolation.
"""
from pathlib import Path
import json
import hashlib
from PIL import Image, ImageDraw, ImageFont
ROOT = Path(__file__).resolve().parent
PAL = json.loads((ROOT/'palette.json').read_text())
RGB = {k: tuple(bytes.fromhex(v[1:])) + (255,) for k,v in PAL.items()}
NAMES = ['idle_a','idle_b','idle_c','windup','move','attack','recover','hit','dead','skill_a','skill_b','skill_c','poison_a','poison_b','stun_a','stun_b','sleep_a','sleep_b']

def expand():
    grids = {}
    current = None
    for line in (ROOT/'authored_rows.txt').read_text().splitlines():
        if not line or line.startswith('#'): continue
        if line.startswith('['):
            current = line[1:-1]
            grids[current] = [['.']*96 for _ in range(96)]
            continue
        y,x,pixels = line.split()
        y,x = int(y),int(x)
        if x < 1 or x+len(pixels)>95 or y<1 or y>92: raise ValueError((current,y,x,len(pixels)))
        for k,c in enumerate(pixels):
            if c != '.' and c not in PAL: raise ValueError((current,y,x+k,c))
            grids[current][y][x+k]=c
    for name,rows in grids.items():
        folder = 'poses' if name in NAMES[:9] else 'actions'
        (ROOT/folder/(name+'.pxgrid')).write_text('\n'.join(''.join(r) for r in rows)+'\n')

def render():
    frames={}
    for name in NAMES:
        folder = 'poses' if name in NAMES[:9] else 'actions'
        rows=(ROOT/folder/(name+'.pxgrid')).read_text().splitlines()
        if len(rows)!=96 or any(len(r)!=96 for r in rows): raise ValueError(name+' canvas')
        im=Image.new('RGBA',(96,96))
        im.putdata([RGB[c] if c!='.' else (0,0,0,0) for r in rows for c in r])
        im.save(ROOT/'rendered'/(name+'.png')); frames[name]=im
    # Diagnostic backgrounds and labels are presentation only.
    sheet=Image.new('RGB',(6*288,3*310),(35,33,42)); draw=ImageDraw.Draw(sheet)
    for i,name in enumerate(NAMES):
        x,y=(i%6)*288,(i//6)*310
        for by in range(0,288,24):
            for bx in range(0,288,24):
                color=(190,181,173) if (bx//24+by//24)%2 else (220,211,203)
                draw.rectangle((x+bx,y+by,x+bx+23,y+by+23),fill=color)
        sheet.paste(frames[name].resize((288,288),Image.Resampling.NEAREST),(x,y),frames[name].resize((288,288),Image.Resampling.NEAREST))
        draw.text((x+8,y+291),name,fill=(240,231,213))
    sheet.save(ROOT/'rendered'/'all-checker-3x.png')
    for bg,label in [((238,231,217),'light'),((27,26,34),'dark')]:
        sheet=Image.new('RGB',(6*96,3*114),bg); d=ImageDraw.Draw(sheet)
        for i,name in enumerate(NAMES):
            x,y=(i%6)*96,(i//6)*114
            sheet.paste(frames[name],(x,y),frames[name]); d.text((x+2,y+97),name,fill=(120,114,116))
        sheet.save(ROOT/'rendered'/('all-'+label+'-1x.png'))
    scenes={
      'idle':(['idle_a','idle_b','idle_c','idle_b'],[240]*4),
      'attack':(['idle_a','windup','move','attack','recover','idle_a'],[600,200,100,120,220,900]),
      'hit':(['idle_a','hit','idle_a'],[700,180,900]),
      'dead':(['idle_a','hit','dead'],[700,150,1700]),
      'skill':(['idle_a','skill_a','skill_b','skill_c','idle_a'],[700,260,160,240,900]),
      'poison':(['poison_a','poison_b'],[420,420]),
      'stun':(['stun_a','stun_b'],[300,300]),
      'sleep':(['sleep_a','sleep_b'],[650,650])}
    colors=[(0,0,0)]+[c[:3] for c in RGB.values()]
    lookup={c:i for i,c in enumerate(colors) if i}
    indexed={}
    for name,im in frames.items():
        p=Image.new('P',im.size); flat=[v for c in colors for v in c]
        p.putpalette(flat+[0]*(768-len(flat)))
        p.putdata([lookup[c[:3]] if c[3] else 0 for c in im.getdata()]); indexed[name]=p
    readback = {}
    for scene,(order,holds) in scenes.items():
        images=[indexed[n] for n in order]
        path=ROOT/'motions'/(scene+'.gif')
        images[0].save(path,save_all=True,append_images=images[1:],duration=holds,loop=0,transparency=0,disposal=2,optimize=False)
        with Image.open(path) as gif:
            if gif.n_frames != len(order): raise ValueError(scene+' frame count')
            for i,name in enumerate(order):
                gif.seek(i)
                if gif.info.get('duration') != holds[i]: raise ValueError(scene+' hold')
                if gif.convert('RGBA').tobytes()!=frames[name].tobytes(): raise ValueError(scene+' decode')
        readback[scene] = {'sequence':order, 'holdsMs':holds, 'decodedPixelsMatch':True, 'sha256':hashlib.sha256(path.read_bytes()).hexdigest()}
        # Openable contact sheet of decoded animation, without art changes.
        strip=Image.new('RGB',(len(order)*192,212),(43,39,49)); d=ImageDraw.Draw(strip)
        with Image.open(path) as gif:
            for i,name in enumerate(order):
                gif.seek(i); f=gif.convert('RGBA').resize((192,192),Image.Resampling.NEAREST)
                strip.paste(f,(i*192,0),f); d.text((i*192+5,195),name+' '+str(holds[i])+'ms',fill='white')
        strip.save(ROOT/'motions'/(scene+'-decoded.png'))
    info = {'nativeCell':96, 'paletteColors':len(PAL), 'motions':readback, 'sources':{}}
    for name,im in frames.items():
        folder='poses' if name in NAMES[:9] else 'actions'
        path=ROOT/folder/(name+'.pxgrid')
        info['sources'][name]={'sha256':hashlib.sha256(path.read_bytes()).hexdigest(), 'inkBounds':im.getbbox(), 'pngSha256':hashlib.sha256((ROOT/'rendered'/(name+'.png')).read_bytes()).hexdigest()}
    (ROOT/'rendered/READBACK.json').write_text(json.dumps(info,indent=2)+'\n')
    print('Encoded 18 native PNGs and 8 GIFs; all GIF pixels, frame counts and holds reread exactly.')

if __name__=='__main__':
    import sys
    if '--expand' in sys.argv: expand()
    if '--idle' in sys.argv:
        rows=(ROOT/'poses/idle_a.pxgrid').read_text().splitlines()
        im=Image.new('RGBA',(96,96)); im.putdata([RGB[c] if c!='.' else (0,0,0,0) for r in rows for c in r]); im.save(ROOT/'rendered/idle_a.png')
        canvas=Image.new('RGBA',(384,384),(218,209,197,255)); big=im.resize((384,384),Image.Resampling.NEAREST); canvas.alpha_composite(big); canvas.convert('RGB').save(ROOT/'rendered/idle-study-4x.png')
    else: render()

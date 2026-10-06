"""Render literal grids only; nearest-neighbor scaling is diagnostic only."""
from pathlib import Path
from PIL import Image, ImageDraw
import json, hashlib
ROOT = Path(__file__).resolve().parent
palette = json.loads((ROOT/'palette.json').read_text())
colors = {k:tuple(bytes.fromhex(v[1:]))+(255,) for k,v in palette.items()}
poses = ['idle_a','idle_b','idle_c','windup','move','attack','recover','hit','dead']
actions = ['skill_a','skill_b','skill_c','poison_a','poison_b','stun_a','stun_b','sleep_a','sleep_b']
images = {}
for group,names in [('poses',poses),('actions',actions)]:
    for name in names:
        path = ROOT/group/(name+'.pxgrid')
        if not path.exists(): continue
        rows = path.read_text().splitlines()
        if len(rows)!=64 or any(len(r)!=64 for r in rows): raise ValueError(path)
        pixels = [colors[s] if s!='.' else (0,0,0,0) for row in rows for s in row]
        im=Image.new('RGBA',(64,64)); im.putdata(pixels)
        images[name]=im
        im.save(ROOT/'previews'/(name+'.png'))

def background(mode,size):
    im=Image.new('RGBA',size,{'light':'#EEE8D7','dark':'#242735','checker':'#8E9894'}[mode])
    if mode=='checker':
        draw=ImageDraw.Draw(im)
        for y in range(0,size[1],8):
            for x in range(0,size[0],8):
                if (x//8+y//8)%2: draw.rectangle((x,y,x+7,y+7),fill='#BAC3B9')
    return im
for group,names in [('poses',poses),('actions',actions)]:
    available=[n for n in names if n in images]
    if not available: continue
    sheet=Image.new('RGBA',(192,192))
    for i,n in enumerate(available): sheet.alpha_composite(images[n],((i%3)*64,(i//3)*64))
    sheet.save(ROOT/'previews'/(group+'-native.png'))
    for mode in ['light','dark','checker']:
        native=background(mode,(240,246))
        draw=ImageDraw.Draw(native)
        for i,n in enumerate(available):
            x=(i%3)*80+8; y=(i//3)*82+16
            draw.text((x,y-12),n,fill='#566568' if mode=='light' else '#D8E4D4')
            native.alpha_composite(images[n],(x,y))
        native.save(ROOT/'previews'/(group+'-'+mode+'-1x.png'))
        native.resize((960,984),Image.Resampling.NEAREST).save(ROOT/'previews'/(group+'-'+mode+'-4x.png'))
# A fixed color table preserves every source color and transparent index.
gifpalette=[0,0,0]+[channel for color in colors.values() for channel in color[:3]]
gifpalette += [0]*(768-len(gifpalette))
index={k:i+1 for i,k in enumerate(colors)}
def gif(name,order,holds):
    if not all(n in images for n in order): return
    frames=[]
    reverse={c:i+1 for i,c in enumerate(colors.values())}
    for n in order:
        im=Image.new('P',(64,64)); im.putpalette(gifpalette)
        im.putdata([reverse[p] if p[3] else 0 for p in images[n].get_flattened_data()])
        frames.append(im)
    frames[0].save(ROOT/'gifs'/(name+'.gif'),save_all=True,append_images=frames[1:],duration=holds,loop=0,transparency=0,disposal=2,optimize=False)
gif('idle',['idle_a','idle_b','idle_c','idle_b'],[240]*4)
gif('attack',['idle_a','windup','move','attack','recover','idle_a'],[240,180,100,160,180,280])
gif('hit',['idle_a','hit','recover','idle_a'],[260,220,160,300])
gif('dead',['hit','dead'],[220,1100])
gif('skill',['idle_a','skill_a','skill_b','skill_c','idle_a'],[240,280,200,260,300])
gif('poison',['poison_a','poison_b'],[380,380])
gif('stun',['stun_a','stun_b'],[420,420])
gif('sleep',['sleep_a','sleep_b'],[680,760])
# Diagnostic inventory, no art judgments or external review claims.
inventory={}
for name,im in images.items():
    ink=[(x,y) for y in range(64) for x in range(64) if im.getpixel((x,y))[3]]
    inventory[name]={'ink_bounds':[min(x for x,y in ink),min(y for x,y in ink),max(x for x,y in ink),max(y for x,y in ink)],'sha256_rgba':hashlib.sha256(im.tobytes()).hexdigest()}
(ROOT/'previews'/'inventory.json').write_text(json.dumps(inventory,indent=2)+'\n')
print('Rendered',len(images),'independent grids')
# Read back the actual encoded GIFs, preserving invisible RGB as transparent.
# Filmstrips are diagnostics from the delivered animations, not new art frames.
sequences = {
    'idle':(['idle_a','idle_b','idle_c','idle_b'],[240]*4),
    'attack':(['idle_a','windup','move','attack','recover','idle_a'],[240,180,100,160,180,280]),
    'hit':(['idle_a','hit','recover','idle_a'],[260,220,160,300]),
    'dead':(['hit','dead'],[220,1100]),
    'skill':(['idle_a','skill_a','skill_b','skill_c','idle_a'],[240,280,200,260,300]),
    'poison':(['poison_a','poison_b'],[380,380]),
    'stun':(['stun_a','stun_b'],[420,420]),
    'sleep':(['sleep_a','sleep_b'],[680,760])
}
readback={}
for motion,(order,holds) in sequences.items():
    path=ROOT/'gifs'/(motion+'.gif')
    if not path.exists(): continue
    gifimage=Image.open(path)
    film=background('dark',(len(order)*80,84))
    draw=ImageDraw.Draw(film)
    details=[]
    for i,name in enumerate(order):
        gifimage.seek(i)
        decoded=gifimage.convert('RGBA')
        rgba=list(decoded.get_flattened_data())
        rgba=[p if p[3] else (0,0,0,0) for p in rgba]
        if rgba != list(images[name].get_flattened_data()):
            raise ValueError(('GIF differs from grid',motion,i))
        hold=gifimage.info.get('duration')
        if hold != holds[i]: raise ValueError(('GIF duration',motion,i,hold))
        decoded.putdata(rgba)
        film.alpha_composite(decoded,(i*80+8,18))
        draw.text((i*80+8,2),str(hold)+'ms',fill='#D8E4D4')
        details.append({'frame':name,'hold_ms':hold,'rgba_equals_source':True})
    film.save(ROOT/'previews'/(motion+'-gif-readback-1x.png'))
    film.resize((film.width*4,film.height*4),Image.Resampling.NEAREST).save(ROOT/'previews'/(motion+'-gif-readback-4x.png'))
    readback[motion]={'encoded_sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'frames':details}
(ROOT/'previews'/'gif-readback.json').write_text(json.dumps(readback,indent=2)+'\n')
print('Read back',len(readback),'GIFs with unchanged native pixels and holds')

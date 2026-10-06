"""Read literal pxgrids; render exact RGBA pixels, diagnostic enlargement, GIFs.
No source mutation, pose synthesis, quantization or artwork drawing primitives.
"""
import json, hashlib
from pathlib import Path
from PIL import Image, ImageDraw
ROOT=Path(__file__).resolve().parent
PAL=json.loads((ROOT/'palette.json').read_text())
RGB={k:tuple(bytes.fromhex(v[1:])) for k,v in PAL.items()}
PORDER=['idle_a','idle_b','idle_c','windup','move','attack','recover','hit','dead']
AORDER=['skill_a','skill_b','skill_c','poison_a','poison_b','stun_a','stun_b','sleep_a','sleep_b']
MOTIONS={
'idle':(['idle_a','idle_b','idle_c','idle_b'],[240,240,240,240]),
'attack':(['idle_a','windup','move','attack','recover','idle_a'],[300,330,100,220,240,350]),
'hit':(['idle_a','hit','recover','idle_a'],[300,280,220,350]),
'dead':(['idle_a','hit','dead'],[280,170,1300]),
'skill':(['idle_a','skill_a','skill_b','skill_c','idle_a'],[300,420,360,300,350]),
'poison':(['poison_a','poison_b'],[420,420]),
'stun':(['stun_a','stun_b'],[450,450]),
'sleep':(['sleep_a','sleep_b'],[720,720])}

def rgba(p):
    rows=p.read_text().splitlines()
    if len(rows)!=128 or any(len(r)!=128 for r in rows): raise ValueError(('canvas',p))
    colors=set(''.join(rows))- {'.'}
    if colors-set(PAL): raise ValueError(('palette',p))
    points=[(x,y) for y,r in enumerate(rows) for x,c in enumerate(r) if c!='.']
    if min(x for x,y in points)<1 or max(x for x,y in points)>126 or min(y for x,y in points)<1 or max(y for x,y in points)>124: raise ValueError(('margin',p))
    if p.stem=='idle_a' and max(y for x,y in points)!=124: raise ValueError('idle grounding')
    im=Image.new('RGBA',(128,128)); im.putdata([(*RGB[c],255) if c!='.' else (0,0,0,0) for r in rows for c in r])
    return im,dict(pose=p.stem,lowestInk=max(y for x,y in points),bounds=[min(x for x,y in points),min(y for x,y in points),max(x for x,y in points),max(y for x,y in points)],sourceSha256=hashlib.sha256(p.read_bytes()).hexdigest())

def background(kind,size):
    if kind!='checker': return Image.new('RGBA',size,(239,229,202,255) if kind=='light' else (29,35,44,255))
    im=Image.new('RGBA',size); im.putdata([(80,86,91,255) if (x//8+y//8)%2 else (119,123,119,255) for y in range(size[1]) for x in range(size[0])]); return im

def render():
    images={}; report=[]
    for folder in ['poses','actions']:
        for p in (ROOT/folder).glob('*.pxgrid'):
            im,record=rgba(p); images[p.stem]=im; report.append(record); im.save(ROOT/'png'/(p.stem+'.png'))
    order=[s for s in PORDER+AORDER if s in images]
    for kind in ['light','dark','checker']:
        sheet=background(kind,(128*6,150*((len(order)+5)//6)))
        d=ImageDraw.Draw(sheet)
        for i,name in enumerate(order):
            x=(i%6)*128;y=(i//6)*150; sheet.alpha_composite(images[name],(x,y+19)); d.text((x+4,y+3),name,fill=(230,213,160) if kind!='light' else (40,45,42))
        sheet.convert('RGB').save(ROOT/'png'/('all-'+kind+'-1x.png'))
        sheet.resize((sheet.width*3,sheet.height*3),Image.Resampling.NEAREST).save(ROOT/'png'/('all-'+kind+'-3x.png'))
    if 'idle_a' in images:
        diag=Image.new('RGB',(128*3*3,128*3))
        for i,kind in enumerate(['light','dark','checker']):
            b=background(kind,(128,128));b.alpha_composite(images['idle_a']); diag.paste(b.resize((384,384),Image.Resampling.NEAREST),(i*384,0))
        diag.save(ROOT/'png'/'idle-a-backgrounds-3x.png')
    sheet=Image.new('RGBA',(384,384))
    for i,name in enumerate(PORDER):
        if name in images: sheet.alpha_composite(images[name],((i%3)*128,(i//3)*128))
    sheet.save(ROOT/'png'/'poses-sheet.png')
    if all(n in images for n in AORDER):
        sheet=Image.new('RGBA',(384,384))
        for i,name in enumerate(AORDER):sheet.alpha_composite(images[name],((i%3)*128,(i//3)*128))
        sheet.save(ROOT/'png'/'actions-sheet.png')
    gifpal=[0,0,0]+[v for c in PAL for v in RGB[c]]
    gifpal+= [0]*(768-len(gifpal)); indices={c:i+1 for i,c in enumerate(PAL)}
    for motion,(names,holds) in MOTIONS.items():
        if not all(n in images for n in names):continue
        frames=[]
        for n in names:
            im=Image.new('P',(128,128));im.putpalette(gifpal)
            im.putdata([indices.get(c,0) for c in (ROOT/('poses' if n in PORDER else 'actions')/(n+'.pxgrid')).read_text().replace('\n','')]);im.info['transparency']=0;frames.append(im)
        path=ROOT/'gif'/(motion+'.gif');frames[0].save(path,save_all=True,append_images=frames[1:],duration=holds,loop=0,transparency=0,disposal=2,optimize=False)
        decoded=Image.open(path)
        for i,n in enumerate(names):
            decoded.seek(i)
            if decoded.convert('RGBA').tobytes()!=images[n].tobytes():raise ValueError(('GIF readback',motion,i))
    (ROOT/'render-observations.json').write_text(json.dumps({'paletteColors':len(PAL),'frames':report,'note':'Local format/render observations; not harness review or user approval.'},indent=2)+'\n')
if __name__=='__main__':render()

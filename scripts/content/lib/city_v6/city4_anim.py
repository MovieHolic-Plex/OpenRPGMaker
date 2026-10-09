import sys, json; sys.path.insert(0,'/tmp/j8city')
from PIL import Image, ImageDraw
import terrain, pf, pz
from px2 import _hash
A='/tmp/j8city/anim/'
_c={}
def spr(name):
    if name not in _c: _c[name]=Image.open(A+name).convert('RGBA')
    return _c[name]
_F={}
def fountain(f):
    if f not in _F:
        o=pf.fountain(f); _F[f]=pz.fin(o) if hasattr(o,'img') else o
    return _F[f]
_S={}
def anim_spr(kind,f):
    key=(kind,f)
    if key not in _S:
        o={'flag':lambda: pz.flagpole(f%4),'fsmall':lambda: pz.fountain_small(f%4),'fpool':lambda: pz.fish_pool(f%4),'crane':lambda: pz.crane(f%4)}.get(kind)
        o=o() if o else pz.festoon(160,frame=f%6,seed=3)
        _S[key]=o if isinstance(o,Image.Image) else pz.fin(o)
    return _S[key]
_G={}
def glow(a):
    if a not in _G:
        g=Image.new('RGBA',(19,19)); d=ImageDraw.Draw(g)
        for r,al in ((9,a//3),(6,a//2),(3,a)): d.ellipse((9-r,9-r,9+r,9+r),fill=(255,200,110,al))
        _G[a]=g
    return _G[a]
def frame(base,f,meta=None):
    meta=meta or json.load(open('/tmp/j8city/city4_anim.json'))
    im=base.copy(); px=im.load()
    for x0,y0,w in meta['falls']: terrain.waterfall(px,x0,y0,w,f%4)
    fx,fy=meta['fountain']; im.alpha_composite(fountain(f%4),(fx*16,fy*16))
    for k,x,y in meta['boats']: im.alpha_composite(spr(f'boat_{k}_{f%4}.png'),(x*16,y*16))
    for i,(sx,sy) in enumerate(meta['smoke']): im.alpha_composite(spr(f'smoke_{(f+i)%6}.png'),(sx-5,sy-31))
    for i,(kind,x,y) in enumerate(sorted(meta['anim'],key=lambda a:a[2])):
        im.alpha_composite(anim_spr(kind,f+i if kind in ('flag','fsmall') else f),(x,y))
    for i,(x,y) in enumerate(meta['glow']): im.alpha_composite(glow(60 if _hash(i,f,5)<0.75 else 30),(x-9,y-9))
    return im
def gif(base,box,name,scale=2,n=12,ms=150):
    meta=json.load(open('/tmp/j8city/city4_anim.json')); fr=[]
    for f in range(n):
        c=frame(base,f,meta).crop(box)
        fr.append(c.resize((c.width*scale,c.height*scale),Image.NEAREST).convert('P',palette=Image.ADAPTIVE,colors=255))
    fr[0].save(name,save_all=True,append_images=fr[1:],duration=ms,loop=0)
if __name__=='__main__':
    base=Image.open('/tmp/j8city/city4_base.png').convert('RGBA')
    gif(base,(880,500,1260,760),'/tmp/j8city/g4_market.gif')
    gif(base,(560,1020,1200,1500),'/tmp/j8city/g4_harbour.gif',scale=1)

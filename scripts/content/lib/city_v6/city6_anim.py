# 버들항 v5 animation: one 24-frame seamless loop (LCM of water 8, windmill 8, smoke 12, boats/fountains/flags 4).
import sys, json; sys.path.insert(0,__import__('os').path.dirname(__import__('os').path.abspath(__file__)))
import numpy as np
from PIL import Image, ImageDraw
import terrain, pf, pz, roman, smoke5
from px2 import _hash
OUT=__import__('os').environ.get('CITY6_OUT','/tmp/j8city6'); A=OUT+'/anim/'
LOOP=24
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
        o=o() if o else pz.festoon(88,frame=f%6,seed=3)
        _S[key]=o if isinstance(o,Image.Image) else pz.fin(o)
    return _S[key]
_G={}
def glow(a):
    if a not in _G:
        g=Image.new('RGBA',(19,19)); d=ImageDraw.Draw(g)
        for r,al in ((9,a//3),(6,a//2),(3,a)): d.ellipse((9-r,9-r,9+r,9+r),fill=(255,200,110,al))
        _G[a]=g
    return _G[a]
_W={}
def water(f):
    f%=8
    if f not in _W: _W[f]=np.array(Image.open(A+f'water_{f}.png'))
    return _W[f]
_M=[None]
def wmask():
    if _M[0] is None: _M[0]=np.array(Image.open(A+'water_mask.png'))//100
    return _M[0]
_SAILS={}
def sails(f):
    f%=roman.WM_NF
    if f not in _SAILS:
        import v6pieces; _SAILS[f]=v6pieces.windmill_sails6(f)
    return _SAILS[f]
def comp(im,src,x,y):
    x,y=int(x),int(y)
    if x>=im.width or y>=im.height or x+src.width<=0 or y+src.height<=0: return
    cx,cy=max(0,-x),max(0,-y)
    if cx or cy: src=src.crop((cx,cy,src.width,src.height)); x+=cx; y+=cy
    im.alpha_composite(src,(x,y))
def frame(base,f,meta=None):
    meta=meta or json.load(open(OUT+'/city6_anim.json'))
    B=np.array(base).copy(); M=wmask(); Wf=water(f)
    B[M==1,:3]=Wf[M==1,:3]
    sh=M==2; B[sh,:3]=np.floor(Wf[sh,:3].astype(np.float64)*np.array((0.52,0.58,0.74))).astype(np.uint8)
    im=Image.fromarray(B,'RGBA').copy(); px=im.load()
    for fx0,fy0,w in meta['falls']: terrain.waterfall(px,fx0,fy0,w,f%4)
    for kind,fx,fy in meta['fountains']: comp(im,fountain(f%4),fx,fy)
    for k,x,y in meta['boats']: comp(im,spr(f'boat_{k}_{f%4}.png'),x*16,y*16)
    for (x,y) in meta['windmills']: comp(im,sails(f),x,y)
    for (sx,sy,kind,ph,seed) in meta['smoke']: comp(im,smoke5.sprite(kind,f+ph,seed),sx-smoke5.OX,sy-smoke5.OY)
    for i,(kind,x,y) in enumerate(sorted(meta['anim'],key=lambda a:a[2])):
        comp(im,anim_spr(kind,f+i if kind in ('flag','fsmall') else f),x,y)
    for i,(x,y) in enumerate(meta['glow']): comp(im,glow(60 if _hash(i,f,5)<0.75 else 30),x-9,y-9)
    return im
FR=[]
def gif(base,box,name,scale=2,n=LOOP,ms=125):
    meta=json.load(open(OUT+'/city6_anim.json')); fr=[]
    for f in range(n):
        c=(FR[f] if FR else frame(base,f,meta)).crop(box)
        fr.append(c.resize((c.width*scale,c.height*scale),Image.NEAREST).convert('RGB'))
    pal=fr[0].quantize(colors=255,method=Image.Quantize.MEDIANCUT)
    q=[f_.quantize(palette=pal,dither=Image.Dither.NONE) for f_ in fr]
    q[0].save(name,save_all=True,append_images=q[1:],duration=ms,loop=0,disposal=1)

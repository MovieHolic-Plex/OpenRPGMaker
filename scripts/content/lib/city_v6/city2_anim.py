# per-frame overlays for 버들항: waterfalls, fountain, boats (with their water), chimney smoke
import sys, json; sys.path.insert(0,'/tmp/j8city')
from PIL import Image
import terrain, pf
A='/tmp/j8city/anim/'
_c={}
def spr(name):
    if name not in _c: _c[name]=Image.open(A+name).convert('RGBA')
    return _c[name]
_F={}
def fountain(f):
    if f not in _F:
        o=pf.fountain(f); _F[f]=o.img() if hasattr(o,'img') else o
    return _F[f]
def frame(base,f,meta=None):
    meta=meta or json.load(open('/tmp/j8city/city2_anim.json'))
    im=base.copy(); px=im.load()
    for x0,y0,w in meta['falls']: terrain.waterfall(px,x0,y0,w,f%4)
    fx,fy=meta['fountain']; im.alpha_composite(fountain(f%4),(fx*16,fy*16))
    for k,x,y in meta['boats']: im.alpha_composite(spr(f'boat_{k}_{f%4}.png'),(x*16,y*16))
    for i,(sx,sy) in enumerate(meta['smoke']):
        im.alpha_composite(spr(f'smoke_{(f+i)%6}.png'),(sx-5,sy-31))
    return im
def gif(base,box,name,scale=2,n=12,ms=150):
    meta=json.load(open('/tmp/j8city/city2_anim.json'))
    fr=[]
    for f in range(n):
        c=frame(base.crop((0,0,base.width,base.height)),f,meta).crop(box)
        fr.append(c.resize((c.width*scale,c.height*scale),Image.NEAREST).convert('P',palette=Image.ADAPTIVE,colors=255))
    fr[0].save(name,save_all=True,append_images=fr[1:],duration=ms,loop=0)
if __name__=='__main__':
    base=Image.open('/tmp/j8city/city2_base.png').convert('RGBA')
    gif(base,(640,1320,1200,1600),'/tmp/j8city/g_harbour.gif')
    gif(base,(440,300,760,560),'/tmp/j8city/g_fall1.gif')
    gif(base,(680,940,960,1120),'/tmp/j8city/g_fall2.gif')
    gif(base,(900,500,1300,760),'/tmp/j8city/g_market.gif')

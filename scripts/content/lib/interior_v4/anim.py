# animated pieces: every builder returns kit.F with .frames (4 images, 180 ms) ; .im = frame 0
import math
from objs3 import *
from p3 import FIRE
BASE={k:OBJ[k][1] for k in ('forge','bread oven','cauldron','fish tank','candelabra','wall sconce')}
NF=4
def _copy(im): return im.copy()
def flame(p,cx,base,w,h,t,seed=0):
    """teardrop flames: a few tongues whose heights wobble per frame; white-yellow core, orange, red rim"""
    for k in range(-(w//2),w//2+1):
        x=cx+k
        hh=int(h*(1-abs(k)/(w/2+1))*(0.75+0.35*math.sin(t*1.7+k*1.3+seed)))
        for d in range(hh):
            y=base-d; f=d/max(1,hh)
            c=FIRE[5] if (f<0.35 and abs(k)<w/4) else (FIRE[4] if f<0.6 else (FIRE[3] if f<0.85 else FIRE[2]))
            p.set(x,y,c)
    if t%2==0: p.set(cx+(1 if t%4==0 else -1),base-h-1,FIRE[3])   # a spark
def framed(base_fn,paint,n=NF):
    fr=[]
    for t in range(n):
        f=base_fn(); p=Pix(f.im.width,f.im.height); p.im.alpha_composite(f.im); paint(p,t); fr.append(p.im)
    out=base_fn(); out.im=fr[0]; out.frames=fr; return out
def a_fireplace():
    def paint(p,t):
        for y in range(14,24):
            for x in range(10,22):
                if p.get(x,y)[:3] in (FIRE[i][:3] for i in range(6)): p.set(x,y,hx('#140c0c'))
        flame(p,16,23,10,9,t); flame(p,13,23,4,5,t+2,1); flame(p,19,23,4,5,t+1,2)
        for x in range(10,22): p.set(x,24,WOOD[4]); p.set(x,25,WOOD[2])
    return framed(lambda:kit.fireplace(),paint)
def a_forge():
    def paint(p,t):
        for y in range(18,25):
            for x in range(4,28):
                if y<20: c=M['black'][0]
                else:
                    v=(x*3+y+t*2)%5; c=[M['red'][3],M['orange'][4],M['orange'][5],M['yellow'][5],M['orange'][4]][v]
                    if y>=23: c=M['red'][3] if (x+t)%3 else M['red'][2]
                p.set(x,y,c)
        for i,cx in enumerate((9,15,21)): flame(p,cx,20,5,4+((t+i)%3),t+i,i)
    return framed(lambda:BASE['forge'](),paint)
def a_oven():
    def paint(p,t):
        for x in range(11,21):
            for y in (24,25): p.set(x,y,[M['orange'][4],M['yellow'][5],M['orange'][5],M['red'][4]][(x+y+t)%4])
        flame(p,13,23,3,2+t%2,t); flame(p,19,23,3,2+(t+1)%2,t+1)
    return framed(lambda:BASE['bread oven'](),paint)
def a_stove():
    def paint(p,t):
        for y in range(11,17):
            for x in range(5,11): p.set(x,y,hx('#1a0c08'))
        flame(p,8,16,5,4+(t%2),t)
    return framed(lambda:kit.stove(),paint)
def a_cauldron():
    def paint(p,t):
        L=ramp('#0a2a0a','#3aa030','#c0ff80')
        for i,(bx,by) in enumerate(((5,5),(9,6),(7,4),(11,5))):
            ph=(t+i)%4
            if ph<3: p.set(bx,by,L[5+ (1 if ph==1 else 0)])
            if ph==1: p.set(bx+1,by,L[5])
        for k in range(3):   # steam
            y=2-((t+k)%3); x=6+k*2
            if y>=0: p.set(x,y,(230,240,230,110))
    return framed(lambda:BASE['cauldron'](),paint)
def a_tank():
    def paint(p,t):
        for yy in range(6,19):
            for xx in range(2,30):
                c=M['water'][4 if yy<12 else 3]
                if (xx-yy+t)%11==0 and yy<14: c=M['water'][5]
                p.set(xx,yy,c)
        put_good(p,'fishr',4+t*2,9); put_good(p,'fish',20-t*2,13,True); put_good(p,'fishg',18+(t%2),8+(t//2))
        for i,bx in enumerate((8,24)):
            y=17-((t*3+i*5)%10); p.set(bx,y,M['white'][6]); p.set(bx+1,y-3 if y>9 else y,M['water'][6])
        for xx,yy in ((10,16),(11,15),(24,17),(25,16)): p.set(xx+(t%2),yy,M['green'][4])
    return framed(lambda:BASE['fish tank'](),paint)
def _flicker(fn,pts):
    def paint(p,t):
        for (x,y) in pts:
            if p.get(x,y)[3]==0 and p.get(x,y+1)[3]==0: continue
            p.set(x,y,[M['yellow'][6],M['yellow'][5],M['orange'][4],M['yellow'][6]][t])
            p.set(x+(1 if t==1 else (-1 if t==3 else 0)),y-1,M['yellow'][6] if t!=2 else (0,0,0,0))
    return framed(fn,paint)
def a_candle(): return _flicker(lambda:kit.candle(),[(8,3)])
def a_candelabra(): return _flicker(lambda:BASE['candelabra'](),[(2,8),(6,8),(10,8)])
def a_sconce(): return _flicker(lambda:BASE['wall sconce'](),[(7,1),(8,1)])
ANIM={'fireplace':a_fireplace,'forge':a_forge,'bread oven':a_oven,'stove':a_stove,'cauldron':a_cauldron,'fish tank':a_tank,
      'candle':a_candle,'candelabra':a_candelabra,'wall sconce':a_sconce}
for k,f in ANIM.items():
    c=OBJ[k][0]; OBJ[k]=(c,f)

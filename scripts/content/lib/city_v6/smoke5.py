# 버들항 v5 chimney smoke: four kinds, 12-frame seamless loops (particle ages wrap), per-chimney seed + phase.
#  wisp  = a thin winding thread of small puffs      puffy = round puffs that swell as they rise
#  drift = puffs bent sideways by the wind (east)    dark  = heavy brown-grey smoke (forge, bakery ovens)
import math
from PIL import Image
NF=12; SW,SH=32,48; OX,OY=10,44          # sprite size; the chimney mouth sits at (OX,OY) inside the sprite
LIGHT=[(146,148,145),(196,198,195),(222,224,221),(240,242,238)]
DARK=[(38,40,44),(58,56,58),(84,80,78),(112,106,98)]
KIND={'wisp':dict(n=22,r0=1.2,r1=2.4,rise=40,amp=2.5,wind=3,pal=LIGHT,a0=250),
      'puffy':dict(n=5,r0=2.4,r1=5.8,rise=38,amp=1.5,wind=4,pal=LIGHT,a0=255),
      'drift':dict(n=7,r0=2.0,r1=4.6,rise=26,amp=1.0,wind=18,pal=LIGHT,a0=250),
      'dark':dict(n=7,r0=2.8,r1=6.2,rise=40,amp=2.0,wind=6,pal=DARK,a0=255)}
_C={}
def sprite(kind,f,seed=0):
    key=(kind,f%NF,seed%4)
    if key in _C: return _C[key]
    K=KIND[kind]; im=Image.new('RGBA',(SW,SH)); p=im.load(); n=K['n']; ph=seed*0.37
    parts=[]
    for k in range(n):
        a=((f%NF)/NF+k/n)%1.0                               # age 0..1, wraps -> seamless
        y=OY-2-a*K['rise']; x=OX+math.sin(a*math.pi*3+ph*6)*K['amp']*(0.4+a)+K['wind']*a**1.6
        r=K['r0']+(K['r1']-K['r0'])*a
        al=K['a0']*(1-a)**0.8 if a>0.12 else K['a0']*min(1,a/0.12+0.35)
        parts.append((a,x,y,r,al))
    for a,x,y,r,al in sorted(parts,key=lambda t:-t[0]):    # oldest (highest) first, newest on top
        q=max(110,min(255,int(al//36*36)+40))                          # quantised alpha steps
        for yy in range(int(y-r)-1,int(y+r)+2):
            for xx in range(int(x-r)-1,int(x+r)+2):
                dx=(xx+0.5-x)/r; dy=(yy+0.5-y)/r; d=dx*dx+dy*dy
                if d>1 or not (0<=xx<SW and 0<=yy<SH): continue
                lit=-dx*0.6-dy*0.7
                t=3 if lit>0.45 else (2 if lit>-0.1 else (1 if lit>-0.55 else 0))
                if kind=='dark': t=min(3,t)
                c=K['pal'][t]
                o=p[xx,yy]
                if o[3]>=q: continue
                p[xx,yy]=c+(q,)
    _C[key]=im; return im

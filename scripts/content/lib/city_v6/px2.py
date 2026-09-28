# volumetric pixel painter: per-pixel normal + material grain, quantized to hue-shifted 6-tone ramps (chipset style)
import math, random
from PIL import Image
def hx(s): s=s.lstrip('#'); return tuple(int(s[i:i+2],16) for i in (0,2,4))
PAL={
 'stone':['#161926','#2e3346','#4c5369','#6e768c','#959db0','#c3c9d4','#e4e8ee'],
 'mstone':['#1a1d1a','#343a33','#525a4c','#737c69','#98a08a','#bec4ac','#dfe2cc'],
 'moss': ['#101e0c','#1c3413','#2c5019','#3f6c22','#5a8a2c','#7aa83a','#a2c458'],
 'leaf': ['#0c1e10','#153a1a','#225c22','#36842a','#56ab30','#86cf3e','#bcec6a'],
 'wood': ['#1a0f0a','#361f13','#58351d','#7c4f28','#a26e36','#c69250','#e4ba78'],
 'bark': ['#140d0a','#2c1c14','#48301f','#66462a','#86603a','#a67e4e','#c8a26c'],
 'gold': ['#2e1a06','#5e380c','#94601a','#c89028','#ecc04a','#fce27a','#fff8c8'],
 'iron': ['#101218','#262a34','#40464f','#5e6572','#838b98','#adb4c0','#dde2ea'],
 'red':  ['#200610','#4a0e1a','#7c1824','#b02c30','#d85040','#f08462','#fcbc98'],
 'cream':['#3a2c20','#624c34','#8c7250','#b49a72','#d4bc94','#ecdab8','#fff6e2'],
 'teal': ['#061c22','#0c3c44','#12666a','#1c9a94','#34ccbc','#86f0de','#e2fff8'],
 'cryst':['#0a1430','#142e66','#1e52a4','#3282d6','#62b6f0','#a8e2fc','#f0fcff'],
 'shroom':['#10123a','#1e2670','#3040aa','#4c68d8','#7a9cf2','#b2cefe','#eef4ff'],
 'stem': ['#2c2a22','#4e4a3a','#747058','#9c987c','#c2bea2','#e0dcc4','#fbf8ea'],
 'cloth':['#240e08','#4c1e0e','#7a3416','#aa5222','#d07a38','#eca660','#fcd49a'],
 'pink': ['#2c0a1c','#5a1638','#8e2a5a','#c64a82','#e878a8','#f8aacb','#ffe2ee'],
 'fire': ['#3a0a04','#7a1c06','#c03c0c','#ec6c14','#fca42c','#ffd860','#fffac8'],
 'rope': ['#261a0c','#4a3418','#6e5228','#94723c','#b89456','#d8b87a','#f2dcaa'],
 'dirt': ['#1a120c','#322216','#4e3622','#6c4e32','#8c6a46','#ac8a60','#cca87e'],
 'lily': ['#0a2016','#12402a','#1c6438','#2c8a44','#46b050','#78d066','#b4ec94'],
 'dark': ['#050608','#0c0e14','#14161e','#1c1f28','#262a34','#30343e','#3a3e48'],
 'bone': ['#2e2a24','#57503f','#827a60','#aca386','#d0c8ac','#ece6cc','#fffcee'],
}
LX,LY,LZ=-0.55,-0.65,0.75; _n=math.sqrt(LX*LX+LY*LY+LZ*LZ); LX/=_n; LY/=_n; LZ/=_n
def _hash(x,y,s):
    h=(x*374761393+y*668265263+s*982451653)&0xffffffff; h=(h^(h>>13))*1274126177&0xffffffff; return ((h^(h>>16))&0xffff)/65535.0
PER=[None]
def vnoise(x,y,sc,seed,per=None):
    fx,fy=x/sc,y/sc; x0,y0=math.floor(fx),math.floor(fy); tx,ty=fx-x0,fy-y0
    if per:
        x1,y1=(x0+1)%per,(y0+1)%per; x0,y0=x0%per,y0%per
        tx=tx*tx*(3-2*tx); ty=ty*ty*(3-2*ty)
        a=_hash(x0,y0,seed); b=_hash(x1,y0,seed); c=_hash(x0,y1,seed); d=_hash(x1,y1,seed)
        return (a*(1-tx)+b*tx)*(1-ty)+(c*(1-tx)+d*tx)*ty
    tx=tx*tx*(3-2*tx); ty=ty*ty*(3-2*ty)
    a=_hash(x0,y0,seed); b=_hash(x0+1,y0,seed); c=_hash(x0,y0+1,seed); d=_hash(x0+1,y0+1,seed)
    return (a*(1-tx)+b*tx)*(1-ty)+(c*(1-tx)+d*tx)*ty
GRAIN={'stone':(0.11,2.2),'mstone':(0.12,2.0),'moss':(0.26,1.5),'leaf':(0.22,1.6),'wood':(0.10,1.2),'bark':(0.18,1.4),
 'gold':(0.06,2),'iron':(0.06,2),'red':(0.10,1.8),'cream':(0.10,2),'teal':(0.04,2),'cryst':(0.02,2),'shroom':(0.06,2),
 'stem':(0.10,1.6),'cloth':(0.08,1.6),'pink':(0.06,2),'fire':(0.0,2),'rope':(0.10,1.2),'dirt':(0.24,1.5),'lily':(0.10,1.8),'dark':(0.1,2),'bone':(0.1,2)}
PIXEL_NOISE=1.0   # per-pixel speckle on top of the grain (0 = clean clusters, SNES look)
GRAIN_SCALE=1.0   # >1 = bigger grain clusters
GRAIN_AMP=1.0
class C:
    def __init__(s,w,h,seed=1):
        s.w,s.h,s.seed=w,h,seed; s.m=[[None]*w for _ in range(h)]; s.v=[[0.0]*w for _ in range(h)]
        s.fix=[[None]*w for _ in range(h)]; s.id=[[0]*w for _ in range(h)]; s.nid=0; s.sh=[[0]*w for _ in range(h)]; s.grp={}; s.cur=None; s.period=None
    def inb(s,x,y): return 0<=x<s.w and 0<=y<s.h
    # value v in [0,1] = lit amount before grain
    def setv(s,x,y,mat,v,oid=None,grain=True):
        if not s.inb(x,y): return
        g=0
        if grain and mat in GRAIN:
            a,sc=GRAIN[mat]; a*=GRAIN_AMP; px_,py_=(x%s.period,y%s.period) if s.period else (x,y); scp=(4 if GRAIN_SCALE>1 else 2) if s.period else sc*GRAIN_SCALE; g=(vnoise(px_,py_,scp,s.seed+sum(map(ord,mat)),per=(s.period//scp if s.period else None))-0.5)*2*a+(_hash(px_,py_,s.seed)-0.5)*a*0.5*PIXEL_NOISE
        s.m[y][x]=mat; s.v[y][x]=v+g; s.fix[y][x]=None; s.id[y][x]=s.nid if oid is None else oid
    def tone(s,x,y,mat,t):   # explicit tone 0..6
        if s.inb(x,y): s.m[y][x]=mat; s.fix[y][x]=t; s.id[y][x]=s.nid
    def new(s):
        s.nid+=1; s.grp[s.nid]=s.cur if s.cur is not None else s.nid; return s.nid
    def group(s,g): s.cur=g
    def shade(s,nx,ny,nz,amb=0.18):
        d=nx*LX+ny*LY+nz*LZ; return amb+(1-amb)*max(0,d)
    def ellipsoid(s,cx,cy,rx,ry,mat,rz=None,amb=0.18,clip=None,bias=0.0,bump=0.0,bsc=3.0):
        s.new()
        for y in range(int(cy-ry)-1,int(cy+ry)+2):
            for x in range(int(cx-rx)-1,int(cx+rx)+2):
                dx=(x+0.5-cx)/rx; dy=(y+0.5-cy)/ry; r=dx*dx+dy*dy
                if r>1 or (clip and not clip(x,y)): continue
                nz=math.sqrt(1-r)
                if bump:
                    dx+=(vnoise(x,y,bsc,s.seed+7)-0.5)*bump; dy+=(vnoise(x,y,bsc,s.seed+13)-0.5)*bump
                    L=math.sqrt(dx*dx+dy*dy+nz*nz); dx,dy,nz=dx/L,dy/L,nz/L
                s.setv(x,y,mat,s.shade(dx,dy,nz,amb)+bias)
    def cylinder(s,cx,y0,y1,rx,mat,cap=True,capry=None,amb=0.2,bias=0.0):
        # upright cylinder seen from 3/4 above: body + elliptical top
        s.new(); capry=capry or max(1,rx*0.45)
        for y in range(int(y0),int(y1)+1):
            for x in range(int(cx-rx)-1,int(cx+rx)+2):
                dx=(x+0.5-cx)/rx
                if abs(dx)>1: continue
                yb=y1-capry*math.sqrt(max(0,1-dx*dx))  # rounded bottom
                if y>y1+capry*math.sqrt(max(0,1-dx*dx))-1: continue
                s.setv(x,y,mat,s.shade(dx,0.15,math.sqrt(1-dx*dx),amb)+bias)
        if cap:
            for y in range(int(y0-capry)-1,int(y0+capry)+2):
                for x in range(int(cx-rx)-1,int(cx+rx)+2):
                    dx=(x+0.5-cx)/rx; dy=(y+0.5-y0)/capry
                    if dx*dx+dy*dy<=1: s.setv(x,y,mat,0.92+bias-0.12*(dx+dy)*0.5)
    def hcyl(s,x0,x1,cy,ry,mat,amb=0.2,bias=0.0,endcap=None,capmat=None):
        # log lying east-west; endcap='L' draws the cut face at the left end
        s.new(); rx=max(1.5,ry*0.45)
        for y in range(int(cy-ry)-1,int(cy+ry)+2):
            dy=(y+0.5-cy)/ry
            if abs(dy)>1: continue
            nz=math.sqrt(1-dy*dy)
            for x in range(int(x0),int(x1)+1): s.setv(x,y,mat,s.shade(0,dy,nz,amb)+bias)
        if endcap:
            ex=x0 if endcap=='L' else x1; cm=capmat or 'cream'; s.new()
            for y in range(int(cy-ry)-1,int(cy+ry)+2):
                for x in range(int(ex-rx)-1,int(ex+rx)+2):
                    dx=(x+0.5-ex)/rx; dy=(y+0.5-cy)/ry; r=dx*dx+dy*dy
                    if r<=1:
                        ring=int(math.sqrt(r)*3.2)
                        s.tone(x,y,cm,(4,3,4,2)[min(3,ring)] if r<0.86 else 2)
    def box(s,x0,y0,w,d,h,mat,top=0.95,front=0.55,side=0.32,bias=0.0):
        # top face at rows y0..y0+d-1, front face below it h rows; right column darker side
        s.new()
        for y in range(y0,y0+d):
            for x in range(x0,x0+w): s.setv(x,y,mat,top+bias-0.04*(y-y0)/max(1,d))
        for y in range(y0+d,y0+d+h):
            for x in range(x0,x0+w): s.setv(x,y,mat,front+bias-0.12*(y-y0-d)/max(1,h))
    def poly(s,pts,mat,v,grain=True):
        s.new(); ys=[p[1] for p in pts]
        for y in range(int(min(ys)),int(max(ys))+1):
            xs=[]; n=len(pts)
            for i in range(n):
                (x1,y1),(x2,y2)=pts[i],pts[(i+1)%n]
                if (y1<=y+0.5<y2) or (y2<=y+0.5<y1): xs.append(x1+(y+0.5-y1)*(x2-x1)/(y2-y1))
            xs.sort()
            for a,b in zip(xs[::2],xs[1::2]):
                for x in range(int(round(a)),int(round(b))):
                    s.setv(x,y,mat,v(x,y) if callable(v) else v,grain=grain)
    def line(s,x0,y0,x1,y1,mat,t):
        n=int(max(abs(x1-x0),abs(y1-y0)))+1
        for i in range(n):
            f=i/max(1,n-1); s.tone(int(round(x0+(x1-x0)*f)),int(round(y0+(y1-y0)*f)),mat,t)
    def darken(s,x,y,k=1):
        if s.inb(x,y) and s.m[y][x]:
            if s.fix[y][x] is not None: s.fix[y][x]=max(0,s.fix[y][x]-k)
            else: s.v[y][x]-=0.16*k
    def lighten(s,x,y,k=1):
        if s.inb(x,y) and s.m[y][x]:
            if s.fix[y][x] is not None: s.fix[y][x]=min(6,s.fix[y][x]+k)
            else: s.v[y][x]+=0.16*k
    def lit(s,rows,x0,y0,key):
        for j,row in enumerate(rows):
            for i,ch in enumerate(row):
                if ch=='.': continue
                if ch==' ': s.m[y0+j][x0+i]=None; continue
                m,t=key[ch]; s.tone(x0+i,y0+j,m,t)
    def shadow(s,cx,cy,rx,ry,a=100):
        for y in range(int(cy-ry)-1,int(cy+ry)+2):
            for x in range(int(cx-rx)-1,int(cx+rx)+2):
                dx=(x+0.5-cx)/rx; dy=(y+0.5-cy)/ry
                if dx*dx+dy*dy<=1 and s.inb(x,y) and s.m[y][x] is None: s.sh[y][x]=a
    def t_of(s,x,y):
        if s.fix[y][x] is not None: return s.fix[y][x]
        return max(1,min(6,int(round(s.v[y][x]*4.9+0.7))))
    def img(s,outline=True):
        W,H=s.w,s.h; T=[[None]*W for _ in range(H)]
        for y in range(H):
            for x in range(W):
                if s.m[y][x]: T[y][x]=(s.m[y][x],s.t_of(x,y))
        if outline:
            add=[]
            for y in range(H):
                for x in range(W):
                    if T[y][x] is not None: continue
                    for dx,dy in ((1,0),(-1,0),(0,1),(0,-1)):
                        xx,yy=x+dx,y+dy
                        if 0<=xx<W and 0<=yy<H and T[yy][xx] is not None:
                            add.append((x,y,T[yy][xx][0])); break
            for x,y,m in add: T[y][x]=(m,0)
            # contour where a front object (drawn later, other group) overlaps a back one: darken the back pixels
            dk=[]
            for y in range(H):
                for x in range(W):
                    if T[y][x] is None or T[y][x][1]==0: continue
                    a=s.id[y][x]
                    for dx,dy in ((1,0),(-1,0),(0,1),(0,-1)):
                        xx,yy=x+dx,y+dy
                        if 0<=xx<W and 0<=yy<H and T[yy][xx] and T[yy][xx][1]>0 and s.id[yy][xx]>a and s.grp.get(s.id[yy][xx])!=s.grp.get(a):
                            dk.append((x,y)); break
            for x,y in dk: T[y][x]=(T[y][x][0],1 if T[y][x][1]>2 else 0)
        for (x,y) in getattr(s,'spark',[]):
            T[y][x]=('cryst',6)
        im=Image.new('RGBA',(W,H))
        for y in range(H):
            for x in range(W):
                if T[y][x]: im.putpixel((x,y),hx(PAL[T[y][x][0]][T[y][x][1]])+(255,))
                elif s.sh[y][x]: im.putpixel((x,y),(14,30,8,s.sh[y][x]))
        return im

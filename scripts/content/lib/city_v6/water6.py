# 버들항 v6 animated water: 8-frame seamless loop over every open water pixel.
# v6 (verdict 7 "harbour water looks like paving under water"): the chipset's 2-tone water tile is gone from the base -
# depth bands now come from the distance to the bank plus two octaves of lattice-free value noise, so nothing repeats
# every 16 / 32 px; still water only swells in place (no drifting dash rows with a 16 px period); `natural` cells get
# an irregular, noise-carved shoreline (the carved band is returned as `beach` for a sand edge) instead of a quay rim.
#  - depth shading from the bank distance (dark middle, lighter shallows), the quay's shadow under a north bank
#  - river: current streaks that travel with the flow (south / east lanes, period 32 px, 4 px per frame)
#  - lake/pond: standing ripple dashes that swell and fade on their own phase, a slow eastward drift line set
#  - sparkles, foam along the quays and around piers / cutwaters / boats (flickering), boat ripple rings
#  - static multiplicative shade (arches, bridge shadow) and wobbling reflections (bridge faces, boats)
#  - lily pads and flowers on quiet water (static, drawn every frame)
import sys, os, math; sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from PIL import Image
from scipy import ndimage
import terrain
NF=8
WT=np.array(terrain.CH.crop((16,80,32,96)).convert('RGB'),dtype=np.int32)       # chipset water tile (2 tones)
TA=(28,74,68); TB=(33,88,78)
def vnoise2(W,H,sc,seed):
    # value noise on a jittered lattice of spacing sc (smoothstep interpolation); no tiling, no fixed period
    gw=W//sc+3; gh=H//sc+3; rng=np.random.RandomState(seed); G=rng.rand(gh,gw)
    ox=rng.randint(0,sc); oy=rng.randint(0,sc)
    Y,X=np.mgrid[0:H,0:W]; fx=(X+ox)/sc; fy=(Y+oy)/sc; ix=fx.astype(int); iy=fy.astype(int); tx=fx-ix; ty=fy-iy
    tx=tx*tx*(3-2*tx); ty=ty*ty*(3-2*ty)
    a=G[iy,ix]; b=G[iy,ix+1]; c=G[iy+1,ix]; d=G[iy+1,ix+1]
    return (a*(1-tx)+b*tx)*(1-ty)+(c*(1-tx)+d*tx)*ty
def nhash(x,y,s):
    x=np.asarray(x,dtype=np.uint64); y=np.asarray(y,dtype=np.uint64)
    h=(x*np.uint64(374761393)+y*np.uint64(668265263)+np.uint64(s*982451653))&np.uint64(0xffffffff)
    h=((h^(h>>np.uint64(13)))*np.uint64(1274126177))&np.uint64(0xffffffff)
    return ((h^(h>>np.uint64(16)))&np.uint64(0xffff)).astype(np.float64)/65535.0
class Water:
    def __init__(s,mask,flow,obstacles=(),lilies=(),natural=None):
        # mask[y][x] water cells; flow[y][x] in 'S','E','N','W','still'; obstacles: (x,y,r) px foam spots
        H=len(mask); W=len(mask[0]); s.H,s.W=H*16,W*16
        m=np.array(mask,bool); M=np.kron(m,np.ones((16,16),bool))
        # rim / quay face pixels (the same rule as pn.canal) are not surface
        up=np.zeros_like(m); up[1:]=m[:-1]; dn=np.zeros_like(m); dn[:-1]=m[1:]; lf=np.zeros_like(m); lf[:,1:]=m[:,:-1]; rt=np.zeros_like(m); rt[:,:-1]=m[:,1:]
        Y,X=np.mgrid[0:s.H,0:s.W]; ly=Y%16; lx=X%16
        cu=np.kron(up,np.ones((16,16),bool)); cd=np.kron(dn,np.ones((16,16),bool)); cl=np.kron(lf,np.ones((16,16),bool)); cr=np.kron(rt,np.ones((16,16),bool))
        rim=((~cu)&(ly<9))|((~cd)&(ly>=13))|((~cl)&(lx<3))|((~cr)&(lx>=13))
        s.surf=M&~rim
        s.beach=np.zeros_like(M)
        if natural is not None:
            NM=np.kron(np.array(natural,bool),np.ones((16,16),bool))&M
            dl=ndimage.distance_transform_edt(M)                        # px from the nearest land pixel
            thr=3.0+11.0*vnoise2(s.W,s.H,40,71)+4.0*vnoise2(s.W,s.H,13,72)
            wet=dl>thr
            s.surf=np.where(NM,wet,s.surf); s.beach=NM&~wet
        d=ndimage.distance_transform_edt(s.surf)
        s.d=d
        # depth bands: distance to the bank + two noise octaves + a hashed dither at the band edges (no tile, no period)
        TONES=np.array([(42,106,96),(33,88,78),(28,74,68),(26,70,64),(20,60,54)],np.float64)
        v=np.clip((d-1.5)/26.0,0,1)*0.78+(vnoise2(s.W,s.H,56,5)-0.5)*0.42+(vnoise2(s.W,s.H,19,6)-0.5)*0.16+(nhash(X,Y,5)-0.5)*0.07
        lvl=np.digitize(v,[0.10,0.28,0.50,0.74])
        base=TONES[lvl]
        # quay shadow under a north bank, lighter under a west bank (from pn.canal) -- measured in px from the bank
        nb=np.zeros((s.H,s.W),np.int32)+99
        for k in range(1,13):
            sh=np.zeros_like(s.surf); sh[k:]=~s.surf[:-k]
            nb=np.where((nb==99)&sh,k,nb)
        f=np.where(nb<=11,0.72+0.02*np.clip(nb-6,0,5),1.0)
        base*=f[...,None]
        s.base=base
        s.X,s.Y=X,Y
        fl=np.array([[{'S':0,'E':1,'N':2,'W':3}.get(flow[y][x],4) for x in range(W)] for y in range(H)])
        s.fl=np.kron(fl,np.ones((16,16),np.int32))
        s.obst=list(obstacles); s.shade=np.ones((s.H,s.W)); s.refl=[]; s.boats=[]; s.lilies=list(lilies)
    def add_shade(s,x0,y0,pts):
        for X,Y,k in pts:
            xx,yy=x0+X,y0+Y
            if 0<=xx<s.W and 0<=yy<s.H: s.shade[yy,xx]=min(s.shade[yy,xx],k)
    def add_band(s,x0,x1,y0,y1,k):
        s.shade[y0:y1,x0:x1]=np.minimum(s.shade[y0:y1,x0:x1],k)
    def add_reflection(s,img,x0,y0,alpha=0.26,dark=0.85):
        s.refl.append((np.array(img.convert('RGBA'),np.float64),x0,y0,alpha,dark))
    def add_boat(s,cx,cy,rx,phase):
        s.boats.append((cx,cy,rx,phase))
    def frame(s,f):
        X,Y=s.X,s.Y; c=s.base.copy(); surf=s.surf; d=s.d
        LIGHT=np.array((63,162,174),np.float64); PALE=np.array((125,152,162),np.float64); WHITE=np.array((167,212,219),np.float64)
        # ---- river current streaks ----
        for dirn,(u,v) in {0:(Y,X),1:(X,Y),2:(-Y,X),3:(-X,Y)}.items():
            sel=surf&(s.fl==dirn)&(d>2.5)
            if not sel.any(): continue
            lane=v//3; on=(v%3==1)&(nhash(lane,dirn,11)>0.3)
            off=(nhash(lane,dirn,12)*32).astype(np.int64); L=3+(nhash(lane,dirn,13)*4).astype(np.int64)
            ph=(u-f*4+off)%32
            st=sel&on&(ph<L)
            c[st]=c[st]*0.55+LIGHT*0.45
            st2=sel&on&(ph>=L)&(ph<L+2)&(nhash(lane,dirn,14)>0.6)
            c[st2]=c[st2]*0.8+LIGHT*0.2
        # ---- still water: ripple dashes swelling on their own phase + a slow drift ----
        sel=surf&(s.fl==4)&(d>2.5)
        if sel.any():
            gy=Y//7; gx=(X+(nhash(gy,0,20)*23).astype(np.int64))//23; hx_=nhash(gx,gy,21); hy_=nhash(gx,gy,22)
            cxp=gx*23-(nhash(gy,0,20)*23).astype(np.int64)+2+(hx_*15).astype(np.int64); cyp=gy*7+(hy_*5).astype(np.int64)
            ph=((f+(nhash(gx,gy,23)*NF).astype(np.int64))%NF)
            ln=np.choose(np.clip(ph,0,NF-1),[0,2,4,5,4,2,0,0])
            dash=sel&(Y==cyp)&(np.abs(X-cxp-2)<=ln//2)&(ln>0)&(nhash(gx,gy,24)>0.45)
            c[dash]=c[dash]*0.5+np.where((ph[dash]==3)[:,None],PALE,LIGHT)*0.5
        # ---- sparkles ----
        h=nhash(X,Y,31); ph=(nhash(X,Y,32)*NF).astype(np.int64)
        sp=surf&(d>1.5)&(h<0.0022)&(((f+ph)%NF)==0)
        c[sp]=WHITE
        sp2=surf&(d>1.5)&(h<0.0022)&(((f+ph)%NF)==1)
        c[sp2]=c[sp2]*0.4+WHITE*0.6
        # ---- foam along the quays ----
        fh=(nhash(X//2,Y//2,41)+f/NF)%1.0
        fo=surf&(d<=1.5)&(fh<0.34)
        c[fo]=c[fo]*0.35+PALE*0.65
        fo2=surf&(d>1.5)&(d<=2.6)&(fh<0.16)
        c[fo2]=c[fo2]*0.6+PALE*0.4
        # ---- foam around piers, cutwaters, boats ----
        for (ox,oy,r) in s.obst:
            x0,x1=max(0,ox-r-3),min(s.W,ox+r+4); y0,y1=max(0,oy-r-3),min(s.H,oy+r+4)
            if x0>=x1 or y0>=y1: continue
            xx,yy=X[y0:y1,x0:x1],Y[y0:y1,x0:x1]; dd=np.hypot(xx-ox,(yy-oy)*1.4)
            ring=(dd<=r+1)&(((nhash(xx//2,yy//2,43)+f/NF+dd/8)%1.0)<0.42)&surf[y0:y1,x0:x1]
            sub=c[y0:y1,x0:x1]; sub[ring]=sub[ring]*0.3+WHITE*0.7
        # ---- boat ripple rings (expanding, one per boat, own phase) ----
        for (bx,by,rx,phase) in s.boats:
            t=((f+phase)%NF)/NF; R=rx*0.75+2+t*8
            x0,x1=max(0,int(bx-R-2)),min(s.W,int(bx+R+3)); y0,y1=max(0,int(by-R*0.45-2)),min(s.H,int(by+R*0.45+3))
            xx,yy=X[y0:y1,x0:x1],Y[y0:y1,x0:x1]; dd=np.hypot((xx-bx)/R,(yy-by)/(R*0.4))
            ang=np.arctan2((yy-by)/0.4,xx-bx); dash=nhash((ang*5).astype(np.int64)+50,int(bx),51)>0.45
            ring=(np.abs(dd-1)<0.06)&surf[y0:y1,x0:x1]&(yy>=by-1)&dash
            sub=c[y0:y1,x0:x1]; a=0.4*(1-t); sub[ring]=sub[ring]*(1-a)+PALE*a
        # ---- reflections (wobbling rows) ----
        for arr,x0,y0,alpha,dark in s.refl:
            hgt,wid=arr.shape[:2]
            for j in range(hgt):
                yy=y0+j
                if not (0<=yy<s.H): continue
                sh=int(round(math.sin(j*0.9+f*2*math.pi/NF)*(1+j/12)))
                row=arr[j]; a=row[:,3]/255.0*alpha*(1-j/(hgt+4))
                xs=np.arange(wid)+x0+sh; ok=(xs>=0)&(xs<s.W)
                xs=xs[ok]; msk=surf[yy,xs]&(a[ok]>0)
                xs=xs[msk]; aa=a[ok][msk][:,None]; col=row[ok][msk][:,:3]*dark
                c[yy,xs]=c[yy,xs]*(1-aa)+col*aa
        c*=s.shade[...,None]
        # ---- lily pads (static) ----
        for (lx_,ly_,kind) in s.lilies: c=_lily(c,surf,lx_,ly_,kind)
        out=np.zeros((s.H,s.W,4),np.uint8); out[...,:3]=np.clip(c,0,255).astype(np.uint8); out[...,3]=np.where(surf,255,0)
        return out
LILY=[(20,58,39),(44,100,56),(70,138,64),(110,178,86),(150,208,112)]
def _lily(c,surf,x0,y0,kind):
    # a 7x4 pad with a notch (tones by the light from the upper-left), kind 1 = with a pink flower
    pad=["..###..",".#####.","##@@##.",".####.."]
    for j,row in enumerate(pad):
        for i,ch in enumerate(row):
            if ch=='.': continue
            X,Y=x0+i,y0+j
            if 0<=Y<c.shape[0] and 0<=X<c.shape[1] and surf[Y,X]:
                t=3 if (i<3 and j<2) else 2
                if ch=='@': t=1
                if j==3: t=1
                c[Y,X]=LILY[t]
    if kind==1:
        for (i,j,col) in ((3,0,(248,170,203)),(2,-1,(232,120,168)),(4,-1,(232,120,168)),(3,-1,(255,226,238)),(3,-2,(248,170,203))):
            X,Y=x0+i,y0+j
            if 0<=Y<c.shape[0] and 0<=X<c.shape[1]: c[Y,X]=col
    return c

# drawing primitives that follow the RTP rules: rolled rim on top faces, lit lip -> dark row -> black under-shadow,
# fixed ramps, grain near rims only, black only at the bottom / in cavities
from mat import *
def R(m): return M[m] if isinstance(m,str) else m
def box(p,x,y,w,d,h,mat='wood',panel=True,top=True,base=True,seed=1):
    """top face d rows (seen from above), front face h rows. Returns y of the front-face top."""
    Rm=R(mat); n=len(Rm)-1
    hi,lo=n-1 if n>6 else n,2
    for yy in range(d):
        for xx in range(w):
            X,Y=x+xx,y+yy
            if not top: continue
            if yy==0: t=1
            elif xx==0: t=2
            elif xx==w-1: t=1
            elif yy==1 or xx==1: t=hi
            elif xx==w-2: t=hi-2
            else:
                t=hi-1
                if min(xx-2,w-3-xx,yy-2)<2 and H(X//3,Y,seed)<0.25: t=hi-2
            p.set(X,Y,Rm[t])
    fy=y+d
    for xx in range(w):
        p.set(x+xx,fy,Rm[hi] if 0<xx<w-1 else Rm[1])
    for yy in range(1,h):
        for xx in range(w):
            X,Y=x+xx,fy+yy
            if xx in (0,w-1): t=0
            elif yy==1: t=2
            elif base and yy==h-1: t=0
            elif xx==1: t=hi-3
            elif xx==w-2: t=2
            else:
                t=hi-2
                if panel and h>=7:
                    lx=(xx-2)%max(6,(w-4)//max(1,(w-4)//12)) if w>10 else xx-2
                    if yy==2 or yy==h-2: t=hi-3
            p.set(X,Y,Rm[t])
    return fy
def panels(p,x,y,w,h,mat='wood',cols=1,knobs=True,drawers=0):
    """recessed door panels / drawers on a front face region"""
    Rm=R(mat); n=len(Rm)-1
    pw=w//cols
    for c in range(cols):
        x0=x+c*pw; x1=x0+pw-1
        if drawers:
            dh=h//drawers
            for d in range(drawers):
                y0=y+d*dh
                for xx in range(x0+1,x1):
                    p.set(xx,y0,Rm[n-1]); p.set(xx,y0+dh-1,Rm[1])
                kx=(x0+x1)//2; p.set(kx,y0+dh//2,M['brass'][5]); p.set(kx,y0+dh//2+1,M['brass'][2])
        else:
            for yy in range(y,y+h):
                p.set(x0+1,yy,Rm[n-1]); p.set(x1-1,yy,Rm[2])
            for xx in range(x0+1,x1):
                p.set(xx,y,Rm[n-1]); p.set(xx,y+h-1,Rm[2])
            if knobs:
                kx=x1-2 if c==0 else x0+2
                if cols==1: kx=x1-2
                p.set(kx,y+h//2,M['brass'][5]); p.set(kx,y+h//2+1,M['brass'][2])
def legs(p,x,y,w,h,mat='wood',inset=1):
    Rm=R(mat)
    for lx in (x+inset,x+w-inset-3):
        for yy in range(y,y+h):
            p.set(lx,yy,Rm[0]); p.set(lx+1,yy,Rm[5]); p.set(lx+2,yy,Rm[2])
def cavity(p,x,y,w,h,mat='wood'):
    """open interior seen from above (box/crate/basket inside): dark, lighter toward the front"""
    Rm=R(mat)
    for yy in range(h):
        for xx in range(w):
            p.set(x+xx,y+yy,Rm[1] if yy<h-1 else Rm[2])
        p.set(x,y+yy,Rm[0])
from PIL import Image as _I
def put_good(p,name,x,y,flip=False):
    f,a,b=G[name]
    if not flip: f(p,x,y); return
    t=Pix(a,b); f(t,0,0); p.im.alpha_composite(t.im.transpose(_I.FLIP_LEFT_RIGHT),(x,y))
def heap(p,x,y,w,h,goods,seed=3,dense=0.95):
    """pile goods in the rect: rows back to front, each row spread evenly across the width, alternate rows staggered,
    elongated goods alternate facing; a few gaps let the dark inside show"""
    gh=max(G[g][2] for g in goods)
    rows=max(1,round(h/(gh*0.65)))
    i=int(H(seed,0,seed)*len(goods))
    for r in range(rows):
        yy=y+(int(r*(h-gh)/(rows-1)) if rows>1 else (h-gh)//2)
        a=G[goods[i%len(goods)]][1]
        n=max(1,(w+(1 if a>4 else 0))//(a-1 if a>4 else a))
        if r%2 and n>1 and a<=4: n-=1
        span=w-a
        for k in range(n):
            g=goods[i%len(goods)]; a=G[g][1]
            xx=x+(round(k*span/(n-1)) if n>1 else span//2)+(1 if (r%2 and a<=4) else 0)
            if H(xx,yy,seed)<dense: put_good(p,g,min(xx,x+w-a),yy+(1 if H(xx,r,seed+1)<0.3 else 0),flip=(a>=6 and (k+r)%2==1))
            i+=1
def ellipse_top(p,cx,cy,rx,ry,mat,inner=None):
    """lid / rim of a round thing seen from above; inner=(mat) fills the opening"""
    Rm=R(mat)
    for yy in range(-ry,ry+1):
        for xx in range(-rx,rx+1):
            d=(xx/(rx+0.5))**2+(yy/(ry+0.5))**2
            if d>1: continue
            X,Y=cx+xx,cy+yy
            if inner and d<0.55: p.set(X,Y,R(inner)[1 if yy<0 else 3]); continue
            t=5 if (yy<0 and xx<rx*0.3) else 4
            if d>0.8: t=2 if yy>0 else 6
            p.set(X,Y,Rm[t])
def cylinder(p,x,y,w,h,mat,bands=(),bandmat='iron'):
    Rm=R(mat); B=R(bandmat)
    for xx in range(w):
        f=xx/(w-1)
        t=[2,4,5,5,4,4,3,2][min(7,int(f*8))]
        for yy in range(h):
            c=Rm[t if yy<h-1 else 1]
            if yy in bands: c=B[min(6,t+1)]
            if xx in (0,w-1): c=Rm[0] if yy>1 else Rm[1]
            p.set(x+xx,y+yy,c)
def hang_board(p,x,y,w,mat='wood'):
    Rm=R(mat)
    for xx in range(w):
        p.set(x+xx,y,Rm[6]); p.set(x+xx,y+1,Rm[3]); p.set(x+xx,y+2,Rm[1])
    p.set(x+1,y+3,Rm[2]); p.set(x+w-2,y+3,Rm[2])

import sys, random, math; sys.path.insert(0,'round2')
from w3_common import *
PAL=[(12,35,26),(19,49,32),(20,58,39),(32,80,48),(54,99,36),(75,130,50),(88,160,53),(115,184,62),(143,210,74)]
# also (46,80,34),(71,114,42),(88,130,50) in originals -> snap to nearest of PAL by luminance
def lum(c): return 0.3*c[0]+0.59*c[1]+0.11*c[2]
def snap(c):
    return min(range(len(PAL)),key=lambda i:abs(lum(PAL[i])-lum(c)))
def clump_shape(ntier,rnd,y0,y1,cx,rmin,rmax):
    rs=[rmin+(rmax-rmin)*((k/(ntier-1))**0.8) for k in range(ntier)]
    rys=[r*0.5+1.0 for r in rs]
    cl=[];cy=y0+rys[0]
    for k in range(ntier):
        cl.append((cx+rnd.uniform(-0.5,0.5),cy,rs[k],rys[k]))
        if k<ntier-1: cy+=0.62*(rys[k]+rys[k+1])
    return cl
def make(name,seed,ntier,rmax,shift):
    o=load(R1+'existing-bd-tree-'+name+'.png')
    rnd=random.Random(seed)
    n=Image.new('RGBA',(16,48),(0,0,0,0))
    # noise for lumpy edge
    grid={}
    def g(i,j):
        if (i,j) not in grid: grid[(i,j)]=rnd.random()
        return grid[(i,j)]
    def noise(x,y,s):
        fx,fy=x/s,y/s; i,j=int(fx),int(fy); tx,ty=fx-i,fy-j
        a=g(i,j)*(1-tx)+g(i+1,j)*tx; b=g(i,j+1)*(1-tx)+g(i+1,j+1)*tx
        return a*(1-ty)+b*ty
    y0,y1,cx=2,42,7.5
    cl=clump_shape(ntier,rnd,y0,y1,cx,3.4,rmax)
    owner={}
    for idx,(ccx,ccy,rx,ry) in enumerate(cl):
        for y in range(int(ccy-ry)-1,int(ccy+ry)+2):
            for x in range(16):
                dx=(x+0.5-ccx)/rx; dy=(y+0.5-ccy)/ry
                e=1+0.16*(noise(x+idx*5,y+idx*3,2.0)-0.5)*2
                if dx*dx+dy*dy<=e: owner[(x,y)]=(idx,dx,dy)
    rows={}
    for (x,y) in owner: rows.setdefault(y,[]).append(x)
    # orig row extents
    oext={}
    for y in range(48):
        xs=[x for x in range(16) if o.getpixel((x,y))[3] and y<43]
        if xs: oext[y]=(min(xs),max(xs))
    lvl={}
    for y,xs in rows.items():
        l,r=min(xs),max(xs); w=r-l+1
        oy=min(42,max(1,y))
        # sample orig at nearest row with extents
        while oy not in oext and oy<42: oy+=1
        ol,orr=oext[oy]; ow=orr-ol+1
        for x in xs:
            u=(x-l+0.5)/w
            sx=int(ol+u*ow); sx=max(ol,min(orr,sx))
            sy=oy
            p=o.getpixel((sx,sy))
            lvl[(x,y)]=snap(p[:3]) if p[3] else 3
    # lighting overlay
    out={}
    for (x,y),(idx,dx,dy) in owner.items():
        v=lvl[(x,y)]
        # tier-top lit rim, left lit
        v+= round(-dy*2.0) + round(-dx*0.8)
        if idx==0: v+=2 if (dx+dy)<0.3 else 1
        elif idx==1 and dy<-0.2: v+=1
        # darken the part overlapped just above next tier (underside)
        v+=shift
        out[(x,y)]=max(1,min(8,int(round(v))))
    for (x,y),(idx,_,_) in owner.items():
        b=owner.get((x,y+1))
        if b and b[0]>idx: out[(x,y)]=min(out[(x,y)],2)
    for (x,y) in list(out):
        for dx,dy in ((1,0),(-1,0),(0,1),(0,-1)):
            if (x+dx,y+dy) not in out: out[(x,y)]=0; break
    yb=max(y for (x,y) in out)
    for (x,y),l in out.items():
        if 0<=y<48: n.putpixel((x,y),PAL[l]+(255,))
    M=(59,40,31);N=(37,26,20)
    for y in range(yb,48):
        n.putpixel((7,y),M+(255,)); n.putpixel((8,y),N+(255,))
    n.save(R2+'tree-'+name+'.png'); compare(o,n,R2+'tree-'+name+'-compare.png')
if __name__=='__main__':
    make('eef4bc',5,8,6.6,-0.3)
    make('28ad5e',8,8,6.7,0)
    make('c27062',13,8,6.6,0.3)

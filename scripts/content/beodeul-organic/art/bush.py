"""Bushes: hand-placed lobe clusters, shaded per lobe (light upper-left), dark gaps, s/S ground shadow."""
import random
DK = {"o":"#071f1d","1":"#08372c","2":"#0a5134","3":"#226b39","4":"#418640","5":"#8cbf5f"}
WD = {"o":"#071d1b","1":"#063328","2":"#104c2f","3":"#296535","4":"#497f3c","5":"#94b353"}

def lobes_img(W, H, lobes, ramp, seed, berries=(), thorns=False):
    rnd = random.Random(seed)
    g = [["."]*W for _ in range(H)]
    own = [[None]*W for _ in range(H)]
    # lobes drawn back to front (list order); later lobes overlap earlier
    for i,(cx,cy,rx,ry) in enumerate(lobes):
        for y in range(H):
            for x in range(W):
                dx=(x-cx)/rx; dy=(y-cy)/ry; d=dx*dx+dy*dy
                wob = 0.18*rnd.random()
                if d <= 1.0-wob:
                    own[y][x]=(i,dx,dy,d)
    gx,gy=W/2,H/2
    for y in range(H):
        for x in range(W):
            o=own[y][x]
            if not o: continue
            i,dx,dy,d=o
            cx,cy,_,_=lobes[i]
            # global darkening toward lower-right of whole bush
            glob=((cx-gx)/W*1.2+(cy-gy)/H*1.6)*3.0
            v = -(dx+dy)*2.4 - d*1.0 - glob + 2.1
            # edge between different lobes -> inner contour
            edge=False
            for ax,ay in ((1,0),(0,1),(-1,0),(0,-1)):
                nx,ny=x+ax,y+ay
                if 0<=nx<W and 0<=ny<H and own[ny][nx] and own[ny][nx][0]!=i and own[ny][nx][0]<i and (ax<0 or ay<0)==False:
                    pass
                if (ax,ay) in ((0,1),(1,0)) and 0<=nx<W and 0<=ny<H and own[ny][nx] and own[ny][nx][0]>i+1 and d>0.35:
                    edge=True
            v += rnd.choice((0,0,0,0.6,-0.6))
            if v>2.6: c="5"
            elif v>1.7: c="4"
            elif v>0.8: c="3"
            elif v>0.0: c="2"
            else: c="1"
            if edge: c="o" if c in "12" else "1"
            if d>0.5 and (dx+dy)>0.35: c="1" if c in "123" else "2"
            g[y][x]=c
    # thin isolated '5' singles -> 4 (clump the highlights)
    for y in range(H):
        for x in range(W):
            if g[y][x]=="5":
                n=sum(1 for ax,ay in ((1,0),(0,1),(-1,0),(0,-1)) if 0<=x+ax<W and 0<=y+ay<H and g[y+ay][x+ax]=="5")
                if n==0: g[y][x]="4"
    # outline
    out=[r[:] for r in g]
    for y in range(H):
        for x in range(W):
            if g[y][x]!=".": continue
            if any(0<=x+ax<W and 0<=y+ay<H and g[y+ay][x+ax] not in "." for ax,ay in ((1,0),(0,1),(-1,0),(0,-1))):
                out[y][x]="o"
    g=out
    for y in range(H):
        for x in range(W):
            if g[y][x]=="o" and rnd.random()<0.12:
                if any(0<=x+ax<W and 0<=y+ay<H and g[y+ay][x+ax]=="." for ax,ay in ((1,0),(0,1),(-1,0),(0,-1))):
                    g[y][x]="."
    # dark holes inside mass
    for y in range(1,H-1):
        for x in range(1,W-1):
            if g[y][x]=="1" and rnd.random()<0.25 and all(g[y+ay][x+ax]!="." for ax,ay in ((1,0),(0,1),(-1,0),(0,-1))):
                g[y][x]="o"
    for (x,y) in berries:
        for (ax,ay,c) in ((0,0,"r"),(1,0,"R"),(0,1,"d")):
            if g[y+ay][x+ax]!=".": g[y+ay][x+ax]=c
        if rnd.random()<0.5 and g[y][x]=="r": g[y][x]="h"
    if thorns:
        for _ in range(W//2):
            x=rnd.randrange(1,W-1); y=rnd.randrange(1,H-3)
            if g[y][x] in "234": g[y][x]="t"
    # ground shadow lower-right
    for y in range(H-1,-1,-1):
        pass
    for x in range(W):
        col=[y for y in range(H) if g[y][x]!="."]
        if not col: continue
        b=max(col)
        for k,ch in ((1,"S"),(2,"s")):
            yy=b+k
            if yy<H and g[yy][x]=="." and x>W*0.25: g[yy][x]=ch
    return ["".join(r) for r in g]

def scatter(seed, cx, cy, rx, ry, n, r0, r1):
    rnd=random.Random(seed); L=[]
    while len(L)<n:
        a=rnd.uniform(-1,1); b=rnd.uniform(-1,1)
        if a*a+b*b>1: continue
        if len(L)<n//2: a*=0.6; b*=0.6
        r=rnd.uniform(r0,r1)
        L.append((cx+a*rx, cy+b*ry, r, r*rnd.uniform(0.75,0.95)))
    L.sort(key=lambda t:t[1]+0.3*t[0])
    return L

def keys(ramp, extra=None):
    k=dict(ramp); k.update({"s":"s","S":"S"})
    if extra: k.update(extra)
    return k

BER={"r":"#dd2912","R":"#9e2514","d":"#650000","h":"#e8a8b9"}
TH={"t":"#6f4725"}
ART={
 "bush-s":(lobes_img(16,16,scatter(4,8,9,4.6,3.6,16,2.2,3.0),DK,3),keys(DK)),
 "bush-m":(lobes_img(32,32,scatter(8,16,18,10.5,6.5,40,3.0,4.4),WD,7),keys(WD)),
 "bush-berry":(lobes_img(32,32,scatter(22,16,16,8.5,8,30,3.6,5.0),DK,11,berries=[(9,11),(17,13),(22,9),(13,19),(24,18),(7,17),(19,22),(11,23),(26,14),(15,8)]),keys(DK,BER)),
 "shrub-tall":(lobes_img(16,32,scatter(6,8,17,3.0,10,26,2.4,3.2),WD,5),keys(WD)),
 "bramble":(lobes_img(32,16,scatter(10,16,10,12.5,2.6,28,2.2,3.0),WD,9,thorns=True),keys(WD,TH)),
}

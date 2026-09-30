import math
def canvas(W,H,ch='k'): return [[ch]*W for _ in range(H)]
def R(g,x0,y0,x1,y1,ch):
    for y in range(max(0,y0),min(len(g)-1,y1)+1):
        for x in range(max(0,x0),min(len(g[0])-1,x1)+1): g[y][x]=ch
def P(g,x,y,ch):
    if 0<=y<len(g) and 0<=x<len(g[0]): g[y][x]=ch
def stamp(g,x,y,rows,skip='.'):
    for j,r in enumerate(rows):
        for i,ch in enumerate(r):
            if ch!=skip: P(g,x+i,y+j,ch)
def out(g): return [''.join(r) for r in g]
def ellipse_mask(cx,cy,rx,ry):
    m=set()
    for y in range(int(cy-ry)-1,int(cy+ry)+2):
        for x in range(int(cx-rx)-1,int(cx+rx)+2):
            if ((x+.5-cx)/rx)**2+((y+.5-cy)/ry)**2<=1: m.add((x,y))
    return m
def lantern(g,x0,y0,w,hb,t):
    """x0,y0 = left/top of whole lantern. w body width, hb body height. t = tone dict"""
    cx=x0+w/2; cy=y0+3+hb/2
    # cord
    R(g,int(cx)-1,y0,int(cx),y0+1,t['cord'])
    # top cap
    R(g,x0+2,y0+2,x0+w-3,y0+3,t['cap'])
    m=ellipse_mask(cx,y0+4+hb/2,w/2,hb/2)
    by=y0+4
    for (x,y) in m:
        edge=any((x+dx,y+dy) not in m for dx,dy in((1,0),(-1,0),(0,1),(0,-1)))
        u=(x+.5-cx)/(w/2); v=(y+.5-(by+hb/2))/(hb/2)
        if edge: ch=t['ol']
        elif u<-0.4 and v<0.35: ch=t['hi']
        elif u>0.35 or v>0.6: ch=t['sh']
        else: ch=t['mid']
        if not edge and abs(u)<0.3 and abs(v)<0.3 and t.get('hot'): ch=t['hot']
        P(g,x,y,ch)
    # ribs
    for f in (0.3,0.5,0.7):
        yy=int(by+hb*f)
        for x in range(x0,x0+w+1):
            if (x,yy) in m and (x+1,yy) in m and (x-1,yy) in m and g[yy][x] not in (t['ol'],): g[yy][x]=t['rib']
    # bottom cap + tassel
    ye=by+hb
    R(g,x0+2,ye,x0+w-3,ye+1,t['cap'])
    R(g,int(cx)-1,ye+2,int(cx),ye+4,t['tas'])
    return ye+4
NOREN=None
def noren(g,x0,y0,w,h,t):
    R(g,x0-2,y0-1,x0+w+1,y0,t['rail'])
    R(g,x0,y0+1,x0+w-1,y0+h-1,t['cloth'])
    # panels & slits
    pw=w//3
    for k in range(3):
        px=x0+k*pw
        R(g,px,y0+1,px,y0+h-1,t['hi'])
        R(g,px+pw-1,y0+1,px+pw-1,y0+h-1,t['sh'])
    for k in (1,2):
        sx=x0+k*pw
        R(g,sx,y0+5,sx,y0+h-1,t['slit'])
    R(g,x0,y0+h-1,x0+w-1,y0+h-1,t['hem'])
    # emblem on middle panel
    mx=x0+pw+(pw//2)
    for (dx,dy) in ((0,-2),(-1,-1),(0,-1),(1,-1),(-2,0),(-1,0),(0,0),(1,0),(2,0),(-1,1),(0,1),(1,1),(0,2)):
        P(g,mx+dx-0,y0+3+dy,t['mark'])

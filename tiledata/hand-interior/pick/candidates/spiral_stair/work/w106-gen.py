import math
W,H=32,64
g=[['.']*W for _ in range(H)]
cx=16.0; K=0.5
def put(x,y,c):
    if 0<=x<W and 0<=y<H: g[y][x]=c
# column template
head=["..DDDDDDDD..",".DCCCCCCCCD.","DCCCCCCCCEED",".DCCCEEEEGD.","DDCCCCCCCEDD","DDEEEEFGGGDD",
".DDEEFGGGDD.","..DCCHEFGD..","..DGGGGGGD..","..DFFFFFFD.."]
def col_items():
    it=[]
    for i,r in enumerate(head):
        for j,ch in enumerate(r):
            if ch!='.': it.append((10+j,9+i,ch))
    for y in range(19,56):
        for j,ch in enumerate("DCCFEGGD"): it.append((12+j,y,ch))
    return it
base=[".DCCCEEGGGD.","DCCCCCEEEGGD","DCCCCEEEEGGD","DHHHHHHHHHHD",".DEEEEFGGGD.","..DDDDDDDD.."]
def base_items():
    it=[]
    for i,r in enumerate(base):
        for j,ch in enumerate(r):
            if ch!='.': it.append((10+j,56+i,ch))
    return it
N=9; step=4.5; y0=56.0; th0=25; span=42; SP=36
def inrange(t,a,b):
    return ((t-a)%360)<=(b-a)
treads=[]
for k in range(N):
    yc=y0-step*k; a=th0+SP*k; b=a+span
    T=set()
    for y in range(H):
        for x in range(W):
            dx=x+0.5-cx; dy=(y+0.5-yc)/K
            r=math.hypot(dx,dy)
            if 3.5<=r<=14.5 and inrange(math.degrees(math.atan2(dy,dx)),a,b): T.add((x,y))
    mid=math.radians(a+span/2)
    treads.append((math.sin(mid),T,k))
# handrail points
rail=[]
prev=None
for i in range(0,int((SP*6.9)*2)):
    t=th0+i/2.0+10
    yc=y0-step*(t-th0)/SP
    r=13.5
    x=int(math.floor(cx+r*math.cos(math.radians(t))))
    y=int(round(yc+K*r*math.sin(math.radians(t))-7))
    d=math.sin(math.radians(t))
    if prev is None: pts=[(x,y)]
    else:
        px,py=prev; n=max(abs(x-px),abs(y-py)); pts=[(px+round((x-px)*j/n),py+round((y-py)*j/n)) for j in range(1,n+1)] if n else []
    for p in pts: rail.append((d,p[0],p[1]))
    prev=(x,y)
items=[]
for d,T,k in treads: items.append((d,0,k,T))
for d,x,y in rail: items.append((d,1,x,(x,y)))
items.sort(key=lambda s:(s[0],s[1]))
# base first
for x,y,c in base_items(): put(x,y,c)
colp=False
def draw_col():
    for x,y,c in col_items(): put(x,y,c)
for d,kind,a,b in items:
    if not colp and d>=0: draw_col(); colp=True
    if kind==0:
        T=b
        for (x,y) in T:
            if (x,y+1) not in T:
                put(x,y+1,'G'); 
                if (x,y+2) not in T: put(x,y+2,'H')
        for (x,y) in T:
            put(x,y,'C' if (x,y+1) not in T else 'E')
    else:
        if b[1]>=9: put(b[0],b[1],"A")
if not colp: draw_col()
out=["// w106-A 나선 계단: 둥근 가운데 기둥(머리 타원)+부채꼴 디딤판 11장(윗면·앞 모서리·두께 2행)+얇은 난간 한 줄"]
out+=["@size 32 64","@cell 16","@palette palette.pal","@block 0 0"]
out+=[''.join(r) for r in g]
open('w106-A.pxg','w').write('\n'.join(out)+'\n')

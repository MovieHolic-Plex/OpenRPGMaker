# 버들항 변형 2 — 사막 손 도트 소품 (vprops 와 같은 C 볼륨 페인터 + 톤 직접 찍기)
from vprops import *
PAL['camel']=['#2e1a0c','#4e3018','#7a5028','#a07038','#c09050','#dcb073','#f2d49c']
PAL['cactus']=['#10301c','#1c4a2a','#2c6a3a','#438a48','#62a85a','#8cc874','#bce89c']
PAL['scrub']=['#3a2c14','#5a4620','#7c6630','#9e8844','#bca860','#d6c480','#eee0a8']
PAL['shell']=['#3a2a24','#6a5648','#988272','#b8a48e','#d0c0a8','#e6dac2','#f8f0dc']
PAL['dome']=['#0c2c34','#14485a','#1c6878','#2a8c98','#4cb0b0','#84d4c8','#c8f4e8']      # 청록 돔
PAL['rugred']=['#3a1014','#621a1c','#8c2a24','#b04030','#cc5c3c','#e08a5c','#f4b888']
PAL['rugblue']=['#0c1c3a','#182e5c','#244a80','#3468a4','#5088c4','#80b0dc','#b8d8f0']
PAL['terra']=['#3a1e14','#6a3a24','#94562e','#b8783c','#d49a58','#ecc080','#fae0aa']
GRAIN.update({'terra':(0.07,1.5),'camel':(0.08,1.6),'cactus':(0.06,1.5),'scrub':(0.10,1.4),'shell':(0.05,1.5),'dome':(0.05,1.5),'rugred':(0.06,1.4),'rugblue':(0.06,1.4)})

def _px(im,x,y,mat,t):
    if 0<=x<im.width and 0<=y<im.height: im.putpixel((x,y),hx(PAL[mat][t])+(255,))

# ---- 평지붕: 난간 + 옥상 슬래브를 벽 위에 얹는다(경사 지붕 대신). 벽 그림은 house(..., nroof=0, mode='sand').
def flatroof(wall,seed=1,items=(),cap=13,hut=None):
    W=wall.width; top=cap+(14 if hut else 0)
    im=Image.new('RGBA',(W,wall.height+top),(0,0,0,0)); im.alpha_composite(wall,(0,top))
    y0=(14 if hut else 0)
    # 난간 윗면(뒤) 2줄, 안쪽 면 2줄, 슬래브, 앞 난간 윗면 2줄
    for x in range(1,W-1):
        j=hsh(x,seed,7)
        _px(im,x,y0,'sstone',5 if j>0.3 else 6); _px(im,x,y0+1,'sstone',4)
        _px(im,x,y0+2,'sstone',3 if x>3 else 4); _px(im,x,y0+3,'sstone',2)
        for y in range(y0+4,y0+cap-3):
            t=4+(1 if hsh(x//2,y,seed+3)>0.72 else 0)-(1 if hsh(x,y//2,seed+4)>0.86 else 0)
            if y==y0+4: t=3                         # 난간 그림자
            _px(im,x,y,'sand' if hsh(x,y,seed+5)>0.92 else 'sstone',t)
        _px(im,x,y0+cap-3,'sstone',6 if hsh(x,seed,9)>0.3 else 5); _px(im,x,y0+cap-2,'sstone',5); _px(im,x,y0+cap-1,'sstone',3)
    for y in range(y0,y0+cap):                      # 양옆 난간 두께
        _px(im,1,y,'sstone',5 if y<y0+cap-1 else 4); _px(im,2,y,'sstone',4)
        _px(im,W-2,y,'sstone',3); _px(im,W-3,y,'sstone',4 if y<y0+4 else 3)
    for it in items:
        name,x=it[0],it[1]
        yb=y0+cap-5
        if name=='pot':
            c=C(8,9,seed+x); c.ellipsoid(4,5,3,3.2,'terra',bias=0.05); T(c,3,1,'terra',2); T(c,4,1,'terra',2); T(c,5,1,'terra',3)
            im.alpha_composite(c.img(False),(x,yb-8))
        elif name=='cloth':
            for j in range(5):
                for i in range(7):
                    if j==0 and i in(0,6): continue
                    _px(im,x+i,yb-4+j,'red' if it[2]=='r' else 'cryst',5 if (i<3 and j<3) else (4 if j<4 else 2))
        elif name=='stack':                          # 마른 장작/볏짚 더미
            for j in range(4):
                for i in range(9-j):
                    _px(im,x+i+j//2,yb-3+j,'thatch',5 if (i+j)%3 else 3)
        elif name=='ladder':
            for y in range(yb-10,yb+1):
                _px(im,x,y,'bark',3); _px(im,x+5,y,'bark',2)
                if y%3==0 and y<yb: 
                    for i in range(1,5): _px(im,x+i,y,'wood',4)
    if hut:                                        # 계단실 작은 상자
        hw=hut; hx0=W-hw-6
        for y in range(2,15):
            for x in range(hx0,hx0+hw):
                t=6 if y==2 else (5 if y<5 else (3 if y<7 else 4))
                _px(im,x,y,'sstone',t - (1 if x>hx0+hw-3 else 0))
        for y in range(9,15):                        # 문
            for x in range(hx0+hw//2-2,hx0+hw//2+2): _px(im,x,y,'wood',2 if y>9 else 1)
    return im

def dome(w=48,h=26,seed=1,mat='dome'):
    """사원 돔: 타원체 + 받침 테두리 + 꼭대기 금 첨탑"""
    c=C(w,h+10,seed); c.shadow(w/2,h+6.5,w*0.44,1.5,60)
    c.ellipsoid(w/2,h-2,w/2-1,h-4,mat,rz=1.0,amb=0.16,bias=0.02)
    c.new()
    for x in range(1,w-1):
        for y in (h-2,h-1,h): T(c,x,y,'sstone',{h-2:5,h-1:4,h:3}[y])
    for y in range(0,7): T(c,w//2,2+y,'gold',5 if y<4 else 3)
    T(c,w//2,0,'gold',6); T(c,w//2,1,'gold',6)
    for r in range(2,w//2-3,4):                    # 골 무늬
        pass
    return c

# ---- 야자수
def palm(kind=0,seed=1):
    W,H=(44,62) if kind!=2 else (36,44)
    c=C(W,H,seed); cx=W//2
    c.shadow(cx+2,H-2.5,9,2.2,95)
    th={0:44,1:34,2:24}[kind]; lean={0:3,1:-2,2:2}[kind]
    by=H-4; ty=by-th; tx=cx+lean
    pts=[]
    for i in range(th+1):
        f=i/th; x=cx+lean*f*f*2.2+ (1 if kind==1 and f>0.5 else 0)*(-f*2); y=by-i
        pts.append((x,y))
    for i,(x,y) in enumerate(pts):
        xi=int(round(x)); w3=3 if i>4 else 4
        for k in range(w3):
            t=4 if k==0 else (3 if k<w3-1 else 2)
            if i%3==0: t-=1                          # 마디 무늬
            T(c,xi+k-1,int(y),'bark',max(1,t))
    for k in range(-3,4):                           # 밑동 퍼짐
        T(c,cx+k,by+1,'bark',2 if k>0 else 3); 
    for k in range(-2,3): T(c,cx+k,by,'bark',3 if k<=0 else 2)
    fx,fy=pts[-1]; fx=int(round(fx)); fy=int(fy)
    # 잎: (시작각, 길이, 처짐). 리브를 곡선으로 그리고 아래로 잔잎 띠를 붙인다
    fr=[(-178,17,9),(-150,19,8),(-118,14,5),(-90,10,2),(-62,14,5),(-30,19,8),(-2,17,9),(25,13,9),(155,13,9)]
    rng=random.Random(seed)
    for a,L,dr in sorted(fr,key=lambda f:abs(f[0]+90)):
        ar=math.radians(a); dx,dy=math.cos(ar),math.sin(ar)
        left=dx<0
        for s_ in range(L):
            t=s_/L
            x=fx+dx*s_*1.0; y=fy+dy*s_*0.55+dr*t*t*1.6
            xi=int(round(x)); yi=int(round(y))
            # 리브
            T(c,xi,yi,'palm',6 if left else 5)
            # 잔잎 띠(리브 아래로)
            bh=int(round(1+3.2*math.sin(math.pi*min(1,t*1.15))))
            for k in range(1,bh+1):
                if (xi+k)%3==0 and k==bh and t>0.25: continue   # 끝 톱니
                tt=4 if left else 3
                if k>=bh-0: tt-=1
                if k==1: tt+=1
                T(c,xi,yi+k,'palm',max(1,min(6,tt)))
    for i in range(-2,3): T(c,fx+i,fy+1+(abs(i)>1),'palm',2)
    if kind==0:                                     # 대추 송이
        for i in range(6): T(c,fx-2+i%3,fy+3+i//3,'wood',2+(i%2)); 
    T(c,fx,fy,'palm',2); T(c,fx+1,fy,'palm',2)
    return fin(c)

# ---- 선인장
def cactus(kind=0,seed=1):
    if kind==0:      # 큰 선인장(팔 둘)
        c=C(28,44,seed); c.shadow(14,41,8,1.8,95)
        c.cylinder(14,8,39,4.2,'cactus',capry=2.0)
        c.cylinder(5,15,25,2.6,'cactus',capry=1.3); c.hcyl(6,11,27,2.4,'cactus') 
        c.cylinder(23,11,21,2.6,'cactus',capry=1.3); c.hcyl(17,22,24,2.4,'cactus')
        for y in range(10,38,3): T(c,13,y,'cactus',5); T(c,15,y+1,'cactus',2)
        for (x,y) in ((14,6),(13,7)): T(c,x,y,'scrub',6)
    elif kind==1:    # 통선인장
        c=C(18,18,seed); c.shadow(9,15.4,6,1.6,90)
        c.ellipsoid(9,9.5,6,6.4,'cactus',bias=0.0)
        for x in (5,7,9,11,13): 
            for y in range(4,15): 
                if c.m[y][x]: c.darken(x,y,1) if (x%2==1) else None
        for (x,y) in ((9,3),(8,3),(10,3)): T(c,x,y,'rugred',5)
    else:            # 작은 납작 선인장(부채)
        c=C(24,24,seed); c.shadow(12,21.5,7,1.6,90)
        c.ellipsoid(10,16,4.5,4.0,'cactus'); c.ellipsoid(15,10,4,3.6,'cactus'); c.ellipsoid(8,8,3.2,3.0,'cactus')
        for (x,y) in ((8,5),(15,7),(18,9)): T(c,x,y,'rugred',5)
    return fin(c)

def scrub(kind=0,seed=1):
    if kind==0:      # 마른 덤불
        c=C(24,16,seed); c.shadow(12,13.6,8,1.4,80)
        rng=random.Random(seed)
        for i in range(58):
            a=rng.uniform(-2.9,-0.25); L=rng.uniform(5,11)
            for s_ in range(int(L)):
                x=int(12+math.cos(a)*s_*1.3); y=int(12+math.sin(a)*s_*0.95)
                T(c,x,y,'scrub',5 if (x<12 and s_>L*0.5) else (3 if s_<L*0.5 else 4))
    else:            # 굴러다니는 덤불 공
        c=C(18,16,seed); c.shadow(9,13.6,6,1.3,80)
        c.ellipsoid(9,8.5,6.2,5.6,'scrub',bump=0.9,bsc=1.6)
        rng=random.Random(seed)
        for i in range(14):
            x=rng.randint(4,14); y=rng.randint(4,12)
            if c.m[y][x]: T(c,x,y,'scrub',1)
    return fin(c)

def sandrock(w=24,h=18,seed=1):
    c=C(w,h,seed); c.shadow(w/2,h-2.5,w*0.44,2.0,100)
    c.ellipsoid(w/2,h*0.55,w*0.44,h*0.40,'sstone',bias=-0.02,bump=0.5,bsc=3.0)
    for y in range(int(h*0.3),int(h*0.8),3):       # 지층 줄
        for x in range(2,w-2):
            if c.m[y][x] and hsh(x,y,seed)>0.35: c.darken(x,y,1)
    return fin(c)

def mesa_pillar(seed=1,w=30,h=56):
    """사암 기둥(메사 잔해): 지층 줄무늬가 있는 긴 돌기둥"""
    c=C(w,h,seed); c.shadow(w/2,h-3,w*0.45,2.4,100)
    c.cylinder(w/2,6,h-8,w*0.36,'sstone',capry=3.0,amb=0.18,bias=0.0)
    for y in range(9,h-8):
        if (y//4)%2==0:
            for x in range(2,w-2):
                if c.m[y][x] and hsh(x,y//4,seed)>0.2: c.darken(x,y,1)
    c.cylinder(w/2+1,h-14,h-6,w*0.42,'sstone',capry=2.5)
    return fin(c)

# ---- 낙타 (옆모습, 오른쪽을 본다; 윗면이 보이는 3/4)
def _neck(c,pts,r0,r1,mat='camel'):
    """pts: 목 중심선. 각 점에서 반지름 r 의 원판을 칠하되 톤은 원판 안 위치(왼쪽 위 밝게)로 — 밧줄처럼 안 보이게 한 번에."""
    n=len(pts); cells={}
    for i,(px_,py_) in enumerate(pts):
        r=r0+(r1-r0)*i/(n-1)
        for y in range(int(py_-r)-1,int(py_+r)+2):
            for x in range(int(px_-r)-1,int(px_+r)+2):
                d=math.hypot(x+0.5-px_,y+0.5-py_)
                if d<=r: cells[(x,y)]=min(cells.get((x,y),9),0)  # 마스크
    xs=[k[0] for k in cells]; 
    for (x,y) in cells:
        # 중심선으로부터 가까운 점 기준 법선 밝기
        best=min(pts,key=lambda p:(p[0]-x-0.5)**2+(p[1]-y-0.5)**2)
        nx=(x+0.5-best[0]); ny=(y+0.5-best[1])
        lit=-(nx*0.7+ny*0.7)/max(0.5,r0)
        t=int(round(3.6+lit*1.6))
        T(c,x,y,mat,max(2,min(6,t)))

def _leg(c,x,y0,y1,far=False):
    bias=-0.22 if far else 0.0
    c.cylinder(x,y0,y0+6,2.6,'camel',cap=False,amb=0.12,bias=bias)
    c.cylinder(x+0.3,y0+6,y1-1,1.7,'camel',cap=False,amb=0.12,bias=bias)
    for xx in range(int(x-2),int(x+3)):
        T(c,xx,y1-1,'camel',1 if far else 2); T(c,xx,y1,'camel',0 if False else 1)

def camel(pose=0,seed=1):
    W,H=52,42; c=C(W,H,seed); c.shadow(26,H-4.5,18,2.6,95)
    if pose==0:      # 서 있음
        for x in (11,29): _leg(c,x,24,H-6,far=True)
        c.ellipsoid(23,21,14,6.6,'camel',bias=0.0,bump=0.25,bsc=3)
        c.ellipsoid(17,15,4.6,4.8,'camel',bias=0.05)                   # 혹
        for x in (15,33): _leg(c,x,24,H-6)
        _neck(c,[(33,18),(36,14),(38,10.5),(40,8)],3.2,2.4)
        c.ellipsoid(43,7,4.4,2.6,'camel',bias=0.05)                      # 머리
        c.ellipsoid(46,8,2.6,2.0,'camel')                                # 주둥이
        T(c,43,6,'camel',0); T(c,40,4,'camel',2); T(c,41,4,'camel',3)    # 눈, 귀
        for y in range(19,27): T(c,9,y,'camel',2 if y>21 else 3)
        T(c,9,27,'camel',1); T(c,8,27,'camel',1)
        c.new()
        for y in range(19,25):                                          # 안장 깔개
            for x in range(17,29):
                if c.m[y][x] and y>=19: T(c,x,y,'rugred' if (x//2)%2==0 else 'rugblue',4 if y<23 else 2)
    else:            # 웅크림
        c.ellipsoid(22,27,15,6.0,'camel',bump=0.25,bsc=3)
        c.ellipsoid(17,20.5,4.6,4.8,'camel',bias=0.05)
        _neck(c,[(33,25),(36,21),(38,16),(40,12)],3.2,2.4)
        c.ellipsoid(43,10,4.4,2.6,'camel',bias=0.05); c.ellipsoid(46,11,2.6,2.0,'camel')
        T(c,43,9,'camel',0); T(c,40,7,'camel',2); T(c,41,7,'camel',3)
        c.ellipsoid(12,33,6.5,2.4,'camel',bias=-0.12); c.ellipsoid(32,33,6.5,2.4,'camel',bias=-0.06)
        for y in range(25,31): T(c,8,y,'camel',2)
        for y in range(24,29):
            for x in range(16,28):
                if c.m[y][x] and y>=24: T(c,x,y,'rugred' if (x//2)%2==0 else 'rugblue',4 if y<28 else 2)
    return fin(c)

# ---- 천막·말뚝·우물 …
def nomad_tent(w=48,seed=1,c1='rugred',c2='cream'):
    H=38; c=C(w,H,seed); cx=w/2
    c.shadow(cx,H-3.4,w*0.46,2.0,95)
    for y in range(3,H-4):
        f=(y-3)/(H-7); hw=2+f*(w/2-3)
        for x in range(int(cx-hw),int(cx+hw)+1):
            k=(x-int(cx)+200)//4%2
            lit=(x+0.5-cx)/max(1,hw)
            t=5 if lit<-0.25 else (4 if lit<0.35 else 3)
            T(c,x,y,c1 if k==0 else c2,t-(1 if y>H-9 else 0))
    # 입구(삼각 어둠) + 골조 기둥
    for y in range(H-16,H-4):
        hw=1+(y-(H-16))*0.55
        for x in range(int(cx-hw),int(cx+hw)+1): T(c,x,y,'dark',1 if abs(x-cx)<hw-1 else 2)
    for y in range(0,5): T(c,int(cx),y,'bark',3); T(c,int(cx)+1,y,'bark',2)
    for x in range(int(cx)-1,int(cx)+3): T(c,x,0,'red',5)           # 깃
    for y in range(H-4,H-2):                                        # 밑단 말뚝
        for x in range(2,w-2,7): T(c,x,y,'bark',3)
    return fin(c)

def well(seed=1):
    c=C(40,44,seed); c.shadow(20,40,15,2.6,100)
    c.cylinder(20,24,37,11,'sstone',capry=5.0,amb=0.2)
    for y in range(25,36):
        for x in range(8,33):
            if c.m[y][x] and ((x+(y//4)*3)%8==0 or y%4==0): c.darken(x,y,1)
    c.new()                                                         # 물(안쪽 타원)
    for y in range(20,30):
        for x in range(11,30):
            dx=(x+0.5-20)/8.2; dy=(y+0.5-24)/3.7
            if dx*dx+dy*dy<=1: T(c,x,y,'oasis',1 if dx*dx+dy*dy>0.45 else 2)
    c.new()                                                         # 기둥 + 도르래 가로대
    for y in range(6,28):
        for k in range(2): T(c,9+k,y,'wood',4-k); T(c,30+k,y,'wood',3-k)
    for x in range(8,33): T(c,x,6,'wood',5); T(c,x,7,'wood',3); T(c,x,8,'wood',2)
    for x in range(14,27): T(c,x,4+(1 if x in(14,26) else 0),'sstone',5); 
    for y in range(9,18): T(c,20,y,'rope',4)
    for y in range(18,22):
        for x in range(18,23): T(c,x,y,'wood',4 if y<20 else 2)
    return fin(c)

def hitch_post(n=3,seed=1):
    w=n*16; c=C(w,22,seed); c.shadow(w/2,19.5,w*0.46,1.6,80)
    for i in range(n+1):
        x=min(w-3,i*16+1)
        for y in range(4,19):
            T(c,x,y,'bark',4); T(c,x+1,y,'wood',4 if y%4 else 3); T(c,x+2,y,'bark',2)
    for r in (7,11):
        for x in range(0,w): T(c,x,r,'rope' if r==7 else 'bark',5); T(c,x,r+1,'bark',2)
    return fin(c)

def adobe_wall(n=2,seed=1):
    w=n*16; c=C(w,22,seed); c.shadow(w/2,20,w*0.47,1.4,80)
    c.box(0,5,w,4,11,'sstone',bias=0.02)
    for y in range(9,20):
        for x in range(1,w-1):
            if ((x+(y//4)*5)%10==0 and y%4!=0) or y%4==0: c.darken(x,y,1)
    for x in range(0,w,3): c.lighten(x,5) if hsh(x,1,seed)>0.4 else None
    return fin(c)

def clay_oven(seed=1):
    c=C(28,28,seed); c.shadow(14,25.4,10,1.8,95)
    c.ellipsoid(14,16,10,9.5,'terra',bump=0.3,bsc=2.4,bias=0.03)
    for y in range(17,25):
        for x in range(9,19):
            dx=(x+0.5-14)/4.6; dy=(y+0.5-24)/7.5
            if dx*dx+dy*dy<=1: T(c,x,y,'dark',1)
    for y in range(6,12): T(c,22,y,'terra',3); T(c,23,y,'terra',2)    # 연통
    return fin(c)

def jars(kind=0,seed=1):
    c=C(24,22,seed); c.shadow(12,19.4,9,1.6,90)
    spec=[(7,13,4.2,5.0),(16,14,3.6,4.4)] if kind==0 else [(12,12,5.2,6.6)]
    for x,y,rx,ry in spec:
        c.ellipsoid(x,y,rx,ry,'terra',bias=0.04)
        for xx in range(int(x-2),int(x+2)): T(c,xx,int(y-ry)-1,'terra',3); 
        T(c,int(x)-1,int(y-ry)-2,'terra',4); T(c,int(x),int(y-ry)-2,'terra',4)
        for xx in range(int(x-rx)+1,int(x+rx)): T(c,xx,int(y)-1,'terra',2 if xx>x else 1)
    return fin(c)

def bales(seed=1):
    c=C(32,24,seed); c.shadow(16,21,13,1.6,90)
    c.box(1,9,14,4,9,'thatch'); c.box(15,11,15,4,8,'cloth',bias=0.0); c.box(6,2,14,4,8,'thatch',bias=0.03)
    for x in (4,10): 
        for y in range(9,20): T(c,x,y,'rope',4)
    for x in (9,16):
        for y in range(2,11): T(c,x,y,'rope',4)
    for x in (18,24):
        for y in range(11,20): T(c,x,y,'rope',4)
    return fin(c)

def bones(seed=1):
    c=C(20,10,seed)
    for x in range(3,17): T(c,x,4,'shell',6 if x%4 else 4); T(c,x,5,'shell',3)
    for x in (3,16): T(c,x,3,'shell',6); T(c,x,6,'shell',5)
    c.ellipsoid(7,2.5,2,1.6,'shell') if False else None
    return fin(c)

def rug(kind=0,seed=1):
    c=C(32,20,seed); m='rugred' if kind==0 else 'rugblue'
    for y in range(3,17):
        for x in range(2,30):
            edge=(x in(2,29) or y in(3,16)); mid=abs(x-16)<4 and abs(y-10)<3
            T(c,x,y,m,2 if edge else (6 if mid else (4 if (x+y)%4 else 5) if (x//3+y//3)%2 else 3))
    for x in range(2,30,3): T(c,x,2,'cream',5); T(c,x,17,'cream',5)
    return c.img(False)

def reed_tuft(kind=0,seed=1):
    c=C(18,26,seed); rng=random.Random(seed)
    for i in range(9):
        x0=rng.randint(4,13); h=rng.randint(10,21); lean=rng.choice([-1,0,0,1])
        for j in range(h):
            T(c,x0+int(lean*j/7),24-j,'reed',2+(3 if j>h*0.55 else 0) if not (j==h-1) else 6)
    for x in (6,9,12): 
        for y in range(3,7): T(c,x,y,'wood',3) if kind==1 and False else None
    return fin(c)

def lily_pad(seed=1):
    c=C(14,8,seed)
    for (x,y) in ((3,3),(9,4)):
        for dy in range(-1,2):
            for dx in range(-2,3):
                if abs(dx)+abs(dy)*1.6<=2.6: T(c,x+dx,y+dy,'lily',4 if dx<1 else 3)
    return fin(c)

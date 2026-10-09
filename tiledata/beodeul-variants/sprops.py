# 버들항 변형 3 — 늪 수상 마을 손 도트 소품·땅 (city_v6 의 C 볼륨 페인터 방식)
from vprops import *
import random, math
import dprops  # rugred 등 팔레트 등록

PAL['mossy']=['#0c1a0e','#1c3316','#2f4c1e','#47682a','#688a38','#8eaf4c','#b6d072']      # 이끼
GRAIN.update({'mossy':(0.22,1.5)})

# ================= 땅 =================
def deck_painter(s_,k,m,PX,PY):
    """널판 바닥: 동서로 누운 널 4화소 폭, 널마다 명도가 다르고 이음매가 엇갈린다."""
    X=PX.astype(int); Y=PY.astype(int); r=Y//4; ry=Y%4
    off=(hsh(r,0,51)*23).astype(int); xo=X+off
    joint=(xo%22==0)
    plank=3.6+(hsh(r,1,52)-0.5)*1.6+(hsh(xo//22,r,53)-0.5)*0.9+(hsh(X,Y,54)-0.5)*0.35
    t=np.where(ry==0,plank+0.9,np.where(ry==3,1.0,plank))
    t=np.where(joint&(ry<3),2.0,t)
    nail=((xo%22==2)|(xo%22==20))&(ry==1)&(hsh(r,xo//22,55)>0.5)
    t=np.where(nail,plank-1.4,t)
    t=np.clip(np.rint(t),1,6).astype(np.int8)
    return palarr('deck')[t],t

def pile_painter(s_,k,m,PX,PY):
    """널판 바닥 앞면(3/4 의 앞면): 윗줄 가장자리 널 + 그 아래 검은 물에 박힌 말뚝."""
    X=PX.astype(int); Y=PY.astype(int); ry=Y%16; col=X//16; xl=X%16
    water=np.clip(1.6+vn(PX,PY*2.5,5.0,77)*1.6+(hsh(X,Y,78)-0.5)*0.5,1,4)
    wt=np.where((hsh(X//2,Y//3,79)>0.9)&(ry>6),water+1.6,water)
    wt=np.clip(np.rint(wt),1,5).astype(np.int8)
    rgb=palarr('murk')[wt].copy()
    # 가장자리 널(아랫면): 윗줄이 밝고 아래로 어두워진다
    fas=np.select([ry==0,ry==1,ry==2,ry==3],[4,3,2,1],default=0)
    rgb=np.where((fas>0)[...,None],palarr('deck')[np.clip(fas,0,6)],rgb)
    # 말뚝: 타일 열마다 위치가 다르고 일부 열은 없다
    has=hsh(col,0,81)>0.38
    cx=(3+(hsh(col,0,82)*9)).astype(int)
    dx=xl-cx
    post=has&(dx>=0)&(dx<=2)&(ry>=3)
    pt=np.select([dx==0,dx==1,dx==2],[4,3,2],default=3)
    pt=np.where((ry>=12)&(hsh(col,ry,83)>0.35),pt-1,pt)           # 물에 젖은 밑동
    prgb=palarr('bark')[np.clip(pt,0,6)]
    moss=has&post&(ry>=9)&(ry<=12)&(hsh(col,dx,84)>0.4)
    prgb=np.where(moss[...,None],palarr('mossy')[np.where(dx==0,4,3)],prgb)
    rgb=np.where(post[...,None],prgb,rgb)
    # 말뚝 밑동 물결 고리
    ring=has&(ry==14)&((dx==-1)|(dx==3))
    rgb=np.where(ring[...,None],palarr('murk')[5],rgb)
    t=np.where(post,pt,wt).astype(np.int8)
    return rgb,t

def reedbed_painter(s_,k,m,PX,PY):
    """갈대밭 바닥: 마른 갈대 줄기가 가로로 깔린 갯벌 — 세로 잎 자국이 촘촘하다."""
    X=PX.astype(int); Y=PY.astype(int)
    base=3.0+vn(PX,PY,5.0,91)*1.3+(hsh(X,Y,92)-0.5)*0.5
    blade=(hsh(X,Y//3,93)>0.78)&(hsh(X//2,Y//5,94)>0.4)
    t=np.where(blade,base+1.6,base)
    t=np.where((hsh(X//3,Y//2,95)>0.93),t-1.4,t)
    t=np.clip(np.rint(t),1,6).astype(np.int8)
    return palarr('reed')[t],t

# ================= 소품 =================
def pilings(kind=0,seed=1):
    """물에 박힌 말뚝. 윗면이 보이고 이끼가 끼며 밑동에 물결 고리."""
    W,H=(16,26) if kind==0 else (24,28)
    c=C(W,H,seed)
    posts=[(8,22,5,3)] if kind==0 else [(7,22,6,3),(16,24,1,3)]
    for (cx,by,top,rx) in posts:
        if kind==1 and cx==16: top=11
        c.cylinder(cx,top,by,2.4,'bark',capry=1.3,amb=0.2)
        for y in range(top+3,by-2):
            if hsh(cx,y,seed)>0.72: T(c,cx-2,y,'bark',5);
        for (x,y) in ((cx-2,top+1),(cx-1,top),(cx,top-1),(cx-1,top+1),(cx,top+2)):   # 윗면 이끼
            if hsh(x,y,seed+4)>0.3: T(c,x,y,'mossy',4 if x<cx else 3)
        for x in range(cx-4,cx+5):
            if abs(x-cx)>=3: T(c,x,by+1,'murk',5)
        T(c,cx-3,by+2,'murk',5); T(c,cx+3,by+2,'murk',4)
    return fin(c)

def mangrove(kind=0,seed=1):
    """늪 버드나무/맹그로브: 뿌리가 갈라져 내리고 줄기는 수관 밑동 폭과 같다. 잎은 어두운 이끼 녹색."""
    W,H=(44,62) if kind==0 else (36,50)
    c=C(W,H,seed); cx=W//2; rng=random.Random(seed)
    by=H-5; trw=8 if kind==0 else 6
    c.shadow(cx,H-3,W*0.30,2.2,80)
    # 뿌리 받침(바깥으로 갈라짐)
    for sgn in (-1,1):
        for i in range(9):
            x=cx+sgn*(trw//2+i//2); y=by+1-(1 if i<4 else 0)+min(2,i//4)
            for k in range(2): T(c,x,y-k,'bark',4 if sgn<0 else 2)
    for i in range(6):
        for k in range(3): T(c,cx-1+k+(i%2),by+2-(i//3),'bark',2)
    # 줄기
    top=by-(24 if kind==0 else 18)
    c.cylinder(cx,top,by,trw/2.0,'bark',cap=False,amb=0.2)
    for y in range(top,by,3): T(c,cx-trw//2+1,y,'bark',5); T(c,cx+trw//2-1,y+1,'bark',2)
    for (x,y) in ((cx-2,top+6),(cx-2,top+7),(cx-1,top+12),(cx+1,top+16)): T(c,x,y,'mossy',4)
    # 수관: 밑동이 줄기 폭(+좌우 2)인 세 덩이를 쌓아 올린 위가 넓은 모양
    ct=top+4
    lobes=[(cx,ct-3,trw//2+3,5.0,0.0),(cx-5,ct-10,9,7.0,0.0),(cx+5,ct-11,9,7.5,0.0),(cx,ct-17,11,8.5,0.05)] if kind==0 else \
          [(cx,ct-2,trw//2+3,4.5,0.0),(cx-4,ct-8,7.5,6.0,0.0),(cx+4,ct-9,7.5,6.4,0.0),(cx,ct-14,9,7.0,0.05)]
    for (lx,ly,rx,ry,b) in lobes:
        c.ellipsoid(lx,ly,rx,ry,'pine',bump=0.9,bsc=2.4,bias=b-0.12)
    # 늘어진 덩굴(수관 아래로)
    for i in range(14 if kind==0 else 10):
        x=cx-10+int(rng.random()*20) if kind==0 else cx-8+int(rng.random()*16)
        L=rng.randint(4,11)
        y0=ct+2
        for j in range(L): T(c,x,y0+j,'mossy',5 if j<L-1 else 3) if abs(x-cx)>trw//2+1 or j<2 else None
    return fin(c)

def snag(seed=1):
    """잎 없는 고목: 굵은 밑동, 두 갈래 가지, 이끼, 하얗게 마른 윗면."""
    c=C(36,54,seed); cx=18; by=49
    c.shadow(cx,51.5,10,2.2,80)
    c.cylinder(cx,24,by,3.6,'bark',cap=False,amb=0.2)
    for y in range(26,by,3): T(c,cx-2,y,'bark',5); T(c,cx+2,y+1,'bark',1)
    for k in range(-5,6): T(c,cx+k,by+1,'bark',2 if k>0 else 3)
    for (x,y) in ((cx-2,36),(cx-2,37),(cx-1,42),(cx-3,44)): T(c,x,y,'mossy',4)
    for sgn,(L,hh) in ((-1,(12,12)),(1,(14,17))):
        for i in range(L):
            x=cx+sgn*(2+i*0.8); y=26-(i*hh)/L*0.9-(0 if i<L//2 else (i-L//2)*0.3)
            w=3 if i<L*0.45 else 2
            for k in range(w): T(c,int(x)+k-1,int(y),'bark',4 if k==0 else (3 if k<w-1 else 2))
    for i in range(10): T(c,cx-1+(i%3),24-i//3,'bark',5 if i%3==0 else 3)
    return fin(c)

def fish_rack(seed=1):
    """생선 말림대: 기둥 둘, 윗면이 보이는 가로대 두 줄, 매달린 생선."""
    c=C(40,36,seed); rng=random.Random(seed)
    c.shadow(20,32,15,1.6,70)
    for x0 in (4,33):
        c.group(1); c.box(x0,8,3,3,21,'wood')
    for y0 in (9,19):
        c.group(2); c.box(4,y0,32,3,2,'wood',top=0.98)
        for j in range(5 if y0==9 else 4):
            fx=8+j*6+rng.randint(-1,1)
            for k in range(6 if y0==9 else 5):
                w=2 if k in (0,5) or (y0==19 and k==4) else 3
                for dx in range(w): T(c,fx+dx-(w==3),y0+5+k,'stone',5 if dx==0 else 4) if k%5<4 else T(c,fx+dx-(w==3),y0+5+k,'stone',3)
            T(c,fx,y0+5,'rugred',3); T(c,fx,y0+6+ (0),'stone',2)
    return fin(c)

def crab_trap(seed=1):
    c=C(18,16,seed); c.shadow(9,13.5,6,1.3,80)
    c.ellipsoid(9,8.5,6,5.3,'wood',amb=0.2)
    for x in range(4,15,2):
        for y in range(4,14):
            if c.m[y][x]: T(c,x,y,'wood',1)
    for y in (6,9,12):
        for x in range(3,16):
            if c.m[y][x]: T(c,x,y,'wood',1)
    return fin(c)

def reed_stack(kind=0,seed=1):
    """묶어 세운 마른 갈대 단."""
    c=C(18,28,seed); c.shadow(9,25,6,1.5,80); rng=random.Random(seed)
    for i in range(9):
        x0=4+i*1.1+rng.random()*0.6
        for j in range(21):
            T(c,int(x0)+(1 if j>16 and i>4 else 0),24-j,'thatch',5 if i<4 else (4 if i<7 else 3))
        T(c,int(x0),3,'thatch',6)
    for y in (11,12):
        for x in range(3,15): T(c,x,y,'bark',3 if y==11 else 2)
    return fin(c)

def moss_log(seed=1):
    c=C(34,16,seed); c.shadow(17,13.6,13,1.6,80)
    c.hcyl(3,30,9,3.6,'bark',endcap='L',capmat='cream')
    for x in range(5,29):
        if hsh(x,seed,7)>0.4: T(c,x,6,'mossy',4 if x%3 else 5);
        if hsh(x,seed,8)>0.75: T(c,x,7,'mossy',3)
    return fin(c)

def heron(seed=1):
    """말뚝 위에 선 왜가리(작은 새): 회청색 몸, 긴 목, 노란 부리."""
    c=C(20,30,seed);
    for y in range(22,29): T(c,9,y,'bark',3); T(c,10,y,'bark',2)
    c.ellipsoid(9.5,16,5.4,4.6,'stone',amb=0.25)
    for (x,y) in ((5,14),(4,15),(4,16)): T(c,x,y,'stone',2)
    for y in range(6,13): T(c,12,y,'stone',5 if y%2 else 4)
    T(c,12,5,'stone',5); T(c,13,5,'stone',5); T(c,11,5,'stone',3)
    for x in range(14,18): T(c,x,5 if x<16 else 6,'gold',5)
    T(c,12,4,'iron',1)
    for y in range(20,23): T(c,8,y,'stone',2); T(c,11,y,'stone',2)
    return fin(c)

def lantern_buoy(seed=1):
    """기둥에 매단 기름등(물가에 박은 말뚝 위)."""
    c=C(16,34,seed); c.shadow(8,31,4,1.2,70)
    for y in range(10,30): T(c,7,y,'bark',4); T(c,8,y,'bark',2)
    for x in range(8,14): T(c,x,9,'bark',3); T(c,x,10,'bark',2)
    for y in range(10,14): T(c,13,y,'iron',3)
    c.ellipsoid(13.5,16,2.6,3.4,'flame',amb=0.9)
    for (x,y) in ((12,13),(15,13),(12,19),(15,19)): T(c,x,y,'iron',2)
    for x in range(12,16): T(c,x,12,'iron',3)
    return fin(c)

def duck_pair(seed=1):
    c=C(22,10,seed)
    for (x,y,f) in ((6,6,1),(15,5,-1)):
        c.ellipsoid(x,y,3.6,2.4,'cream',amb=0.4)
        c.ellipsoid(x+f*3,y-2,1.7,1.7,'leaf',amb=0.3)
        T(c,x+f*5,y-2,'gold',5)
        for dx in range(-4,5): T(c,x+dx,y+3,'murk',5)
    return fin(c)

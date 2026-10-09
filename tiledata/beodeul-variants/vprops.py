# 버들항 변형 2 — 손 도트 소품·땅 그리기 (city_v6 의 C 볼륨 페인터와 같은 방식)
from varlib import *
from px2 import vnoise
import random
PAL['packed']=['#30283a','#54485a','#7c6c76','#a09090','#c0b0aa','#dccfca','#efe6e2']    # 밟아 다진 눈길
PAL['flame']=['#3a0c00','#8a2000','#d04a00','#f08a10','#ffc030','#ffe680','#fffbd0']
PAL['deck']=['#1c1008','#33200f','#54341a','#76502a','#946a38','#b48a4c','#d2ac6c']       # 나무 바닥(널)
PAL['cobble']=['#1c2230','#343c4e','#525a6e','#727a8e','#949cae','#b4bccb','#d4dae4']
PAL['hotwater']=['#0c3648','#125870','#1c8090','#38a8a4','#70cdb8','#b0eccc','#e8fff0']
GRAIN.update({'packed':(0.10,2.0),'flame':(0.0,1),'deck':(0.10,1.4),'cobble':(0.12,1.8),'hotwater':(0.03,2)})

def T(c,x,y,mat,t): c.tone(x,y,mat,t)
def fin(c,k=0.62): return pz.fin(c,k)

# ---- 눈 덮기: 완성 그림의 열마다 첫 윤곽 밑 depth 화소를 눈으로
def snowcap(im,depth=2,seed=1,minlum=0.0):
    im=im.copy(); px=im.load(); W,H=im.size
    for x in range(W):
        y=0
        while y<H and px[x,y][3]<200: y+=1
        if y>=H: continue
        d=depth+(1 if hsh(x,seed,seed)>0.6 else 0)-(1 if hsh(x,seed,seed+3)<0.2 else 0)
        for i in range(1,d+1):
            yy=y+i
            if yy>=H or px[x,yy][3]<200: break
            tone=6 if i==1 else (5 if i==2 else 4)
            if (x+i)%5==0 and i==d: tone-=1
            px[x,yy]=hx(PAL['snow'][tone])+(255,)
        # 윤곽 위 한 줄(눈이 윤곽을 살짝 덮는 곳은 6 톤)
        if hsh(x,seed,seed+9)>0.72 and px[x,y][3]>=200: px[x,y]=hx(PAL['snow'][3])+(255,)
    return im

# ---- 눈 덮인 소나무 (가지 층층, 눈은 위·왼쪽 빛받는 곳)
def pine(n=3,seed=1,w=None):
    """n 층 침엽수. 층마다 밑이 넓다. 밑동 줄기 3화소 폭(가장 아래 층 폭의 1/3), 잘리지 않음."""
    w=w or (12+n*6); h=10+n*11+6
    c=C(w,h,seed); cx=w/2.0
    c.shadow(cx,h-2.5,w*0.42,2.2,110)
    # 줄기
    c.new()
    for y in range(h-9,h-2):
        for x in range(int(cx)-1,int(cx)+2): c.tone(x,y,'bark',{0:2,1:3,2:2}.get(x-int(cx)+1,2)) if x==int(cx)-1 else c.tone(x,y,'bark',3 if x==int(cx) else 2)
    tiers=[]
    for i in range(n):
        f=i/(n-1 if n>1 else 1)
        rx=(w*0.46)*(1-0.62*f); ry=5.5-1.2*f; cy=h-11-i*10+ (0 if i else 1)
        tiers.append((cx,cy,rx,ry+3.5))
    for i,(tx,cy,rx,ry) in enumerate(tiers):
        c.new()
        for y in range(int(cy-ry)-1,int(cy+ry)+2):
            for x in range(int(tx-rx)-1,int(tx+rx)+2):
                dx=(x+0.5-tx)/rx; dy=(y+0.5-cy)/ry
                # 아래가 넓은 삼각+타원: 위로 갈수록 좁아짐
                wid=(0.28+0.72*max(0,(dy+1)/2))
                if abs(dx)>wid or dy<-1 or dy>1 or dx*dx+dy*dy*0.55>1.05: continue
                nz=math.sqrt(max(0.05,1-0.5*(dx*dx)-0.4*dy*dy))
                v=c.shade(dx*0.9,dy*0.8,nz,0.16)
                # 아랫단 가장자리 톱니(가지 끝)
                if dy>0.55 and int((x+i*3)%4)==0 and dy>0.75: continue
                snowy=(dy<-0.05+ (vnoise(x,y,2.5,seed+i)-0.5)*0.7 - 0.15*dx) and dy<0.35
                if snowy: c.setv(x,y,'snow',min(1.0,v+0.28))
                else: c.setv(x,y,'pine',v-0.05)
        # 층 아래 그림자 줄
        for x in range(int(tx-rx*0.8),int(tx+rx*0.8)):
            y=int(cy+ry*0.72)
    return c

def boulder(w=24,h=18,seed=1,snow=True):
    c=C(w,h,seed); c.shadow(w/2,h-2.5,w*0.44,2.0,100)
    c.ellipsoid(w/2,h*0.55,w*0.44,h*0.40,'stone',bias=-0.02,bump=0.45,bsc=3.0)
    return c

def firewood(kind=0):
    """장작더미. kind0 = 피라미드 3단(눈 모자), kind1 = 도끼 꽂은 밑동+쪼갠 장작."""
    if kind==0:
        c=pi.woodpile(); im=fin(c); return snowcap(im,2,4)
    c=C(32,20,seed=181); c.shadow(16,17.4,14,1.6)
    c.group(1); c.cylinder(11,8,16,6,'wood',capry=2.6,amb=0.2)
    for xx in (7,9,13,15): T(c,xx,12,'wood',2)
    # 도끼: 자루 + 머리
    c.group(2)
    for i in range(9): T(c,17-i//3+ (0),4+i,'wood',3) if False else None
    for i in range(10): T(c,17+i//5,1+i,'bark',3); T(c,18+i//5,1+i,'wood',5) if i%3 else None
    for dy in range(0,3):
        for dx in range(0,4): T(c,13+dx,1+dy,'iron' if 'iron' in PAL else 'stone',{0:5,1:3,2:2}[dy]) if not (dy==2 and dx==3) else None
    # 쪼갠 장작 두어 개
    c.group(3)
    for (x0,y0) in ((21,13),(25,11),(23,9)):
        c.new()
        for yy in range(y0,y0+4):
            for xx in range(x0,x0+4): c.tone(xx,yy,'wood',5 if (yy==y0 or xx==x0) else 3)
        T(c,x0+1,y0+1,'bark',2); T(c,x0+2,y0+2,'bark',2)
    return snowcap(fin(c),1,9)

def snowman(seed=3):
    c=C(20,26,seed); c.shadow(10,23.4,8,1.6,90)
    c.ellipsoid(10,18,7,6.2,'snow',bias=0.02); c.ellipsoid(10,10.5,5.2,4.6,'snow',bias=0.04); c.ellipsoid(10,4.5,3.6,3.3,'snow',bias=0.06)
    for (x,y) in ((9,3),(12,3)): T(c,x,y,'coal',1)
    T(c,10,5,'wood',4); T(c,11,5,'wood',5)                      # 당근 코
    for x in range(7,14): T(c,x,7,'cloth',4 if x%2 else 3)      # 목도리
    T(c,13,8,'cloth',3); T(c,13,9,'cloth',2); T(c,13,10,'cloth',3)
    for y in (10,13): T(c,10,y,'coal',1)
    # 팔(나뭇가지)
    for i in range(5): T(c,4-i//2,10-i//3+ (i//2),'bark',3); T(c,15+i//2,10-i//3+(i//2),'bark',3)
    return fin(c)

def bonfire(frame=0):
    c=C(28,28,seed=190+frame); c.shadow(14,24.5,11,2.0,110)
    # 돌 고리
    for i in range(9):
        a=i/9*6.283; x=14+math.cos(a)*9; y=21+math.sin(a)*3.4
        c.ellipsoid(x,y,3.0,2.5,'stone',bump=0.3)
    # 장작 엇갈림
    c.new(); c.hcyl(6,22,20,1.9,'wood',endcap=True,capmat='bark') if False else None
    c.hcyl(7,21,20,2.0,'bark',endcap=True,capmat='wood')
    return c

def flame_layer(im,frame=0):
    """모닥불 불꽃을 완성 그림 위에 손 도트로 얹는다(프레임 3)."""
    im=im.copy(); px=im.load(); cx=im.width//2
    rows=[
    "......6......",
    ".....565.....",
    "....56765....",
    "...4567654...",
    "...3456543...",
    "..234565432..",
    "..234555432..",
    "...2344432...",
    ]
    if frame%2: rows=[r[1:]+r[0] if i%3==0 else r for i,r in enumerate(rows)]
    y0=8
    for j,r in enumerate(rows):
        for i,ch in enumerate(r):
            if ch=='.': continue
            x=cx-6+i; y=y0+j+5
            if 0<=x<im.width and 0<=y<im.height: px[x,y]=hx(PAL['flame'][int(ch)-1 if int(ch)>0 else 0])+(255,)
    return im

def steam(frame=0,w=24,h=32,seed=5):
    """온천 김: 반투명 소용돌이 뭉치(불투명 톤 4단 + 알파)."""
    im=Image.new('RGBA',(w,h),(0,0,0,0)); px=im.load()
    for k in range(5):
        cx=w/2+math.sin(k*1.7+frame*0.9)*4.5; cy=h-5-k*5.5; r=3.0+k*0.8
        for y in range(int(cy-r),int(cy+r)+1):
            for x in range(int(cx-r*1.2),int(cx+r*1.2)+1):
                d=math.hypot((x-cx)/1.2,y-cy)/r
                if d<=1 and 0<=x<w and 0<=y<h and hsh(x,y,seed+k)>0.28+0.3*d:
                    t=5 if d<0.55 else 4
                    a=int(170-k*26)
                    px[x,y]=hx(PAL['steam'][t])+(max(a,40),)
    return im

def ice_hole():
    c=C(24,16,seed=3)
    for y in range(4,12):
        for x in range(4,20):
            dx=(x+0.5-12)/8; dy=(y+0.5-8)/4
            r=dx*dx+dy*dy
            if r<=1: T(c,x,y,'ice',0 if r>0.62 else 1) if False else T(c,x,y,'sky',1 if r<0.55 else 2)
    im=c.img(False)
    px=im.load()
    for y in range(3,13):
        for x in range(3,21):
            dx=(x+0.5-12)/9; dy=(y+0.5-8)/5; r=dx*dx+dy*dy
            if 0.72<r<=1.0 and px[x,y][3]==0: px[x,y]=hx(PAL['frost'][5 if (dx<0 or dy<0) else 3])+(255,)
    return im

def stool_rod():
    c=C(16,20,seed=6); c.shadow(8,17,5,1.2,90)
    c.cylinder(6,10,15,3.5,'wood',capry=1.6,amb=0.2)
    for i in range(14): T(c,10+i//2,9-i//2+ (i//5) if False else 12-i,'bark',4) if False else None
    for i in range(12): T(c,9+i//2,9-i//2,'bark',4)
    for i in range(6): T(c,15,3+i,'steam',5) if i<0 else None
    return fin(c)

def sled():
    c=C(30,14,seed=7); c.shadow(15,11.5,12,1.2,80)
    c.box(4,2,22,5,3,'wood',bias=0.0)
    for x in (6,20): 
        for y in range(9,12): T(c,x,y,'bark',3)
    for x in range(3,28): T(c,x,11,'iron' if False else 'stone',5) if x%1==0 else None
    for x in range(3,28): T(c,x,12,'stone',2)
    return fin(c)

def snow_fence(n=3):
    w=n*16; c=C(w,16,seed=8+n)
    for i in range(n+1):
        x=min(w-3,i*16+1)
        for y in range(4,15):
            for xx in range(x,x+3): T(c,xx,y,'wood',3 if xx==x else (2 if xx==x+2 else 4))
    for r in (6,10):
        for x in range(0,w):
            T(c,x,r,'wood',4); T(c,x,r+1,'wood',2)
    return snowcap(fin(c),2,n)

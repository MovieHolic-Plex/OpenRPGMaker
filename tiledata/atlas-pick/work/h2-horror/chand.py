import sys, math; sys.path.insert(0,'tiledata/atlas-pick/work/h2-horror')
from lib import *
S='chandelier_fallen'
TA=lambda t:('tarn',t); MO=lambda t:('moon',t); MU=lambda t:('murk',t); V=lambda t:('void',t); RO=lambda t:('rot',t)

def ring(c,cx,cy,rx,ry,th,dent=0.0,dent_ang=0.6,hi=5,skip=None):
    """찌그러진 타원 고리. 왼쪽 위가 밝다."""
    pts=set()
    for y in range(cy-ry-2,cy+ry+3):
        for x in range(cx-rx-2,cx+rx+3):
            dx=(x-cx)/rx; dy=(y-cy)/ry
            r=math.hypot(dx,dy); a=math.atan2(dy,dx)
            lim=1.0-dent*max(0,math.cos(a-dent_ang))**4
            if lim-th/ry*0.9<=r<=lim:
                if skip and skip(a): continue
                pts.add((x,y))
    for (x,y) in pts:
        dx=(x-cx)/rx; dy=(y-cy)/ry; a=math.atan2(dy,dx)
        lit=-(math.cos(a-2.3))  # 왼쪽 위(각 -0.8+pi)
        # 밝기: 위/왼쪽 = hi
        v=hi - int(round((1+math.cos(a-(-2.36)+math.pi))*0+ (1-max(-1,min(1,math.cos(a-(-2.36)))))*2))
        c.px(x,y,TA(max(1,min(hi,v))))
    # 바깥 테두리 어둡게
    for (x,y) in pts:
        for ddx,ddy in ((1,0),(0,1)):
            if (x+ddx,y+ddy) not in pts: c.px(x,y,TA(1))
    return pts

def chain(c,x0,y0,x1,y1,wob=1):
    y=y0
    i=0
    while y>=y1:
        x=x0+ (wob if (i//2)%2 else 0)*(1 if i%4<2 else 0)
        c.px(x,y,TA(4) if i%2==0 else TA(2)); c.px(x+1,y,TA(1)) if i%2==0 else None
        y-=1; i+=1

def hub(c,cx,cy):
    c.rect(cx-2,cy-1,cx+2,cy+1,TA(3)); c.hl(cx-2,cx+2,cy-1,TA(5)); c.hl(cx-2,cx+2,cy+1,TA(1)); c.px(cx+2,cy,TA(1)); c.px(cx-2,cy,TA(4))
def arm(c,x0,y0,x1,y1):
    c.line(x0,y0,x1,y1,TA(3)); 
def cup(c,x,y):
    c.px(x,y,TA(4)); c.px(x+1,y,TA(2)); c.px(x,y-1,('wax',5)); c.px(x,y-2,('wax',3)) if False else None

def drops(c,pts,hi=5):
    for (x,y,k) in pts:
        if k==0: c.px(x,y,MO(hi))
        elif k==1: c.px(x,y,MO(hi-1)); c.px(x+1,y,MO(2))
        elif k==2: c.px(x,y,MU(5)); c.px(x,y+1,MU(2))
        elif k==3: c.px(x,y,MO(hi)); c.px(x,y+1,MO(3)); c.px(x-1,y+1,MU(3))

def cracks(c,segs,col=None):
    for (a,b,cc,dd) in segs: c.line(a,b,cc,dd,V(1))

CR=[(3,24,1,28),(1,28,2,30),(28,25,31,27),(29,23,31,22),(14,28,15,30),(15,30,13,31),(22,28,24,30)]
DR=[(4,17,0),(9,12,1),(22,10,1),(27,16,0),(6,26,2),(25,28,3),(12,27,0),(19,27,2),(28,21,1),(3,21,3),(17,9,0),(24,24,1)]

# A
c=C(32,32)
cracks(c,CR)
p=ring(c,15,20,11,7,2.1,dent=0.45,dent_ang=0.7)
# 내부: 중심 허브와 팔
hub(c,15,19)
for (x,y) in [(6,20),(24,21),(11,15),(19,26),(10,25)]:
    pass
arm(c,13,19,8,17); arm(c,17,19,22,17); arm(c,13,20,8,24); arm(c,17,20,23,23); arm(c,15,21,15,25)
for (x,y) in [(8,15),(22,15),(8,22),(23,21),(15,25)]:
    cup(c,x,y)
chain(c,15,17,17,0)
c.px(15,0,None)
drops(c,DR)
c.save(S,'h2-A','A: 놋쇠 tarn 고리를 오른쪽 아래에서 눌러 찌그러진 타원으로 만들고 허브에서 다섯 팔·촛대 받침이 뻗는다. 끊어진 사슬이 허브에서 위로 올라가 칸 위 끝까지, 유리 방울(moon/murk)은 둘레에 흩어짐. 바닥엔 void 갈라진 틈 여럿.'); run(S,'h2-A')
# B: 밝음·그림자 강화
c=C(32,32)
cracks(c,CR)
p=ring(c,15,20,11,7,2.1,dent=0.45,dent_ang=0.7,hi=5)
hub(c,15,19)
arm(c,13,19,8,17); arm(c,17,19,22,17); arm(c,13,20,8,24); arm(c,17,20,23,23); arm(c,15,21,15,25)
for (x,y) in [(8,15),(22,15),(8,22),(23,21),(15,25)]: cup(c,x,y)
chain(c,15,17,17,0)
drops(c,DR,hi=5)
# 그림자: 오른쪽 아래로 ~ 를 뿌린다
for (x,y) in list(p):
    for k in (1,2,3):
        xx,yy=x+k,y+k
        if c.get(xx,yy) is None and yy<31: c.px(xx,yy,'~' if k==1 else '-')
for y in range(24,30):
    for x in range(4,28):
        if c.get(x,y) is None and (x+y)%2==0 and y in (28,29): c.px(x,y,'-')
for (x,y,k) in DR: 
    if k in (0,3): c.px(x,y,MO(5)); c.px(x-1,y,MO(5)) if False else None
c.save(S,'h2-B','B: 형태는 A 와 같되 고리 왼쪽 위에 놋쇠 최고광을 몰고 유리 알갱이는 가장 밝은 moon 으로 올렸다. 고리·팔의 오른쪽 아래로 ~/- 그림자가 두 단으로 떨어져 바닥에 박힌 무게가 읽힌다.'); run(S,'h2-B')
# C: 실루엣 재해석 — 고리가 옆으로 눕고 촛대 팔이 뼈처럼 위로 솟은 모양, 사슬은 낫처럼 굽음
c=C(32,32)
cracks(c,CR)
# 옆으로 선 고리(좁은 타원, 가운데가 꺾여 구부러짐)
p=ring(c,13,20,6,10,2.0,dent=0.5,dent_ang=0.2)
hub(c,13,19)
# 뼈 같은 팔
for (x0,y0,x1,y1) in [(13,17,9,9),(13,17,15,8),(13,17,21,12),(13,22,20,25),(13,22,7,28)]:
    c.line(x0,y0,x1,y1,TA(3))
    c.px(x1,y1,TA(5)); c.px(x1+1,y1,TA(2)); c.px(x1,y1-1,('wax',4)); 
# 손가락처럼 갈라진 끝
c.px(8,8,TA(4)); c.px(10,8,TA(4)); c.px(16,7,TA(4)); c.px(14,7,TA(3)); c.px(22,11,TA(3)); c.px(22,13,TA(3))
# 사슬: 낫처럼 굽어 오른쪽 위로
pts=[(14,15),(15,14),(16,13),(17,12),(19,11),(21,9),(23,7),(25,5),(26,3),(26,1)]
for i,(x,y) in enumerate(pts):
    c.px(x,y,TA(4) if i%2==0 else TA(2)); c.px(x+1,y,TA(1))
drops(c,[(22,20,0),(24,22,1),(26,18,3),(19,28,2),(4,24,1),(28,26,0),(3,14,0),(9,29,0),(18,4,2)])
for (x,y) in list(p):
    for k in (1,2):
        if c.get(x+k,y+k) is None and y+k<31: c.px(x+k,y+k,'~' if k==1 else '-')
c.save(S,'h2-C','C: 고리를 옆으로 세워 눌린 갈비뼈처럼 만들고, 촛대 팔이 뼈 손가락처럼 위로 뻗어 갈라진다. 끊어진 사슬은 낫처럼 굽어 오른쪽 위로 사라짐. 유리 방울은 A 와 같은 moon/murk, 바닥 틈 void.'); run(S,'h2-C')

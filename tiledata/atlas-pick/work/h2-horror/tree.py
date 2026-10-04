import sys, random, math; sys.path.insert(0,'tiledata/atlas-pick/work/h2-horror')
from lib import *
S='dead_tree'
RT=lambda t:('rot',t); SO=lambda t:('soil',t); V=lambda t:('void',t); PA=lambda t:('paper',t); DU=lambda t:('dust',t)
LX,LY=-0.7071,-0.7071
class Body:
    def __init__(s): s.m={}
    def stroke(s, pts, hi=5):
        """pts=[(x,y,r),...] 부드럽게 이어진 선분들. m[(x,y)] = u(-1..1, +는 빛 쪽)"""
        for (x0,y0,r0),(x1,y1,r1) in zip(pts,pts[1:]):
            dx,dy=x1-x0,y1-y0; L=math.hypot(dx,dy) or 1
            px_,py_=-dy/L,dx/L
            if px_*LX+py_*LY<0: px_,py_=-px_,-py_
            R=max(r0,r1)+1
            for y in range(int(min(y0,y1)-R),int(max(y0,y1)+R)+2):
                for x in range(int(min(x0,x1)-R),int(max(x0,x1)+R)+2):
                    t=((x-x0)*dx+(y-y0)*dy)/(L*L); t=max(0,min(1,t))
                    qx,qy=x0+dx*t,y0+dy*t
                    r=r0+(r1-r0)*t
                    d=math.hypot(x-qx,y-qy)
                    if d<=r+0.01:
                        side=((x-qx)*px_+(y-qy)*py_)
                        u=(side/r) if r>0 else 0
                        s.m[(x,y)]=u
    def paint(s, c, rnd, hi=5, lo=2, mid=3, speck=0.08, lit_extra=None):
        for (x,y),u in s.m.items():
            if u>0.45: t=hi
            elif u>-0.05: t=hi-1
            elif u>-0.55: t=mid
            else: t=lo
            if rnd.random()<speck: t=max(1,t-1) if rnd.random()<0.7 else min(6,t+1)
            c.px(x,y,RT(t))
def twig(body, pts): 
    for x,y in pts: body.m[(x,y)]=0.3
def finger(c, x0,y0,x1,y1, t=3):
    c.line(x0,y0,x1,y1,RT(t))

def build(seed, kind):
    rnd=random.Random(seed)
    c=C(48,48); b=Body()
    # 뿌리
    b.stroke([(24,44,4.2),(24,47,5.2)])
    b.stroke([(21,45,2),(15,46.5,1.2),(10,47,0.8)])
    b.stroke([(27,45,2),(33,46.5,1.2),(38,47,0.8)])
    b.stroke([(22,46,1.5),(19,47,1)])
    # 줄기: 비틀림
    b.stroke([(24,44,4.0),(22.5,38,3.6),(24.5,32,3.2),(23,27,2.9)])
    # 갈래 세 개
    b.stroke([(23,28,2.6),(18,22,2.2),(12,17,1.7),(7,10,1.2)])            # 왼
    b.stroke([(24,28,2.6),(28,21,2.1),(34,16,1.6),(40,9,1.1)])            # 오른
    b.stroke([(23.5,27,2.2),(24,20,1.9),(22,13,1.5),(24,4,1.0)])          # 가운데
    # 곁가지
    b.stroke([(17,21,1.4),(12,24,1.1),(6,24,0.8)])
    b.stroke([(30,19,1.3),(36,22,1.0),(42,21,0.7)])
    b.stroke([(10,14,1.0),(5,15,0.7)])
    b.stroke([(35,15,1.0),(38,10,0.7),(37,4,0.5)])
    b.stroke([(22,14,1.0),(17,10,0.8),(15,5,0.5)])
    return rnd,c,b

def finish(c,rnd,b,hi=5,lo=2,mid=3,speck=0.1,outline=True):
    b.paint(c,rnd,hi=hi,lo=lo,mid=mid,speck=speck)
    if outline: c.outline(lambda n,k: RT(1 if k=='ul' else 0))

def knot(c, x,y, rx=1.4, ry=2.2):
    for yy in range(int(y-ry-1),int(y+ry+2)):
        for xx in range(int(x-rx-1),int(x+rx+2)):
            d=((xx-x)/rx)**2+((yy-y)/ry)**2
            if d<=1.0: c.px(xx,yy,V(1 if d<0.55 else 2))
            elif d<=1.7: c.px(xx,yy,RT(1))
    c.px(int(x+1),int(y+ry+1),RT(5)); c.px(int(x),int(y+ry+1),RT(4))

def fingertips(c, ends, rnd, t=3):
    for (x,y,dx,dy) in ends:
        # 가지 끝이 2px 이상일 때만 1px 손가락
        for k in range(1,3):
            xx,yy=x+dx*k,y+dy*k
            if c.get(xx,yy) is None: c.px(xx,yy,RT(t))
            else: break

# A
rnd,c,b=build(4,'A'); finish(c,rnd,b)
knot(c,23.5,36,1.3,2.0)
fingertips(c,[(7,10,-1,-1),(40,9,1,-1),(24,4,0,-1),(6,24,-1,0),(42,21,1,0),(5,15,-1,0),(37,4,0,-1)],rnd)
# 뿌리 부근 흙 그림자
for x in range(28,41):
    if c.get(x,47) is None: c.px(x,47,'~')
c.save(S,'h2-A','A: v5식 낡은 마감. 굵은 줄기가 아래 가운데에서 올라와 왼·가운데·오른 세 갈래로 벌어지고, 곁가지 넷, 가지 끝은 굵기 2px 대에서 1px 손가락으로 마무리. 줄기 왼쪽 밝게·오른쪽 어둡게(rot 2~5), 옹이 구멍 하나(void), 뿌리 다섯 가닥, 발치 ~ 그림자.'); run(S,'h2-A')

# B: 명암 강화
rnd,c,b=build(9,'B'); finish(c,rnd,b,hi=6,lo=1,mid=3,speck=0.14)
knot(c,23.5,36,1.5,2.4)
# 갈라진 껍질 골(void 한 줄)
for (x,y) in [(22,41),(22,42),(23,43),(26,40),(26,41),(25,42)]:
    if c.get(x,y): c.px(x,y,RT(0))
fingertips(c,[(7,10,-1,-1),(40,9,1,-1),(24,4,0,-1),(6,24,-1,0),(42,21,1,0),(5,15,-1,0),(37,4,0,-1)],rnd,t=4)
# 그림자: 나무 발치에서 오른쪽 아래로 길게
for y in (45,46,47):
    for x in range(25 if y<47 else 20, 45 if y==47 else 41):
        if c.get(x,y) is None: c.px(x,y,'~' if y==47 or x>33 else '-')
# 달빛이 줄기 왼쪽 위에 스치는 점
for (x,y) in [(21,33),(22,30),(20,24),(14,20),(26,22)]:
    g=c.get(x,y)
    if g and g[0]=='rot': c.px(x,y,RT(6))
c.save(S,'h2-B','B: 형태는 A 와 같되 명암 폭을 넓혔다. 달빛 쪽 rot 6 하이라이트·그림자 쪽 rot 1, 껍질 골(rot 0), 옹이 구멍 크게. 발치에서 오른쪽 아래로 길게 - / ~ 그림자를 깔았다.'); run(S,'h2-B')

# C: 얼굴 줄기 + 팔 같은 가지 + 끊어진 밧줄
rnd=random.Random(15); c=C(48,48); b=Body()
b.stroke([(24,44,4.6),(24,47,5.6)])
b.stroke([(20,45,2.2),(13,46.5,1.3),(7,47,0.8)])
b.stroke([(28,45,2.2),(34,46.5,1.3),(41,47,0.8)])
b.stroke([(24,44,4.4),(24,36,4.4),(24,28,4.0)])   # 굵고 곧은 몸통(얼굴 자리)
# 어깨에서 위로 뻗은 팔 둘(휘어 손가락 다섯)
b.stroke([(21,28,2.6),(15,23,2.2),(10,17,1.8),(9,10,1.3)])
b.stroke([(27,28,2.6),(33,22,2.2),(38,15,1.8),(37,8,1.3)])
# 손가락 다섯씩
for (bx,by,side) in [(9,10,-1),(37,8,1)]:
    for i,(ddx,ddy) in enumerate([(-3,-4),(-1,-6),(1,-6),(3,-5),(4,-2)]):
        ex,ey=bx+ddx*(1 if side>0 else 1),by+ddy
        b.stroke([(bx,by,1.1),(bx+ddx*0.5,by+ddy*0.6,0.8),(ex,ey,0.5)])
# 가운데 짧은 그루터기 가지 (밧줄용)
b.stroke([(24,28,2.4),(24,21,1.9),(22,15,1.4),(24,9,1.1)])
b.stroke([(23,14,1.2),(15,13,0.9),(12,11,0.6)])   # 밧줄 가지
finish(c,rnd,b,hi=5,lo=2,mid=3,speck=0.1)
# 얼굴: 눈 둘(긴 void 틈 + 흰 점), 입 (세로로 벌어진 옹이)
for (ex,ey) in [(21,31),(27,31)]:
    c.rect(ex-1,ey,ex+1,ey+1,V(1)); c.px(ex,ey-1,RT(1)); c.px(ex-2,ey+1,RT(1)) if False else None
    c.px(ex,ey,PA(6))   # 눈빛
# 입
for yy in range(36,43):
    w=1 if yy in (36,42) else (2 if yy in (37,41) else 3)
    for xx in range(24-w,24+w+1): c.px(xx,yy,V(0 if yy in (38,39,40) else 1))
c.px(22,36,RT(1)); c.px(26,36,RT(1))
# 이빨처럼 삐죽한 껍질 두 개
c.px(23,37,RT(4)); c.px(25,41,RT(4))
# 밧줄: 왼쪽 가지 끝에서 늘어진 끊어진 밧줄(올가미 고리 + 풀린 끝)
rx0,ry0=13,12
for k in range(0,12):
    c.px(rx0-(k//5),ry0+1+k,PA(4 if k%2 else 3))
c.px(rx0-2,ry0+13,PA(3)); c.px(rx0-3,ry0+14,PA(2)); c.px(rx0-1,ry0+13,PA(4))
# 올가미 고리
for (x,y) in [(rx0-2,ry0+10),(rx0-4,ry0+11),(rx0-5,ry0+12),(rx0-4,ry0+14),(rx0-2,ry0+15),(rx0-1,ry0+14)]:
    pass
# 풀린 올
for (x,y) in [(rx0-3,ry0+15),(rx0-2,ry0+16),(rx0-4,ry0+16),(rx0-3,ry0+17)]: c.px(x,y,PA(2))
for x in range(28,41):
    if c.get(x,47) is None: c.px(x,47,'~')
c.save(S,'h2-C','C: 실루엣을 사람으로 다시 읽게 했다. 굵은 몸통에 긴 눈 틈 둘(흰 눈빛)과 벌어진 입 옹이, 어깨에서 갈라진 두 팔이 위로 뻗어 손가락 다섯씩으로 끝나고, 왼쪽 가지에는 올가미 밧줄이 늘어져 끝이 풀려 끊어졌다. 뿌리 셋.'); run(S,'h2-C')

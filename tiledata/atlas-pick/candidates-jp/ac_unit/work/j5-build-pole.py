import sys; sys.path.insert(0,'/home/main/.t3/worktrees/rpg-zzu/t3code-8b4b09de-jp-pick/tiledata/atlas-pick/candidates-jp/ac_unit/work')
from j5lib import *
P=lambda t:('pole',t); M=lambda t:('mmetal',t); W=lambda t:('mwhite',t); Y=lambda t:('myellow',t); L=lambda t:('lacq',t); KB=lambda t:('kblue',t)
def rng(y,taper=True):
    if y<24: return (6,9)
    if y<56: return (5,10)
    return (5,10) if y<59 else (4,11)
def shaft(c,y0,y1,hi=5,two=False):
    for y in range(y0,y1):
        a,b=rng(y); w=b-a+1
        cols=[[P(hi),P(3),P(2),P(1)], [P(hi),P(4),P(4),P(3),P(2),P(1)], [P(hi),P(4),P(4),P(3),P(3),P(2),P(1),P(0)][:w]][0 if w==4 else 1 if w==6 else 2]
        if w==8: cols=[P(hi),P(4),P(4),P(4),P(3),P(2),P(1),P(0)]
        for i,x in enumerate(range(a,b+1)): c.put(x,y,cols[i])
def ins(c,x,y,b=False):
    c.rect(x,y,2,3,W(4)); c.hl(x,y,2,W(5)); c.put(x+1,y+1,W(3)); c.hl(x,y+2,2,W(2))
    if b: c.put(x,y,W(5)); c.put(x+1,y,W(4))
def arm(c,x0,x1,y,hi=6,h=2):
    c.hl(x0,y,x1-x0+1,M(hi)); 
    for k in range(1,h): c.hl(x0,y+k,x1-x0+1,M(3))
    c.hl(x0,y+h-1,x1-x0+1,M(2)); c.put(x1,y,M(4)); c.put(x1,y+h-1,M(1))
def band(c,y0,y1,shadeR=True):
    for y in range(y0,y1):
        a,b=rng(y)
        for x in range(a,b+1):
            s=((x+y)//2)%2
            col=Y(3) if s==0 else L(1)
            if x==a: col=Y(4) if s==0 else L(3)
            if x==b: col=Y(1) if s==0 else L(0)
            if x==b-1 and shadeR: col=Y(2) if s==0 else L(0)
            c.put(x,y,col)
def plate(c,x,y):
    c.rect(x,y,4,5,KB(3)); c.hl(x,y,4,KB(4)); c.hl(x,y+4,4,KB(1)); c.vl(x+3,y,5,KB(2)); c.vl(x,y,5,KB(4))
    c.put(x,y,KB(5)); c.hl(x+1,y+2,2,W(5))
def trans(c,x,y,h,cols=(7,5,4,3,2,1),wd=6):
    for i in range(wd):
        c.vl(x+i,y,h,M(cols[i]))
    c.hl(x,y,wd,M(7)); c.hl(x,y+1,wd,M(6)); c.put(x,y,M(6))
    c.hl(x,y+h-1,wd,M(1))
    c.hl(x,y+h-2,wd,M(2))
    c.hl(x-1,y+3,1,M(3)); c.hl(x-1,y+h-4,1,M(3))
    c.hl(x+1,y+5,wd-2,M(3)); c.hl(x+1,y+6,wd-2,M(4)) if False else None
def base(c,wide):
    c.hl(3,62,10,P(3)); c.hl(3,63,10,P(1)); c.put(3,62,P(4)); c.put(12,62,P(2)); c.put(12,63,P(0))
# ---------------- A
c=C(16,64)
shaft(c,3,62)
c.hl(6,2,4,P(4)); c.put(9,2,P(2)); c.put(6,2,P(5))
arm(c,1,14,8,6,2)
for x in (1,4,10,13): ins(c,x,5)
arm(c,3,12,15,6,2)
for x in (3,11): ins(c,x,12)
ins(c,10,19); ins(c,13,19)
trans(c,9,22,14)
c.hl(8,25,1,M(3)); c.hl(8,33,1,M(3))
plate(c,6,40)
band(c,48,56)
base(c,True)
finish(c,'utility_pole','A',"강남 정면 시점: 회색 4→6→8칸 테이퍼 기둥(왼쪽 밝고 오른쪽 어둡게), 가로대 2단+흰 애자 6개, 오른쪽 원통 변압기, 파란 주소판, 노랑·검정 사선 반사띠")
# ---------------- B : 조명 강화
c=C(16,64)
shaft(c,3,62,hi=5)
for y in range(3,62):
    a,b=rng(y); c.put(a,y,P(5)); c.put(a+1,y,P(5) if y%9 else P(4))
c.hl(6,1,4,P(5)); c.hl(6,2,4,P(4)); c.put(9,2,P(2))
arm(c,1,14,8,7,3)
for x in (1,4,10,13): ins(c,x,5,True)
c.hl(1,11,14,'~')
c.hl(4,12,9,'-')
arm(c,3,12,15,7,3)
for x in (3,11): ins(c,x,12,True)
ins(c,10,19,True); ins(c,13,19,True)
trans(c,9,22,14,(7,6,5,3,2,0))
c.hl(9,36,6,'~'); c.hl(10,37,6,'-')
plate(c,6,40)
band(c,48,56)
# 기둥 오른쪽 그늘 강조, 바닥 접지 그림자
for y in range(3,62):
    a,b=rng(y); c.put(b,y,P(1)); c.put(b-1,y,P(3)); c.put(a+2,y,P(4)) if b-a>=5 else None
c.hl(3,62,10,P(2)); c.hl(3,63,10,P(0)); c.put(3,62,P(4)); c.put(4,62,P(3))
c.hl(12,61,4,'~'); c.hl(13,62,3,'~'); c.hl(13,63,3,'-')
finish(c,'utility_pole','B',"빛·그림자 강화: 기둥 왼쪽 2칸 밝은 띠, 오른쪽 끝 가장 어둡게, 가로대 3줄 두께(윗면 밝음)+아래 반투명 그림자, 변압기 왼쪽 밝고 오른쪽 검게, 밑동 오른쪽으로 접지 그림자")
# ---------------- C : 실루엣 재해석
c=C(16,64)
# 가는 기둥 + 큰 십자 가로대 + 변압기 통 3개 + 전선 늘어짐
for y in range(3,62):
    a,b=(7,9) if y<40 else (6,9)
    cols=[P(5),P(3),P(1)] if b-a==2 else [P(5),P(4),P(3),P(1)]
    for i,x in enumerate(range(a,b+1)): c.put(x,y,cols[i])
c.hl(6,1,4,P(4)); c.hl(7,0,2,P(3))
arm(c,0,15,4,6,3)
for x in (0,3,6,9,12): 
    if x!=6 and x!=9: ins(c,x,1)
ins(c,7,1) if False else None
arm(c,2,13,11,6,2)
# 늘어진 전선(가는 1px, 검은 먹색)
for x,y in ((0,7),(1,8),(2,9),(3,10),(12,10),(13,9),(14,8),(15,7)): c.put(x,y,('sumi',1))
# 변압기 3통 (작은 원통), 가로대 밑에 매달림
for i,x in enumerate((1,6,11)):
    c.vl(x,17,9,M(6)); c.vl(x+1,17,9,M(5)); c.vl(x+2,17,9,M(3)); c.vl(x+3,17,9,M(1))
    c.hl(x,17,4,M(7)); c.hl(x,25,4,M(1)); c.hl(x+1,16,2,M(4))
    c.hl(x,20,4,M(2)); c.hl(x+1,20,1,M(4))
c.hl(1,14,14,P(2))
# 노랑 검정 띠 굵게
for y in range(44,52):
    for x in range(6,10):
        s=((x+y)//2)%2
        c.put(x,y,Y(3) if s==0 else L(1))
    c.put(9,y,Y(1) if ((9+y)//2)%2==0 else L(0))
plate(c,5,34)
c.hl(4,62,8,P(2)); c.hl(4,63,8,P(0))
c.hl(10,62,4,'~'); c.hl(10,63,5,'-')
finish(c,'utility_pole','C',"실루엣 재해석: 가는 기둥+양끝까지 뻗은 긴 가로대, 아래에 원통 변압기 3통 나란히, 양쪽으로 늘어진 전선 — 멀리서도 '전신주'로 읽히는 윤곽")
sheet('utility_pole',8)

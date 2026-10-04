import sys, math; sys.path.insert(0,'/home/main/.t3/worktrees/rpg-zzu/t3code-8b4b09de-jp-pick/tiledata/atlas-pick/candidates-jp/ac_unit/work')
from j5lib import *
Bl=lambda t:('mblue',t); Mt=lambda t:('mmetal',t); Lq=lambda t:('lacq',t); Wt=lambda t:('mwhite',t); Gn=lambda t:('mgreen',t); Rd=lambda t:('mred',t); Wd=lambda t:('mwood',t)
def line(c,x0,y0,x1,y1,col):
    dx=abs(x1-x0); dy=-abs(y1-y0); sx=1 if x0<x1 else -1; sy=1 if y0<y1 else -1; e=dx+dy
    while True:
        c.put(x0,y0,col)
        if x0==x1 and y0==y1: break
        e2=2*e
        if e2>=dy: e+=dy; x0+=sx
        if e2<=dx: e+=dx; y0+=sy
def wheel(c,cx,cy,r,tire,hi,spoke,hub,rim=None):
    for y in range(cy-r-1,cy+r+2):
        for x in range(cx-r-1,cx+r+2):
            d=math.hypot(x-cx,y-cy)
            if r-1.0<=d<=r+0.45:
                c.put(x,y,hi if (x-cx)+(y-cy)<-r*0.6 else tire)
            elif rim and r-2.0<=d<r-1.0: c.put(x,y,rim)
    for k in range(4):
        a=k*math.pi/4
        for t in range(1,r-1):
            c.put(round(cx+t*math.cos(a)),round(cy+t*math.sin(a)),spoke)
            c.put(round(cx-t*math.cos(a)),round(cy-t*math.sin(a)),spoke)
    c.put(cx,cy,hub); c.put(cx+1,cy,hub) if False else None
def basket(c,x,y,w,h,fr,dk,hi):
    c.rect(x,y,w,h,None)
    c.hl(x,y,w,hi); c.hl(x,y+h-1,w,dk); c.vl(x,y,h,fr); c.vl(x+w-1,y,h,dk)
    for i in range(x+2,x+w-1,2):
        c.vl(i,y+1,h-2,fr)
    for j in range(y+2,y+h-1,2): c.hl(x+1,j,w-2,dk)
# ------------------ A
c=C(32,16)
R=(7,10); F=(25,10); BB=(15,11)
wheel(c,R[0],R[1],5,Lq(2),Lq(4),Mt(3),Mt(6),Mt(5)); wheel(c,F[0],F[1],5,Lq(2),Lq(4),Mt(3),Mt(6),Mt(5))
# fender arcs
for (cx,rgt) in ((7,False),(25,True)):
    for x in range(cx-5,cx+6):
        d=(5.6**2-(x-cx)**2)
        if d>0: c.put(x,round(10-math.sqrt(d)),Bl(5) if x<cx else Bl(3))
# frame
line(c,7,10,15,11,Bl(4)); line(c,7,9,12,5,Bl(4)); line(c,15,11,12,5,Bl(5)); line(c,15,10,22,5,Bl(4)); line(c,16,11,22,6,Bl(3))
line(c,22,4,24,10,Mt(5)); line(c,23,4,25,10,Mt(3))
# seat & post
c.hl(10,3,5,Lq(3)); c.hl(10,4,4,Lq(1)); c.put(9,3,Lq(4)); c.vl(12,4,2,Mt(5))
# rack rear
c.hl(0,5,6,Mt(5)); c.hl(0,6,1,Mt(3)); c.hl(1,6,5,Mt(2)) if False else None
line(c,5,5,7,8,Mt(3))
# handlebar
c.hl(20,2,4,Mt(6)); c.put(20,3,Lq(2)); c.put(21,2,Lq(3)); c.vl(22,3,2,Mt(4))
# basket
basket(c,25,0,7,5,Mt(5),Mt(2),Mt(7))
# pedal & crank, chain guard
c.rect(13,11,4,2,Bl(1)); c.put(14,12,Mt(6)); c.hl(15,13,2,Lq(2))
# kickstand
line(c,10,13,12,15,Mt(2))
# hubs
finish(c,'mamachari','A',"강남 옆모습: 낮은 U 프레임(하늘색)·안장·앞 바구니(철망)·뒤 짐받이·양 바퀴 흙받이, 바퀴 안은 뚫려 뒤가 비침")
# ------------------ B  빛 강화
c=C(32,16)
wheel(c,R[0],R[1],5,Lq(1),Lq(5),Mt(4),Mt(7),Mt(5)); wheel(c,F[0],F[1],5,Lq(1),Lq(5),Mt(4),Mt(7),Mt(5))
for cx in (7,25):
    for x in range(cx-5,cx+6):
        d=(5.7**2-(x-cx)**2)
        if d>0:
            y=round(10-math.sqrt(d)); c.put(x,y,Bl(5) if x<cx else Bl(2)); 
            if x<=cx: c.put(x,y+1,Bl(3)) if False else None
line(c,7,10,15,11,Bl(4)); line(c,7,11,15,12,Bl(1)) if False else None
line(c,7,9,12,5,Bl(4)); line(c,8,9,13,5,Bl(2))
line(c,15,11,12,5,Bl(5)); line(c,16,11,13,5,Bl(2))
line(c,15,10,22,5,Bl(5)); line(c,16,11,22,6,Bl(1)); line(c,16,10,23,5,Bl(3)) if False else None
line(c,22,4,24,10,Mt(7)); line(c,23,4,25,10,Mt(3))
c.hl(10,3,5,Lq(5)); c.hl(10,4,5,Lq(2)); c.put(9,3,Lq(6)); c.hl(11,5,2,Lq(0)); c.vl(12,5,1,Mt(6))
c.hl(0,5,6,Mt(7)); c.hl(0,6,6,Mt(2)); line(c,5,6,7,8,Mt(3))
c.hl(20,2,4,Mt(7)); c.put(20,3,Lq(3)); c.put(21,2,Lq(5)); c.vl(22,3,2,Mt(5))
basket(c,25,0,7,5,Mt(6),Mt(1),Mt(7))
c.rect(13,11,4,2,Bl(0)); c.put(14,12,Mt(7)); c.hl(15,13,2,Lq(1))
line(c,10,13,12,15,Mt(2))
# 접지 그림자 (바퀴 밑 반투명)
c.hl(1,15,11,'-') if False else None
for x in range(2,13):
    if c.g[15][x] is None: c.put(x,15,'~')
for x in range(20,31):
    if c.g[15][x] is None: c.put(x,15,'~')
finish(c,'mamachari','B',"빛 강화: 프레임 윗면 하이라이트(왼쪽 위)+아랫면 어둡게, 바퀴 왼쪽 위 밝게, 바구니 윗줄 흰빛, 바퀴 밑 접지 그림자 반투명 띠")
# ------------------ C  재해석: 큰 바퀴·짐 실은 바구니(대파)
c=C(32,16)
R=(6,9); F=(25,9)
wheel(c,R[0],R[1],6,Lq(2),Lq(4),Mt(3),Mt(6),Mt(5)); wheel(c,F[0],F[1],6,Lq(2),Lq(4),Mt(3),Mt(6),Mt(5))
line(c,6,9,14,11,Rd(3)); line(c,6,8,11,4,Rd(3)); line(c,14,11,11,4,Rd(4)); line(c,14,10,21,5,Rd(3)); line(c,15,11,21,6,Rd(1))
line(c,21,4,25,9,Mt(6))
c.hl(9,3,5,Lq(3)); c.hl(9,4,4,Lq(1))
c.hl(0,4,5,Mt(5)); line(c,4,5,6,7,Mt(3))
c.hl(19,1,4,Mt(6)); c.put(19,2,Lq(2))
# 큰 바구니 + 대파 두 줄기 + 흰 봉지
c.rect(23,4,8,1,None)
basket(c,23,3,9,5,Mt(5),Mt(2),Mt(7))
for x in (25,28):
    c.vl(x,0,3,Gn(3)); c.put(x,0,Gn(4)); c.put(x+1,1,Gn(2)); c.vl(x,2,2,Wt(3)) if False else None
c.hl(24,2,7,Wt(3)); c.hl(24,3,7,Wt(4)) if False else None
c.rect(13,11,3,2,Rd(1)); c.put(14,12,Mt(6))
line(c,9,14,11,15,Mt(2))
finish(c,'mamachari','C',"재해석: 바퀴를 크게(지름 13)·프레임 빨강·앞 바구니에 대파와 흰 봉지를 삐죽 — 실루엣만으로 '장보는 자전거'")
sheet('mamachari',10)

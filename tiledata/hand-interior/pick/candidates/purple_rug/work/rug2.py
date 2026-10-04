from rug import LG, diamond
from w6lib import emit, Cv
def fringe(c,strong):
    for x in range(3,29):
        hi = 'n' if x%2==0 else 'm'
        # 위쪽: y2 가 몸통에 붙은 쪽, y1 이 끝
        c.px(x,2,hi); c.px(x,29,'l')
        if x%3!=0:
            c.px(x,1,'l' if x%2 else 'm'); c.px(x,30,'o' if x%2 else 'l')
    if strong:
        for x in range(3,29): c.px(x,29,'o' if x%2 else 'l')
def rug(strong):
    c=Cv(32,32)
    fringe(c,strong)
    X0,Y0,X1,Y1=1,3,30,28
    c.rect(X0,Y0,30,26,'1')
    def ring(i,tl,br,cor=None):
        for x in range(X0+i,X1-i+1): c.px(x,Y0+i,tl); c.px(x,Y1-i,br)
        for y in range(Y0+i,Y1-i+1): c.px(X0+i,y,tl); c.px(X1-i,y,br)
        if cor: c.px(X0+i,Y0+i,cor[0]); c.px(X1-i,Y1-i,cor[1])
    ring(0,'2' if strong else '1','0')
    for y in range(Y0,Y1+1): c.px(X0,y,'3' if strong else '2'); c.px(X1,y,'0' if strong else '1')
    ring(1,'e' if strong else 'd','b',('f','a'))
    ring(2,'3','1')
    # 무늬띠 배경
    c.rect(X0+3,Y0+3,24,20,'3')
    ring(3,'4','2')
    # 마름모 줄
    for k in range(6,26,4):
        for yy in (7,):  # 위
            for (dx,dy,col) in ((0,-1,'5'),(-1,0,'5'),(1,0,'5'),(0,0,'6'),(0,1,'5')):
                c.px(k+dx,yy+dy,col if not strong or col!='5' else '5')
        for (dx,dy,col) in ((0,-1,'5'),(-1,0,'5'),(1,0,'5'),(0,0,'6'),(0,1,'5')):
            c.px(k+dx,24+dy,col)
    for k in range(9,23,4):
        for xx in (4+2,):
            pass
    for k in range(10,23,4):
        for xx in (5,26):
            for (dx,dy,col) in ((0,-1,'5'),(-1,0,'5'),(1,0,'5'),(0,0,'6'),(0,1,'5')):
                c.px(xx+dx,k+dy,col)
    # 안쪽 판 x7..24, y9..22
    c.rect(7,9,18,14,'4')
    ring2=lambda tl,br: ([c.px(x,9,tl) or c.px(x,22,br) for x in range(7,25)], [c.px(7,y,tl) or c.px(24,y,br) for y in range(9,23)])
    ring2('2','4')
    for y in range(10,22):
        for x in range(8,24):
            u=(x-y)%4
            c.px(x,y,'4')
            if u==0 and (x+y)%8<4: c.px(x,y,'5')
            if u==2 and (x+y)%8>=4: c.px(x,y,'3')
    # 메달리온
    cx,cy=16,16
    diamond(c,cx,cy,5,'d'); diamond(c,cx,cy,4,'b')
    diamond(c,cx,cy,3,'6' if strong else '5',fill='3')
    diamond(c,cx,cy,1,'d',fill='e'); c.px(cx,cy,'f')
    for (x,y) in ((cx,cy-6),(cx,cy+6),(cx-6,cy),(cx+6,cy)): c.px(x,y,'d')
    # 모서리 작은 금 점
    for (x,y) in ((9,11),(22,11),(9,20),(22,20)): c.px(x,y,'d')
    return c
c=rug(False); emit('../w6-A.pxg',LG,c.rows())
c=rug(True)
# 접지 그림자: 오른쪽 아래 (밑 술 아래 빈 줄 x 없음: 오른쪽 열, 아래 줄)
for y in range(4,30): c.px(31,y,'-')
for x in range(3,30): c.px(x,31,'-')
emit('../w6-B.pxg',LG,c.rows())
# C: 둥근 모서리 타원형 양탄자 (겹둥근 띠 + 별 메달리온), 좌우 술
c=Cv(32,32)
import math
def inside(x,y,rx,ry,p=3.2):
    return (abs((x-15.5)/rx))**p+(abs((y-15.5)/ry))**p<=1
lay=[(15.0,14.4,'1'),(14.2,13.6,'d'),(13.4,12.8,'2'),(12.0,11.4,'3'),(10.8,10.2,'5'),(9.6,9.0,'4')]
for y in range(32):
    for x in range(32):
        for rx,ry,col in lay:
            if inside(x,y,rx,ry): c.px(x,y,col)
# 술: 좌우
for y in range(9,23):
    if y%2==0:
        for x in (0,1): c.px(x,y,'m')
        for x in (30,31): c.px(x,y,'l')
    else:
        c.px(1,y,'n'); c.px(30,y,'o')
# 겉 빛 : 위-왼 밝고 아래-오른 어둡게
for y in range(32):
    for x in range(32):
        if c.g[y][x]=='1':
            if not inside(x-1,y-1,15.0,14.4): c.px(x,y,'3')
            if not inside(x+1,y+1,15.0,14.4): c.px(x,y,'0')
# 중앙 별/메달리온
cx,cy=16,16
for y in range(32):
    for x in range(32):
        d=abs(x-15.5)+abs(y-15.5)
        if inside(x,y,9.6,9.0):
            u=(x-y)%4
            c.px(x,y,'4')
            if u==0 and (x+y)%8<4: c.px(x,y,'5')
diamond(c,15,15,6,'d'); diamond(c,16,16,6,'d')
for (x,y) in [(15,15),(16,15),(15,16),(16,16)]: c.px(x,y,'e')
diamond(c,15,15,4,'b'); diamond(c,16,16,4,'b')
c.rect(15,15,2,2,'f')
for (x,y) in ((15,9),(16,9),(15,22),(16,22),(9,15),(9,16),(22,15),(22,16)): c.px(x,y,'d')
# 겹띠 사이 무늬 : 금색 점선 (12.0 층 안쪽)
for t in range(0,64):
    a=t/64*2*math.pi
    x=int(round(15.5+11.0*math.cos(a)*1.0)); y=int(round(15.5+10.5*math.sin(a)))
    if inside(x,y,11.2,10.6) and not inside(x,y,10.2,9.6) and t%2==0: c.px(x,y,'6')
# 바닥 그림자 오른쪽 아래
for y in range(25,29):
    for x in range(8,26):
        if c.g[y][x]=='.' and inside(x-1,y-1,15.0,14.4): c.px(x,y,'-')
emit('../w6-C.pxg',LG,c.rows())

import sys; sys.path.insert(0,'tiledata/atlas-pick/work/h2-horror')
from lib import *
S='broken_window'
T=lambda t:('tin',t); N=lambda t:('night',t); MU=lambda t:('murk',t); V=lambda t:('void',t); R=lambda t:('rot',t)

def frame(c, hi=5):
    # 바깥 틀 x1..30, y1..12
    for y in range(1,13):
        for x in range(1,31):
            edge = x in (1,30) or y in (1,12)
            if edge:
                c.px(x,y,T(1) if (x==30 or y==12) else T(hi-1))
    # 안쪽 틀
    for y in range(2,12):
        for x in range(2,30):
            if x in (2,) or y==2: c.px(x,y,T(hi))
            elif x==29 or y==11: c.px(x,y,T(2))
    # 가운데 세로 틀 x14..16
    for y in range(2,12):
        c.px(14,y,T(hi)); c.px(15,y,T(3)); c.px(16,y,T(2))
    # 창턱
    c.hl(0,31,12,T(2)); c.hl(0,31,13,T(1)); 
    c.hl(1,30,12,T(hi-1)); c.px(0,12,None); c.px(31,12,None); c.px(0,13,None); c.px(31,13,None)
    c.hl(1,30,13,T(1))
def glass(c, x0,x1,y0=3,y1=10):
    for y in range(y0,y1+1):
        for x in range(x0,x1+1):
            c.px(x,y,N(1) if y<7 else N(2))
def outside_dark(c,x0,x1,y0=3,y1=10):
    for y in range(y0,y1+1):
        for x in range(x0,x1+1): c.px(x,y,N(0) if (x+y)%5 else N(1))
def moon(c, rows=(14,15), x0=3, x1=13, alpha='?'):
    for y in rows:
        for x in range(x0,x1+1):
            if (y==rows[-1] and (x-x0)%3==0): continue
            c.px(x,y,alpha)

def sheen(c, x0,y0):  # 유리 번쩍임 대각 두 줄
    for k in range(4): c.px(x0+k,y0+3-k,MU(5))
    for k in range(3): c.px(x0+4+k,y0+3-k+1,MU(4))

# 깨진 왼쪽 유리(뾰족한 구멍 가장자리)
def broken_left(c, shard=MU(5)):
    outside_dark(c,3,13)
    # 톱니 가장자리 조각: 각 변 안쪽에서 뾰족하게
    top=[(3,3),(4,3),(5,3),(6,4),(3,4),(4,4),(3,5)]
    for (x,y) in top: c.px(x,y,shard if (x+y)%2 else MU(3))
    c.px(5,4,MU(4)); c.px(3,6,MU(3))
    right=[(13,3),(12,3),(13,4),(12,4),(13,5),(11,3),(13,6)]
    for (x,y) in right: c.px(x,y,shard if (x+y)%2==0 else MU(3))
    for (x,y) in [(13,10),(12,10),(13,9),(11,10),(3,10),(4,10),(3,9),(5,10),(3,8)]:
        c.px(x,y,MU(4) if (x+y)%2 else MU(2))
    c.px(6,10,MU(3)); c.px(10,10,MU(3)); c.px(9,10,MU(5))
    # 뾰족 이빨 하나씩 안쪽으로
    c.px(7,5,MU(4)); c.px(7,4,MU(3)); c.px(9,4,MU(3)); c.px(10,4,MU(4))
    c.px(9,9,MU(4)); c.px(8,10,MU(2)); c.px(4,9,MU(3))
    # 달빛에 밖: 별 하나
    c.px(9,6,MU(6)); 

def right_pane(c, crack=True):
    glass(c,17,28)
    sheen(c,18,4)
    if crack:
        for (x,y) in [(24,3),(23,4),(23,5),(22,6),(22,7),(21,8),(20,9),(19,10)]:
            c.px(x,y,MU(6))
        for (x,y) in [(22,6),(23,7)]: c.px(x,y,MU(5))
        c.px(26,7,MU(6)); c.px(25,7,MU(5)); c.px(27,8,MU(5))

# A
c=C(32,16); frame(c); broken_left(c); right_pane(c); moon(c)
c.save(S,'h2-A','A: 주석 틀은 tin 회청색 쇠 창틀, 밖은 night 밤 청. 왼쪽 유리는 가장자리에 뾰족한 이빨만 남고 구멍으로 어둠이 보이며, 오른쪽 유리엔 금 한 줄과 대각 번쩍임. 창 아래 벽에 ? 달빛이 두 줄.'); run(S,'h2-A')
# B: 달빛 강조 + 구멍 안쪽 어둠 더 깊게 + 틀 그림자
c=C(32,16); frame(c,hi=6); broken_left(c,MU(6)); right_pane(c)
for y in range(3,11):
    for x in range(3,14):
        g=c.get(x,y)
        if g and g[0]=='night': c.px(x,y,N(0) if (x*3+y)%4 else V(2))
for x in range(3,13): c.px(x,10,c.get(x,10) if c.get(x,10)!=N(0) else V(1))
# 유리 아래 어둠(창턱 그림자)
for x in range(2,30): c.px(x,14,'-')
moon(c,rows=(14,15),x0=3,x1=14,alpha='?')
for x in range(15,22): c.px(x,15,'?')
c.save(S,'h2-B','B: 틀을 한 단 밝게 올리고 구멍 안 어둠을 void 까지 눌러 대비를 키움. 깨진 조각은 더 밝은 청백. 창 아래 벽에 - 그림자와 ? 달빛 번짐이 겹쳐 빛이 창턱 밑으로 흘러내린다.'); run(S,'h2-B')
# C: 실루엣 재해석 — 가운데 틀이 부러지고 구멍 가장자리가 톱니 이빨, 구멍에서 흰 손가락 자국
c=C(32,16); frame(c)
# 가운데 틀 부러짐: 위쪽만 남기고 아래는 어둠
for y in range(6,12): 
    for x in (15,16): c.px(x,y,None)
outside_dark(c,3,28)
# 유리 이빨: 왼쪽 위/아래에서 안쪽으로 삼각 톱니
def tooth(c,x0,y0,dx,dy,n,col):
    for k in range(n):
        c.px(x0+dx*k,y0+dy*k,col)
for (x0,y0) in [(3,3),(6,3),(9,3),(12,3),(17,3),(20,3),(24,3),(27,3)]:
    c.px(x0,y0,MU(5)); c.px(x0,y0+1,MU(4)); c.px(x0+1,y0,MU(3)); 
    if x0 in (6,12,20,27): c.px(x0,y0+2,MU(3))
for (x0,y0) in [(4,10),(8,10),(11,10),(18,10),(22,10),(26,10)]:
    c.px(x0,y0,MU(5)); c.px(x0,y0-1,MU(4)); c.px(x0+1,y0,MU(2))
    if x0 in (8,22): c.px(x0,y0-2,MU(3))
# 구멍에서 늘어진 커튼 조각 찢김
for y in range(3,9):
    c.px(21,y,('ward',3) if y%2 else ('ward',2))
for y in range(3,7): c.px(22,y,('ward',2))
c.px(21,9,('ward',4)); 
# 밖의 손: 창턱을 짚은 다섯 손가락
for x in range(8,13):
    for y in (9,10): c.px(x,y,('sheet',4) if y==9 else ('sheet',3))
for (x,top) in [(8,8),(9,6),(10,5),(11,6),(12,8)]:
    for y in range(top,9): c.px(x,y,('sheet',5) if x!=12 else ('sheet',4))
c.px(7,10,('sheet',3)); c.px(13,10,('sheet',2))
moon(c, x0=3,x1=13, rows=(14,15))
c.save(S,'h2-C','C: 창틀 가운데 세로 틀이 아래로 부러지고 유리는 위·아래 톱니만 남는다. 구멍은 밤 청 그대로 열려 왼쪽 아래 창턱을 짚은 창백한 손이 밖에서 올라오고, 오른쪽 위에서 찢긴 커튼 자락이 늘어짐.'); run(S,'h2-C')

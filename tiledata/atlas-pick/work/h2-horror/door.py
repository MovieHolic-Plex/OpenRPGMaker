import sys; sys.path.insert(0,'.')
from lib import *
S='door_boarded'
M=lambda t:('mahog',t); R=lambda t:('rot',t)
def door(c, hi=4):
    # 문틀 (x1..14, y1..31)
    for y in range(1,32):
        for x in range(1,15):
            edge = x in (1,14) or y in (1,31)
            if edge: c.px(x,y,M(0) if (x in (14,) or y==31) else M(1))
            elif x in (2,13) or y in (2,):
                c.px(x,y,M(hi) if (x==2 or y==2) else M(2))
            else: c.px(x,y,M(3))
    # 문짝 세로 널 이음
    for x in (6,9):
        c.vl(x,3,29,M(2))
    c.vl(3,3,29,M(hi-1)); c.vl(12,3,29,M(2))
    # 안쪽 판(위/아래)
    for (y0,y1) in ((4,14),(17,26)):
        c.hl(4,11,y0,M(2)); c.vl(4,y0,y1,M(2)); c.hl(4,11,y1,M(hi)); c.vl(11,y0,y1,M(hi-1))
    # 문 아래 틈 : 새까맣다
    c.hl(3,12,29,('void',1)); c.hl(3,12,30,('void',0))
    # 손잡이
    c.px(11,20,('tin',5)); c.px(11,21,('tin',3)); c.px(12,20,('tin',2))

def plank(c,f,x0,x1,th=4,body=4,top=5,dark=1,grain=3):
    for x in range(x0,x1+1):
        y=f(x)
        for k in range(th):
            if x in (x0,x1): t=R(dark)
            elif k==0: t=R(top)
            elif k==th-1: t=R(dark+1)
            else: t=R(body)
            c.px(x,y+k,t)
    # 결
    for x in range(x0+2,x1-1,5):
        y=f(x); c.px(x,y+1,R(grain)); c.px(x+1,y+2,R(grain))
def nail(c,x,y): 
    c.px(x,y,('tin',6)); c.px(x+1,y,('tin',3)); c.px(x,y+1,R(0)) 

H=lambda y:(lambda x:y)
D1=lambda x:round(14+x*0.72)
D2=lambda x:round(27-x*0.78)

# A
c=C(16,32); door(c)
plank(c,H(7),0,15); plank(c,D1,0,15); plank(c,D2,0,15)
for (x,y) in [(1,8),(13,8),(1,15),(13,25),(1,25),(13,16),(7,20)]:
    nail(c,x,y if y!=20 else 20)
c.save(S,'h2-A','A: 짙은 마호가니 문틀·널문에 낡은 판자 셋(가로 하나, 굵은 X)을 못질. 문 아래 틈은 void 로 새까맣다. v5 나무 톤 그대로의 정직판.'); run(S,'h2-A')
# B: 그림자 강화 — 판자 밑에 ~ 그림자, 문 아래 어둠 짙게, 문 위쪽 어둠
c=C(16,32); door(c,hi=5)
# 문 틈: 위 어둠 그라데이션
plank(c,H(7),0,15); plank(c,D1,0,15); plank(c,D2,0,15)
def under(c,f):
    for x in range(0,16):
        y=f(x)+4
        for k in (0,1):
            if c.get(x,y+k) is not None and not isinstance(c.get(x,y+k),str) and k==0: c.px(x,y+k,M(0))
            elif c.get(x,y+k) is not None and k==1 and not isinstance(c.get(x,y+k),str): c.px(x,y+k,M(1))
for f in (H(7),D1,D2): under(c,f)
for (x,y) in [(1,8),(13,8),(1,15),(13,25),(1,25),(13,16),(7,20)]: nail(c,x,y)
for y in range(3,29,1):
    if y>=22: 
        for x in range(3,13):
            g=c.get(x,y)
            if g is not None and not isinstance(g,str) and g[0]=='mahog': c.px(x,y,('mahog',max(0,g[1]-1)))
c.save(S,'h2-B','B: 판자 아래 어두운 띠로 그림자를 붙이고, 문 아랫부분을 한 단씩 눌러 바닥 쪽이 새까맣게 가라앉는다. 문틀 왼쪽·위 밝은 테는 한 단 올림.'); run(S,'h2-B')
# C: 실루엣 재해석 — 안에서 밀어 부러진 판자와 어둠 속 눈 둘
c=C(16,32); door(c)
plank(c,H(7),0,15); 
# 부러진 가운데 판자: 왼쪽 반은 위로 휘어 튀어나오고 오른쪽 반은 아래로 처짐
plank(c,lambda x:round(15+x*0.3),0,6)
plank(c,lambda x:round(21+(x-10)*0.5),10,15)
# 부러진 사이 틈 : 어둠
for y in range(15,25):
    for x in range(7,10): c.px(x,y,('void',1) if y%2 else ('void',0))
c.px(6,19,None)
# 눈 둘
c.px(7,19,('sheet',6)); c.px(9,19,('sheet',6)); 
# 찢긴 갈고리 자국
for (x,y) in [(4,22),(5,23),(6,24),(3,24),(4,25),(5,26)]: c.px(x,y,M(0))
# 부서진 조각 널
c.px(13,13,R(5)); c.px(14,13,R(4)); c.px(14,14,R(2)); c.px(12,14,R(3))
for (x,y) in [(1,8),(13,8),(1,17),(14,24)]: nail(c,x,y)
c.save(S,'h2-C','C: 가로 판자 하나만 성하고 가운데 판자는 안쪽에서 밀려 두 동강(왼쪽은 위로 휘고 오른쪽은 처짐). 벌어진 새까만 틈에 흰 점 눈 둘, 문짝에 긁힌 자국. 실루엣이 X 자에서 벗어난다.'); run(S,'h2-C')

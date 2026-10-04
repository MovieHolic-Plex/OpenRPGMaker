import sys, random, math; sys.path.insert(0,'tiledata/atlas-pick/work/h2-horror')
from lib import *
S='rug_blood'
VE=lambda t:('velv',t); D=lambda t:('damask',t); WX=lambda t:('wax',t); RT=lambda t:('rot',t); B=lambda t:('blood',t); PA=lambda t:('paper',t)
X0,X1,Y0,Y1=2,45,1,30
def base(c, rnd, field=4, med=5, wear=10, outer=1):
    for y in range(Y0,Y1+1):
        for x in range(X0,X1+1):
            e=min(x-X0,X1-x,y-Y0,Y1-y)
            if e<2: t=VE(outer)
            elif e==2: t=WX(2)
            elif e<5: t=VE(2)
            elif e==5: t=WX(1)
            else: t=VE(field)
            c.px(x,y,t)
    # 둥근 모서리(좌하·우하·좌상 한 칸)
    for (x,y) in [(X0,Y1),(X1,Y1),(X0,Y0)]: c.px(x,y,None)
    # 술: 좌우 끝
    for y in range(Y0+1,Y1):
        if y%2==0:
            L=rnd.choice([1,2,2]); 
            for k in range(L): c.px(X0-1-k,y,RT(3 if k==0 else 2)); c.px(X1+1+k,y,RT(3 if k==0 else 2))
        elif rnd.random()<0.35:
            c.px(X0-1,y,RT(2)); c.px(X1+1,y,RT(2))
    # 마름모 메달리온
    cx,cy=24,15
    for y in range(Y0+6,Y1-5):
        for x in range(X0+6,X1-5):
            d=abs(x-cx)/12.5+abs(y-cy)/7.5
            if d<=1.0:
                if d>0.86: c.px(x,y,WX(2 if d<0.94 else 3))
                elif d>0.78: c.px(x,y,VE(1))
                else: c.px(x,y,VE(med))
    # 안쪽 작은 마름모 무늬(damask)
    for y in range(Y0+6,Y1-5):
        for x in range(X0+6,X1-5):
            d=abs(x-cx)/6+abs(y-cy)/3.6
            if 0.85<=d<=1.05: c.px(x,y,D(4))
    # 모서리 문양 점
    for (mx,my) in [(X0+8,Y0+7),(X1-8,Y0+7),(X0+8,Y1-7),(X1-8,Y1-7)]:
        c.px(mx,my,D(4)); c.px(mx-1,my,D(3)); c.px(mx+1,my,D(3)); c.px(mx,my-1,D(3)); c.px(mx,my+1,D(3))
    # 낡음: 색 바랜 점, 올 나감
    for _ in range(wear*6):
        x=rnd.randint(X0+1,X1-1); y=rnd.randint(Y0+1,Y1-1)
        g=c.get(x,y)
        if g and g[0]=='velv': c.px(x,y,VE(max(0,min(5,g[1]+rnd.choice([-1,1])))))
def curl(c, strong=False):
    # 우상단 모서리를 접어 올림
    for y in range(Y0-1,Y0+9):
        for x in range(X1-9,X1+2):
            dx=X1-x; dy=y-Y0
            s=dx+dy
            if s<=3: c.px(x,y,None)
            elif s<=5:
                c.px(x,y,RT(5 if s==4 else 4))          # 접힌 뒷면(삼베)
    # 뒷면 아래 그림자
    for y in range(Y0,Y0+10):
        for x in range(X1-10,X1+1):
            dx=X1-x; dy=y-Y0; s=dx+dy
            if s in (6,7) and c.get(x,y) is not None and not isinstance(c.get(x,y),str):
                c.px(x,y,VE(0))
def stain(c, rnd, cx, cy, rx, ry, seed, edge=True, drip=0, dark=False):
    r2=random.Random(seed)
    ph=[r2.random()*6.28 for _ in range(3)]
    cells=[]
    for y in range(int(cy-ry-3),int(cy+ry+4)):
        for x in range(int(cx-rx-3),int(cx+rx+4)):
            a=math.atan2((y-cy)/ry,(x-cx)/rx)
            wob=1+0.16*math.sin(3*a+ph[0])+0.1*math.sin(5*a+ph[1])+0.06*math.sin(8*a+ph[2])
            d=math.hypot((x-cx)/rx,(y-cy)/ry)/wob
            if d<=1.0: cells.append((x,y,d))
    for x,y,d in cells:
        g=c.get(x,y)
        if g is None or isinstance(g,str): continue
        if d>0.9 and edge: c.px(x,y,'$')
        elif d>0.7: c.px(x,y,B(3 if not dark else 2))
        elif d>0.4: c.px(x,y,B(2))
        else: c.px(x,y,B(1 if rnd.random()<0.8 else 0))
    # 마른 균열(밝은 핏빛)
    for _ in range(4):
        x=int(cx+rnd.uniform(-rx*0.5,rx*0.5)); y=int(cy+rnd.uniform(-ry*0.5,ry*0.5))
        g=c.get(x,y)
        if g and g[0]=='blood': c.px(x,y,B(3))
    for i in range(drip):
        x=int(cx-rx*0.5+i*rx*0.6); y=int(cy+ry*0.8)
        for k in range(3+i):
            g=c.get(x,y+k)
            if g is not None and not isinstance(g,str): c.px(x,y+k,B(2) if k<2 else '$')
def count_blood(c):
    n=0
    for row in c.g:
        for p in row:
            if p=='$' or (p and not isinstance(p,str) and p[0]=='blood'): n+=1
    return n

# A
rnd=random.Random(11); c=C(48,32); base(c,rnd); stain(c,rnd,28,17,10.5,6,3,drip=2); curl(c)
print('A blood',count_blood(c),'/',44*30)
c.save(S,'h2-A','A: v5 양탄자를 낡게. 검붉은 velv 바탕, 바랜 wax 테와 마름모 메달리온, 좌우 끝에 닳은 술, 여기저기 색 바랜 점. 한가운데에서 오른쪽 아래로 치우친 마른 핏덩이(blood 안쪽 + $ 가장자리, 면적 약 1/6) 하나와 짧은 번짐 둘. 우상단 모서리는 접혀 삼베 뒷면이 보인다.'); run(S,'h2-A')
# B
rnd=random.Random(21); c=C(48,32); base(c,rnd,field=3,med=5,wear=18,outer=0); stain(c,rnd,27,17,11,6.5,5,drip=3,dark=True); curl(c)
# 접힌 곳 그림자 (양탄자 밖 바닥)
for y in range(Y0+1,Y0+8):
    for x in range(X1-8,X1+1):
        if c.get(x,y) is None and (X1-x)+(y-Y0) in (4,5,6,7): c.px(x,y,'~')
# 술 그림자
for y in range(Y0+1,Y1):
    if c.get(X0-1,y) is None and c.get(X0,y) is not None: pass
# 하단 그림자: 양탄자 아래 가장자리
for x in range(X0+1,X1):
    if c.get(x,Y1+1) is None: c.px(x,Y1+1,'-')
print('B blood',count_blood(c))
c.save(S,'h2-B','B: 대비를 세게. 바탕을 한 단 어둡게, 테를 가장 어둡게 깔아 메달리온 마름모가 또렷이 뜬다. 핏덩이는 더 진하게(blood 1~2단이 넓고 $ 가장자리가 눈에 띈다) 세 갈래 흘러내림. 접힌 모서리 밑에 ~ 그림자, 양탄자 아래 가장자리에 - 그림자.'); run(S,'h2-B')
# C: 눈 + 끌린 자국
rnd=random.Random(33); c=C(48,32); base(c,rnd,wear=12)
# 메달리온을 눈(아몬드)으로: 마름모 안쪽을 눈꺼풀 선으로 다시 그림
cx,cy=24,15
for y in range(Y0+6,Y1-5):
    for x in range(X0+6,X1-5):
        d=abs(x-cx)/12.5+abs(y-cy)/7.5
        if d<=1.0:
            # 위아래를 곡선으로 깎아 아몬드
            yy=abs(y-cy)/(7.5*(1-(abs(x-cx)/12.5)**2)**0.6+0.01)
            if yy>1.0: c.px(x,y,VE(3))
            elif yy>0.88: c.px(x,y,WX(3) if y<cy else WX(2))
            else: c.px(x,y,WX(4))
# 눈동자 = 핏덩이 (중앙 원)
stain(c,rnd,24,15,5.2,5.2,9,drip=0)
# 끌린 자국: 눈동자에서 왼쪽 아래 술 쪽으로 손 폭 3 넓이 줄무늬
for i in range(0,20):
    x=19-i; y=19+int(i*0.5)
    if x<X0+1 or y>Y1: break
    for w in range(-1,2):
        g=c.get(x,y+w)
        if g is not None and not isinstance(g,str): c.px(x,y+w,B(2) if w==0 else ('$' if i%2 else B(3)))
# 자국 끝에 손자국 (5손가락)
hx,hy=X0+2,Y1-4
for (dx,dy) in [(0,1),(1,0),(2,-1),(3,-1),(4,0),(1,1),(2,1),(3,1),(4,1),(2,2),(3,2)]:
    g=c.get(hx+dx,hy+dy)
    if g is not None and not isinstance(g,str): c.px(hx+dx,hy+dy,B(2))
curl(c)
print('C blood',count_blood(c))
c.save(S,'h2-C','C: 메달리온 마름모를 눈(아몬드)으로 다시 읽게 했다. 눈동자 자리가 마른 핏덩이, 거기서 왼쪽 아래 술 쪽으로 손 폭의 끌린 자국이 이어지고 끝에 손자국. 접힌 우상단 모서리는 그대로.'); run(S,'h2-C')

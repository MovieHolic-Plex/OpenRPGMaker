import sys, random, math; sys.path.insert(0,'tiledata/atlas-pick/work/h2-horror')
from lib import *
S='mausoleum'
G=lambda t:('grave',t); TN=lambda t:('tin',t); RU=lambda t:('rust',t); V=lambda t:('void',t)
HM=lambda t:('hmoss',t); NI=lambda t:('night',t); BI=lambda t:('bisque',t); PA=lambda t:('paper',t); BL=lambda t:('blood',t)
CX=32
def gable(c, rnd, deep=0):
    apex,base=3,18
    for y in range(apex,base+1):
        w=max(1,round((y-apex+1)*29/(base-apex+1)))
        xl,xr=CX-w,CX+w-1
        for x in range(xl,xr+1):
            i=x-xl; j=xr-x
            if i<=1: t=6 if i==0 else 5
            elif i<=3: t=4
            elif j==0: t=2
            elif j<=2: t=3
            else:
                t=4 if x<CX else 3
                if (y-apex)%4==3: t=max(1,t-2)
                elif (y-apex)%4==0 and x>xl+4: t=t+ (1 if x<CX-4 else 0)
            if deep and j<=3: t=max(1,t-1)
            c.px(x,y,G(t))
    # 박공 이음매(수직 줄)
    for y in range(apex+2,base+1):
        w=round((y-apex+1)*29/(base-apex+1))
        for xx in range(CX-w+5,CX+w-4):
            if (y-apex)%4==3: continue
            if (xx*7+y*3)%13==0: c.px(xx,y,G(2))
    # 꼭대기 장식돌
    c.px(CX-1,2,G(6)); c.px(CX,2,G(2)); c.px(CX-1,1,G(5)); c.px(CX,1,G(1))
def cornice(c, deep=0):
    for x in range(2,62):
        c.px(x,19,G(6)); c.px(x,20,G(5)); c.px(x,21,G(3)); c.px(x,22,G(1))
        if x%4 in (0,1): c.px(x,21,G(2))
    c.px(2,19,G(5)); c.px(2,20,G(4)); c.px(61,19,G(3)); c.px(61,20,G(2)); c.px(61,21,G(1))
def wall(c, rnd, x0=6,x1=57,y0=23,y1=57, deep=0):
    for y in range(y0,y1+1):
        course=(y-y0)//5
        off=4 if course%2 else 0
        for x in range(x0,x1+1):
            row=(y-y0)%5
            col=(x-x0+off)%9
            base=4 if x<CX else 3
            if row==4: t=2                     # 가로 줄눈
            elif col==8: t=2                   # 세로 줄눈
            elif row==0: t=base+1              # 위 모서리 빛
            elif col==0: t=base+1
            else: t=base
            if (x*13+y*7+course*5)%11==0: t=max(1,t-1)
            if (x*5+y*17)%23==0: t=min(6,t+1)
            if y<y0+2: t=max(1,t-1-deep)       # 처마 밑 그늘
            c.px(x,y,G(t))
def pillars(c):
    for px0 in (6,50):
        # 기둥머리
        for x in range(px0-1,px0+9):
            c.px(x,23,G(6 if x<px0+4 else 4)); c.px(x,24,G(5 if x<px0+4 else 3)); c.px(x,25,G(2))
        # 몸통
        for y in range(26,55):
            for i,x in enumerate(range(px0+1,px0+7)):
                t=[5,5,4,3,2,1][i] if px0==6 else [5,4,4,3,2,1][i]
                if (y*3+x)%17==0: t=max(1,t-1)
                c.px(x,y,G(t))
        # 기단
        for x in range(px0-1,px0+9):
            c.px(x,55,G(6 if x<px0+4 else 4)); c.px(x,56,G(4 if x<px0+4 else 2)); c.px(x,57,G(2 if x<px0+4 else 1))
def plate(c, mark=None):
    for y in range(26,31):
        for x in range(23,41):
            e=(x in (23,40)) or (y in (26,30))
            c.px(x,y,G(2 if e else 5 if x<CX else 4))
    c.hl(23,40,26,G(6)); c.px(23,27,G(5)); c.px(23,28,G(5))
    if mark=='groove':
        c.hl(26,37,28,G(2))
    elif mark=='tally':
        for i,x in enumerate((26,28,30,32)):
            c.vl(x,27,29,G(1))
        c.line(25,29,33,27,G(1))
        for x in (35,37): c.vl(x,27,29,G(1))
def door(c, rnd, mode='A', open_x=32):
    # 문틀
    for y in range(32,58):
        for x in range(23,41):
            e=(x in (23,24,39,40)) or y in (32,33)
            if e: c.px(x,y,G(5 if x in (23,24) or y==32 else 3 if x in (39,40) else 4))
    c.hl(23,40,32,G(6)); c.vl(23,32,57,G(6)); c.vl(40,33,57,G(2)); c.vl(39,34,57,G(3))
    # 문 안
    for y in range(34,58):
        for x in range(25,39):
            if (y==34 and x in (25,38)) : continue
            if x<open_x:
                # 닫힌 쪽 쇠문짝
                i=x-25
                t=[5,4,3,3,4,3,2][min(i,6)] if False else (5 if i==0 else 4 if i in (1,2) else 3 if i in (3,4) else 2)
                if i%3==2: t=max(1,t-1)
                c.px(x,y,TN(t))
            else:
                depth=x-open_x
                c.px(x,y,V(1 if depth<2 else 0 if y<50 else 1))
    # 녹
    for _ in range(46):
        x=rnd.randint(25,open_x-1); y=rnd.randint(35,57)
        if c.get(x,y) and c.get(x,y)[0]=='tin': c.px(x,y,RU(rnd.choice([2,3,3,4])))
    for y in range(35,45):
        if rnd.random()<0.6: c.px(rnd.randint(25,open_x-1),y,RU(3))
    # 띠와 리벳
    for yy in (39,52):
        for x in range(25,open_x): c.px(x,yy,RU(2)) if x%3 else c.px(x,yy,TN(6))
    for yy in (41,54):
        for x in (26,29):
            if x<open_x: c.px(x,yy,TN(6))
    # 손잡이 고리
    if open_x>30: c.px(open_x-2,46,TN(6)); c.px(open_x-2,47,TN(1)); c.px(open_x-1,46,TN(1))
    # 열린 쪽 문짝 모서리(안으로 밀려 각진 옆면)
    for y in range(34,58):
        c.px(open_x,y,TN(5 if y%7 else 3))
    # 바닥 문턱
    for x in range(25,39): c.px(x,57,G(2 if x>=open_x else 4))
def steps(c):
    for y,(x0,x1) in zip((58,59,60),((16,47),)*3):
        for x in range(x0,x1+1):
            c.px(x,y,G(6 if y==58 else 4 if y==59 else 2))
            if y==59 and x>CX+6: c.px(x,y,G(3))
    for y in (61,62,63):
        for x in range(10,54):
            c.px(x,y,G(6 if y==61 else 4 if y==62 else 1))
            if y==62 and x>CX+6: c.px(x,y,G(3))
    c.px(16,58,G(6)); c.px(10,61,G(6))
    for x in (30,31,32,33): c.px(x,59,G(3)) if False else None
def ivy(c, rnd, dense=1.0):
    pts=[(8,57),(9,52),(11,47),(9,42),(12,38),(15,35),(19,36),(22,33)]
    for (x0,y0),(x1,y1) in zip(pts,pts[1:]):
        c.line(x0,y0,x1,y1,NI(2))
    for (x,y) in pts:
        for dx,dy in [(0,0),(1,0),(0,1),(-1,0),(1,1),(-1,-1)]:
            if rnd.random()<0.85*dense: c.px(x+dx,y+dy,NI(3 if (dx+dy)%2 else 4))
    # 잎사귀 밝은 점
    for (x,y) in pts:
        if rnd.random()<0.7: c.px(x+1,y-1,HM(4))
    for (x,y) in [(24,31),(25,30),(14,42),(13,44),(16,34),(17,33)]:
        c.px(x,y,NI(4)); c.px(x+1,y,NI(2))
    # 오른쪽 기둥에도 조금
    for (x,y) in [(55,52),(56,50),(55,47),(54,46),(56,44)]:
        c.px(x,y,NI(3)); c.px(x-1,y+1,NI(2))
    c.px(55,49,HM(4))
def moss(c, rnd, deep=False):
    for x in range(10,54):
        if rnd.random()<0.35:
            g=c.get(x,63)
            if g: c.px(x,63,HM(2)); 
            g=c.get(x,62)
            if g and rnd.random()<0.5: c.px(x,62,HM(3))
    for (x,y) in [(4,20),(5,20),(6,19),(58,19),(59,19),(57,20),(60,20),(3,19)]:
        c.px(x,y,HM(3 if (x+y)%2 else 4))
    # 지붕 이끼
    for _ in range(12):
        y=rnd.randint(8,17); w=round((y-3+1)*29/16); x=CX+w-rnd.randint(5,10)
        if c.get(x,y): c.px(x,y,HM(2)); c.px(x-1,y,HM(3))
def cracks(c):
    for (x,y) in [(44,23),(44,24),(45,25),(45,26),(46,27),(46,28),(45,29),(45,30),(46,31),(47,32),(47,33),(48,34)]:
        c.px(x,y,G(0))
    for (x,y) in [(17,44),(17,45),(18,46),(18,47),(19,48),(19,49),(20,50)]:
        c.px(x,y,G(0))
    for (x,y) in [(38,7),(38,8),(37,9),(37,10),(36,11),(36,12)]:
        c.px(x,y,G(1))
def sanity(c):
    return

def do(name,mode):
    rnd=random.Random({'A':1,'B':2,'C':3}[mode]); c=C(64,64)
    deep = 1 if mode=='B' else 0
    gable(c,rnd,deep); cornice(c); wall(c,rnd,deep=deep); pillars(c); plate(c,'tally' if mode=='C' else 'groove')
    door(c,rnd,mode,open_x=32 if mode!='C' else 31)
    steps(c); cracks(c)
    if mode=='C':
        # 박공 해골
        sx,sy=CX,11
        for y in range(8,15):
            for x in range(CX-4,CX+4):
                r=((x-CX+0.5)/4.3)**2+((y-10.5)/3.6)**2
                if y>=13:
                    if CX-2<=x<=CX+1: c.px(x,y,G(6 if x<CX else 5))
                elif r<=1: c.px(x,y,G(6 if x<CX else 5))
        for (x,y) in [(CX-3,10),(CX-2,10),(CX-3,11),(CX-2,11),(CX+1,10),(CX+2,10),(CX+1,11),(CX+2,11)]: c.px(x,y,V(1))
        c.px(CX-1,12,V(2)); c.px(CX,12,V(2))
        for x in (CX-1,CX): c.px(x,14,G(2))
        # 어둠 속 눈 둘, 문틈을 붙잡은 창백한 손
        c.rect(34,41,35,42,PA(6)); c.px(34,42,V(1)); c.px(37,40,PA(6)); c.px(37,41,PA(6)); c.px(38,41,V(1))
        for y in (44,45): 
            pass
        # 손: 문 가장자리를 쥔 다섯 손가락
        hx,hy=32,47
        for i,(dx,dy) in enumerate([(0,0),(1,-1),(2,-1),(3,-1),(4,0)]):
            c.px(hx+dx,hy+dy,BI(5)); c.px(hx+dx,hy+dy+1,BI(4))
        c.rect(hx,hy+2,hx+4,hy+3,BI(3)); c.hl(hx+1,hx+3,hy+4,BI(2))
        c.px(hx-1,hy+1,BI(4)) 
        # 문턱 아래로 흐른 피(마른 얼룩)
        for (x,y) in [(33,58),(33,59),(34,59),(34,60),(34,61),(35,61),(35,62),(35,63)]:
            c.px(x,y,BL(2 if (x+y)%2 else 1))
        c.px(36,63,'$'); c.px(33,58,BL(3))
    ivy(c,rnd,1.0 if mode!='B' else 1.3); moss(c,rnd)
    if mode=='B':
        # 달빛 얼룩, 처마 그림자, 발치 안개
        for x in range(14,50):
            for y in (23,24): 
                g=c.get(x,y)
                if g and g[0]=='grave': c.px(x,y,G(1))
        for x in range(15,17):
            for y in range(28,54,6): 
                if c.get(x,y) and c.get(x,y)[0]=='grave': c.px(x,y,G(6))
        for x in range(8,56):
            for y in (61,62,63):
                if (x+y)%3==0 and c.get(x,y) is not None and c.get(x,y)!='+': pass
        for x in range(4,60,2):
            for y in (62,63):
                if c.get(x,y) is None or not isinstance(c.get(x,y),str): c.px(x,y,'+' if y==62 else '!')
        for y in range(48,57):
            for x in range(33,39):
                if c.get(x,y)==V(0) or c.get(x,y)==V(1): c.px(x,y,V(0))
        # 문 안쪽에 옅은 빛 한 줄(몹시 옅은 곰팡이빛)
        for x in range(34,38): c.px(x,56,V(3))
    notes={'A':'A: v5식으로 낡힌 정면. 삼각 박공(돌 두른 테, 가운데 이음줄)·돌 처마와 이빨장식, 기둥 둘(왼쪽 밝게), 돌쌓기 벽, 글자 없는 새김판(홈 한 줄), 녹슨 쇠문(왼 문짝 닫힘·오른쪽 반쯤 열려 속 어둠), 계단 두 단, 벽 금 셋, 왼 기둥에서 오르는 담쟁이·지붕과 발치의 이끼.',
           'B':'B: 형태는 A 와 같되 명암 폭을 넓혔다. 처마 밑을 가장 어둡게(grave 1) 눌러 그늘을 깊게, 왼쪽 돌면에 grave 6 달빛 하이라이트 줄, 문 안 void 0 로 더 깊게, 담쟁이 더 빽빽, 계단 아래 + / ! 안개 두 줄.',
           'C':'C: 죽음을 얹은 실루엣. 박공 한가운데 해골 부조(눈구멍 void), 새김판에는 글자 대신 긁은 세는 표시, 반쯤 열린 문 틈 어둠 속에서 흰 눈 둘이 내다보고 창백한 손이 문짝을 붙잡고 있다. 문턱에서 계단으로 마른 핏줄기가 흘러내린다.'}
    c.save(S,name,notes[mode]); run(S,name)
for m in 'ABC': do('h2-'+m,m)

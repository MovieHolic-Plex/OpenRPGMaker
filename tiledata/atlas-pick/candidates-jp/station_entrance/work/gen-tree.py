import sys,random
sys.path.insert(0,'tiledata/atlas-pick/candidates-jp/station_entrance/work')
from j4_mk import w
from j4_fac import *
MATS=["o sakura 0","p sakura 1","q sakura 2","r sakura 3","s sakura 4","t sakura 5",
"k sumi 0","l sumi 1","m sumi 2","n sumi 3","u sumi 4","v sumi 5",
"g matsu 1","h matsu 2","i matsu 3"]
def lump(g,cx,cy,rx,ry,tones,rnd,hi=0.5,lo=-0.15,dots=True):
    m=ellipse_mask(cx,cy,rx,ry)
    for (x,y) in m:
        edge=any((x+dx,y+dy) not in m for dx,dy in((1,0),(-1,0),(0,1),(0,-1)))
        u=(x+.5-cx)/rx; v=(y+.5-cy)/ry
        lit=-0.6*u-0.8*v            # >0 toward upper-left
        if edge: ch='o' if lit<0.2 else 'p'
        elif lit>hi: ch=tones[3]
        elif lit>lo: ch=tones[2]
        elif lit>-0.6: ch=tones[1]
        else: ch=tones[0]
        P(g,x,y,ch)
    if dots:
        pts=sorted(m)
        for _ in range(len(pts)//9):
            x,y=rnd.choice(pts)
            u=(x+.5-cx)/rx; v=(y+.5-cy)/ry
            if any((x+dx,y+dy) not in m for dx in(-2,-1,0,1,2) for dy in(-2,-1,0,1,2)): continue
            lit=-0.6*u-0.8*v
            P(g,x,y,'t' if lit>0.2 else ('p' if lit<-0.3 else 'r'))
            if lit>0.2: P(g,x+1,y,'s')
def edge_petals(g,rnd,cx,cy,rx,ry,n):
    for _ in range(n):
        a=rnd.random()*6.283
        import math
        x=int(cx+math.cos(a)*(rx+2)); y=int(cy+math.sin(a)*(ry+2))
        if g[y][x]=='.' : P(g,x,y,rnd.choice('rst'))
def trunk(g,x0,x1,y0,y1,lean=None):
    for y in range(y0,y1+1):
        R(g,x0,y,x1,y,'m')
        P(g,x0,y,'k'); P(g,x1,y,'k')
        P(g,x0+1,y,'n'); P(g,x0+2,y,'n') if x1-x0>5 else None
        P(g,x1-1,y,'l'); P(g,x1-2,y,'l')
        if y%5==2: P(g,x0+3,y,'l'); P(g,x0+4,y,'k')
def ground_petals(g,rnd,y0,xa,xb,skipx,n,cols='rst'):
    for _ in range(n):
        x=rnd.randint(xa,xb); y=rnd.randint(y0,47)
        if skipx[0]<=x<=skipx[1] and y<47: continue
        if g[y][x]=='.': P(g,x,y,rnd.choice(cols))
TA=['p','q','r','s']
def A():
    rnd=random.Random(4); g=canvas(48,48,'.')
    trunk(g,20,27,24,47)
    R(g,20,45,27,47,'m'); R(g,20,45,20,47,'k'); R(g,27,45,27,47,'k'); R(g,21,45,22,47,'n')
    # branch stubs under canopy
    P(g,19,26,'k'); P(g,28,27,'k')
    lump(g,10,20,10,8,TA,rnd)
    lump(g,38,21,10,8,TA,rnd)
    lump(g,24,13,16,11,TA,rnd)
    edge_petals(g,rnd,24,14,17,12,12)
    for x,y in((8,29),(41,29),(15,30)): P(g,x,y,rnd.choice('rs'))
    # matsu leaves poking out low left
    stamp(g,15,44,[".h.","hgh"]); stamp(g,30,45,["h.h",".gh"])
    ground_petals(g,rnd,44,4,44,(20,27),16)
    return g
def B():
    rnd=random.Random(9); g=canvas(48,48,'.')
    TB=['o','p','r','t']
    # ground shadow on light-right side first
    for y in range(44,48):
        for x in range(28,46):
            if ((x-34)/11)**2+((y-46.5)/2.6)**2<=1: g[y][x]='~' if y>=45 else '-'
    trunk(g,20,27,24,47)
    R(g,20,45,27,47,'m'); R(g,20,45,20,47,'k'); R(g,27,45,27,47,'k'); R(g,21,45,22,47,'n')
    R(g,25,44,26,47,'l')
    lump(g,10,20,10,8,TB,rnd,hi=0.35,lo=-0.3)
    lump(g,38,21,10,8,['o','o','p','r'],rnd,hi=0.5,lo=-0.1)
    lump(g,24,13,16,11,TB,rnd,hi=0.3,lo=-0.35)
    # strong highlight patches upper left
    for (x,y) in ellipse_mask(17,8,6,3): 
        if g[y][x] in 'rs': g[y][x]='t'
    for (x,y) in ellipse_mask(11,16,4,2):
        if g[y][x] in 'rs': g[y][x]='t'
    # light spill pink on ground left
    for y in range(44,48):
        for x in range(4,20):
            if ((x-11)/8)**2+((y-46)/2.2)**2<=1 and g[y][x]=='.': g[y][x]='%'
    edge_petals(g,rnd,24,14,17,12,10)
    ground_petals(g,rnd,44,3,17,(30,30),7,'st')
    return g
def C():
    rnd=random.Random(21); g=canvas(48,48,'.')
    TC=['p','q','r','s']
    # forked trunk, wide flat umbrella crown, hanging petal clusters
    trunk(g,20,27,30,47)
    R(g,20,45,27,47,'m'); R(g,20,45,20,47,'k'); R(g,27,45,27,47,'k'); R(g,21,45,22,47,'n')
    for i in range(7):                       # left fork
        R(g,15+i,29-i//2*1,18+i,31-i//2,'m') if False else None
    for i in range(9):
        R(g,19-i,29-i,22-i,30-i,'m'); P(g,18-i,29-i,'k'); P(g,23-i,30-i,'l')
        R(g,25+i,29-i,28+i,30-i,'m'); P(g,29+i,29-i,'k'); P(g,24+i,30-i,'l')
    R(g,20,27,27,31,'m')
    lump(g,24,10,22,8,TC,rnd,hi=0.45,lo=-0.15)
    lump(g,10,16,8,6,TC,rnd)
    lump(g,38,16,8,6,TC,rnd)
    lump(g,24,10,18,7,TC,rnd,hi=0.5,lo=-0.1,dots=False)
    # weeping fringe clusters
    for x0,ln in((6,9),(12,10),(19,7),(29,8),(36,11),(41,7)):
        ys=[y for y in range(48) if g[y][x0] not in '.' and y<30]
        top=max(ys)+1 if ys else 20
        for j in range(ln):
            P(g,x0,top+j,'q' if j%3 else 'r'); P(g,x0+1,top+j,'p')
        P(g,x0,top+ln,'s')
    edge_petals(g,rnd,24,12,22,9,10)
    ground_petals(g,rnd,44,2,46,(20,27),20,'rsst')
    return g
if __name__=='__main__':
    w('sakura_tree','A',(3,3),"강남 결: 꽃 덩이 셋(가운데 큼·양옆 작음) 위 왼쪽이 밝고 속은 어둡게, 굵은 갈색 줄기, 가장자리 꽃잎, 발치 떨어진 꽃잎",MATS,out(A()))
    w('sakura_tree','B',(3,3),"빛 구조: 왼쪽 위 흰분홍 강한 하이라이트, 오른쪽 덩이는 어둡게, 오른쪽 땅에 그림자·왼쪽 땅에 분홍빛 번짐",MATS,out(B()))
    w('sakura_tree','C',(3,3),"실루엣 재구상: 두 갈래 줄기 위 넓고 납작한 우산형 수관, 아래로 처지는 꽃가지",MATS,out(C()))

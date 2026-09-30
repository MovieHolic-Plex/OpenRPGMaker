import sys,importlib.util
sys.path.insert(0,'tiledata/atlas-pick/candidates-jp/station_entrance/work')
from j4_mk import w
from j4_fac import *
MATS=["e kawara 1","b kawara 2","a kawara 3","A kawara 5",
"j sumi 0","l sumi 1","k sumi 2","K sumi 3","L sumi 4",
"G hinoki 1","g hinoki 2","h hinoki 3","H hinoki 4","I hinoki 5",
"V washi 2","v washi 3","w washi 4","W washi 5",
"z akachin 0","Q akachin 1","q akachin 2","r akachin 3","R akachin 4","y akachin 5",
"m ai 0","M ai 1","n ai 2","N ai 3",
"d mconc 1","c mconc 2","C mconc 3","D mconc 4","t lacq 1","T lacq 3"]
LAN=dict(cord='j',cap='j',ol='Q',hi='R',mid='r',sh='q',rib='q',tas='R',hot=None)
NOR=dict(rail='j',cloth='n',hi='N',sh='M',slit='m',hem='M',mark='W')

def eave(g,strong=False):
    R(g,0,0,63,0,'e'); R(g,0,1,63,1,'A' if not strong else 'A')
    R(g,0,2,63,4,'a'); R(g,0,5,63,5,'b'); R(g,0,6,63,6,'e')
    for y,off in((2,0),(4,3)):
        for x in range(off,64,6): P(g,x,y,'e'); 
    for x in range(0,64,6): P(g,x,3,'e')
    for x in range(3,64,6): P(g,x,3,'b') if False else None
def planks(g,y0,y1,base='k',gap='j',hi='K'):
    for y in range(y0,y1+1):
        for x in range(64):
            g[y][x]= gap if x%5==0 else (hi if x%5==1 and (y%9<6) else base)
def door(g,x0,x1,y0,y1,t):
    # frame
    R(g,x0,y0,x1,y1,'g')
    R(g,x0,y0,x1,y0+2,'g'); R(g,x0,y0,x0,y1,'h'); R(g,x1,y0,x1,y1,'G')
    # glass
    gx0,gx1=x0+3,x1-3; gy0,gy1=y0+3,y1-3
    R(g,gx0,gy0,gx1,gy1,t['glass'])
    # warm gradient bottom
    R(g,gx0,gy1-5,gx1,gy1,t['glass2'])
    # centre glow
    for y in range(gy0,gy0+12):
        for x in range((gx0+gx1)//2-6,(gx0+gx1)//2+6):
            if t.get('core'): g[y][x]=t['core'] if abs(x-(gx0+gx1)//2)<5 else t['glass']
    # vertical lattice
    for x in range(gx0+4,gx1+1,6):
        R(g,x,gy0,x,gy1,t['barL']); R(g,x+1,gy0,x+1,gy1,t['barR'])
    # horizontal bars
    for y in (gy0+9,gy0+18):
        R(g,gx0,y,gx1,y,t['barL']); R(g,gx0,y+1,gx1,y+1,t['barR'])
    # inner frame shade
    R(g,gx0,gy0,gx1,gy0,t['barR'])
    # kick panel
    R(g,x0+1,y1-2,x1-1,y1,'g'); R(g,x0+1,y1-2,x1-1,y1-2,'h')
def window(g,x0,y0,x1,y1,t):
    R(g,x0,y0,x1,y1,'g'); R(g,x0,y0,x1,y0,'h'); R(g,x0,y0,x0,y1,'h')
    R(g,x0+1,y0+1,x1-1,y1-1,t['glass'])
    mx=(x0+x1)//2
    R(g,mx,y0+1,mx,y1-1,t['barL']); R(g,mx+1,y0+1,mx+1,y1-1,t['barR'])
    my=(y0+y1)//2
    R(g,x0+1,my,x1-1,my,t['barL']); R(g,x0+1,my+1,x1-1,my+1,t['barR'])
    R(g,x0+1,y1-2,x1-1,y1-1,t['glass2'])
    R(g,x0-1,y1+1,x1+1,y1+1,'G')
def board(g,x0,y0,x1,y1):
    R(g,x0,y0,x1,y1,'g'); R(g,x0,y0,x1,y0,'h'); R(g,x0,y0,x0,y1,'h'); R(g,x1,y0,x1,y1,'G'); R(g,x0,y1,x1,y1,'G')
    R(g,x0+1,y0+1,x1-1,y1-1,'t')
    R(g,x0+1,y0+1,x1-1,y0+1,'T')
    # menu marks: red dot + bars (no fake letters)
    R(g,x0+2,y0+3,x0+3,y0+4,'r')
    for k,yy in enumerate((y0+3,y0+6,y0+9)):
        L=(x1-x0-4)-(k%2)*2
        R(g,x0+5,yy,x0+5+L-2,yy,'v')
    R(g,x0+2,y0+6,x0+3,y0+6,'v'); R(g,x0+2,y0+9,x0+3,y0+9,'v')
def base(g,y0,strong=False):
    R(g,0,y0,63,y0+4,'c'); R(g,0,y0,63,y0,'C')
    for x in range(0,64,8): R(g,x,y0+1,x,y0+4,'d')
    R(g,0,y0+2,63,y0+2,'c')
    R(g,0,y0+4,63,y0+4,'d')
TA=dict(glass='w',glass2='v',core='W',barL='H',barR='g')

def A():
    g=canvas(64,48,'k'); eave(g)
    R(g,0,7,63,8,'j'); R(g,0,9,63,10,'l')
    planks(g,11,42); R(g,0,9,63,10,'l'); R(g,0,7,63,8,'j')
    R(g,0,11,63,12,'l')
    for x in range(64):
        if x%5==0: R(g,x,9,x,12,'j')
    lantern(g,5,7,10,14,LAN); lantern(g,49,7,10,14,LAN)
    window(g,5,31,14,41,TA)
    door(g,17,46,9,42,TA)
    noren(g,21,12,22,10,NOR)
    board(g,49,31,58,41)
    base(g,43)
    return g
def B():
    g=canvas(64,48,'l'); eave(g)
    R(g,0,7,63,9,'j')
    planks(g,10,42,base='l',gap='j',hi='k'); R(g,0,7,63,9,'j')
    # warm halo on wall around lanterns
    def halo(cx,cy,r):
        for y in range(48):
            for x in range(64):
                d=math.hypot(x-cx,(y-cy)*1.1)
                if d<r and g[y][x] in 'lkjK':
                    lvl='K' if d<r*0.5 else 'k' if d<r*0.8 else 'l'
                    if g[y][x]=='j' and d>=r*0.5: continue
                    g[y][x]=lvl if g[y][x]!='j' else 'l'
    halo(10,18,12); halo(54,18,12)
    LB=dict(LAN); LB.update(hot='y',hi='y',mid='R',sh='r',rib='q',ol='z',tas='R')
    lantern(g,5,7,10,14,LB); lantern(g,49,7,10,14,LB)
    TB=dict(glass='W',glass2='w',core='W',barL='I',barR='G')
    window(g,5,31,14,41,TB)
    door(g,17,46,9,42,TB)
    noren(g,21,12,22,10,dict(NOR,cloth='M',hi='n',sh='m',slit='m',hem='m',mark='W',rail='j'))
    board(g,49,31,58,41)
    # eave shadow
    R(g,0,7,63,9,'j')
    base(g,43)
    # spill fan + shadow
    for y in range(43,48):
        for x in range(64):
            half=14+ (y-43)*3
            if abs(x-31.5)<=half: g[y][x]='%'
            else: g[y][x]='-' if y>=46 else g[y][x]
    for y in (46,47):
        for x in range(64):
            if abs(x-31.5)>14+(y-43)*3: g[y][x]='~' if y==46 else '-'
    return g
if __name__=='__main__':
    w('izakaya_front','A',(4,3),"강남 결: 짙은 판벽 위에 기와 처마, 붉은 제등 둘, 가운데 격자 미닫이+노랑 불빛, 문 위 남색 노렌, 옆 창과 메뉴판",MATS,out(A()))
    w('izakaya_front','B',(4,3),"빛 구조: 판벽을 더 어둡게, 제등 속을 밝게 하고 벽에 불빛 테, 격자 유리 속 밝은 흰빛, 발치에 부채꼴 불빛 번짐과 접지 그림자",MATS,out(B()))

def C():
    g=canvas(64,48,'k'); eave(g)
    planks(g,11,42)
    R(g,0,7,63,8,'j'); R(g,0,9,63,10,'l')
    for x in range(64):
        if x%5==0: R(g,x,9,x,12,'j')
    # door left, wide
    door(g,3,34,9,42,TA)
    noren(g,8,12,22,11,NOR)
    # big + small lantern on the right
    LBIG=dict(LAN,hot='y')
    lantern(g,42,7,16,18,LBIG)
    # white stripes on big lantern (abstract band, no letters)
    for y in (16,17,22,23):
        for x in range(46,55):
            if g[y][x] in 'rRqy': g[y][x]='w' if y in (16,22) else 'v'
    lantern(g,36,7,6,9,dict(LAN))
    # A-board standing at right of door
    board(g,37,30,44,39)
    R(g,38,40,38,42,'g'); R(g,43,40,43,42,'G')
    # sake barrel
    m=ellipse_mask(52,38.5,7.6,4.6)
    for (x,y) in m:
        edge=any((x+dx,y+dy) not in m for dx,dy in((1,0),(-1,0),(0,1),(0,-1)))
        g[y][x]='l' if edge else ('H' if x<49 else 'h' if x<55 else 'g')
    for yy in (35,41):
        for x in range(44,60):
            if (x,yy) in m and g[yy][x]!='l': g[yy][x]='j'
    R(g,49,37,55,40,'W'); R(g,49,37,55,37,'V'); R(g,51,38,52,39,'r')
    R(g,45,42,59,42,'j')
    base(g,43)
    return g
if __name__=='__main__':
    w('izakaya_front','C',(4,3),"실루엣 다시: 문을 왼쪽으로 붙이고 오른쪽에 큰 제등 하나(흰 띠)와 서 있는 메뉴판, 술통을 두어 세로 무게를 옮김",MATS,out(C()))

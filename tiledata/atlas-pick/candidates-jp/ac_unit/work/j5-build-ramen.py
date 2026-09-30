import sys; sys.path.insert(0,'/home/main/.t3/worktrees/rpg-zzu/t3code-8b4b09de-jp-pick/tiledata/atlas-pick/candidates-jp/ac_unit/work')
from j5lib import *
K=lambda r:(lambda t:(r,t))
Cn=K('mconc'); Gl=K('mglass'); Me=K('mmetal'); Ak=K('akachin'); Ai=K('ai'); Wh=K('mwhite'); Lq=K('lacq'); Ho=K('hinoki'); Kw=K('kawara'); Mr=K('mred'); Ko=K('korange'); Pv=K('mpave'); Ye=K('myellow'); Su=K('sumi')
RA=["..##....","...##...",".######.",".##.....",".##.....",".#####..",".##..##.",".##..##.","..####.."]
BO=["........","........","........","########","########","........","........","........","........"]
ME=["...##...","...##...",".#.##.#.","##.##.##","##.##.##","##.####.",".##.###.","..#####.","...###.."]
N =["...##...","...##...","...##...","..###...","..##.##.",".##..###",".##...##",".##....##" if False else ".##...##","##.....#"]
MEN=["##.#######","##.#.....#","####.###.#" ,"##.#######","#..#.#.#.#","####.#.#.#","##.#######","##.#.#.#.#","##.#.#.#.#","##.#.....#","#..#.....#"]
def blit(c,x,y,rows,col):
    for j,r in enumerate(rows):
        for i,k in enumerate(r):
            if k=='#': c.put(x+i,y+j,col)
def hemw(x,ph): return [0,0,1,1,1,0,0,-1,-1,0][(x+ph)%10]
def noren(c,shade,ox=13,pw=(11,12,11),top=23,bot=38):
    x=ox
    for i,w in enumerate(pw):
        for xx in range(x,x+w):
            h=bot+hemw(xx,i*3)
            for y in range(top,h+1):
                t=3
                if xx-x<=0: t=4
                if x+w-1-xx<=0: t=2
                if shade:
                    if xx-x<=1: t=4
                    if y<=top+2: t-=1
                c.put(xx,y,Ai(t))
            c.put(xx,h,Ai(1 if not shade else 0))
        m=x+w//2
        for y in range(top+3,bot-1): c.put(m,y,Ai(2))
        if i==1:
            gx=x+(w-10)//2+0
            blit(c,gx,top+3,MEN,Wh(5))
        x+=w+1
    c.hl(ox-1,top-1,sum(pw)+2+2,Ho(5)); c.hl(ox-1,top,sum(pw)+2+2,Ho(3)) if False else None
    c.hl(ox-1,top-2,sum(pw)+4,Ho(6)); c.hl(ox-1,top-1,sum(pw)+4,Ho(4)); c.hl(ox,top,sum(pw)+2,Ho(2))
def lantern(c,x,y,shade,big=False):
    w=9 if not big else 13; h=12 if not big else 20
    c.vl(x+w//2,y-3,3,Su(3))
    c.rect(x+1,y,w-2,2,Lq(3)); c.rect(x+1,y+h-2,w-2,2,Lq(3)); c.hl(x+1,y,w-2,Lq(5))
    for j in range(2,h-2):
        ww=w-(0 if 3<j<h-5 else 1)
        xs=x+(w-ww)//2
        c.hl(xs,y+j,ww,Mr(3)); c.put(xs,y+j,Mr(4)); c.put(xs+ww-1,y+j,Mr(1))
        if j in (5,h-7): c.hl(xs,y+j,ww,Mr(1) if False else Mr(2))
    # 흰 무늬
    if not big:
        c.rect(x+3,y+4,3,4,Wh(5)); c.put(x+4,y+5,Mr(3)); c.put(x+4,y+6,Mr(3))
    else:
        c.rect(x+4,y+5,5,9,Wh(5)); c.vl(x+6,y+6,7,Mr(3))
    if shade:
        for j in range(1,h-1): c.put(x-1,y+j,'%')
        c.put(x+w//2,y+h+1,'~')
def stage(c,shade,roof='flat'):
    W,H=64,48
    # 벽
    for y in range(20,48):
        for x in range(W):
            c.put(x,y,Cn(4))
    for y in range(20,48): c.put(0,y,Cn(5)); c.put(63,y,Cn(3))
    # 아래 판벽
    for y in range(40,48):
        for x in range(W):
            c.put(x,y,Ho(3) if (x//8)%2==0 else Ho(2))
    for x in range(0,W,8): c.vl(x,40,8,Ho(1))
    c.hl(0,40,W,Ho(5)); c.hl(0,47,W,Pv(3)) 
    # 처마
    for y in range(0,6):
        for x in range(W):
            c.put(x,y,Kw(4) if (x//4+y//2)%2==0 else Kw(3))
    for x in range(W): 
        if x%4==0: c.vl(x,0,6,Kw(2))
    c.hl(0,0,W,Kw(5)); c.hl(0,5,W,Kw(1)); c.hl(0,6,W,Ho(3))
    if shade:
        c.hl(0,7,W,'~'); c.hl(0,8,W,'-')
    # 간판 판
    c.rect(3,6,58,14,Ho(3)); c.hl(3,6,58,Ho(5)); c.vl(3,6,14,Ho(5)); c.hl(3,19,58,Ho(1)); c.vl(60,6,14,Ho(1))
    c.rect(5,8,54,10,Ak(3)); c.hl(5,8,54,Ak(4)); c.vl(5,8,10,Ak(4)); c.hl(5,17,54,Ak(1)); c.vl(58,8,10,Ak(1))
    ox=13
    for i,g in enumerate((RA,BO,ME,N)):
        blit(c,ox+i*10+ (0 if i!=1 else 0),8+0,g[:9],Wh(5))
    c.hl(2,20,60,Ho(2)) if False else None
    if shade:
        c.hl(4,20,58,'~')
    # 문 열림
    c.rect(12,21,40,19,Lq(1)); 
    c.rect(13,22,38,18,Ko(1)); c.hl(13,32,38,Ko(2)); c.hl(13,36,38,Ko(2)); c.hl(13,38,38,Ko(1))
    for sx in (19,32,45): c.rect(sx,35,3,5,Lq(2)); c.hl(sx,34,3,Ko(3))
    c.vl(11,21,19,Ho(4)); c.vl(12,21,19,Ho(3)); c.vl(51,21,19,Ho(1)); c.vl(52,21,19,Ho(0))
    noren(c,shade)
    if shade:
        c.hl(13,33,38,'~')
    # 창 (김서림)
    c.rect(1,24,10,15,Me(2)); c.hl(1,24,10,Me(4)); c.vl(1,24,15,Me(4))
    c.rect(2,25,8,13,Gl(3)); c.rect(2,26,8,9,Wh(4)); c.rect(3,27,5,6,Wh(5)); c.hl(2,25,8,Wh(3)) if False else None
    for xx in (3,6,8): c.vl(xx,34,4,Gl(4))
    c.put(4,36,Wh(5)); c.put(7,35,Wh(5))
    c.hl(0,38,12,Cn(6)); c.hl(0,39,12,Cn(2))
    if shade:
        for y in range(25,38): c.put(11,y,'%')
    lantern(c,54,24,shade)
def build(shade):
    c=C(64,48); stage(c,shade); return c
c=build(False)
finish(c,'ramen_front','A',"강남: 기와 처마, 붉은 가로 간판 흰 「らーめん」, 남색 노렌 세 폭에 흰 「麺」, 김서림 유리창, 오른쪽 붉은 등롱")
c=build(True)
finish(c,'ramen_front','B',"빛 강화: 처마·간판 아래 반투명 그림자, 노렌 왼쪽 밝고 봉 밑 어둡게, 김서림 창·등롱 옆 %빛 번짐, 노렌 안쪽 따뜻한 조명")
# ---- C  휜 처마 실루엣 + 큰 등롱
c=C(64,48); stage(c,False)
# 처마 양끝을 위로 휜 곡선으로 깎아 투명하게
for y,cut in ((0,7),(1,5),(2,3),(3,2),(4,1)):
    for x in range(cut): c.put(x,y,None); c.put(63-x,y,None)
# 처마 밑 두께
c.hl(2,5,60,Kw(2)); 
# 큰 등롱이 간판 왼쪽 아래로 늘어짐
c.erase(54,17,10,20)
lantern(c,52,14,False,big=True)
finish(c,'ramen_front','C',"재해석: 처마 끝이 위로 휜 기와 실루엣(양끝 투명)과 간판을 가로지르는 커다란 붉은 등롱")
sheet('ramen_front',5)

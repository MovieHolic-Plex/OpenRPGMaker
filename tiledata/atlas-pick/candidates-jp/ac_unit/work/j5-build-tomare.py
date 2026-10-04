import sys, math; sys.path.insert(0,'/home/main/.t3/worktrees/rpg-zzu/t3code-8b4b09de-jp-pick/tiledata/atlas-pick/candidates-jp/ac_unit/work')
from j5lib import *
Rd=lambda t:('mred',t); Wh=lambda t:('mwhite',t); Po=lambda t:('pole',t); Y=lambda t:('myellow',t); Lq=lambda t:('lacq',t); Gr=lambda t:('mgran',t)
TOME=[".#.","###","#.#","#.#","###"]
MA=["##.","###",".#.","##.","###"]
RE=["#..","###","#.#","#.#","#.#"]
def glyph(c,x,y,rows,col):
    for j,r in enumerate(rows):
        for i,ch in enumerate(r):
            if ch=='#': c.put(x+i,y+j,col)
def span(y,H=21,top=16,bot=4):
    w=top-(top-bot)*y/H
    w=int(round(w)); w-=w%2
    return 8-w//2, 8+w//2
def tri(c,H=21,fill=None,edge=None,inner=None,shade=None,hi=None):
    for y in range(H+1):
        a,b=span(y,H)
        for x in range(a,b): c.put(x,y,fill)
    return
def pole(c,y0,y1,x=7,cols=(5,3,1)):
    for y in range(y0,y1):
        c.put(x,y,Po(cols[0])); c.put(x+1,y,Po(cols[1])); c.put(x+2,y,Po(cols[2])) if len(cols)>2 else None

W=[16]*8+[14,14,12,12,10,10,8,8,6,6,4,4,4]
def sp(y):
    w=W[min(y,len(W)-1)]; return 8-w//2, 8+w//2
NR=len(W)
def body(c,fill,lite,dark,white_l,white_r,tx=2,ty=2):
    for y in range(NR):
        a,b=sp(y)
        for x in range(a,b): c.put(x,y,fill)
        c.put(a,y,white_l); c.put(b-1,y,white_r)
    a,b=sp(0); c.hl(a,0,b-a,white_l)
    # 바깥 붉은 테두리 -> 흰 선 안쪽 붉은 채움 (전체 바깥선은 붉은 어두운 단)
    for y in range(NR):
        a,b=sp(y); 
        if y>0 and sp(y-1)!=(a,b):
            pass
    a,b=sp(NR-1); c.hl(a,NR-1,b-a,white_r)
    for i,g in enumerate((TOME,MA,RE)):
        glyph(c,tx+i*4,ty,g,Wh(5))
def cut(c):
    c.put(0,0,None); c.put(15,0,None)

# ---- A
c=C(16,32); body(c,Rd(3),None,None,Wh(5),Wh(4))
cut(c)
for y in range(NR):
    a,b=sp(y)
    if y>0 and a>sp(y-1)[0]: c.hl(sp(y-1)[0],y,a-sp(y-1)[0],'~') if False else None
pole(c,NR,32,7,(5,3,1)); c.hl(6,31,4,Po(2))
finish(c,'tomare_sign','A',"강남: 흰 테두리 빨간 표지에 흰 3×5 「止まれ」, 회색 기둥. 16px 폭이라 글자가 뭉개짐 — 2×2 로 키우자")
# ---- B
c=C(16,32); body(c,Rd(3),None,None,Wh(5),Wh(3))
for x in range(1,15): 
    if c.g[1][x] is not None and c.g[1][x]==Rd(3): c.put(x,1,Rd(4))
for y in range(NR):
    a,b=sp(y); c.put(b,y,'~') if y<NR-1 else None
c.hl(4,NR,8,'~') if False else None
for y in range(NR,32):
    for k,col in enumerate((Po(5),Po(4),Po(2),Po(0))): c.put(6+k,y,col)
c.hl(10,NR+1,3,'~'); c.hl(10,31,5,'-'); c.hl(4,31,6,Po(3))
cut(c)
finish(c,'tomare_sign','B',"빛 강화: 표지 윗변 밝은 붉은색, 오른쪽에 반투명 두께 그림자, 기둥 4단 명암 원통감, 밑동 접지 그림자")
# ---- C  이동식 받침
c=C(16,32); body(c,Rd(3),None,None,Wh(5),Wh(4))
cut(c)
c.vl(7,NR,8,Po(4)); c.vl(8,NR,8,Po(2))
c.rect(1,27,14,5,Lq(2)); c.hl(1,27,14,Lq(4)); c.hl(1,31,14,Lq(0)); c.vl(14,28,4,Lq(1))
for x in range(2,14):
    for y in (28,29,30):
        if ((x+y)//2)%2==0: c.put(x,y,Y(3))
c.hl(3,26,10,Lq(3)); c.put(3,26,Lq(4))
finish(c,'tomare_sign','C',"재해석: 공사장식 이동 표지 — 가는 기둥을 노랑·검정 사선 고무 받침 위에 세운 실루엣")
sheet('tomare_sign',10)

import sys; sys.path.insert(0,'/home/main/.t3/worktrees/rpg-zzu/t3code-8b4b09de-jp-pick/tiledata/atlas-pick/candidates-jp/ac_unit/work')
from j5lib import *
Ai=lambda t:('ai',t); Wh=lambda t:('mwhite',t); Ho=lambda t:('hinoki',t); Sh=lambda t:('shu',t); Wa=lambda t:('washi',t); Su=lambda t:('sumi',t)
PAN=[(1,9),(11,20),(22,30)]
def hem(x,ph):  # 아랫단 흔들림: 패널별 위상
    return [13,13,14,14,14,13,13,12,12,13][(x+ph)%10]
def corners(c):
    for x,y in ((0,0),(31,0),(0,15),(31,15)): c.put(x,y,None)
def rod(c,hi,mid,lo):
    c.hl(0,0,32,hi); c.hl(0,1,32,mid); c.hl(1,2,30,lo)
    for x in (0,31): c.put(x,0,None)
    c.put(0,1,lo); c.put(31,1,lo)
def crest(c,cx,cy,r,col,ring):
    for y in range(cy-r,cy+r+1):
        for x in range(cx-r,cx+r+1):
            d=(x-cx)**2+(y-cy)**2
            if d<=r*r+r/2: c.put(x,y,col)
    for y in range(cy-r+2,cy+r-1):
        for x in range(cx-r+2,cx+r-1):
            d=(x-cx)**2+(y-cy)**2
            if d<=(r-2)**2+1: c.put(x,y,ring)
# ---- A
c=C(32,16)
for i,(a,b) in enumerate(PAN):
    for x in range(a,b+1):
        for y in range(2,hem(x,i*3)+1):
            c.put(x,y,Ai(3))
        c.put(x,hem(x,i*3),Ai(1))
        if x==a: pass
    for y in range(2,13): c.put(a,y,Ai(4)); c.put(b,y,Ai(2))
    m=(a+b)//2; 
    for y in range(3,12): c.put(m,y,Ai(2))
rod(c,Ho(5),Ho(4),Ho(2))
crest(c,15,7,4,Wh(5),Ai(3)); c.rect(14,6,3,3,Wh(5))
corners(c)
finish(c,'noren','A',"강남: 남색 3폭, 1px 틈, 위 나무봉, 아랫단 물결, 가운데 폭에 흰 가문. 접힌 줄 하나씩")
# ---- B
c=C(32,16)
for i,(a,b) in enumerate(PAN):
    for x in range(a,b+1):
        h=hem(x,i*3)
        for y in range(2,h+1):
            t=3
            if x-a<=1: t=4
            if b-x<=1: t=2
            if y<=4: t-=1   # 봉 밑 그늘
            c.put(x,y,Ai(t))
        c.put(x,h,Ai(0)); 
        if h>2: c.put(x,h-1,Ai(1))
    for y in range(2,13): c.put(a,y,Ai(5) if y>4 else Ai(3))
    m=(a+b)//2
    for y in range(5,12): c.put(m,y,Ai(1)); c.put(m-1,y,Ai(2)) 
rod(c,Ho(6),Ho(4),Ho(1))
c.hl(1,2,30,Ai(0)); 
for i,(a,b) in enumerate(PAN):
    c.hl(a,2,b-a+1,Ai(0))
crest(c,15,8,4,Wh(5),Ai(3)); c.rect(14,7,3,3,Wh(5)); c.hl(11,8+4,8,None) if False else None
for y in range(5,13): c.put(19,y,Ai(1)) if False else None
corners(c)
finish(c,'noren','B',"빛 강화: 봉 밑 어두운 그늘 2줄, 각 폭 왼쪽 밝게·오른쪽 어둡게, 가운데 접힘 골, 아랫단 검정에 가까운 남색 단")
# ---- C  줄발(縄のれん)
c=C(32,16)
lens=[9,12,10,14,11,13,10,14,12,9,13,11]
for i,L in enumerate(lens):
    x=2+i*2+(0 if i<12 else 0)
    if x>29: break
    x=1+int(i*2.5)
    for y in range(2,2+L):
        c.put(x,y,Wa(4)); c.put(x+1,y,Wa(2))
        if (y-2)%4==3: c.put(x,y,Ho(3)); c.put(x+1,y,Ho(1))
    c.put(x,2+L,Sh(4)); c.put(x+1,2+L,Sh(2)); c.put(x,3+L,Sh(3)) if L<13 else None
rod(c,Ho(5),Ho(4),Ho(2))
for x in range(2,31,6): c.rect(x,1,2,3,Sh(3)); c.put(x,1,Sh(5))
corners(c)
finish(c,'noren','C',"재해석: 새끼줄 발(縄のれん) — 천 대신 길이가 다른 짚 줄 12가닥에 붉은 매듭과 끝술, 빈틈 있는 실루엣")
sheet('noren',12)

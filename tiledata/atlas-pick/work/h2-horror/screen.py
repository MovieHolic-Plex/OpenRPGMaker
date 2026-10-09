import sys; sys.path.insert(0,'tiledata/atlas-pick/work/h2-horror')
from lib import *
S='hosp_screen'
T=lambda t:('tin',t); W=lambda t:('ward',t); SH=lambda t:('sheet',t); RU=lambda t:('rust',t); V=lambda t:('void',t)
FOLD=[2,5,4,3]
def frame(c):
    # 위 레일 y3..4, 기둥 x2 / x29, 아래 받침 y28
    c.hl(2,29,3,T(6)); c.hl(2,29,4,T(3)); c.hl(2,29,5,T(1))
    for x in (2,29):
        c.vl(x,3,29,T(5) if x==2 else T(2)); c.vl(x+ (1 if x==2 else -1),5,29,T(3) if x==2 else T(1))
    c.px(2,2,T(4)); c.px(3,2,T(2)); c.px(29,2,T(3)); c.px(28,2,T(1))
    # 가운데 기둥 (얇게)
    c.vl(15,4,27,T(3)); c.vl(16,4,27,T(1))
    # 받침
    c.hl(2,29,27,T(4)); c.hl(2,29,28,T(2)); c.hl(3,28,29,T(1)) if False else None
    for x in (2,15,28):
        c.rect(x,29,x+1,31,T(1)); c.px(x,29,T(3)); c.px(x,30,T(2))
    for (x,y) in [(2,8),(29,20),(15,9),(2,25),(28,28),(6,3),(22,4)]: c.px(x,y,RU(3))
    c.px(29,14,RU(4)); c.px(3,3,RU(4))
    # 고리
    for x in range(4,29,3): 
        if x not in (15,16): c.px(x,5,T(5)); c.px(x,6,T(2))
def curtain(c, x0,x1, y1=25, torn=None, dark=0):
    for x in range(x0,x1+1):
        t=FOLD[(x-x0)%4]
        bot=y1
        if torn: bot=y1-torn(x)
        for y in range(6,bot+1):
            tt=t
            if y>bot-2: tt=max(1,t-1)
            if y<8: tt=max(1,t-1)
            c.px(x,y,W(max(1,tt-dark)))
    # 밑단 선
        if not torn: c.px(x,y1,W(1)); 
def hem_wrinkle(c,x0,x1):
    for (x,y) in [(x0+1,12),(x0+2,13),(x0+5,16),(x0+6,17),(x0+9,10),(x0+9,11)]:
        c.px(x,y,W(6)) if False else c.px(x,y,W(6-1))
def tornfn(c,x0,x1):
    import random
    rnd=random.Random(7)
    prof={}
    for x in range(x0,x1+1):
        prof[x]=rnd.choice([0,3,8,5,1,10,6,2,9])
    return lambda x: prof.get(x,0)
def strands(c,x0,x1,y1):
    # 찢겨 늘어진 가닥
    for x in range(x0,x1+1,2):
        l=(x*7)%5+1
        for k in range(l): c.px(x,y1+1+k,W(3 if (x-x0)%4<2 else 2)) if c.get(x,y1+1+k) is None and y1+1+k<27 else None

def silhouette(c,x,y,g='*'):
    # 머리 + 어깨 (커튼 위에 얹힌 어둠 글자)
    for yy in range(y,y+4):
        for xx in range(x,x+4):
            if (xx,yy) in [(x,y),(x+3,y),(x,y+3),(x+3,y+3)]: continue
            c.px(xx,yy,g)
    for yy in range(y+4,y+16):
        w=6+min(6,(yy-y-4))
        xs=x+2-w//2+1
        for xx in range(xs,xs+w+1):
            c.px(xx,yy,g)

# A
c=C(32,32); curtain(c,3,14); curtain(c,17,28,torn=tornfn(c,17,28)); frame(c); strands(c,17,28,25)
c.save(S,'h2-A','A: 회색 tin 쇠 틀에 바퀴 받침, 고리에 걸린 바랜 회녹 ward 커튼 두 폭. 오른쪽 폭은 아랫단이 찢겨 들쭉날쭉 늘어진다. hosp_bed 와 같은 쇠 색, rust 점.'); run(S,'h2-A')
# B
c=C(32,32); curtain(c,3,14); curtain(c,17,28,torn=tornfn(c,17,28)); frame(c); strands(c,17,28,25)
for y in range(6,26):
    for x in range(3,15):
        g=c.get(x,y)
        if g and g[0]=='ward' and y>10: c.px(x,y,W(max(1,g[1])))
silhouette(c,6,8,'*')
for x in range(2,30): c.px(x,31,'-') if c.get(x,31) is None else None
c.save(S,'h2-B','B: 형태는 A 와 같고 왼쪽 폭 뒤에 사람 그림자(머리·어깨) 하나를 * 어둠 덮개로 얹었다. 주름 명암 폭을 유지, 받침 아래에 - 그림자.'); run(S,'h2-B')
# C
c=C(32,32)
curtain(c,3,14,dark=1)
# 오른쪽 폭은 통째 찢겨 세로 가닥 세 줄만
for x0 in (18,22,26):
    curtain(c,x0,x0+1,y1=26-((x0*3)%5)*2)
curtain(c,17,17,y1=12); 
frame(c)
# 가운데 열린 자리에 키 큰 그림자: 머리 길쭉, 팔 길게
for yy in range(7,11):
    for xx in range(20,23):
        c.px(xx,yy,'&')
for yy in range(11,27):
    for xx in range(19,24): c.px(xx,yy,'*' if yy<20 else '&')
# 긴 팔
for k in range(8):
    c.px(19-k//2-1,13+k,'&'); c.px(24+k//2+1,13+k,'&')
c.save(S,'h2-C','C: 오른쪽 폭이 다 찢겨 세로 가닥 세 줄만 남고, 열린 자리에 머리가 길쭉하고 팔이 늘어진 키 큰 그림자(& 짙은 어둠)가 서 있다. 왼쪽 폭은 한 단 어둡게. 커튼 너머가 아니라 커튼이 사라진 자리라 실루엣이 더 크다.'); run(S,'h2-C')

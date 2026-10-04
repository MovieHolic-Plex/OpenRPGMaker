import sys; sys.path.insert(0,'.')
from lib import *
D=lambda t:('dust',t)
def lerp(a,b,t): return (round(a[0]+(b[0]-a[0])*t), round(a[1]+(b[1]-a[1])*t))
def corner(c, rad_ends, ts, tone_rad, tone_arc, gap=None, sag=0.0):
    o=(0,0)
    for e in rad_ends: c.line(0,0,e[0],e[1],tone_rad)
    for ti,t in enumerate(ts):
        pts=[lerp(o,e,t) for e in rad_ends]
        for i in range(len(pts)-1):
            if gap==(ti,i): continue
            p,q=pts[i],pts[i+1]
            c.line(p[0],p[1],q[0],q[1],tone_arc)
def shade(c, tone='-'):
    pts=[(x,y) for y in range(c.h) for x in range(c.w) if c.g[y][x] is not None and not isinstance(c.g[y][x],str)]
    for x,y in pts:
        if c.get(x+1,y+1) is None: c.px(x+1,y+1,tone)

E4=[(15,2),(13,8),(8,13),(2,15)]
# ---------- cobweb_corner
S='cobweb_corner'
c=C(16,16); corner(c,E4,[0.42,0.72,0.97],D(3),D(5),gap=(2,1))
# 끊겨 늘어진 줄
pts=[lerp((0,0),E4[1],0.94),lerp((0,0),E4[2],0.94)]
c.line(pts[0][0],pts[0][1],pts[0][0]+1,pts[0][1]+3,D(4)); c.px(pts[0][0]+1,pts[0][1]+4,D(3))
for (x,y) in [(1,1),(2,1),(1,2)]: c.px(x,y,D(6))
c.save(S,'h2-A','A: 왼쪽 위 모서리에서 방사 줄 넷 + 호 줄 세 겹(dust 3~5), 안쪽 호 하나가 끊겨 줄 끝이 늘어짐.'); run(S,'h2-A')
c=C(16,16); corner(c,E4,[0.42,0.75,1.0],D(4),D(6),gap=(2,2))
for (x,y) in [(1,1),(2,1),(1,2),(2,2)]: c.px(x,y,D(6))
pts=[lerp((0,0),E4[1],1.0)]
c.line(pts[0][0],pts[0][1],pts[0][0]+1,pts[0][1]+4,D(5)); c.px(pts[0][0]+1,pts[0][1]+5,D(2))
shade(c,'-')
# 이슬 한 점
c.px(8,5,D(6)) if c.get(8,5) is None else None
c.save(S,'h2-B','B: 줄 밝기를 dust 4~6 으로 올리고 줄마다 오른쪽 아래에 - 그림자를 붙여 벽에서 뜬 느낌. 모서리 뭉침은 가장 밝게.'); run(S,'h2-B')
# C: 촘촘한 깔때기 + 매달린 고치
c=C(16,16); corner(c,[(15,1),(15,6),(12,11),(7,14),(2,15)],[0.5,0.92],D(3),D(4))
c.line(9,7,9,9,D(4))
COC=[".ss.","sSss","sSss","sSSs","sSss","sSSs",".ss.","..s."]
c.art(8,9,COC,{'s':('sheet',5),'S':('sheet',3)})
for y in (11,13): c.hl(8,11,y,('dust',2))
c.px(10,10,('sheet',6)); c.px(9,10,('sheet',6))
c.save(S,'h2-C','C: 방사 줄 다섯의 촘촘한 깔때기 웹, 한가운데 줄 하나에 사람만 한 흰 고치(sheet)가 매달려 실루엣이 웹보다 고치로 읽힌다.'); run(S,'h2-C')
# ---------- cobweb_hang
S='cobweb_hang'
def sag_row(c,y,x0,x1,depth,tone):
    n=x1-x0
    for x in range(x0,x1+1):
        t=(x-x0)/n; dy=round(depth*4*t*(1-t))
        c.px(x,y+dy,tone)
def spider(c,x,y,body,leg):
    c.px(x,y,body); c.px(x+1,y,body); c.px(x,y+1,body); c.px(x+1,y+1,body)
    for dx,dy in [(-1,0),(-1,2),(2,0),(2,2),(-1,1),(2,1)]: c.px(x+dx,y+dy,leg)
c=C(16,16)
sag_row(c,1,0,15,2,D(5)); sag_row(c,4,0,15,3,D(4)); sag_row(c,7,2,13,2,D(3))
for x in (2,7,13): 
    c.vl(x,0,3 if x!=7 else 4,D(3))
c.vl(7,5,9,D(4)); spider(c,7,10,('void',1),('void',3))
c.px(3,2,D(6)); c.px(4,2,D(6)); c.px(1,1,D(6))
c.save(S,'h2-A','A: 가로로 처진 줄 세 겹을 세로 줄이 잇고 가운데 줄에 검은 거미 한 마리가 매달림.'); run(S,'h2-A')
c=C(16,16)
sag_row(c,1,0,15,2,D(6)); sag_row(c,4,0,15,3,D(5)); sag_row(c,7,2,13,2,D(4))
for x in (2,7,13): c.vl(x,0,3 if x!=7 else 4,D(4))
c.vl(7,5,9,D(5)); spider(c,7,10,('void',0),('grave',3))
shade(c,'-')
for (x,y) in [(4,3),(10,3),(6,6)]: 
    if c.get(x,y) is None: c.px(x,y,D(6))
c.save(S,'h2-B','B: 줄을 dust 5~6 으로 밝히고 오른쪽 아래 - 그림자, 거미는 다리에 grave 로 옅은 빛을 받아 어두운 방에서도 보인다.'); run(S,'h2-B')
c=C(16,16)
def thread(c,x,ln,wob,tone):
    xx=x
    for y in range(0,ln+1):
        if y in wob: xx+=wob[y]
        c.px(xx,y,tone)
    return xx
ends=[]
ends.append((thread(c,1,8,{4:1},D(4)),8))
ends.append((thread(c,4,13,{3:-1,8:1},D(5)),13))
ends.append((thread(c,8,6,{3:1},D(3)),6))
ends.append((thread(c,11,14,{5:1,10:-1},D(4)),14))
ends.append((thread(c,14,10,{6:-1},D(5)),10))
for (x,e) in ends:
    if e>=10:
        for dx,dy,t in [(0,1,5),(-1,1,3),(1,1,6),(0,2,4),(-1,2,3),(1,2,4)]:
            c.px(x+dx,e+dy,('sheet',t))
c.line(1,3,4,2,D(4)); c.line(4,5,8,4,D(3)); c.line(11,4,14,5,D(4))
spider(c,6,7,('void',1),('void',3)); c.vl(7,4,6,D(3))
c.save(S,'h2-C','C: 위에서 세로로 길게 늘어진 줄 다섯(길이 제각각) 끝에 흰 알주머니가 달리고 거미 한 마리가 내려오는 중. 가로 호는 두 겹만.'); run(S,'h2-C')

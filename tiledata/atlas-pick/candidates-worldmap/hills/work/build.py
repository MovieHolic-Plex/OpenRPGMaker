import sys, math; sys.path.insert(0,'../../plains_base/work')
from w2lib import *
LEG = {'D':('wgrass',1),'d':('wgrass',2),'g':('wgrass',3),'h':('wgrass',4),'H':('wgrass',5)}

def mound(g, cx, cy, w, h, hi='h', hh='H', mid='g', sh='d', dk='D', rimdark=True):
    """cx: 가운데, cy: 밑줄 y, 반타원 언덕. 왼쪽 위 밝게, 오른쪽 아래 어둡게."""
    for x in range(cx - w//2, cx + w//2 + 1):
        t = (x - cx) / (w/2)
        if abs(t) > 1: continue
        top = cy - int(round(h * math.sqrt(1 - t*t)))
        for y in range(top, cy+1):
            c = mid
            if y == top:
                c = hh if t < -0.35 else (hi if t < 0.35 else mid)
                if t >= 0.35: c = sh
            elif y == top+1 and t < -0.5: c = hi
            elif y == top+1 and t > 0.35: c = sh
            if abs(t) > 0.8 and y > top and t > 0: c = sh
            if y == cy: c = dk if t > 0.1 else (sh if t > -0.4 else mid)
            stamp(g, [c], x, y)
def tile(base, mounds, extra=()):
    g = blank(16,16,base)
    for m in mounds: mound(g, *m[:4], **(m[4] if len(m)>4 else {}))
    for sh,x,y in extra: stamp(g, sh, x, y)
    return rows(g)

def mk(P_common, tex, texalt, color, name):
    return dict(P_common, tex=tex, texalt=texalt, color=color)

# ---- A: 낮은 대비, 작은 언덕 둘 ----
def colA(x,y,d,lit,t,cell):
    if d==1: return 'd' if not lit else 'g'
    if d==2 and lit: return 'h'
    return t
kA = dict(hi='h', hh='h', mid='g', sh='d', dk='d')
texA = tile('g', [(5,7,9,4,kA),(12,15,8,3,kA)])
texA2 = tile('g', [(4,6,8,3,kA),(11,13,10,4,kA)])
jN=[0,0,1,0,0,0,1,0,0,0,0,1,0,0,0,0]; jS=[0,0,0,1,0,0,0,0,1,0,0,0,1,0,0,0]
PA = dict(E=1,R=4,RN=1,wN=jN,wS=jS,wW=jN[::-1],wE=jS[::-1],tex=texA,texalt=texA2,color=colA,shadow='soft')
# ---- B: 빛 세게 ----
def colB(x,y,d,lit,t,cell):
    if d==1: return 'D' if not lit else 'd'
    if d==2: return 'H' if lit else 'd'
    if d==3 and not lit: return 'd'
    return t
kB = dict(hi='h', hh='H', mid='g', sh='d', dk='D')
texB = tile('g', [(5,8,10,5,kB),(12,15,7,4,kB)])
texB2 = tile('g', [(4,7,9,4,kB),(11,14,10,5,kB)])
PB = dict(E=1,R=4,RN=1,wN=jN,wS=jS,wW=jN[::-1],wE=jS[::-1],tex=texB,texalt=texB2,color=colB,shadow=True)
# ---- C: 큰 한 덩이 언덕 (척도), 윤곽 굵게 ----
def colC(x,y,d,lit,t,cell):
    if d<=2: return 'D' if (d==1 or not lit) else 'd'
    if d==3 and lit: return 'h'
    return t
kC = dict(hi='h', hh='H', mid='g', sh='d', dk='D')
texC = tile('g', [(8,14,15,10,kC)])
texC2 = tile('g', [(7,13,15,9,kC)])
PC = dict(E=1,R=5,RN=1,wN=[0,0,0,1,1,0,0,0,0,1,1,0,0,0,0,0],wS=[0]*16,wW=[0,1,1,0,0,0,0,0,1,0,0,0,0,0,1,0],wE=[0]*16,tex=texC,texalt=texC2,color=colC,shadow=True)
for X,P in (('A',PA),('B',PB),('C',PC)):
    write(f'../w2-{X}.pxg', bundle(P), LEG, f'hills w2-{X}')

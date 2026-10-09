import sys; sys.path.insert(0,'../../plains_base/work')
from w2lib import *
LEG = {'a':('wdirt',0),'b':('wdirt',1),'c':('wdirt',2),'d':('wdirt',3),'e':('wdirt',4),
       'i':('wgrass',1),'g':('wgrass',2),'h':('wgrass',3),'j':('wgrass',4)}
def texgen(base, strokes):
    g = blank(16,16,base)
    for sh,x,y in strokes: stamp(g, sh, x, y)
    return rows(g)
# 흙 결: 짧은 어두운 획 + 밝은 알갱이
texA = texgen('d',[(['cc'],3,3),(['c'],5,4),(['e'],9,2),(['cc'],11,7),(['e'],2,8),(['c','c'],7,9),(['e','e'],13,12),(['cc'],4,13),(['c'],9,14),(['e'],6,5)])
texA2= texgen('d',[(['cc'],1,4),(['e'],5,2),(['c','c'],10,4),(['cc'],6,8),(['e'],12,10),(['c'],3,12),(['cc'],9,13),(['e'],14,6)])
sym=lambda a:a
w0=[0,0,1,0,0,0,1,0,0,1,0,0,0,1,0,0]
w1=[0,1,0,0,1,0,0,0,1,0,0,1,0,0,0,1]
# ---- A: 강남 결, 저대비 ----
def colA(x,y,d,lit,t,cell):
    if d==1: return 'h' if ((x*7+y*3)%5==0) else 'b'
    if d==2: return 'd' if lit else 'c'
    return t
PA=dict(E=4,R=4,RN=1,EI=3,RI=4,wN=w0,wS=w0,wW=w1,wE=w1,tex=texA,texalt=texA2,color=colA,shadow=False)
# ---- B: 빛 볼륨 ----
def colB(x,y,d,lit,t,cell):
    if d==1:
        if lit: return 'a' if (x+y)%3 else 'i'
        return 'a'
    if d==2: return ('e' if (x+y)%2==0 else 'd') if lit else ('b' if (x+y)%3 else 'c')
    if d==3 and not lit: return 'c'
    if t=='e' and lit is False: return 'd'
    return t
texB = texgen('d',[(['cc'],3,3),(['e','e'],4,5),(['e'],9,2),(['b','c'],11,6),(['e','e'],2,9),(['c','c'],7,9),(['e'],13,11),(['cc'],4,13),(['b'],9,14),(['e'],6,6)])
texB2= texgen('d',[(['cc'],1,4),(['e','e'],5,2),(['b','c'],10,4),(['cc'],6,8),(['e'],12,10),(['c'],3,12),(['bc'],9,13),(['e'],14,6)])
PB=dict(E=4,R=4,RN=1,EI=3,RI=4,wN=w1,wS=w1,wW=w0,wE=w0,tex=texB,texalt=texB2,color=colB,shadow=False)
# ---- C: 넓고 닳은 길(10px), 풀이 크게 덮임 ----
def colC(x,y,d,lit,t,cell):
    if d==1: return 'g' if ((x+y*2)%3) else 'j'
    if d==2: return 'b' if ((x*5+y)%4==0) else 'c'
    if d==3: return 'd'
    return t
texC = texgen('d',[(['cc','cc'],2,2),(['e'],7,3),(['bb'],10,5),(['c','c'],4,8),(['e','e'],12,9),(['cc'],8,12),(['bb'],1,13),(['e'],14,14),(['c'],6,6)])
texC2= texgen('d',[(['cc','cc'],10,2),(['e'],3,4),(['bb'],5,9),(['c','c'],13,7),(['e','e'],8,11),(['cc'],2,13)])
PC=dict(E=3,R=4,RN=1,EI=2,RI=5,wN=w0,wS=w0,wW=w1,wE=w1,tex=texC,texalt=texC2,color=colC,shadow=False)
for X,P in (('A',PA),('B',PB),('C',PC)):
    write(f'../w2-{X}.pxg', bundle(P), LEG, f'road w2-{X}')

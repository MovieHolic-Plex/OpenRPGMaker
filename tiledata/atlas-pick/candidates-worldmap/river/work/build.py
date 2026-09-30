import sys; sys.path.insert(0,'../../plains_base/work')
from w2lib import *
LEG = {'a':('wriver',0),'b':('wriver',1),'c':('wriver',2),'d':('wriver',3),'e':('wriver',4),'f':('wfoam',0),
       'i':('wgrass',1),'g':('wgrass',2),'h':('wgrass',3),'j':('wgrass',4)}
def texgen(base, strokes):
    g = blank(16,16,base)
    for sh,x,y in strokes: stamp(g, sh, x, y)
    return rows(g)
texA = texgen('c',[(['dd'],2,2),(['b'],5,4),(['b','b'],10,1),(['dd'],9,6),(['b'],3,8),(['d','d'],13,9),(['bb'],6,11),(['dd'],1,13),(['b'],11,13),(['f'],7,7)])
texA2= texgen('c',[(['dd'],7,2),(['bb'],2,5),(['d','d'],12,4),(['b'],8,9),(['dd'],3,10),(['b','b'],13,12),(['bb'],9,14)])
w0=[0,0,1,0,0,0,1,0,0,1,0,0,0,1,0,0]
w1=[0,1,0,0,1,0,0,0,1,0,0,1,0,0,0,1]
def colA(x,y,d,lit,t,cell):
    if d==1: return 'g' if (x+y)%3 else 'h'
    if d==2: return 'h' if (x*3+y)%5==0 else ('e' if not lit else 'd')
    return t
PA=dict(E=3,R=4,RN=1,EI=3,RI=4,wN=w0,wS=w0,wW=w1,wE=w1,tex=texA,texalt=texA2,color=colA,shadow=False)
# B: 위·왼 둑은 밝은 풀, 아래·오른 둑은 짙은 그늘 + 그림자가 물에 드리움
texB = texgen('c',[(['ddd'],2,2),(['b'],5,4),(['b','b'],10,1),(['dd'],9,6),(['e'],10,6),(['b'],3,8),(['d','d'],13,9),(['bb'],6,11),(['ddd'],1,13),(['b'],11,13),(['f'],7,7),(['f'],1,3)])
texB2= texgen('c',[(['ddd'],7,2),(['bb'],2,5),(['d','d'],12,4),(['b'],8,9),(['dd'],3,10),(['e'],4,10),(['b','b'],13,12),(['bb'],9,14),(['f'],6,6)])
def colB(x,y,d,lit,t,cell):
    if d==1: return 'j' if lit and (x+y)%2 else ('h' if lit else 'i')
    if d==2: return 'g' if lit else 'i'
    if d==3: return 'f' if lit and (x*3+y)%4==0 else ('e' if lit else 'a')
    if d==4 and not lit: return 'b'
    return t
PB=dict(E=3,R=4,RN=1,EI=3,RI=4,wN=w1,wS=w1,wW=w0,wE=w0,tex=texB,texalt=texB2,color=colB,shadow=False)
# C: 폭 12px 깊고 잔잔한 큰 개울, 둑 2px 풀
texC = texgen('b',[(['cc'],2,3),(['dd'],6,2),(['a'],10,5),(['cc'],9,9),(['d'],3,10),(['a','a'],13,7),(['cc'],5,13),(['dd'],12,12),(['f'],8,6)])
texC2= texgen('b',[(['cc'],9,3),(['dd'],3,6),(['a'],6,10),(['cc'],12,9),(['d'],2,12),(['a','a'],14,2)])
def colC(x,y,d,lit,t,cell):
    if d==1: return 'i' if (x+y)%2 else 'g'
    if d==2: return 'g' if (x*5+y)%4 else 'h'
    if d==3: return 'd' if lit else 'c'
    return t
PC=dict(E=2,R=5,RN=1,EI=2,RI=5,wN=w0,wS=w0,wW=w1,wE=w1,tex=texC,texalt=texC2,color=colC,shadow=False)
for X,P in (('A',PA),('B',PB),('C',PC)):
    write(f'../w2-{X}.pxg', bundle(P), LEG, f'river w2-{X}')

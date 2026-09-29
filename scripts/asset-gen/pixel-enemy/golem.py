"""Original basalt golem. 64px, two heavy steps and paired hammer fists."""
import sys
sys.dont_write_bytecode = True
from pe_lib import Pen, build
CELL=64
PAL=dict(o='252632',s='414352',b='686976',l='9197a0',h='c0c7c7',m='486553',v='6d8c63',e='e6bd71',r='bb7748')

def draw(n):
    p=Pen(CELL,PAL)
    if n=='dead':
        for x,y,w,h in [(12,53,13,8),(25,49,15,12),(39,54,14,7),(31,45,10,7)]: p.stone(x,y,w,h)
        p.line([(27,52),(30,53),(29,57)],'o'); return p
    lean={'windup':-2,'attack':4,'hit':-3,'recover':1}.get(n,0)
    bob={'idle_a':0,'idle_b':1,'idle_c':2}.get(n,0)
    # Weight-bearing feet stay on y60; alternate move stance opens the gap.
    for x,y in [(20,48),(36,47 if n=='move' else 48)]:
        p.stone(x,y,11,13 if y==48 else 14)
        p.line([(x+2,58),(x+7,58)],'h')
    x,y=21+lean,31+bob
    p.stone(x,y,24,23)
    p.poly([(x+3,y+2),(x+15,y+2),(x+20,y+7),(x+13,y+11),(x+3,y+9)],'l')
    p.line([(x+13,y+3),(x+10,y+8),(x+13,y+11),(x+11,y+18)],'s')
    p.stone(26+lean,21+bob,15,14)
    p.line([(28+lean,23+bob),(35+lean,23+bob)],'h')
    p.box((34+lean,27+bob,38+lean,28+bob),'o'); p.box((35+lean,27+bob,38+lean,27+bob),'e')
    p.line([(34+lean,31+bob),(39+lean,31+bob)],'s')
    if n=='windup': arms=[(13,20,13,17),(39,17,13,18)]
    elif n=='attack': arms=[(32,41,12,18),(43,43,14,18)]
    elif n=='move': arms=[(12,34,12,17),(43,30,12,18)]
    elif n=='hit': arms=[(9,32,12,18),(40,38,12,17)]
    else: arms=[(12+lean,34+bob,12,18),(42+lean,34+bob,12,18)]
    for ax,ay,w,h in arms:
        p.stone(ax,ay,w,h)
        p.line([(ax+3,ay+h-5),(ax+w-4,ay+h-5)],'s')
        p.line([(ax+5,ay+h-4),(ax+5,ay+h-2)],'o')
        if n=='attack': p.line([(ax+3,ay+1),(ax+7,ay+1)],'h')
    ax,ay,_,_=arms[0]
    p.poly([(ax+3,ay+1),(ax+7,ay+1),(ax+8,ay+4),(ax+5,ay+5),(ax+2,ay+4)],'m')
    p.line([(ax+3,ay+1),(ax+6,ay+1)],'v')
    p.line([(x+4,y+13),(x+7,y+14),(x+6,y+18)],'o')
    p.line([(x+16,y+13),(x+19,y+13)],'l')
    return p
if __name__=='__main__': build('golem',CELL,PAL,draw)

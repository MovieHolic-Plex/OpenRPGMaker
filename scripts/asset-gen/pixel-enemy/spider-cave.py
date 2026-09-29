"""Original cave spider: eight articulated legs, marked abdomen, hooked fangs."""
import sys
sys.dont_write_bytecode = True
from pe_lib import Pen, build
CELL=48
PAL=dict(o='252334',s='44354a',b='70516a',l='9b7288',h='c299a1',v='b0734d',e='efad62',r='d25955',t='e0c2a0')

def draw(n):
    p=Pen(CELL,PAL)
    if n=='dead':
        for pts in [[(15,42),(10,36),(17,38)],[(20,43),(18,34),(23,38)],[(27,43),(29,35),(30,40)],[(31,43),(37,36),(35,43)]]:
            p.line(pts,'o',3); p.line(pts,'l')
        p.poly([(16,38),(23,36),(29,38),(34,41),(32,44),(17,44),(13,42)],'b','o'); return p
    y=33+{'idle_b':-1,'idle_c':1,'windup':1,'move':-1,'hit':1,'recover':-1}.get(n,0)
    # Four far legs and four near legs. Joint silhouette changes, no mirrored sprite.
    spread=2 if n in ('move','attack') else -1 if n=='windup' else 0
    far=[[(19,y),(12,27),(8-spread,35)],[(23,y),(21,25),(16,30)],[(27,y),(32,24),(37+spread,32)],[(30,y),(38,28),(42,37)]]
    near=[[(19,y+3),(10,35),(7-spread,43)],[(22,y+4),(18,39),(16-spread,43)],[(28,y+4),(32,38),(34+spread,43)],[(31,y+2),(39,35),(42+spread,43)]]
    for pts in far: p.line(pts,'o',3); p.line(pts,'b')
    p.poly([(13,y-4),(19,y-7),(25,y-5),(29,y),(26,y+6),(19,y+8),(12,y+4),(10,y)],'b','o')
    p.poly([(13,y-3),(19,y-5),(23,y-4),(24,y-1),(20,y+1),(13,y)],'l')
    p.poly([(15,y+1),(20,y-1),(24,y+2),(20,y+5)],'v')
    p.line([(14,y-3),(17,y-4),(20,y-4)],'h')
    p.poly([(12,y+1),(16,y+4),(21,y+6),(19,y+7),(13,y+4)],'s')
    if n=='attack': near[-1]=[(31,y+2),(40,32),(44,35)]
    for pts in near:
        p.line(pts,'o',3); p.line(pts,'l')
        x,yj=pts[1]; p.line([(x,yj),(x+1,yj+1)],'h')
    p.poly([(26,y-2),(31,y-3),(36,y),(36,y+5),(31,y+7),(25,y+4)],'b','o')
    p.line([(27,y-1),(31,y-2),(34,y)],'h')
    p.grid(31,y,['ee.e','oo.o','rr.r'])
    if n=='hit': p.line([(31,y),(33,y+1),(31,y+2)],'o')
    f=2 if n=='attack' else 0
    p.poly([(34,y+4),(38+f,y+4),(37+f,y+8),(35,y+7)],'t','o')
    p.poly([(31,y+6),(34+f,y+7),(33+f,y+10),(31,y+9)],'t','o')
    return p
if __name__=='__main__': build('spider-cave',CELL,PAL,draw)

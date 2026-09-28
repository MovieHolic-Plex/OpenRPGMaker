"""Original bone archer. Skull profile, separate radius/ulna and drawn bowstring."""
import sys
sys.dont_write_bytecode = True
from pe_lib import Pen, build
CELL=48
PAL=dict(o='292936',s='6b6062',b='c7b799',l='eee0b9',h='fff0d0',r='96554a',w='65473f',t='b27d53',e='e77a59')

def draw(n):
    p=Pen(CELL,PAL)
    if n=='dead':
        p.line([(11,43),(21,41),(31,43)],'b',2); p.line([(15,39),(23,43),(33,40)],'l')
        p.poly([(26,38),(31,37),(35,39),(35,43),(29,44),(26,42)],'b','o')
        p.box((31,39,33,40),'o'); p.line([(36,36),(40,39),(39,44)],'t'); return p
    dy={'idle_a':0,'idle_b':1,'idle_c':2}.get(n,0)
    dx=-1 if n in ('windup','hit') else 0
    # Pelvis and legs, stance anchored to the floor.
    p.line([(22,33),(20,38),(18,43),(22,43)],'o',3)
    p.line([(22,33),(20,38),(18,43),(22,43)],'b')
    p.line([(25,33),(27,39),(29,43),(32,43)],'o',3)
    p.line([(25,33),(27,39),(29,43),(32,43)],'l')
    p.line([(22+dx,22+dy),(23,33)],'s',3)
    for y in [24,27,30]:
        p.line([(20+dx,y+dy),(26+dx,y+dy),(27+dx,y+dy+1)],'b')
        p.line([(20+dx,y+dy),(21+dx,y+dy+1)],'l')
    p.poly([(20,32),(25,32),(28,34),(25,36),(21,35)],'b','o')
    p.poly([(21+dx,17+dy),(24+dx,15+dy),(29+dx,16+dy),(30+dx,20+dy),(32+dx,21+dy),(30+dx,23+dy),(25+dx,23+dy),(21+dx,21+dy)],'b','o')
    p.line([(23+dx,17+dy),(27+dx,17+dy)],'l')
    p.box((27+dx,18+dy,29+dx,20+dy),'o')
    p.box((28+dx,19+dy,29+dx,19+dy),'e')
    p.line([(22+dx,18+dy),(22+dx,20+dy)],'l')
    p.grid(27+dx,22+dy,['b.b','l.l'])
    p.line([(26+dx,23+dy),(30+dx,24+dy)],'l')
    bx=36 if n!='hit' else 33
    p.line([(bx-2,17),(bx+1,21),(bx+2,27),(bx,34),(bx-3,38)],'o',3)
    p.line([(bx-2,17),(bx+1,21),(bx+2,27),(bx,34),(bx-3,38)],'t')
    pulled=n in ('windup','move')
    sx=(26 if n=='windup' else 22) if pulled else bx-1
    p.line([(bx-2,17),(sx,27),(bx-3,38)],'l')
    p.line([(24+dx,25+dy),(29,28),(bx+1,27)],'o',3)
    p.line([(24+dx,25+dy),(29,28),(bx+1,27)],'b')
    p.line([(21+dx,25+dy),(17 if pulled else 27,29),(sx,27)],'o',3)
    p.line([(21+dx,25+dy),(17 if pulled else 27,29),(sx,27)],'l')
    if n=='attack':
        # Releasing hand snaps beside the jaw while the bow arm stays straight.
        p.line([(21,25),(20,28),(24,24)],'o',3)
        p.line([(21,25),(20,28),(24,24)],'l')
    if n not in ('attack','recover','hit'):
        p.line([(sx-1,26),(41,26)],'w')
        p.poly([(40,24),(43,26),(40,28)],'b')
        p.line([(sx,25),(sx+2,26),(sx,27)],'r')
    return p
if __name__=='__main__': build('skeleton-archer',CELL,PAL,draw)

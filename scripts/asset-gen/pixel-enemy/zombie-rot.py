"""Original rotten zombie. Stooped green face, exposed ribs, uneven shuffling gait."""
import sys
sys.dont_write_bytecode = True
from pe_lib import Pen, build
CELL=48
PAL=dict(o='292a34',s='47574e',b='78846a',l='a7ad83',h='d0c399',t='615269',v='887286',r='995b58',w='cabc94',e='e5c877')

def draw(n):
    p=Pen(CELL,PAL)
    if n=='dead':
        p.poly([(10,42),(14,38),(22,39),(27,41),(32,38),(38,41),(38,44),(12,44)],'b','o')
        p.poly([(13,39),(21,40),(24,44),(12,43)],'t')
        p.line([(32,40),(35,41)],'o'); return p
    dx={'windup':-2,'attack':2,'hit':-2}.get(n,0)
    bob={'idle_b':1,'idle_c':2,'recover':1}.get(n,0)
    p.poly([(19,33),(24,34),(24,40),(21,43),(23,44),(17,44),(17,41)],'t','o')
    p.poly([(25,33),(29,34),(29,40),(33,43),(33,44),(27,44),(25,40)],'s','o')
    if n=='move':
        p.poly([(18,35),(21,36),(18,40),(14,42),(13,40)],'b','o')
        p.line([(16,40),(18,38)],'l')
    p.poly([(21+dx,22+bob),(27+dx,22+bob),(29+dx,28),(30,35),(26,38),(23,35),(19,36),(17+dx,29)],'t','o')
    p.line([(20,34),(21,32),(22,35),(24,33)],'o')
    p.line([(19+dx,24+bob),(20+dx,23+bob),(22+dx,23+bob)],'h')
    p.poly([(19+dx,25+bob),(22+dx,24+bob),(22,31),(20,34),(18,32)],'v')
    p.poly([(24+dx,25+bob),(28+dx,27+bob),(28,32),(24,33)],'s')
    for y in [27,29,31]: p.line([(24+dx,y),(27+dx,y+1)],'w')
    hx,hy=25+dx,17+bob
    p.poly([(hx-2,hy),(hx+2,hy-2),(hx+6,hy),(hx+6,hy+3),(hx+8,hy+5),(hx+6,hy+8),(hx,hy+8),(hx-3,hy+5)],'b','o')
    p.poly([(hx-1,hy),(hx+2,hy-1),(hx+4,hy+1),(hx+2,hy+3),(hx-2,hy+3)],'l')
    p.box((hx+3,hy+3,hx+5,hy+4),'o'); p.box((hx+4,hy+3,hx+5,hy+3),'e')
    p.line([(hx+3,hy+7),(hx+6,hy+7)],'r')
    p.box((hx-1,hy+3,hx,hy+4),'s')
    p.line([(hx+4,hy+6),(hx+6,hy+6)],'w')
    p.line([(20,37),(21,39)],'v')
    p.box((27,39,28,40),'r')
    if n=='windup': arms=[[(20,25),(16,20),(20,16)],[(27,25),(32,20),(31,16)]]
    elif n=='attack': arms=[[(22,26),(29,31),(37,35)],[(28,25),(36,29),(40,34)]]
    elif n=='hit': arms=[[(19,26),(13,29),(12,34)],[(27,26),(32,28),(35,26)]]
    else: arms=[[(20+dx,26+bob),(24,31+bob),(31,31+bob)],[(28+dx,25+bob),(32,28+bob),(37,28+bob)]]
    for pts in arms:
        p.line(pts,'o',4); p.line(pts,'b',2)
        x,y=pts[-1]; p.line([(x-1,y),(x+1,y+1),(x+1,y+3)],'l')
    if n=='hit':
        p.line([(hx+3,hy+3),(hx+5,hy+4),(hx+3,hy+5)],'o')
    return p
if __name__=='__main__': build('zombie-rot',CELL,PAL,draw)

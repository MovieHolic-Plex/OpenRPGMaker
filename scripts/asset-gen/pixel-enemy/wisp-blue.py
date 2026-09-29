"""Original blue will-o-wisp. Clustered cold flame and a right-facing mask."""
import sys
sys.dont_write_bytecode = True
from pe_lib import Pen, build
CELL=48
PAL=dict(o='28324e',s='354c81',b='427dc0',l='5fb8da',h='a2e1ea',w='e2f5e8',e='243550')

def draw(n):
    p=Pen(CELL,PAL)
    if n=='dead':
        p.poly([(15,43),(18,40),(23,41),(26,39),(31,42),(34,44),(17,44)],'s')
        p.line([(20,42),(24,43),(28,42)],'l'); return p
    dx={'windup':-2,'move':1,'attack':3,'hit':-2}.get(n,0)
    dy={'idle_b':-1,'idle_c':-2,'windup':1,'move':-1,'recover':1,'hit':2}.get(n,0)
    def poly(pts,c): p.poly([(x+dx,y+dy) for x,y in pts],c)
    poly([(21,39),(16,36),(12,30),(13,24),(18,18),(16,12),(23,17),(27,10),(29,19),(34,23),(36,29),(33,35),(28,39),(24,42)],'s')
    poly([(21,37),(16,32),(15,27),(19,22),(20,17),(24,22),(27,15),(28,22),(32,24),(34,29),(31,34),(27,37),(24,39)],'b')
    poly([(18,29),(20,24),(24,26),(27,20),(29,25),(32,28),(30,33),(25,36),(21,34)],'l')
    poly([(20,29),(23,27),(25,29),(28,25),(30,29),(28,33),(23,33)],'h')
    poly([(22,29),(25,30),(28,28),(28,31),(25,33),(22,32)],'w')
    # Cut across the nested flame bands: light on upper left, long cool lower-right edge.
    poly([(15,25),(19,21),(20,17),(22,21),(20,27),(18,31),(16,29)],'h')
    poly([(30,31),(33,28),(33,33),(28,38),(24,40),(27,35)],'s')
    poly([(18,31),(21,32),(24,36),(22,37),(18,34)],'l')
    p.grid(26+dx,25+dy,['ee.e','ee.e'])
    p.line([(29+dx,31+dy),(32+dx,30+dy)],'e')
    # An asymmetrical flame crown bends rather than only bobbing a rigid outline.
    if n in ('idle_b','move'):
        poly([(24,18),(26,11),(29,9),(28,15),(30,20)],'b')
        poly([(25,20),(27,14),(28,13),(27,21)],'l')
    if n=='hit':
        poly([(25,25),(32,25),(33,28),(26,28)],'l')
        p.line([(26+dx,25+dy),(28+dx,27+dy),(26+dx,28+dy)],'e')
    if n=='attack':
        poly([(31,28),(38,24),(40,26),(35,30),(39,31),(36,34),(31,33)],'l')
        p.line([(35+dx,28+dy),(38+dx,26+dy)],'w')
    return p
if __name__=='__main__': build('wisp-blue',CELL,PAL,draw)

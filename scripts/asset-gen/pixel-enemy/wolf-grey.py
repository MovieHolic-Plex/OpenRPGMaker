"""Original grey wolf: long muzzle, bristled ruff, low dash and open-jaw bite."""
import sys
sys.dont_write_bytecode = True
from pe_lib import Pen, build
CELL=48
PAL=dict(o='232939',s='414b60',b='748094',l='a7b3bb',h='d6dcd4',w='eee4c7',e='e9b866',r='a45960')

def draw(n):
    p=Pen(CELL,PAL)
    if n=='dead':
        p.poly([(7,41),(13,38),(23,39),(30,41),(38,39),(42,42),(39,44),(12,44)],'b','o')
        p.line([(12,40),(24,41),(29,43)],'l'); p.line([(35,41),(37,42),(39,41)],'o'); return p
    low=n in ('windup','move','attack'); y=32 if low else 29+{'idle_b':1,'idle_c':2}.get(n,0)
    # Tail grows out of the rump and points backwards, not a detached effect.
    p.poly([(15,y+2),(10,y),(7,y-4),(6,y+1),(9,y+6),(16,y+7)],'b','o')
    p.line([(8,y),(11,y+3),(14,y+3)],'l')
    # Far hind and fore paws: all four legs read independently of the near stride.
    for pts in [[(19,y+5),(22,39),(20,42),(23,42),(25,38)],[(29,y+5),(27,40),(26,42),(29,42),(31,38)]]:
        p.poly(pts,'s','o')
    legs=[[(16,y+6),(14,40),(11,43),(16,44),(19,38)],[(29,y+6),(30,40),(30,44),(35,44),(33,42),(34,y+5)]]
    if n=='move': legs=[[(17,y+4),(12,39),(8,41),(9,43),(15,42),(22,36)],[(28,y+5),(34,37),(39,41),(42,42),(41,44),(37,44),(30,40)]]
    for pts in legs: p.poly(pts,'b','o')
    p.poly([(13,y+1),(18,y-1),(25,y),(29,y-3),(34,y-2),(36,y+3),(32,y+8),(25,y+9),(18,y+7),(12,y+6)],'b','o')
    p.poly([(14,y+1),(19,y),(25,y+1),(29,y-1),(31,y+1),(26,y+4),(17,y+4)],'l')
    p.poly([(29,y),(31,y-4),(33,y-2),(35,y-5),(37,y),(35,y+5),(32,y+8),(30,y+5),(28,y+6)],'h')
    hx,hy=(31,27) if low else (30,22+(n=='idle_c'))
    if n=='hit': hx-=2; hy+=2
    p.poly([(hx,hy+2),(hx,hy-3),(hx+3,hy),(hx+5,hy-2),(hx+6,hy+3),(hx+10,hy+5),(hx+11,hy+8),(hx+5,hy+10),(hx+1,hy+8),(hx-2,hy+6)],'b','o')
    p.poly([(hx+1,hy+2),(hx+5,hy+2),(hx+6,hy+5),(hx+10,hy+6),(hx+6,hy+7),(hx+2,hy+6)],'l')
    p.poly([(16,y+5),(22,y+6),(26,y+5),(27,y+8),(22,y+8),(17,y+6)],'s')
    p.line([(15,y+1),(19,y),(22,y+1)],'h')
    p.line([(hx+1,hy),(hx+1,hy+2)],'s')
    p.box((hx+6,hy+4,hx+7,hy+4),'e'); p.box((hx+10,hy+6,hx+11,hy+7),'o')
    if n=='attack':
        p.poly([(hx+5,hy+8),(hx+11,hy+7),(hx+12,hy+12),(hx+6,hy+12),(hx+3,hy+9)],'o')
        p.line([(hx+5,hy+12),(hx+11,hy+13)],'l')
        p.grid(hx+7,hy+8,['w..w','w...']); p.line([(hx+7,hy+11),(hx+9,hy+11)],'r')
    elif n=='hit': p.line([(hx+5,hy+3),(hx+7,hy+4),(hx+5,hy+5)],'o')
    else: p.line([(hx+6,hy+9),(hx+10,hy+8)],'o')
    return p
if __name__=='__main__': build('wolf-grey',CELL,PAL,draw)

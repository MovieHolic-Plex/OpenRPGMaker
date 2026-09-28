"""Original ember slime, NOT recolored slime.py: split flame crest and toothed grin."""
import sys
sys.dont_write_bytecode = True
from pe_lib import Pen, build
CELL=48
PAL=dict(o='542534',s='943744',b='d34b49',l='ef7856',h='ffac6a',w='ffe1a2',e='302635',t='fff0c8')

def draw(n):
    p=Pen(CELL,PAL)
    if n=='dead':
        p.poly([(12,42),(17,40),(23,42),(29,40),(36,42),(35,44),(13,44)],'b','o')
        p.line([(15,42),(20,42)],'h'); p.line([(27,43),(32,43)],'s'); return p
    top={'idle_a':29,'idle_b':30,'idle_c':31,'windup':34,'move':25,'attack':29,'recover':33,'hit':32}[n]
    bottom=40 if n=='move' else 44
    left=12 if n in ('windup','recover') else 14
    right=36 if n in ('windup','recover','attack') else 34
    p.poly([(left,bottom-2),(left,top+7),(left+3,top+3),(20,top+1),(21,top-4),(25,top),(28,top-3),(29,top+3),(right-2,top+5),(right,bottom-3),(right-2,bottom),(left+2,bottom)],'b','o')
    p.poly([(left+2,top+7),(left+5,top+4),(21,top+3),(22,top-1),(26,top+3),(24,top+6),(19,top+6),(left+3,top+10)],'l')
    p.poly([(left+3,bottom-2),(22,bottom-1),(right-2,bottom-4),(right-1,bottom-2),(right-3,bottom-1),(left+4,bottom-1)],'s')
    p.line([(left+5,top+5),(left+7,top+4)],'h',2)
    fy=min(top+7,bottom-6)
    p.grid(25,fy,['ee..ee','ee..ee'])
    if n=='move': p.line([(22,top-2),(24,top),(25,top+1)],'h')
    if n=='attack': p.poly([(17,37),(20,35),(22,38),(20,40),(17,39)],'l')
    # Crooked brows and a cheek ember, unique to this hot-tempered species.
    p.line([(25,fy-2),(27,fy-1)],'s')
    p.line([(30,fy-1),(32,fy-2)],'s')
    p.line([(left+4,bottom-3),(left+6,bottom-3)],'l')
    if n=='attack':
        p.poly([(25,fy+3),(35,fy+2),(35,fy+7),(29,fy+8),(25,fy+6)],'e')
        p.grid(28,fy+3,['tt..tt','t.....'])
    elif n=='hit': p.line([(25,fy),(28,fy+2),(25,fy+3)],'e')
    else:
        p.line([(26,fy+4),(28,fy+5),(32,fy+4)],'e')
        p.box((29,fy+4,30,fy+5),'t')
    return p
if __name__=='__main__': build('slime-red',CELL,PAL,draw)

"""Separate anatomical rigs for hornet, gem fox, carnivore and S-coiled sea dragon."""
from common import *
def hornet(n):
    p=pen(48,dict(s='683833',b='a04d38',l='df8760',h='f7e9bd',a='ad983e',u='e2c453',v='fff0a2',e='e77b51',w='cbdad6'))
    if n=='dead':
        p.poly([(12,43),(9,36),(17,35),(23,41)],'w','o');blob(p,23,41,9,3);p.line([(26,39),(33,36),(38,38)],'s',2);return finish(p,n,True)
    dx,dy,re,sw=POSE[n];x=23+dx;y=26+dy
    # Two wings per side. Idle alternates fan angles, attack narrows span.
    tips={'idle_a':[(7,8),(25,7),(6,19),(35,16)],'idle_b':[(6,12),(26,10),(7,23),(34,19)],'idle_c':[(9,6),(24,5),(8,17),(34,14)],
    'windup':[(6,13),(17,7),(10,23),(34,18)],'move':[(8,8),(21,5),(10,18),(34,14)],'attack':[(12,13),(25,10),(15,22),(33,18)],
    'recover':[(7,12),(19,9),(10,23),(35,19)],'hit':[(6,17),(18,10),(9,25),(34,20)]}[n]
    for i,(tx,ty) in enumerate(tips):
        origin=(x-i%2*2,y-3+i%2*2)
        p.poly([origin,(tx+dx,ty+dy),(tx+dx+3,ty+dy-1),(tx+dx+7,ty+dy+3),((tx+x)//2+dx+3,(ty+y)//2+dy),(x-1,y-2+i%2)],'w','o')
        p.line([origin,(tx+dx+2,ty+dy+1)],'h')
    # Three articulated leg pairs. Not mammals: feet hook under the thorax.
    for i in range(3):
        p.line([(x+i*3-4,y+2),(x+i*3-7+sw,y+8),(x+i*3-3+sw,y+11)],'o',2)
        p.line([(x+i*3-3,y+3),(x+i*3+re//2,y+8),(x+i*3+3+re//2,y+8)],'s')
    blob(p,x-6,y+2,9,6,20)
    # Yellow abdomen bands curve with body and terminate at dark taper.
    for xx in (x-10,x-6):
        p.poly([(xx,y-3),(xx+2,y-3),(xx+4,y+5),(xx+1,y+6)],'u','o')
        p.line([(xx+1,y-2),(xx+2,y)],'v')
    p.poly([(x-13,y+3),(x-19,y+3+sw),(x-12,y+6)],'o')
    blob(p,x+1,y-1,6,6)
    blob(p,x+8,y-4,5,5,keys={'b':'b','l':'l','s':'s'})
    eye(p,x+8,y-6,'k',3)
    p.line([(x+9,y-8),(x+8,y-12),(x+11,y-15)],'o');p.line([(x+11,y-7),(x+13,y-11)],'s')
    # Pointed mandibles open in thrust pose.
    p.line([(x+12,y-3),(x+15,y-1+(2 if n=='attack' else 0)),(x+12,y+1)],'o',2)
    p.line([(x+5,y-3),(x+7,y-4)],'h')
    return finish(p,n,True)
def fox(n):
    p=pen(48,dict(s='8c3e36',b='c35d43',l='ec9570',h='fff0d1',w='e8d9bf',e='8cd3b6',a='743046',z='e85576'))
    if n=='dead':
        blob(p,23,40,13,4);p.poly([(31,39),(36,36),(42,39),(39,43),(31,44)],'b','o');p.line([(36,40),(39,40)],'o');diamond(p,36,37,1,2,'z');return finish(p,n)
    dx,dy,re,sw=POSE[n];x=24+dx;y=30+dy
    # Full tail sways independently; cream terminal tuft.
    pts=[(x-7,y+4),(x-13,y+2),(x-16,y-2-sw),(x-18,y-7-sw),(x-13,y-6-sw),(x-8,y-1)]
    p.poly(pts,'b','o');p.poly([(x-18,y-7-sw),(x-13,y-6-sw),(x-12,y-3-sw),(x-16,y-2-sw)],'w','o')
    for i,xx in enumerate((x-7,x+6,x-4,x+9)):
        f=xx+(-3 if n=='move' and i%2==0 else 2 if n=='move' else 0)
        cap(p,[(xx,y+3),(xx+(sw if i%2 else -sw),y+8),(f,42)],2,'s' if i<2 else 'b',lit='l')
        p.poly([(f-1,42),(f+2,42),(f+3,44),(f-1,44)],'w','o')
    blob(p,x,y,12,7,-5)
    p.poly([(x+4,y-4),(x+9,y-5),(x+12,y+2),(x+9,y+6),(x+4,y+4)],'w','o')
    hx=31+dx//2+(1 if n=='attack' else 0);hy=y-9+(2 if n=='windup' else 0)
    # Triangular ears and long rightward muzzle make unmistakable fox anatomy.
    p.poly([(hx-5,hy+3),(hx-4,hy-7),(hx+1,hy-1),(hx+3,hy-6),(hx+5,hy+1),(hx+8,hy+4),(hx+12,hy+6),(hx+10,hy+9),(hx+3,hy+10),(hx-3,hy+7)],'b','o')
    p.poly([(hx-3,hy-5),(hx,hy-1),(hx-2,hy+1)],'a');p.poly([(hx+3,hy-4),(hx+4,hy),(hx+2,hy)],'a')
    p.poly([(hx+4,hy+5),(hx+11,hy+6),(hx+9,hy+8),(hx+3,hy+9),(hx,hy+6)],'w')
    p.box((hx+10,hy+5,hx+11,hy+6),'o');eye(p,hx+3,hy+2,'e',2)
    diamond(p,hx+2,hy-1,2,3,'z');p.line([(hx+1,hy-2),(hx+2,hy-3)],'h')
    if n=='attack':mouth(p,hx+5,hy+8,5,2)
    return finish(p,n)
def plant(n):
    p=pen(64,dict(s='2f5c3c',b='568444',l='94b96c',h='eaf0b7',r='843851',z='bc5573',e='f9d05b',a='263c30',u='5d633b'))
    if n=='dead':
        p.poly([(9,60),(17,55),(32,58),(41,53),(54,59),(51,60)],'s','o');p.poly([(25,58),(27,49),(35,48),(44,54),(45,60)],'b','o');p.line([(30,51),(38,54)],'l');return finish(p,n)
    dx,dy,re,sw=POSE[n];hx=38+dx;hy=22+dy
    # Root leaves: ground remains fixed while stem bends toward strike.
    for q in [[(29,58),(11,55),(7,60),(23,60)],[(30,58),(18,46),(14,46),(17,55)],[(34,58),(52,54),(56,60),(41,60)],[(32,55),(46,45),(51,46),(41,55)]]:
        p.poly(q,'b','o');p.line([q[0],q[1]],'l')
    stem=bez([(31,57,4),(19+sw,46,4),(32+dx,36,4),(hx-5,hy+8,4)])
    tube(p,stem,'b',shade='s',hi='l')
    for x,y in [(24+sw,44),(29+dx,35),(hx-6,hy+13)]:p.poly([(x,y),(x-5,y-3),(x-2,y+3)],'s','o')
    # Small embedded face on stalk, two yellow eyes retained in every living pose.
    blob(p,29+dx,40,6,5);eye(p,27+dx,38,'e',2);eye(p,32+dx,39,'e',2);p.line([(30+dx,43),(33+dx,42)],'o')
    # Carnivorous jaw opens around rightmost hinge: huge mouth, teeth, red interior.
    gape={'idle_a':7,'idle_b':8,'idle_c':6,'windup':4,'move':9,'attack':13,'recover':5,'hit':10}[n]
    p.poly([(hx-12,hy+4),(hx-9,hy-8),(hx+1,hy-13),(hx+12,hy-8),(hx+17,hy-3),(hx+9,hy+2),(hx-1,hy+4)],'b','o')
    p.poly([(hx-9,hy+3),(hx+13,hy-2),(hx+14,hy+gape),(hx+3,hy+gape+5),(hx-9,hy+10)],'r','o')
    p.poly([(hx-9,hy+10),(hx+4,hy+gape+3),(hx+14,hy+gape),(hx+13,hy+gape+5),(hx+1,hy+gape+8),(hx-11,hy+11)],'b','o')
    p.line([(hx-10,hy-5),(hx-4,hy-10),(hx+2,hy-10)],'l',2)
    for k in range(5):
        x=hx-5+k*4;y=hy+2-k
        p.poly([(x,y),(x+3,y-1),(x+2,y+4)],'h','o')
        y2=hy+gape+3-(1 if k==4 else 0)
        p.poly([(x,y2),(x+3,y2),(x+2,y2-3)],'h','o')
    p.line([(hx-1,hy+gape),(hx+5,hy+gape-1),(hx+9,hy+gape)],'z',2)
    # Two viscous strands are geometry, binary alpha.
    for x,h in [(hx+12,4+sw),(hx+6,3)]:
        p.line([(x,hy+gape+4),(x,hy+gape+4+h)],'l',2)
    return finish(p,n)
def serpent(n):
    p=pen(64,dict(s='263c67',b='365f94',l='639bb7',h='c8e3d7',a='6f354e',u='ad5866',v='e39492',e='e8bc69'))
    if n=='dead':
        tube(p,bez([(8,58,3),(27,50,5),(35,61,5),(53,56,4)]),'b',shade='s',hi='l');p.poly([(45,55),(49,50),(57,53),(59,57),(55,60),(47,59)],'b','o');p.line([(53,55),(56,55)],'o');return finish(p,n)
    dx,dy,re,sw=POSE[n];hx=44+dx;hy=18+dy
    # Long continuous S: rear lower coil -> left flank -> upper curve -> right head.
    pts=bez([(9,57,1),(56,65,4),(52,40+sw,5),(26,43+sw,5)])
    pts+=bez([(26,43+sw,5),(7,45,5),(17,21-sw,5),(34,32,5)])
    pts+=bez([(34,32,5),(52,40,5),(45,hy+13,4),(hx,hy+4,4)])
    tube(p,pts,'b',shade='s',hi='l')
    # Rose dorsal sail grows from distinct parts of the S, not arbitrary horns.
    for x,y,sgn in [(17,36,-1),(23,25,-1),(36,31,-1),(45,41,1),(35,52,1)]:
        p.poly([(x,y),(x+3,y+sgn*8),(x+6,y+sgn*2)],'u','o');p.line([(x+1,y),(x+3,y+sgn*6)],'v')
    for x,y in [(22,38),(28,45+sw),(38,47),(42,32),(27,29)]:
        p.line([(x,y),(x+2,y+1),(x+3,y)],'l');p.line([(x+1,y+3),(x+3,y+4)],'s')
    p.poly([(hx-5,hy+5),(hx-6,hy-4),(hx+1,hy-8),(hx+7,hy-5),(hx+9,hy-1),(hx+15,hy+1),(hx+14,hy+5),(hx+7,hy+6),(hx+5,hy+10),(hx-1,hy+10)],'b','o')
    p.line([(hx-4,hy-3),(hx,hy-6),(hx+4,hy-5)],'l')
    eye(p,hx+4,hy-2,'e',3)
    gape=7 if n=='attack' else 4 if n!='windup' else 2
    mouth(p,hx+5,hy+4,9,gape)
    p.poly([(hx+4,hy+gape+5),(hx+13,hy+gape+4),(hx+13,hy+gape+7),(hx+7,hy+gape+8),(hx+2,hy+gape+7)],'b','o')
    p.poly([(hx-4,hy-3),(hx-8,hy-11),(hx+1,hy-6)],'u','o')
    return finish(p,n)

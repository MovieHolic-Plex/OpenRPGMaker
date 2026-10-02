"""Rib cages and skulls remain bones, not solid generic body masses."""
from common import *
BONE=dict(s='99896d',b='c9b793',l='f2dec0',h='fff2cf',e='de6d62',a='49384d',u='746077',v='a494ad',r='8c4a32',f='c17c4b')
ROT=dict(s='465748',b='728d69',l='acbc8b',h='e4d9ae',e='b7ed72',a='32432f',u='516646',v='809063',w='d7c5a0')
def sword(p,hand,tip,green=False):
    hx,hy=hand;tx,ty=tip
    vx,vy=tx-hx,ty-hy;L=max(abs(vx),abs(vy)) or 1
    px,py=-vy/L*2,vx/L*2
    p.poly([(hx+px,hy+py),(tx+px/2,ty+py/2),(tx+vx/L*2,ty+vy/L*2),(tx-px/2,ty-py/2),(hx-px,hy-py)],'g' if green else 'r','o')
    p.line([(hx-px/2,hy-py/2),(tx,ty)],'e' if green else 'f')
    p.line([(hx-px*2,hy-py*2),(hx+px*2,hy+py*2)],'f',2)
    p.line([(hx-vx/L*3,hy-vy/L*3),hand],'a',3)
    if not green:p.grid(round(hx+vx/2)-1,round(hy+vy/2),['oo','r.'])
def skull(p,x,y,n,c='b',red=False):
    p.poly([(x,y+2),(x+2,y),(x+7,y),(x+10,y+3),(x+10,y+6),(x+12,y+7),(x+9,y+8),(x+9,y+11),(x+3,y+11),(x+1,y+8)],c,'o')
    p.line([(x+2,y+1),(x+6,y+1)],'l');eye(p,x+5,y+4,'z' if red else 'e',3)
    p.box((x+9,y+7,x+10,y+7),'o');p.line([(x+3,y+8),(x+5,y+8)],'s')
    p.line([(x+4,y+10),(x+8,y+10)],'o')
    for k in range(4,10,2):p.line([(x+k,y+9),(x+k,y+10)],'h')
    if n in ('windup','attack'):
        p.poly([(x+5,y+10),(x+10,y+10),(x+10,y+14),(x+4,y+13)],c,'o');p.line([(x+5,y+11),(x+9,y+11)],'o')
def draw(slug,n):
    if slug=='bonepile-crawler':return crawler(n)
    armor=slug=='revenant-vengeful';zombie=slug.startswith('ghoul');upper=slug=='skeleton-bone';cell=64 if armor else 48
    pal=dict(ROT if zombie else BONE)
    if armor:pal.update(a='56565c',u='645078',v='9d989e',e='98df97',z='ee7466')
    p=pen(cell,pal);base=cell-4
    if n=='dead':
        for pts in [[(10,base-1),(23,base-3)],[(18,base-6),(31,base-2)],[(27,base-2),(35,base-1)]]:cap(p,pts,2,'b',lit='l')
        skull(p,31,base-11,'idle_a');p.box((37,base-7,39,base-5),'o')
        if not zombie:sword(p,(12,base-4),(36,base-7),armor)
        else:p.poly([(13,base-6),(25,base-8),(30,base-2),(18,base)],'u','o')
        return finish(p,n,upper)
    dx,dy,re,sw=POSE[n];off=8 if armor else 0;x=21+dx+off;y=22+dy+off
    # feet remain planted while knees and hip change. Floating upper skeleton has no fake legs.
    if not upper:
        for a,k,f,c in [((x-1,y+11),(18+off-dy,37+off),(15+off-(3 if n=='move' else 0),base),'s'),((x+4,y+11),(27+off+dy,37+off),(28+off+(3 if n=='move' else 0),base),'b')]:
            cap(p,[a,k,(f[0],base-3)],3 if zombie or armor else 2,c,lit='l',dark='s')
            p.poly([(f[0]-2,base-3),(f[0]+2,base-3),(f[0]+5,base),(f[0]-2,base)],'u' if zombie or armor else c,'o')
            if armor:
                cap(p,[k,(f[0],base-4)],4,'a',lit='v',dark='s')
                p.poly([(f[0]-2,base-3),(f[0]+2,base-3),(f[0]+5,base),(f[0]-2,base)],'a','o')
                p.line([(f[0]-1,base-4),(f[0]+2,base-4)],'v')
    else:
        p.line([(x-3,y+11),(x-6,y+15)],'s',2);p.line([(x+5,y+10),(x+8,y+15)],'b',2)
    # ragged cloth mantle: skeleton has brown cloth, revenant purple, ghoul moss green.
    p.poly([(x-6,y-2),(x+4,y-3),(x+7,y+2),(x+6,y+10),(x+3,y+8),(x+2,y+12),(x-2,y+9),(x-6,y+11),(x-8,y+3)],'u' if zombie or armor else 'r','o')
    p.line([(x-5,y),(x-4,y+5)],'v' if zombie or armor else 'f')
    # ribs are separate strips joined by narrow spine with visible negative space.
    p.box((x-2,y+1,x+4,y+9),'k');p.line([(x+1,y),(x+1,y+11)],'b',2)
    for k in range(3):
        p.line([(x-3,y+1+k*3),(x,y+2+k*3),(x+4,y+1+k*3)],'l')
    p.line([(x-1,y+10),(x+5,y+10)],'b',2)
    if armor:
        for ax in (x-9,x+4):p.stone(ax,y-1,8,7,base='a',light='v')
        p.poly([(x-4,y),(x+4,y),(x+6,y+5),(x+3,y+9),(x-4,y+8)],'a','o')
        p.line([(x-3,y+1),(x+1,y+1),(x-1,y+5)],'v');p.grid(x+3,y+3,['rf','r.'])
        p.box((x,y+5,x+3,y+8),'k');p.line([(x,y+6),(x+2,y+6)],'b')
    skull(p,x-1,y-13,n,red=armor)
    if zombie:
        p.poly([(x-2,y-11),(x-1,y-14),(x+5,y-14),(x+8,y-11),(x+2,y-10)],'a','o')
        p.line([(x,y-7),(x+3,y-5)],'s');p.box((x,y-4,x+3,y-2),'r')
        if slug=='ghoul-grave':p.grid(x+1,y-12,['sl','s.']);p.line([(x-5,y+9),(x-6,y+13)],'u',2)
    # Separate rear/front elbow paths; blade and hands vary across all poses.
    far=[(x+2,y+1),(x+6,y+5),(x+9+re//2,y+3)]
    if n=='hit':far=[(x+2,y+1),(x+5,y-3),(x+3,y-6)]
    cap(p,far,3 if zombie else 2,'s',lit='b')
    if zombie:
        if n=='windup':arm=[(x-5,y),(x-8,y-5),(x-5,y-10)]
        elif n=='attack':arm=[(x-5,y),(x+5,y+1),(x+13,y+1)]
        elif n=='hit':arm=[(x-5,y),(x-10,y+3),(x-11,y+8)]
        else:arm=[(x-5,y),(x,y+7+sw),(x+10+re//2,y+5)]
        claw(p,arm,3)
        ex,ey=far[-1]
        p.line([(ex,ey),(ex+3,ey+1)],'h');p.line([(ex,ey),(ex+3,ey-1)],'h')
    else:
        points={'idle_a':((x-7,y+6),(x-4,y-12)),'idle_b':((x-6,y+7),(x-3,y-11)),'idle_c':((x-8,y+4),(x-7,y-14)),
        'windup':((x-5,y-5),(x-15,y-15)),'move':((x-6,y+6),(x-1,y-11)),
        'attack':((x+10,y+3),(cell-4,y+5)),'recover':((x+5,y+7),(x+13,y+15)),
        'hit':((x-9,y+4),(x-16,y-5))}
        hand,tip=points[n]
        cap(p,[(x-5,y),(x-8,y+3),hand],2,'b',lit='l');sword(p,hand,tip,armor)
        p.box((hand[0]-1,hand[1]-1,hand[0]+1,hand[1]+1),'b')
    return finish(p,n,upper)
def crawler(n):
    p=pen(64,BONE)
    if n=='dead':
        for a,b in [((11,57),(24,59)),((23,54),(35,60)),((38,58),(51,56))]:cap(p,[a,b],2,'b',lit='l')
        skull(p,41,48,'idle_a');p.box((47,52,49,54),'o');return finish(p,n)
    dx,dy,re,sw=POSE[n];cx=30+dx;cy=36+dy
    # Four clearly separated walking supports, bone knees and splayed talons.
    for a,k,end in [((22,39),(16-sw,47),(10-sw,60)),((37,39),(40+sw,47),(44+sw,60)),((25,40),(21+sw,49),(23+sw,60)),((39,39),(48-sw,48),(51-sw,60))]:
        cap(p,[a,k,(end[0],end[1]-2)],2,'b',lit='l',dark='s')
        p.line([(end[0]-2,60),(end[0]+3,60),(end[0]+5,58)],'b',2)
    # Exposed arched vertebrae, with rib cage loops and empty spaces.
    p.line([(16+dx,33+dy),(22+dx,29+dy),(32+dx,28+dy),(41+dx,32+dy)],'o',4)
    p.line([(16+dx,33+dy),(22+dx,29+dy),(32+dx,28+dy),(41+dx,32+dy)],'l',2)
    for i in range(5):
        x=20+i*4+dx;y=31+dy+(1 if i in(0,4) else 0)
        p.line([(x,y),(x-2,y+5),(x,y+11),(x+4,y+12),(x+6,y+8),(x+4,y+2)],'o',3)
        p.line([(x,y),(x-2,y+5),(x,y+11),(x+4,y+12),(x+6,y+8),(x+4,y+2)],'b')
    skull(p,41+dx,26+dy+(2 if n=='attack' else 0),n)
    p.line([(46+dx,27+dy),(45+dx,30+dy),(47+dx,32+dy)],'s')
    eye(p,48+dx,30+dy,'e',2)
    if n=='windup':cap(p,[(44,40),(48,35),(54,33)],2,'b',lit='l')
    if n=='attack':cap(p,[(44,40),(53,42),(59,44)],2,'b',lit='l')
    return finish(p,n)

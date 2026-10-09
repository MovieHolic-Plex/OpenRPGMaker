"""Elemental bodies, spectral robes, wind ribbons and a tendrilled eye."""
from arcane_core import Art,P,rig,shift
SPIRITS={'wisp-blue','ghost-pale','spirit-fire','spirit-water','eye-floating','ghost-01','spirit-01','specter-01','wraith-dark','banshee-wail','spirit-wind','spirit-light','spirit-dark','sylph-01','sylph-air','undine-sea'}
PALETTES={
 'wisp-blue':('28436b','477cb2','83c5df','d5f2e9'),
 'ghost-pale':('556678','8da7b1','c4d9d6','eff1d6'),
 'spirit-fire':('793344','bd574c','ef9764','ffe9ac'),
 'spirit-water':('294e73','3f849d','82c3cb','d9eece'),
 'ghost-01':('414d71','6e81a9','a9c5d0','e5ecd6'),
 'spirit-01':('685978','a48caf','d4bdd1','f6e8de'),
 'specter-01':('49435c','736887','aa9ab3','e0d3da'),
 'wraith-dark':('292b45','494865','807392','b9a5bd'),
 'banshee-wail':('405570','748fac','b3ccd2','e9ecda'),
 'spirit-wind':('4b6573','7b9fa2','bbd2bf','eeead0'),
 'spirit-light':('917860','c6b28b','eee0ad','fff6d8'),
 'spirit-dark':('302e48','555273','897eac','c6b4d7'),
 'sylph-01':('355e6a','669598','a7c9bd','e3e8c9'),
 'sylph-air':('4d5880','849abe','becfd5','eef0da'),
 'undine-sea':('2e5764','538f92','91bdae','d3e1c3'),
 'eye-floating':('6b3e51','aa6376','d996a0','efcac1')}
def spectral(a,pts,fill='m',width=3):
    a.line(pts,'o',width+2);a.line(pts,'s',width);a.line([(x-1,y-1) for x,y in pts],'h',max(1,width-2))
def draw(slug,pose,cell):
    pal=P.copy();pal.update(zip(('s','m','h','w'),PALETTES[slug]));a=Art(cell,pal);dx,dy,arm,step=rig(pose)
    if slug=='eye-floating':return eye(a,pose)
    if slug in ('wisp-blue','spirit-fire','spirit-water','spirit-wind','spirit-light','spirit-dark'):return elemental(a,slug,pose)
    if slug in ('sylph-01','sylph-air','undine-sea'):return nymph(a,slug,pose)
    if pose=='dead':
        a.poly([(8,43),(12,39),(19,40),(23,37),(30,39),(39,42),(38,44),(29,43),(23,44),(17,42)],'s')
        a.poly([(13,41),(20,41),(24,39),(30,41),(35,42),(27,42),(22,43)],'h',None);a.line([(16,42),(20,42)],'w')
        if slug=='wraith-dark':a.line([(8,43),(36,42)],'b',2);a.poly([(35,42),(36,36),(41,34),(40,38)],'m')
        if slug=='banshee-wail':a.poly([(29,40),(34,36),(39,38),(37,43),(31,43)],'d');a.line([(32,38),(36,40)],'h')
        return a.im
    cx=23+dx;cy=18+dy;cloak=slug in ('specter-01','wraith-dark');female=slug=='banshee-wail';pale=slug=='ghost-pale';mask=slug=='spirit-01'
    # Layered flowing tail or torn robe; hem bends relative to head and hands.
    tx=cx-5+step;ty=min(42,cy+22)
    if pale:
        a.poly([(cx-8,cy-9),(cx-3,cy-13),(cx+4,cy-11),(cx+8,cy-7),(cx+8,cy+4),(cx+12,cy+10),(cx+10,cy+13),(cx+5,cy+12),(cx+5,ty-2),(cx+1,ty-4),(cx-2,ty),(cx-6,ty-3),(tx-8,ty-1),(cx-10,cy+9),(cx-14,cy+8),(cx-13,cy+4),(cx-9,cy+2)],'m')
        a.poly([(cx-6,cy-8),(cx-2,cy-11),(cx+3,cy-9),(cx+5,cy-4),(cx+3,cy+8),(cx+1,ty-7),(cx-4,ty-5),(cx-6,cy+6)],'h',None)
        a.line([(cx-4,cy-9),(cx,cy-10),(cx+2,cy-8)],'w');a.line([(cx-8,cy+6),(cx-7,ty-5)],'s');a.line([(cx+4,cy+9),(cx+3,ty-5)],'s')
        a.oval((cx-3,cy-4,cx,cy),'o');a.oval((cx+4,cy-5,cx+6,cy-1),'o');a.pixel(cx+5,cy-4,'e')
        a.oval((cx+1,cy+3,cx+5,cy+9+(2 if pose=='attack' else 0)),'s','o');a.line([(cx+2,cy+5),(cx+2,cy+8)],'o')
        if pose=='attack':a.poly([(cx+8,cy+3),(cx+14,cy+1),(cx+19,cy+3),(cx+17,cy+6),(cx+9,cy+7)],'m');a.line([(cx+13,cy+2),(cx+17,cy+3)],'h')
        elif pose=='windup':a.poly([(cx+6,cy+2),(cx+10,cy-4),(cx+13,cy-7),(cx+14,cy-2),(cx+9,cy+7)],'m');a.line([(cx+10,cy-3),(cx+12,cy-5)],'h')
        return a.im
    if cloak:
        a.poly([(cx-7,cy-6),(cx+4,cy-8),(cx+8,cy+3),(cx+6,cy+10),(cx+10,ty-2),(cx+5,ty-4),(cx+2,ty),(cx-1,ty-5),(cx-6,ty-1),(cx-8,ty-6),(tx-10,ty-2),(cx-11,cy+12)],'s')
        a.poly([(cx-6,cy),(cx-2,cy-3),(cx+2,cy+2),(cx+3,ty-6),(cx-1,ty-5),(cx-4,cy+10),(cx-10,ty-5),(cx-8,cy+6)],'m',None);a.line([(cx-5,cy+6),(cx-8,ty-7)],'h');a.line([(cx+3,cy+7),(cx+4,ty-6)],'h')
        a.poly([(cx-6,cy-4),(cx-5,cy-11),(cx,cy-14),(cx+7,cy-10),(cx+9,cy-2),(cx+4,cy+3),(cx-1,cy+1)],'s');a.poly([(cx-2,cy-9),(cx+3,cy-10),(cx+6,cy-6),(cx+6,cy-1),(cx+2,cy+1),(cx-2,cy-1)],'o',None);a.line([(cx-3,cy-10),(cx,cy-12),(cx+5,cy-9)],'h');a.line([(cx+1,cy-4),(cx+6,cy-5)],'e');a.pixel(cx+5,cy-5,'E')
        if slug=='specter-01':a.skull(cx+2,cy-2,False,.7);a.line([(cx-4,cy+5),(cx-1,cy+8),(cx+4,cy+7)],'h')
    else:
        a.poly([(cx-6,cy+4),(cx+6,cy+3),(cx+7,cy+11),(cx+3,cy+15),(cx-3,cy+17),(tx,ty),(tx-8,ty-2),(cx-7,cy+17),(cx-11,cy+12)],'m')
        a.poly([(cx-3,cy+7),(cx+3,cy+7),(cx+3,cy+13),(cx-4,cy+18),(tx-5,ty-3),(tx-1,ty-5),(cx-2,cy+14)],'h',None);a.line([(cx-3,cy+8),(cx-4,cy+14),(cx-7,cy+18)],'w')
        if female:
            a.poly([(cx-5,cy+3),(cx+4,cy+3),(cx+3,cy+11),(cx+8,ty-1),(cx+3,ty-3),(cx+1,ty),(cx-3,ty-2),(cx-8,ty-1),(cx-4,cy+10)],'h');a.line([(cx-1,cy+11),(cx-4,ty-4)],'w');a.line([(cx+2,cy+14),(cx+5,ty-4)],'s')
            a.poly([(cx-6,cy-9),(cx-1,cy-13),(cx+5,cy-10),(cx+6,cy-5),(cx+1,cy-1),(cx-4,cy+2),(cx-11-step/2,cy+4),(cx-9-step/2,cy-3),(cx-12,cy-2),(cx-10,cy-8)],'d');a.line([(cx-5,cy-9),(cx-8,cy-4),(cx-8-step/2,cy+1)],'m');a.line([(cx-7,cy-7),(cx-10,cy-5)],'h')
        a.poly([(cx-3,cy-7),(cx+3,cy-8),(cx+6,cy-4),(cx+6,cy-1),(cx+9,cy),(cx+7,cy+3),(cx+7,cy+6),(cx+2,cy+7),(cx-3,cy+3),(cx-5,cy-1)],'h');a.poly([(cx-2,cy-6),(cx+2,cy-6),(cx+4,cy-3),(cx+1,cy-1),(cx-3,cy-2)],'w',None);a.line([(cx+1,cy-2),(cx+5,cy-3)],'o',2);a.pixel(cx+4,cy-2,'e')
        if pose=='attack' or female:a.oval((cx+3,cy+2,cx+7,cy+7),'s','o');a.pixel(cx+4,cy+3,'w')
        else:a.line([(cx+3,cy+4),(cx+7,cy+4)],'s')
        if mask:
            a.poly([(cx-3,cy-6),(cx-7,cy-13),(cx-8,cy-10),(cx-6,cy-4)],'h');a.poly([(cx+2,cy-7),(cx+3,cy-15),(cx+6,cy-13),(cx+5,cy-5)],'h');a.line([(cx-6,cy-10),(cx-5,cy-6)],'w');a.line([(cx+4,cy-12),(cx+4,cy-8)],'w');a.pixel(cx+3,cy+1,'R')
    rear=[(cx-5,cy+5),(cx-11,cy+5-arm/3),(cx-14,cy+1+step/2)]
    front=[(cx+4,cy+5),(cx+10+arm/3,cy+9-arm/3),(min(43,cx+13+arm/2),cy+5-arm/2)]
    if pose=='windup':front=[(cx+4,cy+5),(cx+8,cy-1),(cx+9,cy-8)]
    if pose=='hit':front=[(cx+4,cy+5),(cx+3,cy+11),(cx-1,cy+8)]
    for pts in (rear,front):
        spectral(a,pts,'m',3);ex,ey=pts[-1];a.line([(ex,ey),(min(45,ex+3),ey-2),(min(45,ex+4),ey)],'h');a.line([(ex,ey),(min(45,ex+3),ey+2)],'h')
    if slug=='wraith-dark':
        ex,ey=front[-1];a.line([(ex,ey+10),(ex+1,max(5,ey-12))],'o',3);a.line([(ex,ey+10),(ex+1,max(5,ey-12))],'B');a.poly([(ex+1,max(5,ey-12)),(ex-5,max(3,ey-13)),(ex-12,max(5,ey-10)),(ex-16,max(8,ey-5)),(ex-10,max(6,ey-8)),(ex-4,max(6,ey-9))],'m');a.line([(ex-13,max(8,ey-6)),(ex-9,max(6,ey-9)),(ex-4,max(6,ey-10))],'h')
    return a.im

def elemental(a,slug,pose):
    dx,dy,arm,step=rig(pose);dead=pose=='dead';fire=slug=='spirit-fire';water=slug=='spirit-water';wind=slug=='spirit-wind';light=slug=='spirit-light';dark=slug=='spirit-dark';wisp=slug=='wisp-blue'
    if dead:
        a.poly([(9,43),(14,40),(21,42),(26,39),(32,41),(38,43),(34,44),(25,43),(19,44)],'s');a.line([(14,42),(20,43),(25,41),(31,42)],'h')
        if fire:a.poly([(22,40),(24,34),(26,38),(29,36),(28,41)],'m');a.line([(24,39),(25,37)],'w')
        if light:a.line([(29,38),(33,37),(37,39)],'y');a.pixel(21,39,'E')
        return a.im
    cx=24+dx;cy=min(25,23+dy)
    if wisp:
        a.poly([(cx-7,cy-4),(cx-8,cy-9),(cx-4,cy-8),(cx-2,cy-15),(cx+1,cy-11),(cx+5,cy-17),(cx+4,cy-7),(cx+9,cy-3),(cx+10,cy+4),(cx+5,cy+10),(cx-1,cy+13),(cx-9-step,cy+17),(cx-15,cy+14),(cx-11,cy+11),(cx-13,cy+7),(cx-8,cy+8),(cx-5,cy+6)],'m')
        a.poly([(cx-5,cy-3),(cx-2,cy-10),(cx+1,cy-4),(cx+4,cy-8),(cx+5,cy),(cx+7,cy+3),(cx+3,cy+8),(cx-4,cy+10),(cx-8-step,cy+13),(cx-7,cy+8)],'h',None);a.poly([(cx-1,cy-5),(cx+3,cy),(cx+4,cy+4),(cx,cy+7),(cx-3,cy+5),(cx-3,cy)],'w',None)
        a.line([(cx-3,cy),(cx,cy+1)],'o',2);a.line([(cx+4,cy),(cx+7,cy-1)],'o',2);a.pixel(cx+6,cy,'e')
        if pose=='attack':a.poly([(cx+7,cy+4),(43,cy+3),(44,cy+5),(cx+7,cy+8)],'h');a.pixel(43,cy+4,'w')
        return a.im
    if fire:
        a.poly([(cx-8,cy+5),(cx-10,cy-3),(cx-7,cy-2),(cx-8,cy-10),(cx-4,cy-8),(cx-3,cy-18),(cx+2,cy-13),(cx+5,cy-20),(cx+5,cy-9),(cx+9,cy-13),(cx+8,cy-2),(cx+12,cy+1),(cx+6,cy+10),(cx+7,cy+16),(cx+1,cy+14),(cx-2,cy+19),(cx-5,cy+14),(cx-11,cy+18),(cx-9,cy+10)],'m')
        a.poly([(cx-5,cy+4),(cx-4,cy-4),(cx-1,cy-13),(cx+2,cy-5),(cx+5,cy-7),(cx+5,cy+3),(cx+2,cy+11),(cx-2,cy+15),(cx-6,cy+10)],'h',None);a.poly([(cx-2,cy-4),(cx+2,cy-2),(cx+3,cy+5),(cx-1,cy+10),(cx-3,cy+6)],'w',None)
        rear=[(cx-6,cy+2),(cx-13,cy+4),(cx-14,cy-2+arm/3)];front=[(cx+6,cy),(cx+11,cy+2-arm/3),(min(42,cx+13+arm/2),cy-arm/2)]
        for p in (rear,front):spectral(a,p,width=3);ex,ey=p[-1];a.poly([(ex-2,ey+2),(ex-3,ey-2),(ex-1,ey-6),(ex+1,ey-3),(ex+3,ey-5),(ex+3,ey),(ex+1,ey+3)],'h');a.pixel(ex,ey,'w')
    elif water:
        # Wave has a huge curled rear crest and a forward head emerging from foam.
        a.poly([(5,37),(8,30+dy),(11,23+dy),(17,20+dy),(20,21+dy),(21,25+dy),(18,28+dy),(15,28+dy),(16,25+dy),(14,26+dy),(14,31+dy),(20,32+dy),(23,cy+1),(cx-2,cy-9),(cx+3,cy-13),(cx+8,cy-9),(cx+9,cy-4),(cx+13,cy-1),(cx+9,cy+3),(cx+7,cy+8),(40,39),(36,42),(26,40),(20,42),(12,40)],'m')
        a.poly([(8,36),(10,28+dy),(14,23+dy),(18,22+dy),(19,24+dy),(15,26+dy),(13,32+dy),(19,35+dy),(24,34),(29,37),(35,39),(30,40),(19,38)],'h',None);a.line([(9,31+dy),(11,26+dy),(15,22+dy),(18,22+dy)],'w');a.line([(14,34+dy),(18,35+dy),(24,35)],'w')
        a.poly([(cx-1,cy-7),(cx+3,cy-10),(cx+6,cy-7),(cx+5,cy-2),(cx+1,cy)],'h',None);spectral(a,[(cx+4,cy+3),(cx+9,cy+7),(min(43,cx+13+arm/2),cy+3-arm/2)],width=3)
    elif wind:
        a.poly([(6,31+dy),(11,24+dy),(17,22+dy),(21,25+dy),(18,28+dy),(14,27+dy),(17,25+dy),(13,25+dy),(10,30+dy),(13,34+dy),(23,34+dy),(31,30+dy),(30,23+dy),(cx+1,cy-2),(cx-2,cy-10),(cx+2,cy-14),(cx+8,cy-10),(cx+9,cy-5),(cx+12,cy-2),(cx+8,cy+2),(cx+7,cy+6),(37,32+dy),(32,38),(23,41),(15,39),(9,40)],'m')
        a.line([(10,30+dy),(13,27+dy),(16,26+dy)],'w');a.line([(12,35+dy),(21,37+dy),(29,34+dy),(33,29+dy)],'h',2);a.line([(16,39),(23,39),(28,37)],'w');spectral(a,[(cx+5,cy+2),(cx+10,cy+1),(min(43,cx+13+arm/2),cy-3-arm/2)],width=2)
        a.poly([(cx-4,cy-4),(cx-12,cy-10),(cx-16,cy-10),(cx-12,cy-6),(cx-14,cy-2),(cx-7,cy+1)],'h');a.line([(cx-11,cy-8),(cx-7,cy-4)],'w')
    elif light:
        for i,(x,y) in enumerate([(11,13),(18,6),(28,6),(37,11),(39,28)]):
            x+=dx/2;y+=dy;a.poly([(x,y-3),(x+1,y-1),(x+3,y),(x+1,y+1),(x,y+3),(x-1,y+1),(x-3,y),(x-1,y-1)],'y');a.pixel(x,y,'E')
        a.poly([(cx-5,cy-8),(cx-14,cy-14),(cx-18,cy-9),(cx-15,cy-2),(cx-12,cy),(cx-9,cy+6),(cx-3,cy+3)],'h');a.line([(cx-15,cy-9),(cx-12,cy-3),(cx-8,cy+1)],'w')
        a.poly([(cx-4,cy-5),(cx+2,cy-7),(cx+6,cy-3),(cx+5,cy+8),(cx+10,cy+16),(cx+4,cy+14),(cx,cy+19),(cx-4,cy+16),(cx-10+step,cy+17),(cx-6,cy+7)],'m');a.poly([(cx-2,cy-3),(cx+2,cy-3),(cx+2,cy+9),(cx,cy+15),(cx-5,cy+14)],'w',None)
        spectral(a,[(cx+3,cy),(cx+7,cy+3),(min(41,cx+12+arm/2),cy-arm/2)],width=2)
        a.oval((cx-6,cy-16,cx+7,cy-12),'y','o');a.line([(cx-3,cy-15),(cx+4,cy-15)],'E')
    else:
        # Shadow elemental: crescent crown and six tapered shadow arms.
        a.poly([(cx-8,cy-9),(cx-10,cy-17),(cx-7,cy-20),(cx-4,cy-12),(cx+2,cy-13),(cx+7,cy-20),(cx+9,cy-15),(cx+7,cy-9),(cx+7,cy+3),(cx+11,cy+15),(cx+5,cy+13),(cx+2,cy+19),(cx-1,cy+11),(cx-7,cy+17),(cx-7,cy+8),(cx-12,cy+10),(cx-8,cy+1)],'s')
        a.poly([(cx-6,cy-8),(cx-1,cy-10),(cx+4,cy-8),(cx+3,cy+6),(cx-1,cy+13),(cx-4,cy+8),(cx-3,cy)],'m',None);a.line([(cx-6,cy-8),(cx-2,cy-9)],'h')
        for i in range(3):
            spectral(a,[(cx-5,cy-3+i*4),(cx-12,cy-5+i*5+step),(cx-15,cy-9+i*7)],width=2)
            spectral(a,[(cx+4,cy-3+i*4),(cx+10,cy-3+i*4-arm/4),(min(43,cx+14+arm/2),cy-7+i*6-arm/3)],width=2)
    # Species-facing features emerge from the flowing material.
    fx=cx+3;fy=cy-5 if fire or dark else cy-4 if light else cy-6
    a.line([(fx-3,fy),(fx,fy+1)],'o',2);a.line([(fx+3,fy),(fx+6,fy-1)],'o',2)
    if pose!='hit':a.pixel(fx+5,fy,'e');a.pixel(fx-1,fy+1,'e')
    if pose=='attack':a.poly([(fx-2,fy+4),(fx+6,fy+3),(fx+5,fy+8),(fx+1,fy+9),(fx-2,fy+6)],'s');a.line([(fx,fy+5),(fx+4,fy+4)],'w')
    else:a.line([(fx,fy+5),(fx+5,fy+4)],'s')
    return a.im

def nymph(a,slug,pose):
    dx,dy,arm,step=rig(pose);sea=slug=='undine-sea';air=slug=='sylph-air';cx=23+dx;cy=min(22,20+dy) if not sea else 20+dy
    if pose=='dead':
        a.poly([(8,43),(13,39),(20,40),(26,38),(34,41),(39,43),(34,44),(25,42),(18,44)],'m');a.line([(14,41),(22,42),(27,40),(32,41)],'h');a.poly([(30,40),(34,36),(38,37),(39,41),(35,42)],'h');a.line([(34,38),(37,39)],'o');return a.im
    if sea:
        a.poly([(cx-5,cy+7),(cx+5,cy+6),(cx+6,cy+14),(cx,cy+18),(cx-9+step,cy+18),(cx-13+step,cy+13),(cx-16+step,cy+11),(cx-17+step,cy+16),(cx-13+step,cy+20),(cx-7+step,cy+21),(cx+2,cy+19),(cx+7,cy+15)],'m');a.line([(cx-3,cy+9),(cx+2,cy+13),(cx-2,cy+16),(cx-9+step,cy+16)],'h',2);a.poly([(cx-11+step,cy+14),(cx-16+step,cy+8),(cx-18+step,cy+11),(cx-17+step,cy+16),(cx-14+step,cy+19)],'h');a.line([(cx-16+step,cy+11),(cx-14+step,cy+16)],'w')
    else:
        for side in (-1,1):
            wx=cx+side*12;wy=cy-4+(step if side<0 else -step)
            if air:
                tx=max(3,min(44,cx+side*20));ty=cy-8+(step if side<0 else -step)
                a.poly([(cx+side*3,cy),(tx,ty-3),(tx-side*2,ty+1),(tx-side*6,ty+3),(tx-side*4,ty+5),(tx-side*11,ty+6),(cx+side*7,cy+6)],'h')
                a.line([(cx+side*5,cy),(tx-side*3,ty)],'w');a.line([(cx+side*6,cy+3),(tx-side*8,ty+3)],'m')
            else:
                a.poly([(cx,cy),(wx,wy-10),(wx+side*4,wy-7),(wx+side*3,wy-2),(wx,wy+5),(cx+side*5,cy+7)],'h');a.line([(cx+side*3,cy+1),(wx,wy-7),(wx,wy+1)],'w');a.line([(cx+side*3,cy+2),(wx,wy+2)],'m')
        a.poly([(cx-4,cy+7),(cx+4,cy+7),(cx+6,cy+12),(cx+1,cy+18),(cx-5+step,cy+22),(cx-11+step,cy+20),(cx-6+step,cy+16),(cx-10+step,cy+13)],'m');a.line([(cx,cy+10),(cx-1,cy+15),(cx-7+step,cy+19)],'h',2)
        if air:
            a.poly([(cx-5,cy+8),(cx-14,cy+11),(cx-18,cy+15),(cx-17,cy+19),(cx-12+step/2,cy+21),(cx-6+step/2,cy+19),(cx-7+step/2,cy+17),(cx-13+step/2,cy+18),(cx-14,cy+16),(cx-11,cy+14),(cx-4,cy+12)],'h')
            a.line([(cx-8,cy+11),(cx-15,cy+14),(cx-16,cy+17),(cx-12+step/2,cy+19)],'w')
    a.poly([(cx-4,cy-2),(cx+3,cy-3),(cx+5,cy+2),(cx+3,cy+8),(cx-2,cy+9),(cx-5,cy+4)],'s');a.poly([(cx-2,cy),(cx+2,cy-1),(cx+3,cy+5),(cx-1,cy+6)],'h',None)
    # Hair fans back with the moving air/water, while the nose faces right.
    a.poly([(cx-5,cy-12),(cx+2,cy-14),(cx+6,cy-10),(cx+2,cy-5),(cx-5,cy-3),(cx-10-step/2,cy+1),(cx-12-step/2,cy-2),(cx-8,cy-4),(cx-11,cy-7)],'m');a.line([(cx-4,cy-11),(cx-7,cy-6),(cx-10-step/2,cy-2)],'h');a.line([(cx-5,cy-8),(cx-8,cy-5)],'w')
    a.poly([(cx-2,cy-11),(cx+3,cy-12),(cx+5,cy-9),(cx+5,cy-6),(cx+8,cy-5),(cx+6,cy-3),(cx+5,cy),(cx+1,cy),(cx-2,cy-4)],'t');a.line([(cx-1,cy-10),(cx+2,cy-10)],'i');a.line([(cx+1,cy-7),(cx+4,cy-7)],'o');a.pixel(cx+3,cy-7,'C');a.line([(cx+3,cy-3),(cx+5,cy-3)],'R')
    if sea:a.poly([(cx-5,cy-10),(cx-6,cy-16),(cx-2,cy-13),(cx+1,cy-17),(cx+3,cy-13),(cx+6,cy-16),(cx+5,cy-10)],'y');a.jewel(cx+1,cy-12,'C')
    elif air:
        a.poly([(cx-4,cy-11),(cx-9,cy-12),(cx-15,cy-10),(cx-12,cy-14),(cx-6,cy-16),(cx+1,cy-17),(cx+5,cy-15),(cx+6,cy-10),(cx+1,cy-11)],'h');a.line([(cx-12,cy-12),(cx-6,cy-14),(cx+2,cy-15)],'w')
    else:a.poly([(cx-4,cy-11),(cx-6,cy-14),(cx-2,cy-13),(cx+1,cy-15),(cx+3,cy-12)],'G');a.pixel(cx+1,cy-13,'e')
    arms=[[(cx-4,cy),(cx-9,cy+4),(cx-11,cy+1+step/2)],[(cx+3,cy),(cx+9+arm/3,cy+3-arm/3),(min(42,cx+12+arm/2),cy-arm/2)]]
    for pts in arms:
        a.limb(pts,'t',2);ex,ey=pts[-1];a.line([(ex,ey),(ex+2,ey-1)],'i')
    if pose=='attack':a.jewel(43,cy-3,'C' if sea else 'h')
    return a.im

def eye(a,pose):
    dx,dy,arm,step=rig(pose)
    if pose=='dead':
        a.poly([(8,43),(15,40),(20,39),(28,40),(36,39),(41,42),(37,44),(26,42),(17,44)],'s');a.poly([(23,38),(29,36),(35,38),(37,41),(31,43),(25,41)],'h');a.line([(27,39),(34,40)],'o');return a.im
    cx=24+dx;cy=22+dy
    for i,(ex,ey) in enumerate([(7,10),(8,31),(14,39),(34,38),(42,15)]):
        ex=min(40,ex+(step/2 if i%2 else -step/2));ey=min(37,ey+dy)
        spectral(a,[(cx-3+i,cy+3),(ex+3,ey-3),(ex,ey),(ex+1,ey+3)],width=2)
        a.poly([(ex,ey-2),(ex+2,ey),(ex,ey+3),(ex-2,ey)],'m');a.pixel(ex,ey,'w')
    a.poly([(cx-11,cy-5),(cx-6,cy-11),(cx+3,cy-12),(cx+11,cy-7),(cx+13,cy),(cx+10,cy+8),(cx+3,cy+12),(cx-6,cy+10),(cx-12,cy+4)],'s')
    a.poly([(cx-10,cy-4),(cx-5,cy-9),(cx+3,cy-10),(cx+10,cy-5),(cx+11,cy+1),(cx+7,cy+7),(cx,cy+9),(cx-7,cy+6)],'h',None)
    a.oval((cx-7,cy-7,cx+10,cy+7),'w','m');a.oval((cx+1,cy-6,cx+10,cy+5),'G','o');a.oval((cx+4,cy-5,cx+8,cy+4),'o');a.pixel(cx+5,cy-4,'U')
    a.line([(cx-8,cy-6),(cx-2,cy-9),(cx+5,cy-9)],'m',2);a.line([(cx-6,cy+8),(cx+1,cy+9),(cx+6,cy+7)],'m')
    for pts in [[(cx-6,cy-4),(cx-3,cy-1),(cx-5,cy+2)],[(cx-3,cy+6),(cx-1,cy+3),(cx+1,cy+4)]]:a.line(pts,'R')
    if pose=='hit':a.poly([(cx-8,cy-3),(cx+10,cy-4),(cx+10,cy+2),(cx-8,cy+3)],'m');a.line([(cx-7,cy),(cx+10,cy-1)],'o')
    if pose=='attack':a.poly([(cx+11,cy-1),(45,cy-3),(45,cy+1),(cx+11,cy+2)],'e');a.line([(cx+12,cy),(45,cy-1)],'E')
    return a.im

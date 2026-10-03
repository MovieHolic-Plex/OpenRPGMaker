"""Haunted wood, orbital stones, flying blade and a cursed fruit."""
import math
from arcane_core import Art,P,rig,shift
OBJECTS={'mimic-chest','ontology-8da61312','jackolantern-01','sword-flying','scarecrow-field','puppet-string','totem-cursed'}
def draw(slug,pose,cell):return {'mimic-chest':mimic,'ontology-8da61312':runes,'jackolantern-01':pumpkin,'sword-flying':blade,'scarecrow-field':scarecrow,'puppet-string':puppet,'totem-cursed':totem}[slug](pose,cell)
def wood(a,pts):
    a.poly(pts,'b'); xs=[p[0] for p in pts];ys=[p[1] for p in pts];x0=min(xs);x1=max(xs);y0=min(ys);y1=max(ys)
    a.line([(x0+2,y0+2),(x1-2,y0+2)],'t');a.line([(x0+3,(y0+y1)/2),(x1-3,(y0+y1)/2-1)],'B')
def mimic(pose,cell):
    a=Art(cell);dx,dy,arm,step=rig(pose)
    if pose=='dead':
        wood(a,[(7,38),(24,35),(41,38),(39,44),(9,44)]);a.poly([(9,36),(13,31),(31,31),(35,35),(22,39)],'B');a.line([(13,34),(28,34)],'t');a.poly([(19,40),(29,39),(35,41),(27,44),(19,43)],'R');a.line([(25,40),(29,41)],'p');a.poly([(13,37),(17,37),(16,40)],'i');return a.im
    cx=23+dx;bottom=42;gap={'idle_a':9,'idle_b':10,'idle_c':8,'windup':4,'move':12,'attack':16,'recover':6,'hit':13}[pose];jaw=min(31,29+dy)
    # Little monster legs drive the jump while the chest case remains articulated.
    for x in (13-step/2,34+step/2):a.poly([(x-2,37),(x+2,37),(x+3,43),(x-3,44),(x-5,42)],'g');a.line([(x-3,42),(x,41)],'a')
    wood(a,[(cx-16,jaw),(cx+12,jaw-2),(cx+17,jaw+2),(cx+17,41),(cx+11,44),(cx-16,41)])
    a.poly([(cx-14,jaw+1),(cx+10,jaw-1),(cx+14,jaw+3),(cx+12,jaw+9),(cx-13,jaw+10)],'r');a.poly([(cx-12,jaw+2),(cx+10,jaw+1),(cx+10,jaw+6),(cx-5,jaw+8),(cx-12,jaw+6)],'o',None)
    for x,y in [(cx-9,jaw+1),(cx-2,jaw+1),(cx+5,jaw)]:a.poly([(x,y),(x+4,y),(x+2,y+5)],'i')
    for x,y in [(cx-7,jaw+10),(cx,jaw+9),(cx+8,jaw+8)]:a.poly([(x,y),(x+4,y-1),(x+2,y-5)],'t');a.pixel(x+2,y-3,'i')
    ly=jaw-gap
    a.line([(cx-15,ly+5),(cx-16,jaw+4)],'o',4);a.line([(cx-15,ly+5),(cx-16,jaw+4)],'B',2);a.line([(cx-14,ly+7),(cx-12,jaw+3)],'r',2)
    wood(a,[(cx-16,ly+3),(cx-13,ly-3),(cx+10,ly-5),(cx+16,ly),(cx+14,ly+6),(cx-13,ly+8)])
    a.poly([(cx-13,ly-2),(cx+9,ly-4),(cx+13,ly-1),(cx-11,ly+1)],'B');a.line([(cx-10,ly-1),(cx+8,ly-3)],'t');a.line([(cx-14,ly+5),(cx+13,ly+3)],'y',2)
    for x in (cx-10,cx+8):a.line([(x,ly),(x+1,ly+5)],'y',2);a.pixel(x,ly+1,'i')
    a.jewel(cx+1,ly+2,'e');a.line([(cx-5,ly+5),(cx-2,ly+4)],'o');a.pixel(cx-3,ly+5,'e');a.line([(cx+6,ly+4),(cx+9,ly+3)],'o');a.pixel(cx+8,ly+4,'e')
    a.line([(cx-13,jaw+13),(cx+9,jaw+13)],'y');a.box((cx+12,jaw+9,cx+14,jaw+11),'t')
    if pose=='attack':a.poly([(cx+2,jaw+5),(cx+10,jaw+6),(44,jaw+3),(45,jaw+6),(cx+12,jaw+10),(cx+1,jaw+9)],'R');a.line([(cx+5,jaw+6),(cx+12,jaw+7),(43,jaw+5)],'p')
    else:a.poly([(cx-1,jaw+7),(cx+6,jaw+5),(cx+9,jaw+7),(cx+7,jaw+9),(cx+1,jaw+10)],'R');a.line([(cx+1,jaw+7),(cx+5,jaw+6)],'p')
    return a.im

def runes(pose,cell):
    a=Art(cell);dx,dy,arm,step=rig(pose);i=['idle_a','idle_b','idle_c','windup','move','attack','recover','hit','dead'].index(pose)
    if pose=='dead':
        for x,y in [(11,41),(22,39),(33,41)]:
            a.poly([(x-5,y-2),(x+2,y-4),(x+6,y),(x+2,44),(x-6,43)],'s');a.line([(x-4,y-1),(x,y-2)],'h');a.line([(x-1,y),(x+2,y+1)],'V')
        return a.im
    cx=24+dx/2;cy=24+dy/2
    a.poly([(cx-6,cy-8),(cx+2,cy-10),(cx+8,cy-5),(cx+9,cy+4),(cx+2,cy+10),(cx-6,cy+7),(cx-10,cy)],'v')
    a.line([(cx-7,cy),(cx-4,cy-6),(cx+2,cy-7),(cx+6,cy-3),(cx+5,cy+4),(cx,cy+6),(cx-3,cy+2),(cx-1,cy-2),(cx+2,cy-2)],'u',2);a.line([(cx-6,cy+4),(cx-2,cy+8),(cx+5,cy+7)],'l')
    offsets=[(-13,-11,5,6),(8,-13,6,5),(15,4,5,6),(-1,15,6,4),(-15,8,4,5)]
    for j,(ox,oy,w,h) in enumerate(offsets):
        x=cx+ox+(step/2 if j%2 else -step/2);y=cy+oy+(dy/2 if j%2 else -dy/2)
        if pose=='windup':x=cx+ox*.78;y=cy+oy*.78
        if pose=='attack':x=cx+ox*.98+(2 if ox>0 else -1);y=cy+oy*.9
        if pose=='hit':x=cx+ox*.88;y=cy+oy*.88+(2 if j%2 else -1)
        x=max(7,min(40,x));y=min(44-h,y)
        a.poly([(x-w,y-h+2),(x-w+3,y-h),(x+w-2,y-h+1),(x+w,y+h-2),(x+w-3,y+h),(x-w+1,y+h-1)],'s');a.poly([(x-w+2,y-h+2),(x+w-2,y-h+2),(x+1,y-h+5),(x-w+1,y)],'h',None);a.line([(x-w+3,y-h+1),(x+w-3,y-h+2)],'w');a.line([(x+w-1,y),(x+w-3,y+h-1)],'d')
        col='u' if j%2 else 'l';a.line([(x-2,y-1),(x+2,y-2),(x+2,y+2),(x-1,y+3),(x-2,y+1)],col);a.line([(x,y),(x,y+3)],'U' if j%2 else 'L')
    return a.im

def pumpkin(pose,cell):
    a=Art(cell);dx,dy,arm,step=rig(pose)
    if pose=='dead':
        a.poly([(7,43),(9,38),(17,37),(23,40),(30,37),(37,40),(41,44),(31,43),(22,44),(15,42)],'R');a.poly([(10,40),(15,39),(21,41),(17,42)],'a');a.line([(26,40),(31,39),(35,41)],'e');a.line([(13,38),(10,34),(13,32)],'G',2);return a.im
    cx=24+dx;cy=29+dy/2
    for p in [[(cx-9,cy),(cx-15,cy-3),(cx-18,cy-8+arm/3)],[(cx+10,cy),(cx+15,cy-3-arm/3),(min(43,cx+18+arm/4),cy-9-arm/3)]]:a.limb(p,'G',2);ex,ey=p[-1];a.line([(ex,ey),(ex+1,ey-3)],'a')
    for x in (cx-9-step/2,cx+7+step/2):a.line([(x,cy+9),(x-2,42),(x+2,42)],'o',4);a.line([(x,cy+9),(x-2,42),(x+2,42)],'G',2);a.pixel(x+2,44,'a')
    a.poly([(cx-14,cy-3),(cx-11,cy-10),(cx-4,cy-13),(cx+5,cy-13),(cx+12,cy-8),(cx+15,cy),(cx+12,cy+9),(cx+6,cy+12),(cx-5,cy+12),(cx-12,cy+8)],'R');a.poly([(cx-11,cy-3),(cx-8,cy-9),(cx-2,cy-11),(cx+5,cy-10),(cx+10,cy-5),(cx+12,cy+2),(cx+8,cy+9),(cx-2,cy+10),(cx-9,cy+6)],'p',None)
    for x in (-7,1,8):a.line([(cx+x,cy-10),(cx+x-2,cy-5),(cx+x-1,cy+5),(cx+x+2,cy+9)],'R')
    a.line([(cx-8,cy-8),(cx-10,cy-3)],'q');a.line([(cx,cy-10),(cx-1,cy-5)],'q')
    a.poly([(cx-3,cy-12),(cx-5,cy-17),(cx-3,cy-20),(cx+1,cy-19),(cx+2,cy-16),(cx,cy-12)],'G');a.line([(cx-3,cy-17),(cx-1,cy-18)],'a');a.poly([(cx+1,cy-15),(cx+5,cy-18),(cx+9,cy-15),(cx+3,cy-13)],'a')
    a.poly([(cx-5,cy-5),(cx+1,cy-3),(cx-4,cy)],'o');a.poly([(cx+5,cy-4),(cx+11,cy-7),(cx+10,cy)],'o');a.line([(cx-3,cy-3),(cx-1,cy-2)],'e');a.line([(cx+7,cy-4),(cx+9,cy-5)],'e');a.poly([(cx+2,cy),(cx+5,cy+2),(cx+1,cy+3)],'o')
    a.poly([(cx-6,cy+3),(cx-3,cy+5),(cx-1,cy+3),(cx+2,cy+5),(cx+5,cy+3),(cx+10,cy+2),(cx+8,cy+8),(cx+2,cy+10),(cx-4,cy+7)],'o');a.line([(cx-3,cy+6),(cx+1,cy+7),(cx+6,cy+6)],'e');a.pixel(cx+8,cy+4,'E')
    if pose=='hit':a.line([(cx-5,cy-4),(cx,cy-2)],'p',2);a.line([(cx+6,cy-3),(cx+10,cy-5)],'p',2)
    if pose=='attack':a.poly([(cx+9,cy+4),(43,cy+1),(44,cy+5),(cx+8,cy+8)],'e');a.line([(cx+11,cy+5),(43,cy+3)],'E')
    return a.im

def blade(pose,cell):
    a=Art(cell);dx,dy,arm,step=rig(pose)
    if pose=='dead':
        a.poly([(8,42),(27,39),(31,40),(44,43),(29,44),(10,44)],'s');a.line([(9,42),(27,40)],'w');a.line([(30,39),(29,44)],'y',2);a.box((32,41,39,43),'b');a.oval((39,40,43,44),'t','o');return a.im
    angle={'idle_a':-63,'idle_b':-60,'idle_c':-66,'windup':-113,'move':-32,'attack':-5,'recover':-47,'hit':-91}[pose]
    r=math.radians(angle);ux=math.cos(r);uy=math.sin(r);vx=-uy;vy=ux;ox=19.5 if pose=='attack' else 23+dx/2;oy=30+dy/2
    def pt(along,across=0):return(ox+ux*along+vx*across,oy+uy*along+vy*across)
    # Blade bevel, fullers, gem guard and a skull pommel all move around the hilt.
    a.poly([pt(2,-2),pt(20,-2),pt(25),pt(20,2),pt(2,2)],'m');a.poly([pt(3,-1),pt(20,-1),pt(24),pt(3,0)],'w',None);a.line([pt(4,1),pt(19,1)],'d');a.line([pt(4,-1),pt(19,-1)],'h')
    a.poly([pt(1,-6),pt(-1,-6),pt(-2,-2),pt(-2,2),pt(-1,6),pt(1,6),pt(0,2),pt(0,-2)],'y');a.line([pt(0,-5),pt(-1,-2),pt(-1,2),pt(0,5)],'i');a.line([pt(-3),pt(-9)],'o',4);a.line([pt(-3),pt(-9)],'b',2);a.line([pt(-5,-1),pt(-5,1)],'t')
    px,py=pt(-10);a.oval((px-2,py-2,px+2,py+2),'t','o');a.line([(px,py),(px+1,py)],'o');a.pixel(px-1,py-1,'i');gx,gy=pt(-1);a.jewel(gx,gy,'C')
    # Aura is a separate tapered ribbon, not a resampled/rotated image.
    p1=pt(4,-4);p2=pt(11,-5-step/2);p3=pt(17,-3);a.line([p1,p2,p3],'C');a.pixel(p2[0],p2[1]-1,'U')
    return a.im

def scarecrow(pose,cell):
    a=Art(cell);dx,dy,arm,step=rig(pose)
    if pose=='dead':
        a.line([(7,42),(35,42)],'o',4);a.line([(7,42),(35,42)],'B',2);a.poly([(14,40),(23,36),(30,38),(27,43),(19,44)],'r');a.poly([(32,36),(39,35),(43,40),(40,43),(34,42)],'t');a.line([(35,38),(40,40)],'o');a.poly([(32,36),(31,33),(35,29),(38,34),(42,36)],'b');a.line([(11,41),(7,37)],'y');return a.im
    cx=23+dx;cy=24+dy;hx=cx+1;hy=12+dy
    for x in (cx-4-step/3,cx+5+step/3):a.line([(x,cy+8),(x,43)],'o',4);a.line([(x,cy+8),(x,43)],'B',2);a.line([(x-3,43),(x+2,43)],'t',2)
    rear=[(cx-4,cy-5),(cx-12,cy-6+arm/3),(cx-17,cy-9+step)];front=[(cx+4,cy-5),(cx+11,cy-5-arm/3),(min(42,cx+16+arm/3),cy-8-arm/2)]
    for pts in (rear,front):a.limb(pts,'B',3);ex,ey=pts[-1];a.line([(ex,ey),(ex+2,ey-3)],'y');a.line([(ex,ey),(ex+3,ey+1)],'t');a.line([(ex,ey),(ex+1,ey+3)],'y')
    a.poly([(cx-7,cy-8),(cx-11,cy-3),(cx-8,cy+2),(cx-5,cy),(cx-7,cy+10),(cx-3,cy+9),(cx-1,cy+13),(cx+2,cy+9),(cx+6,cy+11),(cx+4,cy),(cx+9,cy+1),(cx+10,cy-4),(cx+5,cy-9)],'r');a.poly([(cx-4,cy-6),(cx+1,cy-7),(cx+2,cy+8),(cx-2,cy+9),(cx-4,cy+5)],'R',None);a.line([(cx-2,cy-6),(cx-1,cy+7)],'p');a.line([(cx-6,cy+2),(cx+4,cy+1)],'B',2);a.pixel(cx-1,cy+2,'y')
    a.poly([(hx-5,hy-5),(hx+2,hy-6),(hx+6,hy-3),(hx+6,hy+3),(hx+2,hy+7),(hx-4,hy+5),(hx-6,hy)],'t');a.poly([(hx-4,hy-3),(hx+1,hy-4),(hx+3,hy-1),(hx+1,hy+4),(hx-3,hy+3)],'y',None);a.line([(hx-2,hy-1),(hx+1,hy)],'o');a.line([(hx+3,hy-1),(hx+5,hy-2)],'o');a.pixel(hx+4,hy-1,'e');a.line([(hx-1,hy+3),(hx+2,hy+4),(hx+5,hy+2)],'b');a.pixel(hx,hy+2,'b');a.pixel(hx+3,hy+3,'b')
    a.poly([(hx-9,hy-4),(hx-4,hy-8),(hx-2,max(2,hy-13)),(hx+2,hy-9),(hx+4,hy-6),(hx+9,hy-4),(hx+8,hy-2),(hx-7,hy-1)],'b');a.line([(hx-4,hy-6),(hx+3,hy-6)],'y',2);a.line([(hx-6,hy-3),(hx+5,hy-3)],'t')
    for x,y in [(cx-8,cy+9),(cx+4,cy+10)]:a.line([(x,y),(x-2,y+3)],'y');a.line([(x+1,y),(x+2,y+3)],'t')
    return a.im

def puppet(pose,cell):
    a=Art(cell);dx,dy,arm,step=rig(pose)
    if pose=='dead':
        a.line([(6,42),(22,43)],'t',2);a.line([(13,40),(16,43)],'B');a.poly([(19,41),(25,36),(31,39),(28,43),(23,44)],'r');a.oval((32,37,40,43),'t','o');a.line([(35,39),(38,40)],'o');a.line([(17,38),(20,41)],'B',2);a.line([(31,39),(37,35)],'B',2);a.line([(8,42),(10,37),(16,35)],'h');return a.im
    cx=23+dx/2;cy=24+dy;hx=cx+1;hy=14+dy
    a.line([(8,4),(38,4)],'o',3);a.line([(8,4),(38,4)],'t');a.line([(23,2),(23,6)],'B',2)
    arms=[[(cx-5,cy-4),(cx-12,cy-1+arm/3),(cx-15,cy-5+step)],[(cx+5,cy-4),(cx+11,cy-1-arm/3),(min(42,cx+16+arm/4),cy-6-arm/3)]]
    legs=[[(cx-3,cy+7),(cx-5-step,cy+12),(cx-7-step,41-dy/2)],[(cx+3,cy+7),(cx+6+step,cy+12),(cx+8+step,40+dy/2)]]
    for i,p in enumerate(arms+legs):
        a.limb(p,'B',2)
        for x,y in p:a.oval((x-1,y-1,x+1,y+1),'y','o')
        ex,ey=p[-1];a.line([((10 if i==0 else 36 if i==1 else 19 if i==2 else 29),5),(ex,ey)],'m')
        if i>1:a.poly([(ex-2,ey-1),(ex+1,ey-2),(ex+4,ey),(ex+3,ey+2),(ex-2,ey+2)],'r');a.line([(ex,ey),(ex+2,ey)],'p')
        else:a.line([(ex,ey),(ex+2,ey+2)],'t',2)
    a.poly([(cx-5,cy-7),(cx+5,cy-7),(cx+6,cy+2),(cx+3,cy+8),(cx-3,cy+8),(cx-6,cy+2)],'R');a.poly([(cx-3,cy-5),(cx+1,cy-5),(cx+2,cy+4),(cx-3,cy+4)],'p',None);a.line([(cx,cy-4),(cx,cy+6)],'y');a.pixel(cx+1,cy,'i')
    a.poly([(hx-5,hy-6),(hx+2,hy-7),(hx+6,hy-3),(hx+5,hy+4),(hx+1,hy+6),(hx-4,hy+4),(hx-6,hy)],'t');a.poly([(hx-3,hy-4),(hx+1,hy-5),(hx+3,hy-2),(hx+2,hy+3),(hx-3,hy+2)],'q',None);a.line([(hx-2,hy-1),(hx+1,hy-1)],'o');a.line([(hx+3,hy-1),(hx+5,hy-2)],'o');a.pixel(hx+4,hy-1,'C');a.line([(hx-1,hy+3),(hx+4,hy+3)],'r');a.line([(hx,hy+2),(hx,hy+4)],'B');a.line([(hx+3,hy+2),(hx+3,hy+4)],'B')
    a.poly([(hx-5,hy-5),(hx-3,hy-10),(hx+3,hy-9),(hx+7,hy-4)],'v');a.line([(hx-3,hy-7),(hx+2,hy-7)],'l');a.oval((hx+5,hy-7,hx+8,hy-4),'y','o')
    return a.im

def totem(pose,cell):
    a=Art(cell);dx,dy,arm,step=rig(pose)
    if pose=='dead':
        for x,y,r in [(10,40,5),(23,39,7),(37,40,5)]:
            a.poly([(x-r,y-3),(x+r-1,y-4),(x+r,y+2),(x+1,44),(x-r,43)],'b');a.line([(x-r+2,y-1),(x+r-2,y)],'t');a.line([(x-2,y+1),(x+2,y+1)],'o')
        a.poly([(29,37),(33,34),(38,37),(36,41)],'G');return a.im
    cx=24+dx/2
    # Three unequal carved masks wobble at their own joints, rather than one box.
    for j,(cy,w) in enumerate([(35,11),(24,9),(12,7)]):
        x=cx+(step/2 if j%2 else -step/3);y=min(36,cy+(dy/2 if j<2 else dy)) if j==0 else cy+(dy/2 if j<2 else dy)
        a.poly([(x-w,y-5),(x-w+2,y-8),(x+w-2,y-7),(x+w,y-3),(x+w-1,y+6),(x+w-4,y+8),(x-w+2,y+7)],'b');a.poly([(x-w+2,y-5),(x-1,y-7),(x+3,y-4),(x+3,y+6),(x-w+3,y+5)],'B',None);a.line([(x-w+3,y-6),(x-2,y-6)],'t');a.line([(x+w-2,y-4),(x+w-2,y+5)],'d')
        a.poly([(x-w+3,y-2),(x-2,y),(x-w+3,y+2)],'o');a.poly([(x+2,y),(x+w-2,y-3),(x+w-2,y+1)],'o');a.pixel(x-w+5,y,'e');a.pixel(x+w-3,y-1,'e');a.poly([(x,y-1),(x+2,y+3),(x-1,y+3)],'t');a.line([(x-4,y+4),(x+4,y+4)],'o');a.pixel(x-2,y+4,'y');a.pixel(x+2,y+4,'y')
        if j==1:a.line([(x-w+2,y+1),(x-w+4,y+4)],'G');a.line([(x+w-3,y+1),(x+w-4,y+4)],'G')
    # Carved fan crest and independently swinging vine fists.
    y=6+dy
    for ox,top in [(-9,4),(-5,2),(0,3),(5,2),(9,5)]:a.poly([(cx+ox-2,y+3),(cx+ox-1,max(2,top+dy/2)),(cx+ox+1,max(2,top+dy/2)),(cx+ox+2,y+3)],'G');a.line([(cx+ox,max(3,top+dy/2+1)),(cx+ox,y+2)],'a')
    for p in [[(cx-10,33),(cx-16,30+arm/3),(cx-18,25+step)],[(cx+10,33),(cx+15,29-arm/3),(min(43,cx+18+arm/4),24-arm/2)]]:a.limb(p,'G',2);ex,ey=p[-1];a.poly([(ex-2,ey-2),(ex+2,ey-2),(ex+3,ey+1),(ex+1,ey+3),(ex-2,ey+2)],'B');a.pixel(ex-1,ey-1,'t')
    a.poly([(cx-13,42),(cx+13,42),(cx+12,44),(cx-12,44)],'b');a.line([(cx-10,43),(cx+10,43)],'t')
    return a.im

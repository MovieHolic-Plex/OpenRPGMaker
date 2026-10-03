"""Gem fox, four-wing hornet, two carnivorous plants and a finned sea serpent."""
import math
from arcane_core import Art,P,rig,shift
CREATURES={'carbuncle-01','sylph-hornet-transparent','plant-01','plant-carnivore','lemora-01'}
def draw(slug,pose,cell):return {'carbuncle-01':fox,'sylph-hornet-transparent':hornet,'plant-01':plant,'plant-carnivore':flower,'lemora-01':serpent}[slug](pose,cell)
def fox(pose,cell):
    a=Art(cell);dx,dy,arm,step=rig(pose)
    if pose=='dead':
        a.poly([(6,42),(10,37),(17,36),(24,38),(31,38),(35,41),(32,44),(22,43),(14,44)],'C');a.poly([(8,40),(4,37),(3,33),(9,34),(14,39)],'h');a.poly([(31,39),(35,37),(41,39),(43,41),(40,44),(34,43)],'u');a.line([(36,40),(39,41)],'o');a.jewel(34,38,'e');return a.im
    cx=22+dx;cy=30+dy/2;hx=33+dx/2;hy=21+dy
    # Huge squirrel-like tail curls left, moves through the tail root.
    a.poly([(cx-8,cy+3),(8,cy+1),(4,cy-5),(5,cy-12),(10,cy-17),(16,cy-17),(19,cy-13),(17,cy-9),(14,cy-8),(12,cy-11),(14,cy-13),(10,cy-12),(8,cy-7),(11,cy-3),(cx-5,cy-1)],'C');a.poly([(6,cy-6),(7,cy-11),(11,cy-15),(16,cy-15),(17,cy-12),(14,cy-11),(12,cy-13),(9,cy-9),(10,cy-5),(15,cy-2)],'u',None);a.line([(7,cy-10),(10,cy-13),(14,cy-14)],'U')
    a.poly([(cx-9,cy-4),(cx-5,cy-9),(cx+3,cy-9),(cx+9,cy-4),(cx+9,cy+4),(cx+3,cy+8),(cx-5,cy+7),(cx-9,cy+3)],'C');a.poly([(cx-5,cy-7),(cx+2,cy-7),(cx+6,cy-2),(cx+3,cy+3),(cx-4,cy+3)],'u',None);a.line([(cx-5,cy-6),(cx,cy-7)],'U')
    legs=[[(cx-6,cy+2),(cx-8-step/2,39),(cx-10-step/2,43)],[(cx+5,cy+1),(cx+8+step/2,38),(cx+7+step/2,43)]]
    for p in legs:a.limb(p,'C',3);ex,ey=p[-1];a.poly([(ex-2,42),(ex+3,42),(ex+4,44),(ex-3,44)],'h');a.pixel(ex+2,43,'U')
    a.poly([(hx-8,hy-1),(hx-7,hy-8),(hx-5,hy-15),(hx-1,hy-10),(hx+3,hy-15),(hx+5,hy-7),(hx+8,hy-3),(hx+10,hy),(hx+8,hy+4),(hx+3,hy+7),(hx-3,hy+7),(hx-7,hy+3)],'C');a.poly([(hx-5,hy-7),(hx-2,hy-8),(hx+3,hy-7),(hx+5,hy-2),(hx+8,hy),(hx+5,hy+4),(hx-1,hy+5),(hx-5,hy+1)],'u',None);a.poly([(hx-5,hy-12),(hx-3,hy-8),(hx-5,hy-6)],'p');a.poly([(hx+3,hy-12),(hx+3,hy-7),(hx+1,hy-8)],'p')
    a.line([(hx+1,hy-2),(hx+4,hy-3)],'o',2);a.pixel(hx+3,hy-2,'e');a.pixel(hx+8,hy,'o');a.line([(hx+3,hy+3),(hx+7,hy+2)],'s');a.poly([(hx-5,hy+3),(hx-6,hy+8),(hx,hy+7),(hx+1,hy+4)],'h');a.jewel(hx-1,hy-6,'e')
    if pose=='attack':a.poly([(hx+3,hy+3),(hx+8,hy+2),(hx+8,hy+6),(hx+4,hy+7)],'r');a.line([(hx+4,hy+4),(hx+7,hy+3)],'i')
    if pose=='hit':a.line([(hx+1,hy-1),(hx+4,hy)],'C',2)
    return a.im

def hornet(pose,cell):
    a=Art(cell);dx,dy,arm,step=rig(pose)
    if pose=='dead':
        a.poly([(7,40),(13,34),(20,39),(16,43),(10,43)],'h');a.poly([(12,43),(18,39),(27,39),(34,42),(31,44),(20,44)],'B');a.line([(24,41),(26,43)],'o',2);a.line([(31,41),(39,39),(43,41)],'B',2);return a.im
    cx=22+dx/2;cy=28+dy
    wingangles={'idle_a':(-2,1),'idle_b':(1,3),'idle_c':(-4,-1),'windup':(3,0),'move':(-3,-2),'attack':(2,4),'recover':(0,2),'hit':(5,3)}[pose]
    for i,(tx,ty) in enumerate([(7,9),(21,6),(6,19),(32,12)]):
        ty+=wingangles[i%2];tx+=dx/2;a.poly([(cx,cy-4),(tx,ty),(tx+4,ty-1),(tx+5,ty+4),(cx+2,cy-2)],'m');a.poly([(cx,cy-5),(tx+1,ty+1),(tx+3,ty+1),(cx+1,cy-3)],'h',None);a.line([(tx+1,ty+1),(tx+2,ty+3)],'w');a.line([(tx+3,ty+3),(cx,cy-3)],'s')
    # Segmented tapered abdomen has a downward hooked stinger.
    a.poly([(cx-4,cy-2),(cx-10,cy-2),(cx-15,cy+2),(cx-15,cy+6),(cx-9,cy+9),(cx-2,cy+6),(cx+1,cy+1)],'B');a.poly([(cx-13,cy+1),(cx-9,cy),(cx-5,cy+1),(cx-5,cy+5),(cx-9,cy+7),(cx-13,cy+5)],'y',None)
    for x in (-10,-5):a.line([(cx+x,cy),(cx+x-1,cy+6)],'o',2)
    a.poly([(cx-14,cy+5),(cx-18,cy+11),(cx-17,cy+5)],'i');a.poly([(cx-3,cy-5),(cx+3,cy-5),(cx+7,cy),(cx+5,cy+5),(cx-2,cy+4),(cx-5,cy)],'R');a.line([(cx-2,cy-3),(cx+2,cy-3)],'p');a.line([(cx-3,cy+2),(cx+2,cy+3)],'r')
    hx=cx+10;hy=cy-5-arm/4
    a.poly([(hx-6,hy-5),(hx,hy-7),(hx+5,hy-3),(hx+6,hy+3),(hx+2,hy+6),(hx-4,hy+4),(hx-6,hy)],'R');a.poly([(hx-3,hy-4),(hx+1,hy-5),(hx+3,hy-2),(hx,hy+1),(hx-4,hy)],'p',None);a.oval((hx+1,hy-3,hx+4,hy+1),'y','o');a.pixel(hx+3,hy-2,'i');a.line([(hx-3,hy-5),(hx-5,hy-10),(hx-2,hy-12)],'o',2);a.line([(hx,hy-6),(hx+3,hy-11),(hx+6,hy-10)],'o',2);a.poly([(hx+3,hy+3),(hx+7,hy+2),(hx+5,hy+6)],'t')
    for i in range(3):
        x=cx+i*3-2;y=cy+1+i
        a.line([(x,y),(x+1+step/2,cy+10),(x+6+step/2,cy+11-i)],'o',2);a.line([(x,y),(x+1+step/2,cy+10),(x+6+step/2,cy+11-i)],'t')
    if pose=='attack':a.line([(hx+3,hy+4),(45,hy+5)],'y',2)
    return a.im

def roots(a,pose):
    dx,dy,arm,step=rig(pose)
    for i,(x,y) in enumerate([(8,43),(18,44),(29,44),(41,43)]):
        p=[(24,35),(x+(-step if i%2 else step)/2,40),(x,42)];a.limb(p,'G',3);a.poly([(x-2,42),(x+2,42),(x+3,44),(x-3,44)],'G');a.line([(x-1,43),(x+1,43)],'a')

def plant(pose,cell):
    a=Art(cell);dx,dy,arm,step=rig(pose)
    if pose=='dead':
        a.poly([(6,43),(10,39),(18,41),(23,38),(31,40),(40,44),(30,43),(20,44)],'G');a.poly([(28,36),(35,33),(42,37),(41,42),(35,44),(30,42)],'G');a.line([(32,38),(39,40)],'o');a.poly([(25,38),(26,34),(31,36),(29,40)],'p');return a.im
    roots(a,pose);hx=28+dx/2;hy=17+dy;gape={'idle_a':9,'idle_b':10,'idle_c':8,'windup':5,'move':11,'attack':14,'recover':6,'hit':12}[pose]
    a.limb([(24,40),(17,31+dy),(hx-7,hy+9)],'G',6);a.line([(21,37),(19,32+dy),(hx-8,hy+9)],'a',2)
    for pts in [[(18,33),(9,28+dy),(7,22+dy),(14,23+dy),(20,29)],[(22,37),(28,31+dy),(38,31+dy),(34,36),(25,39)]]:a.poly(pts,'G');a.line([pts[0],pts[1],pts[2]],'a')
    a.poly([(hx-14,hy+2),(hx-12,hy-5),(hx-6,hy-10),(hx+2,hy-11),(hx+11,hy-7),(hx+15,hy-2),(hx+9,hy+2),(hx-4,hy+5)],'G');a.poly([(hx-10,hy-3),(hx-5,hy-8),(hx+2,hy-9),(hx+9,hy-6),(hx+11,hy-3),(hx+3,hy),(hx-5,hy+1)],'a',None);a.line([(hx-9,hy-4),(hx-4,hy-7),(hx+1,hy-8)],'A')
    a.poly([(hx-8,hy+2),(hx+12,hy-1),(hx+13,hy+gape),(hx+6,hy+gape+4),(hx-5,hy+gape+3)],'r');a.poly([(hx-7,hy+5),(hx+10,hy+3),(hx+10,hy+gape),(hx+3,hy+gape+1),(hx-5,hy+gape)],'o',None)
    a.poly([(hx-10,hy+gape),(hx-3,hy+gape+5),(hx+6,hy+gape+6),(hx+13,hy+gape+2),(hx+14,hy+gape+5),(hx+7,hy+gape+9),(hx-3,hy+gape+8),(hx-11,hy+gape+3)],'G');a.line([(hx-7,hy+gape+3),(hx+2,hy+gape+6),(hx+9,hy+gape+3)],'a')
    for x,y in [(hx-5,hy+3),(hx+1,hy+2),(hx+7,hy+1)]:a.poly([(x,y),(x+4,y),(x+2,y+5)],'i')
    for x,y in [(hx-3,hy+gape+3),(hx+3,hy+gape+4),(hx+9,hy+gape+1)]:a.poly([(x,y),(x+3,y),(x+2,y-4)],'t');a.pixel(x+2,y-2,'i')
    a.poly([(hx+2,hy-7),(hx+8,hy-5),(hx+6,hy-3),(hx+2,hy-4)],'o');a.pixel(hx+5,hy-5,'e');a.pixel(hx+6,hy-5,'E')
    a.line([(hx+3,hy+gape),(hx+7,hy+gape-1),(hx+9,hy+gape)],'p',2)
    return a.im

def flower(pose,cell):
    a=Art(cell);dx,dy,arm,step=rig(pose)
    if pose=='dead':
        a.poly([(7,43),(17,39),(23,41),(29,37),(38,42),(40,44),(26,43),(18,44)],'G');a.poly([(27,38),(31,34),(38,35),(42,39),(38,44),(30,43)],'R');a.line([(32,39),(38,40)],'o');a.pixel(34,39,'i');return a.im
    roots(a,pose);hx=23+dx/2;hy=max(20,18+dy)
    a.limb([(24,40),(27+step/2,31),(hx-2,hy+6)],'G',6);a.line([(23,37),(25+step/2,30),(hx-4,hy+7)],'a',2)
    for pts in [[(23,32),(15,25),(7,25),(8,30),(17,35)],[(27,35),(33,27),(41,27),(39,34),(31,38)]]:a.poly(pts,'G');a.line([pts[0],pts[1],pts[2]],'a');a.pixel(pts[1][0],pts[1][1],'A')
    # Asymmetric radial fleshy petals surround the head, distinct from plant-01 jaws.
    petals=[(-9,-5,-13,-10),(-2,-9,-3,-15),(7,-7,12,-12),(11,0,17,1),(8,8,14,12),(-2,10,-2,15),(-10,4,-15,8)]
    for x,y,ex,ey in petals:
        ex+=step/3 if y>0 else -step/3
        a.poly([(hx+x-3,hy+y-2),(hx+ex-3,hy+ey-2),(hx+ex+2,hy+ey-3),(hx+ex+4,hy+ey+1),(hx+x+2,hy+y+3)],'R');a.line([(hx+ex-1,hy+ey-1),(hx+x,hy+y)],'p',2);a.pixel(hx+ex,hy+ey-2,'q')
    a.poly([(hx-10,hy-5),(hx-5,hy-9),(hx+3,hy-9),(hx+10,hy-5),(hx+13,hy+1),(hx+9,hy+9),(hx+2,hy+12),(hx-7,hy+10),(hx-12,hy+3)],'G');a.poly([(hx-7,hy-4),(hx-2,hy-7),(hx+4,hy-6),(hx+9,hy-2),(hx+8,hy+5),(hx+3,hy+9),(hx-5,hy+6)],'a',None)
    a.poly([(hx-6,hy-1),(hx+9,hy-3),(hx+10,hy+5),(hx+4,hy+9),(hx-4,hy+7),(hx-7,hy+3)],'r');a.poly([(hx-4,hy+1),(hx+7,hy),(hx+7,hy+5),(hx+2,hy+7),(hx-4,hy+5)],'o',None)
    for x in (-4,1,6):a.poly([(hx+x,hy),(hx+x+3,hy-1),(hx+x+2,hy+4)],'i');a.poly([(hx+x,hy+7),(hx+x+3,hy+7),(hx+x+2,hy+4)],'t')
    a.line([(hx-3,hy-5),(hx,hy-4)],'o');a.line([(hx+4,hy-5),(hx+7,hy-6)],'o');a.pixel(hx+6,hy-5,'e')
    if pose=='attack':a.poly([(hx+8,hy+5),(44,hy+3),(45,hy+7),(hx+8,hy+9)],'p');a.line([(hx+9,hy+6),(43,hy+5)],'q')
    return a.im

def serpent(pose,cell):
    pal=P.copy();pal.update({'s':'2b4564','m':'416d8b','h':'7ba7b4','w':'c4d8c4'});a=Art(cell,pal);dx,dy,arm,step=rig(pose)
    if pose=='dead':
        a.poly([(4,41),(9,36),(17,37),(21,40),(29,39),(35,37),(43,40),(44,43),(37,44),(29,43),(20,44),(13,41),(6,44)],'m');a.line([(6,41),(10,38),(16,39),(20,42),(28,41),(34,39)],'h');a.poly([(34,38),(37,35),(43,36),(45,39),(44,42),(38,42)],'m');a.line([(39,38),(43,39)],'o');return a.im
    hx=34+dx/2;hy=12+dy;curl=step/2
    # Wide lower coil and S-neck are redrawn around independent flexion points.
    a.poly([(4,39),(7,32),(14,29),(23,30),(30,34),(33,39),(29,43),(17,44),(8,43),(6,40),(11,36),(18,35),(24,37),(25,39),(21,41),(15,40),(16,38),(12,38),(10,40),(17,42),(25,41),(28,38),(24,34),(18,33),(11,35),(7,39)],'m');a.line([(7,34),(12,31),(18,31),(25,33),(30,37)],'h',2);a.line([(8,41),(15,43),(23,42)],'w')
    a.poly([(25,36),(20+curl,30),(19+curl,23+dy),(23+curl,18+dy),(28,17+dy),(hx-5,hy+5),(hx+1,hy+5),(hx+2,hy+10),(28+curl,22+dy),(25+curl,26+dy),(27,32),(30,36)],'m');a.poly([(hx-2,hy+6),(hx,hy+9),(26+curl,22+dy),(23+curl,26+dy),(24,31),(27,35),(25,36),(21+curl,30),(21+curl,24+dy),(25+curl,19+dy)],'t',None);a.line([(hx-1,hy+7),(25+curl,21+dy),(22+curl,25+dy)],'y')
    for y,x in [(23,24+curl),(27,22+curl),(31,23)]:a.line([(x,y+dy/2),(x+3,y+dy/2)],'B')
    a.poly([(hx-8,hy),(hx-5,hy-7),(hx+1,hy-9),(hx+7,hy-6),(hx+11,hy-3),(hx+11,hy+1),(hx+7,hy+4),(hx+3,hy+7),(hx-4,hy+5)],'m');a.poly([(hx-5,hy-3),(hx-2,hy-6),(hx+2,hy-7),(hx+7,hy-4),(hx+9,hy-2),(hx+4,hy),(hx-2,hy+1)],'h',None);a.line([(hx-3,hy-5),(hx+2,hy-6)],'w')
    a.poly([(hx-7,hy-3),(hx-12,hy-7),(hx-12,hy+1),(hx-7,hy+5)],'R');a.line([(hx-11,hy-4),(hx-9,hy+1)],'p');a.poly([(hx-2,hy-7),(hx-4,max(2,hy-13)),(hx+1,hy-9)],'t');a.poly([(hx+3,hy-7),(hx+5,max(2,hy-12)),(hx+6,hy-6)],'t')
    a.line([(hx+1,hy-2),(hx+6,hy-3)],'o',2);a.pixel(hx+4,hy-2,'e');a.pixel(hx+5,hy-2,'E')
    gape=6 if pose=='attack' else 2
    a.poly([(hx+1,hy+2),(hx+10,hy),(hx+10,hy+gape),(hx+5,hy+gape+3),(hx,hy+gape+1)],'r');a.line([(hx+2,hy+2),(hx+8,hy+1)],'i');a.poly([(hx+2,hy+3),(hx+4,hy+2),(hx+3,hy+6)],'i');a.line([(hx+3,hy+gape+1),(hx+7,hy+gape)],'p')
    a.poly([(19+curl,24+dy),(15+curl,20+dy),(16+curl,28+dy),(20+curl,31+dy)],'R');a.line([(17+curl,24+dy),(19+curl,28+dy)],'p')
    return a.im

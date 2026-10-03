"""Ten separately shaped gelatin species; compressive joint geometry."""
from arcane_core import Art,P,rig,face
SLIMES={'slime','slime-red','slime-blue','slime-green','slime-metal','king-slime-01','slime-king','slime-cube','ooze-black','ooze-acid'}
PAL={
 'slime':('315b6f','448e99','75bdc1','bbe4d5'),
 'slime-red':('6f3548','b35859','e78a66','ffd0a3'),
 'slime-blue':('343b70','526ca9','88a8dd','d0e8f0'),
 'slime-green':('31554b','569772','9ac779','d7e59d'),
 'slime-metal':('3f5362','7792a0','b2c6ca','f3f0db'),
 'king-slime-01':('344a7a','507fc0','84bbdf','d7f0df'),
 'slime-king':('583766','92519a','c78cc6','f2d0e0'),
 'slime-cube':('376650','64a27e','a5d0a3','e5efd0'),
 'ooze-black':('242b42','41405e','6c658e','ada2b6'),
 'ooze-acid':('3d552c','7a9f3a','bfcd64','f3e3a4')}
def draw(slug,pose,cell):
    pal=P.copy();pal.update(zip(('s','m','h','w'),PAL[slug]));a=Art(cell,pal);dx,dy,arm,step=rig(pose)
    dead=pose=='dead'; goo=slug.startswith('ooze'); cube=slug=='slime-cube'; metal=slug=='slime-metal'; king=slug in ('slime-king','king-slime-01')
    top={'idle_a':20,'idle_b':21,'idle_c':19,'windup':28,'move':16,'attack':24,'recover':23,'hit':29,'dead':39}[pose]
    if king:top=max(12,top-6) if not dead else top
    left=7 if not goo else 4;right=41 if not goo else 44
    if dead:
        a.poly([(left,42),(left+3,39),(16,40),(22,38),(30,40),(right-3,39),(right,42),(right-2,44),(31,43),(24,44),(15,43),(left+2,44)],'s')
        a.poly([(left+4,41),(17,41),(23,39),(29,41),(right-5,41),(right-6,43),(22,42),(14,42)],'m',None)
        a.line([(left+5,41),(16,41)],'h');a.line([(22,40),(27,41)],'w')
        a.line([(16,40),(18,42),(20,40)],'o');a.line([(29,41),(32,42),(34,40)],'o');a.line([(21,43),(28,43)],'r')
        if king:a.poly([(29,40),(35,37),(42,39),(40,43),(32,43)],'y');a.pixel(37,40,'R')
        if cube:a.poly([(16,40),(23,37),(28,39),(25,43),(18,43)],'h');a.line([(23,38),(22,41)],'w')
        return a.im
    if pose=='windup':left-=2;right+=1
    if pose=='move':left+=4;right-=3
    fx=26+dx; fy=min(top+10,37)
    if cube and not dead:
        a.poly([(left+1,top+3),(29+dx,top-3),(right-2,top+3),(right-2,38),(23,44),(left,39)],'s')
        a.poly([(left+2,top+4),(23,top+10),(39,top+4),(29+dx,top-2)],'h')
        a.poly([(left+1,top+5),(23,top+11),(23,42),(left+1,38)],'m',None)
        a.poly([(24,top+11),(39,top+6),(39,37),(24,42)],'s',None)
        a.line([(left+4,top+6),(22,top+12),(22,38)],'w');a.line([(27,top+9),(34,top+7)],'w');a.box((27,32,32,36),'m');a.line([(28,33),(31,34)],'h')
        fx=31;fy=min(top+13,34)
    else:
        peak=25+dx
        pts=[(left,43),(left-1,39),(left+3,34),(left+4,top+9),(left+10,top+3),(peak,top),(right-6,top+4),(right-2,top+12),(right,37),(right+1,41),(right-2,44),(left+5,44)]
        if metal and not dead:pts=[(left,42),(left+2,34),(17+dx,top+8),(25+dx,top-5),(30+dx,top+4),(right-4,top+13),(right,40),(right-3,44),(left+3,44)]
        if slug=='slime-red' and not dead:pts[4:6]=[(left+9,top+4),(left+12,top-5),(peak,top+1),(peak+5,top-2)]
        if slug=='slime-green' and not dead:pts[4:6]=[(left+9,top+4),(peak-3,top-2),(peak+4,top),(peak+9,top-3)]
        if goo:
            pts=[(left,44),(left-1,41),(8,38),(10,top+9),(14,top+4),(20+dx,top),(29+dx,top+2),(32,top+9),(38,top+6),(41,top+14),(43,40),(45,43),(40,44),(34,43),(29,44),(22,42),(17,44),(11,42),(8,44)]
            if slug=='ooze-acid':pts[4:8]=[(13,top+6),(16+dx,top+2),(18+dx,top-3),(21+dx,top-3),(23+dx,top+2),(28+dx,top+4),(30,top+11)]
        a.poly(pts,'s');a.poly([(left+3,40),(left+5,top+10),(left+11,top+4),(peak-1,top+2),(peak+8,top+5),(right-5,top+11),(right-7,35),(right-3,39),(right-6,42),(15,41)],'m',None)
        if not dead:
            a.poly([(left+7,top+10),(left+11,top+5),(peak-2,top+3),(peak+2,top+5),(peak-3,top+8),(left+12,top+10)],'h',None)
            a.line([(left+10,top+8),(left+12,top+5),(peak-3,top+4)],'w')
            a.poly([(right-9,31),(right-7,34),(right-8,38),(right-12,39),(right-12,36)],'h',None)
        a.line([(left+6,42),(left+11,42),(left+13,40)],'h');a.pixel(right-6,40,'w')
        if metal and not dead:
            a.poly([(22+dx,top+3),(25+dx,top-3),(27+dx,top+4),(28,top+11),(24,top+8)],'w',None)
            a.line([(12,34),(19,31),(23,32)],'d');a.line([(30,37),(36,34)],'w')
    if dead:
        a.line([(16,40),(18,42),(20,40)],'o');a.line([(29,41),(32,42),(34,40)],'o');a.line([(21,43),(28,43)],'r')
        if king:a.poly([(29,40),(35,37),(42,39),(40,43),(32,43)],'y');a.pixel(37,40,'R')
        if cube:a.poly([(16,40),(23,37),(28,39),(25,43),(18,43)],'h');a.line([(23,38),(22,41)],'w')
    else:
        face(a,fx,fy,pose)
        if goo:
            a.box((fx-5,fy,fx-2,fy+1),'e');a.box((fx+3,fy,fx+6,fy+1),'e');a.line([(fx-2,fy+4),(fx+1,fy+6),(fx+5,fy+4)],'p')
            a.oval((8,32,12,36),'m','o');a.pixel(10,32,'h');a.oval((36,27,40,31),'m','o');a.pixel(38,28,'w')
            if slug=='ooze-acid':
                a.poly([(36,40),(39,35),(40,top+5),(43,top+3),(45,top+6),(43,34),(43,39),(40,43)],'m');a.line([(42,top+5),(41,34),(40,39)],'h')
                a.oval((8,top+2,12,top+6),'m','o');a.pixel(10,top+3,'w')
        if slug=='slime-green':
            a.poly([(18+dx,top+3),(16+dx,top-4),(20+dx,top-2),(22+dx,top+3)],'G');a.poly([(23+dx,top+2),(26+dx,top-3),(29+dx,top-2),(26+dx,top+4)],'a');a.line([(19+dx,top),(21+dx,top+4)],'A')
        if slug=='slime-blue':
            for x,y in [(14,37),(17,33),(20,39)]:a.box((x,y,x+1,y+1),'h');a.pixel(x,y,'w')
        if king:
            cx=22+dx;cy=top+1
            if slug=='king-slime-01':
                a.poly([(cx-9,cy),(cx-11,cy-8),(cx-5,cy-5),(cx-1,cy-11),(cx+3,cy-5),(cx+8,cy-9),(cx+7,cy+1)],'B')
                a.poly([(cx-8,cy-1),(cx-9,cy-6),(cx-5,cy-3),(cx-1,cy-8),(cx+3,cy-3),(cx+6,cy-6),(cx+6,cy-1)],'y',None)
                a.line([(cx-7,cy),(cx+6,cy)],'i');a.jewel(cx-1,cy-2,'R')
            else:
                a.poly([(cx-7,cy),(cx-8,cy-4),(cx-4,cy-8),(cx+3,cy-8),(cx+7,cy-4),(cx+6,cy)],'r')
                a.line([(cx-7,cy),(cx+6,cy)],'y',2);a.oval((cx-3,cy-11,cx+1,cy-7),'y','o');a.line([(cx-1,cy-10),(cx-1,cy-8)],'i')
                a.line([(cx-4,cy-6),(cx-5,cy-3)],'p');a.line([(cx+2,cy-6),(cx+3,cy-3)],'p')
    return a.im

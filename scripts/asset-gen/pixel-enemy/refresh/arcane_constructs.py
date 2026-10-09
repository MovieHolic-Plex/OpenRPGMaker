"""Jointed stone, clay, iron and crystalline constructs at native cell size."""
from arcane_core import Art,P,rig,shift
GOLEMS={'golem','golem-stone','golem-clay','golem-iron','golem-crystal','spirit-earth'}
COLORS={
'golem':('304d48','50746c','85a08c','b4c4a0'),
'golem-stone':('3e4855','657781','9da7a8','d5d5bf'),
'golem-clay':('704142','aa6954','d69b76','f0c792'),
'golem-iron':('303c4c','506676','839ca9','d1dbd2'),
'golem-crystal':('4a3a65','795595','b68cca','dfc7e3'),
'spirit-earth':('4e4947','827461','b2a58c','d7ceb4')}
def slab(a,cx,cy,w,h,color='s',crystal=False):
    pts=[(cx-w,cy-h+2),(cx-w+3,cy-h),(cx+w-2,cy-h),(cx+w,cy-h+3),(cx+w,cy+h-2),(cx+w-3,cy+h),(cx-w+2,cy+h),(cx-w,cy+h-3)]
    if crystal:pts=[(cx-w,cy),(cx-2,cy-h-3),(cx+w,cy-h+1),(cx+w-1,cy+h),(cx-w+2,cy+h+2)]
    a.poly(pts,color);a.poly([(cx-w+2,cy-h+3),(cx,cy-h+1),(cx+2,cy+h-2),(cx-w+2,cy+h-1)],'m',None)
    a.line([(cx-w+3,cy-h+2),(cx,cy-h+1),(cx+w-2,cy-h+2)],'h');a.line([(cx-w+2,cy-h+3),(cx-w+2,cy)],'w')
    a.line([(cx+w-2,cy),(cx+w-3,cy+h-1),(cx+2,cy+h-1)],'d')
def draw(slug,pose,cell):
    pal=P.copy();pal.update(zip(('s','m','h','w'),COLORS[slug]));a=Art(cell,pal);dx,dy,arm,step=rig(pose)
    iron=slug=='golem-iron'; clay=slug=='golem-clay'; crystal=slug=='golem-crystal';earth=slug=='spirit-earth';stone=slug=='golem-stone';dead=pose=='dead'
    if dead:
        for x,y,w,h in [(10,40,5,4),(20,39,6,5),(33,40,7,4),(40,42,4,2),(12,33,3,3)]:slab(a,x,y-(2 if crystal else 0),w,h,crystal=crystal)
        slab(a,29,33,6,4,crystal=crystal);a.line([(26,32),(32,34)],'o');a.line([(25,32),(27,33)],'e')
        if iron:a.poly([(19,36),(22,31),(31,31),(34,35),(32,38),(23,38)],'b');a.line([(22,34),(31,34)],'r');a.line([(25,32),(27,34),(29,32)],'R')
        if clay:a.poly([(8,37),(13,32),(15,36),(14,39),(10,40)],'m');a.line([(10,36),(13,36)],'w')
        if earth:a.line([(8,41),(14,40),(18,42),(22,42)],'G',2);a.line([(33,39),(37,36),(41,37)],'a')
        return a.im
    cx=24+dx;ty=21+dy-(3 if earth else 0)
    # Heavy separate feet remain on the ground while upper body recoils.
    if not earth:
        lx=16-step/2;rx=32+step/2
        slab(a,lx,36,4,5,crystal=crystal);slab(a,rx,36,4,5,crystal=crystal)
        slab(a,lx-1,42,6,2,crystal=False);slab(a,rx+1,42,6,2,crystal=False)
        if iron:
            for x in (lx,rx):a.line([(x-3,35),(x+3,35)],'b');a.box((x-2,38,x+2,39),'h')
    else:
        for x,y in [(10,37+dy),(22,40-dy),(34,36+dy)]:slab(a,x,y,3,2)
        a.line([(12,32+dy),(17,35+dy),(22,33+dy),(24,36+dy)],'G',2);a.line([(30,33+dy),(34,31+dy),(38,34+dy)],'G',2)
    # Arm chains, individually flexed at shoulder/elbow and fist.
    lsh=(cx-9,ty-3);lel=(cx-14,ty+5);lf=(cx-13-arm/2,ty+12-arm/3)
    rsh=(cx+9,ty-3);rel=(cx+13+arm/3,ty+3-arm/2);rf=(min(41,cx+14+arm/3),ty+9-arm)
    if pose=='windup':lf=(cx-13,ty+2);lel=(cx-14,ty-3);rf=(cx+11,12);rel=(cx+14,ty-5)
    elif pose=='attack':lf=(cx-6,ty+12);lel=(cx-11,ty+4);rf=(40,ty+11);rel=(cx+13,ty+3)
    a.limb([lsh,lel,lf],'d',6);a.limb([rsh,rel,rf],'d',6)
    slab(a,lf[0],lf[1],4,5,crystal=crystal);slab(a,rf[0],rf[1],5 if clay else 4,5,crystal=crystal)
    for f in (lf,rf):a.line([(f[0]-2,f[1]),(f[0]+2,f[1])],'d');a.pixel(f[0]-2,f[1]-3,'w')
    slab(a,cx,ty,10 if not clay else 9,11,crystal=crystal)
    if iron:
        a.poly([(cx-7,ty-7),(cx+6,ty-7),(cx+8,ty-3),(cx+7,ty+6),(cx-7,ty+6),(cx-8,ty-2)],'b');a.oval((cx-5,ty-5,cx+5,ty+5),'d','o');a.oval((cx-3,ty-3,cx+3,ty+3),'R','o');a.pixel(cx-1,ty-2,'q')
        a.line([(cx-9,ty+9),(cx+8,ty+9)],'h');a.box((cx-7,ty-16,cx-3,ty-12),'s','o');a.line([(cx-7,ty-17),(cx-2,ty-17)],'h',2)
        for x,y in [(cx-8,ty-8),(cx+8,ty-8),(cx-8,ty+7),(cx+8,ty+7)]:a.pixel(x,y,'y')
        a.line([(cx-4,ty+8),(cx+4,ty+8)],'b')
    elif clay:
        a.poly([(cx-7,ty-8),(cx+6,ty-8),(cx+8,ty),(cx+6,ty+8),(cx-6,ty+8),(cx-8,ty)],'m')
        a.line([(cx-6,ty-7),(cx+5,ty-7)],'w');a.line([(cx-6,ty+7),(cx+5,ty+7)],'h');a.line([(cx-3,ty-3),(cx+2,ty-2),(cx-1,ty+2),(cx+4,ty+3)],'d')
        a.line([(cx-7,ty+3),(cx-4,ty+5)],'p')
    elif crystal:
        a.poly([(cx-6,ty-7),(cx+2,ty-11),(cx+7,ty-3),(cx+5,ty+7),(cx-3,ty+10)],'h');a.poly([(cx+2,ty-10),(cx+2,ty+6),(cx+6,ty-3)],'w',None);a.line([(cx-4,ty-3),(cx+2,ty+6),(cx-2,ty+8)],'m')
        for x,lean in ((cx-10,-2),(cx+9,2)):
            a.poly([(x-4,ty-5),(x+lean,ty-17),(x+3,ty-6),(x+1,ty)],'m');a.line([(x+lean,ty-15),(x,ty-5)],'w')
    elif earth:
        a.poly([(cx-8,ty-8),(cx-4,ty-11),(cx+3,ty-10),(cx+8,ty-5),(cx+7,ty+6),(cx+1,ty+10),(cx-7,ty+6)],'m')
        a.line([(cx-7,ty-8),(cx-2,ty-5),(cx-4,ty),(cx-1,ty+6)],'d');a.poly([(cx-8,ty-8),(cx-3,ty-12),(cx+6,ty-10),(cx+9,ty-6),(cx+2,ty-7)],'G');a.line([(cx-3,ty-10),(cx+3,ty-9)],'a')
    else:
        a.poly([(cx-7,ty-7),(cx-1,ty-9),(cx+6,ty-5),(cx+7,ty+6),(cx,ty+9),(cx-7,ty+6)],'m')
        a.line([(cx-7,ty-2),(cx-2,ty-3),(cx+2,ty),(cx+6,ty-1)],'d');a.line([(cx-4,ty+4),(cx,ty+3),(cx+3,ty+6)],'d')
        if stone:a.box((cx-5,ty-4,cx+5,ty-1),'s');a.line([(cx-4,ty-4),(cx+4,ty-4)],'h')
        else:a.poly([(cx-10,ty-9),(cx-7,ty-13),(cx-2,ty-11),(cx+1,ty-8),(cx-3,ty-6)],'G');a.line([(cx-8,ty-10),(cx-4,ty-9)],'a');a.jewel(cx,ty+2,'C')
    # Head rests in the shoulder cavity; eyes turn right, jaw breaks on impact.
    hx=cx+2+(1 if pose=='attack' else 0);hy=max(7,ty-12)
    slab(a,hx,hy,5,3 if crystal else 4,crystal=crystal)
    a.line([(hx-2,hy),(hx+4,hy-1)],'o',2)
    a.pixel(hx+2,hy-1,'e');a.pixel(hx+3,hy-1,'E')
    if pose=='hit':a.line([(hx+1,hy),(hx+4,hy+1)],'o')
    else:a.line([(hx-1,hy+3),(hx+4,hy+3)],'d')
    if iron:a.box((hx-2,hy+2,hx+3,hy+3),'k');a.pixel(hx,hy+2,'r')
    if clay:a.line([(hx-4,hy-3),(hx+3,hy-3)],'y');a.pixel(hx+4,hy+1,'h')
    if crystal:a.poly([(hx-3,hy-3),(hx-1,hy-5),(hx+2,hy-4)],'h');a.line([(hx-1,hy-4),(hx-1,hy-4)],'w')
    if earth:a.line([(cx-11,ty+3),(cx-14,ty-1),(cx-13,ty-8)],'G',2);a.poly([(cx-14,ty-7),(cx-17,ty-11),(cx-12,ty-10),(cx-11,ty-7)],'a')
    return a.im

# Dedicated silhouettes replace the preliminary shared torso rig for mineral species.
_original_draw=draw
def rock(a,x,y,w,h,seed=0):
    a.poly([(x-w,y-h+2),(x-w+3,y-h),(x+w-2,y-h+1),(x+w,y-h+5),(x+w-1,y+h-2),(x+2,y+h),(x-w+1,y+h-1)],'s')
    a.poly([(x-w+2,y-h+3),(x-1,y-h+2),(x+3,y),(x-1,y+h-2),(x-w+3,y+h-3)],'m',None)
    a.poly([(x-1,y-h+2),(x+w-3,y-h+3),(x+w-2,y-1),(x+3,y)],'h',None)
    a.line([(x-w+3,y-h+2),(x-2,y-h+1)],'w');a.line([(x+w-2,y),(x+3,y+2),(x+2,y+h-2)],'d')
    if seed%2:a.line([(x-3,y-3),(x,y),(x-2,y+min(3,h-1)),(x+1,y+min(4,h-1))],'d')
    else:a.line([(x-w+2,y+2),(x-4,y+1),(x-1,y+3)],'d')

def mineral(slug,pose,cell):
    pal=P.copy();pal.update(zip(('s','m','h','w'),COLORS[slug]));a=Art(cell,pal);dx,dy,arm,step=rig(pose);stone=slug=='golem-stone';dead=pose=='dead'
    if dead:
        for j,(x,y,w,h) in enumerate([(8,41,5,3),(18,38,6,6),(30,40,7,4),(40,41,5,3)]):rock(a,x,y,w,h,j)
        a.line([(27,38),(34,39)],'o',2);a.line([(29,37),(33,38)],'m')
        if not stone:a.poly([(12,36),(16,34),(20,37),(17,39)],'G');a.line([(14,36),(17,37)],'a')
        return a.im
    cx=24+dx/2;cy=29+dy/2
    # Low, broad shoulders and overlapping slabs form an irregular rock pile.
    for x in (15-step/2,32+step/2):rock(a,x,41,6,3,1)
    rock(a,cx-6,35,6,6,0);rock(a,cx+7,35,6,6,1)
    rock(a,cx,cy,12 if stone else 11,11,1)
    if stone:
        a.poly([(cx-9,cy-8),(cx-4,cy-11),(cx+6,cy-10),(cx+10,cy-5),(cx+7,cy-1),(cx-2,cy+1),(cx-9,cy-2)],'m');a.line([(cx-7,cy-7),(cx+3,cy-8)],'h');a.line([(cx-3,cy-6),(cx-2,cy-1),(cx+2,cy+2),(cx,cy+7)],'d')
    else:
        a.poly([(cx-8,cy-6),(cx-3,cy-9),(cx+4,cy-7),(cx+7,cy-2),(cx+4,cy+5),(cx-3,cy+7),(cx-8,cy+1)],'m');a.jewel(cx,cy,'C');a.poly([(cx-10,cy+3),(cx-7,cy+1),(cx-4,cy+5),(cx-8,cy+8)],'G');a.line([(cx-8,cy+4),(cx-6,cy+5)],'a')
    lsh=(cx-12,cy-7);rsh=(cx+11,cy-8)
    lf=(max(6,cx-16-arm/4),min(37,cy+5-arm/3));rf=(min(41,cx+16+arm/4),cy+1-arm/2)
    if pose=='windup':lf=(9,cy-1);rf=(36,13)
    elif pose=='attack':lf=(18,35);rf=(41,36)
    rock(a,*lsh,7,7,0);rock(a,*rsh,7,8,1)
    a.limb([lsh,(lf[0]+2,lf[1]-6),lf],'s',6);a.limb([rsh,(rf[0]-2,rf[1]-6),rf],'s',6)
    rock(a,*lf,5,7,1);rock(a,*rf,5,7,0)
    for x,y in (lf,rf):a.line([(x-3,y+3),(x+2,y+2)],'d');a.line([(x-2,y-3),(x+1,y-3)],'h')
    hx=cx+4;hy=13+dy
    rock(a,hx,hy,8 if stone else 7,8,1)
    a.poly([(hx-6,hy-2),(hx-2,hy-4),(hx+6,hy-3),(hx+8,hy),(hx+3,hy+2),(hx-3,hy+1)],'s');a.line([(hx-4,hy-2),(hx+5,hy-2)],'o',2);a.pixel(hx-1,hy-1,'e');a.pixel(hx+4,hy-1,'E')
    a.poly([(hx+4,hy+1),(hx+9,hy+1),(hx+9,hy+4),(hx+5,hy+5)],'m');a.line([(hx+5,hy+2),(hx+8,hy+2)],'h');a.line([(hx-1,hy+5),(hx+6,hy+6)],'d')
    if not stone:a.poly([(hx-7,hy-5),(hx-4,hy-9),(hx+2,hy-8),(hx+5,hy-5),(hx,hy-5),(hx-3,hy-3)],'G');a.line([(hx-4,hy-7),(hx+1,hy-6)],'a')
    else:a.line([(hx-2,hy-6),(hx+1,hy-4),(hx-1,hy-2)],'d')
    if pose=='hit':a.line([(hx-2,hy),(hx+5,hy+1)],'s',2)
    return a.im

def clay_urn(pose,cell):
    pal=P.copy();pal.update(zip(('s','m','h','w'),COLORS['golem-clay']));a=Art(cell,pal);dx,dy,arm,step=rig(pose)
    if pose=='dead':
        for p in [[(6,43),(9,36),(15,35),(13,39),(15,44)],[(18,40),(24,34),(31,37),(30,42),(26,44),(20,43)],[(33,42),(39,36),(44,39),(43,44)]]:a.poly(p,'m');a.line([p[0],p[1],p[2]],'h')
        a.line([(20,40),(25,41),(28,38)],'d');a.line([(8,39),(11,38)],'w');return a.im
    cx=24+dx/2;cy=29+dy/2
    for x in (cx-6-step/2,cx+6+step/2):a.poly([(x-3,38),(x+2,38),(x+3,43),(x+1,44),(x-4,44),(x-4,42)],'m');a.line([(x-2,42),(x+1,42)],'h')
    # Clay handles grow from an immense urn belly; elbows and pot fists swing apart.
    lf=(max(6,cx-16-arm/4),min(37,cy+2-arm/3));rf=(min(41,cx+16+arm/4),cy-1-arm/2)
    if pose=='windup':rf=(35,15);lf=(9,cy-3)
    elif pose=='attack':rf=(41,29);lf=(15,34)
    for sign,f in [(-1,lf),(1,rf)]:
        pts=[(cx+sign*9,cy-8),(cx+sign*14,cy-9),(f[0],f[1]-5),f]
        a.line(pts,'o',6);a.line(pts,'m',4);a.line([(x-1,y-1) for x,y in pts],'h')
        a.poly([(f[0]-4,f[1]-5),(f[0]+4,f[1]-5),(f[0]+5,f[1]+3),(f[0]+2,f[1]+6),(f[0]-3,f[1]+5),(f[0]-5,f[1]+1)],'m');a.line([(f[0]-3,f[1]-3),(f[0]+3,f[1]-3)],'w');a.line([(f[0]-3,f[1]+2),(f[0]+3,f[1]+2)],'s')
    a.poly([(cx-8,cy-12),(cx+8,cy-12),(cx+9,cy-8),(cx+13,cy-1),(cx+12,cy+7),(cx+8,cy+11),(cx-8,cy+11),(cx-12,cy+7),(cx-13,cy-1),(cx-9,cy-8)],'s');a.poly([(cx-7,cy-9),(cx+4,cy-9),(cx+9,cy-3),(cx+9,cy+6),(cx+5,cy+9),(cx-7,cy+8),(cx-10,cy+2),(cx-9,cy-4)],'m',None)
    a.poly([(cx-7,cy-8),(cx-3,cy-9),(cx-1,cy-4),(cx-2,cy+6),(cx-6,cy+7),(cx-8,cy+2)],'h',None);a.line([(cx-6,cy-7),(cx-5,cy-2)],'w');a.line([(cx-10,cy+6),(cx+10,cy+6)],'h');a.line([(cx-8,cy+9),(cx+7,cy+9)],'d')
    a.line([(cx+4,cy-7),(cx+6,cy-3),(cx+3,cy),(cx+5,cy+3)],'d');a.poly([(cx-2,cy-3),(cx+1,cy-4),(cx+3,cy),(cx+1,cy+3),(cx-2,cy+1)],'B');a.line([(cx,cy-2),(cx+1,cy)],'y')
    hx=cx+1;hy=11+dy
    a.poly([(hx-6,hy-5),(hx+5,hy-5),(hx+7,hy-2),(hx+6,hy+6),(hx-5,hy+6),(hx-7,hy+1)],'m');a.poly([(hx-6,hy-5),(hx-4,hy-7),(hx+4,hy-7),(hx+6,hy-5),(hx+4,hy-3),(hx-4,hy-3)],'s');a.line([(hx-5,hy-5),(hx+4,hy-5)],'w');a.line([(hx-4,hy),(hx-1,hy+1)],'o',2);a.line([(hx+2,hy+1),(hx+5,hy)],'o',2);a.pixel(hx+4,hy+1,'e');a.line([(hx-1,hy+4),(hx+4,hy+4)],'d')
    if pose=='hit':a.line([(hx+3,hy-2),(hx+1,hy),(hx+3,hy+2)],'d')
    return a.im

def earth_spirit(pose,cell):
    pal=P.copy();pal.update(zip(('s','m','h','w'),COLORS['spirit-earth']));a=Art(cell,pal);dx,dy,arm,step=rig(pose)
    if pose=='dead':
        for j,(x,y,w,h) in enumerate([(10,41,6,3),(23,39,7,5),(37,40,7,4)]):rock(a,x,y,w,h,j)
        a.line([(8,42),(14,40),(22,42),(30,41)],'G',2);return a.im
    cx=24+dx/2;cy=27+dy/2
    # Unequal detached stones orbit a green seam. There are no feet or leg shafts.
    rock(a,cx-2,cy,11,8,1);rock(a,cx+4,cy-13,8,6,0)
    rock(a,8-step/2,cy+2-arm/4,5,7,1);rock(a,39+arm/4,cy-3-arm/3,5,5,0)
    rock(a,15+step/2,39-dy/2,4,3,0);rock(a,29-step/2,39+dy/2,6,3,1)
    a.poly([(cx-11,cy-7),(cx-6,cy-10),(cx-1,cy-9),(cx+4,cy-7),(cx+3,cy-5),(cx-4,cy-6),(cx-8,cy-4)],'G');a.line([(cx-7,cy-8),(cx-1,cy-7)],'a')
    a.line([(cx-2,cy-5),(cx-5,cy),(cx-3,cy+4),(cx-6,cy+8)],'G',2);a.line([(cx+3,cy-2),(cx+6,cy+1),(cx+3,cy+5)],'a')
    hx=cx+4;hy=cy-13
    a.line([(hx-4,hy-1),(hx+4,hy-2)],'o',2);a.pixel(hx-1,hy,'e');a.pixel(hx+3,hy-1,'E');a.line([(hx-1,hy+3),(hx+4,hy+3)],'d')
    a.poly([(hx-7,hy-3),(hx-6,hy-8),(hx-1,hy-9),(hx+4,hy-7),(hx+7,hy-4),(hx+2,hy-4),(hx-3,hy-5)],'G');a.line([(hx-4,hy-7),(hx+1,hy-6)],'a')
    for x,y,ex,ey in [(10,cy+1,cx-9,cy+4),(36,cy-2,cx+9,cy),(17,37,cx-5,cy+7)]:
        a.line([(x,y),((x+ex)/2+step/3,(y+ey)/2-2),(ex,ey)],'G',2);a.poly([(x,y),(x-3,y-3),(x+1,y-4),(x+3,y-1)],'a');a.pixel(x,y-2,'A')
    if pose=='attack':a.poly([(41,cy-9),(45,cy-8),(44,cy-3),(40,cy-4)],'m');a.line([(42,cy-7),(43,cy-7)],'h')
    return a.im

def draw(slug,pose,cell):
    if slug in ('golem','golem-stone'):return mineral(slug,pose,cell)
    if slug=='golem-clay':return clay_urn(pose,cell)
    if slug=='spirit-earth':return earth_spirit(pose,cell)
    im=_original_draw(slug,pose,cell)
    if slug=='golem-crystal' and pose!='dead':
        # A huge offset amethyst shoulder forms a clear asymmetrical silhouette.
        a=Art(cell);a.im=im;from PIL import ImageDraw;a.d=ImageDraw.Draw(im)
        dx,dy,arm,step=rig(pose);x=13+dx/2;y=19+dy
        a.poly([(x-5,y+4),(x-7,y-5),(x-5,max(2,y-15)),(x-1,y-8),(x+2,y-2),(x+3,y+7)],'V');a.poly([(x-5,max(3,y-13)),(x-3,y-5),(x-2,y+3),(x-5,y)],'L',None);a.line([(x-4,max(3,y-12)),(x-3,y-4)],'w')
    return im

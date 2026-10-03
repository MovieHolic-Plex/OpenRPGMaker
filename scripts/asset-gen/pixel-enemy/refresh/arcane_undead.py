"""Exposed skeleton joints, ragged flesh and separate weapons; native drawing."""
from arcane_core import Art,P,rig,shift
UNDEAD={'skeleton-archer','skeleton-knight','skeleton-01','skeleton-bone','zombie-rot','mummy-bandage','ghoul-01','ghoul-grave','revenant-vengeful','bonepile-crawler','armor-living','lich-frost'}
def bone(a,pts,width=2):
    a.line(pts,'o',width+2);a.line(pts,'t',width);a.line([(pts[0][0],pts[0][1]),(pts[1][0],pts[1][1])],'w')
    for x,y in (pts[0],pts[-1]):a.oval((x-1,y-1,x+1,y+1),'t','o');a.pixel(x,y,'w')
def sword(a,x,y,pose,flame=False):
    if pose=='attack':tip=(43,y-2);base=(x+1,y+1)
    elif pose=='windup':tip=(x-5,max(3,y-18));base=(x,y)
    elif pose=='hit':tip=(x-8,y-10);base=(x,y)
    else:tip=(x+4,max(3,y-16));base=(x,y)
    tx,ty=tip;bx,by=base
    a.line([(bx,by+3),(bx,by)],'b',2);a.line([(bx-3,by),(bx+3,by)],'y',2)
    a.poly([(bx-1,by-2),(tx-1,ty+2),(tx,ty),(tx+2,ty+2),(bx+2,by-2)],'m');a.line([(bx,by-2),(tx,ty+1)],'w')
    if flame:a.line([(bx+2,by-3),((bx+tx)/2+2,(by+ty)/2),(tx+2,ty+2)],'R')
def draw(slug,pose,cell):
    a=Art(cell);dx,dy,arm,step=rig(pose);dead=pose=='dead'
    if slug=='bonepile-crawler':return crawler(pose,cell)
    if slug=='skeleton-bone':return bone_spirit(pose,cell)
    sk=slug.startswith('skeleton');archer=slug=='skeleton-archer';knight=slug=='skeleton-knight';mummy=slug=='mummy-bandage';armor=slug=='armor-living';lich=slug=='lich-frost';revenant=slug=='revenant-vengeful';ghoul=slug.startswith('ghoul')
    if dead:
        if sk:
            for p in [[(8,41),(16,39),(23,41)],[(12,36),(18,37),(22,39)],[(22,42),(28,40),(32,42)]]:bone(a,p)
            a.skull(35,38,True);a.poly([(15,38),(20,35),(25,37),(23,40),(17,41)],'t');a.line([(18,37),(23,38)],'w')
            if archer:a.line([(7,33),(5,37),(7,40),(11,42)],'b',2);a.line([(7,33),(11,42)],'t')
            elif knight:a.poly([(5,40),(11,37),(17,38),(16,43),(8,44)],'s');a.line([(7,41),(14,39)],'h')
            else:a.line([(5,42),(19,42)],'b',2)
        else:
            fill='t' if mummy else 's' if armor else 'v' if lich else 'g'
            a.poly([(7,43),(8,38),(14,37),(19,38),(23,36),(29,37),(36,40),(41,42),(38,44),(27,43),(20,44),(14,41)],fill)
            a.poly([(13,39),(20,38),(27,38),(30,41),(21,42),(15,40)],'m' if armor else 'B' if mummy else 'G',None)
            a.skull(34,38,True) if lich else a.poly([(32,37),(37,36),(41,38),(43,41),(38,43),(33,41)],'h' if armor else 't' if mummy else 'a')
            a.line([(36,39),(40,40)],'o');a.line([(11,40),(15,42),(18,40)],'h' if armor else 'w' if mummy else 'a')
            if revenant:a.poly([(11,42),(19,39),(29,42),(27,44),(15,44)],'r');a.pixel(32,39,'e')
            if lich:a.line([(6,42),(25,43)],'t',2);a.jewel(7,41,'C')
            if mummy:a.line([(16,37),(13,39),(10,39)],'w');a.line([(33,38),(38,38)],'w')
        return a.im
    cx=22+dx;cy=24+dy; hx=cx+2;hy=13+dy+(1 if ghoul else 0)
    if slug=='ghoul-grave':hx+=5;hy+=6
    lean=2 if ghoul or slug=='zombie-rot' else 0
    # Individually placed knees and heels: no sprite translation.
    hip=(cx,32+dy);lfoot=(14-step,44);rfoot=(29+step,44)
    legs=[[(cx-4,31+dy),(16-step/2,37),(lfoot[0],42)],[(cx+3,31+dy),(29+step/2,37),(rfoot[0],42)]]
    for p in legs:
        if sk:bone(a,p,2)
        else:a.limb(p,'t' if mummy else 's' if armor or revenant else 'v' if lich else 'g',4)
    for x,y in (lfoot,rfoot):
        a.poly([(x-3,41),(x+2,41),(x+4,43),(x+4,44),(x-4,44),(x-4,43)],'t' if sk or mummy else 'd')
        a.line([(x-2,42),(x+2,42)],'w' if sk or mummy else 'h')
    rear=[(cx-5,cy-4),(cx-10,cy+1+arm/3),(cx-9-arm/3,cy+7)]
    front=[(cx+4,cy-4),(cx+9+arm/3,cy+1-arm/3),(min(40,cx+11+arm),cy-1-arm/2)]
    if pose=='windup':front=[(cx+4,cy-4),(cx+7,cy-10),(cx+3,cy-14)]
    if pose=='hit':front=[(cx+4,cy-4),(cx+4,cy+2),(cx-2,cy+3)]
    if sk:
        bone(a,rear);bone(a,front)
        # Rib cage: central sternum and four bent paired ribs.
        a.line([(cx,cy-8),(cx,cy+4)],'o',3);a.line([(cx,cy-8),(cx,cy+4)],'w')
        for k in range(4):
            y=cy-6+k*3;a.line([(cx-5,y-1),(cx-5,y+1),(cx,y+2),(cx+5,y),(cx+5,y-2)],'o',3);a.line([(cx-4,y),(cx,y+1),(cx+4,y-1)],'t');a.pixel(cx-3,y,'w')
        a.poly([(cx-5,cy+6),(cx,cy+5),(cx+5,cy+6),(cx+3,cy+9),(cx-3,cy+9)],'t');a.line([(cx-3,cy+7),(cx+2,cy+7)],'w')
        a.skull(hx,hy,False)
        if pose=='hit':a.line([(hx+2,hy-2),(hx+5,hy-1)],'o')
        if archer:
            fx,fy=front[-1];bx=min(41,fx+2);by=cy-2
            a.line([(bx-2,by-12),(bx+2,by-8),(bx+3,by),(bx+2,by+7),(bx-2,by+11)],'o',3);a.line([(bx-2,by-11),(bx+1,by-7),(bx+2,by),(bx+1,by+7),(bx-2,by+10)],'B',2);a.line([(bx-2,by-11),(bx-4 if pose=='windup' else bx-2,by),(bx-2,by+10)],'y')
            ax=min(45,bx+6) if pose=='attack' else bx+2;a.line([(bx-13,by),(ax,by)],'t');a.poly([(ax,by),(ax-3,by-2),(ax-3,by+2)],'h');a.line([(bx-13,by),(bx-15,by-2)],'w')
            a.poly([(cx-10,cy-13),(cx-8,cy-14),(cx-5,cy+3),(cx-7,cy+4)],'b');a.line([(cx-9,cy-13),(cx-12,cy-19)],'t');a.line([(cx-7,cy-13),(cx-9,cy-18)],'t')
            a.poly([(hx-5,hy-7),(hx-2,hy-10),(hx+3,hy-9),(hx+5,hy-6)],'r');a.line([(hx-3,hy-8),(hx+2,hy-8)],'R')
        elif knight:
            a.poly([(cx-10,cy-2),(cx-5,cy-3),(cx-2,cy+1),(cx-5,cy+10),(cx-9,cy+11),(cx-13,cy+5)],'s');a.poly([(cx-9,cy),(cx-6,cy-1),(cx-4,cy+2),(cx-7,cy+8),(cx-10,cy+4)],'m',None);a.line([(cx-8,cy+1),(cx-8,cy+6)],'y');a.line([(cx-10,cy+3),(cx-5,cy+3)],'y')
            a.poly([(hx-5,hy-7),(hx-2,hy-10),(hx+4,hy-9),(hx+6,hy-5),(hx+3,hy-4),(hx-5,hy-4)],'s');a.line([(hx-3,hy-8),(hx+3,hy-7)],'h');a.poly([(hx-1,hy-10),(hx-3,hy-9),(hx+2,hy-8),(hx+3,hy-10)],'R')
            sword(a,*front[-1],pose)
        else:
            a.poly([(cx-6,cy+5),(cx+5,cy+5),(cx+4,cy+9),(cx-1,cy+8),(cx-5,cy+10)],'r');a.line([(cx-4,cy+6),(cx+3,cy+6)],'R')
            if pose=='attack':a.line([(front[-1][0]-1,front[-1][1]),(45,front[-1][1]-1)],'t',3)
            else:a.line([(front[-1][0],front[-1][1]+2),(front[-1][0]+2,max(5,front[-1][1]-9))],'t',3)
    else:
        skin='t' if mummy else 's' if armor or revenant else 'v' if lich else 'G'
        a.limb(rear,skin,3);a.limb(front,skin,3)
        if lich:
            a.poly([(cx-5,cy-9),(cx+4,cy-10),(cx+7,cy+5),(cx+13,40),(cx+8,43),(cx+3,41),(cx-2,44),(cx-6,42),(cx-11,43),(cx-7,cy+4)],'v');a.poly([(cx-3,cy-6),(cx+2,cy-6),(cx+4,39),(cx,42),(cx-5,40)],'V',None);a.line([(cx-1,cy-5),(cx-2,39)],'l')
            a.skull(hx,hy);a.poly([(hx-6,hy-7),(hx-4,hy-8),(hx+3,hy-9),(hx+7,hy-8),(hx+6,hy-3),(hx+3,hy-6),(hx-3,hy-6),(hx-5,hy-1)],'s');a.line([(hx-3,hy-9),(hx+2,hy-8)],'u')
            a.line([(front[-1][0],front[-1][1]+5),(front[-1][0]+1,8)],'o',3);a.line([(front[-1][0],front[-1][1]+5),(front[-1][0]+1,8)],'t');a.jewel(front[-1][0]+1,7,'C');a.poly([(front[-1][0]-2,6),(front[-1][0]+1,2),(front[-1][0]+4,6)],'h');a.line([(front[-1][0]+1,3),(front[-1][0]+1,6)],'U')
        elif armor or revenant:
            if revenant:a.poly([(cx-7,cy-8),(cx-13,cy-5),(cx-17,36),(cx-13,41),(cx-11,39),(cx-8,43),(cx-3,36)],'r');a.line([(cx-12,cy-2),(cx-13,36)],'R')
            a.poly([(cx-6,cy-8),(cx+5,cy-8),(cx+7,cy),(cx+4,cy+7),(cx-4,cy+7),(cx-7,cy)],'s');a.poly([(cx-4,cy-6),(cx+1,cy-7),(cx+4,cy-2),(cx+1,cy+4),(cx-4,cy+3)],'m',None);a.line([(cx-4,cy-6),(cx+1,cy-6)],'h');a.line([(cx-6,cy+5),(cx+5,cy+5)],'B',2)
            a.poly([(hx-5,hy-7),(hx-2,hy-9),(hx+3,hy-8),(hx+6,hy-4),(hx+6,hy+3),(hx+3,hy+6),(hx-2,hy+5),(hx-5,hy+1)],'s');a.poly([(hx-3,hy-6),(hx+1,hy-7),(hx+3,hy-4),(hx-2,hy-3)],'h',None);a.line([(hx-1,hy-1),(hx+5,hy-2)],'o',2);a.pixel(hx+4,hy-2,'e');a.line([(hx+1,hy+1),(hx+1,hy+4)],'h');a.line([(hx+3,hy+1),(hx+3,hy+3)],'d')
            if revenant:a.poly([(hx-4,hy-7),(hx-6,hy-9),(hx-2,hy-9),(hx+1,hy-9),(hx+4,hy-10),(hx+4,hy-6)],'t');a.line([(cx-1,cy-2),(cx+3,cy+1)],'R')
            else:a.poly([(cx-10,cy-6),(cx-5,cy-8),(cx-3,cy-4),(cx-7,cy-2)],'h')
            sword(a,*front[-1],pose,revenant)
        else:
            a.poly([(cx-6,cy-9),(cx+4,cy-8),(cx+6,cy),(cx+4,cy+8),(cx-5,cy+8),(cx-8,cy)],'t' if mummy else 'g')
            a.poly([(cx-4,cy-7),(cx+1,cy-7),(cx+3,cy),(cx+1,cy+6),(cx-4,cy+5)],'y' if mummy else 'G',None)
            if mummy:
                for y in range(round(cy-6),round(cy+8),3):a.line([(cx-5,y),(cx+4,y+1)],'B');a.line([(cx-3,y-1),(cx+2,y)],'w')
                a.poly([(hx-5,hy-7),(hx+1,hy-8),(hx+5,hy-4),(hx+5,hy),(hx+7,hy+1),(hx+5,hy+5),(hx,hy+6),(hx-5,hy+2)],'t');a.line([(hx-4,hy-5),(hx+3,hy-5)],'w');a.line([(hx-4,hy-2),(hx+5,hy-3)],'B');a.line([(hx-2,hy),(hx+5,hy)],'o');a.pixel(hx+4,hy,'e');a.line([(hx-3,hy+2),(hx+5,hy+2)],'w');a.line([(hx-1,hy+4),(hx+3,hy+4)],'B')
                a.line([(rear[-1][0],rear[-1][1]),(rear[-1][0]-5,rear[-1][1]+3),(rear[-1][0]-7,rear[-1][1]+2)],'t',2)
            else:
                rag='v' if slug=='ghoul-01' else 'b' if slug=='ghoul-grave' else 'r'
                a.poly([(cx-6,cy-8),(cx-10,cy-5),(cx-7,cy+2),(cx-4,cy),(cx-3,cy+4),(cx+1,cy+2),(cx+4,cy+5),(cx+6,cy),(cx+4,cy-7)],rag);a.line([(cx-6,cy-6),(cx-4,cy-4)],'V' if ghoul else 'R')
                if slug=='ghoul-grave':
                    a.poly([(cx-7,cy-10),(cx-12,cy-7),(cx-14,cy-2),(cx-11,cy+4),(cx-10,cy+1),(cx-7,cy+6),(cx-5,cy+2),(cx-2,cy+5),(cx+1,cy+1),(cx+5,cy+3),(cx+8,cy-1),(cx+4,cy-6),(cx-1,cy-9)],'b')
                    a.poly([(cx-8,cy-7),(cx-4,cy-8),(cx+3,cy-4),(cx+5,cy),(cx+1,cy-1),(cx-4,cy-4),(cx-10,cy-1)],'B',None)
                    a.line([(cx-9,cy-5),(cx-6,cy-6),(cx-2,cy-4)],'t');a.line([(cx-10,cy),(cx-9,cy+3)],'d')
                elif slug=='ghoul-01':
                    a.poly([(cx-2,cy-5),(cx+3,cy-4),(cx+5,cy+1),(cx+2,cy+4),(cx-2,cy+2)],'r')
                    for ry in (-3,0,3):a.line([(cx-2,cy+ry),(cx+1,cy+ry+1),(cx+3,cy+ry)],'t');a.pixel(cx,cy+ry,'i')
                a.poly([(hx-6,hy-6),(hx,hy-8),(hx+4,hy-5),(hx+5,hy-1),(hx+8,hy),(hx+7,hy+3),(hx+4,hy+6),(hx-1,hy+5),(hx-5,hy+2)],'G');a.poly([(hx-4,hy-5),(hx,hy-6),(hx+2,hy-4),(hx+1,hy-1),(hx-3,hy)],'a',None);a.line([(hx+1,hy-2),(hx+5,hy-3)],'o',2);a.pixel(hx+4,hy-2,'e');a.poly([(hx+1,hy+1),(hx+7,hy+1),(hx+5,hy+4),(hx+1,hy+4)],'r');a.line([(hx+2,hy+2),(hx+6,hy+2)],'t');a.pixel(hx+1,hy+3,'i')
                if slug=='zombie-rot':a.poly([(hx-6,hy-5),(hx-4,hy-9),(hx+1,hy-8),(hx+3,hy-5),(hx-1,hy-5),(hx-3,hy-3)],'d');a.line([(cx-1,cy+1),(cx+3,cy+3)],'r');a.pixel(cx+1,cy+2,'p')
                elif slug=='ghoul-grave':a.poly([(hx-5,hy-5),(hx-8,hy-8),(hx-7,hy),(hx-4,hy+1)],'G');a.line([(hx-5,hy-5),(hx-6,hy-2)],'a')
                else:a.poly([(hx-4,hy-5),(hx-7,hy-7),(hx-6,hy+1),(hx-4,hy+2)],'G');a.line([(cx-6,cy-9),(cx-8,cy-12),(cx-3,cy-10)],'t',2)
                if slug=='ghoul-01':
                    a.poly([(hx-1,hy+4),(hx+7,hy+3),(hx+9,hy+6),(hx+6,hy+9),(hx+1,hy+8)],'g');a.line([(hx+1,hy+6),(hx+6,hy+7)],'a')
                    a.poly([(hx+1,hy+6),(hx+1,hy+1),(hx+3,hy+3),(hx+3,hy+7)],'i');a.poly([(hx+6,hy+6),(hx+7,hy+1),(hx+9,hy+3),(hx+8,hy+7)],'t');a.pixel(hx+7,hy+3,'i')
                for ex,ey in (rear[-1],front[-1]):
                    a.line([(ex,ey),(ex+3,ey+1),(ex+4,ey+3)],'a');a.line([(ex,ey+1),(ex+2,ey+4)],'t')
                    if slug=='ghoul-grave':
                        a.poly([(ex-2,ey-2),(ex+2,ey-2),(min(44,ex+5),ey),(min(44,ex+6),ey+3),(min(44,ex+3),ey+1),(min(44,ex+4),ey+5),(ex+1,ey+3),(ex,ey+6),(ex-2,ey+3)],'G')
                        a.line([(ex-1,ey),(ex+2,ey)],'a');a.line([(ex+1,ey+2),(min(44,ex+3),ey+4)],'t')
    return a.im

def bone_spirit(pose,cell):
    a=Art(cell);dx,dy,arm,step=rig(pose)
    if pose=='dead':
        for x,y in ((13,39),(22,40),(31,39)):bone(a,[(x-4,y-2),(x,y),(x+5,42)],2)
        a.skull(34,38,True);return a.im
    cx=25+dx;cy=15+dy
    for i in range(5):
        x=18-i*2+dx+(step if i%2 else -step)/3;y=24+i*3+dy
        a.poly([(x-3,y-2),(x+3,y-1),(x+4,y+2),(x-2,y+3),(x-4,y+1)],'t');a.line([(x-2,y),(x+2,y)],'w');a.pixel(x,y+1,'b')
    a.skull(cx,cy,False,1.45)
    a.line([(cx-5,cy-6),(cx-8,cy-11),(cx-4,cy-8)],'t',2);a.line([(cx+2,cy-9),(cx+5,cy-12),(cx+5,cy-7)],'t',2)
    a.line([(cx+3,cy-3),(cx+6,cy-3)],'e',2)
    if pose=='attack':a.poly([(35,22),(44,21),(40,24),(45,25),(38,27)],'V');a.line([(37,23),(41,23)],'L')
    return a.im

def crawler(pose,cell):
    a=Art(cell);dx,dy,arm,step=rig(pose)
    if pose=='dead':
        for x,y in [(12,40),(22,38),(32,40)]:bone(a,[(x-5,y-3),(x,y),(x+5,42)],2)
        a.skull(35,38,True,1.1);a.skull(14,36,True,.75);a.poly([(19,42),(23,41),(26,43),(24,44),(20,44)],'t');a.line([(21,42),(24,43)],'w');return a.im
    a.poly([(8,28+dy),(13,21+dy),(20+dx,18+dy),(29+dx,22+dy),(35+dx,28+dy),(29,35),(18,36),(11,33)],'b')
    for i in range(5):
        x=12+i*4+dx;y=25+dy+(i-2)**2/2
        a.line([(x,y-4),(x-3,y),(x-1,y+6),(x+2,y+8)],'o',4);a.line([(x,y-4),(x-3,y),(x-1,y+6),(x+2,y+8)],'t',2);a.pixel(x-1,y,'w')
    for i,(sx,ex) in enumerate([(13,6),(19,14),(27,35),(32,43)]):
        bone(a,[(sx+dx,28+dy),(min(44,max(4,ex+(step if i%2 else -step))),35),(ex,43)],2)
        a.line([(ex-2,42),(ex+2,43)],'w',2)
    a.skull(35+dx/2,24+dy,False,1.25);a.skull(18+dx,20+dy,False,.7)
    a.line([(9,28+dy),(5,24+dy),(4,19+dy)],'t',2);a.pixel(4,19+dy,'w')
    if pose=='attack':a.poly([(38,27),(44,26),(44,30),(41,32),(38,31)],'r');a.line([(39,28),(43,28)],'w')
    return a.im

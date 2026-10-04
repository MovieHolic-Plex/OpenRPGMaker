"""Rock joints, orbital runestones, lit pumpkin and three cursed constructs."""
from common import *
def golem(slug,n):
    pals={'golem-stone':dict(s='555145',b='827d66',l='b9b395',h='e2d9b2',g='507449',e='f5cf64'),
'golem-clay':dict(s='4a493e',b='756f5c',l='aaa88a',h='ded9ad',g='618453',e='c4ef81'),
'golem-crystal':dict(s='344665',b='577ba4',l='94b8d0',h='dcf0f1',g='77538b',e='de9bef')}
    p=pen(64,pals[slug]);clay=slug=='golem-clay';crystal=slug=='golem-crystal'
    if n=='dead':
        for x,y,w,h in [(10,54,14,7),(23,51,17,10),(40,54,14,7),(28,46,12,9)]:p.stone(x,y,w,h)
        p.poly([(16,54),(21,54),(22,57),(18,58)],'g');return finish(p,n)
    dx,dy,re,sw=POSE[n];x=30+dx;y=31+dy
    # Weight shifts through two stone shin/ankle assemblies.
    for x0,x1 in [(23,20-(3 if n=='move' else 0)),(39,38+(4 if n=='move' else 0))]:
        p.stone(x0-5,44+dy,11,8);p.stone(x1-5,51,13,10)
        p.line([(x1-3,53),(x1+3,53)],'h')
    p.stone(x-12,y-1,26,19)
    p.poly([(x-9,y+1),(x+2,y+1),(x+9,y+5),(x-2,y+9),(x-9,y+7)],'l')
    p.line([(x+1,y+1),(x-2,y+6),(x+1,y+10),(x-2,y+16)],'s')
    # The head reads right; nose block and asymmetrical brow.
    hx=x-1;hy=y-14
    p.stone(hx-6,hy,16,15)
    p.poly([(hx+7,hy+6),(hx+11,hy+7),(hx+11,hy+10),(hx+7,hy+11)],'b','o')
    p.line([(hx-3,hy+2),(hx+4,hy+2)],'h')
    p.line([(hx+1,hy+5),(hx+8,hy+5)],'o',2);eye(p,hx+1,hy+6,'e',3);eye(p,hx+6,hy+7,'e',2)
    p.line([(hx+2,hy+12),(hx+9,hy+12)],'s')
    if clay:
        # Low block crown, lichen seam apron, rock nodes at shoulders.
        p.stone(hx-9,hy+2,7,8);p.poly([(x-7,y+3),(x-4,y+2),(x-1,y+5),(x-3,y+9),(x-7,y+10)],'g')
        p.line([(x-6,y+3),(x-3,y+4)],'h')
    if crystal:
        p.poly([(hx-3,hy+8),(hx+1,hy+10),(hx-1,hy+13),(hx-4,hy+12)],'g')
        p.poly([(x+4,y+9),(x+8,y+8),(x+11,y+12),(x+8,y+15),(x+5,y+13)],'g')
    # Massive elbow and fist rocks: overhead windup, hammer sweep, folded impact.
    if n=='windup':arms=[(12,20,11,13),(43,15,12,14)]
    elif n=='attack':arms=[(24,40,12,18),(46,40,13,20)]
    elif n=='hit':arms=[(8,34,12,16),(39,37,12,17)]
    elif n=='move':arms=[(12,30,11,16),(45,33,12,18)]
    else:arms=[(11+dx,y+1+sw,12,18),(43+dx,y+1-sw,12,18)]
    for index,(ax,ay,w,h) in enumerate(arms):
        shoulder=(x-10,y+3) if index==0 else (x+11,y+3)
        cap(p,[shoulder,(ax+w//2,ay+5)],5,'b',lit='l',dark='s')
        p.stone(ax,ay,w,h)
        p.line([(ax+2,ay+h-6),(ax+w-3,ay+h-6)],'o')
        p.line([(ax+5,ay+h-4),(ax+5,ay+h-2)],'s')
        if clay:p.stone(ax+1,ay-2,8,6)
    ax,ay,_,_=arms[0]
    p.poly([(ax+2,ay+2),(ax+7,ay+2),(ax+8,ay+5),(ax+4,ay+7),(ax+2,ay+5)],'g')
    if not crystal:
        p.poly([(x+6,y+15),(x+11,y+15),(x+12,y+18),(x+6,y+18)],'g')
    return finish(p,n)
def rune(n):
    p=pen(64,dict(s='33354a',b='575770',l='8e859e',h='d8cccb',e='7bf5dd',z='ef94d1',a='614d88',u='929cdf',v='b2e4e3'))
    if n=='dead':
        for x,y,w,h in [(12,55,11,6),(24,53,13,8),(39,56,11,5)]:p.stone(x,y,w,h)
        p.line([(27,57),(33,57)],'e');return finish(p,n,True)
    phase=NAMES.index(n);sw=POSE[n][3]
    # Pink/cyan vortex bounded by hand-grid stepped arcs.
    p.poly([(27,24),(36,24),(41,29),(40,38),(34,43),(25,40),(22,34),(24,28)],'a','o')
    p.line([(24,31),(27,26),(34,26),(38,30),(38,36),(33,39),(28,37),(28,32),(32,30),(35,33)],'e',2)
    p.line([(25,36),(28,40),(35,41),(41,36),(42,30),(37,24),(30,22)],'z',2)
    # Five independently orbiting faceted stones; runes follow the planar faces.
    rocks=[(15-sw,17+phase%3,12,14),(35+sw,12-phase%2,15,13),(44-sw,35,13,15),(18+sw,43-phase%3,14,12),(10+phase%3,34-sw,11,10)]
    for i,(x,y,w,h) in enumerate(rocks):
        p.poly([(x+3,y),(x+w-2,y+2),(x+w,y+h-4),(x+w-4,y+h),(x,y+h-2),(x-1,y+4)],'b','o')
        p.poly([(x+3,y+1),(x+w-3,y+3),(x+w-6,y+6),(x+1,y+4)],'l')
        p.line([(x+w-3,y+5),(x+w-3,y+h-4),(x+3,y+h-2)],'s')
        col='e' if i%2 else 'z'
        p.line([(x+3,y+5),(x+6,y+4),(x+7,y+8),(x+3,y+9)],col)
        p.line([(x+5,y+6),(x+5,y+10)],col)
    return finish(p,n,True)
def pumpkin(n):
    p=pen(48,dict(s='904324',b='d77b32',l='edae54',h='ffe5a1',e='ffd258',a='4c5f36',u='798141',r='753d2d'))
    if n=='dead':
        p.poly([(8,44),(12,39),(21,41),(28,38),(39,43),(38,44)],'b','o');p.line([(15,42),(21,43),(26,41)],'l');p.box((27,40,28,43),'h');return finish(p,n)
    dx,dy,re,sw=POSE[n];x=25+dx;y=32+dy
    # Round fruit ribs, broad rear lobe and compressed forward lobe.
    blob(p,x-6,y,10 if n in ('idle_c','recover') else 9,11-dy);blob(p,x+2,y,10 if n=='idle_c' else 11,12-dy)
    p.line([(x-5,y-10),(x-8,y-5),(x-8,y+5),(x-4,y+9)],'s')
    p.line([(x+2,y-10),(x,y-5),(x,y+5),(x+3,y+10)],'l')
    p.poly([(x-3,y-11),(x-4,y-16),(x-1,y-18),(x+2,y-17),(x+1,y-12),(x+4,y-11)],'a','o')
    p.line([(x-2,y-16),(x,y-16)],'u')
    # Carved right-facing wedge eyes and hostile jagged grin.
    p.poly([(x-4,y-5),(x+2,y-3),(x-3,y-1)],'k','o');p.poly([(x+5,y-4),(x+10,y-7),(x+9,y-1)],'k','o')
    p.line([(x-2,y-3),(x,y-3)],'e');p.line([(x+7,y-4),(x+8,y-5)],'e')
    if n=='hit':
        p.line([(x-4,y-4),(x+1,y-1)],'b',2)
        p.line([(x+6,y-4),(x+10,y-5)],'b',2)
    p.poly([(x+3,y-1),(x+5,y+2),(x+1,y+2)],'k')
    p.poly([(x-5,y+3),(x-2,y+5),(x,y+3),(x+3,y+5),(x+6,y+3),(x+10,y+2),(x+8,y+7),(x+2,y+9),(x-3,y+7)],'k','o')
    p.line([(x-3,y+5),(x+1,y+7),(x+6,y+6)],'e')
    # Candle visible through mouth: wax stump and two-tone flame.
    p.box((x+2,y+5,x+3,y+7),'h');p.line([(x+2,y+4),(x+2,y+3)],'e')
    if n=='attack':p.line([(40,26),(43,23),(44,27)],'e',2)
    return finish(p,n)
def blade(n):
    p=pen(48,dict(s='596276',b='9ba8b8',l='d4dae0',h='fff4cb',e='f4d47c',f='bb9652',a='594a63'))
    if n=='dead':
        p.poly([(10,41),(38,38),(42,40),(13,44)],'b','o');p.line([(13,41),(39,39)],'l');p.line([(15,37),(17,44)],'f',2);return finish(p,n,True)
    # Native vertex generation at each angle: no raster rotation.
    angles={'idle_a':-25,'idle_b':-20,'idle_c':-30,'windup':-70,'move':-15,'attack':5,'recover':30,'hit':-45}
    ang=math.radians(angles[n]);ux,uy=math.cos(ang),math.sin(ang);nx,ny=-uy,ux
    def q(d,w=0):return (round(24+ux*d+nx*w),round(24+uy*d+ny*w))
    p.poly([q(-4,-3),q(13,-2),q(19),q(13,2),q(-4,3)],'b','o')
    p.poly([q(-3,-2),q(13,-1),q(17),q(-3)],'l')
    p.line([q(-7,-7),q(-5,-5),q(-5,5),q(-7,7)],'o',3);p.line([q(-7,-6),q(-5,-4),q(-5,4),q(-7,6)],'f',2)
    for v in (-5,5):
        x,y=q(-6,v);p.box((x-1,y-1,x+1,y+1),'e');p.box((x,y,x,y),'h')
    p.line([q(-6),q(-15)],'a',3);p.line([q(-7,-1),q(-13,-1)],'v');x,y=q(-17);diamond(p,x,y,2,2,'f')
    for d in (0,5,10):
        p.line([q(d,-1),q(d+2,-1),q(d+1,1)],'e');p.line([q(d+1,0),q(d+2,1)],'e')
    return finish(p,n,True)
def scarecrow(n):
    p=pen(64,dict(s='644838',b='94704d',l='c89b67',h='ecd3a0',a='513a31',u='86614a',v='bba077',e='323033',r='956344',f='be9563'))
    if n=='dead':
        p.poly([(11,60),(18,56),(32,58),(39,54),(50,60)],'u','o');p.line([(16,57),(43,52)],'b',2);p.line([(41,50),(51,55),(53,59)],'s',2);return finish(p,n)
    dx,dy,re,sw=POSE[n];x=30+dx;y=29+dy
    # Wooden stake always carries weight; straw ragged sleeves are separately bent.
    p.poly([(28,42),(32,42),(33,60),(28,60)],'b','o');p.line([(29,44),(29,58)],'l')
    p.poly([(x-9,y-1),(x+7,y-1),(x+10,y+12),(x+5,y+17),(x+1,y+14),(x-3,y+18),(x-9,y+13)],'u','o')
    p.poly([(x-6,y+2),(x-1,y+2),(x-1,y+7),(x-6,y+7)],'l','o');p.line([(x-5,y+3),(x-2,y+6)],'a')
    for y0 in (y+5,y+10):p.line([(x+1,y0),(x+5,y0+1)],'a')
    for i in range(4):p.line([(x-7+i*4,y+13),(x-8+i*4,y+19-i%2)],'h')
    arm=[(x-7,y+1),(x-16,y+2+sw),(x-19,y-2+sw)]
    cap(p,arm,4,'u',lit='l',dark='s')
    for i in range(3):p.line([arm[-1],(arm[-1][0]-3,arm[-1][1]-2+i*2)],'h')
    cap(p,[(x+6,y+1),(x+13,y+5+re//2),(x+18,y+1+re//2)],4,'u',lit='l',dark='s')
    # Straw head, stitched grin, black button eye, wide pointed patched hat.
    p.poly([(x-4,y-11),(x+5,y-12),(x+9,y-8),(x+8,y-1),(x+2,y+2),(x-4,y-2)],'b','o')
    p.box((x+2,y-7,x+4,y-5),'a');p.box((x+3,y-6,x+3,y-6),'h')
    p.line([(x+1,y-2),(x+6,y-3)],'a')
    for i in range(3):p.line([(x+2+i*2,y-4),(x+2+i*2,y-1)],'a')
    p.poly([(x-9,y-10),(x-3,y-12),(x-2,y-23),(x+2,y-21),(x+6,y-14),(x+13,y-10),(x+4,y-9)],'a','o')
    p.line([(x-2,y-20),(x+3,y-15)],'u');p.grid(x+1,y-14,['vl','lv'])
    # Rusted hooked scythe: long shaft and crescent blade.
    sx=x+17;sy=y+3+re//2
    p.line([(sx,sy+16),(sx+1,sy-17)],'o',3);p.line([(sx,sy+15),(sx+1,sy-16)],'b')
    p.poly([(sx+1,sy-17),(sx+7,sy-15),(sx+9,sy-9),(sx+8,sy-5),(sx+6,sy-10),(sx+3,sy-13),(sx+1,sy-13)],'r','o')
    p.line([(sx+4,sy-14),(sx+7,sy-11)],'f')
    return finish(p,n)
def puppet(n):
    p=pen(64,dict(s='66503e',b='a17b59',l='d2ae7b',h='f1e5cd',a='513c63',u='91627e',v='bd95a1',r='755143',e='c34766',w='eee1cc'))
    if n=='dead':
        p.line([(8,15),(15,58),(28,55),(38,60)],'s');p.poly([(17,59),(21,53),(36,54),(39,60)],'u','o');p.stone(37,52,10,9,base='w',light='h');return finish(p,n,True)
    dx,dy,re,sw=POSE[n];x=29+dx;y=30+dy
    # Four independently posed string attachments, actual wooden hinged limbs.
    joints=[[(x-5,y+2),(x-13,y+4+sw),(x-18,y-3-re//2)],[(x+5,y+2),(x+12,y+7),(x+19,y+3+re//2)],
    [(x-3,y+12),(x-8+sw,y+18),(x-11+sw,y+24)],[(x+3,y+12),(x+9-sw,y+17),(x+11-sw,y+22)]]
    if n=='attack':joints[1]=[(x+5,y+2),(x+13,y),(x+21,y+1)]
    if n=='windup':joints[0]=[(x-5,y+2),(x-14,y-3),(x-12,y-11)]
    for i,pts in enumerate(joints):
        ex,ey=pts[-1];p.line([(10+i*13,4),(ex,ey)],'s')
        cap(p,pts,3,'b',lit='l',dark='s');p.box((pts[1][0]-1,pts[1][1]-1,pts[1][0]+1,pts[1][1]+1),'a')
        p.poly([(ex-2,ey),(ex+3,ey),(ex+4,ey+3),(ex-2,ey+3)],'a','o')
    p.poly([(x-6,y),(x+6,y),(x+6,y+10),(x+3,y+13),(x,y+10),(x-4,y+13),(x-6,y+10)],'u','o')
    p.poly([(x-5,y+1),(x,y+1),(x-1,y+7),(x-5,y+6)],'v')
    p.line([(x,y+2),(x,y+9)],'h');p.box((x+2,y+4,x+3,y+5),'f')
    # Split porcelain mask, open shocked mouth, jester cap with worn triangular points.
    p.poly([(x-3,y-12),(x+5,y-12),(x+9,y-8),(x+8,y-1),(x+2,y+2),(x-4,y-3)],'w','o')
    p.line([(x+2,y-11),(x+1,y-7),(x+3,y-4),(x+2,y)],'s')
    eye(p,x+3,y-8,'k',2);mouth(p,x+2,y-4,5,4)
    p.poly([(x-5,y-10),(x-8,y-16),(x-3,y-14),(x+1,y-20),(x+4,y-13),(x+10,y-15),(x+9,y-10)],'a','o')
    p.line([(x-3,y-12),(x+1,y-16),(x+3,y-12)],'v')
    # Dagger in anatomical left hand (rear arm).
    ex,ey=joints[0][-1];p.line([(ex-1,ey-1),(ex-2,ey-10)],'o',3);p.line([(ex-1,ey-2),(ex-2,ey-9)],'h');p.line([(ex-4,ey-2),(ex+2,ey-2)],'f',2)
    return finish(p,n,True)
def totem(n):
    p=pen(64,dict(s='533c32',b='81593e',l='b58a5c',h='d9b879',a='392f31',u='78534d',v='bb7161',e='f78462',g='627d48'))
    if n=='dead':
        p.poly([(10,60),(12,52),(29,53),(32,57),(49,54),(54,60)],'b','o');p.line([(16,54),(25,55),(22,59)],'s');p.line([(31,58),(42,57),(48,59)],'g',2);return finish(p,n)
    dx,dy,re,sw=POSE[n]
    # Three carved faces, individually rocking tiers with zigzag vine joints.
    tiers=[(22,44,20,16),(22+dx//2,27+dy,20,18),(22+dx,10+dy,20,19)]
    for i,(x,y,w,h) in enumerate(tiers):
        p.poly([(x+2,y),(x+w-3,y),(x+w,y+3),(x+w-1,y+h-1),(x+1,y+h-1),(x,y+4)],'b','o')
        p.poly([(x+2,y+2),(x+6,y+2),(x+6,y+h-3),(x+2,y+h-3)],'l')
        p.line([(x+w-3,y+3),(x+w-3,y+h-3)],'s')
        # Carved brows, glowing rightward eyes, broad sinister mouth.
        p.poly([(x+7,y+3),(x+13,y+5),(x+8,y+7)],'a','o');p.poly([(x+14,y+5),(x+18,y+3),(x+18,y+7)],'a','o')
        p.line([(x+9,y+5),(x+11,y+6)],'e');p.line([(x+15,y+5),(x+17,y+4)],'e')
        p.poly([(x+12,y+7),(x+15,y+7),(x+16,y+10),(x+11,y+10)],'s','o')
        mouth(p,x+8,y+11,10,4 if n=='attack' else 2)
        if i==1:p.line([(x+4,y+6),(x+3,y+10),(x+5,y+13)],'s')
    p.line([(23,59),(20,50),(24+sw,39),(19,31),(23+dx,23),(20,14)],'g',2)
    for x,y in [(21,52),(24+sw,40),(20,30),(22+dx,21)]:p.poly([(x,y),(x-5,y-2),(x-3,y+3)],'g','o')
    return finish(p,n)

def earth(n):
    """Original hovering earth spirit: unconnected rock joints bridged by roots."""
    p=pen(64,dict(s='634a35',b='967147',l='c8a16a',h='ebd0a0',g='4d7950',u='739452',e='f2a25b',r='8d5235'))
    if n=='dead':
        for x,y,w,h in [(10,55,11,6),(22,53,13,8),(38,54,16,7)]:p.stone(x,y,w,h)
        p.line([(16,58),(25,56),(35,60),(44,58)],'g',2);return finish(p,n,True)
    dx,dy,re,sw=POSE[n];x=31+dx;y=31+dy
    # Roots retain visible air gaps between distinct angular body rocks.
    joints=[(x-14,y+5+sw),(x+13,y+6-sw),(x-7,y+12),(x+8,y+13)]
    if n=='windup':joints[:2]=[(x-16,y-5),(x+15,y-10)]
    if n=='attack':joints[:2]=[(x+1,y+9),(x+21,y+10)]
    if n=='hit':joints[:2]=[(x-18,y+4),(x+13,y+14)]
    if n=='recover':joints[:2]=[(x-15,y+9),(x+14,y+3)]
    for i,(jx,jy) in enumerate(joints):
        root=(x-6,y+3) if i==0 else (x+6,y+3) if i==1 else (x-4,y+12) if i==2 else (x+4,y+12)
        p.line([root,(jx-2,jy-2),(jx,jy+5)],'s',3);p.line([root,(jx-2,jy-2),(jx,jy+5)],'g')
        p.stone(jx-5,jy,10 if i>1 else 12,9 if i>1 else 12)
        p.poly([(jx-3,jy+1),(jx+1,jy+1),(jx+3,jy+4),(jx-2,jy+5)],'g')
        p.line([(jx-2,jy+1),(jx,jy+2)],'u')
        if i>1:p.line([(jx-3,jy+9),(jx-6,jy+10),(jx-3,jy+9),(jx,jy+11)],'g')
    p.poly([(x-8,y-1),(x-3,y-5),(x+7,y-3),(x+10,y+4),(x+5,y+12),(x-3,y+13),(x-10,y+7)],'b','o')
    p.poly([(x-7,y),(x-2,y-3),(x+4,y-2),(x+2,y+4),(x-6,y+5)],'l')
    p.line([(x+2,y+2),(x,y+6),(x+3,y+8),(x+1,y+12)],'s')
    p.poly([(x-2,y+5),(x+4,y+4),(x+5,y+8),(x,y+10),(x-4,y+8)],'g')
    # Floating head has its own lower root gap, chipped protruding brow.
    p.line([(x,y-5),(x+1,y-9)],'g',2)
    p.poly([(x-5,y-22),(x+4,y-24),(x+10,y-19),(x+9,y-12),(x+4,y-9),(x-5,y-12),(x-8,y-18)],'b','o')
    p.poly([(x-5,y-21),(x+2,y-22),(x+5,y-20),(x-2,y-18)],'l')
    p.poly([(x-6,y-23),(x-1,y-25),(x+3,y-23),(x+2,y-20),(x-5,y-19)],'g','o')
    eye(p,x+2,y-17,'e',3);eye(p,x+7,y-16,'e',2)
    p.line([(x+2,y-12),(x+7,y-12)],'s')
    p.line([(x-5,y-12),(x-7,y-8),(x-4,y-10)],'g')
    return finish(p,n,True)

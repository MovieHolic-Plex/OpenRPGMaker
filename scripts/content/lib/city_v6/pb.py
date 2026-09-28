import sys, math; sys.path.insert(0,__import__('os').path.dirname(__import__('os').path.abspath(__file__)))
from px2 import C, vnoise, _hash
from pa import mossify, vine
P={}; WATER=set()

def rafflesia():
    c=C(32,32,seed=41); c.shadow(16,25,14,4)
    # five fleshy petals around a central well, seen from above at 3/4
    for k,ang in enumerate((-90,-18,54,126,198)):
        a=math.radians(ang); px_=16+math.cos(a)*7.5; py_=16+math.sin(a)*5.8
        c.group(10+k); c.ellipsoid(px_,py_,6.2,5.0,'red',amb=0.3,bump=0.35,bsc=3)
        # cream warts on petals
        for j in range(9):
            wx=int(px_+(_hash(k,j,1)-0.5)*8); wy=int(py_+(_hash(k,j,2)-0.5)*6)
            if c.m[wy][wx]=='red' and c.id[wy][wx]==c.nid: c.tone(wx,wy,'cream',5); c.tone(wx+1,wy+1,'red',2) if c.m[wy+1][wx+1]=='red' else None
    c.group(20)
    # central rim (raised collar) and dark well
    c.ellipsoid(16,15,6,4.4,'red',amb=0.35,bias=0.1)
    c.new()
    for y in range(10,20):
        for x in range(10,23):
            dx=(x+0.5-16)/4.2; dy=(y+0.5-15.3)/3.0
            if dx*dx+dy*dy<=1: c.tone(x,y,'red',0 if dy<0.2 else 1)
    for (x,y) in ((14,15),(16,14),(18,16),(15,17),(17,17)): c.tone(x,y,'cream',3)
    return c
P['라플레시아 (거대 꽃)']=rafflesia

def biglog():
    c=C(64,32,seed=42); c.shadow(32,27,31,3.5)
    c.group(1); c.hcyl(6,60,17,8.5,'bark',endcap='L',capmat='wood')
    # bark ridges: long dark grooves following the length
    for y0 in (11,14,18,21):
        for x in range(8,61):
            y=y0+int(round(math.sin(x/5.0+y0)*0.6))
            if c.m[y][x]=='bark': c.darken(x,y,1)
    # broken right end: jagged splinters
    for y in range(9,26):
        cut=58+int(_hash(y,0,3)*4)
        for x in range(cut,62):
            if c.m[y][x]=='bark': c.m[y][x]=None
    for y in range(10,25,2): c.tone(58+int(_hash(y,0,3)*4)-1,y,'wood',4)
    # moss on the top, ferns sprouting
    mossify(c,6,8,60,14,'bark',thr=0.35,sc=3,topbias=0.5)
    c.group(2)
    for (fx,fy) in ((22,9),(40,8)):
        for (dx,dy) in ((-3,-2),(-2,-3),(-1,-4),(0,-4),(1,-3),(2,-2),(3,-1),(-4,-1)):
            c.tone(fx+dx,fy+dy,'leaf',4 if dy<-2 else 3)
        c.tone(fx,fy-1,'leaf',2); c.tone(fx,fy,'leaf',2)
    # small mushrooms on the side
    for (mx,my) in ((47,23),(50,24)):
        c.tone(mx,my,'cream',5); c.tone(mx+1,my,'cream',4); c.tone(mx,my+1,'stem',4)
    return c
P['쓰러진 거목']=biglog

def mush():
    c=C(16,16,seed=43); c.shadow(8,14,7,1.6)
    specs=[(5,8,3.4,2.2,13),(11,5.5,3.6,2.4,12),(12.5,11,2.2,1.5,14)]
    for i,(x,y,rx,ry,base) in enumerate(sorted(specs,key=lambda s:s[1])):
        c.group(i+1)
        c.new()
        for yy in range(int(y),base+1):                 # stalk
            for xx in range(int(x-1),int(x+1)+1): c.setv(xx,yy,'stem',0.8 if xx<x-0.5 else 0.6 if xx<x+0.5 else 0.4)
        c.ellipsoid(x,y,rx,ry,'shroom',amb=0.3,bias=-0.05)
        for xx in range(int(x-rx)+1,int(x+rx)): c.tone(xx,int(y+ry*0.6),'shroom',2) if c.m[int(y+ry*0.6)][xx]=='shroom' else None
        for (dx,dy) in ((-1,-1),(1,0)): c.tone(int(x+dx*rx*0.45),int(y+dy*ry*0.4),'shroom',6)  # glow spots
    return c
P['빛나는 버섯']=mush

def thorns():
    c=C(16,16,seed=44); c.shadow(8,14,7.5,1.8)
    arcs=[(8,15,6,11,-2.6,-0.4),(8,15,5,9,-3.0,-1.2),(6,15,4,7,-2.2,-0.2),(10,15,4,8,-3.0,-0.9),(8,15,7,5,-2.8,-0.3)]
    for k,(cx,cy,rx,ry,a0,a1) in enumerate(arcs):
        c.group(k+1); c.new(); n=26
        for j in range(n):
            a=a0+(a1-a0)*j/(n-1); x=int(round(cx+math.cos(a)*rx)); y=int(round(cy+math.sin(a)*ry))
            if not c.inb(x,y): continue
            c.setv(x,y,'bark',0.72 if math.cos(a)<0 else 0.45)
            if j%4==2:
                tx=int(round(cx+math.cos(a)*(rx+1.3))); ty=int(round(cy+math.sin(a)*(ry+1.3)))
                if c.inb(tx,ty) and c.m[ty][tx] is None: c.tone(tx,ty,'bone',5)
            if j%7==4 and c.inb(x+1,y): c.tone(x+1,y,'leaf',4); c.tone(x+1,y+1,'leaf',2) if c.inb(x+1,y+1) else None
    c.tone(9,3,'red',5); c.tone(10,3,'red',3)
    return c
P['가시 덩굴']=thorns

def pitcher():
    c=C(16,32,seed=45); c.shadow(8,29.8,7,1.8)
    c.group(1)
    # leaves at base
    for (x,y,rx,ry) in ((4,26,3.6,1.8),(12,26.5,3.4,1.7),(8,28,4,1.6)): c.ellipsoid(x,y,rx,ry,'leaf',amb=0.3)
    c.group(2)
    # tendril
    c.line(8,26,9,22,'leaf',2)
    # pitcher body: tall jug, bulge low
    c.new()
    prof=[2.6,2.1,1.9,2.0,2.3,2.8,3.4,4.0,4.6,5.0,5.2,5.1,4.7,4.0,3.0]
    cx=8.5
    for i,r in enumerate(prof):
        y=9+i
        for x in range(int(cx-r)-1,int(cx+r)+2):
            dx=(x+0.5-cx)/r
            if abs(dx)<=1: c.setv(x,y,'lily',c.shade(dx,0.1,math.sqrt(1-dx*dx),0.3)+0.05)
    # red speckles & vertical stripe (wings)
    for y in range(12,23):
        for x in range(4,14):
            if c.m[y][x]=='lily' and _hash(x,y,5)>0.84 and y>14: c.tone(x,y,'red',3 if _hash(x,y,6)>0.5 else 2)
    for y in range(12,23): c.tone(8,y,'lily',2) if c.m[y][8]=='lily' else None
    # peristome (red rim) & dark mouth
    c.group(3)
    c.ellipsoid(8.5,8.8,3.4,1.9,'red',amb=0.5,bias=0.15)
    for (x,y) in ((7,8),(8,8),(9,8),(10,8),(7,9),(8,9),(9,9)): c.tone(x,y,'dark',1)
    # lid leaning back
    c.group(4)
    c.ellipsoid(11.2,4.4,2.8,2.4,'lily',amb=0.45,bias=0.1)
    for (x,y) in ((10,4),(12,5),(11,3)): c.tone(x,y,'red',3)
    c.line(10,7,10,6,'lily',2)
    return c
P['벌레잡이 식물']=pitcher

def campfire():
    c=C(16,16,seed=46); c.shadow(8,13.4,7.4,1.8)
    # ring of stones
    ring=[(a*math.pi/4) for a in range(8)]
    back=[a for a in ring if math.sin(a)<0]; front=[a for a in ring if math.sin(a)>=0]
    k=0
    for a in back:
        k+=1; c.group(k); c.ellipsoid(8+math.cos(a)*5.2,11+math.sin(a)*2.6,1.9,1.4,'stone',bias=0.05)
    c.group(20)
    # crossed logs
    for (x0,y0,x1,y1) in ((3,12,12,9),(4,9,13,12)):
        c.new(); n=10
        for j in range(n):
            f=j/(n-1); x=int(round(x0+(x1-x0)*f)); y=int(round(y0+(y1-y0)*f))
            c.setv(x,y,'bark',0.7); c.setv(x,y+1,'bark',0.35)
    # flame: layered teardrops
    c.group(30); c.new()
    flame=["......x.....",
           ".....xo.....",
           "....oxo..x..",
           "....oxxo.o..",
           "...ooxxoo...",
           "...fooxoof..",
           "..ffoxxxofF.",
           "..FfoooofF..",
           "...FfffFF...",]
    c.lit(flame,2,1,{'x':('fire',6),'o':('fire',4),'f':('fire',3),'F':('fire',2)})
    for a in front:
        k+=1; c.group(40+k); c.ellipsoid(8+math.cos(a)*5.2,11+math.sin(a)*2.6,1.9,1.4,'stone',bias=0.1)
    return c
P['모닥불']=campfire

def tent():
    # fixed chipset view: front-facing, symmetric, seen from the front and above.
    # ridge runs straight away from the viewer -> both roof planes visible above the front gable.
    c=C(48,48,seed=47); c.shadow(24,41.5,22,3.2)
    B=(24,5); F=(24,20); L=(3,40); R=(45,40); Lb=(5,24); Rb=(43,24)
    c.group(1); c.poly([B,F,L,Lb],'cloth',lambda x,y:0.9-0.1*(y-5)/35)      # left roof plane (lit)
    c.group(2); c.poly([B,Rb,R,F],'cloth',lambda x,y:0.5-0.08*(y-5)/35)     # right roof plane (shade)
    for k in (1,2,3):                                                     # seams parallel to the ridge
        f=k/4; c.line(B[0]+(Lb[0]-B[0])*f,B[1]+(Lb[1]-B[1])*f,F[0]+(L[0]-F[0])*f,F[1]+(L[1]-F[1])*f,'cloth',3)
        c.line(B[0]+(Rb[0]-B[0])*f,B[1]+(Rb[1]-B[1])*f,F[0]+(R[0]-F[0])*f,F[1]+(R[1]-F[1])*f,'cloth',1)
    c.line(B[0],B[1],F[0],F[1],'cloth',5)                                  # ridge
    c.group(3); c.poly([F,R,L],'cloth',lambda x,y:0.66-0.08*(y-20)/20)     # front gable
    for x in range(4,45):
        if c.m[39][x]=='cloth': c.darken(x,39,1)
    # doorway, flaps tied back symmetrically
    c.group(4); c.poly([(24,24),(15,40),(33,40)],'dark',0.3,grain=False)
    for y in range(35,40):
        for x in range(16,33):
            if c.m[y][x]=='dark': c.tone(x,y,'red',2 if (x+y)%4 else 3)
    for x in range(20,29): c.tone(x,33,'cream',4); c.tone(x,34,'cream',3)
    c.group(5); c.poly([(24,24),(15,40),(18,40),(20,32)],'cloth',lambda x,y:0.98)
    c.group(6); c.poly([(24,24),(33,40),(30,40),(28,32)],'cloth',lambda x,y:0.8)
    c.tone(19,32,'rope',5); c.tone(20,33,'rope',4); c.tone(29,32,'rope',4); c.tone(28,33,'rope',3)
    # poles and pennant
    c.group(7)
    for y in range(15,21): c.tone(24,y,'bark',4)
    for y in range(1,6): c.tone(24,y,'bark',3)
    for (x,y,t) in ((25,1,5),(26,1,4),(27,2,4),(25,2,4),(26,2,3)): c.tone(x,y,'red',t)
    # guy ropes + pegs, symmetric
    c.line(3,40,0,44,'rope',4); c.line(45,40,47,44,'rope',3)
    c.line(9,30,1,34,'rope',4); c.line(39,30,46,34,'rope',3)
    for (x,y) in ((0,44),(47,44),(1,34),(46,34)): c.tone(x,y,'bark',4); c.tone(x,y+1,'bark',2)
    return c
P['야영 천막']=tent

def chest(kind):
    c=C(16,16,seed=48); c.shadow(8,14.3,7.6,1.6)
    body='wood' if kind!='gold' else 'gold'
    band='iron' if kind!='gold' else 'gold'
    c.group(1); c.new()
    lid_top=2 if kind!='open' else 1
    if kind=='open':
        # lid thrown back: dark underside panel on top
        for y in range(1,5):
            for x in range(2,14): c.setv(x,y,'wood',0.35)
        for x in range(2,14): c.tone(x,1,'wood',4)
        c.new()
        for y in range(5,8):
            for x in range(1,15): c.tone(x,y,'dark',1)
        # treasure heap
        for y in range(5,8):
            for x in range(2,14):
                if _hash(x,y,9)>0.25: c.tone(x,y,'gold',6 if _hash(x,y,8)>0.7 else 5 if _hash(x,y,7)>0.4 else 4)
        c.tone(6,5,'red',5); c.tone(10,6,'cryst',5)
    else:
        for y in range(2,7):
            for x in range(1,15):
                dy=(y-6.5)/4.5; c.setv(x,y,body,c.shade(0,dy,math.sqrt(max(0,1-dy*dy)),0.3)+0.05)
        for x in range(2,14): c.lighten(x,3,1)
    for y in range(7,14):
        for x in range(1,15): c.setv(x,y,body,0.55-0.03*(y-7) if body=='wood' else 0.62-0.03*(y-7))
    for x in range(1,15): c.tone(x,10,body,2)
    for x0 in (3,11):
        for y in range(lid_top if kind!='open' else 7,14):
            c.tone(x0,y,band,5 if y<7 else 4); c.tone(x0+1,y,band,2 if y<7 else 1)
    for x in range(1,15): c.tone(x,7,band,3 if kind!='open' else 4); c.tone(x,8,band,1 if kind!='open' else 2)
    if kind!='open':
        for (x,y,t) in ((7,6,5),(8,6,6),(7,7,4),(8,7,5),(7,8,3),(8,8,2),(7,9,4),(8,9,3)): c.tone(x,y,'gold' if kind!='gold' else 'iron',t)
        c.tone(7,8,'dark',1)
    if kind=='gold':
        for (x,y) in ((2,11),(13,11)): c.tone(x,y,'red',5)
        c.tone(7,4,'cryst',5); c.tone(8,4,'cryst',6)
    return c
P['보물 상자 (나무)']=lambda: chest('wood'); P['보물 상자 (금)']=lambda: chest('gold'); P['보물 상자 (열림)']=lambda: chest('open')

def crystal():
    c=C(16,32,seed=49); c.shadow(8,29.8,6.5,1.8)
    c.group(1); c.cylinder(8,24,27,5.2,'stone',capry=1.8)
    for (x,y) in ((5,24),(8,23),(11,24)): c.tone(x,y,'teal',5)
    c.group(2)
    # floating octahedral crystal, facets flat-toned (gem, not grain)
    gem=["......A.......",
         ".....ABc......",
         "....AABcc.....",
         "...AAABccc....",
         "..AAAABcccd...",
         ".AAAAABccccd..",
         "AAAAAABcccccd.",
         ".aaaaaBbbbbd..",
         "..aaaaBbbbd...",
         "...aaaBbbd....",
         "....aaBbd.....",
         ".....aBd......",
         "......d.......",]
    c.lit(gem,1,4,{'A':('cryst',5),'B':('cryst',6),'c':('cryst',4),'d':('cryst',2),'a':('cryst',3),'b':('cryst',2)})
    for (x,y) in ((4,10),(5,9)): c.tone(x,y,'cryst',6)
    # sparkles (not outlined: drawn after)
    c.spark=[(2,5),(13,8),(3,18),(12,17),(8,20)]
    return c
P['세이브 크리스털']=crystal

def totem():
    c=C(16,48,seed=50); c.shadow(8,45.5,6.5,1.8)
    c.group(1); c.cylinder(8,6,43,5.6,'wood',capry=1.8)
    faces=[(8,'red'),(20,'teal'),(32,'gold')]
    for i,(fy,col) in enumerate(faces):
        for x in range(3,14): c.darken(x,fy+10,2); c.lighten(x,fy+11,1)       # segment groove
        for x in range(4,13): c.darken(x,fy,1)                                # brow shadow
        for x in range(4,13): c.lighten(x,fy-1,1)                             # brow ridge
        for (x,y) in ((5,fy+1),(6,fy+1),(5,fy+2),(6,fy+2),(10,fy+1),(11,fy+1),(10,fy+2),(11,fy+2)): c.tone(x,y,'dark',1)
        c.tone(5,fy+1,col,6); c.tone(10,fy+1,col,6); c.tone(6,fy+2,col,4); c.tone(11,fy+2,col,4)
        for (x,y,t) in ((8,fy+2,5),(7,fy+3,4),(8,fy+3,5),(9,fy+3,2),(7,fy+4,2),(8,fy+4,1),(9,fy+4,1)): c.tone(x,y,'wood',t)   # beak nose
        for x in range(5,12): c.tone(x,fy+6,'dark',1); c.tone(x,fy+7,'dark',1)
        for x in (5,7,9,11): c.tone(x,fy+6,'bone',6)
        for x in (6,8,10): c.tone(x,fy+7,'bone',4)
        c.tone(4,fy+5,col,4); c.tone(12,fy+5,col,3)                          # painted cheeks
    # wings / beak at top
    c.group(2)
    c.poly([(3,6),(0,2),(0,10),(3,9)],'red',0.75); c.poly([(13,6),(16,2),(16,10),(13,9)],'red',0.45)
    for (x,y,t) in ((7,1,5),(8,1,6),(8,2,4),(7,2,3)): c.tone(x,y,'teal',t)
    return c
P['부족 토템']=totem

def ropebridge():
    c=C(16,16,seed=51)
    # rope rails top & bottom (sagging), planks between hung by vertical cords
    c.group(1)
    for i,x0 in enumerate(range(0,16,3)):
        c.new()
        for y in range(4,12):
            for x in range(x0,min(16,x0+2)): c.setv(x,y,'wood',0.8 if x==x0 else 0.5)
        c.tone(x0,4,'wood',5)
    c.group(2)
    for x in range(16):
        yt=2+int(round(math.sin(x/15*math.pi)*1)); yb=13+int(round(math.sin(x/15*math.pi)*1))
        c.tone(x,yt,'rope',5); c.tone(x,yt+1,'rope',2); c.tone(x,yb,'rope',4); c.tone(x,yb+1,'rope',1)
    for x in range(0,16,3):
        c.tone(x,4,'rope',3); c.tone(x,11,'rope',3)
    # leaves twined on the rails
    for x in (3,10,14): c.tone(x,2,'leaf',4); c.tone(x+1,3,'leaf',3)
    return c
P['덩굴 흔들다리 (가로)']=ropebridge; WATER.add('덩굴 흔들다리 (가로)')

def ladder():
    c=C(16,32,seed=52)
    c.group(1)
    for x0 in (3,11):
        c.new()
        for y in range(0,32):
            c.setv(x0,y,'bark',0.8); c.setv(x0+1,y,'bark',0.4)
    c.group(2)
    for y in range(3,32,5):
        c.new()
        for x in range(5,11): c.setv(x,y,'wood',0.85); c.setv(x,y+1,'wood',0.35)
        c.tone(4,y,'rope',4); c.tone(11,y,'rope',4)
    vine(c,[(3,6),(2,9),(3,12),(2,15)]); vine(c,[(12,20),(13,23),(12,26)])
    return c
P['사다리']=ladder

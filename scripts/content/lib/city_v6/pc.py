# batch 3: more jungle JRPG objects (fixed front-above view, chipset texture)
import sys, math; sys.path.insert(0,__import__('os').path.dirname(__import__('os').path.abspath(__file__)))
from px2 import C, vnoise, _hash
from pa import mossify, vine
P={}; WATER=set()

def olmec():
    # giant carved stone head half-sunk in the ground, facing the viewer
    c=C(32,32,seed=71); c.shadow(16,29,15,2.6)
    c.group(1); c.ellipsoid(16,15,13,13,'mstone',amb=0.28,bump=0.35,bsc=4)
    c.new()
    for x in range(4,29): c.tone(x,5,'mstone',1) if 7<x<25 else None           # helmet band
    for x in range(6,27): c.tone(x,6,'mstone',5)
    for (x,y) in ((8,10),(9,11),(10,11),(11,11),(12,10),(19,10),(20,11),(21,11),(22,11),(23,10)): c.tone(x,y,'mstone',0)   # heavy lids
    for (x,y,t) in ((10,12,4),(21,12,4)): c.tone(x,y,'mstone',t)
    for (x,y) in ((9,12),(11,12),(20,12),(22,12)): c.tone(x,y,'mstone',2)
    for y in range(12,19): c.tone(14,y,'mstone',4); c.tone(17,y,'mstone',1)  # broad nose
    for x in range(12,21): c.tone(x,19,'mstone',0)
    c.tone(13,18,'mstone',1); c.tone(19,18,'mstone',1)
    for x in range(11,22): c.tone(x,22,'mstone',0)                          # thick lips
    for x in range(12,21): c.tone(x,21,'mstone',5); c.tone(x,23,'mstone',4)
    for y in range(9,20): c.tone(3,y,'mstone',2); c.tone(29,y,'mstone',1)   # ear flaps
    # sunk into earth
    for y in range(26,30):
        for x in range(2,31):
            if c.m[y][x]: c.setv(x,y,'dirt',0.5-0.1*(y-26))
    mossify(c,3,1,29,10,'mstone',thr=0.55,topbias=0.35)
    vine(c,[(26,6),(27,9),(26,12),(27,15)])
    return c
P['거대 석두 (반쯤 묻힘)']=olmec

def idol():
    c=C(16,32,seed=72); c.shadow(8,29.6,6.5,1.8)
    c.group(1); c.box(2,23,12,2,4,'mstone'); c.box(3,20,10,2,1,'mstone',bias=0.08)
    c.group(2)
    rows=["....yZZy....",
          "...yZ!!Zy...",
          "..yZZZZZZy..",
          "..yZeZZeZy..",
          "..yZZZZZZy..",
          "...yZrrZy...",
          "..yyZZZZyy..",
          ".yZZZZZZZZy.",
          ".yZ.yZZy.Zy.",
          "..y.yZZy.y..",
          "....yZZy....",
          "...yyZZyy...",
          "...yZZZZy...",
          "..yyyyyyyy.."]
    c.lit(rows,2,6,{'y':('gold',2),'Z':('gold',4),'!':('gold',6),'e':('red',5),'r':('gold',1)})
    for y in range(7,20): c.lighten(4,y,1) if c.m[y][4] else None
    c.spark=[(3,6),(12,8),(2,14)]
    return c
P['황금 우상']=idol

def pot(v):
    c=C(16,16,seed=73+v); c.shadow(8,14.3,6,1.5)
    c.group(1)
    if v==0:
        c.ellipsoid(8,9.5,5.5,4.8,'cloth',amb=0.3)
        c.cylinder(8,3.5,5,2.6,'cloth',capry=1.1,amb=0.3)
        for (x,y) in ((6,3),(7,3),(8,3),(9,3),(10,3)): c.tone(x,y,'dark',1) if abs(x-8)<2 else None
        for x in range(3,14): c.tone(x,9,'cream',4) if c.m[9][x] else None        # painted band
        for x in range(4,13,3): c.tone(x,10,'red',3) if c.m[10][x] else None
    else:
        c.ellipsoid(8,10,4.6,4,'cloth',amb=0.3,bias=-0.08)
        c.cylinder(8,4.5,6.5,3.4,'cloth',capry=1.4,amb=0.3,bias=-0.05)
        c.new(); c.ellipsoid(8,4.2,2.8,1.1,'bark',amb=0.4)                       # wooden stopper
        for x in range(4,13): c.tone(x,8,'rope',4) if c.m[8][x] else None
    return c
P['토기 항아리 A']=lambda: pot(0); P['토기 항아리 B']=lambda: pot(1)

def bones():
    c=C(16,16,seed=75); c.shadow(8,13.5,7,1.8)
    c.group(1)
    for (x0,y0,x1,y1) in ((2,12,11,10),(5,9,14,13),(3,11,6,6)):
        c.new(); n=int(max(abs(x1-x0),abs(y1-y0)))+1
        for j in range(n):
            f=j/(n-1); x=int(round(x0+(x1-x0)*f)); y=int(round(y0+(y1-y0)*f)); c.setv(x,y,'bone',0.75)
        for (x,y) in ((x0,y0),(x1,y1)): c.tone(x-1,y,'bone',5); c.tone(x,y-1,'bone',6)
    c.group(2); c.ellipsoid(9,7,3.4,3.0,'bone',amb=0.35,bias=0.1)
    for (x,y) in ((8,7),(10,7)): c.tone(x,y,'dark',1)
    c.tone(9,8,'bone',2); c.tone(8,9,'bone',3); c.tone(10,9,'bone',3)
    return c
P['뼈 무더기']=bones

def spikes(up):
    c=C(16,16,seed=76); c.period=16
    for y in range(16):
        for x in range(16): c.setv(x,y,'mstone',0.55 if (x%8 and y%8) else 0.35)
    for y in range(16): c.tone(0,y,'mstone',1); c.tone(15,y,'mstone',4)
    for x in range(16): c.tone(x,0,'mstone',1); c.tone(x,15,'mstone',4)
    for (cx,cy) in ((4,4),(12,4),(4,12),(12,12)):
        c.tone(cx,cy,'dark',1); c.tone(cx-1,cy,'dark',2)
        if up:
            for (dx,dy,t) in ((0,-3,6),(0,-2,5),(-1,-1,4),(0,-1,4),(1,-1,2),(-1,0,3),(0,0,3),(1,0,1)): c.tone(cx+dx,cy+dy,'iron',t)
    return c
P['가시 함정 (숨김)']=lambda: spikes(False); P['가시 함정 (솟음)']=lambda: spikes(True)

def plate():
    c=C(16,16,seed=77); c.period=16
    for y in range(16):
        for x in range(16): c.setv(x,y,'mstone',0.62)
    c.group(2); c.box(3,3,10,8,2,'stone',bias=0.05)
    c.new()
    for (x,y,t) in ((7,6,5),(8,6,6),(6,7,4),(9,7,4),(7,8,6),(8,8,5),(7,9,4),(8,9,4)): c.tone(x,y,'teal',t)
    return c
P['압력판']=plate

def sign():
    c=C(16,16,seed=78); c.shadow(8,14.5,4,1.2)
    c.group(1)
    for y in range(8,15): c.tone(7,y,'bark',4); c.tone(8,y,'bark',2)
    c.group(2); c.box(2,2,12,1,6,'wood',bias=0.05)
    for x in range(3,13): c.tone(x,5,'wood',2)
    for (x,y) in ((4,4),(6,4),(8,4),(10,4),(5,7),(7,7),(9,7)): c.tone(x,y,'dark',2)
    c.tone(12,3,'leaf',4); c.tone(13,4,'leaf',3); c.tone(2,8,'leaf',4)
    return c
P['나무 표지판']=sign

def bamboo():
    c=C(16,16,seed=79)
    for i,x0 in enumerate((1,6,11)):
        c.group(i+1); c.new()
        top=1+i%2
        for y in range(top,15):
            for x,t in zip(range(x0,x0+4),(5,4,3,1)): c.tone(x,y,'lily',t)
        for y in (top+4,top+9):
            for x in range(x0,x0+4): c.tone(x,y,'lily',2); c.tone(x,y-1,'lily',5) if x==x0 else None
        for x in range(x0,x0+4): c.tone(x,top,'cream',4 if x<x0+2 else 3)
    c.group(9)
    for x in range(16): c.tone(x,7,'rope',4); c.tone(x,8,'rope',2)
    return c
P['대나무 울타리 (가로)']=bamboo

def taro():
    # huge elephant-ear leaves on stems, fanned out
    c=C(32,32,seed=80); c.shadow(16,28.5,12,2.4)
    leaves=[(-150,9,5),(-115,11,6),(-65,11,6),(-30,9,5),(-90,8,5)]
    for k,(ang,L,w) in enumerate(leaves):
        a=math.radians(ang); tipx=16+math.cos(a)*L*1.3; tipy=26+math.sin(a)*L*1.6
        c.group(k+1); c.new()
        c.line(16,26,int(tipx*0.5+16*0.5),int(tipy*0.5+26*0.5),'lily',2)
        cx=16+math.cos(a)*L*0.95; cy=26+math.sin(a)*L*1.15
        for y in range(32):
            for x in range(32):
                dx=x+0.5-cx; dy=y+0.5-cy
                u=dx*math.cos(a)+dy*math.sin(a); v=-dx*math.sin(a)+dy*math.cos(a)
                r=(u/(L*0.62))**2+(v/(w*0.95))**2
                if r<=1 and not (u<-L*0.45 and abs(v)<1.2):
                    side=0.12 if v<0 else -0.1
                    c.setv(x,y,'leaf',0.66+side-0.2*r)
                    if abs(v)<0.6: c.tone(x,y,'leaf',5)
    return c
P['거대 토란잎']=taro

def fern():
    # a few long arching fronds with feathery leaflets, drooping at the tips
    c=C(32,32,seed=81); c.shadow(16,28.5,13,2.2)
    fronds=[(-155,13,1),(-122,16,1),(-90,17,0),(-58,16,-1),(-25,13,-1)]
    for k,(ang,L,side) in enumerate(fronds):
        a=math.radians(ang); c.group(k+1); c.new()
        pts=[]
        for j in range(L*2):
            f=j/(L*2-1); r=L*f
            x=16+math.cos(a)*r*0.9; y=28+math.sin(a)*r*1.1+ (f**2)*(5 if abs(ang+90)>50 else 3 if abs(ang+90)>20 else 0)
            pts.append((x,y))
        for j,(x,y) in enumerate(pts):
            c.setv(int(x),int(y),'leaf',0.45)
            if j>2 and j%2==0:
                f=j/len(pts); ll=max(1,int(round(2.6*(1-f)+0.5)))
                if j+1<len(pts): dx,dy=pts[j+1][0]-x,pts[j+1][1]-y
                else: dx,dy=pts[j][0]-pts[j-1][0],pts[j][1]-pts[j-1][1]
                n=math.hypot(dx,dy) or 1; px_,py_=-dy/n,dx/n
                for s_ in (-1,1):
                    for q in range(1,ll+1):
                        xx=int(round(x+px_*s_*q+dx/n*q*0.5)); yy=int(round(y+py_*s_*q+dy/n*q*0.5))
                        c.setv(xx,yy,'leaf',0.9 if s_*py_<0 or s_*px_<0 else 0.6)
    return c
P['거대 고사리']=fern

def curtain():
    # vines hanging from a cliff lip, 16x32 overlay
    c=C(16,32,seed=82)
    for x in range(16): c.tone(x,0,'moss',4); c.tone(x,1,'moss',3); c.tone(x,2,'moss',2) if x%3 else None
    for k,x in enumerate((2,5,8,11,14)):
        L=14+int(_hash(k,1,82)*14); c.new()
        for y in range(2,L):
            xx=x+int(round(math.sin(y/4+k)*0.8))
            c.tone(xx,y,'leaf',2)
            if y%3==0: c.tone(xx+(1 if (y//3)%2 else -1),y,'leaf',5); c.tone(xx+(1 if (y//3)%2 else -1),y+1,'leaf',3)
        if k%2: c.tone(x,L,'pink',5); c.tone(x+1,L,'pink',4)
    return c
P['덩굴 커튼 (벼랑 끝)']=curtain

def baskets():
    c=C(16,16,seed=83); c.shadow(8,14.3,7.4,1.6)
    c.group(1); c.cylinder(5,7,12,3.6,'rope',capry=1.5,amb=0.3)
    for y in range(8,13):
        for x in range(2,9):
            if c.m[y][x]=='rope' and (x+y)%2: c.darken(x,y,1)
    c.new()
    for (x,y,t) in ((4,6,5),(5,6,6),(6,6,5),(5,5,4)): c.tone(x,y,'red',t)      # fruit
    c.group(2); c.ellipsoid(11.5,10.5,3.6,3.6,'cream',amb=0.3,bias=-0.05)
    for (x,y) in ((11,7),(12,7),(11,6)): c.tone(x,y,'rope',3)
    c.line(9,9,14,11,'rope',2)
    return c
P['바구니·자루']=baskets

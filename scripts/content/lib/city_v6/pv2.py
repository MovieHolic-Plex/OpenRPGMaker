# batch 8: more medieval town props (fixed front-above view, chipset palette via palette.apply()).
import sys, math; sys.path.insert(0,__import__('os').path.dirname(__import__('os').path.abspath(__file__)))
from px2 import C, vnoise, _hash
P={}; WATER=set()

def post(c,x,y0,y1,mat='bark',t=(5,2)):
    c.new()
    for y in range(y0,y1+1): c.tone(x,y,mat,t[0]); c.tone(x+1,y,mat,t[1])

def disk(c,cx,cy,r,f):
    # f(dx,dy,d) -> (mat,tone) or None, per pixel of a front-facing disc
    c.new()
    for y in range(int(cy-r)-1,int(cy+r)+2):
        for x in range(int(cx-r)-1,int(cx+r)+2):
            dx,dy=x+0.5-cx,y+0.5-cy; d=math.hypot(dx,dy)
            if d<=r:
                o=f(dx,dy,d)
                if o: c.tone(x,y,o[0],o[1])

def hoops(c,rows,x0,x1,cx):
    for y in rows:
        for x in range(x0,x1):
            if c.m[y][x]: c.tone(x,y,'iron',4 if x<cx else 2)

# 1 fish drying rack --------------------------------------------------------
def fish(c,cx,cy,g,flip=False):
    # side profile, head left: lens body, eye, gill line, forked tail; hung from the bar by a string
    c.group(g); c.new()
    for y in range(cy-5,cy-2): c.tone(cx,y,'rope',3)
    for x in range(cx-5,cx+4):
        f=(x-(cx-5))/8; hh=max(0,round(2.3*math.sin(math.pi*min(1,f*1.1))))
        for y in range(cy-hh,cy+hh+1):
            t=5 if y<cy else (4 if y==cy else 3)
            if y==cy-hh: t=6
            c.tone(x,y,'iron',t)
    for (x,y) in ((cx+4,cy),(cx+5,cy-1),(cx+5,cy+1),(cx+6,cy-2),(cx+6,cy+2)): c.tone(x,y,'iron',4)
    c.tone(cx+5,cy,'iron',2)
    c.tone(cx-3,cy-1,'dark',1); c.tone(cx-1,cy,'iron',2); c.tone(cx-1,cy+1,'iron',2)

def fishrack():
    c=C(32,32,seed=400); c.shadow(16,29.6,15,1.6)
    c.group(1); post(c,2,3,29); post(c,28,3,29)
    for bar in (4,16):
        c.new()
        for x in range(1,31): c.tone(x,bar,'wood',5 if x<16 else 4); c.tone(x,bar+1,'wood',2)
    fish(c,9,10,10); fish(c,21,10,11); fish(c,9,22,12); fish(c,21,22,13)
    return c

# 2 pottery ---------------------------------------------------------------
def pot(c,cx,base,rx,ry,neck,g,mat='cloth'):
    c.group(g); cy=base-ry
    c.ellipsoid(cx,cy,rx,ry,mat,amb=0.3,bias=0.02)
    for x in range(int(cx-rx),int(cx+rx)+1):                                    # painted band
        y=int(cy-ry*0.25)
        if c.m[y][x]==mat: c.tone(x,y,'wood',2 if x>cx else 3)
    top=int(cy-ry)-neck
    c.new()
    for y in range(top,int(cy-ry)+2):
        for x in range(int(cx)-2,int(cx)+2): c.tone(x,y,mat,5 if x<cx-1 else 3)
    c.new()
    for x in range(int(cx)-3,int(cx)+3): c.tone(x,top,mat,5 if x<cx else 4)
    c.tone(int(cx)-1,top,'dark',1); c.tone(int(cx),top,'dark',1)
def pottery():
    c=C(32,16,seed=401); c.shadow(16,14.6,15,1.4)
    pot(c,8,14,5.5,5.5,2,1); pot(c,20,14,4,3.8,1,2); pot(c,27.5,14,3,4.2,2,3,mat='cream')
    return c

# 3 fruit baskets ------------------------------------------------------------
def basket(c,x0,w,g,fruit):
    c.group(g); c.box(x0,9,w,1,5,'rope',top=0.7,front=0.6)
    for y in range(10,15):
        for x in range(x0,x0+w):
            if (x+(y//2)*2)%4==0: c.darken(x,y,1)
            if y==10: c.lighten(x,y,1)
    c.group(g+1)
    mat,rx=fruit
    pts=[(x0+2.5,8.5),(x0+w-2.5,8.5),(x0+w/2,6.2),(x0+w/2-2.3,7.5),(x0+w/2+2.3,7.3)]
    for (px_,py_) in pts: c.ellipsoid(px_,py_,rx,rx*0.9,mat,amb=0.3,bias=0.08)
    if mat=='red':
        for (px_,py_) in pts: c.tone(int(px_),int(py_-rx),'leaf',3)
def fruit():
    c=C(32,16,seed=402); c.shadow(16,14.6,15,1.4)
    basket(c,1,14,1,('red',2.0)); basket(c,17,14,3,('gold',2.0))
    return c

# 4 cloth bolts in a crate ----------------------------------------------------
def bolts():
    c=C(32,16,seed=403); c.shadow(16,14.6,15,1.4)
    cols=['red','cryst','gold','lily','cream']
    for i,m in enumerate(cols):
        cx=5+i*5.5; c.group(1+i); c.cylinder(cx,2+(i%2)*2,11,2.5,m,capry=1.1,amb=0.3,bias=0.05)
        c.tone(int(cx),2+(i%2)*2,m,2)                                             # roll core
    c.group(9); c.box(1,10,30,0,5,'wood',front=0.62)
    for x in range(1,31):
        c.tone(x,10,'wood',5)
        if x in (1,30,16): [c.tone(x,y,'wood',2) for y in range(10,15)]
    for x in range(1,31): c.tone(x,12,'wood',3)
    return c

# 5 stone bench -------------------------------------------------------------
def stonebench():
    c=C(32,16,seed=404); c.shadow(16,14.6,15,1.3)
    c.group(1)
    for x0 in (5,23): c.box(x0,9,4,0,5,'stone',front=0.45)
    c.group(2); c.box(2,4,28,3,3,'stone',top=0.95,front=0.6)
    for x in (10,21):
        for y in range(4,10): c.darken(x,y,1)                                    # slab joints
    return c

# 6 hand cart ---------------------------------------------------------------
def wheel(c,cx,cy,r,g,spokes=6):
    c.group(g); c.new()
    for y in range(int(cy-r)-1,int(cy+r)+2):
        for x in range(int(cx-r)-1,int(cx+r)+2):
            d=math.hypot(x+0.5-cx,y+0.5-cy)
            if r-1.8<=d<=r: c.tone(x,y,'bark',5 if (x<cx and y<cy) else 3 if y<cy or x<cx else 2)
    for k in range(spokes):
        a=k*2*math.pi/spokes+0.3; c.line(cx,cy,cx+math.cos(a)*(r-1.5),cy+math.sin(a)*(r-1.5),'bark',4)
    c.new(); c.ellipsoid(cx,cy,1.5,1.5,'iron',bias=0.1)
def handcart():
    c=C(32,32,seed=405); c.shadow(18,29.4,14,1.6)
    c.group(1); c.line(0,20,9,15,'bark',5); c.line(0,21,9,16,'bark',3)         # handles
    c.group(2); c.new()
    for y in range(20,28): c.tone(10,y,'bark',4); c.tone(11,y,'bark',2)          # prop leg
    c.group(3); c.ellipsoid(16,11,4.2,3.6,'cream',bias=0.05); c.tone(16,8,'rope',3)
    c.group(4); c.box(20,6,8,2,5,'wood',bias=0.05)
    for y in range(8,13): c.tone(24,y,'wood',2)
    c.group(5); c.box(8,12,23,2,7,'wood')
    for y in (15,18):
        for x in range(8,31): c.darken(x,y,1)
    for x in (8,30):
        for y in range(14,21): c.tone(x,y,'wood',2)
    wheel(c,21,22,7,6)
    return c

# 7 wheelbarrow -------------------------------------------------------------
def wheelbarrow():
    c=C(32,16,seed=406); c.shadow(15,14.6,13,1.3)
    c.group(1); c.line(0,6,8,8,'bark',5); c.line(0,7,8,9,'bark',3)
    c.group(2); c.new()
    for y in range(10,15): c.tone(9,y,'bark',4)
    c.group(3); c.ellipsoid(17,5.5,7,3,'dirt',bump=0.6,bsc=2,amb=0.3)            # load of earth
    c.group(4); c.poly([(6,6),(28,6),(25,12),(9,12)],'wood',lambda x,y:0.9 if y<8 else 0.55)
    for x in range(7,28): c.tone(x,6,'wood',6 if x%3 else 5)
    for x in range(9,26): c.tone(x,9,'wood',3)
    wheel(c,26,11,4.2,5,spokes=4)
    return c

# 8 barrel rack (barrel ends facing the viewer) ------------------------------
def barrel_end(c,cx,cy,r,g):
    c.group(g)
    def f(dx,dy,d):
        if d>r-1.3: return ('iron',4 if dy<0 and dx<0 else 2 if dx>0 else 3)
        if d>r-2.4: return ('wood',3)
        if abs(dx)<1 and abs(dy)<1: return ('dark',2)                           # bung
        t=5 if dx<-1 else (4 if dx<2 else 3)
        if int(dx+20)%3==0: t-=1                                                 # staves of the lid
        if dy<-r*0.55: t=min(6,t+1)
        return ('wood',t)
    disk(c,cx,cy,r,f)
def barrelrack():
    c=C(32,32,seed=407); c.shadow(16,29.6,15,1.6)
    c.group(1); c.box(1,23,30,1,5,'bark',front=0.5)                              # cradle beam
    for x in (3,28):
        c.new(); [c.tone(x,y,'bark',3) for y in range(28,30)]; [c.tone(x+1,y,'bark',2) for y in range(28,30)]
    barrel_end(c,9,17,7,2); barrel_end(c,23,17,7,3); barrel_end(c,16,8,6.5,4)
    c.group(9); c.new(); c.tone(9,25,'iron',4); c.tone(9,26,'iron',3); c.tone(23,25,'iron',4); c.tone(23,26,'iron',3)  # taps
    return c

# 9 chopping block ------------------------------------------------------------
def chopblock():
    c=C(16,16,seed=408); c.shadow(8,14.5,7,1.2)
    c.group(1); c.hcyl(0,5,12.5,1.8,'bark',endcap='R')
    c.group(2); c.cylinder(9,8,13,4.6,'bark',capry=2)
    c.new()
    for y in range(6,11):
        for x in range(4,15):
            r=((x+0.5-9)/4.1)**2+((y+0.5-8)/1.7)**2
            if r<=1: c.tone(x,y,'cream',5 if r<0.25 or r>0.6 else 4)
    c.group(3); c.new()
    for (x,y,t) in ((6,5,6),(7,5,5),(8,5,5),(5,6,5),(6,6,5),(7,6,4),(8,6,4),(9,6,3),(6,7,3),(7,7,3)): c.tone(x,y,'iron',t)
    c.line(9,5,13,1,'wood',5); c.line(10,5,14,1,'wood',3)
    return c

# 10 market scale ------------------------------------------------------------
def scale():
    c=C(16,32,seed=409); c.shadow(8,29.6,6,1.3)
    c.group(1); c.box(4,25,8,2,3,'wood')
    c.group(2); post(c,7,6,25,'wood',(5,3))
    c.group(3); c.new()
    for x in range(1,15): c.tone(x,6,'wood',5 if x<8 else 4); c.tone(x,7,'wood',2)
    c.tone(7,4,'gold',5); c.tone(8,4,'gold',4); c.tone(7,5,'gold',4); c.tone(8,5,'gold',3)
    for side,cx in ((0,3),(1,12)):
        c.group(4+side); c.new()
        c.line(cx,8,cx-3,16,'rope',4); c.line(cx,8,cx+3,16,'rope',3)
        c.new()
        for x in range(cx-4,cx+4): c.tone(x,17,'gold',5 if x<cx else 4)
        for x in range(cx-3,cx+3): c.tone(x,18,'gold',3)
        for x in range(cx-2,cx+2): c.tone(x,19,'gold',2)
    c.group(8); c.ellipsoid(12,15.5,1.8,1.5,'red',bias=0.15); c.ellipsoid(3,16,1.5,1.1,'iron',bias=0.1)
    return c

# 11 bust on a plinth --------------------------------------------------------
def bust():
    c=C(16,32,seed=410); c.shadow(8,29.6,6.5,1.4)
    c.group(1); c.box(2,27,12,1,2,'stone',bias=-0.02)
    c.group(2); c.box(4,17,8,2,10,'stone',front=0.58)
    c.new()
    for y in range(21,24):
        for x in range(5,11): c.tone(x,y,'gold',5 if y==21 else (4 if x<8 else 3))
    c.group(3); c.ellipsoid(8,15.5,6.8,3.4,'stone',amb=0.3,bias=0.05,clip=lambda x,y:y<18)
    c.new()
    for y in range(13,18): c.tone(8,y,'stone',3)
    c.group(4); c.new(); [c.tone(x,11,'stone',3) for x in range(6,10)]; [c.tone(x,12,'stone',3) for x in range(6,10)]
    c.group(5); c.ellipsoid(8,7,3.6,4.2,'stone',amb=0.3,bias=0.1)
    for x in range(5,12): c.tone(x,3,'stone',2 if x>8 else 3)
    c.tone(5,4,'stone',3); c.tone(10,4,'stone',2)
    c.tone(6,7,'stone',2); c.tone(9,7,'stone',2); c.tone(8,9,'stone',3); c.tone(7,10,'stone',3)
    return c

# 12 bell post ---------------------------------------------------------------
def bellpost():
    c=C(16,32,seed=411); c.shadow(8,29.6,7,1.4)
    c.group(1); c.box(1,26,14,2,2,'stone')
    c.group(2); post(c,2,6,26); post(c,12,6,26)
    c.group(3); c.new()
    for x in range(2,14): c.tone(x,8,'wood',4); c.tone(x,9,'wood',2)
    c.group(4); c.new()
    prof=[1.5,2.5,3,3,3,3.2,3.6,4.3,5]
    for j,hw in enumerate(prof):
        y=10+j
        for x in range(int(round(8-hw)),int(round(8+hw))):
            dx=(x+0.5-8)/hw
            t=6 if (dx<-0.4 and j<6) else 5 if dx<-0.1 else (4 if dx<0.45 else 3)
            c.tone(x,y,'gold',t)
    for x in range(3,13): c.tone(x,18,'gold',2)
    c.tone(7,19,'iron',3); c.tone(8,19,'iron',2)
    c.group(5); c.new()
    for y in range(20,26): c.tone(9,y,'rope',4)
    c.group(6); c.poly([(0,7),(8,1),(16,7)],'clay',lambda x,y:0.95 if x<8 else 0.5)
    for x in range(0,16): c.tone(x,7,'wood',2)
    return c

# 13 dog kennel --------------------------------------------------------------
def kennel():
    c=C(16,16,seed=412); c.shadow(8,14.6,7,1.2)
    c.group(1); c.box(2,6,12,0,8,'wood',front=0.65)
    for y in range(6,14):
        for x in range(2,14):
            if x%3==1: c.darken(x,y,1)
    c.new()
    for y in range(8,14):
        for x in range(5,11):
            if not (y==8 and x in (5,10)): c.tone(x,y,'dark',1)
    c.group(2); c.poly([(0,7),(8,0),(16,7)],'clay',lambda x,y:0.95 if x<8 else 0.5)
    for x in range(1,15): c.tone(x,7,'clay',2)
    c.group(3); c.new()
    for x in range(10,15): c.tone(x,13,'iron',4 if x<12 else 3); c.tone(x,14,'iron',2)  # bowl
    c.tone(11,12,'wood',4); c.tone(12,12,'wood',4)
    return c

# 14 hand pump ---------------------------------------------------------------
def pump():
    c=C(16,32,seed=413); c.shadow(8,29.6,7,1.4)
    c.group(1); c.box(1,22,10,2,5,'stone')
    for x in range(1,11): c.darken(x,25,1)
    c.group(2); c.cylinder(6,11,22,2.6,'iron',capry=1.1,bias=-0.05)
    c.group(3); c.box(3,8,6,1,2,'iron',bias=0.1)
    c.group(4); c.new()
    for x in range(8,12): c.tone(x,15,'iron',4); c.tone(x,16,'iron',2)
    c.tone(11,17,'iron',3)
    c.group(5); c.line(5,8,1,3,'iron',4); c.line(6,8,2,3,'iron',2)
    c.tone(1,2,'wood',5); c.tone(2,2,'wood',4)
    c.group(6); c.cylinder(12,23,28,2.8,'wood',capry=1.1)
    hoops(c,(26,),8,16,12)
    c.new()
    for x in range(11,14): c.tone(x,23,'teal',4)
    c.new(); c.tone(11,19,'teal',5); c.tone(11,21,'teal',4)
    return c

# 15 grindstone --------------------------------------------------------------
def grindstone():
    c=C(16,16,seed=414); c.shadow(8,14.6,7,1.2)
    c.group(1); c.box(2,10,12,1,4,'wood',front=0.5)
    c.new()
    for x in range(3,13): c.tone(x,10,'teal',3)
    c.group(2)
    disk(c,8,7,4.8,lambda dx,dy,d: ('stone',2 if d>4.0 else (6 if (dx+dy<-3 and d>2.6) else 5 if dx+dy<-1 else 4 if dx+dy<2 else 3)) if d>1.2 else ('iron',4))
    c.group(3); c.new()
    for x0 in (2,13):
        for y in range(4,11): c.tone(x0,y,'wood',5 if x0==2 else 3)
    c.group(4); c.new()
    c.tone(14,7,'iron',3); c.tone(15,7,'iron',3); c.tone(15,6,'iron',4); c.tone(15,5,'wood',5); c.tone(15,4,'wood',4)
    return c

# 16 archery target ------------------------------------------------------------
def target():
    c=C(16,32,seed=415); c.shadow(8,29.6,7,1.4)
    c.group(1); c.line(4,14,1,29,'wood',4); c.line(11,14,14,29,'wood',3)
    c.group(2)
    def f(dx,dy,d):
        if d>6.2: return ('rope',3 if dx<0 else 2)
        if d<1.6: return ('gold',5)
        if d<3.2: return ('red',4 if dx+dy<0 else 3)
        if d<4.8: return ('cream',5 if dx+dy<0 else 4)
        return ('red',4 if dx+dy<0 else 3)
    disk(c,8,11,7.3,f)
    c.group(3); c.line(10,9,14,6,'wood',5); c.tone(14,5,'cream',5); c.tone(15,6,'cream',4)  # arrow
    return c

# 17 hitching rail ------------------------------------------------------------
def hitching():
    c=C(32,16,seed=416); c.shadow(16,14.6,15,1.2)
    c.group(1); post(c,3,2,14); post(c,27,2,14)
    for x in (3,27): c.tone(x,1,'bark',4); c.tone(x+1,1,'bark',3)
    c.group(2); c.new()
    for x in range(3,29): c.tone(x,5,'wood',5 if x<16 else 4); c.tone(x,6,'wood',2)
    c.group(3); c.new()
    for (x,y) in ((12,7),(11,8),(13,8),(12,9)): c.tone(x,y,'iron',4)            # tie ring
    for y in range(9,13): c.tone(12+(y-9)%2,y,'rope',4)
    c.group(4); c.cylinder(20,10,14,2.8,'wood',capry=1.1)                       # water bucket
    hoops(c,(12,),16,24,20)
    c.new()
    for x in range(19,22): c.tone(x,10,'teal',4)
    return c

# 18 stocks ------------------------------------------------------------------
def stocks():
    c=C(32,16,seed=417); c.shadow(16,14.6,15,1.2)
    c.group(1); post(c,3,1,14); post(c,27,1,14)
    for x in (3,27): c.tone(x,0,'bark',4); c.tone(x+1,0,'bark',3)
    c.group(2); c.box(2,4,28,1,7,'wood',front=0.7)
    for x in range(2,30): c.tone(x,8,'wood',2)
    c.new()
    for (cx,r) in ((9,1.6),(16,2.4),(23,1.6)):
        for y in range(5,12):
            for x in range(int(cx-r)-1,int(cx+r)+2):
                if math.hypot(x+0.5-cx,(y+0.5-8.5)*1.1)<=r: c.tone(x,y,'dark',1)
    for x in (5,26): c.tone(x,6,'iron',4); c.tone(x,10,'iron',4)
    return c

# 19 birdbath -----------------------------------------------------------------
def birdbath():
    c=C(16,16,seed=418); c.shadow(8,14.6,5.5,1.2)
    c.group(1); c.box(5,12,6,1,2,'stone')
    c.group(2); c.new()
    for y in range(7,12):
        for x in range(7,10): c.tone(x,y,'stone',5 if x==7 else 3)
    c.group(3); c.ellipsoid(8,6,6.5,2.6,'stone',amb=0.3,bias=0.05)
    c.new()
    for y in range(4,7):
        for x in range(3,14):
            if ((x+0.5-8)/4.6)**2+((y+0.5-5.2)/1.3)**2<=1: c.tone(x,y,'teal',4 if y>4 else 5)
    c.group(4); c.new()                                                          # little bird on the rim
    c.tone(12,3,'wood',4); c.tone(13,3,'wood',3); c.tone(12,2,'wood',5); c.tone(11,2,'gold',5); c.tone(14,4,'wood',2)
    return c

# 20 wooden lantern post ------------------------------------------------------
def lanternpost():
    c=C(16,32,seed=419); c.shadow(6,29.6,4.5,1.2)
    c.group(1); c.box(1,26,8,1,3,'stone')
    c.group(2); post(c,4,3,26)
    c.group(3); c.new()
    for x in range(4,14): c.tone(x,5,'wood',4); c.tone(x,6,'wood',2)
    c.line(6,9,9,6,'wood',3)                                                     # brace
    c.group(4); c.new(); c.tone(12,7,'iron',3)
    c.new()
    for y in range(8,15):
        for x in range(10,15):
            t=6 if (11<=x<=13 and 10<=y<=13) else None
            c.tone(x,y,'fire',t) if t else c.tone(x,y,'wood',4 if x<12 else 2)
    c.tone(12,11,'fire',6); c.tone(12,12,'fire',5)
    c.poly([(9,8),(12,6),(15,8)],'wood',lambda x,y:0.9 if x<12 else 0.5)
    c.spark=[(9,11),(15,12)]
    return c

# 21 bucket and broom -----------------------------------------------------------
def bucketbroom():
    c=C(16,16,seed=420); c.shadow(8,14.6,7,1.2)
    c.group(1); c.new()
    for y in range(0,10): c.tone(11,y,'wood',5); c.tone(12,y,'wood',3)
    c.new()
    for y in range(9,15):
        w=1+(y-9)//2
        for x in range(12-w-1,12+w+1): c.tone(x,y,'rope',5 if x<11 else (4 if x<13 else 3))
    for x in range(10,14): c.tone(x,10,'wood',2)
    c.group(2); c.cylinder(5,8,13,3.6,'wood',capry=1.4)
    hoops(c,(10,13),1,10,5)
    c.new()
    for x in range(3,8): c.tone(x,8,'teal',4)
    c.tone(4,8,'teal',5)
    return c

# 22 stone urn planter ----------------------------------------------------------
def urn():
    c=C(16,16,seed=421); c.shadow(8,14.6,5.5,1.2)
    c.group(1); c.box(5,12,6,1,2,'stone')
    c.group(2); c.ellipsoid(8,9,4.5,3.2,'stone',amb=0.3,clip=lambda x,y:y>=7)
    c.box(3,6,10,1,1,'stone',bias=0.05)
    c.group(3)
    for (x,y,rx) in ((5,4,2.6),(10.5,4,2.6),(8,2.5,2.8)): c.ellipsoid(x,y,rx,2.3,'leaf',amb=0.3,bias=0.05)
    c.new()
    for (x,y,m) in ((4,3,'red'),(8,1,'pink'),(11,3,'red'),(7,4,'gold'),(10,2,'cream')): c.tone(x,y,m,5); c.tone(x+1,y,m,4)
    return c

# 23 milestone -----------------------------------------------------------------
def oven():
    c=C(32,32,seed=422); c.shadow(16,29.6,15,1.8)
    c.group(1); c.box(2,20,28,2,7,'stone',front=0.6)
    for y in (23,26):
        for x in range(2,30): c.darken(x,y,1)
    for x in range(2,30,5):
        for y in range(22,27): c.darken(x+(y//3)%2*2,y,1)
    c.group(2); c.ellipsoid(16,15,11.5,9,'clay',amb=0.3,bias=0.05,clip=lambda x,y:y<21)
    c.new()
    for y in range(12,21):
        for x in range(11,22):
            if ((x+0.5-16)/4.6)**2+((y+0.5-20)/7.2)**2<=1: c.tone(x,y,'dark',1)
    for (x,y,t) in ((14,19,5),(15,19,6),(16,19,5),(17,19,4),(13,20,4),(16,18,4),(18,20,3)): c.tone(x,y,'fire',t)
    c.group(3); c.box(14,5,5,1,2,'clay',bias=-0.05); c.tone(15,5,'dark',1); c.tone(16,5,'dark',1)
    c.group(4); c.hcyl(22,29,18.5,1.4,'bark',endcap='L'); c.hcyl(23,30,16.5,1.4,'bark',endcap='L')
    return c

# 24 spare wheels -----------------------------------------------------------------
def wheels():
    c=C(32,16,seed=423); c.shadow(15,14.6,13,1.2)
    c.group(1); c.box(18,7,12,1,6,'wood',bias=-0.05)                             # low crate behind
    for y in range(8,14): c.tone(24,y,'wood',2)
    wheel(c,9,8,6.5,2); wheel(c,19,9,5.5,3)
    return c

for n,f,fp,note in [
 ('생선 건조대',fishrack,'2×2','말린 생선을 두 단에 건 나무 틀 — 부두·어시장'),
 ('항아리 좌판',pottery,'2×1','질그릇 셋(큰 항아리·단지·흰 물병) — 도기 가게 앞'),
 ('과일 바구니',fruit,'2×1','사과·배 바구니 둘 — 노점 앞·창고'),
 ('옷감 두루마리',bolts,'2×1','상자에 세운 옷감 다섯 필 — 포목점'),
 ('돌 벤치',stonebench,'2×1','돌다리 둘 + 판석 — 광장 가장자리'),
 ('손수레',handcart,'2×2','바퀴 하나·손잡이 둘, 자루와 상자 실음'),
 ('외바퀴 수레',wheelbarrow,'2×1','흙을 실은 외바퀴 수레 — 밭·공사장'),
 ('술통 받침대',barrelrack,'2×2','마구리가 보이게 눕힌 술통 셋 + 꼭지 — 주점 뒤'),
 ('도끼 박힌 모탕',chopblock,'1×1','모탕 + 도끼 + 쪼갠 장작'),
 ('시장 저울',scale,'1×2','놋쇠 접시 두 개 매단 천칭 — 시장 한가운데'),
 ('흉상 받침대',bust,'1×2','월계관 흉상 + 놋쇠 명판 — 광장·관청 앞'),
 ('종 기둥',bellpost,'1×2','지붕 달린 종틀 + 당김줄 — 광장·성당 앞'),
 ('개집',kennel,'1×1','박공 지붕 개집 + 밥그릇'),
 ('손 펌프',pump,'1×2','돌 받침 쇠 펌프 + 양동이 — 우물 대신'),
 ('숫돌',grindstone,'1×1','틀에 건 둥근 숫돌 + 손잡이 — 대장간'),
 ('과녁',target,'1×2','짚 과녁 + 화살 — 경비대 훈련장'),
 ('말 매는 난간',hitching,'2×1','난간 + 쇠고리 + 물 양동이 — 여관 앞'),
 ('형틀',stocks,'2×1','구멍 셋 뚫린 칼판 — 광장 구석'),
 ('새 물확',birdbath,'1×1','돌 받침 물확 + 참새 — 정원'),
 ('나무 등롱 기둥',lanternpost,'1×2','팔에 등롱을 매단 나무 기둥 — 골목'),
 ('양동이와 빗자루',bucketbroom,'1×1','물 양동이 + 세워 둔 싸리비 — 가게 문 옆'),
 ('돌 화분',urn,'1×1','돌 항아리 화분 + 꽃 — 집 앞·광장'),
 ('빵 화덕',oven,'2×2','돌 받침 위 흙 가마 + 불씨 + 장작 — 빵집 뒤·광장'),
 ('여분 바퀴',wheels,'2×1','수레바퀴 둘 + 낮은 상자 — 수레방 앞'),
]:
    P[n]=(f,fp,note)

# batch 6c: village life props (fixed front-above view, chipset texture)
import sys, math; sys.path.insert(0,__import__('os').path.dirname(__import__('os').path.abspath(__file__)))
from px2 import C, vnoise, _hash, PAL, GRAIN
import pg
P={}; WATER=set()

def _crate(c,x,y,w=12,d=3,h=10,g=1):
    c.group(g); c.box(x,y,w,d,h,'wood')
    for yy in range(y+d,y+d+h):
        c.tone(x,yy,'wood',2); c.tone(x+w-1,yy,'wood',1)
        if (yy-y-d)%4==3: 
            for xx in range(x+1,x+w-1): c.darken(xx,yy,1)
    for xx in range(x,x+w): c.tone(xx,y+d,'wood',2); c.tone(xx,y+d+h-1,'wood',1)
    for j in range(h-2):
        xx=x+1+round(j*(w-3)/(h-3)); c.tone(xx,y+d+1+j,'wood',5); c.tone(xx+1,y+d+1+j,'wood',3)
    for xx in range(x,x+w): c.tone(xx,y,'wood',6)

def crate():
    c=C(16,16,seed=170); c.shadow(8,14.6,7,1.3); _crate(c,2,2); return c
def crates():
    c=C(32,32,seed=171); c.shadow(16,29.6,15,2)
    _crate(c,1,15,14,3,11,1); _crate(c,16,15,14,3,11,2); _crate(c,8,3,14,3,11,3)
    return c

def sack(c,cx,cy,g,bias=0.0):
    # burlap grain sack: tall body, tied neck with a flared top
    c.group(g); c.new()
    for y in range(int(cy-4),int(cy+6)):
        for x in range(int(cx-6),int(cx+7)):
            f=(y-(cy-4))/10; hw=3+2.2*math.sin(min(1,f*1.25)*math.pi/2)
            dx=(x+0.5-cx)/hw
            if abs(dx)<=1: c.setv(x,y,'cream',c.shade(dx,0.2,math.sqrt(1-dx*dx),0.3)+bias-0.12)
    for x in range(int(cx)-1,int(cx)+2): c.tone(x,int(cy-5),'rope',2)
    for (dx,t) in ((-2,4),(-1,3),(0,4),(1,2),(2,2)): c.tone(int(cx)+dx,int(cy-6),'cream',t)
    c.tone(int(cx)-1,int(cy-7),'cream',3); c.tone(int(cx)+1,int(cy-7),'cream',2)
    for y in range(int(cy-1),int(cy+4),3): c.tone(int(cx)+1,y,'cream',2)
def sacks():
    c=C(16,16,seed=172); c.shadow(8,14.6,7.5,1.4)
    sack(c,5,8,1,0.05); sack(c,11,8.5,2,-0.1); return c

def woodpile():
    # split logs stacked with their cut ends toward the viewer, a pyramid 3-2-1 per bay
    c=C(32,16,seed=173); c.shadow(16,14.6,15,1.4)
    k=0
    for row,(n,y) in enumerate(((5,11),(4,7),(3,3.5))):
        for i in range(n):
            x=4+i*6+row*3; k+=1; c.group(k); c.new()
            for yy in range(int(y-3),int(y+4)):
                for xx in range(int(x-3),int(x+4)):
                    r=math.hypot(xx+0.5-x,yy+0.5-y)
                    if r<=3.1: c.tone(xx,yy,'bark' if r>2.2 else 'wood',2 if r>2.2 else (3 if r<0.9 else (5 if (r*2)%2<1 else 4)))
    return c

def bench():
    c=C(32,16,seed=174); c.shadow(16,14.6,14,1.4)
    c.group(1); c.box(3,1,26,2,3,'wood',bias=0.05)                                     # backrest
    for x in (4,27):
        c.new()
        for y in range(4,8): c.tone(x,y,'bark',4); c.tone(x+1,y,'bark',2)
    c.group(2); c.box(2,7,28,3,2,'wood')                                              # seat
    for x in range(2,30): c.tone(x,8,'wood',4) if x%7 else None
    c.group(3)
    for x in (4,26):
        c.new()
        for y in range(12,15): c.tone(x,y,'bark',4); c.tone(x+1,y,'bark',2)
    return c

def planter():
    c=C(16,16,seed=175); c.shadow(8,14.6,7,1.2)
    c.group(1); c.box(2,8,12,2,5,'wood')
    for y in range(10,15): c.tone(2,y,'wood',2); c.tone(13,y,'wood',1)
    c.group(2); c.new()
    for (x,y) in ((3,7),(5,6),(7,7),(9,6),(11,7),(12,6),(4,5),(10,5)): c.tone(x,y,'leaf',3); c.tone(x,y+1,'leaf',2)
    for (x,y,m) in ((4,4,'red'),(7,3,'gold'),(10,4,'pink'),(12,5,'red'),(6,5,'pink'),(9,2,'red')):
        c.tone(x,y,m,5); c.tone(x+1,y,m,4); c.tone(x,y+1,m,3); c.tone(x+1,y+1,m,3); c.tone(x,y,m,6) if m=='gold' else None
    return c

def trough():
    c=C(32,16,seed=176); c.shadow(16,14.6,14,1.3)
    c.group(1); c.box(2,4,28,4,7,'wood')
    for y in range(8,15): c.tone(2,y,'wood',2); c.tone(29,y,'wood',1)
    for x in range(3,29): c.tone(x,11,'wood',3)
    c.new()
    for y in range(5,8):
        for x in range(4,28): c.tone(x,y,'teal',2 if y==5 else 3)
    for x in range(8,14): c.tone(x,6,'teal',5)
    for x in (8,23):
        c.group(2); c.new()
        for y in range(13,16): c.tone(x,y,'bark',3)
    return c

def noticeboard():
    c=C(32,32,seed=177); c.shadow(16,29.6,12,1.6)
    c.group(1)
    for x in (4,26):
        c.new()
        for y in range(6,30): c.tone(x,y,'bark',5); c.tone(x+1,y,'bark',3)
    c.group(2); c.box(3,8,26,0,15,'wood',front=0.5)
    for x in range(3,29): c.tone(x,8,'wood',5); c.tone(x,22,'wood',2)
    c.group(3)
    for (x,y,w,h) in ((6,11,6,7),(14,10,5,5),(21,12,6,6),(15,16,5,5)):
        c.new()
        for yy in range(y,y+h):
            for xx in range(x,x+w): c.tone(xx,yy,'cream',6 if yy==y else 5)
        for xx in range(x+1,x+w-1,1):
            for yy in range(y+2,y+h-1,2): c.tone(xx,yy,'cream',3) if (xx+yy)%3 else None
        c.tone(x+w//2,y,'red',4)
    c.group(4); c.poly([(1,7),(16,2),(31,7),(29,9),(3,9)],'wood',lambda x,y:0.95 if x<16 else 0.6)   # little roof
    return c

def haystack():
    # dome of straw ('rope' tan, not gold), vertical straw strokes, rougher skirt, a pitchfork stuck in it
    c=C(32,32,seed=178); c.shadow(16,29.6,15,2)
    c.group(1); c.ellipsoid(16,17,13,12,'rope',amb=0.3,bump=0.35,bsc=2.5)
    c.ellipsoid(16,25,15,5,'rope',amb=0.3,bump=0.5,bias=-0.14)
    for i in range(70):
        x=int(3+_hash(i,1,178)*26); y=int(6+_hash(i,2,178)*22)
        if c.m[y][x]=='rope' and c.m[min(31,y+2)][x]=='rope':
            t=5 if x<14 else (4 if x<20 else 3)
            c.tone(x,y,'rope',t); c.tone(x,y+1,'rope',t-1); c.tone(x,y+2,'rope',max(1,t-3))
    for x in range(2,31):
        if c.m[28][x] and x%2: c.tone(x,29,'rope',2)
    c.group(2); c.line(23,2,21,12,'bark',4); c.line(24,2,22,12,'bark',2)
    for (x,y) in ((22,1),(24,0),(26,1)): c.tone(x,y,'iron',5); c.tone(x,y+1,'iron',3)
    for x in range(22,27): c.tone(x,2,'iron',4)
    return c

def scarecrow():
    c=C(16,32,seed=179); c.shadow(8,29.6,4,1.2)
    c.group(1); c.new()
    for y in range(8,30): c.tone(7,y,'bark',4); c.tone(8,y,'bark',2)
    c.group(2); c.new()
    for x in range(1,15): c.tone(x,13,'bark',4); c.tone(x,14,'bark',2)
    c.group(3); c.box(4,12,8,0,9,'cloth',front=0.6)                                     # shirt
    for (x,y) in ((5,15),(6,15),(5,16),(6,16)): c.tone(x,y,'cryst',3)
    for x in range(4,12): c.tone(x,17,'rope',4)
    for (x,y) in ((0,12),(0,14),(15,12),(15,14),(1,15),(14,15)): c.tone(x,y,'gold',5)
    c.group(4); c.ellipsoid(8,8.5,3.4,3.4,'cream',amb=0.35)                              # sack head
    c.tone(7,8,'dark',1); c.tone(9,8,'dark',1)
    for x in (7,8,9): c.tone(x,10,'dark',2) if x!=8 else c.tone(x,10,'dark',1)
    c.group(5); c.ellipsoid(8,5,6.5,1.6,'gold',bias=0.05); c.ellipsoid(8,3,3.2,2.6,'gold',bias=0.15)   # straw hat
    for x in range(5,12): c.tone(x,4,'red',3)
    return c

def soil():
    # tileable ploughed furrows (lower floor): ridge lit, trench dark, 4px pitch
    c=C(16,16,seed=180); c.period=16; c.new()
    for y in range(16):
        for x in range(16):
            p=y%4; c.setv(x,y,'dirt',(0.8,0.6,0.32,0.5)[p])
    return c
# v7: ripe wheat in a khaki straw ramp (the chipset gold ramp's tone 5 is a saturated primary yellow: QA "원색 노랑 밀밭")
import px2 as _px2
_px2.PAL['wheat']=['#312210','#4a3a20','#6b5a30','#8a7844','#a69456','#c2b078','#ddd0a0']
def crop(kind):
    # overlays for the furrow tile: plants sit on the ridge rows (y%4==0)
    c=C(16,16,seed=181); c.period=16
    for ry in (1,5,9,13):
        if kind=='sprout':
            for rx in (3,11) if ry%8==1 else (7,15):
                c.new(); c.tone(rx,ry,'leaf',3); c.tone(rx-1,ry-1,'leaf',5); c.tone(rx+1,ry-1,'leaf',4); c.tone(rx-2,ry-2,'leaf',4); c.tone(rx+2,ry-2,'leaf',3)
        elif kind=='cabbage':
            for rx in (3,11) if ry%8==1 else (7,15):
                c.new(); c.ellipsoid(rx,ry-0.5,2.3,1.9,'leaf',bias=0.05)
                c.tone(rx-1,ry-1,'leaf',6); c.tone(rx,ry,'leaf',2)
        elif kind=='wheat':
            for rx in range(0,16):
                h=4+int(_hash(rx,ry,181)*3); c.new()
                for y in range(ry-h+2,ry+2): c.tone(rx,y%16,'wheat',2 if y>ry else (3 if rx%2 else 4))
                for k in range(3): c.tone(rx,(ry-h-k+2)%16,'wheat',(6,5,4)[k] if rx%2==0 else (5,4,3)[k])
    return c

def field(kind,w=4,h=3):
    from PIL import Image
    s_=soil().img(outline=False); o=Image.new('RGBA',(w*16,h*16))
    for x in range(w):
        for y in range(h):
            o.alpha_composite(s_,(x*16,y*16))
            if kind: o.alpha_composite(crop(kind).img(outline=(kind!='wheat')),(x*16,y*16))
    return o

class Pic:
    def __init__(s,im): s.im=im
    def img(s,outline=True): return s.im

P['나무 상자']=crate; P['상자 더미']=crates; P['곡식 자루']=sacks; P['장작더미']=woodpile; P['벤치']=bench
P['꽃 화분 상자']=planter; P['여물통']=trough; P['마을 게시판']=noticeboard; P['건초더미']=haystack; P['허수아비']=scarecrow
P['밭 이랑 4×3']=lambda: Pic(field(None)); P['밭: 새싹']=lambda: Pic(field('sprout')); P['밭: 양배추']=lambda: Pic(field('cabbage')); P['밭: 익은 밀']=lambda: Pic(field('wheat'))

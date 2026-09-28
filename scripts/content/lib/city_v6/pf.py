# batch 5: medieval / fantasy / FF6 / Chrono Trigger field objects (fixed front-above view, chipset texture)
import sys, math; sys.path.insert(0,__import__('os').path.dirname(__import__('os').path.abspath(__file__)))
from px2 import C, vnoise, _hash, PAL, GRAIN
from pe import masonry_ring
PAL.setdefault('emer',['#04201a','#0a4432','#12704a','#1ea060','#3cd07c','#8cf0a8','#e0ffe8']); GRAIN.setdefault('emer',(0.02,2))
P={}; WATER=set()
FLAME=["...x..","..xo..",".oxxo.",".oxxo.","fooxof",".ffff."]
FK={'x':('fire',6),'o':('fire',4),'f':('fire',3)}

def time_gate():
    # Chrono Trigger style time gate: a flat swirling vortex on the ground, bright core, sparks around
    c=C(32,32,seed=101); c.group(1); c.new()
    cx,cy,rx,ry=16,20,15,6.4
    for y in range(10,30):
        for x in range(0,32):
            dx=(x+0.5-cx)/rx; dy=(y+0.5-cy)/ry; r=math.sqrt(dx*dx+dy*dy)
            if r>1: continue
            th=math.atan2(dy,dx); band=((th/(2*math.pi))*3+r*2.6)%1
            t=2+int(band*3.2)+(1 if r<0.55 else 0)+(1 if r<0.28 else 0)
            if r>0.9: t=max(1,t-2)
            c.tone(x,y,'cryst',min(6,t))
    for (x,y) in ((14,20),(15,20),(16,20),(17,20),(15,19),(16,21)): c.tone(x,y,'cryst',6)
    c.spark=[(4,13),(28,12),(1,21),(30,25),(10,9),(23,8),(16,6)]
    return c
P['시공의 문']=time_gate

def magicite():
    # FF6 style magicite: green crystal cluster growing from a rock
    c=C(32,32,seed=102); c.shadow(16,29.6,13,2)
    c.group(1); c.ellipsoid(16,25,12,5,'stone',bump=0.5,bsc=3,amb=0.3)
    def prism(cx,t,b,w,tilt,g,dim=0):
        c.group(g); c.new()
        for y in range(t,b+1):
            off=(b-y)*tilt; cap=y<t+w*1.2; hw=w*min(1,(y-t+0.5)/(w*1.2)) if cap else w
            for x in range(int(cx+off-w)-1,int(cx+off+w)+2):
                u=(x+0.5-cx-off)/max(0.5,hw)
                if abs(u)>1: continue
                if cap: tt=6 if u<0 else 3
                else: tt=5 if u<-0.33 else (4 if u<0.33 else 2)
                c.tone(x,y,'emer',max(1,tt-dim))
    prism(9,12,25,2.6,-0.25,2,1); prism(23,10,25,2.8,0.22,3,1); prism(12,6,26,3.2,-0.08,4); prism(20,4,26,3.6,0.06,5); prism(16,14,27,2.4,0,6)
    c.spark=[(19,3),(11,5),(25,9),(6,12)]
    return c
P['마석 결정']=magicite

def knight():
    # guardian knight statue: few large parts with clear value steps (lit left, shaded right),
    # greatsword planted in front of the legs, darker cape behind, on a pedestal
    c=C(32,48,seed=103); c.shadow(16,46,15,1.8)
    L=lambda hi,lo: (lambda x,y: hi if x<16 else lo)
    c.group(1); c.box(3,38,26,3,5,'stone')
    c.new()
    for x in range(11,21): c.tone(x,42,'stone',2)
    c.group(2); c.poly([(10,13),(22,13),(26,38),(6,38)],'stone',L(0.34,0.22))                    # cape (dark)
    c.group(3); c.poly([(10,27),(15,27),(15,38),(10,38)],'stone',lambda x,y:0.8)                  # legs
    c.poly([(17,27),(22,27),(22,38),(17,38)],'stone',lambda x,y:0.5)
    c.group(4)                                                                                    # body: breastplate + tassets as one piece
    c.ellipsoid(16,18,6.5,6.5,'stone',amb=0.3)
    c.poly([(9,22),(23,22),(24,29),(8,29)],'stone',L(0.85,0.5))
    for x in range(9,24): c.tone(x,23,'stone',1)
    c.line(16,24,16,28,'stone',2)
    c.group(5); c.ellipsoid(9,14,3.6,3,'stone',bias=0.12); c.ellipsoid(23,14,3.6,3,'stone',bias=-0.1)   # pauldrons
    c.group(6); c.poly([(6,15),(9,15),(14,25),(11,26)],'stone',lambda x,y:0.8); c.poly([(23,15),(26,15),(21,26),(18,25)],'stone',lambda x,y:0.45)
    c.group(7); c.ellipsoid(16,8,4.6,5,'stone',amb=0.3,bias=0.08)                                 # great helm
    for x in range(13,20): c.tone(x,8,'dark',1)
    c.tone(16,9,'dark',2); c.tone(16,10,'dark',2)
    c.group(8); c.new()                                                                           # greatsword in front
    for y in range(29,38): c.tone(15,y,'iron',6); c.tone(16,y,'iron',3)
    c.tone(15,38,'iron',4)
    for x in range(11,21): c.tone(x,27,'gold',5 if x<16 else 3); c.tone(x,28,'gold',3 if x<16 else 2)
    for y in range(22,27): c.tone(15,y,'bark',4); c.tone(16,y,'bark',2)
    c.tone(15,21,'gold',6); c.tone(16,21,'gold',4)
    c.group(9); c.ellipsoid(16,25,3.4,2,'stone',bias=0.15)                                        # hands on the hilt
    c.group(10); c.poly([(15,0),(17,0),(18,4),(14,4)],'red',L(0.9,0.5))                           # red plume
    return c
P['기사 석상']=knight

def fountain(frame=0):
    # frame 0..3: the plume pulses, the falling sheets shimmer downward, ripple rings travel outward (4 fps loop)
    f=frame%4
    # village fountain: big round basin (water surface visible), short pedestal with ONE bowl, a jet and 2px-wide falling
    # water arcs into the basin, foam where they land. Chunky clusters, no 1px strands.
    c=C(48,48,seed=104); c.shadow(24,45.6,23,2)
    cx,cy,rx,ry=24,31,22,10
    c.group(1); c.new()                                                   # rim (top face of the basin wall)
    for y in range(cy-ry-1,cy+ry+2):
        for x in range(1,48):
            dx=(x+0.5-cx)/rx; dy=(y+0.5-cy)/ry; r=dx*dx+dy*dy
            if r<=1: c.setv(x,y,'stone',0.95-0.08*dy)
    c.group(2); c.new()                                                   # water surface with ripple rings
    for y in range(cy-ry+2,cy+ry-1):
        for x in range(4,45):
            dx=(x+0.5-cx)/(rx-3.5); dy=(y+0.5-cy+0.5)/(ry-2.8); r=math.sqrt(dx*dx+dy*dy)
            if r<=1:
                t=2 if dy<-0.45 else 3
                for r0 in (0.34+0.11*f,0.34+0.11*f+0.44):
                    rr=r0 if r0<=0.98 else r0-0.64
                    if rr<r<rr+0.1: t=4 if rr<0.8 else 3
                c.tone(x,y,'teal',t)
    # low front wall following the basin's front curve (5px), blocks 8 wide
    k=0
    for x in range(2,47):
        dx=(x+0.5-cx)/rx
        if abs(dx)>1: continue
        yt=int(cy+ry*math.sqrt(1-dx*dx))
        for j in range(6):
            y=yt+j; off=4 if j>=3 else 0
            v=c.shade(dx,0.1,math.sqrt(1-dx*dx),0.3)+(_hash((x+off)//8,j//3,104)-0.5)*0.15
            if j==2 or (x+off)%8==0: v-=0.3
            c.group(7); c.setv(x,y,'stone',v,oid=900)
        c.tone(x,yt-1,'stone',6) if c.m[yt-1][x]=='stone' else None
    c.group(3); c.cylinder(24,17,30,3.2,'stone',cap=False)               # pedestal
    c.group(4); c.new()                                                   # the bowl: underside then water top
    for y in range(15,21):
        for x in range(13,36):
            dx=(x+0.5-24)/9; dy=(y+0.5-15)/5
            if dx*dx+dy*dy<=1 and y>=15: c.setv(x,y,'stone',c.shade(dx,0.6,math.sqrt(max(0,1-dx*dx-dy*dy)),0.3))
    c.new()
    for y in range(12,17):
        for x in range(13,36):
            dx=(x+0.5-24)/9; dy=(y+0.5-14.5)/2.4
            if dx*dx+dy*dy<=1: c.tone(x,y,'stone',5) if dx*dx+dy*dy>0.55 else c.tone(x,y,'teal',3 if y>=14 else 2)
    c.group(5); c.cylinder(24,7,13,1.6,'stone',cap=True,capry=1)          # spout
    c.group(6); c.new()                                                   # spray plume over the spout
    PLUMES=[["..6.6..",".56565.","5666665",".56665.","..545..","...4..."],
            ["...6...",".6.6.6.",".56665.","5666665",".56565.","...4..."],
            [".6...6.","..656..",".56665.","5666665","..565..","...4..."],
            ["...6...","..6.6..",".56665.",".66666.","5656565","...4..."]]
    plume=PLUMES[f]
    for j,row in enumerate(plume):
        for i,ch in enumerate(row):
            if ch!='.': c.tone(21+i,1+j,'teal',int(ch))
    for s in (-1,1):                                                      # short sheets falling from the bowl rim
        for y in range(17,24):
            hi=(y-17-2*f)%7 in (0,1)                                          # a bright band slides down the sheet
            c.tone(24+s*9,y,'teal',6 if hi else 5); c.tone(24+s*10,y,'teal',5 if hi else 4)
        foam=((0,0),(1,0),(-1,0),(0,-1)) if f%2==0 else ((0,0),(1,-1),(-1,-1),(2,0),(-2,0))
        for (dx,dy) in foam: c.tone(24+s*9+dx,24+dy,'teal',6)
    return c
P['광장 분수']=fountain

def lamppost():
    # iron street lamp (Narshe / Figaro), warm glass lantern
    c=C(16,32,seed=105); c.shadow(8,29.6,4.5,1.2)
    c.group(1); c.box(5,26,6,1,3,'iron'); c.box(6,24,4,1,2,'iron',bias=0.05)
    c.group(2); c.new()
    for y in range(10,24): c.tone(7,y,'iron',4); c.tone(8,y,'iron',2)
    for x in range(6,10): c.tone(x,18,'iron',5 if x<8 else 3)
    c.group(3); c.box(4,9,8,1,1,'iron',bias=0.1)
    c.group(4); c.new()
    for y in range(4,9):
        for x in range(5,11): c.tone(x,y,'gold',6 if (x in (7,8) and 5<=y<=7) else 5 if x<8 else 4)
    for y in range(4,9): c.tone(4,y,'iron',4); c.tone(11,y,'iron',2)
    for y in range(4,9): c.tone(7,y,'iron',3) if y in (4,8) else None
    c.group(5); c.poly([(8,0),(12,4),(3,4)],'iron',lambda x,y:0.9 if x<8 else 0.45)
    c.tone(7,0,'iron',5)
    c.spark=[(2,6),(13,5)]
    return c
P['철제 가로등']=lamppost

def shop_sign(kind):
    c=C(16,32,seed=106); c.shadow(4,29.6,4,1.2)
    c.group(1); c.new()
    for y in range(4,30): c.setv(3,y,'bark',0.9); c.setv(4,y,'bark',0.5)
    c.group(2); c.hcyl(3,15,5,1.2,'bark',bias=0.1)
    c.line(5,9,9,6,'bark',3)
    c.group(3); c.new()
    for y in (7,8): c.tone(7,y,'iron',4); c.tone(13,y,'iron',3)
    c.group(4); c.box(5,9,11,1,9,'wood')
    c.new()
    for x in range(5,16): c.tone(x,18,'wood',1)
    for y in range(10,18): c.tone(5,y,'wood',5); c.tone(15,y,'wood',2)
    ic={'weapon':(["...s...","..sS...","..sS...","..sS...",".ggggg.","...b...","...g..."],{'s':('iron',6),'S':('iron',3),'g':('gold',4),'b':('bark',3)}),
        'inn':   (["cccc...","ccccc..","gggg.g.","gggg..g","gggg.g.",".gg...."],{'c':('cream',6),'g':('gold',4)}),
        'item':  (["..r....",".rrr...","rrrrr..","rRrrr..",".rrr...","......."],{'r':('red',4),'R':('red',6)})}[kind]
    c.group(5); c.new(); c.lit(ic[0],7,10 if kind=='weapon' else 11,ic[1])
    if kind=='item':
        c.tone(8,10,'cream',5); c.tone(8,11,'cream',4)
    return c
P['상점 간판 (무기)']=lambda: shop_sign('weapon'); P['상점 간판 (여관)']=lambda: shop_sign('inn'); P['상점 간판 (도구)']=lambda: shop_sign('item')

def cart():
    # hay cart lying east-west: plank bed, load of hay and sacks, two spoked wheels, shafts
    c=C(48,32,seed=107); c.shadow(26,29.2,21,2)
    c.group(1); c.line(1,17,12,17,'bark',5); c.line(1,18,12,18,'bark',3)
    c.group(2); c.ellipsoid(25,11,14,6,'gold',bump=0.6,bsc=2,amb=0.35)                   # hay
    for x in range(12,39,2): c.tone(x,5+((x*7)%3),'gold',6) if c.m[5+((x*7)%3)][x] else None
    c.group(3); c.ellipsoid(33,10,4,3.6,'cream',bias=0.05); c.group(4); c.ellipsoid(17,11,3.6,3.2,'cream')
    c.tone(33,7,'rope',3); c.tone(17,8,'rope',3)
    c.group(5); c.box(9,13,34,2,7,'wood')
    for y in (17,20): 
        for x in range(9,43): c.darken(x,y,1)
    for x in (9,25,42):
        for y in range(15,22): c.tone(x,y,'wood',2)
    def wheel(cx,cy,r,g):
        c.group(g); c.new()
        for y in range(int(cy-r)-1,int(cy+r)+2):
            for x in range(int(cx-r)-1,int(cx+r)+2):
                d=math.hypot(x+0.5-cx,y+0.5-cy)
                if r-1.8<=d<=r: c.tone(x,y,'bark',5 if (x<cx and y<cy) else 3 if y<cy or x<cx else 2)
        for k in range(6):
            a=k*math.pi/3; c.line(cx,cy,cx+math.cos(a)*(r-1.5),cy+math.sin(a)*(r-1.5),'bark',4)
        c.new(); c.ellipsoid(cx,cy,1.6,1.6,'iron',bias=0.1)
    wheel(16,23,6.5,6); wheel(36,23,6.5,7)
    return c
P['건초 수레']=cart

def anvil():
    c=C(16,16,seed=108); c.shadow(8,14.4,6.5,1.4)
    c.group(1); c.cylinder(8,9,13,5,'bark',capry=1.8)
    c.new()
    for x in range(5,12): c.tone(x,9,'bark',5) if x%3 else c.tone(x,9,'bark',4)
    c.group(2); c.box(4,3,10,2,2,'iron'); c.poly([(0,4),(4,3),(4,7)],'iron',lambda x,y:0.85)
    c.group(3); c.box(6,7,6,0,2,'iron',front=0.45)
    c.group(4); c.box(5,9,8,0,1,'iron',front=0.6)
    return c
P['모루와 그루터기']=anvil

def barrels():
    c=C(32,32,seed=109); c.shadow(16,29.6,14,2)
    def barrel(cx,y0,y1,rx,g,bias=0.0):
        c.group(g); c.new(); mid=(y0+y1)/2; half=(y1-y0)/2
        for y in range(y0,y1+1):
            r=rx*(1-0.2*((y-mid)/half)**2)
            for x in range(int(cx-r)-1,int(cx+r)+2):
                dx=(x+0.5-cx)/r
                if abs(dx)>1: continue
                v=c.shade(dx,0.1,math.sqrt(1-dx*dx),0.3)+bias
                if int((x-cx+20)*1.0)%3==0: v-=0.12
                c.setv(x,y,'wood',v)
        for y in (y0+2,y1-2):
            for x in range(int(cx-rx)-1,int(cx+rx)+2):
                if c.m[y][x]=='wood': c.tone(x,y,'iron',4 if x<cx else 2)
        c.new()
        for y in range(y0-3,y0+2):
            for x in range(int(cx-rx)-1,int(cx+rx)+2):
                dx=(x+0.5-cx)/(rx*0.9); dy=(y+0.5-y0+0.5)/1.5
                if dx*dx+dy*dy<=1: c.tone(x,y,'wood',5 if dx*dx+dy*dy<0.45 else 4)
    barrel(9,19,28,7,1,-0.06); barrel(23,19,28,7,2,-0.13); barrel(16,9,18,6.8,3,-0.03)
    return c
P['술통 더미']=barrels

def cauldron():
    c=C(16,16,seed=110); c.shadow(8,14.5,6.5,1.3)
    c.group(1); c.new(); c.lit(FLAME,5,9,FK)
    c.group(2)
    for x in (3,12): c.new(); c.tone(x,12,'iron',3); c.tone(x,13,'iron',2)
    c.group(3); c.ellipsoid(8,8.5,6.2,4.2,'iron',amb=0.3)
    c.group(4); c.new()
    for y in range(3,8):
        for x in range(1,16):
            dx=(x+0.5-8)/6.6; dy=(y+0.5-5.2)/1.9
            if dx*dx+dy*dy<=1: c.tone(x,y,'iron',5 if dx*dx+dy*dy>0.55 else ('emer',)[0] and 3)
    for y in range(4,7):
        for x in range(3,14):
            dx=(x+0.5-8)/4.8; dy=(y+0.5-5.2)/1.2
            if dx*dx+dy*dy<=1: c.tone(x,y,'emer',4 if (x+y)%3 else 5)
    c.tone(6,4,'emer',6); c.tone(10,5,'emer',6); c.tone(8,2,'emer',5); c.tone(9,1,'emer',4)
    c.spark=[(4,1)]
    return c
P['마녀 가마솥']=cauldron

def weapon_rack():
    c=C(32,32,seed=111); c.shadow(16,29.6,14,1.8)
    c.group(1)
    for x in (3,27):
        c.new()
        for y in range(6,29): c.setv(x,y,'wood',0.9); c.setv(x+1,y,'wood',0.5)
    c.group(2); c.hcyl(3,29,8,1.2,'wood',bias=0.1)
    def sword(x,g):
        c.group(g); c.new()
        for y in range(9,26): c.tone(x,y,'iron',6); c.tone(x+1,y,'iron',3)
        c.tone(x,26,'iron',4)
        for xx in range(x-2,x+4): c.tone(xx,8,'gold',4 if xx<=x else 3)
        for y in range(5,8): c.tone(x,y,'bark',4); c.tone(x+1,y,'bark',2)
        c.tone(x,4,'gold',5); c.tone(x+1,4,'gold',3)
    sword(8,3)
    c.group(4); c.new()
    for y in range(4,28): c.tone(14,y,'wood',6); c.tone(15,y,'wood',4)
    c.lit([".s.","sSs","sSs",".s."],13,0,{'s':('iron',3),'S':('iron',6)})
    sword(21,6)
    c.group(7); c.ellipsoid(10,23,5,5,'red',amb=0.3)
    c.new()
    for y in range(18,29): c.tone(10,y,'gold',4) if c.m[y][10]=='red' else None
    for x in range(5,16): c.tone(x,23,'gold',4) if c.m[23][x]=='red' else None
    c.group(8); c.ellipsoid(10,23,1.4,1.4,'gold',bias=0.2)
    return c
P['무기 거치대']=weapon_rack

def banner_pole():
    c=C(16,48,seed=112); c.shadow(8,45.6,6,1.6)
    c.group(1); c.box(3,40,10,2,4,'stone')
    c.group(2); c.new()
    for y in range(4,41): c.tone(7,y,'iron',4); c.tone(8,y,'iron',2)
    c.lit(["..g..",".gGg.","..g.."],5,1,{'g':('gold',3),'G':('gold',6)})
    c.group(3); c.hcyl(2,14,6,0.9,'gold',bias=0.1)
    c.group(4); c.new()
    for y in range(7,32):
        for x in range(3,13):
            cut=y>=27 and abs(x+0.5-8)<(y-26)*1.1
            if cut: continue
            v=0.72+0.22*math.sin((x-3)*0.9)-0.1*(y-7)/25
            c.setv(x,y,'red',v)
    for y in range(7,28): c.tone(3,y,'gold',4); c.tone(12,y,'gold',3)
    c.lit(["..g..",".gGg.","gGGGg",".gGg.","..g.."],6,13,{'g':('gold',3),'G':('gold',5)})
    return c
P['깃발 기둥']=banner_pole

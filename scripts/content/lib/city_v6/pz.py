# city props for 버들항 (v4). Fixed front-above view, chipset palette (palette.apply() first), px2 grain; rendered with an
# INSET soft outline (fin()). v4: contact shadows are light (chipset props carry almost none); unreadable v3 props
# (rope coil, trap pile, buoys, horseshoe board, chain bollards, mask fountain, tarp pile, oar rack, poster column,
# gazebo) were dropped after the adversarial QA.
import sys, math, os; sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from PIL import Image
import px2
from px2 import C, vnoise, _hash, PAL, GRAIN
import ph
_shadow=C.shadow
def _light_shadow(s,cx,cy,rx,ry,a=100): _shadow(s,cx,cy,rx*0.8,ry*0.8,a=min(a,42))
C.shadow=_light_shadow
P={}      # name -> (fn, cells note, where)
CHIPSET='/home/main/.t3/worktrees/rpg-zzu/t3code-8b4b09de/public/assets/atlas-biomes/jungle-chipset.png'
_CH=[None]
def chip(x,y,w,h):
    if _CH[0] is None: _CH[0]=Image.open(CHIPSET).convert('RGBA')
    return _CH[0].crop((x,y,x+w,y+h))

def fin(c,k=0.62):
    if isinstance(c,Image.Image): A=c; B=c
    else: A=c.img(True); B=c.img(False)
    a=A.load(); b=B.load(); W,H=B.size; o=Image.new('RGBA',(W,H)); p=o.load()
    for y in range(H):
        for x in range(W):
            if b[x,y][3]==255: p[x,y]=a[x,y]
            elif b[x,y][3]: p[x,y]=b[x,y]
    edge=[]
    for y in range(H):
        for x in range(W):
            if p[x,y][3]<200: continue
            for dx,dy in ((0,1),(1,0),(-1,0),(0,-1)):
                xx,yy=x+dx,y+dy
                if not (0<=xx<W and 0<=yy<H) or p[xx,yy][3]<200: edge.append((x,y)); break
    for x,y in edge:
        r,g,bb,al=p[x,y]; p[x,y]=(int(r*k),int(g*k),min(255,int(bb*k*1.1)),al)
    return o

def post(c,x,y0,y1,mat='bark',t=(5,2)):
    c.new()
    for y in range(y0,y1+1): c.tone(x,y,mat,t[0]); c.tone(x+1,y,mat,t[1])
def lantern(c,cx,y,g,glow=6):
    c.group(g); c.new(); c.tone(cx,y,'iron',3); c.tone(cx-1,y+1,'iron',4); c.tone(cx,y+1,'iron',4); c.tone(cx+1,y+1,'iron',2)
    c.new()
    for yy in range(y+2,y+7):
        for xx in range(cx-2,cx+3):
            if xx in (cx-2,cx+2): c.tone(xx,yy,'iron',4 if xx<cx else 2)
            else: c.tone(xx,yy,'fire',glow if (xx<=cx and yy<y+5) else max(3,glow-2))
    for xx in range(cx-2,cx+3): c.tone(xx,y+7,'iron',3)
def disc_top(c,cx,cy,rx,ry,mat,tone_f):
    c.new()
    for y in range(int(cy-ry)-1,int(cy+ry)+2):
        for x in range(int(cx-rx)-1,int(cx+rx)+2):
            dx=(x+0.5-cx)/rx; dy=(y+0.5-cy)/ry; r=dx*dx+dy*dy
            if r<=1: c.tone(x,y,mat,tone_f(dx,dy,r))
def flowers(c,pts,g):
    c.group(g); c.new()
    for (x,y) in pts:
        for dx,dy in ((0,0),(1,0),(0,1),(-1,1),(1,1),(0,2)): c.tone(x+dx,y+dy,'leaf',3 if dx<=0 else 2)
    c.new()
    cols=['red','gold','pink','cream','red','slate']
    for i,(x,y) in enumerate(pts):
        m=cols[i%len(cols)]; c.tone(x,y-1,m,5); c.tone(x+1,y-1,m,4); c.tone(x,y,m,4)
        if m=='gold': c.tone(x,y-1,m,6)

# ============================ STREET ============================
def lamp_double():
    c=C(32,48,seed=901); c.shadow(16,45.6,6,1.3)
    c.group(1); c.box(12,40,8,2,4,'stone'); c.box(13,37,6,1,3,'stone',bias=0.05)
    c.group(2); c.new()
    for y in range(9,37): c.tone(15,y,'iron',4); c.tone(16,y,'iron',2)
    for y in (20,30): c.tone(15,y,'iron',5); c.tone(16,y,'iron',3)
    c.group(3); c.new()
    for x in range(5,27): c.tone(x,9,'iron',4 if x<16 else 3); c.tone(x,10,'iron',2)
    c.line(8,11,13,15,'iron',3); c.line(23,11,18,15,'iron',2)
    c.tone(15,7,'iron',5); c.tone(16,7,'iron',3); c.tone(15,6,'gold',5); c.tone(16,6,'gold',4)
    for cx,g in ((6,4),(25,5)): lantern(c,cx,11,g)
    return c
P['쌍등 가로등']=(lamp_double,'2×3','광장 모서리')

def lamp_crook():
    c=C(16,48,seed=902); c.shadow(6,45.6,4,1.2)
    c.group(1); c.box(2,41,8,2,3,'stone')
    c.group(2); c.new()
    for y in range(8,41): c.tone(5,y,'iron',4); c.tone(6,y,'iron',2)
    for (x,y) in ((5,7),(6,6),(7,5),(8,5),(9,5),(10,6),(11,7),(11,8)): c.tone(x,y,'iron',4); c.tone(x,y+1,'iron',2) if y<7 else None
    for y in (15,16): c.tone(4,y,'iron',3); c.tone(7,y,'iron',3)
    lantern(c,11,9,3)
    return c
P['목 굽은 가로등']=(lamp_crook,'1×3','큰길·산책로 (9칸 간격)')

def bench_park():
    # wooden slat bench on iron legs; the seat reads as boards seen from above, the backrest as a board on posts
    c=C(32,16,seed=903)
    c.group(1); c.new()
    for x in range(4,28):
        c.tone(x,1,'wood',5); c.tone(x,2,'wood',4); c.tone(x,3,'wood',2)
    for x in (5,26):
        c.new()
        for y in range(4,7): c.tone(x,y,'iron',3); c.tone(x+1,y,'iron',2)
    c.group(2); c.new()
    for x in range(3,29):
        c.tone(x,7,'wood',6 if x%9 else 4); c.tone(x,8,'wood',5); c.tone(x,9,'wood',4); c.tone(x,10,'wood',2)
    c.group(3)
    for x in (4,26):
        c.new()
        for y in range(11,15): c.tone(x,y,'iron',4); c.tone(x+1,y,'iron',2)
    return c
P['나무 벤치']=(bench_park,'2×1','광장 가장자리·공원')

def table_mugs():
    c=C(32,32,seed=904); c.shadow(16,28.6,15,2)
    c.group(1); c.box(1,5,30,2,3,'wood',bias=-0.05)
    for x in (3,27): c.new(); [c.tone(x,y,'bark',3) for y in range(10,12)]
    c.group(2); c.box(2,12,28,6,4,'wood',bias=0.05)
    for x in range(2,30):
        if x%7==1:
            for y in range(12,18): c.tone(x,y,'wood',3)
    for x in (4,26): c.new(); [c.tone(x,y,'bark',3) for y in range(22,25)]
    c.group(3)
    for x in (7,14,22):
        c.new()
        for y in range(12,16): c.tone(x,y,'wood',4 if y<15 else 2); c.tone(x+1,y,'wood',3); c.tone(x+2,y,'wood',2)
        c.tone(x,12,'cream',6); c.tone(x+1,12,'cream',6); c.tone(x+2,12,'cream',5); c.tone(x+3,13,'wood',2); c.tone(x+3,14,'wood',2)
    c.new(); c.ellipsoid(18,15,2.5,1.4,'clay',bias=0.1)
    c.group(4); c.box(1,24,30,2,3,'wood')
    for x in (3,27): c.new(); [c.tone(x,y,'bark',3) for y in range(29,31)]
    return c
P['주막 탁자']=(table_mugs,'2×2','여관 앞')

def parasol_table():
    c=C(32,32,seed=905); c.shadow(16,29.6,11,1.6)
    c.group(1); c.cylinder(16,19,25,7,'wood',capry=2.4)
    c.new()
    for y in range(26,30): c.tone(12,y,'bark',3); c.tone(20,y,'bark',2)
    c.group(2); c.new()
    for y in range(8,21): c.tone(15,y,'wood',4); c.tone(16,y,'wood',2)
    c.group(3); c.new()
    for y in range(0,10):
        hw=2+y*1.55
        for x in range(int(16-hw),int(16+hw)+1):
            seg=int((x-16)/3.2+10)%2; m='red' if seg else 'cream'
            t=5 if x<16 else 4
            if y>=8: t-=2
            c.tone(x,y,m,max(1,t))
    c.tone(16,0,'wood',4)
    return c
P['파라솔 탁자']=(parasol_table,'2×2','빵집·여관 앞')

def statue_sage():
    c=C(32,64,seed=907); c.shadow(16,61.6,15,2)
    c.group(1); c.box(4,46,24,3,12,'stone',front=0.6)
    for x in range(4,28): c.tone(x,49,'stone',5); c.tone(x,57,'stone',2)
    c.new()
    for x in range(9,23):
        for y in range(51,55): c.tone(x,y,'stone',3 if (x+y)%3 else 2)
    c.group(2); c.box(7,42,18,3,2,'stone',bias=0.08)
    c.group(3)
    def rw(y):
        if y<24: return 3+(y-19)*1.4
        if y<31: return 7-(y-24)*0.25
        return 5.3+(y-31)*0.42
    c.new()
    for y in range(19,44):
        w=rw(y)
        for x in range(int(15-w),int(15+w)+1):
            u=(x+0.5-15)/w; t=5 if u<-0.35 else (4 if u<0.25 else 2)
            if y>=31 and (x-15)%4==0: t-=1
            c.tone(x,y,'stone',max(1,t))
    for x in range(11,20): c.tone(x,30,'gold',4 if x<15 else 3)
    c.group(4); c.ellipsoid(15,16,3.4,3.8,'stone',amb=0.35,bias=0.05)
    c.new(); c.tone(14,17,'stone',2); c.tone(16,17,'stone',2); c.tone(15,19,'stone',3)
    c.group(5); c.new()
    for x in range(18,24): c.tone(x,26+(x-18)//3,'stone',4); c.tone(x,27+(x-18)//3,'stone',2)
    c.group(6); c.new()
    for y in range(9,44): c.tone(24,y,'wood',4); c.tone(25,y,'wood',2)
    c.ellipsoid(24.5,7,2.6,2.6,'gold',amb=0.3,bias=0.1)
    c.spark=[(23,5)]
    return c
P['현자 석상']=(statue_sage,'2×4','언덕 광장')

def column_monument():
    c=C(16,64,seed=908); c.shadow(8,61.6,7.5,1.6)
    c.group(1); c.box(0,52,16,3,7,'stone')
    c.group(2); c.box(2,48,12,2,3,'stone',bias=0.06)
    c.group(3); c.new()
    for y in range(14,48):
        for x in range(4,12):
            dx=(x+0.5-8)/4; t=5 if dx<-0.4 else (4 if dx<0.3 else 2)
            if x in (6,9): t-=1
            c.tone(x,y,'stone',t)
    c.group(4); c.box(2,10,12,2,3,'stone',bias=0.1)
    c.group(5); c.ellipsoid(8,6,3.4,3.4,'gold',amb=0.3,bias=0.1)
    c.new(); [c.tone(x,50,'gold',4) for x in range(3,13)]
    return c
P['기념 원주']=(column_monument,'1×4','성 앞마당')

def fountain_small(frame=0):
    c=C(32,32,seed=909); c.shadow(16,29.6,15,2)
    c.group(1); c.cylinder(16,17,24,14,'stone',capry=5.5,bias=-0.05)
    disc_top(c,16,17,11.5,4.2,'teal',lambda dx,dy,r: 2 if dy<-0.3 else (3 if r>0.55 else 4))
    for i,(x,y) in enumerate([(9,17),(22,18),(13,19),(19,16)]):
        if (i+frame)%2==0: c.tone(x,y,'teal',5); c.tone(x+1,y,'teal',5)
    c.group(2); c.cylinder(16,11,17,2,'stone',capry=1)
    c.group(3); c.new()
    top=3+(frame%4 in (1,2))
    for y in range(top,11): c.tone(15,y,'teal',6); c.tone(16,y,'teal',5)
    for (dx,dy) in ((-2,1),(2,1),(-3,3),(3,3),(-1,0),(1,0)):
        if (dx+frame)%2==0 or abs(dx)<2: c.tone(15+dx,top+dy,'teal',6); c.tone(16+dx,top+dy,'teal',5)
    return c
P['작은 분수']=(fountain_small,'2×2','골목 광장 (움직임 4장)')

def fish_pool(frame=0):
    c=C(48,32,seed=910); c.shadow(24,29.6,23,2)
    c.group(1); c.box(1,8,46,15,7,'stone',front=0.58)
    c.new()
    for y in range(10,22):
        for x in range(3,45): c.tone(x,y,'teal',2 if y<12 else 3)
    for (x,y) in ((8,15),(15,19),(33,16),(40,19),(11,20),(37,13)):
        if (x+frame)%3: c.tone(x,y,'teal',5); c.tone(x+1,y,'teal',5)
    c.group(2); c.new()
    c.box(21,13,6,2,3,'stone',bias=0.05)
    c.poly([(20,11),(24,4),(28,11),(24,13)],'teal',lambda x,y:0.9 if x<24 else 0.55)
    c.tone(22,8,'dark',1); c.tone(24,3,'teal',5); c.tone(25,2,'teal',5)
    c.group(3); c.new()
    arc=[(26,2),(28,1),(30,1),(32,2),(33,4),(34,6),(35,8),(35,10)] if frame%2==0 else [(26,2),(28,1),(30,2),(32,3),(33,5),(34,7),(35,9),(36,11)]
    for x,y in arc: c.tone(x,y,'teal',6); c.tone(x,y+1,'teal',5)
    c.tone(34,11,'teal',6); c.tone(36,12,'teal',6); c.tone(33,12,'teal',5)
    return c
P['물고기 연못 분수']=(fish_pool,'3×2','항구 광장 (움직임)')

def flowerbox_long():
    c=C(32,16,seed=911)
    c.group(1); c.box(1,8,30,2,5,'wood')
    for y in range(10,15): c.tone(1,y,'wood',2); c.tone(30,y,'wood',1)
    for x in range(1,31): c.tone(x,12,'wood',3)
    flowers(c,[(3,6),(6,5),(9,6),(12,5),(15,6),(18,5),(21,6),(24,5),(27,6),(28,4)],2)
    return c
P['긴 꽃상자']=(flowerbox_long,'2×1','집 앞 문 옆')

def planter_round():
    c=C(16,16,seed=912)
    c.group(1); c.cylinder(8,9,13,6,'stone',capry=2.2)
    disc_top(c,8,9,4.8,1.6,'dirt',lambda dx,dy,r: 2)
    c.group(2); c.ellipsoid(8,6,5,3.4,'leaf',amb=0.3,bump=0.4,bsc=2)
    c.new()
    for (x,y,m) in ((5,5,'pink'),(9,4,'pink'),(7,7,'cream'),(11,6,'pink'),(8,3,'cream')): c.tone(x,y,m,5); c.tone(x+1,y,m,4)
    return c
P['둥근 돌 화분']=(planter_round,'1×1','광장 둘레')

def door_pots():
    c=C(16,16,seed=913)
    for g,(cx,h) in enumerate(((4.5,5),(11,4)),1):
        c.group(g); c.cylinder(cx,14-h,13,2.8,'clay',capry=1.1)
    c.group(3); c.ellipsoid(4.5,6,3.2,3,'leaf',amb=0.3,bump=0.3,bsc=2); c.ellipsoid(11,7.5,3,2.6,'leaf',amb=0.3,bump=0.3,bsc=2)
    c.new()
    for (x,y) in ((3,5),(5,4),(6,6)): c.tone(x,y,'red',5); c.tone(x,y+1,'red',3)
    for (x,y) in ((10,6),(12,7)): c.tone(x,y,'gold',6); c.tone(x,y+1,'gold',4)
    return c
P['문간 화분 둘']=(door_pots,'1×1','문 옆')

def tree_planter():
    im=Image.new('RGBA',(32,48))
    c=C(32,48,seed=914)
    c.group(1); c.box(4,36,24,3,7,'stone',front=0.6)
    for x in range(4,28): c.tone(x,39,'stone',5)
    c.new()
    for y in range(37,39):
        for x in range(6,26): c.tone(x,y,'dirt',2 if y==37 else 3)
    c.group(2); c.new()
    for y in range(24,38): c.tone(15,y,'bark',4); c.tone(16,y,'bark',3); c.tone(17,y,'bark',2)
    im.alpha_composite(fin(c)); im.alpha_composite(chip(336,512,32,32),(0,0))
    return im
P['화분 속 가로수']=(tree_planter,'2×3','넓은 길가')

def hedge(n=3):
    c=C(16*n,24,seed=915+n); c.period=16
    c.group(1); c.box(1,2,16*n-2,8,10,'leaf',top=0.9,front=0.5)
    for x in range(1,16*n-1):
        c.tone(x,2,'leaf',5 if x%3 else 4); c.tone(x,10,'leaf',3)
        if _hash(x,1,915)<0.35: c.lighten(x,3,1)
        if _hash(x,2,915)<0.5: c.darken(x,11+int(_hash(x,3,915)*8),1)
    for y in range(2,20): c.tone(1,y,'leaf',3 if y<10 else 2); c.tone(16*n-2,y,'leaf',2 if y<10 else 1)
    return c
P['다듬은 산울타리']=(lambda: hedge(3),'3×1','공원 가장자리')

def sandwich_board():
    c=C(16,16,seed=918)
    c.group(1); c.new()
    for y in range(2,14):
        hw=4+(y-2)*0.25
        for x in range(int(8-hw),int(8+hw)+1): c.tone(x,y,'dark',5 if y>3 else 6)
    for y in range(2,14): c.tone(int(8-4-(y-2)*0.25),y,'wood',4); c.tone(int(8+4+(y-2)*0.25),y,'wood',2)
    for x in range(4,13): c.tone(x,2,'wood',5)
    c.new()
    for (y,x0,x1) in ((5,6,11),(7,5,10),(9,6,12),(11,5,9)):
        for x in range(x0,x1): c.tone(x,y,'cream',6 if x%3 else 4)
    c.tone(10,11,'red',5); c.tone(11,11,'red',4)
    return c
P['입간판 (분필)']=(sandwich_board,'1×1','가게 문 옆')

def flagpole(frame=0):
    c=C(32,64,seed=919); c.shadow(8,61.6,5,1.3)
    c.group(1); c.box(3,56,10,2,4,'stone')
    c.group(2); c.new()
    for y in range(4,56): c.tone(7,y,'wood',5); c.tone(8,y,'wood',3)
    c.tone(7,2,'gold',6); c.tone(8,2,'gold',4); c.tone(7,3,'gold',4); c.tone(8,3,'gold',3)
    c.group(3); c.new()
    for x in range(9,31):
        f=(x-9)/21; wv=round(1.6*math.sin(f*5.5-frame*1.57)); hh=round(7-4*f)
        for y in range(6+wv,6+wv+hh*2):
            if x>27 and abs(y-(6+wv+hh))<=1: continue
            mid=y-(6+wv)<hh; m='red' if (y-(6+wv))<hh*2-3 else 'gold'
            c.tone(x,y,m,5 if (mid and wv<=0) else (4 if mid else 3))
    return c
P['깃대 (나부낌)']=(flagpole,'2×4','광장·부두 입구 (움직임 4장)')

# ============================ MARKET ============================
def stall2(w,color,goods):
    c=ph.stall(w,color,['-']*w); c.group(40)
    for i,g in enumerate(goods):
        x0=i*16; c.new()
        if g=='cheese':
            for (dx,dy) in ((5,28),(11,28)):
                disc_top(c,x0+dx,dy-1,3.2,1.3,'gold',lambda a,b,r:6 if a<0 else 5)
                for x in range(x0+dx-3,x0+dx+3): c.tone(x,dy,'gold',4); c.tone(x,dy+1,'gold',3)
        elif g=='meat':
            for dx in (4,9,13):
                c.new()
                for y in range(16,23):
                    hw=1+min(y-16,3)*0.5
                    for x in range(int(x0+dx-hw),int(x0+dx+hw)+1): c.tone(x,y,'red',5 if x<x0+dx else 3)
                c.tone(x0+dx,15,'cream',5); c.tone(x0+dx,23,'cream',5)
            c.new(); c.ellipsoid(x0+8,28,4,1.8,'red',bias=0.1); c.tone(x0+6,28,'cream',6)
        elif g=='jug':
            for dx in (4,10):
                c.new(); c.ellipsoid(x0+dx,27.5,2.4,2.6,'clay',bias=0.05); c.tone(x0+dx,24,'clay',4); c.tone(x0+dx,25,'clay',3); c.tone(x0+dx+2,26,'clay',2)
            c.new(); c.ellipsoid(x0+14,28,1.6,2,'cream',bias=0.05)
        elif g=='pumpkin':
            for dx in (5,11): c.ellipsoid(x0+dx,28,3,2.2,'clay',bias=0.2,amb=0.3); c.tone(x0+dx,26,'leaf',3)
        elif g=='bottle':
            for dx in (3,6,9,12):
                c.new(); m='cryst' if dx%2 else 'lily'
                for y in range(24,30): c.tone(x0+dx,y,m,5 if y<27 else 3); c.tone(x0+dx+1,y,m,3)
                c.tone(x0+dx,23,'wood',4)
        elif g=='herb':
            for dx in (3,7,11):
                c.new()
                for y in range(16,23): c.tone(x0+dx,y,'leaf',4 if y%2 else 2); c.tone(x0+dx+1,y,'leaf',3)
                c.tone(x0+dx,15,'rope',4)
            c.new(); c.ellipsoid(x0+8,28,3.5,1.6,'lily',bias=0.1)
        elif g=='flower':
            flowers(c,[(x0+3,27),(x0+7,26),(x0+11,27),(x0+13,25)],41+i)
    return c
P['노점: 치즈·고기']=(lambda: stall2(2,'blue',['cheese','meat']),'2×3','시장 광장')
P['노점: 옹기·술병']=(lambda: stall2(2,'red',['jug','bottle']),'2×3','시장 광장')
P['노점: 약초·꽃']=(lambda: stall2(2,'green',['herb','flower']),'2×3','시장 광장')
P['노점: 호박·양배추']=(lambda: stall2(3,'red',['pumpkin','cabbage','pumpkin']),'3×3','시장·항구 광장')

def flower_cart():
    c=C(32,32,seed=921); c.shadow(16,29.6,15,1.8)
    c.group(1); c.box(2,15,26,3,8,'wood')
    for x in range(2,28): c.tone(x,19,'wood',3)
    c.new()
    for x in range(26,32): c.tone(x,19,'wood',4); c.tone(x,20,'wood',2)
    c.group(2)
    for (cx,m) in ((7,'red'),(14,'gold'),(21,'pink')):
        c.cylinder(cx,11,17,3,'iron',capry=1.2)
        c.ellipsoid(cx,8,3.8,3.4,'leaf',amb=0.35,bump=0.3,bsc=2)
        c.new()
        for (dx,dy) in ((-2,-1),(1,-2),(0,0),(2,1),(-1,2),(-3,1)): c.tone(cx+dx,8+dy,m,5); c.tone(cx+dx+1,8+dy,m,4)
    c.group(3)
    for cx in (7,22):
        c.new()
        for y in range(23,30):
            for x in range(cx-2,cx+2): c.tone(x,y,'wood',2 if x in (cx-2,cx+1) else 4)
        c.tone(cx-1,26,'iron',4); c.tone(cx,26,'iron',3)
    return c
P['꽃 수레']=(flower_cart,'2×2','시장')

def veg_cart():
    c=C(32,32,seed=922); c.shadow(16,29.6,15,1.8)
    c.group(1); c.box(1,13,28,4,9,'wood')
    for x in range(1,29): c.tone(x,13,'wood',6); c.tone(x,21,'wood',2)
    for y in range(17,26): c.tone(1,y,'wood',2)
    c.group(2)
    for (x,y,m,rx) in ((5,12,'leaf',3.2),(10,11,'leaf',3.2),(15,12,'clay',3),(20,11,'clay',3),(25,12,'red',2.6),(8,9,'leaf',3),(18,8.5,'clay',2.8),(23,9,'red',2.4)):
        c.ellipsoid(x,y,rx,rx*0.8,m,amb=0.3,bias=0.1)
    c.group(3)
    for cx in (6,24):
        c.new()
        for y in range(21,30):
            for x in range(cx-2,cx+2): c.tone(x,y,'wood',2 if x in (cx-2,cx+1) else 4)
        c.tone(cx-1,25,'iron',4)
    c.new()
    for x in range(28,32): c.tone(x,18,'wood',4); c.tone(x,19,'wood',2)
    return c
P['채소 손수레']=(veg_cart,'2×2','시장·청과상')

def open_crate(kind):
    c=C(16,16,seed=923+len(kind))
    c.group(1); c.box(2,6,12,3,7,'wood')
    for y in range(9,16): c.tone(2,y,'wood',2); c.tone(13,y,'wood',1)
    for x in range(2,14): c.tone(x,11,'wood',2)
    c.group(2)
    if kind=='apple':
        for (x,y) in ((4,6),(7,6),(10,6),(12,6),(5.5,4.5),(9,4.5)): c.ellipsoid(x+0.5,y+0.5,1.8,1.6,'red',bias=0.15)
    elif kind=='cabbage':
        for (x,y) in ((5,5.5),(10.5,5.5),(8,3.5)): c.ellipsoid(x,y,2.8,2.4,'leaf',bias=0.1,bump=0.3)
    elif kind=='fish':
        c.new()
        for y in range(4,8):
            for x in range(3,13): c.tone(x,y,'cryst',5)
        for yy,off in ((4,0),(6,2)):
            for k in range(7): c.tone(3+k+off,yy,'iron',6 if k<5 else 4)
            c.tone(10+off,yy-1,'iron',5); c.tone(10+off,yy+1,'iron',5); c.tone(4+off,yy,'dark',1)
    return c
P['과일 상자']=(lambda: open_crate('apple'),'1×1','청과상 앞')
P['양배추 상자']=(lambda: open_crate('cabbage'),'1×1','청과상 앞')
P['생선 상자']=(lambda: open_crate('fish'),'1×1','생선 가게 앞')

def goods_pile():
    c=C(32,32,seed=926); c.shadow(16,29.6,15,2)
    c.group(1); c.cylinder(7,12,24,5.2,'wood',capry=2)
    for y in (15,21):
        for x in range(2,13): c.tone(x,y,'iron',4 if x<7 else 2)
    c.group(2); c.box(13,15,13,3,11,'wood')
    for y in range(18,29): c.tone(13,y,'wood',2); c.tone(25,y,'wood',1)
    c.line(14,19,24,27,'wood',5)
    c.group(3); c.box(15,7,9,3,6,'wood',bias=0.05)
    c.group(4); c.new()
    for y in range(18,29):
        hw=2+min(3,(y-18)*0.6)
        for x in range(int(29-hw),int(29+hw)+1): c.setv(x,y,'cream',0.7 if x<29 else 0.45)
    c.tone(29,17,'rope',3); c.tone(28,16,'cream',4); c.tone(30,16,'cream',3)
    return c
P['통·상자·자루 더미']=(goods_pile,'2×2','창고 옆·부두')

def laundry_rack():
    c=C(32,32,seed=928)
    c.group(1)
    for x in (2,28): post(c,x,4,29,'wood',(4,2))
    c.new()
    for x in range(2,30): c.tone(x,5,'rope',4)
    c.group(2)
    for (x0,w,h,m) in ((5,7,14,'cream'),(13,6,10,'slate'),(20,7,13,'red')):
        c.new()
        for y in range(6,6+h):
            for x in range(x0,x0+w): c.tone(x,y,m,(5 if x<x0+w//2 else 4) if y<6+h-1 else 3)
        c.tone(x0+1,6,'wood',2); c.tone(x0+w-2,6,'wood',2)
    return c
P['빨래 건조대']=(laundry_rack,'2×2','뒷마당')

def laundry_line(width_px,seed=0,drop=10):
    c=C(width_px,drop+18,seed=929+seed)
    c.group(1); c.new()
    for x in range(width_px):
        y=1+round(drop*0.35*math.sin(math.pi*x/max(1,width_px-1))); c.tone(x,y,'rope',4)
    cols=['cream','red','slate','cream','gold','lily']; x=4; k=seed
    c.group(2)
    while x<width_px-7:
        y=1+round(drop*0.35*math.sin(math.pi*(x+2)/max(1,width_px-1)))+1
        m=cols[k%len(cols)]; w=4+(k*3)%4; h=6+(k*5)%6; c.new()
        if k%3==1:
            for yy in range(y,y+3):
                for xx in range(x-1,x+w+1): c.tone(xx,yy,m,5 if xx<x+w//2 else 4)
            for yy in range(y+3,y+h):
                for xx in range(x,x+w): c.tone(xx,yy,m,5 if xx<x+w//2 else 4)
        else:
            for yy in range(y,y+h):
                for xx in range(x,x+w): c.tone(xx,yy,m,(5 if xx<x+w//2 else 4) if yy<y+h-1 else 3)
        x+=w+3; k+=1
    return fin(c)
P['골목 빨랫줄']=(lambda: laundry_line(48,1),'두 집 사이 (공중)','골목 틈')

# ============================ HARBOUR ============================
def mooring_bollard():
    c=C(16,16,seed=931)
    c.group(1); c.new()
    for y in range(6,14):
        for x in range(5,11): c.tone(x,y,'dark',6 if x<7 else (5 if x<9 else 3))
    c.group(2)
    disc_top(c,8,5,5,2,'dark',lambda dx,dy,r: 6 if dx<-0.2 and dy<0.2 else (4 if r<0.6 else 3))
    c.tone(6,4,'iron',5); c.tone(7,4,'iron',5)
    c.group(3); c.new()
    for x in range(3,13): c.tone(x,9,'rope',5 if x%2 else 4); c.tone(x,10,'rope',3)
    for (x,y) in ((12,11),(13,12),(14,13),(15,14)): c.tone(x,y,'rope',4)
    return c
P['계선주']=(mooring_bollard,'1×1','부두 물가 줄')

def net_rack():
    c=C(32,32,seed=933); c.shadow(16,29.6,15,1.4)
    c.group(1)
    for x in (2,28): post(c,x,3,29)
    c.new()
    for x in range(2,30): c.tone(x,4,'wood',5 if x<16 else 4); c.tone(x,5,'wood',2)
    c.group(2); c.new()
    for y in range(6,26):
        for x in range(4,28):
            hem=22+round(3*math.sin(math.pi*(x-4)/23))
            if y>hem: continue
            if (x+y)%4==0 or (x-y)%4==0: c.tone(x,y,'rope',4 if x<16 else 3)
    for x in range(4,28): c.tone(x,22+round(3*math.sin(math.pi*(x-4)/23)),'rope',3)
    c.group(3)
    for (x,y) in ((9,15),(20,18),(14,23)): c.ellipsoid(x,y,1.8,1.8,'cloth',bias=0.2)
    return c
P['그물 건조대']=(net_rack,'2×2','부두')

def anchor():
    c=C(32,32,seed=935); c.shadow(16,29.6,14,1.6)
    c.group(1); c.box(3,24,26,3,3,'wood')
    c.group(2); c.new()
    for y in range(6,24): c.tone(15,y,'dark',6); c.tone(16,y,'dark',5); c.tone(17,y,'dark',3)
    for x in range(10,23): c.tone(x,8,'dark',6 if x<16 else 5); c.tone(x,9,'dark',3)
    for (x,y) in ((15,2),(16,2),(17,2),(14,3),(18,3),(14,4),(18,4),(15,5),(16,5),(17,5)): c.tone(x,y,'dark',5)
    c.new()
    for i in range(21):
        a=math.pi*i/20; x=16+10*math.cos(a); y=16+6*math.sin(a)
        c.tone(int(x),int(y),'dark',6 if x<16 else 4); c.tone(int(x),int(y)+1,'dark',3)
    for (x,y) in ((5,14),(6,13),(6,14),(7,14),(26,14),(26,13),(25,14),(27,14),(5,15),(27,15)): c.tone(x,y,'dark',6)
    c.group(3); c.new()
    for x in range(18,28): c.tone(x,3+abs(x-23)//2,'rope',4)
    for y in range(6,24): c.tone(28,y,'rope',4 if y%2 else 3)
    return c
P['닻 전시대']=(anchor,'2×2','항구 광장')

def crane(frame=0):
    c=C(64,80,seed=936); c.shadow(20,77.6,19,2)
    c.group(1); c.box(4,66,32,3,8,'stone')
    c.group(2); c.new()
    for y in range(40,67): c.tone(10+(66-y)//6,y,'wood',4); c.tone(11+(66-y)//6,y,'wood',2); c.tone(29-(66-y)//6,y,'wood',4); c.tone(30-(66-y)//6,y,'wood',2)
    c.group(3); c.new()
    for y in range(36,68):
        for x in range(4,37):
            r=math.hypot(x+0.5-20,y+0.5-52)
            if 12.5<=r<=15: c.tone(x,y,'wood',5 if (x<20 and y<52) else (4 if x<20 or y<52 else 2))
    for k in range(8):
        a=k*math.pi/4
        for t in range(2,13): c.tone(int(20+t*math.cos(a)),int(52+t*math.sin(a)),'wood',3)
    c.tone(19,51,'iron',5); c.tone(20,51,'iron',4); c.tone(19,52,'iron',3); c.tone(20,52,'iron',2)
    c.group(4); c.new()
    for i in range(0,40):
        x=20+i; y=38-int(i*0.72)
        c.tone(x,y,'wood',5); c.tone(x,y+1,'wood',4); c.tone(x,y+2,'wood',2)
    c.line(28,64,44,30,'wood',3)
    c.group(5); c.new()
    hy=40+(frame%4 in (1,2))*2
    for y in range(11,hy): c.tone(59,y,'rope',4)
    c.tone(58,hy,'iron',4); c.tone(59,hy,'iron',3); c.tone(60,hy+1,'iron',3); c.tone(58,hy+1,'iron',2)
    c.group(6); c.box(53,hy+2,11,3,9,'wood',bias=0.05)
    for y in range(hy+5,hy+14): c.tone(53,y,'wood',2); c.tone(63,y,'wood',1)
    for x in range(53,64): c.tone(x,hy+9,'wood',3)
    return c
P['부두 기중기']=(crane,'4×5 (아래 1줄 점유)','창고 부두 (움직임 4장)')

def fish_crates():
    c=C(32,16,seed=937)
    for g,x in enumerate((1,16),1):
        c.group(g); c.box(x,5,15,3,7,'wood')
        for y in range(8,15): c.tone(x,y,'wood',2); c.tone(x+14,y,'wood',1)
        c.new()
        for y in range(4,8):
            for xx in range(x+1,x+14): c.tone(xx,y,'cryst',5)
        for yy,off in ((4,0),(6,3)):
            for k in range(8): c.tone(x+2+k+off,yy,'iron',6 if k<5 else 4)
            c.tone(x+10+off,yy-1,'iron',5); c.tone(x+10+off,yy+1,'iron',5); c.tone(x+3+off,yy,'dark',1)
    return c
P['얼음 생선 궤짝']=(fish_crates,'2×1','생선 가게 앞·부두')

def fish_barrel():
    c=C(16,16,seed=940)
    c.group(1); c.cylinder(8,6,13,5,'wood',capry=2)
    for y in (8,11):
        for x in range(3,14): c.tone(x,y,'iron',4 if x<8 else 2)
    c.group(2); c.new()
    for (x,y) in ((6,4),(9,3)):
        for k in range(5): c.tone(x+k-2,y+(k//3),'iron',5 if k<3 else 3)
    c.tone(8,1,'iron',4); c.tone(8,2,'iron',3); c.tone(7,0,'iron',4); c.tone(9,0,'iron',4)
    return c
P['생선 통']=(fish_barrel,'1×1','생선 가게 앞')

# ============================ SHOP FRONTS ============================
SIGN_ICON={
 'bakery': (["..ccc..",".c.c.c.","c..c..c","c.c.c.c",".c...c.","..ccc.."],{'c':('clay',4)}),
 'fish':   ([".sss....s","sSssss.ss","sssssssss",".ssss..ss","........s"],{'s':('cryst',5),'S':('dark',1)}),
 'pharm':  ([".gg.",".gg.","gggg","gggg",".gg.",".gg."],{'g':('lily',5)}),
 'smith':  (["hhhhh..","hhhhh..","..w....","..w....","aaaaaaa",".aaaaa.","..a.a.."],{'h':('iron',5),'w':('wood',4),'a':('iron',3)}),
 'inn':    (["ccc.","wwww","wwwwh","wwwwh","wwww."],{'c':('cream',6),'w':('gold',4),'h':('gold',3)}),
 'tailor': (["b...b",".b.b.","..b..",".o.o.","o...o","o...o",".o.o."],{'b':('iron',5),'o':('iron',3)}),
 'jewel':  ([".rr.","rRrr","rrrr",".rr.","g..g","g..g",".gg."],{'r':('cryst',4),'R':('cryst',6),'g':('gold',5)}),
 'butcher':(["..cc...",".rrrr..","rrrrrr.","rRrrrrr",".rrrr..","..cc..."],{'r':('red',4),'R':('red',6),'c':('cream',6)}),
 'grocer': ([".l...","rrr..","rRrr.","rrrr.",".rr.."],{'r':('red',4),'R':('red',6),'l':('leaf',4)}),
 'books':  (["ccccc","cwwwc","ccccc","cwwwc","ccccc"],{'c':('cream',6),'w':('dark',2)}),
}
SIGN_NAME={'bakery':'빵집','fish':'생선 가게','pharm':'약방','smith':'대장간','inn':'여관','tailor':'재단사','jewel':'보석상','butcher':'푸줏간','grocer':'청과상','books':'서점'}
def bracket_sign(kind):
    c=C(20,20,seed=941)
    c.group(1); c.new()
    for x in range(0,19): c.tone(x,1,'iron',4 if x<10 else 3)
    c.line(1,6,7,2,'iron',3)
    c.tone(0,0,'iron',4); c.tone(0,2,'iron',3); c.tone(18,0,'iron',5)
    c.new(); c.tone(6,2,'iron',3); c.tone(15,2,'iron',3); c.tone(6,3,'iron',3); c.tone(15,3,'iron',3)
    c.group(2); c.box(4,4,14,1,13,'wood',front=0.55)
    for y in range(5,18): c.tone(4,y,'wood',4); c.tone(17,y,'wood',1)
    for x in range(4,18): c.tone(x,4,'wood',5); c.tone(x,17,'wood',1)
    rows,key=SIGN_ICON[kind]; w=max(len(r) for r in rows); h=len(rows)
    c.group(3); c.new(); c.lit(rows,11-w//2,11-h//2,key)
    return c
for _k in SIGN_ICON: P[f'걸이 간판: {SIGN_NAME[_k]}']=((lambda k=_k: bracket_sign(k)),'벽에 걸림','가게 문 옆 벽')

def bread_rack():
    c=C(16,32,seed=942)
    c.group(1)
    for x in (1,13): post(c,x,4,29,'wood',(4,2))
    c.new()
    for y in (10,18,26):
        for x in range(1,15): c.tone(x,y,'wood',5); c.tone(x,y+1,'wood',2)
    c.group(2)
    for (x,y) in ((4,8),(9,8.5),(4,16),(10,16),(7,24)): c.ellipsoid(x,y,2.8,1.7,'clay',bias=0.2)
    c.new()
    for (x,y) in ((4,7),(9,8),(10,15)): c.tone(x,y,'cream',5)
    return c
P['빵 진열대']=(bread_rack,'1×2','빵집 문 옆')

def herb_rack():
    c=C(16,32,seed=943)
    c.group(1); post(c,2,4,29); post(c,12,4,29)
    c.new()
    for x in range(2,14): c.tone(x,5,'wood',5); c.tone(x,6,'wood',2)
    c.group(2)
    for i,x in enumerate((4,7,10)):
        c.new(); m=('leaf','lily','moss')[i]
        for y in range(7,16+i*2):
            hw=0 if y<9 else 1
            for xx in range(x-hw,x+hw+1): c.tone(xx,y,m,4 if xx<=x else 2)
        c.tone(x,7,'rope',4)
    c.group(3); c.cylinder(7,22,27,3.8,'clay',capry=1.4)
    c.new(); c.tone(8,19,'wood',4); c.tone(9,18,'wood',4); c.tone(10,17,'wood',5)
    return c
P['약초 걸이·절구']=(herb_rack,'1×2','약방 문 옆')

def cloth_stand():
    c=C(32,32,seed=944)
    c.group(1)
    for x in (2,28): post(c,x,5,29,'wood',(4,2))
    c.new()
    for x in range(2,30): c.tone(x,5,'wood',5); c.tone(x,6,'wood',3)
    c.group(2)
    for i,(x0,m) in enumerate(((4,'red'),(10,'slate'),(16,'gold'),(22,'lily'))):
        c.new(); h=16+(i%2)*4
        for y in range(7,7+h):
            for x in range(x0,x0+5):
                t=(5 if x<x0+2 else 4) if (y-7)%5 else 3
                if y==6+h: t=2
                c.tone(x,y,m,t)
    return c
P['옷감 걸이']=(cloth_stand,'2×2','재단사 앞')

def sword_barrel():
    c=C(16,16,seed=945)
    for i,(x,top) in enumerate(((3,0),(7,2),(11,1))):
        c.group(10+i); c.new()
        for y in range(top+1,7): c.tone(x,y,'iron',6); c.tone(x+1,y,'iron',5); c.tone(x+2,y,'iron',3)
        c.tone(x+1,top,'iron',6)
        for xx in range(x-1,x+4): c.tone(xx,7,'gold',5 if xx<x+2 else 3)
    c.group(2); c.cylinder(8,9,13,5,'wood',capry=1.8)
    for y in (10,12):
        for x in range(3,14): c.tone(x,y,'iron',4 if x<8 else 2)
    return c
P['칼 꽂은 통']=(sword_barrel,'1×1','대장간 앞')

def stair_rail(h_px):
    c=C(4,h_px+8,seed=948); c.group(1); c.new()
    for y in range(0,h_px+8): c.tone(1,y,'iron',4); c.tone(2,y,'iron',2)
    c.new()
    for y in range(0,h_px+8,6): c.tone(0,y,'iron',5); c.tone(1,y,'iron',5); c.tone(2,y,'iron',3); c.tone(3,y,'iron',2)
    c.tone(1,0,'gold',5); c.tone(2,0,'gold',4)
    return fin(c)
P['계단 난간']=(lambda: stair_rail(40),'계단 양옆 (겹침)','모든 계단')

# ============================ v4: bridge (E-W, fixed front-top view) ============================
def bridge_ew(w_cells,frame=0):
    # an east-west stone bridge over a north-south river, 2 street rows wide: north parapet (coping + thin inner face),
    # cobbled deck, south parapet coping, then the FRONT FACE of the bridge: a stone band with an arch per river cell
    # and the dark water under it; the deck's shadow falls on the water below the face.
    import terrain
    COB=terrain.CH.crop((160,96,176,112)).load()
    ST=[tuple(int(PAL['stone'][i][j:j+2],16) for j in (1,3,5)) for i in range(7)]
    W=w_cells*16+8; H=16*4; im=Image.new('RGBA',(W,H)); px=im.load()
    for Y in range(0,H):
        for X in range(W):
            if Y<5:                                         # north parapet: coping top + inner face
                t=5 if Y<2 else (4 if Y<3 else 2)
                if X%12==0 and Y<3: t=3
                px[X,Y]=ST[t]+(255,)
            elif Y<37:                                      # deck: street cobbles, 2 rows
                r,g,b,_=COB[X%16,(Y-5)%16]; px[X,Y]=(r,g,b,255)
            elif Y<40:                                      # south parapet coping
                t=6 if Y==37 else (5 if Y==38 else 3)
                if X%12==0: t=3
                px[X,Y]=ST[t]+(255,)
            elif Y<56:                                      # front face: dressed stone with arches
                cx=((X-4)//16)*16+12; dx=abs(X+0.5-cx)
                arch_top=46+max(0,(dx-3))**2/6 if dx<7 else 99
                if Y>=arch_top and 4<=X<W-4: px[X,Y]=(18,40,44,255) if Y>arch_top+1 else ST[1]+(255,)
                else:
                    t=4 if (Y-40)%5 else 2
                    if (X+((Y-40)//5)*6)%12==0: t=2
                    if Y==40: t=2
                    px[X,Y]=ST[t]+(255,)
            elif Y<60:                                      # shadow + ripples on the water under the face
                px[X,Y]=(10,30,34,110 if Y<58 else 60)
    for X in list(range(0,4))+list(range(W-4,W)):          # end posts
        for Y in range(0,8): px[X,Y]=ST[6 if Y==0 else 4 if X<W//2 else 3]+(255,)
        for Y in range(34,42): px[X,Y]=ST[6 if Y==34 else 4 if X<W//2 else 3]+(255,)
    return im

def festoon(width_px,frame=0,seed=0):
    c=C(width_px,20,seed=930)
    c.group(1); c.new()
    for x in range(width_px):
        y=1+round(7*math.sin(math.pi*x/max(1,width_px-1))); c.tone(x,y,'rope',3)
    for i,x in enumerate(range(6,width_px-4,10)):
        y=2+round(7*math.sin(math.pi*x/max(1,width_px-1)))
        lantern(c,x,y,10+i,glow=5 if _hash(i,frame,seed)<0.3 else 6)
    return fin(c)
P['등불 줄 (깜빡임)']=(lambda: festoon(64),'광장 위 (공중)','시장 광장 위')

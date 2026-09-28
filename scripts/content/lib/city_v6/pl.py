# batch 7: more village life — signpost, laundry line, beehives, hen house + hens, flower bed, garden table,
# wayside shrine, rain barrel, pumpkins (fixed front-above view, chipset palette via palette.apply())
import sys, math; sys.path.insert(0,__import__('os').path.dirname(__import__('os').path.abspath(__file__)))
from px2 import C, vnoise, _hash
P={}; WATER=set()

def post(c,x,y0,y1,t=(4,2)):
    c.new()
    for y in range(y0,y1+1): c.tone(x,y,'bark',t[0]); c.tone(x+1,y,'bark',t[1])

def signpost():
    c=C(16,32,seed=300); c.shadow(8,29.6,4,1.2)
    c.group(1); post(c,7,4,29); c.tone(7,3,'bark',5); c.tone(8,3,'bark',3)
    for g,(y,dirn) in enumerate(((6,-1),(13,1))):                       # two arrow boards, one each way
        c.group(2+g); c.new()
        x0,x1=(1,13) if dirn<0 else (3,15)
        for yy in range(y,y+5):
            for xx in range(x0,x1):
                tip=(xx==x0 and dirn<0) or (xx==x1-1 and dirn>0)
                if tip and yy in (y,y+4): continue
                c.tone(xx,yy,'wood',5 if yy==y else (4 if yy<y+4 else 2))
        for xx in range(x0+3,x1-3,2): c.tone(xx,y+2,'wood',2)          # carved letters
        c.tone(x0+2 if dirn<0 else x1-3,y+2,'wood',2)
    c.group(9); c.new(); c.tone(6,28,'leaf',4); c.tone(9,28,'leaf',3); c.tone(5,29,'leaf',3); c.tone(10,29,'leaf',2)
    return c

def laundry():
    c=C(48,32,seed=301); c.shadow(24,29.6,21,1.6)
    c.group(1); post(c,2,3,29); post(c,44,3,29)
    for x in (1,2,3,4): c.tone(x,4,'bark',4 if x<3 else 2)
    for x in (43,44,45,46): c.tone(x,4,'bark',4 if x<45 else 2)
    c.group(2); c.new()
    sag=lambda x:5+int(round(2.2*math.sin(math.pi*(x-4)/40)))
    for x in range(4,44): c.tone(x,sag(x),'rope',3)
    def cloth(x0,x1,h,mat,g,shirt=False):
        c.group(g); c.new()
        for x in range(x0,x1):
            top=sag(x)+1
            for y in range(top,top+h):
                if shirt and y>top+4 and x not in range(x0+2,x1-2): continue       # sleeves stop, body goes on
                t=5 if y==top else (4 if x<(x0+x1)//2 else 3)
                if (x-x0)%4==3 and y>top+1: t-=1                                   # soft folds
                c.tone(x,y,mat,t)
        for x in range(x0,x1,3): c.tone(x,sag(x),'wood',5)                         # pegs
    cloth(7,17,11,'cream',3); cloth(19,28,9,'red',4,shirt=True); cloth(30,36,10,'shroom',5); cloth(37,42,7,'cream',6)
    return c

def skep(c,cx,g):
    # woven straw skep: a bell that narrows to a rounded top, coil bands every 2 rows, dark entrance at the foot
    c.group(g); c.new()
    for y in range(1,13):
        f=(y-1)/11; hw=1.6+4.6*math.sin(min(1,f*1.15)*math.pi/2)
        for x in range(int(cx-hw)-1,int(cx+hw)+2):
            dx=(x+0.5-cx)/hw
            if abs(dx)<=1: c.setv(x,y,'rope',c.shade(dx,-0.3+0.5*f,math.sqrt(1-dx*dx),0.3)+(0 if y%2 else -0.18))
    c.new()
    for x in range(cx-1,cx+2): c.tone(x,11,'dark',1); c.tone(x,12,'dark',1)
def beehives():
    c=C(32,16,seed=302); c.shadow(16,14.6,14,1.3)
    c.group(1); c.box(2,11,28,2,2,'wood')
    for x in (4,27): c.new(); [c.tone(x,y,'bark',3) for y in range(15,16)]
    skep(c,9,2); skep(c,22,3)
    return c

def henhouse():
    c=C(32,32,seed=303); c.shadow(16,29.6,14,1.8)
    c.group(1); c.box(4,12,24,0,15,'wood',front=0.6)
    for y in range(12,27):
        for x in range(4,28):
            if x%4==3: c.darken(x,y,1)                                                # vertical planks
    for y in range(12,27): c.tone(4,y,'wood',2); c.tone(27,y,'wood',1)
    for x in range(4,28): c.tone(x,26,'wood',1)
    c.new()
    for y in range(18,24):
        for x in range(13,19):
            if not (y==18 and x in (13,18)): c.tone(x,y,'dark',1)                   # hen door
    for (x,y) in ((8,16),(9,16),(22,16),(23,16)): c.tone(x,y,'dark',2)              # air holes
    c.group(2); c.new()                                                             # ramp to the door
    for j,y in enumerate(range(24,30)):
        for x in range(13-j//3,19+j//3): c.tone(x,y,'wood',4 if y%2 else 3)
    c.group(3); c.poly([(1,13),(5,3),(27,3),(31,13)],'rope',lambda x,y:0.95-0.3*(y-3)/10)   # straw roof
    for y in range(4,13):
        for x in range(2,31):
            if c.m[y][x]=='rope' and (x+y*2)%5==0: c.darken(x,y,1)
    for x in range(2,31): c.tone(x,13,'rope',2)
    for x in range(5,27): c.tone(x,3,'rope',5)
    return c

def hen(c,cx,cy,g,flip=False):
    s=-1 if flip else 1
    c.group(g); c.ellipsoid(cx,cy,3.6,2.8,'cream',amb=0.4,bias=0.1)
    c.ellipsoid(cx-3*s,cy-1.5,1.3,2.2,'cream',amb=0.4,bias=0.1)                  # tail
    c.new(); c.ellipsoid(cx+3*s,cy-2.5,1.8,1.8,'cream',amb=0.4,bias=0.15)         # head
    hx=int(cx+3*s); hy=int(cy-2.5)
    c.tone(hx,hy-2,'red',4); c.tone(hx+s,hy-2,'red',3); c.tone(hx,hy+1,'red',3)    # comb, wattle
    c.tone(hx+2*s,hy,'gold',5); c.tone(hx+s,hy-1,'dark',1)                        # beak, eye
    for dx in (-1,1): c.tone(int(cx)+dx,int(cy+3),'gold',4)                       # legs
def hens():
    c=C(16,16,seed=304); c.shadow(8,14.3,7,1.2); hen(c,5,9,1); hen(c,11,11,2,flip=True); return c

def flowerbed():
    c=C(32,16,seed=305); c.shadow(16,14.6,15,1.2)
    c.group(1); c.box(1,6,30,6,2,'dirt',top=0.55,front=0.4)
    for i,x in enumerate(range(1,31,3)):                                           # stone border
        c.new(); c.ellipsoid(x+1.2,13.2,1.7,1.3,'stone',bias=0.05+0.08*(i%2))
    c.group(2)
    cols=('red','gold','pink','red','cream','gold','pink','red','cream')
    for i in range(9):
        x=3+i*3+(i%2); y=7+(i*5)%3
        c.new()
        c.tone(x,y+2,'leaf',3); c.tone(x+1,y+3,'leaf',2); c.tone(x-1,y+3,'leaf',4)
        m=cols[i]; c.tone(x,y,m,5); c.tone(x+1,y,m,4); c.tone(x,y+1,m,3); c.tone(x+1,y+1,m,3); c.tone(x,y-1,m,6 if m!='cream' else 5)
    return c

def gardentable():
    c=C(32,32,seed=306); c.shadow(16,28.6,15,2)
    c.group(1); c.box(5,11,22,6,4,'wood')
    for x in range(5,27): c.tone(x,11,'wood',6) if x%5 else None
    for (x,y0) in ((6,21),(24,21)):
        c.new()
        for y in range(y0,y0+6): c.tone(x,y,'wood',2); c.tone(x+1,y,'wood',1)
    for g,(cx,cy) in enumerate(((3,20),(29,20),(16,27))):                          # stools
        c.group(3+g); c.cylinder(cx,cy,cy+3,2.6,'wood',capry=1.2)
    c.group(7)
    for (cx,m) in ((10,'stone'),(21,'stone')):                                     # mugs
        c.cylinder(cx,12,14,1.3,m,capry=0.7); c.tone(cx+2,13,m,3)
    c.new()
    for x in range(14,19): c.tone(x,13,'cream',5); c.tone(x,14,'cream',3)          # plate with bread
    c.tone(15,12,'gold',4); c.tone(16,12,'gold',5); c.tone(17,12,'gold',3)
    return c

def shrine():
    c=C(16,32,seed=307); c.shadow(8,29.6,6,1.4)
    c.group(1); c.box(3,11,10,2,16,'stone',front=0.62)
    for y in range(13,29,4):
        for x in range(3,13): c.darken(x,y,1)
    c.new()
    for y in range(15,23):
        for x in range(5,11):
            if not (y==15 and x in (5,10)): c.tone(x,y,'dark',1)                    # niche
    c.new(); c.ellipsoid(8,19,1.6,2.8,'gold',amb=0.45,bias=0.15)                  # little saint in the niche
    c.tone(8,16,'gold',6)
    c.group(2); c.poly([(1,11),(8,4),(15,11)],'wood',lambda x,y:0.95 if x<8 else 0.55)
    for x in range(1,15): c.tone(x,11,'wood',2)
    c.tone(8,2,'gold',5); c.tone(8,3,'gold',4); c.tone(7,3,'gold',4); c.tone(9,3,'gold',3)
    c.group(3); c.new()
    for (x,m) in ((3,'red'),(12,'gold'),(4,'pink')):
        c.tone(x,28,'leaf',3); c.tone(x,27,m,5)
    return c

def rainbarrel():
    c=C(16,16,seed=308); c.shadow(8,14.6,7,1.3)
    c.group(1); c.cylinder(8,4,13,5.5,'wood',capry=2.2)
    for y in (6,11):
        for x in range(2,15):
            if c.m[y][x]=='wood': c.tone(x,y,'stone',3 if x<8 else 2)
    c.new()
    for y in range(3,6):
        for x in range(4,13):
            if ((x+0.5-8)/4.3)**2+((y+0.5-4)/1.4)**2<=1: c.tone(x,y,'teal',3 if y>3 else 4)
    c.tone(6,4,'teal',5)
    return c

def pumpkin(c,cx,cy,rx,ry,g):
    c.group(g); c.ellipsoid(cx,cy,rx,ry,'gold',amb=0.3,bias=-0.05)
    for dx in (-rx*0.45,rx*0.45):
        x=int(round(cx+dx))
        for y in range(int(cy-ry)+1,int(cy+ry)):
            if c.m[y][x]=='gold': c.darken(x,y,1)
    c.new(); c.tone(int(cx),int(cy-ry),'leaf',2); c.tone(int(cx),int(cy-ry)-1,'leaf',3)
def pumpkins():
    c=C(16,16,seed=309); c.shadow(8,14.6,7,1.3)
    pumpkin(c,5,10,4.2,3.3,1); pumpkin(c,11.5,11,3.4,2.8,2); pumpkin(c,9,6,2.8,2.3,3)
    c.group(4); c.new(); c.tone(1,13,'leaf',3); c.tone(2,12,'leaf',4); c.tone(14,13,'leaf',3)
    return c

P['이정표']=signpost; P['빨래줄']=laundry; P['벌통 (짚 벌집)']=beehives; P['닭장']=henhouse; P['닭 두 마리']=hens
P['꽃밭']=flowerbed; P['야외 탁자']=gardentable; P['길가 성소']=shrine; P['빗물통']=rainbarrel; P['호박']=pumpkins

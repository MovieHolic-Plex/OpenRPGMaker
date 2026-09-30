import sys, math; sys.path.insert(0,__import__('os').path.dirname(__import__('os').path.abspath(__file__)))
from px2 import C, vnoise, _hash
P={}; WATER=set()
def mossify(c,x0,y0,x1,y1,mat_from,thr=0.6,sc=2.2,seed=4,topbias=0.0,into='moss'):
    thr+=0.1; sc*=1.3
    for y in range(y0,y1+1):
        for x in range(x0,x1+1):
            if c.inb(x,y) and c.m[y][x]==mat_from and c.fix[y][x] is None:
                if vnoise(x,y,sc,seed)+topbias*(1-(y-y0)/max(1,y1-y0))>thr: c.setv(x,y,into,c.v[y][x]+0.02,oid=c.id[y][x])
def vine(c,pts,seed=1):
    # hanging vine: dark stem, small leaves alternating
    for i in range(len(pts)-1):
        c.line(*pts[i],*pts[i+1],'leaf',2)
    n=0
    for (x,y) in pts[1:]:
        n+=1; sgn=1 if n%2 else -1
        c.tone(x+sgn,y,'leaf',4); c.tone(x+sgn,y+1,'leaf',3)

def pillar():
    c=C(16,32,seed=11); c.shadow(8,29.2,7.5,2.2)
    c.group(1)
    c.box(2,26,12,2,2,'mstone')                      # base slab
    c.cylinder(8,9,26,4.6,'mstone',cap=False)
    # fluting: darker grooves
    for y in range(9,26):
        for x in (6,9): c.darken(x,y,1)
    # broken jagged top (cap face tilted)
    top=[9,8,7,8,6,7,9,10,9]
    for i,x in enumerate(range(4,13)):
        t=top[i]
        for y in range(t,11):
            if y<=t+1: c.setv(x,y,'mstone',0.95-0.05*(x-4))
    c.box(3,24,10,1,1,'mstone',bias=0.05)          # torus ring
    mossify(c,2,6,14,28,'mstone',thr=0.66,sc=2)
    vine(c,[(11,9),(12,12),(11,15),(12,18),(12,20)])
    return c
P['무너진 기둥 (선 것)']=pillar

def fallen():
    c=C(32,16,seed=12); c.shadow(16,13.2,15,2.4)
    c.group(1)
    c.hcyl(4,17,8,4.5,'mstone',endcap='L',capmat='mstone')
    c.group(2)
    c.hcyl(19,29,9,4.2,'mstone',endcap='L',capmat='mstone')
    for x in (8,11,14,23,26):                         # fluting along length
        pass
    for x in range(4,30):
        for y in (6,9):
            if c.m[y][x]=='mstone' and c.fix[y][x] is None: c.darken(x,y,1)
    # broken right end chips
    for (x,y) in ((29,6),(29,12),(28,5)): c.m[y][x]=None
    mossify(c,3,3,30,13,'mstone',thr=0.62,sc=2,topbias=0.25)
    for (x,y) in ((18,12),(18,13),(17,13)): c.tone(x,y,'mstone',2)   # rubble
    return c
P['쓰러진 기둥']=fallen

def altar():
    c=C(64,48,seed=13); c.shadow(32,45,31,3)
    c.group(1)
    c.box(2,30,60,4,10,'mstone')          # tier 1
    c.box(9,20,46,4,8,'mstone',bias=0.02) # tier 2
    c.box(18,11,28,3,7,'mstone',bias=0.04)# tier 3 (shrine)
    # block courses on front faces
    for (x0,x1,y0,y1) in ((2,61,34,43),(9,54,24,31),(18,45,14,20)):
        for y in range(y0+3,y1,4):
            for x in range(x0,x1+1): c.darken(x,y,1)
        for y in range(y0,y1):
            k=(y-y0)//4
            for x in range(x0+(k%2)*4,x1+1,8): c.darken(x,y,1)
    # right side shading on tiers
    for (x1,y0,y1) in ((61,30,43),(54,20,31),(45,11,20)):
        for y in range(y0,y1+1):
            for x in range(x1-2,x1+1): c.darken(x,y,1)
    # central stairway
    c.group(2); c.new()
    for i,y in enumerate(range(14,44)):
        w=5+ (y-14)//6
        for x in range(32-w,32+w):
            c.setv(x,y,'mstone',0.78 if (y%3==0) else 0.5 if y%3==1 else 0.42)
        c.tone(32-w-1,y,'mstone',1); c.tone(32+w,y,'mstone',1)
    c.group(3)
    # shrine doorway with glow
    c.new()
    for y in range(12,19):
        for x in range(28,36):
            if not (y==12 and x in (28,35)): c.tone(x,y,'dark',1)
    for (x,y,t) in ((31,15,4),(32,15,5),(31,16,5),(32,16,6),(31,17,4),(32,17,4),(30,16,3),(33,16,3)): c.tone(x,y,'teal',t)
    # roof slab
    c.box(16,8,32,3,2,'mstone',bias=0.08)
    mossify(c,2,8,62,44,'mstone',thr=0.64,sc=2.4,topbias=0.12)
    vine(c,[(10,20),(10,23),(11,26),(10,29)]); vine(c,[(52,21),(53,24),(52,27)])
    return c
P['계단식 제단']=altar

def serpent():
    c=C(32,40,seed=9); c.shadow(16,36,13,3)
    c.group(1); c.box(4,28,24,3,4,'mstone'); c.box(6,25,20,3,1,'mstone',bias=0.05)
    c.group(2)
    c.ellipsoid(16,24.5,9.5,3.4,'stone',amb=0.35); c.group(21); c.ellipsoid(17,21.5,7.5,3.0,'stone',amb=0.35); c.group(22); c.ellipsoid(18,18.8,5.5,2.6,'stone',amb=0.35); c.group(2)
    # scale seams between coils
    # neck: rises from the coil top, arcs back then forward to the head (left)
    pts=[(19,18),(21,15),(21.5,12),(20,9),(17,7.5)]
    def bez(t):
        n=len(pts)-1; q=pts[:]
        while len(q)>1: q=[((1-t)*q[i][0]+t*q[i+1][0],(1-t)*q[i][1]+t*q[i+1][1]) for i in range(len(q)-1)]
        return q[0]
    for i in range(80):
        t=i/79; x,y=bez(t); r=2.8-0.6*t
        for yy in range(int(y-r)-1,int(y+r)+2):
            for xx in range(int(x-r)-1,int(x+r)+2):
                dx=(xx+0.5-x)/r; dy=(yy+0.5-y)/r
                if dx*dx+dy*dy<=1: c.setv(xx,yy,'stone',c.shade(dx,dy,math.sqrt(max(0,1-dx*dx-dy*dy)),0.4)+0.08,oid=c.nid)
    # belly plates on the neck's front (right side)
    for t in (0.1,0.25,0.4,0.55):
        x,y=bez(t); c.tone(int(x+2),int(y),'stone',2)
    c.group(3)
    # head: wedge pointing left, upper jaw + open lower jaw
    c.new()
    head=["....OOOOO...",
          "..OOhhllmmO.",
          ".Ohlllemmmd.",
          "Ohlllllmmmd.",
          "Ollmmmmmmd..",
          ".ORRRRRdd...",
          "Ok.RrrRmd...",
          ".OmmmmmdO...",
          "..OOOOOO...."]
    key={'O':('stone',0),'d':('stone',1),'m':('stone',2),'l':('stone',3),'h':('stone',5),'e':('teal',5),'R':('red',1),'r':('red',3),'k':('bone',6)}
    c.lit(head,8,3,key)
    c.tone(13,5,'dark',1); c.tone(14,4,'stone',1)       # brow ridge over the eye
    c.tone(7,9,'red',3); c.tone(6,10,'red',3); c.tone(6,8,'red',3)   # forked tongue
    mossify(c,4,24,28,33,'mstone',thr=0.55,topbias=0.25)
    return c
P['뱀 석두상']=serpent

def floor(v):
    c=C(16,16,seed=20+v); c.period=16
    # flagstones layout: list of rects (x0,y0,x1,y1) inclusive, grout between
    L=[[(0,0,6,5),(8,0,15,3),(8,5,15,9),(0,7,6,12),(8,11,12,15),(14,11,15,15),(0,14,6,15)],
       [(0,0,9,4),(11,0,15,6),(0,6,4,11),(6,6,9,11),(11,8,15,12),(0,13,9,15),(11,14,15,15)]][v]
    for y in range(16):
        for x in range(16): c.setv(x,y,'dirt',0.25)
    for (x0,y0,x1,y1) in L:
        c.new()
        for y in range(y0,y1+1):
            for x in range(x0,x1+1):
                v_=0.62
                if x==x0 or y==y0: v_=0.84
                if x==x1 or y==y1: v_=0.42
                c.setv(x,y,'mstone',v_)
    # moss in some grout
    for y in range(16):
        for x in range(16):
            if c.m[y][x]=='dirt' and vnoise(x,y,2,31+v,per=8)>0.45: c.setv(x,y,'moss',0.55)
    return c
P['이끼 돌바닥 A']=lambda: floor(0); P['이끼 돌바닥 B']=lambda: floor(1)

def gate():
    c=C(48,48,seed=15)
    c.group(1)
    # masonry wall with rounded top
    c.new()
    for y in range(4,46):
        for x in range(2,46):
            dx=(x+0.5-24)/22; top=4+ (1-math.sqrt(max(0,1-dx*dx)))*14
            if y>=top: c.setv(x,y,'mstone',0.62-0.25*max(0,(x-36)/10)+0.2*max(0,(8-x)/8))
    for y in range(8,46,5):
        for x in range(2,46):
            if c.m[y][x]: c.darken(x,y,1)
    for y in range(4,46):
        k=(y-3)//5
        for x in range(2+(k%2)*5,46,10):
            if c.m[y][x]: c.darken(x,y,1)
    # arch frame of big voussoirs
    c.group(2); c.new()
    for y in range(10,44):
        for x in range(10,38):
            dx=(x+0.5-24)/13; dy=(y+0.5-22)/12
            inside=(dx*dx+dy*dy<=1) or (y>=22 and abs(x+0.5-24)<=13)
            dx2=(x+0.5-24)/10; dy2=(y+0.5-22)/9
            inner=(dx2*dx2+dy2*dy2<=1) or (y>=22 and abs(x+0.5-24)<=10)
            if inside and not inner: c.setv(x,y,'stone',0.9 if x<24 else 0.55)
    # door slab
    c.group(3); c.new()
    for y in range(13,44):
        for x in range(14,34):
            dx2=(x+0.5-24)/10; dy2=(y+0.5-22)/9
            if (dx2*dx2+dy2*dy2<=1) or y>=22: c.setv(x,y,'stone',0.42-0.1*(x-14)/20)
    for y in range(14,44): c.tone(24,y,'stone',1); c.tone(23,y,'stone',2)
    # sealing glyph ring (glow)
    for a in range(0,360,10):
        r=5.5; x=int(round(24+math.cos(math.radians(a))*r)); y=int(round(30+math.sin(math.radians(a))*r)); c.tone(x,y,'teal',4)
    for (x,y,t) in ((24,26,5),(24,27,6),(24,28,5),(22,30,5),(23,30,6),(25,30,6),(26,30,5),(24,32,5),(24,33,6),(24,34,5),(24,30,6)): c.tone(x,y,'teal',t)
    # keystone
    c.group(4); c.box(21,8,6,2,3,'stone',bias=0.05)
    for (x,y) in ((23,11),(24,11)): c.tone(x,y,'teal',4)
    # threshold
    c.group(5); c.box(12,44,24,1,2,'stone',bias=0.02)
    mossify(c,2,4,46,46,'mstone',thr=0.63,sc=2.4,topbias=0.2)
    vine(c,[(8,8),(8,11),(9,14),(8,17),(8,20)]); vine(c,[(40,12),(41,15),(40,18)])
    return c
P['봉인된 석문 (벽)']=gate

def tablet():
    c=C(16,32,seed=16); c.shadow(8,29.5,7,2)
    c.group(1)
    c.box(2,25,12,2,3,'mstone')
    c.new()
    for y in range(3,26):
        for x in range(3,13):
            dx=(x+0.5-8)/5; top=3+ (1-math.sqrt(max(0,1-dx*dx)))*4
            if y>=top: c.setv(x,y,'stone',0.72-0.35*max(0,(x-9)/4)+0.15*max(0,(5-x)/3))
    rune=[".##.#",".#..#","##.##","",".#.#.","#.#.#",".###.","","##..#","..#.#","#.##."]
    for j,r in enumerate(rune):
        for i,ch in enumerate(r):
            if ch=='#': c.tone(5+i,9+j,'teal',5 if (i+j)%3 else 6)
    mossify(c,2,3,14,28,'stone',thr=0.7,sc=2,topbias=0.15); mossify(c,2,25,14,28,'mstone',thr=0.58)
    return c
P['룬 석판']=tablet

def lily(v):
    c=C(16,16,seed=30+v)
    def pad(cx,cy,rx,ry,notch):
        c.new()
        for y in range(16):
            for x in range(16):
                dx=(x+0.5-cx)/rx; dy=(y+0.5-cy)/ry; d=dx*dx+dy*dy
                if d>1: continue
                a=math.atan2(dy,dx); da=(a-notch+math.pi)%(2*math.pi)-math.pi
                if abs(da)<0.5 and d>0.03: continue
                # slightly cupped pad: rim rises
                val=0.6+0.25*(-dx*0.6-dy*0.8)*d
                c.setv(x,y,'lily',val)
        for k in range(7):
            a=notch+math.pi/3.6*(k-3)+math.pi
            for s_ in (0.35,0.6,0.82):
                x=int(cx+math.cos(a)*rx*s_); y=int(cy+math.sin(a)*ry*s_)
                if c.m[y][x]=='lily': c.darken(x,y,1)
    if v==0: pad(7.5,7,6.8,4.8,-0.4)
    else: pad(9.5,6.5,5.4,3.8,2.5); pad(4.5,12,3.6,2.5,-1.0)
    return c
P['수련 잎 A']=lambda: lily(0); P['수련 잎 B']=lambda: lily(1); WATER|={'수련 잎 A','수련 잎 B'}

def lotus():
    c=C(16,16,seed=33)
    c.new()
    for y in range(16):
        for x in range(16):
            dx=(x+0.5-8)/7; dy=(y+0.5-9)/5; d=dx*dx+dy*dy
            a=math.atan2(dy,dx); da=(a+0.9+math.pi)%(2*math.pi)-math.pi
            if d<=1 and not (abs(da)<0.45 and d>0.03): c.setv(x,y,'lily',0.6+0.2*(-dx*0.6-dy*0.8)*d)
    c.group(2)
    petals=[(8,8,2.2,3.6,0),(5.6,8.4,2.4,2.6,0),(10.4,8.4,2.4,2.6,0),(6.6,6.4,1.8,2.6,0),(9.4,6.4,1.8,2.6,0),(8,5.6,1.6,2.6,0)]
    for (x,y,rx,ry,_) in petals: c.ellipsoid(x,y,rx,ry,'pink',amb=0.35,bias=0.08)
    for (x,y,t) in ((8,7,6),(7,8,5),(8,8,4)): c.tone(x,y,'gold',t)
    return c
P['연꽃']=lotus; WATER.add('연꽃')

def stones():
    c=C(16,16,seed=34)
    for i,(x,y,rx,ry) in enumerate(((4.5,4.0,3.5,2.3),(11.5,7.5,3.7,2.5),(5.5,12.0,3.4,2.2))):
        c.group(i+1)
        c.new()
        for yy in range(16):
            for xx in range(16):
                dx=(xx+0.5-x)/rx; dy=(yy+0.5-y-1.4)/ry
                if dx*dx+dy*dy<=1: c.setv(xx,yy,'mstone',0.28)     # wet flank
        c.ellipsoid(x,y,rx,ry,'mstone',rz=0.4,bias=0.25,bump=0.5)
    return c
P['징검돌']=stones; WATER.add('징검돌')

def boulder():
    c=C(32,32,seed=3); c.shadow(16,27,14,3.2)
    c.group(1); c.ellipsoid(14,17,11.5,9.5,'mstone',bump=0.9,bsc=4)
    c.group(None); c.ellipsoid(24,22,6.5,5,'mstone',bump=0.8,bsc=3); c.ellipsoid(7,24,4.5,3.2,'mstone',bump=0.7,bsc=3)
    for y in range(7,17):
        for x in range(4,26):
            if c.m[y][x]=='mstone' and c.id[y][x]==1:
                edge=y-(17-9.5*math.sqrt(max(0,1-(x+0.5-14)**2/11.5**2)))
                if edge<3.0+vnoise(x,0,2.5,5)*3 and x<21: c.setv(x,y,'moss',c.v[y][x]+0.05,oid=c.id[y][x])
    c.line(12,19,15,23,'mstone',1); c.line(15,23,15,25,'mstone',1); c.line(18,15,20,17,'mstone',1)
    return c
P['물가 바위']=boulder

def logbridge():
    # chipset view (front, from above), same idiom as the chipset's wooden bridge: a deck top strip,
    # a front face (here: the logs' round cut ends), dark outline, shadow on the water. Tiles horizontally.
    c=C(16,16,seed=36)
    for x in range(16): c.tone(x,0,'wood',0)
    for i,x0 in enumerate((0,8)):
        c.new()
        prof=(4,5,5,4,4,3,2,1)                        # a fat log's cross-section, lit from the left
        for y in range(1,8):
            for k,t in enumerate(prof): c.tone(x0+k,y,'wood',t)
        for (k,y) in ((3,2+i),(5,5-i),(2,6)): c.tone(x0+k,y,'wood',c.fix[y][x0+k]-1)   # bark grain
        end=["01222210","12344321","23455432","23455432","12344321","01222210"]
        for j,r in enumerate(end):
            for k,ch in enumerate(r): c.tone(x0+k,8+j,'wood',int(ch)) if ch!='0' else c.tone(x0+k,8+j,'wood',0)
        c.tone(x0+3,10,'wood',3); c.tone(x0+4,11,'wood',3)                         # growth ring
    for x in range(16): c.tone(x,14,'wood',0) if c.m[14][x] is None else None
    # rope lashing over the log tops
    for x in range(16): c.tone(x,3,'rope',5 if x%3 else 4); c.tone(x,4,'rope',2)
    im=c.img(outline=False)
    for x in range(16):                              # shadow on the water under the deck
        for y,a in ((14,120),(15,60)): im.putpixel((x,y),(8,30,26,a))
    class W: pass
    w=W(); w.img=lambda outline=True: im
    return w
P['통나무 다리 (가로)']=logbridge; WATER.add('통나무 다리 (가로)')

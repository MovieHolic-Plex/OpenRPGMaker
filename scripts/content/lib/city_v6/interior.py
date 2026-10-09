# Interior chipset (houses / inns / shops) — inside of the pj.py houses. Fixed front-top view (RM2000 idiom):
# wall top = dark band seen from above, wall face = 2 cells seen from the front, floor seen from above.
# Surfaces are the chipset's own seamless tiles; hand drawing only for joints, rims and furniture.
import sys, os, math, json; sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
import palette; palette.apply()
import px2; from px2 import C, PAL, hx
import pf, pi                      # accepted barrels / cauldron / crates / sacks
palette.apply()
from PIL import Image
CHIPSET=os.environ.get('PJ_CHIPSET','/home/main/.herdr/worktrees/rpg-zzu/worktree-brave-stone-6ff0/public/assets/atlas-biomes/jungle-chipset.png')
CH=Image.open(CHIPSET).convert('RGBA')
def ct(x,y,w=16,h=16): return CH.crop((x,y,x+w,y+h))
def tile(t,w,h):
    o=Image.new('RGBA',(w,h))
    for y in range(0,h,16):
        for x in range(0,w,16): o.paste(t,(x,y))
    return o
def _luma(c): return c[0]*0.3+c[1]*0.59+c[2]*0.11
def step(im,k,mask=None,ref=None):
    # move every pixel k steps along the tile's OWN colours sorted by luma: shading that never invents a colour
    ref=ref or im; cols=sorted({p for p in ref.getdata() if p[3]},key=_luma); ix={c:i for i,c in enumerate(cols)}
    o=im.copy(); px=o.load()
    for y in range(o.height):
        for x in range(o.width):
            p=px[x,y]
            if p[3] and p in ix and (mask is None or mask(x,y)): px[x,y]=cols[max(0,min(len(cols)-1,ix[p]+k))]
    return o
def rgb(mat,t): return hx(PAL[mat][t])+(255,)
class Pic:
    def __init__(s,im): s.im=im
    def img(s,outline=True): return s.im
def fix_shadow(im):
    # px2 contact shadows are lawn-green; indoors they are the chipset's darkest purple
    px=im.load()
    for y in range(im.height):
        for x in range(im.width):
            r,g,b,a=px[x,y]
            if (r,g,b)==(14,30,8): px[x,y]=(27,16,36,min(120,a+20))
    return im
P={}; SIZE={}; WATER=set()
def reg(name,fn,w=1,h=1): P[name]=fn; SIZE[name]=(w,h)

# ---------------- floors ----------------
FLOORSRC={'wood':ct(192,304),'wood2':step(ct(192,288),-1),'flag':ct(224,320),'tile':ct(208,480)}
def _checker():
    a=ct(224,320); b=step(ct(224,320),-2); o=Image.new('RGBA',(16,16))
    for y in range(16):
        for x in range(16): o.putpixel((x,y),(a if ((x//8)+(y//8))%2==0 else b).getpixel((x,y)))
    # 1px grout on the tile grid, taken from the dark tile
    g=sorted({p for p in b.getdata()},key=_luma)[1]
    for i in range(16): o.putpixel((i,0),g); o.putpixel((0,i),g); o.putpixel((i,8),g) if i%16 else None; o.putpixel((8,i),g)
    return o
FLOORSRC['check']=_checker()
FLOORS=list(FLOORSRC)
def floor_shadow(k,code):
    # code: '' none, 'n' wall face above, 'w' wall band left, 'nw' both, 'c' only the up-left corner is wall
    t=FLOORSRC[k]
    def m(x,y):
        n='n' in code and y<5-(x>12); w='w' in code and x<4-(y>13)
        c=code=='c' and x<4 and y<5 and x+y<7
        return n or w or c
    s=step(t,-2,m) if code else t
    if 'n' in code: s=step(s,-1,lambda x,y:y<2)
    return s
for k in FLOORS:
    for code in ('','n','w','nw','c'):
        reg('floor.%s%s'%(k,'.s'+code if code else ''),(lambda k=k,code=code: Pic(floor_shadow(k,code))))
    # window light: a slanted patch falling down-right from a window in the wall face above
    for part in ('a','b'):
        def lit(k=k,part=part):
            base=floor_shadow(k,'n' if part=='a' else '')
            off=0 if part=='a' else 16
            return Pic(step(base,1,lambda x,y:3+0.45*(y+off)<=x<=11+0.45*(y+off) and (y+off)%11!=6))
        reg('floor.%s.lit%s'%(k,part),lit)
# rug: the chipset's own red carpet, 9-slice
RUG={'tl':(240,448),'t':(256,448),'tr':(272,448),'l':(240,464),'c':(256,464),'r':(272,464),'bl':(240,480),'b':(256,480),'br':(272,480)}
for k,(x,y) in RUG.items(): reg('rug.'+k,(lambda x=x,y=y: Pic(ct(x,y))))

# ---------------- walls ----------------
FACE={'tim':ct(248,16),'sto':ct(200,16),'wod':ct(200,56)}
TRIM={'tim':'wood','sto':'stone','wod':'wood'}
STYLES=list(FACE)
def face(style,row,end):
    # row 'u' upper / 'b' lower half of a 2-cell wall face; end l/m/r/lr/post
    im=tile(FACE[style],16,16); px=im.load(); T=TRIM[style]
    def P_(x,y,t,mat=T): px[x,y]=rgb(mat,t)
    if style in('tim','wod'):
        if row=='u':
            for x in range(16): P_(x,0,1); P_(x,1,4); P_(x,2,3); P_(x,3,2); P_(x,4,1)       # top beam under the ceiling
            im=step(im,-1,lambda x,y:y in(5,6),ref=FACE[style]) if True else im; px=im.load()
        else:
            for x in range(16): P_(x,11,1); P_(x,12,5); P_(x,13,4); P_(x,14,3); P_(x,15,1)   # skirting board
        posts={'l':[0],'r':[12],'lr':[0,12],'post':[6]}.get(end,[])
        for x0 in posts:
            for y in range(16):
                if row=='u' and y<5: continue
                if row=='b' and y>=11: continue
                for i,t in enumerate((1,4,3,2)): P_(x0+i,y,t)
        if style=='tim' and end=='m' and row=='u':
            pass
    else:
        if row=='u':
            for x in range(16): P_(x,0,1); P_(x,1,4); P_(x,2,3); P_(x,3,1)                    # stone lintel course
        else:
            im=step(im,-1,lambda x,y:y>=11,ref=FACE[style]); px=im.load()
            for x in range(16): P_(x,11,4); P_(x,10,1); P_(x,15,1)                             # plinth
        for x0,side in ((0,'l'),(11,'r')):
            if end in (side,'lr'):
                for y in range(16):
                    blk=((y//4)%2)
                    for i in range(5):
                        if side=='r' and i<(1 if blk else 3): continue
                        if side=='l' and i>(3 if blk else 1): continue
                        t=1 if (y%4==3 or i==(0 if side=='l' else 4)) else (5 if y%4==0 else 4)
                        P_(x0+i,y,t)
    # shaded right end: the side wall's thickness in shadow
    if end in('r','lr'):
        im=step(im,-1,lambda x,y:x>=14,ref=FACE[style])
    if end in('l','lr'):
        im=step(im,1,lambda x,y:x in(4,5) and style!='sto',ref=FACE[style])
    return im
for s in STYLES:
    for row in 'ub':
        for end in ('l','m','r','lr','post'):
            reg('wall.%s.%s.%s'%(s,row,end),(lambda s=s,row=row,end=end: Pic(face(s,row,end))))
# wall top (ceiling band seen from above) — 47-set via neighbour mask; 'open' = room interior on that side
def _bandfill(s):
    # the wall top is a dark band: the face texture's own pattern re-toned onto the trim ramp's darkest steps
    t=FACE[s]; cols=sorted({p for p in t.getdata() if p[3]},key=_luma); o=t.copy(); px=o.load(); n=len(cols)
    for y in range(16):
        for x in range(16):
            r=cols.index(px[x,y])/max(1,n-1); px[x,y]=rgb(TRIM[s],1 if r<0.5 else 2)
    return o
BANDFILL={s:_bandfill(s) for s in STYLES}
def band(style,o):
    # o: set of open directions among N,E,S,W,NE,NW,SE,SW (diagonals only matter when both sides are closed)
    im=BANDFILL[style].copy(); px=im.load(); T=TRIM[style]
    def P_(x,y,t): px[x,y]=rgb(T,t)
    lip=(1,5,3)   # from the fill outward: dark joint, lit lip, mid edge (the lip meets the room)
    for d in 'NESW':
        if d not in o: continue
        for i in range(16):
            for j,t in enumerate(lip):
                pos=2-j   # 0 = the pixel against the room
                if d=='N': P_(i,pos,t)
                if d=='S': P_(i,15-pos,t)
                if d=='W': P_(pos,i,t)
                if d=='E': P_(15-pos,i,t)
    corners={'NW':(0,0,1,1),'NE':(15,0,-1,1),'SW':(0,15,1,-1),'SE':(15,15,-1,-1)}
    for d,(cx,cy,sx,sy) in corners.items():
        a,b=d[0],d[1]
        if d in o and a not in o and b not in o:
            for (i,j),t in {(0,0):3,(1,0):5,(0,1):5,(2,0):1,(0,2):1,(1,1):1,(2,1):1,(1,2):1}.items():
                P_(cx+sx*i,cy+sy*j,t)
    return im
def band_key(o):
    o=set(o); ks=[d for d in ('N','E','S','W','NE','NW','SE','SW') if d in o and (len(d)==1 or (d[0] not in o and d[1] not in o))]
    return '-'.join(sorted(ks,key=['N','E','S','W','NE','NW','SE','SW'].index)).lower() or 'x'
def all_band_keys():
    import itertools; ks=set()
    for bits in itertools.product((0,1),repeat=8):
        o={d for d,b in zip(('N','E','S','W','NE','NW','SE','SW'),bits) if b}; ks.add(band_key(o))
    return sorted(ks,key=lambda k:(len(k),k))
def _band_from_key(k):
    return set() if k=='x' else {d.upper() for d in k.split('-')}
for s in STYLES:
    for k in all_band_keys():
        reg('top.%s.%s'%(s,k),(lambda s=s,k=k: Pic(band(s,_band_from_key(k)))))

# ---------------- wall details (overlays on the 2-cell face) ----------------
def window(curtain=False):
    c=C(16,32,seed=301); c.group(1); c.new()
    for y in range(6,23):
        for x in range(2,14):
            edge=x in(2,13) or y in(6,22)
            if edge: c.tone(x,y,'wood',2 if x==13 or y==22 else 4)
            elif x in(3,12) or y==7: c.tone(x,y,'wood',1)
            else:
                t=5 if (x-4)+(y-8)*0.6<5 else (4 if y<16 else 3)
                c.tone(x,y,'cryst',t)
    for y in range(8,22): c.tone(7,y,'wood',3); c.tone(8,y,'wood',2)
    for x in range(4,12): c.tone(x,14,'wood',3)
    c.tone(5,9,'cryst',6); c.tone(10,9,'cryst',6); c.tone(4,10,'cryst',6)
    for x in range(1,15): c.tone(x,23,'wood',5); c.tone(x,24,'wood',3)   # sill
    if curtain:
        c.group(2)
        for side in (0,1):
            c.new()
            for y in range(5,22):
                w=4-int(y>14)+(y>19)
                for i in range(w):
                    x=(2+i) if side==0 else (13-i)
                    c.tone(x,y,'red',4 if (i+(y//3))%3 else 3)
        for x in range(1,15): c.tone(x,4,'wood',4)
    return c
def door(opened=True):
    c=C(16,32,seed=302); c.group(1); c.new()
    for y in range(8,32):
        for x in range(1,15):
            if x in(1,2) or x in(13,14) or y in(8,9): c.tone(x,y,'wood',4 if x in(1,2) or y==8 else 2)
            elif opened: c.tone(x,y,'dark',1 if y<24 else 2)
            else:
                c.tone(x,y,'wood',(2 if x in(3,7,11) else 3) if (y-10)%7 else 1)
    if opened:
        for y in range(10,32):
            for x in range(3,13):
                if y>28: c.tone(x,y,'wood',2)
    else:
        c.tone(11,20,'gold',5); c.tone(11,21,'gold',3)
    return c
def fireplace():
    c=C(48,48,seed=303); c.group(1); c.new()
    # stone surround on the face (rows 0..31) and a hearth slab on the floor (rows 32..40)
    for y in range(2,33):
        for x in range(4,44):
            blk=((x+(4 if (y//5)%2 else 0))//8,y//5)
            v=0.55+((blk[0]*7+blk[1]*3)%5)*0.06
            if y%5==4 or (x+(4 if (y//5)%2 else 0))%8==7: v-=0.3
            c.setv(x,y,'stone',v)
    c.group(2); c.new()
    for y in range(9,33):
        for x in range(12,36):
            arch=y>=9+max(0,int(5-math.sqrt(max(0,144-(x-23.5)**2))/2.4))
            if arch: c.tone(x,y,'dark',1 if y<20 else 2)
    c.group(3); c.new()
    for x in range(2,46): c.tone(x,6,'wood',5); c.tone(x,7,'wood',4); c.tone(x,8,'wood',2)   # mantle beam
    for x in range(3,45): c.tone(x,5,'wood',3)
    c.group(4); c.new()
    for x in range(15,33): c.tone(x,31,'wood',3 if x%5 else 1); c.tone(x,30,'wood',4 if x%5 else 2)   # logs
    c.lit(pf.FLAME,21,24,pf.FK); c.lit(pf.FLAME,17,26,pf.FK); c.lit(pf.FLAME,25,26,pf.FK)
    c.group(5); c.new()
    for y in range(33,40):
        for x in range(2,46): c.setv(x,y,'stone',0.85-(y-33)*0.05 if y<38 else 0.4)
    for x in range(2,46,9):
        for y in range(33,38): c.tone(x,y,'stone',2)
    # mantle clutter: a pot and a candle
    c.group(6); c.new()
    for y in range(1,5):
        for x in range(8,12): c.tone(x,y,'clay',4 if x<10 else 3)
    c.tone(37,2,'cream',6); c.tone(37,3,'cream',5); c.tone(37,4,'cream',4); c.tone(37,1,'fire',5); c.tone(37,0,'fire',6)
    c.tone(36,5,'gold',4); c.tone(38,5,'gold',3)
    return c
def shelves(kind='jars'):
    c=C(32,16,seed=304)
    for yb in (6,14):
        c.group(yb); c.new()
        for x in range(1,31): c.tone(x,yb,'wood',5); c.tone(x,yb+1,'wood',2)
        c.tone(3,yb+2,'wood',1); c.tone(28,yb+2,'wood',1) if yb+2<16 else None
    items=[(3,'clay',4),(7,'cryst',3),(11,'leaf',3),(16,'red',3),(20,'clay',4),(24,'cryst',4),(27,'gold',4)]
    for i,(x,m,h) in enumerate(items):
        c.group(100+i); c.new(); top=6-h
        for y in range(top,6):
            for xx in range(x,x+3): c.tone(xx,y,m,5 if xx==x else (4 if xx==x+1 else 3))
        if m in('cryst','leaf'): c.tone(x+1,top-1,'wood',3)
    for i,x in enumerate(range(3,29,3)):
        c.group(200+i); c.new(); m=('red','slate','leaf','gold','red','slate','clay','leaf','slate')[i]
        for y in range(9,14):
            for xx in (x,x+1): c.tone(xx,y,m,4 if xx==x else 3)
        c.tone(x,10,'gold',5)
    return c
def painting():
    c=C(32,16,seed=305); c.group(1); c.new()
    for y in range(2,15):
        for x in range(4,28):
            if x in(4,27) or y in(2,14): c.tone(x,y,'gold',4 if x==4 or y==2 else 2)
            elif x in(5,26) or y in(3,13): c.tone(x,y,'gold',3)
            else:
                hor=9+int(1.5*math.sin(x/3))
                c.tone(x,y,'cryst' if y<hor else ('leaf' if y<11 else 'wood'),(4 if y<6 else 3) if y<hor else (3 if (x+y)%4 else 4))
    c.tone(20,5,'gold',6); c.tone(21,5,'gold',5)
    return c
def sconce():
    c=C(16,16,seed=306); c.group(1); c.new()
    for y in range(8,13): c.tone(7,y,'iron',3); c.tone(8,y,'iron',2)
    for x in range(5,11): c.tone(x,12,'iron',4 if x<8 else 2)
    c.tone(6,13,'iron',2); c.tone(9,13,'iron',2)
    c.group(2); c.new()
    for y in range(6,9): c.tone(7,y,'cream',6); c.tone(8,y,'cream',4)
    c.lit(pf.FLAME,5,0,pf.FK)
    return c
def herbs():
    c=C(32,16,seed=307); c.group(1); c.new()
    for x in range(1,31): c.tone(x,2,'wood',4); c.tone(x,3,'wood',2)
    for i,x in enumerate((4,11,18,25)):
        c.group(10+i); c.new(); m=('leaf','moss','leaf','gold')[i]
        c.tone(x+1,4,'rope',4); c.tone(x+1,5,'rope',3)
        for y in range(6,14):
            w=1+min(2,(y-5)//2)
            for xx in range(x+1-w,x+2+w):
                c.tone(xx,y,m,(5 if xx<=x else 3) if (xx+y)%3 else 2)
    return c
reg('win',lambda:window(False),1,2); reg('win.curtain',lambda:window(True),1,2)
reg('door.open',lambda:door(True),1,2); reg('door.shut',lambda:door(False),1,2)
reg('fireplace',fireplace,3,3); reg('shelf.wall',shelves,2,1); reg('painting',painting,2,1)
reg('sconce',sconce,1,1); reg('herbs',herbs,2,1)
def doormat():
    c=C(16,16,seed=308); c.group(1); c.new()
    for y in range(3,13):
        for x in range(2,14): c.tone(x,y,'rope',(4 if (x+y)%2 else 3) if 2<x<13 and 3<y<12 else 2)
    return c
reg('mat',doormat)

# ---------------- furniture ----------------
def _planktop(c,x0,y0,w,d,mat='wood'):
    for y in range(y0,y0+d):
        for x in range(x0,x0+w):
            t=5 if y==y0 else (4 if (y-y0)%4 else 3)
            if (x*7+((y-y0)//4)*5)%13==0 and (y-y0)%4: t=3
            c.tone(x,y,mat,t)
def table(w):
    W=w*16; c=C(W,32,seed=310); c.shadow(W/2,29,W/2-3,2)
    c.group(1); c.new()
    for x in (3,4,W-5,W-4):
        for y in range(22,30): c.tone(x,y,'wood',2 if x in(3,W-5) else 1)
    c.group(2); c.new(); _planktop(c,1,8,W-2,13)
    for x in range(1,W-1): c.tone(x,21,'wood',3); c.tone(x,22,'wood',2); c.tone(x,23,'wood',1)
    for y in range(8,24): c.tone(1,y,'wood',4 if y<21 else 2); c.tone(W-2,y,'wood',3 if y<21 else 1)
    return c
def chair(face):
    c=C(16,16,seed=311+ 'dulr'.index(face)); c.shadow(8,14.5,5.5,1.2)
    def seat(y0):
        for y in range(y0,y0+4):
            for x in range(4,12): c.tone(x,y,'wood',5 if y==y0 else 4)
        for x in range(4,12): c.tone(x,y0+4,'wood',2)
    def legs(y0,y1,xs=(4,11)):
        for x in xs:
            for y in range(y0,y1): c.tone(x,y,'wood',2)
    if face=='d':      # facing the viewer: backrest behind (above) the seat
        c.group(1); c.new()
        for y in range(1,8):
            for x in range(4,12): c.tone(x,y,'wood',(3 if x in(4,11) or y==1 else (2 if x in(6,9) else 1)) if True else 0)
        for x in range(4,12): c.tone(x,1,'wood',5)
        c.group(2); c.new(); seat(7); legs(12,15)
    elif face=='u':    # back to the viewer: the backrest's back covers the seat
        c.group(1); c.new(); seat(6); legs(11,15)
        c.group(2); c.new()
        for y in range(2,12):
            for x in range(4,12): c.tone(x,y,'wood',(4 if x==4 or y==2 else 3) if y<11 else 2)
        for x in range(5,11): c.tone(x,6,'wood',2)
    else:              # side view, backrest on the far side
        c.group(1); c.new()
        for y in range(7,11):
            for x in range(4,12): c.tone(x,y,'wood',5 if y==7 else 4)
        for x in range(4,12): c.tone(x,11,'wood',2)
        bx=11 if face=='l' else 4
        for y in range(1,11): c.tone(bx,y,'wood',4 if face=='r' else 3); c.tone(bx+(1 if face=='l' else -1)*0,y,'wood',4 if face=='r' else 3)
        for y in range(1,8): c.tone(bx+(-1 if face=='l' else 1),y,'wood',2) if y in(1,4,7) else None
        legs(12,15,(4,11))
        if face=='r':
            for y in range(1,11): c.tone(4,y,'wood',4); c.tone(5,y,'wood',2)
        else:
            for y in range(1,11): c.tone(11,y,'wood',3); c.tone(10,y,'wood',2)
    return c
def stool():
    c=C(16,16,seed=315); c.shadow(8,14.5,5,1.2); c.group(1); c.new()
    for x,y in ((4,10),(4,11),(4,12),(4,13),(11,10),(11,11),(11,12),(11,13),(8,11),(8,12),(8,13),(8,14)): c.tone(x,y,'wood',2)
    c.group(2); c.new()
    for y in range(5,11):
        for x in range(2,14):
            dx=(x+0.5-8)/6; dy=(y+0.5-7.5)/2.6
            if dx*dx+dy*dy<=1: c.tone(x,y,'wood',5 if dy<-0.3 and dx<0.3 else (4 if dy<0.5 else 2))
    return c
def bench(w=2):
    W=w*16; c=C(W,16,seed=316); c.shadow(W/2,14.5,W/2-2,1.2); c.group(1); c.new()
    for x in (3,4,W-5,W-4):
        for y in range(10,15): c.tone(x,y,'wood',2 if x in(3,W-5) else 1)
    c.group(2); c.new(); _planktop(c,1,4,W-2,5)
    for x in range(1,W-1): c.tone(x,9,'wood',2); c.tone(x,10,'wood',1)
    return c
def cabinet(kind):
    # tall furniture stands on the floor row and rises over the wall face behind it (2x2)
    c=C(32,32,seed=320+len(kind)); c.group(1); c.new()
    x0,x1=2,29
    top={'cupboard':4,'wardrobe':1,'bookshelf':3}[kind]
    for y in range(top,31):
        for x in range(x0,x1+1): c.tone(x,y,'wood',3)
    for x in range(x0-1,x1+2):
        c.tone(x,top,'wood',5); c.tone(x,top+1,'wood',4); c.tone(x,top+2,'wood',2)
    for y in range(top,31): c.tone(x0,y,'wood',4); c.tone(x1,y,'wood',2)
    for x in range(x0,x1+1): c.tone(x,30,'wood',1); c.tone(x,29,'wood',2)
    c.group(2); c.new()
    if kind=='bookshelf':
        for sy in (6,14,22):
            for x in range(x0+2,x1-1):
                for y in range(sy,sy+7): c.tone(x,y,'wood',1)
            x=x0+2; i=sy
            while x<x1-2:
                m=('red','slate','leaf','gold','clay')[(x*3+i)%5]; h=5+((x+i)%3==0)-((x+i)%4==0)
                if (x+i)%7==3: x+=2; continue
                for y in range(sy+7-h,sy+7):
                    c.tone(x,y,m,4); c.tone(x+1,y,m,3)
                c.tone(x,sy+8-h,m,5); c.tone(x,sy+9-h,'gold',5) if h>4 else None
                x+=2
            for x in range(x0+1,x1): c.tone(x,sy+7,'wood',4)
    elif kind=='cupboard':
        # open plate rack above, two doors and a drawer below (a kitchen dresser)
        for x in range(x0+2,x1-1):
            for y in range(8,17): c.tone(x,y,'wood',1)
        for x in range(x0+1,x1): c.tone(x,16,'wood',4); c.tone(x,17,'wood',2)
        for i,cx in enumerate((8,15.5,23)):
            c.group(10+i); c.new()
            for y in range(8,16):
                for x in range(int(cx)-3,int(cx)+4):
                    if (x+0.5-cx)**2/12+(y+0.5-12)**2/12<=1: c.tone(x,y,'plaster',4 if (x+0.5-cx)**2/12+(y+0.5-12)**2/12>0.5 else 3)
            c.tone(int(cx)-1,10,'plaster',5)
        c.group(3); c.new()
        for x in range(x0+1,x1): c.tone(x,19,'wood',1); c.tone(x,20,'wood',4)
        for y in range(20,29): c.tone(16,y,'wood',1)
        for x,y in ((13,24),(19,24)): c.tone(x,y,'gold',5); c.tone(x,y+1,'gold',3)
    else:
        for y in range(5,28): c.tone(16,y,'wood',1); c.tone(17,y,'wood',4)
        for (a,b) in ((5,14),(19,28)):
            for x in range(a,b): c.tone(x,6,'wood',2); c.tone(x,26,'wood',4)
            for y in range(6,27): c.tone(a,y,'wood',2); c.tone(b-1,y,'wood',4)
        for x in range(x0,x1+1): c.tone(x,1,'gold',4)
        for x,y in ((14,16),(19,16)): c.tone(x,y,'gold',5); c.tone(x,y+1,'gold',3)
    return c
def chest():
    c=C(16,16,seed=330); c.shadow(8,14.5,7,1.2); c.group(1); c.new()
    for y in range(3,14):
        for x in range(1,15):
            if y<7: t=5 if y==3 else 4
            else: t=3 if y<13 else 2
            c.tone(x,y,'wood',t)
    for x in range(1,15): c.tone(x,7,'wood',1)
    for x in (3,12):
        for y in range(3,14): c.tone(x,y,'gold',4 if y<7 else 3)
    for y in range(7,11): c.tone(7,y,'gold',5); c.tone(8,y,'gold',3)
    c.tone(7,9,'dark',1)
    return c
def bed(w):
    W=w*16; c=C(W,32,seed=335+w); c.shadow(W/2,30.5,W/2-2,1.2)
    c.group(1); c.new()
    for x in range(1,W-1):                    # headboard against the wall
        for y in range(0,8): c.tone(x,y,'wood',(5 if y==0 else 4) if x in(1,2,W-3,W-2) else (3 if y<6 else 2))
    for x in range(3,W-3): c.tone(x,1,'wood',4)
    c.group(2); c.new()
    for x in range(2,W-2):                    # mattress + sheet fold + blanket
        for y in range(7,27):
            if y<14: c.tone(x,y,'plaster',4 if y>8 else 5)
            elif y<16: c.tone(x,y,'plaster',5 if y==14 else 3)
            else: c.tone(x,y,'red' if w==1 else 'slate',(5 if y==16 else 4) if x>3 else 3)
    for x in range(2,W-2): c.tone(x,26,'red' if w==1 else 'slate',2)
    for y in range(16,27): c.tone(W-3,y,'red' if w==1 else 'slate',3)
    if w==2:
        for y in range(18,26): c.tone(W//2,y,'slate',3)
    for i in range(w):                        # pillows
        c.group(10+i); c.new(); px0=4+i*16
        for y in range(8,13):
            for x in range(px0,px0+(8 if w==1 else 10)+(0 if w==1 else 0)):
                if x<W-3: c.tone(x,y,'plaster',6 if y<10 else 5)
    c.group(3); c.new()
    for x in range(1,W-1):                    # footboard front
        for y in range(27,31): c.tone(x,y,'wood',4 if y==27 else (2 if y<30 else 1))
    return c
def pots():
    c=C(16,16,seed=340); c.shadow(8,14.6,7,1.3)
    for g,(cx,top,bot,r,neck) in enumerate(((5.5,3,14,4.6,2.2),(12,7,14,3.2,1.6))):
        c.group(g); c.new()
        for y in range(top+1,bot+1):
            f=(y-top)/(bot-top); rr=neck+(r-neck)*math.sin(min(1,f*1.7)*math.pi/2)-(0.8 if f>0.9 else 0)
            for x in range(int(cx-rr)-1,int(cx+rr)+2):
                dx=(x+0.5-cx)/rr
                if abs(dx)<=1: c.setv(x,y,'clay',c.shade(dx,0.1,math.sqrt(1-dx*dx),0.3)+(0.1 if g==0 else 0))
        for x in range(int(cx-neck-1),int(cx+neck+1)+1): c.tone(x,top,'clay',5); c.tone(x,top+1,'clay',3)
        for x in range(int(cx-neck),int(cx+neck)+1): c.tone(x,top+1 if g else top+1,'dark',1) if abs(x+0.5-cx)<neck else None
        yb=top+int((bot-top)*0.55)
        for x in range(int(cx-r)+1,int(cx+r)): c.tone(x,yb,'clay',2) if g==0 else None
    return c
def candles():
    c=C(16,16,seed=341); c.group(1); c.new()
    for x in range(3,13): c.tone(x,13,'gold',4 if x<8 else 3); c.tone(x,14,'gold',2)
    for y in range(9,13): c.tone(7,y,'gold',4); c.tone(8,y,'gold',3)
    for x in range(3,13): c.tone(x,9,'gold',4 if x<8 else 2)
    for g,x in enumerate((3,7,11)):
        c.group(10+g); c.new(); top=4 if x==7 else 5
        for y in range(top,9): c.tone(x,y,'cream',6); c.tone(x+1,y,'cream',4)
        c.tone(x,top-1,'fire',6); c.tone(x,top-2,'fire',4); c.tone(x+1,top-1,'fire',3)
    return c
def plant():
    c=C(16,16,seed=342); c.shadow(8,14.6,5,1.2); c.group(1); c.new()
    for y in range(10,15):
        for x in range(4+(y>12),12-(y>12)): c.tone(x,y,'clay',(5 if x<7 else 3) if y>10 else 2)
    for x in range(4,12): c.tone(x,10,'clay',4)
    c.group(2)
    for (cx,cy,rx,ry) in ((8,5,4,3.5),(4.5,7.5,3,2.5),(11.5,7.5,3,2.5),(8,2.5,2.5,2)):
        c.ellipsoid(cx,cy,rx,ry,'leaf',amb=0.3,bump=0.5)
    return c
def counter(mask,bottles=False):
    # bar counter cell from the N/E/S/W neighbour mask: top face = centre + arms, front face under exposed top edges
    c=C(16,16,seed=350); c.group(1); c.new()
    top=set()
    for y in range(1,8):
        for x in range(2,14): top.add((x,y))
    if 'N' in mask:
        for y in range(0,1):
            for x in range(2,14): top.add((x,y))
    if 'S' in mask:
        for y in range(8,16):
            for x in range(2,14): top.add((x,y))
    if 'E' in mask:
        for y in range(1,8):
            for x in range(14,16): top.add((x,y))
    if 'W' in mask:
        for y in range(1,8):
            for x in range(0,2): top.add((x,y))
    for (x,y) in top:
        t=4 if (y%3) else 5
        if (x,y-1) not in top and 'N' not in mask: t=6
        c.tone(x,y,'wood',t)
    for (x,y) in list(top):
        if (x,y+1) not in top and y<15:
            for k in range(1,9):
                if y+k>15: break
                c.tone(x,y+k,'wood',(2 if k==1 else (1 if (x%5==0 or k==8) else 3)) if True else 3)
    # side edges of the top face
    for (x,y) in top:
        if (x-1,y) not in top and 'W' not in mask: c.tone(x,y,'wood',5)
        if (x+1,y) not in top and 'E' not in mask: c.tone(x,y,'wood',3)
    if bottles:
        for g,(x,m) in enumerate(((3,'leaf'),(6,'cryst'),(10,'red'))):
            c.group(10+g); c.new()
            for y in range(0,5): c.tone(x,y,m,4); c.tone(x+1,y,m,3)
            c.tone(x,-1+1,m,5); c.tone(x,0,'wood',2)
        c.group(20); c.new()
        for y in range(3,6):
            for x in (12,13): c.tone(x,y,'plaster',5 if x==12 else 3)
    return c
MASKS=['','N','E','S','W','NE','NS','NW','ES','EW','SW','NES','NEW','NSW','ESW','NESW']
for m in MASKS: reg('counter.'+(m.lower() or 'o'),(lambda m=m: counter(m)))
for m in ('EW','E','W'): reg('counter.%s.bottles'%m.lower(),(lambda m=m: counter(m,True)))
def stove():
    c=C(32,32,seed=360); c.group(1); c.new()
    for y in range(0,12):                     # iron flue up the wall face
        for x in range(13,19): c.tone(x,y,'iron',(4 if x<15 else 2) if y%5 else 1)
    c.group(2); c.new()
    for y in range(12,30):
        for x in range(3,29):
            if y<16: c.tone(x,y,'iron',5 if y==12 else 4)
            else: c.tone(x,y,'stone',2 if (y+(x//6))%4==0 else 3)
    for y in range(12,30): c.tone(3,y,'stone',4); c.tone(28,y,'stone',1)
    c.group(3); c.new()
    for y in range(19,27):
        for x in range(8,24):
            c.tone(x,y,'iron',1 if x in(8,23) or y in(19,26) else ('fire',)[0] and 0)
            if not(x in(8,23) or y in(19,26)): c.tone(x,y,'fire',(5 if 12<x<19 and y>22 else 3) if y>21 else 2)
    for x in range(9,23,3):
        for y in range(20,26): c.tone(x,y,'iron',1)
    c.group(4); c.new()                        # pot on the hob
    for y in range(7,14):
        for x in range(18,27):
            dx=(x+0.5-22.5)/4.5
            if abs(dx)<=1: c.tone(x,y,'iron',2 if y>8 else 4)
    for x in range(18,27): c.tone(x,7,'iron',5)
    return c
def stairs_up():
    # steps climb from the floor toward the back wall, ending in a dark landing opening (2 wide, 3 tall: face x2 + floor)
    c=C(32,48,seed=370); c.group(1); c.new()
    for y in range(0,48):
        for x in range(1,31):
            if x in(1,2,29,30): c.tone(x,y,'wood',4 if x<3 else 2); continue
            if y<8: c.tone(x,y,'dark',1); continue
            k=(y-8)%5
            depth=(y-8)/40
            c.tone(x,y,'wood',(1 if k==4 else (5 if k==0 else 4)) if depth>0.45 else (1 if k==4 else (4 if k==0 else 3)))
    for y in range(8,48): c.tone(3,y,'wood',2); c.tone(28,y,'wood',1)
    for y in range(0,8): c.tone(3,y,'wood',1)
    return c
def stairs_down():
    # an opening in the floor: rim + steps going down toward the back, darker the deeper
    c=C(32,32,seed=371); c.group(1); c.new()
    for y in range(2,31):
        for x in range(1,31):
            rim=x in(1,2,29,30) or y in(2,3,29,30)
            if rim: c.tone(x,y,'stone',5 if (y in(29,30) or x in(1,2)) and not y in(2,3) else 3); continue
            k=(28-y)%5; depth=(28-y)/25
            if depth>0.8: c.tone(x,y,'dark',1); continue
            t=(4 if depth<0.3 else 3 if depth<0.55 else 2)
            c.tone(x,y,'stone',t+1 if k==0 else (1 if k==4 else t))
    for y in range(4,29): c.tone(3,y,'stone',1); c.tone(28,y,'stone',1)
    return c
def crate_(): return pi.crate()
def crates_(): return pi.crates()
reg('table.sq',lambda:table(2),2,2); reg('table.long',lambda:table(3),3,2)
for f in 'dulr': reg('chair.'+f,(lambda f=f: chair(f)))
reg('stool',stool); reg('bench',bench,2,1)
reg('cupboard',lambda:cabinet('cupboard'),2,2); reg('wardrobe',lambda:cabinet('wardrobe'),2,2); reg('bookshelf',lambda:cabinet('bookshelf'),2,2)
reg('chest',chest); reg('bed.single',lambda:bed(1),1,2); reg('bed.double',lambda:bed(2),2,2)
reg('barrels',pf.barrels,2,2); reg('cauldron',pf.cauldron); reg('pots',pots); reg('candles',candles); reg('plant',plant)
reg('crate',crate_); reg('crates',crates_,2,2); reg('sacks',pi.sacks)
reg('stove',stove,2,2); reg('stairs.up',stairs_up,2,3); reg('stairs.down',stairs_down,2,2)

def render(name):
    im=P[name]().img(); return fix_shadow(im)

# ---------------- room builder ----------------
def room(w,h,style='tim',notch=None,floor='wood',exit=None):
    """w x h cells incl. walls. notch=(corner,nw,nh) cuts a rectangle from 'tl'/'tr'/'bl'/'br' -> L-shaped room.
    Returns a grid of piece names ('' = void). Layout: wall-top band ring (47-set), 2-cell face under every band
    that has room below it, floor with baked shadow variants, optional exit=(x) doorway in the bottom band."""
    R=[[True]*w for _ in range(h)]
    if notch:
        cn,nw,nh=notch
        xs=range(0,nw) if cn[1]=='l' else range(w-nw,w); ys=range(0,nh) if cn[0]=='t' else range(h-nh,h)
        for y in ys:
            for x in xs: R[y][x]=False
    def inR(x,y): return 0<=x<w and 0<=y<h and R[y][x]
    I=[[inR(x,y) and all(inR(x+dx,y+dy) for dx in(-1,0,1) for dy in(-1,0,1)) for x in range(w)] for y in range(h)]
    def inI(x,y): return 0<=x<w and 0<=y<h and I[y][x]
    G=[['']*w for _ in range(h)]; kind=[['']*w for _ in range(h)]
    for y in range(h):
        for x in range(w):
            if inR(x,y) and not inI(x,y): kind[y][x]='T'
            elif inI(x,y):
                if kind[y-1][x]=='T': kind[y][x]='U'
                elif kind[y-1][x]=='U': kind[y][x]='B'
                else: kind[y][x]='F'
    if exit is not None:
        kind[h-1][exit]='X'
    D={'N':(0,-1),'E':(1,0),'S':(0,1),'W':(-1,0),'NE':(1,-1),'NW':(-1,-1),'SE':(1,1),'SW':(-1,1)}
    def k(x,y): return kind[y][x] if 0<=x<w and 0<=y<h else ''
    for y in range(h):
        for x in range(w):
            t=kind[y][x]
            if t=='T':
                o={d for d,(dx,dy) in D.items() if k(x+dx,y+dy) in('U','B','F','X')}
                G[y][x]='top.%s.%s'%(style,band_key(o))
            elif t in('U','B'):
                l=k(x-1,y)=='T'; r=k(x+1,y)=='T'
                end='lr' if l and r else 'l' if l else 'r' if r else ('post' if style!='sto' and (x%4==0) else 'm')
                G[y][x]='wall.%s.%s.%s'%(style,'u' if t=='U' else 'b',end)
            elif t in('F','X'):
                n=k(x,y-1) in('B','T'); wv=k(x-1,y)=='T'; cr=k(x-1,y-1) in('T','B') and not n and not wv
                code=('n' if n else '')+('w' if wv else '')
                if not code and cr: code='c'
                G[y][x]='floor.%s%s'%(floor,'.s'+code if code else '')
    return G
def compose(G,objs=()):
    h=len(G); w=len(G[0]); o=Image.new('RGBA',(w*16,h*16),(12,8,18,255))
    cache={}
    def get(n):
        if n not in cache: cache[n]=render(n)
        return cache[n]
    for y in range(h):
        for x in range(w):
            if G[y][x]: o.alpha_composite(get(G[y][x]),(x*16,y*16))
    for (n,x,y) in sorted(objs,key=lambda t:t[2]+SIZE[t[0]][1]):
        o.alpha_composite(get(n),(x*16,y*16))
    return o

# ---------------- sheet ----------------
def bake(out='interior-chipset.png',idx='interior-index.json',per=30):
    cells=[]; index={}
    for name in P:
        im=render(name); cw,ch=SIZE[name]
        if im.size!=(cw*16,ch*16): im=im.crop((0,0,cw*16,ch*16))
        # multi-cell pieces stay in one block so they read as a whole; wrap to next row if needed
        cells.append((name,im,cw,ch))
    col=0; row=0; rowh=1; place=[]
    for name,im,cw,ch in cells:
        if col+cw>per: col=0; row+=rowh; rowh=1
        place.append((name,im,col,row)); index[name]={'col':col,'row':row,'w':cw,'h':ch}
        col+=cw; rowh=max(rowh,ch)
    H=(row+rowh)*16; sheet=Image.new('RGBA',(per*16,H))
    for name,im,cx,cy in place: sheet.alpha_composite(im,(cx*16,cy*16))
    sheet.save(out); json.dump(index,open(idx,'w'),ensure_ascii=False,indent=0)
    return sheet,index
if __name__=='__main__':
    s,i=bake(); print(s.size,len(i))

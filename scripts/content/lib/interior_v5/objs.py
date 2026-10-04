# ~200 interior objects. Each registry entry: name -> (category, builder) ; builder() -> kit.F
import sys; sys.path.insert(0,'/tmp/j8v5')
from prim import *
import kit, p1, p2, p3, p4, p5
F=kit.F
OBJ={}
def reg(name,cat):
    def d(f): OBJ[name]=(cat,f); return f
    return d
def canvas(w,h): return Pix(w,h)
# ---------- containers of goods (the combinatorial part: each is a distinct stock item in a shop) ----------
def crate_of(goods,seed=1,mat='pine'):
    # open crate: rim (dark edge + lit top), dark inside with the goods heaped, plank front face, black base
    p=canvas(16,16); Rm=R(mat)
    for yy in range(3,16):
        for xx in range(1,15):
            if yy==3: t=1
            elif xx in (1,14): t=1 if yy<10 else 0
            elif yy==4: t=6
            elif yy<9: t=2 if xx in (2,13) else 1
            elif yy==9: t=6
            elif yy==10: t=2
            elif yy==15: t=0
            else: t=4 if (yy-11)%2==0 else 3
            if yy>=11 and xx in (2,13) and yy<15: t=5 if xx==2 else 2
            p.set(xx,yy,Rm[t])
    heap(p,2,1,12,8,goods,seed)
    for xx in range(2,14): p.set(xx,9,Rm[6])
    return F(p.im,1,1,0,'floor')
def basket_of(goods,seed=2):
    p=canvas(16,16); S=M['straw']
    for yy in range(7,15):
        half=6 if yy<13 else 5
        for xx in range(8-half,8+half):
            t=4 if (xx+yy)%2 else 3
            if yy==7: t=5
            if yy==8: t=2 if 8-half<xx<8+half-1 else 1
            if xx in (8-half,8+half-1): t=1
            if yy==14: t=1
            p.set(xx,yy,S[t])
    for xx in range(3,13): p.set(xx,8,S[1])
    heap(p,3,2,10,7,goods,seed)
    for xx in range(2,14): p.set(xx,7,S[5] if xx%2 else S[4])
    return F(p.im,1,1,0,'floor')
def barrel_of(goods,seed=3):
    p=canvas(16,16)
    cylinder(p,2,7,12,9,'wood',bands=(2,6))
    ellipse_top(p,8,6,6,3,'wood',inner='black')
    heap(p,3,1,10,6,goods,seed)
    for xx in range(3,13): p.set(xx,9,WOOD[2])
    return F(p.im,1,1,0,'floor')
def shelf_of(goods,seed=4):
    p=canvas(16,16)
    hang_board(p,1,6,14); hang_board(p,1,13,14)
    heap(p,1,0,14,6,goods,seed,1.0) if False else None
    for row,yb in ((0,6),(1,13)):
        xx=2; i=0
        while True:
            f,a,b=G[goods[(i+row)%len(goods)]]
            if xx+a>14: break
            f(p,xx,yb-b); xx+=a+1; i+=1
    return F(p.im,1,0,0,'hang')
def cabinet_of(goods,seed=5,mat='wood'):
    # open standing shelf unit 1 cell, 16 px up the wall face
    p=canvas(16,32); Rm=R(mat)
    for yy in range(32):
        for xx in range(16):
            if yy<3: t=[1,6,3][yy] if 0<xx<15 else 1
            elif xx in (0,15): t=0
            elif xx==1: t=4
            elif xx==14: t=2
            elif yy>=30: t=0 if yy==31 else 3
            else: t=1
            p.set(xx,yy,Rm[t])
    for yb in (12,21,29):
        for xx in range(1,15): p.set(xx,yb,Rm[6]); p.set(xx,yb+1,Rm[2])
    for yb in (12,21,29):
        xx=2; i=int(H(yb,0,seed)*len(goods))
        while True:
            f,a,b=G[goods[i%len(goods)]]
            if xx+a>14: break
            f(p,xx,yb-b); xx+=a+(1 if H(xx,yb,seed)<0.5 else 0); i+=1
    return F(p.im,1,1,16,'wall')
def table_of(goods,wc=2,seed=6,cloth=None):
    W=wc*16; p=canvas(W,16)
    if cloth:
        Cm=M[cloth]
        box(p,0,2,W,8,4,'wood',panel=False)
        for yy in range(3,12):
            for xx in range(1,W-1):
                t=5 if yy<10 else 3
                if yy==3: t=6
                if yy>=10 and xx%4==0: t=2
                p.set(xx,yy,Cm[t])
        legs(p,0,12,W,4)
    else:
        fy=box(p,0,2,W,8,4,'wood',panel=False); legs(p,0,fy+4,W,16-fy-4)
    heap(p,3,1,W-6,6,goods,seed,0.75)
    return F(p.im,wc,1,0,'floor')
def sack_of(goods,seed=7):
    p=canvas(16,16); S=M['straw']
    lit(p,2,6,['  1111111   ',' 144444441  ','14555554441 ','14555544431 ','14454444321 ','12344433321 ',' 11222222 1 ','  11111111  '],S)
    cavity(p,4,6,8,2,'straw')
    heap(p,4,2,8,5,goods,seed)
    return F(p.im,1,1,0,'floor')
def hang_of(good,n=3,seed=8):
    # goods hanging from a wall rail on strings (fish, herbs, sausages, hams)
    p=canvas(16,16)
    for xx in range(0,16): p.set(xx,1,WOOD[6]); p.set(xx,2,WOOD[2])
    f,a,b=G[good]
    for i in range(n):
        x0=1+i*(15//n)+max(0,(15//n-a)//2); p.set(x0+a//2,3,M['straw'][2]); p.set(x0+a//2,4,M['straw'][2])
        f(p,x0,5+(i%2))
    return F(p.im,1,0,0,'hang')
STOCK={
 'veg':[['cabbage'],['carrot'],['tomato'],['pumpkin'],['potato'],['onion'],['eggplant'],['apple'],['lemon'],['grape']],
 'fish':[['fish'],['fishr'],['fishg'],['squid'],['crab'],['shell'],['fish','ice']],
 'bake':[['loaf'],['baguette'],['bun'],['pie'],['cake']],
 'pharm':[['potion','potionb','potiong'],['herb'],['vial','flask'],['jar','jarb','jarg'],['mushroom'],['flower']],
 'misc':[['book','bookb','bookg'],['scroll'],['gem','gemr'],['coins'],['yarn','yarnb','yarny'],['bolt','boltg','boltr'],['bottle','bottler','bottley'],['candle'],['cheese'],['egg'],['ham'],['sausage'],['steak'],['ingot','ingotg'],['horseshoe'],['wool'],['toy'],['skull','crystal']],
}
for cat,lists in STOCK.items():
    for gl in lists:
        nm='+'.join(gl)
        if cat in ('veg','fish','bake'): reg(f'crate:{nm}',cat)(lambda gl=gl:crate_of(gl))
        if cat in ('veg','bake','pharm') or gl[0] in ('egg','wool','yarn','fish','shell'): reg(f'basket:{nm}',cat)(lambda gl=gl:basket_of(gl))
        if cat in ('fish',) or gl[0] in ('apple','potato','grape'): reg(f'barrel:{nm}',cat)(lambda gl=gl:barrel_of(gl))
        if cat in ('pharm','misc') and gl[0] not in ('ham','steak','egg','wool','horseshoe','sausage'): reg(f'shelf:{nm}',cat)(lambda gl=gl:shelf_of(gl))
        if cat in ('pharm','bake','misc') and gl[0] in ('potion','jar','vial','loaf','bun','pie','book','bottle','cheese','bolt','candle','toy','gem'): reg(f'cabinet:{nm}',cat)(lambda gl=gl:cabinet_of(gl))
for g in ('potato','onion','wool','straw'):
    pass
reg('sack:grain','bake')(lambda:sack_of(['potato']))
reg('sack:flour','bake')(lambda:sack_of(['egg']))
for g,n in (('fish',2),('herb',3),('sausage',2),('ham',3),('mushroom',3),('onion',3),('flower',3),('fishr',2)):
    reg(f'hang:{g}',{'fish':'fish','fishr':'fish','ham':'butcher','sausage':'butcher'}.get(g,'pharm'))(lambda g=g,n=n:hang_of(g,n))
for gl,cl in ((['loaf','bun'],None),(['cake','pie'],'linen'),(['fish','fishr'],None),(['potion','flask'],'purple'),(['plate','cup'],'linen'),(['book','scroll'],'green'),(['mug','bottle'],None),(['steak','ham'],None),(['gem','coins'],'red'),(['bolt','yarn'],None)):
    reg(f'table:{"+".join(gl)}',{'loaf':'bake','cake':'bake','fish':'fish','potion':'pharm','steak':'butcher'}.get(gl[0],'home'))(lambda gl=gl,cl=cl:table_of(gl,2,cloth=cl))

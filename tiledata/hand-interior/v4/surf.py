# furniture with a usable top surface (F.surf = x0,y0,x1,y1 in F.im pixels) + builder for things ON it
from anim import *
def S(f,rect,id=None): f.surf=rect; f.id=id; return f
def plain_table(wc=2,hc=1): 
    f=kit.table(wc,hc); top=hc*16-6; return S(f,(2,2,wc*16-3,top-1),f'table {wc}x{hc}')
def plain_counter(wc=3):
    f=F(p4.counter(wc),wc,1,8,'floor'); return S(f,(2,1,wc*16-3,6),f'counter {wc}')
def plain_desk():
    p=canvas(32,16); fy=box(p,0,2,32,8,6,'dwood',panel=True); panels(p,20,fy+1,10,4,'dwood',drawers=1); legs(p,0,fy+6,32,16-fy-6,'dwood')
    return S(F(p.im,2,1,0,'floor'),(2,3,29,9),'desk')
def plain_worktable(mat='pine'):
    p=canvas(32,16); fy=box(p,0,2,32,8,4,mat,panel=False); legs(p,0,fy+4,32,16-fy-4,mat)
    return S(F(p.im,2,1,0,'floor'),(2,3,29,9),'work table '+mat)
def side_table():
    p=canvas(16,16); fy=box(p,1,3,14,7,3,'wood',panel=False); legs(p,1,fy+3,14,16-fy-3)
    return S(F(p.im,1,1,0,'floor'),(3,4,12,9),'side table')
def tea_table():
    p=canvas(16,16); fy=box(p,1,4,14,6,3,'white',panel=False); legs(p,1,fy+3,14,16-fy-3,'wood')
    for yy in range(5,10):
        for xx in range(2,14): p.set(xx,yy,M['red'][4] if ((xx//2+yy//2)%2) else M['red'][5])
    return S(F(p.im,1,1,0,'floor'),(2,5,13,9),'tea table')
def nightstand():
    p=canvas(16,24); fy=box(p,2,8,12,4,10,'wood',panel=False); panels(p,3,fy+2,10,6,'wood',drawers=2)
    return S(F(p.im,1,1,8,'floor'),(3,9,12,11),'nightstand')
def dresser():
    f=F(p2.dresser(),1,1,8,'wall'); return S(f,(2,1,13,4),'cupboard')
def bar_counter(wc):
    return plain_counter(wc)
def altar():
    p=canvas(32,24); fy=box(p,0,2,32,10,12,'marble',panel=True)
    for yy in range(3,20):
        for xx in range(10,22): p.set(xx,yy,M['purple'][4 if xx<16 else 3] if yy>3 else M['purple'][5])
    for yy in range(12,18): p.set(15,yy,M['gold'][5]); p.set(16,yy,M['gold'][3])
    for xx in range(13,19): p.set(xx,14,M['gold'][5])
    return S(F(p.im,2,1,8,'wall'),(2,3,29,11),'altar')
def sewing_table():
    f=plain_worktable('wood'); return f
def kitchen_table():
    f=plain_worktable('pine'); return f

# surface furniture joins the catalogue (replacing the versions with goods baked in)
for wc,hc in ((1,1),(2,1),(3,1),(2,2)): OBJ[f'table {wc}x{hc}']=('home',lambda wc=wc,hc=hc:plain_table(wc,hc))
for wc in (2,3,4,5,6): OBJ[f'counter {wc}']=('shop',lambda wc=wc:plain_counter(wc))
OBJ['desk']=('study',plain_desk); OBJ['writing desk']=('study',plain_desk)
for m in ('pine','wood','dwood'): OBJ['work table '+m]=('home',lambda m=m:plain_worktable(m))
OBJ['side table']=('home',side_table); OBJ['tea table']=('home',tea_table); OBJ['nightstand']=('home',nightstand)
OBJ['cupboard']=('home',dresser); OBJ['altar']=('church',altar)
OBJ.pop('nightstand lamp',None)
def ice_chest(goods,mat='pine'):
    p=canvas(32,16); fy=box(p,0,3,32,8,5,mat,panel=False)
    for yy in range(5,10):
        for xx in range(2,30): p.set(xx,yy,M['ice'][5] if (xx+yy)%3 else M['ice'][4])
    heap(p,3,3,26,6,goods,5)
    f=F(p.im,2,1,0,'floor'); f.id='ice chest:'+'+'.join(goods); return f
for gl,c in ((['fish','fishr','fish'],'fish'),(['fish','fishg','fishr'],'fish'),(['squid','crab','shell'],'fish'),(['steak','ham','sausage'],'butcher'),(['ham','steak','ham'],'butcher')):
    OBJ['ice chest:'+'+'.join(gl)]=(c,lambda gl=gl:ice_chest(gl))

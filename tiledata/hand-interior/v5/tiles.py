# floors / wall faces / ceiling, hand-painted by rule. RTP lessons: floors 4 quiet tones (low contrast), joints darkest,
# board ends as a 3-px darker streak; wall courses with a lit top row and a dark mortar row; wall face = 32 px.
from k import *
from p2 import R_
PLANK=R_('#6a4630','#7c5638','#8a6442','#96704c','#a27c56')          # honey oak, quiet
FLAG=R_('#3e3a40','#4e4a52','#5e5a60','#68646a','#726e74','#7e7a80')
BRICK=R_('#2e2630','#463a44','#5a4c56','#6c5c66','#7c6c74','#8e7e84')
PLAST=R_('#8a7a60','#a8987a','#b8a888','#c6b696','#d2c4a4','#ddd0b2')
LOG=R_('#2a1606','#4a2a10','#6a3e1c','#86542a','#a06a38','#b88048')
def img(w,h,f):
    p=Pix(w,h)
    for y in range(h):
        for x in range(w): p.set(x,y,f(x,y))
    return p.im
def plank(x,y,seed=3):
    # 4-row boards: 3 face rows + a joint; boards 24..40 px long, staggered per row; each board its own base tone
    row=y//4; ly=y%4
    if ly==3: return PLANK[1] if H(x,row,seed)<0.8 else PLANK[0]
    off=int(H(row,0,seed+1)*32); L=32
    k=(x+off)//L; lx=(x+off)%L
    if lx==0: return PLANK[1]
    base=3 if H(row,k,seed+7)<0.5 else 2
    t=base+1 if (ly==0 and base==2) else base
    if H((x+off)//4,y,seed+2)<0.12: t=base-1 if base==3 else base+1
    return PLANK[max(1,min(4,t))]
def flag(x,y,seed=5):
    # flagstones 12x8 staggered (tile repeats every 48 px across 3 tiles is too big, so 16x8 with a half stagger),
    # each slab its own quiet tone, dark joint right/bottom, lit top row, sparse speckle
    sy=y//8; off=8 if sy%2 else 0; lx=(x+off)%16; ly=y%8; slab=((x+off)//16,sy)
    if ly==7 or lx==15: return FLAG[1]
    base=[2,3,3,4][int(H(slab[0],sy,seed)*4)]
    t=base+1 if ly==0 and lx<14 else base
    if lx==0 and ly>0: t=base
    r=H(x,y,seed+1)
    if r<0.08: t=base-1
    elif r>0.95: t=base+1
    return FLAG[max(1,min(5,t))]
def brick_face(x,y,seed=7):
    # 32-px stone face: 4-px courses: lit top row, two body rows, mortar; stagger 4; bottom plinth
    if y>=29: return BRICK[3] if y==29 else BRICK[0]
    c=y//4; ly=y%4; lx=(x+(4 if c%2 else 0))%8
    if ly==3 or lx==7: return BRICK[0] if ly==3 else BRICK[1]
    t=4 if ly==0 else 3
    if lx==0: t=5 if ly==0 else 4
    if H(x,y,seed)<0.1: t-=1
    return BRICK[t]
def plaster_face(x,y,seed=9):
    # beam under the ceiling, plaster, mid rail, wainscot planks, skirting
    if y<3: return [WOOD[1],WOOD[2],WOOD[3]][y]
    if y==3: return PLAST[0]
    if y in (14,15): return WOOD[7] if y==14 else WOOD[3]
    if y==16: return WOOD[1]
    if y>=17:           # wainscot: vertical boards 4 px, lit left edge
        if y>=29: return WOOD[6] if y==29 else (WOOD[3] if y==30 else WOOD[1])
        bx=x%4
        return WOOD[5] if bx==0 else (WOOD[2] if bx==3 else (WOOD[4] if (y+x)%9 else WOOD[5]))
    t=4 if y>5 else 3
    if H(x//2,y//2,seed)<0.14: t-=1
    if H(x,y,seed+1)<0.05: t+=1
    return PLAST[t]
def log_face(x,y,seed=11):
    if y>=29: return WOOD[2] if y==29 else WOOD[0]
    ly=y%7
    t=[2,4,5,4,3,2,0][ly]
    if ly in (1,2,3) and H(x//4,y,seed)<0.2: t-=1
    return LOG[t]
FLOORS={'plank':img(16,16,plank),'flag':img(16,16,flag)}
FACES={'plaster':img(16,32,plaster_face),'stone':img(16,32,brick_face),'log':img(16,32,log_face)}

FLOORFN={'plank':plank,'boards':plank,'flag':flag,'grey':flag,'cobble':flag}
DPLANK=R_('#3a2618','#4a3020','#563a26','#60422c','#6c4c32')
MARB=R_('#4a4854','#6a6874','#86848e','#a4a2aa','#b8b6bc','#c8c6cc')
def dplank(x,y,seed=13):
    global PLANK
    old=PLANK; PLANK=DPLANK
    try: return plank(x,y,seed)
    finally: PLANK=old
def check(x,y,seed=17):
    cx,cy=x//8,y//8; lx,ly=x%8,y%8; dark=(cx+cy)%2
    t=(2 if dark else 3)
    if lx==0 or ly==0: t+=1
    if lx==7 or ly==7: t-=1
    if H(x,y,seed)<0.06: t+=(-1 if dark else 1)
    return MARB[max(0,min(5,t))]
FLOORFN.update({'dplank':dplank,'check':check})

# v4 surfaces: kitchen tile floor + tiled kitchen wall, packed earth, sooty flags, oven-room stone floor.
# Same RTP rules as tiles.py: floors are quiet (4-5 tones inside ~25 luma), painted in WORLD coords; wall face = 32 px,
# lower half one step darker, bottom rows = skirting.
from k import *
from p2 import R_
import tiles as TL, room2
KT=R_('#8e8676','#a8a090','#b8b0a0','#c4bcac','#cec8b8','#dad4c4')          # pale glazed tile, warm white
EARTH=R_('#4a3624','#5a4430','#664e38','#70583f','#7a6246','#86704f')
SOOT=R_('#26242a','#322f36','#3c3a42','#46444c','#504e56','#5c5a62')
OVENF=R_('#3a3434','#4a4242','#564c4a','#605654','#6a605c','#766a66')        # warm grey stone, fire-side
def ktile(x,y,seed=21):
    # 8x8 tiles, 1px grout (right/bottom), each tile one tone, a lit top-left pixel row only on every other tile
    lx,ly=x%8,y%8; tx,ty=x//8,y//8
    if lx==7 or ly==7: return KT[1]
    base=3 if H(tx,ty,seed)<0.55 else 4
    if ly==0 and lx<6 and (tx+ty)%2==0: return KT[base+1]
    if H(x,y,seed+1)<0.03: return KT[base-1]
    return KT[base]
def earth(x,y,seed=23):
    # packed earth: broad soft patches (4 tones), a few pebbles, no grid at all
    v=H(x//6,y//5,seed)*0.6+H(x//3,y//3,seed+1)*0.4
    t=2 if v<0.3 else (3 if v<0.72 else 4)
    r=H(x,y,seed+2)
    if r<0.012: return EARTH[5]
    if r<0.03: return EARTH[1]
    return EARTH[t]
def soot(x,y,seed=25):
    # flagstones like tiles.flag but dark and smudged: soot patches pull a slab one tone down
    sy=y//8; off=8 if sy%2 else 0; lx=(x+off)%16; ly=y%8; slab=((x+off)//16,sy)
    if ly==7 or lx==15: return SOOT[0]
    base=[2,3,3,4][int(H(slab[0],sy,seed)*4)]
    t=base+1 if ly==0 and lx<14 else base
    if H(x//4,y//3,seed+3)<0.22: t-=1
    if H(x,y,seed+1)<0.04: t-=1
    return SOOT[max(0,min(5,t))]
def ovenf(x,y,seed=27):
    # big irregular flags (16x12 staggered), warm grey
    sy=y//12; off=(sy*7)%16; lx=(x+off)%20; ly=y%12
    if ly==11 or lx==19: return OVENF[1]
    base=[2,3,3,4][int(H((x+off)//20,sy,seed)*4)]
    t=base+1 if ly==0 and lx<18 else base
    if H(x,y,seed+1)<0.06: t-=1
    return OVENF[max(1,min(5,t))]
def ktile_face(x,y,seed=29):
    # kitchen wall: plaster band on top, a dark rail, then glazed tiles (6 px rows, stagger 0), skirting
    if y<3: return [WOOD[1],WOOD[2],WOOD[3]][y]
    if y<12:
        t=4 if y>4 else 3
        if H(x//2,y//2,seed)<0.12: t-=1
        return KT[t]
    if y==12: return WOOD[6]
    if y==13: return WOOD[2]
    if y>=29: return KT[1] if y==29 else WOOD[1]
    ly=(y-14)%5; lx=x%8
    if ly==4 or lx==7: return KT[1]
    t=3 if y<22 else 2
    if ly==0: t+=1
    return KT[t]
def rubble_face(x,y,seed=31):
    # rough stone for oven room / smithy: irregular blocks 5-7 px tall, 8-12 wide, lit top, dark joints; lower half darker
    if y>=29: return TL.BRICK[3] if y==29 else TL.BRICK[0]
    rows=[0,6,11,17,23,29]; r=max(i for i,v in enumerate(rows) if v<=y); ly=y-rows[r]; hgt=rows[r+1]-rows[r]
    off=int(H(r,0,seed)*10); L=[10,12,9,11][r%4]; lx=(x+off)%L
    if ly==hgt-1 or lx==L-1: return TL.BRICK[0]
    t=4 if ly==0 else 3
    if lx==0: t=4
    if H((x+off)//L,r,seed+2)<0.35: t-=1
    if y>=16: t=max(1,t-1)
    if H(x,y,seed+1)<0.07: t-=1
    return TL.BRICK[max(1,t)]
def img(w,h,f): return TL.img(w,h,f)
NEWF={'ktile':ktile,'earth':earth,'soot':soot,'ovenf':ovenf}
NEWW={'ktile':img(16,32,ktile_face),'rubble':img(16,32,rubble_face)}
TL.FLOORFN.update(NEWF)
for k,v in NEWW.items(): room2.FACE[k]=v.load(); TL.FACES[k]=v

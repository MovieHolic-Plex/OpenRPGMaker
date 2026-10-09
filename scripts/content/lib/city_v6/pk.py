# batch 6e: village ground — dirt road and cobble plaza, drawn from the cell mask (any shape joins), lower layer
import sys, math; sys.path.insert(0,__import__('os').path.dirname(__import__('os').path.abspath(__file__)))
from px2 import C, vnoise, _hash, PAL, GRAIN
from PIL import Image
P={}; WATER=set()

def _edge_dist(mask,W,H,x,y):
    # distance in px from pixel (x,y) inside a road cell to the nearest non-road cell border (8-neighbour aware)
    cx,cy=x//16,y//16; fx,fy=x%16+0.5,y%16+0.5; d=99
    for dx in (-1,0,1):
        for dy in (-1,0,1):
            if dx==dy==0: continue
            nx,ny=cx+dx,cy+dy
            inside=0<=nx<W and 0<=ny<H and mask[ny][nx]
            if inside: continue
            ex=0 if dx==0 else (fx if dx<0 else 16-fx); ey=0 if dy==0 else (fy if dy<0 else 16-fy)
            dd=max(ex,ey) if (dx and dy) else (ex if dx else ey)
            if dx and dy: dd=math.hypot(ex,ey)
            d=min(d,dd)
    return d

class Pic:  # defined early for road()
    def __init__(s,im): s.im=im
    def img(s,outline=True): return s.im
def ground(c): return Pic(c.img(outline=False))
_DIRT=None
def _dirt():
    # the chipset's own light-dirt interior tile (seamless) — road surface matches the chipset exactly
    global _DIRT
    if _DIRT is None:
        im=Image.open(__import__('os').environ.get('PX_CHIPSET',__import__('os').path.join(__import__('os').path.dirname(__import__('os').path.abspath(__file__)),'assets','jungle-chipset-v6.png'))).convert('RGBA')
        _DIRT=im.crop((64,224,80,240)).load()
    return _DIRT
def road(mask,joins=None):
    # joins: cells (e.g. the plaza) the road runs into — no grass edge is drawn against them
    H=len(mask); W=len(mask[0]); D=_dirt(); out=Image.new('RGBA',(W*16,H*16)); px=out.load()
    em=[[mask[y][x] or (joins and joins[y][x]) for x in range(W)] for y in range(H)]
    for y in range(H*16):
        for x in range(W*16):
            if not mask[y//16][x//16]: continue
            d=_edge_dist(em,W,H,x,y)-(vnoise(x%16,y%16,2,211,per=8)-0.5)*2.4
            if d<0.8: continue
            r,g,b,a=D[x%16,y%16]
            if d<1.8: r,g,b=int(r*0.62),int(g*0.58),int(b*0.55)              # dark rim where grass meets the road
            elif d<2.8: r,g,b=int(r*0.85),int(g*0.83),int(b*0.8)
            px[x,y]=(r,g,b,255)
    return Pic(out)
CHIP_COB=__import__('os').environ.get('PJ_CHIP','1')=='1'
COB={}; _COB=[None]
def _cob():
    # the chipset's cobble interior (seamless) — the plaza matches the chipset's own paving
    if _COB[0] is None:
        im=Image.open(__import__('os').environ.get('PX_CHIPSET',__import__('os').path.join(__import__('os').path.dirname(__import__('os').path.abspath(__file__)),'assets','jungle-chipset-v6.png'))).convert('RGBA')
        _COB[0]=im.crop((160,96,176,112)).load()
    return _COB[0]
class _PlazaPic:
    def __init__(s,c): s.c=c
    def img(s,outline=False):
        im=s.c.img(outline=False); px=im.load()
        for (x,y),col in COB.items(): px[x,y]=col+(255,)
        return im
SEEDS=[(3,3),(10,2),(14,8),(6,9),(1,13),(11,14),(8,5.5)]
def plaza(mask):
    H=len(mask); W=len(mask[0]); c=C(W*16,H*16,seed=220); c.period=16; c.new()
    for y in range(H*16):
        for x in range(W*16):
            if not mask[y//16][x//16]: continue
            d=_edge_dist(mask,W,H,x,y)
            if d<3:                                                   # curb stones
                v=0.82 if d>=1 else 0.5
                if ((x+y)//4)%2==0 and d>=1: v-=0.12
                c.setv(x,y,'stone',v); continue
            lx,ly=x%16,y%16
            if CHIP_COB:
                r,g,b,a=_cob()[lx,ly]; c.fixc(x,y,(r,g,b)) if hasattr(c,'fixc') else None; COB[(x,y)]=(r,g,b); continue
            best=[99,99,None]
            for (sx,sy) in SEEDS:
                for ox in (-16,0,16):
                    for oy in (-16,0,16):
                        d=math.hypot(lx+0.5-sx-ox,ly+0.5-sy-oy)
                        if d<best[0]: best=[d,best[0],(sx+ox,sy+oy)]
                        elif d<best[1]: best[1]=d
            if best[1]-best[0]<1.3: v=0.7                                     # joint (soft)
            else:
                sx,sy=best[2]; v=0.86+0.1*((sx-lx)+(sy-ly))/6+(_hash(int(sx)%16,int(sy)%16,221)-0.5)*0.12
            c.setv(x,y,'stone',v)
    return _PlazaPic(c) if CHIP_COB else c

P['흙길 (갈림·모퉁이)']=lambda: (road([[ch=='#' for ch in r] for r in ["..##....","..##....","..######","..######","..##....",".###....","##......"]])) 
P['광장 포석']=lambda: ground(plaza([[ch=='#' for ch in r] for r in ["######.","#######","#######","..#####"]]))

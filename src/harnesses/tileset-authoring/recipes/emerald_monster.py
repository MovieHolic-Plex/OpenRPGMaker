"""Seven Emerald inspired original native variants. No sampled or filtered bitmap pixels.

Use existing atlas enumeration and structural masks; temporarily replace native drawing
functions within this process only. Sand/snow/ash/lava and league ramps stay distinct.
"""
from contextlib import contextmanager
import importlib
import math
import random
import px
import monster_overworld as mo
import forest
import buildings
import coast
import tree
import climate_common
import climate_desert
import gyms_common


def grass_tex(P, v=0):
    g = P['grass']
    im = px.new(); px.fill(im, g[2])
    # Large quiet meadow patches; sparse paired blades, no single pixel confetti.
    for x, y in ((2+v, 3), (10, 11-v)):
        for dx, dy in ((0,0),(1,0),(2,0),(0,1),(1,1)):
            px.put(im, (x+dx)%16, (y+dy)%16, g[3])
    if v == 2:
        for x,y in ((6,7),(7,6),(8,7),(7,8)):
            px.put(im,x,y,g[1] if y==8 else g[3])
    return im


def ripple(ramp, x, y, frame, deep=False, variant=0):
    # Tileable four phase horizontal ripples; strong highlights never form a net.
    x, y = x % 16, y % 16
    for sx, sy, length in ((2,3,5),(10,11,4)):
        dx = (x-sx-frame)%16
        if y==sy and dx<length: return ramp[2 if deep else 3]
        if y==(sy+1)%16 and 1<=dx<length-1:return ramp[1 if deep else 2]
    return ramp[0]


def water_px(P,x,y,f):return ripple(P['water'],x,y,f)
def sea_px(P,x,y,f,deep=False,v=0,dark=False):
    return ripple(P['sea_deep'] if dark else P['sea'],x,y,f,deep,v)


def crown(P, seed='forest-crown'):
    # Broad joined lobes with coherent top-left lighting; the native forest compositor
    # still owns neighbour overlaps, upper caps and bottom trunks.
    r=random.Random(seed)
    centers=[(16,21,12.5)]
    for k in range(9):
        a=math.pi*(0.80+1.40*k/8)
        centers.append((16+10.6*math.cos(a),21+12.6*math.sin(a),r.uniform(5.0,6.0)))
    centers += [(8,32.5,5.5),(16,32.5,6),(24,32.5,5.5),
                (10,16,6.5),(20,12,6.5),(21,25,6)]
    return tree.cluster_canopy(32,41,centers,px.ramp(P['_leaf_hex']),seed,0.03,0.55,0.28)


def roof_flat(P,key,n,seed,H=33):
    # Same 33px roof envelope/eaves. Native courses are wider with one shadow row,
    # a slim ridge and separate distant/front planes, without chunky gold caps.
    ramp=P[key]; w=n*16; im=px.new(w,H)
    for y in range(H):
        for x in range(1,w-1):
            if x in (1,w-2) or y in (0,H-1):tone=0
            elif y<5:tone=1 if y==4 else 2
            elif y<9:tone=4 if y<7 else 2
            elif y==9:tone=1
            elif y>=H-3:tone=1 if y==H-3 else 2
            else:
                row=(y-10)//5; u=(x+3*(row%2))%8; yy=(y-10)%5
                tone=2 if yy==4 or (yy==3 and u==0) else 3
                if yy==0 and 1<=u<=4:tone=4
                if x>w*0.72 and tone==4:tone=3
            px.put(im,x,y,ramp[tone])
    return im


def pool_cell(P,m,f,alt=0):
    # Keep the pool's submerged north/west walls and cream deck boundaries.
    gc=gyms_common;pl=P['gy_pool'];rim=P['gy_rim'];ins=gc.at_mask('gy_pool',m)
    ground=gc.floor(P,'rim');im=px.new()
    for y in range(16):
        for x in range(16):
            if not ins[y][x]:c=ground.getpixel((x,y))
            else:
                d=gc._dist_out(ins,x,y,m);dn=gc._dist_dir(ins,x,y,m,0,-1);dw=gc._dist_dir(ins,x,y,m,-1,0)
                if d==1:c=rim[0]
                elif dn<=5 or dw<=3:c=pl[0]
                elif dn<=8 or dw<=5:c=pl[1]
                else:c=ripple([pl[2],pl[2],pl[3],pl[4]],x,y,f,variant=alt)
            px.put(im,x,y,c)
    return im


def select_native_seed(seed, P, make, prefix, want, tries=40, silhouette=False):
    # Explicit original native seeds. Scarloxy palette comparison does not apply to
    # Emerald variants, and must never select fewer tiles or resize the atlas.
    return [(f'{prefix}-{i}', make(f'{prefix}-{i}')) for i in range(want)], want


@contextmanager
def native_style():
    replacements=[(mo,'grass_tex',grass_tex),(mo,'water_px',water_px),
                  (coast,'sea_px',sea_px),(forest,'crown',crown),
                  (buildings,'roof_flat',roof_flat),(mo,'pick_by_gate',select_native_seed),
                  (climate_common,'net_water',ripple),(climate_desert,'grass_tex',grass_tex),
                  (gyms_common,'pool_cell',pool_cell)]
    old=[(module,name,getattr(module,name)) for module,name,_ in replacements]
    for module,name,fn in replacements:setattr(module,name,fn)
    try:yield
    finally:
        for module,name,fn in old:setattr(module,name,fn)


def build(seed):
    source=importlib.import_module(seed['nativeSource'].replace('-','_'))
    with native_style():return source.build(seed)

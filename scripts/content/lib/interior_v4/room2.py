# interior rooms in the chipset's front-top view (hand-drawn structure over chipset surface textures).
# A plan is a grid of chars: '#' solid (outside / thick wall), anything else is inside. Structure is derived, never
# painted by hand: the two rows under any solid cell to the north are WALL FACE (not walkable), the rest is FLOOR;
# solid cells touching the inside are WALL TOP (the ceiling band, drawn as a stone cap), the rest is void.
# Thick partitions are just solid cells inside the plan: they get their own cap and a 2-row face on their south side.
import sys, os, math; sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from PIL import Image
import palette
import tiles as TL
FACE={k:v.load() for k,v in TL.FACES.items()}; FACE['grey']=FACE['stone']
FLR={k:v.load() for k,v in TL.FLOORS.items()}
for a,b in (('boards','plank'),('grey','flag'),('cobble','flag')): FLR[a]=FLR[b]
BR=[c[:3] for c in TL.BRICK]
CH=Image.open('/home/main/.t3/worktrees/rpg-zzu/t3code-8b4b09de/public/assets/atlas-biomes/jungle-chipset.png').convert('RGBA')
def hx(s): return tuple(int(s[i:i+2],16) for i in (1,3,5))
def ramp(k): return [hx(palette.OUT_CHIP.get(k,'#1c2626'))]+[hx(c) for c in palette.RAMPS_CHIP[k]]
WD=ramp('wood'); ST=ramp('stone'); PL=ramp('plaster')
def mul(c,k): return tuple(max(0,min(255,int(v*k))) for v in c[:3])
def T(x,y): return CH.crop((x,y,x+16,y+16)).load()
# surface textures (chipset tile interiors)
FLOOR={'plank':T(304,96),'boards':T(336,80),'flag':T(224,160),'grey':T(224,176),'cobble':T(160,96)}
WALLTX={'stone':T(208,16),'plaster':T(256,16),'log':T(208,64),'grey':T(240,144)}
VOID=(16,14,22)
def _n(x,y):
    h=(x*374761393+y*668265263)&0xffffffff; h=(h^(h>>13))*1274126177&0xffffffff; return (h&0xffff)/65535
def analyse(plan):
    H=len(plan); W=max(len(r) for r in plan)
    g=[[(plan[y][x] if x<len(plan[y]) else '#')!='#' for x in range(W)] for y in range(H)]
    def inn(x,y): return 0<=x<W and 0<=y<H and g[y][x]
    face=[[0]*W for _ in range(H)]
    for y in range(H):
        for x in range(W):
            if not g[y][x]: continue
            if not inn(x,y-1): face[y][x]=1
            elif face[y-1][x]==1: face[y][x]=2
    top=[[(not g[y][x]) and any(inn(x+dx,y+dy) for dx in (-1,0,1) for dy in (-1,0,1)) for x in range(W)] for y in range(H)]
    return W,H,g,face,top,inn
def render(plan,floor='plank',wall='plaster',zones=()):
    # zones: (x0,y0,x1,y1,floor,wall) overrides per rectangle
    W,H,g,face,top,inn=analyse(plan)
    def mat(x,y):
        f,w=floor,wall
        for x0,y0,x1,y1,ff,ww in zones:
            if x0<=x<=x1 and y0<=y<=y1: f,w=ff or f,ww or w
        return f,w
    im=Image.new('RGBA',(W*16,H*16)); px=im.load()
    for cy in range(H):
        for cx in range(W):
            f,w=mat(cx,cy)
            for ly in range(16):
                for lx in range(16):
                    X,Y=cx*16+lx,cy*16+ly
                    if g[cy][cx] and face[cy][cx]:
                        fy=ly+(face[cy][cx]-1)*16                          # 0..31 down the wall face
                        r,gg,b,_=FACE[w][X%16,fy]; c=(r,gg,b)
                        if w=='plaster' and X%64 in (0,1,2) and 3<fy<14: c=(WD[4] if X%64==0 else WD[3] if X%64==1 else WD[2])   # timber posts
                        if fy<4: c=mul(c,0.62+0.08*fy)                           # shade under the ceiling band
                        px[X,Y]=c+(255,)
                    elif g[cy][cx]:
                        c=TL.FLOORFN[f](X,Y)[:3]
                        if face[cy-1][cx] if cy>0 else 0:
                            if ly<3: c=mul(c,0.6+0.12*ly)                         # contact shadow at the wall foot
                        px[X,Y]=c+(255,)
                    elif top[cy][cx]:
                        # ceiling band: dark stone cap; a light lip where it overhangs the inside, a dark edge to void
                        c=(34,30,40) if (X+Y)%2 else (27,24,32)                     # quiet dark checker cap
                        s_in=inn(cx,cy+1); n_in=inn(cx,cy-1); w_in=inn(cx-1,cy); e_in=inn(cx+1,cy)
                        if s_in and ly>=12: c=BR[5] if ly==12 else (BR[4] if ly==13 else (BR[2] if ly==14 else BR[0]))
                        if n_in and ly<=1: c=BR[0] if ly==0 else BR[3]
                        if w_in and lx<=2: c=BR[0] if lx==0 else (BR[4] if lx==1 else BR[3])
                        if e_in and lx>=13: c=BR[0] if lx==15 else (BR[2] if lx==14 else BR[3])
                        # edges toward the void
                        if not inn(cx,cy-1) and not top[cy-1][cx] if cy>0 else True:
                            if ly==0: c=VOID
                        px[X,Y]=c+(255,)
                    else: px[X,Y]=VOID+(255,)
    # cast shadow: a solid mass to the WEST darkens the next 5 px of face and floor (light from the upper left... the
    # chipset/MV convention puts the soft shadow on the left inside edge)
    for cy in range(H):
        for cx in range(W):
            if g[cy][cx] and not inn(cx-1,cy):
                for ly in range(16):
                    for lx in range(6):
                        X,Y=cx*16+lx,cy*16+ly; r,gg,b,a=px[X,Y]; px[X,Y]=mul((r,gg,b),0.62+0.06*lx)+(255,)
    return im

def compose(plan,floor,wall,items,zones=(),lights=()):
    # items: (F, x, y) floor footprint top-left in cells; 'hang' items: y = the wall-face row, drawn 2 px below its top
    base=render(plan,floor,wall,zones); px=base.load()
    for (wx,wy) in lights:                                 # sunlight through a window falls on the floor below it
        for Y in range((wy+2)*16,(wy+4)*16):
            sh=(Y-(wy+2)*16)//3
            for X in range(wx*16+2+sh,wx*16+14+sh):
                if X<base.width:
                    r,g,b,a=px[X,Y]; px[X,Y]=(min(255,int(r*1.22+10)),min(255,int(g*1.2+10)),min(255,int(b*1.12+8)),a)
    draw=[]
    for f,x,y in items:
        if f.kind=='hang': draw.append((y*16,f.im,x*16,y*16+2))
        elif f.kind=='flat': draw.append((-1,f.im,x*16,y*16))
        else: draw.append(((y+f.fh)*16,f.im,x*16,y*16-f.up))
    for _,im,X,Y in sorted(draw,key=lambda d:d[0]): base.alpha_composite(im,(X,Y))
    return base

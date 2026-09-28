# terrain for big towns: levels (plateaus), south-facing cliff faces two cells tall (natural rock or a masonry
# retaining wall) THREE cells tall, side rims, stone stairs cut through a face, and a waterfall where a river drops.
# Same projection as every chipset object: a face shows full height on the LOWER level's two rows under the edge.
import sys, os, math; sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from PIL import Image
from px2 import _hash, vnoise
import palette
CH=Image.open(__import__('os').path.join(__import__('os').path.dirname(__import__('os').path.abspath(__file__)),'assets','jungle-chipset-v6.png')).convert('RGBA')
def hx(s): return tuple(int(s[i:i+2],16) for i in (1,3,5))
ST=[hx(c) for c in [palette.OUT_CHIP['stone']]+palette.RAMPS_CHIP['stone']]
WD=[hx(c) for c in [palette.OUT_CHIP['wood']]+palette.RAMPS_CHIP['wood']]
WA=[hx(c) for c in palette.RAMPS_CHIP['water']]
LF=[hx(c) for c in palette.RAMPS_CHIP['leaf']]
def tile(x,y): return CH.crop((x,y,x+16,y+16)).load()
ROCK=[tile(336,336),tile(352,352),tile(352,336)]; CASTLE=tile(352,32); WATER=tile(16,80)
_SW=[None]
def SW():
    if _SW[0] is None:
        import pj; _SW[0]=pj.tex('sto.wall',16,16).load()
    return _SW[0]
def mul(c,k): return tuple(max(0,min(255,int(v*k))) for v in c[:3])

def faces(E):
    # face[y][x] = (k, top_level): k=1/2 for the 1st/2nd row under a south drop, else 0
    H=len(E); W=len(E[0]); F=[[0]*W for _ in range(H)]
    for y in range(H):
        for x in range(W):
            if y>=1 and E[y-1][x]>E[y][x] and not F[y-1][x]: F[y][x]=1
            elif y>=1 and F[y-1][x] in (1,2): F[y][x]=F[y-1][x]+1
    return F

def render(E,masonry=None,stairs=(),falls=(),frame=0):
    # E: level per cell. masonry[y][x]: face drawn as a dressed retaining wall instead of rock.
    # stairs: (x,y,w) = a stair w cells wide whose top row is the first face row y. falls: (x,y,w) = waterfall.
    H=len(E); W=len(E[0]); F=faces(E); im=Image.new('RGBA',(W*16,H*16)); px=im.load()
    stc={(x+i,y+j) for x,y,w in stairs for i in range(w) for j in (0,1,2)}
    fac={(x+i,y+j) for x,y,w in falls for i in range(w) for j in (0,1,2)}
    def lv(x,y): return E[max(0,min(H-1,y))][max(0,min(W-1,x))]
    for Y in range(H*16):
        cy,ly=Y//16,Y%16
        for X in range(W*16):
            cx,lx=X//16,X%16; k=F[cy][cx]
            if k and (cx,cy) not in stc and (cx,cy) not in fac:
                fy=ly+(k-1)*16                                            # 0..47 down the face
                ends_w=not F[cy][cx-1] if cx>0 else True; ends_e=not F[cy][cx+1] if cx<W-1 else True
                if masonry and masonry[cy][cx]:
                    r,g,b,_=SW()[lx,ly]; c=(r,g,b)
                    if fy<3: c=ST[5] if fy==0 else (ST[4] if fy==1 else ST[1])          # coping course
                    elif fy<6: c=mul(c,0.62)
                    if fy>=45: c=ST[3] if fy==45 else ST[1]
                else:
                    t=ROCK[1+int(_hash(cx,cy,5)*2)]; r,g,b,_=t[lx,(ly+cx*5)%16]; c=(r,g,b)
                    # rock buttresses: vertical ribs 5-9 px wide, each lit on its left, shaded on its right,
                    # with a dark crack between ribs; the ribs wander a little so no tile grid shows
                    xx=X+int(3*vnoise(0,Y*0.08,9,78)); rib=int(xx/7+_hash(xx//7,0,3)*0.6); u=(xx%7)/7
                    shade=0.78+0.36*(0.5-u)+0.18*(_hash(rib,cy//2,4)-0.5)
                    if u>0.86: shade=0.5
                    c=mul(c,min(1.15,shade+0.1*(fy/47)))
                    if fy<4: c=mul(c,0.55)                                               # under the grass lip
                    if fy>=45: c=(46,52,40) if fy==47 else mul(c,0.6)
                    if fy>=43 and (X*7+Y*3)%11<3: c=LF[2]                                # grass tufts at the foot
                if ends_w and lx<2: c=mul(c,0.55 if lx==0 else 0.75)
                if ends_e and lx>13: c=mul(c,0.45 if lx==15 else 0.7)
                px[X,Y]=c+(255,)
                continue
            if F[min(H-1,cy+1)][cx]==1 and ly>=13 and (cx,cy+1) not in fac:                # lip on the plateau edge
                if masonry and masonry[min(H-1,cy+1)][cx]: continue
                c=LF[5] if ly==13 else (LF[3] if ly==14 else LF[1])
                if (cx,cy+1) in stc: continue
                px[X,Y]=c+(255,); continue
            if not k:                                                                    # side rims (edge-on faces)
                h=E[cy][cx]
                if lv(cx-1,cy)<h and not F[cy][cx-1] and lx<2: px[X,Y]=(LF[5] if lx==1 else ST[1])+(255,)
                elif lv(cx+1,cy)<h and not F[cy][cx+1] and lx>13: px[X,Y]=(LF[1] if lx==14 else ST[1])+(255,)
                elif lv(cx,cy-1)<h and ly<2 and not F[cy][cx]: px[X,Y]=(LF[5] if ly==1 else ST[2])+(255,)   # north rim
    for x0,y0,w in stairs: stair(px,x0,y0,w)
    for x0,y0,w in falls: waterfall(px,x0,y0,w,frame)
    return im

def stair(px,x0,y0,w):
    # stone flight coming down toward the viewer through the face: treads (lit) and risers (shade), 4 px per step,
    # low side walls with coping on both sides
    X0,Y0=x0*16,y0*16-3; W=w*16
    for Y in range(Y0,Y0+51):
        for X in range(X0,X0+W):
            lx=X-X0; s=(Y-Y0)%5
            if lx<4 or lx>=W-4:
                side=lx<4; e=lx if side else W-1-lx
                c=ST[5] if e in (1,2) else (ST[3] if e==3 else ST[1])
                if Y>=Y0+48: c=ST[1]
            else:
                c=ST[6] if s==0 else (ST[5] if s<3 else ST[2])
                if lx==4 or lx==W-5: c=mul(c,0.7)
            px[X,Y]=c+(255,)

def waterfall(px,x0,y0,w,frame=0):
    # a river dropping three rows: a bright rounded lip, then long vertical ribbons of falling water (each column its
    # own speed and length, sliding down 4 px a frame), darker at the rock cheeks; foam and spray at the foot.
    X0,Y0=x0*16,y0*16-2; W=w*16; FH=52
    for Y in range(Y0,Y0+FH):
        for X in range(X0,X0+W):
            lx=X-X0; fy=Y-Y0
            ph=int(_hash(lx,1,31)*40); L=14+int(_hash(lx,2,31)*14); n=int(_hash(lx,3,31)*3)
            v=(fy+ph-frame*4)%L
            t=2+n//2
            if v<3: t=5 if n else 4                                              # a bright ribbon passing
            elif v<6: t=4 if n else 3
            if lx<2 or lx>=W-2: t=max(0,t-2)
            c=WA[min(5,t)]
            if fy<4: c=WA[5] if fy<2 else WA[4]                                 # the lip
            if fy>=FH-9:
                k=fy-(FH-9)
                if (lx*3+k*5+frame*7)%9<5+k//3: c=(243,248,251)
                else: c=WA[5]
            px[X,Y]=c+(255,)
    for Y in range(Y0+FH,Y0+FH+14):                                             # spray and rings on the pool
        for X in range(X0,X0+W):
            lx=X-X0; k=Y-(Y0+FH)
            if (lx+k*3+frame*5)%11<2 and k<10: px[X,Y]=WA[5]+(255,)
            elif k<3 and (lx+frame)%3: px[X,Y]=(243,248,251,255)

def paving(mask,tx,ty,joins=None,curb=True):
    # a paved surface from a cell mask: the chipset paving tile, a curb where it meets grass (2 px light stone over a
    # 1 px dark joint), no curb against `joins` (e.g. a street running into a square)
    H=len(mask); W=len(mask[0]); T=CH.crop((tx,ty,tx+16,ty+16)).load(); im=Image.new('RGBA',(W*16,H*16)); px=im.load()
    def on(x,y): return 0<=x<W and 0<=y<H and (mask[y][x] or (joins is not None and joins[y][x]))
    for cy in range(H):
        for cx in range(W):
            if not mask[cy][cx]: continue
            n,s,w,e=on(cx,cy-1),on(cx,cy+1),on(cx-1,cy),on(cx+1,cy)
            for ly in range(16):
                for lx in range(16):
                    r,g,b,_=T[lx,ly]; c=(r,g,b)
                    if curb:
                        d=min(ly if not n else 99,15-ly if not s else 99,lx if not w else 99,15-lx if not e else 99)
                        if d==0: c=ST[1]
                        elif d<3: c=ST[5] if ((cx*16+lx)//5+(cy*16+ly)//5)%2 else ST[4]
                    px[cx*16+lx,cy*16+ly]=c+(255,)
    return im

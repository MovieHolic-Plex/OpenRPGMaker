# v5 kit, part 1: line autotiles (rugs/runners, mine rail, fences, iron bars, pipes), columns, dais, shared lights.
# Line autotiles pick a 16x16 piece from the 4-neighbour mask (N,E,S,W) plus inner-corner flags (both sides connected but
# the diagonal cell empty) -> any length, ends, corners, T-junctions and crosses. Rugs are 'flat' (walkable);
# fences/bars are blocking with an explicit cell list (F.cells).
import sys, math; sys.path.insert(0,'/tmp/j8v5')
import anim4, kit4, tiles5
from anim4 import *          # OBJ, F, Pix, M, MT, G, WOOD, H, hx, osc, framed, flame, N, MS
from PIL import Image
R8=kit4.R8
DIRS=(('N',0,-1),('E',1,0),('S',0,1),('W',-1,0))
def mask_at(cells,x,y):
    m=''.join(d for d,dx,dy in DIRS if (x+dx,y+dy) in cells)
    ic=''
    for a,b,dx,dy in (('N','E',1,-1),('E','S',1,1),('S','W',-1,1),('W','N',-1,-1)):
        if a in m and b in m and (x+dx,y+dy) not in cells: ic+=a+b.lower()
    return m,ic
class LineKit:
    def __init__(s,name,ko,draw,kind='flat',use='none'):
        s.name,s.ko,s.draw,s.kind,s.use=name,ko,draw,kind,use; s.cache={}
    def piece(s,m,ic=''):
        k=(m,ic)
        if k not in s.cache: s.cache[k]=s.draw(m,ic)
        return s.cache[k]
    def all_pieces(s):
        out={}
        for n in range(16):
            m=''.join(d for i,(d,_,_) in enumerate(DIRS) if n>>i&1)
            out[(m,'')]=s.piece(m)
            for a,b in (('N','E'),('E','S'),('S','W'),('W','N')):
                if a in m and b in m: out[(m,a+b.lower())]=s.piece(m,a+b.lower())
        return out
    def item(s,cells,id=None):
        cells=set(cells); xs=[c[0] for c in cells]; ys=[c[1] for c in cells]; x0,y0=min(xs),min(ys)
        W=(max(xs)-x0+1)*16; Hh=(max(ys)-y0+1)*16; up=getattr(s,'up',0)
        im=Image.new('RGBA',(W,Hh+up))
        for (x,y) in sorted(cells,key=lambda c:(c[1],c[0])):
            m,ic=mask_at(cells,x,y); im.alpha_composite(s.piece(m,ic),((x-x0)*16,(y-y0)*16))
        f=F(im,max(xs)-x0+1,max(ys)-y0+1,up,s.kind); f.id=id or s.name; f.cells=[(x-x0,y-y0) for x,y in cells]; f.line=s.name
        if s.use: f.use=s.use
        return (f,x0,y0)
LINEKITS={}
# ---------------- rugs / runners ----------------
RUGS={'red':(R8('#1c0206','#8a1420','#e87060'),MT.M['gold']),'royal':(R8('#14020a','#6a0a1e','#d04058'),MT.M['gold']),
      'blue':(R8('#020a1c','#1e4a8a','#80b0e8'),MT.M['gold']),'green':(R8('#021a08','#1e6a30','#80d090'),MT.M['gold']),
      'purple':(R8('#10041c','#4a2a8a','#b090e8'),MT.M['gold']),'brown':(R8('#140a04','#6a4424','#d0a070'),R8('#1a1004','#a08040','#f0e0a0'))}
def rug_draw(style):
    B,Gd=RUGS[style]
    def draw(m,ic):
        p=Pix(16,16)
        for ly in range(16):
            for lx in range(16):
                d=9
                if 'N' not in m: d=min(d,ly)
                if 'S' not in m: d=min(d,15-ly)
                if 'W' not in m: d=min(d,lx)
                if 'E' not in m: d=min(d,15-lx)
                for a in ('Ne','Es','Sw','Wn'):
                    if a in ic:
                        cx=15-lx if a in ('Ne','Es') else lx; cy=ly if a in ('Ne','Wn') else 15-ly
                        if cx<=2 and cy<=2: d=min(d,max(cx,cy))
                if d==0: c=B[1]
                elif d==1: c=Gd[5]
                elif d==2: c=B[2]
                else:
                    dd=abs(lx-7.5)+abs(ly-7.5)
                    c=B[4] if (lx+ly)%2 else B[5]
                    if 3.2<dd<4.4: c=Gd[4]
                    elif dd<1.2: c=Gd[5]
                    elif d==3: c=B[3]
                p.set(lx,ly,c)
        return p.im
    return draw
for st in RUGS: LINEKITS['rug '+st]=LineKit('rug '+st,{'red':'붉은','royal':'진홍','blue':'파란','green':'초록','purple':'보라','brown':'갈색'}[st]+' 양탄자(자동 타일)',rug_draw(st))
def rug(cells,style='red'): return LINEKITS['rug '+style].item(cells,'rug '+style)
def rect(x0,y0,x1,y1): return [(x,y) for y in range(y0,y1+1) for x in range(x0,x1+1)]
def line(x0,y0,x1,y1): return rect(min(x0,x1),min(y0,y1),max(x0,x1),max(y0,y1))
# ---------------- mine rail ----------------
IRON=MT.M['iron']; RT=R8('#140a04','#5a3a1c','#a07448')
def rail_draw(m,ic):
    p=Pix(16,16)
    ns=('N' in m or 'S' in m); ew=('E' in m or 'W' in m)
    corner=len(m)==2 and ns and ew
    if not m: ns=True
    if corner:
        cx=16 if 'E' in m else -1; cy=-1 if 'N' in m else 16
        for y in range(16):
            for x in range(16):
                r=math.hypot(x-cx,y-cy)
                ang=math.atan2(y-cy,x-cx)
                if 2<=r<=14 and int(math.degrees(ang)+720)%18<5: p.set(x,y,RT[3] if int(r)%3 else RT[2])
        for y in range(16):
            for x in range(16):
                r=math.hypot(x-cx,y-cy)
                if abs(r-4.5)<0.7 or abs(r-11.5)<0.7: p.set(x,y,IRON[5] if (x+y)%3 else IRON[3])
        return p.im
    if ns or 'N' in m or 'S' in m:
        y0=0 if 'N' in m else 3; y1=15 if 'S' in m else 12
        for y in range(y0,y1+1):
            if y%4==1:
                for x in range(1,15): p.set(x,y,RT[4] if x>1 else RT[5]); p.set(x,y+1,RT[2])
        for y in range(y0,y1+1):
            for x in (4,11): p.set(x,y,IRON[5]); p.set(x+1,y,IRON[2])
        if 'N' not in m:
            for x in range(3,13): p.set(x,y0,RT[1]); p.set(x,y0+1,RT[4])
        if 'S' not in m:
            for x in range(3,13): p.set(x,y1,RT[1])
    if ew:
        x0=0 if 'W' in m else 3; x1=15 if 'E' in m else 12
        for x in range(x0,x1+1):
            if x%4==1:
                for y in range(2,14): p.set(x,y,RT[4] if y>2 else RT[5]); p.set(x+1,y,RT[2])
        for x in range(x0,x1+1):
            for y in (5,11): p.set(x,y,IRON[5]); p.set(x,y+1,IRON[2])
    return p.im
LINEKITS['rail']=LineKit('rail','광차 선로(자동 타일)',rail_draw)
def rail(cells): return LINEKITS['rail'].item(cells,'rail')
# ---------------- fences / bars (blocking lines) ----------------
def post_line_draw(Rm,bars=False,cap=None):
    def draw(m,ic):
        p=Pix(16,24)                                       # 8 px rise above the cell (up=8)
        base=21
        def post(x):
            for y in range(6 if not bars else 4,base+2):
                p.set(x,y,Rm[1]); p.set(x+1,y,Rm[5]); p.set(x+2,y,Rm[3]); p.set(x+3,y,Rm[1])
            for x2 in range(x,x+4): p.set(x2,5 if not bars else 3,Rm[6] if not bars else Rm[5])
        if 'E' in m or 'W' in m or (bars and not ('N' in m or 'S' in m)):
            xa=0 if ('W' in m or bars) else 6; xb=15 if ('E' in m or bars) else 9     # bars run wall to wall
            if bars:
                for x in range(xa,xb+1):
                    p.set(x,6,Rm[5]); p.set(x,7,Rm[1]); p.set(x,base-2,Rm[5]); p.set(x,base-1,Rm[1])
                    if x%3==0:
                        for y in range(6,base+1): p.set(x,y,Rm[6] if y<9 else (Rm[5] if y%5 else Rm[6]))
                    elif x%3==1:
                        for y in range(8,base+1): p.set(x,y,Rm[1])
            else:
                for yy in (9,15):
                    for x in range(xa,xb+1): p.set(x,yy,Rm[6]); p.set(x,yy+1,Rm[3]); p.set(x,yy+2,Rm[1])
        if 'N' in m or 'S' in m:
            ya=0 if 'N' in m else 10; yb=base+2 if 'S' in m else 12
            for y in range(ya,yb):
                p.set(7,y,Rm[5] if not bars else Rm[5]); p.set(8,y,Rm[2])
                if bars and y%3==0: p.set(6,y,Rm[4]); p.set(9,y,Rm[3])
        post(6)
        return p.im
    return draw
FW=R8('#140a04','#6a4424','#d0a070')
LINEKITS['fence']=LineKit('fence','나무 칸막이 울타리(자동 타일)',post_line_draw(FW),kind='floor')
LINEKITS['fence'].up=8
LINEKITS['bars']=LineKit('bars','쇠창살(자동 타일)',post_line_draw(R8('#08090c','#3a4048','#b8c0cc'),bars=True),kind='floor')
LINEKITS['bars'].up=8
def fence(cells): return LINEKITS['fence'].item(cells,'fence')
def bars(cells): return LINEKITS['bars'].item(cells,'bars')
# ---------------- steam pipe along the floor ----------------
CU=R8('#1a0a04','#8a4a1c','#ffc890')
def pipe_draw(m,ic):
    p=Pix(16,16)
    def seg_h(x0,x1):
        for x in range(x0,x1+1):
            for y,t in zip(range(5,11),(1,6,7,5,3,1)): p.set(x,y,CU[t])
    def seg_v(y0,y1):
        for y in range(y0,y1+1):
            for x,t in zip(range(5,11),(1,6,7,5,3,1)): p.set(x,y,CU[t])
    if 'W' in m: seg_h(0,8)
    if 'E' in m: seg_h(7,15)
    if 'N' in m: seg_v(0,8)
    if 'S' in m: seg_v(7,15)
    if len(m)!=2 or m in ('NS','EW'):
        for y in range(4,12):
            for x in range(4,12): p.set(x,y,CU[6] if (x,y)==(5,5) else (CU[1] if x in (4,11) or y in (4,11) else CU[4]))
    for x,y in ((0,5),(15,5)) if 'EW'==m else ():
        pass
    return p.im
LINEKITS['pipe']=LineKit('pipe','증기관(자동 타일)',pipe_draw,kind='floor')
def pipe(cells): return LINEKITS['pipe'].item(cells,'pipe')
# ---------------- columns ----------------
COL={'marble':R8('#3a3440','#b0a8b4','#ffffff'),'stone':R8('#16181c','#6a707a','#c8ccd0'),'dwarf':R8('#0c0a0e','#3a3840','#8a8894'),
     'wood':R8('#100804','#5a3416','#c8904a'),'live':R8('#140a04','#6a4a2a','#c0985a'),'steel':R8('#0c0e12','#4a5260','#c8d4e0')}
def column(style='marble'):
    R=COL[style]; p=Pix(16,40); Gd=MT.M['gold']
    sq=style in ('dwarf','steel')
    for y in range(40):
        if y<5 or y>=34: x0,x1=2,13
        else: x0,x1=(4,11) if not sq else (3,12)
        for x in range(x0,x1+1):
            f=(x-x0)/max(1,x1-x0)
            t=[2,5,6,6,5,4,3,2][min(7,int(f*8))] if not sq else (6 if x==x0+1 else (2 if x>=x1-1 else 4))
            if x in (x0,x1): t=0
            if y in (0,34): t=7 if 0<x-x0<x1-x0 else 1
            if y in (4,39): t=1
            if y in (5,33) : t=2
            if style=='marble' and 6<y<33 and (x-x0)%3==1: t=max(1,t-1)          # flutes
            if style=='wood' and y in (9,10,26,27): p.set(x,y,Gd[5] if y%2 else Gd[3]); continue
            if style=='dwarf' and 14<=y<=24 and x0+2<=x<=x1-2:
                if (x-x0-2,y-14) in ((2,0),(2,1),(1,2),(3,2),(2,3),(0,4),(4,4),(2,5),(2,6),(1,8),(3,8),(2,9),(2,10)): p.set(x,y,Gd[5]); continue
            if style=='steel' and y%6==2 and x in (x0+1,x1-1): p.set(x,y,R[7]); continue
            p.set(x,y,R[t])
    if style=='live':
        LF=tiles5.LEAF
        for y in range(0,9):
            for x in range(0,16):
                if (x-7.5)**2/64+(y-4)**2/20<1 and H(x,y,5)<0.8: p.set(x,y,LF[[2,3,3,4][int(H(x,y,6)*4)]])
        for y in range(34,40):
            for x in (1,2,13,14): p.set(x,y,R[2])
    f=F(p.im,1,1,24,'floor'); return f
for st in COL: OBJ[f'column {st}']=('decor',lambda st=st:column(st))
# ---------------- dais / raised floor (walkable, flat) ----------------
def dais(wc,hc,mat='marble'):
    R={'marble':R8('#3a3440','#b0a8b4','#ffffff'),'wood':R8('#140a04','#7a5230','#e0b078'),'stone':R8('#16181c','#6a707a','#c8ccd0')}[mat]
    W,Hh=wc*16,hc*16; p=Pix(W,Hh)
    for y in range(Hh):
        for x in range(W):
            t=5
            if (x//16+y//16)%2: t=4
            if y>=Hh-6:                                         # two steps down to the floor in front
                t=[7,5,2,6,4,1][y-(Hh-6)]
            elif y==0 or x in (0,W-1): t=2
            elif x==1 or y==1: t=6
            p.set(x,y,R[t])
    f=F(p.im,wc,hc,0,'flat'); f.id=f'dais {wc}x{hc} {mat}'; return f
# ---------------- shared lights (animated, seamless) ----------------
def wall_torch():
    def base():
        p=Pix(16,16)
        MT.lit(p,6,8,[' 1111 ','155551',' 1441 ','  11  ','  14  ','  13  ',' 1331 '],'iron')
        for y in range(9,12): p.set(7,y,WOOD[5]); p.set(8,y,WOOD[3])
        return F(p.im,1,0,0,'hang')
    def paint(p,t):
        flame(p,8,8,4,6,t,1)
    f=framed(base,paint); return f
def brazier():
    def base():
        p=Pix(16,16)
        MT.lit(p,2,7,['111111111111','155555555551',' 1444444441 ','  13333331  ','   1 11 1   ','  1  11  1  ',' 1   11   1 ',' 1  1111  1 '],'iron')
        for x in range(3,13): p.set(x,7,MT.M['orange'][4] if x%2 else MT.M['red'][3])
        return F(p.im,1,1,0,'floor')
    def paint(p,t):
        for i,cx in enumerate((5,8,11)): flame(p,cx,7,4,5+(i%2),t,i)
    return framed(base,paint)
def lantern():
    def base():
        p=Pix(16,16)
        MT.lit(p,5,1,['  11  ',' 1  1 ','111111','1gggg1','1gggg1','1gggg1','111111',' 1111 '],'iron',{'g':MT.M['yellow'][5]})
        return F(p.im,1,0,0,'hang')
    def paint(p,t):
        v=[6,6,5,6,5,5,6,6,5,6,6,5][t%12]
        for y in range(4,7):
            for x in range(6,10): p.set(x,y,MT.M['yellow'][v] if (x+y+t//3)%4 else MT.M['orange'][5])
    return framed(base,paint)
OBJ['wall torch']=('decor',wall_torch); OBJ['brazier']=('decor',brazier); OBJ['hanging lantern']=('decor',lantern)
anim4.ANIM.update({'wall torch':wall_torch,'brazier':brazier,'hanging lantern':lantern})

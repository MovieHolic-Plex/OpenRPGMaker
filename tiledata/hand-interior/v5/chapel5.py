# v5 chapel pieces for an east-oriented basilica (altar to the east, people face east):
# east-facing pews and a free-standing altar seen from the side, altar rail (line autotile), pulpit with stair,
# confessional, reredos, choir stalls, bell rope, votive stand, sanctuary lamp, font, hymn board, stepped dais (west steps).
import sys, math; sys.path.insert(0,'tiledata/hand-interior/v5')
from props5 import *
from prim import box, panels, legs, put_good, ellipse_top, cylinder
import props5
NEWC=[]
def newc(name,cat='church',anim=False):
    def d(fn): reg(name,cat,fn,anim); NEWC.append(name); return fn
    return d
Wd=MT.M['wood']; Dw=MT.M['dwood']; Au=MT.M['gold']; Rd=MT.M['red']; Pu=MT.M['purple']; Mb=MT.M['marble']; Wh=MT.M['white']; Ir=MT.M['iron']
BK=MT.M['black'][0]
def endpanel(p,x0,y0,w,h,R):
    """a bench end / carved board seen face-on: rim, recessed panel, dark bottom"""
    for y in range(y0,y0+h):
        for x in range(x0,x0+w):
            t=4
            if y==y0: t=6
            elif x==x0 or y==y0+1: t=5
            elif x==x0+w-1: t=2
            elif y==y0+h-1: t=0
            elif x0+2<=x<=x0+w-3 and y0+3<=y<=y0+h-3: t=3 if (x==x0+2 or y==y0+3) else 4
            p.set(x,y,R[t])
def pew_e(n=2):
    # pew facing east, seen side-on from above: two light seat planks running N-S, the back board's top edge on the
    # west side (it rises 8 px), low carved ends N and S, a hymn book left on the seat
    R=Wd; Hh=n*16+8; p=Pix(16,Hh)
    for y in range(9,Hh-8):                         # seat planks
        for x in range(7,15):
            t=6 if x in (7,11) else (5 if x<11 else 4)
            if x==10 or x==14: t=2
            p.set(x,y,R[t])
    for y in range(Hh-8,Hh-3):                      # seat front edge + rail under it (south end, seen face-on)
        for x in range(7,15): p.set(x,y,R[3] if y<Hh-6 else (R[1] if y<Hh-4 else R[0]))
    for y in range(1,Hh-3):                         # back board top edge + dark gap before the seat
        p.set(2,y,R[1]); p.set(3,y,R[6]); p.set(4,y,R[5]); p.set(5,y,R[2]); p.set(6,y,R[0])
    for y in range(Hh-10,Hh-1):                     # back board south end face (taller than the seat)
        for x in range(2,7): p.set(x,y,R[[1,5,4,3,1][x-2]] if y<Hh-2 else R[0])
    for x in range(2,15): p.set(x,Hh-1,R[0]) if x<7 else None
    for y in range(3,9):                            # north end board
        for x in range(7,15): p.set(x,y,R[5] if y==3 else (R[4] if y<7 else R[1]))
    for x in range(2,7): p.set(x,0,R[6])
    for y in range(12,17):                          # hymn book
        for x in range(9,13): p.set(x,y,MT.M['red'][3] if x<12 else MT.M['red'][1])
    f=F(p.im,1,n,8,'floor'); f.id=f'pew E{n}'; return f
for _n in (2,3): reg(f'pew E{_n}','church',lambda n=_n:pew_e(n)); NEWC.append(f'pew E{_n}')
@newc('choir stall')
def _():
    # stall row against a north wall, facing south: tall panelled back with pointed tracery, canopy, seat ledge, desk rail
    R=Dw; p=Pix(48,40)
    for y in range(4,30):
        for x in range(1,47):
            t=3
            k=(x-1)%9
            if k in (0,): t=1
            elif k==1: t=5
            ay=4+abs(k-4.5)*1.2                     # pointed arch head in each bay
            if 2<=k<=7 and y>ay+4 and y<24: t=2 if k<7 else 1
            if y==4: t=6
            p.set(x,y,R[t])
    for x in range(0,48):                        # canopy cornice with gilt cresting
        p.set(x,2,R[6]); p.set(x,3,R[4]); p.set(x,1,Au[5] if x%4<2 else R[1]); p.set(x,0,Au[3] if x%4==0 else (0,0,0,0))
    box(p,0,28,48,4,5,'dwood',panel=False)       # seat ledge
    for x in range(2,46): p.set(x,37,R[1]); p.set(x,38,R[0])
    for x in (1,2,45,46):
        for y in range(28,40): p.set(x,y,R[5] if x in (1,45) else R[2])
    for x in range(4,44,9):                      # red cushions
        for y in range(29,31):
            for xx in range(x,x+6): p.set(xx,y,Rd[4] if y==29 else Rd[3])
    f=F(p.im,3,1,24,'wall'); return f
@newc('altar E')
def _():
    # free-standing stone altar, long side N-S (people face east): white linen top with gold-edged frontal hanging on the
    # west (left) side, marble south end face with a carved cross panel
    p=Pix(32,40)
    for y in range(0,28):                        # top
        for x in range(0,32):
            t=6 if y<2 or x<2 else (5 if (x+y)%7 else 4)
            p.set(x,y,Wh[t] if 0<x<31 else Mb[2])
    for y in range(0,28):                        # frontal hanging over the west edge + gold braid
        for x in range(0,6): p.set(x,y,Pu[4] if x>1 else Pu[5])
        p.set(6,y,Au[5] if y%2 else Au[3])
        if 10<=y<=17 and x==3: pass
    for y in range(9,19): p.set(3,y,Au[6]);
    for x in range(1,6): p.set(x,13,Au[6])
    for x in range(0,32): p.set(x,27,Wh[3]); p.set(x,28,Mb[1])
    for y in range(29,40):                       # marble end face
        for x in range(0,32):
            t=4 if 2<x<29 else 5
            if y==39: t=0
            elif x in (0,31): t=1
            elif 12<=x<=19 and 31<=y<=37: t=3 if (x in (12,19) or y in (31,37)) else 5
            p.set(x,y,Mb[t])
    for y in range(32,37): p.set(15,y,Au[5]); p.set(16,y,Au[3])
    for x in range(13,19): p.set(x,33,Au[5])
    f=F(p.im,2,2,8,'floor'); f.surf=(8,2,29,24); f.use='none'; return f
def rail_draw(m,ic):
    """altar rail: polished top rail + turned balusters + a red kneeling cushion on the nave (west / south) side"""
    p=Pix(16,24); R=Dw
    ns='N' in m or 'S' in m; ew='E' in m or 'W' in m
    if ns or not ew:
        ya=0 if 'N' in m else 6; yb=24 if 'S' in m else 18
        for y in range(ya+8,yb):                   # kneeler on the west side (floor level)
            for x in range(1,5): p.set(x,y,Rd[4] if x<3 else Rd[3])
            p.set(5,y,Rd[1])
        for y in range(ya,yb-4):                   # balusters seen from above: dark dots under the rail
            if y%4==1: p.set(7,y+6,R[1]); p.set(12,y+6,R[1])
        for y in range(ya,yb-2):                   # rail top
            p.set(8,y,R[6]); p.set(9,y,R[5]); p.set(10,y,R[4]); p.set(11,y,R[2]); p.set(12,y,R[1])
        if 'S' not in m:                           # front end: the rail's end grain + a newel post face
            for y in range(yb-2,yb+4):
                for x in range(7,13): p.set(x,y,R[[1,5,4,4,3,1][x-7]] if y<yb+3 else R[0])
    if ew:
        xa=0 if 'W' in m else 6; xb=16 if 'E' in m else 12
        for x in range(xa,xb):
            p.set(x,6,R[6]); p.set(x,7,R[5]); p.set(x,8,R[3]); p.set(x,9,R[1])
            for y in range(10,21):
                if x%4==1: p.set(x,y,R[5] if y%5 else R[6])
                elif x%4==2: p.set(x,y,R[2])
            for y in (21,22): p.set(x,y,Rd[4] if y==21 else Rd[2])
    return p.im
LINEKITS['altar rail']=LineKit('altar rail','제단 난간(자동 타일)',rail_draw,kind='floor'); LINEKITS['altar rail'].up=8
def altar_rail(cells): return LINEKITS['altar rail'].item(cells,'altar rail')
@newc('pulpit')
def _():
    # raised wooden pulpit: panelled drum with a red antependium, reading desk + open book, on a stem; a curved stair
    # with a handrail climbs from the west (left). 2x2 footprint, rises 24 px.
    p=Pix(32,56); R=Wd
    for i in range(7):                           # stair: seven treads stepping down to the lower left
        y=20+i*5; x0=0; x1=12-i//3
        for yy in range(y,y+5):
            for x in range(x0,x1):
                t=5 if yy==y else (3 if yy<y+3 else 2)
                p.set(x,yy,R[t])
    for i in range(12):                          # handrail rising to the drum
        x=1+i//1; y=50-i*3
        if 0<=y<56:
            p.set(min(x,31),y,Au[5]); p.set(min(x,31),y+1,R[1])
    for y in range(34,50):                       # stem + foot
        for x in range(15,21): p.set(x,y,R[[1,5,4,3,2,1][x-15]])
    for y in range(50,56):
        for x in range(11,25): p.set(x,y,R[5] if y==50 else (R[3] if y<55 else R[0]))
    for y in range(4,12):                        # drum top ring (seen from above) + desk
        for x in range(8,30):
            d=ell(18.5,7.5,10.5,4.2,x,y)
            if d<=1: p.set(x,y,R[6] if d>0.7 else R[2])
    for y in range(3,8):
        for x in range(12,26): p.set(x,y,R[5] if y>3 else R[6])
    put_good(p,'openbook',15,2)
    for y in range(11,34):                       # drum face: panels, gilt edges, red cloth with gold cross
        for x in range(8,30):
            k=(x-8)%7; t=4 if k not in (0,6) else (6 if k==0 else 2)
            if y in (11,12): t=6 if y==11 else 5
            if y>=32: t=1
            p.set(x,y,R[t])
        p.set(8,y,R[1]); p.set(29,y,R[0])
    for y in range(13,30):
        for x in range(15,23): p.set(x,y,Rd[4] if x<19 else Rd[3])
        p.set(15,y,Au[5]); p.set(22,y,Au[3])
    for x in range(15,23): p.set(x,29,Au[5] if x%2 else Au[3])
    for y in range(16,26): p.set(18,y,Au[6]); p.set(19,y,Au[4])
    for x in range(16,22): p.set(x,19,Au[6])
    f=F(p.im,2,2,24,'floor'); f.use='none'; return f
@newc('confessional')
def _():
    # dark oak booth against a wall: priest's middle door with a grille, two curtained penitent sides, a cornice + cross
    R=Dw; p=Pix(48,40)
    for y in range(4,40):
        for x in range(0,48):
            t=3
            if x in (0,15,16,31,32,47): t=1 if x in (0,16,32) else 5
            if y>=38: t=0
            p.set(x,y,R[t])
    for x in range(0,48): p.set(x,2,R[6]); p.set(x,3,R[4]); p.set(x,4,R[2])
    for y in range(0,3): p.set(23,y,Au[5]); p.set(24,y,Au[3])
    for x in range(22,26): p.set(x,1,Au[5])
    for side in (2,34):                          # curtains (folds)
        for y in range(7,36):
            for x in range(side,side+12):
                c=Pu if side==2 else Pu
                f=(x-side)%4; t=[5,4,3,4][f]
                if y>=34: t=2
                p.set(x,y,c[t])
        for x in range(side,side+12): p.set(x,6,Au[5] if x%2 else Au[3])
    for y in range(8,36):                        # priest door: panels + grille window
        for x in range(18,30):
            t=4 if 19<x<29 and y not in (21,22) else 2
            p.set(x,y,R[t])
    for y in range(10,19):
        for x in range(20,28): p.set(x,y,BK if (x+y)%3 else Au[3])
    p.set(27,26,Au[6]); p.set(27,27,Au[3])
    f=F(p.im,3,1,24,'wall'); return f
@newc('reredos')
def _():
    # gilded altar screen on the east (apse) wall: three pointed niches, a crucifix in the middle, painted saints either side
    p=Pix(48,30)
    for y in range(30):
        for x in range(48):
            k=x//16; lx=x%16
            ay=8+abs(lx-7.5)*0.9
            if lx in (0,15) or y<3 or y>=27:
                p.set(x,y,Au[[5,6,4,3][(x+y)%4]] if not (y>=28) else Au[1]); continue
            if y<ay: p.set(x,y,Au[4] if (x+y)%3 else Au[5]); continue
            if lx in (1,14) or y==int(ay): p.set(x,y,Au[2]); continue
            p.set(x,y,MT.M['blue'][2] if y<18 else MT.M['blue'][1])
            if k!=1 and 5<=lx<=10 and 12<=y<=25:          # a saint: halo, face, robe
                if y<=13 and lx in (6,7,8,9): p.set(x,y,Au[6])
                elif y<=16 and lx in (7,8): p.set(x,y,(236,196,160))
                elif y>16: p.set(x,y,(Rd if k==0 else MT.M['green'])[4 if lx<8 else 3])
    for y in range(10,26): p.set(23,y,Au[6]); p.set(24,y,Au[3])
    for x in range(19,29): p.set(x,14,Au[6]); p.set(x,15,Au[3])
    f=F(p.im,3,0,0,'hang'); f.tall=True; return f
@newc('bell rope')
def _():
    # ringing chamber: a rope from the ceiling hole with a striped woollen sally at hand height
    p=Pix(16,30)
    for y in range(0,30):
        p.set(7,y,MT.M['straw'][5]); p.set(8,y,MT.M['straw'][3])
    for y in range(14,24):
        c=[Rd,Wh,MT.M['blue']][(y//3)%3]
        for x in range(5,11): p.set(x,y,c[5] if x<8 else c[3])
    for x in range(6,10): p.set(x,0,Ir[2])
    f=F(p.im,1,0,0,'hang'); f.tall=True; return f
@newc('hymn board')
def _():
    p=Pix(16,16)
    for y in range(1,15):
        for x in range(2,14): p.set(x,y,Dw[1] if x in (2,13) or y in (1,14) else Dw[2])
    for i,row in enumerate((3,7,11)):
        for x in range(4,12): p.set(x,row,Wh[6] if x%3 else Wh[3]); p.set(x,row+1,Wh[4] if x%3 else Dw[2])
    return F(p.im,1,0,0,'hang')
def _votive_base():
    p=Pix(16,24)
    for y in range(8,22):                        # iron stand with three tiers of tea lights
        p.set(2,y,Ir[3]); p.set(13,y,Ir[2])
    for i,y in enumerate((6,11,16)):
        for x in range(1,15): p.set(x,y,Ir[5]); p.set(x,y+1,Ir[2])
        for x in range(2,14,3):
            p.set(x,y-1,Wh[6]); p.set(x+1,y-1,Wh[4])
    for x in range(3,13): p.set(x,21,Ir[4]); p.set(x,22,Ir[1])
    return F(p.im,1,1,8,'floor')
def _votive_paint(p,t):
    for i,y in enumerate((6,11,16)):
        for j,x in enumerate(range(2,14,3)):
            v=0.5+0.5*osc(t,1,i*1.7+j*2.3)
            p.set(x,y-2,MT.M['yellow'][6] if v>0.35 else MT.M['orange'][5])
            p.set(x+1 if v>0.6 else x,y-3,MT.M['orange'][4] if v>0.2 else MT.M['yellow'][5])
@newc('votive stand','church',anim=True)
def _(): return framed(_votive_base,_votive_paint)
def _slamp_base():
    p=Pix(16,16)
    p.set(7,0,Ir[3]); p.set(8,0,Ir[2])
    for y in range(1,6): p.set(4+y//2,y,Au[4]); p.set(11-y//2,y,Au[3])
    for y in range(6,13):
        for x in range(5,11): p.set(x,y,Rd[4] if x<8 else Rd[3])
    for x in range(5,11): p.set(x,6,Au[5]); p.set(x,13,Au[3])
    return F(p.im,1,0,0,'hang')
def _slamp_paint(p,t):
    v=0.5+0.5*osc(t,1)
    for y in range(8,11):
        for x in range(6,10): p.set(x,y,Rd[6] if (v>0.5 and (x+y)%2) else Rd[5])
    p.set(7,9,MT.M['yellow'][6] if v>0.3 else MT.M['orange'][5])
@newc('sanctuary lamp','church',anim=True)
def _(): return framed(_slamp_base,_slamp_paint)
def _font_base():
    # baptismal font: octagonal stone bowl on a thick stem, water inside
    p=Pix(32,40)
    for y in range(30,40):
        for x in range(4,28): p.set(x,y,STN[5] if y==30 else (STN[3] if y<39 else STN[0]))
    for y in range(18,31):
        for x in range(10,22): p.set(x,y,STN[[1,5,5,4,4,4,3,3,3,2,2,1][x-10]])
    for y in range(2,20):
        for x in range(1,31):
            d=ell(15.5,8,14.5,6.2,x,y)
            if y>=8 and 2<=x<=29 and y<19:        # bowl front face with carved arcading
                k=(x-2)%7; t=4 if k else 2
                if y==18: t=1
                p.set(x,y,STN[t]); continue
            if d<=1: p.set(x,y,STN[6] if d>0.62 else MT.M['water'][3])
    return F(p.im,2,2,8,'floor')
def _font_paint(p,t):
    for i in range(3):
        a=TAU*(t/N)+i*2.1; x=int(15.5+6*math.cos(a)); y=int(7.5+2.5*math.sin(a))
        p.set(x,y,MT.M['water'][6]); p.set(x+1,y,MT.M['water'][5])
@newc('baptismal font','church',anim=True)
def _(): return framed(_font_base,_font_paint)
@newc('paschal candle','church',anim=True)
def _():
    def base():
        p=Pix(16,48)
        for y in range(8,26):
            for x in range(6,10): p.set(x,y,Wh[6] if x<8 else Wh[4])
        for y in range(14,20): p.set(7,y,Rd[4]); p.set(8,y,Rd[3])
        for x in range(5,11): p.set(x,26,Au[5]); p.set(x,27,Au[3])
        for y in range(28,44): p.set(7,y,Au[5]); p.set(8,y,Au[2])
        for y in range(44,48):
            for x in range(3,13): p.set(x,y,Au[5] if y==44 else (Au[3] if y<47 else Au[1]))
        return F(p.im,1,1,32,'floor')
    def paint(p,t): flame(p,8,8,3,6,t,4)
    return framed(base,paint)
def dais_w(wc,hc,mat='marble'):
    """raised sanctuary floor with two steps down on its WEST edge (east-facing church) and a front (south) edge"""
    R={'marble':R8('#3a3440','#b0a8b4','#ffffff'),'stone':R8('#16181c','#6a707a','#c8ccd0')}[mat]
    W,Hh=wc*16,hc*16; p=Pix(W,Hh)
    for y in range(Hh):
        for x in range(W):
            t=5 if (x//16+y//16)%2==0 else 4
            if x<10: t=[2,6,4,1,6,4,2,6,4,1][x] if y<Hh-4 else [2,4,3,1,4,3,2,4,3,1][x]   # two treads + risers
            elif y>=Hh-4: t=[5,3,2,0][y-(Hh-4)]                                            # front edge of the platform
            elif y==0: t=2
            p.set(x,y,R[t])
    f=F(p.im,wc,hc,0,'flat'); f.id=f'dais-w {wc}x{hc} {mat}'; return f

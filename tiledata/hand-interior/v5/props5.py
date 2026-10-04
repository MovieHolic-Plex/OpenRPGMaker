# v5 props, part 2: medieval / Middle-earth-flavoured pieces (hobbit hole, dwarf hall, elf hall, mead hall, throne room,
# wizard tower, dungeon, mine). Same rules: fixed front-top view, rolled rim, lit top-left, black only at the bottom and
# in cavities, fixed ramps. Animated ones are seamless 12-frame loops (anim4.framed + periodic functions).
import sys, math; sys.path.insert(0,'tiledata/hand-interior/v5')
from kit5 import *
import kit5
R8=kit4.R8
def ell(cx,cy,rx,ry,x,y): return ((x-cx)/rx)**2+((y-cy)/ry)**2
def reg(name,cat,fn,anim=False):
    OBJ[name]=(cat,fn)
    if anim: anim4.ANIM[name]=fn
NEW=[]
def new(name,cat,anim=False):
    def d(fn): reg(name,cat,fn,anim); NEW.append(name); return fn
    return d
GRN=R8('#061a0c','#2e7a3a','#a8e0a0'); GLS=MT.M['glass']; BRS=MT.M['brass']; STN=kit5.COL['stone']
# ---------------- hobbit hole ----------------
@new('round window','hobbit')
def _():
    p=Pix(16,16)
    for y in range(16):
        for x in range(16):
            d=ell(7.5,7.5,7,7,x,y)
            if d>1: continue
            if d>0.62: t=6 if (x+y)<14 else (3 if d>0.85 else 4); p.set(x,y,WOOD[t] if d<0.92 else WOOD[1]); continue
            g=4 if y<6 else (3 if y<10 else 2)
            if (x-y) in (1,2) and y<7: g=5
            if x in (7,8) or y in (7,8): p.set(x,y,WOOD[6] if (x==7 or y==7) else WOOD[3]); continue
            p.set(x,y,GLS[g])
    return F(p.im,1,0,0,'hang')
@new('round door','hobbit')
def _():
    # the round green door, filling both wall-face rows (2 cells wide), brass knob in the very middle, a timber ring
    p=Pix(32,30)
    for y in range(30):
        for x in range(32):
            d=ell(15.5,14.5,14.5,14.5,x,y)
            if d>1: continue
            if d>0.84: p.set(x,y,WOOD[1] if d>0.94 else (WOOD[6] if (x<16 and y<15) else WOOD[3])); continue
            if d>0.78: p.set(x,y,GRN[1]); continue
            t=5 if x<12 else (4 if x<22 else 3)
            if x%7==3: t=2
            p.set(x,y,GRN[t])
    for y in (14,15):
        for x in (15,16): p.set(x,y,BRS[5] if (x,y)==(15,14) else BRS[3])
    f=F(p.im,2,0,0,'hang'); f.tall=True; return f
@new('round arch','hobbit')
def _():
    # timber arch round a doorway: drawn over the gap column and the two wall faces beside it (3 cells, both face rows)
    p=Pix(48,32)
    for y in range(32):
        for x in range(48):
            d=ell(23.5,20,11.5,19,x,y)
            if 0.72<d<1.0 and y<30: p.set(x,y,WOOD[6] if x<24 and y<16 else (WOOD[4] if d<0.86 else WOOD[2]))
            elif 1.0<=d<1.12 and y<30: p.set(x,y,WOOD[1])
    f=F(p.im,3,0,0,'hang'); f.frame=True; f.tall=True; return f
@new('pipe rack','hobbit')
def _():
    p=Pix(16,16)
    for x in range(1,15): p.set(x,3,WOOD[6]); p.set(x,4,WOOD[3]); p.set(x,5,WOOD[1])
    for i,cx in enumerate((3,7,11)):
        MT.lit(p,cx,4,[' 11','155','14 ','14 ','14 ','144','1331'],'wood' if i!=1 else 'dwood')
    return F(p.im,1,0,0,'hang')
@new('cheese wheels','hobbit')
def _():
    p=Pix(16,16)
    for i,(cx,cy) in enumerate(((5,11),(11,11),(8,6))):
        for y in range(cy-3,cy+4):
            for x in range(cx-4,cx+5):
                d=ell(cx,cy-1,4,2,x,y)
                if y<=cy-1 and d<=1: p.set(x,y,MT.M['cheese'][5] if d<0.5 else MT.M['cheese'][4])
                elif cy-1<y<=cy+2 and abs(x-cx)<=4: p.set(x,y,MT.M['cheese'][3] if abs(x-cx)<4 else MT.M['cheese'][1])
        for x in range(cx-3,cx+4): p.set(x,cy+3,MT.M['cheese'][1])
    return F(p.im,1,1,0,'floor')
# ---------------- dwarf hall ----------------
@new('mine cart','mine')
def _():
    p=Pix(16,16); IR=MT.M['iron']
    for y in range(3,13):
        for x in range(1,15):
            t=4 if y<5 else 3
            if x in (1,14): t=1
            if y==3: t=5
            if y==12: t=1
            if y in (7,8) and 2<x<13: t=2
            p.set(x,y,IR[t])
    for x in range(3,13):
        for y in range(1,4):
            if H(x,y,3)<0.8: p.set(x,y,[STN[3],STN[4],MT.M['gold'][5],STN[2]][int(H(x,y,4)*4)])
    for cx in (4,11):
        for y in range(12,16):
            for x in range(cx-2,cx+2): p.set(x,y,IR[1] if abs(x-cx+0.5)>1 or y==15 else IR[3])
    return F(p.im,1,1,0,'floor')
@new('ore pile','mine')
def _():
    p=Pix(16,16)
    for y in range(4,16):
        for x in range(1,15):
            d=ell(7.5,14,7,9,x,y)
            if d>1: continue
            v=H(x//2,y//2,7)
            c=STN[2 if d>0.8 else (4 if (x+y)%3 else 3)]
            if v<0.12: c=MT.M['gold'][5]
            elif v<0.2: c=MT.M['teal'][4]
            if y==15: c=STN[1]
            p.set(x,y,c)
    return F(p.im,1,1,0,'floor')
def rune_stone():
    def base():
        p=Pix(16,32)
        for y in range(6,32):
            for x in range(2,14):
                if y<9 and abs(x-7.5)>5.5-(9-y): continue
                t=3 if x<5 else (2 if x>10 else 3)
                if x in (2,13) or y==31: t=0
                if x==3: t=4
                p.set(x,y,kit5.COL['dwarf'][t+1])
        return F(p.im,1,1,16,'floor')
    GL=[(7,11),(8,11),(7,12),(6,13),(8,13),(7,14),(7,17),(6,18),(8,18),(7,19),(7,20),(6,23),(7,23),(8,23),(8,24),(7,25)]
    def paint(p,t):
        v=0.5+0.5*osc(t,1)
        c=MT.M['teal'][6] if v>0.66 else (MT.M['teal'][5] if v>0.33 else MT.M['teal'][4])
        for x,y in GL: p.set(x,y,c)
    return framed(base,paint)
reg('rune stone','mine',rune_stone,True); NEW.append('rune stone')
@new('stone throne','mine')
def _():
    p=Pix(16,32); R=kit5.COL['dwarf']; Gd=MT.M['gold']
    for y in range(2,32):
        for x in range(1,15):
            if y<18 and not (3<=x<=12): continue
            t=4
            if y<18: t=5 if x<6 else 4
            if x in (1,14,3,12) : t=1
            if 18<=y<=21: t=6 if y==18 else 3
            if y>=29: t=1
            p.set(x,y,R[t])
    for x in range(4,12): p.set(x,5,Gd[5]); p.set(x,2,Gd[4])
    return F(p.im,1,1,16,'floor')
# ---------------- elf hall ----------------
def moon_pool(wc=3,hc=2):
    W,Hh=wc*16,hc*16
    WT=R8('#04101e','#1a4a6a','#9ad0e8'); RIM=R8('#3a4838','#98a890','#e8f0e0')
    def base():
        p=Pix(W,Hh)
        for y in range(Hh):
            for x in range(W):
                d=ell((W-1)/2,(Hh-1)/2,W/2-0.5,Hh/2-0.5,x,y)
                if d>1: continue
                if d>0.72: p.set(x,y,RIM[6] if y<Hh/2 and d<0.86 else (RIM[3] if d<0.9 else RIM[1])); continue
                p.set(x,y,WT[3] if y<Hh*0.45 else WT[2])
        return F(p.im,wc,hc,0,'floor')
    def paint(p,t):
        cx,cy=W*0.62,Hh*0.42
        for y in range(Hh):
            for x in range(W):
                c=p.get(x,y)
                if c[3]==0 or c[:3] not in (WT[2][:3],WT[3][:3],WT[4][:3],WT[5][:3],WT[6][:3]): continue
                ring=math.hypot((x-cx)/1.6,y-cy)
                w=math.sin(ring*1.3-TAU*t/N)
                if ring<3.2: p.set(x,y,WT[7] if ring<2 else WT[6])       # the moon's reflection
                elif w>0.86 and ring<14: p.set(x,y,WT[5])
                elif w>0.6 and ring<14: p.set(x,y,WT[4])
        for i,(lx,ly) in enumerate(((W*0.25,Hh*0.62),(W*0.4,Hh*0.72))):   # lily pads bob
            dy=int(round(0.6*osc(t,1,i*2)))
            for y in range(-2,3):
                for x in range(-3,4):
                    if ell(0,0,3,2,x,y)<=1 and not (x==1 and y<0): p.set(int(lx)+x,int(ly)+y+dy,GRN[4] if y<0 else GRN[3])
            p.set(int(lx),int(ly)-1+dy,MT.M['pink'][5])
    return framed(base,paint)
reg('moon pool','elf',moon_pool,True); NEW.append('moon pool')
@new('elven harp','elf')
def _():
    p=Pix(16,32); SV=R8('#2a2a34','#a0a8b8','#ffffff'); Gd=MT.M['gold']
    for y in range(3,30):
        x=int(4+3*math.sin((y-3)/27*math.pi))
        p.set(x,y,Gd[5]); p.set(x+1,y,Gd[3])
    for x in range(4,13): p.set(x,3+int((x-4)*0.3),Gd[5])
    for y in range(4,29): p.set(12,y,Gd[4]); p.set(13,y,Gd[2])
    for k in range(6):
        x=6+k
        for y in range(6+k//2,28):
            if y%2==0: p.set(x,y,SV[6])
    for x in range(3,15): p.set(x,29,WOOD[5]); p.set(x,30,WOOD[2]); p.set(x,31,WOOD[0])
    return F(p.im,1,1,16,'floor')
def leaf_lantern():
    def base():
        p=Pix(16,16)
        for x in range(4,12): p.set(x,1,tiles5.LEAF[2])
        for y in range(2,4): p.set(7,y,WOOD[3])
        for y in range(4,13):
            for x in range(4,12):
                if ell(7.5,8,4,4.5,x,y)<=1: p.set(x,y,tiles5.LEAF[1] if ell(7.5,8,4,4.5,x,y)>0.7 else MT.M['white'][5])
        return F(p.im,1,0,0,'hang')
    def paint(p,t):
        v=0.5+0.5*osc(t,1)
        for y in range(6,11):
            for x in range(6,10):
                if ell(7.5,8,2.2,2.6,x,y)<=1: p.set(x,y,(210,255,230,255) if v>0.5 else (180,240,210,255))
    return framed(base,paint)
reg('leaf lantern','elf',leaf_lantern,True); NEW.append('leaf lantern')
@new('elven bed','elf')
def _():
    f=kit.bed('teal'); p=Pix(16,38); p.im.alpha_composite(f.im)
    for y in range(0,12):
        for x in range(0,16):
            if y<8 and H(x,y,9)<0.55 and (x<4 or x>11 or y<3): p.set(x,y,tiles5.LEAF[[2,3,3,4][int(H(x,y,8)*4)]])
    g=F(p.im,1,2,6,'wall'); return g
@new('white tree','elf')
def _():
    # a silver-white tree in a stone planter (statue-like) — Gondor / elven motif
    p=Pix(16,40); SV=R8('#40404c','#b8bcc8','#ffffff')
    for y in range(8,34): p.set(7,y,SV[5]); p.set(8,y,SV[3])
    for k,(ax,ay) in enumerate(((-6,6),(6,5),(-5,1),(5,0),(0,-2))):
        for s in range(12):
            x=int(7.5+ax*s/12); y=int(14+ay*s/12-s*0.6)
            p.set(x,y,SV[5])
    for y in range(0,16):
        for x in range(1,15):
            if H(x,y,11)<0.3 and ell(7.5,7,7,7,x,y)<1: p.set(x,y,SV[6] if y<8 else SV[4])
    for y in range(34,40):
        for x in range(3,13): p.set(x,y,STN[6] if y==34 else (STN[4] if y<39 else STN[1]))
    return F(p.im,1,1,24,'floor')
# ---------------- mead hall / throne room ----------------
def long_hearth(hc=5):
    # a stone-rimmed fire trench running N-S down the middle of the hall (1 wide x hc long): glowing coals that twinkle
    # with their own phase, a row of flame tongues
    W,Hh=16,hc*16
    def base():
        p=Pix(W,Hh)
        for y in range(Hh):
            for x in range(W):
                if x in (0,15) or y in (0,Hh-1): t=1
                elif x in (1,14) or y in (1,Hh-2): t=5 if (x==1 or y==1) else 3
                else: p.set(x,y,MT.M['black'][1]); continue
                p.set(x,y,STN[t])
        return F(p.im,1,hc,0,'floor')
    def paint(p,t):
        for y in range(3,Hh-3):
            for x in range(3,13):
                v=osc(t,1,H(x,y,17)*TAU)
                r=H(x//2,y//2,19)
                if r<0.2: continue
                c=MT.M['yellow'][5] if v>0.8 else (MT.M['orange'][5] if v>0.1 else (MT.M['orange'][4] if v>-0.6 else MT.M['red'][3]))
                p.set(x,y,c)
        for k in range(1,hc*2):
            flame(p,5+(k%2)*6,k*8+3,5,6,t,k%3)
    return framed(base,paint)
for hc in (3,4,5,6): reg(f'long hearth {hc}','hall',lambda hc=hc:long_hearth(hc),True)
NEW.append('long hearth 5')
@new('tapestry','hall')
def _():
    # a woven hanging that fills both face rows: dark red ground, a white horse, gold fringe
    p=Pix(16,30); RD=MT.M['red']; Gd=MT.M['gold']
    for x in range(1,15): p.set(x,0,WOOD[5]); p.set(x,1,WOOD[2])
    for y in range(2,27):
        for x in range(2,14):
            p.set(x,y,RD[3] if x in (2,13) else RD[2] if (x+y)%2 else RD[3])
    horse=['  11   ','  111  ',' 1111  ','111111 ','  1111 ','  1  1 ','  1  1 ']
    for j,r in enumerate(horse):
        for i,c in enumerate(r):
            if c=='1': p.set(4+i,10+j,MT.M['white'][6] if j<4 else MT.M['white'][5])
    for x in range(2,14): p.set(x,27,Gd[5] if x%2 else Gd[3]); p.set(x,28,Gd[3] if x%2 else (0,0,0,0))
    f=F(p.im,1,0,0,'hang'); f.tall=True; return f
@new('royal banner','hall')
def _():
    p=Pix(16,30); RD=MT.M['red']; Gd=MT.M['gold']
    for x in range(2,14): p.set(x,0,Gd[5]); p.set(x,1,Gd[2])
    for y in range(2,29):
        for x in range(3,13):
            if y>24 and abs(x-7.5)<(y-24)*1.2: continue
            p.set(x,y,RD[4] if x<5 else (RD[2] if x>10 else RD[3]))
    for y in range(9,17):
        for x in range(6,10):
            if (x-7.5)**2+(y-12.5)**2<5: p.set(x,y,Gd[5] if y<12 else Gd[4])
    for y in range(8,19): p.set(7,y,Gd[5]) if y in (8,18) else None
    f=F(p.im,1,0,0,'hang'); f.tall=True; return f
# ---------------- wizard tower ----------------
@new('spiral stair','tower')
def _():
    # a spiral staircase seen from the front-top: ten stone treads wind clockwise up round a newel post from the
    # south (floor level) through west and north to the east, each raised 3 px higher; every tread shows its lit top
    # and the dark riser under it, with iron rail posts on the outer edge. The last 60 degrees is the landing gap.
    p=Pix(32,64); cx,cy=15.5,47.5
    def newel():
        for y in range(int(cy)-33,int(cy)+3):            # newel post from the floor up past the top tread
            for x in range(13,19): p.set(x,y,STN[[1,5,4,3,2,1][x-13]])
        for x in range(13,19): p.set(x,int(cy)-34,STN[6])
    drawn_newel=False
    wedges=[]
    for i in range(10):
        a0=90+i*30; h=i*3
        pts=[]
        for y in range(32,64):
            for x in range(32):
                r=math.hypot(x-cx,y-cy)
                if not (3<=r<=15.2): continue
                a=(math.degrees(math.atan2(y-cy,x-cx))+360)%360
                if (a-a0)%360<30: pts.append((x,y,r,(a-a0)%360))
        my=sum(q[1] for q in pts)/len(pts)
        wedges.append((my,h,i,pts))
    for my,h,i,pts in sorted(wedges):
        if my>cy and not drawn_newel: newel(); drawn_newel=True
        for x,y,r,u in pts:                              # the tread is a slab: 3 px thick edge, open underneath
            for yy in range(y-h,y-h+4): p.set(x,yy,STN[2] if yy<y-h+3 else STN[0])
        for x,y,r,u in pts:                              # tread top
            t=5 if u>4 else 6
            if r>13.8: t=3
            p.set(x,y-h,STN[t] if not (u<2) else STN[2])
        for x,y,r,u in pts:                              # rail post at the outer edge
            if r>14.4 and 12<u<16:
                for yy in range(y-h-6,y-h): p.set(x,yy,MT.M['iron'][4] if yy%2 else MT.M['iron'][2])

    f=F(p.im,2,2,32,'floor'); f.stairs='spiral'; return f
def owl_perch():
    def base():
        p=Pix(16,32)
        for y in range(14,31): p.set(7,y,WOOD[5]); p.set(8,y,WOOD[2])
        for x in range(3,13): p.set(x,13,WOOD[6]); p.set(x,14,WOOD[2])
        for x in range(4,12): p.set(x,31,WOOD[1])
        OW=R8('#2a1a0c','#8a6a44','#e8d0a8')
        rows=['  1  1  ','  1661  ','  1ww1 ','15eeee51','15eeee51','155555 1','15444451',' 144441 ','  1331  ']
        for j,r in enumerate(rows[:9]):
            for i,c in enumerate(r):
                if c=='1': p.set(4+i,4+j,OW[1])
                elif c in '6543': p.set(4+i,4+j,OW[int(c)+0 if int(c)<8 else 7])
                elif c=='w': p.set(4+i,4+j,OW[6])
                elif c=='e': p.set(4+i,4+j,OW[6])
        for x,y in ((6,8),(9,8)): p.set(x,y,MT.M['yellow'][5]);
        for x,y in ((6,8),(9,8)): p.set(x+1 if x==6 else x-1,y,MT.M['black'][0])
        return F(p.im,1,1,16,'floor')
    def paint(p,t):
        if t in (5,6):                                    # blink once per loop
            OW=R8('#2a1a0c','#8a6a44','#e8d0a8')
            for x in (6,7,8,9): p.set(x,8,OW[4])
    return framed(base,paint)
reg('owl perch','tower',owl_perch,True); NEW.append('owl perch')
@new('star chart','tower')
def _():
    p=Pix(16,16); NV=R8('#040818','#1a2a5a','#8aa8e8')
    for y in range(1,14):
        for x in range(1,15):
            p.set(x,y,WOOD[5] if (x in (1,14) or y in (1,13)) else NV[2])
    for x,y in ((4,4),(7,3),(10,5),(12,9),(5,9),(8,11),(3,11)): p.set(x,y,MT.M['yellow'][6])
    for a,b in (((4,4),(7,3)),((7,3),(10,5)),((5,9),(8,11))):
        for s in range(1,6):
            x=int(a[0]+(b[0]-a[0])*s/6); y=int(a[1]+(b[1]-a[1])*s/6); p.set(x,y,NV[5])
    return F(p.im,1,0,0,'hang')
def orrery():
    def base():
        p=Pix(16,24)
        for y in range(14,21): p.set(7,y,BRS[5]); p.set(8,y,BRS[2])
        for x in range(4,12): p.set(x,21,WOOD[6]); p.set(x,22,WOOD[3]); p.set(x,23,WOOD[1])
        return F(p.im,1,1,8,'floor')
    def paint(p,t):
        cx,cy=7.5,9
        for y in range(2,16):
            for x in range(0,16):
                if abs(ell(cx,cy,6,2.6,x,y)-1)<0.18: p.set(x,y,BRS[4])
        p.set(7,9,MT.M['yellow'][6]); p.set(8,9,MT.M['orange'][5]); p.set(7,8,MT.M['yellow'][5]); p.set(8,8,MT.M['yellow'][6])
        for k,(r,col,sp) in enumerate(((3.2,MT.M['blue'][5],1),(6,MT.M['red'][5],2))):
            a=TAU*sp*t/N+k
            x=int(round(cx+r*math.cos(a))); y=int(round(cy+r*0.43*math.sin(a)))
            p.set(x,y,col); p.set(x+1,y,col)
    return framed(base,paint)
reg('orrery','tower',orrery,True); NEW.append('orrery')
# ---------------- dungeon ----------------
@new('shackles','dungeon')
def _():
    p=Pix(16,16); IR=MT.M['iron']
    for cx in (4,11):
        p.set(cx,1,IR[2]); p.set(cx,2,IR[5])
        for y in range(3,10): p.set(cx+(y%2),y,IR[4] if y%2 else IR[2])
        for y in range(10,14):
            for x in range(cx-2,cx+3):
                if abs(ell(cx,11.5,2,2,x,y)-1)<0.5: p.set(x,y,IR[5] if y<12 else IR[3])
    return F(p.im,1,0,0,'hang')
@new('slop bucket','dungeon')
def _():
    p=Pix(16,16)
    MT.lit(p,4,6,['11111111','15555551','1wwwwww1','14444441','13333331','14444441','13333331',' 111111 '],'wood',{'w':R8('#1a1a10','#4a4a2a','#8a8a5a')[3]})
    return F(p.im,1,1,0,'floor')
def drip_puddle():
    WT=R8('#0a1420','#2a4458','#8ab0c8')
    def base():
        p=Pix(16,16)
        for y in range(4,14):
            for x in range(1,15):
                if ell(7.5,9,6.5,4,x,y)<=1: p.set(x,y,WT[2] if ell(7.5,9,6.5,4,x,y)>0.6 else WT[3])
        return F(p.im,1,1,0,'flat')
    def paint(p,t):
        s=t%6; r=1+s*0.9                                      # a drop lands every 6 frames, its ring spreads
        for y in range(4,14):
            for x in range(1,15):
                if abs(ell(7.5,9,r*1.6,r,x,y)-1)<0.25 and ell(7.5,9,6.5,4,x,y)<0.95: p.set(x,y,WT[6] if s<3 else WT[5])
        if s==5: p.set(7,5,WT[7])
    return framed(base,paint)
reg('drip puddle','dungeon',drip_puddle,True); NEW.append('drip puddle')
# ---------------- mine ----------------
@new('ore vein','mine')
def _():
    p=Pix(16,16)
    for k in range(9):
        x=int(2+H(k,1,3)*12); y=int(2+H(k,2,3)*12)
        col=MT.M['teal'] if k%3 else MT.M['gold']
        p.set(x,y,col[6]); p.set(x+1,y,col[4]); p.set(x,y+1,col[3])
    return F(p.im,1,0,0,'hang')
@new('pick rack','mine')
def _():
    p=Pix(16,16); IR=MT.M['iron']
    for x in range(1,15): p.set(x,2,WOOD[6]); p.set(x,3,WOOD[2])
    for cx in (4,11):
        for y in range(4,15): p.set(cx,y,WOOD[6]); p.set(cx+1,y,WOOD[3])
        for i,x in enumerate(range(cx-4,cx+6)):
            y=5+abs(x-cx-0.5)//3
            p.set(x,int(y),IR[5]); p.set(x,int(y)+1,IR[2])
    return F(p.im,1,0,0,'hang')
@new('powder kegs','mine')
def _():
    p=Pix(16,16)
    for cx,cy in ((5,10),(11,10),(8,5)):
        MT.lit(p,cx-3,cy-3,[' 1111 ','155551','1r44r1','144441','1r33r1',' 1111 '],'wood',{'r':MT.M['red'][4]})
    return F(p.im,1,1,0,'floor')
@new('timber prop','mine')
def _():
    # a free-standing pit prop: post + cap beam wedged under the roof
    p=Pix(16,40)
    for y in range(4,40):
        p.set(6,y,WOOD[1]); p.set(7,y,WOOD[6]); p.set(8,y,WOOD[4]); p.set(9,y,WOOD[1])
    for x in range(0,16): p.set(x,1,WOOD[1]); p.set(x,2,WOOD[6]); p.set(x,3,WOOD[3]); p.set(x,4,WOOD[1])
    return F(p.im,1,1,24,'floor')
@new('drain grate','shop')
def _():
    # iron drain in a wet-stone floor: dark sump under slotted bars, a stone collar
    p=Pix(16,16); IR=MT.M['iron']
    for y in range(3,13):
        for x in range(3,13):
            if x in (3,12) or y in (3,12): p.set(x,y,STN[5] if (x==3 or y==3) else STN[2])
            elif (x-4)%2==0: p.set(x,y,IR[4] if y<8 else IR[3])
            else: p.set(x,y,MT.M['black'][0])
    return F(p.im,1,1,0,'flat')

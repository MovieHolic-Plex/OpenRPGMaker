# v5 surfaces. Floors stay quiet (4-5 tones, painted in world coords); wall faces are 32 px, lower half one step darker,
# bottom rows = skirting. Wall painters here are world-coordinate functions (room2.FACEFN) so long walls never repeat
# every 16 px.
from k import *
from p2 import R_
import tiles as TL, room2, tiles4
import math
def _fl(R,v): return R[max(0,min(len(R)-1,v))]
# ---------------- floors ----------------
WET=R_('#1e242c','#28303a','#323c46','#3c4652','#48525e','#7c8c9c')           # wet slate, cold blue-grey, glossy glints
def wetstone(x,y,seed=41):
    sy=y//10; off=(sy*9)%14; lx=(x+off)%14; ly=y%10
    if ly==9 or lx==13: return WET[0]
    base=[2,2,3,3][int(H((x+off)//14,sy,seed)*4)]
    t=base+1 if ly==0 and lx<12 else base
    wet=H(x//7,y//5,seed+3)
    if wet<0.18: t=max(1,t-1)                                   # damp patch
    if wet<0.18 and (x+y)%7==0: return WET[5]                    # glint on the wet patch
    return _fl(WET,t)
TERRA=R_('#4a2418','#6a3424','#7c3e2a','#884630','#945038','#a45e42')         # terracotta shop tiles, 8x8, offset
def terra(x,y,seed=43):
    lx,ly=x%8,y%8
    if lx==7 or ly==7: return TERRA[1]
    base=3 if H(x//8,y//8,seed)<0.55 else 4
    if ly==0 and lx<6: return TERRA[base+1]
    return TERRA[base]
STRAW=R_('#5a4414','#7a5c1c','#94722a','#a88436','#bc9844','#d4b05c')
def straw(x,y,seed=45):
    # loose straw: short diagonal strands in 3 tones over a mid base, no grid
    r=H(x,y,seed); d=(x+y*2+int(H(x//5,y//5,seed+1)*6))%7
    t=3
    if d==0: t=5
    elif d==3: t=2
    if r<0.05: t=1
    if H(x//6,y//4,seed+2)<0.2: t=max(1,t-1)
    return STRAW[t]
GRATE=R_('#14161a','#24282e','#343a42','#464c56','#5a626c','#7c8692')
def grate(x,y,seed=47):
    # riveted steel deck plates 16x16 with a diamond tread; bolts at plate corners
    lx,ly=x%16,y%16
    if lx==15 or ly==15: return GRATE[0]
    if lx==0 or ly==0: return GRATE[4]
    if lx in (2,13) and ly in (2,13): return GRATE[5]
    d=(lx+ly)%4==0 or (lx-ly)%4==0
    return GRATE[3] if d else GRATE[2]
CAVE=R_('#2a2420','#3a322a','#463c32','#524638','#5e5040','#6c5c4a')
def cave(x,y,seed=49):
    v=H(x//5,y//4,seed)*0.6+H(x//2,y//2,seed+1)*0.4
    t=2 if v<0.35 else (3 if v<0.75 else 4)
    r=H(x,y,seed+2)
    if r<0.02: return CAVE[5]
    if r<0.05: return CAVE[1]
    return CAVE[t]
ELF=R_('#4a5a48','#6a7a62','#8a9a7c','#9aaa8a','#aabb98','#c8d8b0')           # pale moon-stone with leaf inlay
def elfstone(x,y,seed=51):
    # large soft slabs (24x16) + a faint leaf vein pattern every other slab
    sy=y//16; off=12 if sy%2 else 0; lx=(x+off)%24; ly=y%16
    if ly==15 or lx==23: return ELF[1]
    t=3 if H((x+off)//24,sy,seed)<0.5 else 4
    if ly==0: t+=1
    cx,cy=11.5,7.5
    if ((x+off)//24+sy)%2==0 and abs((lx-cx)-(ly-cy)*1.2)<0.6 and abs(lx-cx)<7: t=2
    return _fl(ELF,t)
DWARF=R_('#1c1a1e','#2a282e','#36343a','#424048','#4e4c54','#c89a3a')          # dark granite, gold inlay lines
def dwarf(x,y,seed=53):
    # 32x32 carved squares: gold inlay border every 32 px, inner square, quiet granite
    lx,ly=x%32,y%32
    if lx in (0,31) or ly in (0,31): return DWARF[1]
    if lx in (1,) or ly in (1,): return DWARF[5] if (lx+ly)%2==0 else DWARF[4]
    if lx in (8,23) and 8<=ly<=23 or ly in (8,23) and 8<=lx<=23: return DWARF[1]
    t=3 if H(x//4,y//4,seed)<0.7 else 2
    return DWARF[t]
RUSH=R_('#3e2a18','#5a3e24','#6a4a2c','#765434','#825e3c','#b0924a')
def rush(x,y,seed=55):
    # wide dark hall planks (5 px boards) with scattered rushes
    t=tiles4
    row=y//5; ly=y%5
    if ly==4: return RUSH[1]
    off=int(H(row,0,seed)*40); k=(x+off)//40
    b=3 if H(row,k,seed+1)<0.5 else 2
    if (x+off)%40==0: return RUSH[1]
    if ly==0: b+=1
    if H(x//3,y,seed+2)<0.03: return RUSH[5]
    return RUSH[b]
MARB=R_('#5a5058','#8a8088','#a8a0a6','#bcb4ba','#ccc6ca','#e2dce0')
def marble(x,y,seed=57):
    # large polished slabs 32x32 with a thin dark joint and soft veining
    lx,ly=x%32,y%32
    if lx==31 or ly==31: return MARB[1]
    v=math.sin((x*0.35+y*0.18)+H(x//32,y//32,seed)*6)*0.5+0.5
    t=4 if v<0.72 else 3
    if abs(math.sin(x*0.21+y*0.47+H(x//32,y//32,seed+1)*9))<0.05: t=2
    if ly==0: t=5
    return MARB[t]
STAGE=R_('#3a2410','#5a3818','#6e4620','#7c5028','#8a5c30','#a47440')
def stage(x,y,seed=59):
    # stage: long narrow boards running E-W, 3 px, darker than house floors
    row=y//3; ly=y%3
    if ly==2: return STAGE[1]
    off=int(H(row,1,seed)*48); k=(x+off)//48
    b=3 if H(row,k,seed)<0.5 else 4
    if (x+off)%48==0: return STAGE[1]
    return STAGE[b if ly else b+1] if b<5 else STAGE[5]
DUNG=R_('#1e1c1c','#2c2826','#38322e','#443c36','#50463e','#5e5244')
def dungeon(x,y,seed=61):
    sy=y//8; off=(sy*5)%12; lx=(x+off)%12; ly=y%8
    if ly==7 or lx==11: return DUNG[0]
    t=[2,3,3,4][int(H((x+off)//12,sy,seed)*4)]
    if ly==0 and lx<10: t+=1
    if H(x//3,y//3,seed+3)<0.12: t-=1
    if H(x,y,seed+4)<0.015: return R_('#3a4a2a')[0]          # moss speck
    return _fl(DUNG,t)
HOB=R_('#5a3a1c','#7a5028','#8c5e30','#9a6a38','#a67440','#b8864c')
def hobbit(x,y,seed=63):
    # warm honey boards, wider than the house plank (6 px), board ends staggered
    row=y//6; ly=y%6
    if ly==5: return HOB[1]
    off=int(H(row,3,seed)*36); k=(x+off)//36
    if (x+off)%36==0: return HOB[1]
    b=3 if H(row,k,seed)<0.5 else 4
    if ly==0: b+=1
    if H(x//4,y,seed+1)<0.06: b-=1
    return _fl(HOB,b)
REDC=R_('#3a0a10','#5a1018','#781620','#8a1c26','#9c2430','#c8a040')
def casino(x,y,seed=65):
    # wall-to-wall patterned carpet: burgundy with a small gold lozenge every 16 px
    lx,ly=x%16,y%16
    d=abs(lx-7.5)+abs(ly-7.5)
    if 3.5<d<5: return REDC[5] if (lx+ly)%2 else REDC[4]
    if d<2: return REDC[4]
    return REDC[3] if (x//2+y//2)%2 else REDC[2]
SNOWW=R_('#4a3a2c','#5e4a38','#6c5642','#78604a','#846a52','#e8eef4')
def narshe(x,y,seed=67):
    # dark heavy planks with meltwater/snow tracked in near the door handled by zones; here: plain dark timber
    row=y//4; ly=y%4
    if ly==3: return SNOWW[0]
    off=int(H(row,5,seed)*30); k=(x+off)//30
    if (x+off)%30==0: return SNOWW[0]
    b=3 if H(row,k,seed)<0.5 else 2
    if ly==0: b+=1
    return SNOWW[b]
def snowmat(x,y,seed=69):
    b=narshe(x,y,seed)
    if H(x//2,y//2,seed+1)<0.45: return SNOWW[5] if H(x,y,seed)<0.7 else R_('#b8c8d8')[0]
    return b
SLUM=R_('#1e1c1a','#2a2622','#34302a','#3e3830','#4a4238','#2a3a44')
def slum(x,y,seed=71):
    # broken flags, grime, puddles (blue-grey)
    sy=y//9; off=(sy*7)%13; lx=(x+off)%13; ly=y%9
    if ly==8 or lx==12: return SLUM[0]
    t=[2,3,3,2][int(H((x+off)//13,sy,seed)*4)]
    if H(x//6,y//4,seed+2)<0.12: return SLUM[5] if (x+y)%5 else R_('#4a6070')[0]
    if H(x,y,seed+3)<0.05: t-=1
    return _fl(SLUM,t)
NEWF={'wetstone':wetstone,'terra':terra,'straw':straw,'grate':grate,'cave':cave,'elfstone':elfstone,'dwarf':dwarf,'rush':rush,
      'marble':marble,'stage':stage,'dungeon':dungeon,'hobbit':hobbit,'casino':casino,'narshe':narshe,'snowmat':snowmat,'slum':slum}
TL.FLOORFN.update(NEWF)
# ---------------- walls (world coords: X, fy 0..31) ----------------
def _lower(c,fy): return c if fy<16 else tuple(max(0,int(v*0.86)) for v in c[:3])+(255,)
RUNE=R_('#141216','#221f24','#2e2a30','#3a363c','#46424a','#d4a640','#8a6a28')
def f_rune(X,fy):
    # carved granite: big ashlar blocks, a gold rune band at fy 9..12, skirting
    if fy>=29: return RUNE[2] if fy==29 else RUNE[0]
    if 9<=fy<=12:
        if fy in (9,12): return RUNE[6]
        k=X%10; glyph=[(0,1),(1,2),(2,1),(1,0)] if (X//10)%3==0 else ([(0,0),(1,1),(2,2),(0,2)] if (X//10)%3==1 else [(1,0),(1,1),(1,2),(0,1),(2,1)])
        gx,gy=k-3,fy-10
        return RUNE[5] if (gx,gy) in glyph else RUNE[1]
    r=0 if fy<9 else 1; y0=[0,13][r]; hgt=[9,16][r]; ly=fy-y0
    off=0 if r==0 else 12; L=24; lx=(X+off)%L
    if ly==hgt-1 or lx==L-1: return RUNE[0]
    t=4 if ly==0 else 3
    if lx==0: t=4
    if H((X+off)//L,r,77)<0.3: t-=1
    return _lower(RUNE[t],fy)
LW=R_('#1e140c','#3a2616','#5a3c22','#74502e','#8c643a','#a67c4a'); LEAF=R_('#1a3a1e','#2e5a2a','#4a8a38','#7ab84a','#b8e070')
def f_livewood(X,fy):
    # living trunks side by side (each 10-14 px wide, bark ridges), leaves and vines drooping over the top
    tw=[12,10,14,11,13]; acc=0; i=0
    while True:
        w=tw[i%5]
        if X%60<acc+w: break
        acc+=w; i+=1
    lx=X%60-acc; w=tw[i%5]
    if lx==0: c=LW[0]
    elif lx==1: c=LW[4]
    elif lx==w-1: c=LW[1]
    else:
        c=LW[3]
        if (lx+fy//3+i)%5==0: c=LW[2]
        if lx==2: c=LW[5] if fy%6 else LW[4]
    if fy<5+int(3*abs(math.sin(X*0.37))):                       # leaf canopy fringe
        v=H(X,fy,79)
        c=LEAF[3] if v<0.35 else (LEAF[2] if v<0.75 else LEAF[4])
    if fy>=29: c=LW[1] if fy==29 else LW[0]
    return _lower(c,fy)
GW=R_('#1c1008','#2e1c0c','#4a2c12','#62401c','#7a5226','#e0b040','#9a7020')
def f_goldwood(X,fy):
    # mead hall: dark vertical planks, a carved gold band (interlace) at fy 4..8, hanging shield-line shadow
    if fy>=29: return GW[3] if fy==29 else GW[0]
    if 4<=fy<=8:
        if fy in (4,8): return GW[6]
        k=(X+ (fy-5)*2)%8
        return GW[5] if k in (0,1) else GW[2]
    lx=X%6
    c=GW[3] if lx not in (0,5) else (GW[1] if lx==5 else GW[4])
    if H(X//6,fy//7,81)<0.15: c=GW[2]
    return _lower(c,fy)
MW=R_('#6a6068','#8e848c','#aaa2a8','#c2bac0','#d4ccd2','#9a2030','#c8a040')
def f_marblewall(X,fy):
    # throne room: marble ashlar with a gold cornice line and a red dado below
    if fy>=29: return MW[1] if fy==29 else MW[0]
    if fy in (2,3): return MW[6] if fy==2 else MW[1]
    if fy>=18:
        if fy==18: return MW[6]
        return MW[5] if fy<28 else R_('#5a1018')[0]
    ly=(fy-4)%7; lx=(X+(8 if ((fy-4)//7)%2 else 0))%16
    if ly==6 or lx==15: return MW[1]
    return MW[4] if ly==0 else MW[3]
DG=R_('#121012','#1e1a1c','#2a2426','#352e2e','#403836','#3a4a2a')
def f_dungeon(X,fy):
    if fy>=29: return DG[2] if fy==29 else DG[0]
    rows=[0,7,13,20,26,29]; r=max(i for i,v in enumerate(rows) if v<=fy); ly=fy-rows[r]; hgt=rows[r+1]-rows[r]
    off=int(H(r,3,83)*9); L=[9,11,8,10,12][r%5]; lx=(X+off)%L
    if ly==hgt-1 or lx==L-1: return DG[0]
    t=4 if ly==0 else 3
    if H((X+off)//L,r,85)<0.35: t-=1
    if fy>18 and H(X//2,fy//3,87)<0.1: return DG[5]           # moss low on the wall
    if (X%23==4) and fy>6: return DG[1] if fy%3 else DG[4]    # damp streak
    return _lower(DG[t],fy)
RK=R_('#1a1612','#2a2420','#3a322a','#4a4034','#5a4e40','#6a5c4a')
def f_rock(X,fy):
    # raw cave rock: lumpy strata, no masonry joints
    v=H(X//4,fy//3,89)*0.5+H(X//7,fy//5,90)*0.5+0.15*math.sin(X*0.3+fy*0.2)
    t=1 if v<0.25 else (2 if v<0.5 else (3 if v<0.8 else 4))
    if H(X,fy,91)<0.04: t=5
    if fy>=29: t=0 if fy==31 else 1
    return _lower(RK[t],fy)
def f_mine(X,fy):
    # rock + a timber post every 48 px with a cross beam at the top
    lx=X%48
    if lx<4:
        return [WOOD[1],WOOD[6],WOOD[4],WOOD[1]][lx] if fy<30 else WOOD[0]
    if fy<3: return [WOOD[1],WOOD[5],WOOD[2]][fy]
    return f_rock(X,fy)
ST=R_('#16181c','#262a30','#363c44','#48505a','#5c6670','#8a96a2','#b0703a')
def f_riveted(X,fy):
    # magitek: riveted steel plates, a copper pipe run at fy 6..8, gauge-less (gauges are props)
    if fy>=29: return ST[2] if fy==29 else ST[0]
    if 6<=fy<=8: return [R_('#6a3418')[0],ST[6],R_('#e0a060')[0]][fy-6] if X%32 not in (0,1) else ST[1]
    px=X%24; py=(fy-9)%12 if fy>8 else fy
    if px==23 or (fy>8 and py==11) or fy==5: return ST[0]
    if px in (2,20) and py in (2,9): return ST[5]
    c=ST[3] if px>0 and py>0 else ST[4]
    return _lower(c,fy)
VV=R_('#2a0610','#4a0c1a','#6a1424','#7c1a2c','#8e2234','#c8a040','#ffe090')
def f_velvet(X,fy):
    # opera / casino: damask velvet with a gold pilaster every 40 px and a gold dado
    lx=X%40
    if fy>=29: return VV[1] if fy==29 else VV[0]
    if fy in (20,21): return VV[5] if fy==20 else VV[1]
    if lx<4: return [VV[1],VV[6],VV[5],VV[1]][lx]
    if fy>21: return VV[2] if (X+fy)%4 else VV[1]
    d=abs((lx-4)%12-5.5)+abs(fy%12-5.5)
    return VV[4] if 3.5<d<5 else VV[3]
SP=R_('#2a1a0c','#46301a','#5e4226','#745230','#88623a','#a07a4a')
def f_stable(X,fy):
    # weathered vertical boards, a hay rack rail at fy 12, dark lower boards
    if fy>=29: return SP[1] if fy==29 else SP[0]
    if fy in (12,13): return WOOD[6] if fy==12 else WOOD[2]
    lx=X%7
    c=SP[3] if lx not in (0,6) else (SP[1] if lx==6 else SP[4])
    if H(X//7,fy//5,93)<0.12: c=SP[2]
    return _lower(c,fy)
HB=R_('#4a3018','#6a4424','#8c6a44','#c8a878','#e0c89c','#f0dcb4')
def f_hobbit(X,fy):
    # round-house: warm cream plaster with a curved wooden rib every 48 px and dark panelling below
    lx=X%48
    if fy>=29: return WOOD[3] if fy==29 else WOOD[0]
    if fy>=16:
        if fy==16: return WOOD[7]
        return WOOD[5] if (X%5) else WOOD[3]
    if lx<3: return [WOOD[2],WOOD[6],WOOD[3]][lx]
    t=4 if fy>3 else 3
    if H(X//3,fy//2,95)<0.12: t-=1
    return HB[t]
SN=R_('#2a1e14','#3e2c1c','#523a24','#664a2e','#7a5a38','#8e6a44')
def f_logdark(X,fy):
    # Narshe: dark logs (7 px) with white chinking
    if fy>=29: return SN[1] if fy==29 else SN[0]
    ly=fy%7
    if ly==6: return R_('#c8c4bc')[0]
    t=[3,4,4,3,2,1][ly]
    if H(X//5,fy//7,97)<0.2: t-=1
    return _lower(SN[max(0,t)],fy)
SL=R_('#141210','#221e1a','#2e2822','#3a322a','#463c32','#6a3a8a','#c83a3a')
def f_slum(X,fy):
    # Zozo: stained cracked plaster over brick, graffiti streaks, rain stains
    if fy>=29: return SL[1] if fy==29 else SL[0]
    if H(X//9,fy//6,99)<0.28:                                   # plaster fallen off -> brick
        ly=fy%4; lx=(X+(3 if (fy//4)%2 else 0))%7
        c=R_('#4a2a22','#5a3428')[0 if (ly==3 or lx==6) else 1]
    else:
        c=SL[3] if H(X//2,fy//2,101)<0.8 else SL[2]
    if X%31==7 and fy>4: c=SL[1]                               # rain streak
    if 10<fy<18 and (X//3)%17 in (3,4,5) and abs(math.sin(X*0.8+fy))>0.6: c=SL[5] if (X//51)%2 else SL[6]   # graffiti
    return _lower(c,fy)
NEWW={'rune':f_rune,'livewood':f_livewood,'goldwood':f_goldwood,'marblewall':f_marblewall,'dungeonw':f_dungeon,'rock':f_rock,
      'mine':f_mine,'riveted':f_riveted,'velvet':f_velvet,'stablew':f_stable,'hobbitw':f_hobbit,'logdark':f_logdark,'slumw':f_slum}
room2.FACEFN.update(NEWW)
CEILS={'rock':((30,26,22,255),(22,19,16,255)),'dark':((20,18,22,255),(14,12,16,255)),'wood':((40,26,16,255),(30,20,12,255)),
       'leaf':((22,40,26,255),(16,30,20,255)),'gold':((44,30,12,255),(34,22,8,255)),'steel':((26,30,36,255),(18,22,26,255)),
       'velvet':((40,10,18,255),(30,6,12,255))}
CEILS={k:(v[0][:3],v[1][:3]) for k,v in CEILS.items()}

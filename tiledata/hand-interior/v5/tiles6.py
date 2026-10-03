# v6 surfaces: modern, East-Asian (hanok / tatami / wuxia hall) and SF rooms. Same rules as tiles5: floors are quiet
# world-coordinate functions (4-5 tones, joints darkest), wall faces are f(X, fy 0..31) with skirting at fy>=29.
# Every surface has two candidates (_a / _b); the user picks one per row and only the picks are registered (PICKED).
from k import *
from p2 import R_
import tiles as TL, room2
import math
def _fl(R,v): return R[max(0,min(len(R)-1,v))]
def _lower(c,fy): return c if fy<16 else tuple(max(0,int(v*0.88)) for v in c[:3])+(255,)
# ================================================================ floors
LINO=R_('#6a665e','#8e8a80','#a8a398','#b6b1a6','#c2bdb2','#7a8a8c','#a07a5a')
def lino_a(x,y,seed=101):
    # beige vinyl sheet: 32x32 sheets, hairline joint, two-colour flecks
    lx,ly=x%32,y%32
    if lx==31 or ly==31: return LINO[1]
    t=3 if H(x//8,y//8,seed)<0.7 else 2
    r=H(x,y,seed+1)
    if r<0.012: return LINO[5]
    if r<0.024: return LINO[6]
    if r>0.985: return LINO[4]
    return LINO[t]
HOSP=R_('#4a5a54','#6a7c74','#86988e','#94a69c','#a2b4aa','#c4d2ca','#5a6a66')
def lino_b(x,y,seed=103):
    # hospital green vinyl: roll seams every 64 px (vertical), dense speckle, soft gloss band
    if x%64==63: return HOSP[1]
    r=H(x,y,seed)
    if r<0.10: return HOSP[2]
    if r<0.14: return HOSP[6]
    if r>0.93: return HOSP[5]
    g=math.sin((x-y)*0.09+H(x//64,0,seed)*4)
    return HOSP[4] if g>0.85 else HOSP[3]
CARP=R_('#1e2430','#2c3442','#3a4454','#465264','#526074')
def carpet_a(x,y,seed=105):
    # office carpet tiles 16x16, grain turned 90 degrees on alternate tiles (quarter-turn layout)
    lx,ly=x%16,y%16; flip=((x//16)+(y//16))%2
    v=ly if flip else lx
    t=3 if v%3 else 2
    if H(x,y,seed)<0.08: t=4
    if H(x,y,seed+1)<0.05: t=1
    return CARP[t]
WARMC=R_('#3a2e28','#54443a','#66554a','#726054','#7e6c5e','#9a8676')
def carpet_b(x,y,seed=107):
    # warm grey loop-pile carpet: no tiles, tiny 2-px loops on a diagonal, soft wear patches
    t=3 if (x+2*y)%5 else 2
    if (x*3+y)%7==0: t=4
    if H(x//3,y//3,seed)<0.06: t=max(1,t-1)
    if H(x,y,seed+1)<0.02: t=5
    return WARMC[t]
WT=R_('#7a7e84','#a4a8ae','#c4c8cc','#d4d8dc','#e2e6e8','#f2f4f4')
def wtile_a(x,y,seed=109):
    # small white bathroom tiles 8x8, grey grout, lit top-left lip
    lx,ly=x%8,y%8
    if lx==7 or ly==7: return WT[1]
    if lx==0 or ly==0: return WT[4]
    t=3 if H(x//8,y//8,seed)<0.6 else 2
    return WT[5] if (lx==1 and ly==1) else WT[t]
WB=R_('#5e6a74','#8a98a2','#b8c4cc','#c8d2d8','#d6dee2','#2e5a7a')
def wtile_b(x,y,seed=111):
    # 16x16 pale tiles with a small dark-blue cabochon where four tiles meet (kitchen / clinic)
    lx,ly=x%16,y%16
    dx=min(lx,15-lx)+(0 if lx<8 else 0); dy=min(ly,15-ly)
    if dx+dy<=1: return WB[5]
    if lx==15 or ly==15: return WB[1]
    if dx+dy==2: return WB[1]
    t=3 if H(x//16,y//16,seed)<0.6 else 2
    if ly==0: t=4
    return WB[t]
PQ=R_('#4a2c16','#6a4022','#7e4e2a','#8c5a32','#9a663a','#b07c4a')
def herring_a(x,y,seed=113):
    # basket-weave parquet: 8x8 squares, three 2-px slats each, slats turn 90 degrees square by square
    lx,ly=x%8,y%8; turn=((x//8)+(y//8))%2
    v=ly if turn else lx
    if v%3==2 or v==7: return PQ[1]
    b=3 if H(x//8,y//8,seed)<0.5 else 4
    if v%3==0: b+=1
    return _fl(PQ,b)
def herring_b(x,y,seed=115):
    # chevron parquet: 8-px columns of slanted slats, slant flips each column
    col=x//8; lx=x%8; s=1 if col%2 else -1
    u=y+s*lx
    if u%4==3: return PQ[1]
    k=u//4
    b=3 if H(col,k,seed)<0.5 else 2
    if lx==0 or lx==7: b-=1
    if u%4==0: b+=1
    return _fl(PQ,b)
CON=R_('#3a3c3e','#56585a','#6c6e70','#787a7c','#848688','#9a9c9e')
def concrete_a(x,y,seed=117):
    # raw slab: saw-cut joints every 64 px, mottled cloud, tiny pits
    if x%64==63 or y%64==63: return CON[1]
    v=H(x//6,y//5,seed)*0.6+H(x//2,y//2,seed+1)*0.4
    t=2 if v<0.3 else (3 if v<0.75 else 4)
    if H(x,y,seed+2)<0.025: return CON[0]
    return CON[t]
EPX=R_('#2e3834','#46524c','#5a6862','#66746e','#728078','#94a29a')
def concrete_b(x,y,seed=119):
    # polished epoxy floor: big 48x48 bays, soft diagonal gloss streaks, almost no grain
    if x%48==47 or y%48==47: return EPX[1]
    g=math.sin((x+y)*0.11+H(x//48,y//48,seed)*5)
    t=4 if g>0.92 else 3
    if H(x,y,seed+1)<0.03: t=2
    return EPX[t]
TAT=R_('#4a4a22','#6a6a32','#8a8a44','#9a9a4e','#a8a85a','#bcb870','#1e3020','#34503a')
def tatami_a(x,y,seed=121):
    # tatami 32x16 mats laid in alternating orientation; dark green cloth edging (heri) on the long sides, rush lines
    bx,by=x//32,y//32; lx,ly=x%32,y%32
    if (bx+by)%2==0:           # two horizontal mats in this 32x32 block
        mx,my=lx,ly%16; long_axis='h'
    else:                      # two vertical mats
        mx,my=ly,lx%16; long_axis='v'
    if my in (0,15): return TAT[6] if my==15 else TAT[7]
    if mx in (0,31): return TAT[1]
    t=4 if my%2 else 3
    if H(x//4,y//4,seed)<0.12: t-=1
    return TAT[t]
def tatami_b(x,y,seed=123):
    # paler new tatami, all mats E-W in a running bond, edging only on long sides, finer rush lines
    my=y%16; off=16 if (y//16)%2 else 0; mx=(x+off)%32
    if my==15: return TAT[6]
    if my==0: return TAT[7]
    if mx==31: return TAT[2]
    t=5 if my%2 else 4
    if H((x+off)//32,y//16,seed)<0.4: t-=1
    return TAT[t]
JP=R_('#5e4420','#86683a','#a4844c','#b29254','#c0a060','#d4b678')
def jangpan_a(x,y,seed=125):
    # oiled hanji floor paper (jangpanji): 16x16 sheets overlapping, light upper-left lip, dark lower-right shadow
    lx,ly=x%16,y%16
    if lx==15 or ly==15: return JP[1]
    if lx==0 or ly==0: return JP[5]
    t=3 if H(x//16,y//16,seed)<0.6 else 4
    if H(x//3,y//3,seed+1)<0.15: t-=1
    return JP[t]
JQ=R_('#3a2408','#5a3812','#74481a','#82521e','#905c24','#a87030')
def jangpan_b(x,y,seed=127):
    # old house: bigger 24x24 darker paper sheets, worn glossy centre, a few burn-dark spots
    lx,ly=x%24,y%24
    if lx==23 or ly==23: return JQ[1]
    if lx==0 or ly==0: return JQ[4]
    d=abs(lx-11.5)+abs(ly-11.5)
    t=4 if d<7 else 3
    if H(x//2,y//2,seed)<0.04: t=2
    return JQ[t]
MR=R_('#2e1e10','#4a3018','#5e3e22','#6c482a','#7a5432','#8e6640')
def maru_a(x,y,seed=129):
    # woomul-maru: heavy cross-beams every 48 px (5 px), short boards (6 px) spanning between them
    lx=x%48
    if lx<5: return [MR[1],MR[4],MR[3],MR[3],MR[0]][lx]
    ly=y%6
    if ly==5: return MR[1]
    b=3 if H(x//48,y//6,seed)<0.5 else 4
    if ly==0: b+=1
    if H(x//3,y,seed+1)<0.05: b-=1
    return _fl(MR,b)
MS=R_('#4a3418','#6e4e26','#8a6434','#9a703c','#a87c44','#bc9256')
def maru_b(x,y,seed=131):
    # lighter maru: beams every 32 px (4 px), narrow 4-px boards
    lx=x%32
    if lx<4: return [MS[1],MS[4],MS[3],MS[0]][lx]
    ly=y%4
    if ly==3: return MS[1]
    b=3 if H(x//32,y//4,seed)<0.5 else 4
    if ly==0: b+=1
    return _fl(MS,b)
SFD=R_('#101418','#1c2228','#2a3038','#363e46','#424c56','#5c6874','#3ad0e0','#1a7a88')
def sfdeck_a(x,y,seed=133):
    # dark deck plates 32x32, bolts in the corners, cyan light strip on the south edge of every other plate
    lx,ly=x%32,y%32
    if lx==31 or ly==31: return SFD[0]
    if (x//32+y//32)%2==0 and ly in (28,29) and 3<=lx<=28: return SFD[6] if ly==28 else SFD[7]
    if lx in (2,29) and ly in (2,26): return SFD[5]
    if lx==0 or ly==0: return SFD[4]
    t=3 if (lx+ly)%6 else 2                                  # fine diagonal tread, not a checker
    if H(x//32,y//32,seed)<0.4: t=max(2,t-1) if t==3 else t
    return SFD[t]
SFW=R_('#5a626c','#848c96','#aab2ba','#bcc4ca','#ccd2d8','#e0e6ea','#3a7ad0')
def sfdeck_b(x,y,seed=135):
    # white starship floor: 32x16 panels with bevelled edges, a blue status pip on some panels
    lx,ly=x%32,y%16
    if lx==31 or ly==15: return SFW[0]
    if lx==30 or ly==14: return SFW[1]
    if lx==0 or ly==0: return SFW[5]
    if lx in (27,28) and ly in (11,12) and H(x//32,y//16,seed)<0.4: return SFW[6]
    return SFW[4] if ly<7 else SFW[3]
BS=R_('#262c34','#3a424c','#4c5662','#56606c','#626c78','#76808c')
def bluestone_a(x,y,seed=137):
    # wuxia courtyard / hall: big blue-grey slabs 32x32, chamfer lip, worn darker centre on some
    lx,ly=x%32,y%32
    if lx==31 or ly==31: return BS[0]
    if lx==0 or ly==0: return BS[5]
    if lx==30 or ly==30: return BS[1]
    t=4 if H(x//32,y//32,seed)<0.5 else 3
    if H(x,y,seed+2)<0.03: t-=1
    return _fl(BS,t)
BR6=R_('#2a2a2c','#424244','#565658','#626264','#6e6e70','#848486')
def bluestone_b(x,y,seed=139):
    # square fired floor bricks (bangjeon) 16x16 in a straight grid, each its own tone
    lx,ly=x%16,y%16
    if lx==15 or ly==15: return BR6[1]
    t=[2,3,3,4][int(H(x//16,y//16,seed)*4)]
    if ly==0 or lx==0: t+=1
    if H(x,y,seed+1)<0.05: t-=1
    return _fl(BR6,t)
FLOOR_CANDS={'lino':(lino_a,lino_b),'carpet':(carpet_a,carpet_b),'wtile':(wtile_a,wtile_b),'parquet':(herring_a,herring_b),
             'concrete':(concrete_a,concrete_b),'tatami':(tatami_a,tatami_b),'jangpan':(jangpan_a,jangpan_b),
             'maru':(maru_a,maru_b),'sfdeck':(sfdeck_a,sfdeck_b),'bluestone':(bluestone_a,bluestone_b)}
FLOOR_LABEL={'lino':'리놀륨','carpet':'사무실 카펫','wtile':'흰 타일 바닥','parquet':'쪽모이 마루','concrete':'콘크리트 바닥',
             'tatami':'다다미','jangpan':'장판지','maru':'우물마루','sfdeck':'SF 갑판','bluestone':'청석 바닥'}
FLOOR_ALT={'lino':('베이지 리놀륨','병원 녹색 비닐'),'carpet':('카펫 타일(결 엇갈림)','따뜻한 회색 카펫'),
           'wtile':('작은 흰 타일','큰 타일+파란 점'),'parquet':('바구니 짜임','쉐브론'),'concrete':('노출 콘크리트','광택 에폭시'),
           'tatami':('엇갈린 다다미','새 다다미(줄눈 쌓기)'),'jangpan':('노란 장판지','낡은 갈색 장판지'),
           'maru':('짙은 우물마루','밝은 우물마루'),'sfdeck':('어두운 갑판+청록 띠','흰 우주선 바닥'),'bluestone':('청석 큰 판','회색 방전돌')}
# ================================================================ walls
WP=R_('#8a8068','#b4aa8e','#cec4a6','#dcd2b4','#e8dec2','#7e9478','#94aa8c')
def w_wallpaper_a(X,fy):
    # cream wallpaper with sage stripes, a wood chair rail, panelled wainscot, skirting
    if fy>=29: return WOOD[4] if fy==29 else WOOD[1]
    if fy in (17,18): return WOOD[6] if fy==17 else WOOD[3]
    if fy>18:
        return WOOD[5] if X%16==0 else (WOOD[3] if X%16==15 else WOOD[4])
    s=X%8
    c=WP[5] if s in (0,1) else (WP[6] if s==2 else WP[4] if fy<3 else WP[3])
    return c
RW=R_('#6a3a3e','#8e5458','#a46a6c','#b27a7a','#c08a88','#e8d8c8','#c8a060')
def w_wallpaper_b(X,fy):
    # dusty rose damask: small diamond motif on an 8x8 lattice, white dado below with a gold line
    if fy>=29: return RW[0] if fy>29 else RW[1]
    if fy==19: return RW[6]
    if fy>19: return RW[5] if X%24 not in (0,23) else R_('#b8a898')[0]
    lx,ly=X%8,fy%8
    d=abs(lx-3.5)+abs(ly-3.5)
    if d<1.2: return RW[4]
    if 2.5<d<3.2: return RW[2]
    return RW[3]
WW=R_('#7a7c7e','#a6a8aa','#cacbc8','#d8d8d4','#e4e4e0','#f0f0ec','#4a4c50')
def w_white_a(X,fy):
    # modern painted wall: crown line at the top, quiet paint, grey baseboard
    if fy>=27: return WW[6] if fy==27 else (WW[1] if fy<31 else WW[0])
    if fy==0: return WW[2]
    t=4 if H(X//3,fy//3,201)<0.85 else 3
    return _lower(WW[t],fy) if fy>=20 else WW[t]
SCH=R_('#3e5a44','#5e8064','#7aa080','#88ae8c','#e0ded4','#cfcdc2','#2a2a2a')
def w_white_b(X,fy):
    # school / clinic wall: white upper, pale green gloss lower half with a dark line, black skirting
    if fy>=29: return SCH[6] if fy>29 else SCH[0]
    if fy==15: return SCH[0]
    if fy>15: return SCH[3] if fy==16 else SCH[2]
    return SCH[4] if H(X//4,fy//4,203)<0.85 else SCH[5]
TW=R_('#80868c','#a6acb2','#cfd4d8','#dee2e4','#eaedee','#f6f8f8')
def w_tile_a(X,fy):
    # bathroom wall: square 8x8 white tiles top to bottom, bull-nose cap row
    if fy>=29: return TW[1] if fy==29 else TW[0]
    if fy<2: return TW[5] if fy==0 else TW[2]
    lx,ly=X%8,(fy-2)%8
    if lx==7 or ly==7: return TW[1]
    if lx==0 or ly==0: return TW[4]
    return TW[3]
MT=R_('#5a7a74','#86a49c','#a8c4bc','#b6d0c8','#c4dcd4','#dceee8','#ecece4')
def w_tile_b(X,fy):
    # metro tiles 8x4 in a running bond on the lower 2/3, painted plaster above
    if fy>=29: return MT[0] if fy>29 else MT[1]
    if fy<10: return MT[6] if fy else R_('#c8c8c0')[0]
    if fy==10: return MT[1]
    r=(fy-11)//4; ly=(fy-11)%4; lx=(X+(4 if r%2 else 0))%8
    if ly==3 or lx==7: return MT[1]
    return MT[5] if ly==0 else MT[3]
CW=R_('#3e4042','#5a5c5e','#727476','#7e8082','#8a8c8e','#9a9c9e','#2a2c2e')
def w_conc_a(X,fy):
    # exposed concrete: 48x16 form panels, four tie holes per panel, faint wood-board grain
    if fy>=29: return CW[1] if fy==29 else CW[0]
    lx=X%48; ly=fy%16
    if lx==47 or ly==15: return CW[1]
    if lx in (8,39) and ly in (4,11): return CW[6]
    t=4 if (ly//4)%2 else 3
    if H(X//5,fy//2,205)<0.15: t-=1
    return _lower(CW[t],fy)
CB=R_('#64666a','#8c8e92','#a4a6aa','#b0b2b6','#bcbec2','#cacccf')
def w_conc_b(X,fy):
    # painted cinder blocks 16x8 in a running bond, recessed mortar
    if fy>=29: return CB[1] if fy==29 else CB[0]
    r=fy//8; ly=fy%8; lx=(X+(8 if r%2 else 0))%16
    if ly==7 or lx==15: return CB[0]
    if ly==0 or lx==0: return CB[4]
    t=3 if H((X+(8 if r%2 else 0))//16,r,207)<0.6 else 2
    return _lower(CB[t],fy)
HJ=R_('#2a1a0e','#4a2e18','#6a4426','#80562e','#966a3a','#e4dcc6','#f2ecda','#c8bea4')
def w_hanji_a(X,fy):
    # changho: dark posts every 48 px, hanji paper with ttisal lattice (vertical bars, three cross bars), wooden gungpan below
    lx=X%48
    if fy>=29: return HJ[3] if fy==29 else HJ[0]
    if lx<4: return [HJ[1],HJ[4],HJ[3],HJ[0]][lx]
    if fy<2 or fy in (21,22): return HJ[2] if fy in (0,21) else HJ[1]
    if fy>22: return HJ[3] if (lx-4)%11 else HJ[1]
    if (lx-4)%4==0 or fy in (2,8,14,20): return HJ[2] if fy!=2 else HJ[3]
    return HJ[6] if fy<12 else HJ[5]
EW=R_('#3a2410','#5a3a1c','#7a5028','#8e6232','#a8784a','#d8ccae','#e6dcc0','#c8b894')
def w_hanji_b(X,fy):
    # hanok wall: posts every 48 px, lintels (inbang) at fy 3-5 and 22-24, whitewashed earth panels between
    lx=X%48
    if fy>=29: return EW[2] if fy==29 else EW[0]
    if lx<4: return [EW[1],EW[4],EW[3],EW[0]][lx]
    if 3<=fy<=5 or 22<=fy<=24: return [EW[4],EW[3],EW[1]][(fy-3)%19 if fy<=5 else fy-22]
    if fy<3: return EW[7] if fy else EW[1]
    if fy>24: return EW[2] if (lx%6) else EW[1]
    t=6 if H(X//3,fy//3,209)<0.8 else 5
    return EW[t]
LQ=R_('#3a0a08','#5a120e','#7c1a14','#922218','#a82c1e','#c8a040','#ece2cc','#d6ccb4','#4a4a4e','#6a6a70')
def w_lacquer_a(X,fy):
    # wuxia hall: red lacquer pillars every 40 px with a gold collar, white plaster between, stone plinth course
    lx=X%40
    if fy>=26: return LQ[9] if fy==26 else (LQ[8] if fy<31 else R_('#2a2a2e')[0])
    if lx<6:
        if fy in (2,3): return LQ[5]
        return [LQ[1],LQ[4],LQ[3],LQ[3],LQ[2],LQ[0]][lx]
    if fy<2: return LQ[0]
    t=6 if H(X//3,fy//3,211)<0.85 else 7
    return LQ[t]
DC=R_('#1a1410','#2e2218','#46321e','#5a4026','#6e4e2e','#2e7a5a','#c83a2a','#3a5aa8','#e8d070')
def w_lacquer_b(X,fy):
    # dark timber panel wall under a dancheong band (green / red / blue / gold motif) at fy 1..7
    if fy>=29: return DC[2] if fy==29 else DC[0]
    if fy==0: return DC[0]
    if 1<=fy<=7:
        lx=X%16; ly=fy-1
        if ly in (0,6): return DC[8] if fy==1 else DC[1]
        d=abs(lx-7.5)+abs(ly-3)
        return DC[6] if d<2 else (DC[8] if d<3 else (DC[7] if d<5 else DC[5]))
    lx=X%24
    if lx in (0,23) or fy==8: return DC[1]
    if lx in (1,22) or fy==9: return DC[4]
    return _lower(DC[3],fy)
SP6=R_('#0e1216','#1a2026','#262e36','#323c46','#3e4a56','#5a6876','#3ad0e0','#1a7a88','#d06a2a')
def w_sf_a(X,fy):
    # dark hull panels 32 wide, a cyan light strip at fy 9-10, louvred vent band low on the wall
    if fy>=29: return SP6[2] if fy==29 else SP6[0]
    lx=X%32
    if lx==31: return SP6[0]
    if lx==0: return SP6[4]
    if fy in (9,10): return SP6[6] if fy==9 else SP6[7]
    if fy in (8,11): return SP6[1]
    if 20<=fy<=26 and 6<=lx<=25: return SP6[1] if fy%2 else SP6[3]
    if lx in (3,28) and fy in (2,16): return SP6[5]
    return _lower(SP6[3] if fy<11 else SP6[2],fy)
SV=R_('#4e5660','#7a828c','#a2aab2','#b8c0c6','#c8ced4','#dce2e6','#e07a2a','#8a3e10')
def w_sf_b(X,fy):
    # white starship wall: rounded 32-px panels (lit left, dark right), orange accent stripe at fy 19-20, grey lower
    if fy>=29: return SV[1] if fy==29 else SV[0]
    if fy in (19,20): return SV[6] if fy==19 else SV[7]
    lx=X%32
    if lx==31: return SV[1]
    if lx==0: return SV[5]
    if lx==30: return SV[2]
    if fy<2: return SV[2] if fy==0 else SV[4]
    if fy>20: return SV[2] if fy>27 else SV[3]
    return SV[4]
WALL_CANDS={'wallpaper':(w_wallpaper_a,w_wallpaper_b),'whitewall':(w_white_a,w_white_b),'tilewall':(w_tile_a,w_tile_b),
            'concwall':(w_conc_a,w_conc_b),'hanji':(w_hanji_a,w_hanji_b),'lacquer':(w_lacquer_a,w_lacquer_b),'sfwall':(w_sf_a,w_sf_b)}
WALL_LABEL={'wallpaper':'벽지','whitewall':'흰 벽','tilewall':'타일 벽','concwall':'콘크리트 벽','hanji':'한옥 벽','lacquer':'무림 전각 벽',
            'sfwall':'SF 벽'}
WALL_ALT={'wallpaper':('줄무늬 벽지+징두리','장미색 다마스크'),'whitewall':('흰 페인트+걸레받이','학교 벽(위 흰·아래 녹색)'),
          'tilewall':('흰 욕실 타일','메트로 타일+회벽'),'concwall':('노출 콘크리트','칠한 블록'),'hanji':('창호지 띠살문','흙벽+인방'),
          'lacquer':('붉은 칠 기둥+흰 벽','단청 띠+짙은 판벽'),'sfwall':('어두운 패널+청록 빛','흰 우주선 벽')}
GENRE={'lino':'modern','carpet':'modern','wtile':'modern','parquet':'modern','concrete':'modern','tatami':'east','jangpan':'east',
       'maru':'east','bluestone':'east','sfdeck':'sf','wallpaper':'modern','whitewall':'modern','tilewall':'modern','concwall':'modern',
       'hanji':'east','lacquer':'east','sfwall':'sf'}
CEILS6={'pale':((64,62,66),(54,52,56)),'navy':((18,24,38),(12,16,28)),'lacquer':((40,14,10),(30,10,8))}
# the user's picks: key -> 'a' | 'b'. Only picked surfaces are registered under their key.
PICKED={}
def register():
    import tiles5
    for k,ab in PICKED.items():
        if k in FLOOR_CANDS: TL.FLOORFN[k]=FLOOR_CANDS[k][0 if ab=='a' else 1]
        else: room2.FACEFN[k]=WALL_CANDS[k][0 if ab=='a' else 1]
    tiles5.CEILS.update(CEILS6)

# v6 surfaces: modern, East-Asian (hanok / tatami / wuxia hall) and SF rooms. Floors are world-coordinate functions
# f(x, y) and wall faces f(X, fy 0..31) like tiles5, but drawn with material rules instead of salt-and-pepper noise:
#   * every slab / plank / tile has a bevel (lit row on top + lit column on the left, a shade row/column bottom-right,
#     then the joint) — light comes from the top-left like the rest of the sheet;
#   * soft variation is smooth value noise quantised with a 4x4 ordered dither (dq), not per-pixel random speckle;
#   * walls carry real mouldings (crown, rail, baseboard: lit / face / shade rows) and a faint top-lit gradient.
# All structural periods divide 64 and value noise wraps at 64, so the 64-px fold in build_tileset is seamless.
# Every surface has two candidates (_a / _b); the user picks one per row and only the picks are registered (PICKED).
from k import *
from p2 import R_
import tiles as TL, room2
import math
BAY=((0,8,2,10),(12,4,14,6),(3,11,1,9),(15,7,13,5))
def dq(v,x,y):
    """continuous tone -> integer tone: clean patches, ordered 4x4 dither only on a thin band at each tone edge"""
    t=math.floor(v); f=v-t
    if f<0.42: return t
    if f>0.58: return t+1
    return t+(1 if (f-0.42)/0.16>(BAY[y&3][x&3]+0.5)/16 else 0)
def _sm(t): return t*t*(3-2*t)
def vn(x,y,c,s,cy=None):
    """smooth value noise 0..1 on a c x cy lattice that wraps every 64 px"""
    cy=cy or c; gx,gy=x//c,y//cy; nx,ny=64//c,64//cy; fx=_sm((x%c)/c); fy=_sm((y%cy)/cy)
    a=H(gx%nx,gy%ny,s); b=H((gx+1)%nx,gy%ny,s); d=H(gx%nx,(gy+1)%ny,s); e=H((gx+1)%nx,(gy+1)%ny,s)
    return (a*(1-fx)+b*fx)*(1-fy)+(d*(1-fx)+e*fx)*fy
def _i(h,n): return min(n-1,int(h*n))
def P(R,v): return R[max(0,min(len(R)-1,v))]
def bevel(lx,ly,w,h):
    """2 = joint (last row/col), -1 = shade (row/col before the joint), 1 = lit (first row/col), 0 = face"""
    if lx==w-1 or ly==h-1: return 2
    if lx==w-2 or ly==h-2: return -1
    if lx==0 or ly==0: return 1
    return 0
# ================================================================ floors
VCT=R_('#4e463c','#776d5e','#958a78','#a49985','#b2a792','#c1b6a1','#d3c9b5')
def lino_a(x,y,seed=101):
    # vinyl composition tiles 16x16: bevel, quarter-turned chip streaks, three tile batches
    lx,ly=x%16,y%16; e=bevel(lx,ly,16,16)
    if e==2: return VCT[0]
    b=[3,4,4][_i(H(x//16,y//16,seed),3)]
    if e==1: return VCT[b+1]
    if e==-1: return VCT[b-1]
    turn=((x//16)+(y//16))%2; a,c=(lx,ly) if turn else (ly,lx)
    k=(a*3+c*7+int(H(x//16,y//16,seed+1)*11))%13
    if k==0: return VCT[b-1]
    if k==6 and (a+c)%2: return VCT[b+1]
    return VCT[b]
HV=R_('#34443e','#4f625a','#677b72','#73887e','#7f948a','#8ea398','#a8bcb0')
def lino_b(x,y,seed=103):
    # hospital sheet vinyl: weld seam every 64 px, smooth mottle, sparse chips in neighbour tones
    lx=x%64
    if lx==63: return HV[1]
    if lx==0: return HV[5]
    t=dq(3.15+0.9*vn(x,y,16,seed)+0.55*vn(x,y,32,seed+2,8),x,y)
    r=H(x,y,seed+1)
    if r<0.025: t-=1
    elif r>0.985: t+=1
    return P(HV,min(t,5))
CT=R_('#161c27','#1f2735','#283244','#313c50','#3b475d','#4a576e')
def carpet_a(x,y,seed=105):
    # office carpet tiles 16x16: corded ridges every 2 px, ridge direction turns 90 degrees tile by tile
    lx,ly=x%16,y%16; turn=((x//16)+(y//16))%2; a=ly if turn else lx
    b=2+(a%2)+(1 if H(x//16,y//16,seed)<0.4 and a%2 else 0)
    r=H(x,y,seed+1)
    if r<0.06: b+=1
    elif r<0.10: b-=1
    if (lx==15 or ly==15) and (x+y)%2: b-=1                       # tile seam, half visible
    return P(CT,b)
HC=R_('#0d2224','#143032','#1b3e3f','#244c4c','#7e6026','#a8823a','#4e1820','#74262e')
def carpet_b(x,y,seed=107):
    # hotel corridor carpet: teal ground with woven fuzz, gold diamond trellis, burgundy rosette in each diamond
    lx,ly=x%16,y%16
    if (lx+ly)%16==0 or (lx-ly)%16==0: return HC[5] if (x//2+y//2)%2 else HC[4]
    d=abs(lx-8)+abs(ly-8)
    if d==0: return HC[5]
    if d==1: return HC[7]
    if d==2 and (lx==8 or ly==8): return HC[6]
    t=2 if (x+y)%2 else 1
    if (x+2*y)%5==0: t=3
    return HC[t]
GZ=R_('#7d858c','#a1a9b0','#c6ccd1','#d6dbdf','#e2e6e9','#eef1f2','#fbfcfc')
def wtile_a(x,y,seed=109):
    # small glazed white tiles 8x8: grout, bevel, one specular pixel per tile
    lx,ly=x%8,y%8; e=bevel(lx,ly,8,8)
    if e==2: return GZ[1]
    if e==-1: return GZ[2]
    if e==1: return GZ[5]
    if (lx,ly)==(1,1): return GZ[6]
    return GZ[4] if H(x//8,y//8,seed)<0.75 else GZ[3]
OC=R_('#5c6670','#8a959e','#b9c2c8','#cbd2d7','#d9dfe3','#e8ecee','#163a64','#2e5f96','#7ea6d4')
def wtile_b(x,y,seed=111):
    # octagon-and-dot: white octagons 16x16 with a blue square-on-point cabochon where four tiles meet
    lx,ly=(x+8)%16,(y+8)%16                                       # (8,8) = tile corner = cabochon centre
    d=abs(lx-8)+abs(ly-8)
    if d<=3:
        if d==3: return OC[0]
        return OC[8] if (lx,ly)==(7,7) else (OC[7] if lx+ly<16 else OC[6])
    tx,ty=x%16,y%16
    if tx==15 or ty==15: return OC[1]
    if d==4: return OC[5] if lx+ly>16 else OC[2]                  # bevel along the cut corner
    if ty==14 or tx==14: return OC[2]
    if ty==0 or tx==0: return OC[5]
    return OC[4] if H(x//16,y//16,seed)<0.7 else OC[3]
OAK=R_('#3a2112','#583319','#71441f','#835226','#94602f','#a6713a','#bf8a50')
def _slat(along,across,slat_id,seed):
    # one 4-px slat: lit row, two grained rows, joint row
    if across==3: return OAK[0]
    b=[2,3,4][_i(H(*slat_id,seed),3)]
    if across==0: return OAK[b+1]
    g=H((along+int(H(*slat_id,seed+1)*16))//5,across,seed+2)
    if across==2 and g<0.3: return OAK[b-1]
    if across==1 and g>0.85: return OAK[b+1]
    return OAK[b]
def herring_a(x,y,seed=113):
    # basket-weave parquet: 16x16 squares of four 4-px slats, slats turn 90 degrees square by square
    sx,sy=x//16,y//16; lx,ly=x%16,y%16
    if lx==15 and (sx+sy)%2 or ly==15 and not (sx+sy)%2: return OAK[1]   # slat ends
    if (sx+sy)%2: return _slat(lx,ly%4,(sx*4+ly//4,sy),seed)
    return _slat(ly,lx%4,(sx,sy*4+lx//4),seed)
def herring_b(x,y,seed=115):
    # herringbone: 16-px columns of 45-degree slats, slant flips each column, mitre joint on the column line
    col=x//16; lx=x%16; s=1 if col%2 else -1
    u=y+(lx if s>0 else 15-lx); k=u//4; a=u%4
    if (s>0 and lx==0) or (s<0 and lx==15): return OAK[1] if a else OAK[0]
    if a==3: return OAK[0]
    b=[2,3,4][_i(H(col,k,seed),3)]
    if a==0: return OAK[b+1]
    if a==2 and H(col,k*3+lx//3,seed+1)<0.3: return OAK[b-1]
    return OAK[b]
CN=R_('#33363a','#4c5054','#62666a','#6f7377','#7c8084','#8b8f93','#a2a6a9')
def concrete_a(x,y,seed=117):
    # power-floated slab: soft cloudy mottle (dithered), dark aggregate pits, pale fines, saw-cut joints every 64 px
    lx,ly=x%64,y%64
    if lx==63 or ly==63: return CN[1]
    if lx==0 or ly==0: return CN[5]
    t=dq(2.6+1.3*vn(x,y,16,seed)+0.4*vn(x,y,8,seed+1),x,y)
    r=H(x,y,seed+2)
    if r<0.022: return CN[1]
    if r<0.03: return P(CN,t+1)
    return P(CN,t)
EP=R_('#2a3430','#3f4c47','#53625c','#5f6f68','#6b7c75','#7d8e86','#9aaaa2')
def concrete_b(x,y,seed=119):
    # epoxy resin floor: 64-px pours, almost no grain, soft long reflections of the ceiling lights
    lx,ly=x%64,y%64
    if lx==63 or ly==63: return EP[1]
    if lx==0 or ly==0: return EP[4]
    gl=max(0.0,1-((lx-31.5)/7)**2-((ly-31.5)/26)**2)          # window light stretched toward the viewer
    t=dq(3.0+0.5*vn(x,y,32,seed)+1.2*gl,x,y)
    if H(x,y,seed+1)<0.012: t-=1
    return P(EP,t)
TM=R_('#3f4520','#5f672e','#7c843b','#8a9244','#979f4e','#a7ae5c','#c0c477')
TN=R_('#3c4a22','#5a6c30','#78903e','#86a046','#93ad50','#a3bd5e','#bfd27c')
HERI=R_('#14231a','#22382a','#33503d','#4b6c55')
def _mat(a,c,mid,seed,R):
    # one tatami: a = along the mat (0..31), c = across (0..15); edging on the long sides, weft lines, warp stitches
    if c==0: return HERI[2]
    if c==1: return HERI[3] if a%4 else HERI[2]
    if c==15: return HERI[0]
    if c==14: return HERI[1]
    if a==31: return R[1]
    if a==0: return R[5]
    b=[3,4][_i(H(*mid,seed),2)]
    if a%8==4 and c%3==1: return R[b-1]                           # warp stitch
    return R[b+1] if c%2 else R[b]
def tatami_a(x,y,seed=121):
    # classic layout: in every 32x32 block two mats, blocks alternate horizontal / vertical
    bx,by=x//32,y//32; lx,ly=x%32,y%32
    if (bx+by)%2==0: return _mat(lx,ly%16,(bx,by*2+ly//16),seed,TM)
    return _mat(ly,lx%16,(bx*2+lx//16,by),seed,TM)
def tatami_b(x,y,seed=123):
    # fresh green mats, all E-W in a running bond
    off=16 if (y//16)%2 else 0
    return _mat((x+off)%32,y%16,((x+off)//32,y//16),seed,TN)
JP=R_('#5b3d1b','#86602e','#a57a3f','#b38848','#c09652','#cfa762','#e2c182')
def jangpan_a(x,y,seed=125):
    # oiled hanji floor paper: 16x16 sheets, the overlap is a 2-px darker band (double layer) on top/left, glossy mottle
    lx,ly=x%16,y%16
    if lx==0 or ly==0: return JP[2]
    if lx==1 or ly==1: return JP[3]
    t=dq(3.3+0.9*vn(x,y,8,seed)+0.7*vn(x,y,32,seed+1,16),x,y)
    if H(x//3,y,seed+2)<0.03: t-=1                                # fibre
    return P(JP,min(t,5))
MN=R_('#6a4c22','#97722f','#b88e42','#c49b4c','#cfa758','#dbb468','#ecca86')
def jangpan_b(x,y,seed=127):
    # monoreum (printed wood-look vinyl, Korean flat): faint printed boards 8 px tall, wide gloss, no real joints
    row=y//8; ly=y%8; off=int(H(row%8,0,seed)*64); lx=(x+off)%64
    t=dq(3.2+0.8*vn(x,y,32,seed+1,16),x,y)
    if ly==7: t-=1                                                # printed board line
    if lx==0 and ly<7: t-=1
    if H((x+off)//6,y,seed+2)<0.12: t-=1
    return P(MN,min(t,6))
MR=R_('#26180c','#3d2814','#52361c','#614023','#704b2a','#815933','#9a6e42')
MP=R_('#4a3418','#6c4e26','#896532','#98723b','#a77f45','#b98f52','#d2aa6c')
def _maru(x,y,R,seed,bh):
    # woomul-maru: jang-gwitle beams every 32 px (5 px, bevelled) and short boards (bh px) spanning between them
    lx=x%32
    if lx<5: return [R[1],R[5],R[4],R[3],R[0]][lx]
    if lx==5: return R[1]                                         # shade on the board next to the beam
    ly=y%bh; k=y//bh
    if ly==bh-1: return R[0]
    b=[2,3,4][_i(H(x//32,k,seed),3)]
    if ly==0: return R[b+1]
    if H((lx+int(H(x//32,k,seed+1)*20))//4,y,seed+2)<0.22: return R[b-1]
    return R[b]
def maru_a(x,y,seed=129): return _maru(x,y,MR,seed,5)
def maru_b(x,y,seed=131):
    # pale pine daecheong: same structure, narrower 4-px boards, a knot now and then
    if x%32>5 and y%4 in (1,2) and H(x//6,y//4,seed+3)<0.025: return MP[1]
    return _maru(x,y,MP,seed,4)
SD=R_('#0b0f13','#151b21','#1f262e','#29313a','#343e48','#46525e','#66737f')
CY=R_('#0d3a42','#1a6672','#2fb6c8','#a8f4ff')
def sfdeck_a(x,y,seed=133):
    # dark diamond-plate deck: 32x32 plates, bevel, raised tread, corner bolts, a cyan light strip on alternate plates
    lx,ly=x%32,y%32; e=bevel(lx,ly,32,32)
    if e==2: return SD[0]
    lit=(x//32+y//32)%2==0
    if lit and 4<=lx<=27 and ly in (25,26,27): return [CY[1],CY[3],CY[1]][ly-25] if 5<=lx<=26 else CY[0]
    if lit and 4<=lx<=27 and ly in (24,28): return SD[2]
    if lx in (2,28) and ly in (2,28): return SD[6]
    if lx in (3,29) and ly in (3,29): return SD[0]
    if e==1: return SD[5]
    if e==-1: return SD[1]
    cx,cy=lx%4,ly%4; o=((lx//4)+(ly//4))%2
    if (cx,cy) in (((0,0),(1,1)) if o else ((2,1),(1,2))): return SD[4]
    if (cx,cy) in (((1,0),(2,1)) if o else ((2,2),(1,3))): return SD[1]
    return SD[3]
WS=R_('#5c656e','#838c95','#a9b1b8','#bcc3c9','#cbd1d6','#dadfe3','#ebeef0','#2b6fd6','#8fc0ff')
def sfdeck_b(x,y,seed=135):
    # white starship floor: 32x16 panels, recessed seams, top-lit gradient, a blue status pip on some panels
    lx,ly=x%32,y%16; e=bevel(lx,ly,32,16)
    if e==2: return WS[0]
    if e==-1: return WS[2]
    if e==1: return WS[6]
    if H(x//32,y//16,seed)<0.3 and 26<=lx<=29 and 9<=ly<=12:
        if lx in (27,28) and ly in (10,11): return WS[8] if (lx,ly)==(27,10) else WS[7]
        return WS[3]
    return P(WS,dq(5.2-1.6*ly/15,x,y))
BS=R_('#1e242c','#2f3740','#3f4853','#4a5460','#55606c','#636e7b','#7a8693')
def bluestone_a(x,y,seed=137):
    # big blue-grey slabs 32x32, half-bond by row, chamfer, dithered stone grain, a hairline crack in a few slabs
    off=16 if (y//32)%2 else 0; lx,ly=(x+off)%32,y%32; sid=(((x+off)//32)%2,(y//32)%2)
    e=bevel(lx,ly,32,32)
    if e==2: return BS[0]
    if e==-1: return BS[1]
    b=3+(1 if H(*sid,seed)<0.4 else 0)
    if e==1: return BS[b+2]
    if H(*sid,seed+1)<0.25 and abs(lx-ly*0.6-8-int(H(*sid,seed+2)*8))<0.6 and 6<ly<26: return BS[1]
    t=dq(b-0.5+1.0*vn(x,y,8,seed+3),x,y)
    if H(x,y,seed+4)<0.02: t-=1
    return P(BS,t)
BJ=R_('#262628','#3c3c3f','#4f4f53','#5b5b5f','#67676b','#76767a','#8c8c90')
def bluestone_b(x,y,seed=139):
    # square fired floor bricks (bangjeon) 16x16, straight grid, bevel, each brick its own firing tone, pores
    lx,ly=x%16,y%16; e=bevel(lx,ly,16,16)
    if e==2: return BJ[0]
    b=[2,3,3,4][_i(H(x//16,y//16,seed),4)]
    if e==1: return BJ[b+2]
    if e==-1: return BJ[b-1]
    t=dq(b-0.4+0.8*vn(x,y,8,seed+1),x,y)
    if H(x,y,seed+2)<0.03: t-=1
    return P(BJ,t)
FLOOR_CANDS={'lino':(lino_a,lino_b),'carpet':(carpet_a,carpet_b),'wtile':(wtile_a,wtile_b),'parquet':(herring_a,herring_b),
             'concrete':(concrete_a,concrete_b),'tatami':(tatami_a,tatami_b),'jangpan':(jangpan_a,jangpan_b),
             'maru':(maru_a,maru_b),'sfdeck':(sfdeck_a,sfdeck_b),'bluestone':(bluestone_a,bluestone_b)}
FLOOR_LABEL={'lino':'비닐 바닥','carpet':'카펫','wtile':'타일 바닥','parquet':'쪽모이 마루','concrete':'콘크리트 바닥',
             'tatami':'다다미','jangpan':'장판','maru':'우물마루','sfdeck':'SF 갑판','bluestone':'청석·전돌 바닥'}
FLOOR_ALT={'lino':('비닐 타일(VCT)','병원 녹색 시트'),'carpet':('사무실 카펫 타일','호텔 복도 무늬 카펫'),
           'wtile':('작은 흰 유약 타일','팔각+파란 점 타일'),'parquet':('바구니 짜임','헤링본'),'concrete':('노출 콘크리트','광택 에폭시'),
           'tatami':('엇갈린 다다미','새 다다미(줄눈 쌓기)'),'jangpan':('노란 장판지','모노륨(나무무늬 장판)'),
           'maru':('짙은 우물마루','밝은 대청마루'),'sfdeck':('어두운 무늬강판+청록 띠','흰 우주선 바닥'),'bluestone':('청석 큰 판','방전돌')}
# ================================================================ walls
WN=R_('#24140a','#3b2212','#56331b','#6a4123','#7d4f2c','#935f37','#ad7646')
WP=R_('#9c9478','#bdb497','#d3caac','#ded6b9','#e9e2c7','#6f8569','#8ea487','#a9bea1')
def w_wallpaper_a(X,fy):
    # cream paper with sage stripes and printed sprigs, chair rail, raised-panel wainscot, baseboard
    if fy>=29: return [WN[4],WN[2],WN[0]][fy-29]
    if fy in (16,17,18): return [WN[6],WN[4],WN[1]][fy-16]
    if fy>=19:
        lx=X%16; ly=fy-19                                         # panel 16 wide, rows 19..28
        if lx==15 or ly==9: return WN[1]
        if lx==0 or ly==0: return WN[5]
        if lx==14 or ly==8: return WN[2]
        if lx==1 or ly==1: return WN[3]
        if lx==13 or ly==7: return WN[5]
        if lx==2 or ly==2: return WN[2]
        return WN[4]
    if fy<2: return [WN[2],WN[5]][fy]                             # picture rail
    s=X%16
    if s in (0,1): return WP[5]
    if s==2: return WP[7]
    if s==8 and fy%6==3: return WP[6]
    if s in (7,9) and fy%6==4: return WP[7]
    return P(WP,min(dq(4.6-1.2*fy/16,X,fy),4))
DR=R_('#5a2c32','#7a3e44','#91545a','#9f6066','#ad6d72','#bb7c80','#d8aaa4')
DW=R_('#9d958b','#beb6ab','#d7d0c6','#e3ddd4','#eeeae2','#f7f4ee','#b8923e')
def w_wallpaper_b(X,fy):
    # rose damask: ogee lattice traced in a tone-on-tone print, white panelled dado with a gilt line
    if fy>=29: return [DW[3],DW[1],DW[0]][fy-29]
    if fy==19: return DW[6]
    if fy==18: return DR[0]
    if fy>=20:
        lx=X%16; ly=fy-20
        if lx==15 or ly==8: return DW[1]
        if lx==0 or ly==0: return DW[5]
        if (lx in (2,13) and 2<=ly<=6) or (ly in (2,6) and 2<=lx<=13): return DW[2] if lx==13 or ly==6 else DW[5]
        return DW[4]
    if fy<2: return [DR[0],DR[5]][fy]
    lx=X%16; w=3.2+2.4*math.sin(2*math.pi*fy/16)
    d=min(abs(lx-8-w),abs(lx-8+w))
    if d<0.6: return DR[5]
    if d<1.2: return DR[2]
    if fy%16 in (3,4,11,12) and abs(lx-8)<1.6: return DR[5]
    return P(DR,dq(4.0-0.8*fy/18,X,fy))
WH=R_('#6c6e71','#9a9c9f','#bdbfc1','#cfd0d0','#dcdcdb','#e7e7e5','#f3f3f1')
def w_white_a(X,fy):
    # modern painted wall: three-step crown, quiet top-lit paint, a deep painted baseboard with a contact shadow
    if fy<3: return [WH[2],WH[6],WH[3]][fy]
    if fy>=26: return [WH[2],WH[6],WH[5],WH[4],WH[4],WH[1]][fy-26]
    return P(WH,dq(5.3-1.0*(fy-3)/22,X,fy))
SC=R_('#244232','#355c45','#467656','#518462','#5d936e','#79ad88','#e4e0d2','#d2cebf','#bfbaab','#181818','#3a3a3a')
def w_white_b(X,fy):
    # school / clinic: cream paint above, gloss green oil-paint dado with a soft reflection band, black rubber skirting
    if fy>=29: return [SC[10],SC[9],SC[9]][fy-29]
    if fy==14: return SC[0]
    if fy==15: return SC[5]
    if fy>=16: return P(SC,min(5,dq(2.4+1.5*max(0.0,1-abs(fy-19)/3.5)+0.3*vn(X,fy,16,7),X,fy)))
    if fy<2: return [SC[8],SC[6]][fy]
    return SC[6] if dq(0.85-fy/20,X,fy)>=1 else SC[7]
TT=R_('#7a8288','#9ea6ac','#c2c8cc','#d3d8db','#e1e5e7','#eef1f2','#fafbfb')
def w_tile_a(X,fy):
    # bathroom: glazed white 8x8 tiles top to bottom, bull-nose cap, darker cove tiles at the foot
    if fy<2: return [TT[2],TT[6]][fy]
    if fy>=29: return [TT[5],TT[2],TT[1]][fy-29]
    lx,ly=X%8,(fy-2)%8; e=bevel(lx,ly,8,8)
    if e==2: return TT[1]
    if e==-1: return TT[2]
    if e==1: return TT[5]
    if (lx,ly)==(1,1): return TT[6]
    return TT[4]
MT=R_('#4a6a62','#6e8f86','#94b3a9','#a6c3b9','#b6d1c7','#c8ded6','#e2f0eb','#e6e2d6','#d6d1c3')
def w_tile_b(X,fy):
    # metro tiles 8x4 in a running bond below, painted plaster above, a dark-green border course between
    if fy<2: return [MT[8],MT[7]][fy]
    if fy<10: return MT[7] if dq(0.8-(fy-2)/16,X,fy)>=1 else MT[8]
    if fy==10: return MT[0]
    if fy==11: return MT[2]
    if fy>=29: return [MT[2],MT[1],MT[0]][fy-29]
    r=(fy-12)//4; ly=(fy-12)%4; lx=(X+(4 if r%2 else 0))%8
    if ly==3 or lx==7: return MT[1]
    if ly==0: return MT[6] if lx==1 else MT[5]
    if lx==0: return MT[5]
    if ly==2 or lx==6: return MT[3]
    return MT[4]
CW=R_('#33363a','#4c5054','#63676b','#707478','#7d8185','#8b8f93','#a1a5a8','#202224')
def w_conc_a(X,fy):
    # board-formed concrete: 32x16 form panels, recessed tie holes with a lit rim and a rain stain, board lines
    if fy>=29: return [CW[4],CW[2],CW[1]][fy-29]
    lx,ly=X%32,fy%16
    if lx==31 or ly==15: return CW[1]
    if lx==0 or ly==0: return CW[5]
    for hx,hy in ((7,4),(23,4),(7,10),(23,10)):
        if (lx,ly) in ((hx,hy),(hx+1,hy)): return CW[7]
        if (lx,ly) in ((hx,hy+1),(hx+1,hy+1)): return CW[5]
        if lx in (hx,hx+1) and hy+2<=ly<=hy+4 and (lx+ly)%2: return CW[2]
    return P(CW,dq(2.7+0.9*vn(X,fy,16,215,8)+(0.35 if ly%4==1 else 0),X,fy))
CB=R_('#555a60','#7a8086','#9aa0a6','#a8aeb3','#b5bbc0','#c4c9cd','#d5d9dc')
def w_conc_b(X,fy):
    # painted cinder-block wall 16x8, running bond, deep mortar, bevel, pores
    if fy>=29: return [CB[1],CB[0],CB[0]][fy-29]
    r=fy//8; ly=fy%8; lx=(X+(8 if r%2 else 0))%16; e=bevel(lx,ly,16,8)
    if e==2: return CB[0]
    if e==-1: return CB[2]
    if e==1: return CB[5]
    if H(X,fy,217)<0.05: return CB[2]
    return CB[4] if fy<16 else CB[3]
HW=R_('#1f130a','#352012','#4c2e19','#5d3a20','#704828','#875a33','#a06e42')
HP=R_('#c7b994','#d9cdaa','#e6dcbd','#efe7cd','#f7f1de','#fffaea')
def w_hanji_a(X,fy):
    # changho sliding doors: posts every 64 px, door frames, ttisal lattice (dense verticals, three bar groups)
    # over glowing hanji, bevelled wooden gungpan below, threshold
    lx=X%64
    if fy>=29: return [HW[5],HW[3],HW[1]][fy-29]
    if lx<5: return [HW[1],HW[6],HW[5],HW[3],HW[0]][lx]
    if fy<2: return [HW[2],HW[5]][fy]
    dx=(lx-5)%30
    if dx in (0,29) or fy in (2,21): return HW[4] if dx==0 or fy==2 else HW[2]
    if fy>=22:
        ly=fy-22
        if ly==6: return HW[1]
        if dx==1 or ly==0: return HW[5]
        if dx==28 or ly==5: return HW[2]
        return HW[3] if (dx//2+ly)%5 else HW[4]
    if fy in (4,5,11,12,18,19): return HW[5] if fy in (4,11,18) else HW[3]
    if dx%3==1: return HW[4]
    t=dq(2.4+2.2*(1-abs(fy-11.5)/10),lx,fy)
    if dx%3==2: t-=1                                              # shadow of the bar on the paper
    return P(HP,t)
HE=R_('#8a6a44','#a8865a','#bc9a6c','#c8a878','#d4b686')
HL=R_('#b9b2a2','#d2cbba','#e2dccb','#ece6d6','#f5f0e2')
def w_hanji_b(X,fy):
    # hanok earth wall: posts every 64 px, three lintels (inbang), whitewashed upper panel, ochre earth lower panel
    lx=X%64
    if fy>=29: return [HW[5],HW[3],HW[1]][fy-29]
    if lx<5: return [HW[1],HW[6],HW[5],HW[3],HW[0]][lx]
    for top in (0,13,25):
        if top<=fy<=top+3: return [HW[6],HW[4],HW[3],HW[1]][fy-top]
    ao=lx in (5,6) or lx==63 or fy in (4,12,17,24)
    if fy<13: return P(HL,dq(2.8+1.0*vn(X,fy,8,219),X,fy)-(1 if ao else 0))
    t=dq(2.0+1.2*vn(X,fy,8,221),X,fy)-(1 if ao else 0)
    if H(X//2,fy,223)<0.04: t-=1                                  # straw in the clay
    return P(HE,t)
LQ=R_('#2c0806','#4c0f0b','#6e1610','#8c1f15','#a82a1c','#c84630','#e4805e')
GD=R_('#5a3c10','#9a6c1e','#d4a23a','#f4d27a')
PL=R_('#a69c88','#c4baa5','#d8cfbb','#e6dfcd','#f0ead9','#f8f4e8')
GS=R_('#2e3034','#45484d','#5c5f65','#6c6f75','#7e8187','#959a9f')
AR=R_('#163a2c','#2e6a50','#14261e')
def w_lacquer_a(X,fy):
    # wuxia hall: round red-lacquer columns every 64 px (cylinder shading, gilt collars), whitewash between with AO,
    # a green architrave above, granite plinth course with column bases
    lx=X%64
    if fy>=26:
        if lx<10 and fy>=27: return [GS[1],GS[4],GS[5],GS[4],GS[3],GS[3],GS[2],GS[2],GS[1],GS[0]][lx]   # column base
        bx=(X+(8 if (fy-26)%2 else 0))%16
        if fy==26: return GS[5]
        if bx==15 or fy==31: return GS[0]
        return GS[3] if bx else GS[4]
    if 1<=lx<=8:
        if fy in (3,22): return [GD[1],GD[2],GD[3],GD[2],GD[2],GD[1],GD[1],GD[0]][lx-1]
        if fy in (4,23): return GD[0]
        return [LQ[1],LQ[3],LQ[5],LQ[6],LQ[4],LQ[3],LQ[2],LQ[0]][lx-1]
    if fy<3: return AR[fy]
    ao=lx in (0,9) or fy==3
    return P(PL,dq(4.4-1.0*fy/25+0.4*vn(X,fy,8,225),X,fy)-(2 if ao else 0))
DC=R_('#0e2a22','#17463a','#246a55','#3a9277','#7cc7a8','#e8e4d4')
RD=R_('#6a140e','#a8261a','#d84a2a','#f4a050','#ffe08a')
BL=R_('#14284e','#244a8a','#4a78c0')
PW=R_('#160e09','#24170e','#352214','#432b19','#52351f','#644226','#7b5331')
def w_lacquer_b(X,fy):
    # dancheong band (meori-cho: graded green bands, red lotus with a gold heart, blue buds) over dark lacquered
    # raised-panel wainscot, granite foot
    if fy>=29: return [GS[4],GS[2],GS[0]][fy-29]
    if fy<=9:
        lx=X%32
        if fy in (0,9): return DC[0]
        if fy in (1,8): return DC[5]
        c=abs(lx-15.5); d=c+abs(fy-4.5)*1.4
        if d<1.6: return RD[4]
        if d<3.0: return RD[3]
        if d<4.6: return RD[2]
        if d<6.0: return RD[1]
        if c>12 and 3<=fy<=6: return BL[2] if fy in (3,4) else BL[1]
        return [DC[1],DC[2],DC[3],DC[4],DC[3],DC[2]][(fy-2)%6]
    if fy==10: return PW[0]
    lx=X%16; ly=fy-11                                             # panels rows 11..28
    if lx==15 or ly==17: return PW[0]
    if lx==0 or ly==0: return PW[5]
    if lx==14 or ly==16: return PW[1]
    if lx==1 or ly==1: return PW[4]
    if (lx==2 and 2<=ly<=15) or (ly==2 and 2<=lx<=13): return PW[1]
    if (lx==13 and 2<=ly<=15) or (ly==15 and 2<=lx<=13): return PW[5]
    return P(PW,dq(3.2+0.6*vn(X,fy,16,227,8)-0.6*ly/18,X,fy))
SF=R_('#090c10','#11161c','#1a2027','#232b33','#2d3640','#3a4550','#55636f')
LED=R_('#c83030','#3ac060','#e8b030')
def w_sf_a(X,fy):
    # dark hull panels 32 wide: bevel, a cyan light strip with a halo, a louvred vent, status LEDs, metal kickplate
    if fy>=29: return [SF[5],SF[3],SF[1]][fy-29]
    lx=X%32
    if fy in (7,8,9): return [CY[1],CY[3],CY[1]][fy-7] if lx!=31 else SF[1]
    if fy in (6,10): return CY[0]
    if lx==31: return SF[0]
    if lx==30: return SF[1]
    if lx==0: return SF[5]
    if fy==15: return SF[0]
    if fy==16: return SF[4]
    if 19<=fy<=26 and 6<=lx<=25:
        if lx in (6,25) or fy in (19,26): return SF[1]
        return SF[4] if fy%2 else SF[1]
    if fy==12 and lx in (4,6) and H((X//32)%2,lx,231)<0.6: return LED[_i(H((X//32)%2,lx,229),3)]
    if (lx,fy) in ((2,2),(28,2),(2,13),(28,13)): return SF[6]
    return P(SF,dq(3.6-0.8*fy/28,X,fy))
SW=R_('#4b535b','#737b84','#99a1a9','#afb6bc','#c1c7cc','#d1d6da','#e2e6e9','#f1f3f4')
OR=R_('#7a3008','#c8581a','#f08a3a','#ffc080')
def w_sf_b(X,fy):
    # white starship wall: 32-px panels with chamfered corners and recessed seams, an orange accent stripe,
    # grey lower panel with a slot vent, kickplate
    if fy>=29: return [SW[3],SW[1],SW[0]][fy-29]
    lx=X%32
    if fy in (17,18,19): return [OR[3],OR[2],OR[0]][fy-17] if lx!=31 else SW[1]
    if lx==31: return SW[0]
    top,bot=(0,16) if fy<17 else (20,28)
    ly=fy-top
    if fy==bot: return SW[1]
    if lx+ly<2 or (30-lx)+ly<2: return SW[1]                      # chamfered corners
    if lx==0 or ly==0: return SW[7]
    if lx==30 or fy==bot-1: return SW[2]
    if fy>=20:
        if 23<=fy<=25 and 4<=lx<=26 and lx%3: return SW[1] if fy==23 else SW[2]
        return SW[3]
    return P(SW,dq(6.4-1.4*ly/15,X,fy))
WALL_CANDS={'wallpaper':(w_wallpaper_a,w_wallpaper_b),'whitewall':(w_white_a,w_white_b),'tilewall':(w_tile_a,w_tile_b),
            'concwall':(w_conc_a,w_conc_b),'hanji':(w_hanji_a,w_hanji_b),'lacquer':(w_lacquer_a,w_lacquer_b),'sfwall':(w_sf_a,w_sf_b)}
WALL_LABEL={'wallpaper':'벽지','whitewall':'칠한 벽','tilewall':'타일 벽','concwall':'콘크리트 벽','hanji':'한옥 벽','lacquer':'무림 전각 벽',
            'sfwall':'SF 벽'}
WALL_ALT={'wallpaper':('줄무늬 벽지+판벽','장미색 다마스크+흰 판벽'),'whitewall':('흰 페인트+몰딩','학교 벽(아래 녹색 유성)'),
          'tilewall':('흰 욕실 타일','메트로 타일+회벽'),'concwall':('노출 콘크리트(폼타이)','칠한 블록'),'hanji':('창호 띠살문','회벽+흙벽+인방'),
          'lacquer':('붉은 둥근 기둥+회벽','단청 머리초+검은 판벽'),'sfwall':('어두운 패널+청록 빛','흰 우주선 벽')}
GENRE={'lino':'modern','carpet':'modern','wtile':'modern','parquet':'modern','concrete':'modern','tatami':'east','jangpan':'east',
       'maru':'east','bluestone':'east','sfdeck':'sf','wallpaper':'modern','whitewall':'modern','tilewall':'modern','concwall':'modern',
       'hanji':'east','lacquer':'east','sfwall':'sf'}
CEILS6={'pale':((64,62,66),(54,52,56)),'navy':((18,24,38),(12,16,28)),'lacquer':((40,14,10),(30,10,8))}
WEAVE=64        # every structure above repeats within 64 px
# the user's picks: key -> 'a' | 'b'. Only picked surfaces are registered under their key.
PICKED={}
def register():
    import tiles5
    for k,ab in PICKED.items():
        if k in FLOOR_CANDS: TL.FLOORFN[k]=FLOOR_CANDS[k][0 if ab=='a' else 1]
        else: room2.FACEFN[k]=WALL_CANDS[k][0 if ab=='a' else 1]
    tiles5.CEILS.update(CEILS6)

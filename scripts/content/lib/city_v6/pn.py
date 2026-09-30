# batch 8b: large-town infrastructure drawn from per-cell masks — canal with stone quays, bridge deck, town wall with
# walkway + battlements + front face, gate arch, flanking towers. Surfaces are chipset tile interiors; joints hand-drawn.
import sys, os, math; sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from PIL import Image
from px2 import _hash
import palette
CH=Image.open(os.environ.get('PJ_CHIPSET',os.path.join(os.path.dirname(os.path.abspath(__file__)),'assets','jungle-chipset-v6.png'))).convert('RGBA')   # the v6 chipset copy (byte-identical to the jungle atlas it was taken from)
def hx(s): return tuple(int(s[i:i+2],16) for i in (1,3,5))
ST=[hx(c) for c in [palette.OUT_CHIP['stone']]+palette.RAMPS_CHIP['stone']]     # tone 0..6
WD=[hx(c) for c in [palette.OUT_CHIP['wood']]+palette.RAMPS_CHIP['wood']]
def tile(x,y): return CH.crop((x,y,x+16,y+16)).load()
WATER=tile(16,80); CASTLE=tile(352,32); COB=tile(160,96)
def mk(mask): return len(mask[0]),len(mask)
def at(mask,x,y): return 0<=y<len(mask) and 0<=x<len(mask[0]) and mask[y][x]
def mul(c,k): return tuple(min(255,int(v*k)) for v in c[:3])

def canal(mask):
    # water cells; a bank on the north shows the quay's stone face (6px) under a 3px rim, other banks show a 3px rim
    W,H=mk(mask); im=Image.new('RGBA',(W*16,H*16)); px=im.load()
    for Y in range(H*16):
        for X in range(W*16):
            cx,cy=X//16,Y//16
            if not mask[cy][cx]: continue
            lx,ly=X%16,Y%16; r,g,b,_=WATER[lx,ly]; col=(r,g,b)
            n=at(mask,cx,cy-1); s=at(mask,cx,cy+1); w=at(mask,cx-1,cy); e=at(mask,cx+1,cy)
            rim=(not n and ly<3) or (not s and ly>=13) or (not w and lx<3) or (not e and lx>=13)
            face=(not n and 3<=ly<9)
            if rim:
                t=5 if ((not n and ly==0) or (not w and lx==0)) else (4 if (not s and ly>=13) or (not e and lx>=13) else 5)
                if (not n and ly==2) or (not s and ly==13) or (not w and lx==2) or (not e and lx==13): t=3
                if (X//8+Y//3)%3==0 and t>3: t-=1
                col=ST[t]
            elif face:
                course=(ly-3)//3; off=4 if course%2 else 0
                t=3 if (ly-3)%3!=2 and (X+off)%8!=0 else 1
                if ly==8: t=1
                col=ST[t]
            else:
                if not n and ly<12: col=mul(col,0.72)                      # the quay's shadow on the water
                if not w and lx<5: col=mul(col,0.85)
            px[X,Y]=col+(255,)
    return im

def bridge(w=3,h=4):
    # a N-S road bridge over an E-W canal: cobbled deck, low parapets on both sides with their tops and south ends,
    # stone end posts; its shadow falls right onto the water (drawn by the caller's shadow pass)
    W,H=w*16,h*16; im=Image.new('RGBA',(W,H)); px=im.load()
    for Y in range(H):
        for X in range(W):
            if 5<=X<W-5:
                r,g,b,_=COB[X%16,Y%16]; px[X,Y]=(r,g,b,255)
                if X in (5,W-6): px[X,Y]=ST[2]+(255,)
            else:
                side=X<5; x=X if side else W-1-X
                t=5 if x in (1,2) else (4 if x==3 else 2)
                if x==0 or x==4: t=1
                if Y%8==0 and 1<=x<=3: t=3                                     # coping stone joints
                px[X,Y]=(ST[t] if side else ST[max(1,t-1)])+(255,)
    for X in list(range(0,5))+list(range(W-5,W)):                               # parapet south-end faces
        for Y in range(H-4,H): px[X,Y]=ST[3 if X<W//2 else 2]+(255,)
        px[X,H-1]=ST[1]+(255,)
    for (x0,y0) in ((0,0),(W-5,0),(0,H-9),(W-5,H-9)):                          # end posts
        for Y in range(y0,y0+5):
            for X in range(x0,x0+5): px[X,Y]=ST[6 if Y==y0 else 4 if X<x0+3 else 3]+(255,)
    return im

def townwall(mask,gates=(),face=None):
    # mask: walkway cells. An E-W run shows walkway (merlons on the outer/north edge, a parapet on the inner edge) and,
    # in the two cells below it, the stone front face. N-S runs show only the walkway with merlons on both sides.
    # gates: cells of the walkway above a road; the face below them gets an arch passage.
    W,H=mk(mask); im=Image.new('RGBA',(W*16,H*16)); px=im.load()
    def face_col(cx,cy):   # is (cx,cy) a face cell (below an E-W walkway, not itself a walkway)
        for k in (1,2):
            if at(mask,cx,cy-k) and not at(mask,cx,cy) and not any(at(mask,cx,cy-j) for j in range(1,k)) : return k
        return 0
    for Y in range(H*16):
        for X in range(W*16):
            cx,cy=X//16,Y//16; lx,ly=X%16,Y%16
            if at(mask,cx,cy):
                n=at(mask,cx,cy-1); s=at(mask,cx,cy+1); w=at(mask,cx-1,cy); e=at(mask,cx+1,cy)
                t=4 if ((X//8)+(Y//4))%2 else 3
                if Y%4==3 or (X+(4 if (Y//4)%2 else 0))%8==7: t=2               # paving slabs
                col=ST[t]
                ns=not n and not s                                               # E-W run
                if not n and ly<5:                                               # merlons on the north edge
                    col=ST[5 if ly<2 else 4] if (X%8)<5 else (ST[1] if ly>=2 else ST[3])
                if not s and ly>=13: col=ST[5 if ly==13 else 4]                  # inner parapet
                if not w and lx<4: col=ST[5 if lx<2 else 4] if (Y%8)<5 else ST[2]
                if not e and lx>=12: col=ST[4 if lx>13 else 3] if (Y%8)<5 else ST[1]
                px[X,Y]=col+(255,)
            else:
                k=face_col(cx,cy)
                if not k: continue
                wy=ly+(k-1)*16; wc=cx
                gate=any((gx,gy)==(cx,cy-k) for gx,gy in gates)
                if face: col=face(X,wy)                                           # v7: pale ashlar like the castle (the chipset's dark navy tile read as water)
                else: r,g,b,_=CASTLE[lx,ly]; col=(r,g,b)
                if wy<3: col=mul(col,0.6)                                         # under the parapet overhang
                if wy>=29: col=ST[4] if wy==29 else ST[2]                         # footing course
                px[X,Y]=col+(255,)
    # gate arches: each run of gate cells opens one round arch in the face below it
    gs=sorted(gates,key=lambda g:(g[1],g[0]))
    runs=[]
    for g in gs:
        if runs and runs[-1][-1][0]==g[0]-1 and runs[-1][-1][1]==g[1]: runs[-1].append(g)
        else: runs.append([g])
    for run in runs:
        x0=run[0][0]*16; x1=(run[-1][0]+1)*16; y0=(run[0][1]+1)*16; y1=y0+32
        cx=(x0+x1)/2; R=(x1-x0)/2-3; spring=y0+4+R
        for Y in range(y0,y1):
            for X in range(x0,x1):
                d=X+0.5-cx
                inside=abs(d)<=R and (Y>=spring or (Y+0.5-spring)**2+d*d<=R*R)
                ring=abs(d)<=R+2 and (Y>=spring or (Y+0.5-spring)**2+d*d<=(R+2)**2)
                if inside:
                    far=abs(d)<R*0.45 and Y>=y1-10                               # the far end of the passage, lit
                    col=mul(COB[X%16,Y%16],0.8) if far else ((14,16,24) if Y<y1-6 else mul(COB[X%16,Y%16],0.32))
                    if Y<spring-R+4 and int(d)%3==0: col=ST[1]                  # raised portcullis teeth
                    px[X,Y]=col+(255,)
                elif ring:
                    a=math.atan2(Y+0.5-spring,d); seg=int((a+math.pi)*8/math.pi)
                    px[X,Y]=(ST[5] if seg%2 else ST[4])+(255,)                  # voussoirs
    return im

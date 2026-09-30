from k import *
# ---- chair, ladder-back (our design: open back with two rungs, turned finials) ----
CHAIR_S=[
 ' 13    31 ',
 '1673  3761',
 '0677777760',
 '0666666630',
 '0322222230',
 '063    630',
 '0637777630',
 '0632222230',
 '063    630',
 '1455555541',
 '1566656651',
 '0777777770',
 '0233333320',
 '0200000020',
 ' 30    30 ',
]
CHAIR_N=[   # back toward the viewer: seat plate beyond, the ladder back in front of it
 '          ',
 ' 11111111 ',
 '1677777761',
 '1566656651',
 '0677777760',
 '0666666630',
 '0322222230',
 '0635556630',
 '0636666630',
 '0637777630',
 '0632222230',
 '063000 630',
 '0630000630',
 '0620000620',
 ' 30    30 ',
]
CHAIR_E=[   # facing east: back post on the west (3 px, rounded lit top), seat plate to the east
 ' 11      ',
 '1771     ',
 '0761     ',
 '0761     ',
 '0751     ',
 '0761     ',
 '0761     ',
 '0751     ',
 '076111111',
 '076455551',
 '076566661',
 '077777771',
 '003333330',
 '0200 0200',
 '01    01 ',
]
def mirror(rows): return [r[::-1] for r in rows]
def chair(face='S'):
    rows={'S':CHAIR_S,'N':CHAIR_N,'E':CHAIR_E,'W':mirror(CHAIR_E)}[face]
    p=Pix(16,16); w=len(rows[0]); p.lit((16-w)//2,1,rows,WK); return p.im
# ---- table: any size; top seen from above, rolled rim, lit front lip, black apron, turned legs ----
def table(W,Hh,seed=1):
    top=Hh-6; p=Pix(W,Hh)
    for y in range(top):
        for x in range(W):
            if y==0: t=1 if H(x,0,seed)<0.6 else 2
            elif x==0: t=2
            elif x==W-1: t=1
            elif y==1 or x==1 or x==W-2: t=7
            else:
                t=6
                # grain: short east-west streaks, denser near the rim
                edge=min(x-2,W-3-x,y-2)
                r=H(x//3+(y*7)%5,y,seed)
                if r<(0.30 if edge<2 else 0.07): t=5
                if r>0.985: t=4
            p.set(x,y,WOOD[t])
    y=top; p.set(0,y,WOOD[1]); p.set(W-1,y,WOOD[1])
    for x in range(1,W-1): p.set(x,y,WOOD[7])
    y+=1
    for x in range(W): p.set(x,y,WOOD[[2,3,3,2][int(H(x,y,seed)*4)]])
    p.set(0,y,WOOD[1]); p.set(W-1,y,WOOD[1])
    y+=1
    for x in range(W): p.set(x,y,WOOD[0])
    # legs: 3 px, lit left, dark right, black outline, feet
    for lx in (1,W-5):
        for yy in range(y+1,Hh):
            p.set(lx,yy,WOOD[0]); p.set(lx+1,yy,WOOD[6] if yy<Hh-1 else WOOD[3]); p.set(lx+2,yy,WOOD[3]); p.set(lx+3,yy,WOOD[0])
    for x in range(5,W-5): p.set(x,y+1,WOOD[1])
    return p.im
def stool():
    return Pix.__new__(Pix)
STOOL=[
 '   111111   ',
 '  17777771  ',
 ' 1766565761 ',
 ' 1766666661 ',
 ' 1576666751 ',
 ' 0157777510 ',
 '  03333330  ',
 '  00000000  ',
 '  063  630  ',
 '  063  630  ',
 '  0630 630  ',
 '  063  630  ',
 '  030  030  ',
]
def stool():
    p=Pix(16,16); p.lit(2,2,STOOL,WK); return p.im

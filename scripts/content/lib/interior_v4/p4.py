from k import *
from p2 import R_, BRASS, QUILT
from p3 import IRON, CLAY, STONE, FIRE, GOLD, GLASS, LEAF
from tiles import FLAG, BRICK
def stairs_up(wc=3,mat='stone'):
    # flight climbing north into the wall: 48 px tall (first floor row + both face rows). 4-px steps:
    # 2 tread rows (lit), 2 riser rows (shade, dithered); masonry cheeks with a lit inner edge; dark landing on top
    W=wc*16; Hh=48; p=Pix(W,Hh)
    R=STONE if mat=='stone' else [WOOD[0],WOOD[1],WOOD[2],WOOD[3],WOOD[4],WOOD[5],WOOD[6],WOOD[7]]
    for y in range(Hh):
        for x in range(W):
            if x<4 or x>=W-4:          # cheeks
                cx=x if x<4 else W-1-x
                c=[BRICK[0],BRICK[2],BRICK[3],BRICK[4]][cx] if x<4 else [BRICK[0],BRICK[1],BRICK[2],BRICK[3]][cx]
                if y%6==5: c=BRICK[1]
                p.set(x,y,c); continue
            if y<6:
                p.set(x,y,hx('#141018') if y<5 else R[1]); continue
            k=(y-6)%4; step=(y-6)//4
            fade=max(0,2-step//3)              # upper steps sit deeper in the shadow
            if k==0: t=6
            elif k==1: t=5 if (x+y)%5 else 6
            elif k==2: t=3 if (x+y)%2 else 2
            else: t=2
            t=max(1,t-fade)
            if x in (4,W-5): t=max(1,t-2)      # shadow along the cheeks
            p.set(x,y,R[t])
    return p.im
def stairs_down():
    p=Pix(16,16)
    for y in range(16):
        for x in range(16):
            if x in (0,15) or y in (0,15): c=FLAG[0] if (x==15 or y==15) else FLAG[4]
            elif x in (1,14) or y==1: c=FLAG[3]
            else:
                d=min(y-2,6); c=hx('#141018')
                # three steps falling away south → north, each darker
                for i,yy in enumerate((11,8,5)):
                    if y>=yy and y<yy+2 and 2+i<=x<=13-i: c=STONE[5-i] if y==yy else STONE[3-i]
            p.set(x,y,c)
    return p.im
def counter(wc=3,goods=()):
    W=wc*16; Hh=24; p=Pix(W,Hh)
    top=7
    for y in range(Hh):
        for x in range(W):
            if y<top:        # top board seen from above
                if y==0: t=1
                elif x in (0,W-1): t=1
                elif y==1 or x==1: t=7
                elif x==W-2: t=5
                else: t=6 if H(x//3,y,2)>0.2 else 5
            elif y==top: t=7 if 0<x<W-1 else 1
            elif y==top+1: t=2 if 0<x<W-1 else 0
            elif y>=Hh-2: t=0 if y==Hh-1 else 3
            else:            # front face: frame + recessed panels every 16 px
                lx=x%16
                if x in (0,W-1): t=0
                elif lx in (0,15) and 0<x<W-1: t=4 if lx==0 else 3
                elif y in (top+2,Hh-3): t=4
                elif lx in (2,13) or y in (top+3,Hh-4):
                    t=3 if (lx==13 or y==Hh-4) else 6
                elif lx in (1,14): t=4
                else: t=5 if (x+y)%7 else 4
            p.set(x,y,WOOD[t])
    return p.im
def fireplace(wc=2):
    W=wc*16; Hh=32; p=Pix(W,Hh)         # stands against the wall: the top 16 px sit on the wall face
    for y in range(Hh):
        for x in range(W):
            c=None
            if y<4:        # mantel shelf
                c=WOOD[[1,7,6,2][y]] if 0<x<W-1 else WOOD[1]
            elif y<28:
                # stone surround with a lit inner rim, dark arched firebox
                fx=abs(x-(W-1)/2); inner=W/2-5
                arch_top=12+int(max(0,fx-(inner-4))*1.2)
                if fx<inner and y>=arch_top:
                    c=hx('#140c0c') if y<26 else hx('#2a1810')
                    if fx>=inner-1 or y==arch_top: c=STONE[1]
                else:
                    ly=(y-4)%5; lx=(x+(3 if ((y-4)//5)%2 else 0))%7
                    t=5 if ly==0 else (4 if ly<3 else 3)
                    if ly==4 or lx==6: t=1
                    if x in (0,W-1): t=0
                    c=STONE[t]
            else:          # hearth slab in front
                c=FLAG[4] if y==28 else (FLAG[3] if y<31 else FLAG[1])
                if x in (0,W-1): c=FLAG[1]
            p.set(x,y,c)
    # logs + flames
    cx=W//2
    for x in range(cx-6,cx+6):
        p.set(x,24,WOOD[4]); p.set(x,25,WOOD[2])
    for (x,y,t) in [(cx-3,17,2),(cx-2,16,3),(cx-1,15,4),(cx,14,5),(cx,15,4),(cx+1,16,3),(cx+2,18,2),(cx-4,20,2),(cx+3,20,2)]:
        for yy in range(y,24): p.set(x,yy,FIRE[max(1,t-(yy-y)//3)] if yy<23 else FIRE[2])
    for x in range(cx-2,cx+2):
        for y in range(19,23): p.set(x,y,FIRE[5] if y>20 else FIRE[4])
    return p.im
def rug(wc=3,hc=2,col='red'):
    W,Hh=wc*16-4,hc*16-4; p=Pix(wc*16,hc*16); Q=QUILT[col]
    for y in range(Hh):
        for x in range(W):
            e=min(x,y,W-1-x,Hh-1-y)
            if e==0: t=1
            elif e==1: t=GOLD
            elif e==2: t=2
            else:
                cx,cy=(W-1)/2,(Hh-1)/2; d=abs(x-cx)/cx+abs(y-cy)/cy
                t=4 if d<0.45 else 3
                if 0.55<d<0.65: t=GOLD
                if (x+y)%2 and t in (3,4): t=t-1 if H(x,y,4)<0.2 else t
            p.set(x+2,y+2,GOLD[3] if t is GOLD else Q[t])
    for x in range(3,W+1,2): p.set(x,1,LIN) if False else None
    return p.im
def shelf_pots():
    # wall shelf (hangs on the face): board with brackets, three jars
    p=Pix(16,16)
    for x in range(1,15): p.set(x,11,WOOD[7]); p.set(x,12,WOOD[3]); p.set(x,13,WOOD[1])
    p.set(2,14,WOOD[2]); p.set(13,14,WOOD[2])
    jars=[(2,5,CLAY),(7,3,[hx('#1a2a3a'),hx('#28506a'),hx('#3a7090'),hx('#5a98b8'),hx('#8cc0d8'),hx('#c0e0f0')]),(11,6,CLAY)]
    for x0,y0,R in jars:
        h=11-y0; w=4 if x0!=7 else 3
        for y in range(y0,11):
            for x in range(x0,x0+w):
                t=4 if x==x0 else (2 if x==x0+w-1 else 3)
                if y==y0: t=5
                p.set(x,y,R[t])
        p.set(x0,y0,R[1]); p.set(x0+w-1,y0,R[1])
    return p.im
def bottles():
    p=Pix(16,16)
    for x in range(1,15): p.set(x,11,WOOD[7]); p.set(x,12,WOOD[3]); p.set(x,13,WOOD[1])
    cols=[('#1e4a1a','#2e7020','#6cc050'),('#4a0a10','#8a1a20','#e06060'),('#3a2a08','#8a6420','#e0b860'),('#1a2a4a','#28508a','#80a8e0')]
    for i,x0 in enumerate((2,5,8,11)):
        d,m,l=[hx(c) for c in cols[i]]; top=4+(i%2)*2
        p.set(x0+1,top,WOOD[2]); p.set(x0+1,top+1,m)
        for y in range(top+2,11):
            p.set(x0,y,m); p.set(x0+1,y,l if y<top+5 else m); p.set(x0+2,y,d)
    return p.im
def stove():
    p=Pix(16,24)
    for y in range(24):
        for x in range(1,15):
            if y<6:   # iron top with two plates, seen from above
                t=4 if y==0 else 3
                if (x-5)**2+(y-3)**2*2<7 or (x-10)**2+(y-3)**2*2<7: t=1
                if x in (1,14): t=1
            elif y==6: t=5
            elif y<22:
                t=2
                if x in (1,14): t=0
                elif x==2: t=3
                if 10<=y<=17 and 4<=x<=11: t=0 if (y in (10,17) or x in (4,11)) else None
            else: t=0
            if t is None:
                p.set(x,y,FIRE[3] if y>14 else FIRE[1]); continue
            p.set(x,y,IRON[t])
    p.set(7,16,FIRE[5]); p.set(8,16,FIRE[4]); p.set(6,16,FIRE[4])
    return p.im
def sack():
    B=R_('#3a2a14','#5e4626','#80643a','#a0844e','#bca266','#d4bc84')
    rows=['    1111    ','   124421   ','    1331    ','  11344311  ',' 1345554431 ','134555544431','134555444321','134454444321','123444333221',' 1233322221 ','  11111111  ']
    p=Pix(16,16); p.lit(2,3,rows,{str(i):c for i,c in enumerate(B)}); return p.im
def wardrobe():
    W=16; Hh=32; p=Pix(W,Hh)
    for y in range(Hh):
        for x in range(W):
            if y<4: t=[1,7,6,3][y] if 0<x<W-1 else 1
            elif y>=Hh-2: t=0 if y==Hh-1 else 3
            else:
                if x in (0,W-1): t=0
                elif x in (1,8): t=4 if x==1 else 6
                elif x in (7,14): t=2
                elif y in (5,Hh-4): t=6 if y==5 else 2
                elif y==4: t=4
                else:
                    t=5
                    if 7<=y<=Hh-7 and x in (3,10): t=3
                    if 7<=y<=Hh-7 and x in (5,12): t=6
            p.set(x,y,WOOD[t])
    for y in (16,17): p.set(6,y,BRASS[3 if y==16 else 1]); p.set(9,y,BRASS[3 if y==16 else 1])
    return p.im
def candle():
    p=Pix(16,16)
    rows=['   5   ','  454  ','   4   ','   3   ','  111  ','  161  ','  151  ','  151  ',' 22222 ','2433332',' 11111 ']
    key={'5':FIRE[5],'4':FIRE[4],'3':FIRE[2],'1':hx('#b8a888'),'6':hx('#fff4e0'),'2':GOLD[1]}
    key['1']=hx('#c8b898'); key['5']=hx('#fff8d0')
    p.lit(5,3,[r.replace('1','w').replace('6','W').replace('5','f') for r in rows],{'w':hx('#c8b898'),'W':hx('#fff4e0'),'f':hx('#fff8d0'),'4':FIRE[4],'3':FIRE[2],'2':GOLD[1],'l':GOLD[3]})
    return p.im

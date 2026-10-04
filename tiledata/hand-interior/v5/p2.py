from k import *
R_=lambda *c:[hx(x) for x in c]
LINEN=R_('#3a3530','#564a3e','#96896e','#b9ab9d','#d8cbac','#e9dec3','#fff4e2')
PILLOW=R_('#2c3a40','#475b63','#8fa7a3','#aac3b5','#cfecec','#f0faff')
QUILT={'green':R_('#16301a','#244d22','#34692c','#4b8a3a','#6aa84c','#94c86a','#c2e490'),
       'red':R_('#3a0508','#6a0c10','#a5010a','#c30014','#e0303a','#f06a64','#ffa89a'),
       'blue':R_('#0a1a3a','#0e357b','#085890','#2a74b0','#3f94d0','#6fb1ff','#b0d8ff')}
BOOK={'r':R_('#3a0508','#a5010a','#c30014','#f06a64'),'b':R_('#0a1a3a','#0e357b','#085890','#6fb1ff'),
      'p':R_('#24103f','#6024a8','#8050b8','#b89ae0'),'g':R_('#10300f','#2e8507','#419d39','#8cd07a'),
      't':R_('#411e05','#9a5435','#d59147','#ffebd7'),'k':R_('#101418','#2a3038','#4a5460','#8894a0')}
BRASS=R_('#4a3006','#8a6010','#d0a020','#ffe070')
def bed(W=16,quilt='green',seed=2):
    Hh=32; p=Pix(W,Hh+6); up=6; Q=QUILT[quilt]; o=up   # up: headboard rises above the footprint
    # headboard: two turned posts + arched panel
    for px in (0,W-3):
        p.lit(px,0,[' 1 ','171','161','030','161','161','161','161','161','161','131','030'],WK)
    for x in range(3,W-3):
        arch=0 if abs(x-(W-1)/2)<W/2-5 else 1
        for y in range(1+arch,12):
            t=6 if y==1+arch else (7 if y==2+arch else 5)
            if y>=10: t=3
            if y==11: t=0
            if 4+arch<=y<=8 and 5<=x<=W-6: t=4 if (y==4+arch or x==5) else (6 if (y==8 or x==W-6) else 5)
            p.set(x,y,WOOD[t])
        p.set(x,arch,WOOD[1])
    # mattress/linen area
    top=12
    for y in range(top,Hh+up-2):
        for x in range(1,W-1):
            p.set(x,y,LINEN[5])
    for y in range(top,Hh+up-2): p.set(0,y,WOOD[1]); p.set(W-1,y,WOOD[1]); p.set(1,y,WOOD[6]); p.set(W-2,y,WOOD[3])
    # pillows: puffy, rounded, lit centre, soft shadow row under
    n=1 if W<=16 else 2; pw=(W-4)//n
    for i in range(n):
        x0=2+i*pw; m=pw-4
        rows=['  '+'1'*(m)+'  ',' 14'+'5'*(m-2)+'41 ','14'+'5'*m+'41','13'+'4'+'5'*(m-2)+'4'+'31','123'+'4'*(m-2)+'321',' 1'+'2'*m+'1 ']
        p.lit(x0,top,rows,{str(k):c for k,c in enumerate(PILLOW)})
    # turned-down sheet fold, then the quilt: symmetric ramp (edges dark, centre lit), one stitch row, draped foot
    qy=top+7
    for x in range(1,W-1): p.set(x,qy,LINEN[6]); p.set(x,qy+1,LINEN[5]); p.set(x,qy+2,LINEN[3])
    for y in range(qy+3,Hh+up-2):
        for x in range(1,W-1):
            e=min(x-1,W-2-x)                       # px from the edge
            t=[1,3,4,4,5][e] if e<5 else 5
            if e in (2,4) and (x+y)%2: t+=1         # dithered boundary, alternating per row (RTP cloth)
            if y==qy+3: t=min(6,t+1)
            if y>=Hh+up-5: t=max(1,t-2) if (x*3+y)%5 else max(0,t-3)
            p.set(x,y,Q[max(0,min(6,t))])
    # foot rail + legs
    y=Hh+up-2
    for x in range(W): p.set(x,y,WOOD[7] if 0<x<W-1 else WOOD[1]); p.set(x,y+1,WOOD[3] if 0<x<W-1 else WOOD[0])
    p.set(1,y+1,WOOD[0]); p.set(W-2,y+1,WOOD[0])
    return p.im
def bookshelf(W=32,rows=3,seed=5):
    sh=10; top=5; Hh=top+rows*sh+3; p=Pix(W,Hh)
    # cornice
    for x in range(W):
        p.set(x,0,WOOD[1]); p.set(x,1,WOOD[7] if 0<x<W-1 else WOOD[1])
        for y in (2,3): p.set(x,y,WOOD[6 if (x+y)%7 else 5] if 0<x<W-1 else WOOD[1])
        p.set(x,4,WOOD[3] if 0<x<W-1 else WOOD[0])
    for s in range(rows):
        y0=top+s*sh
        for y in range(y0,y0+sh):
            p.set(0,y,WOOD[0]); p.set(1,y,WOOD[4]); p.set(W-2,y,WOOD[3]); p.set(W-1,y,WOOD[0])
            for x in range(2,W-2): p.set(x,y,WOOD[1] if y<y0+2 else WOOD[0])
        # books: varied heights and widths, gaps, a leaning book, sometimes a jar
        x=3; i=0
        while x<W-4:
            r=H(x,s,seed); c='rbpgtk'[int(r*6)]; bw=2 if r<0.55 else 3
            if x+bw>W-3: break
            if H(x,s,seed+9)<0.12 and x+4<W-3:   # gap with a small jar
                p.lit(x,y0+sh-6,[' 11 ','1331','1231','1221','0110'],{'0':WOOD[0],'1':hx('#2c3a40'),'2':hx('#475b63'),'3':hx('#aac3b5')}); x+=5; continue
            bh=sh-2-int(H(x,s,seed+3)*3); by=y0+sh-bh
            B=BOOK[c]
            for yy in range(by,y0+sh):
                for k in range(bw):
                    t=[3,2,1][k] if bw==3 else [2,1][k]
                    if yy==by: t=min(3,t+1)
                    if yy==by+2: t=3 if k==0 else 0   # spine band
                    p.set(x+k,yy,B[t])
            x+=bw; i+=1
            if H(x,s,seed+5)<0.18: x+=1
        # shelf board
        yb=y0+sh
        for x in range(1,W-1): p.set(x,yb,WOOD[7]); p.set(x,yb+1,WOOD[[3,2][(x+s)%2]])
    for x in range(W): p.set(x,Hh-1,WOOD[0])
    for x in range(2,W-2): p.set(x,Hh-2,WOOD[3])
    return p.im
def dresser(W=16,seed=1):
    # a low chest of drawers: top seen from above (4 rows), three drawers with brass pulls, plinth
    Hh=24; p=Pix(W,Hh)
    for x in range(W):
        p.set(x,0,WOOD[1])
        for y in (1,2,3,4):
            t=[7,6,6,5][y-1] if 0<x<W-1 else 1
            if y in (2,3) and 0<x<W-1 and H(x//2,y,seed)<0.2: t=5
            p.set(x,y,WOOD[t])
        p.set(x,5,WOOD[7] if 0<x<W-1 else WOOD[1]); p.set(x,6,WOOD[2] if 0<x<W-1 else WOOD[0])
    for d in range(3):
        y0=7+d*5
        for y in range(y0,y0+5):
            for x in range(W):
                if x in (0,W-1): t=0
                elif x==1: t=4
                elif x==W-2: t=3
                elif y==y0: t=6
                elif y==y0+4: t=1
                elif x==2: t=6
                elif x==W-3: t=3
                else: t=5 if (x+y)%5 else 4
                p.set(x,y,WOOD[t])
        cx=W//2; p.set(cx-1,y0+2,BRASS[3]); p.set(cx,y0+2,BRASS[2]); p.set(cx-1,y0+3,BRASS[1]); p.set(cx,y0+3,BRASS[0])
    for x in range(W): p.set(x,22,WOOD[0] if x in (0,W-1) else WOOD[3]); p.set(x,23,WOOD[0])
    for x in (2,3,W-4,W-3): p.set(x,23,WOOD[1])
    return p.im

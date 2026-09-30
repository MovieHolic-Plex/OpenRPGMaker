from k import *
from p2 import R_, BRASS, QUILT, LINEN
from p3 import IRON, CLAY, STONE, FIRE, GOLD, GLASS, LEAF
def doormat():
    B=R_('#3a2a14','#5e4626','#80643a','#a0844e','#bca266')
    p=Pix(16,16)
    for y in range(4,13):
        for x in range(1,15):
            e=min(x-1,y-4,14-x,12-y)
            t=1 if e==0 else (2 if e==1 else (3 if (x+y)%2 else 4 if (y%3==0) else 3))
            p.set(x,y,B[t])
    return p.im
def bench(wc=2):
    W=wc*16; p=Pix(W,16)
    for y in range(3,16):
        for x in range(W):
            if y==3: t=1
            elif x in (0,W-1) and y<10: t=1
            elif y==4: t=7
            elif y<8: t=6 if H(x//3,y,5)>0.2 else 5
            elif y==8: t=7
            elif y==9: t=2
            elif y==10: t=0
            else:
                legs={1:0,2:6,3:3,4:0,W-5:0,W-4:6,W-3:3,W-2:0}
                if x in legs and y<15: t=legs[x]
                elif x in legs: t=0 if x in (1,4,W-5,W-2) else 2
                else: continue
            p.set(x,y,WOOD[t] if 0<=x<W else None)
    return p.im
def roundtable():
    p=Pix(16,16)
    for y in range(1,11):
        for x in range(16):
            d=((x+0.5-8)/7.5)**2+((y+0.5-5.5)/4.8)**2
            if d<=1:
                t=6
                if d>0.72: t=7 if (y<5 or x<8) else 5
                if d>0.92: t=1 if y<5 else 2
                if d<0.72 and H(x//3,y,3)<0.15: t=5
                p.set(x,y,WOOD[t])
    for x in range(3,13): p.set(x,11,WOOD[2] if 3<x<12 else WOOD[1])
    for x in range(5,11): p.set(x,12,WOOD[0])
    for y in range(12,15): p.set(7,y,WOOD[6]); p.set(8,y,WOOD[3]); p.set(6,y,WOOD[0]); p.set(9,y,WOOD[0])
    for x in range(4,12): p.set(x,15,WOOD[0] if x in (4,11) else WOOD[2])
    # a mug and a plate
    p.lit(4,3,[' 11 ','1551','1441',' 11 '],{'1':LINEN[2],'5':LINEN[6],'4':LINEN[4]})
    p.lit(9,5,['1111','1331','1221','0000'],{'1':WOOD[1],'3':hx('#d0c090'),'2':hx('#a09060'),'0':WOOD[0]})
    return p.im
def weapon_rack():
    p=Pix(16,16)
    # sword, spear, axe standing in a wall rack
    for x in range(0,16): p.set(x,12,WOOD[7]); p.set(x,13,WOOD[3]); p.set(x,14,WOOD[1])
    for y in range(1,12): p.set(3,y,IRON[5] if y<9 else WOOD[4]); p.set(4,y,IRON[3] if y<9 else WOOD[2])
    p.set(2,9,GOLD[3]); p.set(5,9,GOLD[2]); p.set(3,0,IRON[4])
    for y in range(0,12): p.set(8,y,WOOD[5] if y>2 else IRON[5])
    for y in range(0,3): p.set(7,y+1,IRON[3]); p.set(9,y+1,IRON[2])
    for y in range(2,12): p.set(12,y,WOOD[4]); p.set(13,y,WOOD[2])
    for y in range(2,6):
        for x in range(10,12): p.set(x,y,IRON[4] if x==10 else IRON[3])
    p.set(10,2,IRON[5]); p.set(10,6,IRON[1]); p.set(11,6,IRON[1])
    return p.im
def shield():
    p=Pix(16,16); R=QUILT['red']
    for y in range(1,15):
        half=6 if y<8 else int(6*(15-y)/7+0.5)
        for x in range(8-half,8+half):
            e=x in (8-half,8+half-1) or y==1
            p.set(x,y,IRON[1] if e else (R[4] if x<8 else R[3]))
    for y in range(2,13): p.set(7,y,GOLD[4]); p.set(8,y,GOLD[2])
    for x in range(3,13): p.set(x,6,GOLD[4] if x<8 else GOLD[2])
    p.set(7,6,GOLD[5])
    return p.im
def display(goods='potion'):
    p=Pix(16,16)
    for y in range(4,16):
        for x in range(1,15):
            if y==4: t=1
            elif x in (1,14): t=1 if y<9 else 0
            elif y==5: t=7
            elif y<9: t=2      # open box interior, seen from above
            elif y==9: t=7
            elif y==15: t=0
            else: t=5 if (y-10)%3 else 3
            p.set(x,y,WOOD[t])
    cols={'potion':[QUILT['red'],QUILT['blue'],QUILT['green']],'apple':[QUILT['red']]*2+[QUILT['green']],'bread':[[hx(c) for c in ('#3a2008','#6a3a10','#9a6020','#c08038','#d8a050','#f0c878','#fff0c0')]]*3}[goods]
    for i,x in enumerate((3,7,11)):
        R=cols[i]
        if goods=='potion':
            p.set(x+1,1,hx('#c8b898')); p.set(x+1,2,R[2])
            for y in range(3,8): p.set(x,y,R[3]); p.set(x+1,y,R[5] if y<5 else R[4]); p.set(x+2,y,R[2])
        else:
            for y in range(4,8):
                for xx in range(x,x+3): p.set(xx,y,R[5] if (xx==x and y<6) else (R[4] if y<7 else R[2]))
            p.set(x+1,3,R[4])
    return p.im
def goods_img(g):
    p=Pix(8,8)
    if g=='mug': p.lit(2,2,[' 11 ','1551','14411','1441 ',' 11 '],{'1':WOOD[1],'5':LINEN[6],'4':LINEN[4]})
    elif g=='bread': p.lit(1,3,[' 1111 ','155541','144431',' 1111 '],{'1':WOOD[1],'5':hx('#f0c878'),'4':hx('#c08038'),'3':hx('#9a6020')})
    elif g=='book': p.lit(1,3,['111111','133331','122221','111111'],{'1':hx('#3a0508'),'3':hx('#c30014'),'2':hx('#a5010a')})
    elif g=='scale': p.lit(1,1,['  1   ','111111','2 1  2','22122 ','  1   ',' 111  '],{'1':GOLD[2],'2':GOLD[4]})
    return p.im

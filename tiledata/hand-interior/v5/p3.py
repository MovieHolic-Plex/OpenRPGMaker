from k import *
from p2 import R_, BRASS
GLASS=R_('#1a2a3a','#2e5070','#4a7aa0','#7ab0d8','#b8e0f8','#f0faff')
IRON=R_('#101418','#2a3038','#4a5460','#707c88','#a0acb8','#d0d8e0')
CLAY=R_('#2a1206','#5a2a10','#8a4420','#b8663a','#d88a58','#f0b080')
STONE=R_('#1d2c33','#363540','#4f4d5e','#606278','#758090','#909fb2','#a6bdbf','#d0dcd8')
LEAF=R_('#0c240e','#1d4a1a','#2e7020','#419d39','#6cc050','#a8e080')
FIRE=R_('#5a0a00','#b02000','#e85010','#ff9020','#ffd040','#fff8b0')
GOLD=R_('#3a2400','#6a4a08','#a07818','#d0a830','#f0d060','#fff0b0')
def window(w=12,h=13):
    p=Pix(w,h); m=w//2
    for y in range(h-3):
        for x in range(w):
            edge=x in (0,w-1) or y==0
            if edge: c=WOOD[1]
            elif x==1 or y==1: c=WOOD[7]
            elif x==w-2: c=WOOD[3]
            elif x in (m-1,m) or y==(h-3)//2+1: c=WOOD[6] if (x==m-1 or y==(h-3)//2+1) else WOOD[3]
            elif y==h-4: c=WOOD[3]
            else:
                g=4 if y<4 else (3 if y<h-6 else 2)
                if x in (2,m+1) or y in (2,(h-3)//2+2): g=max(1,g-1)       # frame shadow on the glass
                if (x-y) in (1,2) and y<(h-3)//2: g=5                    # glint
                if (x-y)==m-1 and y>(h-3)//2+1: g=4
                c=GLASS[g]
            p.set(x,y,c)
    # sill: lit top, protruding one px
    p.set(0,h-3,WOOD[1]); p.set(w-1,h-3,WOOD[1])
    for x in range(-0,w): p.set(x,h-3,WOOD[7] if 0<x<w-1 else WOOD[2])
    for x in range(w): p.set(x,h-2,WOOD[4] if 0<x<w-1 else WOOD[1]); p.set(x,h-1,WOOD[1])
    out=Pix(16,16); out.im.alpha_composite(p.im,((16-w)//2,1)); return out.im
def picture(kind='land'):
    p=Pix(14,11)
    for y in range(11):
        for x in range(14):
            if x in (0,13) or y in (0,10): p.set(x,y,GOLD[0])
            elif x==1 or y==1: p.set(x,y,GOLD[4])
            elif x==12 or y==9: p.set(x,y,GOLD[2])
            elif x==2 or y==2 or x==11 or y==8: p.set(x,y,GOLD[1])
            else:
                # tiny landscape: sky, far hill, near field, a tree
                hill=5+int(1.5*math.sin(x*0.9)) if False else (5 if 4<x<9 else 6)
                c=hx('#8cc8f0') if y<4 else (hx('#bfe4f8') if y<hill else (LEAF[3] if y<7 else LEAF[2]))
                if y==hill and 4<x<9: c=LEAF[4]
                p.set(x,y,c)
    p.set(9,4,LEAF[2]); p.set(9,5,LEAF[1]); p.set(10,4,LEAF[3]); p.set(9,3,LEAF[3])
    p.set(3,3,hx('#fff4d0'))
    out=Pix(16,16); out.im.alpha_composite(p.im,(1,2)); return out.im
import math
def clock():
    # tall case clock, 1x2: hood with round dial, trunk with a pendulum window, plinth
    rows=[
    '    111111    ',
    '   17777771   ',
    '  1766666661  ',
    '  0655555530  ',
    '  0512222150  ',
    '  0126776210  ',
    '  0167777610  ',
    '  0167607610  ',
    '  0167707610  ',
    '  0127777210  ',
    '  0512662150  ',
    '  0655555530  ',
    '  0333333330  ',
    '   07777770   ',
    '   06555530   ',
    '   06100130   ',
    '   0610g130   ',
    '   061gG130   ',
    '   0610g130   ',
    '   06100130   ',
    '   061GGG30   ',
    '   061gGg30   ',
    '   06111130   ',
    '   06555530   ',
    '  1777777771  ',
    '  0655555530  ',
    '  0333333330  ',
    '  0000000000  ',
    ]
    key=dict(WK); key.update({'g':GOLD[2],'G':GOLD[4]})
    # dial face is ivory, hands dark
    key['7']=WOOD[7]
    p=Pix(16,32); p.lit(1,3,rows,key)
    # dial: ivory disc with a dark rim and two hands (paint over the hood panel)
    cx,cy=7.5,10.5
    for y in range(6,16):
        for x in range(3,13):
            d=((x-cx)**2+(y-cy)**2)**0.5
            if d<=2.7: p.set(x,y,hx('#f4ead0') if (x+y)<cx+cy+1 else hx('#d8c8a0'))
            elif d<=3.6: p.set(x,y,GOLD[1] if (x+y)>cx+cy else GOLD[3])
    p.set(7,10,WOOD[0]); p.set(7,9,WOOD[0]); p.set(8,10,WOOD[1])
    return p.im
def barrel():
    rows=[
    '    222222    ',
    '  22455554 2  ',
    ' 2456666665 2 ',
    ' 2566677666 2 ',
    ' 1455666654 1 ',
    ' 012444442110 ',
    ' 0iIIIIIIIIi0 ',
    ' 0366767663 0 ',
    ' 0356676653 0 ',
    ' 0356767653 0 ',
    ' 0iIIIIIIIIi0 ',
    ' 0245656542 0 ',
    ' 0124545421 0 ',
    '  001111100   ',
    ]
    # fix ragged right edge: make symmetric rows
    rows=[
    '    222222    ',
    '  2245555422  ',
    ' 245666666542 ',
    ' 256667766652 ',
    ' 145566665541 ',
    ' 012444444210 ',
    ' 0jIIIIIIIIj0 ',
    '03566767666530',
    '03566676666530',
    '03566767666530',
    ' 0jIIIIIIIIj0 ',
    ' 024565656420 ',
    ' 012454545210 ',
    '  0011111100  ',
    ]
    key=dict(WK); key.update({'I':IRON[3],'j':IRON[1]})
    p=Pix(16,16); p.lit(1,1,rows,key); return p.im
def jar(col=CLAY):
    rows=[
    '    1111    ',
    '   133331   ',
    '   120021   ',
    '    1331    ',
    '  11344311  ',
    ' 1345554431 ',
    '134555544431',
    '134555444321',
    '134454444321',
    '123444433321',
    ' 1233333221 ',
    '  11222211  ',
    '   111111   ',
    ]
    p=Pix(16,16); p.lit(2,2,rows,{str(i):c for i,c in enumerate(col)}); return p.im
def plant():
    p=Pix(16,16)
    leaves=[
    '     4  3     ',
    '   44 435  3  ',
    '  3 443543 43 ',
    ' 43 3543342 5 ',
    ' 3 45 32 4353 ',
    '  4332 34324 3',
    ' 32 242 3 32  ',
    '  2 12 21 2   ',
    ]
    p.lit(1,0,leaves,{str(i):c for i,c in enumerate(LEAF)})
    pot=[
    '  11111111  ',
    '  15555551  ',
    '  13444431  ',
    '   134431   ',
    '   123321   ',
    '    1111    ',
    ]
    p.lit(2,8,pot,{str(i):c for i,c in enumerate(CLAY)}); return p.im
def chest():
    rows=[
    '  11111111111 ',
    ' 1677777777761',
    ' 1666565666631',
    ' 1iIIIIIIIIIi1',
    ' 1333333333331',
    ' 0777777777770',
    ' 0I56666666I30',
    ' 0I566ggG66I30',
    ' 0I566gGg66I30',
    ' 0I55555555I30',
    ' 0I33333333I30',
    ' 00000000000 0',
    ]
    rows=[r if len(r)==14 else r.ljust(14) for r in rows]
    rows[-1]=' 0000000000000'
    key=dict(WK); key.update({'I':IRON[2],'i':IRON[4],'g':GOLD[2],'G':GOLD[4]})
    p=Pix(16,16); p.lit(1,3,rows,key); return p.im
def crate():
    p=Pix(16,16)
    for y in range(2,15):
        for x in range(2,14):
            e=x in (2,13) or y in (2,14)
            if e: c=WOOD[1] if y==2 else WOOD[0]
            elif y==3: c=WOOD[7]
            elif y in (4,5): c=WOOD[6] if (x+y)%6 else WOOD[5]          # top face (seen from above)
            elif y==6: c=WOOD[3]
            elif x in (3,12) or y in (7,13): c=WOOD[6] if (x==3 or y==7) else WOOD[4]   # frame
            else: c=WOOD[3] if (y-8)%3==2 else WOOD[5]
            p.set(x,y,c)
    for i in range(8):
        y=8+int(i*4/7+0.5)
        p.set(4+i,y,WOOD[7]); p.set(11-i,y,WOOD[7])
        if y<12: p.set(4+i,y+1,WOOD[2]) if i<4 else None
    return p.im

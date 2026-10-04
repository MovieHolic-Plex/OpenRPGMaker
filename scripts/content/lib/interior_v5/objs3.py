# batch B: chapel, study/library, tailor, home, bath, magic, decor
from objs2 import *
import math
@ob('pew','church')
def _():
    p=canvas(32,16)
    for xx in range(32):
        for yy in range(0,6): p.set(xx,yy,WOOD[[1,6,5,5,4,2][yy]] if xx not in (0,31) else WOOD[1])
    fy=box(p,0,6,32,4,5,'wood',panel=False)
    for xx in (1,2,3,28,29,30): 
        for yy in range(0,15): p.set(xx,yy,WOOD[[0,6,3][(xx-1)%3]] if xx<8 else WOOD[[6,3,0][(xx-28)%3]])
    return F(p.im,2,1,0,'floor')
@ob('altar','church')
def _():
    p=canvas(32,24); fy=box(p,0,2,32,8,12,'marble',panel=True)
    for yy in range(3,20):
        for xx in range(10,22):
            if yy<10 or yy<19: p.set(xx,yy,M['purple'][4 if xx<16 else 3] if yy>3 else M['purple'][5])
    for yy in range(12,18): p.set(15,yy,M['gold'][5]); p.set(16,yy,M['gold'][3])
    for xx in range(13,19): p.set(xx,14,M['gold'][5])
    put_good(p,'candle',3,0); put_good(p,'candle',26,0); put_good(p,'book',14,3)
    return F(p.im,2,1,8,'wall')
@ob('lectern','church')
def _():
    p=canvas(16,24)
    lit(p,2,0,[' 11111111111 ','1677777777761','1566666666651','1444444444441',' 111111111111'],'wood')
    lit(p,4,1,['16661666','15551555'],'linen')
    for yy in range(5,22): p.set(7,yy,WOOD[6]); p.set(8,yy,WOOD[3]); p.set(6,yy,WOOD[1]); p.set(9,yy,WOOD[0])
    for xx in range(3,13): p.set(xx,21,WOOD[5]); p.set(xx,22,WOOD[2]); p.set(xx,23,WOOD[0])
    return F(p.im,1,1,8,'floor')
@ob('pipe organ','church')
def _():
    p=canvas(32,40); 
    for i in range(12):
        x0=2+i*2+ (1 if i>5 else 0); h=10+int(10*math.sin(i/11*math.pi))
        for yy in range(22-h,22):
            p.set(x0,yy,M['gold'][5]); p.set(x0+1,yy,M['gold'][3])
        p.set(x0,22-h,M['gold'][6]); p.set(x0,19,M['black'][1]); p.set(x0+1,19,M['black'][1])
    fy=box(p,0,22,32,5,13,'dwood',panel=True)
    for xx in range(2,30): p.set(xx,29,M['white'][6] if xx%3 else M['black'][0])
    return F(p.im,2,1,24,'wall')
@ob('stained glass','church')
def _():
    p=canvas(16,16)
    cols=[M['red'][4],M['blue'][4],M['yellow'][5],M['green'][4],M['purple'][4]]
    for yy in range(1,15):
        for xx in range(3,13):
            top=1+int(abs(xx-7.5)**2/6)
            if yy<top: continue
            if xx in (3,12) or yy in (top,14): p.set(xx,yy,M['stone'][1]); continue
            if (xx-3)%3==0 or (yy-2)%4==0: p.set(xx,yy,M['black'][1]); continue
            p.set(xx,yy,cols[((xx-3)//3+(yy-2)//4)%5])
    return F(p.im,1,0,0,'hang')
@ob('candelabra','church')
def _():
    p=canvas(16,32)
    lit(p,2,8,['f   f   f  ','o   o   o  ','5   5   5  ','5   5   5  ','4   4   4  ','3333333333 ','    3     ','    3     '],'linen',{'f':M['yellow'][6],'o':M['orange'][4],'3':M['gold'][3]})
    for yy in range(16,30): p.set(6,yy,M['gold'][5]); p.set(7,yy,M['gold'][2])
    for xx in range(3,11): p.set(xx,30,M['gold'][4]); p.set(xx,31,M['gold'][1])
    return F(p.im,1,1,16,'floor')
@ob('holy water font','church')
def _():
    p=canvas(16,16); ellipse_top(p,8,5,6,3,'marble',inner='water')
    lit(p,4,8,['1455541 ','  1441  ','  1441  ',' 144441 ','14444441','11111111'],'marble')
    return F(p.im,1,1,0,'floor')
@ob('writing desk','study')
def _():
    p=canvas(32,16); fy=box(p,0,2,32,8,6,'dwood',panel=True); panels(p,20,fy+1,10,4,'dwood',drawers=1)
    legs(p,0,fy+6,32,16-fy-6,'dwood')
    lit(p,4,3,['666666 ','6555556','6555556',' 44444 '],'linen'); put_good(p,'candle',24,0); put_good(p,'book',15,3)
    lit(p,12,2,['1','1','y'],'black',{'y':M['white'][6]})
    return F(p.im,2,1,0,'floor')
@ob('globe','study')
def _():
    p=canvas(16,16)
    for yy in range(1,11):
        for xx in range(3,13):
            d=((xx-7.5)/5)**2+((yy-5.5)/5)**2
            if d>1: continue
            land=math.sin(xx*0.9)+math.cos(yy*1.1+xx*0.3)>0.6
            t=5 if (xx<8 and yy<5) else (4 if d<0.6 else 3)
            p.set(xx,yy,M['green'][t] if land else M['blue'][t])
    for a in range(0,180,12):
        p.set(int(7.5+6*math.cos(math.radians(a+90))),int(5.5-6*math.sin(math.radians(a+90))) if a<180 else 0,M['brass'][4])
    for yy in range(11,14): p.set(7,yy,M['brass'][4]); p.set(8,yy,M['brass'][2])
    for xx in range(4,12): p.set(xx,14,WOOD[5]); p.set(xx,15,WOOD[1])
    return F(p.im,1,1,0,'floor')
@ob('telescope','study')
def _():
    p=canvas(16,16)
    for i in range(10):
        x=3+i; y=10-i*0.7
        p.set(x,int(y),M['brass'][5]); p.set(x,int(y)+1,M['brass'][3]); p.set(x,int(y)+2,M['brass'][1])
    p.set(13,3,M['glass'][6]); 
    for a,b in ((8,6),(5,15),(8,15),(11,15)):
        for t in range(10):
            x=int(8+(a-8)*t/9) if (a,b)!=(8,6) else 8; y=int(8+(b-8)*t/9)
            p.set(x,y,WOOD[3])
    return F(p.im,1,1,0,'floor')
@ob('scroll rack','study')
def _():
    p=canvas(16,32); fy=box(p,0,0,16,3,29,'wood',panel=False)
    for r in range(4):
        for c in range(3):
            x0=2+c*4; y0=5+r*6
            for yy in range(y0,y0+5):
                for xx in range(x0,x0+4): p.set(xx,yy,WOOD[1])
            for k in range(2): lit(p,x0,y0+1+k*2,['5665'[:4],'3443'],'linen')
    return F(p.im,1,1,16,'wall')
@ob('armchair','home')
def _():
    p=canvas(16,16); C=M['red']
    lit(p,1,1,[' 11111111111 ','1455555555541','1455555555541','1455555555541','144444444444 1'[:13],'1311111111131','15166666665 1'[:13],'1516555556151','1414444444141','1313333333131','1111111111111',' 1         1 ','  0       0  '],C)
    for yy in range(12,14): p.set(3,yy,WOOD[2]); p.set(12,yy,WOOD[2])
    return F(p.im,1,1,0,'floor')
@ob('sofa','home')
def _():
    p=canvas(32,16); C=M['green']
    for yy in range(1,15):
        for xx in range(1,31):
            if yy<6: t=5 if yy==1 else 4
            elif yy<8: t=2
            elif yy<11: t=5 if yy==8 else 4
            elif yy==11: t=5
            else: t=2 if yy<14 else 1
            if xx in (1,2,29,30): t=[1,4,4,1][[1,2,29,30].index(xx)] if yy>2 else 1
            if xx==15 and 7<yy<11: t=2
            p.set(xx,yy,C[t])
    for xx in (3,28): p.set(xx,15,WOOD[1])
    return F(p.im,2,1,0,'floor')
@ob('coat rack','home')
def _():
    p=canvas(16,32)
    for yy in range(4,30): p.set(7,yy,WOOD[6]); p.set(8,yy,WOOD[3])
    lit(p,3,1,['1   11   1',' 1  11  1 ','  1111111 '],'wood')
    lit(p,1,5,[' 1111  ','144441 ','1455541','1455541','1444441','1333331',' 11111 '],'blue')
    lit(p,9,4,[' 111 ','14541','1444 1'[:5],' 131 '],'straw')
    for xx in range(4,12): p.set(xx,30,WOOD[5]); p.set(xx,31,WOOD[1])
    return F(p.im,1,1,16,'floor')
@ob('nightstand lamp','home')
def _():
    p=canvas(16,24); fy=box(p,2,8,12,4,10,'wood',panel=False); panels(p,3,fy+2,10,6,'wood',drawers=2)
    lit(p,5,0,['  66  ',' 6556 ','655555','144441','  33  ','  33  ',' 1221 '],'yellow',{'1':M['brass'][2],'2':M['brass'][4],'3':M['brass'][3]})
    return F(p.im,1,1,8,'floor')
@ob('vanity mirror','home')
def _():
    p=canvas(16,32)
    for yy in range(0,14):
        for xx in range(3,13):
            d=((xx-7.5)/5)**2+((yy-7)/7)**2
            if d<1: p.set(xx,yy,M['gold'][4] if d>0.72 else (M['glass'][5] if (xx-yy)%6 else M['white'][6]))
    fy=box(p,0,14,16,5,13,'pink',panel=False); panels(p,2,fy+2,12,8,'pink',drawers=2)
    put_good(p,'bottler',2,12); put_good(p,'flower',10,11)
    return F(p.im,1,1,16,'wall')
@ob('washbasin','home')
def _():
    p=canvas(16,24); ellipse_top(p,8,6,6,3,'white',inner='water')
    lit(p,6,0,[' 44 ','4664','5555','4444'],'white')
    fy=box(p,1,9,14,2,13,'wood',panel=False); panels(p,2,fy+2,12,8,'wood',cols=2)
    return F(p.im,1,1,8,'wall')
@ob('bathtub','home')
def _():
    p=canvas(32,16)
    for yy in range(1,15):
        for xx in range(1,31):
            d=((xx-15.5)/15)**2+((yy-6)/5)**2
            if yy<=6 and d>1: continue
            if d>0.7 and yy<=6: c=M['white'][6] if yy<4 else M['white'][4]
            elif yy<=6: c=M['water'][5] if (xx+yy*3)%9 else M['white'][6]
            else: c=M['white'][4] if yy<12 else M['white'][2]
            if xx in (1,30) and yy>6: c=M['white'][1]
            p.set(xx,yy,c)
    for xx in (3,4,27,28): p.set(xx,15,M['brass'][3])
    for xx,yy in ((10,3),(11,3),(20,4)): p.set(xx,yy,M['white'][6])
    return F(p.im,2,1,0,'floor')
@ob('cradle','home')
def _():
    p=canvas(16,16); fy=box(p,1,3,14,7,4,'pine',panel=False)
    for yy in range(4,10):
        for xx in range(3,13): p.set(xx,yy,M['blue'][5] if yy>6 else M['white'][6])
    lit(p,5,4,[' 55 ','5k55'],'pink',{'k':M['black'][1]})
    for xx in range(1,15): p.set(xx,14,WOOD[3] if abs(xx-7.5)<6 else None); p.set(xx,15,WOOD[1] if abs(xx-7.5)<5 else None)
    return F(p.im,1,1,0,'floor')
@ob('canopy bed','home')
def _():
    b=p2.bed(32,'purple' if False else 'red'); p=canvas(32,48); p.im.alpha_composite(b,(0,10))
    for xx in range(32):
        for yy in range(0,6): p.set(xx,yy,M['purple'][[1,5,4,4,3,1][yy]])
        if xx%4==0: p.set(xx,5,M['gold'][4])
    for x0 in (0,29):
        for yy in range(0,46): p.set(x0,yy,WOOD[1]); p.set(x0+1,yy,WOOD[6]); p.set(x0+2,yy,WOOD[3])
        for yy in range(6,20): p.set(x0+(3 if x0==0 else -1),yy,M['purple'][3])
    return F(p.im,2,2,16,'wall')
@ob('straw bed','home')
def _():
    p=canvas(16,32)
    for yy in range(4,30):
        for xx in range(1,15):
            t=4 if (xx*3+yy*5)%7 else 5
            if xx in (1,14) or yy in (4,29): t=2
            p.set(xx,yy,M['straw'][t])
    for yy in range(14,28):
        for xx in range(2,14): p.set(xx,yy,ramp('#2a1a10','#8a6a48','#d8c0a0')[4 if (xx+yy)%5 else 3])
    lit(p,4,6,[' 5555 ','555555',' 4444 '],'linen')
    return F(p.im,1,2,0,'floor')
@ob('kitchen sink','kitchen')
def _():
    p=canvas(16,24); fy=box(p,0,6,16,6,12,'stone',panel=False)
    for yy in range(8,12):
        for xx in range(3,13): p.set(xx,yy,M['water'][3] if yy>9 else M['stone'][1])
    lit(p,6,0,[' 111 ','14441','  41 ','  41 ','  4  ','  3  '],'iron')
    return F(p.im,1,1,8,'wall')
@ob('dish rack','kitchen')
def _():
    p=canvas(16,16); hang_board(p,1,6,14); hang_board(p,1,13,14)
    for i in range(4): lit(p,2+i*3,1,[' 66 ','6556','6446',' 33 '][:4],'white'); p.set(3+i*3,5,M['blue'][4])
    for i in range(3): put_good(p,'cup',2+i*4,10)
    return F(p.im,1,0,0,'hang')
@ob('hanging pans','kitchen')
def _():
    p=canvas(16,16)
    for xx in range(16): p.set(xx,1,M['iron'][4]); p.set(xx,2,M['iron'][2])
    lit(p,1,3,['  1     1     ','  1     1  1  ',' 111   111 1  ','15551 1555111 ','14441 1444141 ',' 111   111 1  '],'iron')
    lit(p,1,10,['  1    ',' 131   ','13331  ','12221  ',' 111   '],'brass')
    return F(p.im,1,0,0,'hang')
@ob('firewood pile','kitchen')
def _():
    p=canvas(16,16)
    for r,(y0,n,off) in enumerate(((11,4,0),(7,3,2),(3,2,4))):
        for i in range(n):
            cx=2+off+i*4; cy=y0
            for yy in range(cy,cy+4):
                for xx in range(cx,cx+4):
                    d=((xx-cx-1.5)**2+(yy-cy-1.5)**2)**0.5
                    if d<2.2: p.set(xx,yy,WOOD[1] if d>1.6 else (M['pine'][5] if d<0.8 else M['pine'][4]))
    return F(p.im,1,1,0,'floor')
@ob('water jar','kitchen')
def _():
    p=canvas(16,16); ellipse_top(p,8,3,4,2,'clay',inner='water')
    lit(p,2,5,['   1111111  ','  145555541 ',' 14555554441','145555544431','144544444321','134444433321',' 1233333221 ','  11111111  ','   111111   '],'clay')
    return F(p.im,1,1,0,'floor')
@ob('crystal ball','magic')
def _():
    p=canvas(16,16)
    for yy in range(1,10):
        for xx in range(3,13):
            d=((xx-7.5)/4.6)**2+((yy-5)/4.2)**2
            if d<1: p.set(xx,yy,M['purple'][6] if (xx<7 and yy<4) else (M['purple'][4] if d<0.5 else M['purple'][3]))
    p.set(6,3,M['white'][6])
    lit(p,4,9,[' 1yyyy1 ','1yyYYyy1',' 111111 ','  1331  ',' 133331 ','11111111'],'gold',{'y':M['gold'][4],'Y':M['gold'][6],'3':WOOD[4]})
    return F(p.im,1,1,0,'floor')
@ob('spellbook stand','magic')
def _():
    p=canvas(16,16)
    lit(p,2,1,['  1111111111  '[:12],' 15551155551','1p555115555p1'[:12],' 1111111111 '],'linen',{'p':M['purple'][4]})
    for i,(x,y) in enumerate(((4,0),(9,0),(11,2))): p.set(x,y,M['teal'][6])
    for yy in range(5,14): p.set(7,yy,WOOD[5]); p.set(8,yy,WOOD[2])
    for xx in range(4,12): p.set(xx,14,WOOD[5]); p.set(xx,15,WOOD[1])
    return F(p.im,1,1,0,'floor')
@ob('magic circle','magic')
def _():
    p=canvas(32,32)
    for yy in range(32):
        for xx in range(32):
            d=((xx-15.5)**2+(yy-15.5)**2)**0.5
            if 13.4<d<14.4 or 10<d<10.8: p.set(xx,yy,M['teal'][5])
            ang=math.atan2(yy-15.5,xx-15.5)
            for k in range(5):
                a=ang-k*2*math.pi/5
            if d<10 and any(abs(((xx-15.5)*math.sin(k*4*math.pi/5)-(yy-15.5)*math.cos(k*4*math.pi/5))-0)<0.6 and False for k in range(5)): pass
    pts=[(15.5+10*math.cos(-math.pi/2+k*4*math.pi/5),15.5+10*math.sin(-math.pi/2+k*4*math.pi/5)) for k in range(6)]
    for (a,b),(c,d) in zip(pts,pts[1:]):
        for t in range(40):
            p.set(int(a+(c-a)*t/39),int(b+(d-b)*t/39),M['teal'][4])
    for k in range(12):
        a=k*math.pi/6; p.set(int(15.5+12*math.cos(a)),int(15.5+12*math.sin(a)),M['teal'][6])
    return F(p.im,2,2,0,'flat')
@ob('treasure pile','magic')
def _():
    p=canvas(32,16)
    for yy in range(4,16):
        for xx in range(1,31):
            d=((xx-15.5)/15)**2+((yy-15)/11)**2
            if d<1: p.set(xx,yy,M['gold'][[5,4,3,4,5][(xx*3+yy*7)%5]] if d<0.85 else M['gold'][2])
    for (g,x,y) in (('gemr',6,8),('gem',20,7),('crystal',14,2),('coins',24,10),('dagger',3,11)): put_good(p,g,x,y)
    return F(p.im,2,1,0,'floor')
for col in ('blue','red','teal','yellow'):
    def mk(col=col):
        p=canvas(16,24)
        lit(p,4,2,['  1111  ','  1331  ','   11   ','  1441  ',' 145541 ','1455554 1'[:8],'14555441','14555441','1455w441','14544431','14444431','14444431',' 143331 ',' 143331 ','  1331  ',' 111111 ','12222221','11111111'],col,{'w':M['white'][6]})
        return F(p.im,1,1,8,'floor')
    reg(f'tall vase {col}','decor')(mk)
PL={'fern':('leaf',['  5 3 5  ',' 454 4543',' 3 454 3 ','4 34543 4',' 43 3 34 ','3 2 2 2 3']),
    'flowering':('pink',['  5 4 5  ',' 565 4565',' 4 565 4 ','g 45654 g',' g4 g 4g ','g g g g g']),
    'sapling':('leaf',[' 45554 ','4556554','3455543','3445443',' 34443 ','  2w2  ','   w   ','   w   ']),
    'cactus':('green',['   5   ','  454  ',' 5454  ','45454 5','3454343','3454 3 ',' 343   ','  3    '])}
for nm,(col,rows) in PL.items():
    def mk(col=col,rows=rows):
        p=canvas(16,16); lit(p,3,0,rows,col,{'g':M['green'][3],'w':WOOD[3]})
        lit(p,3,9,[' 111111111 ','1666666666 1'[:11],' 144444441 ','  1333331  ','   12221   ','   111111  '[:11]],'clay')
        return F(p.im,1,1,0,'floor')
    reg(f'potted {nm}','decor')(mk)
for nm,col,shape in (('round rug','blue','round'),('runner','red','runner'),('fur rug','linen','fur'),('green rug','green','rect'),('purple rug','purple','rect')):
    def mk(col=col,shape=shape):
        wc,hc=(2,2) if shape!='runner' else (1,3)
        W,Hh=wc*16,hc*16; p=canvas(W,Hh); C=M[col]
        for yy in range(Hh):
            for xx in range(W):
                if shape=='round':
                    d=((xx-W/2+0.5)/(W/2-1))**2+((yy-Hh/2+0.5)/(Hh/2-2))**2
                    if d>1: continue
                    t=2 if d>0.85 else (M['gold'][4] if 0.6<d<0.7 else (4 if (xx+yy)%2 else 3))
                elif shape=='fur':
                    d=((xx-W/2+0.5)/(W/2-1))**2+((yy-Hh/2+0.5)/(Hh/2-3))**2
                    if d>1-0.25*math.sin(math.atan2(yy-Hh/2,xx-W/2)*8)**2: continue
                    t=5 if (xx*7+yy*3)%5 else 4
                    if d>0.7: t=3
                else:
                    e=min(xx-1,yy-1,W-2-xx,Hh-2-yy)
                    if e<0: continue
                    t=1 if e==0 else (M['gold'][4] if e==1 else (2 if e==2 else ((4 if (xx//3+yy//3)%2 else 3) if shape=='runner' else (4 if (xx+yy)%4 else 5))))
                p.set(xx,yy,C[t] if isinstance(t,int) else t)
        return F(p.im,wc,hc,0,'flat')
    reg(nm,'decor')(mk)
for col in ('red','blue','green'):
    def mk(col=col):
        p=canvas(16,16); C=M[col]
        for xx in range(2,14): p.set(xx,1,M['brass'][4])
        for yy in range(2,15):
            for xx in range(4,12):
                if yy>11 and abs(xx-7.5)<(yy-11): continue
                p.set(xx,yy,C[5 if xx<6 else (4 if xx<10 else 3)])
        for yy in range(5,9): p.set(7,yy,M['gold'][5]); p.set(8,yy,M['gold'][3])
        p.set(6,6,M['gold'][4]); p.set(9,6,M['gold'][4])
        return F(p.im,1,0,0,'hang')
    reg(f'banner {col}','decor')(mk)
@ob('wall clock','decor')
def _():
    p=canvas(16,16)
    for yy in range(2,12):
        for xx in range(3,13):
            d=((xx-7.5)**2+(yy-6.5)**2)**0.5
            if d<5: p.set(xx,yy,WOOD[2] if d>4 else (M['linen'][6] if d<3.5 else WOOD[6]))
    p.set(7,6,M['black'][0]); p.set(7,4,M['black'][0]); p.set(7,5,M['black'][0]); p.set(8,6,M['black'][0]); p.set(9,6,M['black'][0])
    for yy in range(12,15): p.set(7,yy,M['brass'][4])
    p.set(6,14,M['brass'][5]); p.set(8,14,M['brass'][3])
    return F(p.im,1,0,0,'hang')
@ob('deer trophy','decor')
def _():
    p=canvas(16,16)
    lit(p,1,0,['1 1      1 1 ','1 1 1  1 1 1 ',' 111 11 111  ','   1    1    ','    1551     ','   155551    ','   1k55k1    ','    1551     ','    1441     ','   1wwww1    ','  1333331    ',' 144444441   '],'bread',{'k':M['black'][0],'w':M['linen'][6],'1':WOOD[3]})
    return F(p.im,1,0,0,'hang')
@ob('wall map','decor')
def _():
    p=canvas(16,16)
    for yy in range(2,13):
        for xx in range(1,15):
            c=M['linen'][5]
            if math.sin(xx*0.7+yy*0.4)+math.cos(yy*0.8)>0.7: c=M['green'][4]
            if (xx-8)**2+(yy-7)**2<5: c=M['blue'][4]
            if xx in (1,14) or yy in (2,12): c=M['linen'][3]
            p.set(xx,yy,c)
    p.set(10,5,M['red'][4]); p.set(11,5,M['red'][4])
    return F(p.im,1,0,0,'hang')
@ob('notice board','decor')
def _():
    p=canvas(16,16)
    for yy in range(1,14):
        for xx in range(1,15): p.set(xx,yy,WOOD[1] if xx in (1,14) or yy in (1,13) else ramp('#3a2410','#9a6a40','#e0b080')[3])
    for (x,y,w,h) in ((3,3,4,5),(8,2,5,4),(8,7,4,5),(3,9,4,3)):
        for yy in range(y,y+h):
            for xx in range(x,x+w): p.set(xx,yy,M['linen'][6] if yy==y else M['linen'][5])
        p.set(x+w//2,y,M['red'][4])
    return F(p.im,1,0,0,'hang')
@ob('curtained window','decor')
def _():
    im=p3.window(); p=canvas(16,16); p.im.alpha_composite(im)
    for yy in range(1,12):
        for xx in (1,2,3,12,13,14):
            w=3-int(yy/5)
            if (xx<=3 and xx<=w) or (xx>=12 and xx>=15-w): p.set(xx,yy,M['red'][5 if xx in (1,12) else 4 if xx in (2,13) else 3])
    for xx in range(0,16): p.set(xx,0,M['brass'][4])
    return F(p.im,1,0,0,'hang')
@ob('wall sconce','decor')
def _():
    p=canvas(16,16)
    for yy in range(0,12):
        for xx in range(2,14):
            if ((xx-7.5)**2+(yy-4)**2)<30 and (xx+yy)%2==0: p.set(xx,yy,(255,240,180,70))
    lit(p,6,1,[' ff ',' fo ',' 5o ',' 55 ','1yy1','1111',' 11 ','  1 ','  1 '],'linen',{'f':M['yellow'][6],'o':M['orange'][4],'y':M['brass'][5],'1':M['brass'][2]})
    for yy in range(0,10):
        for xx in range(2,14):
            d=((xx-7.5)**2+(yy-4)**2)**0.5
    return F(p.im,1,0,0,'hang')
@ob('throne','decor')
def _():
    p=canvas(16,32)
    lit(p,1,0,['    1yy1    ','   1yYYy1   ','  1pppppp1  ','  1p5555p1  ','  1p5445p1  ','  1p5445p1  ','  1p5445p1  ','  1p5445p1  ','  1p5445p1  ','  1p5555p1  ',' 1yyyyyyyy1 ','1yy555555yy1','1y54444445y1','1y55555555y1','1yyyyyyyyyy1','1y3333333 y1'[:12],'1y1111111 y1'[:12],'1y1      1y1'[:12],'111      111'],'red',{'y':M['gold'][4],'Y':M['gold'][6],'p':M['gold'][3]})
    return F(p.im,1,1,16,'floor')
@ob('royal chest','decor')
def _():
    im=p3.chest(); p=canvas(16,16); p.im.alpha_composite(im); px=p.im.load()
    for yy in range(16):
        for xx in range(16):
            c=px[xx,yy]
            if c[3] and c[:3] in [w[:3] for w in WOOD[3:8]]:
                i=[w[:3] for w in WOOD].index(c[:3]); p.set(xx,yy,M['red'][min(6,i-2)])
    return F(p.im,1,1,0,'floor')
@ob('tea table','home')
def _():
    p=canvas(16,16); fy=box(p,1,4,14,6,3,'white',panel=False); legs(p,1,fy+3,14,16-fy-3,'wood')
    for yy in range(5,9):
        for xx in range(2,14): p.set(xx,yy,M['linen'][6] if (xx+yy)%4 else M['pink'][5])
    put_good(p,'cup',3,4); put_good(p,'cup',9,5); lit(p,6,2,[' 11 ','1551','1441',' 11 '],'blue')
    return F(p.im,1,1,0,'floor')
@ob('mannequin','tailor')
def _():
    p=canvas(16,32)
    lit(p,3,2,['   1111   ','  155551  ','  155551  ','   1441   ','  1ppppp1 '[:10],' 1p555554p1'[:10],'1p5555554p'[:10],'1p5555544p'[:10],' 1p55544p1'[:10],'  1p5544p1'[:10],'  1p5544p1'[:10],' 1p555544p1'[:10],' 1p555544p '[:10],'1p5555554p1'[:10],'1p5555544p1'[:10],'1pp55544pp'[:10],' 11111111 '],'purple',{'p':M['purple'][2],'1':M['purple'][1],'5':M['purple'][5],'4':M['purple'][3]})
    for yy in range(0,6):
        for xx in range(6,10): pass
    lit(p,6,0,[' 11 ','1661','1551',' 11 '],'linen')
    for yy in range(19,30): p.set(7,yy,WOOD[5]); p.set(8,yy,WOOD[2])
    for xx in range(4,12): p.set(xx,30,WOOD[5]); p.set(xx,31,WOOD[1])
    return F(p.im,1,1,16,'floor')
@ob('spinning wheel','tailor')
def _():
    p=canvas(16,16)
    for a in range(0,360,8):
        x=int(9+5*math.cos(math.radians(a))); y=int(6+5*math.sin(math.radians(a))); p.set(x,y,WOOD[6] if a<180 else WOOD[3])
    for a in range(0,360,45):
        for r in range(5): p.set(int(9+r*math.cos(math.radians(a))),int(6+r*math.sin(math.radians(a))),WOOD[4])
    for xx in range(1,15): p.set(xx,12,WOOD[6]); p.set(xx,13,WOOD[2])
    for xx in (2,13):
        for yy in range(12,16): p.set(xx,yy,WOOD[3])
    put_good(p,'yarn',1,7); p.set(9,6,M['brass'][5])
    return F(p.im,1,1,0,'floor')
@ob('loom','tailor')
def _():
    p=canvas(32,24)
    for yy in range(0,24):
        for xx in (1,2,29,30): p.set(xx,yy,WOOD[[1,6,3,1][[1,2,29,30].index(xx)]])
    for yb in (1,14):
        for xx in range(1,31): p.set(xx,yb,WOOD[6]); p.set(xx,yb+1,WOOD[2])
    for yy in range(3,14):
        for xx in range(4,28):
            if yy<9: c=M['straw'][5] if xx%2 else M['straw'][3]
            else: c=M['red'][4] if (xx//2+yy)%3 else M['yellow'][5]
            p.set(xx,yy,c)
    box(p,3,16,26,3,5,'wood',panel=False)
    return F(p.im,2,1,8,'floor')
@ob('sewing table','tailor')
def _():
    p=canvas(32,16); fy=box(p,0,2,32,8,4,'wood',panel=False); legs(p,0,fy+4,32,16-fy-4)
    put_good(p,'boltr',3,3); put_good(p,'yarnb',12,3); put_good(p,'yarny',17,4)
    lit(p,23,3,['1111','1661','1551','1111'],'iron'); lit(p,24,2,['1  ','66 '],'white')
    for xx in range(9,16): p.set(xx,8,M['yellow'][5])
    return F(p.im,2,1,0,'floor')
@ob('fabric bolt rack','tailor')
def _():
    p=canvas(16,32); fy=box(p,0,0,16,3,29,'wood',panel=False)
    for r,cols in enumerate((('red','blue'),('green','purple'),('yellow','pink'),('teal','orange'))):
        for c,col in enumerate(cols):
            y0=5+r*6; x0=2+c*6
            for yy in range(y0,y0+5):
                for xx in range(x0,x0+6): p.set(xx,yy,M[col][5 if yy==y0 else (4 if yy<y0+3 else 2)] if xx not in (x0,x0+5) else M[col][1])
    return F(p.im,1,1,16,'wall')
@ob('tailor mirror','tailor')
def _():
    p=canvas(16,32)
    for yy in range(0,28):
        for xx in range(3,13):
            if xx in (3,12) or yy in (0,27): p.set(xx,yy,M['gold'][3])
            else: p.set(xx,yy,M['glass'][5] if (xx-yy)%7 else M['white'][6])
    for xx in range(2,14): p.set(xx,28,WOOD[5]); p.set(xx,29,WOOD[2]); p.set(xx,30,WOOD[0])
    return F(p.im,1,1,16,'floor')

# ---- the v2 kit pieces (p1..p5) join the catalogue ----
for face in 'SNEW': reg(f'chair {face}','home')(lambda face=face:kit.chair(face))
for wc,hc in ((1,1),(2,1),(3,1),(2,2)): reg(f'table {wc}x{hc}','home')(lambda wc=wc,hc=hc:kit.table(wc,hc))
reg('stool','home')(kit.stool)
for q in ('green','red','blue'):
    reg(f'bed {q}','home')(lambda q=q:F(p2.bed(16,q),1,2,6,'wall'))
    reg(f'double bed {q}','home')(lambda q=q:F(p2.bed(32,q),2,2,6,'wall'))
for wc in (1,2,3): reg(f'bookshelf {wc}w','study')(lambda wc=wc:kit.bookshelf(wc))
for n in ('cupboard','wardrobe','clock','chest','barrel','crate','sack','plant','pot','candle','fireplace','window','picture','shelf_pots','bottles','stove','stairs_down','doormat','roundtable','weapon_rack','shield'):
    reg(n.replace('_',' '),'home')(getattr(kit,n))
reg('rug red','decor')(kit.rug)
reg('counter 3','shop')(lambda:kit.counter(3)); reg('counter 2','shop')(lambda:kit.counter(2))
reg('stairs up stone','home')(lambda:kit.stairs_up(3)); reg('stairs up wood','home')(lambda:kit.stairs_up(3,'wood'))
reg('bench 2','home')(kit.bench); reg('bench 3','home')(lambda:kit.bench(3))
for g in ('potion','apple','bread'): reg(f'display {g}','shop')(lambda g=g:kit.display(g))

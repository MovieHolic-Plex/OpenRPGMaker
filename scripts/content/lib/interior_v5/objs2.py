# unique pieces, batch A: shop workstations (pharmacy, fishmonger, butcher, bakery, smithy, tavern)
from objs import *
def ob(name,cat):
    return reg(name,cat)
@ob('apothecary drawers','pharm')
def _():
    p=canvas(16,32); Rm=WOOD
    for yy in range(32):
        for xx in range(16):
            if yy<3: t=[1,7,3][yy] if 0<xx<15 else 1
            elif xx in (0,15) or yy==31: t=0
            elif xx==1: t=4
            elif xx==14 or yy==30: t=2
            else: t=5
            p.set(xx,yy,Rm[t])
    for r in range(6):
        for c in range(3):
            x0=2+c*4; y0=4+r*4
            for xx in range(x0,x0+4):
                p.set(xx,y0,WOOD[6]); p.set(xx,y0+3,WOOD[1])
            p.set(x0,y0+1,WOOD[6]); p.set(x0,y0+2,WOOD[6]); p.set(x0+3,y0+1,WOOD[2]); p.set(x0+3,y0+2,WOOD[2])
            p.set(x0+1,y0+1,M['linen'][5]); p.set(x0+2,y0+1,M['linen'][4]); p.set(x0+1,y0+2,M['brass'][5]); p.set(x0+2,y0+2,M['brass'][2])
    return F(p.im,1,1,16,'wall')
@ob('mortar and pestle','pharm')
def _():
    p=canvas(16,16)
    lit(p,4,6,['  1   6  ','  1  6   ',' 1126111 ','16555554 1'[:9],'154444431','143333321',' 1222221 ','  11111  '],'stone',{'6':M['wood'][6]})
    return F(p.im,1,1,0,'floor')
@ob('alembic','pharm')
def _():
    p=canvas(16,16)
    lit(p,1,1,['          11  ','         1  1 ','   1111 1   1 ','  155551     1','  1g55g1     1','  1gggg1    121','   1gg1     1g1','   1111     1g1','  1iiii1    111','  1ifi i1       '[:14],'  1iooo1       '[:14],'  111111       '[:14]],'glass',{'g':M['green'][4],'i':M['iron'][2],'f':M['orange'][5],'o':M['orange'][3]})
    for yy in range(12,16): p.set(3,yy,M['iron'][1]); p.set(8,yy,M['iron'][1])
    return F(p.im,1,1,0,'floor')
@ob('cauldron','pharm')
def _():
    p=canvas(16,16)
    ellipse_top(p,8,6,6,3,'iron',inner=ramp('#0a2a0a','#3aa030','#c0ff80'))
    cylinder(p,2,7,12,6,'iron')
    lit(p,4,4,[' 6 ',' 5  6'],'green')
    for xx,yy in ((3,13),(4,14),(12,13),(11,14)): p.set(xx,yy,M['iron'][0])
    for xx in range(5,11): p.set(xx,14,M['orange'][4] if xx%2 else M['yellow'][5]); p.set(xx,15,M['red'][3])
    return F(p.im,1,1,0,'floor')
@ob('herb drying rack','pharm')
def _():
    p=canvas(16,32)
    for yy in range(4,32):
        for xx in (1,14): p.set(xx,yy,WOOD[1]); p.set(xx+1 if xx==1 else xx-1,yy,WOOD[5])
    for yb in (4,14,24):
        for xx in range(1,15): p.set(xx,yb,WOOD[6]); p.set(xx,yb+1,WOOD[2])
    for yb in (6,16):
        for i,x0 in enumerate((3,7,11)):
            put_good(p,['herb','flower','mushroom'][(i+yb)%3],x0-1,yb+1)
    return F(p.im,1,1,16,'wall')
@ob('balance scale','pharm')
def _():
    p=canvas(16,16)
    lit(p,1,1,['       5      ','  66666566666 ','  4    5    4 ',' 4 4   5   4 4','4   4  5  4   4','5555   5   5555',' 333   5    333','      151      '[:14],'     15551    ','    1444441   ','    1111111   '],'brass')
    for yy in range(12,16):
        for xx in range(4,11): p.set(xx,yy,WOOD[[6,5,3,0][yy-12]] if 3<xx<11 else None)
    return F(p.im,1,1,0,'floor')
@ob('fish ice chest','fish')
def _():
    p=canvas(32,16); fy=box(p,0,3,32,8,5,'pine',panel=False)
    for yy in range(5,10):
        for xx in range(2,30): p.set(xx,yy,M['ice'][5] if (xx+yy)%3 else M['ice'][4])
    heap(p,3,3,26,6,['fish','fishr','fishg'],5)
    for xx in range(2,30,5): p.set(xx,13,M['pine'][2])
    return F(p.im,2,1,0,'floor')
@ob('fish tank','fish')
def _():
    p=canvas(32,24)
    for yy in range(24):
        for xx in range(32):
            if yy<3: t=M['wood'][[1,6,3][yy]]
            elif xx in (0,31) or yy==23: t=M['wood'][0]
            elif xx in (1,30) or yy==22: t=M['wood'][4]
            elif yy<6: t=M['glass'][5] if xx%7 else M['glass'][6]
            else:
                t=M['water'][4 if yy<12 else 3]
                if (xx-yy)%11==0 and yy<14: t=M['water'][5]
                if yy>18: t=M['straw'][3] if (xx*7+yy)%5 else M['straw'][2]
            p.set(xx,yy,t)
    put_good(p,'fishr',6,9); put_good(p,'fish',17,13,True); put_good(p,'fishg',21,8)
    for xx,yy in ((10,16),(10,17),(11,15),(24,17),(25,16),(25,18)): p.set(xx,yy,M['green'][4])
    return F(p.im,2,1,8,'wall')
@ob('fishing net','fish')
def _():
    p=canvas(16,16)
    for yy in range(1,15):
        for xx in range(1,15):
            if (xx+yy)%4==0 or (xx-yy)%4==0: p.set(xx,yy,M['straw'][3] if yy<8 else M['straw'][2])
    for xx in range(0,16): p.set(xx,1,WOOD[6]); p.set(xx,2,WOOD[2])
    for xx,yy in ((4,12),(10,10)): p.set(xx,yy,M['orange'][5]); p.set(xx+1,yy,M['orange'][3])
    return F(p.im,1,0,0,'hang')
@ob('chopping block','butcher')
def _():
    p=canvas(16,16)
    for yy in range(3,10):
        for xx in range(1,15):
            d=((xx-7.5)/6.5)**2+((yy-6)/3.2)**2
            if d>1: continue
            r=((xx-7.5)**2/4+(yy-6)**2)**0.5
            c=WOOD[6] if int(r)%2==0 else WOOD[5]
            if d>0.8: c=WOOD[7] if yy<6 else WOOD[3]
            p.set(xx,yy,c)
    cylinder(p,2,8,12,7,'wood')
    for yy in range(9,15): 
        for xx in range(3,13):
            if (xx*3+yy)%7==0: p.set(xx,yy,WOOD[2])
    lit(p,8,1,['6666 ','55551','  12 ','  12 '],'iron',{'1':WOOD[1],'2':WOOD[4]})
    return F(p.im,1,1,0,'floor')
@ob('meat hooks','butcher')
def _():
    p=canvas(32,32)
    for xx in range(32): p.set(xx,3,WOOD[6]); p.set(xx,4,WOOD[2])
    for yy in range(3,32): 
        for xx in (1,30): p.set(xx,yy,WOOD[1]); p.set(xx+(1 if xx==1 else -1),yy,WOOD[5])
    for i,(g,x0) in enumerate((('ham',5),('sausage',11),('ham',18),('ham',24))):
        p.set(x0+2,5,M['iron'][4]); p.set(x0+2,6,M['iron'][3]); put_good(p,g,x0,7+(i%2))
    for xx in range(1,31): p.set(xx,30,WOOD[3]); p.set(xx,31,WOOD[0])
    return F(p.im,2,1,16,'wall')
@ob('bread oven','bake')
def _():
    p=canvas(32,32); B=ramp('#2a1008','#8a4a30','#e8a878')
    for yy in range(32):
        for xx in range(32):
            cx=15.5; dx=abs(xx-cx)
            dome=4+int((dx/16)**2*10)
            if yy<dome: continue
            ly=(yy-dome)%4; lx=(xx+(3 if ((yy-dome)//4)%2 else 0))%6
            t=5 if ly==0 else 4
            if ly==3 or lx==5: t=2
            if xx in (0,31) or yy==dome: t=1
            if yy>=29: t=1 if yy==31 else 3
            p.set(xx,yy,B[t])
    for yy in range(15,27):
        for xx in range(9,23):
            d=((xx-15.5)/7)**2+((yy-20)/6)**2
            if yy>=20 or d<1:
                c=M['black'][0] if yy<24 else M['orange'][4 if (xx+yy)%2 else 5]
                if yy in (24,25) and 11<xx<20: c=M['yellow'][5]
                p.set(xx,yy,c)
    for xx in range(9,23): p.set(xx,27,M['stone'][5]); p.set(xx,28,M['stone'][2])
    put_good(p,'loaf',13,21)
    return F(p.im,2,1,16,'wall')
@ob('dough table','bake')
def _():
    p=canvas(32,16); fy=box(p,0,2,32,8,4,'pine',panel=False); legs(p,0,fy+4,32,16-fy-4,'pine')
    for yy in range(4,9):
        for xx in range(4,28): 
            if H(xx,yy,9)<0.5: p.set(xx,yy,M['linen'][6])
    lit(p,6,4,[' 555 ','56665','45554',' 333 '],'linen'); lit(p,15,5,['16666661','23333332'],'pine')
    lit(p,24,3,[' 4 ','565','444'],'white')
    return F(p.im,2,1,0,'floor')
@ob('cake display case','bake')
def _():
    p=canvas(32,24); fy=box(p,0,2,32,10,12,'wood',panel=True)
    for yy in range(3,11):
        for xx in range(1,31): p.set(xx,yy,M['glass'][5] if (xx-yy)%9 else M['glass'][6])
    for i,g in enumerate(('cake','pie','cake','bun')): put_good(p,g,3+i*7,5)
    for yy in range(4,11,3):
        for xx in range(1,31): 
            if (xx-yy)%9==0: p.set(xx,yy,M['white'][6])
    panels(p,2,fy+2,28,8,'wood',cols=2)
    return F(p.im,2,1,8,'floor')
@ob('anvil','smith')
def _():
    p=canvas(16,16)
    lit(p,1,4,['  11111111111 ','1666666666661 ',' 1445555554 1 '[:14],'   1444441    ','    13331     ','    12221     ','   1122211    ','  111111111   ','  122222221   ','  111111111   '],'iron')
    return F(p.im,1,1,0,'floor')
@ob('forge','smith')
def _():
    p=canvas(32,32); S=M['stone']
    for yy in range(32):
        for xx in range(32):
            if yy<14 and not (6<=xx<=25): continue
            if yy<14:   # hood
                t=4 if xx in (7,) else (2 if xx==25 else 3)
                if yy%4==0: t=2
                if xx in (6,25): t=1
                p.set(xx,yy,S[t]); continue
            ly=(yy-14)%4; lx=(xx+(2 if ((yy-14)//4)%2 else 0))%5
            t=4 if ly==0 else 3
            if ly==3 or lx==4: t=1
            if xx in (0,31): t=0
            p.set(xx,yy,S[t])
    for yy in range(18,25):
        for xx in range(4,28): p.set(xx,yy,M['black'][0] if yy<20 else M['orange'][[3,4,5][(xx*3+yy)%3]] if yy<23 else M['red'][3])
    for xx in range(9,23):
        for yy in (19,20): 
            if H(xx,yy,4)<0.5: p.set(xx,yy,M['yellow'][6])
    for xx in range(2,30): p.set(xx,25,S[6]); p.set(xx,26,S[2])
    return F(p.im,2,1,16,'wall')
@ob('grindstone','smith')
def _():
    p=canvas(16,16)
    for yy in range(0,12):
        for xx in range(3,13):
            d=((xx-7.5)/5)**2+((yy-5.5)/5.5)**2
            if d<1: p.set(xx,yy,M['stone'][5 if (xx<8 and yy<6) else (3 if d<0.3 else 4)] if d<0.85 else M['stone'][1])
    p.set(7,5,M['iron'][1]); p.set(8,5,M['iron'][1])
    box(p,1,9,14,3,4,'wood',panel=False)
    legs(p,1,15,14,1)
    lit(p,12,3,['111','1 1','  1'],'wood')
    return F(p.im,1,1,0,'floor')
@ob('quench barrel','smith')
def _():
    p=canvas(16,16); cylinder(p,2,7,12,9,'wood',bands=(2,6)); ellipse_top(p,8,6,6,3,'wood',inner='water')
    p.set(6,5,M['white'][6]); p.set(9,6,M['water'][6])
    return F(p.im,1,1,0,'floor')
@ob('armor stand','smith')
def _():
    p=canvas(16,32)
    lit(p,3,2,['   1111   ','  155551  ','  154451  ','  1k55k1  ','   1441   ','1115665111','1566666651','1456666541','1455665541',' 14566541 ',' 14555541 ',' 13444431 ','  144441  ','  1yyyy1  ','  134431  ','  13  31  ','  13  31  ','  12  21  '],'iron',{'k':M['black'][0],'y':M['gold'][4]})
    for xx in range(4,12): p.set(xx,29,WOOD[6]); p.set(xx,30,WOOD[3]); p.set(xx,31,WOOD[0])
    for yy in range(20,29): p.set(7,yy,WOOD[5]); p.set(8,yy,WOOD[2])
    return F(p.im,1,1,16,'floor')
@ob('weapon barrel','smith')
def _():
    p=canvas(16,16); cylinder(p,2,8,12,8,'wood',bands=(2,5)); ellipse_top(p,8,7,6,3,'wood',inner='black')
    for x0,top,m in ((4,0,'iron'),(7,1,'iron'),(10,0,'iron'),(6,3,'wood'),(11,2,'wood')):
        for yy in range(top,8): p.set(x0,yy,M[m][5]); p.set(x0+1,yy,M[m][3])
        p.set(x0,top,M[m][6])
    for x0 in (4,7,10): p.set(x0-1,5,M['gold'][4]); p.set(x0+2,5,M['gold'][3])
    return F(p.im,1,1,0,'floor')
@ob('tool wall','smith')
def _():
    p=canvas(16,16); 
    for xx in range(16): p.set(xx,2,WOOD[6]); p.set(xx,3,WOOD[2])
    put_good(p,'hammer',1,5); put_good(p,'horseshoe',9,5); put_good(p,'dagger',2,11); 
    lit(p,10,10,['1   1',' 1 1 ','  1  ',' 1 1 ','1   1'],'iron')
    return F(p.im,1,0,0,'hang')
@ob('keg rack','tavern')
def _():
    # kegs lying on a cradle, round ends toward the viewer: rings, iron hoop, brass tap
    p=canvas(32,24)
    for yy in range(19,24):
        for xx in range(32): p.set(xx,yy,WOOD[[6,4,3,2,0][yy-19]] if xx not in (0,31) else WOOD[0])
    for (cx,cy) in ((6,14),(16,14),(26,14),(11,6),(21,6)):
        for yy in range(cy-5,cy+6):
            for xx in range(cx-5,cx+6):
                d=((xx-cx)**2+(yy-cy)**2)**0.5
                if d>5.3: continue
                if d>4.5: c=M['iron'][2 if (xx-cx)+(yy-cy)>0 else 4]
                elif d>3.6: c=WOOD[6 if (xx-cx)+(yy-cy)<0 else 3]
                else: c=WOOD[5] if int(d*1.3)%2==0 else WOOD[4]
                p.set(xx,yy,c)
        p.set(cx,cy+2,M['brass'][5]); p.set(cx,cy+3,M['brass'][3]); p.set(cx+1,cy+2,M['brass'][2])
    return F(p.im,2,1,8,'wall')
@ob('dart board','tavern')
def _():
    p=canvas(16,16)
    for yy in range(1,15):
        for xx in range(1,15):
            d=((xx-7.5)**2+(yy-7.5)**2)**0.5
            if d>6.8: continue
            c=M['black'][1] if d>6 else (M['red'][4] if int(d)%3==0 else (M['linen'][5] if (xx+yy)%2 else M['black'][2]))
            if d<1.2: c=M['green'][4]
            p.set(xx,yy,c)
    p.set(9,5,M['yellow'][6]); p.set(10,4,M['red'][5])
    return F(p.im,1,0,0,'hang')
@ob('piano','tavern')
def _():
    p=canvas(32,24); fy=box(p,0,0,32,6,12,'dwood',panel=True)
    for xx in range(2,30):
        p.set(xx,6,M['white'][6] if xx%3 else M['white'][3]); p.set(xx,7,M['white'][5] if xx%3 else M['white'][3])
        if xx%3==1 and xx%9!=1: p.set(xx,6,M['black'][0])
    panels(p,3,fy+4,26,6,'dwood',cols=2,knobs=False)
    lit(p,12,1,['1666666661','1555555551'],'linen')
    legs(p,0,18,32,6,'dwood')
    return F(p.im,2,1,8,'wall')
@ob('lute','tavern')
def _():
    p=canvas(16,16)
    lit(p,4,1,['     12 ','    121 ','    14  ','   14   ','  144   ',' 16541  ','1655541 ','1553441 ','1545341 ',' 144431 ','  1111  '],'wood',{'3':M['black'][1]})
    return F(p.im,1,0,0,'hang')
@ob('bar stool','tavern')
def _():
    p=canvas(16,16); ellipse_top(p,8,4,4,2,'red'); 
    for yy in range(7,15): p.set(7,yy,M['iron'][5]); p.set(8,yy,M['iron'][3])
    for xx in range(4,12): p.set(xx,11,M['iron'][4])
    for xx in range(5,11): p.set(xx,15,M['iron'][1])
    return F(p.im,1,1,0,'floor')

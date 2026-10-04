# v5 props, part 3: Final Fantasy VI flavoured pieces — magitek/steam machinery, opera house, casino, chocobo stable.
import sys, math; sys.path.insert(0,'/tmp/j8v5')
from props5 import *
import props5
NEW6=[]
def new6(name,cat,anim=False):
    def d(fn): reg(name,cat,fn,anim); NEW6.append(name); return fn
    return d
STL=kit5.COL['steel']; CU=kit5.CU
# ---------------- magitek ----------------
def gear(p,cx,cy,r,teeth,ang,R):
    for y in range(int(cy-r-2),int(cy+r+3)):
        for x in range(int(cx-r-2),int(cx+r+3)):
            d=math.hypot(x-cx,y-cy); a=math.atan2(y-cy,x-cx)-ang
            tooth=math.cos(a*teeth)>0.3
            if d<=r or (d<=r+2 and tooth):
                t=5 if (x-cx)+(y-cy)<0 else 3
                if d<r*0.35: t=1 if d>r*0.2 else 6
                elif abs(d-r*0.62)<0.6: t=2
                p.set(x,y,R[t])
def gear_wall():
    def base():
        p=Pix(32,30)
        for y in range(30):
            for x in range(32): p.set(x,y,STL[1] if (x in (0,31) or y in (0,29)) else STL[2])
        return F(p.im,2,0,0,'hang')
    def paint(p,t):
        a=TAU*t/N
        gear(p,10,11,7,8,a/8,CU)                       # 8 teeth: one tooth pitch per loop -> seamless
        gear(p,23,19,6,6,-a/6+0.3,STL)
        gear(p,22,6,3,6,-a/6,CU)
    f=framed(base,paint); f.tall=True; return f
reg('gear wall','magitek',gear_wall,True); NEW6.append('gear wall')
def gauge_panel():
    def base():
        p=Pix(16,16)
        for y in range(1,15):
            for x in range(1,15): p.set(x,y,STL[1] if x in (1,14) or y in (1,14) else STL[3])
        for cx,cy in ((5,6),(11,6)):
            for y in range(cy-3,cy+4):
                for x in range(cx-3,cx+4):
                    d=math.hypot(x-cx,y-cy)
                    if d<=3.2: p.set(x,y,BRS[4] if d>2.4 else MT.M['white'][6])
        for x in range(3,13): p.set(x,11,MT.M['red'][4] if x%3 else STL[1]); p.set(x,12,STL[1])
        return F(p.im,1,0,0,'hang')
    def paint(p,t):
        for i,(cx,cy) in enumerate(((5,6),(11,6))):
            a=-math.pi/2+0.9*osc(t,1+i,i)
            for s in (1,2): p.set(int(round(cx+s*math.cos(a))),int(round(cy+s*math.sin(a))),MT.M['red'][3])
        k=t%4; p.set(4+k*2,11,MT.M['green'][6])
    return framed(base,paint)
reg('gauge panel','magitek',gauge_panel,True); NEW6.append('gauge panel')
def steam_vent():
    def base():
        p=Pix(16,24)
        for y in range(14,24):
            for x in range(2,14):
                t=3 if (x+y)%2 else 2
                if x in (2,13) or y in (14,23): t=1
                p.set(x,y,STL[t])
        return F(p.im,1,1,8,'floor')
    def paint(p,t):
        for k in range(3):
            s=(t+k*4)%12
            y=15-s; x=5+k*3+int(round(osc(t,1,k)))
            if s<11:
                c=(232,236,240,255) if s<5 else (200,206,214,255)
                for dx,dy in ((0,0),(1,0),(0,-1)):
                    if 0<=y+dy: p.set(x+dx,y+dy,c)
    return framed(base,paint)
reg('steam vent','magitek',steam_vent,True); NEW6.append('steam vent')
def magitek_engine():
    # 3x2 engine block: riveted boiler drum, two pistons pumping out of phase, a glowing magitek core window
    W,Hh=48,48
    def base():
        p=Pix(W,Hh)
        for y in range(16,Hh):
            for x in range(W):
                t=3 if x>3 else 5
                if x in (0,W-1) or y==Hh-1: t=0
                if y==16: t=6
                if y in (17,): t=5
                if (x%12 in (1,10)) and y%6==3: t=6
                if x>W-4: t=2
                p.set(x,y,STL[t])
        for y in range(24,40):
            for x in range(16,32):
                d=math.hypot(x-23.5,y-31.5)
                if d<=8: p.set(x,y,BRS[5] if d>7 else MT.M['purple'][2])
        return F(p.im,3,2,16,'floor')
    def paint(p,t):
        a=TAU*t/N
        for y in range(24,40):
            for x in range(16,32):
                d=math.hypot(x-23.5,y-31.5)
                if d<=6.5:
                    v=math.sin(d*0.9-a)
                    p.set(x,y,MT.M['purple'][6] if v>0.7 else (MT.M['pink'][5] if v>0.2 else MT.M['purple'][4]))
        for i,px0 in enumerate((4,36)):
            h=int(round(6+5*math.sin(a+i*math.pi)))
            for y in range(16-h-2,17):
                for x in range(px0,px0+8):
                    t2=5 if x==px0+1 else (2 if x==px0+7 else 4)
                    p.set(x,y,STL[t2])
            for x in range(px0-1,px0+9): p.set(x,16-h-3,STL[6]); p.set(x,16-h-2,STL[1])
    f=framed(base,paint); return f
reg('magitek engine','magitek',magitek_engine,True); NEW6.append('magitek engine')
def control_console():
    def base():
        p=Pix(32,24)
        fy=kit5.kit4 and None
        for y in range(6,24):
            for x in range(32):
                t=3
                if y<12: t=4 if y>6 else 6
                if x in (0,31) or y==23: t=0
                if y==12: t=6
                p.set(x,y,STL[t])
        for i,x in enumerate((5,11,17,23)):
            for y in range(1,8): p.set(x,y,STL[5] if y>2 else MT.M['red'][5])
        return F(p.im,2,1,8,'wall')
    def paint(p,t):
        for i in range(8):
            on=((t+i*5)%6)<3
            p.set(3+i*3,9,MT.M['green'][6] if on else MT.M['green'][2]); p.set(4+i*3,9,MT.M['yellow'][6] if not on else STL[2])
    return framed(base,paint)
reg('control console','magitek',control_console,True); NEW6.append('control console')
@new6('magitek armor','magitek')
def _():
    # FF6 walker: rounded cockpit on two backward-jointed legs, parked (static)
    p=Pix(32,48); A=R8('#10141a','#5a6a78','#d0dce8'); Gl=MT.M['teal']
    for y in range(2,26):
        for x in range(3,29):
            if ell(15.5,14,12.5,11,x,y)>1: continue
            d=ell(15.5,14,12.5,11,x,y)
            t=6 if (x<12 and y<10) else (5 if d<0.6 else 3)
            if d>0.88: t=1
            p.set(x,y,A[t])
    for y in range(8,14):
        for x in range(10,22): p.set(x,y,Gl[5] if y<10 else Gl[3])
    for lx in (6,22):
        for y in range(24,46):
            dx=int(2*math.sin((y-24)/22*math.pi))
            for x in range(lx+dx,lx+dx+4): p.set(x,y,A[5] if x==lx+dx else (A[2] if x==lx+dx+3 else A[4]))
        for x in range(lx-2,lx+7): p.set(x,46,A[4]); p.set(x,47,A[0])
    return F(p.im,2,2,16,'floor')
# ---------------- opera house ----------------
VEL=R8('#1e0408','#8a1424','#f08090')
@new6('theater seat','opera')
def _():
    # seen from behind (audience faces the stage to the north): velvet back, gold edge, armrests
    p=Pix(16,16)
    for y in range(2,15):
        for x in range(2,14):
            t=5 if x<6 else (4 if x<11 else 3)
            if y==2: t=6
            if x in (2,13) or y==14: t=1
            p.set(x,y,VEL[t])
    for x in range(2,14): p.set(x,10,MT.M['gold'][4] if x%2 else MT.M['gold'][2])
    for y in range(8,15): p.set(1,y,WOOD[5]); p.set(14,y,WOOD[2])
    return F(p.im,1,1,0,'floor')
@new6('stage curtain','opera')
def _():
    # red velvet drape hanging in both wall-face rows (folds every 4 px, gold tie-back)
    p=Pix(16,30)
    for y in range(0,30):
        for x in range(0,16):
            t=[6,5,4,3][x%4]
            if y<3: t=6 if y==1 else 2
            p.set(x,y,VEL[t])
    for x in range(0,16): p.set(x,0,MT.M['gold'][5]); p.set(x,29,VEL[1])
    f=F(p.im,1,0,0,'hang'); f.tall=True; return f
@new6('curtain wing','opera')
def _():
    # a drawn-back curtain standing on the stage floor at the proscenium side (floor, tall)
    p=Pix(16,40)
    for y in range(0,40):
        w=16 if y<6 else max(6,16-int((y-6)*0.35))
        for x in range(0,w):
            t=[6,5,4,3][x%4]
            if x==w-1: t=1
            if y>=38: t=1
            p.set(x,y,VEL[t])
    for x in range(4,10): p.set(x,20,MT.M['gold'][5]); p.set(x,21,MT.M['gold'][2])
    return F(p.im,1,1,24,'floor')
def footlights():
    def base():
        p=Pix(16,16)
        for x in range(16): p.set(x,11,BRS[5]); p.set(x,12,BRS[2]); p.set(x,13,WOOD[1])
        for cx in (4,12):
            for y in range(7,11):
                for x in range(cx-2,cx+2): p.set(x,y,BRS[4] if y==10 else MT.M['yellow'][5])
        return F(p.im,1,1,0,'flat')
    def paint(p,t):
        for i,cx in enumerate((4,12)):
            v=osc(t,1,i*2.4)
            for y in range(7,10):
                for x in range(cx-2,cx+2): p.set(x,y,MT.M['yellow'][6] if v>0 else MT.M['yellow'][5])
    return framed(base,paint)
reg('footlights','opera',footlights,True); NEW6.append('footlights')
@new6('music stand','opera')
def _():
    p=Pix(16,24)
    for y in range(10,22): p.set(7,y,MT.M['black'][3]); p.set(8,y,MT.M['black'][1])
    for x in range(4,12): p.set(x,22,MT.M['black'][2])
    MT.lit(p,2,2,['111111111111','166666666661','156565656561','155555555551','111111111111'],'linen',{'1':MT.M['black'][1]})
    return F(p.im,1,1,8,'floor')
@new6('scenery flat','opera')
def _():
    # painted backdrop of a castle on a hill standing at the back of the stage (3 wide, wall kind)
    p=Pix(48,32); SK=R8('#0a1030','#3a5aa0','#c0d8ff')
    for y in range(0,30):
        for x in range(48):
            c=SK[5] if y<12 else SK[4]
            if y>18+int(3*math.sin(x*0.13)): c=tiles5.LEAF[2] if y<26 else tiles5.LEAF[1]
            if 18<=x<=30 and 8<=y<=19:
                c=STN[5] if x<24 else STN[4]
                if (x in (18,22,26,30) and y<10): c=SK[5]
                if 23<=x<=25 and y>=15: c=STN[1]
            p.set(x,y,c)
    for x in range(48): p.set(x,30,WOOD[5]); p.set(x,31,WOOD[1])
    for y in range(32): p.set(0,y,WOOD[5]); p.set(47,y,WOOD[1])
    return F(p.im,3,1,16,'wall')
@new6('conductor podium','opera')
def _():
    p=Pix(16,16)
    fy=box(p,2,5,12,4,6,'dwood',panel=False)
    MT.lit(p,5,0,['   5 ','  54 ',' 1111','11111'],'linen')
    return F(p.im,1,1,0,'floor')
# ---------------- casino ----------------
kit4.RAMPS['felt']=R8('#021a0c','#1a6a3a','#9ae0a8')
kit4.STY['felt']=dict(ko='카드 탁자(초록 펠트)',ramp='dwood',top='felt',up=0,ty0=1,after=6,front='table')
kit4.PIECES['felt']=kit4.pieces('felt')
for Wc,Hc in ((1,1),(2,1),(3,1),(2,2),(3,2)): OBJ[f'felt {Wc}x{Hc}']=('casino',lambda Wc=Wc,Hc=Hc:kit4.assemble('felt',Wc,Hc))
def roulette():
    W,Hh=32,32
    def base():
        f=kit4.assemble('felt',2,2); p=Pix(W,Hh); p.im.alpha_composite(f.im)
        for y in range(4,20):
            for x in range(8,26):
                d=ell(16.5,11.5,7.5,6.5,x,y)
                if d<=1: p.set(x,y,WOOD[1] if d>0.85 else WOOD[5])
        return F(p.im,2,2,0,'floor')
    def paint(p,t):
        a0=TAU*t/N/6                           # one red/black pair per loop
        for y in range(4,20):
            for x in range(8,26):
                d=ell(16.5,11.5,6.2,5.3,x,y)
                if d>1: continue
                if d<0.15: p.set(x,y,MT.M['gold'][5]); continue
                a=math.atan2((y-11.5)/5.3,(x-16.5)/6.2)-a0
                k=int((a%TAU)/TAU*12)                  # 12 pockets: one pocket per frame -> seamless
                if d>0.45: p.set(x,y,MT.M['red'][4] if k%2 else MT.M['black'][1])
                else: p.set(x,y,WOOD[4])
        a=-TAU*2*t/N
        bx=int(round(16.5+6.9*math.cos(a))); by=int(round(11.5+5.9*math.sin(a)))
        p.set(bx,by,MT.M['white'][6])
    f=framed(base,paint); f.surf=(2,20,29,25); return f
reg('roulette table','casino',roulette,True); NEW6.append('roulette table')
def slot_machine():
    def base():
        p=Pix(16,32); Gd=MT.M['gold']
        for y in range(2,32):
            for x in range(2,14):
                t=4
                if y<6: t=6
                if x in (2,13): t=1
                if y>=29: t=1
                p.set(x,y,VEL[t] if 8<=y<=26 else Gd[t if t<7 else 6])
        for y in range(11,18):
            for x in range(4,12): p.set(x,y,MT.M['white'][6] if x not in (6,9) else MT.M['black'][2])
        for y in range(9,20): p.set(14,y,MT.M['black'][2])
        p.set(14,8,MT.M['red'][5]); p.set(15,8,MT.M['red'][4])
        return F(p.im,1,1,16,'wall')
    SYM=[MT.M['red'][4],MT.M['yellow'][5],MT.M['blue'][4],MT.M['green'][4]]
    def paint(p,t):
        for i,x0 in enumerate((4,7,10)):
            for y in range(12,17):
                s=((y+t*(i+1))//3)%4                   # reels scroll 1-3 px/frame; 12 frames x speed = multiple of 12
                p.set(x0,y,SYM[s]); p.set(x0+1,y,SYM[s])
        for k in range(6):
            on=(t+k)%2==0
            p.set(3+k*2,4,MT.M['yellow'][6] if on else MT.M['orange'][4])
    return framed(base,paint)
reg('slot machine','casino',slot_machine,True); NEW6.append('slot machine')
@good('chips',8,5)
def g_chips(p,x,y):
    for i,(cx,col) in enumerate(((1,'red'),(4,'blue'),(6,'green'))):
        for k in range(3-(i%2)):
            MT.lit(p,x+cx-1,y+3-k,['122'],col)
    p.set(x+2,y,MT.M['white'][6])
@good('cardfan',7,3)
def g_cardfan(p,x,y): MT.lit(p,x,y,[' 6r6r6 ','6666666','3333333'],'white',{'r':MT.M['red'][4]})
# ---------------- chocobo stable ----------------
def chocobo():
    Y=R8('#3a2a00','#d8a818','#fff4a0'); B=MT.M['orange']
    def draw(t):
        p=Pix(16,32); bob=1 if t%6>=3 else 0
        for y in range(8,30):
            for x in range(0,16):
                d=ell(7,20+bob,6.5,6,x,y)                    # round fluffy body
                if d<=1:
                    t2=6 if (x<6 and y<19+bob) else (5 if d<0.55 else 4)
                    if d>0.82: t2=2
                    p.set(x,y,Y[t2])
                d2=ell(10,11+bob,3,5,x,y)                    # thick neck
                if d2<=1 and y<18+bob: p.set(x,y,Y[5] if x<10 else Y[4])
        for y in range(2,10):
            for x in range(6,16):
                d=ell(10.5,6+bob,4,3.5,x,y)                  # head
                if d<=1: p.set(x,y,Y[6] if (x<10 and y<6+bob) else (Y[5] if d<0.7 else Y[3]))
        for x in range(13,16): p.set(x,7+bob,B[5]); p.set(x,8+bob,B[3])     # beak
        p.set(11,5+bob,MT.M['black'][0] if t not in (7,8) else Y[4])
        for i,(x,y) in enumerate(((8,2),(9,1),(10,2))): p.set(x,y+bob,Y[6])  # crest
        for x,y in ((1,19),(0,20),(1,21),(0,22)): p.set(x,y+bob,Y[5])        # tail tuft
        for lx in (4,9):
            for y in range(26+bob,30): p.set(lx,y,B[4]); p.set(lx+1,y,B[2])
            for x in range(lx-1,lx+3): p.set(x,30,B[3]); p.set(x,31,B[1])
        q=p.im.copy(); pq=q.load()
        for y in range(32):
            for x in range(16):
                if pq[x,y][3]==0 and any(0<=x+dx<16 and 0<=y+dy<32 and p.im.getpixel((x+dx,y+dy))[3] and p.im.getpixel((x+dx,y+dy))[:3] in [c[:3] for c in Y] for dx,dy in ((1,0),(-1,0),(0,1),(0,-1))):
                    pq[x,y]=Y[1] if y<14 else Y[0]
        return q
    fr=[draw(t) for t in range(N)]
    f=F(fr[0],1,1,16,'floor'); f.frames=fr; f.ms=MS
    f.paint=(lambda:F(Image.new('RGBA',(16,32)),1,1,16,'floor'),lambda p,t:p.im.alpha_composite(draw(t)))
    return f
reg('chocobo','stable',chocobo,True); NEW6.append('chocobo')
@new6('hay bale','stable')
def _():
    p=Pix(16,16)
    for y in range(3,15):
        for x in range(1,15):
            t=4 if y<7 else 3
            if y==3: t=5
            if x in (1,14) or y==14: t=1
            if y>=7 and (x*3+y)%5==0: t=2
            p.set(x,y,tiles5.STRAW[t])
    for y in range(3,15): p.set(5,y,WOOD[2]); p.set(10,y,WOOD[2])
    return F(p.im,1,1,0,'floor')
@new6('feed trough','stable')
def _():
    p=Pix(32,16)
    fy=box(p,0,4,32,6,5,'wood',panel=False)
    for y in range(5,9):
        for x in range(2,30): p.set(x,y,tiles5.LEAF[3] if (x+y)%3 else tiles5.LEAF[2])
    for x in (4,11,19,26): p.set(x,5,MT.M['yellow'][5])                    # gysahl greens
    return F(p.im,2,1,0,'floor')
@new6('water trough','stable')
def _():
    p=Pix(32,16)
    fy=box(p,0,4,32,6,5,'dwood',panel=False)
    for y in range(5,9):
        for x in range(2,30): p.set(x,y,MT.M['water'][4] if (x-y)%9 else MT.M['water'][6])
    return F(p.im,2,1,0,'floor')
@new6('saddle rack','stable')
def _():
    p=Pix(16,24)
    for y in range(8,24): p.set(3,y,WOOD[5]); p.set(12,y,WOOD[2])
    for x in range(2,14): p.set(x,10,WOOD[6])
    MT.lit(p,2,2,['  111111  ','1155555511','1444444441','1r444444r1',' 1333333 1','  1    1  '],'wood',{'r':MT.M['red'][4]})
    return F(p.im,1,1,8,'floor')
@new6('pitchfork','stable')
def _():
    p=Pix(16,16); IR=MT.M['iron']
    for y in range(4,16): p.set(9,y,WOOD[6])
    for x in (7,9,11):
        for y in range(1,4): p.set(x,y,IR[5])
    for x in range(7,12): p.set(x,4,IR[3])
    return F(p.im,1,0,0,'hang')

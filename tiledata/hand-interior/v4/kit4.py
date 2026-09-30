# v4 kit: (1) autotile surfaces — tables, desks, display tables, counters, kitchen worktops, sideboards — as 16-piece
# neighbour-mask sets that assemble to any W x H with a surface rect; (2) new pieces: firewood racks, kitchen range,
# proofing rack, stairwell down, broom+bucket, towel rail, big chapel window, desk globe and other tabletop goods.
import sys; sys.path.insert(0,'/tmp/j8v4')
from surf import *            # OBJ, F, kit, prim, mat (M, G, ramp, good), WOOD, H, Pix
import mat as MT
from PIL import Image
def R8(d,m,l): return MT.ramp(d,m,l,n=8)
RAMPS={'wood':WOOD[:8],'pine':R8('#140a02','#a07448','#f4d8a0'),'dwood':R8('#0a0503','#5a341a','#b08050'),
       'stone':R8('#1a1c22','#8c8a90','#e8e6ea'),'linen':R8('#2a2420','#c8bca8','#fffaf0'),'red':R8('#240406','#b02024','#ffb0a0'),
       'green':R8('#061a0a','#2e7a3a','#c0f0b0')}
# style: ramp (frame/front), top ramp, up (px above the top cell), rows after the top face, front kind, legs, drawers
STY={
 'dining':  dict(ko='식탁',ramp='wood',top='wood',up=0,ty0=1,after=6,front='table'),
 'work':    dict(ko='작업대',ramp='pine',top='pine',up=0,ty0=1,after=6,front='table'),
 'desk':    dict(ko='책상',ramp='dwood',top='dwood',up=0,ty0=1,after=6,front='desk'),
 'display': dict(ko='진열 탁자(천)',ramp='wood',top='linen',up=0,ty0=1,after=6,front='cloth'),
 'counter': dict(ko='카운터',ramp='wood',top='wood',up=8,ty0=0,after=17,front='panel'),
 'kcounter':dict(ko='부엌 조리대',ramp='pine',top='stone',up=8,ty0=0,after=17,front='doors'),
 'sideboard':dict(ko='찬장(낮은)',ramp='dwood',top='dwood',up=8,ty0=0,after=17,front='doors'),
 'tea':     dict(ko='찻상(붉은 천)',ramp='wood',top='red',up=0,ty0=1,after=6,front='cloth'),
}
def paint_slab(Wc,Hc,st,seed=3):
    s=STY[st]; Rf=RAMPS[s['ramp']]; Rt=RAMPS[s['top']]; up=s['up']; W=Wc*16; Ht=Hc*16+up
    ty0=s['ty0']; te=Ht-1-s['after']; p=Pix(W,Ht)
    cloth=s['front']=='cloth'
    for y in range(ty0,te+1):
        for x in range(W):
            if y==ty0: t=1
            elif x==0: t=1 if cloth else 2
            elif x==W-1: t=1
            elif y==ty0+1 or x==1: t=7
            elif x==W-2 or y==te: t=5
            else:
                t=6
                edge=min(x-2,W-3-x,y-ty0-2,te-1-y)
                r=H((x%16)//3+((y-up)%16*7)%5,(y-up)%16,seed)
                if not cloth and r<(0.30 if edge<2 else 0.06): t=5
                if cloth and edge<2 and (x+y)%2: t=5
            p.set(x,y,Rt[t])
    fk=s['front']
    y=te+1
    if fk in ('table','desk'):
        for x in range(W): p.set(x,y,Rf[7] if 0<x<W-1 else Rf[1])
        for x in range(W): p.set(x,y+1,Rf[[2,3,3,2][int(H(x%16,y%16,seed)*4)]] if 0<x<W-1 else Rf[1])
        for x in range(W): p.set(x,y+2,Rf[0])
        for x in range(5,W-5): p.set(x,y+3,Rf[1])
        legxs=[1,W-5] if fk=='table' else [1]
        for lx in legxs:
            for yy in range(y+3,Ht):
                p.set(lx,yy,Rf[0]); p.set(lx+1,yy,Rf[6] if yy<Ht-1 else Rf[3]); p.set(lx+2,yy,Rf[3]); p.set(lx+3,yy,Rf[0])
        if fk=='desk':                   # drawer pedestal under the east end: 12 px wide, 2 drawers down to the floor
            x0=W-13
            for yy in range(y+2,Ht):
                for xx in range(x0,W):
                    t=0 if xx in (x0,W-1) or yy==Ht-1 else (5 if xx==x0+1 else (2 if xx==W-2 else 4))
                    p.set(xx,yy,Rf[t])
            if Ht-(y+2)>=5:
                p.set(x0+6,y+3,MT.M['brass'][5])
    elif fk=='cloth':                    # the cloth falls over the front: hem with folds every 4 px, dark hem line
        for yy in range(y,Ht-1):
            for x in range(W):
                if x in (0,W-1): t=1
                else:
                    t=[6,5,5,4][x%4]
                    if yy==y: t=7 if 0<x<W-1 else 1
                    if yy>=Ht-3: t=max(1,t-2)
                p.set(x,yy,Rt[t])
        for x in range(W): p.set(x,Ht-1,Rt[0] if x%4 else (0,0,0,0))
    else:                                 # counter panels / cupboard doors, down to the floor
        for x in range(W): p.set(x,y,Rf[7] if 0<x<W-1 else Rf[1])
        for x in range(W): p.set(x,y+1,Rf[2] if 0<x<W-1 else Rf[0])
        for yy in range(y+2,Ht):
            for x in range(W):
                lx=x%16
                if yy==Ht-1: t=0
                elif yy==Ht-2: t=3
                elif x in (0,W-1): t=0
                elif lx in (0,15): t=4 if lx==0 else 2
                elif yy in (y+2,Ht-3): t=4
                elif lx in (2,13) or yy in (y+3,Ht-4): t=2 if (lx==13 or yy==Ht-4) else 6
                elif lx in (1,14): t=4
                else: t=5 if (((x%16)*3+yy)%7 or fk=="doors") else 4
                p.set(x,yy,Rf[t])
            if fk=='doors':
                for x in range(W):
                    if x%16==11 and yy in ((y+2+Ht-2)//2,(y+2+Ht-2)//2+1): p.set(x,yy,MT.M['brass'][5] if yy==(y+2+Ht-2)//2 else MT.M['brass'][2])
    return p.im,(2,ty0+2,W-3,te-1)
# ---- slice templates into the 16 neighbour-mask pieces ----
COLS={1:['S'],3:['L','M','R']}
def ONE_ROW(st): return STY[st]['front'] in ('panel','doors')   # fronts reach the floor: one row, E-W only
def pieces(st):
    up=STY[st]['up']; out={}
    for Wc in (1,3):
        for Hc in ((1,) if ONE_ROW(st) else (1,3)):
            im,_=paint_slab(Wc,Hc,st)
            for i,cc in enumerate(COLS[Wc]):
                for j,rc in enumerate(['S'] if Hc==1 else ['T','M','B']):
                    y0=0 if j==0 else up+16*j; y1=up+16*(j+1)
                    out[(cc,rc)]=im.crop((i*16,y0,i*16+16,y1))
    return out
def mask_of(cc,rc):
    # N E S W bits: which sides continue into another piece of the same surface
    n=rc in ('M','B'); s=rc in ('T','M'); w=cc in ('M','R'); e=cc in ('L','M')
    return f"{'N' if n else ''}{'E' if e else ''}{'S' if s else ''}{'W' if w else ''}" or 'none'
PIECES={st:pieces(st) for st in STY}
def assemble(st,Wc,Hc,id=None):
    up=STY[st]['up']; P=PIECES[st]; im=Image.new('RGBA',(Wc*16,Hc*16+up))
    for j in range(Hc):
        rc='S' if Hc==1 else ('T' if j==0 else 'B' if j==Hc-1 else 'M')
        for i in range(Wc):
            cc='S' if Wc==1 else ('L' if i==0 else 'R' if i==Wc-1 else 'M')
            im.alpha_composite(P[(cc,rc)],(i*16,0 if j==0 else up+16*j))
    _,surf=paint_slab(Wc,Hc,st)
    kind='wall' if st in ('sideboard',) else 'floor'
    f=F(im,Wc,Hc,up,kind); f.surf=surf; f.id=id or f'{st} {Wc}x{Hc}'; f.style=st; return f
def selfcheck():
    bad=[]
    for st in STY:
        for Wc,Hc in ((1,1),(2,1),(4,1),(5,2),(2,4),(6,3)):
            if ONE_ROW(st) and Hc>1: continue
            a=assemble(st,Wc,Hc).im.tobytes(); b=paint_slab(Wc,Hc,st)[0].tobytes()
            if a!=b: bad.append((st,Wc,Hc))
    return bad
# ---------------- new pieces ----------------
BARK=R8('#1a0c04','#5a3418','#9a6a3c'); HEART=R8('#3a2008','#c89858','#fff0c0')
LOGEND7=['..BBB..','.BLLlm.','BLlllmb','BLlcmdb','Bllmddb','.mmddb.','..bbb..']
def log_end(p,cx,cy,r=3,v=0):
    """round cut end of a log seen head-on (7x7 disc): bark ring lit upper-left (B) / dark lower-right (b), pale heartwood
    lit toward the light, a dark pith pixel; v shifts the heartwood a tone so neighbouring logs differ"""
    key={'B':BARK[4],'b':BARK[2],'L':HEART[7-v],'l':HEART[6-v],'m':HEART[5-v],'d':HEART[4-v],'c':HEART[2]}
    for j,row in enumerate(LOGEND7):
        for i,ch in enumerate(row):
            if ch!='.': p.set(cx-3+i,cy-3+j,key[ch])
def firewood_rack(wc=1):
    # stands against the north wall: two posts, a cap board, logs lying N-S so their round ends face us (tight hex stack)
    W=wc*16; p=Pix(W,32)
    for yy in range(6,30):
        for xx in range(2,W-2): p.set(xx,yy,BARK[0] if (xx+yy)%4 else BARK[1])
    rows=0; y=9; k=0
    while y<=29:
        off=0 if rows%2==0 else -3
        x=5+off
        while x<=W:
            log_end(p,x,y,v=int(H(x,y,5)*2)); x+=7; k+=1
        y+=6; rows+=1
    for y in range(4,32):
        for x in (1,W-2):
            p.set(x-1,y,WOOD[0]); p.set(x,y,WOOD[6] if x==1 else WOOD[3]); p.set(x+1,y,WOOD[0])
    for x in range(0,W):
        p.set(x,2,WOOD[1]); p.set(x,3,WOOD[7]); p.set(x,4,WOOD[5]); p.set(x,5,WOOD[1])
    for x in range(W): p.set(x,30,WOOD[4] if 0<x<W-1 else WOOD[1]); p.set(x,31,WOOD[0])
    f=F(p.im,wc,1,16,'wall'); return f
def firewood_bundle():
    # small floor stack beside a hearth: logs lying E-W (bark lengths), cut ends on the west, 3 below + 2 above
    p=Pix(16,16)
    def log(x0,y0,ln):
        for yy in range(y0-3,y0+3):
            for xx in range(x0,x0+ln):
                t=[1,4,3,2,2,0][yy-y0+3]
                if (xx*3+yy*5)%11==0 and abs(yy-y0)<2: t=1
                if xx==x0+ln-1: t=0
                p.set(xx,yy,BARK[t])
        log_end(p,x0,y0)
    for x0,y0 in ((6,6),(3,6)) if False else ():
        pass
    log(3,11,12); log(6,6,9)
    return F(p.im,1,1,0,'floor')
FIRE=[hx(c) for c in ('#2a0806','#7a1a08','#c83a0c','#f07818','#ffc040','#fff4b0')]
def kitchen_range(t=0,N=12):
    """조리대(화덕 겸 레인지): brick body, black iron hotplate top (the surface for pots), fire door with glow,
    brick chimney breast + iron hood on the wall face above"""
    p=Pix(32,40); BR=[c for c in __import__('tiles').BRICK]; IR=MT.M['iron']
    # chimney breast on the wall face (y 0..15)
    for y in range(0,17):
        for x in range(6,26):
            ly=y%4; lx=(x+(3 if (y//4)%2 else 0))%6
            c=BR[4] if ly==0 else BR[3]
            if ly==3 or lx==5: c=BR[1]
            if x in (6,25): c=BR[0]
            p.set(x,y,c)
    for y in range(13,19):                  # iron hood lip
        w=13+(y-13)*1
        for x in range(16-w,16+w):
            c=IR[4] if y==13 else (IR[2] if y<18 else IR[0])
            if x in (16-w,16+w-1): c=IR[0]
            p.set(x,y,c)
    # body (y 19..39): hotplate top 19..25, front 26..39
    for y in range(19,26):
        for x in range(1,31):
            if y==19: c=IR[1]
            elif x in (1,30): c=IR[0]
            elif y==20 or x==2: c=IR[4]
            elif y==25: c=IR[2]
            else: c=IR[2] if (x+y)%2 else IR[1]
            p.set(x,y,c)
    for cx in (9,22):                        # two hob rings
        for yy in range(-1,2):
            for xx in range(-4,5):
                if abs(xx)>=3 or abs(yy)==1 and abs(xx)>=1: p.set(cx+xx,22+yy,IR[3] if yy<=0 else IR[0])
    for y in range(26,40):
        for x in range(1,31):
            ly=(y-26)%4; lx=(x+(3 if ((y-26)//4)%2 else 0))%6
            c=BR[4] if ly==0 else BR[3]
            if ly==3 or lx==5: c=BR[1]
            if y==26: c=IR[5]
            if y==27: c=IR[1]
            if x in (1,30) or y==39: c=BR[0]
            p.set(x,y,c)
    for y in range(29,37):                   # fire door (iron frame, glowing grate, animated)
        for x in range(7,25):
            if x in (7,24) or y in (29,36): c=IR[0]
            elif x in (8,23) or y==30: c=IR[3]
            else:
                k=(x*5+y*3+t*7)%N
                ph=__import__('math').sin(2*__import__('math').pi*(t/N)+x*0.7+y*0.4)
                c=FIRE[3] if ph>0.3 else (FIRE[4] if ph>-0.2 else FIRE[2])
                if y==35: c=FIRE[1]
                if (x-8)%3==0: c=IR[1]         # grate bars
            p.set(x,y,c)
    f=F(p.im,2,1,24,'wall'); f.surf=(3,20,28,25); return f
def proofing_rack():
    # 발효 선반: open shelves against the wall with dough balls rising on linen-lined boards
    p=Pix(16,32); PN=RAMPS['pine']; LN=RAMPS['linen']
    for y in range(2,32):
        for x in range(1,15):
            if x in (1,14): p.set(x,y,PN[1] if y>2 else PN[1])
            elif x in (2,13): p.set(x,y,PN[6] if x==2 else PN[3])
    for sy in (9,17,25):
        for x in range(2,14): p.set(x,sy,PN[7]); p.set(x,sy+1,PN[3]); p.set(x,sy+2,PN[0])
        for x in range(3,13): p.set(x,sy-1,LN[5])
        for i,dx in enumerate((3,8)):
            MT.lit(p,dx,sy-4,[' 565 ','56665','45554'],'linen')
    for x in range(1,15): p.set(x,2,PN[1]); p.set(x,3,PN[6])
    for x in range(1,15): p.set(x,31,PN[0])
    for y in range(4,31):
        for x in range(3,13):
            if p.get(x,y)[3]==0: p.set(x,y,PN[1] if y%8<2 else PN[2])
    return F(p.im,1,1,16,'wall')
def stairwell_down(wc=3):
    # 2F: an opening in the floor with a balustrade on the three far sides; steps fall away to the NORTH (darker deeper)
    W=wc*16; Hh=32; p=Pix(W,Hh); ST=RAMPS['dwood']; SD=RAMPS['wood']
    for y in range(Hh):
        for x in range(W):
            if x<3 or x>=W-3 or y<3:                           # rail (dark stained wood with lit top)
                c=ST[6] if (y==0 or x in (0,W-1)) else ST[3]
                if y==1 and 2<x<W-3: c=ST[7]
                if y==2 and 2<x<W-3: c=ST[1]
                if x in (1,W-2) and y>0: c=ST[5] if x==1 else ST[2]
                if (x in (0,W-1)) and y>0: c=ST[0]
                p.set(x,y,c); continue
            k=(Hh-1-y)//5; ly=(Hh-1-y)%5                       # step k from the near (south) edge
            dark=min(5,k)
            c=[6,6,5,3,2][4-ly] if True else 0
            t=max(0,c-dark)
            if x in (3,W-4): t=max(0,t-2)
            p.set(x,y,SD[t] if t>0 else hx('#141018'))
    for x in range(3,W-3,4):                                   # balusters on the far rail
        for y in range(3,6): p.set(x,y,ST[5] if y<5 else ST[1])
    f=F(p.im,wc,2,0,'flat'); f.stairs='down'; return f
def broom_bucket():
    p=Pix(16,16); IR=MT.M['iron']
    for y in range(0,12): p.set(4,y,WOOD[6]); p.set(5,y,WOOD[3])
    MT.lit(p,1,9,[' 3333 ','344443','3434343','2323232'[:7]],'straw')
    MT.ellipse_top if False else None
    MT.lit(p,8,6,[' 11111 ','1555551','1433331','1444441','1433331','1444441',' 12221 '],'wood')
    for x in range(9,14): p.set(x,7,MT.M['water'][4])
    for x in range(7,15): p.set(x,5,IR[3] if x in (7,14) else (0,0,0,0))
    return F(p.im,1,1,0,'floor')
def towel_rail():
    p=Pix(16,16)
    for x in range(2,14): p.set(x,3,MT.M['brass'][5]); p.set(x,4,MT.M['brass'][2])
    MT.lit(p,3,4,['1555551','1566651','1555551','1455541','1455541',' 1 1 1 '],'white')
    MT.lit(p,10,4,['1555','1565','1455','1445'],'blue')
    return F(p.im,1,0,0,'hang')
def tall_window(wc=2):
    """big stained arch window for the wall behind an altar: fills both face rows (height 30), 2 cells wide"""
    W=wc*16; p=Pix(W,22); GL=[MT.M['blue'],MT.M['red'],MT.M['yellow'],MT.M['green'],MT.M['purple']]; ST=MT.M['stone']
    cx=(W-1)/2
    HT=22
    for y in range(HT):
        for x in range(2,W-2):
            r=(W-4)/2; dy=y-r
            if y<r and ((x-cx)**2+(dy)**2)**0.5>r: continue
            inner=(x in (2,W-3)) or y==HT-1 or (y<r and ((x-cx)**2+dy**2)**0.5>r-1.2)
            if inner: p.set(x,y,ST[1]); continue
            if y==HT-2: p.set(x,y,ST[5]); continue
            lead=(x-2)%5==0 or (y%6==0)
            if lead: p.set(x,y,hx('#1a1620')); continue
            k=int((x-2)//5+y//6)%5; g=GL[k]
            t=5 if (x-y)%9==0 else (4 if y<12 else 3)
            if 12<=x<=W-13 and 6<=y<=18: g=MT.M['yellow']; t=5 if abs(x-cx)<1 or y==10 else 4   # the cross of light
            p.set(x,y,g[t])
    f=F(p.im,wc,0,0,'hang'); f.tall=True; return f
def runner2(hc=3):
    # 2-wide aisle runner for the chapel (flat)
    p=Pix(32,hc*16); RD=MT.M['red']; GD=MT.M['gold']
    for y in range(hc*16):
        for x in range(32):
            if x in (0,31): c=GD[2]
            elif x in (1,30): c=GD[5]
            elif x in (2,29): c=RD[2]
            else:
                c=RD[4] if 3<x<28 else RD[3]
                if (x in (4,27)) and y%4<2: c=GD[3]
                if abs(x-15.5)+abs((y%16)-7.5)<3.2 and abs(x-15.5)+abs((y%16)-7.5)>1.9: c=GD[4]
            p.set(x,y,c)
    return F(p.im,2,hc,0,'flat')
def coal_bin():
    p=Pix(16,16); IR=MT.M['iron']
    fy=box(p,1,5,14,5,6,'dwood',panel=False)
    for yy in range(3,10):
        for xx in range(3,13):
            if yy>=6 or abs(xx-8)<(yy-2)*1.6: p.set(xx,yy,MT.M['black'][1] if (xx+yy)%3 else MT.M['black'][3])
    return F(p.im,1,1,0,'floor')
def bread_shelf(goods=('loaf','bun')):
    # open wall shelf for loaves (customer side): three boards, bread standing in rows, pine
    p=Pix(16,32); PN=RAMPS['pine']
    for y in range(2,32):
        p.set(0,y,PN[0]); p.set(1,y,PN[6]); p.set(14,y,PN[3]); p.set(15,y,PN[0])
        for x in range(2,14): p.set(x,y,PN[2] if y%9 else PN[1])
    for x in range(16): p.set(x,1,PN[1]); p.set(x,2,PN[7])
    for k,sy in enumerate((10,19,28)):
        for x in range(1,15): p.set(x,sy,PN[7]); p.set(x,sy+1,PN[3])
        g=goods[k%len(goods)]; gw=G[g][1]; n=max(1,12//(gw+1))
        for i in range(n): put_good(p,g,2+i*(gw+1),sy-G[g][2])
    for x in range(16): p.set(x,31,PN[0])
    return F(p.im,1,1,16,'wall')
def peel_rack():
    # 화덕 삽(peel) 걸이: a peg board with two long-handled peels hanging blade-down
    p=Pix(16,16); PN=RAMPS['pine']
    for x in range(1,15): p.set(x,1,WOOD[1]); p.set(x,2,WOOD[6]); p.set(x,3,WOOD[3])
    for cx in (4,11):
        for y in range(3,9): p.set(cx,y,PN[6])
        for y in range(9,15):
            for x in range(cx-2,cx+3):
                t=6 if x<cx+1 else 5
                if x in (cx-2,cx+2) or y==14: t=2
                if y==9 and x in (cx-2,cx+2): continue
                p.set(x,y,PN[t])
    return F(p.im,1,0,0,'hang')
# ---- tabletop goods (static) ----
@good('globe_s',9,11)
def g_globe(p,x,y):
    import math
    for yy in range(0,7):
        for xx in range(1,8):
            d=((xx-4)/3.3)**2+((yy-3)/3.3)**2
            if d>1: continue
            land=math.sin(xx*1.4)+math.cos(yy*1.3+xx*0.5)>0.7
            t=5 if (xx<4 and yy<3) else (4 if d<0.55 else 3)
            p.set(x+xx,y+yy,MT.M['green'][t] if land else MT.M['blue'][t])
    for yy in range(0,8): p.set(x+8 if yy<2 else x+8,y+yy,MT.M['brass'][4]) if yy in (2,3,4) else None
    p.set(x+4,y+7,MT.M['brass'][4]); p.set(x+4,y+8,MT.M['brass'][2])
    MT.lit(p,x+1,y+9,['1555551','1222221'],'dwood')
@good('breadbasket',9,6)
def g_bbask(p,x,y):
    MT.lit(p,x,y,[' 5 4 5 ','4565456 ','5656565','1444441',' 13331 ',' 1111 '][:6],'bread')
    for xx in range(1,8): p.set(x+xx,y+3,MT.M['straw'][4] if xx%2 else MT.M['straw'][3]); p.set(x+xx,y+4,MT.M['straw'][2])
@good('loafrow',11,4)
def g_loafrow(p,x,y):
    MT.lit(p,x,y,[' 565  565  ','45654456543','3444334443 ','2333223332 '[:11]],'bread')
@good('baguettes',10,5)
def g_bag2(p,x,y):
    MT.lit(p,x,y,['   565656 ','565656543 ',' 34443332 ','1111111111'[:10]],'bread')
    for xx in range(1,9): p.set(x+xx,y+4,MT.M['straw'][3])
@good('doughball',5,3)
def g_dough(p,x,y): MT.lit(p,x,y,[' 666 ','66665','45554'],'linen')
@good('rollingpin',8,2)
def g_rpin(p,x,y): MT.lit(p,x,y,['15666651','12333321'],'pine')
@good('flourbowl',6,4)
def g_fbowl(p,x,y): MT.lit(p,x,y,[' 6666 ','166661','144441',' 1331 '],'linen')
@good('kettle',7,6)
def g_kettle(p,x,y): MT.lit(p,x,y,['  111  ',' 1 3 1 ','1455541','1466541','1444431',' 1111 '],'iron')
@good('pot',8,6)
def g_pot(p,x,y): MT.lit(p,x,y,['11111111','15555551','14343431','1444441 ','1333331 ',' 11111  '],'iron')
@good('ladle',6,2)
def g_ladle(p,x,y): MT.lit(p,x,y,['1  655','12221 '],'iron')
@good('plates',8,3)
def g_plates(p,x,y): MT.lit(p,x,y,[' 666666 ','65555556',' 333333 '],'white')
@good('candlestick',5,9)
def g_cstick(p,x,y): MT.lit(p,x,y,['  f  ','  o  ',' 565 ',' 454 ',' 454 ',' 454 ','  4  ',' 454 ','23332'],'linen',{'f':MT.M['yellow'][6],'o':MT.M['orange'][4],'2':MT.M['brass'][2],'3':MT.M['brass'][3],'4':MT.M['brass'][4] if False else MT.M['linen'][4]})
@good('washbowl',8,5)
def g_wbowl(p,x,y): MT.lit(p,x,y,['  6  6  ','16w55w61','14444441',' 133331 ','  1111  '],'white',{'w':MT.M['water'][4]})
@good('pitcher',5,7)
def g_pitch(p,x,y): MT.lit(p,x,y,[' 11  ','16651','15551','14441 '[:5],'14441','13331',' 111 '],'white')
@good('sealbox',6,3)
def g_seal(p,x,y): MT.lit(p,x,y,['166661','1r44r1','111111'],'dwood',{'r':MT.M['red'][4]})
@good('quill',5,5)
def g_quill(p,x,y): MT.lit(p,x,y,['    6','   65','  65 ',' 1   ','111  '],'white',{'1':MT.M['black'][1]})
@good('keys',5,3)
def g_keys(p,x,y): MT.lit(p,x,y,['55 5 ','4 44 ',' 5  5'],'brass')
# register everything new so the atlas and metadata see it
def _reg(name,cat,fn): OBJ[name]=(cat,fn)
for st in STY:
    for Wc,Hc in ((1,1),(2,1),(3,1),(4,1),(2,2),(3,2),(4,2)):
        if ONE_ROW(st) and Hc>1: continue
        _reg(f'{st} {Wc}x{Hc}','shop' if st=='counter' else ('kitchen' if st=='kcounter' else 'home'),lambda st=st,Wc=Wc,Hc=Hc:assemble(st,Wc,Hc))
_reg('firewood rack','kitchen',lambda:firewood_rack(1)); _reg('firewood rack 2w','kitchen',lambda:firewood_rack(2))
_reg('firewood bundle','kitchen',firewood_bundle); _reg('proofing rack','bake',proofing_rack)
_reg('stairwell down','home',stairwell_down); _reg('broom and bucket','home',broom_bucket); _reg('towel rail','home',towel_rail)
_reg('tall stained window','church',tall_window); _reg('aisle runner','church',runner2); _reg('coal bin','smith',coal_bin)
_reg('bread shelf','bake',bread_shelf); _reg('bread shelf pie','bake',lambda:bread_shelf(('pie','bun','cake')))
_reg('bread shelf baguette','bake',lambda:bread_shelf(('baguette','loaf'))); _reg('peel rack','bake',peel_rack)
OLD={k:OBJ[k][1] for k in ('firewood pile','dough table','table 2x1','counter 4','desk','side table','tea table','globe') if k in OBJ}
OBJ.pop('firewood pile',None)
for k in ('table 1x1','table 2x1','table 3x1','table 2x2','counter 2','counter 3','counter 4','counter 5','counter 6','desk','writing desk',
          'work table pine','work table wood','work table dwood','side table','dough table','sewing table','tea table','globe'):
    OBJ.pop(k,None)            # v3 one-off surfaces: every table/desk/counter now comes from the autotile kit          # replaced: the old pile ignored the fixed view
def fur_rug():
    # brown pelt with a ragged edge, lighter long-hair centre, darker spine stripe (2x2, flat)
    p=Pix(32,32); FR=R8('#1a0e06','#6a4424','#d8b080')
    import math
    for y in range(32):
        for x in range(32):
            dx=(x-15.5)/15; dy=(y-15.5)/13.5
            ang=math.atan2(dy,dx); r=math.hypot(dx,dy)
            edge=0.86+0.1*math.sin(ang*7)+0.05*math.sin(ang*13+1)
            if r>edge: continue
            t=6 if r<0.45 else (5 if r<0.7 else 4)
            if r>edge-0.12: t=2
            if abs(x-15.5)<1.2 and r<0.75: t=3
            if (x*3+y*5)%9==0 and r<edge-0.12: t=max(3,t-1)
            p.set(x,y,FR[t])
    return F(p.im,2,2,0,'flat')
OBJ['fur rug']=('home',fur_rug)

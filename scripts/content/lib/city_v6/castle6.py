# 버들항 v6 royal castle kit (verdict 3: "a real castle, not the same brick as the town"). Look reference only (no pixels
# copied): an RPG-Maker-MV-style fan castle. Every piece is drawn in PALE ASHLAR - large grey-white blocks in running bond
# with dark mortar, each block with its own tone, a lit top-left edge and a shaded bottom-right edge, the chipset's stone
# grain inside - and roofed in the chipset's slate-violet tiles. The town houses use pink brick + terracotta, so the castle
# reads as another material at a glance. Same fixed front-above view as the chipset: walls show only as front faces, wall
# tops / terraces are walkable, roofs are foreshortened slopes. Light from the upper left, inset outline (pz.fin).
import sys, os, math, random; sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from PIL import Image
import palette
from px2 import _hash
import pz, pv, pj, ph2, terrain, roman
from roman import ST, CRM, WDr, mul, mix, ramp
from v6pieces import put, ctex, LEAF6, GOLD
WD=terrain.WD
SL=[terrain.hx(c) for c in [palette.OUT_CHIP['roofc']]+palette.RAMPS_CHIP['roofc']]    # slate-violet ramp
GL=[(7,21,40),(33,45,66),(48,70,92),(63,162,174)]                                      # window glass (chipset teal)
WARM=terrain.hx('#d9d2be')

# ---------------- the castle stone ----------------
def ash(X,Y,k=1.0,bw=16,bh=8,seed=0):
    # pale ashlar: blocks bw x bh in running bond, dark mortar (1 px), per-block base tone, lit top/left edge, shaded
    # bottom/right edge, sparse chipset grain (from the chipset's own ashlar tile) inside the face
    row=Y//bh; ly=Y%bh; off=(row%2)*(bw//2); col=(X+off)//bw; lx=(X+off)%bw
    if ly==bh-1 or lx==bw-1: c=ST[3]
    else:
        h=_hash(col,row,seed+41)
        base=ST[5] if h<0.55 else (mix(ST[5],WARM,0.55) if h<0.8 else mix(ST[5],ST[6],0.6))
        c=base
        if ly==0 or lx==0: c=mix(base,ST[6],0.7)
        elif ly==bh-2 or lx==bw-2: c=mix(base,ST[4],0.55)
        else:
            g=ctex(224,160,X,Y)
            if g==(140,108,91) and _hash(X,Y,seed+42)<0.45: c=mix(base,ST[4],0.6)
            elif g==(158,141,131) and _hash(X,Y,seed+43)<0.3: c=mix(base,ST[4],0.3)
    return mul(c,k) if k!=1.0 else c

# ---------------- small parts ----------------
def arch_window(px,W,H,x0,y0,w=6,h=11,k=1.0):
    # an arched window: stone frame (lit left), dark glass with a teal glint, a sill
    cx=x0+w/2
    for y in range(y0-1,y0+h+1):
        for x in range(x0-1,x0+w+1):
            r=math.hypot((x+0.5-cx)/((w+2)/2),max(0,(y0+w/2-(y+0.5)))/((w+2)/2))
            if y<y0+w/2 and r>1: continue
            inner=x0<=x<x0+w and y0<=y<y0+h and (y>=y0+w/2 or math.hypot((x+0.5-cx)/(w/2),(y0+w/2-(y+0.5))/(w/2))<=1)
            if inner:
                c=GL[1] if y<y0+h*0.45 else GL[2]
                if x==x0+1 and y0+w//2<=y<y0+w//2+3: c=GL[3]
                if x==int(cx) and y>y0+2: c=GL[0]
            else: c=ST[6] if x<cx else ST[4]
            put(px,W,H,x,y,mul(c,k))
    for x in range(x0-2,x0+w+2): put(px,W,H,x,y0+h+1,mul(ST[6] if x<cx else ST[4],k))
def slit(px,W,H,x,y0,h=8):
    for y in range(y0,y0+h): put(px,W,H,x,y,ST[1]); put(px,W,H,x+1,y,ST[2])
    put(px,W,H,x-1,y0+h//2,ST[1]); put(px,W,H,x+2,y0+h//2,ST[2])
def shield(color='slate'):
    # a heater shield: coloured field, gold rim, a white wing emblem; 10 x 12
    R=SL if color=='slate' else [terrain.hx(c) for c in [palette.OUT_CHIP['red']]+palette.RAMPS_CHIP['red']]
    o=Image.new('RGBA',(10,12)); px=o.load()
    for y in range(12):
        hw=5 if y<6 else 5-(y-5)*0.72
        for x in range(10):
            d=abs(x+0.5-5)
            if d>hw: continue
            c=GOLD[4] if d>hw-1.2 or y==0 else (R[4] if x<5 else R[3])
            px[x,y]=c+(255,)
    for (x,y) in ((3,4),(4,4),(5,4),(6,4),(2,3),(7,3),(4,5),(5,5),(4,6),(5,6),(4,7),(5,7)): px[x,y]=CRM[6]+(255,)
    return pz.fin(o)
def banner(color='slate',h=24):
    return roman.banner_hanging('shroom' if color=='slate' else 'red',h)
def merlons(px,W,H,y0,x0=0,x1=None,step=8,mw=5,k=1.0):
    # a crenellated parapet edge seen from the front-above: merlon tops (lit) and the embrasures between (shadow)
    x1=W if x1 is None else x1
    for x in range(x0,x1):
        m=((x-x0)%step)<mw
        for j in range(6):
            y=y0+j
            if m: c=ST[6] if j==0 else (ST[5] if j<3 else ash(x,y,0.95))
            else: c=None if j<2 else (ST[3] if j==2 else ash(x,y,0.75))
            if c is not None: put(px,W,H,x,y,mul(c,k))
        if m and (x-x0)%step==mw-1:
            for j in range(1,6): put(px,W,H,x,y0+j,ST[3])

# ---------------- curtain wall ----------------
def wall_h6(n,seed=0,shields=(),banners=()):
    # 4 rows: the wall-walk seen from above (row 0, walkable: flagstones, a low inner lip at the top, merlons along the
    # front edge) and the tall outer face (rows 1-3: ashlar, arrow slits, shields, a battered plinth, shadow at the foot)
    W=n*16; H=64; o=Image.new('RGBA',(W,H)); px=o.load()
    for y in range(H):
        for x in range(W):
            if y<2: c=ST[5] if y==0 else ST[3]
            elif y<11: c=ctex(192,176,x,y)                      # walk: the chipset's pale flagstone
            elif y<16: c=None
            elif y<H-6: c=ash(x,y-16,seed=seed)
            elif y<H-2: c=mix(ash(x,y,seed=seed+1,bw=12,bh=4),ST[4],0.25)
            else: c=ST[3] if y==H-2 else ST[2]
            if c is not None: put(px,W,H,x,y,c)
    merlons(px,W,H,10)
    for k in range(n):
        if k%2==1 and k not in shields: slit(px,W,H,k*16+7,30,10)
    im=pz.fin(o)
    for k in shields: im.alpha_composite(shield(),(k*16+3,24))
    for k,col in banners: im.alpha_composite(banner(col,26),(k*16+2,17))
    return im
def wall_v6(n):
    # a N-S wall-walk seen from above: pale flagstone walk, merlons along the outer (east) side, a lip on the inner side
    W=16; H=n*16; o=Image.new('RGBA',(W,H)); px=o.load()
    for y in range(H):
        for x in range(W):
            if x<2: c=ST[5] if x==0 else ST[3]
            elif x<10: c=ctex(192,176,x,y)
            else:
                m=(y%8)<5
                c=(ST[6] if x==10 else ST[5] if x<13 else ST[3]) if m else (ST[3] if x<13 else ST[2])
            put(px,W,H,x,y,c)
    return pz.fin(o)

# ---------------- round tower ----------------
def tower6(wc=3,body=80,cone=48,tiers=3,ry=5,flag='slate',windows=True):
    # a drum tower: ashlar cylinder (texture wrapped by arc length so the courses bow toward the viewer), window tiers,
    # a corbelled ring under the roof, a tall slate-violet cone whose shingle rings bow like the eave, gold finial + pennant
    W=wc*16; R=W/2; Hc=cone; Hb=body; top=8
    o=Image.new('RGBA',(W,top+Hc+Hb+ry+1)); px=o.load(); OH=o.height
    lit=pv.T('sto','back',W*2,Hc+ry*3).load(); dk=pv.T('sto','front',W*2,Hc+ry*3).load()
    y0=top+Hc
    for y in range(y0-ry,y0+Hb+ry+1):
        for x in range(W):
            d=x+0.5-R
            if abs(d)>R-1: continue
            u,cz=pv._wrap(d,R-1); bow=ry*cz
            if y<y0+bow or y>y0+Hb+bow: continue
            yy=int(y-bow-y0)
            k=0.66+0.46*max(0,cz*0.85-0.3*(d/R))
            if yy<7:                                                        # corbel ring: two projecting courses
                c=ST[6] if yy==0 else (ST[5] if yy<3 else (ST[3] if yy==3 else (ST[4] if (int(u+64))%5<3 else ST[2])))
            elif yy>=Hb-5: c=ST[4] if yy<Hb-1 else ST[2]
            else: c=ash(int(u+64),yy,bw=12,bh=6,seed=wc)
            put(px,W,H_(OH),x,y,mul(c,min(1.12,k)))
    # windows in tiers on the axis and staggered
    if windows:
        for t in range(tiers):
            wy=y0+12+t*int((Hb-22)/max(1,tiers))
            cxw=int(R)-3+(0 if t%2==0 else 0)
            arch_window(px,W,OH,cxw,wy,6,10,k=0.95)
    # cone
    for y in range(top,y0+ry+1):
        half=(R+1)*min(1,(y-top+1)/Hc)
        for x in range(W):
            d=x+0.5-R
            if abs(d)>half: continue
            u,cz=pv._wrap(d,half); bow=ry*(half/R)*cz
            if y>y0+bow: continue
            yy=int(y-bow)-top+ry
            c=(lit if d<0 else dk)[int(u+R)%(W*2),max(0,yy)%(Hc+ry*3)]
            kk=1.05 if d<0 else 0.86
            if abs(abs(d)-half)<1.2: c=SL[5] if d<0 else SL[0]
            put(px,W,OH,x,y,mul(c,kk))
    for x in range(W):
        d=x+0.5-R
        if abs(d)<=R:
            u,cz=pv._wrap(d,R); yb=int(y0+ry*cz)
            put(px,W,OH,x,yb,SL[1]); put(px,W,OH,x,yb+1,ST[2])
    cx=int(R)
    for y in range(0,top+2): put(px,W,OH,cx-1,y,GOLD[4]); put(px,W,OH,cx,y,GOLD[2])
    im=pz.fin(o)
    if flag:
        p=im.load(); R_=SL if flag=='slate' else [terrain.hx(c) for c in [palette.OUT_CHIP['red']]+palette.RAMPS_CHIP['red']]
        for j in range(4):
            for i in range(8-j*2):
                if 0<=cx+1+i<W: p[cx+1+i,1+j]=(R_[5] if j<2 else R_[3])+(255,)
    return im
def H_(h): return h

# ---------------- gatehouse ----------------
def gatehouse6():
    # 5 cells x 4 rows between two drum towers: the wall-walk on top (row 0, merlons in front), a tall ashlar face with a
    # round-arched gate (3 cells wide passage, portcullis half raised, the vault soffit in shade), the royal banner over
    # the arch and two shields. The middle three cells are the walkable passage.
    W,H=80,64; o=Image.new('RGBA',(W,H)); px=o.load()
    cx=40; ax0,ax1=17,63; spring=38; rx=23; ry=19
    def open_(x,y): return ax0<=x<ax1 and y>=spring-ry and ((x+0.5-cx)**2/rx**2+(max(0,spring-(y+0.5)))**2/ry**2<1)
    for y in range(H):
        for x in range(W):
            if y<2: c=ST[5] if y==0 else ST[3]
            elif y<11: c=ctex(192,176,x,y)
            elif y<16: c=None
            else:
                if open_(x,y) and y>=22: continue
                c=ash(x,y-16,seed=5)
                e=(x+0.5-cx)**2/(rx+4)**2+(max(0,spring-(y+0.5)))**2/(ry+4)**2
                if e<1 and not open_(x,y) and y<spring+1:
                    ang=math.degrees(math.atan2(spring-(y+0.5),x+0.5-cx)); c=ST[6] if x<cx else ST[4]
                    if int(ang+180)%14<2: c=ST[3]
                if y>=H-3: c=ST[3] if y==H-3 else ST[2]
            if c is not None: put(px,W,H,x,y,c)
    merlons(px,W,H,10)
    for y in range(16,H):                                                   # soffit + dark passage + portcullis
        for x in range(ax0,ax1):
            if not open_(x,y) or y<22: continue
            d=0.35+0.3*min(1,(y-22)/30)
            c=mul(ctex(192,176,x,y),d) if y>=H-14 else mul(ST[2],0.7+0.3*(y-22)/30)
            if not open_(x,y-4): c=mul(ST[3],0.8 if x<cx else 0.6)
            put(px,W,H,x,y,c)
            if y<spring+2 and ((x-ax0)%5==2 or (y-22)%5==2): put(px,W,H,x,y,ST[4] if (x-ax0)%5==2 else ST[3])
    for x in range(ax0,ax1):                                                # portcullis spikes
        if (x-ax0)%5==2 and open_(x,spring+2): put(px,W,H,x,spring+2,ST[5]); put(px,W,H,x,spring+3,ST[4])
    im=pz.fin(o)
    im.alpha_composite(shield(),(3,26)); im.alpha_composite(shield(),(67,26))
    b=banner('slate',22); im.alpha_composite(b,(cx-6,16))
    return im

# ---------------- palace ----------------
def facade(wc,storeys,door=None,seed=0,tall=36):
    # an ashlar palace front: storeys of arched windows (one per cell), string courses, a plinth; door on cell `door`
    W=wc*16; H=storeys*tall+6; o=Image.new('RGBA',(W,H)); px=o.load()
    for y in range(H):
        for x in range(W):
            c=ash(x,y,seed=seed)
            if y%tall in (0,1) and y<storeys*tall: c=ST[6] if y%tall==0 else ST[4]      # string course
            if y>=H-6: c=ST[(5,5,4,4,3,2)[y-(H-6)]]
            put(px,W,H,x,y,c)
    for s in range(storeys):
        for k in range(wc):
            if door is not None and s==storeys-1 and k==door: continue
            arch_window(px,W,H,k*16+5,s*tall+9,6,min(18,tall-15))
    im=pz.fin(o)
    return im
def big_door(w=20,h=30):
    o=Image.new('RGBA',(w+8,h+4)); px=o.load(); W,H=o.size; cx=W/2
    for y in range(H):
        for x in range(W):
            r=math.hypot((x+0.5-cx)/(W/2),max(0,(W/2-(y+0.5)))/(W/2))
            if y<W/2 and r>1: continue
            inner=4<=x<W-4 and y>=4 and (y>=W/2 or math.hypot((x+0.5-cx)/((W-8)/2),((W/2)-(y+0.5))/((W-8)/2))<=1)
            if inner:
                c=WD[3] if (x-4)%4 else WD[2]
                if abs(x+0.5-cx)<1: c=WD[1]
                if (y-8)%8==0: c=WD[2]
                if (x in (int(cx)-3,int(cx)+2)) and y%6==3: c=GOLD[5]
            else: c=ST[6] if x<cx else ST[4]
            put(px,W,H,x,y,c)
    return pz.fin(o)
def stepped_gable(W,Hg,seed=0):
    # a crow-stepped gable wall rising in front of the roof: ashlar, coping on every step, a round window + shield
    o=Image.new('RGBA',(W,Hg)); px=o.load(); cx=W/2; steps=5; sw=W/(2*steps+1)
    for y in range(Hg):
        for x in range(W):
            k=int(abs(x+0.5-cx)//sw)                                         # step index from the axis
            ytop=int(k*Hg/(steps+1)) if k<=steps else Hg
            if y<ytop: continue
            c=ash(x,y,seed=seed+7)
            if y<ytop+2: c=ST[6] if y==ytop else ST[4]
            put(px,W,Hg,x,y,c)
    im=pz.fin(o)
    im.alpha_composite(shield(),(int(cx)-5,Hg-18))
    return im
def palace6():
    # 23 cells: wing (6, 2 storeys, hipped slate roof) + drum tower (3) + centre block (5, 3 storeys, crow-stepped gable,
    # great door with a banner) + drum tower + wing. Left-right symmetric about the door. Returns im, door cell, chimneys.
    wing_w,tw,cw=6,3,5; N=wing_w*2+tw*2+cw; W=N*16
    tall=34
    wing=facade(wing_w,2,seed=3,tall=tall); wr=ph2.steep_hip('sto',wing_w*16,40); wing_im=Image.new('RGBA',(wing_w*16,40+wing.height))
    wing_im.alpha_composite(wr,(0,0)); wing_im.alpha_composite(wing,(0,40)); wing_im=ph2.volume(wing_im,40)
    cen=facade(cw,3,door=2,seed=4,tall=tall); cr=ph2.steep_hip('sto',cw*16,44)
    Hg=34; cen_im=Image.new('RGBA',(cw*16,44+cen.height)); cen_im.alpha_composite(cr,(0,0)); cen_im.alpha_composite(cen,(0,44)); cen_im=ph2.volume(cen_im,44)
    g=stepped_gable(cw*16,Hg); cen_im.alpha_composite(g,(0,44-Hg+4))
    d=big_door(20,30); cen_im.alpha_composite(d,((cw*16-d.width)//2,cen_im.height-d.height-6))
    cen_im.alpha_composite(banner('slate',30),(cw*16//2-6,44+tall+4)) if False else None
    for bx in (1,3):                                                          # banners on the centre block
        cen_im.alpha_composite(banner('slate',28),(bx*16+2,44+tall+4))
    tow=tower6(tw,body=cen.height+8,cone=44,tiers=4)
    Hmax=max(tow.height,cen_im.height,wing_im.height)
    o=Image.new('RGBA',(W,Hmax)); x=0
    for im in (wing_im,tow,cen_im,tow,wing_im):
        o.alpha_composite(im,(x,Hmax-im.height)); x+=im.width
    return dict(im=o,door=wing_w+tw+cw//2,chim=[],below=0,above=0)

# ---------------- court / approach pieces ----------------
def castle_house(wc=3,storeys=1,door=1,seed=0,chim=True):
    # a castle outbuilding (smithy, barracks) in the same ashlar + slate as the keep: facade, steep hipped slate roof,
    # optional chimney whose top may overhang the row above (returned as `above`)
    f=facade(wc,storeys,door=door,seed=seed+20,tall=32); Rh=40; pad=16 if chim else 0
    im=Image.new('RGBA',(wc*16,pad+Rh+f.height)); im.alpha_composite(ph2.steep_hip('sto',wc*16,Rh),(0,pad)); im.alpha_composite(f,(0,pad+Rh))
    im=ph2.volume(im,pad+Rh); ch=[]
    if chim: ch.append(ph2.chimney(im,(wc-1)*16 if door==0 else 0,pad-12+int(Rh*0.25),'sto'))
    d=Image.new('RGBA',(12,20)); dp=d.load()
    for y in range(20):
        for x in range(12):
            if y<4 and math.hypot(x+0.5-6,4-y)>6: continue
            dp[x,y]=(WD[3] if x%4 else WD[2])+(255,)
    im.alpha_composite(pz.fin(d),(door*16+2,im.height-26))
    return dict(im=im,door=door,chim=ch,below=0,above=pad)
def drawbridge6(wc=3,rows=3):
    # a lowered drawbridge over the moat, wc cells wide: planks across the travel, edge beams, iron straps, and the two
    # chains rising from its outer corners to the gatehouse face above (P px of overhang at the top)
    W=wc*16; P=14; H=P+rows*16; o=Image.new('RGBA',(W,H)); px=o.load()
    for y in range(P,H):
        for x in range(W):
            yy=y-P
            if x<3 or x>=W-3: c=WD[2] if x in (0,W-1) else (WD[5] if x<3 else WD[3])
            else:
                c=WD[5] if yy%4 else WD[2]
                if yy%4==1 and (x*7+yy)%13==0: c=WD[3]
                if x in (8,W-9): c=ST[3]
            if y>=H-2: c=WD[2]
            px[x,y]=c+(255,)
    for side in (0,1):
        x0=1 if side==0 else W-2
        for k in range(P+22):
            y=H-6-int(k*1.5); x=x0+(int(k*0.18) if side==0 else -int(k*0.18))
            if 0<=y<H: px[x,y]=(ST[4] if k%2 else ST[2])+(255,)
    return pz.fin(o)
def castle_face(px,Wpx,Hpx,cells,top_of):
    # repaint rock-face cells (x,y) with the castle's ashlar retaining wall: coping on the first course, battered plinth
    for (cx,cy) in cells:
        k=top_of[(cx,cy)]
        for ly in range(16):
            for lx in range(16):
                X,Y=cx*16+lx,cy*16+ly; fy=ly+k*16
                c=ash(X,Y,seed=9)
                if fy<3: c=ST[6] if fy==0 else (ST[5] if fy==1 else ST[2])
                elif fy<7: c=mul(c,0.78)
                if fy>=44: c=ST[3] if fy<47 else ST[2]
                if 0<=X<Wpx and 0<=Y<Hpx: px[X,Y]=c+(255,)

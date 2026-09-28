# 버들항 v6 pieces (2026-09-28 user verdicts on v5): the big tower windmill (body + 8-frame sails), and shared helpers.
# Same fixed front-above view and chipset ramps as every other piece; outlines are inset (pz.fin); light from upper left.
import sys, os, math, random; sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from PIL import Image, ImageDraw
import palette
from px2 import _hash
import pz, pv, pj, terrain, roman
from roman import ST, TRV, TC, WDr, CRM, mul, mix, ramp
WD=terrain.WD
def put(px,W,H,x,y,c,a=255):
    if 0<=x<W and 0<=y<H: px[x,y]=tuple(c[:3])+(a,)

# ======================= windmill (verdict 1: a tall tower building, much larger than a house) =======================
# body 4 cells x 7 rows (64 x 112 px): a tapered round tower (stone plinth, plastered shaft, tiers of small windows, arched
# door with steps) under a shingled cap; the sails are a separate 120 x 120 sprite hung on the hub, radius 54 px (sweep
# ~6.8 cells), 4 lattice sails turning a quarter turn in 8 frames (the cross repeats every 90 deg -> seamless loop).
WMB_W,WMB_H=64,124
HUB=(32,29)                       # hub in body coordinates
SAIL_R=54; SAIL_C=60              # sail sprite is 2*SAIL_C square, hub at its centre
def windmill_body6():
    W,H=WMB_W,WMB_H; o=Image.new('RGBA',(W,H)); px=o.load()
    wall=pj.tex('tim.wall',W*2,H).load()
    y0,y1=40,116; ry=4                                                  # shaft top / bottom (axis), ellipse depth
    def half(y): return 15+(28-15)*max(0,min(1,(y-y0)/(y1-y0)))
    for y in range(y0-ry,y1+ry+1):
        for x in range(W):
            hf=half(max(y0,min(y1,y))); d=x+0.5-32
            if abs(d)>hf: continue
            u,cz=pv._wrap(d,hf); bow=ry*cz
            if y<y0+bow or y>y1+bow: continue
            yy=y-bow
            k=0.60+0.52*max(0,cz*0.8-0.25*(d/hf))
            if yy>=y1-10:                                                 # stone plinth: two courses of blocks
                row=int((yy-(y1-10))//5); bx=int((u+64+row*5)//10)
                t=5 if _hash(bx,row,31)<0.5 else 4
                if (yy-(y1-10))%5==4 or int(u+64+row*5)%10==0: t=3
                if yy>=y1-1: t=2
                c=ST[t]; k=min(1.05,k+0.08)
            else:
                c=wall[int(u+64)%(W*2),int(yy)%H]
                if abs(yy-(y1-11))<1: c=ST[3]                                # plinth coping
                if abs(yy-80)<1: c=ST[4]                                     # string course between the tiers
                if abs(yy-81)<1: c=mul(ST[3],1.0)
            put(px,W,H,x,y,mul(c,min(1.12,k)))
    # windows in tiers (on the lit half and the axis), each a small arch with a sill; door on the axis with steps
    def window(cx,top,h=9):
        for y in range(top,top+h):
            for x in range(cx-2,cx+3):
                r=abs(x+0.5-(cx+0.5))
                if y==top and r>1.1: continue
                edge=(x in (cx-2,cx+2)) or y==top or (y==top+1 and r>1.5)
                c=WD[4] if edge and x<=cx else (WD[2] if edge else ((33,45,66) if y<top+4 else (48,70,92)))
                put(px,W,H,x,y,c)
        for x in range(cx-3,cx+4): put(px,W,H,x,top+h,ST[5] if x<cx+2 else ST[4])
        put(px,W,H,cx-1,top+3,(63,162,174))
    window(32,46); window(25,60,8); window(39,64,8); window(32,86)
    cx=32; top=98; bot=y1+ry-1
    for y in range(top,bot):                                              # arched plank door
        for x in range(cx-6,cx+6):
            r=math.hypot(x+0.5-cx,(y-(top+6))*1.0)
            if y<top+6 and r>6: continue
            c=WD[3] if (x-cx)%4 else WD[2]
            if y in (top+10,top+17): c=WD[2]
            put(px,W,H,x,y,c)
    for a in range(0,181,6):                                              # stone arch ring round the door
        x=cx+7*math.cos(math.radians(a)); y=top+6-7*math.sin(math.radians(a))
        put(px,W,H,int(x),int(y),ST[5] if x<cx else ST[4])
    for y in range(top+6,bot): put(px,W,H,cx-7,y,ST[5]); put(px,W,H,cx+6,y,ST[4])
    put(px,W,H,cx+3,top+13,roman.ramp('gold')[5])
    for j,(w_,t) in enumerate(((10,6),(12,5))):                          # two steps in front of the door
        yy=bot+j
        for x in range(cx-w_,cx+w_): put(px,W,H,x,yy,ST[t] if x<cx+w_-2 else ST[3])
    # cap: a boat-shaped dome of wooden shingles in courses that bow like the shaft (lit left, shaded right), eave board
    cb=42; ct=14; CW=21
    for y in range(ct,cb+ry+1):
        t=(cb-y)/(cb-ct)
        hf=CW*math.sqrt(max(0,1-t*t)) if y<=cb else CW
        for x in range(W):
            d=x+0.5-32
            if abs(d)>hf or hf<0.5: continue
            u,cz=pv._wrap(d,hf); bow=ry*cz*(hf/CW)
            if y>cb+bow: continue
            yy=y-bow; course=int((yy-ct)//3); off=3 if course%2 else 0; sx=int((u+64+off)//6)
            lit=-(d/CW)*0.7+(1-t)*0.0
            tt=4 if lit>0.25 else (3 if lit>-0.3 else 2)
            if (yy-ct)%3>=2: tt=max(1,tt-1)
            elif int(u+64+off)%6==0: tt=max(1,tt-1)
            elif _hash(sx,course,77)<0.25: tt=min(5,tt+1)
            if t>0.82: tt=min(5,tt+1) if d<0 else tt
            if abs(abs(d)-hf)<1.2: tt=5 if d<0 else 1
            put(px,W,H,x,y,WD[tt])
    for x in range(W):
        d=x+0.5-32
        if abs(d)<=CW:
            u,cz=pv._wrap(d,CW); yb=int(cb+ry*cz)
            put(px,W,H,x,yb,WD[4] if d<0 else WD[2]); put(px,W,H,x,yb+1,WD[1])
    for y in range(ct-5,ct+1): put(px,W,H,31,y,WD[4]); put(px,W,H,32,y,WD[2])
    put(px,W,H,31,ct-6,roman.ramp('gold')[5]); put(px,W,H,32,ct-6,roman.ramp('gold')[4])
    # windshaft housing on the cap front (the hub sits on it)
    for y in range(HUB[1]-5,HUB[1]+6):
        for x in range(HUB[0]-5,HUB[0]+6):
            if math.hypot(x+0.5-HUB[0],y+0.5-HUB[1])<=5.2: put(px,W,H,x,y,WD[3] if x<HUB[0] else WD[2])
    return pz.fin(o)

def windmill_sails6(frame,NF=8):
    # per-pixel, 3x3 supersampled: each sail = a stock (whip) from the hub + a lattice frame on its trailing side with
    # canvas over it; the classes win in order stock > frame rail > lattice bar > canvas. Outline = inset darkest wood.
    S=SAIL_C*2; o=Image.new('RGBA',(S,S)); px=o.load(); R=SAIL_R
    a0=(frame%NF)*(math.pi/2)/NF
    CAN=[mix(CRM[4],CRM[5],0.4),CRM[4],CRM[3],CRM[2]]          # canvas light .. dark
    def cls(x,y):
        best=None
        for k in range(4):
            a=a0+k*math.pi/2; ca,sa=math.cos(a),math.sin(a)
            u=x*ca+y*sa; v=-x*sa+y*ca
            if u<0 or u>R: continue
            if abs(v)<=1.6 and u>=5: return ('stock',k,u,v)
            if u>=R*0.24 and u<=R-1 and 1.6<v<=12.5:
                vv=v-1.6
                if vv>=9.9 or u>=R-2.2 or u<=R*0.24+1.2: c=('rail',k,u,vv)
                elif (u-R*0.24)%6.5<1.1: c=('bar',k,u,vv)
                else: c=('can',k,u,vv)
                if best is None or ['rail','bar','can'].index(c[0])<['rail','bar','can'].index(best[0]): best=c
        return best
    for Y in range(S):
        for X in range(S):
            votes={}
            for sy in (-1/3,0,1/3):
                for sx in (-1/3,0,1/3):
                    c=cls(X+0.5+sx-SAIL_C,Y+0.5+sy-SAIL_C)
                    key=c[0] if c else None; votes[key]=votes.get(key,0)+1
                    if c: votes.setdefault('_'+c[0],c)
            k_=max((k for k in votes if not str(k).startswith('_')),key=lambda k:votes[k])
            if k_ is None or votes[k_]<4: continue
            c=votes['_'+k_]; kind,sk,u,v=c
            if kind=='stock':
                col=WD[5] if v<0 else WD[3]
                if int(u)%9==0: col=WD[2]
            elif kind=='rail': col=WD[4] if int(u)%2 else WD[3]
            elif kind=='bar': col=WD[3]
            else:
                t=0 if v<3.5 else (1 if v<7 else 2)
                if (u-R*0.24)%6.5>5.2: t=min(3,t+1)                   # the cloth sags between the bars
                col=CAN[t]
            px[X,Y]=col+(255,)
    # hub boss
    for Y in range(SAIL_C-4,SAIL_C+5):
        for X in range(SAIL_C-4,SAIL_C+5):
            r=math.hypot(X+0.5-SAIL_C,Y+0.5-SAIL_C)
            if r<=4.2: px[X,Y]=(WD[5] if (X-SAIL_C)+(Y-SAIL_C)<-1 else (WD[4] if r<2.5 else WD[2]))+(255,)
    px[SAIL_C-1,SAIL_C-1]=roman.ramp('gold')[5]+(255,)
    return pz.fin(o)
def windmill_sail_offset(): return (HUB[0]-SAIL_C,HUB[1]-SAIL_C)

# ======================= review sheet helper =======================
def lawnbg(w,h):
    from sheet2 import lawn
    bg=Image.new('RGBA',(w,h))
    for x in range(0,w,16):
        for y in range(0,h,16): bg.paste(lawn,(x,y))
    return bg
def review(out,items,S=4,label=True):
    # items: [(title, image)] placed bottom-aligned on lawn, side by side with chipset-idiom houses for comparison
    import ph2
    ref=[('칩셋 집 (반목조 6칸 2층)',ph2.house('tim',6,2,seed=3)['im']),('칩셋 집 (석조 5칸)',roman.terracotta(ph2.house('sto',5,1,seed=4)['im'],1))]
    allit=ref+list(items); pad=8
    H=max(i.height for _,i in allit)+2*pad; W=sum(i.width+2*pad for _,i in allit)
    bg=lawnbg(W,H); x=0
    for t,im in allit:
        bg.alpha_composite(im,(x+pad,H-pad-im.height)); x+=im.width+2*pad
    big=bg.resize((W*S,H*S),Image.NEAREST)
    if label:
        from PIL import ImageFont
        try: f=ImageFont.truetype('/usr/share/fonts/truetype/nanum/NanumGothic.ttf',14)
        except Exception: f=None
        o=Image.new('RGBA',(big.width,big.height+22),(27,28,31,255)); o.paste(big,(0,22)); d=ImageDraw.Draw(o); x=0
        for t,im in allit: d.text((x*S+4,3),t,fill=(230,230,230),font=f); x+=im.width+2*pad
        big=o
    big.save(out)

# ======================= chipset tiles as textures =======================
_CT={}
def ctile(tx,ty):
    if (tx,ty) not in _CT: _CT[(tx,ty)]=terrain.CH.crop((tx,ty,tx+16,ty+16)).convert('RGB').load()
    return _CT[(tx,ty)]
def ctex(tx,ty,X,Y): return ctile(tx,ty)[X%16,Y%16]
PLASTER=(248,16); PALEASH=(224,160); PALEASH_D=(224,176)
GOLD=ramp('gold')

# ======================= forum (verdict 2: squared-up, the chipset houses' fixed view) =======================
def _col_shaft(px,W,H,cx,y0,y1,w=7,R=None,cap=True):
    # a column seen from the front: capital (2 rows, wider), shaft lit left / shaded right with two flutes, base (2 rows)
    R=R or CRM; tones={5:[6,5,4,3,2],6:[6,5,5,4,3,2],7:[6,6,5,4,4,3,2]}[w]; x0=cx-w//2
    for y in range(y0+2,y1-1):
        for i in range(w):
            t=tones[i]
            if i in (1,w-2) and y%3==0: t=max(2,t-1)
            put(px,W,H,x0+i,y,R[t])
    if cap:
        for y in (y0,y0+1):
            for i in range(-1,w+1): put(px,W,H,x0+i,y,R[6 if y==y0 and i<w-1 else (5 if i<w//2+1 else 3)])
    for y in (y1-1,y1):
        for i in range(-1,w+1): put(px,W,H,x0+i,y,R[5 if (y<y1 and i<w-1) else 3])
def _entablature(px,W,H,y,x0=0,x1=None,inscr=True):
    # cornice (lit fillet + dentils), frieze with an inscription, architrave, shadow line: 8 rows
    x1=W if x1 is None else x1
    for x in range(x0,x1):
        put(px,W,H,x,y,CRM[6]); put(px,W,H,x,y+1,CRM[5]); put(px,W,H,x,y+2,CRM[5] if x%3 else CRM[2])
        for yy in (y+3,y+4,y+5): put(px,W,H,x,y+yy-y,mix(CRM[4],CRM[5],0.25))
        put(px,W,H,x,y+6,CRM[5]); put(px,W,H,x,y+7,CRM[3])
    if inscr:
        n=(x1-x0)//2; a=x0+n//2+(x1-x0)//8; b=x1-n//2-(x1-x0)//8
        for x in range(a,b):
            if (x-a)%4 in (0,1) and _hash(x//4,y,5)<0.85: put(px,W,H,x,y+4,CRM[2])
def temple6(wc=7):
    # a Roman temple in the chipset houses' view: the roof seen from above with its ridge running away (north-south
    # courses, lit left slope, shaded right, far peak rising as much as the front pediment), the pediment as the gable
    # wall, entablature, a hexastyle porch before the shaded cella wall with a bronze door, the podium face in pale
    # ashlar and a stair (treads lit, risers shaded) coming down toward the viewer. wc x 7 rows.
    W=wc*16; H=112; o=Image.new('RGBA',(W,H)); px=o.load(); gx=W/2
    RH=52; G=20; top=RH-G
    lit=pj.nstex('tim','l',W,RH).load(); dk=pj.nstex('tim','r',W,RH).load(); pl=pj.tex('tim.wall',W,RH).load()
    for y in range(RH):
        for x in range(W):
            d=abs(x+0.5-gx)
            if y<G and d>gx*(y+1)/G: continue                                   # the far pediment's peak over the roof
            c=(lit if x<gx else dk)[x,y]
            if d<1 and y<top: c=mul(c,1.25) if x<gx else mul(c,0.6)             # ridge
            if y>=top:
                half=gx*(y-top+1)/G
                if d<=half-3: c=mix(pl[x,y],CRM[4],0.35)                          # tympanum
                elif d<=half-1.5: c=CRM[3] if x<gx else CRM[2]                     # raking cornice underside
                elif d<=half: c=CRM[6] if x<gx else CRM[4]                         # raking cornice
            elif y<G and d>gx*(y+1)/G-2: c=CRM[5] if x<gx else CRM[3]             # far raking cornice
            elif x<2: c=CRM[5] if x==1 else CRM[2]                                 # eaves along the long sides
            elif x>=W-2: c=CRM[3] if x==W-2 else CRM[1]
            put(px,W,H,x,y,c)
    # tympanum relief: a gilded round shield on a laurel
    cy=top+int(G*0.62); cx=int(gx)
    for y in range(cy-4,cy+4):
        for x in range(cx-5,cx+5):
            r=math.hypot((x+0.5-gx)/5.0,(y+0.5-cy)/3.6)
            if r<=1: put(px,W,H,x,y,GOLD[5] if (x<cx and y<cy) else (GOLD[4] if r<0.6 else GOLD[3]))
    for k in range(7):
        put(px,W,H,cx-7-k,cy+1-k//3,LEAF6[3]); put(px,W,H,cx+6+k,cy+1-k//3,LEAF6[2])
    _entablature(px,W,H,52)
    # porch: shaded cella wall, bronze door, six columns
    for y in range(60,90):
        for x in range(1,W-1):
            k=0.42+0.16*min(1,(y-60)/22)
            put(px,W,H,x,y,mul(mix(pl[x,y%RH],CRM[3],0.5),k))
    for y in range(60,64):
        for x in range(1,W-1): put(px,W,H,x,y,mul(CRM[2],0.8))           # the porch ceiling's shadow
    dx0=int(gx)-6
    for y in range(66,90):
        for x in range(dx0,dx0+12):
            edge=x in (dx0,dx0+11) or y==66
            c=GOLD[2] if edge else (GOLD[3] if (x-dx0) in (3,8) or y in (73,82) else GOLD[4] if x<gx else GOLD[3])
            if x in (int(gx)-1,int(gx)): c=GOLD[1]
            put(px,W,H,x,y,c)
    for x in range(dx0-2,dx0+14): put(px,W,H,x,65,CRM[6] if x<gx else CRM[5])
    for y in range(65,90): put(px,W,H,dx0-1,y,CRM[5]); put(px,W,H,dx0+12,y,CRM[3])
    n=6; xs=[round(9+(W-18)*i/(n-1)) for i in range(n)]
    if n==6: xs=[9,27,45,W-45,W-27,W-9]
    for cx_ in xs: _col_shaft(px,W,H,cx_,60,89,7)
    # podium: stylobate, ashlar face, base moulding; stair 3 cells wide in the middle with cheek walls
    sx0=W//2-24; sx1=W//2+24
    for y in range(90,H):
        for x in range(W):
            if sx0<=x<sx1:
                s=(y-90)%4; c=CRM[(6,5,4,3)[s]]
                if x in (sx0,sx0+1): c=CRM[5] if x==sx0 else CRM[4]
                if x in (sx1-2,sx1-1): c=CRM[3] if x==sx1-2 else CRM[2]
                if y>=H-1: c=CRM[2]
            else:
                if y==90: c=CRM[6]
                elif y==91: c=CRM[4]
                elif y<106: c=ctex(*PALEASH,x,y-92)
                elif y<108: c=CRM[5] if y==106 else CRM[4]
                else: c=CRM[3] if y<H-1 else CRM[2]
                if x<2 or x>=W-2: c=mul(c,0.8)
            put(px,W,H,x,y,c)
    return pz.fin(o)
LEAF6=[terrain.hx(c) for c in ['#071528']+palette.RAMPS_CHIP['leaf']]
def stoa6(wc=5,seed=2):
    # a roofed colonnade seen from the front: the chipset range roof (lit back slope, shaded front slope, hip ends,
    # overhang + eave shadow), entablature, columns before a shaded back wall with shop doors, a stylobate with a step.
    import ph2
    W=wc*16; RH=34; H=80; o=Image.new('RGBA',(W,H)); px=o.load()
    roof=ph2.steep_hip('tim',W,RH); o.alpha_composite(roof,(0,0)); px=o.load()
    pl=pj.tex('tim.wall',W,H).load()
    _entablature(px,W,H,RH,inscr=False)
    r=random.Random(seed)
    for y in range(RH+8,RH+38):
        for x in range(W):
            k=0.42+0.16*min(1,(y-RH-8)/24); put(px,W,H,x,y,mul(mix(pl[x,y],CRM[3],0.5),k))
    for y in range(RH+8,RH+11):
        for x in range(W): put(px,W,H,x,y,mul(CRM[2],0.78))
    for b in range(wc-1):
        x0=b*16+12
        if b%2==0:                                                         # shop doors between the columns
            for y in range(RH+17,RH+37):
                for x in range(x0,x0+8):
                    edge=x in (x0,x0+7) or y==RH+17
                    put(px,W,H,x,y,WD[4] if edge else (WD[2] if (x-x0)%3==0 else WD[3]))
        elif r.random()<0.7:                                               # an amphora against the wall
            cx=b*16+16
            for y in range(RH+27,RH+37):
                w_=2+(1 if RH+29<=y<=RH+34 else 0)
                for x in range(cx-w_,cx+w_+1): put(px,W,H,x,y,TC[5] if x<cx else TC[3])
    for k in range(wc): _col_shaft(px,W,H,k*16+8,RH+8,RH+37,6)
    for y in range(RH+38,RH+46):
        for x in range(W):
            c=CRM[(6,5,4,4,6,5,3,2)[y-RH-38]]
            put(px,W,H,x,y,c)
    import ph2 as _p
    o=_p.volume(o,RH,o=2,shadow=3)
    return pz.fin(o)
def forum_gate6():
    # the forum entrance: a single-bay arch seen from the front, 5 cells x 4 rows: attic top (foreshortened), inscribed
    # attic, cornice, two ashlar piers each with a pair of engaged columns on a plinth, an elliptical arch with voussoirs
    # and keystone, the vault's shaded soffit inside the opening (the ground shows through below it). The three middle
    # columns of cells are walkable (the passage); the piers are blocked.
    W,H=80,64; o=Image.new('RGBA',(W,H)); px=o.load(); pl=pj.tex('tim.wall',W,H).load()
    cx,cy,rx,ry=40,40,22,18
    def opening(x,y): return 18<=x<62 and y>=20 and (x+0.5-cx)**2/rx**2+(max(0,cy-(y+0.5)))**2/ry**2<1
    for y in range(H):
        for x in range(W):
            if y<5: c=CRM[(6,5,5,5,4)[y]] if 1<=x<W-1 else None
            elif y<19:
                if y==5: c=CRM[6]
                elif y==6: c=CRM[5] if x%3 else CRM[2]
                elif y<16: c=mix(pl[x,y],CRM[4],0.35)
                elif y==16: c=CRM[5]
                elif y==17: c=CRM[3]
                else: c=mul(CRM[2],0.9)
            else:
                if opening(x,y): continue
                c=ctex(*PALEASH,x,y)
                e=(x+0.5-cx)**2/(rx+4)**2+(max(0,cy-(y+0.5)))**2/(ry+4)**2
                if 14<=x<66 and e<1 and y<cy+1:                                  # voussoir ring
                    ang=math.degrees(math.atan2(cy-(y+0.5),x+0.5-cx))
                    c=CRM[5] if x<cx else CRM[4]
                    if int(ang+180)%15<2: c=CRM[3]
                    if abs(x+0.5-cx)<3 and y<cy-ry+4: c=CRM[6] if x<cx else CRM[5]   # keystone
                for p0 in (2,9,64,71):                                           # engaged columns on the piers
                    if p0<=x<p0+6 and 21<=y<H-5: c=CRM[(6,5,5,4,3,2)[x-p0]] if y>22 else CRM[6]
                    if p0-1<=x<p0+7 and y in (19,20): c=CRM[6] if y==19 else CRM[4]
                if y>=H-5: c=CRM[(6,5,4,3,2)[y-(H-5)]]                          # plinth
            if c is None: continue
            if x<1 or x>=W-1: c=mul(c,0.8)
            put(px,W,H,x,y,c)
    for x in range(18,62):                                                        # vault soffit (depth)
        for y in range(19,H):
            if opening(x,y) and not opening(x,y-4): put(px,W,H,x,y,mul(CRM[2],0.55 if x>cx else 0.7))
    for x in range(22,58):                                                        # inscription
        if (x-22)%4 in (0,1) and _hash(x//4,3,9)<0.9: put(px,W,H,x,10,CRM[2]); put(px,W,H,x,12,CRM[2]) if (x//4)%3 else None
    return pz.fin(o)

# ======================= noble estate (verdict 4: one material set - stucco walls + terracotta tile) =======================
# Every estate piece shares it: cream stucco (the chipset's plaster), pale stone dressings (quoins, window surrounds,
# cornices, portico - the chipset's plaster/stone light tones), terracotta tile (the chipset's orange roof pair) on the
# manor, the wings, the lodge, the coach house, the gate-pier caps and the wall coping; terracotta urns on the piers.
RW=[terrain.hx(c) for c in [palette.OUT_CHIP['roofw']]+palette.RAMPS_CHIP['roofw']]
def _quoin(px,W,H,x0,y0,y1,left=True):
    k=0
    for y in range(y0,y1):
        blk=(y-y0)//5; w=5 if blk%2==0 else 3
        for i in range(w):
            x=x0+i if left else x0-i
            c=CRM[5] if (y-y0)%5 else CRM[3]
            if (y-y0)%5==1: c=CRM[6]
            put(px,W,H,x,y,c)
def stucco_facade(wc,storeys,door=None,tall=32,skip=(),seed=0,carriage=False):
    # cream stucco front with stone quoins, a cornice between storeys, a plinth; one window per cell (stone surround,
    # a small cap, brown shutters), a panelled door with a fanlight on cell `door`, cells in `skip` left plain
    W=wc*16; H=storeys*tall; o=Image.new('RGBA',(W,H)); px=o.load()
    for y in range(H):
        for x in range(W):
            c=ctex(*PLASTER,x,y)
            if y%tall==0 and y>0: c=CRM[6]
            elif y%tall==1 and y>1: c=CRM[3]
            if y>=H-4: c=CRM[(5,4,4,2)[y-(H-4)]]
            put(px,W,H,x,y,c)
    _quoin(px,W,H,0,0,H-4,True); _quoin(px,W,H,W-1,0,H-4,False)
    for s in range(storeys):
        for k in range(wc):
            if k in skip and s==storeys-1 and k!=door: continue
            if door is not None and s==storeys-1 and k==door:
                x0=k*16+3; y0=s*tall+(9 if tall>=32 else 7)
                dw=10 if not carriage else 12
                for y in range(y0-3,H-4):
                    for x in range(x0-1,x0+dw+1):
                        edge=x in (x0-1,x0+dw) or y==y0-3
                        if y<y0: c=GL[1] if not edge else CRM[6]
                        else: c=CRM[6] if (edge and x<x0+dw//2) else (CRM[4] if edge else (WD[3] if (x-x0)%5 else WD[2]))
                        if not edge and y>=y0 and (y-y0)%7==0: c=WD[2]
                        put(px,W,H,x,y,c)
                put(px,W,H,x0+dw-3,y0+10,GOLD[5])
                continue
            x0=k*16+5; y0=s*tall+8; wh=min(13,tall-14)
            for y in range(y0-2,y0+wh+2):
                for x in range(x0-1,x0+7):
                    if y<y0: c=CRM[6] if y==y0-2 else CRM[4]                           # window cap
                    elif y>=y0+wh: c=CRM[5] if y==y0+wh else CRM[3]                    # sill
                    elif x in (x0-1,x0+6): c=CRM[6] if x==x0-1 else CRM[4]
                    else: c=GL[1] if y<y0+wh//2 else GL[2]
                    if x==x0+2 and y0<=y<y0+wh: c=CRM[5]
                    put(px,W,H,x,y,c)
            put(px,W,H,x0,y0+1,GL[3]); put(px,W,H,x0,y0+2,GL[3])
            for y in range(y0,y0+wh):                                            # shutters
                for x in (x0-3,x0-2,x0+7,x0+8):
                    put(px,W,H,x,y,WD[3] if (y-y0)%3 else WD[2])
    return o
GL=[(7,21,40),(33,45,66),(48,70,92),(63,162,174)]
def tile_house(wc,storeys,door=None,Rh=40,chim=True,hipped=True,seed=0,skip=(),carriage=False,tall=32):
    import ph2
    f=stucco_facade(wc,storeys,door=door,tall=tall,skip=skip,seed=seed,carriage=carriage); pad=16 if chim else 0
    im=Image.new('RGBA',(wc*16,pad+Rh+f.height)); im.alpha_composite(ph2.steep_hip('tim',wc*16,Rh,ends=hipped),(0,pad)); im.alpha_composite(f,(0,pad+Rh))
    im=ph2.volume(im,pad+Rh); ch=[]
    if chim:
        for cx in ([16,wc*16-32] if wc>=6 else [0 if (door or 0)>0 else (wc-1)*16]):
            ch.append(ph2.chimney(im,cx,pad-12+int(Rh*0.25),'tim'))
    return dict(im=pz.fin(im),door=door,chim=ch,below=0,above=pad)
def portico6(wc=5):
    # a porch in the temple manner, smaller: tiled gable roof running back to the facade (lit left / shaded right slopes),
    # pediment with a raking cornice, entablature, four columns (the door shows between the middle pair), two steps
    W=wc*16; H=72; o=Image.new('RGBA',(W,H)); px=o.load(); gx=W/2; RH=28; G=16; top=RH-G
    lit=pj.nstex('tim','l',W,RH).load(); dk=pj.nstex('tim','r',W,RH).load(); pl=pj.tex('tim.wall',W,RH).load()
    for y in range(RH):
        for x in range(W):
            d=abs(x+0.5-gx)
            if y<top:
                c=(lit if x<gx else dk)[x,y]
                if d<1: c=mul(c,1.25) if x<gx else mul(c,0.6)
                if x<2: c=CRM[5] if x==1 else CRM[2]
                elif x>=W-2: c=CRM[3] if x==W-2 else CRM[1]
            else:
                half=gx*(y-top+1)/G
                if d>half: c=(lit if x<gx else dk)[x,y] if d<gx else None
                elif d<=half-3: c=mix(pl[x,y],CRM[4],0.35)
                elif d<=half-1.5: c=CRM[3] if x<gx else CRM[2]
                else: c=CRM[6] if x<gx else CRM[4]
            if c is not None: put(px,W,H,x,y,c)
    for y in range(RH,RH+6):
        for x in range(W): put(px,W,H,x,y,CRM[(6,5,4,4,5,3)[y-RH]])
    for y in range(RH+6,RH+34):
        for x in range(1,W-1): put(px,W,H,x,y,mul(mix(pl[x,y%RH],CRM[3],0.4),0.62+0.2*(y-RH-6)/28))
    xs=[8,8+(W-16)//3,W-8-(W-16)//3,W-8]
    for cx_ in xs: _col_shaft(px,W,H,cx_,RH+6,RH+33,5)
    for y in range(RH+34,H):
        for x in range(W): put(px,W,H,x,y,CRM[(6,5,5,3,6,5,4,3,2,2)[min(9,y-RH-34)]])
    return o
def gate_pier6(urn=True):
    # a stucco gate pier with stone quoins, a small terracotta-tile cap seen from above, and a terracotta urn
    W,H=16,52; o=Image.new('RGBA',(W,H)); px=o.load()
    for y in range(22,H):
        for x in range(1,15):
            c=ctex(*PLASTER,x,y)
            if y>=H-3: c=CRM[3] if y<H-1 else CRM[2]
            put(px,W,H,x,y,c)
    _quoin(px,W,H,1,24,H-3,True); _quoin(px,W,H,14,24,H-3,False)
    t=ctile(240,192)
    for y in range(14,22):                                           # tiled cap (a tiny hip roof)
        for x in range(0,16):
            e=(22-y)*0.9
            if x<e-4 or x>15-e+4: continue
            c=t[x,(y*2)%16]
            if y==21: c=RW[2]
            if y==14: c=RW[5]
            put(px,W,H,x,y,c)
    if urn:
        for y in range(2,14):
            hw=[2,3,3,4,5,5,5,4,3,2,3,4][y-2]
            for x in range(8-hw,8+hw):
                c=RW[5] if x<7 else (RW[4] if x<9 else RW[3])
                if y in (2,12): c=RW[3]
                put(px,W,H,x,y,c)
    return pz.fin(o)
def estate_wall(maskgrid):
    # a low stucco garden wall with a terracotta tile coping, drawn per cell from its N/E/S/W neighbours
    Hh=len(maskgrid); Ww=len(maskgrid[0]); o=Image.new('RGBA',(Ww*16,Hh*16+2)); px=o.load(); W,H=o.size
    def on(x,y): return 0<=x<Ww and 0<=y<Hh and maskgrid[y][x]
    t=ctile(240,192); tr=ctile(224,208)
    for cy in range(Hh):
        for cx in range(Ww):
            if not maskgrid[cy][cx]: continue
            n,e,s,w=on(cx,cy-1),on(cx+1,cy),on(cx,cy+1),on(cx-1,cy)
            X0,Y0=cx*16,cy*16
            # vertical run: coping band seen from above
            if n or s or not (e or w):
                for y in range(0 if n else 4,16 if s else 9):
                    for x in range(4,12):
                        c=tr[(y+3)%16,x] if 5<=x<=10 else (RW[5] if x==4 else RW[2])
                        put(px,W,H,X0+x,Y0+y,c)
                if not s:
                    for y in range(9,15):
                        for x in range(4,12): put(px,W,H,X0+x,Y0+y,mul(ctex(*PLASTER,X0+x,Y0+y),0.92) if y<14 else CRM[2])
            if e or w:
                for x in range(0 if w else 4,16 if e else 12):
                    for y in range(4,15):
                        if y<8: c=t[x,(y*3)%16] if y>4 else RW[5]
                        elif y==8: c=RW[2]
                        elif y<14: c=ctex(*PLASTER,X0+x,Y0+y)
                        else: c=CRM[2]
                        put(px,W,H,X0+x,Y0+y,c)
    return pz.fin(o)

def manor6():
    # 13 cells, symmetric: 2-storey wing (3) + 3-storey centre (7) + wing (3), stucco + stone quoins + terracotta hipped
    # roofs, two chimneys, a 5-cell portico on the axis (the door shows between its middle columns), steps 8 px below
    c=tile_house(7,3,door=3,Rh=44,skip=(1,2,4,5)); wl=tile_house(3,2,Rh=40,chim=False); wr=tile_house(3,2,Rh=40,chim=False)
    W=13*16; base=c['im'].height; H=base+8; im=Image.new('RGBA',(W,H))
    im.alpha_composite(wl['im'],(0,base-wl['im'].height)); im.alpha_composite(wr['im'],(W-48,base-wr['im'].height))
    im.alpha_composite(c['im'],(48,0))
    po=portico6(5); pp=po.load()
    for y in range(28+12,28+34):
        for x in range(33,48): pp[x,y]=(0,0,0,0)
    im.alpha_composite(pz.fin(po),(48+16,H-po.height))
    return dict(im=im,door=6,chim=[(x+48,y) for x,y in c['chim']],below=8,above=c['above'])

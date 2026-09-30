# 버들항 v5 "로마풍": paving (travertine forum flags, calm court flagstones, gravel), terracotta roof recolour, the grand
# stone arch bridge (back = walkable deck + far balustrade, front = near balustrade + arched face + cutwaters) and the
# Roman props (statue on plinth, cypress, umbrella pine, stoa, temple front, portico, aqueduct, cafe terrace pieces,
# reeds, carriage ...). Same fixed front-above view and chipset ramps as every other piece; outlines are inset (pz.fin).
import sys, os, math, random; sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from PIL import Image, ImageDraw
import palette
from px2 import C, PAL, _hash, vnoise
import pz, terrain
def hx(s): s=s.lstrip('#'); return tuple(int(s[i:i+2],16) for i in (0,2,4))
def ramp(m): return [hx(c) for c in PAL[m]]
ST=terrain.ST                     # 0 outline .. 6 light (chipset stone)
CRM=[hx(c) for c in ['#2b203f']+palette.RAMPS_CHIP['plaster']]
WDr=[hx(c) for c in [palette.OUT_CHIP['wood']]+palette.RAMPS_CHIP['wood']]
LFr=[hx(c) for c in ['#071528']+palette.RAMPS_CHIP['leaf']]
# terracotta: chipset roof reds, one step between the brick red and the orange
TC=[hx(c) for c in ['#2b203f','#562945','#7a2e2c','#9a3a26','#b85530','#cf7446','#e89a62']]
TRV=[hx(c) for c in ['#3a2c20','#6c5c4c','#9e8d83','#bcaaa0','#d2c6b0','#e2d6c0','#f2ead8']]   # travertine
def mul(c,k): return tuple(max(0,min(255,int(v*k))) for v in c[:3])
def mix(a,b,t): return tuple(int(a[i]+(b[i]-a[i])*t) for i in range(3))

# ---------------- paving ----------------
def tex_travertine(X,Y):
    # large flags 32x24 in running bond; faces calm (tone 4 with sparse tone 5 flecks and a few pores), joints tone 3
    row=Y//24; off=(row%2)*16; col=(X+off)//32; lx=(X+off)%32; ly=Y%24
    if ly==23 or lx==31: return TRV[2] if (lx==31 and ly==23) else TRV[3]
    h=_hash(col,row,71); base=TRV[4] if h<0.7 else TRV[5]
    if ly==0 or lx==0: return mix(base,TRV[6],0.5)
    r=_hash(X,Y,72)
    if r<0.05: return TRV[5] if base==TRV[4] else TRV[4]
    if r>0.992: return TRV[3]
    return base
def tex_opus(X,Y,cx,cy):
    # a calm opus-sectile medallion: a band of grey stone framing travertine squares turned 45 degrees
    dx=abs(X-cx); dy=abs(Y-cy)
    if max(dx,dy)%48 in (0,1,2,3): return ST[4] if max(dx,dy)%48 in (1,2) else ST[3]
    if (dx+dy)%24==0: return TRV[3]
    return TRV[5] if ((dx+dy)//24)%2 else TRV[4]
def tex_flag(X,Y,seed=5):
    # calm grey flagstones: rows 12..16 px tall, flags 14..26 wide, faces one tone with sparse grain, dark joints
    rh=(13,15,12,16,14); acc=0; row=0
    per=sum(rh); yy=Y%per; base_row=(Y//per)*len(rh)
    for i,h in enumerate(rh):
        if yy<acc+h: row=base_row+i; ly=yy-acc; hh=h; break
        acc+=h
    x=X+int(_hash(row,0,seed)*40); w=0; col=0
    # widths from a hash sequence (period 96 px so the pattern tiles)
    xs=x%96; edges=[0]; k=0
    while edges[-1]<96:
        edges.append(edges[-1]+14+int(_hash(row%10,k,seed+1)*12)); k+=1
    edges[-1]=96
    for i in range(len(edges)-1):
        if edges[i]<=xs<edges[i+1]: col=i; lx=xs-edges[i]; w=edges[i+1]-edges[i]; break
    if ly==hh-1 or lx==w-1: return ST[3]
    hh_=_hash(col,row,seed+2); c=mix(ST[4],ST[5],0.12+0.3*hh_)
    if ly==0 or lx==0: c=mix(c,ST[5],0.35)
    if _hash(X,Y,seed+3)<0.035: c=mix(c,ST[5],0.5)
    return c
GRV=[hx(c) for c in ['#3a2c20','#6c5c4c','#8c7c64','#a89878','#c4b492','#d8caa8','#ece2c4']]
def tex_gravel(X,Y):
    h=_hash(X,Y,91); n=vnoise(X,Y,3,92)
    c=GRV[4] if n<0.55 else GRV[5]
    if h<0.12: c=GRV[3]
    elif h>0.93: c=GRV[6]
    return c
def paving5(mask,tex,joins=None,curb=True,edge=None):
    # like terrain.paving but with a texture function on global pixel coords (flags span cells). curb: a 2px kerb of
    # light stone with a 1px dark joint where the paving meets anything that is not paving/joins.
    H=len(mask); W=len(mask[0]); im=Image.new('RGBA',(W*16,H*16)); px=im.load()
    def on(x,y): return 0<=x<W and 0<=y<H and (mask[y][x] or (joins is not None and joins[y][x]))
    for cy in range(H):
        for cx in range(W):
            if not mask[cy][cx]: continue
            n,s,w,e=on(cx,cy-1),on(cx,cy+1),on(cx-1,cy),on(cx+1,cy)
            for ly in range(16):
                for lx in range(16):
                    X,Y=cx*16+lx,cy*16+ly; c=tex(X,Y)
                    if curb:
                        d=min(ly if not n else 99,15-ly if not s else 99,lx if not w else 99,15-lx if not e else 99)
                        if d==0: c=ST[1]
                        elif d<3: c=(edge or ST)[5] if (X//6+Y//6)%2 else (edge or ST)[4]
                    px[X,Y]=c+(255,)
    return im

# ---------------- terracotta roofs ----------------
def terracotta(im,seed=0,top=None):
    # recolour slate (blue-violet) roof pixels to terracotta by luminance; keeps every other colour. top: only rows < top
    im=im.copy(); p=im.load(); W,H=im.size
    shift=[0,0.04,-0.05][seed%3]
    for y in range(H if top is None else min(H,top)):
        for x in range(W):
            r,g,b,a=p[x,y]
            if a==0: continue
            mx=max(r,g,b); mn=min(r,g,b)
            if b>r+8 and b>g+14 and mx-mn>18:
                l=(0.3*r+0.59*g+0.11*b)/255
                t=min(6,max(1,int(l*9.0+0.8+shift*10)))
                c=TC[t]; p[x,y]=c+(a,)
    return im

# ---------------- small helpers ----------------
def lamp_head(c,cx,y,g):
    pz.lantern(c,cx,y,g,glow=6)
def iron_post(c,x,y0,y1):
    c.new()
    for y in range(y0,y1+1): c.tone(x,y,'iron',4); c.tone(x+1,y,'iron',2)
def toga_statue(c,cx,top,g0=20,mat='bone',pose=0):
    # a standing figure in a toga, ~22 px tall, one arm raised (pose 0) or holding a scroll (pose 1)
    c.group(g0); c.new()
    for y in range(top+6,top+22):
        w=3.2+(y-top-6)*0.12
        for x in range(int(cx-w),int(cx+w)+1):
            u=(x+0.5-cx)/w; t=5 if u<-0.3 else (4 if u<0.35 else 2)
            if (x+y)%5==0 and y>top+10: t=max(2,t-1)
            c.tone(x,y,mat,t)
    for x in range(int(cx-2),int(cx+3)): c.tone(x,top+13,mat,3)      # toga fold
    c.group(g0+1); c.ellipsoid(cx,top+3.5,2.6,3.0,mat,amb=0.35,bias=0.05)
    c.group(g0+2); c.new()
    if pose==0:
        for k in range(6): c.tone(int(cx+3+k*0.5),top+8-k,mat,4 if k<3 else 3); c.tone(int(cx+4+k*0.5),top+8-k,mat,2)
    else:
        for k in range(4): c.tone(int(cx-4),top+10+k,mat,4)
        c.tone(int(cx-5),top+12,'cream',5); c.tone(int(cx-5),top+13,'cream',4)

# ---------------- grand bridge ----------------
def bridge_grand(wc=4,statue=True):
    # E-W bridge over a N-S river wc cells wide. Returns dict with 'back' (far balustrade + deck, drawn with the ground),
    # 'front' (near balustrade, arched downstream face, cutwaters; sorted with the objects), their offsets relative to
    # the deck's top-left cell corner, and water effects: 'shade' (px list with factor), 'foam' points, 'reflect' img.
    A=12; RW=wc*16; W=RW+2*A; P=22
    narch=2 if wc<=4 else 3
    piers=[A+RW*i//narch for i in range(1,narch)]                  # middle pier centres
    # ---- back ----
    c=C(W,P+46,seed=611)
    DECK=[]
    for Y in range(P+14,P+46):
        for X in range(W):
            t=tex_flag(X,Y-P,seed=9); DECK.append((X,Y,t))
    back=Image.new('RGBA',(W,P+46)); bp=back.load()
    for X,Y,t in DECK: bp[X,Y]=t+(255,)
    for X in range(W):                                           # kerb lines along both balustrades
        bp[X,P+14]=ST[2]+(255,); bp[X,P+15]=ST[4]+(255,); bp[X,P+44]=ST[4]+(255,); bp[X,P+45]=ST[3]+(255,)
    ped=[(0,A)]+[(p-5,p+5) for p in piers]+[(W-A,W)]
    def in_ped(X): return any(a<=X<b for a,b in ped)
    for Y in range(P,P+14):                                      # far balustrade (its south face)
        y=Y-P
        for X in range(W):
            if in_ped(X):
                a,b=[pp for pp in ped if pp[0]<=X<pp[1]][0]
                t=6 if y<2 else (5 if X<(a+b)/2 else 3)
                if y==13: t=2
                bp[X,Y]=ST[t]+(255,); continue
            if y<3: bp[X,Y]=ST[(6,5,3)[y]]+(255,)
            elif y<11:
                k=X%5
                if k<3:
                    narrow=(y in (6,7))
                    if narrow and k!=1: continue
                    bp[X,Y]=ST[(5,4,2)[k] if not narrow else 4]+(255,)
            else: bp[X,Y]=ST[(4,4,2)[y-11]]+(255,)
    # lamps on the end pedestals (far side)
    cl=C(W,P+2,seed=612)
    for i,(a,b) in enumerate((ped[0],ped[-1])):
        cx=(a+b)//2; iron_post(cl,cx-1,6,P+1); lamp_head(cl,cx,0,10+i)
        cl.new(); [cl.tone(x,P+1,'iron',3) for x in range(cx-3,cx+3)]
    back.alpha_composite(pz.fin(cl),(0,0))
    # ---- front ----
    WL=78; FT=P+40                                              # waterline and top of the near balustrade (image y)
    H2=WL+16+P
    front=Image.new('RGBA',(W,H2)); fp=front.load()
    def arch_of(X):
        # opening test for the arch spans between abutments and piers
        edges=[A]+[q for p in piers for q in (p-4,p+4)]+[A+RW]
        for i in range(0,len(edges),2):
            a,b=edges[i],edges[i+1]
            if a<=X<b: return (a+b)/2,(b-a)/2
        return None
    shade=[]
    for Y in range(FT,H2):
        y=Y-P
        for X in range(W):
            if y<52:                                             # near balustrade
                yy=y-40
                if in_ped(X):
                    a,b=[pp for pp in ped if pp[0]<=X<pp[1]][0]
                    t=6 if yy<2 else (5 if X<(a+b)/2 else 3)
                    fp[X,Y]=ST[t]+(255,); continue
                if yy<3: fp[X,Y]=ST[(6,5,3)[yy]]+(255,)
                elif yy<9:
                    k=X%5
                    if k<3 and not (yy in (5,6) and k!=1): fp[X,Y]=ST[(5,4,2)[k] if yy not in (5,6) else 4]+(255,)
                else: fp[X,Y]=ST[(4,3,2)[yy-9]]+(255,)
                continue
            if y<55:                                             # cornice / string course
                fp[X,Y]=ST[(6,5,2)[y-52]]+(255,); continue
            if y>=WL:
                continue
            ar=arch_of(X)
            if ar is not None:
                cx,hs=ar; rise=hs*1.05; dx=(X+0.5-cx)/hs; dy=(WL-(y+0.5))/rise
                r=math.hypot(dx,dy)
                if r<1.0:                                        # the opening: water shows through, shaded
                    shade.append((X,Y,0.42+0.3*(1-dy)))
                    continue
                if r<1.28:                                       # voussoirs
                    ang=math.atan2(dy,dx); k=int(ang/ (math.pi/9))
                    t=5 if X<cx else 4
                    if abs(ang-(ang//(math.pi/9))*(math.pi/9))<0.07: t=2
                    if abs(dx)<0.14 and dy>0.9: t=6
                    fp[X,Y]=ST[t]+(255,); continue
            row=(y-55)//5; off=6 if row%2 else 0
            t=4 if (y-55)%5!=4 and (X+off)%12!=0 else 2
            if X<A or X>=W-A: t=4 if (y-55)%5!=4 and (X+off)%12!=0 else 2
            if t==4 and _hash(X//12,row,7)<0.25: t=3
            fp[X,Y]=ST[t]+(255,)
    # cutwaters (downstream, pointed) under each pier + their pyramid caps
    foam=[]
    for p in piers:
        for Y in range(P+64,P+WL+14):
            y=Y-P
            if y<70:                                             # cap
                half=4+(y-64)*0.5
            elif y<WL: half=7
            else: half=7*(1-(y-WL)/14)
            for X in range(int(p-half),int(p+half)+1):
                if not (0<=X<W): continue
                lit=X<p
                t=(5 if lit else 3) if y>=70 else (6 if lit else 4)
                if y>=WL-1 and y<WL+1: t=2
                if y>=70 and (y-70)%5==4: t=2 if lit else 1
                fp[X,Y]=ST[t]+(255,)
        foam+=[(p,P+WL+14,3),(p-7,P+WL+2,3),(p+7,P+WL+2,3),(p,P+WL+6,4)]
    for X in (A,A+RW-1): foam.append((X,P+WL,3))
    # statue on the middle pier's pedestal (near side), finials on the end pedestals
    if statue and piers:
        cs=C(W,P+44,seed=613)
        for i,p in enumerate(piers):
            cs.group(30+i); cs.box(p-4,P+34,8,2,4,'stone',bias=0.05)
            toga_statue(cs,p,P+13,g0=40+i*3,pose=i%2)
        for i,(a,b) in enumerate((ped[0],ped[-1])):
            cx=(a+b)//2; cs.group(50+i); cs.box(cx-3,P+36,6,2,3,'stone',bias=0.05); cs.ellipsoid(cx,P+34,2.6,2.6,'stone',amb=0.3)
        front.alpha_composite(pz.fin(cs),(0,0))
    # reflection of the face (for the water layer): face rows flipped under the waterline
    face=front.crop((0,P+55,W,P+WL)); refl=face.transpose(Image.FLIP_TOP_BOTTOM)
    return dict(back=back,front=front,ox=-A,oy_back=-(P+14),oy_front=-(P+14),W=W,shade=shade,foam=foam,
                reflect=refl,refl_y=P+WL,P=P)

# ---------------- windmill: tower (static, in the base) + sails (animated overlay, 8 frames = a quarter turn) ----------------
import pv
def windmill_body():
    W,H=64,96; o=Image.new('RGBA',(W,H)); px=o.load(); wall=pv.pj.tex('tim.wall',W,H).load()
    for y in range(40,96):
        t=min(1,(y-40)/52); half=12+8*t
        for x in range(W):
            d=x+0.5-32
            if abs(d)<=half:
                u,cz=pv._wrap(d,half)
                if y>92+3*cz: continue
                k=0.62+0.5*max(0,cz*0.8-0.25*(d/half))
                px[x,y]=pv.mul(wall[int(u+32)%W,max(0,int(y-3*cz))],min(1.12,k))[:3]+(255,)
    for y in range(80,93):
        for x in range(28,36): px[x,y]=(pv.WD[3] if (x-28)%3 else pv.WD[2])+(255,)
    lit=pv.T('tim','back',W,H).load(); dk=pv.T('tim','front',W,H).load()
    for y in range(26,44):
        half=6+(y-26)*0.8
        for x in range(W):
            d=x+0.5-32
            if abs(d)<=half: px[x,y]=(lit[x,y] if d<0 else dk[x,y])[:3]+(255,)
    return o
WM_NF=8
def windmill_sails(frame):
    # 4 sails, a quarter turn over WM_NF frames (the sail cross repeats every 90 degrees -> seamless)
    W,H=64,96; o=Image.new('RGBA',(W,H)); d=ImageDraw.Draw(o); a0=(frame%WM_NF)*(math.pi/2)/WM_NF
    for k in range(4):
        a=a0+k*math.pi/2; x1=32+30*math.cos(a); y1=34+30*math.sin(a)*0.9
        d.line((32,34,x1,y1),fill=pv.WD[2]+(255,),width=2)
        ax=32+10*math.cos(a); ay=34+10*math.sin(a)*0.9; bx=x1; by=y1
        nx,ny=-math.sin(a)*5,math.cos(a)*5*0.9
        d.polygon([(ax,ay),(bx,by),(bx+nx,by+ny),(ax+nx,ay+ny)],fill=(236,214,198,255),outline=pv.WD[2]+(255,))
        # lattice line on the sail cloth
        mx,my=(ax+bx)/2+nx/2,(ay+by)/2+ny/2
        d.line((ax+nx/2,ay+ny/2,bx+nx/2,by+ny/2),fill=(200,178,160,255))
    d.ellipse((29,31,35,37),fill=pv.WD[4]+(255,)); d.point((31,33),fill=pv.WD[5]+(255,))
    return o

# ---------------- trees in chipset leaf texture: cypress (1x3 / 1x2), umbrella pine (4 wide), topiary cone ----------------
_LT=[None]
def _leaftex():
    if _LT[0] is None:
        t=terrain.CH.crop((224+8,512+12,224+8+32,512+12+32)).convert('RGB'); _LT[0]=t.load()
    return _LT[0]
LEAFR=[hx(c) for c in palette.RAMPS_CHIP['leaf']]          # 6 tones dark..light
def _ltone(c):
    return min(range(6),key=lambda i: sum((c[j]-LEAFR[i][j])**2 for j in range(3)))
def foliage(px,W,H,inside,shade,dark=0,ox=0,oy=0):
    # paint chipset leaf texture into the pixels inside(x,y), re-toned by shade(x,y) in -3..+2 plus a global dark shift
    T=_leaftex()
    for y in range(H):
        for x in range(W):
            if not inside(x,y): continue
            t=_ltone(T[(x+ox)%32,(y+oy)%32])+shade(x,y)-dark
            px[x,y]=LEAFR[max(0,min(5,t))]+(255,)
def cypress(rows=3,seed=0):
    W,H=16,rows*16; im=Image.new('RGBA',(W,H)); px=im.load(); top=2; bot=H-5
    def half(y):
        t=(y-top)/(bot-top)
        return 1.5+5.8*math.sin(min(1,t*1.15)*math.pi*0.62)*(1 if t<0.9 else 1-(t-0.9)*3)
    def inside(x,y):
        if not (top<=y<=bot): return False
        h=half(y)+(_hash(y,seed,5)-0.5)*1.2; return abs(x+0.5-8)<=h
    def shade(x,y):
        h=half(y); u=(x+0.5-8)/max(1,h)
        s=1 if u<-0.35 else (0 if u<0.3 else -2)
        if (y+int(_hash(x,y//3,seed)*3))%5==0: s-=1               # layered sprays
        return s
    foliage(px,W,H,inside,shade,dark=1,ox=seed*7,oy=seed*5)
    for y in range(bot+1,H):                                     # trunk
        px[7,y]=(72,47,37,255); px[8,y]=(48,30,20,255)
    return pz.fin(im)
def umbrella_pine(seed=0):
    W,H=64,80; im=Image.new('RGBA',(W,H)); px=im.load()
    # trunk: slightly leaning, forked under the crown
    for y in range(26,H-3):
        t=(y-26)/(H-29); x=int(31+(1-t)*3)
        for k,c in enumerate(((150,110,78),(120,86,58),(86,60,42),(60,42,30))): px[x+k-1,y]=c+(255,)
    for k in range(10):
        px[30-k,27+k//2]=(120,86,58,255); px[30-k,28+k//2]=(86,60,42,255)
        px[34+k,26+k//3]=(120,86,58,255); px[34+k,27+k//3]=(86,60,42,255)
    def edge(x):
        u=(x+0.5-32)/31
        if abs(u)>1: return None
        return 14-9*math.sqrt(1-u*u)+math.sin(x*0.7+seed)*1.6
    def inside(x,y):
        e=edge(x)
        if e is None: return False
        b=30-2*(1-abs((x-32)/31))+math.sin(x*0.9+seed*2)*1.5
        return e<=y<=b
    def shade(x,y):
        e=edge(x); d=y-e
        s=1 if d<3 else (0 if d<9 else -2)
        if x>46: s-=1
        if x<18 and d<5: s+=1
        return s
    foliage(px,W,H,inside,shade,dark=0,ox=seed*9)
    return pz.fin(im)
def topiary(seed=0):
    W,H=16,32; im=Image.new('RGBA',(W,H)); px=im.load()
    def inside(x,y):
        if 2<=y<=22: return abs(x+0.5-8)<=1+(y-2)*0.28
        return False
    def shade(x,y): u=(x+0.5-8); return 1 if u<-1 else (0 if u<2 else -2)
    foliage(px,W,H,inside,shade,dark=0,ox=seed*3)
    c=C(16,32,seed=950+seed); c.box(3,23,10,3,5,'clay',bias=0.05)   # terracotta pot
    pot=c.img(False); im.alpha_composite(pot)
    return pz.fin(im)
def clumps(px,W,H,cl,dark=0,seed=0):
    # a crown as overlapping leaf clumps (like the chipset trees): each clump lit from the upper left, painted back to front
    T=_leaftex()
    for i,(cx,cy,rx,ry) in enumerate(sorted(cl,key=lambda c:c[1])):
        for y in range(int(cy-ry)-1,int(cy+ry)+2):
            for x in range(int(cx-rx)-1,int(cx+rx)+2):
                if not (0<=x<W and 0<=y<H): continue
                dx=(x+0.5-cx)/rx; dy=(y+0.5-cy)/ry; r=dx*dx+dy*dy
                wob=(_hash(x,y,seed+i)-0.5)*0.25
                if r>1+wob: continue
                lit=-(dx*0.55+dy*0.8)
                s=1 if lit>0.45 else (0 if lit>-0.15 else (-1 if lit>-0.6 else -2))
                if r>0.8 and lit<0: s-=1
                t=_ltone(T[(x+seed*7)%32,(y+seed*5)%32])-2+s+2-dark
                px[x,y]=LEAFR[max(0,min(5,t))]+(255,)
def cypress(rows=3,seed=0):
    W,H=16,rows*16; im=Image.new('RGBA',(W,H)); px=im.load(); top=2; bot=H-6
    cl=[]; n=int((bot-top)/4.2)
    for k in range(n+1):
        t=k/n; y=top+3+t*(bot-top-5)
        w=1.8+4.4*math.sin(min(1,t*1.1+0.05)*math.pi*0.6)
        if t>0.85: w*=1-(t-0.85)*2
        cl.append((8+(_hash(k,seed,3)-0.5)*1.6,y,w,3.4))
    for y in range(bot-1,H):
        px[7,y]=(96,66,46,255); px[8,y]=(60,42,30,255)
    clumps(px,W,H,cl,dark=1,seed=seed)
    return pz.fin(im)
def umbrella_pine(seed=0):
    W,H=64,80; im=Image.new('RGBA',(W,H)); px=im.load()
    BK=[(150,110,78),(120,86,58),(86,60,42),(60,42,30)]
    for y in range(24,H-3):
        t=(y-24)/(H-27); x=int(round(31+(1-t)**2*4))
        for k in range(3): px[x+k-1,y]=BK[k+ (1 if k==2 else 0)]+(255,)
    for k in range(12):                                          # two limbs into the crown
        px[31-k,26+k//3]=BK[1]+(255,); px[31-k,27+k//3]=BK[3]+(255,)
        px[34+k,25+k//4]=BK[1]+(255,); px[34+k,26+k//4]=BK[3]+(255,)
    cl=[]
    for k in range(9):                                            # flat underside
        u=-0.88+1.76*k/8; cl.append((32+u*27,20+(_hash(k,seed,6)-0.5)*2,7.0,5.0))
    for k in range(7):                                            # dome
        u=-0.75+1.5*k/6; cl.append((32+u*24,17-6*math.sqrt(max(0,1-u*u))+(_hash(k,seed,4)-0.5)*2,7.5,6.5))
    for k in range(3):
        u=-0.5+k*0.5; cl.append((32+u*16,9,6.5,5.0))
    clumps(px,W,H,cl,dark=0,seed=seed)
    return pz.fin(im)

# ---------------- architecture pieces (direct pixels, ramps ST / TRV / TC) ----------------
def _put(px,W,H,x,y,c,a=255):
    if 0<=x<W and 0<=y<H: px[x,y]=c[:3]+(a,)
def column(px,W,H,cx,y0,y1,w=6,R=None):
    # a column: capital (2 rows wider), shaft with cylinder shading + two flutes, base (2 rows wider)
    R=R or TRV; tones=[6,5,5,4,3,2,2][:w] if w<=7 else [6]+[5]*(w-4)+[4,3,2]
    x0=cx-w//2
    for y in range(y0+3,y1-2):
        for i in range(w):
            t=tones[i]
            if i in (2,w-3) and (y%2==0): t=max(2,t-1)
            _put(px,W,H,x0+i,y,R[t])
    for y in range(y0,y0+3):
        for i in range(-1,w+1): _put(px,W,H,x0+i,y,R[6 if y==y0 else (5 if i<w//2 else 3)])
    for y in range(y1-2,y1+1):
        for i in range(-1,w+1): _put(px,W,H,x0+i,y,R[5 if y<y1 else 3] if i<w-1 else R[3])
def tile_roof_slope(px,W,H,x0,x1,y0,y1,lit=True):
    # terracotta tiles on a slope that faces the viewer: imbrex ridges every 5 px, courses every 5 rows, eave at the bottom
    for y in range(y0,y1+1):
        for x in range(x0,x1+1):
            k=(x+((y-y0)//5)*2)%5
            t=(3,5,5,4,4)[k]
            if (y-y0)%5==4: t=min(t,3)
            if not lit: t-=1
            if y>=y1-1: t=(2 if y==y1 else 3)
            _put(px,W,H,x,y,TC[max(1,t)])
def stoa(wc=6,doors=True,seed=0):
    # a colonnade (stoa) facing the viewer: lean-to terracotta roof, entablature, columns in front of a shaded back
    # wall with shop doors, a travertine walk and a step. 4 rows tall; the bottom row is walkable.
    W=wc*16; H=64; im=Image.new('RGBA',(W,H)); px=im.load()
    tile_roof_slope(px,W,H,0,W-1,0,13)
    for y in range(14,20):
        for x in range(W):
            t=6 if y==14 else (5 if y<19 else 3)
            if y==16 and x%3==0: t=3
            _put(px,W,H,x,y,TRV[t])
    for y in range(20,52):                                       # shaded back wall (stucco)
        for x in range(W):
            k=0.55+0.25*min(1,(y-20)/20)
            c=mul(CRM[3],k)
            if (x//12+y//6)%7==0 and _hash(x,y,seed)<0.1: c=mul(c,0.92)
            _put(px,W,H,x,y,c)
    r=random.Random(seed)
    if doors:
        for b in range(wc):
            if b%2==1 and b<wc-1 and r.random()<0.8:
                x0=b*16+12
                for y in range(34,52):
                    for x in range(x0,x0+8):
                        edge=x in (x0,x0+7) or y==34
                        _put(px,W,H,x,y,WDr[4] if edge else (WDr[1] if y<40 else WDr[2]))
            elif b%2==0 and r.random()<0.5:                      # an amphora against the wall
                cx=b*16+8
                for y in range(42,52):
                    w_=2+(1 if 44<=y<=49 else 0)
                    for x in range(cx-w_,cx+w_+1): _put(px,W,H,x,y,TC[5 if x<cx else 3])
    for k in range(wc):
        column(px,W,H,k*16+8,20,51,6)
    for y in range(52,64):
        for x in range(W):
            if y<58: c=tex_travertine(x,y)
            elif y==58: c=TRV[6]
            elif y<62: c=TRV[3]
            else: c=TRV[2]
            _put(px,W,H,x,y,c)
    return pz.fin(im)
def pediment(px,W,H,x0,x1,y0,y1,relief=True):
    cx=(x0+x1)/2; hw=(x1-x0)/2
    for y in range(y0,y1+1):
        t=(y-y0)/max(1,(y1-y0)); half=hw*t
        for x in range(int(cx-half),int(cx+half)+1):
            edge=abs(x+0.5-cx)>half-2.2
            c=TRV[6] if edge else TRV[4]
            if y>=y1-1: c=TRV[5] if y==y1-1 else TRV[3]
            _put(px,W,H,x,y,c)
    if relief:                                                   # a small wreath in the tympanum
        rx,ry=int(cx),int(y0+(y1-y0)*0.62)
        for a in range(0,360,30):
            x=int(rx+math.cos(math.radians(a))*3.2); y=int(ry+math.sin(math.radians(a))*2.2)
            _put(px,W,H,x,y,LFr[3] if a<180 else LFr[2])
def temple_front(wc=5,seed=0):
    # a small Roman temple seen from the front: tiled gable roof from above, pediment, inscribed architrave, four
    # columns before a dark pronaos with the bronze door, a podium with a central stair. 6 rows.
    W=wc*16; H=96; im=Image.new('RGBA',(W,H)); px=im.load(); cx=W//2
    for y in range(0,39):                                        # roof from above: ridge down the middle, its front
        for x in range(1,W-1):                                   # edge follows the raking cornices
            if y>=20+abs(x+0.5-cx)/((W-3)/2)*18: continue
            lit=x<cx; t=(5 if lit else 4) if (y%4)!=3 else (4 if lit else 3)
            if abs(x+0.5-cx)<1.1: t=6 if x<cx else 2
            _put(px,W,H,x,y,TC[t])
    pediment(px,W,H,1,W-2,20,38)
    for y in range(39,46):
        for x in range(1,W-1):
            t=6 if y==39 else (5 if y<45 else 3)
            if 41<=y<=43 and 12<=x<W-12 and (x%4 in (0,1)) and y!=42: t=2          # inscription
            _put(px,W,H,x,y,TRV[t])
    for y in range(46,78):                                       # pronaos in shade
        for x in range(2,W-2):
            _put(px,W,H,x,y,mul(CRM[2],0.55+0.2*(y-46)/32))
    for y in range(56,78):                                       # bronze door
        for x in range(cx-6,cx+6):
            edge=x in (cx-6,cx+5) or y==56
            _put(px,W,H,x,y,(ramp('gold')[2] if edge else (ramp('gold')[3] if (x-cx)%4 else ramp('gold')[2])))
    for k in range(4): column(px,W,H,int(8+k*(W-16)/3),46,77,7)
    for y in range(78,96):                                       # podium + stair
        for x in range(1,W-1):
            side=x<14 or x>=W-14
            if side: t=6 if y==78 else (4 if y<93 else 2)
            else: t=(6,5,3)[(y-78)%3] if y<95 else 2
            if side and x in (13,W-14): t=3
            _put(px,W,H,x,y,TRV[t])
    return pz.fin(im)
def portico(wc=5):
    # a portico to set in front of a facade: pediment, entablature, four columns, two steps (64 px tall, bottom 8 px
    # hang below the facade's base line)
    W=wc*16; H=64; im=Image.new('RGBA',(W,H)); px=im.load()
    pediment(px,W,H,0,W-1,0,17)
    for y in range(18,23):
        for x in range(W): _put(px,W,H,x,y,TRV[6 if y==18 else (5 if y<22 else 3)])
    for y in range(23,56):
        for x in range(2,W-2): _put(px,W,H,x,y,mul(CRM[2],0.62+0.2*(y-23)/33),255)
    for k in range(4): column(px,W,H,int(7+k*(W-14)/3),23,55,6)
    for y in range(56,64):
        for x in range(0,W): _put(px,W,H,x,y,TRV[(6,5,3,3,6,5,3,2)[y-56]])
    return im
def door_cut(im,x0,y0,w,h):
    # open the portico's shaded back so the facade door shows through (used when overlaid on a house)
    p=im.load()
    for y in range(y0,y0+h):
        for x in range(x0,x0+w): p[x,y]=(0,0,0,0)
    return im
def aqueduct(wc=12,seed=0):
    # an aqueduct arcade facing the viewer: capped channel with water on top, piers every 24 px with round arches.
    # 4 rows tall; the openings show the ground behind.
    W=wc*16; H=64; im=Image.new('RGBA',(W,H)); px=im.load()
    for x in range(W):
        for y in range(0,8):
            if y==0: c=ST[6]
            elif y in (1,5): c=ST[5]
            elif 2<=y<=4: c=(63,162,174) if (y==3 and (x+seed)%9) else ((125,152,162) if y==2 else (33,88,78))
            elif y==6: c=ST[4]
            else: c=ST[2]
            _put(px,W,H,x,y,c)
    for y in range(8,H):
        for x in range(W):
            b=x%24; pc=4                                      # pier 0..7, opening 8..23
            cxa=(x//24)*24+16; hs=8.0; rise=10
            dx=(x+0.5-cxa)/hs; spring=34; dy=(spring-(y+0.5))/rise
            opening=abs(dx)<1 and (y>=spring or dx*dx+dy*dy<1)
            ring=abs(dx)<1.35 and not opening and (y<spring and dx*dx*0.55+dy*dy<1.8) and y>=spring-rise-3
            if opening: continue
            row=(y-8)//4; off=4 if row%2 else 0
            t=4 if (y-8)%4!=3 and (x+off)%8!=0 else 3
            if b<8: t=5 if b<3 else (4 if b<6 else 3)
            if b<8 and (y-8)%4==3: t=3
            if ring: t=5 if x<cxa else 4
            if y in (spring-1,spring) and b<8: t=6
            c=TRV[t] if t>=3 else TRV[3]
            _put(px,W,H,x,y,c)
    return pz.fin(im)

# ---------------- statue on a plinth ----------------
def statue_plinth(pose=0,seed=0,mat='bone'):
    c=C(32,64,seed=960+seed); c.shadow(16,61.6,13,2)
    c.group(1); c.box(6,50,20,3,9,'stone',front=0.6)             # base step
    c.group(2); c.box(9,30,14,2,19,'stone',front=0.62,bias=0.04)  # tall plinth
    c.new()
    for x in range(10,22):
        c.tone(x,32,'stone',6); c.tone(x,47,'stone',2)
    for (y,x0,x1) in ((37,12,20),(40,11,21),(43,13,19)):       # inscription
        for x in range(x0,x1):
            if x%2==0: c.tone(x,y,'stone',2)
    c.group(3); c.box(8,28,16,2,2,'stone',bias=0.1)
    toga_statue(c,16,6,g0=10,mat=mat,pose=pose)
    return pz.fin(c)

# ---------------- cafe terrace ----------------
def awning(wc=4,cols=('red','cream'),seed=0):
    # striped canvas awning over a shop front, sloping toward the viewer, scalloped valance, shade band under it
    W=wc*16; H=22; im=Image.new('RGBA',(W,H)); px=im.load()
    A=ramp(cols[0]); B=ramp(cols[1])
    for y in range(0,12):
        for x in range(W):
            R=A if (x//6)%2==0 else B
            t=5 if y<3 else (4 if y<9 else 3)
            if x%6==5: t-=1
            _put(px,W,H,x,y,R[t])
    for x in range(W):                                            # valance scallops
        R=A if (x//6)%2==0 else B; d=x%6
        for y in range(12,12+(3 if d in (1,2,3,4) else 2)): _put(px,W,H,x,y,R[3 if y==12 else 2])
        for y in range(15,H): _put(px,W,H,x,y,(10,10,20),60 if y<19 else 30)
    for x in (0,W-1):
        for y in range(0,14): _put(px,W,H,x,y,ramp('iron')[3])
    return im
def cafe_table(seed=0,chairs=2):
    # a round bistro table with cups and a saucer, wrought-iron chairs either side
    c=C(32,32,seed=970+seed); c.shadow(16,27.6,12,2)
    r=random.Random(seed)
    def chair(x0,flip):
        c.new()
        for y in range(10,26):                                    # back rest (curled top)
            if y<18: c.tone(x0+(0 if not flip else 5),y,'iron',3)
        for x in range(x0,x0+6): c.tone(x,17,'wood',5); c.tone(x,18,'wood',4); c.tone(x,19,'wood',2)
        for y in range(20,26): c.tone(x0+1,y,'iron',3); c.tone(x0+4,y,'iron',2)
        c.tone(x0+(0 if not flip else 5),9,'iron',4)
    c.group(1)
    if chairs>=1: chair(1,False)
    if chairs>=2: chair(25,True)
    c.group(2); c.new()
    for y in range(18,26): c.tone(15,y,'iron',4); c.tone(16,y,'iron',2)
    for x in range(12,20): c.tone(x,26,'iron',3)
    c.group(3); disc=pz.disc_top
    disc(c,16,15,8.5,4.2,'wood',lambda dx,dy,r: 6 if (dx+dy)<-0.7 else (5 if r<0.7 else 4))
    c.new(); [c.tone(x,19,'wood',2) for x in range(9,24)]
    c.group(4)
    for (x,y) in ((11,13),(18,14))[:1+(seed%2)]:                  # white cups (coffee inside) on saucers
        c.new()
        for xx in range(x-1,x+4): c.tone(xx,y+2,'bone',5)
        c.tone(x,y,'bone',6); c.tone(x+1,y,'wood',1); c.tone(x+2,y,'bone',5)
        c.tone(x,y+1,'bone',6); c.tone(x+1,y+1,'bone',5); c.tone(x+2,y+1,'bone',4); c.tone(x+3,y+1,'bone',4)
    if seed%3==0:                                                 # a small carafe / flower vase
        c.new(); c.tone(20,11,'leaf',5); c.tone(20,12,'cryst',5); c.tone(20,13,'cryst',4); c.tone(21,13,'cryst',3); c.tone(20,10,'pink',5)
    return pz.fin(c)
def cafe_parasol(color='leaf',seed=0):
    # a tall market parasol (scalloped, striped) over a bistro table
    base=cafe_table(seed,2); W,H=40,48; im=Image.new('RGBA',(W,H)); im.alpha_composite(base,(4,16))
    c=C(W,H,seed=980+seed); c.group(1); c.new()
    for y in range(8,32): c.tone(20,y,'wood',4); c.tone(21,y,'wood',2)
    c.group(2); c.new()
    for y in range(0,10):
        hw=3+y*1.75
        for x in range(int(20.5-hw),int(20.5+hw)+1):
            seg=int((x-20.5)/3.5+20)%2; m=color if seg else 'cream'
            t=5 if x<20 else 4
            if y>=8: t-=2
            c.tone(x,y,m,max(1,t))
    for x in range(4,38,4): c.tone(x,10,color if (x//4)%2 else 'cream',3)
    c.tone(20,0,'gold',5)
    im.alpha_composite(pz.fin(c))
    return im
def menu_board():
    c=C(16,24,seed=990); c.shadow(8,22.6,6,1.4)
    c.group(1); c.new()
    for y in range(3,22): c.tone(3+(y-3)//8,y,'wood',4); c.tone(12-(y-3)//8,y,'wood',2)
    c.group(2); c.new()
    for y in range(3,16):
        for x in range(4,12): c.tone(x,y,'dark',4 if y>4 else 5)
    for x in range(3,13): c.tone(x,2,'wood',5); c.tone(x,16,'wood',3)
    c.new()
    for (y,x0,x1) in ((6,5,10),(9,5,11),(11,5,9),(13,6,11)):
        for x in range(x0,x1): c.tone(x,y,'cream',6 if x%3 else 4)
    c.tone(10,5,'bone',6); c.tone(11,5,'bone',5); c.tone(10,4,'bone',4)   # a chalk cup
    return pz.fin(c)
def planter_box(w=2,seed=0):
    # a wooden terrace planter with a clipped shrub and flowers
    c=C(w*16,24,seed=995+seed); c.shadow(w*8,22.6,w*8-1,1.5)
    c.group(1); c.box(1,12,w*16-2,3,8,'wood',front=0.55)
    for x in range(1,w*16-1):
        if x%5==0:
            for y in range(15,23): c.tone(x,y,'wood',3)
    c.group(2); c.ellipsoid(w*8,9,w*8-3,5,'leaf',bump=0.5,amb=0.25)
    c.new()
    r=random.Random(seed)
    for k in range(w*3):
        x=r.randint(3,w*16-4); y=r.randint(6,11); m=r.choice(['pink','red','gold'])
        c.tone(x,y,m,5); c.tone(x+1,y,m,4)
    return pz.fin(c)
SIGN_CAFE=(["..s.s..",".s.s...","ccccc..","cCccccc","ccccc.c","ccccccc",".ccc..."],{'c':('bone',6),'C':('bone',4),'s':('stone',5)})

# ---------------- water edge, estate & castle props ----------------
def reeds(seed=0,w=16,h=24):
    c=C(w,h,seed=1000+seed); r=random.Random(seed)
    for k in range(9):
        x=r.randint(1,w-2); top=r.randint(3,h-12); lean=r.choice((-1,0,0,1))
        c.new()
        for y in range(top,h-1):
            xx=x+int(lean*(h-1-y)/10); c.tone(xx,y,'moss' if k%2 else 'leaf',4 if y<h-6 else 3)
        if k%3==0:
            c.new(); [c.tone(x+int(lean*(h-1-top)/10),yy,'bark',(4,3,3,2)[yy-top+3]) for yy in range(top-3,top+1)]
    return pz.fin(c)
def carriage(seed=0,color='red'):
    # a closed coach (side view, facing left): lacquered body with a window and gold trim, two spoked wheels, shaft
    c=C(52,36,seed=1010); c.shadow(26,33.6,22,2.2)
    def wheel(cx,cy,r_):
        c.new()
        for a in range(0,360,6):
            x=cx+r_*math.cos(math.radians(a)); y=cy+r_*math.sin(math.radians(a))*0.95
            c.tone(int(x),int(y),'wood',2 if a<180 else 4)
        for a in range(0,180,30):
            for t in range(1,int(r_)):
                c.tone(int(cx+t*math.cos(math.radians(a))),int(cy+t*math.sin(math.radians(a))),'wood',3)
        c.tone(int(cx),int(cy),'gold',5)
    c.group(1); wheel(38,26,7.5)
    c.group(2); c.box(14,4,28,3,17,color,front=0.62)
    c.new()
    for x in range(14,42): c.tone(x,4,'gold',5); c.tone(x,23,'gold',3)
    for y in range(9,17):
        for x in range(20,30): c.tone(x,y,'cryst',3 if y<12 else 2)
    for y in range(8,18): c.tone(19,y,'gold',4); c.tone(30,y,'gold',3)
    for y in range(9,22): c.tone(33,y,'gold',3)                   # door line
    c.new(); [c.tone(x,2,'dark',4) for x in range(16,40)]; [c.tone(x,3,'dark',5) for x in range(15,41)]
    c.group(3); c.new()
    for x in range(2,15): c.tone(x,22+(15-x)//6,'wood',4); c.tone(x,23+(15-x)//6,'wood',2)
    c.group(4); wheel(18,27,6.5)
    c.new(); c.tone(12,6,'fire',6); c.tone(12,7,'fire',5); c.tone(12,5,'iron',3)
    return pz.fin(c)
def horse_head(c,x,y,g,col='wood'):
    c.group(g); c.new()
    rows=[".mm..","mmmm.","mmmmm",".mmmm","..mmm","..mnn"]
    for j,row in enumerate(rows):
        for i,ch in enumerate(row):
            if ch=='m': c.tone(x+i,y+j,col,4 if i<2 else 3)
            if ch=='n': c.tone(x+i,y+j,col,2)
    c.tone(x+1,y+1,'dark',1); c.tone(x,y,'bark',2)
def stable(wc=6,seed=0):
    # a timber stable: steep tiled roof, stalls with half doors and horses looking out, hay loft door above
    import ph2
    h=ph2.house('tim',wc,1,seed=seed,chim=False,door=0)
    im=terracotta_tim(h['im']); px=im.load(); W,H=im.size; base=H-1
    c=C(W,H,seed=1020)
    for k in range(1,wc):
        x0=k*16+2
        for y in range(base-24,base-2):
            for x in range(x0,x0+12):
                if y<base-12: px[x,y]=(26,18,20,255)
                else: px[x,y]=(WDr[4] if (x-x0)%4 else WDr[3])+(255,)
        for x in range(x0,x0+12): px[x,base-12]=WDr[5]+(255,); px[x,base-24]=WDr[2]+(255,)
        if (k+seed)%3!=0: horse_head(c,x0+3,base-21,10+k,col=('wood','bark','cream')[(k+seed)%3])
    im.alpha_composite(c.img(False))
    return dict(im=pz.fin(im),door=0,chim=[],below=0,above=h.get('above',0))
def terracotta_tim(im):
    return im
def hay_bales():
    c=C(32,24,seed=1030); c.shadow(16,21.6,15,2)
    c.group(1); c.box(2,6,14,4,9,'rope',front=0.6)          # v6: thatch ramp (the straw ramp read as gold chests)
    c.group(2); c.box(14,9,16,4,8,'rope',front=0.6)
    for g,(x0,x1,y) in ((1,(2,16,12)),(2,(14,30,14))):
        c.new()
        for x in range(x0,x1): c.tone(x,y,'rope',2)
    return pz.fin(c)
def gate_pier(urn=True):
    # a square ashlar gate pier with a cap and an urn
    c=C(16,48,seed=1040); c.shadow(8,45.6,7,1.6)
    c.group(1); c.box(1,18,14,2,26,'stone',front=0.6)
    c.new()
    for y in range(20,44,5):
        for x in range(1,15): c.tone(x,y,'stone',3)
    c.group(2); c.box(0,14,16,3,3,'stone',bias=0.1)
    if urn:
        c.group(3); c.ellipsoid(8,9,4.2,4.0,'stone',amb=0.3,bias=0.05)
        c.new(); [c.tone(x,4,'stone',5) for x in range(5,11)]; c.tone(8,2,'stone',5); c.tone(8,3,'stone',4)
    return pz.fin(c)
def iron_gate(wc=2,open_=True):
    # a wrought-iron double gate; open = the leaves stand folded against the piers (the passage is clear)
    W=wc*16; im=Image.new('RGBA',(W,36)); px=im.load(); I=ramp('iron')
    leaves=[(0,5),(W-5,W)] if open_ else [(0,W)]
    for a,b in leaves:
        for x in range(a,b):
            for y in range(6,34):
                if x%3==0 or y in (8,20,32): px[x,y]=(I[4] if x%3==0 else I[3])+(255,)
            top=6-int(2*math.sin(math.pi*(x-a)/max(1,b-a))) if not open_ else 5
            px[x,top]=I[5]+(255,)
            if x%3==0: px[x,top-1]=ramp('gold')[4]+(255,)
    return pz.fin(im)
def banner_hanging(color='red',h=32):
    # a long cloth banner hanging from a wall top: colour field, gold border and an emblem
    c=C(12,h,seed=1050); c.group(1); c.new()
    for y in range(0,h):
        for x in range(1,11):
            if y>h-5 and abs(x-5.5)>(h-1-y)*1.2: continue
            t=5 if x<4 else (4 if x<8 else 3)
            if x in (1,10): c.tone(x,y,'gold',4 if x==1 else 3); continue
            c.tone(x,y,color,t)
    for x in range(0,12): c.tone(x,0,'wood',4)
    c.new()
    for (x,y) in ((5,8),(6,8),(4,9),(5,9),(6,9),(7,9),(5,10),(6,10),(5,11),(6,11),(4,12),(7,12)): c.tone(x,y,'gold',5)
    return pz.fin(c)
def portcullis():
    I=ramp('iron'); im=Image.new('RGBA',(28,16)); px=im.load()
    for y in range(16):
        for x in range(28):
            if x%4==1 or y%4==1: px[x,y]=(I[3] if x%4==1 else I[2])+(255,)
    for x in range(1,28,4): px[x,15]=I[4]+(255,)
    return im

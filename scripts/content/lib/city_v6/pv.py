# house form study: forms the straight-range block set cannot make. Roofs are painted per pixel from the chipset's roof
# pair (lit / shaded slope tiles), walls come from the existing storey blocks, joints are hand-drawn in chipset colours.
import sys, os, math; sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from PIL import Image, ImageDraw
import palette, pj
from pj_demo import storeyrows as SR
def hx(s): return tuple(int(s[i:i+2],16) for i in (1,3,5))
WD=[hx(c) for c in [palette.OUT_CHIP['wood']]+palette.RAMPS_CHIP['wood']]
ST=[hx(c) for c in [palette.OUT_CHIP['stone']]+palette.RAMPS_CHIP['stone']]
_L=[None]
def L():
    if _L[0] is None: _L[0]=pj.library()
    return _L[0]
def walls(st,kinds,storeys=1,gs=None,top='eave'):
    gs=gs or st
    rows=SR(gs,kinds,top,'base') if storeys==1 else SR(st,kinds,top,'jetty')+SR(gs,kinds,'plain','base')
    return pj.assemble(rows,L()).crop((0,0,len(kinds)*16,storeys*32))
def T(st,key,w,h): return pj.pairtex(st,key,w,h)
PEAK=[True]   # north-south ridges show the far end as a peak (FF5/FF6 idiom): the skyline becomes a row of points
def mul(c,k): return tuple(max(0,min(255,int(v*k))) for v in c[:3])
def put(px,x,y,c,W,H):
    if 0<=x<W and 0<=y<H: px[x,y]=c[:3]+(255,)
def stack(*parts):
    # parts: (image, x offset) stacked top to bottom (x offsets in px)
    W=max(im.width+dx for im,dx in parts); H=sum(im.height for im,dx in parts); o=Image.new('RGBA',(W,H)); y=0
    for im,dx in parts: o.alpha_composite(im,(dx,y)); y+=im.height
    return o

# --- A: gable-front house (ridge runs north-south; the gable wall faces the viewer) ---
def gable_end(st,W,roofH,G,window=True,timber=None):
    # roof seen from above (lit left half, shaded right half, ridge cap) with a triangular gable wall hanging in its last G px
    lit=pj.nstex(st,'l',W,roofH).load(); dk=pj.nstex(st,'r',W,roofH).load(); wall=pj.tex(st+'.wall',W,roofH).load()
    o=Image.new('RGBA',(W,roofH)); px=o.load(); gx=W/2; timber=(st!='sto') if timber is None else timber
    # far end: the same rise as the front gable (G), shifted up by the roof's depth - one consistent projection
    top=roofH-G; peak=PEAK[0] and G
    for y in range(roofH):
        for x in range(W):
            if y<peak and abs(x+0.5-gx)>gx*(y+1)/peak: continue            # the far gable's peak seen over the roof
            left=x<gx; c=(lit if left else dk)[x,y]
            if y>=top:
                t=(y-top+1)/G; half=t*gx
                if abs(x+0.5-gx)<=half-2: c=wall[x,y]
                elif abs(x+0.5-gx)<=half: c=WD[4] if left else WD[2]        # barge boards
            if abs(x+0.5-gx)<1 and y<top: c=mul(c,1.25) if x<gx else mul(c,0.6)   # ridge cap
            px[x,y]=c[:3]+(255,)
    if timber:
        for y in range(top,roofH):
            t=(y-top+1)/G; half=t*gx
            if half>4:
                put(px,int(gx)-1,y,WD[3],W,roofH); put(px,int(gx),y,WD[2],W,roofH)
        yb=roofH-3
        for x in range(W):
            if abs(x+0.5-gx)<=(yb-top+1)/G*gx-2: put(px,x,yb,WD[3],W,roofH); put(px,x,yb+1,WD[2],W,roofH)
    if window:
        wy=top+int(G*0.45); 
        for y in range(wy,wy+6):
            for x in range(int(gx)-3,int(gx)+3): put(px,x,y,(28,40,60) if y<wy+3 else (40,70,90),W,roofH)
        for x in range(int(gx)-4,int(gx)+4): put(px,x,wy-1,WD[4],W,roofH); put(px,x,wy+6,WD[2],W,roofH)
        for y in range(wy,wy+6): put(px,int(gx)-4,y,WD[4],W,roofH); put(px,int(gx)+3,y,WD[2],W,roofH); put(px,int(gx)-1,y,WD[3],W,roofH)
    for y in range(top):                                                     # verge boards down both sides
        if y<peak:
            h=gx*(y+1)/peak; xl=int(gx-h); xr=int(gx+h)-1
            put(px,xl,y,WD[4],W,roofH); put(px,xl+1,y,WD[3],W,roofH); put(px,xr,y,WD[1],W,roofH); put(px,xr-1,y,WD[2],W,roofH); continue
        put(px,0,y,WD[4],W,roofH); put(px,1,y,WD[3],W,roofH); put(px,W-2,y,WD[2],W,roofH); put(px,W-1,y,WD[1],W,roofH)
    return o
def gfront(st,wc,storeys=1,kinds=None,gs=None,depth=2):
    W=wc*16; G=int(W*0.42)//2*2; roofH=depth*16+G
    k=kinds or ('l'+'w'*(wc-2)+'r' if wc<4 else 'lw'+'d'.join(['']*1)+'')
    if kinds is None:
        mid=wc//2; k=['l']+['p']*(wc-2)+['r']; k[mid]='d'
        for i in range(1,wc-1):
            if abs(i-mid)>=2: k[i]='w'
        k=''.join(k)
    if storeys==1: body=walls(st,k,1,gs)
    else: body=stack((walls(st,k.replace('d','w'),1,st,'eave').crop((0,0,W,32)),0),(walls(gs or st,k,1,gs,'plain'),0))
    return stack((gable_end(st,W,roofH,G),0),(body,0))

# --- B: hipped roof (four slopes): lit back, shaded front, end slopes at both sides ---
def hip(st,wc,rows,storeys=1,kinds=None,gs=None):
    # front-top view, left-right symmetric: the ridge runs east-west at hb; four faces meet at hip lines drawn from each
    # eave corner to the nearest ridge end. back = lit, front = shaded (east-west courses); the two end triangles face
    # west / east, so their courses run north-south (nstex): west end lit, east end in shade
    W=wc*16; H=rows*16; lit=T(st,'back',W,H).load(); dk=T(st,'front',W,H).load()
    le=pj.nstex(st,'l',W,H).load(); re=pj.nstex(st,'r',W,H).load()
    o=Image.new('RGBA',(W,H)); px=o.load(); hb=H*0.42; e=min(W*0.28,H*0.75)
    for y in range(H):
        for x in range(W):
            yy=y+0.5; xx=x+0.5
            reach=e*(yy/hb) if yy<hb else e*(1-(yy-hb)/(H-hb))
            if xx<reach: c=le[x,y]; edge=reach-xx; f='l'
            elif xx>W-reach: c=mul(re[x,y],0.85); edge=xx-(W-reach); f='r'
            elif yy<hb: c=lit[x,y]; edge=min(xx-reach,(W-reach)-xx,hb-yy); f='b'
            else: c=dk[x,y]; edge=min(xx-reach,(W-reach)-xx,yy-hb); f='f'
            if edge<1.0: c=WD[5] if f in 'bl' else WD[1]              # hip / ridge cap line
            px[x,y]=c[:3]+(255,)
    k=kinds or ('l'+''.join('w' if i%2 else 'p' for i in range(1,wc-1))+'r')
    if kinds is None:
        k=list(k); k[wc//2]='d'; k=''.join(k)
    if storeys==1: body=walls(st,k,1,gs)
    else: body=stack((walls(st,k.replace('d','w'),1,st,'eave'),0),(walls(gs or st,k,1,gs,'plain'),0))
    return stack((o,0),(body,0))

# --- C: round tower with a conical roof ---
def _wrap(d,half):
    # a point d px from the axis of a round body of radius half, mapped to the flat texture (arc length)
    t=max(-1.0,min(1.0,d/half)); return math.asin(t)/(math.pi/2)*half, math.sqrt(1-t*t)
def round_tower(st='sto',wc=3,wall_rows=3,cone_rows=3):
    # seen from the front and above like every chipset object: the body is a cylinder whose top and bottom are ellipses
    # (ry px deep), so its stone courses bow downward toward the viewer; the cone's shingle rings bow the same way and
    # its eave is the same ellipse. Texture is wrapped by arc length, light falls from the left.
    W=wc*16; R=W/2; Hc=cone_rows*16; Hw=wall_rows*16; ry=5
    o=Image.new('RGBA',(W,Hc+Hw+ry+1)); px=o.load(); OH=o.height
    wall=pj.tex(st+'.wall',W*2,Hw+ry*3).load(); lit=T(st,'back',W*2,Hc+ry*3).load(); dk=T(st,'front',W*2,Hc+ry*3).load()
    for y in range(Hc-ry,Hc+Hw+ry+1):                                         # cylinder, between two ellipses
        for x in range(W):
            d=x+0.5-R
            if abs(d)>R: continue
            u,cz=_wrap(d,R); bow=ry*cz
            if y<Hc+bow or y>Hc+Hw+bow: continue
            c=wall[int(u+R)%(W*2),int(y-bow-Hc+ry)]; k=0.62+0.5*max(0,cz*0.8-0.25*(d/R))
            put(px,x,y,mul(c,min(1.12,k)),W,OH)
    for y in range(Hc+ry+1):                                                  # cone: rings bow like the eave
        half=R*min(1,(y+1)/Hc)
        for x in range(W):
            d=x+0.5-R
            if abs(d)>half: continue
            u,cz=_wrap(d,half); bow=ry*(half/R)*cz
            if y>Hc+bow-1 and y>=Hc-ry: 
                if y>Hc+bow: continue
            yy=int(y-bow)+ry
            c=(lit if d<0 else dk)[int(u+R)%(W*2),max(0,yy)]
            k=1.0 if d<0 else 0.9
            if abs(abs(d)-half)<1.2: c=WD[4] if d<0 else WD[1]
            put(px,x,y,mul(c,k),W,OH)
    for x in range(W):                                                        # eave board along the front ellipse
        d=x+0.5-R
        if abs(d)<=R:
            u,cz=_wrap(d,R); yb=int(Hc+ry*cz)
            put(px,x,yb,WD[2],W,OH); put(px,x,yb+1,mul(WD[1],1),W,OH)
    cx=int(R); base=Hc+Hw+ry                                                  # door on the axis, slit window above it
    for y in range(base-18,base+1):
        for x in range(cx-4,cx+4): put(px,x,y,WD[3] if (x-cx)%3 else WD[2],W,OH)
    for x in range(cx-4,cx+4): put(px,x,base-19,ST[5],W,OH)
    for y in range(Hc+ry+8,Hc+ry+16): put(px,cx-1,y,(20,24,32),W,OH); put(px,cx,y,(20,24,32),W,OH)
    for y in range(0,4): put(px,cx-1,y,ST[4],W,OH)
    return o

# --- D: lean-to shed on the side of a house (single slope falling toward the viewer) ---
def leanto(st,wc,kinds='lpr'):
    W=wc*16; H=24; dk=T(st,'front',W,H).load(); o=Image.new('RGBA',(W,H)); px=o.load()
    for y in range(H):
        for x in range(W): px[x,y]=mul(dk[x,y],0.9)[:3]+(255,)
    for x in range(W): px[x,0]=WD[4]+(255,); px[x,H-1]=WD[1]+(255,)
    return stack((o,0),(walls(st,kinds,1,'wod' if st=='tim' else st),0))

# --- F: dormer (small gable window on the front slope) ---
def dormer(st):
    # a small window poking out of the roof, drawn in the same projection as a gable-front house: its little north-south
    # roof meets the main slope in two valleys closing at an apex (top), its gable wall faces the viewer, window below
    W,H=18,21; o=Image.new('RGBA',(W,H)); px=o.load(); lit=pj.nstex(st,'l',W,H).load(); dk=pj.nstex(st,'r',W,H).load()
    wall=pj.tex(st+'.wall',W,H).load(); gx=W/2; V=6; G=6
    for y in range(H):
        for x in range(W):
            d=x+0.5-gx
            if y<V+G:
                half=gx*min(1,(y+1)/V)
                if abs(d)>half: continue
                c=lit[x,y] if d<0 else dk[x,y]
                if y<V and abs(d)>half-1.2: c=(60,34,30)                        # valleys
                g=(y-V+1)*gx/G
                if y>=V and abs(d)<=g-1.5: c=wall[x,y]                          # its gable wall
                elif y>=V and abs(d)<=g: c=WD[4] if d<0 else WD[2]
            else:                                                              # cheeks and the window
                if abs(d)>gx-1: continue
                c=WD[3] if abs(d)>gx-3 else ((28,40,60) if y<V+G+4 else (48,86,98))
                if y in (V+G,H-1): c=WD[4] if y==V+G else WD[1]
                if abs(d)<0.8 and V+G<y<H-1: c=WD[2]
            px[x,y]=c[:3]+(255,)
    return o
def porch(st,wc=3,wall_h=32,D=12,hb=30,hf=22):
    # a porch roof fixed to the front wall just under the eave: its back edge sits at height hb ON the wall, its front
    # edge is D px forward and lower (hf), carried by two posts that stand on a plank deck. Everything follows the one
    # projection (screen y = base - height + depth). The image's top row is the wall at height hb: place it at base-hb.
    W=wc*16; H=hb+D+1; o=Image.new('RGBA',(W,H)); px=o.load(); dk=T(st,'front',W,H).load()
    yf=(hb-hf)+D                                                          # the roof's front edge on screen
    for y in range(hb,hb+D+1):                                            # deck seen from above, shaded under the roof
        for x in range(1,W-1):
            c=WD[5] if (y-hb)%3 else WD[4]
            px[x,y]=mul(c,0.62 if y<hb+D-3 else 0.85)[:3]+(255,)
    for x in range(1,W-1): px[x,H-1]=WD[1]+(255,)
    for x0 in (2,W-5):                                                    # posts from the roof's front edge to the deck front
        for y in range(yf,H-1): px[x0,y]=WD[5]+(255,); px[x0+1,y]=WD[3]+(255,); px[x0+2,y]=WD[1]+(255,)
    for y in range(0,yf+1):                                               # roof: one slope toward the viewer (east-west courses)
        for x in range(W):
            c=dk[x,y]
            if y==0: c=WD[1]                                              # the joint against the wall, in the eave's shade
            if y>=yf-1: c=WD[4] if y==yf-1 else WD[2]                     # fascia board
            if x in (0,W-1): c=WD[2]
            px[x,y]=c[:3]+(255,)
    return o

def leanto_side(st,wc=2,D=24,wall_h=32,hi=26,lo=18,kinds='door'):
    # a shed built against the house's EAST side: its roof falls to the east, so its courses run north-south (nstex,
    # the shaded side); its front wall is a trapezoid, high against the house (hi) and low at the outer end (lo); the
    # roof is that top line pushed back by the shed's depth D. Place it with its bottom row on the house's base line,
    # touching the house's right edge.
    W=wc*16; H=hi+D+1; base=H-1; o=Image.new('RGBA',(W,H)); px=o.load()
    rf=pj.nstex(st,'r',W,H).load(); wall=pj.tex(('wod' if st=='tim' else st)+'.wall',W,H).load()
    def top(x): return base-(hi-(hi-lo)*x/(W-1))                          # screen y of the front wall's top
    for x in range(W):
        t=top(x)
        for y in range(H):
            if t-D<=y<t:                                                  # roof surface
                c=mul(rf[x,y],0.9)
                if y<t-D+1: c=WD[4]
                if y>=t-2: c=WD[2]
            elif t<=y<=base:                                              # front wall: open shed with a woodpile inside
                c=wall[x,y]
                if kinds=='door' and W//2-5<=x<W//2+4 and base-17<=y<base:     # plank door
                    c=WD[1] if x in (W//2-5,W//2+3) or y==base-17 else (WD[3] if (x-W//2)%3 else WD[2])
                if x in (0,1) or x in (W-2,W-1): c=WD[3] if x in (1,W-2) else WD[1]
            else: continue
            px[x,y]=c[:3]+(255,)
    return o

# --- G: balcony with railing on an upper storey + outside stair ---
def balcony(w=48,D=12):
    # upper-floor balcony: floor at the storey line, projecting D px. Screen: its floor fills D rows below the storey
    # line (place the image's top row ON the storey line = base-32), a 3px slab edge, brackets, a railing on the front.
    H=D+3+6; o=Image.new('RGBA',(w,H)); px=o.load()
    for y in range(D):
        for x in range(w): px[x,y]=(WD[5] if (y%3) else WD[4])+(255,)
    for x in range(w):
        for y in range(D,D+3): px[x,y]=(WD[3] if y==D else WD[2] if y==D+1 else WD[1])+(255,)
    for x0 in (3,w-5):
        for y in range(D+3,H):
            for x in range(x0,x0+2): px[x,y]=(WD[3] if x==x0 else WD[1])+(255,)
    return o
def railing(w=48,h=9):
    # the balcony's front railing, drawn on top of its floor's front edge
    o=Image.new('RGBA',(w,h)); px=o.load()
    for x in range(w):
        px[x,0]=WD[5]+(255,); px[x,1]=WD[3]+(255,)
        if x%4==1 or x in (0,w-1):
            for y in range(2,h): px[x,y]=(WD[4] if x%4==1 else WD[3])+(255,)
    return o
def stair(rise=32,n=8,run=3,w=12):
    # an outside stair coming straight DOWN TOWARD THE VIEWER from a balcony's front edge (a north-south flight,
    # walkable on the grid). Each step shows its tread (top face, lit, `run` px) and the riser in front of it (front face,
    # shaded, rise/n px); side stringers are edge-on (2px). Top row = the balcony front edge.
    st_=rise//n; H=n*(run+st_)+2; o=Image.new('RGBA',(w,H)); px=o.load(); y=0
    for k in range(n):
        for yy in range(y,y+run):
            for x in range(2,w-2): px[x,yy]=(WD[6] if yy==y else WD[5])+(255,)
        for yy in range(y+run,y+run+st_):
            for x in range(2,w-2): px[x,yy]=(WD[3] if yy==y+run else WD[2])+(255,)
        y+=run+st_
    for yy in range(H):
        for x in (0,1,w-2,w-1): px[x,yy]=(WD[4] if x in (0,w-2) else WD[1])+(255,)
    for x in range(w): px[x,H-1]=ST[2]+(255,); px[x,H-2]=ST[4]+(255,)
    return o

def balcony_side(w=32):
    # projects toward the viewer: plank floor seen from above, a railing along its front, brackets under it
    o=Image.new('RGBA',(w,20)); px=o.load()
    for y in range(0,5):
        for x in range(w): px[x,y]=(WD[5] if (x//6+y)%2 else WD[4])+(255,)
    for x in range(w):
        px[x,5]=WD[5]+(255,); px[x,6]=WD[3]+(255,); px[x,13]=WD[4]+(255,); px[x,14]=WD[1]+(255,)
        if x%4==1:
            for y in range(7,13): px[x,y]=WD[4]+(255,)
            if x+1<w:
                for y in range(7,13): px[x+1,y]=WD[2]+(255,)
    for x0 in (2,w-4):
        for y in range(15,20):
            for x in range(x0,x0+2): px[x,y]=WD[3]+(255,)
    return o
def stair_side(rise=32,depth=10,run=4,step=4,up='L'):
    # an outside stair climbing along the house front, seen from the front and above like the chipset: each tread is a
    # top face (run px wide, depth px deep, lit) stepping up by `step` px; the stringer's front face runs underneath as a
    # diagonal board, and the triangle under the flight is open (the wall shows through). up='L' climbs to the left.
    n=rise//step; W=n*run+2; H=rise+depth+4; o=Image.new('RGBA',(W,H)); px=o.load()
    for i in range(n):                                                      # i = 0 at the foot
        x0=(W-2-(i+1)*run) if up=='L' else i*run; yt=H-4-depth-(i+1)*step
        for y in range(yt,yt+depth):
            for x in range(x0,x0+run+1):
                c=WD[6] if y==yt else (WD[5] if (y-yt)%3 else WD[4]) if y<yt+depth-1 else WD[3]   # plank tread, lit
                if (up=='L' and x==x0+run) or (up!='L' and x==x0): c=WD[3]   # the step's edge (riser seen edge-on)
                put(px,x,y,c,W,H)
        for y in range(yt+depth,yt+depth+step+3):                           # stringer front face, 3 px under the nosing
            for x in range(x0,x0+run+1): put(px,x,y,WD[3] if y<yt+depth+1 else (WD[2] if y<yt+depth+step+1 else WD[1]),W,H)
    return o

# --- H: windmill ---
def windmill(frame=0):
    W,H=64,96; o=Image.new('RGBA',(W,H)); px=o.load(); wall=pj.tex('tim.wall',W,H).load()
    for y in range(40,96):                                                     # tapered round tower, elliptical foot
        t=min(1,(y-40)/52); half=12+8*t
        for x in range(W):
            d=x+0.5-32
            if abs(d)<=half:
                u,cz=_wrap(d,half)
                if y>92+3*cz: continue
                k=0.62+0.5*max(0,cz*0.8-0.25*(d/half))
                px[x,y]=mul(wall[int(u+32)%W,max(0,int(y-3*cz))],min(1.12,k))[:3]+(255,)
    for y in range(80,93):
        for x in range(28,36): px[x,y]=(WD[3] if (x-28)%3 else WD[2])+(255,)
    lit=T('tim','back',W,H).load(); dk=T('tim','front',W,H).load()
    for y in range(26,44):                                                     # cap
        half=6+(y-26)*0.8
        for x in range(W):
            d=x+0.5-32
            if abs(d)<=half: px[x,y]=(lit[x,y] if d<0 else dk[x,y])[:3]+(255,)
    d=ImageDraw.Draw(o); a0=frame*math.pi/8
    for k in range(4):                                                         # sails
        a=a0+k*math.pi/2; x1=32+30*math.cos(a); y1=34+30*math.sin(a)*0.9
        d.line((32,34,x1,y1),fill=WD[2]+(255,),width=2)
        ax=32+10*math.cos(a); ay=34+10*math.sin(a)*0.9; bx=x1; by=y1
        nx,ny=-math.sin(a)*5,math.cos(a)*5*0.9
        d.polygon([(ax,ay),(bx,by),(bx+nx,by+ny),(ax+nx,ay+ny)],fill=(236,214,198,255),outline=WD[2]+(255,))
    d.ellipse((29,31,35,37),fill=WD[4]+(255,))
    return o

# --- I: open market hall: timber upper storey on posts, the ground floor open (shade, goods, people pass under) ---
def market_hall(st='tim',wc=7):
    from pj_demo import roofrows as RR, storeyrows as SR
    up=pj.assemble(RR(st,wc,None,4)+SR(st,'l'+'w'*(wc-2)+'r','eave','jetty'),L())
    W=wc*16; ground=Image.new('RGBA',(W,32)); px=ground.load()
    for y in range(32):
        for x in range(W):
            if y<30: px[x,y]=(38,30,34,255) if y<14 else (52,44,46,255)            # deep shade under the floor
            else: px[x,y]=ST[3]+(255,)
    for i in range(wc+1):                                                          # posts on stone pads
        x0=min(W-4,i*16-2 if i else 0)
        for y in range(0,30):
            for k,t in enumerate((5,4,2,1)):
                if 0<=x0+k<W: px[x0+k,y]=WD[t]+(255,)
        for k in range(-1,5):
            if 0<=x0+k<W: px[x0+k,28]=ST[4]+(255,); px[x0+k,29]=ST[2]+(255,)
    for k in range(3):                                                             # sacks and a crate glimpsed inside
        cx=24+k*28
        for y in range(20,28):
            for x in range(cx,cx+8): px[x,y]=((150,120,90,255) if y>21 else (180,150,110,255))
    return stack((up,0),(ground,0))

# --- J: cross-gabled range (FF5 Karnak / FF6 South Figaro idiom): a long east-west roof with forward gables whose
#        north-south ridges peak above it, so the skyline becomes a row of points instead of one flat edge ---
def crossgable(st,w,s=1,gables=(1,),proj=1,gs=None,doors=None):
    from pj_demo import roofrows as RR, storeyrows as SR
    gs=gs or st; R=3 if s==1 else 4; peak=20   # = the gable's rise G
    cov=set(c+i for c in gables for i in range(3))
    k=['l']+['p']*(w-2)+['r']; free=[i for i in range(1,w-1) if i not in cov]
    for i in free: k[i]='w' if i%2 else ('m' if st=='tim' and i<w//2 else ('n' if st=='tim' else 'p'))
    main_rows=RR(st,w,None,R)+((SR(st,''.join(k),'eave','jetty')+SR(gs,''.join(k),'plain','base')) if s==2 else SR(gs,''.join(k),'eave','base'))
    main=pj.assemble(main_rows,L())
    H=peak+main.height+proj*16; o=Image.new('RGBA',(w*16,H)); o.alpha_composite(main,(0,peak))
    for j,c in enumerate(gables):
        G=20; roofH=peak+(R+proj)*16-(0)
        g=gable_end(st,48,roofH,G)
        kinds='ldr' if (doors is None and j==0) or (doors and c in doors) else 'lwr'
        body=walls(st,kinds,s,gs) if s==1 else stack((walls(st,'lwr',1,st,'eave'),0),(walls(gs,kinds,1,gs,'plain'),0))
        o.alpha_composite(stack((g,0),(body,0)),(c*16,0))
    return o

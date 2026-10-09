# batch 6d: house BLOCK set — every block is one 16x16 cell, placed by name on a grid; houses are assembled, not painted.
# Families (per style 'tim' half-timber / 'sto' stone):
#   roof  : roof.ridge / roof.body / roof.eave   ×  .l (verge end) / .m / .r
#   gable : gable.tl gable.tm gable.tr / gable.bl gable.bm gable.br   (3x2, sits on the lowest two roof rows, over a door)
#   wall  : upper half  <style>.u.<kind>.<eave|plain>   kind: l r m n p w d   (m '\' brace, n '/' brace, p plain, w window, d door top)
#           lower half  <style>.b.<kind>.<base|jetty>   kind: l r m n p d f   (f flower box under a window, d door bottom)
#   extra : chimney.top / chimney.bot (overlay on the roof)
import sys, math; sys.path.insert(0,__import__('os').path.dirname(__import__('os').path.abspath(__file__)))
from px2 import C, vnoise, _hash, PAL, GRAIN
from PIL import Image
import pg   # palettes 'slate', 'plaster'
P={}; WATER=set()
import os
CHIP=os.environ.get('PJ_CHIP','1')=='1'     # surfaces = the chipset's own tile interiors (matches its grain exactly)
_CHIPIM=[None]
# the chipset's roof comes as a 2x2 PAIR per colour: lit back slope (top tile carries the back-eave bars) over a
# shaded front slope (bottom tile carries the front-eave bars). The ridge is where lit meets shade.
ROOFPAIR={'tim':{'back0':(224,192),'back':(224,208),'front':(240,192),'eave':(240,208)},
          'wod':{'back0':(224,192),'back':(224,208),'front':(240,192),'eave':(240,208)},
          'sto':{'back0':(256,224),'back':(256,240),'front':(272,224),'eave':(272,240)}}
TEXAT={'tim.roof':(240,192),'sto.roof':(272,208),'wod.roof':(240,192),'tim.wall':(248,16),'sto.wall':(200,16),'wod.wall':(200,56)}
def tex(key,w,h,dx=0,dy=0):
    if _CHIPIM[0] is None:
        _CHIPIM[0]=Image.open(os.environ.get('PJ_CHIPSET',__import__('os').path.join(__import__('os').path.dirname(__import__('os').path.abspath(__file__)),'assets','jungle-chipset-v6.png'))).convert('RGBA')
    tx,ty=TEXAT[key]; t=_CHIPIM[0].crop((tx,ty,tx+16,ty+16)); o=Image.new('RGBA',(w,h))
    for y in range(-16,h+16,16):
        for x in range(-16,w+16,16): o.paste(t,(x+dx%16-16+16,y+dy%16))
    return o
def shade(im,box,k):
    # multiply the pixels in box by k (k<1 darker, >1 lighter)
    px=im.load(); x0,y0,x1,y1=box
    for y in range(max(0,y0),min(im.height,y1)):
        for x in range(max(0,x0),min(im.width,x1)):
            r,g,b,a=px[x,y]
            if a: px[x,y]=(min(255,int(r*k)),min(255,int(g*k)),min(255,int(b*k*(1.08 if k<1 else 1))),a)
def under(bg,fg): bg=bg.copy(); bg.alpha_composite(fg); return bg
ROOF={'tim':'cloth','sto':'slate','wod':'cloth'}
B='bark'

def _roof_v(x,y,Rh=32):
    # rounded tile scales 8 wide x 4 tall, alternate courses offset by 4: chunky clusters like the chipset roof pieces
    xx=x%16; course=(y%32)//4; off=4 if course%2 else 0; lx=(xx+off)%8; ly=y%4
    v=0.9-0.25*((y%32)/32)
    if (ly==3 and 1<=lx<=6) or (ly==2 and lx in (0,7)): v-=0.34
    elif ly==0 and lx in (2,3): v+=0.14
    elif lx in (0,7): v-=0.1
    return v

def roof(row,side,style):
    # rows: 'ridge' (lit back slope, back-eave bars) / 'back' (lit) / 'front' (shaded, ridge cap on top) / 'body' (shaded) / 'eave'
    R=ROOF[style]; c=C(16,16,seed=200); c.period=16; c.new()
    yb={'ridge':0,'back':6,'front':12,'body':12,'eave':24}[row]
    if not CHIP:
        for y in range(16):
            for x in range(16): c.setv(x,y,R,_roof_v(x,y)+0.15-0.3*(yb+y)/40)
        if row=='ridge':
            for x in range(16): c.tone(x,0,R,6); c.tone(x,1,R,4); c.tone(x,2,R,1)
        if row=='eave':
            for x in range(16): c.tone(x,14,R,2); c.tone(x,15,R,1)
    if CHIP and row=='front':
        for x in range(16): c.tone(x,0,R,6 if x%4 else 5); c.tone(x,1,R,1)            # ridge cap where the slopes meet
    if side=='l':
        for y in range(16): c.tone(0,y,B,4); c.tone(1,y,B,2)
    if side=='r':
        for y in range(16): c.tone(14,y,B,3); c.tone(15,y,B,1)
    if CHIP:
        key={'ridge':'back0','back':'back','front':'front','body':'front','eave':'eave'}[row]
        tx,ty=ROOFPAIR[style][key]; _ensure_chip(); t=_CHIPIM[0].crop((tx,ty,tx+16,ty+16))
        c.img_=under(t,c.img(outline=False))
    return c
def _ensure_chip():
    if _CHIPIM[0] is None: tex('tim.wall',16,16)
def pairtex(style,key,w,h):
    _ensure_chip(); tx,ty=ROOFPAIR[style][key]; t=_CHIPIM[0].crop((tx,ty,tx+16,ty+16)); o=Image.new('RGBA',(w,h))
    for y in range(0,h,16):
        for x in range(0,w,16): o.paste(t,(x,y))
    return o

def nstex(style,side,w,h):
    # a slope of a north-south ridge: shingle courses run along the ridge (north-south), their butts face down-slope
    # (left slope -> left, right slope -> right). Same chipset tiles as the east-west roof, turned 90 degrees.
    _ensure_chip(); tx,ty=ROOFPAIR[style]['back' if side=='l' else 'front']
    t=_CHIPIM[0].crop((tx,ty,tx+16,ty+16)).transpose(Image.ROTATE_270 if side=='l' else Image.ROTATE_90)
    o=Image.new('RGBA',(w,h))
    for y in range(0,h,16):
        for x in range(0,w,16): o.paste(t,(x,y))
    return o

def gable(style,wingbase=None):
    # one 48x32 design cut into 6 blocks: raised '/\' roof, gable wall with a round window; main roof shows behind the slopes
    R=ROOF[style]; c=C(48,32,seed=201); c.period=16; c.new()
    if not CHIP:
        for y in range(32):
            for x in range(48): c.setv(x,y,R,_roof_v(x,y)+0.15-0.3*(12+y)/40)
    for x in range(48): c.tone(x,30,R,2); c.tone(x,31,R,1)
    gx=24; c.group(2); c.new()
    if CHIP:
        base=pairtex(style,'front',48,32); eave=pairtex(style,'eave',48,16); base.paste(eave,(0,16))
        if wingbase is not None: base=wingbase.copy()
        wall=tex(style+'.wall',48,32,dy=0); lit=pairtex(style,'back',48,32).load(); dk=pairtex(style,'front',48,32).load(); bp=base.load(); wp=wall.load()
        for y in range(32):
            half=int(23*y/31)+1
            for x in range(gx-half,gx+half+1):
                edge=half-abs(x-gx)
                if not 0<=x<48: continue
                if edge<=5:
                    # slope band: the roof texture slid along the slope, lit on the left, shaded on the right
                    sx=(x+(y if x<gx else -y))%48
                    r,g,b,a=(lit if x<gx else dk)[sx,y]; k=1.0 if x<gx else 0.85
                    bp[x,y]=(int(r*k),int(g*k),int(b*k),255)
                else: bp[x,y]=wp[x,y]
    for y in range(0,32):
        half=int(23*y/31)+1
        for x in range(gx-half,gx+half+1):
            edge=half-abs(x-gx)
            if CHIP:
                if style=='tim' and edge>5:
                    if abs(x-gx)<=1: c.tone(x,y,B,3 if x<=gx else 2)
                    if y in (26,27): c.tone(x,y,B,3)
            elif edge<=5: c.setv(x,y,R,_roof_v(x+(y if x<gx else -y),y)+(0.22 if x<gx else -0.3))
            elif style=='tim':
                c.setv(x,y,'plaster',0.68)
                if abs(x-gx)<=1: c.tone(x,y,B,3 if x<=gx else 2)
                if y in (26,27): c.tone(x,y,B,3)
            else:
                row=y//4; off=4 if row%2 else 0; v=0.6+(_hash((x+off)//8,row,201)-0.5)*0.22
                if y%4==3 or (x+off)%8==7: v-=0.28
                c.setv(x,y,'stone',v)
    for y in range(32):
        half=int(23*y/31)+1
        for k in (0,1): c.tone(gx-half+k,y,B,4-k); c.tone(gx+half-k,y,B,1+k)   # barge boards on both slopes
    c.tone(gx,0,R,6)
    c.new()
    for y in range(13,21):
        for x in range(gx-4,gx+5):
            if (x-gx)**2+(y-16.5)**2<=13: c.tone(x,y,'cryst',2 if y<17 else 3)
    c.tone(gx-2,15,'cryst',5)
    for y in range(13,21): c.tone(gx,y,B,3)
    for x in range(gx-3,gx+4): c.tone(x,17,B,3)
    if CHIP: c.img_=under(base,c.img(outline=False))
    return c

def storey(style,kind,top,bottom):
    # 16x32 design for one storey of one column; cut into the upper and lower block
    c=C(16,32,seed=202); c.period=16; c.new()
    for y in (range(32) if not CHIP else ()):
        for x in range(16):
            if style=='tim': v=0.66+(vnoise(x,y,3,202)-0.5)*0.12-0.05*y/32
            else:
                row=y//4; off=4 if row%2 else 0; v=0.6+(_hash((x+off)//8,row,202)-0.5)*0.22
                if y%4==3 or (x+off)%8==7: v-=0.28
            c.setv(x,y,'plaster' if style=='tim' else 'stone',v)
    def post(x0):
        for y in range(0,30):
            for k in range(3): c.tone(x0+k,y,B,(4,3,1)[k])
    for x in range(16): c.tone(x,0,B,4); c.tone(x,1,B,2)
    if style=='tim':
        for x in range(16): c.tone(x,19,B,4); c.tone(x,20,B,2)
        post(0)
        if kind=='r': post(13)
        if kind in 'mn':
            for (ya,yz) in ((2,19),(21,30)):
                n=yz-ya
                for j in range(n):
                    x=3+round(j*10/n) if kind=='m' else 13-round(j*10/n)
                    c.tone(x,ya+j,B,3); c.tone(x+(1 if kind=='m' else -1),ya+j,B,2)
    elif style=='wod':                                                     # log/plank barn: dark corner posts only
        if kind=='l':
            for y in range(0,30): c.tone(0,y,B,2); c.tone(1,y,B,3)
        if kind=='r':
            for y in range(0,30): c.tone(14,y,B,2); c.tone(15,y,B,1)
    else:
        for (q0,side) in ((0,1),(12,-1)):
            if (kind=='l' and side>0) or (kind=='r' and side<0):
                for q in range(0,28,4):
                    wq=4 if (q//4)%2 else 3
                    for y in range(2+q,min(30,5+q)):
                        for x in (range(q0,q0+wq) if side>0 else range(q0+4-wq,q0+4)):
                            if CHIP: c.tone(x,y,'plaster',5 if y<4+q else 4)
                            else: c.setv(x,y,'stone',0.9)
    if bottom=='base':
        for x in range(16):
            c.setv(x,30,'mstone' if style=='sto' else 'stone',0.72); c.setv(x,31,'mstone' if style=='sto' else 'stone',0.45)
            if x%8==0: c.tone(x,30,'stone',2)
    elif style=='tim':
        for x in range(16): c.tone(x,30,B,4); c.tone(x,31,B,1)
    else:
        for x in range(16): c.setv(x,30,'stone',0.95); c.setv(x,31,'stone',0.5)
    if kind=='w':
        wy=3; c.new()
        for y in range(wy,wy+11):
            for x in range(5,12):
                if y==wy and x in (5,11): continue
                c.tone(x,y,'cryst',1 if y<wy+4 else 2)
        c.tone(6,wy+2,'cryst',5); c.tone(6,wy+3,'cryst',4); c.tone(10,wy+8,'cryst',4)
        for y in range(wy,wy+11): c.tone(8,y,B,3)
        for x in range(5,12): c.tone(x,wy+5,B,3)
        for y in range(wy,wy+12): c.tone(4,y,B,4); c.tone(12,y,B,1)
        for x in range(5,12): c.tone(x,wy-1,B,4)
        for x in range(3,14): c.tone(x,14,'wood',5); c.tone(x,15,'wood',2)
    if kind=='f':                                                          # flower box hung under a window
        c.new()
        for x in range(3,14): c.tone(x,17,'wood',5); c.tone(x,18,'wood',3); c.tone(x,19,'wood',2)
        for (x,m) in ((4,'red'),(6,'pink'),(8,'gold'),(10,'red'),(12,'pink')): c.tone(x,16,m,5); c.tone(x+1,16,'leaf',3)
    if kind=='d':
        dy=6; c.new()
        for y in range(dy,30):
            for x in range(4,13):
                if y<dy+2 and x in (4,12): continue
                c.setv(x,y,'wood',0.68-(0.22 if x%3==1 else 0)-0.12*(y-dy)/24)
        for y in range(dy,30): c.tone(3,y,B,4); c.tone(13,y,B,1)
        for x in range(5,12): c.tone(x,dy-1,B,4)
        for (x,y) in ((5,dy+5),(11,dy+5),(5,dy+17),(11,dy+17)): c.tone(x,y,'iron',4)
        c.tone(11,dy+11,'gold',5); c.tone(11,dy+12,'gold',3)
        if bottom=='base':
            for x in range(2,15): c.tone(x,30,'stone',6); c.tone(x,31,'stone',3)
    if kind=='a':                                                          # tall lancet window (chapel)
        c.new()
        for y in range(2,28):
            for x in range(5,11):
                if y<5 and abs(x-7.5)>(y-1)*1.2: continue                      # pointed arch
                c.tone(x,y,'cryst',1 if (x+y)%5 else 2)
        for (x,y) in ((6,6),(6,7),(9,15),(6,20)): c.tone(x,y,'cryst',4)
        for y in range(3,28): c.tone(7,y,'iron',2) if y%1==0 else None
        for x in range(5,11):
            for y in (10,17,23): c.tone(x,y,'iron',2)
        for y in range(2,28): c.tone(4,y,'stone',5); c.tone(11,y,'stone',3)
        for x in range(4,12): c.tone(x,28,'stone',5); c.tone(x,29,'stone',3)
        c.tone(7,1,'stone',5); c.tone(8,1,'stone',4)
    if kind=='s':                                                          # shopfront: hanging sign above, awning + display window below
        c.new()
        for x in range(2,14): c.tone(x,5,B,2)
        for y in range(6,13):
            for x in range(3,13): c.tone(x,y,'wood',5 if y==6 else (4 if x<8 else 3))
        for (x,y) in ((6,8),(7,8),(8,8),(9,8),(7,9),(8,9),(7,10),(8,10)): c.tone(x,y,'gold',5)   # painted loaf / bag mark
        for y in range(3,6): c.tone(3,y,'iron',3); c.tone(12,y,'iron',3)
        for y in range(16,21):                                              # scalloped awning over the whole column
            for x in range(0,16):
                if y==20 and x%3==1: continue
                c.tone(x,y,'red' if (x//3)%2==0 else 'cream',5 if y==16 else 4 if y<19 else 3)
        for x in range(0,16): c.tone(x,21,'dark',2) if x%3!=1 else None
        for y in range(22,29):
            for x in range(2,14): c.tone(x,y,'cryst',1 if y<25 else 2)
        for (x,m) in ((3,'red'),(5,'gold'),(8,'leaf'),(10,'red'),(12,'gold')):
            c.tone(x,27,m,5); c.tone(x,26,m,4); c.tone(x+1,27,m,3); c.tone(x,25,m,5)
        c.tone(4,23,'cryst',5); c.tone(5,23,'cryst',4)
        for y in range(22,29): c.tone(8,y,B,3); c.tone(1,y,B,4); c.tone(14,y,B,1)
        for x in range(1,15): c.tone(x,28,'wood',5); c.tone(x,29,'wood',2)
    if kind in 'gh':                                                       # barn double door, two columns wide
        c.new(); xs=range(3,16) if kind=='g' else range(0,13)
        for y in range(4,30):
            for x in xs:
                c.setv(x,y,'wood',0.66-(0.2 if x%3==0 else 0)-0.1*(y-4)/26)
        for x in xs: c.tone(x,3,B,4); c.tone(x,4,B,2)
        edge=3 if kind=='g' else 12
        for y in range(4,30): c.tone(edge,y,B,4 if kind=='g' else 1)
        n=len(xs)
        for j in range(26):
            xx=xs[0]+round(j*(n-2)/25) if kind=='g' else xs[-1]-round(j*(n-2)/25)
            c.tone(xx,4+j,'wood',6); c.tone(xx+1,4+j,'wood',3)
        for y in (8,24):
            for x in (xs[0]+1,xs[0]+2) if kind=='g' else (xs[-1]-2,xs[-1]-1): c.tone(x,y,'iron',4)
        if kind=='g': c.tone(15,17,'iron',5)
        else: c.tone(0,17,'iron',4)
    if kind=='b':                                                          # belfry: open arch with a bell
        c.new()
        for y in range(4,28):
            for x in range(3,13):
                if y<8 and abs(x-7.5)>(y-3)*1.3: continue
                c.tone(x,y,'dark',1 if y<12 else 2)
        c.new(); c.ellipsoid(8,13,3.4,4,'gold',amb=0.35,bias=0.1)
        for x in range(4,13): c.tone(x,17,'gold',3) if c.m[16][x]=='gold' else None
        c.tone(8,18,'gold',2); c.tone(8,8,'iron',3)
        for y in range(18,27): c.tone(8,y,'rope',4)
        for y in range(4,28): c.tone(2,y,'stone',5); c.tone(13,y,'stone',3)
        for x in range(2,14): c.tone(x,28,'stone',5); c.tone(x,29,'stone',3)
    if top=='eave':
        for x in range(16): c.darken(x,0,2); c.darken(x,1,1); c.darken(x,2,1)
    if CHIP:
        c.img_=under(tex(style+'.wall',16,32),c.img(outline=False))
        if top=='eave': shade(c.img_,(0,0,16,5),0.62); shade(c.img_,(0,5,16,8),0.82)
    return c

def chimney(style):
    c=C(16,32,seed=203); c.group(1); c.box(4,4,8,2,26,'clay' if style=='tim' else 'stone')
    for y in range(6,30):
        for x in range(4,12):
            if (y%3==0) or ((x+(2 if (y//3)%2 else 0))%4==0): c.darken(x,y,1)
    c.group(2); c.box(3,2,10,2,2,'stone',bias=0.1)
    c.new()
    for x in range(5,11): c.tone(x,2,'dark',1)
    return c


def spire(style,w=3,h=4):
    # square pyramid roof on a tower, seen from the front and above like everything else: the base is the tower top
    # (a W x D rectangle foreshortened, its front edge = the bottom row); the apex rises above its centre. Visible faces:
    # the FRONT face (a broad triangle, east-west courses, the shaded roof tile - like any front slope), and thin LEFT (lit)
    # and RIGHT (shade) faces between the front face's edges and the base's back corners. Never split down the middle:
    # a lit/dark split at the axis means a corner points at the viewer (oblique), which the chipset never shows.
    W,H=w*16,h*16; D=7; ay=4; ax=W/2; yb=H-2
    out=Image.new('RGBA',(W,H)); op=out.load()
    fr=pairtex(style,'front',W,H).load(); lf=nstex(style,'l',W,H).load(); rt=nstex(style,'r',W,H).load()
    def xl(y,y0): return ax-(ax)*(y-ay)/(y0-ay)           # left edge of a line from the apex to (0,y0)
    for y in range(ay,yb+1):
        for x in range(W):
            d=x+0.5
            fl=xl(y,yb); fr_=W-fl                           # front face edges (to the front corners)
            bl=xl(y,yb-D) if y<=yb-D else 0; br=W-bl        # side faces reach the back corners
            if fl<=d<=fr_: c=fr[x,y]; k=1.0; face='f'
            elif bl<=d<fl: c=lf[x,y]; k=1.08; face='l'
            elif fr_<d<=br: c=rt[x,y]; k=0.72; face='r'
            else: continue
            if face=='f' and (abs(d-fl)<1.0): c=WD_(5)
            if face=='f' and (abs(d-fr_)<1.0): c=WD_(1)
            op[x,y]=(min(255,int(c[0]*k)),min(255,int(c[1]*k)),min(255,int(c[2]*k)),255)
    for x in range(W):                                       # eave board along the front edge
        op[x,yb]=WD_(2)+(255,); op[x,yb+1]=WD_(1)+(255,)
    c=C(W,H,seed=205); c.group(1); c.new()
    for y in range(0,ay+2): c.tone(int(ax)-1,y,'iron',4); c.tone(int(ax),y,'iron',2)
    c.new(); c.ellipsoid(ax,2.5,1.6,1.6,'gold',amb=0.4,bias=0.15)
    out.alpha_composite(c.img(outline=False)); return out
def WD_(i):
    import palette
    hx=lambda s:tuple(int(s[j:j+2],16) for j in (1,3,5))
    return ([hx(palette.OUT_CHIP['wood'])]+[hx(c) for c in palette.RAMPS_CHIP['wood']])[i]

def _halves(style,W,H,cap=True):
    # a roof whose ridge runs north-south: left half the lit slope, right half the shaded slope, ridge cap between
    lit=nstex(style,'l',W,H); dk=nstex(style,'r',W,H); o=lit.copy(); o.paste(dk.crop((W//2,0,W,H)),(W//2,0))
    c=C(W,H,seed=206); c.new(); R=ROOF[style]
    if cap:
        for y in range(H): c.tone(W//2-1,y,R,6 if y%4 else 5); c.tone(W//2,y,R,1)
    for y in range(H): c.tone(0,y,B,4); c.tone(1,y,B,2); c.tone(W-2,y,B,3); c.tone(W-1,y,B,1)
    o.alpha_composite(c.img(outline=False)); return o
def wing(style,rows):
    # a 3-wide cross wing projecting toward the viewer: north-south ridge roof, gable end on its last two rows
    W,H=48,rows*16; o=_halves(style,W,H)
    g=_im(gable(style,wingbase=o.crop((0,H-32,W,H)))); o.paste(g,(0,H-32)); return o
def nwing(style,rows):
    # a wing going away from the viewer: only its roof shows above the main ridge; the far end is a hip line
    W,H=48,rows*16; o=_halves(style,W,H); c=C(W,H,seed=207); c.new(); R=ROOF[style]
    for x in range(2,W-2): c.tone(x,0,R,6 if x<W//2 else 4); c.tone(x,1,R,1)
    o.alpha_composite(c.img(outline=False)); return o

def vwing(style,rows,V=32):
    # a cross wing whose ridge is as high as the main ridge: over the main front slope (top V px) only a triangle of the
    # wing shows, bounded by the two valleys that run from the ridge point down to the main eave corners; transparent
    # outside it so the main roof shows through. Below V the wing is full width and ends in its gable.
    W,H=48,rows*16; o=wing(style,rows); px=o.load(); gx=W/2
    for y in range(V):
        half=gx*(y+1)/V
        for x in range(W):
            d=abs(x+0.5-gx)
            if d>half: px[x,y]=(0,0,0,0)
            elif d>half-1.5: px[x,y]=WD1(style)
    return o
def nwing2(style,rows,V=16,G=20):
    # a wing going away (north): its far end is a gable peak (G px, like every north-south ridge), its near end
    # meets the main back slope in two valleys that close at the main ridge (bottom V px, transparent outside)
    W,H=48,rows*16+V; o=_halves(style,W,H); px=o.load(); gx=W/2
    for y in range(H):
        for x in range(W):
            d=abs(x+0.5-gx)
            if y<G and d>gx*(y+1)/G: px[x,y]=(0,0,0,0)
            elif y<G and d>gx*(y+1)/G-2: px[x,y]=WD1(style)
            elif y>=H-V:
                half=gx*(H-y)/V
                if d>half: px[x,y]=(0,0,0,0)
                elif d>half-1.5: px[x,y]=WD1(style)
    return o
def WD1(style):
    return (60,34,30,255)

# ---- the block library: name -> 16x16 RGBA ----
def _cut(im,x,y): return im.crop((x*16,y*16,x*16+16,y*16+16))
def _im(c): return getattr(c,'img_',None) or c.img(outline=False)
def library():
    L={}
    for st in ('tim','sto','wod'):
        for row in ('ridge','back','front','body','eave'):
            for side in ('l','m','r'): L[f'{st}.roof.{row}.{side}']=_im(roof(row,side,st))
        g=_im(gable(st))
        for j,r in enumerate('tb'):
            for i,cn in enumerate('lmr'): L[f'{st}.gable.{r}{cn}']=_cut(g,i,j)
        for kind in 'lrmnpwdasghb':
            for top in ('eave','plain'):
                L[f'{st}.u.{kind}.{top}']=_cut(_im(storey(st,kind,top,'base')),0,0)
        for kind in 'lrmnpdfasghb':
            for bottom in ('base','jetty'):
                L[f'{st}.b.{kind}.{bottom}']=_cut(_im(storey(st,kind,'plain',bottom)),0,1)
        for rows in range(3,10):
            wg=wing(st,rows)
            for j in range(rows):
                for i in range(3): L[f'{st}.wing{rows}.{j}{i}']=_cut(wg,i,j)
        for rows in range(2,10):
            vw=vwing(st,rows)
            for j in range(rows):
                for i in range(3): L[f'{st}.vwing{rows}.{j}{i}']=_cut(vw,i,j)
        for rows in range(1,5):
            for nb in (1,2):
                nw=nwing2(st,rows,nb*16)
                for j in range(rows+nb):
                    for i in range(3): L[f'{st}.nwing{rows}_{nb}.{j}{i}']=_cut(nw,i,j)
        for rows in range(1,5):
            nw=nwing(st,rows)
            for j in range(rows):
                for i in range(3): L[f'{st}.nwing{rows}.{j}{i}']=_cut(nw,i,j)
        sp=spire(st)
        for j in range(4):
            for i in range(3): L[f'{st}.spire.{j}{i}']=_cut(sp,i,j)
        ch=chimney(st).img(); L[f'{st}.chimney.top']=_cut(ch,0,0); L[f'{st}.chimney.bot']=_cut(ch,0,1)
    return L

def assemble(rows,L,overlays=()):
    # rows: list of strings of space-separated block names ('.' = empty). overlays: (name,x,y)
    grid=[r.split() for r in rows]; H=len(grid); W=max(len(r) for r in grid)
    im=Image.new('RGBA',(W*16,H*16+1))
    for y,r in enumerate(grid):
        for x,n in enumerate(r):
            if n!='.': im.alpha_composite(L[n],(x*16,y*16))
    for n,x,y in overlays: im.alpha_composite(L[n],(x*16,y*16))
    return im

def outlined(im,k=0.32):
    # pad by 1px on every side, then outline; place the result one pixel up-left
    p=Image.new('RGBA',(im.width+2,im.height+2)); p.alpha_composite(im,(1,1)); return outline(p,k)

def outline(im,k=0.32):
    # coloured outline around the assembled silhouette: each edge pixel takes its neighbour's colour, darkened
    # (like the chipset trees' dark-green rim) — blocks themselves carry no outline so they join seamlessly
    W,H=im.size; src=im.load(); out=im.copy(); dst=out.load()
    for y in range(H):
        for x in range(W):
            if src[x,y][3]>0: continue
            for dx,dy in ((0,1),(1,0),(-1,0),(0,-1)):
                xx,yy=x+dx,y+dy
                if 0<=xx<W and 0<=yy<H and src[xx,yy][3]>128:
                    r,g,b,_=src[xx,yy]; dst[x,y]=(int(r*k),int(g*k),int(b*k*1.2),255); break
    return out

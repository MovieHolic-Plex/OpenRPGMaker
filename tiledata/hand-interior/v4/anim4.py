# v4 animation: every moving piece is a PERIODIC function of t with a period that divides N (=12 frames, 100 ms),
# so frame N would equal frame 0 and the loop never jumps. seamless() proves it by painting t=N and comparing.
import sys, math; sys.path.insert(0,'/tmp/j8v4')
import kit4
from kit4 import *
import anim as A
from p3 import FIRE as F3
N=12; MS=100
TAU=2*math.pi
def osc(t,k=1,ph=0.0): return math.sin(TAU*k*t/N+ph)
def flame(p,cx,base,w,h,t,seed=0):
    """teardrop tongues; each tongue's height breathes with 1 or 2 cycles per loop; a spark rises every half loop"""
    for k in range(-(w//2),w//2+1):
        x=cx+k
        hh=int(round(h*(1-abs(k)/(w/2+1))*(0.78+0.25*osc(t,1+(abs(k)+seed)%2,k*1.3+seed))))
        for d in range(hh):
            y=base-d; f=d/max(1,hh)
            c=F3[5] if (f<0.35 and abs(k)<w/4) else (F3[4] if f<0.6 else (F3[3] if f<0.85 else F3[2]))
            p.set(x,y,c)
    s=(t+seed*3)%6                                  # spark: rises 6 px, twice per loop
    if s<4: p.set(cx+(1 if (t//6+seed)%2 else -1),base-h-1-s,F3[3] if s<2 else F3[2])
def framed(base_fn,paint,n=N):
    fr=[]
    for t in range(n):
        f=base_fn(); p=Pix(f.im.width,f.im.height); p.im.alpha_composite(f.im); paint(p,t); fr.append(p.im)
    out=base_fn(); out.im=fr[0]; out.frames=fr; out.ms=MS; out.paint=(base_fn,paint); return out
def seamless(f):
    """paint t=N (one period later) and compare with frame 0; also report how different the last->first step is
    compared with the average neighbouring step (a jump shows up as a much larger number)"""
    base_fn,paint=f.paint; g=base_fn(); p=Pix(g.im.width,g.im.height); p.im.alpha_composite(g.im); paint(p,N)
    same=p.im.tobytes()==f.frames[0].tobytes()
    def diff(a,b): return sum(1 for u,v in zip(a.getdata(),b.getdata()) if u!=v)
    steps=[diff(f.frames[i],f.frames[(i+1)%len(f.frames)]) for i in range(len(f.frames))]
    return {'periodic':same,'wrapStepPx':steps[-1],'meanStepPx':round(sum(steps[:-1])/max(1,len(steps)-1),1)}
BASE=A.BASE
def a_fireplace():
    def paint(p,t):
        for y in range(14,24):
            for x in range(10,22):
                if p.get(x,y)[:3] in [c[:3] for c in F3]: p.set(x,y,hx('#140c0c'))
        flame(p,16,23,10,9,t); flame(p,13,23,4,5,t,1); flame(p,19,23,4,5,t,2)
        for x in range(10,22): p.set(x,24,WOOD[4]); p.set(x,25,WOOD[2])
        for x in range(11,21,3):                      # embers pulse
            p.set(x,24,M['orange'][5] if osc(t,1,x)>0.3 else M['red'][4])
    return framed(lambda:kit.fireplace(),paint)
def a_forge():
    def paint(p,t):
        for y in range(18,25):
            for x in range(4,28):
                if y<20: c=M['black'][0]
                else:
                    v=osc(t,1,x*0.8+y*0.9)+0.5*osc(t,2,x*0.3)
                    c=M['yellow'][5] if v>1.0 else (M['orange'][5] if v>0.3 else (M['orange'][4] if v>-0.5 else M['red'][3]))
                    if y>=23: c=M['red'][3] if osc(t,1,x)>-0.3 else M['red'][2]
                p.set(x,y,c)
        for i,cx in enumerate((9,15,21)): flame(p,cx,20,5,5,t,i)
    return framed(lambda:BASE['forge'](),paint)
def a_oven():
    def paint(p,t):
        for x in range(11,21):
            for y in (24,25):
                v=osc(t,1,x*0.9+y)
                p.set(x,y,M['yellow'][5] if v>0.5 else (M['orange'][5] if v>-0.2 else M['orange'][4]))
        flame(p,13,23,3,3,t,0); flame(p,19,23,3,3,t,1)
    return framed(lambda:BASE['bread oven'](),paint)
def a_stove():
    def paint(p,t):
        for y in range(11,17):
            for x in range(5,11): p.set(x,y,hx('#1a0c08'))
        flame(p,8,16,5,5,t)
    return framed(lambda:kit.stove(),paint)
def a_cauldron():
    L=MT.ramp('#0a2a0a','#3aa030','#c0ff80')
    def paint(p,t):
        for i,(bx,by) in enumerate(((5,5),(9,6),(7,4),(11,5))):
            ph=(t+i*3)%6                               # a bubble swells and pops, 2x per loop, staggered
            if ph in (1,2): p.set(bx,by,L[6] if ph==2 else L[5])
            if ph==2: p.set(bx+1,by,L[5])
        for k in range(3):                             # steam wisps rise 4 px per half loop
            s=(t+k*2)%6
            if s<4: p.set(6+k*2+(1 if osc(t,1,k)>0 else 0),3-s,(230,240,230,140-s*25))
    return framed(lambda:BASE['cauldron'](),paint)
def a_tank():
    W0,W1=2,29                                         # water columns (inclusive)
    def fish_at(p,name,x,y,flip):
        f,a,b=G[name]; q=Pix(a,b); f(q,0,0); im=q.im.transpose(Image.FLIP_LEFT_RIGHT) if flip else q.im
        for j in range(b):
            for i in range(a):
                c=im.getpixel((i,j)); X=x+i
                if c[3] and W0<=X<=W1: p.set(X,y+j,c)
    def paint(p,t):
        for yy in range(6,19):
            for xx in range(W0,W1+1):
                c=M['water'][4 if yy<12 else 3]
                if (xx-yy+t*2)%12==0 and yy<12: c=M['water'][5]      # light streaks drift 2 px/frame, period 6
                p.set(xx,yy,c)
        for xx,base in ((10,18),(24,18),(17,18)):                     # weeds sway (1 cycle per loop)
            sw=int(round(osc(t,1,xx)))
            for d in range(4):
                p.set(xx+(sw if d>=2 else 0),base-d,M['green'][4 if d%2 else 3])
        fish_at(p,'fishr',-7+(t*3)%36,9,False)                       # swims east 3 px/frame, wraps every 36 px
        fish_at(p,'fish',-7+(36-(t*3)%36)%36,13,True)                 # swims west
        fish_at(p,'fishg',19,8+int(round(osc(t,1))),False)            # hovers, bobbing
        for i,bx in enumerate((6,13,26)):                             # bubbles rise 1 px/frame from the gravel
            y=17-((t+i*4)%12)
            if y>=6: p.set(bx+(1 if osc(t,2,i)>0.5 else 0),y,M['white'][6] if y>8 else M['water'][6])
    return framed(lambda:BASE['fish tank'](),paint)
def _flicker(fn,pts):
    seq=[6,6,5,6,5,4,5,6,6,5,4,5]                                     # 12-step flame brightness, first ~ last
    def paint(p,t):
        for i,(x,y) in enumerate(pts):
            k=(t+i*4)%N; v=seq[k]
            p.set(x,y,M['yellow'][v] if v>4 else M['orange'][4])
            lean=int(round(osc(t,1,i*2.0)))
            p.set(x+lean,y-1,M['yellow'][6] if v>=5 else (0,0,0,0))
    return framed(fn,paint)
def a_candle(): return _flicker(lambda:kit.candle(),[(8,3)])
def a_candelabra(): return _flicker(lambda:BASE['candelabra'](),[(2,8),(6,8),(10,8)])
def a_sconce(): return _flicker(lambda:BASE['wall sconce'](),[(7,1),(8,1)])
def a_range():
    def paint(p,t):
        g=kitchen_range(t); p.im.paste(g.im,(0,0))
    return framed(lambda:kitchen_range(0),paint)
ANIM={'fireplace':a_fireplace,'forge':a_forge,'bread oven':a_oven,'stove':a_stove,'cauldron':a_cauldron,'fish tank':a_tank,
      'candle':a_candle,'candelabra':a_candelabra,'wall sconce':a_sconce,'kitchen range':a_range}
for k,f in ANIM.items(): OBJ[k]=(OBJ[k][0] if k in OBJ else 'kitchen',f)
# ---- animated tabletop goods: name -> list of N images (bottom-aligned like G sprites) ----
def _stewpot(t):
    """cooking pot seen front-top: the stew surface shows as an ellipse inside the rim, iron lip lit, two ear handles;
    bubbles swell and pop (6-frame period), three steam wisps rise and fade (6-frame period) -> seamless in 12"""
    q=Pix(12,13); IR=M['iron']; ST=MT.ramp('#3a1a06','#c06a20','#ffd890')
    rows=['  11111111  ',' 1TTTTTTTT1 ',' 1STTTTTTS1 ','h1666666661h','h1444444441h',' 1444444431 ',' 1333333321 ','  11111111  ']
    for j,r in enumerate(rows):
        for i,ch in enumerate(r):
            if ch==' ': continue
            c={'1':IR[1],'6':IR[6],'4':IR[4],'3':IR[3],'2':IR[2],'h':IR[2],'S':ST[3],'T':ST[4]}[ch]
            q.set(i,5+j,c)
    for i,bx in enumerate((3,6,8)):
        ph=(t+i*2)%6
        if ph in (1,2,3): q.set(bx,6,ST[6] if ph==2 else ST[5])
        if ph==2: q.set(bx+1,6,ST[5]); q.set(bx,5,ST[5])
    for k in range(3):
        s=(t+k*2)%6
        if s<5:
            x=3+k*3+(1 if osc(t,1,k*2.1)>0.2 else 0); y=4-s
            if y>=0: q.set(x,y,(236,240,244,210-s*40)); q.set(x,y+1,(236,240,244,max(0,120-s*30)))
    return q.im
def _kettle(t):
    q=Pix(9,9); G['kettle'][0](q,1,3)
    s=t%6
    if s<4: q.set(7,2-min(2,s//2),(236,240,244,170-s*35)); q.set(8,1-min(1,s//3),(236,240,244,120-s*25))
    return q.im
GA={'stewpot':[_stewpot(t) for t in range(N)],'kettle_steam':[_kettle(t) for t in range(N)]}
def ga_seamless(name,fn):
    return fn(N).tobytes()==GA[name][0].tobytes()
GA_FN={'stewpot':_stewpot,'kettle_steam':_kettle}

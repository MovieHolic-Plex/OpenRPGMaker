# walkable ziggurat: each tier = a paved terrace you can walk on + a short front wall; summit = plaza with a shrine
import sys, math; sys.path.insert(0,__import__('os').path.dirname(__import__('os').path.abspath(__file__)))
import zig
from zig import T, O, tile, brick, M
from px2 import C, _hash, vnoise
from PIL import Image
def paving(c,y0=0,y1=16):
    for y in range(y0,y1):
        for x in range(16):
            k=y//8; xx=(x-(k%2)*6)%12
            if y%8==7 or xx==11: c.tone(x,y,M,3)
            else: c.setv(x,y,M,0.84+(0.05 if y%8==0 else 0)+(_hash((x-(k%2)*6)//12,k,5)-0.5)*0.1)
def floor(kind='M',seed=31):
    c=tile(seed); paving(c)
    if 'T' in kind:
        for x in range(16): c.tone(x,0,M,0); c.tone(x,1,M,6)
    if 'L' in kind:
        for y in range(16): c.tone(0,y,M,0)
        for y in range(1 if 'T' in kind else 0,16): c.tone(1,y,M,6)
    if 'R' in kind:
        for y in range(16): c.tone(15,y,M,0); c.darken(14,y,1)
    # cast shadows from a higher block: 's' = on top edge, 'w' = on left edge
    if 's' in kind:
        for x in range(16):
            for y in (0,1,2): c.darken(x,y,2 if y<2 else 1)
    if 'w' in kind:
        for y in range(16):
            for x in (0,1,2): c.darken(x,y,2 if x<2 else 1)
    return c.img(outline=False)
def ledgeP(kind='M',seed=32):
    # floor's front row: paving, lit lip, cornice shadow, top of the wall
    c=tile(seed); paving(c,0,11)
    for x in range(16): c.tone(x,11,M,6); c.tone(x,12,M,1)
    for y in range(13,16):
        for x in range(16): brick(c,x,y)
    if 'L' in kind:
        for y in range(16): c.tone(0,y,M,0)
        for y in range(0,12): c.tone(1,y,M,6)
    if 'R' in kind:
        for y in range(16): c.tone(15,y,M,0)
        for y in range(13,16): c.darken(14,y,2)
    if 'w' in kind:
        for y in range(11):
            for x in (0,1,2): c.darken(x,y,2 if x<2 else 1)
    return c.img(outline=False)
def rooftop(kind='M',seed=33):
    # flat roof slab of the summit shrine, seen from above
    c=tile(seed)
    for y in range(16):
        for x in range(16): c.setv(x,y,'stone',0.78 if y%4 else 0.5)
    for x in range(0,16,4):
        for y in range(16): c.darken(x,y,1) if y%4 else None
    if 'T' in kind:
        for x in range(16): c.tone(x,0,M,0); c.tone(x,1,M,6)
    if 'L' in kind:
        for y in range(16): c.tone(0,y,M,0); c.tone(1,y,M,6)
    if 'R' in kind:
        for y in range(16): c.tone(15,y,M,0); c.darken(14,y,2)
    return c.img(outline=False)
def altar_block(seed=34):
    c=C(32,16,seed=seed); c.shadow(16,14.5,15,1.6)
    c.group(1); c.box(2,3,28,5,6,M,bias=0.05)
    for x in range(2,30): c.tone(x,8,M,6)
    c.new()
    for (x,y,t) in ((14,5,5),(15,5,6),(16,5,6),(17,5,5),(15,4,4),(16,4,4)): c.tone(x,y,'red',t)   # offering
    for x in range(6,27,4):
        for y in range(10,13): c.tone(x,y,'teal',3 if y==11 else 2)
    return c.img()
for k in ('M','T','L','R','TL','TR','s','w','sw','Rs','Ls'):
    T['floor_'+k]=floor(k)
for k in ('M','L','R','w'):
    T['ledgeP_'+k]=ledgeP(k)
for k in ('TL','T','TR','L','M','R'):
    T['rooftop_'+k]=rooftop(k)
for k in ('L','M','R'):
    im=zig.roof(k).copy(); top=T['rooftop_'+k].crop((0,0,16,5)); im.paste(top,(0,0))
    for x in range(16):
        if k=='L' and x==0: continue
    T['roofF_'+k]=im
O['altar']=altar_block()
# reuse handmade objects as terrace decor
import pa
O['pillar']=pa.P['무너진 기둥 (선 것)']().img()
O['tablet']=pa.P['룬 석판']().img()
O['statue']=pa.P['뱀 석두상']().img()

def build(n=4,summit_w=9,summit_d=7,m=2,t=1,f=2,h=2,bottom_h=3,stair_w=3,seed=1):
    Wc=summit_w+2*m*(n-1); top_pad=2
    rects=[]   # k=0 summit ... n-1 bottom : (a,b,T,Fb,B)
    Tk=[top_pad+(n-1-k)*t for k in range(n)]
    B=None
    for k in range(n):
        a=(Wc-summit_w)//2-m*k; b=a+summit_w+2*m*k-1
        hh=bottom_h if k==n-1 else h
        if k==0: Fb=Tk[0]+summit_d-1
        else: Fb=B+f
        rects.append((a,b,Tk[k],Fb,Fb+hh)); B=Fb+hh
    H=B+2
    g=[[None]*Wc for _ in range(H)]; ov=[]
    for k in range(n-1,-1,-1):          # bottom tier first, upper tiers overwrite
        a,b,Tt,Fb,Bw=rects[k]
        for y in range(Tt,Bw+1):
            for x in range(a,b+1):
                L='L' if x==a else 'R' if x==b else ''
                if y<Fb: g[y][x]='floor_'+(('T'+L) if y==Tt else (L or 'M'))
                elif y==Fb: g[y][x]='ledgeP_'+(L or 'M')
                else:
                    wr=y-Fb-1; last=(y==Bw)
                    if last: g[y][x]='foot_'+(L or 'M')
                    elif wr==0: g[y][x]='frieze_'+(L or 'M')
                    else: g[y][x]=('face_'+L) if L else ('panel_glyph' if (x+y)%4==0 else 'panel')
        if k<n-1:
            # upper block casts shadow onto the lower terrace: right side and below
            for y in range(Tt,Bw+1):
                if b+1<=rects[k+1][1]-1 and g[y][b+1] and g[y][b+1].startswith('floor_'):
                    g[y][b+1]='floor_w' if g[y][b+1]=='floor_M' else g[y][b+1]
                if g[y][b+1]=='ledgeP_M': g[y][b+1]='ledgeP_w'
            for x in range(a,b+2):
                y=Bw+1
                if g[y][x]=='floor_M': g[y][x]='floor_sw' if x==b+1 else 'floor_s'
    # stairs through every front wall (and the ledge row), terraces stay floor
    ca=(Wc-stair_w)//2; cb=ca+stair_w-1
    for k in range(n):
        a,b,Tt,Fb,Bw=rects[k]
        for y in range(Fb,Bw+1):
            for x in range(ca,cb+1):
                p='stairfoot_' if (y==Bw and k==n-1) else 'stair_'
                g[y][x]=p+('L' if x==ca else 'R' if x==cb else 'M')
    for x in range(Wc): ov.append((x,H-1,'shadow',0))
    # summit shrine: flat roof (2 rows) + roof lip + columned front, set at the back of the plaza
    a,b,Tt,Fb,Bw=rects[0]; mid=Wc//2; sa,sb=mid-3,mid+3
    for x in range(sa,sb+1):
        L='L' if x==sa else 'R' if x==sb else 'M'
        g[Tt][x]='rooftop_'+('T'+L if L!='M' else 'T')
        g[Tt+1][x]='rooftop_'+L
        g[Tt+2][x]='roofF_'+L
        g[Tt+3][x]='face_L' if x==sa else 'face_R' if x==sb else ('door' if x==mid else 'column' if abs(x-mid) in (1,3) else 'face_M')
    for x in range(sa,sb+2):
        if g[Tt+4][x]=='floor_M': g[Tt+4][x]='floor_s' if x<=sb else 'floor_sw'
    for y in range(Tt+1,Tt+4):
        if g[y][sb+1]=='floor_M': g[y][sb+1]='floor_w'
    # roof comb standing on the back of the roof
    ov.append((mid-1,Tt,'jeweldais',0))
    # plaza furniture
    ov.append((mid-1,Tt+5,'altar',0))
    ov.append((a+1,Fb-1,'brazier',0)); ov.append((b-1,Fb-1,'brazier',0))
    # terraces: statues flanking the stair landing, pillars and tablets along the terrace
    for k in range(1,n):
        a,b,Tt,Fb,Bw=rects[k]; ua,ub=rects[k-1][0],rects[k-1][1]
        yl=Fb-1
        if k==n-1: ov.append((ca-2,yl-1,'statue_s',0)); ov.append((cb+1,yl-1,'statue_s',1))
        else: ov.append((ca-1,yl,'brazier',0)); ov.append((cb+1,yl,'brazier',0))
        for x in (a+1,b-1):
            ov.append((x,yl-1,'pillar' if (k+x)%2 else 'tablet',0))
        for x in range(a+1,b):
            if ua<=x<=ub or ca-2<=x<=cb+2: continue
            hsh=_hash(x,k,seed)
            if hsh>0.8: ov.append((x,Tt+1,'moss_patch',0))
    ov.append((ca-2,H-2,'bigserpent_L',0)); ov.append((cb+1,H-2,'bigserpent_R',0))
    return g,ov,Wc,H
def comb3():
    im=Image.new('RGBA',(48,32))
    for i,k in enumerate(('L','M','R')):
        im.alpha_composite(T['combtop_'+k],(i*16,0)); im.alpha_composite(T['comb_'+k],(i*16,16))
    return im
O['comb3']=comb3()
def finial():
    # stone horn-shaped finial on a roof corner, 16x32 (bottom half sits on the roof edge)
    c=C(16,32,seed=61); c.group(1)
    c.box(3,24,10,2,4,M,bias=0.05)
    c.new()
    pts=[(6,24),(5,19),(4,14),(5,10),(7,8)]
    for i,(x,y) in enumerate(pts):
        r=3.2-i*0.5
        for yy in range(int(y-2),int(y+3)):
            for xx in range(int(x-r),int(x+r)+1):
                if ((xx+0.5-x)/max(r,0.8))**2+((yy+0.5-y)/2.5)**2<=1:
                    c.setv(xx,yy,'stone',0.85 if xx<x else 0.5)
    c.tone(7,7,'stone',5); c.tone(8,8,'stone',3)
    for (x,y) in ((5,17),(5,21)): c.tone(x,y,'teal',5)
    return c.img()
def jeweldais():
    # low stepped dais in the roof centre holding the temple's glowing jewel, 48x32
    c=C(48,32,seed=62); c.shadow(24,27,18,2.5)
    c.group(1); c.box(8,18,32,4,5,'stone',bias=0.05)
    c.group(2); c.box(14,12,20,4,4,'stone',bias=0.1)
    c.group(3)
    gem=["....A....","...ABc...","..AABcc..",".AAABccc.","AAAABcccd",".aaaBbbd.","..aaBbd..","...aBd...","....d...."]
    c.lit(gem,20,2,{'A':('teal',5),'B':('teal',6),'c':('teal',4),'d':('teal',2),'a':('teal',3),'b':('teal',2)})
    c.spark=[(17,3),(31,5),(19,11),(30,11)]
    for (x,y) in ((12,20),(35,20),(24,21)): c.tone(x,y,'teal',4)
    return c.img()
O['finial']=finial(); O['jeweldais']=jeweldais()
O['statue_s']=O['statue'].crop((0,4,32,40))
def render(g,ov,W,H,bg,pad=1):
    im=Image.new('RGBA',((W+2*pad)*16,(H+2*pad)*16))
    for y in range(0,im.height,16):
        for x in range(0,im.width,16): im.paste(bg,(x,y))
    for y in range(H):
        for x in range(W):
            if g[y][x]: im.alpha_composite(T[g[y][x]],((x+pad)*16,(y+pad)*16))
    for (x,y,n,fl) in sorted(ov,key=lambda o:o[1]+O[o[2]].height/16):
        o=O[n].transpose(Image.FLIP_LEFT_RIGHT) if fl else O[n]
        im.alpha_composite(o,((x+pad)*16,(y+pad)*16))
    return im

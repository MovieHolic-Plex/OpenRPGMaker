# modular jungle ziggurat kit: 16px tiles that assemble into temples of any size
import sys, math; sys.path.insert(0,__import__('os').path.dirname(__import__('os').path.abspath(__file__)))
from px2 import C, vnoise, _hash
from PIL import Image
T={}   # name -> Image (16x16)
M='mstone'
def tile(seed): c=C(16,16,seed=seed); c.period=16; c.new(); return c
def brick(c,x,y,base=0.55,y0=0):
    k=(y-y0)//4; yy=(y-y0)%4
    if yy==3: return c.tone(x,y,M,1)
    if (x-(k%2)*4)%8==7: return c.tone(x,y,M,2)
    v=base+(0.14 if yy==0 else 0)+(0.08 if (x-(k%2)*4)%8==0 else 0)+(_hash((x-(k%2)*4)//8,k,77)-0.5)*0.12
    c.setv(x,y,M,v)
def face(kind='M',foot=False,seed=1):
    c=tile(seed)
    for y in range(16):
        for x in range(16): brick(c,x,y)
    if foot:
        for x in range(16): c.tone(x,13,M,4); c.tone(x,14,M,2); c.tone(x,15,M,0)
    if kind=='L':
        for y in range(16): c.tone(0,y,M,0); c.tone(1,y,M,5)
    if kind=='R':
        for y in range(16): c.tone(15,y,M,0); c.darken(14,y,2); c.darken(13,y,1)
    return c.img(outline=False)
def ledge(kind='M',seed=2):
    # rows 0-10 paving (top face), 11 lit lip, 12 cornice shadow, 13-15 wall
    c=tile(seed)
    for y in range(11):
        for x in range(16):
            k=y//6; xx=(x-(k%2)*5)%10
            if y%6==5 or xx==9: c.tone(x,y,M,3)
            else: c.setv(x,y,M,0.86+(0.06 if y%6==0 else 0)+(_hash((x-(k%2)*5)//10,k,5)-0.5)*0.1)
    for x in range(16): c.tone(x,11,M,6); c.tone(x,12,M,1)
    for y in range(13,16):
        for x in range(16): brick(c,x,y)
    if kind=='M':      # wall above casts a band of shadow on the paving
        for x in range(16):
            for y in (0,1,2): c.darken(x,y,2 if y<2 else 1)
    else:
        for x in range(16): c.tone(x,0,M,0); c.tone(x,1,M,6)
    if kind=='L':
        for y in range(16): c.tone(0,y,M,0)
        for y in range(1,12): c.tone(1,y,M,6)
    if kind=='R':
        for y in range(16): c.tone(15,y,M,0)
        for y in range(13,16): c.darken(14,y,2); c.darken(13,y,1)
    return c.img(outline=False)
def stair(kind='M',foot=False,seed=3):
    c=tile(seed)
    for y in range(16):
        for x in range(16):
            s=y%4
            v=(0.95,0.82,0.42,0.26)[s]
            c.setv(x,y,M,v)
    if kind in ('L','R'):     # balustrade cheek wall
        xs=(0,1,2,3) if kind=='L' else (15,14,13,12)
        for y in range(16):
            c.tone(xs[0],y,M,0); c.setv(xs[1],y,M,0.95); c.setv(xs[2],y,M,0.7 if kind=='L' else 0.45); c.tone(xs[3],y,M,1)
            if y%8==0: c.tone(xs[1],y,M,3); c.tone(xs[2],y,M,2)
    if foot:
        for x in range(16): c.tone(x,15,M,0); c.tone(x,14,M,2)
    return c.img(outline=False)
def door(seed=4):
    c=tile(seed)
    for y in range(16):
        for x in range(16): brick(c,x,y,base=0.6)
    for y in range(2,16):
        for x in range(2,14):
            dx=(x+0.5-8)/5.5; dy=(y+0.5-7)/5
            if y>=7 or dx*dx+dy*dy<=1:
                edge=abs(x+0.5-8)>4.6 or (y<7 and dx*dx+dy*dy>0.62)
                c.tone(x,y,M,5 if (edge and x<8) else 2 if edge else 0) if edge else c.tone(x,y,'dark',1)
    for (x,y,t) in ((7,9,5),(8,9,6),(7,10,6),(8,10,6),(7,11,5),(8,11,5),(6,10,4),(9,10,4),(7,8,4),(8,8,4)): c.tone(x,y,'teal',t)
    for x in range(4,12): c.tone(x,15,'teal',2)
    return c.img(outline=False)
def roof(kind='M',crest=False,seed=5):
    c=tile(seed); c.new()
    for y in range(4,16):
        for x in range(16):
            if y==4: c.tone(x,y,M,0)
            elif y<10: c.setv(x,y,M,0.9+(0.06 if y==5 else 0))
            elif y==10: c.tone(x,y,M,6)
            elif y<14: c.setv(x,y,M,0.55-0.05*(y-11))
            elif y==14: c.tone(x,y,M,1)
            else: c.tone(x,y,M,0)
    for x in range(0,16,4):
        for y in range(11,14): c.darken(x,y,1)
    if kind=='L':
        for y in range(4,16): c.tone(0,y,M,0)
        for y in range(5,10): c.tone(1,y,M,6)
    if kind=='R':
        for y in range(4,16): c.tone(15,y,M,0)
        for y in range(11,14): c.darken(14,y,2)
    if crest:
        for (x,y,t) in ((7,1,6),(8,1,5),(6,2,5),(7,2,6),(8,2,5),(9,2,4),(7,3,4),(8,3,3)): c.tone(x,y,'teal',t)
        for (x,y) in ((5,3),(10,3),(4,2),(11,2)): c.tone(x,y,M,3)
        c.tone(3,1,M,0); c.tone(12,1,M,0)
    return c.img(outline=False)
# overlays (transparent)
def moss_drape(seed=6):
    # organic clump on the ledge lip (row 11) spilling down the wall, with a few trailing strands
    c=C(16,16,seed=seed); c.new()
    for y in range(7,16):
        for x in range(16):
            core=1-abs(y-10.5)/4.5
            side=1-abs(x-7.5)/8.5
            v=vnoise(x,y,2.0,seed)*0.9+core*0.55+side*0.5
            if v>1.05: c.setv(x,y,'moss',0.95-0.1*(y-7))
    for x in range(1,15):
        if _hash(x,seed,3)>0.7:
            ys=[y for y in range(16) if c.m[y][x]]
            if ys:
                for y in range(max(ys)+1,min(16,max(ys)+2+int(_hash(x,seed,5)*3))): c.tone(x,y,'moss',2)
    return c.img()
def moss_patch(seed=7):
    c=C(16,16,seed=seed)
    for y in range(16):
        for x in range(16):
            d=((x-8)/7)**2+((y-9)/5)**2
            if d+ (vnoise(x,y,2.5,seed)-0.5)*0.9<0.8: c.setv(x,y,'moss',0.7-0.3*(y-4)/12)
    return c.img()
def vine(seed=8):
    c=C(16,16,seed=seed); c.new()
    xs=[6,7,7,6,6,7,8,8,7,7,6,6]
    for y,x in enumerate(xs): c.tone(x,y,'leaf',2)
    for y in range(1,12,2):
        sgn=1 if (y//2)%2 else -1; x=xs[y]+sgn
        c.tone(x,y,'leaf',5); c.tone(x+sgn,y,'leaf',4); c.tone(x,y+1,'leaf',3)
    xs2=[11,11,12,12,11]
    for y,x in enumerate(xs2): c.tone(x,y,'leaf',2)
    c.tone(12,2,'leaf',5); c.tone(10,4,'leaf',4)
    return c.img()
def brazier(seed=9):
    c=C(16,16,seed=seed); c.shadow(8,14.2,5,1.4)
    c.group(1); c.cylinder(8,10,13,1.6,'iron',cap=False)
    c.group(2); c.ellipsoid(8,8.5,5,2.4,'iron',amb=0.3)
    c.new()
    for (x,y) in ((5,8),(6,8),(7,8),(8,8),(9,8),(10,8),(6,7),(7,7),(8,7),(9,7)): c.tone(x,y,'fire',2)
    c.group(3)
    c.lit(["...x....","..xo..x.","..oxo.o.",".ooxxoo.",".foxxof.","ffoooff."],4,1,{'x':('fire',6),'o':('fire',4),'f':('fire',3)})
    return c.img()
def serpent_head(flip=False,seed=10):
    c=C(16,16,seed=seed); c.shadow(8,15,7.5,1.3)
    c.group(1); c.box(1,12,14,1,2,M)
    c.new()
    head=["................",
          "....OOOOOOOO....",
          "..OOhhllllmmOO..",
          ".OhllemllmelmmO.",
          ".Olllddlldmmmd O",
          "Ohlmmmmmmmmmmmd.",
          "OlmmOmmmmmmOmmdO",
          ".OOkRRRRRRRRkOO.",
          "..OkRrrrrrrRkO..",
          "..ORRRRRRRRRRO..",
          "...OmmmmmmmmdO..",
          "....OOOOOOOOO...",]
    c.lit(head,0,1,{'O':('stone',0),'d':('stone',1),'m':('stone',2),'l':('stone',3),'h':('stone',5),'e':('teal',6),'R':('dark',1),'r':('red',3),'k':('bone',6)})
    c.tone(15,5,'stone',0)
    im=c.img(outline=False)
    return im.transpose(Image.FLIP_LEFT_RIGHT) if flip else im
def ground_shadow():
    im=Image.new('RGBA',(16,16))
    for y in range(4):
        for x in range(16): im.putpixel((x,y),(14,30,8,(110,80,50,24)[y]))
    return im

# ---- grandeur pieces ----
FRET=["lllllllD",
      "DDDDDDlD",
      "lllllDlD",
      "lDDDlDlD",
      "lDlllDlD",
      "lDDDDDlD",
      "llllllld",
      "DDDDDDDD"]
def frieze(kind='M',seed=11):
    # carved step-fret band under a cornice: runs along the top of a tier face
    c=tile(seed)
    for x in range(16): c.tone(x,0,M,6); c.tone(x,1,M,4); c.tone(x,2,M,1)
    for y in range(3,11):
        for x in range(16):
            ch=FRET[(y-3)%8][x%8]; c.setv(x,y,M,{'l':0.8,'D':0.25,'d':0.45}[ch])
    for x in range(16): c.tone(x,11,M,1); c.tone(x,12,M,5)
    for y in range(13,16):
        for x in range(16): brick(c,x,y)
    if kind=='L':
        for y in range(16): c.tone(0,y,M,0); c.tone(1,y,M,5)
    if kind=='R':
        for y in range(16): c.tone(15,y,M,0); c.darken(14,y,2); c.darken(13,y,1)
    return c.img(outline=False)
def panel(glyph=False,seed=12):
    # talud-tablero recessed panel: raised frame, sunken field
    c=tile(seed)
    for y in range(16):
        for x in range(16):
            frame = x<2 or x>13 or y<2 or y>13
            if frame: c.setv(x,y,M,0.72 if (x<2 or y<2) else 0.5)
            else: c.setv(x,y,M,0.42)
    for x in range(2,14): c.tone(x,2,M,1); c.tone(x,13,M,5)
    for y in range(2,14): c.tone(2,y,M,1); c.tone(13,y,M,4)
    if glyph:
        g=[".tt.","t..t","t.tt",".tt."]
        for j,r in enumerate(g):
            for i,ch in enumerate(r):
                if ch=='t': c.tone(6+i,6+j,'teal',4)
    return c.img(outline=False)
def column(seed=13):
    # portico column on a dark recess
    c=tile(seed)
    for y in range(16):
        for x in range(16): c.tone(x,y,'dark',2)
    c.group(1); c.cylinder(8,3,13,3.6,'stone',cap=False,amb=0.3,bias=0.1)
    c.box(3,1,10,1,2,M,bias=0.1); c.box(3,13,10,1,2,M)
    for y in range(4,13): c.darken(7,y,1)
    return c.img(outline=False)
def roof_under_comb(kind='M',seed=18):
    # roof slab whose upper strip continues the comb wall down onto the roof
    im=roof('M',seed=seed).copy(); c=tile(seed)
    for y in range(0,5):
        for x in range(16): c.setv(x,y,M,0.6 if x%8<4 else 0.52)
    for x in range(16): c.tone(x,4,M,1)
    if kind=='L':
        for y in range(5): c.tone(0,y,M,0); c.tone(1,y,M,5)
    if kind=='R':
        for y in range(5): c.tone(15,y,M,0); c.tone(14,y,M,2)
    top=c.img(outline=False).crop((0,0,16,5)); im.paste(top,(0,0)); return im
def comb(kind='M',seed=14):
    # pierced roof-comb wall: stone lattice with two tall slits per cell
    c=tile(seed)
    for y in range(16):
        for x in range(16): c.setv(x,y,M,0.62 if x%8<4 else 0.55)
    for x0 in (2,10):
        for y in range(3,14):
            for x in (x0,x0+1,x0+2,x0+3):
                if x<16: c.m[y][x]=None
        for y in range(3,14): c.tone(x0-1,y,M,1) if x0>0 else None
        for x in range(x0,x0+4): c.tone(x,14,M,5)
    for x in range(16): c.tone(x,15,M,1); c.tone(x,0,M,4)
    if kind=='L':
        for y in range(16): c.tone(0,y,M,0); c.tone(1,y,M,5)
    if kind=='R':
        for y in range(16): c.tone(15,y,M,0); c.tone(14,y,M,2)
    return c.img(outline=False)
def comb_top(kind='M',seed=17):
    # stepped crest over the comb; the middle carries the temple's jewel
    c=C(16,16,seed=seed); c.new()
    steps={'L':[12,12,12,10,10,10,10,8,8,8,8,8,8,8,8,8],'M':[6]*16,'R':[8,8,8,8,8,8,8,8,8,10,10,10,10,12,12,12]}[kind]
    for x in range(16):
        for y in range(steps[x],16): c.setv(x,y,M,0.86 if y==steps[x] else 0.6 - (0.15 if kind=='R' else 0))
    if kind=='M':
        for y in range(1,6):                        # horns
            c.tone(2+ (5-y)//2,y,M,4); c.tone(13-(5-y)//2,y,M,2)
        gem=["..e..",".eQe.","eQQQe",".eQe.","..e.."]
        for j,r in enumerate(gem):
            for i,ch in enumerate(r):
                if ch!='.': c.tone(6+i,8+j,'teal',6 if ch=='Q' else 4)
        for (x,y) in ((5,7),(11,7),(5,13),(11,13)): c.tone(x,y,M,1)
    return c.img()
def banner(seed=15):
    # hanging red cloth banner with a gold sun, 16x32 overlay (spans two face rows)
    c=C(16,32,seed=seed)
    c.group(1)
    for x in range(1,15): c.tone(x,1,'bark',4); c.tone(x,2,'bark',2)
    c.new()
    for y in range(3,29):
        for x in range(3,13):
            if y>=26 and abs(x+0.5-8)>(29-y)*1.7: continue
            c.setv(x,y,'red',0.78 if x<6 else 0.6 if x<10 else 0.42)
    for y in range(3,27): c.tone(3,y,'gold',4); c.tone(12,y,'gold',3)
    sun=["..z..","z.Z.z",".ZZZ.","zZZZz",".ZZZ.","z.Z.z","..z.."]
    for j,r in enumerate(sun):
        for i,ch in enumerate(r):
            if ch=='z': c.tone(6+i,10+j,'gold',4)
            if ch=='Z': c.tone(6+i,10+j,'gold',6)
    return c.img()
def big_serpent(flip=False,seed=16):
    # 32x32 stone serpent head at the foot of the balustrade: wide flat skull, heavy angry brows,
    # jaws gaping toward the viewer, a fan of quetzal feathers behind
    c=C(32,32,seed=seed); c.shadow(16,30.5,15,2)
    c.group(1)                                          # feather fan
    for k in range(7):
        a=math.radians(200+k*23.3); col='moss' if k%2 else 'teal'
        for j in range(3,13):
            x=16+math.cos(a)*j; y=13+math.sin(a)*j*0.9
            c.tone(int(x),int(y),col,5 if j<10 else 3); c.tone(int(x+0.6),int(y),col,4 if j<10 else 2)
    c.group(2); c.box(2,25,28,2,4,M)
    c.group(3)
    c.ellipsoid(16,15,13,8.5,'stone',amb=0.25,bias=-0.08,bump=0.3)
    c.new()
    for x in range(4,29):                               # brow ridge, V-shaped (angry)
        y=9+abs(x+0.5-16)//4
        c.tone(x,int(y),'stone',5); c.tone(x,int(y)+1,'stone',1)
    for (x,y,t) in ((8,12,6),(9,12,5),(10,13,3),(23,12,6),(22,12,5),(21,13,3)): c.tone(x,y,'teal',t)
    for x in (8,9,22,23): c.tone(x,11,'stone',1)
    for (x,y) in ((13,15),(19,15),(13,14),(19,14)): c.tone(x,y,'stone',1)   # nostrils
    for x in range(5,28): c.tone(x,17,'stone',4); c.tone(x,18,'stone',1)     # upper lip
    for y in range(19,25):
        for x in range(5,28):
            if abs(x+0.5-16.5)<=11-(y-19)*1.1: c.tone(x,y,'dark',1)
    for (x,y) in ((6,19),(7,20),(26,19),(25,20),(6,20),(26,20)): c.tone(x,y,'bone',6)   # fangs
    for x in range(9,25,3): c.tone(x,19,'bone',5)
    for (x,y,t) in ((16,21,4),(17,21,4),(16,22,3),(17,22,3),(15,23,4),(18,23,4)): c.tone(x,y,'red',t)
    for x in range(8,26): c.tone(x,25,'stone',3)
    im=c.img()
    return im.transpose(Image.FLIP_LEFT_RIGHT) if flip else im

T.update({'face_L':face('L'),'face_M':face('M'),'face_R':face('R'),'foot_L':face('L',True),'foot_M':face('M',True),'foot_R':face('R',True),
 'ledge_L':ledge('L'),'ledge_M':ledge('M'),'ledge_open':ledge('open'),'ledge_R':ledge('R'),
 'stair_L':stair('L'),'stair_M':stair('M'),'stair_R':stair('R'),'stairfoot_L':stair('L',True),'stairfoot_M':stair('M',True),'stairfoot_R':stair('R',True),
 'door':door(),'roof_L':roof('L'),'roof_M':roof('M'),'roof_crest':roof('M',True),'roof_R':roof('R'),'frieze_L':frieze('L'),'frieze_M':frieze('M'),'frieze_R':frieze('R'),'panel':panel(),'panel_glyph':panel(True),'column':column(),'comb_L':comb('L'),'comb_M':comb('M'),'comb_R':comb('R'),'combtop_L':comb_top('L'),'roofc_L':roof_under_comb('L'),'roofc_M':roof_under_comb('M'),'roofc_R':roof_under_comb('R'),'combtop_M':comb_top('M'),'combtop_R':comb_top('R')})
O={'moss_drape':moss_drape(),'moss_drape2':moss_drape(21),'moss_drape3':moss_drape(33),'moss_patch2':moss_patch(19),'vine2':vine(27),'moss_patch':moss_patch(),'vine':vine(),'brazier':brazier(),'serpent_L':serpent_head(),'serpent_R':serpent_head(True),'shadow':ground_shadow(),'banner':banner(),'bigserpent_L':big_serpent(),'bigserpent_R':big_serpent(True)}

def build(tiers,stair_w=3,shrine_w=3,decor_seed=1):
    """tiers: bottom-first list of (width_cells, face_rows). returns (grid, overlays, W, H)"""
    W=tiers[0][0]; H=2+sum(1+f for _,f in tiers)+1   # +1 ground row
    g=[[None]*W for _ in range(H)]; ov=[]
    def span(w): a=(W-w)//2; return a,a+w-1
    # shrine
    sa,sb=span(shrine_w); r=0
    for x in range(sa,sb+1): g[r][x]='roof_L' if x==sa else 'roof_R' if x==sb else ('roof_crest' if x==(sa+sb)//2 else 'roof_M')
    r=1
    for x in range(sa,sb+1): g[r][x]='face_L' if x==sa else 'face_R' if x==sb else ('door' if x==(sa+sb)//2 else 'face_M')
    above=(sa,sb); r=2
    rows_of_tier=[]
    for ti in range(len(tiers)-1,-1,-1):
        w,f=tiers[ti]; a,b=span(w)
        for x in range(a,b+1):
            g[r][x]='ledge_L' if x==a else 'ledge_R' if x==b else ('ledge_M' if above[0]<=x<=above[1] else 'ledge_open')
        rows_of_tier.append((r,a,b,'ledge'))
        for k in range(f):
            rr=r+1+k; last=(ti==0 and k==f-1)
            for x in range(a,b+1):
                p='foot_' if last else 'face_'
                g[rr][x]=p+('L' if x==a else 'R' if x==b else 'M')
            rows_of_tier.append((rr,a,b,'face'))
        above=(a,b); r+=1+f
    ground=r
    ca,cb=span(stair_w)
    for rr in range(2,ground):
        for x in range(ca,cb+1):
            p='stairfoot_' if rr==ground-1 else 'stair_'
            g[rr][x]=p+('L' if x==ca else 'R' if x==cb else 'M')
    for x in range(W): ov.append((x,ground,'shadow'))
    # decor
    for (rr,a,b,kind) in rows_of_tier:
        for x in range(a,b+1):
            if ca-1<=x<=cb+1: continue
            h=_hash(x,rr,decor_seed)
            v=int(_hash(x,rr,decor_seed+9)*3)
            if kind=='ledge' and h>0.72: ov.append((x,rr,('moss_drape','moss_drape2','moss_drape3')[v]))
            if kind=='face' and h>0.86: ov.append((x,rr,('vine','vine2','vine')[v]))
            elif kind=='face' and h<0.08: ov.append((x,rr,('moss_patch','moss_patch2','moss_patch')[v]))
    # braziers on the top ledge beside the shrine, serpent heads at the stair foot
    top=2
    ov.append((sa-1,top,'brazier')); ov.append((sb+1,top,'brazier'))
    ov.append((ca-1,ground,'serpent_L')); ov.append((cb+1,ground,'serpent_R'))
    return g,ov,W,H
def render(g,ov,W,H,bg,pad=1):
    im=Image.new('RGBA',((W+2*pad)*16,(H+2*pad)*16))
    for y in range(0,im.height,16):
        for x in range(0,im.width,16): im.paste(bg,(x,y))
    for y in range(H):
        for x in range(W):
            if g[y][x]: im.alpha_composite(T[g[y][x]],((x+pad)*16,(y+pad)*16))
    for (x,y,n) in sorted(ov,key=lambda o:o[1]):
        im.alpha_composite(O[n],((x+pad)*16,(y+pad)*16))
    return im

def build_grand(tiers,stair_w=3,shrine_w=5,decor_seed=1):
    """tiers bottom-first: (width, face_rows). first face row of each tier is a carved frieze;
    middle rows are recessed panels; shrine has a pierced roof comb and a columned portico."""
    W=tiers[0][0]; H=4+sum(1+f for _,f in tiers)+1
    g=[[None]*W for _ in range(H)]; ov=[]
    def span(w): a=(W-w)//2; return a,a+w-1
    sa,sb=span(shrine_w); mid=(sa+sb)//2
    for x in range(mid-1,mid+2): g[0][x]='combtop_L' if x==mid-1 else 'combtop_R' if x==mid+1 else 'combtop_M'
    for x in range(mid-1,mid+2): g[1][x]='comb_L' if x==mid-1 else 'comb_R' if x==mid+1 else 'comb_M'
    for x in range(sa,sb+1): g[2][x]='roof_L' if x==sa else 'roof_R' if x==sb else ('roofc_L' if x==mid-1 else 'roofc_R' if x==mid+1 else 'roofc_M' if x==mid else 'roof_M')
    for x in range(sa,sb+1):
        g[3][x]='face_L' if x==sa else 'face_R' if x==sb else ('door' if x==mid else 'column')
    above=(sa,sb); r=4; ledges=[]
    for ti in range(len(tiers)-1,-1,-1):
        w,f=tiers[ti]; a,b=span(w)
        for x in range(a,b+1):
            g[r][x]='ledge_L' if x==a else 'ledge_R' if x==b else ('ledge_M' if above[0]<=x<=above[1] else 'ledge_open')
        ledges.append((r,a,b))
        for k in range(f):
            rr=r+1+k; last=(ti==0 and k==f-1)
            for x in range(a,b+1):
                end='L' if x==a else 'R' if x==b else 'M'
                if last: g[rr][x]='foot_'+end
                elif k==0: g[rr][x]='frieze_'+end
                elif end!='M': g[rr][x]='face_'+end
                else: g[rr][x]='panel_glyph' if (x+rr)%4==0 else 'panel'
        above=(a,b); r+=1+f
    ground=r; ca,cb=span(stair_w)
    for rr in range(4,ground):
        for x in range(ca,cb+1):
            p='stairfoot_' if rr==ground-1 else 'stair_'
            g[rr][x]=p+('L' if x==ca else 'R' if x==cb else 'M')
    for x in range(W): ov.append((x,ground,'shadow'))
    for (rr,a,b) in ledges:
        for x in range(a,b+1):
            if ca-1<=x<=cb+1: continue
            h=_hash(x,rr,decor_seed)
            if h>0.8: ov.append((x,rr,('moss_drape','moss_drape2','moss_drape3')[int(_hash(x,rr,9)*3)]))
    ov.append((sa-1,4,'brazier')); ov.append((sb+1,4,'brazier'))
    # banners on the bottom tier, flanking the stair
    bt=ledges[-1][0]+1
    ov.append((ca-2,bt,'banner')); ov.append((cb+2,bt,'banner'))
    # braziers on each ledge beside the stair
    for (rr,a,b) in ledges[1:]:
        ov.append((ca-1,rr,'brazier')); ov.append((cb+1,rr,'brazier'))
    # great serpent heads at the stair foot
    ov.append((ca-2,ground-1,'bigserpent_L')); ov.append((cb+1,ground-1,'bigserpent_R'))
    return g,ov,W,H

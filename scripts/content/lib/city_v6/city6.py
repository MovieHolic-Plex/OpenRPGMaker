# 버들항 v6 (로마풍) — 100x100 river town on three levels. Terrain from city_layout.py; houses from the form study (pv, shapes,
# addons2, town3-style ranges); props from pl/pf/pi/pe/ph/pv2; townsfolk from RM2000 charsets.
import sys, os, random, math, shutil, glob
SRC=os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0,SRC)
OUT=os.environ.get('CITY6_OUT','/tmp/j8city6'); os.makedirs(OUT+'/anim',exist_ok=True)
for _f in glob.glob(SRC+'/anim/boat_*.png'): shutil.copy(_f,OUT+'/anim/')
from PIL import Image, ImageDraw
import palette; palette.apply()
exec(open(SRC+'/city_layout.py').read())
STAIRS[STAIRS.index((11,14,2))]=(14,12,5); STAIRS.append((15,30,3))   # v6: grand stair on the palace axis + causeway stair
import terrain, pk, pn, pj, pv, shapes, addons2, pf, pl, pi, pe, ph, pv2, pz, ground, roman, water6, smoke5
from pj_demo import roofrows as RR, storeyrows as SR
from sheet2 import lawn
L=pj.library()
F=terrain.faces(E)
MAS=[[bool(F[y][x]) and masonry_at(x,y-F[y][x]+1) for x in range(W)] for y in range(H)]
CHIP=terrain.CH
TREES={'oakA':(224,512,4,5),'oakB':(288,512,3,4),'bushC':(336,512,2,2),'bushD':(368,512,3,3),'bushE':(368,560,2,2)}
def tree(k):
    x,y,w,h=TREES[k]; im=CHIP.crop((x,y,x+w*16,y+h*16)); im._tree=True; return im
I=lambda o: (pz.fin(o) if hasattr(o,'img') else o)
rng=random.Random(11)

# ---------------- masks ----------------
road=grid(False); plaza=grid(False); wall=grid(False)
moat=grid(False); fill(moat,1,32,23,25)
water=[[river[y][x] or lake[y][x] or pond[y][x] or moat[y][x] for x in range(W)] for y in range(H)]
def R(g,x0,x1,y0,y1): fill(g,x0,x1,y0,y1,True)
jr=random.Random(5)
def street(y,xs,rows=1,jit=1):
    # an east-west street broken at the cross streets xs=[(x0,x1),...]: each piece is nudged up or down a row so the
    # blocks do not line up like a grid; the cross streets absorb the jogs
    for x0,x1 in xs:
        dy=jr.randint(-jit,jit); R(road,x0,x1,y+dy,y+dy+rows-1)
# castle rock (level 3) + hill (level 2)
# v5: the castle (NW) and the estate (north hill) are kits placed in city6_kits.py; outside them one road each
R(road,15,24,26,26); R(road,44,45,23,27)
# middle town (level 1)
R(road,23,24,29,32); R(road,44,45,30,32)
R(road,1,98,33,34)
V1=[(12,13),(56,58),(70,71),(88,89)]
R(road,12,13,35,57); R(road,56,58,47,61); R(road,70,71,47,60); R(road,88,89,27,53); R(road,30,31,45,53)
street(44,[(1,11),(14,29),(32,38),(51,55),(72,87),(90,98)],1,1)
street(54,[(1,11),(14,29),(32,46),(51,55),(59,69),(72,87),(90,98)],2,1)
R(road,62,63,4,32); R(road,77,78,10,32); street(8,[(59,61),(64,76)],2,1); street(20,[(59,61),(64,76),(79,79)],2,1)
R(plaza,55,74,35,46)                                # v5 forum (was a 11x9 market square)
# temple mount
R(plaza,82,95,17,22); R(road,88,89,23,24)
# harbour town (level 0)
R(road,56,58,64,85); R(road,12,13,60,90); R(road,70,71,63,85); R(road,84,85,60,89); R(road,30,31,67,74)
street(66,[(1,11),(14,29),(32,44),(53,55),(72,83),(86,98)],1,1)
street(75,[(1,11),(14,29),(32,44),(53,55),(59,69),(72,83),(86,98)],2,1)
R(road,45,46,64,86); R(road,51,52,64,86); R(plaza,60,69,67,73)
for x in range(W):                                  # harbour promenade along the shore
    if shore[x] and 8<=x<=90:
        for y in (shore[x]-2,shore[x]-1): road[y][x]=True
for x0,y0,w in STAIRS:
    for i in range(w):
        for j in (0,1,2): road[y0+j][x0+i]=False
for y in range(H):
    for x in range(W):
        if water[y][x]: road[y][x]=False; plaza[y][x]=False
# town wall: north row and both sides (not over cliffs or water)
R(wall,0,99,0,0); R(wall,0,0,0,86); R(wall,99,99,0,90)
for y in range(H):
    for x in range(W):
        if wall[y][x] and (F[y][x] or water[y][x]): wall[y][x]=False
GATES=[(62,0),(63,0)]
for gx,gy in GATES:
    for k in (1,2): road[gy+k][gx]=True

# ---------------- occupancy ----------------
occ=[[None]*W for _ in range(H)]
for y in range(H):
    for x in range(W):
        if water[y][x]: occ[y][x]='water'
        elif F[y][x]: occ[y][x]='cliff'
        elif road[y][x]: occ[y][x]='road'
        elif plaza[y][x]: occ[y][x]='plaza'
        if wall[y][x] or (y>=1 and wall[y-1][x] and not wall[y][x] and x not in (0,99)) or (y>=2 and wall[y-2][x] and x not in (0,99)): occ[y][x]='wall'
        if E[y][x]!=E[max(0,y-1)][x] and not F[y][x] and occ[y][x] is None: occ[y][x]='rim'     # north rims stay clear
for x0,y0,w in STAIRS:
    for i in range(w):
        for j in (0,1,2): occ[y0+j][x0+i]='stair'
for gx,gy in GATES:
    for k in (1,2): occ[gy+k][gx]='road'
def P_(name,f,x,y,allow=('plaza',)):
    im=I(f() if callable(f) else f); fw,fh=-(-im.width//16),-(-im.height//16)
    if free(x,y,fw,fh,allow): mark(name,x,y,fw,fh); objs.append((im,x*16,y*16,True)); return True
    return False
def V2(n): return pv2.P[n][0]
# ---- bridges: where a street meets the river, a 4-wide deck carries it across (walkable) ----
BRIDGES=[]
for bx in (33,47):
    for y in range(1,H-2):
        # a street row on both banks at y and y+1 -> bridge
        if all(road[y+j][bx+i] for j in (0,1) for i in (-3,-2,-1,4,5,6)) and water[y][bx] and water[y+1][bx] and not any(fx==bx and 0<=y-(fy+3)<3 for fx,fy,fw in FALLS):
            if not any(abs(y-b)<2 and bx==a for a,b in BRIDGES): BRIDGES.append((bx,y))
for bx,by in BRIDGES:
    for i in range(4):
        for j in range(2): occ[by+j][bx+i]='bridge'
# ---- reserve the ground at cliff lips and cliff feet (no building may sit on an edge or against a face) ----
for y in range(H-1):
    for x in range(W):
        if occ[y][x] is None and F[y+1][x]==1: occ[y][x]='rim'           # the lip row on the plateau
        if occ[y+1][x] is None and F[y][x]==3: occ[y+1][x]='rim'         # the foot row under a face
def soft_outline(im,k=0.62):
    # an INSET outline: the silhouette's own edge pixels darkened; nothing grows outward (no black ring)
    im=im.copy(); p=im.load(); W_,H_=im.size; edge=[]
    for y in range(H_):
        for x in range(W_):
            if p[x,y][3]<128: continue
            for dx,dy in ((0,1),(1,0),(-1,0),(0,-1)):
                xx,yy=x+dx,y+dy
                if not (0<=xx<W_ and 0<=yy<H_) or p[xx,yy][3]<128: edge.append((x,y)); break
    for x,y in edge:
        r,g,b,a=p[x,y]; p[x,y]=(int(r*k),int(g*k),int(b*k*1.1),a)
    return im
objs=[]; HOUSES=[]; SMOKE=[]; SHOPS=[]; OBJOF={}
TRADES={0:['fish','grocer','butcher','inn','tailor','fish','bakery'],1:['bakery','pharm','tailor','jewel','books','grocer','butcher','inn'],2:['smith','jewel','books','pharm','tailor'],3:['smith']}
_tc={}
def trade_at(x,y):
    L_=TRADES[E[y][x]]; k=_tc.get(E[y][x],0); _tc[E[y][x]]=k+1; return L_[k%len(L_)]
def signed(im,door,below,trade):
    im=im.copy(); s=pz.fin(pz.bracket_sign(trade)); x=(door+1)*16+1; y=im.height-below-44
    if x+20>im.width: x=door*16-21
    im.alpha_composite(s,(max(0,x),max(0,y))); return im
PROPBAN=set()      # v6: cells under a tall kit piece's overhang (tower cones): walkable, but no prop may stand there
def free(x,y,w,h,allow=()):
    if any((xx,yy) in PROPBAN for yy in range(y,y+h) for xx in range(x,x+w)): return False
    lv={E[yy][xx] for yy in range(y,y+h) for xx in range(x,x+w) if 0<=yy<H and 0<=xx<W}
    return len(lv)==1 and all(0<=xx<W and 0<=yy<H and (occ[yy][xx] is None or occ[yy][xx] in allow) for yy in range(y,y+h) for xx in range(x,x+w))
def mark(name,x,y,w,h):
    for yy in range(y,y+h):
        for xx in range(x,x+w):
            if 0<=xx<W and 0<=yy<H: occ[yy][xx]=name
def place(name,im,x,bottom,allow=(),outline=False,below=0,cast=True,door=None,chim=(),above=0):
    # above: px at the top that may overhang the row above (a chimney) without claiming it
    im=I(im); hb=im.height-below; fw=-(-(im.width-1)//16); fh=-(-(hb-above-1)//16); y=bottom-fh+1
    if not free(x,y,fw,fh,allow): return False
    if outline: im=soft_outline(im)
    mark(name,x,y,fw,fh); px0=x*16; py0=(bottom+1)*16-hb
    objs.append((im,px0,py0,cast)); OBJOF[name]=(objs[-1],len(SMOKE),len(chim))
    if door is not None: HOUSES.append((name,x+door,bottom))
    for cx,cy in chim: SMOKE.append((px0+cx,py0+cy,name))
    return y

# ---------------- building forms (v2: steep roofs with volume) ----------------
import ph2
def with_porch(h,st):
    im=h['im']; base=im.height-1; p=pv.porch(st,3); x=max(0,(h['door']-1)*16)
    o=Image.new('RGBA',(im.width,im.height+12)); o.alpha_composite(im); o.alpha_composite(p,(x,base-30))
    h=dict(h); h['im']=o; h['below']=12; return h
def with_lean(h,st):
    im=h['im']; l=pv.leanto_side(st,2); o=Image.new('RGBA',(im.width+32,im.height)); o.alpha_composite(im); o.alpha_composite(l,(im.width,im.height-l.height))
    h=dict(h); h['im']=o; return h
def with_sign(h,kind):
    im=h['im'].copy(); s=I(pf.shop_sign(kind)); x=max(0,h['door']*16+14)
    if x+16<=im.width: im.alpha_composite(s,(x,im.height-44))
    h=dict(h); h['im']=im; return h
RICH={'U','cross','hip2','T'}
def form(kind,style,r):
    st='sto' if style=='sto' else 'tim'; gs='sto' if style in ('sto','mix') else st
    s2=r.random()<0.55; sd=r.randint(0,99999)
    if kind=='hip': return ph2.house(st,r.randint(5,7),2 if s2 else 1,gs=gs,seed=sd)
    if kind=='hip2': return ph2.house(st,r.randint(7,8),2,gs=gs,seed=sd)
    if kind=='gable': return ph2.house(st,r.randint(5,7),2 if s2 else 1,gs=gs,seed=sd,hipped=False)
    if kind=='shop': return ph2.house(st,r.randint(6,7),2 if s2 else 1,gs=gs,shop=True,seed=sd)
    if kind=='gfront': wc=r.choice((3,4,5)); return ph2.gfront(st,wc,2 if (s2 and wc>3) else 1,gs=gs)
    if kind=='cross': w=r.choice((9,10)); return ph2.cross(st,w,2 if s2 else 1,(1,5) if w==9 else (0,4,7)[:2],gs=gs,seed=sd)
    if kind=='L': w=r.choice((7,8)); p=1 if s2 else 2; return ph2.lhouse(st,w,2 if s2 else 1,[(w-3,p)] if r.random()<0.5 else [(0,p)],gs=gs,seed=sd)
    if kind=='T': return ph2.lhouse(st,9,1,[(3,2)],gs=gs,seed=sd)
    if kind=='U': return ph2.lhouse(st,11,2,[(0,1),(8,1)],gs=gs,seed=sd)
    if kind=='back': return ph2.backwing(st,r.choice((7,8)),1,2,gs=gs,seed=sd)
    if kind=='porch': return with_porch(ph2.house(st,6,1,gs=gs,seed=sd),st)
    if kind=='lean': return with_lean(ph2.house(st,5,1,gs=gs,seed=sd),st)
    if kind=='tower': return dict(im=shapes.image(shapes.plan(st='tim',w=7,s=2,gs='sto',tower=4)),door=2,chim=[],below=0)
FORMS=['hip','gable','shop','gfront','cross','L','T','back','porch','lean','hip2','U','tower']
SMALL=['hip','gable','gfront','lean','back']
def yard(x,fw,y0,y1,door,stone,r):
    # a front yard y0..y1 (rows) in front of a house x..x+fw-1: fence (or a low stone wall) on the street side and both
    # sides, a gate on the door column, a path from the door to the gate, flower beds / a bush / a bench inside
    mh=y1-y0+1; m=[[False]*fw for _ in range(mh)]
    for i in range(fw): m[mh-1][i]=True
    for j in range(mh): m[j][0]=True; m[j][fw-1]=True
    gx=door-x; gates={(gx,mh-1)}
    im=ph.run(m,ph.wall_cell if stone else ph.fence_cell,gates=() if stone else gates)
    if stone:                                      # stone walls leave the gate open
        p=im.load()
        for yy in range((mh-1)*16,mh*16+1):
            for xx in range(gx*16,gx*16+16): p[xx,yy]=(0,0,0,0)
    objs.append((im,x*16,y0*16,False))
    for j in range(mh):
        for i in range(fw):
            if m[j][i]: occ[y0+j][x+i]='fence'
    for j in range(mh): occ[y0+j][door]='road'; road[y0+j][door]=True
    inside=[(x+i,y0+j) for j in range(mh-1) for i in range(1,fw-1) if x+i!=door]
    things=[pl.P['꽃밭'],V2('새 물확'),V2('돌 화분'),pi.P['벤치'],pl.P['꽃밭']]
    for k,(cx,cy) in enumerate(inside):
        if occ[cy][cx] is None and r.random()<0.55:
            f=r.choice(things) if r.random()<0.7 else None
            if f is not None: P_(f'yd{cx}_{cy}',f,cx,cy,allow=())
            else:
                im=tree('bushC')
                if free(cx,cy,2,2): mark('tree',cx,cy,2,2); objs.append((im,cx*16,cy*16,True))
POOL={}
def pool(style):
    # a stock of ready-made houses per style (built once), so each street picks from what FITS its block
    if style not in POOL:
        pr=random.Random({'sto':1,'tim':2,'mix':3}[style]); out=[]
        for i in range(70):
            k=(FORMS+['shop','shop','shop'])[i%(len(FORMS)+3)]; h=form(k,style,pr); im=h['im']
            h=dict(h); h['kind']=k; h['fw']=-(-(im.width-1)//16); h['fh']=-(-(im.height-h['below']-h.get('above',0)-1)//16)
            if style in ('sto','mix'): im=roman.terracotta(im,i,top=h.get('above',0)+46)
            h['im']=soft_outline(im); out.append(h)
        POOL[style]=out
    return POOL[style]
def depth_free(x,fw,bottom,allow=()):
    d=0
    while bottom-d>=0 and all(occ[bottom-d][i] is None or occ[bottom-d][i] in allow for i in range(x,x+fw)) and len({E[bottom-d][i] for i in range(x,x+fw)})==1 and E[bottom-d][x]==E[bottom][x]: d+=1
    return d
def terrace(x0,x1,bottom,style,seed,kinds=None,gap=0.1,back=True):
    r=random.Random(seed); x=x0; last=None; n=0
    P0=[h for h in pool(style) if (kinds is None or h['kind'] in kinds)]
    while x<=x1:
        cands=[]
        for h in P0:
            fw=h['fw']
            if x+fw-1>x1 or h['kind']==last: continue
            if h['below'] and not all(occ[bottom+1][i]=='road' for i in range(x,x+fw)): continue
            d=depth_free(x,fw,bottom)
            if h['fh']<=d:
                yd=2 if (h['kind'] in RICH and h['fh']+2<=d and fw>=6) else 0
                cands.append((h,yd))
        if not cands: x+=1; continue
        left=lambda t: x1-(x+t[0]['fw']-1)
        good=[t for t in cands if left(t)==0 or left(t)>=3] or cands     # never leave a sliver too thin for a house
        h,yd=r.choice(good)
        if yd and r.random()<0.35: yd=0
        b=bottom-yd
        him=h['im']
        if h['kind']=='shop': tr=trade_at(x,b); him=signed(him,h['door'],h['below'],tr)
        y=place(f'h{seed}_{n}',him,x,b,allow=('road',) if h['below'] else (),below=h['below'],door=h['door'],chim=h['chim'],above=h.get('above',0))
        if y is not False and h['kind']=='shop': SHOPS.append((f'h{seed}_{n}',x+h['door'],b,tr))
        if y is False: x+=1; continue
        if yd: yard(x,h['fw'],b+1,bottom,x+h['door'],style=='sto',r)
        x+=h['fw']+(1 if r.random()<gap else 0); last=h['kind']; n+=1
    return n
# ---------------- landmarks ----------------
exec(open(SRC+'/city6_kits.py').read())

# cathedral on the temple mount: spire tower + stone nave with lancet windows
tower=[' '.join(f'sto.spire.{j}{i}' for i in range(3)) for j in range(4)]+SR('sto','lbr','plain','jetty')+SR('sto','lar','plain','jetty')+SR('sto','lar','plain','jetty')+SR('sto','lpr','plain','base')
nave=RR('sto',9,4,4)+SR('sto','lapadapar','eave','jetty')+SR('sto','lapadapar','plain','base'); nave=['. '*9]*(len(tower)-len(nave))+nave
place('cathedral',pj.assemble([a+' '+b for a,b in zip(tower,nave)],L),83,16,outline=True,door=7)
# windmills on the western meadow
place('field1',pi.field('wheat',5,3),1,53); place('field2',pi.field('cabbage',5,2),7,53); place('field3',pi.field('sprout',4,3),2,63)
# harbour: market hall on the harbour square, warehouses on the quays

for i,(x,b) in enumerate(((39,84),(53,84),(47,74))):
    place(f'ware{i}',pj.assemble(RR('wod',6,None,4)+SR('wod','lpghpr','eave','base'),L),x,b,outline=True,door=2)
# inn on the market square's north side
inn=RR('tim',8,4,4)+SR('tim','lwnwwmwr','eave','jetty')+SR('tim','lwnwwmwr','plain','jetty')+SR('sto','lwpwdpwr','plain','base')
h=ph2.house('tim',8,2,gs='sto',seed=11); h['im']=signed(h['im'],h['door'],0,'inn'); any(place('inn',h['im'],ix,ib,outline=True,door=h['door'],chim=h['chim'],above=h.get('above',0)) for ib in (32,53,43) for ix in range(56,76)) or print('no inn')
h=ph2.house('sto',6,1,seed=12); h['im']=signed(roman.terracotta(h['im'],1,top=h.get('above',0)+46),h['door'],0,'smith'); any(place('smithy_town',h['im'],ix,ib,outline=True,door=h['door'],chim=h['chim'],above=h.get('above',0)) for ib in (43,53,32) for ix in range(14,45)) or print('no smithy')
h=ph2.balcony_house(); place('balc',h['im'],72,42,outline=True,below=6,allow=('road',),door=h['door'],chim=h['chim'],above=h['above']) or print('no balcony house')

# ---------------- terraces: along every run of street that has buildable ground on its north side ----------------
def style_at(x,y):
    if E[y][x]>=2: return 'sto'
    if E[y][x]==1: return 'mix' if (x//9+y//7)%3==0 else 'tim'
    return 'tim'
runs=[]
for y in range(1,H):
    x=0
    while x<W:
        if road[y][x] and not road[y-1][x] and occ[y-1][x] is None:
            x0=x
            while x<W and road[y][x] and not road[y-1][x] and occ[y-1][x] is None and E[y-1][x]==E[y-1][x0]: x+=1
            if x-x0>=3: runs.append((x0,x-1,y-1))
        else: x+=1
runs.sort(key=lambda r:-(r[1]-r[0]))
for i,(x0,x1,b) in enumerate(runs):
    terrace(x0,x1,b,style_at(x0,b),100+i)
# ---------------- infill: small houses on the leftover ground ----------------
n=0
for y in range(H-2,3,-1):
    for x in range(2,W-3):
        if occ[y][x] is not None or occ[y+1][x] not in (None,'road','plaza'): continue
        st=style_at(x,y)
        for h in random.Random(x*131+y).sample(pool(st),12):
            if h['below'] or h['kind'] in RICH: continue
            fw=h['fw']
            if x+fw>W: continue
            if any(occ[y+1][i] not in (None,'road','plaza') or E[y+1][i]!=E[y][x] for i in range(x,min(W,x+fw))): continue
            if h['fh']>depth_free(x,fw,y): continue
            if place(f'i{n}',h['im'],x,y,door=h['door'],chim=h['chim'],above=h.get('above',0)) is not False:
                n+=1; break
print('infill',n)
# ---------------- every door reaches the street network ----------------
from collections import deque
WALK=('road','plaza','stair','bridge','walk','gate')
def network():
    # cells connected to the main street (stairs join the levels)
    seen={(62,33)}; q=deque([(62,33)])
    while q:
        cx,cy=q.popleft()
        for ddx,ddy in ((0,1),(1,0),(-1,0),(0,-1)):
            nx,ny=cx+ddx,cy+ddy
            if 0<=nx<W and 0<=ny<H and (nx,ny) not in seen and occ[ny][nx] in WALK: seen.add((nx,ny)); q.append((nx,ny))
    return seen
NET=network(); unreached=0; DROP=[]
print('DBG net',[(c,c in NET,occ[c[1]][c[0]]) for c in ((15,21),(15,23),(15,25),(23,26),(23,27),(23,30),(27,8),(31,10),(20,19),(45,23),(45,21),(44,22))])
for name,dx,by in HOUSES:
    sx,sy=dx,by+1
    if not (0<=sy<H) or occ[sy][sx] not in (None,'rim')+WALK: unreached+=1; print('blocked door',name,sx,sy,occ[sy][sx]); continue
    if (sx,sy) in NET: continue
    prev={(sx,sy):None}; q=deque([(sx,sy)]); goal=None
    while q:
        c=q.popleft()
        if c in NET: goal=c; break
        cx,cy=c
        for ddx,ddy in ((0,1),(1,0),(-1,0),(0,-1)):
            nx,ny=cx+ddx,cy+ddy
            if 0<=nx<W and 0<=ny<H and (nx,ny) not in prev and occ[ny][nx] in (None,'rim')+WALK and (occ[ny][nx]=='stair' or occ[cy][cx]=='stair' or E[ny][nx]==E[cy][cx]):
                prev[(nx,ny)]=c; q.append((nx,ny))
    if goal is None: unreached+=1; print('unreached',name,sx,sy,occ[sy][sx],E[sy][sx]); DROP.append(name); continue
    c=goal
    while c is not None:
        if occ[c[1]][c[0]] in (None,'rim'): occ[c[1]][c[0]]='road'; road[c[1]][c[0]]=True
        NET.add(c); c=prev[c]
print('doors',len(HOUSES),'unreached (generation)',unreached)
UNREACHED_BEFORE=unreached
for name in DROP:
    o,si,sn=OBJOF[name]; objs.remove(o)
    for k in range(si,si+sn): SMOKE[k]=None
    for yy in range(H):
        for xx in range(W):
            if occ[yy][xx]==name: occ[yy][xx]=None
HOUSES=[h for h in HOUSES if h[0] not in DROP]; SHOPS=[s_ for s_ in SHOPS if s_[0] not in DROP]
SMOKE=[s_ for s_ in SMOKE if s_ is not None]
print('dropped',DROP)
exec(open(SRC+'/road_audit6.py').read())
# ---------------- props ----------------
# harbour square + quays
for i,(n,x,y) in enumerate((('생선 건조대',60,72),('생선 건조대',67,72),('손수레',68,67))): P_(f'hq{i}',V2(n),x,y)
for i,(f,x,y) in enumerate(((lambda: ph.stall(2,'blue',['fish','fish']),61,67),(lambda: ph.stall(3,'green',['fish','cloth','fish']),64,67),(lambda: ph.stall(2,'red',['apple','bread']),61,70))): P_(f'hst{i}',f,x,y)
P_('crates1',pi.P['상자 더미'],47,86,allow=('road',)); P_('sacks1',pi.P['곡식 자루'],53,86,allow=('road',))
# yards: household things only in the gaps between houses and at the ends of terraces
YARD=[pi.P['장작더미'],pl.P['빗물통'],pl.P['꽃밭'],V2('외바퀴 수레')]
HN={h[0] for h in HOUSES}
k=0
for y in range(3,95):
    for x in range(1,98):
        if occ[y][x] is None and occ[y+1][x] in ('road','plaza') and (occ[y][x-1] in HN or occ[y][x+1] in HN) and rng.random()<0.22:
            if P_(f'yd{x}_{y}',YARD[k%len(YARD)],x,y,allow=()): k+=1
# lanterns along the main streets
exec(open(SRC+'/city6_props.py').read())

# ---------------- trees: clumps on the hill edges, along the river, parks, outskirts ----------------
def clump(cx,cy,n):
    for kk in ['oakA','oakB','bushD','bushC','bushE','bushC','oakB'][:n]:
        im=tree(kk); fw,fh=im.width//16,im.height//16
        for t in range(30):
            x=cx+rng.randint(-3,3)-fw//2; y=cy+rng.randint(-3,3)-fh//2
            if free(x,y,fw,fh): mark('tree',x,y,fw,fh); objs.append((im,x*16,y*16,True)); break
_T5={}
def tree5(k,seed=0):
    if k in TREES: return tree(k)
    key=(k,seed%3)
    if key not in _T5:
        im=roman.cypress(3,seed%3) if k=='cyp' else roman.umbrella_pine(seed%3); im._tree=True; _T5[key]=im
    return _T5[key]
# gardens: every leftover strip becomes a kitchen plot, an orchard tree or a hedge bush (largest that fits first)
gr=random.Random(9)
for y in range(2,H-1):
    for x in range(1,W-1):
        if occ[y][x] is not None: continue
        if gr.random()<0.12 and y+2<H and free(x,y,4,2) and all(occ[y+2][i] is not None for i in range(x,x+4)):
            P_(f'plot{x}_{y}',pi.field(gr.choice(['cabbage','wheat']),4,2),x,y,allow=()); continue
        if gr.random()<0.35: continue
        big=gr.sample(['oakA','oakB','bushD'],3)
        if gr.random()<0.30: big=['cyp']+big
        for kk in big+gr.sample(['bushC','bushE'],2):
            im=tree5(kk,x*7+y); fw,fh=im.width//16,im.height//16
            if free(x,y,fw,fh): mark('tree',x,y,fw,fh); objs.append((im,x*16,y*16,True)); break
# ---------------- lake: wooden piers and boats ----------------
def pier(w,h):
    im=Image.new('RGBA',(w*16,h*16)); px=im.load(); WD=terrain.WD
    for Y in range(h*16):
        for X in range(w*16):
            if 2<=X<w*16-2: c=WD[5] if (Y%4) else WD[3]
            elif X in (0,1,w*16-2,w*16-1) and Y%16<12: c=WD[2]
            else: continue
            px[X,Y]=c+(255,)
    return im
for px_ in (20,38,62,76):
    y0=shore[px_]
    objs.append((pier(2,5),px_*16,y0*16,True))
# boats sit in the water (their own waterline effect); drawn per frame by city2_anim.py, frame 0 here
BOATS=[('ship',51,88),('fishing',40,89),('fishing',77,91),('rowboat',22,92),('rowboat',35,94),('rowboat',66,95),('rowboat',44,97),('barge',47,80)]


# ---------------- townsfolk ----------------
CS='/home/main/.t3/worktrees/rpg-zzu/t3code-8b4b09de/public/assets/easyrpg/charset/'
_SH={}
def npc(sheet,k,d,f=1):
    if sheet not in _SH:
        im=Image.open(CS+sheet+'.png').convert('RGBA'); key=im.getpixel((0,0)); p=im.load()
        for y in range(im.height):
            for x in range(im.width):
                if p[x,y]==key: p[x,y]=(0,0,0,0)
        _SH[sheet]=im
    D={'u':0,'r':1,'d':2,'l':3}[d]; cx,cy=(k%4)*72,(k//4)*128
    return _SH[sheet].crop((cx+f*24,cy+D*32,cx+f*24+24,cy+D*32+32))
people=[]
walk=[(x,y) for y in range(H) for x in range(W) if occ[y][x] in ('road','plaza')]
rng.shuffle(walk)
sheets=['People1','People2','People3','People4','People5']
for (x,y) in walk[:110]:
    people.append((npc(rng.choice(sheets),rng.randint(0,7),rng.choice('udlr')),x*16-4,y*16-16))
for (x,y,d) in ((62,1,'d'),(63,1,'d'),(15,22,'d'),(17,22,'d'),(7,19,'r'),(25,19,'l'),(32,11,'d'),(15,27,'d'),(17,27,'d'),(63,41,'d'),(64,45,'u'),(88,23,'d')):
    people.append((npc('People3',7 if x%2 else 6,d),x*16-4,y*16-16))

exec(open(SRC+'/city6_render.py').read())

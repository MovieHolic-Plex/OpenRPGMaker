# 버들항 — 100x100 river town on three levels. Terrain from city_layout.py; houses from the form study (pv, shapes,
# addons2, town3-style ranges); props from pl/pf/pi/pe/ph/pv2; townsfolk from RM2000 charsets.
import sys, os, random, math; sys.path.insert(0,'/tmp/j8city')
from PIL import Image, ImageDraw
import palette; palette.apply()
exec(open('/tmp/j8city/city_layout.py').read())
import terrain, pk, pn, pj, pv, shapes, addons2, pf, pl, pi, pe, ph, pv2
from pj_demo import roofrows as RR, storeyrows as SR
from sheet2 import lawn
L=pj.library()
F=terrain.faces(E)
MAS=[[bool(F[y][x]) and masonry_at(x,y-F[y][x]+1) for x in range(W)] for y in range(H)]
CHIP=terrain.CH
TREES={'oakA':(224,512,4,5),'oakB':(288,512,3,4),'bushC':(336,512,2,2),'bushD':(368,512,3,3),'bushE':(368,560,2,2)}
def tree(k): x,y,w,h=TREES[k]; return CHIP.crop((x,y,x+w*16,y+h*16))
I=lambda o: (o.img() if hasattr(o,'img') else o)
rng=random.Random(11)

# ---------------- masks ----------------
road=grid(False); plaza=grid(False); wall=grid(False)
water=[[river[y][x] or lake[y][x] or pond[y][x] for x in range(W)] for y in range(H)]
def R(g,x0,x1,y0,y1): fill(g,x0,x1,y0,y1,True)
jr=random.Random(5)
def street(y,xs,rows=1,jit=1):
    # an east-west street broken at the cross streets xs=[(x0,x1),...]: each piece is nudged up or down a row so the
    # blocks do not line up like a grid; the cross streets absorb the jogs
    for x0,x1 in xs:
        dy=jr.randint(-jit,jit); R(road,x0,x1,y+dy,y+dy+rows-1)
# castle rock (level 3) + hill (level 2)
R(plaza,3,20,16,20); R(road,11,12,16,20)                        # castle court under the rock, stair up to the keep
street(21,[(1,31),(37,55)],2,0); R(road,23,24,23,26); R(road,44,45,23,27)
street(11,[(38,50)],1,0); R(road,51,52,11,20); R(road,38,39,12,20)
# middle town (level 1)
R(road,23,24,29,32); R(road,44,45,30,32)
R(road,1,98,33,34)
V1=[(12,13),(56,58),(70,71),(88,89)]
R(road,12,13,35,57); R(road,56,58,35,61); R(road,70,71,35,60); R(road,88,89,27,53); R(road,30,31,45,53)
street(44,[(1,11),(14,29),(32,38),(51,55),(72,87),(90,98)],1,1)
street(54,[(1,11),(14,29),(32,46),(51,55),(59,69),(72,87),(90,98)],2,1)
R(road,62,63,4,32); R(road,77,78,10,32); street(8,[(59,61),(64,76)],2,1); street(20,[(59,61),(64,76),(79,79)],2,1)
R(plaza,59,69,35,43)
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
objs=[]
def free(x,y,w,h,allow=()):
    lv={E[yy][xx] for yy in range(y,y+h) for xx in range(x,x+w) if 0<=yy<H and 0<=xx<W}
    return len(lv)==1 and all(0<=xx<W and 0<=yy<H and (occ[yy][xx] is None or occ[yy][xx] in allow) for yy in range(y,y+h) for xx in range(x,x+w))
def mark(name,x,y,w,h):
    for yy in range(y,y+h):
        for xx in range(x,x+w):
            if 0<=xx<W and 0<=yy<H: occ[yy][xx]=name
def place(name,im,x,bottom,allow=(),outline=False,below=0,cast=True):
    # im's bottom row sits on cell row `bottom` (plus `below` px hanging into the next row, e.g. a porch deck)
    im=I(im); hb=im.height-below; fw=-(-(im.width-1)//16); fh=-(-(hb-1)//16); y=bottom-fh+1   # (assembled images carry 1 spare px)
    im=pj.outlined(im) if outline else im
    if not free(x,y,fw,fh,allow): return False
    mark(name,x,y,fw,fh); objs.append((im,x*16-(1 if outline else 0),(bottom+1)*16-hb-(1 if outline else 0)+(1 if hb%16==1 else 0),cast)); return y

# ---------------- building forms ----------------
def house_rows(w,storeys,style,shop,r):
    d=r.randint(2,w-3) if w>=5 else 1
    def ground():
        k=['l']+['p']*(w-2)+['r']; k[d]='d'
        for i in range(1,w-1):
            if i==d: continue
            if abs(i-d)==1: k[i]=('m' if i<d else 'n') if style=='tim' else 'p'
            elif shop and style!='sto': k[i]='s' if (i-d)%2==0 else ('m' if i<d else 'n')
            else: k[i]='w' if (i-d)%2==0 else ('p' if style=='sto' else ('m' if i<d else 'n'))
        return ''.join(k)
    def upper():
        k=['l']+['p']*(w-2)+['r']
        for i in range(1,w-1): k[i]='w' if i%2==1 else ('p' if style=='sto' else 'm' if i<w//2 else 'n')
        return ''.join(k)
    gs='sto' if style=='mix' else style; us='tim' if style=='mix' else style
    gab=d if (w>=6 and r.random()<0.5) else None
    if storeys==1: rows=RR(us,w,gab,3)+SR(gs,ground(),'eave','base')
    else: rows=RR(us,w,gab,4)+SR(us,upper(),'eave','jetty')+SR(gs,ground(),'plain','base')
    ch=r.random()<0.6; ov=[]
    if ch:
        cx=r.choice([c for c in range(1,w-1) if gab is None or abs(c-gab)>1] or [1]); cs='sto' if us=='sto' else 'tim'
        rows=['. '*w]+rows; ov=[(f'{cs}.chimney.top',cx,0),(f'{cs}.chimney.bot',cx,1)]
    return pj.assemble(rows,L,ov)
FORMS=['range','gfront','cross','hip','L','T','back','porch','lean','dormer','range2','tower']
def form(kind,style,r):
    st='sto' if style=='sto' else 'tim'; gs='sto' if style in ('sto','mix') else 'tim'
    s2=r.random()<0.55
    if kind=='range': w=r.randint(5,7); return house_rows(w,2 if s2 else 1,style,r.random()<0.4,r),0
    if kind=='range2': w=r.randint(6,8); return house_rows(w,2,style,True,r),0
    if kind=='gfront': wc=r.choice((3,4,5)); return pv.gfront(st,wc,2 if (s2 and wc>3) else 1,gs=gs),0
    if kind=='cross': w=r.choice((8,9,10)); g=(1,5) if w<10 else (0,4,7); return pv.crossgable(st,w,2 if s2 else 1,gables=g[:2] if w<10 else g,gs=gs),0
    if kind=='hip': return pv.hip('sto' if r.random()<0.6 else st,r.choice((5,6,7)),4,2 if s2 else 1,gs=gs),0
    if kind=='L': w=r.choice((7,8)); return shapes.image(shapes.plan(st=st,w=w,s=2 if s2 else 1,wings=[(w-3 if r.random()<0.5 else 0,'S',2)],gs=gs)),0
    if kind=='T': return shapes.image(shapes.plan(st=st,w=9,s=1,wings=[(3,'S',2)],gs=gs)),0
    if kind=='back': return shapes.image(shapes.plan(st=st,w=r.choice((7,8)),s=1,wings=[(2,'N',2)],gs=gs)),0
    if kind=='tower': return shapes.image(shapes.plan(st='tim',w=7,s=2,gs='sto',tower=4)),0
    if kind=='porch': return addons2.porch_house(),12
    if kind=='lean': return addons2.lean_house(),0
    if kind=='dormer': return addons2.dormer_house(),0
SMALL=['gfront','range','hip','lean','back','dormer']
def terrace(x0,x1,bottom,style,seed,kinds=None,gap=0.15,back=True):
    # front row: houses wall to wall on the street; back row: smaller houses behind them across a one-row alley,
    # so a block is two rows deep like a real town (the alley is the back row's street)
    r=random.Random(seed); x=x0; last=None; n=0; tops=[]
    while x<=x1:
        ks=[k for k in (kinds or FORMS) if k!=last]; r.shuffle(ks); ok=False
        for k in ks[:8]:
            im,below=form(k,style,r); fw=-(-(im.width-1)//16)
            if x+fw-1>x1: continue
            y=place(f'h{seed}_{n}',im,x,bottom,allow=('road',) if below else (),outline=True,below=below)
            if y is not False:
                tops.append((x,fw,y)); x+=fw+(1 if r.random()<gap else 0); last=k; n+=1; ok=True; break
        if not ok: x+=1
    if not back: return n
    top=[None]*W
    for tx,fw,ty in tops:
        for i in range(tx,tx+fw): top[i]=ty
    x=x0; r2=random.Random(seed+900); last=None
    while x<=x1:
        if top[x] is None: x+=1; continue
        ok=False; ks=[k for k in SMALL if k!=last]; r2.shuffle(ks)
        for k in ks[:6]:
            im,below=form(k,style,r2); fw=-(-(im.width-1)//16)
            if below or x+fw-1>x1 or any(top[i] is None for i in range(x,x+fw)): continue
            b=min(top[i] for i in range(x,x+fw))-2
            y=place(f'b{seed}_{n}',im,x,b,outline=True)
            if y is not False:
                for i in range(x,x+fw):
                    if occ[b+1][i] is None: occ[b+1][i]='road'; road[b+1][i]=True
                x+=fw; last=k; n+=1; ok=True; break
        if not ok: x+=1
    return n

# ---------------- landmarks ----------------
# castle: the keep and two round towers on the rock (level 3), a gatehouse range on the court below it
place('keep',pv.hip('sto',9,5,2),7,12,outline=True)
place('towerW',pv.round_tower('sto',4,5,4),2,12,outline=True)
place('towerE',pv.round_tower('sto',4,5,4),17,12,outline=True)
place('barracks',pj.assemble(RR('sto',6,None,3)+SR('sto','lwpdwr','eave','base'),L),15,20,outline=True,allow=('plaza',)) or print('no barracks')
place('stable',pj.assemble(RR('wod',5,None,3)+SR('wod','lghpr','eave','base'),L),3,20,outline=True,allow=('plaza',)) or print('no stable')
# cathedral on the temple mount: spire tower + stone nave with lancet windows
tower=[' '.join(f'sto.spire.{j}{i}' for i in range(3)) for j in range(4)]+SR('sto','lbr','plain','jetty')+SR('sto','lar','plain','jetty')+SR('sto','lar','plain','jetty')+SR('sto','lpr','plain','base')
nave=RR('sto',9,4,4)+SR('sto','lapadapar','eave','jetty')+SR('sto','lapadapar','plain','base'); nave=['. '*9]*(len(tower)-len(nave))+nave
place('cathedral',pj.assemble([a+' '+b for a,b in zip(tower,nave)],L),83,16,outline=True)
# windmills on the western meadow
place('mill1',pv.windmill(0),2,43,outline=True); place('mill2',pv.windmill(2),6,42,outline=True)
place('field1',pi.field('wheat',5,3),1,53); place('field2',pi.field('cabbage',5,2),7,53); place('field3',pi.field('sprout',4,3),2,63)
# harbour: market hall on the harbour square, warehouses on the quays

for i,(x,b) in enumerate(((39,84),(53,84),(47,74))):
    place(f'ware{i}',pj.assemble(RR('wod',6,None,4)+SR('wod','lpghpr','eave','base'),L),x,b,outline=True)
# inn on the market square's north side
inn=RR('tim',8,4,4)+SR('tim','lwnwwmwr','eave','jetty')+SR('tim','lwnwwmwr','plain','jetty')+SR('sto','lwpwdpwr','plain','base')
place('inn',pj.assemble(['. '*8]+inn,L,[('tim.chimney.top',1,0),('tim.chimney.bot',1,1),('tim.chimney.top',6,0),('tim.chimney.bot',6,1)]),60,32,outline=True)
place('smithy',pj.assemble(RR('sto',6,None,3)+SR('sto','ldpwwr','eave','base'),L),27,43,outline=True)
place('balc',addons2.balcony_house(),72,42,outline=True,below=46,allow=('road',)) or print('no balcony house')

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
    terrace(x0,x1,b,style_at(x0,b),100+i,back=True)
# ---------------- infill: small houses on the leftover ground, each with a path in front of its door ----------------
INF=['gfront','range','hip','lean','gfront','back']
ir=random.Random(77); n=0
for y in range(H-2,3,-1):
    for x in range(2,W-3):
        if occ[y][x] is not None or E[y][x]!=E[y+1][x] or occ[y+1][x] not in (None,'road','plaza'): continue
        for k in ir.sample(INF,3):
            im,below=form(k,style_at(x,y),ir)
            if below: continue
            fw=-(-(im.width-1)//16)
            if any(occ[y+1][i] not in (None,'road','plaza') or E[y+1][i]!=E[y][x] for i in range(x,min(W,x+fw))): continue
            if place(f'i{n}',im,x,y,outline=True) is not False:
                for i in range(x,x+fw):
                    if occ[y+1][i] is None: occ[y+1][i]='road'; road[y+1][i]=True
                n+=1; break
print('infill',n)
# ---------------- props ----------------
def P_(name,f,x,y,allow=('plaza',)):
    im=I(f() if callable(f) else f); fw,fh=-(-im.width//16),-(-im.height//16)
    if free(x,y,fw,fh,allow): mark(name,x,y,fw,fh); objs.append((im,x*16,y*16,True)); return True
    return False
def V2(n): return pv2.P[n][0]
# market square
P_('fountain',lambda: pf.fountain(int(os.environ.get('FF','0'))),63,38)
for i,(f,x,y) in enumerate(((lambda: ph.stall(3,'red',['apple','cabbage','bread']),59,35),(lambda: ph.stall(2,'blue',['fish','fish']),67,35),
    (lambda: ph.stall(3,'green',['pot','cloth','pot']),59,41),(lambda: ph.stall(3,'red',['bread','apple','bread']),66,41))): P_(f'stall{i}',f,x,y)
for i,(n,x,y) in enumerate((('시장 저울',62,36),('항아리 좌판',67,38),('과일 바구니',59,38),('돌 벤치',63,43),('종 기둥',69,40),('형틀',60,43),('흉상 받침대',65,36))):
    P_(f'm{i}',V2(n),x,y)
P_('lamp1',pf.P['철제 가로등'],61,39); P_('lamp2',pf.P['철제 가로등'],68,39)
# castle court
P_('knW',pf.P['기사 석상'],8,18); P_('knE',pf.P['기사 석상'],13,18); P_('ban1',pf.P['깃발 기둥'],6,17); P_('ban2',pf.P['깃발 기둥'],15,17)
P_('well',pe.P['돌 우물'],19,18); P_('target',V2('과녁'),3,19); P_('rack',pf.P['무기 거치대'],4,17)
# temple court
P_('bell',V2('종 기둥'),93,18); P_('urn1',V2('돌 화분'),86,19); P_('urn2',V2('돌 화분'),91,19); P_('bath',V2('새 물확'),84,20); P_('bench',V2('돌 벤치'),94,21)
# harbour square + quays
for i,(n,x,y) in enumerate((('생선 건조대',60,72),('생선 건조대',67,72),('손수레',68,67),('술통 받침대',66,72),('시장 저울',63,73))): P_(f'hq{i}',V2(n),x,y)
P_('crates1',pi.P['상자 더미'],47,86,allow=('road',)); P_('sacks1',pi.P['곡식 자루'],53,86,allow=('road',))
# yards: household things only in the gaps between houses and at the ends of terraces
YARD=[pl.P['빨래줄'],pi.P['장작더미'],pl.P['빗물통'],pl.P['호박'],pi.P['꽃 화분 상자'],V2('개집'),V2('손 펌프'),V2('도끼 박힌 모탕'),V2('외바퀴 수레'),V2('빵 화덕'),V2('양동이와 빗자루'),pl.P['꽃밭']]
k=0
for y in range(3,95):
    for x in range(1,98):
        if occ[y][x] is None and occ[y+1][x] in ('road','plaza') and ((occ[y][x-1] or '')[:1] in 'hb' or (occ[y][x+1] or '')[:1] in 'hb') and rng.random()<0.5:
            if P_(f'yd{x}_{y}',YARD[k%len(YARD)],x,y,allow=()): k+=1
# lanterns along the main streets
for x in range(4,98,9):
    for y in (32,43,53,65,74):
        P_(f'lp{x}_{y}',V2('나무 등롱 기둥'),x,y-1,allow=())

# ---------------- trees: clumps on the hill edges, along the river, parks, outskirts ----------------
def clump(cx,cy,n):
    for kk in ['oakA','oakB','bushD','bushC','bushE','bushC','oakB'][:n]:
        im=tree(kk); fw,fh=im.width//16,im.height//16
        for t in range(30):
            x=cx+rng.randint(-3,3)-fw//2; y=cy+rng.randint(-3,3)-fh//2
            if free(x,y,fw,fh): mark('tree',x,y,fw,fh); objs.append((im,x*16,y*16,True)); break
# gardens: every leftover strip becomes a kitchen plot, an orchard tree or a hedge bush (largest that fits first)
gr=random.Random(9)
for y in range(2,H-1):
    for x in range(1,W-1):
        if occ[y][x] is not None: continue
        if gr.random()<0.12 and free(x,y,4,2) and all(occ[y+2][i] is not None for i in range(x,x+4)):
            P_(f'plot{x}_{y}',pi.field(gr.choice(['sprout','cabbage','wheat']),4,2),x,y,allow=()); continue
        for kk in gr.sample(['oakA','oakB','bushD'],3)+['bushC','bushE']:
            im=tree(kk); fw,fh=im.width//16,im.height//16
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
for bx,by in ((24,93),(41,95),(66,94),(80,96),(30,97)):
    objs.append((I(pe.P['통나무 카누']()),bx*16,by*16,True))

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
for (x,y,d) in ((62,1,'d'),(63,1,'d'),(10,19,'d'),(11,19,'d'),(63,39,'d'),(64,44,'u'),(88,23,'d')):
    people.append((npc('People3',7 if x%2 else 6,d),x*16-4,y*16-16))

# ---------------- render ----------------
img=Image.new('RGBA',(W*16,H*16))
for x in range(W):
    for y in range(H): img.paste(lawn,(x*16,y*16))
img.alpha_composite(pk.plaza(plaza).img(outline=False))
img.alpha_composite(pk.road(road,joins=plaza).img())
img.alpha_composite(pn.canal(water))
img.alpha_composite(terrain.render(E,MAS,STAIRS,FALLS,frame=int(os.environ.get('FF','0'))))
img.alpha_composite(pn.townwall(wall,gates=GATES))
for bx in (33,47):                                   # bridges on the main streets
    for by in (21,33,44,66,75):
        if all(water[by+j][bx+i] for i in range(4) for j in range(2)) and by+2<H and not any(fx==bx and 0<=by-(fy+3)<3 for fx,fy,fw in FALLS):
            objs.append((pn.bridge(4,4),bx*16,(by-1)*16,True))
mask=Image.new('L',img.size,0)
for im,x,y,cast in objs:
    if cast: mask.paste(255,(x+6,y+3),im.split()[3].point(lambda v:255 if v>128 else 0))
p=img.load(); mp=mask.load()
for yy in range(img.height):
    for xx in range(img.width):
        if mp[xx,yy]: r,g,b,a=p[xx,yy]; p[xx,yy]=(int(r*0.52),int(g*0.58),int(b*0.74),a)
for im,px_,py_ in people:
    sh=Image.new('RGBA',(14,5)); ImageDraw.Draw(sh).ellipse((0,0,13,4),fill=(0,0,0,70)); img.alpha_composite(sh,(px_+5,py_+28))
draw=[(y+im.height,im,x,y) for im,x,y,c in objs]+[(py_+32,im,px_,py_) for im,px_,py_ in people]
for _,im,x,y in sorted(draw,key=lambda o:o[0]): img.alpha_composite(im,(x,y))
img.save(os.environ.get('OUT','/tmp/j8city/city.png'))
img.resize((1000,1000),Image.LANCZOS).save('/tmp/j8city/city_s.png')
print('houses',sum(1 for o in objs),'people',len(people))

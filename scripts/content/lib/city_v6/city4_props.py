# v4 props for 버들항 — exec'd inside city4.py after the doors and the road audit.
# Rules: never on a door front (2 cells), a gate passage, a stair approach or a bridge end; a prop may take a street cell
# only at the edge of a street at least 2 cells wide (the paving stays under it), and every placement on a walkable cell
# is re-checked by BFS. Tall props claim their foot row(s); the cells their top overhangs are reserved ('ovh') so no
# other object is drawn into them. Every prop has an owner: a shop, a square, a quay, a stair or a street.
from collections import deque as _dq
OVER=[]; ANIM=[]; GLOW=[]; PROPLOG={}; PLACED=[]
import pzmeta
def pid(k): return pzmeta.M[k][0] if k in pzmeta.M else k
WALKC=('road','plaza')
DOORF={(62,33),(63,33),(62,34),(63,34)}
for _n,_dx,_by in HOUSES:
    for _k in (1,2): DOORF.add((_dx,_by+_k))
for gx,gy in GATES:
    for k in range(1,4): DOORF.add((gx,gy+k))
for x0,y0,w in STAIRS:
    for i in range(-1,w+1):
        for yy in (y0-1,y0-2,y0+3,y0+4): DOORF.add((x0+i,yy))
for bx,by in BRIDGES:
    for i in range(-2,6):
        for j in (0,1): DOORF.add((bx+i,by+j))
_rs=random.Random(404)
_cache={}
def R3(name):
    if name not in _cache:
        o=pz.P[name][0](); _cache[name]=o if isinstance(o,Image.Image) else pz.fin(o)
    return _cache[name]
def walkable(x,y): return 0<=x<W and 0<=y<H and occ[y][x] in WALKC+('stair','bridge')
def reach():
    seen={(62,33)}; q=_dq([(62,33)])
    while q:
        cx,cy=q.popleft()
        for ddx,ddy in ((0,1),(1,0),(-1,0),(0,-1)):
            nx,ny=cx+ddx,cy+ddy
            if 0<=nx<W and 0<=ny<H and (nx,ny) not in seen and occ[ny][nx] in WALK: seen.add((nx,ny)); q.append((nx,ny))
    return seen
_R=[reach()]
def edge_ok(x,y):
    if occ[y][x]=='plaza': return True
    up,dn,lf,rt=walkable(x,y-1),walkable(x,y+1),walkable(x-1,y),walkable(x+1,y)
    return (up!=dn) or (lf!=rt and not (up or dn))
def put(name,x0,by,foot=1,allow=WALKC,anim=None,label=None,cast=True):
    im=R3(name) if isinstance(name,str) else name
    fw=-(-im.width//16); cells=[(x,y) for y in range(by-foot+1,by+1) for x in range(x0,x0+fw)]
    if not all(0<=x<W and 0<=y<H for x,y in cells): return False
    if len({E[y][x] for x,y in cells})!=1: return False
    wk=[]
    for x,y in cells:
        o=occ[y][x]
        if (x,y) in DOORF: return False
        if o is None: continue
        if o in allow and o in WALKC:
            if not edge_ok(x,y): return False
            wk.append((x,y)); continue
        return False
    ht=-(-im.height//16); ov=[]
    for y in range(by-ht+1,by-foot+1):
        for x in range(x0,x0+fw):
            if not (0<=y<H): continue
            if occ[y][x] in ('water','cliff','stair','ovh') or E[y][x]<E[by][x0]: return False
            if occ[y][x] is None: ov.append((x,y))
    old={c:occ[c[1]][c[0]] for c in cells}
    for x,y in cells: occ[y][x]='prop'
    if wk:
        r=reach(); lost=_R[0]-r
        if any(c not in wk for c in lost) or any((dx,by_+1) not in r for _n,dx,by_ in HOUSES):
            for c,o in old.items(): occ[c[1]][c[0]]=o
            return False
        _R[0]=r
    for x,y in ov: occ[y][x]='ovh'
    px=x0*16+(fw*16-im.width)//2; py=(by+1)*16-im.height
    if anim: ANIM.append((anim,px,py))
    else: objs.append((im,px,py,cast))
    k=label or (name if isinstance(name,str) else '?'); PROPLOG[k]=PROPLOG.get(k,0)+1
    PLACED.append(dict(id=pid(k),x=x0,y=by-foot+1,w=fw,h=foot,px=px,py=py))
    return True
def try_box(name,x0,x1,y0,y1,n=1,foot=1,allow=WALKC,anim=None,seed=0,label=None):
    pos=[(x,y) for y in range(y0,y1+1) for x in range(x0,x1+1)]
    random.Random(seed or (sum(map(ord,name))%999 if isinstance(name,str) else 7)).shuffle(pos); k=0
    for x,y in pos:
        if k>=n: break
        if put(name,x,y,foot,allow,anim,label=label): k+=1
    return k
def glow_last(ox,oy): GLOW.append((objs[-1][1]+ox,objs[-1][2]+oy))

# ---- 1. market square (59..69 x 35..43): stalls inside the square only, lamps at its corners, flags at its entry ----
for nm in ('노점: 치즈·고기','노점: 옹기·술병','노점: 약초·꽃','노점: 호박·양배추'): try_box(nm,59,69,35,43,1,foot=2,allow=('plaza',))
for nm in ('꽃 수레','채소 손수레','과일 상자','양배추 상자'): try_box(nm,59,69,35,43,1,allow=('plaza',))
for (x,y) in ((58,34),(70,34),(58,44),(70,44),(59,35),(68,35),(59,43),(68,43)):
    if PROPLOG.get('쌍등 가로등',0)>=4: break
    if put('쌍등 가로등',x,y): glow_last(6,15); glow_last(25,15)
for (x,y) in ((59,34),(68,34),(60,34),(67,34)):
    if PROPLOG.get('깃대 (나부낌)',0)>=2: break
    put(R3('깃대 (나부낌)'),x,y,anim='flag',label='깃대 (나부낌)')
# ---- 2. harbour square (60..69 x 67..73) + quay edge ----
try_box(R3('물고기 연못 분수'),60,69,66,74,1,foot=2,anim='fpool',label='물고기 연못 분수')
for nm in ('닻 전시대','그물 건조대','얼음 생선 궤짝','노점: 호박·양배추','생선 통'): try_box(nm,58,71,66,75,1,allow=('plaza',))
for (x,y) in ((60,66),(69,66),(61,66),(68,66)):
    if PROPLOG.get('깃대 (나부낌)',0)>=4: break
    put(R3('깃대 (나부낌)'),x,y,anim='flag',label='깃대 (나부낌)')
PIERS=(20,38,62,76)
_ok=False
for x in list(range(40,47))+list(range(52,60))+list(range(24,33)):
    if shore[x] and all(shore[i]==shore[x] for i in range(x,x+4)) and put(R3('부두 기중기'),x,shore[x]-1,foot=1,anim='crane',label='부두 기중기'): _ok=True; break
_ok or print('no crane')
for p in PIERS:                                          # a mooring post each side of every pier head
    for x in (p-1,p+2): put('계선주',x,shore[p]-1)
HARB=['계선주','얼음 생선 궤짝','계선주','통·상자·자루 더미','계선주','그물 건조대','생선 통']
k=0
for x in range(9,90,5):                                  # quay edge: one thing every 5 cells, on the water-side row
    if not shore[x] or any(p-2<=x<=p+3 for p in PIERS): continue
    if put(HARB[k%len(HARB)],x,shore[x]-1): k+=1
# ---- 3. shops: hanging sign + goods of the same trade beside the door ----
GOODS={'fish':['생선 상자','얼음 생선 궤짝','생선 통'],'grocer':['과일 상자','양배추 상자','채소 손수레'],'butcher':['통·상자·자루 더미','입간판 (분필)'],
 'bakery':['빵 진열대','입간판 (분필)','파라솔 탁자'],'pharm':['약초 걸이·절구','입간판 (분필)'],'tailor':['옷감 걸이','문간 화분 둘'],
 'jewel':['문간 화분 둘','입간판 (분필)'],'books':['입간판 (분필)','둥근 돌 화분'],'smith':['칼 꽂은 통','통·상자·자루 더미'],'inn':['주막 탁자','파라솔 탁자','입간판 (분필)']}
def busy(dx,by):
    if not (0<=by+1<H): return False
    if any(occ[yy][xx]=='plaza' for yy in range(by,by+4) for xx in range(dx-2,dx+3) if 0<=yy<H and 0<=xx<W): return True
    return by+1 in (33,34) or (E[by][dx]==0 and by>=60)
names_shop={s_[0] for s_ in SHOPS}
for i,(nm,dx,by) in enumerate(HOUSES):
    if nm in names_shop or nm in ('inn','smithy','cathedral','keep','barracks') or not busy(dx,by) or _rs.random()<0.35: continue
    tr=trade_at(dx,by); sg=pz.fin(pz.bracket_sign(tr)); cv=Image.new('RGBA',(20,45)); cv.alpha_composite(sg,(0,0))
    OVER.append((cv,(dx+1)*16+1,(by+1)*16-44,False)); SHOPS.append((nm,dx,by,tr))
    PLACED.append(dict(id='sign_'+tr,x=dx+1,y=by-1,w=2,h=0,layer='wall-overlay',door=[dx,by]))
for sn,dx,by,tr in SHOPS:
    if sn in names_shop: PLACED.append(dict(id='sign_'+tr,x=dx+1,y=by-1,w=2,h=0,layer='wall-overlay (baked into house)',door=[dx,by]))
    k_='걸이 간판: '+pz.SIGN_NAME[tr]; PROPLOG[k_]=PROPLOG.get(k_,0)+1
SHOPLOG=[]
def spots(name_,dx,by):
    xs=[x for x in range(W) if occ[by][x]==name_]
    out=[(x,by+1) for x in (dx+1,dx-1,dx+2,dx-2)]
    if xs: out+=[(max(xs)+1,by),(min(xs)-1,by)]
    return out
def shop_goods(sn,dx,by,tr,n=2):
    got=[]
    for nm in GOODS[tr]:
        im=R3(nm); fw=-(-im.width//16)
        for x,y in spots(sn,dx,by):
            if x<=dx<x+fw and y==by+1: continue
            if put(nm,x,y): got.append(nm); break
        if len(got)>=n: break
    return got
for sn,dx,by,tr in SHOPS: SHOPLOG.append((sn,tr,shop_goods(sn,dx,by,tr)))
for nm,dx,by in HOUSES:
    if nm in ('inn','smithy'): SHOPLOG.append((nm,'inn' if nm=='inn' else 'smith',shop_goods(nm,dx,by,'inn' if nm=='inn' else 'smith',3)))
# ---- 4. homes: a pot pair or a flower box by some doors; laundry across the alleys between two houses ----
shopdoors={(dx,by) for _s,dx,by,_t in SHOPS}
for i,(nm,dx,by) in enumerate(HOUSES):
    if (dx,by) in shopdoors or nm in ('inn','smithy'): continue
    r=_rs.random()
    if r<0.35: put('문간 화분 둘',dx+(1 if i%2 else -1),by+1) or put('문간 화분 둘',dx-(1 if i%2 else -1),by+1)
    elif r<0.5: put('긴 꽃상자',dx+1,by+1) or put('긴 꽃상자',dx-2,by+1)
def hname(o): return isinstance(o,str) and o[:1] in 'hib' and o not in ('bridge',)
nl=0
for y in range(2,H-1):
    x=1
    while x<W-4:
        if hname(occ[y][x]) and not hname(occ[y][x+1]) and not hname(occ[y+1][x]):
            a=occ[y][x]; g=1
            while g<=3 and x+g<W and not hname(occ[y][x+g]): g+=1
            if g<=3 and x+g<W and hname(occ[y][x+g]) and occ[y][x+g]!=a and not hname(occ[y+1][x+g]) and _rs.random()<0.75:
                wpx=(g-1)*16+12
                if wpx>=20:
                    im=pz.laundry_line(wpx,seed=x+y,drop=8); OVER.append((im,(x+1)*16-6,y*16-10,False)); nl+=1
                    PLACED.append(dict(id='laundry_line',x=x+1,y=y,w=g-1,h=0,layer='overlay',between=[a,occ[y][x+g]]))
            x+=g
        else: x+=1
PROPLOG['골목 빨랫줄']=nl
_rk=[]
_cc=[(x,y) for y in range(4,H-2) for x in range(1,W-3)]; _rs.shuffle(_cc)
for x,y in _cc:                                            # drying racks: only right beside a house, same row as its wall
    if len(_rk)>=5: break
    HN={h[0] for h in HOUSES}
    if occ[y][x] is None and occ[y][x+1] is None and occ[y][x-1] in HN and occ[y-1][x-1]==occ[y][x-1] and not any(abs(x-a)+abs(y-b)<16 for a,b in _rk):
        if put('빨래 건조대',x,y,foot=1,allow=()): _rk.append((x,y))
# ---- 5. street furniture with an owner ----
# lamps: along the main streets and the quay, on the lawn edge, >= 9 cells apart
lamps=[]
for y in range(2,H-2):
    for x in range(1,W-1):
        if not (occ[y][x] is None and walkable(x,y+1)): continue
        if not any(walkable(x+i,y+1) and walkable(x+i,y+2) for i in (0,)): continue      # only beside 2-wide streets
        if any(abs(x-a)+abs(y-b)<10 for a,b in lamps) or (x*7+y*3)%4: continue
        if put('목 굽은 가로등',x,y,allow=()): lamps.append((x,y)); glow_last(11,13)
# street trees in planters: only along the main street (row 33-34), every ~8 cells
last=-99
for x in range(2,97):
    if x-last<8: continue
    for y in (32,35):
        if occ[y][x] is None and occ[y][x+1] is None and put('화분 속 가로수',x,y,allow=()): last=x; break
# round planters flank every stair foot and top; benches face squares and fountains
for x0,y0,w in STAIRS:
    for (x,y) in ((x0-2,y0+3),(x0+w+1,y0+3),(x0-2,y0-1),(x0+w+1,y0-1)): put('둥근 돌 화분',x,y,allow=('road','plaza',None))
for (bx0,bx1,by0,by1) in ((57,72,33,46),(58,71,65,75),(81,96,16,23)):
    try_box('나무 벤치',bx0,bx1,by0,by1,2,allow=('road','plaza'))
# castle court, temple court, the hill: one monument each
try_box('기념 원주',3,20,16,20,1); try_box('쌍등 가로등',3,20,16,20,1)
try_box(R3('깃대 (나부낌)'),3,20,15,20,2,anim='flag',label='깃대 (나부낌)')
try_box(R3('작은 분수'),82,95,17,22,1,foot=2,anim='fsmall',label='작은 분수'); try_box('둥근 돌 화분',82,95,17,22,2)
try_box('현자 석상',20,58,21,32,1,foot=2,allow=WALKC)
# a small green: the chipset-idiom roofed well (accepted piece) with a flower bed, a bench and a hedge — a place to draw water
WELL=pz.fin(pe.P['돌 우물']()) if hasattr(pe.P['돌 우물'](),'img') else pe.P['돌 우물']()
done=False
for y in range(22,90):
    for x in range(3,95):
        if all(occ[yy][xx] is None for yy in range(y-2,y+1) for xx in range(x-2,x+5)) and all(walkable(xx,y+1) for xx in range(x,x+2)):
            if put(WELL,x,y,foot=2,allow=(),label='돌 우물 (지붕)'):
                done=True; WX,WY=x,y
                put('나무 벤치',x-2,y+1,allow=()) or put('나무 벤치',x+2,y+1,allow=())
                put(pz.fin(pl.P['꽃밭']()) if hasattr(pl.P['꽃밭'](),'img') else pl.P['꽃밭'](),x+2,y,allow=(),label='꽃밭')
                put(R3('다듬은 산울타리'),x-1,y-2,allow=(),label='다듬은 산울타리')
                break
    if done: break
for (x,y) in [(x,y) for y in range(40,90) for x in range(3,95)]:   # a small fountain only where a street meets it
    if all(walkable(i,y+1) for i in (x,x+1)) and put(R3('작은 분수'),x,y,foot=2,allow=(),anim='fsmall',label='작은 분수'): break
try_box('주막 탁자',55,72,28,34,1,allow=())
# ---- 6. festoon over the market (overhead) and stair railings (overlay) ----
ANIM.append(('festoon',59*16+4,35*16-18)); PLACED.append(dict(id='festoon',x=59,y=34,w=10,h=0,layer='overlay')); PROPLOG['등불 줄 (깜빡임)']=1
for x0,y0,w in STAIRS:
    im=pz.stair_rail(40)
    OVER.append((im,x0*16-3,y0*16-10,False)); OVER.append((im,(x0+w)*16-1,y0*16-10,False))
    PLACED.append(dict(id='stair_rail',x=x0,y=y0,w=w,h=3,side='both',layer='overlay'))
PROPLOG['계단 난간']=2*len(STAIRS)
for bx,by in BRIDGES: PLACED.append(dict(id='bridge_ew',x=bx,y=by,w=4,h=2,layer='deck (walkable) + front face over water'))
# ---- door check after the props ----
_net=reach()
UNREACHED_AFTER=sum(1 for _n,dx,by in HOUSES if (dx,by+1) not in _net)
print('props',sum(PROPLOG.values()),'kinds',len(PROPLOG),'unreached after props',UNREACHED_AFTER,'shops',len(SHOPS))

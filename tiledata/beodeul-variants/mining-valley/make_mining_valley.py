# 산골짜기 광산 마을 「검은재골」 — 다시 돌리면 같은 그림. 실행: python3 make_mining_valley.py
import sys,os
HERE=os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0,os.path.dirname(HERE))
from mprops import *
import random, place
W,H=58,46
s=Scene('mining-valley',W,H,seed=23)
# 눈 덮인 소나무 대신 맨 전나무 (place.tree_add 가 쓰는 캐시를 갈아 끼운다)
_FC={}
def _fircache(n,seed):
    if (n,seed) not in _FC: _FC[(n,seed)]=fir(n,seed)
    return _FC[(n,seed)]
place._pine_cache=_fircache

# ---- 땅 종류 (버들항 땅과 같은 7단 램프·빛 왼쪽 위)
def deck_painter(s_,k,m,PX,PY):
    t=4.0+(vn(PX,PY,3.0,31)-0.5)*1.4
    seam=(PX.astype(int)%6==0); t=np.where(seam,t-1.6,t)
    edge=(PY.astype(int)%16==0)|(PY.astype(int)%16==15); t=np.where(edge,t-1.2,t)
    t=np.clip(np.rint(t+(hsh(PX,PY,33)-0.5)*0.5),1,6).astype(np.int8)
    return palarr('wood')[t],t
def rocktop_painter(s_,k,m,PX,PY):
    X=PX.astype(int); Y=PY.astype(int)
    n=0.6*vn(PX,PY*1.3,8.0,61)+0.4*vn(PX,PY,3.0,62)
    t=2.3+n*2.4+(hsh(PX,PY,63)-0.5)*0.5
    # 얇은 균열: 비스듬한 어두운 줄이 드문드문
    cr=((X+2*Y)%23==0)&(hsh(X//5,Y//5,64)>0.55); t=np.where(cr,t-1.7,t)
    t=np.clip(np.rint(t),1,6).astype(np.int8)
    return palarr('stone')[t],t
def _rails(lx,ly,vert):
    """세로 레일(자갈 바닥 위 침목+두 줄). lx,ly = 타일 안 좌표. 반환 rgb,tone,mask"""
    a,b=(lx,ly) if vert else (ly,lx)
    base=3.4+(hsh(lx,ly,71)-0.5)*1.6
    t=np.clip(np.rint(base),1,6).astype(np.int8)
    rgb=palarr('gravel')[t]
    sl=(b%4==1)&(a>=1)&(a<=14)
    tw=np.where(b%4==1,3,2).astype(np.int8)
    rgb=np.where(sl[...,None],palarr('wood')[tw],rgb); t=np.where(sl,tw,t)
    r1=(a==3)|(a==11); r2=(a==4)|(a==12)
    rt=np.where(r1,5,3).astype(np.int8)
    rgb=np.where((r1|r2)[...,None],palarr('rail')[rt],rgb); t=np.where(r1|r2,rt,t)
    return rgb,t.astype(np.int8)
def railv_painter(s_,k,m,PX,PY):
    return _rails(PX.astype(int)%16,PY.astype(int)%16,True)
def railh_painter(s_,k,m,PX,PY):
    return _rails(PX.astype(int)%16,PY.astype(int)%16,False)
def railc_painter(s_,k,m,PX,PY):
    lx=PX.astype(int)%16; ly=PY.astype(int)%16
    base=3.4+(hsh(lx,ly,71)-0.5)*1.6
    t=np.clip(np.rint(base),1,6).astype(np.int8); rgb=palarr('gravel')[t]
    dx=16-(lx+0.5); dy=ly+0.5; d=np.sqrt(dx*dx+dy*dy); th=np.arctan2(dy,dx)
    sl=False
    for a in (0.26,0.78,1.30):
        sl=sl|((np.abs(th-a)<0.075)&(d>2.5)&(d<13.5))
    tw=np.full(t.shape,3,dtype=np.int8)
    rgb=np.where(sl[...,None],palarr('wood')[tw],rgb); t=np.where(sl,tw,t)
    ro=np.abs(d-12.2)<0.75; ri=np.abs(d-4.1)<0.75
    rt=np.where((np.abs(d-12.2)<0.4)|(np.abs(d-4.1)<0.4),5,3).astype(np.int8)
    rgb=np.where((ro|ri)[...,None],palarr('rail')[rt],rgb); t=np.where(ro|ri,rt,t)
    return rgb,t.astype(np.int8)

s.kind('soil','dirt',3.3,4.5,z=1,sc=6.0,seed=1,dither=0.09)
s.kind('road','gravel',3.6,4.7,z=1,sc=3.5,seed=3,norim=True,dither=0.12)
s.kind('yard','ash',3.2,4.5,z=1,sc=4.5,seed=4,norim=True,dither=0.10)
s.kind('slagg','slag',2.6,4.0,z=1,sc=3.5,seed=5,norim=True,dither=0.12)
s.kind('terr','dirt',4.2,5.4,z=2,sc=5.0,seed=6,sharp=True,dither=0.08)
s.kind('rock','stone',3.6,5.6,z=3,walk=False,painter=rocktop_painter,sharp=True)
s.kind('cliff','stone',2,4.6,z=2,walk=False,painter=paint_cliff('stone',seed=9,lo=2.0,hi=4.4),sharp=True,norim=True)
s.kind('tcliff','slag',2,4.6,z=2,walk=False,painter=paint_cliff('slag',seed=12,lo=2.0,hi=4.4),sharp=True,norim=True)
s.kind('railv','gravel',3,4,z=1,painter=railv_painter,sharp=True,norim=True)
s.kind('railh','gravel',3,4,z=1,painter=railh_painter,sharp=True,norim=True)
s.kind('railc','gravel',3,4,z=1,painter=railc_painter,sharp=True,norim=True)
s.kind('tail','tail',2,4.2,z=0,walk=False,painter=paint_water('tail',seed=8,lo=2.4,hi=4.2,shore=1,deep=(3,6)),outl=1)
s.kind('deck','wood',3,5,z=1.5,painter=deck_painter,sharp=True,norim=True)
s.fill('soil')

# ---- 북쪽 큰 산: 바위 윗면 + 지층 절벽 앞면 4줄 (마디마다 한 칸씩 오르내림)
rnd=random.Random(5); x=0; top=6
while x<W:
    run=rnd.randint(4,9); top=int(np.clip(top+rnd.choice([-1,0,0,1]),5,6))
    for xx in range(x,min(W,x+run)):
        s.rect('rock',xx,0,xx+1,top); s.rect('cliff',xx,top,xx+1,top+4)
    x+=run

# ---- 깎은 단 (서·동·동남). 남쪽 면이 절벽, 틈은 비탈길
s.rect('terr',0,10,17,20)
for xx in range(0,17):
    if xx not in (8,9): s.rect('tcliff',xx,20,xx+1,22)
s.rect('terr',42,10,58,22)
for xx in range(42,58):
    if xx not in (49,50): s.rect('tcliff',xx,22,xx+1,24)
s.rect('terr',48,29,58,35)
for xx in range(48,58):
    if xx!=51: s.rect('tcliff',xx,35,xx+1,37)

# ---- 마당·슬래그 땅
s.rect('yard',19,10,43,16)                # 갱구 앞마당
s.rect('yard',21,21,37,32)                # 광석 마당
s.blob('slagg',42,31,6.5,4.5,seed=4,rough=0.2)   # 제련소 둘레 슬래그 땅
s.blob('slagg',25,14,2,1.2,seed=9,rough=0.3)

# ---- 침전 연못 (회청색 물) + 널 다리
s.blob('tail',50,42,7.5,4.6,seed=6,rough=0.16)
s.rect('deck',47,38,49,43)

# ---- 길: 큰길(폭 2) 입구→마당, 갈래
s.line('road',[(28,45),(28,36),(28,22),(28,16)],wid=1,seed=1,wob=0.25)
def rd(pts,w=0,seed=7): s.line('road',pts,wid=w,seed=seed,wob=0.2)
rd([(29,24),(40,24),(49,24),(49,21),(48,15)],w=0,seed=2)      # 동쪽 단 길
rd([(28,22),(18,22),(9,22),(9,19),(9,14)],w=0,seed=3)          # 서쪽 단 길
rd([(30,37),(40,37),(51,37),(51,33)],w=0,seed=4)               # 동남 단·연못 길
rd([(29,27),(36,27),(39,32)],w=0,seed=5)                       # 제련소 길
# ---- 레일
for y in range(11,25): s.K[y,33]=s.kid['railv']
s.K[25,33]=s.kid['railc']
for x in range(34,43): s.K[25,x]=s.kid['railh']

# ---- 집
# 나무집(tim·wod)은 기와 대신 나무 지붕: 널 기와(shingle)·판재(plank)·그을린 널(shdark). 돌집은 그대로.
ROOF={'w3':'plank','e2':'shingle','boss':'shdark','inn':'shingle','d1':'plank','s2':'shingle','hall':'shingle','d2':'plank'}
def mk(st,storeys,nroof,tx,by,seed,name):
    im,nr,Hh=house(st,storeys,nroof,None,'mine',seed,roofmat=ROOF.get(name))
    im=pj.outlined(im)
    cols=storeys[0][0]; di=cols.index('d') if 'd' in cols else len(cols)//2
    s.put(im,tx,by,fw=len(cols),fh=2*len(storeys),name=name,dx=-1,dy=1)
    s.poi_add(name,tx+di,by+1)
    return im
houses={}
# 서쪽 단: 돌집 4채 (덩이)
houses['w1']=mk('sto',[('lwdwr','eave','base')],3,2,13,1,'w1')
houses['w2']=mk('sto',[('lwdr','eave','base')],3,10,14,2,'w2')
houses['w3']=mk('wod',[('ldr','eave','base')],2,4,18,3,'w3')
houses['w4']=mk('sto',[('lwdwr','eave','base')],3,11,19,4,'w4')
# 동쪽 단: 돌집 3채 + 감독관 2층
houses['e1']=mk('sto',[('lwdwr','eave','base')],3,44,14,5,'e1')
houses['e2']=mk('wod',[('ldr','eave','base')],2,52,14,6,'e2')
houses['e3']=mk('sto',[('lwdr','eave','base')],3,45,20,7,'e3')
houses['boss']=mk('tim',[('lwdwr','eave','jetty'),('lwdwr','plain','base')],3,51,20,8,'boss')
# 제련소 + 남쪽
houses['smelt']=mk('sto',[('lwmdnwr','eave','base')],3,38,31,9,'smelt')
houses['inn']=mk('tim',[('lwdwr','eave','jetty'),('lwdwr','plain','base')],3,22,41,10,'inn')
houses['smith']=mk('sto',[('lwdwr','eave','base')],3,32,41,11,'smith')
# 동남 단 숙소 2채
houses['d1']=mk('wod',[('lwdr','eave','base')],3,48,33,12,'d1')
houses['s1']=mk('sto',[('lwdwr','eave','base')],3,17,30,14,'s1')
houses['s2']=mk('wod',[('ldr','eave','base')],2,8,34,15,'s2')
houses['s3']=mk('sto',[('lwdr','eave','base')],3,16,36,16,'s3')
houses['hall']=mk('tim',[('lwmdnwr','eave','jetty'),('lwmdnwr','plain','base')],3,5,42,17,'hall')
houses['d2']=mk('wod',[('lwdr','eave','base')],3,53,33,13,'d2')
for n in houses:
    x,y=s.poi[n]; s.K[y:y+1,x:x+1]=s.kid['road']
for n,pts in {'w1':[(5,14),(5,15),(9,16)],'w2':[(12,15),(12,16),(9,16)],'w3':[(5,19),(5,20),(9,19)],'w4':[(14,20),(14,21),(9,21)] ,
   'e1':[(47,15),(47,17),(48,17)],'e2':[(54,15),(54,17),(48,17)],'e3':[(47,21),(47,22),(49,22)],'boss':[(53,21),(53,22),(49,22)],
   'smelt':[(40,32),(40,33),(36,33),(30,33)],'inn':[(24,42),(24,43),(28,43)],'smith':[(34,42),(34,43),(30,43)],
   's1':[(19,31),(19,32),(24,32),(28,32)],'s2':[(10,35),(10,36),(14,36),(14,38)],'s3':[(18,37),(18,38),(14,38),(14,40),(14,43),(28,43)],'hall':[(8,43),(8,44),(14,44),(14,43)],'d1':[(50,34),(51,34)],'d2':[(55,34),(55,36),(51,36)]}.items(): rd(pts)
# 비탈길(단 남쪽 틈)
for yy in (20,21): s.K[yy,8:10]=s.kid['road']
for yy in (22,23): s.K[yy,49:51]=s.kid['road']
for yy in (35,36): s.K[yy,51]=s.kid['road']

# ================= 소품 =================
from place import Placer, measure, autofill, greedy_fill, export_parts
s.poi_add('adit',33,11); s.poi_add('rail_corner',33,24); s.poi_add('pier',47,41); s.poi_add('headframe',23,14)
BARE=('soil','terr','yard','slagg','rock')
P=Placer(s,seed=27,free_kinds=('soil','terr','yard','slagg','rock'),canopy_kinds=('soil','terr','yard','slagg','rock','cliff','tcliff'))
P.reserve_objs()
P.keep_kinds(['road'],grow=0); P.keep_kinds(['railv','railh','railc','deck'],grow=0); P.keep_kinds(['tail'],grow=1)
P.keep_poi(1)
def sput(img,x,y,fw=1,fh=1,dx=0,dy=0,name=None,layer=0,block=True):
    s.put(img,x,y,fw=fw,fh=fh,name=name,dx=dx,dy=dy,layer=layer,block=block)
    ht=(img.height+15)//16; x0=x+dx//16; x1=x+(dx+img.width-1)//16
    P.occ[max(0,y-ht+1):y+1,max(0,x0):x1+1]=True
    P.count[name]=P.count.get(name,0)+1
def fp(c): return fin(c) if not isinstance(c,Image.Image) else c

# --- 갱구 앞마당: 갱구·승강 탑·광차
sput(adit(),32,10,fw=3,fh=1,name='adit')
sput(headframe(),21,13,fw=3,fh=1,name='headframe')
sput(cart_v(True),33,15,name='cart'); sput(cart_v(False),33,20,name='cart')
sput(cart_h(True),37,25,fw=2,name='cart_h'); sput(rail_buffer(),43,25,name='buffer')
sput(ore_pile(28,18,2),25,15,fw=2,name='ore'); sput(ore_pile(28,18,5),39,14,fw=2,name='ore')
sput(tool_rack(),29,13,fw=2,name='rack')
sput(lamp_post(),31,13,name='lamp'); sput(lamp_post(),35,13,name='lamp')
sput(slag_rock(24,18,3),37,12,name='slagrock',dx=-4)
# --- 광석 마당
sput(ore_bin(),23,25,fw=2,fh=1,name='bin'); sput(ore_pile(28,18,7),25,29,fw=2,name='ore')
sput(ore_pile(28,18,9),31,22,fw=2,name='ore'); sput(tool_rack(),22,22,fw=2,name='rack')
sput(miner_bench(),31,29,fw=2,name='bench'); sput(lamp_post(),27,21,name='lamp'); sput(lamp_post(),34,30,name='lamp')
sput(fp(pi.crates()),35,23,fw=2,name='crates')
# --- 제련소: 가마·굴뚝·슬래그 더미
sput(kiln(),36,30,fw=3,fh=1,name='kiln')
sput(chimney(),45,31,fw=2,fh=1,name='chimney')
def _smoke(s_,im):
    for i,(ox,oy,f) in enumerate([(-6,-44,0),(2,-66,2),(-10,-90,1)]):
        im.alpha_composite(smoke(f,28,44,5+i),(45*16+ox+2,32*16-80+oy+10))
s.over.append(_smoke)
sput(slag_heap(48,34,2),41,36,fw=3,fh=1,name='slagheap')
sput(slag_rock(24,18,5),45,32,name='slagrock'); sput(slag_rock(24,18,6),38,35,name='slagrock',dx=-2)
sput(fp(timber_pile()),37,33,name='pile')
# --- 연못: 홈통, 널다리 끝 등불
sput(sluice(),44,37,fw=3,fh=1,name='sluice'); sput(lamp_post(),49,38,name='lamp')
# --- 마을 집 곁
for (x,y) in [(1,15),(7,17),(14,16),(43,17),(56,17),(44,21),(50,19)]: sput(fp(timber_pile()),x,y,name='pile')
for (x,y) in [(8,13),(13,18),(53,16),(47,19)]: sput(fp(pi.barrel()) if hasattr(pi,'barrel') else fp(pz.fish_barrel()),x,y,name='barrel')
sput(miner_bench(),15,17,fw=2,name='bench'); sput(miner_bench(),55,19,fw=2,name='bench')
sput(lamp_post(),8,18,name='lamp'); sput(lamp_post(),48,16,name='lamp'); sput(lamp_post(),48,22,name='lamp')
# --- 남쪽 입구: 표지·등불·짐
sput(fp(pi.noticeboard()),30,44,fw=2,name='board')
sput(lamp_post(),27,43,name='lamp'); sput(lamp_post(),30,39,name='lamp')
sput(cart_v(True),26,38,name='cart'); sput(fp(pi.crates()),33,44,fw=2,name='crates')
sput(fp(timber_pile()),21,43,name='pile'); sput(fp(pi.barrel()) if hasattr(pi,'barrel') else fp(pz.fish_barrel()),37,43,name='barrel')
sput(fp(pz.bench_park()),24,44,fw=2,name='bench')

# --- 전나무·바위 덩이 (자연 덩이, 일렬 금지)
_NOTREE=(s.kid['yard'],s.kid['slagg'])
def tree(x,y):
    if int(s.K[y,x]) in _NOTREE or int(s.K[max(0,y-1),x]) in _NOTREE: return False
    n=P.r.choice([1,2,2,3,3,4]); return P.tree_add(x,y,n,name='fir')
_RC={}
def rock(x,y):
    if int(s.K[y,x]) in _NOTREE and P.r.random()<0.6: return False
    k=(P.r.randint(1,5),P.r.randint(1,4))
    if k not in _RC: _RC[k]=slag_rock(24,18,k[0]+k[1]*7)
    return P.add(_RC[k],x,y,1,1,dx=-P.r.randint(2,6),dy=0,name='slagrock',check_canopy=True)
def ore(x,y):
    k=P.r.randint(1,9)
    if y<1: return False
    return P.add(ore_pile(28,18,k),x,y,1,1,dx=-P.r.randint(0,8),name='ore',check_canopy=False)
CL=[(6,3,5,2,6),(17,3,6,2,8),(30,3,6,2,7),(42,3,6,2,8),(53,3,5,2,6),
    (3,30,3,7,9),(10,38,4,4,7),(14,26,3,2,4),(2,44,3,2,3),(18,44,3,1.5,3),
    (38,42,3,3,4),(55,26,2.5,3,5),(56,40,2,4,3),(41,18,2,2,3),(18,16,2,2,3),
    (12,30,3,3,5),(46,27,2,2,3),(55,44,2,1.5,2)]
for (cx,cy,rx,ry,n) in CL: P.clump(cx,cy,rx,ry,n,tree,tries=n*12)
for (cx,cy,rx,ry,n) in [(16,33,3,3,3),(6,25,3,2,2),(54,30,2,3,2),(35,35,3,2,3),(43,20,2,2,2),(20,24,2,2,2),(10,42,2,2,2),(40,40,3,3,2)]:
    P.clump(cx,cy,rx,ry,n,rock,tries=n*10)
for (cx,cy,rx,ry,n) in [(20,36,2,2,2),(38,21,2,1,1)]: P.clump(cx,cy,rx,ry,n,ore,tries=n*10)

autofill(P,bare=BARE,fns=[tree,tree,tree,tree,tree,tree,tree,tree,rock],passes=30,per=5,radius=2.6)
greedy_fill(P,[tree,tree,tree,tree,rock],bare=BARE)
w,big=measure(P,bare=BARE)
print('empty max window %.2f at %s'%(w[0],w[1:]),'| patches>4:',big[:12])
s.compose()
export_parts(s,{'soil':'광재 섞인 흙 (새 재료)','road':'자갈길','yard':'재 섞인 마당','slagg':'광재 땅 (슬래그)','terr':'깎은 단 윗면','rock':'산 바위 윗면','cliff':'지층 절벽 앞면','tcliff':'광재 돌 단 절벽','railv':'레일 세로(자갈·침목)','railh':'레일 가로','railc':'레일 모서리(곡선)','tail':'침전 연못 물(회청록)','deck':'널 다리'},skip=())
print(s.save((29,45)))
print(P.count)

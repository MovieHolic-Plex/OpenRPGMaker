# 늪 수상 마을 「갈대말뚝」 — 다시 돌리면 같은 그림. 실행: python3 make_swamp_stilt.py
import sys,os
HERE=os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0,os.path.dirname(HERE))
from vprops import *
import sprops as SP
import dprops as D
import random
W,H=60,46
s=Scene('swamp-stilt',W,H,seed=31)

# ---- 땅 종류
s.kind('water','murk',2,4.4,z=0,walk=False,painter=paint_water('murk',seed=8,lo=2.4,hi=4.3,shore=2,deep=(5,11)),outl=1)
s.kind('mud','mud',3.4,4.9,z=1,sc=6.0,seed=1,dither=0.10)
s.kind('bog','mossy',3.0,4.5,z=1,sc=4.0,seed=2,norim=True,dither=0.12)
s.kind('path','mud',4.4,5.4,z=1,sc=3.5,seed=3,norim=True,dither=0.10)
s.kind('reedbed','reed',3,5,z=1,sc=4.0,seed=4,norim=True,painter=SP.reedbed_painter)
s.kind('deck','deck',3,5,z=1.5,painter=SP.deck_painter,norim=True,sharp=True)
s.kind('pile','deck',1,4,z=1.5,walk=False,painter=SP.pile_painter,norim=True,sharp=True)
s.fill('water')

# 땅: 남쪽 갯벌, 세 섬
s.blob('mud',30,45,33,7.5,seed=3,rough=0.22)
s.blob('mud',10,29,7.5,5.6,seed=5,rough=0.26)        # 서쪽 섬
s.blob('mud',51,30,7.8,7.0,seed=6,rough=0.26)        # 동쪽 섬
s.blob('mud',30,8.5,12.5,4.6,seed=7,rough=0.24)      # 북쪽 이끼 섬
# 이끼 웅덩이·갈대밭(덩이)
for (cx,cy,rx,ry,sd) in [(14,42,4.5,2.2,1),(46,42,4.8,2.2,2),(4,32,2.4,2,3),(56,36,2.4,2.2,4),(22,7,3.6,1.8,5),(40,9,2.8,1.6,6)]:
    s.blob('bog',cx,cy,rx,ry,seed=sd,rough=0.3,only=('mud',))
for (cx,cy,rx,ry,sd) in [(6,44,4,2,1),(54,44,4.6,2.1,2),(21,36,3,1.5,3),(40,36,3,1.4,4),(17,3,4.5,1.6,5),(45,4,4,1.6,6),(58,20,2.5,4,7),(1,22,1.8,3.4,8),(30,13.5,7,1.2,9)]:
    s.blob('reedbed',cx,cy,rx,ry,seed=sd,rough=0.35)
# 갈대는 물에서도 자란다: 호수 가장자리 얕은 갈대 섬
for (cx,cy,rx,ry,sd) in [(24,17,1.8,1.2,1),(44,14,2,1.3,2),(12,19,1.8,1.2,3),(33,36,1.6,1.1,4)]:
    s.blob('reedbed',cx,cy,rx,ry,seed=sd,rough=0.3)

for (cx,cy,rx,ry,sd) in [(6,6,3.2,1.8,11),(11,12,2.4,1.4,12),(3,14,2,1.2,13),(7,40,1.8,1.2,14)]:
    s.blob('reedbed',cx,cy,rx,ry,seed=sd,rough=0.35)
s.blob('mud',8,8,1.6,1.0,seed=21,rough=0.3)
# ---- 널 길(보드워크)·광장
def dk(pts,w=0): s.line('deck',pts,wid=w,seed=5,wob=0.0)
def pd(pts,w=0,seed=9): s.line('path',pts,wid=w,seed=seed,wob=0.2,only=('mud','bog','reedbed'))
s.rect('deck',22,22,41,32)                             # 중앙 광장
dk([(31,37),(31,33)],1)                                 # 남쪽 널 길
dk([(22,27),(14,27)],0)                                 # 서쪽
dk([(40,27),(46,27)],0)                                 # 동쪽
dk([(26,22),(26,12)],0)                                 # 북섬 가는 길(회관 서쪽)
dk([(49,25),(49,12),(56,12)],0)                         # 동북 선착장 길
s.rect('deck',48,9,59,13)                               # 선착장 상판(동북)
# 남쪽 갯벌 오솔길(진흙): 입구에서 널 길 들머리까지
pd([(31,45),(31,38)],1,1)
pd([(31,42),(16,42),(14,40)],0,2); pd([(31,42),(45,42),(47,40)],0,3)

# ---- 집 (이엉 지붕·널벽, 말뚝 위)
# 지붕 재료: 노란 이엉은 소수(3채) — 묵은 회갈색 이엉·그을린 널·널 기와·이끼 낀 널을 섞는다
ROOF={'hall':'shingle','n1':'thatch','n2':'thatchold','w1':'shdark','w2':'thatchold','w3':'moss','e1':'shingle','e2':'thatch',
      'e3':'moss','s1':'shdark','s2':'thatch','shrine':'moss','loom':'plank','pierhut':'shingle'}
def mk(st,storeys,nroof,tx,by,seed,name,land=False):
    im,nr,Hh=house(st,storeys,nroof,None,'swamp',seed,roofmat=ROOF.get(name,'thatch'))
    im=pj.outlined(im)
    cols=storeys[0][0]; w=len(cols); di=cols.index('d') if 'd' in cols else w//2
    fh=2*len(storeys)
    if not land: s.rect('deck',tx-1,by-1,tx+w+1,by+3)   # 베란다 2줄 + 양옆 1칸
    else: s.rect('deck',tx+di-1,by+1,tx+di+2,by+2)
    s.put(im,tx,by,fw=w,fh=fh,name=name,dx=-1,dy=1)
    s.poi_add(name,tx+di,by+1)
    return im,w
E=lambda c,t='eave',b='base':[(c,t,b)]
houses={}
houses['hall']=mk('tim',[('lwmdnwr','eave','jetty'),('lwmdnwr','plain','base')],3,28,19,1,'hall')
houses['n1']=mk('wod',E('lwdwr'),3,17,20,2,'n1')
houses['n2']=mk('tim',E('lwdr'),3,38,19,3,'n2')
houses['w1']=mk('tim',E('lwdwr'),3,5,26,4,'w1')
houses['w2']=mk('wod',E('lwdr'),3,12,33,5,'w2')
houses['w3']=mk('wod',E('ldr'),2,3,38,6,'w3')
houses['e1']=mk('tim',E('lwdwr'),3,46,25,7,'e1')
houses['e2']=mk('wod',E('lwdr'),3,52,33,8,'e2')
houses['e3']=mk('wod',E('ldr'),2,44,36,9,'e3')
houses['s1']=mk('tim',E('lwdwr'),3,19,41,10,'s1',land=True)
houses['s2']=mk('wod',E('lwdr'),3,39,42,11,'s2',land=True)
houses['shrine']=mk('tim',E('lwdr'),3,30,10,12,'shrine',land=True)
houses['loom']=mk('wod',E('lwdwr'),3,19,10,13,'loom',land=True)
houses['pierhut']=mk('wod',E('ldr'),2,52,8,14,'pierhut',land=False)
# 집 앞 연결: 베란다 덱에서 광장·보드워크로
for pts in [[(19,22),(19,27)],[(21,24),(22,24)],[(39,22),(39,24)],[(49,13),(49,21)]]: dk(pts,0)
# 섬 위 연결은 덱이 아니라 다져진 진흙길
for pts in [[(7,30),(7,31),(10,31)],[(14,30),(14,27)],[(5,34),(5,36),(8,36),(8,31)],[(48,29),(48,27)],[(54,37),(54,39),(49,39)],[(46,40),(46,37)],[(54,22),(54,24),(49,24)]]: pd(pts,0,7)
# 섬에서 널 길로 이어지는 덱 (서/동/북 섬)
dk([(14,27),(11,27)],0); dk([(46,27),(49,27)],0)
# 남쪽 갯벌 집 문 앞 덱 + 오솔길
for n,pts in {'s1':[(21,43),(21,42),(31,42)],'s2':[(41,44),(41,43),(31,43)]}.items(): pd(pts,0,4)
# 북섬: 오솔길이 덱과 만나는 곳
pd([(26,11),(26,9),(31,11)],0,5)
pd([(21,12),(21,13),(26,13)],0,6)

# 덱 바로 아래(남쪽) 물 → 말뚝 앞면
d=s.kid['deck']; wt=s.kid['water']; pl=s.kid['pile']
for y in range(H-1):
    for x in range(W):
        if s.K[y,x]==d and s.K[y+1,x]==wt: s.K[y+1,x]=pl
# 집 문은 항상 덱/길 위
for n in list(houses):
    x,y=s.poi[n]
    if s.K[y,x]==wt or s.K[y,x]==pl: s.K[y,x]=d

# ================= 소품 =================
from place import Placer, measure, autofill, greedy_fill, export_parts
s.poi_add('market',31,27); s.poi_add('pier_end',57,12); s.poi_add('altar',32,11); s.poi_add('old_tree',37,9)
BARE=('mud','bog','reedbed','path')
P=Placer(s,seed=41,free_kinds=('mud','bog','reedbed'),canopy_kinds=('mud','bog','reedbed','path','water','pile'))
P.reserve_objs()
P.keep_kinds(['path'],grow=0); P.keep_kinds(['deck'],grow=0); P.keep_poi(1)
def sput(img,x,y,fw=1,fh=1,dx=0,dy=0,name=None,layer=0,block=True):
    s.put(img,x,y,fw=fw,fh=fh,name=name,dx=dx,dy=dy,layer=layer,block=block)
    ht=(img.height+15)//16; x0=x+dx//16; x1=x+(dx+img.width-1)//16
    P.occ[max(0,y-ht+1):y+1,max(0,x0):x1+1]=True
    P.count[name]=P.count.get(name,0)+1
def fp(c): return fin(c) if not isinstance(c,Image.Image) else c
def boat(kind,frame,x,y,dx=0,dy=0,name='boat'):
    im=pboat.boat(kind,frame); fw=(im.width+15)//16; fh=max(1,(im.height+15)//32)
    sput(im,x,y,fw=fw,fh=fh,dx=dx,dy=dy,name=name,block=True)

# --- 광장: 생선 시장
for (x,y,col,gd) in [(24,25,'red',['fish','crab','jug']),(35,25,'blue',['fish','net','bottle'])]:
    gd=[g if g in ('jug','pumpkin','cheese','bottle','meat') else 'meat' for g in gd]
    sput(fp(pz.stall2(3,col,gd)),x,y,fw=3,name='stall')
sput(SP.fish_rack(1),28,30,fw=3,fh=2,name='fish_rack',dx=-4)
sput(SP.fish_rack(2),36,30,fw=3,fh=2,name='fish_rack',dx=-4)
sput(fp(pz.fish_crates()),32,25,fw=2,name='fish_crates')
sput(fp(pz.fish_barrel()),24,30,name='barrel'); sput(fp(pz.fish_barrel()),39,25,name='barrel')
sput(fp(pz.net_rack()),33,28,fw=2,fh=2,name='net_rack')
for (x,y) in [(22,22),(40,22),(22,31),(40,31)]: sput(fp(pz.lamp_crook()),x,y,name='lamp')
sput(fp(pz.bench_park()),27,27,fw=2,name='bench')
# --- 회관·집 곁
sput(fp(pz.lamp_crook()),27,21,name='lamp'); sput(fp(pz.lamp_crook()),35,21,name='lamp')
sput(SP.lantern_buoy(1),16,22,name='lantern'); sput(SP.lantern_buoy(2),42,22,name='lantern')
sput(fp(pz.laundry_line(64,2,10)),6,30,fw=4,name='laundry',block=False,dy=-14)
sput(fp(pz.laundry_line(64,5,12)),53,28,fw=4,name='laundry',block=False,dy=-14)
sput(fp(pi.woodpile()),3,29,fw=2,name='woodpile'); sput(SP.crab_trap(3),16,36,name='crab_trap')
sput(SP.crab_trap(4),48,35,name='crab_trap'); sput(SP.reed_stack(0,4),10,36,fw=1,name='reed_stack')
sput(SP.reed_stack(1,5),57,40,name='reed_stack'); sput(fp(pi.crates()),46,34,fw=2,fh=2,name='crates')
# --- 북섬: 제단·공방 곁
sput(SP.moss_log(1),34,12,fw=2,name='moss_log'); sput(SP.reed_stack(0,6),23,12,name='reed_stack'); sput(SP.reed_stack(1,7),24,12,name='reed_stack')
sput(SP.reed_stack(1,8),17,12,name='reed_stack')
sput(SP.mangrove(0,3),38,9,fw=2,fh=1,dx=-14,name='mangrove')
sput(SP.snag(5),14,9,fw=1,fh=1,dx=-10,name='snag')
# --- 선착장: 배·말뚝·그물
boat('fishing',0,52,16,dx=-16,name='fishing_boat')
boat('rowboat',0,57,15,dx=-8,name='rowboat'); boat('rowboat',1,45,14,name='rowboat')
for (x,y,k) in [(47,15,0),(55,14,1),(59,14,0),(51,18,1)]: sput(SP.pilings(k,x),x,y,name='pilings',dx=-2)
sput(fp(pz.mooring_bollard()),58,12,name='bollard'); sput(fp(pz.mooring_bollard()),48,12,name='bollard')
sput(fp(pz.net_rack()),55,11,fw=2,fh=2,name='net_rack'); sput(fp(pz.fish_crates()),50,11,fw=2,name='fish_crates')
# --- 물 위 말뚝 무리·오리·수련·왜가리: 물을 자연 덩이로
def piling(x,y):
    k=P.r.choice([0,0,1]); return P.add(SP.pilings(k,x+y),x,y,1,1,dx=-(1 if k==0 else 4),name='pilings',check_canopy=False)
for (x,y) in [(18,15),(22,15),(8,21),(3,27),(6,39),(1,36),(25,36),(37,35),(56,25),(57,33),(44,39),(35,16),(41,16),(27,4),(33,4)]:
    if s.K[y,x]==wt: piling(x,y)
for (x,y) in [(15,14),(12,23),(21,17),(40,14),(52,27),(25,33),(40,33)]:
    if s.K[y,x]==wt: sput(SP.duck_pair(x),x,y,name='ducks',dx=-3,block=False)
for (x,y) in [(9,19),(13,17),(23,16),(36,15),(2,25),(26,34),(35,34),(56,18),(45,18),(3,41)]:
    if s.K[y,x]==wt: sput(D.lily_pad(x),x,y,name='lily',block=False,dx=2)
sput(SP.snag(7),7,9,fw=1,fh=1,dx=-10,name='snag')
boat('rowboat',1,4,17,name='rowboat'); boat('rowboat',0,20,16,dx=-4,name='rowboat')
boat('rowboat',0,2,34,name='rowboat'); boat('rowboat',1,25,35,name='rowboat')
for (x,y) in [(4,3),(9,4),(13,7),(1,10),(14,11),(2,19),(8,16),(12,14)]:
    if s.K[y,x]==wt: piling(x,y)
for (x,y) in [(5,12),(10,10),(3,8),(15,9),(9,14),(1,17),(6,20)]:
    if s.K[y,x]==wt: sput(D.lily_pad(x+3),x,y,name='lily',block=False,dx=2)
# 마을 곁 땅 덩이: 갈대·이끼·고목·맹그로브
REED=[D.reed_tuft(k,k+1) for k in (0,1)]
def reed(x,y): return P.add(P.r.choice(REED),x,y,1,1,dx=-P.r.randint(0,2),name='reed',check_canopy=True)
MG=[SP.mangrove(1,11),SP.mangrove(1,12)]
def mg(x,y): im=P.r.choice(MG); return P.add(im,x,y,1,1,dx=-((im.width-16)//2),name='mangrove')
def snag(x,y): return P.add(SP.snag(x),x,y,1,1,dx=-10,name='snag')
def logf(x,y): return P.add(SP.moss_log(x),x,y,2,1,name='moss_log')
for (cx,cy,rx,ry,n) in [(5,44,3.5,1.6,7),(54,44,4,1.8,8),(30,4,5,1.4,5),(17,3,3.5,1.4,6),(45,4,3.5,1.4,6),(58,21,1.6,3.6,6),(1,22,1.4,3,5),(21,36,2.6,1.3,5),(40,36,2.6,1.3,5),(30,13,6,1,7),(24,17,1.6,1,2),(44,14,1.8,1.1,2)]:
    P.clump(cx,cy,rx,ry,n,reed,tries=n*14)
for (cx,cy,rx,ry,n) in [(8,43,4,1.5,2),(51,44,4,1.6,2),(11,25,3,2,1),(54,33,2.5,2,1)]:
    P.clump(cx,cy,rx,ry,n,mg,tries=n*10)
for (cx,cy,rx,ry,n) in [(40,43,2,1,1),(24,45,3,1,1)]: P.clump(cx,cy,rx,ry,n,snag,tries=30)
for (cx,cy) in [(43,44),(36,10),(40,35),(19,44),(15,4),(5,31)]:
    P.clump(cx,cy,2.2,1.6,4,reed,tries=60)
P.clump(43,44,3,1.4,1,logf,tries=30); P.clump(36,10,3,1.2,1,logf,tries=30)
for (x,y,k) in [(35,10,0),(36,8,1),(34,7,0),(37,11,1),(40,11,0),(46,43,1),(47,45,0),(40,34,1),(41,36,0),(15,5,0),(16,3,1),(14,4,1),(17,5,0),(13,25,0),(12,24,1),(14,26,1),(15,25,0),(13,23,1)]:
    if s.K[y,x] in (s.kid['mud'],s.kid['bog'],s.kid['reedbed']) and not P.occ[y,x]:
        sput(REED[k],x,y,name='reed',dx=-1)
autofill(P,bare=('mud','bog','reedbed'),fns=[reed,reed,mg,reed,snag,reed],passes=16,per=3,radius=3.6)
greedy_fill(P,[reed,reed,mg,reed],bare=('mud','bog','reedbed'))
w,big=measure(P,bare=('mud','bog','reedbed'))
print('empty max window %.2f at %s'%(w[0],w[1:]),'| patches>4:',big[:12])
s.compose()
export_parts(s,{'water':'늪물 (탁한 녹색, 물가가 밝은 띠)','mud':'진흙 갯벌','bog':'이끼 웅덩이 (이끼 재료)','path':'다져진 진흙길','reedbed':'갈대밭 바닥 (새로 찍음)','deck':'널판 바닥 (판마다 명도·엇갈린 이음·못)','pile':'널판 앞면+물에 박힌 말뚝 (이끼·물결 고리)'},
  {'hall':'수상 회관 (이엉 지붕 2층)','stall':'생선 좌판','fish_rack':'생선 말림대','pilings':'물 속 말뚝','mangrove':'늪 맹그로브','snag':'마른 고목','reed':'갈대 무더기','moss_log':'이끼 통나무','crab_trap':'게덫','reed_stack':'묶은 갈대 단','lantern':'말뚝 등불','ducks':'오리','lily':'수련 잎','fishing_boat':'낚싯배','rowboat':'나룻배'},
  skip=('lamp','bench','barrel','woodpile','bollard','crates','fish_crates','net_rack','laundry'))
print(s.save((31,45)))
print(P.count)

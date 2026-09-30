# 사막 오아시스 마을 「모래샘」 — 다시 돌리면 같은 그림. 실행: python3 make_desert_oasis.py
import sys,os
HERE=os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0,os.path.dirname(HERE))
from vprops import *
import dprops as D
import random
W,H=60,46
s=Scene('desert-oasis',W,H,seed=23)

# ---- 땅 종류
def flag_painter(s_,k,m,PX,PY):
    """사암 판석 광장: 버들항 자갈 광장과 같은 행 엇갈림, 돌마다 한 단계씩 다른 명도"""
    X=PX.astype(int); Y=PY.astype(int); r=Y//6; xo=X+(r%2)*5; c=xo//10
    jx=(xo%10==0); jy=(Y%6==0)
    base=3.7+(hsh(c,r,41)-0.5)*1.5+(hsh(X,Y,42)-0.5)*0.5
    lit=((xo%10==1)|(Y%6==1))&~jx&~jy
    t=np.where(jx|jy,2.0,np.where(lit,base+0.8,base))
    t=np.clip(np.rint(t),1,6).astype(np.int8)
    return palarr('sstone')[t],t
s.kind('sand','sand',4.0,5.3,z=1,sc=7.0,seed=1,dither=0.08)
s.kind('dune','sand',3.3,4.5,z=1,sc=4.5,seed=2,norim=True,dither=0.1)
s.kind('road','sand',2.9,3.9,z=1,sc=3.5,seed=3,norim=True,dither=0.12)
s.kind('camp','sand',3.1,4.2,z=1,sc=3.0,seed=4,norim=True,dither=0.12)
s.kind('plaza','sstone',3,5,z=1,painter=flag_painter,norim=True)
s.kind('lawn','leaf',3.4,4.8,z=1,sc=4.0,seed=5,norim=True,dither=0.1)
s.kind('water','oasis',2,4,z=0,walk=False,painter=paint_water('oasis',seed=8,lo=2.6,hi=4.6,shore=2,deep=(5,11)),outl=1)
s.kind('plat','sstone',4.4,5.8,z=3,walk=False,sc=6.0,seed=6,sharp=True)
s.kind('cliff','sstone',2,4.6,z=2,walk=False,painter=paint_cliff('sstone',seed=9,lo=2.0,hi=4.4),sharp=True,norim=True)
s.fill('sand')

# 북쪽 메사(고원)+절벽: 4~9칸 마디, 높이는 한 칸씩 오르내림
rnd=random.Random(6); x=0; top=3
while x<W:
    run=rnd.randint(4,9); top=int(np.clip(top+rnd.choice([-1,0,0,1]),3,4))
    for xx in range(x,min(W,x+run)):
        gap=(19<=xx<23) or (46<=xx<50)
        s.rect('plat',xx,0,xx+1,top)
        if not gap: s.rect('cliff',xx,top,xx+1,top+3)
    x+=run
# 바람에 깎인 모래 언덕 자락(길이 아님)
for (cx,cy,rx,ry,sd) in [(6,21,6,3,1),(52,14,7,3.5,2),(44,43,7,2.5,3),(8,44,6,2,4),(56,25,4,3,5)]:
    s.blob('dune',cx,cy,rx,ry,seed=sd,rough=0.3)
# 오아시스: 풀밭 둘레 + 연못
s.blob('lawn',18,21,11.5,8.6,seed=4,rough=0.22)
s.blob('water',18,21,7.6,5.8,seed=3,rough=0.16)
# 광장·캠프
s.rect('plaza',26,22,43,32)
s.blob('camp',53,35,7.6,6.4,seed=6,rough=0.25)

# 길: 큰길(폭 2), 광장 위 사원길, 지선
def rd(pts,w=0,seed=7): s.line('road',pts,wid=w,seed=seed,wob=0.2)
s.line('road',[(32,45),(32,38),(32,32)],wid=1,seed=1,wob=0.25)
s.line('road',[(31,22),(31,19),(31,14)],wid=1,seed=2,wob=0.2)
rd([(43,27),(46,28),(49,31),(50,34)],0,3)           # 동쪽: 캠프
rd([(26,29),(21,30),(14,31),(9,32)],0,4)            # 서쪽: 연못 남쪽 기슭
rd([(26,22),(24,19),(25,15),(24,12)],0,5)           # 북서
rd([(43,22),(45,19),(41,15),(42,12)],0,6)           # 북동
rd([(9,14),(17,14),(24,14)],0,8)                     # 북쪽 집들을 잇는 골목

# ---- 집 (평지붕 사암 집)
def base_house(st,storeys,seed):
    im,nr,Hh=house(st,storeys,0,None,'sand',seed); return im
def mk(st,storeys,tx,by,seed,name,items=(),hut=None,extra=None):
    im=D.flatroof(base_house(st,storeys,seed),seed,items,13,hut)
    if extra: im=extra(im)
    im=pj.outlined(im)
    cols=storeys[0][0]; di=cols.index('d') if 'd' in cols else len(cols)//2
    s.put(im,tx,by,fw=len(cols),fh=2*len(storeys),name=name,dx=-1,dy=1)
    s.poi_add(name,tx+di,by+1)
    return im
def temple_extra(im):
    d=fin(D.dome(48,26,3)); out=Image.new('RGBA',(im.width,im.height+16),(0,0,0,0))
    out.alpha_composite(im,(0,16)); out.alpha_composite(d,(im.width//2-24,0)); return out
houses={}
J2=[('lwmdnwr','eave','jetty'),('lwmdnwr','plain','base')]
Q=lambda c:[(c,'eave','base')]
houses['temple']=mk('sto',Q('lwmdnwr'),28,13,3,'temple',extra=temple_extra)
houses['n1']=mk('sto',Q('lwdwr'),6,11,1,'n1',items=[('pot',10),('cloth',38,'r')])
houses['n2']=mk('tim',Q('lwdr'),13,10,2,'n2',items=[('stack',12)])
houses['n3']=mk('sto',Q('lwdwr'),20,11,4,'n3',items=[('pot',50),('ladder',12)])
houses['n4']=mk('sto',Q('lwdwr'),38,10,5,'n4',items=[('cloth',14,'b'),('pot',58)])
houses['n5']=mk('tim',Q('lwdr'),45,11,6,'n5',items=[('pot',30)])
houses['n6']=mk('sto',Q('lwdwr'),51,10,7,'n6',items=[('stack',48),('pot',14)])
houses['khan']=mk('sto',Q('lwmdnwr'),46,24,8,'khan',items=[('pot',20),('cloth',60,'r')],hut=16)
houses['e2']=mk('sto',Q('lwdwr'),54,20,9,'e2',items=[('pot',12)])
houses['w1']=mk('sto',Q('lwdwr'),2,30,10,'w1',items=[('stack',14),('pot',56)])
houses['w2']=mk('tim',Q('lwdwr'),9,35,11,'w2',items=[('pot',40),('cloth',12,'b')])
houses['w3']=mk('sto',Q('lwdr'),3,40,12,'w3',items=[('pot',14)])
houses['w4']=mk('sto',Q('ldr'),11,41,13,'w4',items=[('stack',10)])
houses['s1']=mk('sto',Q('lwdwr'),21,41,14,'s1',items=[('pot',12),('cloth',50,'r')])
houses['s2']=mk('tim',Q('lwdwr'),38,42,15,'s2',items=[('pot',56)])
houses['s3']=mk('sto',Q('ldr'),25,44,16,'s3',items=[('stack',10)])
for n in houses:
    x,y=s.poi[n]; s.K[y:y+1,x:x+1]=s.kid['road']
for n,pts in {'n1':[(8,12),(8,14),(9,14)],'n2':[(14,11),(14,14),(17,14)],'n3':[(22,12),(22,14),(24,14)],
   'n4':[(40,11),(40,14),(41,15)],'n5':[(46,12),(46,15),(42,15)],'n6':[(53,11),(53,14),(46,15)],
   'khan':[(49,25),(49,28),(49,31)],'e2':[(56,21),(56,24),(50,28)],
   'w1':[(4,31),(4,32),(9,32)],'w2':[(11,36),(11,37),(14,33),(14,31)],'w3':[(5,41),(5,43),(9,43),(9,37)],
   'w4':[(12,42),(12,43),(9,43)],'s1':[(23,42),(23,43),(30,43),(32,43)],'s2':[(40,43),(40,44),(34,44),(32,44)],
   's3':[(26,45),(28,45),(32,45)]}.items(): rd(pts)

# ================= 소품 =================
from place import Placer, measure, autofill, greedy_fill, export_parts
s.poi_add('well',33,29); s.poi_add('camp_fire',53,35); s.poi_add('pond_shore',26,21)
P=Placer(s,seed=31,free_kinds=('sand','dune','lawn','camp'),canopy_kinds=('sand','dune','lawn','camp','water','cliff','plat','road','plaza'))
P.reserve_objs()
P.keep_kinds(['road'],grow=0); P.keep_kinds(['plaza'],grow=0); P.keep_poi(1)
def sput(img,x,y,fw=1,fh=1,dx=0,dy=0,name=None,layer=0,block=True):
    s.put(img,x,y,fw=fw,fh=fh,name=name,dx=dx,dy=dy,layer=layer,block=block)
    ht=(img.height+15)//16; x0=x+dx//16; x1=x+(dx+img.width-1)//16
    P.occ[max(0,y-ht+1):y+1,max(0,x0):x1+1]=True
    P.count[name]=P.count.get(name,0)+1
def fp(c): return fin(c) if not isinstance(c,Image.Image) else c

# --- 광장: 우물·천막 노점·램프·벤치·깔개
sput(D.well(1),32,27,fw=3,fh=2,name='well',dx=-4)
for (x,y,col,gd) in [(27,25,'red',['jug','pumpkin','cheese']),(38,25,'blue',['bottle','jug','meat']),(28,31,'green',['pumpkin','cheese','jug']),(38,31,'red',['meat','bottle','pumpkin'])]:
    sput(fp(pz.stall2(3,col,gd)),x,y,fw=3,name='stall')
sput(fp(pz.lamp_crook()),26,22,name='lamp'); sput(fp(pz.lamp_crook()),42,22,name='lamp'); sput(fp(pz.lamp_crook()),26,31,name='lamp'); sput(fp(pz.lamp_crook()),42,31,name='lamp')
sput(D.rug(0,1),35,29,fw=2,name='rug',block=False); sput(D.rug(1,2),29,28,fw=2,name='rug',block=False)
sput(fp(pz.bench_park()),34,23,fw=2,name='bench')
# --- 사원 앞
sput(fp(pz.lamp_crook()),29,14,name='lamp'); sput(fp(pz.lamp_crook()),34,14,name='lamp')
# --- 오아시스: 야자·갈대·수련·바위
PALM={k:D.palm(k,k+3) for k in (0,1,2)}
def palm(x,y,k=None):
    k=P.r.choice([0,1,0,1,2]) if k is None else k
    return P.add(PALM[k],x,y,1,1,dx=-((PALM[k].width-16)//2),name='palm')
REED=[D.reed_tuft(k,k+1) for k in (0,1)]
def reed(x,y):
    return P.add(P.r.choice(REED),x,y,1,1,dx=-P.r.randint(0,2),name='reed',check_canopy=True)
for (x,y) in [(10,17),(12,14),(17,14),(23,14),(26,18),(9,22),(11,26),(15,28),(22,28),(25,25)]: palm(x,y)
P.clump(18,21,8,6.2,14,reed,tries=200)
for (x,y) in [(15,19),(20,22),(17,23),(21,18)]:
    if s.K[y,x]==s.kid['water']: sput(D.lily_pad(1),x,y,name='lily',block=False,dx=2)
# --- 캠프: 천막·낙타·말뚝·불·짐
sput(D.nomad_tent(48,1,'rugblue','cream'),49,33,fw=3,fh=2,name='tent',dx=0)
sput(D.nomad_tent(48,2,'rugred','cream'),55,32,fw=3,fh=2,name='tent')
sput(D.nomad_tent(48,3,'rugred','cream'),54,40,fw=3,fh=2,name='tent')
sput(flame_layer(fin(bonfire()),0),52,36,fw=1,fh=1,dx=-6,dy=1,name='bonfire')
s.poi['camp_fire']=(52,37)
for (x,y,p) in [(48,37,1),(50,39,0),(57,36,1),(55,42,0)]:
    sput(D.camel(p,x),x,y,fw=3,fh=1,name='camel',dx=-4)
sput(D.hitch_post(3),47,35,fw=3,name='hitch'); sput(D.hitch_post(3),56,38,fw=3,name='hitch')
sput(D.bales(1),51,31,fw=2,name='bales'); sput(D.bales(2),57,34,fw=2,name='bales')
sput(fp(pz.fish_barrel()),59,37,name='barrel')
# --- 서쪽 마당: 화덕·항아리·담
sput(D.clay_oven(1),8,38,fw=2,name='oven'); sput(D.jars(0,1),6,36,fw=2,name='jars'); sput(D.jars(1,2),13,38,fw=2,name='jars')
sput(fp(pi.woodpile()),14,43,name='pile'); sput(D.jars(0,3),17,44,fw=2,name='jars')
# --- 북쪽 집 곁·남쪽 입구
sput(D.jars(1,4),11,12,fw=2,name='jars')
sput(D.bales(3),36,13,fw=2,name='bales'); sput(D.jars(0,5),49,14,fw=2,name='jars')
sput(fp(pz.lamp_crook()),31,41,name='lamp'); sput(fp(pz.lamp_crook()),34,41,name='lamp')
sput(fp(pz.mooring_bollard()),40,40,name='post')

# --- 선인장·덤불·바위·작은 야자 (자연 덩이)
CAC=[D.cactus(k,k+1) for k in (0,1,2)]; SCR=[D.scrub(k,k+1) for k in (0,1)]
ROC=[D.sandrock(r,q) for r,q in [(24,18),(20,14),(28,20)] for _ in (0,)]
def cactus(x,y):
    i=P.r.choice([0,0,1,2]); im=CAC[i]; return P.add(im,x,y,1,1,dx=-((im.width-16)//2),name='cactus')
def scrub(x,y):
    im=SCR[1] if P.r.random()<0.12 else SCR[0]; return P.add(im,x,y,1,1,dx=-P.r.randint(0,6),name='scrub')
def rock(x,y):
    im=P.r.choice(ROC); return P.add(im,x,y,1,1,dx=-P.r.randint(2,6),dy=-P.r.randint(0,3) if y>=2 else 0,name='rock')
def smallpalm(x,y): return palm(x,y,2)
for (cx,cy,rx,ry,n) in [(4,8,4,3,4),(2,18,2.5,4,4),(2,26,2,2,2),(10,4,4,1.5,2),(40,16,5,2.5,5),(56,14,3,3,4),(57,28,2,3,3),(45,44,3,1.5,3),(17,44,2,1.5,2),(3,44,2,1.5,2),(52,44,3,1.5,3),(36,18,2,2,2),(26,8,2,1.5,2)]:
    P.clump(cx,cy,rx,ry,n,cactus,tries=n*12)
for (cx,cy,rx,ry,n) in [(6,6,5,2,3),(33,5,3,1.5,2),(42,9,3,1.5,2),(57,8,3,2,3),(58,42,2,2,3),(36,36,3,2,3),(14,15,2,2,2),(25,38,2,2,2)]:
    P.clump(cx,cy,rx,ry,n,rock,tries=n*10)
for (cx,cy,rx,ry,n) in [(4,14,3,3,4),(22,35,4,2,4),(43,38,3,3,4),(52,17,4,2.5,4),(39,19,2.5,2,3)]:
    P.clump(cx,cy,rx,ry,n,scrub,tries=n*10)

# 메사 바위기둥(틈새에 홀로 선 사암 기둥)
PIL=D.mesa_pillar(1)
for (x,y) in [(21,5),(48,5)]:
    P.add(PIL,x,y,1,1,dx=-7,name='pillar',check_canopy=False)

autofill(P,bare=('sand','dune','lawn','camp'),fns=[cactus,scrub,scrub,rock,smallpalm,cactus,scrub],passes=16,per=3,radius=3.6)
greedy_fill(P,[scrub,scrub,cactus,rock,smallpalm],bare=('sand','dune','lawn','camp'))
w,big=measure(P,bare=('sand','dune','lawn','camp'))
print('empty max window %.2f at %s'%(w[0],w[1:]),'| patches>4:',big[:12])
s.compose()
export_parts(s,{'sand':'모래 바닥 (새 재료, 버들항 잔디와 같은 결·6단)','dune':'모래 언덕 자락 (명암 한 단 어두움)','road':'다져진 모래길','camp':'밟혀 굳은 캠프 바닥','plaza':'사암 판석 광장 (버들항 자갈 광장의 엇갈림 결)','lawn':'오아시스 풀밭','water':'오아시스 물 (청록, 물가가 밝은 띠)','cliff':'사암 메사 절벽 (층리 줄)'},
  {'temple':'돔 사원 (사암 평지붕 집 위에 청록 돔·금 첨탑)','well':'우물','stall':'천막 노점','palm':'야자수','reed':'갈대 무더기','tent':'유목민 줄무늬 천막','camel':'낙타','hitch':'낙타 말뚝','bales':'짐 꾸러미','oven':'흙 화덕','jars':'항아리','wall':'흙벽','cactus':'선인장','scrub':'마른 덤불','rock':'사암 바위','pillar':'메사 기둥','rug':'카펫 깔개','lily':'수련 잎','khan':'대상 숙소(옥상 계단실)'},
  skip=('lamp','bench','barrel','pile','post','hay','bonfire'))
print(s.save((32,45)))
print(P.count)

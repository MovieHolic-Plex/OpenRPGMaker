# 설원 마을 「서리목」 — 다시 돌리면 같은 그림. 실행: python3 make_snowfield.py
import sys,os
HERE=os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0,os.path.dirname(HERE))
from vprops import *
import random
W,H=56,44
s=Scene('snowfield',W,H,seed=11)

# ---- 땅 종류
def deck_painter(s_,k,m,PX,PY):
    t=4.0+(vn(PX,PY,3.0,31)-0.5)*1.4
    seam=(PX.astype(int)%6==0); t=np.where(seam,t-1.6,t)
    edge=(PY.astype(int)%16==0)|(PY.astype(int)%16==15); t=np.where(edge,t-1.2,t)
    t=np.clip(np.rint(t+(hsh(PX,PY,33)-0.5)*0.5),1,6).astype(np.int8)
    return palarr('deck')[t],t
def cobble_painter(s_,k,m,PX,PY):
    X=PX.astype(int); Y=PY.astype(int); r=Y//5; xo=X+(r%2)*4; c=xo//8
    jx=(xo%8==0); jy=(Y%5==0)
    base=3.6+(hsh(c,r,41)-0.5)*1.6+(hsh(X,Y,42)-0.5)*0.5
    lit=((xo%8==1)|(Y%5==1))&~jx&~jy
    t=np.where(jx|jy,2.0,np.where(lit,base+0.8,base))
    t=np.clip(np.rint(t),1,6).astype(np.int8)
    return palarr('cobble')[t],t
s.kind('snow','snow',4.2,5.5,z=1,sc=7.0,seed=1,dither=0.07)
s.kind('frost','frost',3.6,4.8,z=1,sc=4.0,seed=2,norim=True,dither=0.08)
s.kind('road','packed',3.7,4.7,z=1,sc=3.5,seed=3,norim=True,dither=0.12)
s.kind('plaza','cobble',3,5,z=1,painter=cobble_painter,norim=True)
s.kind('ice','ice',3,5,z=0,painter=paint_ice('ice',seed=5,lo=3.2,hi=5.4),outl=2)
s.kind('hot','hotwater',2,4,z=0,walk=False,painter=paint_water('hotwater',seed=8,lo=2.6,hi=4.4,shore=1,deep=(3,6)),outl=1)
s.kind('deck','deck',3,5,z=1.5,painter=deck_painter,sharp=True,norim=True)
s.kind('plat','snow',4.4,5.8,z=3,walk=False,sc=6.0,seed=6,sharp=True)
s.kind('cliff','stone',2,4.6,z=2,walk=False,painter=paint_cliff('stone',seed=9,lo=2.0,hi=4.4),sharp=True,norim=True)
s.fill('snow')

# 북쪽 고원+절벽: 4~9칸 마디로 높이가 한 칸씩 오르내린다(성벽 톱니 금지)
rnd=random.Random(5); x=0; top=4
while x<W:
    run=rnd.randint(4,9); top=int(np.clip(top+rnd.choice([-1,0,0,1]),3,5))
    for xx in range(x,min(W,x+run)):
        gap=(17<=xx<22) or (39<=xx<44)
        s.rect('plat',xx,0,xx+1,top)
        if not gap: s.rect('cliff',xx,top,xx+1,top+3)
    x+=run
cl_bottom=None

# 언 호수
s.blob('ice',51,25,9.5,10,seed=3,rough=0.16)
# 온천 웅덩이
s.blob('hot',11,15,5.6,3.6,seed=8,rough=0.14)
# 부두 널 (y=22..23, x 41..48)  — 호수 위로 뻗음
s.rect('deck',40,22,49,24)

# 길: 큰길(폭 2), 광장, 지선
s.rect('plaza',21,20,35,28)
s.line('road',[(28,43),(28,36),(28,28)],wid=1,seed=1,wob=0.25)
s.line('road',[(35,22),(41,22)],wid=1,seed=2,wob=0.2)
s.line('road',[(21,22),(17,22),(16,17),(14,13),(11,12)],wid=1,seed=3,wob=0.3)
s.line('road',[(28,33),(20,33),(13,36),(9,37)],wid=1,seed=4,wob=0.3)
def rd(pts,w=0,seed=7): s.line('road',pts,wid=w,seed=seed,wob=0.2)

# ---- 집
def mk(st,storeys,nroof,tx,by,seed,name,mat_mode='snow'):
    im,nr,Hh=house(st,storeys,nroof,None,mat_mode,seed)
    im=icicles(im,2,im.width-2,nr*16,seed)
    im=pj.outlined(im)
    cols=storeys[0][0]; di=cols.index('d') if 'd' in cols else len(cols)//2
    s.put(im,tx,by,fw=len(cols),fh=2*len(storeys),name=name,dx=-1,dy=1)
    s.poi_add(name,tx+di,by+1)
    return im
houses={}
houses['hall']=mk('tim',[('lwmdnwr','eave','jetty'),('lwmdnwr','plain','base')],2,24,19,1,'hall')
houses['w1']=mk('sto',[('lwdwr','eave','base')],3,13,26,2,'w1')
houses['w2']=mk('tim',[('lwdwr','eave','base')],3,15,30,3,'w2')
houses['e1']=mk('sto',[('lwdwr','eave','base')],3,36,19,4,'e1')
houses['hut']=mk('wod',[('ldr','eave','base')],2,38,28,5,'hut')
houses['e2']=mk('tim',[('lwdwr','eave','base')],3,37,34,6,'e2')
houses['s1']=mk('sto',[('lwdwr','eave','base')],3,20,40,7,'s1')
houses['s2']=mk('wod',[('ldr','eave','base')],2,32,40,8,'s2')
houses['shed']=mk('wod',[('lwdwr','eave','base')],3,5,38,9,'shed')
houses['bath']=mk('wod',[('lwdr','eave','base')],3,8,11,10,'bath')
houses['w3']=mk('wod',[('ldr','eave','base')],2,4,27,11,'w3')
houses['n2']=mk('sto',[('lwdr','eave','base')],3,44,13,12,'n2')
# 문 앞 짧은 길
for n in houses:
    x,y=s.poi[n]; s.K[y:y+1,x:x+1]=s.kid['road']
for n,pts in {'w1':[(15,27),(15,24),(16,22)],'w2':[(17,31),(20,33)],'e1':[(38,20),(38,22)],'hut':[(39,29),(34,29),(29,29)],
   'e2':[(39,35),(29,35)],'s1':[(22,41),(28,41)],'s2':[(33,41),(29,41)],'shed':[(7,39),(9,37)],'w3':[(5,28),(5,30),(9,37)],
   'n2':[(46,14),(40,14),(38,20)]}.items(): rd(pts)

# ================= 소품 =================
from place import Placer, measure, autofill, greedy_fill, export_parts
s.poi_add('pier_end',49,23); s.poi_add('yard',8,39); s.poi_add('hot_edge',15,17)
P=Placer(s,seed=21,free_kinds=('snow','frost','plat'),canopy_kinds=('snow','frost','cliff','plat','ice'))
P.reserve_objs()
P.keep_kinds(['road'],grow=0); P.keep_kinds(['plaza','deck'],grow=0); P.keep_kinds(['hot'],grow=1)
P.keep_poi(1)
def sput(img,x,y,fw=1,fh=1,dx=0,dy=0,name=None,layer=0,block=True):
    """종류 검사 없이 직접 놓는다(얼음·널 위 물체). 점유 표시는 한다."""
    s.put(img,x,y,fw=fw,fh=fh,name=name,dx=dx,dy=dy,layer=layer,block=block)
    ht=(img.height+15)//16; x0=x+dx//16; x1=x+(dx+img.width-1)//16
    P.occ[max(0,y-ht+1):y+1,max(0,x0):x1+1]=True
    P.count[name]=P.count.get(name,0)+1
def fp(c): return fin(c) if not isinstance(c,Image.Image) else c

# --- 광장 (돌 바닥 x21..34, y20..27)
sput(flame_layer(fin(bonfire()),0),27,25,fw=1,fh=1,dx=-6,dy=1,name='bonfire'); s.poi_add('bonfire',27,26)
sput(fp(pi.noticeboard()),22,23,fw=2,name='board')
sput(fp(pz.fountain_small(0)),31,23,fw=2,name='well')
sput(fp(pz.lamp_crook()),21,27,name='lamp')
sput(fp(pz.lamp_crook()),34,27,name='lamp')
sput(fp(pz.lamp_crook()),34,20,name='lamp')
sput(fp(pz.bench_park()),24,27,fw=2,name='bench')
sput(fp(pz.bench_park()),30,27,fw=2,name='bench')
# --- 부두: 계선주·상자·그물걸이
for x in (42,46): sput(fp(pz.mooring_bollard()),x,21,name='bollard')
sput(fp(pi.crates()),44,21,fw=2,name='crates')
sput(fp(pz.net_rack()),47,21,fw=2,name='netrack')
sput(fp(pz.fish_crates()),45,24,fw=2,name='fishcrates')
# --- 언 호수: 얼어붙은 배, 얼음낚시
sput(snowcap(pboat.boat('fishing',0),3,2),50,31,fw=3,fh=1,name='ice_boat')
sput(snowcap(pboat.boat('rowboat',0),2,3),44,27,fw=2,name='ice_row')
sput(snowcap(pboat.boat('rowboat',0),2,4),53,16,fw=2,name='ice_row')
sput(ice_hole(),49,26,fw=2,name='ice_hole'); sput(stool_rod(),48,26,name='stool')
sput(ice_hole(),54,22,fw=2,name='ice_hole'); sput(stool_rod(),53,22,name='stool')
sput(ice_hole(),46,17,fw=2,name='ice_hole')
# --- 온천: 바위 두르고 김
rr=random.Random(9)
hot=(s.K==s.kid['hot']); ring=ndimage.binary_dilation(hot,iterations=1)&~hot&(s.K==s.kid['snow'])
cand=[(x,y) for y in range(H) for x in range(W) if ring[y,x] and y>=1]
rr.shuffle(cand); placed=[]
for (x,y) in cand:
    if any(abs(x-a)+abs(y-b)<3 for a,b in placed): continue
    if s.blockx[y,x] or P.keep[y,x]&False: continue
    # 길 위에는 얹지 않는다
    if s.kinds[s.K[y,x]].name!='snow': continue
    sput(snowcap(fin(boulder(24,18,rr.randint(1,99))),3,rr.randint(1,9)),x,y,name='rock',dx=-4); placed.append((x,y))
hx,hy=np.where(hot); cx16=int(hx.mean()) if False else int(np.where(hot)[1].mean()); cy16=int(np.where(hot)[0].mean())
def _steam(s_,im,_c=(cx16,cy16)):
    for i,(ox,oy,f) in enumerate([(-24,-30,0),(-2,-34,2),(-40,-22,1),(14,-26,3)]):
        im.alpha_composite(steam(f,24,32,7+i),(_c[0]*16+ox,_c[1]*16+oy))
s.over.append(_steam)
# --- 나무꾼 마당: 장작, 밑동, 썰매
P.keep_rect(4,35,12,42)  # 마당은 나무로 안 채움
for i,(x,y,k) in enumerate([(3,36,0),(3,40,1),(9,40,0),(10,33,1),(7,34,0),(11,37,1)]):
    sput(firewood(k),x,y,fw=2,name='firewood')
sput(sled(),6,41,fw=2,name='sled')
for (x,y) in [(8,41),(12,41)]: sput(fp(pi.woodpile()),x,y,fw=1,name='pile')
for (x,y,k) in [(6,37,1),(9,37,0),(10,39,1),(5,39,0)]: sput(firewood(k),x,y,fw=2,name='firewood')
# --- 집 곁: 장작·눈사람·울타리·통
sput(firewood(0),12,24,fw=2,name='firewood'); sput(firewood(1),33,18,fw=2,name='firewood')
sput(firewood(0),35,26,fw=2,name='firewood'); sput(firewood(1),41,32,fw=2,name='firewood')
sput(snowman(),19,27,name='snowman'); sput(snowman(4),35,31,name='snowman')
sput(snow_fence(3),16,33,fw=3,name='fence'); sput(snow_fence(3),40,26,fw=3,name='fence')
sput(fp(pi.barrel()) if hasattr(pi,'barrel') else fp(pz.fish_barrel()),18,31,name='barrel')
for (x,y) in [(18,41),(30,41),(23,41)]: pass

# --- 나무·바위 덩이 (자연 덩이, 일렬 금지)
def tree(x,y):
    n=P.r.choice([1,2,2,3,3,4]); return P.tree_add(x,y,n)
_RC={}
def rock(x,y):
    k=(P.r.randint(1,5),P.r.randint(1,4))
    if k not in _RC: _RC[k]=snowcap(fin(boulder(24,18,k[0])),3,k[1])
    return P.add(_RC[k],x,y,1,1,dx=-P.r.randint(2,6),dy=-P.r.randint(0,3) if y>=2 else 0,name='rock',check_canopy=True)
def stump(x,y):
    if y<1: return False
    w=P.r.choice([10,12,14,16]); h=P.r.choice([8,10])
    return P.add(snowcap(fin(boulder(w,h,P.r.randint(1,9))),2,P.r.randint(1,9)),x,y,1,1,dx=(16-w)//2+P.r.randint(-1,1),dy=-P.r.randint(0,4),name='mound',check_canopy=False)
CL=[ # (cx,cy,rx,ry,n)
 (4,8,4,3,7),(20,8,6,2.5,9),(34,8,5,2.5,7),(46,8,6,2.5,8),(10,4,5,1.5,3),
 (3,24,2.5,6,7),(8,28,3,2,4),(20,15,3,2,4),(40,14,3,2.5,5),
 (2,42,3,2,3),(15,42,3,1.5,3),(26,41,2,1.5,2),(45,40,4,3,7),(52,38,3,4,6),(38,40,2,1.5,3),
 (50,10,4,2.5,5),(21,13,2,1.5,3),(31,13,2,1.5,3),
]
for (cx,cy,rx,ry,n) in CL: P.clump(cx,cy,rx,ry,n,tree,tries=n*12)
for (cx,cy,rx,ry,n) in [(19,17,3,2,3),(43,36,3,2,3),(10,30,2,2,2),(27,38,3,2,3),(36,15,3,2,2),(13,6,4,1.5,2),(30,6,4,1.5,2)]:
    P.clump(cx,cy,rx,ry,n,rock,tries=n*10)

autofill(P,bare=('snow','frost','plat'),fns=[tree,tree,tree,tree,tree,tree,rock],passes=16,per=3,radius=3.6)
greedy_fill(P,[tree,tree,tree,tree,stump,stump,rock],bare=('snow','frost','plat'))
w,big=measure(P,bare=('snow','frost','plat'))
print('empty max window %.2f at %s'%(w[0],w[1:]),'| patches>4:',big[:12])
s.compose()
export_parts(s,{'snow':'눈 바닥 (새 재료, 버들항 잔디와 같은 결·6단)','frost':'서리 바닥 (눈 그늘)','ice':'얼음 (얼어붙은 항구 연못)','hot':'온천 물','road':'다져진 눈길','cliff':'돌 절벽 (앞면)','plat':'고원 눈','deck':'부두 널','plaza':'광장 포석'},skip=())
print(s.save((28,43)))
print(P.count)

"""성벽 교역 도시의 시장 구역 (64x55) — 결정적 생성기. python3 make_walled_market.py [출력폴더] 를 다시 돌리면 같은 그림이 나온다."""
import sys, os, math
HERE=os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0,os.path.dirname(HERE))
import bdv, bdv_market as M
from bdv import Town, Image
OUT=sys.argv[1] if len(sys.argv)>1 else HERE
W,H=64,55
t=Town(W,H,'성벽 교역 도시의 시장 구역',seed=31)
NEW=dict((n,im) for n,im,_ in M.all_parts())
FL=lambda im: im.transpose(Image.FLIP_LEFT_RIGHT)

def home(name,dx,dy):
    H_=bdv.HOUSE[name]; t.house(name,dx-H_['door'][0],dy-1-H_['door'][1]); return (dx,dy)
def rd(pts,w=1): t.path(pts,'road',w)

# ---------- 성벽: 북 y=9, 남 y=48, 서 x=2, 동 x=61 (한 칸 폭 성벽 위 통로). 성문은 남북 대로 x=31,32 ----------
t.wall=[[False]*W for _ in range(H)]
for x in range(2,62): t.wall[9][x]=True; t.wall[48][x]=True
for y in range(9,49): t.wall[y][2]=True; t.wall[y][61]=True
GX=(31,32)
t.gates=[(x,9) for x in GX]+[(x,48) for x in GX]
for fy in (10,11,49,50):                       # 성벽 앞면 두 줄: 문 자리만 길, 나머지는 막힘
    for x in range(3,61):
        if x in GX: t.road[fy][x]=True
        else: t._block([(x,fy)]); t.cover[fy][x]=True
for y in (9,48):
    for x in GX: t.road[y][x]=True
# 모서리 탑 네 개 + 서·동 성벽 가운데 탑 둘
for X,Y in ((1,10),(60,10),(1,49),(60,49),(1,29),(60,29)):
    t.prop('castle.tower_round',X,Y,block=1)

# ---------- 길 ----------
t.entrances=[(31,0),(31,54)]
rd([(31,0),(31,9)],2); t.blob('gravel',32,7.4,3.2,1.5,wob=0.1,seed=9)                     # 북 성문 밖 진입로
rd([(31,51),(31,54)],2); rd([(31,48),(31,51)],2)        # 남 성문 밖
rd([(31,12),(31,47)],2)                                  # 대로
rd([(4,21),(58,21)],1)                                   # 1열 집 앞 길(여관·대장간·병영 문 앞)
rd([(4,30),(18,30)],1); rd([(46,30),(60,30)],1)          # 서·동 골목 위
rd([(4,39),(18,39)],1); rd([(46,39),(59,39)],1)          # 서·동 골목 아래
rd([(18,30),(18,46)],1); rd([(46,30),(46,46)],1)         # 서·동 옆길
rd([(4,45),(58,45)],1)                                   # 남쪽 마구간·창고·식당 앞 길
t.blob('gravel',32,14.2,5.6,2.4,wob=0.05,seed=2)         # 북문 광장
t.blob('gravel',32,45.6,6.6,2.2,wob=0.05,seed=3)         # 남문 광장
t.blob('plaza',32,29,13,6,wob=0.05,seed=4)               # 시장 광장
t.blob('gravel',26,21.3,4.2,1.3,wob=0.1,seed=5)          # 여관 앞
t.blob('gravel',37,21.3,3.2,1.3,wob=0.1,seed=6)          # 대장간 앞
t.blob('gravel',9,45.5,6,1.6,wob=0.1,seed=7)             # 마구간 마당
t.blob('gravel',42.5,37.3,3.8,1.9,wob=0.08,seed=8)       # 동쪽 곁장터
t.blob('gravel',24.5,37.6,4.6,2.0,wob=0.08,seed=10)      # 서쪽 곁장터

# ---------- 성안 바닥: 다진 흙(자갈) 바탕 + 뒤뜰 잔디 정원 몇 곳 ----------
for y in range(12,48):
    for x in range(3,61):
        if not t.plaza[y][x]: t.gravel[y][x]=True
for cx,cy,rx,ry,sd in ((9,13.6,7.0,1.8,21),(50,13.6,7.5,1.8,22),(21.5,17.4,3.0,1.6,23),(43,17.2,2.6,1.6,24),
                        (8,26.4,4.0,2.0,25),(56,26.2,4.2,1.8,26),(9,35.6,4.0,1.5,27),(54,35.4,4.4,1.6,28),
                        (23,41.6,3.0,1.2,29),(52,42.4,2.6,1.0,30),(4.5,24,1.2,2.2,31),(4.5,34,1.2,2.6,32),(59,34.5,1.2,2.2,33),
                        (21,25.2,1.8,1.3,34),(42,25.4,1.8,1.3,35),(29.5,42.0,1.4,1.0,36)):
    if rx>0: t.blob('gravel',cx,cy,rx,ry,False,wob=0.15,seed=sd)

# ---------- 1열: 북쪽 (문 앞 길 y=21) ----------
T={}
T['inn']=home('inn',26,21)
T['smithy']=home('smithy_town',37,21)
T['barracks']=home('barracks',45,21)
for i,(n,dx) in enumerate((('h103_1',7),('h112_0',13),('h141_0',18),('h109_0',51),('h135_0',57))): T['rowA%d'%i]=home(n,dx,21)
t.img(NEW['toll_booth'],29,15,block=1)
t.img(NEW['banner_red'],30,13,block=1)
t.img(FL(NEW['banner_teal']),33,14,block=1)
t.img(NEW['forge_yard'],40,20,block=1)
t.prop('lamp_double',29,20,block=1); t.prop('lamp_double',34,14,block=1)
t.prop('bench_wood',22,21,block=0)                       # (길 위: 막지 않음, 그림만)

# ---------- 서쪽 구역 ----------
for n,dx,dy in (('h137_0',6,30),('h129_0',11,30),('h127_0',15,30),('h102_2',6,39),('h109_0',11,39),('h141_0',16,39)): T[f'w{n}{dx}{dy}']=home(n,dx,dy)
# ---------- 동쪽 구역 ----------
for n,dx,dy in (('h138_0',50,30),('h117_1',55,30),('h144_0',59,30),('h134_0',50,39),('h113_1',56,39)): T[f'e{n}{dx}{dy}']=home(n,dx,dy)
# ---------- 남쪽 ----------
T['cstable']=home('cstable',5,45); T['estable']=home('estable',11,45)
T['ware']=home('ware0',22,45); T['cafe']=home('cafe',37,45)
T['h_s1']=home('h103_2',43,45); T['h_s2']=home('h101_0',51,45); T['h_s3']=home('h135_0',58,45)
t.img(NEW['hay_bales'],13,44,block=1); t.img(NEW['trough'],8,44,block=1)
t.img(NEW['hitching_rail'],5,47,block=1); t.img(NEW['wagon'],14,47,block=1)
t.img(NEW['sack_pile'],27,44,block=1); t.prop('goods_pile',25,38,block=1); t.prop('crate_apple',28,38,block=1)
t.prop('table_mugs',35,47,block=1); t.prop('parasol_table',39,47,block=1)

# ---------- 시장 광장: 좌판 덩이(두 덩이, 일렬 아님) ----------
t.prop('forum.fountain',31,29,block=2)
t.prop('stall_veg',19,27); t.prop('stall_cheese_meat',23,26); t.img(NEW['cloth_stall'],26,28,block=1)
t.prop('veg_cart',21,31); t.prop('crate_apple',24,31); t.prop('sandwich_board',26,32)
t.prop('stall_jug_bottle',19,34); t.prop('bread_rack',22,34); t.prop('lamp_crook',28,33)
t.prop('stall_herb_flower',35,25); t.prop('stall_veg',39,27); t.img(FL(NEW['cloth_stall']),42,25,block=1)
t.prop('flower_cart',36,31); t.prop('cloth_stand',40,31); t.prop('sword_barrel',38,33); t.prop('fish_crates',43,32)
t.prop('lamp_double',37,34); t.prop('column_monument',45,29)
t.prop('bench_wood',29,31,block=0); t.prop('bench_wood',34,31,block=0)
t.img(NEW['banner_red'],29,24,block=1); t.img(NEW['banner_teal'],34,24,block=1)
t.prop('stall_jug_bottle',41,37); t.prop('crate_apple',44,38); t.prop('lamp_crook',40,39)

# ---------- 성벽 밖: 성문 밖 야영지 + 성 밖 밭 (밭은 걸을 수 있는 칸) ----------
import pi
def fld(kind,X,Y,w,h): t.gimg(pi.field(kind,w,h),X,Y,label='field')
for X,k,w in ((3,'wheat',6),(9,'cabbage',4),(13,'sprout',5),(18,'wheat',6),(24,'cabbage',4)): fld(k,X,0,w,3)
for X,k,w in ((3,'sprout',5),(8,'wheat',7),(15,'cabbage',5),(20,'wheat',6)): fld(k,X,4,w,4)
for X,k,w in ((35,'sprout',5),(40,'wheat',7),(47,'cabbage',4),(51,'wheat',6),(57,'sprout',4)): fld(k,X,0,w,3)
for X,k,w in ((43,'cabbage',5),(48,'wheat',7),(55,'sprout',5)): fld(k,X,4,w,4)
for X,k,w in ((3,'wheat',6),(9,'cabbage',4),(13,'sprout',5),(18,'wheat',6),(24,'cabbage',4)): fld(k,X,52,w,3)
for X,k,w in ((35,'cabbage',4),(39,'wheat',7),(46,'sprout',5),(51,'wheat',6),(57,'cabbage',4)): fld(k,X,52,w,3)
for xs in ((3,29),(34,60)):                       # 밭 사이 농로(걸을 수 있는 길)
    rd([(xs[0],3),(xs[1],3)]); rd([(xs[0],8),(xs[1],8)]); rd([(xs[0],51),(xs[1],51)])
t.blob('gravel',38.5,6.0,3.6,1.5,wob=0.1,seed=11)
t.img(NEW['wagon'],37,6,block=1); t.img(NEW['hay_bales'],41,6,block=1); t.img(NEW['hay_bales'],26,6,block=1)
t.img(NEW['banner_red'],29,8,block=1); t.img(NEW['banner_teal'],34,8,block=1)
t.img(NEW['banner_red'],29,52,block=1); t.img(FL(NEW['banner_teal']),34,52,block=1)
t.img(NEW['trough'],35,51,block=1)
for kind,X,Y in (('oak',28,7),('bush',26,7),('cypress',29,5),('oak',42,7),('bush',33,6),('cypress',1,4),('cypress',0,7),('bush',2,1),('bush',62,3),('cypress',63,6),('cypress',62,8),
                 ('bush',27,53),('oak',28,54),('bush',34,53),('cypress',1,53),('bush',62,53),('cypress',63,51),('cypress',0,52)):
    t.tree(kind,X,Y)

# ---------- 목표 지점 ----------
t.targets.update({'광장':(30,26),'북문 광장':(32,14),'남문 광장':(32,46),'동쪽 곁장터':(43,36),'서쪽 골목':(6,30),'동쪽 골목':(58,30)})

def _reg():
    for n,im,note in M.all_parts(): t.part(n,im,note,-(-im.width//16)*-(-im.height//16))
_reg()
t.fill_patches(target=4,kinds=('bush','canopy','oak','bush','cypress'),maxn=500)
if __name__=='__main__':
    im=t.render()
    r=t.reach()
    print('reach',{k:[n for n,v in d.items() if not v] for k,d in r.items()})
    print(t.empty_report())
    t.save(OUT)

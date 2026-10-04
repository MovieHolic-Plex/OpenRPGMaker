"""강가 물레방아 마을 (56x44) — 결정적 생성기. python3 make_riverside_mill.py [출력폴더] 를 다시 돌리면 같은 그림이 나온다."""
import sys, os, math
HERE=os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0,os.path.dirname(HERE))
import bdv, bdv_market as M, bdv_mill as MM
from bdv import Town, Image
OUT=sys.argv[1] if len(sys.argv)>1 else HERE
W,H=56,44
t=Town(W,H,'강가 물레방아 마을',seed=41)
NEW=dict((n,im) for n,im,_ in M.all_parts()); NEW.update(dict((n,im) for n,im,_ in MM.all_parts()))
FL=lambda im: im.transpose(Image.FLIP_LEFT_RIGHT)
def home(name,dx,dy):
    H_=bdv.HOUSE[name]; t.house(name,dx-H_['door'][0],dy-1-H_['door'][1]); return (dx,dy)
def rd(pts,w=1): t.path(pts,'road',w)
def wat(x0,y0,x1,y1,flow):
    for y in range(y0,y1+1):
        for x in range(x0,x1+1): t.water[y][x]=True; t.natural[y][x]=True; t.flow[y][x]=flow

# ---------- 강: 북쪽 지류(남으로) + 동서 구간(서로, 물레방아 앞) + 남쪽 본류(남으로) ----------
for y in range(0,13):
    j=0 if 1<=y<=6 else (1 if y in (7,8,10) else 0)
    wat(42+j,y,45+j,y,'S')
for y in range(9,13):
    for x in range(27,46): t.water[y][x]=True; t.natural[y][x]=True; t.flow[y][x]='W'
for y in range(9,44):
    j=0 if 23<=y<=29 else (1 if y%5 in (0,1) else 0)
    for x in range(27+j,31+j): t.water[y][x]=True; t.natural[y][x]=True; t.flow[y][x]='S'

# ---------- 길 ----------
t.entrances=[(0,24),(55,24)]
rd([(0,24),(55,24)],2)                                   # 큰길(돌다리로 강을 건넌다)
t.bridges.append((27,24,4))
for x in range(27,31): t.force[(x,25)]='bridge'; t.force[(x,24)]='bridge'
rd([(3,15),(21,15)],2)                                   # 서쪽 윗길
rd([(22,8),(22,23)],2)                                   # 방앗간 길 -> 광장
rd([(2,8),(31,8)],1)                                     # 밭두렁 겸 방앗간 길
rd([(26,1),(26,8)],1); rd([(26,1),(38,1)],1); rd([(38,1),(38,3)],1); rd([(38,3),(41,3)],1)   # 방앗간 뒷길 -> 섶다리
rd([(42,3),(53,3)],2)                                    # 섶다리 건너 동쪽 밭길(rows 3..4)
rd([(49,5),(49,23)],2)                                   # 동쪽 골목
rd([(6,26),(6,33)],2); rd([(40,26),(40,33)],2)           # 남쪽 골목
rd([(2,33),(25,33)],2); rd([(32,33),(54,33)],2)          # 남쪽 윗길
rd([(0,35),(26,35)],1); rd([(32,35),(55,35)],1)          # 남쪽 밭두렁
for y in (23,26):                                        # 큰길 가장자리 자갈 (집 앞·뒤)
    for x in list(range(2,27))+list(range(31,55)): t.gravel[y][x]=True
t.blob('gravel',22.5,24.5,4.6,3.0,wob=0.1,seed=3)        # 마을 광장
t.blob('gravel',30.5,8.0,4.6,1.2,wob=0.1,seed=4)         # 방앗간 마당
t.force.update({(x,y):'walk' for x in range(42,46) for y in (3,4)})
t.gimg(NEW['plank_footbridge'],42,2,dx=-8)               # 섶다리(북 지류 위)

# ---------- 물방앗간 ----------
T={}
T['방앗간']=home('h109_0',32,8)
t.prop('lamp_crook',27,8,block=1) if False else None
t.img(NEW['waterwheel'],35,10,block=4,dy=8)
t.img(NEW['sluice_gate'],39,9,block=1)
t.img(NEW['millstones'],33,8,block=1)
t.img(NEW['flour_cart'],27,7,block=1)
t.img(NEW['sack_pile'],36,5,block=1); t.img(NEW['haystack'],39,7,block=1)

# ---------- 서쪽 마을 ----------
for n,dx in (('h103_1',4),('h112_0',10),('h141_0',15)): T['wA'+n]=home(n,dx,23)
for n,dx in (('h123_0',4),('h113_0',9),('h135_0',16)): T['wB'+n]=home(n,dx,15)
for n,dx in (('h123_1',4),('h101_1',11),('h113_0',18),('h141_0',23)): T['wC'+n+str(dx)]=home(n,dx,33)
t.prop('well_roofed',22,23,block=1); t.prop('bench_wood',19,26,block=0); t.prop('bench_wood',26,26,block=0)
t.prop('stall_veg',19,22,block=1); t.prop('crate_apple',21,22,block=1)
t.prop('lamp_crook',20,24,block=1); t.prop('lamp_crook',24,26,block=1)
t.img(NEW['laundry_line'],24,30,block=1)
t.prop('mooring_bollard',26,34,block=1); t.boats.append(('rowboat',28,34))

# ---------- 동쪽 마을 ----------
for n,dx in (('h135_0',35),('h112_0',41),('h103_1',46),('h141_0',53)): T['eA'+n+str(dx)]=home(n,dx,23)
T['창고']=home('ware0',36,33)
for n,dx in (('h113_0',44),('h141_0',52)): T['eC'+n+str(dx)]=home(n,dx,33)
t.img(NEW['hay_bales'],32,32,block=1); t.img(NEW['sack_pile'],39,33,block=1) if False else None
t.prop('crate_cabbage',33,33,block=1); t.prop('lamp_crook',48,26,block=1)

# ---------- 밭 (걸을 수 있는 칸) ----------
import pi
def fld(kind,X,Y,w,h): t.gimg(pi.field(kind,w,h),X,Y,label='field')
for X,k,w in ((0,'wheat',6),(6,'cabbage',4),(10,'wheat',7),(17,'sprout',5)): fld(k,X,0,w,4)
for X,k,w in ((0,'sprout',5),(5,'wheat',6),(11,'cabbage',4),(15,'wheat',7)): fld(k,X,4,w,4)
fld('wheat',46,0,10,3); fld('cabbage',46,5,3,8); fld('wheat',51,5,5,8)
fld('wheat',41,13,7,2)
t.tree('oak',34,15); t.tree('bush',36,14); t.tree('canopy',38,15); t.tree('bush',33,14)
t.img(NEW['haystack'],44,15,block=1)
for X,k,w,h in ((0,'wheat',9,3),(9,'cabbage',5,5),(14,'wheat',7,3),(21,'sprout',5,5)): fld(k,X,36,w,h)
for X,k,w,h in ((0,'sprout',6,3),(6,'wheat',3,3),(14,'cabbage',6,3),(20,'wheat',1,3)): fld(k,X,41,w,h)
for X,k,w,h in ((31,'wheat',6,5),(37,'sprout',4,3),(41,'wheat',8,4),(49,'cabbage',6,5)): fld(k,X,36,w,h)
for X,k,w,h in ((31,'sprout',5,3),(45,'wheat',4,3),(37,'cabbage',3,3)): fld(k,X,41 if X!=31 else 41,w,h)
t.img(NEW['scarecrow'],10,4,block=1); t.img(NEW['scarecrow'],52,10,block=1)
t.img(NEW['wheat_stooks_a'],3,7,block=1); t.img(NEW['wheat_stooks_b'],18,3,block=1)
t.img(NEW['wheat_stooks_a'],13,39,block=1); t.img(NEW['wheat_stooks_b'],44,43,block=1)
t.reedcells+=[(27,31),(30,40),(28,38),(31,12),(38,12),(43,12)]

# ---------- 목표 ----------
t.targets.update({'광장':(22,26),'큰돌다리 서':(26,24),'큰돌다리 동':(31,24),'섶다리 서':(41,3),'섶다리 동':(46,3),'북서 밭길':(4,8),'남서 밭두렁':(6,35),'남동 밭두렁':(45,35),'북동 밭':(50,3)})

def _reg():
    for n,im,note in MM.all_parts(): t.part(n,im,note,-(-im.width//16)*-(-im.height//16))
_reg()
t.fill_patches(target=4,kinds=('bush','canopy','oak','bush'),maxn=500)
if __name__=='__main__':
    im=t.render()
    r=t.reach()
    print('reach',{k:[n for n,v in d.items() if not v] for k,d in r.items()})
    print(t.empty_report())
    t.save(OUT)

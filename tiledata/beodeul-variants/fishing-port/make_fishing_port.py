"""어촌 포구 마을 (52x36) — 결정적 생성기. python3 make_fishing_port.py [출력폴더] 를 다시 돌리면 같은 그림이 나온다."""
import sys, os, math, random
HERE=os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0,os.path.dirname(HERE))
import bdv, bdv_parts as P
from bdv import Town, Image
OUT=sys.argv[1] if len(sys.argv)>1 else HERE
W,H=52,32
t=Town(W,H,'어촌 포구 마을',seed=11)

# ---------- 바다·해안: 아래 45% 가 바다, 동쪽으로 곶이 나간다 ----------
def shore(x):
    if x>=44: return 29-(1 if x>=50 else 0)
    if x>=41: return 24+(x-41)*2
    return 21+round(1.6*math.sin(x*0.33)+1.0*math.sin(x*0.11+1.0))+(2 if x<7 else 0)
SH=[shore(x) for x in range(W)]
for x in range(W):
    for y in range(SH[x],H): t.water[y][x]=True; t.natural[y][x]=True

# ---------- 길 ----------
t.entrances=[(0,13)]
t.path([(0,13),(8,13),(12,15),(16,17),(20,18)],'road',2)       # 서쪽 입구 -> 시장 광장
t.path([(31,17),(37,16),(42,19),(45,25)],'road',2)             # 광장 -> 등대 길목
t.path([(11,13),(11,6),(12,6)],'road',1)
t.path([(2,9),(2,13)],'road',1)                              # 북쪽 골목
t.path([(24,12),(24,14)],'road',1)
t.path([(37,16),(37,13)],'road',1)                             # 밭집 가는 길
t.blob('plaza',26,17.5,8.6,3.2,wob=0.05,seed=3)                # 생선 시장 마당
t.blob('gravel',9.5,19.5,4.6,2.6,wob=0.12,seed=5)              # 그물 말리는 자갈밭
t.blob('gravel',46.5,26,2.6,2.2,wob=0.1,seed=6)                # 등대 발치

# ---------- 잔교 ----------
JX=28; JY0=SH[JX]-1; HY=27          # 머리 윗면 27~28행, 앞면(16px)이 29행
t.gimg(P.jetty(2,HY-JY0,False,seed=2),JX,JY0)
t.gimg(P.jetty(10,2,True,seed=4),JX-5,HY)
for yy in range(JY0,HY+1):
    for xx in (JX,JX+1): t.force[(xx,yy)]='walk'
for xx in range(JX-5,JX+5): t.force[(xx,HY)]='walk'; t.force[(xx,HY+1)]='walk'; t.force[(xx,HY+2)]='water'
for xx in (JX-5,JX-1,JX+3,JX+4):
    t.img(P.jetty_post(),xx,HY+1,block=0,dy=-2)

def home(name,dx_,dy_):
    H_=bdv.HOUSE[name]; t.house(name,dx_-H_['door'][0],dy_-1-H_['door'][1]); return (dx_,dy_)
homes=[]
homes.append(home('h144_0',5,12))       # 입구 옆 작은 집
homes.append(home('i9',10,12))
homes.append(home('h112_0',15,18))
homes.append(home('h103_2',12,6))       # 북쪽 골목 끝
homes.append(home('h127_0',16,10))
homes.append(home('h135_0',24,14))      # 광장 북쪽
homes.append(home('h116_1',30,14))
homes.append(home('h103_1',33,8))       # 밭 가는 길 주변
homes.append(home('h109_0',44,14))
homes.append(home('h113_1',37,13))
homes.append(home('h101_2',19,6))
homes.append(home('h141_0',48,15))
homes.append(home('h119_0',41,21))


# ---------- 생선 시장 (광장 남쪽, 잔교 바로 위) ----------
t.img(P.fish_market(),21,20,block=2)
t.targets['생선 시장']=(24,18)
t.prop('crate_fish',31,19,block=1)
t.prop('fish_barrel',30,21,block=1)
t.prop('fish_crates',22,21,block=1)
t.prop('sandwich_board',20,20,block=1)
t.prop('mooring_bollard',JX-1,SH[JX]-1,block=1)
t.prop('mooring_bollard',JX+2,SH[JX]-1,block=1)
t.targets['잔교 끝']=(JX,HY+1)
# 서쪽 작은 부두: 어선 정박용 (기둥 셋)
J2=10; J2Y=SH[J2]-1
t.gimg(P.jetty(1,25-J2Y,True,seed=7),J2,J2Y)
for yy in range(J2Y,25): t.force[(J2,yy)]='walk'
t.force[(J2,25)]='water'
t.img(P.jetty_post(),J2-1,25,block=0,dy=-2); t.img(P.jetty_post(),J2+1,25,block=0,dy=-2)
t.targets['서쪽 부두']=(J2,24)

# ---------- 그물 말리는 곳 ----------
t.img(P.drying_rack(0),6,19,block=1)
t.img(P.drying_rack(1),10,18,block=1)
t.img(P.drying_rack(0),12,22,block=1)
t.prop('net_rack',8,22,block=1)
t.img(P.upturned_boat(),4,22,block=1)
t.img(P.lobster_pots(),14,20,block=1)
t.targets['그물 말리는 곳']=(9,20)

# ---------- 등대 ----------
t.img(P.lighthouse(),46,27,block=2)
t.targets['등대 문']=(47,28)

# ---------- 배 ----------
t.boats=[('fishing',13,27),('fishing',36,26),('rowboat',19,25),('rowboat',7,28),('rowboat',34,30),('fishing',3,27),('fishing',18,28),('fishing',40,25)]

# ---------- 밭·소품 ----------
t.prop('field1',36,7 if False else 6,block=0)
t.prop('field2',42,7,block=0)
t.prop('laundry_rack',13,11,block=1)
t.prop('well_roofed',20,14,block=1)
t.prop('door_pots',9,14,block=0)

# ---------- 나무·관목 (덩이) ----------
def clump(kind,pts):
    for x,y in pts: t.tree(kind,x,y)
clump('oak',[(2,3),(5,2),(9,3),(1,7),(13,3),(17,2)])
clump('canopy',[(22,3),(26,2),(30,4),(24,7),(28,9)])
clump('oak',[(34,3),(38,2),(42,4),(46,3),(49,6),(46,10)])
clump('big',[(50,11),(21,10),(1,19),(46,2)])
clump('cypress',[(43,23),(44,26),(50,24),(49,27)])
clump('bush',[(1,14),(2,20),(21,1),(19,9),(48,12),(47,18),(42,10),(3,9),(7,15),(14,7),(18,13),(27,11),(33,13),(39,15),(47,15),(35,21),(31,8)])

# ---------- 새 조각 등록 (parts/) ----------
def _reg():
    for n,im,note in (('jetty_stem',P.jetty(2,10,False,seed=2),'잔교 몸통 널판 2x10 (윗면)'),
                      ('jetty_head',P.jetty(10,2,True,seed=4),'잔교 T자 머리 10x2 (윗면+앞면)'),
                      ('jetty_west',P.jetty(1,8,True,seed=7),'서쪽 작은 부두 1x8'),
                      ('jetty_post',P.jetty_post(),'잔교 말뚝'),
                      ('lighthouse',P.lighthouse(),'등대 (흰·붉은 띠, 램프방)'),
                      ('fish_market',P.fish_market(),'생선 시장 차양 좌판'),
                      ('drying_rack_a',P.drying_rack(0),'그물 말림대 (2칸)'),
                      ('drying_rack_b',P.drying_rack(1),'그물 말림대 (3칸)'),
                      ('upturned_boat',P.upturned_boat(),'엎어 둔 배'),
                      ('lobster_pots',P.lobster_pots(),'통발 더미')):
        t.part(n,im,note,-(-im.width//16)*-(-im.height//16))
_reg()
t.fill_patches(target=4)
if __name__=='__main__':
    im=t.render()
    print('reach',t.reach())
    print(t.empty_report())
    t.save(OUT)

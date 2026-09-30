"""언덕 포도원 마을 (56x48) — 결정적 생성기. python3 make_vineyard.py [출력폴더] 를 다시 돌리면 같은 그림이 나온다."""
import sys, os, math
HERE=os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0,os.path.dirname(HERE))
import bdv, bdv_vine as V
from bdv import Town, Image, terrain
OUT=sys.argv[1] if len(sys.argv)>1 else HERE
W,H=56,54
t=Town(W,H,'언덕 포도원 마을',seed=23)

# ---------- 단(높이) 3개: 0 골짜기 마을 / 1 포도 단 / 2 언덕 위 신전 ----------
SX=26                                     # 계단 시작 칸(폭 3): 두 계단 모두 같은 열
def wob(x,a,ph): return round(a*math.sin(x*0.27+ph))
def b2(x):                                # 언덕 위 단 아래 경계(이 행부터 벼랑 앞면)
    if x<17 or x>38: return 0
    return 12 if SX<=x<SX+3 else 12+wob(x,0.9,0.4)
def b1(x):
    return 27 if SX<=x<SX+3 else 27+round(1.2*math.sin(x*0.22+1.9))
for x in range(W):
    for y in range(H):
        t.E[y][x]=2 if y<b2(x) else 1 if y<b1(x) else 0
t.stairs=[(SX,12,3),(SX,27,3)]
F=terrain.faces(t.E)
for y in range(H):
    for x in range(W): t.mas[y][x]=False

# ---------- 길 ----------
t.entrances=[(27,53)]
t.path([(27,53),(27,48),(28,44),(28,30)],'road',2)             # 남문 -> 광장 -> 아래 계단
t.path([(27,26),(27,18),(27,13)],'road',2)                      # 포도 단 -> 위 계단
t.path([(27,18),(16,18),(16,25),(13,25)],'road',1)              # 서쪽 농가 길
t.path([(29,18),(44,18),(44,25),(49,25)],'road',1)              # 동쪽 농가 길
t.path([(33,25),(28,25)],'road',1)                              # 창고 문 앞 길
t.path([(27,46),(20,46),(16,47),(15,51)],'road',1)              # 골짜기 서쪽 골목
t.path([(29,48),(36,48),(40,46),(40,40)],'road',1)              # 골짜기 동쪽 골목
t.path([(15,47),(12,43),(12,39)],'road',1)                      # 서쪽 밭길
t.path([(40,42),(46,40),(50,38)],'road',1)                      # 동쪽 밭길
t.path([(27,12),(27,10)],'road',1)
t.blob('plaza',28,43.4,7.4,2.9,wob=0.06,seed=3)                 # 광장(우물·좌판)
t.blob('forum',27.5,10.6,5.6,1.6,wob=0.06,seed=5)               # 신전 앞마당(대리석 바닥)
t.blob('gravel',33.5,21.0,4.8,1.9,wob=0.1,seed=6)               # 창고 앞 자갈 마당

# ---------- 포도밭(칸 마스크, 모서리·윗변을 조금씩 깎아 자연스럽게) ----------
def orgrect(x0,y0,x1,y1,seed):
    c=set()
    for x in range(x0,x1+1):
        top=y0+(1 if math.sin(x*1.3+seed)>0.55 else 0)
        bot=y1-(1 if math.sin(x*0.9+seed*2)>0.6 else 0)
        for y in range(top,bot+1): c.add((x,y))
    for (cx,cy,dx,dy) in ((x0,y0,1,1),(x1,y0,-1,1),(x0,y1,1,-1),(x1,y1,-1,-1)):
        c.discard((cx,cy))
        if seed%2: c.discard((cx+dx,cy))
    return c
def vine(cells,seed):
    xs=[c[0] for c in cells]; ys=[c[1] for c in cells]; X0,Y0=min(xs),min(ys)
    m=[[ (X0+i,Y0+j) in cells for i in range(max(xs)-X0+1)] for j in range(max(ys)-Y0+1)]
    im=V.vine_field(m,seed=seed); t.gimg(im,X0,Y0)
    t._block(cells); return im
vine(orgrect(1,2,13,8,2),2)
vine(orgrect(1,10,13,16,3),4)
vine(orgrect(1,19,9,25,5),12)
vine(orgrect(18,20,24,25,7),6)
vine(orgrect(41,1,54,8,8),7)
vine(orgrect(41,10,54,16,9),8)
vine(orgrect(52,19,54,25,4),13)
vine(orgrect(2,33,9,40,10),9)
vine(orgrect(46,34,54,42,11),10)
vine(orgrect(44,44,54,51,6),14)
vine(orgrect(1,42,9,49,7),15)
vine(orgrect(39,27,40,28,1),11) if False else None

# ---------- 신전 (언덕 위) ----------
TX,TY=24,9
t.img(V.temple_stone(),TX,TY,block=0)
t._block([(TX+i,TY-j) for i in range(7) for j in range(1,7)]+[(TX+i,TY) for i in (0,1,5,6)])
t.targets['신전 계단']=(TX+3,TY+1)
t.prop('column_monument',20,11,block=1)
t.prop('statue_sage',33,11,block=1)
t.prop('bench_wood',18,11,block=1); t.prop('bench_wood',35,11,block=1)
t.prop('lamp_crook',22,10,block=1); t.prop('lamp_crook',32,10,block=1)
t.prop('flowerbed',20,9,block=1)
t.prop('planter_round',34,9,block=1)

# ---------- 포도주 창고와 부속 (포도 단) ----------
WX,WY=30,24
t.img(V.winery(),WX,WY,block=0)
t._block([(WX+i,WY-j) for i in range(8) for j in range(3) if not (i in (3,4) and j==0)])
t.doors['포도주 창고']=(WX+3,WY+1)
t.targets['포도주 창고']=(WX+3,WY+1)
t.img(V.wine_press(),40,21,block=1); t.targets['압착기']=(40,22)
t.img(V.cask_rack(),34,20,block=1)
t.img(V.pergola(3),SX,21,block=0)                              # 길 위 포도 그늘 시렁
t.img(V.pergola(3),SX,16,block=0)
t.img(V.grape_baskets(),30,21,block=1)
t.img(V.barrels_standing(),39,25,block=1)

# ---------- 집 ----------
def home(name,dx_,dy_):
    H_=bdv.HOUSE[name]; t.house(name,dx_-H_['door'][0],dy_-1-H_['door'][1]); return (dx_,dy_)
home('h145_0',13,25)                                            # 서쪽 농가
home('h134_0',49,25)                                            # 동쪽 농가
home('inn',21,44)                                               # 광장 서쪽 주막
home('h103_2',33,44)                                            # 광장 동쪽 집
home('h144_0',15,52)
home('h112_0',21,52)
home('h127_0',34,53)
home('i13',39,50)
home('h123_0',40,39)
home('h141_0',35,37)
home('h107_0',21,36)
home('h101_2',12,39)

# ---------- 광장 소품 ----------
t.prop('forum.fountain',26,44,block=1)
t.prop('stall_jug_bottle',31,46,block=1)
t.prop('stall_veg',22,47,block=1)
t.prop('stall_herb_flower',35,46,block=1)
t.prop('crate_apple',24,47,block=1)
t.prop('well_roofed',30,40,block=1)
t.prop('door_pots',20,43,block=0)
t.prop('laundry_rack',17,50,block=1)
t.prop('goods_pile',37,51,block=1)

# ---------- 올리브 나무 ----------
def olive(v,X,Y):
    im=V.olive(v).copy(); im._tree=True
    px=X*16+8-im.width//2; py=(Y+1)*16-im.height
    t.objs.append((im,px,py,True)); t._cov(px,py,im.width,im.height); t._block([(X,Y)])
for v,x,y in [(0,12,3),(1,14,6),(2,11,9),(0,13,12),(1,10,15),(2,15,10),(0,19,17),(1,22,16),(2,20,15),(0,23,18),
              (0,19,4),(1,21,7),(2,36,4),(0,36,8),(1,20,2),(2,43,19),(0,52,18),(1,52,27),(0,46,31),
              (1,44,47),(2,47,49),(0,3,44),(1,6,46)]:
    olive(v,x,y)
def clump(kind,pts):
    for x,y in pts: t.tree(kind,x,y)
clump('cypress',[(18,2),(19,8),(22,5),(33,3),(37,6),(37,10),(17,11),(38,11)])
clump('bush',[(14,1),(17,22),(37,14),(12,30),(45,26),(10,22),(15,3)])
clump('oak',[(3,30),(1,27),(52,48),(48,52),(4,50),(9,51)])
clump('canopy',[(4,46),(7,48),(50,46),(53,44),(1,52)])

# ---------- 새 조각 등록 ----------
def _reg():
    m=[[True]*6+[False]*2 for _ in range(4)]; m[0][5]=False
    for n,im,note in (('vine_field',V.vine_field(m),'포도밭 이랑 오토타일 (칸 마스크 → 6x4 예시)'),
                      ('olive_a',V.olive(0),'올리브 나무 A'),('olive_b',V.olive(1),'올리브 나무 B'),('olive_c',V.olive(2),'올리브 나무 C'),
                      ('temple_stone',V.temple_stone(),'언덕 위 신전 (기둥과 같은 대리석 지붕·밝은 윗면)'),
                      ('winery',V.winery(),'포도주 창고 (돌벽·붉은 기와·아치 겹문)'),
                      ('barrels_standing',V.barrels_standing(),'서 있는 술통 셋'),
                      ('cask_rack',V.cask_rack(),'시렁 위 누인 술통'),
                      ('wine_press',V.wine_press(),'포도 압착기'),
                      ('pergola',V.pergola(3),'포도 덩굴 그늘 시렁 (3칸)'),
                      ('grape_baskets',V.grape_baskets(),'포도 수확 바구니')):
        t.part(n,im,note,-(-im.width//16)*-(-im.height//16))
_reg()
t.fill_patches(target=4,kinds=('bush','canopy','oak','bush','cypress'),maxn=500)
if __name__=='__main__':
    im=t.render()
    print('reach',t.reach())
    print(t.empty_report())
    t.save(OUT)

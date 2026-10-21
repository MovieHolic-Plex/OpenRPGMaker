# 『폴른 스타』 떨어진 별의 관 — 그을린 구덩이에 동서로 누운, 양 끝이 좁아지는 관 모양 은빛 배(오프닝 crash 컷). 48x32(3x2칸).
# 3/4 탑뷰: 납작한 뚜껑 윗면(관 모양 유리창·뚜껑 테두리·금 간 이음매의 희미한 빛) + 남쪽 앞면(10행, 깨진 판 이음매).
# 은빛 6단 램프 하나 + 물든 윤곽 한 색 + 유리 3단 + 흙 그을음. 코드 손 도트, 생성 그림 없음.
# 실행: python3 scripts/content/fallen-star-vessel-draw.py → /tmp/vessel/vessel.png (fallenStarVessel.ts 에 base64 로 넣는다)
import os
from PIL import Image
W,H=48,32
im=Image.new('RGBA',(W,H),(0,0,0,0)); px=im.load()
R=[(44,58,64),(70,86,92),(98,114,120),(128,142,148),(158,170,174),(196,206,208)]  # 은빛 램프 0(어둠)~5(빛)
OUT=(30,44,50,255)
GL=[(64,110,120),(106,160,168),(168,212,216)]
GLOW=(150,214,218)
SOOT=(34,30,26); DIRT=(58,46,36)
def poly_x(y,pts):
    xs=[]
    for i in range(len(pts)):
        (x1,y1),(x2,y2)=pts[i],pts[(i+1)%len(pts)]
        if (y1<=y<y2) or (y2<=y<y1): xs.append(x1+(y-y1)*(x2-x1)/(y2-y1))
    return sorted(xs)
def region(pts):
    out=set()
    for y in range(H):
        xs=poly_x(y+0.5,pts)
        for i in range(0,len(xs)-1,2):
            for x in range(W):
                if xs[i]<=x+0.5<xs[i+1]: out.add((x,y))
    return out
def put(p,c):
    if 0<=p[0]<W and 0<=p[1]<H: px[p]=c+(255,) if len(c)==3 else c
# 뚜껑: 머리 쪽(서) 어깨가 넓고 발 쪽(동)으로 좁아지는 길쭉한 육각(관).
LIDP=[(2.5,8),(12.5,2),(41.5,4),(46.5,9),(41.5,14),(12.5,16),(2.5,10)]
DEP=10
lid=region(LIDP)
body=set((x,y+d) for (x,y) in lid for d in range(DEP+1) if y+d<H)
side=body-lid
# 그림자(땅에 닿는 앞면 아래·동쪽, 앞면 높이부터)
for (x,y) in body:
    for (dx,dy) in [(1,1),(2,1),(1,2)]:
        q=(x+dx,y+dy)
        if q not in body and q[0]<W and q[1]<H and q[1]>=12 and px[q][3]==0: px[q]=(12,10,8,120)
# 앞면: 윗입술 빛 → 아래로 어두워지는 램프
for (x,y) in side:
    col=[yy for (xx,yy) in side if xx==x]; u=y-min(col); t=max(col)-y
    k=4 if u==0 else 3 if u<=2 else 2 if t>=4 else 1 if t>=1 else 0
    if x<6 and 0<u: k=min(5,k+1)          # 서쪽 모서리 빛
    put((x,y),R[k])
# 결: 앞면은 세로로 긁힌 금속 결(램프 한 단 위아래, 짧은 줄), 발 쪽(동)은 불에 그을린 따뜻한 어둠.
def h(x,y,s=0): return ((x*73856093)^(y*19349663)^(s*83492791))&0xffff
SCORCH=[(54,46,40),(78,66,58),(104,92,84)]
for (x,y) in side:
    col=[yy for (xx,yy) in side if xx==x]; u=y-min(col)
    if u==0: continue
    if h(x,0,1)%5==0 and h(x,y,2)%3!=0:
        cur=px[x,y][:3]; k=min(range(6),key=lambda i:sum(abs(a-b) for a,b in zip(R[i],cur)))
        put((x,y),R[max(0,min(5,k+(1 if h(x,y,3)%2 else -1)))])
    if x>=38 and h(x,y,4)%3!=0:
        cur=px[x,y][:3]; k=min(range(6),key=lambda i:sum(abs(a-b) for a,b in zip(R[i],cur)))
        put((x,y),SCORCH[min(2,max(0,k-1))])
# 앞면 판 이음매(하나는 충격에 끊김)
for sx,broken in [(15,False),(27,True),(37,False)]:
    for (x,y) in side:
        if x==sx and y-min(yy for (xx,yy) in side if xx==x)>=2:
            if broken and y%5 in (0,1): continue
            put((x,y),R[0])
# 뚜껑: 위쪽이 밝고 아래로 한 단씩, 단 경계 디더
for (x,y) in lid:
    k=4 if y<6 else 3 if y<12 else 2
    pass
    if x>39: k=max(1,k-1)
    put((x,y),R[k])
for (x,y) in lid:
    if (x-1,y) not in lid or (x,y-1) not in lid: put((x,y),R[5])
    elif (x,y+1) not in lid or (x+1,y) not in lid: put((x,y),R[2])
# 뚜껑 결: 가로로 쓸린 짧은 줄(한 단 위아래) + 발 쪽 그을음.
for (x,y) in lid:
    if (x-1,y) not in lid or (x,y-1) not in lid or (x,y+1) not in lid: continue
    cur=px[x,y][:3]; k=min(range(6),key=lambda i:sum(abs(a-b) for a,b in zip(R[i],cur)))
    if h(x//3,y,5)%4==0: put((x,y),R[max(0,min(5,k+(1 if h(x//3,y,6)%2 else -1)))])
    if x>=39 and h(x,y,7)%2==0: put((x,y),SCORCH[2] if k>=3 else SCORCH[1])
# 뚜껑 테두리 턱(관 모양을 따라 2칸 안쪽, 중간 톤)
inner=region([(5.5,8.5),(13,4.5),(40.5,6),(43.5,9),(40.5,12.5),(13,14),(5.5,10)])
for (x,y) in inner:
    if any(n not in inner for n in [(x-1,y),(x+1,y),(x,y-1),(x,y+1)]): put((x,y),R[2])
# 머리 쪽 관 모양 유리창(작게), 유리 3단 + 반짝 2칸
win=region([(7.5,8),(10.5,6),(15.5,6),(17.5,8.5),(15.5,11),(10.5,11),(7.5,9.5)])
for (x,y) in win: put((x,y),GL[1] if y<9 else GL[0])
for (x,y) in win:
    if any(n not in win for n in [(x-1,y),(x+1,y),(x,y-1),(x,y+1)]): put((x,y),R[1])
for p in [(10,7),(11,7)]: put(p,GL[2])
# 금 간 이음매 — 발 쪽으로 비스듬히 갈라진 틈에 희미한 빛(채도 낮은 하늘빛)
crack=[(24,7),(25,8),(26,8),(27,9),(28,10),(29,10),(30,11)]
for p in crack: put(p,R[0])
for p in [(26,7),(28,9),(30,10)]: put(p,GLOW)
# 테두리 리벳(4칸마다 빛 점 + 아래 그늘)
for (x,y) in sorted(inner):
    if any(n not in inner for n in [(x,y-1)]) and x%5==0 and 6<x<41: put((x,y-1),R[5]); put((x,y),R[1])
# 찌그러진 자국 둘(어둠+빛 짝)
for (a,b) in [((33,12),(34,11)),((20,10),(21,9))]: put(a,R[1]); put(b,R[5])
# 긁힘·그을음(듬성듬성)
for p in [(20,5),(21,5),(33,6),(35,12),(19,13),(37,8)]: put(p,R[1])
for p in [(43,10),(42,12),(5,10),(44,19),(40,22),(9,23),(31,24),(22,21)]: put(p,SOOT)
for p in [(18,20),(19,20),(33,19),(10,19)]: put(p,R[4])
# 윤곽(물든 한 색)
for y in range(H):
    for x in range(W):
        if (x,y) in body: continue
        if any(n in body for n in [(x-1,y),(x+1,y),(x,y-1),(x,y+1)]): put((x,y),OUT)
# 바닥에 박힌 흙 입술 — 앞면 밑줄 한 칸 아래 그을린 흙
bottom={}
for (x,y) in body: bottom[x]=max(bottom.get(x,0),y)
for x,y in bottom.items():
    for q in [(x,y+2),(x-1,y+2) if x%3==0 else None]:
        if q and q[1]<H: put(q,DIRT if x%2 else SOOT)
bb=im.getbbox(); out=Image.new('RGBA',(W,H),(0,0,0,0)); out.paste(im.crop((0,0,W,bb[3])),(0,H-bb[3]))
os.makedirs('/tmp/vessel',exist_ok=True); out.save('/tmp/vessel/vessel.png')
print('colors',len(set(c for c in out.get_flattened_data() if c[3]==255)))

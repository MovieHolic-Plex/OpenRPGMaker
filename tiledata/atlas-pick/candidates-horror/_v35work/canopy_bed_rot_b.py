import sys; sys.path.insert(0,'_v35work')
from mk import *
W,H=32,48
M=[['.']*W for _ in range(H)]; T=[['.']*W for _ in range(H)]
def px(x,y,m,t):
    if 0<=x<W and 0<=y<H: M[y][x]=m; T[y][x]=str(t)
def hl(x0,x1,y,m,t):
    for x in range(x0,x1+1): px(x,y,m,t)
def rect(x0,x1,y0,y1,m,t):
    for y in range(y0,y1+1): hl(x0,x1,y,m,t)
# --- 안쪽 어둠 (천개 아래)
rect(6,25,14,27,'d',0)
# --- 머리판 (뒤): 윗가로대 밝게, 패널 어둡게
hl(6,25,17,'d',4); hl(6,25,18,'d',3)
rect(6,25,19,27,'d',2)
rect(9,22,20,26,'d',1)
hl(9,22,20,'d',0); 
for x in (11,14,17,20): rect(x,x,21,26,'d',2)
px(6,19,'d',3);px(6,20,'d',3)
# --- 요 윗면 (28~37)
rect(6,25,28,37,'s',5)
# 베개 둘
for x0,x1 in ((7,14),(17,24)):
    rect(x0,x1,28,31,'b',5); hl(x0,x1,28,'b',6); hl(x0,x1,31,'b',3)
    px(x0,29,'b',6);px(x1,29,'b',3);px(x1,30,'b',3)
hl(9,12,30,'b',4); hl(19,22,30,'b',4)
# 시트 주름과 음영
hl(6,25,32,'s',6); hl(6,25,33,'s',5)
hl(6,7,33,'s',6)
rect(23,25,33,37,'s',4)
hl(6,25,37,'s',3)
# 마른 핏자국
for (x0,x1,y) in ((12,17,34),(11,18,35),(12,16,36),(14,15,33),(13,13,37)):
    hl(x0,x1,y,'v',4)
hl(13,15,35,'v',3); hl(14,15,36,'v',2)
# 접혀 걸린 헝겊(먼지빛)
hl(6,11,36,'c',3); hl(6,9,37,'c',2)
# 곰팡이 얼룩 (요 모서리)
px(24,34,'c',2);px(25,35,'c',2);px(24,36,'c',1)
# --- 발판 (푸트보드) 앞면
hl(6,25,38,'d',6)
rect(6,25,39,45,'d',4)
rect(8,23,40,44,'d',3)
hl(8,23,40,'d',2)
hl(8,23,44,'d',5)
for x in (8,23): rect(x,x,40,44,'d',2)
rect(6,25,46,46,'d',1)
hl(6,25,39,'d',5)
rect(6,7,39,46,'d',5); rect(24,25,39,46,'d',2)
# --- 기둥 (앞 두 개, 전체 높이)
for y in range(13,48):
    px(4,y,'d',5 if y<40 else 4); px(5,y,'d',3)
    px(26,y,'d',3); px(27,y,'d',1)
px(4,47,'d',2);px(5,47,'d',1);px(26,47,'d',1);px(27,47,'d',0)
# 뒷기둥 윗부분 (안쪽으로 살짝 보이는 선)
for y in range(15,28): px(6,y,'d',4) if y<17 else None
# --- 늘어진 찢어진 천: 왼쪽/오른쪽/가운데 (밝은 골, 어두운 주름)
def drape(xl,ys_w,dirn,tones):
    for k,(w) in enumerate(ys_w):
        y=15+k
        for i in range(w):
            x=xl+dirn*i
            px(x,y,'v',tones[min(i,len(tones)-1)] - (1 if k%5==4 else 0))
drape(6,[3]*10+[3,3,2,3,2,2,2,3,2,1,2,1,1,2,1,1,0,1,0,1],1,(5,4,3))
drape(25,[3]*7+[3,2,3,3,2,2,2,2,1,2,1,1,2,1,0,1,1],-1,(3,2,1))
drape(12,[2,2,2,2,2,2,2,2,2,1,2,1,1,1,1,0,1,1],1,(4,3))
drape(19,[2,2,2,2,2,1,2,1,1,1],1,(3,2))
# --- 천개 앞 처마 (늘어진 천 치맛단) : 찢긴 톱니
for x in range(6,26):
    d=(4,5,3,6,5,3,4,7,5,3,3,6,4,3,5,6,3,5,3,4)[x-6]
    for y in range(15,15+d):
        px(x,y,'v',4 if y<17 else 3)
    px(x,15+d-1,'v',2)
# --- 천개 앞 가로대(틀)
hl(3,28,13,'d',5); hl(3,28,14,'d',3)
px(3,13,'d',6); px(28,14,'d',1)
# --- 천개 윗면 (0~12), x 3..28, 왼쪽 위 빛
for y in range(0,13):
    for x in range(3,29):
        t=5-((x-3)*3//26)-(y*2//12)
        px(x,y,'v',max(1,t))
hl(3,28,0,'v',2); hl(3,28,1,'v',4)
for y in range(1,13): px(3,y,'v',5)
for y in range(1,13): px(28,y,'v',1)
# 뼈대선과 접힌 주름
for y in range(2,12): px(16,y,'v',2 if y%3 else 3)
for x in range(4,28): px(x,6,'v',max(1,int(T[6][x])-1))
# 찢긴 구멍 (천 밑 나무 뼈대)
for (x,y) in ((8,3),(9,3),(9,4),(8,4),(10,4),(20,8),(21,8),(21,9),(22,9),(20,9)):
    px(x,y,'d',1)
# 거미줄: 먼지색 성긴 선
for i in range(6): px(4+i,1+i,'c',4 if i<4 else 3)
for i in range(4): px(27-i,1+i,'c',3)
px(6,8,'c',3);px(7,9,'c',2);px(25,10,'c',3)
Ms=[''.join(r) for r in M]; Ts=[''.join(r) for r in T]
write('canopy_bed_rot',W,H,{'d':'mahog','v':'velv','s':'sheet','b':'bisque','c':'dust'},Ms,Ts,name='32x48 F35 T13',tag='v35-B')

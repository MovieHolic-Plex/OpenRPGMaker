import sys; sys.path.insert(0,'_v35work')
from mk import *
W,H=16,16
M=[['.']*W for _ in range(H)]; T=[['.']*W for _ in range(H)]
def px(x,y,m,t): M[y][x]=m; T[y][x]=str(t)
def hl(x0,x1,y,m,t):
    for x in range(x0,x1+1): px(x,y,m,t)
# 몸통 x4..11 (8칸), 바퀴는 양옆 4칸
# 등받이 손잡이 + 윗대 (뒤)
px(4,0,'b',5); px(11,0,'b',3)
hl(4,11,1,'b',5)
# 등받이 천 (앞면이 아니라 뒤에서 세운 판): 어둡게, 가운데 주름
for y,t in ((2,3),(3,2),(4,2),(5,1)):
    hl(4,11,y,'c',t)
    px(7,y,'c',t+1); px(8,y,'c',t-1 if t>1 else 0)
# 앉는 판 윗면 (밝게 3줄) + 팔걸이 윗
hl(4,11,6,'c',6); hl(4,11,7,'c',5); hl(4,11,8,'c',4)
px(4,6,'b',6);px(11,6,'b',4);px(4,7,'b',5);px(11,7,'b',3);px(4,8,'b',4);px(11,8,'b',2)
# 앞 가장자리 (앞면 낮은 띠) + 다리 받침 살
hl(4,11,9,'c',2); hl(5,10,10,'c',1)
px(4,9,'b',3);px(11,9,'b',1)
# 발판 두 개 (앞)
hl(4,6,12,'b',5); hl(9,11,12,'b',3)
hl(4,6,13,'b',3); hl(9,11,13,'b',1)
px(5,11,'b',3);px(10,11,'b',2)
# 앞 작은 바퀴
px(5,14,'b',2);px(10,14,'b',1)
# 큰 바퀴: 옆에서 본 4x11 타원 테, 속은 어둡게, 축 녹슨 점
def wheel(x0,rim,inner):
    shape={2:(1,2),3:(0,3),4:(0,3),5:(0,3),6:(0,3),7:(0,3),8:(0,3),9:(0,3),10:(0,3),11:(0,3),12:(1,2)}
    for y,(a,b) in shape.items():
        for x in range(a,b+1):
            edge = x in (a,b) or y in (2,12)
            px(x0+x,y+1 if False else y,'b',rim[0] if edge else inner)
    # 안쪽 채움: 테두리 두께 1, 속은 x1..x2
    for y in range(3,12):
        px(x0+1,y,'b',inner); px(x0+2,y,'b',inner)
    px(x0+1,7,'a',4);px(x0+2,7,'a',3)
    for y in range(3,12):
        px(x0,y,'b',rim[1]); px(x0+3,y,'b',rim[2])
    px(x0+1,2,'b',rim[0]); px(x0+2,2,'b',rim[1]); px(x0+1,12,'b',rim[1]); px(x0+2,12,'b',rim[2])
    # 손 테(안쪽 얇은 링)
    px(x0+ (3 if x0==0 else 0),5,'b',6); 
wheel(0,(6,5,3),1); wheel(12,(4,3,1),0)
# 바퀴 속을 비워 테로 읽히게 (축 점 유지)
for x0 in (0,12):
    for y in list(range(4,7))+list(range(8,11)):
        for x in (x0+1,x0+2):
            M[y][x]='.'; T[y][x]='.'

# 몸통과 바퀴 사이 축
px(3,7,'b',3); px(12,7,'b',2)
M=[''.join(r) for r in M]; T=[''.join(r) for r in T]
write('wheelchair',W,H,{'a':'rust','b':'tin','c':'ward'},M,T,name='16x16 F12 T4',tag='v35-B')

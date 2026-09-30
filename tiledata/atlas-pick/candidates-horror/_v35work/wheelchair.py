import sys; sys.path.insert(0,'_v35work')
from mk import *
W,H=16,32
M=[['.']*W for _ in range(H)]; T=[['.']*W for _ in range(H)]
def px(x,y,m,t): M[y][x]=m; T[y][x]=t
def rect(x0,y0,x1,y1,m,t):
    for y in range(y0,y1+1):
        for x in range(x0,x1+1): px(x,y,m,t)
def hl(x0,x1,y,m,t):
    for x in range(x0,x1+1): px(x,y,m,t)
y0=7   # T 10줄 + F 14줄 ; 폭 14 (바퀴 2 + 팔걸이 1 + 좌석 8 + 팔걸이 1 + 바퀴 2)
f=y0+10
# 등받이 뒤 모서리 선 + 윗판
hl(3,12,y0,'b','1')
hl(3,12,y0+1,'b','6'); hl(4,11,y0+1,'b','5')
# 등받이 앞면 (ward 천, 왼쪽 밝고 오른쪽 어둡게)
for y,t in ((y0+2,'3'),(y0+3,'2')):
    hl(4,11,y,'c',t); px(3,y,'b','4'); px(12,y,'b','2')
# 좌석 윗면 5줄 (뒤 모서리 선 → 밝은 단 → 앞 모서리 하이라이트)
for i,y in enumerate(range(y0+4,y0+9)):
    hl(4,11,y,'c','1' if i==0 else ('6' if i<4 else '5'))
    px(3,y,'b','6'); px(12,y,'b','4')
hl(4,11,y0+9,'c','6'); px(3,y0+9,'b','5'); px(12,y0+9,'b','3')
# 바퀴 (양옆 세로판) — 등받이 높이(y0+2)부터 바닥 가까이
for x,(hi,mid,lo) in ((1,('5','4','1')),(2,('6','5','2')),(13,('4','3','1')),(14,('2','1','0'))):
    pass
for y in range(y0+3,f+11):
    px(1,y,'b','1'); px(2,y,'b','5' if y<f+4 else '4')
    px(13,y,'b','3'); px(14,y,'b','1')
px(2,f+5,'a','4'); px(13,f+5,'a','3')            # 축
for y in range(y0+4,y0+9): px(3,y,'b',M[y][3] and T[y][3])
# 좌석 앞면 3줄
for i,t in enumerate('321'): hl(4,11,f+i,'c',t); px(3,f+i,'b','4'); px(12,f+i,'b','2')
# 팔걸이 기둥·가름대
for y in range(f+3,f+8): px(3,y,'b','3'); px(12,y,'b','2')
hl(4,11,f+3,'b','0')
rect(7,f+4,8,f+8,'b','3'); px(7,f+4,'b','4')
hl(4,11,f+9,'b','4'); hl(4,11,f+10,'b','2')
# 앞 캐스터
rect(4,f+11,5,f+12,'b','1'); rect(10,f+11,11,f+12,'b','1')
px(4,f+11,'b','3'); px(10,f+11,'b','3')
px(1,f+11,'b','0'); px(2,f+11,'b','0'); px(13,f+11,'b','0'); px(14,f+11,'b','0')
M=[''.join(r) for r in M]; T=[''.join(r) for r in T]
S=['.'*W for _ in range(H)]
S[f+13]='....~~~~~~~~....'
write('wheelchair',W,H,{'a':'rust','b':'tin','c':'ward'},M,T,shadow=S,name='16x32 F14 T10')

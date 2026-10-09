import sys; sys.path.insert(0,'.')
from w10lib import *
S='firewood_rack_2w'
L={'0':'wood:0','1':'wood:1','2':'wood:2','3':'wood:3','4':'wood:4','5':'wood:5','6':'wood:6','7':'wood:7',
   'x':'dwood:1','y':'dwood:2','z':'dwood:3',
   'B':'wood:2','p':'pine:6','q':'pine:5','m':'pine:4','r':'pine:3','n':'pine:2','k':'wood:3','h':'pine:6'}
LOG=[".BBBB.",
     "BpppqB",
     "BpmrqB",
     "BqrmrB",
     "BqrrnB",
     ".BBBB."]
LOG2=[".BBBB.",
      "BmmrrB",
      "BmrrnB",
      "BrnrnB",
      "BrnnnB",
      ".BBBB."]
def log(cv,x,y,dark=False,lo=0,hi=32,ylo=0,yhi=32):
    g=LOG2 if dark else LOG
    for j,r in enumerate(g):
        for i,c in enumerate(r):
            if c=='.': continue
            X,Y=x+i,y+j
            if lo<=X<hi and ylo<=Y<yhi: cv.put(X,Y,c)
def frame(cv,dark_right=False):
    # 뒤판
    cv.rect(3,6,26,24,'x')
    # 기둥 (앞면)
    for y in range(2,32):
        cv.put(0,y,'1'); cv.put(1,y,'6'); cv.put(2,y,'4')
        cv.put(29,y,'5'); cv.put(30,y,'3'); cv.put(31,y,'1')
    # 윗보
    cv.hline(0,2,32,'1'); cv.hline(1,3,30,'7'); cv.hline(1,4,30,'6'); cv.hline(1,5,30,'4'); 
    cv.hline(0,3,1,'1'); cv.hline(31,3,1,'1'); cv.hline(0,4,1,'1');cv.hline(31,4,1,'1')
    cv.hline(1,6,28,'y'); 
    # 밑받침
    cv.hline(0,30,32,'4'); cv.hline(0,31,32,'1'); cv.hline(1,30,3,'6')
    cv.put(4,3,'7');
frame_=None
def pile(cv,dark=False):
    ys=[7,12,17,22]
    for r,y in enumerate(ys):
        xs=[3,9,15,21] if r%2==0 else [0,6,12,18,24]
        if r%2==0: xs=[4,10,16,22]
        else: xs=[1,7,13,19,25]
        for x in xs:
            d = dark and (r==0 or x>=13)
            log(cv,x,y,d,lo=3,hi=29,ylo=7,yhi=30)

# ---- A ----
cv=Cv(32,32); frame(cv); pile(cv)
# 옹이 하이라이트 & 윗보 아래 그림자 줄
cv.hline(3,6,26,'y')
for x in range(3,29): 
    if cv.g[7][x]!='.' and cv.g[7][x] in 'BpqmrPn': pass
emit(S,'w10-A',L,cv.rows(),32,32); check(f'{CAND}/{S}/w10-A.pxg')

# ---- B ----
cv=Cv(32,32); frame(cv); pile(cv,dark=True)
# 윗보 그림자: 첫 줄 통나무 위에 어두운 띠
for x in range(3,29):
    if cv.g[7][x] in 'pqm': cv.put(x,7,'m')
# 기둥 명암 강화
for y in range(6,30):
    cv.put(2,y,'6' if y%7 else '4'); cv.put(29,y,'2')
    cv.put(3,y,'z') if cv.g[y][3]=='x' else None
    cv.put(28,y,'y') if cv.g[y][28]=='x' else None
cv.hline(1,29,30,'2'); cv.hline(1,30,30,'4')
emit(S,'w10-B',L,cv.rows(),32,32); check(f'{CAND}/{S}/w10-B.pxg')

# ---- C: 피라미드로 쌓은 더미 + 양옆 말뚝 ----
cv=Cv(32,32)
# 깔개(침목)
cv.hline(0,29,32,'6'); cv.hline(0,30,32,'4'); cv.hline(0,31,32,'1')
cv.hline(1,29,3,'7'); cv.hline(28,29,3,'5')
# 말뚝
for xs,cols in (((0,1,2),'146'),((29,30,31),'531')):
    cols=('1','6','4') if xs[0]==0 else ('5','3','1')
    for y in range(11,29):
        for i,x in enumerate(xs): cv.put(x,y,cols[i])
    cv.put(xs[1],10,cols[1]); 
    cv.hline(xs[0],11,3,'1') if False else None
cv.rect(3,9,26,20,'.')
# 피라미드
rows=[(23,[4,10,16,22]),(18,[7,13,19]),(13,[10,16]),(8,[13])]
for y,xs in rows:
    for x in xs: log(cv,x,y,dark=(x>=16 and y>=18))
# 빈틈 그늘: 통나무 사이의 어두운 뒤
for y in range(9,29):
    for x in range(3,29):
        if cv.g[y][x]=='.' and any(cv.g[y][xx]!='.' for xx in range(max(3,x-3),min(29,x+4))) and y>=13: cv.put(x,y,'x')
# 위 통나무 위 삼각 가장자리
emit(S,'w10-C',L,cv.rows(),32,32); check(f'{CAND}/{S}/w10-C.pxg')

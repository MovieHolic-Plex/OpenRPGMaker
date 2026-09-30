import sys; sys.path.insert(0,'.')
from w10lib import *
S='altar'
L={'a':'marble:6','b':'marble:5','c':'marble:4','d':'marble:3','e':'marble:2','f':'marble:1','g':'marble:0',
   'p':'purple:5','q':'purple:4','r':'purple:3','s':'purple:2','t':'purple:1',
   'G':'gold:5','H':'gold:4','I':'gold:3','J':'gold:2'}
def cloth_top(cv,x0,x1,y0,y1):
    for y in range(y0,y1+1):
        cv.hline(x0,y,x1-x0+1,'q'); cv.put(x0,y,'s'); cv.put(x1,y,'s')
        cv.put(x0+1,y,'p'); cv.put(x1-1,y,'r')
def cross(cv,cx,y0,hi='G',mid='H',lo='I'):
    for y in range(y0,y0+7): cv.put(cx,y,hi); cv.put(cx+1,y,mid)
    for x in range(cx-2,cx+4): cv.put(x,y0+2,hi if x<=cx else mid); cv.put(x,y0+3,mid if x>cx else hi)
    cv.put(cx+1,y0+6,lo)

# ---------- A: 다듬기 ----------
cv=Cv(32,32)
cv.hline(0,10,32,'f')
# 윗면 (y11..19)
cv.rect(0,11,32,9,'c')
cv.hline(1,11,30,'a')                     # 뒤 테두리 밝게
for y in (12,13): cv.hline(1,y,30,'b')
cv.hline(1,18,30,'d')                     # 앞 모서리 쪽 살짝 어둡게
cv.hline(0,19,32,'a')                     # 앞 모서리 하이라이트
cv.vline(0,11,10,'f'); cv.vline(31,11,10,'f')
cv.hline(1,20,30,'e')                     # 윗판 두께 그림자
# 대리석 결
for (x,y) in ((4,14),(5,15),(6,15),(24,13),(25,14),(26,14),(8,17),(27,17)): cv.put(x,y,'d')
cloth_top(cv,10,21,11,19)
# 앞면 (y21..30)
cv.rect(0,21,32,10,'c')
cv.vline(0,21,10,'g'); cv.vline(31,21,10,'g')
cv.vline(1,21,9,'b'); cv.vline(2,21,9,'b')      # 왼쪽 밝게
cv.vline(29,21,9,'d'); cv.vline(30,21,9,'d')    # 오른쪽 어둡게
cv.hline(3,21,26,'e')
cv.rect(3,22,7,8,'c'); cv.rect(22,22,7,8,'d')   # 패널: 왼쪽 밝은 단, 오른쪽 어두운 단
cv.hline(3,22,7,'b'); cv.hline(22,22,7,'c')
cv.vline(3,22,8,'b')
# 패널 안 홈
cv.hline(4,29,5,'d'); cv.hline(23,29,5,'e')
# 밑단
cv.hline(0,30,32,'e'); cv.hline(0,31,32,'g')
# 천 (앞으로 늘어짐)
for y in range(21,31):
    cv.hline(10,y,12,'q'); cv.put(10,y,'s'); cv.put(21,y,'s')
    cv.put(11,y,'p'); cv.put(12,y,'p' if y%3 else 'q'); cv.put(19,y,'r'); cv.put(20,y,'s' if y%2 else 'r')
    cv.put(15,y,'r') if y>=22 and False else None
cv.hline(10,29,12,'H'); cv.hline(10,30,12,'I')
cv.hline(10,20,12,'r'); cv.hline(11,21,10,'r')
cross(cv,15,23)
emit(S,'w10-A',L,cv.rows(),32,32); check(f'{CAND}/{S}/w10-A.pxg')

# ---------- B: 강한 명암 ----------
cv=Cv(32,32)
cv.hline(0,10,32,'e')
cv.rect(0,11,32,9,'b')
cv.hline(1,11,30,'a'); cv.hline(1,12,30,'a')
for y in range(13,16): cv.hline(1,y,30,'b')
for y in range(16,19): cv.hline(1,y,30,'c')
cv.hline(1,18,30,'d')
cv.hline(0,19,32,'a'); cv.vline(0,11,9,'e'); cv.vline(31,11,9,'d')
for x in range(24,31): cv.vline(x,11,8,'c')     # 오른쪽 윗면은 살짝 그늘
cv.hline(1,20,30,'f')
for (x,y) in ((4,14),(5,15),(6,15),(8,17),(20,14)): cv.put(x,y,'c')
cloth_top(cv,10,21,11,19)
cv.rect(0,21,32,10,'d')
cv.vline(0,21,10,'g'); cv.vline(31,21,10,'g')
cv.vline(1,21,9,'c'); cv.vline(2,21,9,'c'); cv.vline(3,21,9,'b')
for x in range(24,31): cv.vline(x,21,9,'e')
cv.vline(29,21,9,'f'); cv.vline(30,21,9,'f')
cv.hline(3,21,26,'f'); cv.hline(3,22,26,'e')
cv.hline(0,30,32,'f'); cv.hline(0,31,32,'g')
for y in range(21,31):
    cv.hline(10,y,12,'r'); cv.put(10,y,'s'); cv.put(21,y,'s')
    cv.put(11,y,'p' if y%3 else 'q'); cv.put(12,y,'q'); cv.put(13,y,'q')
    cv.put(19,y,'s'); cv.put(20,y,'s')
cv.hline(10,29,12,'H'); cv.hline(10,30,12,'I')
cv.hline(10,20,12,'s'); cv.hline(11,21,10,'r')
cross(cv,15,23)
# 천 그림자 (제단 앞면 위에 반투명 X — 불투명 어두운 단으로)
for y in range(22,30):
    cv.put(9,y,'f'); cv.put(22,y,'f')
emit(S,'w10-B',L,cv.rows(),32,32); check(f'{CAND}/{S}/w10-B.pxg')

# ---------- C: 윗판이 튀어나온 제단 + 받침단 ----------
cv=Cv(32,32)
cv.hline(1,10,30,'f')
cv.rect(0,11,32,9,'c')
cv.hline(1,11,30,'a'); cv.hline(1,12,30,'b'); cv.hline(1,13,30,'b')
cv.hline(1,18,30,'d')
cv.hline(0,19,32,'a')
cv.vline(0,11,9,'f'); cv.vline(31,11,9,'f')
# 윗면 판석 이음
cv.vline(10,14,4,'d'); cv.vline(21,14,4,'d')
cloth_top(cv,12,19,11,19)
# 윗판 두께
cv.hline(0,20,32,'e'); cv.hline(0,21,32,'f')
cv.hline(1,22,30,'g')      # 아래 그림자 (튀어나온 판 밑)
# 몸통(안쪽으로 들어감) x3..28, y22..27
cv.rect(3,22,26,6,'d')
cv.vline(3,22,6,'f'); cv.vline(28,22,6,'f')
cv.vline(4,23,5,'c'); cv.vline(5,23,5,'c')
cv.vline(26,23,5,'e'); cv.vline(27,23,5,'e')
cv.hline(3,22,26,'g')
# 받침단 y28..31 전폭
cv.hline(0,28,32,'b'); cv.hline(0,29,32,'c')
cv.rect(0,30,32,1,'e'); cv.hline(0,31,32,'g')
cv.vline(0,28,3,'f'); cv.vline(31,28,3,'f')
cv.hline(1,28,4,'a')
# 천: 몸통 앞으로
for y in range(22,29):
    cv.hline(12,y,8,'q'); cv.put(12,y,'s'); cv.put(19,y,'s'); cv.put(13,y,'p'); cv.put(18,y,'r')
    if y%2: cv.put(15,y,'r')
cv.hline(12,27,8,'H'); cv.hline(12,28,8,'I')
for y in range(23,27): cv.put(15,y,'G'); cv.put(16,y,'H')
cv.hline(14,24,4,'G')
emit(S,'w10-C',L,cv.rows(),32,32); check(f'{CAND}/{S}/w10-C.pxg')

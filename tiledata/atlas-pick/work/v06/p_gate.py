from lib import Cv
from load import load
W,H,g=load('cemetery_gate')
ramps=[]
for r in g:
    for c in r:
        if c and c[0] not in ramps: ramps.append(c[0])
L={r:chr(97+i) for i,r in enumerate(ramps)}
cv=Cv(W,H,{L[r]:r for r in ramps})
# 가운데(문짝·아치)는 원본 그대로
for y in range(H):
    for x in range(9,39):
        c=g[y][x]
        if c: cv.p(x,y,L[c[0]],c[1])
gr=L['grave']
def pillar(ox):
    # 마감 공: 원본 0..6행
    for y in range(0,7):
        for x in range(9):
            c=g[y][x+ox]
            if c: cv.p(x+ox,y,L[c[0]],c[1])
    # 갓돌 윗면 (위에서 본 판)
    top=[(1,7,[1]*7),(0,8,[1,4,4,4,4,4,4,4,2]),(0,9,[1,5,5,5,5,5,5,4,2]),(0,10,[1,5,6,6,6,6,6,5,2]),]
    for x0,y,ts in top:
        for i,t in enumerate(ts): cv.p(ox+x0+i,y,gr,t)
    # 마지막 행: 윗면 앞 모서리 하이라이트 (가장 밝음)
    for i in range(9): cv.p(ox+i,10,gr,6 if 0<i<8 else 3)
    # 갓돌 앞면
    for i,t in enumerate([1,4,4,4,3,3,3,3,2]): cv.p(ox+i,11,gr,t)
    for i in range(9): cv.p(ox+i,12,gr,2 if 0<i<8 else 1)
    # 몸통: 원본 9.. (12~15 한 켜 생략)
    y=13
    for oy in range(9,48):
        if oy in (12,13,14,15): continue
        for x in range(9):
            c=g[oy][x+ox]
            if c: cv.p(x+ox,y,L[c[0]],c[1])
        y+=1
    assert y==48,y
pillar(0); pillar(39)
cv.save('cemetery_gate','v34-A','3/4 재작도: 기둥 갓돌에 윗면(뒤선·밝은 면·앞 모서리 하이라이트)과 앞면을 새로 그리고 몸통 한 켜를 줄여 높이 유지. 문짝·아치·쇠사슬은 원본 유지')

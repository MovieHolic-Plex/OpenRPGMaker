import sys; sys.path.insert(0,'.')
from w10lib import *
S='conductor_podium'
L={'z':'dwood:0','o':'dwood:1','2':'dwood:2','3':'dwood:3','4':'dwood:4','5':'dwood:5','6':'dwood:6',
   'a':'linen:5','b':'linen:4','c':'linen:3','k':'linen:1','p':'pine:3','q':'pine:2',
   'r':'brass:5','s':'brass:4','t':'brass:2','u':'brass:6','w':'wood:5','v':'wood:6'}
def box(cv,x0,x1,y0,ytop_rows,yfront_rows,light=False):
    w=x1-x0+1
    # 윗면
    cv.rect(x0,y0,w,1,'o')
    for j in range(1,ytop_rows+1):
        cv.rect(x0,y0+j,w,1,'5')
        cv.put(x0,y0+j,'o'); cv.put(x1,y0+j,'o')
        cv.put(x0+1,y0+j,'6') 
        cv.put(x1-1,y0+j,'4')
    cv.rect(x0+1,y0+1,w-2,1,'6')
    yf=y0+ytop_rows+1
    cv.rect(x0,yf,w,1,'o')
    for j in range(1,yfront_rows):
        cv.rect(x0,yf+j,w,1,'4'); cv.put(x0,yf+j,'o'); cv.put(x1,yf+j,'o')
        cv.put(x0+1,yf+j,'5'); cv.put(x1-1,yf+j,'3')
    cv.rect(x0+1,yf+1,w-2,1,'5'); cv.put(x0+1,yf+1,'6')
    cv.rect(x0,yf+yfront_rows,w,1,'z')
    return cv
def stand(cv,x,y):
    cv.rect(x,y,6,1,'k'); cv.rect(x,y+3,6,1,'k'); cv.vline(x,y,4,'k'); cv.vline(x+5,y,4,'k')
    cv.rect(x+1,y+1,4,2,'a'); cv.hline(x+1,y+2,4,'b'); cv.put(x+2,y+1,'c'); cv.put(x+4,y+1,'c'); cv.put(x+1,y+2,'c'); cv.put(x+3,y+2,'c')
    cv.vline(x+2,y+4,1,'3') if False else None
cv=Cv(16,16)
box(cv,2,13,5,3,5)
for x in (6,10):
    for y in range(11,14): cv.put(x,y,'3')
stand(cv,5,0)
cv.rect(7,4,2,1,'3')            # 보면대 기둥
cv.hline(4,8,5,'a'); cv.put(9,8,'k'); cv.put(3,8,'b'); cv.hline(5,9,4,'3')   # 지휘봉과 그림자 (윗면 앞줄)
A=cv.rows()
emit(S,'w10-A',L,A,16,16); check(f'{CAND}/{S}/w10-A.pxg')

# ---- B: 강한 명암, 바닥 접지 그림자 ----
cv=Cv(16,16)
def boxB(cv,x0,x1,y0):
    w=x1-x0+1
    cv.rect(x0,y0,w,1,'o')
    for j in range(1,4):
        cv.rect(x0,y0+j,w,1,'6'); cv.put(x0,y0+j,'o'); cv.put(x1,y0+j,'o')
        cv.put(x1-1,y0+j,'5'); cv.put(x1-2,y0+j,'5')
    cv.rect(x0+1,y0+1,w-2,1,'6')
    yf=y0+4
    cv.rect(x0,yf,w,1,'z')
    for j in range(1,5):
        cv.rect(x0,yf+j,w,1,'4'); cv.put(x0,yf+j,'o'); cv.put(x1,yf+j,'o')
        cv.rect(x0+1,yf+j,3,1,'5'); cv.rect(x1-3,yf+j,3,1,'2')
    cv.rect(x0,yf+5,w,1,'z')
boxB(cv,2,12,5)
cv.rect(3,14,11,1,'~'); cv.hline(13,10,3,'-'); cv.vline(13,11,3,'-')
stand(cv,5,0); cv.rect(7,4,2,1,'3')
cv.hline(4,8,5,'a'); cv.put(9,8,'k'); cv.hline(5,9,4,'2')
B=cv.rows()
emit(S,'w10-B',L,B,16,16); check(f'{CAND}/{S}/w10-B.pxg')

# ---- C: 2단 단상 + 난간 ----
cv=Cv(16,16)
# 아래 넓은 단
cv.rect(1,10,14,1,'o'); cv.rect(1,11,14,1,'6'); cv.rect(2,11,1,1,'o')
cv.rect(1,12,14,1,'z')
for j in range(13,15):
    cv.rect(1,j,14,1,'4'); cv.put(1,j,'o'); cv.put(14,j,'o'); cv.rect(2,j,4,1,'5'); cv.rect(11,j,3,1,'3')
cv.rect(1,15,14,1,'z')
# 위 좁은 단
cv.rect(3,6,10,1,'o'); cv.rect(3,7,10,1,'6'); cv.put(3,7,'o'); cv.put(12,7,'o'); cv.hline(10,7,2,'5')
cv.rect(3,8,10,1,'z'); cv.rect(3,9,10,1,'4'); cv.put(3,9,'o'); cv.put(12,9,'o'); cv.rect(4,9,3,1,'5'); cv.rect(10,9,2,1,'3')
# 놋쇠 난간
cv.hline(4,10,8,'r'); 
for x in (4,8,11): cv.put(x,11,'s')
# 보면대와 악보
stand(cv,5,0); cv.rect(7,4,2,2,'3')
cv.hline(9,10,2,'a') if False else None
C=cv.rows()
emit(S,'w10-C',L,C,16,16); check(f'{CAND}/{S}/w10-C.pxg')

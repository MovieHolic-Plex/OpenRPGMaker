import sys; sys.path.insert(0,'.')
from w10lib import *
L={'q':'cheese:6','b':'cheese:5','c':'cheese:4','d':'cheese:3','e':'cheese:2','o':'cheese:1','r':'cheese:0','x':'meat:5'}
S='cheese_wheels'
W8=[".oooooo.",
    "obqqbbbo",
    "obbbbbco",
    "oeeccceo",
    "ocdddddo",
    "oddddeeo",
    ".oooooo."]
cv=Cv(16,16)
cv.blit(W8,0,8,); cv.blit(W8,8,8); cv.blit(W8,4,3)
A=cv.rows()
emit(S,'w10-A',L,A,16,16); check(f'{CAND}/{S}/w10-A.pxg')

# ---- B : 좌상광, 오른쪽·아래 어둡게, 접지 그림자
W8B=[".oooooo.",
     "obqqbbco",
     "obbbbbco",
     "oeecccdo",
     "ocdddddo",
     "oddddeeo",
     ".oooooo."]
W8b=[".oooooo.",
     "obqqbbco",
     "obbbbbco",
     "oeecccdo",
     "ocdddeeo",
     "odddeeeo",
     ".oooooo."]
cv=Cv(16,16)
cv.hline(1,15,14,'-'); cv.hline(2,15,12,'~')
cv.blit(W8B,0,8); cv.blit(W8b,8,8); cv.blit(W8B,4,3)
# 위 바퀴가 아래 바퀴에 드리우는 그림자
for x in range(5,11): 
    if cv.g[10][x] in 'bcq': cv.put(x,10,'c')
B=cv.rows()
B=B[:14]+[''.join('~' if (c=='.' and 0<i<15) else c for i,c in enumerate(B[14]))]+[B[15]] if False else B
emit(S,'w10-B',L,B,16,16); check(f'{CAND}/{S}/w10-B.pxg')

# ---- C : 세로 치즈탑 + 잘린 조각
T=["..oooooo..",
   ".oqqbbbbco",
   "obbbbbbbco",
   "oeeccccceo",
   "ocdddddddo",
   "ocddeddddo",
   "oeeeeeeeeo",
   "ocdddddddo",
   "ocdddeddeo",
   "oeeeeeeeeo",
   "ocdddddddo",
   "oddddddeeo",
   ".oooooooo."]
Wd=["..oooo.",
    ".obqbco",
    "obbbcco",
    "oeeeeeo",
    ".ooooo."]
cv=Cv(16,16)
cv.hline(1,15,14,'-'); cv.hline(2,15,13,'~')
cv.blit(T,6,2); cv.blit(Wd,0,10)
C=cv.rows()
emit(S,'w10-C',L,C,16,16); check(f'{CAND}/{S}/w10-C.pxg')

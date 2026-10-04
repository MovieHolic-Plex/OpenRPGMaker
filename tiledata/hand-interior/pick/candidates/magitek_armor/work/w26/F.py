import sys; sys.path.insert(0, '.')
from lib import *
# F: 새다리 보행기 — 낮고 넓은 선체, 위에 돔 조종석, 바깥으로 굽은 무릎, 붉은 조명선, 접지 그림자
c = Cv(32, 48)
def mir(x): return 31-x
def polym(m, pts, ramp, lo, hi): c.poly([(m(x),y) for x,y in pts], ramp, lo, hi)
def rectm(m, x0,y0,x1,y1,ramp,lo,hi):
    a,b=sorted((m(x0),m(x1))); c.rect(a,y0,b,y1,ramp,lo,hi)
def legs(m):
    polym(m,[(9,30),(14,30),(14,35),(7,35),(4,33)],'iron',3,5)          # 허벅지 바깥으로
    polym(m,[(3,33),(8,33),(8,38),(4,40),(1,38)],'iron',2,4)            # 무릎
    polym(m,[(3,40),(8,40),(9,45),(4,45)],'iron',2,4)                   # 정강이
    polym(m,[(0,45),(11,45),(12,47),(0,47)],'iron',3,5)                 # 발등
    rectm(m,0,45,11,45,'iron',5,5)
    rectm(m,1,46,3,46,'brass',3,5)
for m in (lambda x:x, mir): legs(m)
# 선체
c.poly([(4,17),(27,17),(30,24),(27,31),(4,31),(1,24)],'iron',3,5)
c.rect(3,26,28,27,'black',1,3)
c.rect(5,20,26,21,'red',2,4)
for x in (7,11,15,19,23): c.rect(x,28,x+1,30,'iron',2,2)
# 팔 집게
def claw(m):
    polym(m,[(0,19),(4,19),(4,30),(0,30)],'iron',2,4)
    polym(m,[(0,30),(4,30),(3,35),(1,35)],'brass',3,5)
    c.put(m(1),36,'brass',2) if m(1)!=m(1) else None
for m in (lambda x:x, mir): claw(m)
# 돔
c.ell(15.5,10.5,7.5,6.5,'teal',2,6)
c.rect(8,13,23,16,'iron',3,5)
c.rect(8,16,23,16,'brass',2,4)
c.ell(15.5,12,2.6,2.8,'clay',3,5)
c.rect(13,9,18,10,'wood',1,3)
c.put(14,12,'black',1); c.put(17,12,'black',1)
for (x,y) in ((10,6),(11,5),(10,7),(12,4)): c.put(x,y,'teal',6)
c.put(15,2,'iron',5); c.put(15,3,'iron',4)  # 안테나
c.outline(0)
# 접지 그림자: 발 아래/오른쪽. '~' '-' 는 팔레트 문자라 후처리
src = c.dump('','')
lines = src.split('\n')
open('../../w26-F.pxg','w').write(src)

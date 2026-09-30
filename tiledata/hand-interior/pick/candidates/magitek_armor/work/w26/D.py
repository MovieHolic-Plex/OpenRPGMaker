import sys; sys.path.insert(0, '.')
from lib import *
c = Cv(32, 48)
def mir(x): return 31-x
def sym(fn):
    fn(lambda x: x); fn(mir)
def rectm(m, x0,y0,x1,y1,ramp,lo,hi):
    a,b = sorted((m(x0),m(x1))); c.rect(a,y0,b,y1,ramp,lo,hi)
def polym(m, pts, ramp, lo, hi): c.poly([(m(x),y) for x,y in pts], ramp, lo, hi)
def ellm(m, cx,cy,rx,ry,ramp,lo,hi): c.ell(m(cx) if m is mir else cx, cy, rx, ry, ramp, lo, hi)
# 발
def legs(m):
    polym(m, [(8,29),(14,29),(14,37),(11,38),(5,38),(4,33)], 'iron',3,5)   # 허벅지
    rectm(m, 2,35,8,40,'iron',2,4)                                          # 무릎
    rectm(m, 3,36,4,39,'iron',1,2)
    polym(m, [(5,40),(12,40),(13,44),(5,44)], 'iron',2,4)                   # 정강이
    polym(m, [(1,44),(14,44),(14,47),(1,47)], 'iron',3,5)                   # 발
    rectm(m, 1,44,14,44,'iron',5,5)
sym(legs)
# 몸통
c.poly([(6,16),(25,16),(28,25),(25,30),(6,30),(3,25)], 'iron', 3, 5)
c.rect(5,21,26,23,'red',2,4)
c.rect(11,25,20,28,'black',1,3)
for x in (12,14,17,19): c.rect(x,25,x,28,'iron',2,2)
# 팔 + 포신
def arms(m):
    polym(m, [(0,16),(5,16),(6,22),(6,27),(0,27),(0,22)], 'iron',3,5)
    rectm(m, 0,17,5,19,'red',2,4)
    ellm(m, 3,30,3.6,3.6,'iron',1,4)
    ellm(m, 3,30,2.0,2.0,'black',0,1)
    ellm(m, 3,30,1.0,1.0,'teal',4,5)
sym(arms)
# 조종석
c.ell(15.5,10,7,6,'teal',2,5)
c.rect(8,12,23,15,'iron',3,5)
c.ell(15.5,11.5,2.6,2.8,'clay',3,5)
c.rect(13,8,18,9,'dwood',2,4)
c.put(13,11,'black',1); c.put(17,11,'black',1)
for (x,y) in ((11,5),(12,4),(11,6)): c.put(x,y,'teal',6)
c.rect(9,15,22,15,'brass',2,4)
c.outline(0)
open('../../w26-D.pxg','w').write(c.dump('',''))

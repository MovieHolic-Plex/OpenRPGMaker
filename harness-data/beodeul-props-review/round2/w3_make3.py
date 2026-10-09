import sys; sys.path.insert(0,'round2')
import w3_make2 as T
from w3_common import *
import random
# reuse make() machinery by generating crown into temp using the tree code, then crop
o=load(R1+'existing-bd-mpart-cypress-tub.png')
T.R1_override=None
# build crown with c27062 palette original as texture source (identical crown)
src=load(R1+'existing-bd-tree-c27062.png')
import types
tmp=T.make.__globals__
# call make on c27062-like but write to temp
T.make('c27062',13,8,6.6,0.3)
crown=load(R2+'tree-c27062.png')
n=Image.new('RGBA',(16,48),(0,0,0,0))
# crown: use rows 1..36 of the tree crown (drop trunk), shift so bottom lands inside soil
for y in range(0,38):
    for x in range(16):
        p=crown.getpixel((x,y))
        if p[3] and y<=33: n.putpixel((x,y),p)
# tub
def P(x,y,c): n.putpixel((x,y),c+(255,))
Mx=(49,34,16);Nn=(183,117,65);Oo=(69,42,23);Pp=(136,90,38);Qq=(111,71,37);Rr=(99,55,18);S=(89,91,88);Tt=(62,64,61)
# soil top face: rows 34..38, rim lit
for x in range(1,15):
    P(x,34,Mx if x in (1,14) else Nn)
for y in range(35,39):
    for x in range(1,15):
        if x in (1,14): c=Mx
        elif x in (2,13): c=Nn if x==2 else Oo
        else: c=Mx if (x*7+y*3)%5 else Oo
        P(x,y,c)
for x in range(1,15): P(x,38,Nn if 2<=x<=13 else Mx)
# trunk into soil
for y in (34,35,36):
    P(7,y,(59,40,31));P(8,y,(37,26,20))
# front face rows 39..47
for y in range(39,48):
    for x in range(1,15):
        k=x
        if y==47: c=Mx if x in (1,3,4,5,6,7,8,9,10,11,12,14) else Oo
        elif y in (41,42,45,46): c=S if x<=8 else Tt   # iron bands
        elif x==1 or x==14: c=Mx
        elif x in (2,3): c=Pp
        elif x in (4,5,6,7): c=Qq
        elif x in (8,9,10,11): c=Rr
        else: c=Oo
        P(x,y,c)
for y in range(39,47):
    P(1,y,Mx);P(14,y,Mx)
n.save(R2+'mpart-cypress-tub.png'); compare(o,n,R2+'mpart-cypress-tub-compare.png')

# Reproductions of versions the user REJECTED, kept so the reference images can be regenerated.
# Do not reuse these as starting points.
import os, sys, math; sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from px2 import C, _hash
def tent_oblique():
    # rejected: rotated 3/4 view (ridge running diagonally) - breaks the chipset's fixed front view
    c=C(48,48,seed=47); c.shadow(26,40.5,22,4)
    A=(15,9); R=(37,4); FL=(3,39); FR=(27,39); BR=(47,33)
    c.group(1); c.poly([A,R,BR,FR],'cloth',lambda x,y:0.5-0.12*(y-4)/35)
    c.group(2); c.poly([A,FR,FL],'cloth',lambda x,y:0.85-0.1*(y-9)/30)
    for k in (1,2,3):
        f=k/4; c.line(A[0]+(FR[0]-A[0])*f+1,A[1]+(FR[1]-A[1])*f,R[0]+(BR[0]-R[0])*f,R[1]+(BR[1]-R[1])*f,'cloth',2)
    c.line(A[0],A[1],R[0],R[1],'cloth',5)
    c.group(3); c.poly([(15,17),(8,39),(22,39)],'dark',0.3,grain=False)
    c.group(4); c.poly([(15,17),(8,39),(11,39),(12,29)],'cloth',lambda x,y:1.0)
    c.group(5); c.poly([(15,17),(22,39),(19,39),(18,29)],'cloth',lambda x,y:0.62)
    return c
def tent_teepee():
    # rejected earlier: 2x2 cone, too small and generic
    c=C(32,32,seed=47); c.shadow(16,27.5,14.5,2.6)
    c.group(1); c.poly([(16,4),(3,26),(16,26)],'cloth',lambda x,y:0.82-0.1*(y-4)/22)
    c.group(2); c.poly([(16,4),(29,26),(16,26)],'cloth',lambda x,y:0.45-0.08*(y-4)/22)
    c.group(3); c.poly([(16,11),(10,26),(22,26)],'dark',0.3,grain=False)
    return c
def bridge_boxes():
    # rejected: short vertical logs with cylinder shading read as a row of crates
    c=C(16,16,seed=36)
    for i,x0 in enumerate((0,8)):
        c.group(i+1); c.new()
        for y in range(2,15):
            for x in range(x0,x0+8):
                dx=(x+0.5-x0-4)/4; c.setv(x,y,'wood',c.shade(dx,0.05,math.sqrt(max(0,1-dx*dx)),0.35)+0.12)
        for x in range(x0+1,x0+7): c.tone(x,2,'cream',4)
        for x in range(x0,x0+8): c.tone(x,1,'wood',1); c.tone(x,15,'wood',0)
        for y in range(3,15): c.tone(x0+7,y,'wood',2)
    for y in (5,12):
        for x in range(16): c.tone(x,y,'rope',5 if x%3 else 4)
    return c
def bridge_fence():
    # rejected: two thin planks with a gap read as a fence
    c=C(16,16,seed=36)
    for y0 in (2,9):
        for j,t in enumerate((5,4,3,3,1)):
            for x in range(16): c.tone(x,y0+j,'wood',t)
    for x in (4,11):
        for y in range(2,14): c.tone(x,y,'rope',3 if y%2 else 2)
    return c

import sys; sys.path.insert(0,'tiledata/hand-interior/v5')
import importlib
mod=sys.argv[1]; m=importlib.import_module(mod)
from kit5 import OBJ
from prev5 import sheet
ims=[]
for n in m.NEW:
    f=OBJ[n][1](); ims.append(f.im)
sheet(ims,f'tiledata/hand-interior/v5/_{mod}.png',int(sys.argv[2]) if len(sys.argv)>2 else 3)
print(m.NEW)

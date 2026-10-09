import sys; sys.path.insert(0,'round2')
from w3_common import *
ids=sys.argv[2:]; s=int(sys.argv[1])
origs={'out-hanging-sign':'existing-bd-out-hanging-sign','out-signpost':'existing-bd-out-signpost','out-woodpile':'existing-bd-out-woodpile','gate-wood':'gate-wood','tree-eef4bc':'existing-bd-tree-eef4bc','tree-28ad5e':'existing-bd-tree-28ad5e','tree-c27062':'existing-bd-tree-c27062','mpart-cypress-tub':'existing-bd-mpart-cypress-tub'}
ims=[]
for i in ids:
    ims.append(load(R1+origs[i]+'.png')); ims.append(load(R2+i+'.png'))
sheet(ims,'/tmp/w3_view.png',s)

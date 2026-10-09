import sys; sys.path.insert(0,'.')
import numpy as np
from fr_ground import *
W,H=30,20
z=lambda: np.zeros((H,W),bool)
m=dict(conc=z(),asph=z(),plate=z(),dirt=z(),sick=np.zeros((H,W)),lane=z())
m['asph'][9:12,0:14]=True; m['lane'][10,0:14]=True
m['conc'][4:16,14:26]=True
m['plate'][13:18,24:30]=True
m['dirt'][15:19,2:9]=True
m['sick'][0:20,0:8]=1
im,_=compose(W,H,m)
from PIL import Image
c=Image.alpha_composite
for n,f in (('crack',autotile_crack),('rust',autotile_rust),('tox',autotile_toxpool)):
    sh=f()
    for (x,y) in [(16,6),(17,6),(16,7),(17,7)] if n=='crack' else ([(25,14),(26,14),(25,15)] if n=='rust' else [(4,4),(5,4),(6,4),(4,5),(5,5),(6,5)]):
        cells={(16,6),(17,6),(16,7),(17,7)} if n=='crack' else ({(25,14),(26,14),(25,15)} if n=='rust' else {(4,4),(5,4),(6,4),(4,5),(5,5),(6,5)})
        nn=(1 if (x,y-1) in cells else 0)|(2 if (x+1,y) in cells else 0)|(4 if (x,y+1) in cells else 0)|(8 if (x-1,y) in cells else 0)
        im.alpha_composite(cell_of(sh,nn),(x*16,y*16))
im.resize((im.width*2,im.height*2),Image.NEAREST).save('_work/t3.png')
o=Image.new('RGBA',(48*4+40,48),(0,0,0,255))
for i,g in enumerate([ground_concrete(),ground_asphalt(),ground_steelplate(),ground_sickgrass()]): o.alpha_composite(g,(i*58,0))
o.resize((o.width*3,o.height*3),Image.NEAREST).save('_work/t3b.png')

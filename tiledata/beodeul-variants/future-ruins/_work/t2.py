import sys; sys.path.insert(0,'.')
from fr_dome import *
im=dome()
print(im.size)
bg=Image.new('RGBA',im.size,(110,104,96,255)); bg.alpha_composite(im)
bg.resize((im.width*3,im.height*3),Image.NEAREST).save('_work/t2.png')

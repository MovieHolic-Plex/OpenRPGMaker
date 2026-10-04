import sys;sys.path.insert(0,'/tmp/j8city');import palette;palette.apply()
from PIL import Image
import numpy as np, roman, pn, terrain, water5
W,H=14,12
water=[[(3<=x<=6 and y<8) or y>=8 for x in range(W)] for y in range(H)]
flow=[['S' if y<8 else 'still' for x in range(W)] for y in range(H)]
bg=Image.new('RGBA',(W*16,H*16),(80,140,60,255))
road=[[(not water[y][x]) and y in (3,4) for x in range(W)] for y in range(H)]
bg.alpha_composite(terrain.paving(road,160,96))
bg.alpha_composite(pn.canal(water))
b=roman.bridge_grand(4)
x0=3*16+b['ox']; y0=3*16+b['oy_back']
wa=water5.Water(water,flow,obstacles=[(x0+a,y0+bb,r) for a,bb,r in b['foam']],lilies=[(20,150,1),(40,160,0),(150,170,1)])
wa.add_shade(x0,y0,b['shade']); wa.add_reflection(b['reflect'],x0,y0+b['refl_y'])
wa.add_boat(170,160,10,3)
fr=[]
for f in range(8):
    im=bg.copy(); a=Image.fromarray(wa.frame(f),'RGBA'); im.alpha_composite(a)
    im.alpha_composite(b['back'],(x0,y0)); im.alpha_composite(b['front'],(x0,y0))
    fr.append(im.resize((im.width*3,im.height*3),0))
fr[0].save('/tmp/j8city/_tw0.png')
fr[0].save('/tmp/j8city/_tw.gif',save_all=True,append_images=fr[1:],duration=125,loop=0)

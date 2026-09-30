import sys;sys.path.insert(0,'/tmp/j8city');import palette;palette.apply()
from PIL import Image
import roman, pn, terrain
W,H=12,9
water=[[3<=x<=6 for x in range(W)] for y in range(H)]
bg=Image.new('RGBA',(W*16,H*16),(80,140,60,255))
road=[[(not water[y][x]) and y in (3,4) for x in range(W)] for y in range(H)]
bg.alpha_composite(terrain.paving(road,160,96))
bg.alpha_composite(pn.canal(water))
b=roman.bridge_grand(4)
x0=3*16+b['ox']; y0=3*16+b['oy_back']
p=bg.load()
for X,Y,k in b['shade']:
    xx,yy=x0+X,y0+Y
    if 0<=xx<bg.width and 0<=yy<bg.height: r,g,bb,a=p[xx,yy]; p[xx,yy]=(int(r*k),int(g*k),int(bb*k),a)
bg.alpha_composite(b['back'],(x0,y0)); bg.alpha_composite(b['front'],(x0,y0))
bg.resize((bg.width*4,bg.height*4),0).save('/tmp/j8city/_tb.png')

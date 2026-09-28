import sys; sys.path.insert(0,'/tmp/j8city')
import palette; palette.apply()
from PIL import Image
exec(open('/tmp/j8city/city_layout.py').read())
import terrain, pf
base=Image.open('/tmp/j8city/city.png').convert('RGBA')
frames=[]
for f in range(4):
    im=base.copy(); px=im.load()
    for x0,y0,w in FALLS: terrain.waterfall(px,x0,y0,w,f)
    frames.append(im)
def gif(box,name,scale=2):
    fr=[f.crop(box).resize(((box[2]-box[0])*scale,(box[3]-box[1])*scale),Image.NEAREST).convert('P',palette=Image.ADAPTIVE,colors=255) for f in frames]
    fr[0].save(name,save_all=True,append_images=fr[1:],duration=160,loop=0)
gif((440,300,700,560),'/tmp/j8city/fall1.gif'); gif((660,900,920,1160),'/tmp/j8city/fall2.gif')

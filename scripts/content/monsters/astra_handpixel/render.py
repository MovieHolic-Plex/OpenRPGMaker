import sys, importlib
from PIL import Image
from pix import Canvas
def show(mods, out, scale=8, bg=(150,150,150,255)):
    ims=[]
    for m in mods:
        mod=importlib.import_module(m); c=mod.draw(Canvas); im=c.image(mod.PAL)
        print(m, 'colours used', len(c.used()), c.used())
        ims.append(im)
    W=sum(i.width for i in ims)+8*(len(ims)-1)
    s=Image.new('RGBA',(W,64),bg); x=0
    for i in ims: s.alpha_composite(i,(x,0)); x+=i.width+8
    s=s.resize((s.width*scale,s.height*scale),Image.NEAREST)
    # grid lines every 8 art px
    s.save(out)
if __name__=='__main__':
    show(sys.argv[2:], sys.argv[1])

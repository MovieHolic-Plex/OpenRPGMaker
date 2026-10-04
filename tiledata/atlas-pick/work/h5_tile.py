import sys
from PIL import Image
R='candidates-horror'
def tiled(slug, out, nx=3, ny=2, sc=4):
    ims=[Image.open(f'{R}/{slug}/h5-{x}.png').convert('RGBA') for x in 'ABC']
    w,h=ims[0].size
    s=Image.new('RGBA',((w*nx*sc+12)*3,h*ny*sc),(90,90,96,255))
    for k,im in enumerate(ims):
        t=Image.new('RGBA',(w*nx,h*ny))
        for i in range(nx):
            for j in range(ny): t.alpha_composite(im,(i*w,j*h))
        s.alpha_composite(t.resize((w*nx*sc,h*ny*sc),Image.NEAREST),(k*(w*nx*sc+12),0))
    s.save(out)
tiled(sys.argv[1], sys.argv[2], int(sys.argv[3]) if len(sys.argv)>3 else 3, int(sys.argv[4]) if len(sys.argv)>4 else 2, int(sys.argv[5]) if len(sys.argv)>5 else 3)

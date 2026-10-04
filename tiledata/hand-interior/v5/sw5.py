import sys; sys.path.insert(0,'tiledata/hand-interior/v5')
import tiles5, room2, tiles as TL
from PIL import Image
fl=list(tiles5.NEWF); wl=list(tiles5.NEWW)
im=Image.new('RGB',(len(fl)*52,52+len(wl)*0+10),(0,0,0))
for i,n in enumerate(fl):
    for y in range(48):
        for x in range(48): im.putpixel((i*52+x,y),TL.FLOORFN[n](x+i*48,y)[:3])
im.resize((im.width*3,im.height*3),0).save('tiledata/hand-interior/v5/_fl.png')
im=Image.new('RGB',(len(wl)*68,36),(0,0,0))
for i,n in enumerate(wl):
    for y in range(32):
        for x in range(64): im.putpixel((i*68+x,y),room2.FACEFN[n](x+i*64,y)[:3])
im.resize((im.width*2,im.height*2),0).save('tiledata/hand-interior/v5/_wl.png')

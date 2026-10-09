import sys
from PIL import Image, ImageDraw
def view(src,box,scale,out,grid=16):
    im=Image.open(src).convert('RGBA'); x0,y0,x1,y1=box
    c=im.crop(box).resize(((x1-x0)*scale,(y1-y0)*scale),Image.NEAREST)
    d=ImageDraw.Draw(c)
    for x in range(0,x1-x0+1,grid): d.line([(x*scale,0),(x*scale,c.height)],fill=(255,0,255,255))
    for y in range(0,y1-y0+1,grid): d.line([(0,y*scale),(c.width,y*scale)],fill=(255,0,255,255))
    c.save(out)
if __name__=='__main__':
    a=sys.argv; view(a[1],tuple(map(int,a[2].split(','))),int(a[3]),a[4])

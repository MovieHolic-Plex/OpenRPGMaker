"""Small original integer raster helpers; anatomy lives in each species function."""
from PIL import Image, ImageDraw

class Ink:
    def __init__(self,size,colors,offset=(0,0)):
        self.image=Image.new('RGBA',(size,size));self.d=ImageDraw.Draw(self.image)
        self.c=colors;self.offset=offset
    def points(self,points):
        ox,oy=self.offset
        return [(round(x+ox),round(y+oy)) for x,y in points]
    def poly(self,points,color,outline='o'):
        self.d.polygon(self.points(points),fill=self.c[color])
        if outline:self.d.line(self.points(points+[points[0]]),fill=self.c[outline],width=1)
    def line(self,points,color,width=1):
        self.d.line(self.points(points),fill=self.c[color],width=width)
    def dot(self,x,y,color):self.d.point(self.points([(x,y)]),fill=self.c[color])
    def rect(self,x,y,x2,y2,color):self.d.rectangle(self.points([(x,y),(x2,y2)]),fill=self.c[color])

def shift(pose):
    return ({'windup':-1,'attack':1,'hit':-2}.get(pose,0),
            {'idle_b':-1,'idle_c':1,'windup':2,'move':-2,'attack':1,'recover':2,'hit':-1}.get(pose,0))

def limb(s,a,b,c,width,fill='base',light='light'):
    s.line([a,b,c],'o',width+2);s.line([a,b,c],fill,width)
    s.line([(a[0]-1,a[1]),(b[0]-1,b[1]),(c[0]-1,c[1])],light,max(1,width//3))

"""Direct native64 pixel painters. Authored joints are transformed before painting."""
import math
from PIL import Image,ImageDraw
POSES=['idle_a','idle_b','idle_c','windup','move','attack','recover','hit','dead']
PAL={
'o':'192935','d':'2b3e49','s':'425968','m':'698590','g':'99b0b3','h':'c2d0c5','w':'eee6c7',
'b':'514649','B':'806853','t':'b0926b','y':'dec288','i':'fff0b9',
'r':'563440','R':'934a50','p':'ce7970','q':'efb796',
'v':'3d3857','V':'65587d','l':'9984b0','L':'d0bbd1',
'c':'294e55','C':'427d78','u':'79b7a5','U':'bad8b9',
'e':'dda64d','E':'fff0a0','f':'34523e','F':'587d50','a':'93aa63','A':'cfcd92'}
BODY={'idle_a':(0,0),'idle_b':(0,1),'idle_c':(0,0),'windup':(-2,2),'move':(1,-1),'attack':(2,1),'recover':(0,1),'hit':(-3,3),'dead':(0,0)}
HEAD={'idle_a':(0,0,0),'idle_b':(0,1,-1),'idle_c':(-1,-1,2),'windup':(-2,3,-6),'move':(1,-1,3),'attack':(2,1,5),'recover':(1,2,2),'hit':(-3,4,-8),'dead':(0,0,0)}
SWING={'idle_a':0,'idle_b':1,'idle_c':-1,'windup':-3,'move':3,'attack':6,'recover':2,'hit':-3,'dead':0}
class Pixels:
    def __init__(self,pose,cell=64,pal=None):
        assert cell==64;self.im=Image.new('RGBA',(cell,cell));self.d=ImageDraw.Draw(self.im);self.pose=pose;self.part='body';self.pivot=(37,22)
        self.colors={k:'#'+v for k,v in (pal or PAL).items()};self.vertices=[]
    def point(self,x,y):
        if self.pose=='dead':pass
        elif self.part=='head' or self.part=='jaw':
            dx,dy,ang=HEAD[self.pose];ox,oy=self.pivot;r=math.radians(ang);xx=x-ox;yy=y-oy;x=ox+xx*math.cos(r)-yy*math.sin(r)+dx;y=oy+xx*math.sin(r)+yy*math.cos(r)+dy
            if self.part=='jaw':y+= {'windup':-1,'attack':3,'hit':-1}.get(self.pose,0)
        elif self.part in ('leftleg','rightleg'):
            dx,dy=BODY[self.pose];f=max(0,min(1,(60-y)/23));x+=dx*f;y+=dy*f
            stride={'move':-4 if self.part=='leftleg' else 4,'attack':-2 if self.part=='leftleg' else 3,'windup':2 if self.part=='leftleg' else -2,'hit':2 if self.part=='leftleg' else -2}.get(self.pose,0);x+=stride*(1-f)
            if self.pose=='move':y-=1*(1-f)
        elif self.part=='tail':
            dx,dy=BODY[self.pose];x+=dx; y+=(dy+SWING[self.pose]*(1-max(0,min(1,x/36)))*.35)*max(0,min(1,(60-y)/15))
        elif self.part=='fixed':pass
        else:
            dx,dy=BODY[self.pose];x+=dx;y+=dy*max(0,min(1,(60-y)/15))
        p=(round(x),round(y));self.vertices.append(p);return p
    def pts(self,pts):return [self.point(x,y) for x,y in pts]
    def poly(self,pts,col,edge=False):
        pts=self.pts(pts);self.d.polygon(pts,fill=self.colors.get(col,col))
        if edge:self.d.line(pts+[pts[0]],fill=self.colors['o'],width=1)
    def line(self,pts,col,width=1):self.d.line(self.pts(pts),fill=self.colors.get(col,col),width=width)
    def cluster(self,x,y,rows):
        for yy,row in enumerate(rows):
            for xx,c in enumerate(row):
                if c!='.':self.d.point(self.point(x+xx,y+yy),fill=self.colors[c])
    def oval(self,rect,col,edge=None):
        x0,y0=self.point(rect[0],rect[1]);x1,y1=self.point(rect[2],rect[3]);self.d.ellipse((min(x0,x1),min(y0,y1),max(x0,x1),max(y0,y1)),fill=self.colors[col],outline=self.colors[edge] if edge else None)
    def joint(self,pts,width=5,base='s',light='m',dark='d'):
        # Polygon segments make thick near/far limbs, not single colored sticks.
        for (x,y),(xx,yy) in zip(pts,pts[1:]):
            a=math.atan2(yy-y,xx-x);u=math.sin(a)*width/2;v=-math.cos(a)*width/2
            self.poly([(x+u,y+v),(xx+u,yy+v),(xx-u,yy-v),(x-u,y-v)],base,True)
            self.line([(x+u*.3,y+v*.3),(xx+u*.3,yy+v*.3)],light,max(1,width//3));self.line([(x-u*.55,y-v*.55),(xx-u*.55,yy-v*.55)],dark)
        for x,y in pts[1:-1]:self.poly([(x-2,y-2),(x+2,y-2),(x+2,y+2),(x-2,y+2)],light,True)
    def eye(self,x,y,close=False,iris='e'):
        self.poly([(x-2,y-1),(x+3,y-2),(x+4,y),(x+2,y+2),(x-1,y+2)],'o')
        if not close:self.cluster(x,y,['ii'+iris,'.'+iris+'o'])
        else:self.line([(x-1,y),(x+3,y+1)],'m')

def palette(ramp):
    p=PAL.copy();p.update(zip(('d','s','m','g','h'),ramp));return p

def skull(p,x,y,size=1,grim=False):
    f=lambda pts:[(x+a*size,y+b*size) for a,b in pts]
    p.poly(f([(-7,-9),(-3,-12),(4,-11),(8,-7),(8,-2),(11,-1),(11,2),(7,4),(6,9),(0,11),(-5,8),(-6,4),(-8,0)]),'t',True)
    p.poly(f([(-6,-7),(-2,-10),(3,-9),(6,-6),(5,-2),(2,0),(-4,-1),(-6,-4)]),'y')
    p.poly(f([(-4,-7),(-1,-9),(2,-8),(4,-6),(1,-5),(-4,-5)]),'i')
    p.poly(f([(-4,0),(-2,-2),(1,-2),(2,1),(0,4),(-3,3)]),'o');p.poly(f([(5,-2),(8,-3),(9,0),(7,2),(5,1)]),'o')
    p.poly(f([(3,2),(5,4),(4,6),(2,5)]),'B');p.line(f([(-2,6),(1,7),(5,6),(7,5)]),'b')
    for xx in (-1,2,5):p.poly(f([(xx,5),(xx+1,5),(xx+1,8),(xx,8)]),'i')
    p.poly(f([(-5,3),(-2,4),(-3,8),(-5,6)]),'B');p.line(f([(-3,-10),(1,-10),(4,-8)]),'w')
    if p.pose not in ('hit','dead'):p.cluster(x+6*size,y-1*size,['eE'])
    if grim:p.line(f([(-1,-4),(2,-3)]),'B')

def bone(p,pts,width=4,far=False):p.joint(pts,width,'B' if far else 't','t' if far else 'i','b' if far else 'B')

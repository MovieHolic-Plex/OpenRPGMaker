"""Hand-authored final-grid clusters and joint rigs; no bitmap transformations."""
import math
from common import Canvas, POSES
P={
'o':'182936','d':'304653','s':'486273','m':'6e91a0','h':'a3c5c7','w':'e8eee0',
'k':'27313c','r':'713e4c','R':'a75b5b','p':'d18a78','q':'efc0a1',
'b':'655149','B':'927562','t':'bd9c73','y':'e5ce92','i':'fff0ba',
'g':'315f57','G':'4b9375','a':'81b592','A':'b8d9a5','e':'e9b153','E':'fff1a4',
'v':'4d456a','V':'7765a0','l':'aa91c2','L':'d4c2e7',
'c':'316576','C':'4b9faa','u':'83ccd0','U':'c0eeeb',
}
class Art(Canvas):
    def __init__(self,cell,palette=None): super().__init__(cell,palette or P); self.sx=cell/48; self.sy=(cell-4)/44
    def pts(self,pts): return [(x*self.sx,y*self.sy) for x,y in pts]
    def poly(self,pts,color,outline='o'): super().poly(self.pts(pts),color,outline)
    def line(self,pts,color,width=1): super().line(self.pts(pts),color,max(1,round(width*self.sx)))
    def box(self,r,color,outline=None): super().box((r[0]*self.sx,r[1]*self.sy,r[2]*self.sx,r[3]*self.sy),color,outline)
    def oval(self,r,color,outline=None): super().oval((r[0]*self.sx,r[1]*self.sy,r[2]*self.sx,r[3]*self.sy),color,outline)
    def pixel(self,x,y,color): super().pixel(x*self.sx,y*self.sy,color)
    def limb(self,pts,fill='s',width=4):
        self.line(pts,'o',width+2); self.line(pts,fill,width)
        if len(pts)>2: self.oval((pts[1][0]-1,pts[1][1]-1,pts[1][0]+1,pts[1][1]+1),'h')
    def jewel(self,x,y,col='C'):
        self.poly([(x,y-3),(x+3,y),(x,y+3),(x-3,y)],col); self.line([(x-1,y),(x,y-2),(x+1,y)],'U'); self.pixel(x,y+1,'u')
    def skull(self,x,y,dead=False,large=1):
        s=large; f=lambda p:[(x+a*s,y+b*s) for a,b in p]
        self.poly(f([(-5,-6),(0,-8),(4,-6),(5,-3),(7,-2),(7,0),(4,1),(4,4),(-1,5),(-4,3),(-4,0),(-6,-2)]),'t')
        self.poly(f([(-4,-5),(0,-7),(3,-5),(3,-2),(5,-1),(2,0),(1,2),(-2,1),(-4,-2)]),'w',None)
        self.box((x-2*s,y-3*s,x,y-s),'o'); self.box((x+3*s,y-3*s,x+5*s,y-s),'o')
        self.pixel(x+2*s,y,'b'); self.line([(x,y+3*s),(x+4*s,y+2*s)],'b')
        for a in (0,2,4): self.pixel(x+a*s,y+2*s,'w')
        if not dead: self.pixel(x+4*s,y-2*s,'e')

def rig(pose):
    return {
      'idle_a':(0,0,0,0), 'idle_b':(0,1,1,-1), 'idle_c':(0,-1,-1,1),
      'windup':(-2,2,-4,2),'move':(1,-2,4,-3),'attack':(3,1,8,-2),
      'recover':(1,1,3,1),'hit':(-2,3,-3,3),'dead':(0,0,0,0)
    }[pose]

def shift(points,dx=0,dy=0):return [(x+dx,y+dy) for x,y in points]

def face(a,x,y,pose,kind='eyes'):
    hit=pose in ('hit','dead'); attack=pose=='attack'
    a.line([(x-6,y-2),(x-3,y-3),(x-1,y-2)],'o')
    a.line([(x+2,y-2),(x+5,y-3),(x+7,y-2)],'o')
    if hit:
        a.line([(x-5,y),(x-2,y+1)],'o'); a.line([(x+3,y+1),(x+6,y)],'o')
    else:
        a.box((x-5,y-1,x-2,y+2),'w');a.box((x+3,y-1,x+6,y+2),'w')
        a.box((x-2,y,x-1,y+2),'o');a.box((x+6,y,x+7,y+2),'o')
    if attack:
        a.poly([(x-3,y+4),(x+6,y+3),(x+6,y+8),(x+1,y+9),(x-3,y+7)],'r');a.line([(x-2,y+4),(x+5,y+4)],'i');a.line([(x,y+8),(x+4,y+7)],'p')
    else:a.line([(x-2,y+5),(x+2,y+6),(x+6,y+4)],'o')

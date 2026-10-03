"""Fresh final-grid monster drawings. Anatomy lives in species-specific modules.
No bitmap input, tracing, resampling or image transform is used for source cells.
"""
import math,sys
from pathlib import Path
from PIL import Image,ImageDraw
sys.dont_write_bytecode=True
sys.path.insert(0,str(Path(__file__).resolve().parent))
POSES=('idle_a','idle_b','idle_c','windup','move','attack','recover','hit','dead')
BASE={'o':'172631','d':'2b4149','s':'456452','m':'658765','g':'91ac77','h':'c4d09c',
'b':'473b3c','t':'6d5446','T':'997454','y':'c6a26d','Y':'ebcd95',
'R':'5c3343','r':'995159','p':'ce7c72','P':'eaa28a',
'v':'343e53','a':'536879','A':'84979f','i':'b8c8c3','w':'e6e5c5',
'e':'e8bf68','E':'fff0b0','z':'131d26','q':'735166'}
class P:
 def __init__(self,cell,pose,pal=None):
  self.im=Image.new('RGBA',(cell,cell));self.d=ImageDraw.Draw(self.im);self.cell=cell;self.pose=pose;self.part='body';self.pal={k:'#'+v for k,v in (pal or BASE).items()};self.pivots={};self.size=cell/64
 def rig(self,**parts):self.pivots.update(parts)
 def at(self,part):self.part=part;return self
 def point(self,x,y):
  # Material geometry is transformed at joints before rasterizing.
  n=self.pose;part=self.part;k=self.size
  if n=='dead' or part=='absolute':return round(x),round(y)
  body={'idle_a':(0,0),'idle_b':(0,1),'idle_c':(0,0),'windup':(-1,1),'move':(1,-1),'attack':(2,1),'recover':(0,1),'hit':(-2,2)}[n]
  dx,dy=body
  if part in ('near_leg','far_leg'):
   foot=(self.cell-4);u=max(0,min(1,(y-(self.cell*.66))/(foot-self.cell*.66)))
   stride={'idle_a':0,'idle_b':0,'idle_c':0,'windup':-1,'move':4,'attack':3,'recover':1,'hit':-2}[n]*k
   sign=1 if part=='near_leg' else -1
   return round(x+dx*k*(1-u)+stride*sign*u),round(y+dy*k*(1-u)-(2*k*u if n=='move' and part=='far_leg' else 0))
  if part=='head':
   hx,hy={'idle_a':(0,0),'idle_b':(-1,0),'idle_c':(1,-1),'windup':(-2,0),'move':(1,0),'attack':(2,1),'recover':(1,1),'hit':(-2,1)}[n]
   dx+=hx;dy+=hy
  if part in ('near_arm','far_arm','wing','tail'):
   angle={'idle_a':0,'idle_b':-3,'idle_c':3,'windup':22,'move':-8,'attack':38,'recover':5,'hit':25}[n]
   if part=='near_arm' and n=='attack':angle=self.pivots.get('attack_arm_angle',angle)
   if part=='far_arm':angle*=-.4
   if part=='wing':angle={'idle_a':0,'idle_b':-7,'idle_c':8,'windup':-14,'move':4,'attack':22,'recover':12,'hit':28}[n]
   if part=='tail':angle*=.3
   px,py=self.pivots.get(part,(self.cell*.5,self.cell*.5));a=math.radians(angle)
   xx=x-px;yy=y-py;x=px+xx*math.cos(a)-yy*math.sin(a);y=py+xx*math.sin(a)+yy*math.cos(a)
  if part=='body':dy*=max(0,min(1,(self.cell-4-y)/(self.cell*.18)))
  return round(x+dx*k),round(y+dy*k)
 def poly(self,ps,c,edge=None):
  ps=[self.point(x,y) for x,y in ps];self.d.polygon(ps,fill=self.pal[c])
  if edge:self.d.line(ps+[ps[0]],fill=self.pal[edge],width=1)
 def line(self,ps,c,width=1):self.d.line([self.point(x,y) for x,y in ps],fill=self.pal[c],width=width)
 def dots(self,x,y,rows):
  for j,row in enumerate(rows):
   for i,c in enumerate(row):
    if c!='.':self.d.point(self.point(x+i,y+j),fill=self.pal[c])
 def dot(self,x,y,c):self.d.point(self.point(x,y),fill=self.pal[c])
 def eye(self,x,y):
  n=self.pose
  if n in ('idle_c','hit','dead'):self.line([(x,y),(x+2,y+1)],'z')
  else:self.dots(x,y,['EEz','Ez.'])
 def weapon(self,x,y,kind,weight=1):
  x,y=self.point(x,y);part=self.part;self.part='absolute';n=self.pose
  angle={'idle_a':-86,'idle_b':-89,'idle_c':-82,'windup':-128,'move':-90,'attack':-10,'recover':-75,'hit':-115,'dead':0}[n]
  length=18 if self.cell==64 else 28
  if kind=='knife':length=12
  vx=math.cos(math.radians(angle));vy=math.sin(math.radians(angle));nx=-vy;ny=vx
  def xy(u,v):return (x+vx*u+nx*v,y+vy*u+ny*v)
  if kind in ('sword','knife','spear'):
   if kind=='spear':
    self.line([xy(-9,0),xy(length-3,0)],'b',3);self.line([xy(-8,-1),xy(length-3,-1)],'T')
    self.poly([xy(length-7,-3),xy(length+1,0),xy(length-7,3),xy(length-5,0)],'A','o');self.line([xy(length-6,-1),xy(length,0)],'w')
   else:
    self.poly([xy(2,-2),xy(length-3,-2),xy(length,0),xy(length-3,2),xy(2,2)],'a','o');self.line([xy(3,-1),xy(length-2,0)],'i');self.line([xy(2,-4),xy(2,4)],'y',2);self.line([xy(-4,0),xy(1,0)],'T',2)
  elif kind=='axe':
   self.line([xy(-5,0),xy(length,0)],'b',3);self.line([xy(-4,-1),xy(length,-1)],'T')
   self.poly([xy(length-7,-3),xy(length-8,5),xy(length-5,9),xy(length+2,9),xy(length+4,5),xy(length+1,-3)],'a','o');self.line([xy(length-4,8),xy(length+1,8),xy(length+3,5)],'w',2);self.line([xy(length-5,2),xy(length+1,2)],'i')
  elif kind=='pick':
   self.line([xy(-5,0),xy(length,0)],'b',3);self.line([xy(-4,-1),xy(length,-1)],'T')
   self.poly([xy(length-2,-9),xy(length+2,-6),xy(length+3,0),xy(length+1,7),xy(length-3,10),xy(length-1,4),xy(length,0),xy(length-1,-4)],'a','o');self.line([xy(length,-6),xy(length+1,0),xy(length-1,6)],'i')
  elif kind=='staff':
   self.line([xy(-12,0),xy(length,0)],'b',3);self.line([xy(-11,-1),xy(length,-1)],'T')
   self.poly([xy(length-3,-4),xy(length+3,-4),xy(length+7,0),xy(length+3,4),xy(length-3,4)],'y','o');self.poly([xy(length,-2),xy(length+4,0),xy(length,2),xy(length-2,0)],'p');self.dot(*xy(length,0),'E')
  else:
   self.line([xy(-4,0),xy(length,0)],'b',5);self.line([xy(-3,-1),xy(length,-1)],'T',2)
   self.poly([xy(length-11,-4),xy(length-6,-6),xy(length+2,-4),xy(length+3,3),xy(length-3,5),xy(length-10,4)],'t','o');self.line([xy(length-8,-3),xy(length,-2)],'y');self.line([xy(length-8,0),xy(length-1,1)],'b');self.dots(*[round(z) for z in xy(length-3,-3)],['Aa','vi'])
  self.part=part

DESCRIPTIONS={}

def draw(slug,pose,cell):
 if pose not in POSES:raise ValueError(pose)
 from humanoid_men import DRAWERS as men,DESCRIPTIONS as md
 from humanoid_flying import DRAWERS as fly,DESCRIPTIONS as fd
 from humanoid_hybrids import DRAWERS as hy,DESCRIPTIONS as hd
 from humanoid_spirits import DRAWERS as sp,DESCRIPTIONS as sd
 for ds,notes in ((men,md),(fly,fd),(hy,hd),(sp,sd)):
  DESCRIPTIONS.update(notes)
  if slug in ds:return ds[slug](pose,cell)
 raise ValueError(slug)

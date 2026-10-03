"""Native pixel stamping and named anatomical joint animation, no source rasters."""
import math
from PIL import Image,ImageDraw
POSES=('idle_a','idle_b','idle_c','windup','move','attack','recover','hit','dead')

def pal(m,g,s,d,a='bca77c',h='cdd8bb',r='965e64'):
 return dict(o='192b36',d=d,s=s,m=m,g=g,h=h,i='e0dbc0',w='fff2d3',a=a,A='ecd39a',b='51414b',t='8e706b',T='c49a84',r=r,R='d59085',e='e8b861',E='fff1a9',v='729597',V='abc5be')

GEOMETRY_AUDIT=[]

class Pen:
 def __init__(self,palette,pose,species='organic'):
  self._im=Image.new('RGBA',(64,64));self.d=ImageDraw.Draw(self._im);self.species=species;self.commands=[];self._done=False;self.pal={k:'#'+v for k,v in palette.items()};self.n=POSES.index(pose);self.part='body';self.head=(48,24);self.root=(30,34);self.pivot=(42,37)
 def raw_xy(self,p,context=None):
  if context is None:part,head,pivot=self.part,self.head,self.pivot
  else:part,head,pivot=context
  x,y=p;n=self.n
  if n not in (0,8):
   dx,dy=[(0,0),(0,1),(0,0),(-2,3),(-1,-2),(-2,1),(-1,1),(-3,3),(0,0)][n]
   if part in ('head','jaw'):
    hx,hy=head;mx,my,ang=[(0,0),(0,1,0),(-1,-1,3),(-4,3,-8),(-1,-2,-4),(1,4,7),(-1,2,2),(-4,4,-12),(0,0,0)][n]
    if n==5 and self.species in('ant-soldier','centipede-01','centipede-fire'):mx,my,ang=-1,3,3
    if part=='jaw' and n==5:y=hy+5+(y-hy-5)*1.5
    u,v=x-hx,y-hy;rad=math.radians(ang);x=hx+u*math.cos(rad)-v*math.sin(rad)+mx;y=hy+u*math.sin(rad)+v*math.cos(rad)+my
   elif part=='neck':
    hx,hy=head;w=max(0,min(1,(41-y)/19));x+=dx*(1-w)+[0,0,-1,-4,-1,1,-1,-4,0][n]*w;y+=dy*(1-w)+[0,1,-1,3,-2,4,2,4,0][n]*w
   elif part in ('near_leg','far_leg','hind','far_hind'):
    w=max(0,min(1,(y-36)/24));sign=-1 if part in ('hind','far_leg')else 1;stride=[0,0,1,-2,6,6,2,-2,0][n]*sign
    if self.species.startswith('crab'):stride=0
    lift=4 if n in(4,5)and part in('near_leg','far_hind')else 0
    x+=dx*(1-w)+stride*w;y+=dy*(1-w)-lift*w
   elif part in('arm','wing','tentacle','claw'):
    px,py=pivot;angles=[0,3,-3,-20,-5,22,8,-12,0]
    if part=='wing':angles=[0,2,-2,-7,-4,9,4,-7,0]
    if part=='tentacle':angles=[0,1,-1,-3,-2,3,2,-3,0]
    if part=='arm' and self.species.startswith('crab'):angles=[0,1,-1,0,3,9,4,-1,0]
    rad=math.radians(angles[n]);u,v=x-px,y-py
    w=max(0,min(1,(abs(u)+abs(v))/20));tx=px+u*math.cos(rad)-v*math.sin(rad);ty=py+u*math.sin(rad)+v*math.cos(rad)
    x=x*(1-w)+tx*w+dx;y=y*(1-w)+ty*w+dy
   elif part=='tail':
    w=max(0,min(1,(25-x)/20));x+=dx;y+=dy+[0,1,-2,3,-3,-2,1,-4,0][n]*w
   else:x+=dx;y+=dy
  return x,y
 def anchor(self,context):
  part,head,pivot=context
  if part in ('arm','claw','wing','tentacle'):return pivot
  if part in ('head','jaw'):return head
  if part=='tail':return (34,46)if self.species in('bat','bat-vampire')else(47,25)if self.species=='eel-electric'else(20,32)
  if part in('hind','far_hind'):return (23,36)
  if part in('near_leg','far_leg'):return (32,36)if self.species.startswith(('crab','spider','centipede'))else(40,36)
  if part=='neck':return(40,35)
  return(30,34)
 def context(self):return(self.part,self.head,self.pivot)
 def poly(self,pts,c='m',edge=True):self.commands.append(('poly',pts,c,0,edge,self.context()))
 def line(self,pts,c='s',w=1):self.commands.append(('line',pts,c,w,False,self.context()))
 def cluster(self,x,y,rows):
  context=self.context()
  for yy,row in enumerate(rows):
   for xx,c in enumerate(row):
    if c!='.':self.commands.append(('point',[(x+xx,y+yy)],c,0,False,context))
 def xy(self,p):
  context=self._painting_context;key=(context[0],self.anchor(context));scale,anchor=self._fits[key]
  x,y=self.raw_xy(p,context);x=anchor[0]+(x-anchor[0])*scale;y=anchor[1]+(y-anchor[1])*scale
  assert 1<=x<=62 and 1<=y<=60,(self.species,POSES[self.n],context[0],'float',(x,y))
  x,y=round(x),round(y)
  assert 1<=x<=62 and 1<=y<=60,(self.species,POSES[self.n],context[0],(x,y))
  return x,y
 @property
 def im(self):
  if self._done:return self._im
  self._fits={};bounds={}
  # Fit one entire authored part around its anatomical attachment, before rasterization.
  # No vertex is clipped or clamped. The same factor applies to contour and material marks.
  for kind,pts,c,w,edge,context in self.commands:
   key=(context[0],self.anchor(context));anchor=self.raw_xy(key[1],context)
   scale=self._fits.get(key,(1,anchor))[0];radius=w//2
   for point in pts:
    x,y=self.raw_xy(point,context)
    b=bounds.setdefault(key,[x-radius,y-radius,x+radius,y+radius]);b[:]=[min(b[0],x-radius),min(b[1],y-radius),max(b[2],x+radius),max(b[3],y+radius)]
    for value,a,lo,hi in((x,anchor[0],1,62),(y,anchor[1],1,60)):
     distance=value-a
     if distance>0 and value+radius>hi:scale=min(scale,(hi-radius-.01-a)/distance)
     elif distance<0 and value-radius<lo:scale=min(scale,(a-lo-radius-.01)/(-distance))
   assert 0<scale<=1,(self.species,POSES[self.n],key,scale)
   self._fits[key]=(scale,anchor)
  final={};transformed={}
  for kind,pts,c,w,edge,context in self.commands:
   self._painting_context=context;key=(context[0],self.anchor(context));points=[self.xy(point)for point in pts];radius=w//2
   scale,anchor=self._fits[key]
   for source in pts:
    x,y=self.raw_xy(source,context);x=anchor[0]+(x-anchor[0])*scale;y=anchor[1]+(y-anchor[1])*scale
    assert 1<=x-radius and x+radius<=62 and 1<=y-radius and y+radius<=60,(self.species,POSES[self.n],context[0],'float stroke',(x,y),w)
    b=transformed.setdefault(key,[x-radius,y-radius,x+radius,y+radius]);b[:]=[min(b[0],x-radius),min(b[1],y-radius),max(b[2],x+radius),max(b[3],y+radius)]
   for x,y in points:
    assert 1<=x-radius and x+radius<=62 and 1<=y-radius and y+radius<=60,(self.species,POSES[self.n],context[0],(x,y),w)
    b=final.setdefault(key,[x-radius,y-radius,x+radius,y+radius]);b[:]=[min(b[0],x-radius),min(b[1],y-radius),max(b[2],x+radius),max(b[3],y+radius)]
   if kind=='poly':
    self.d.polygon(points,fill=self.pal[c])
    if edge:self.d.line(points+points[:1],fill=self.pal['o'],width=1)
   elif kind=='line':self.d.line(points,fill=self.pal[c],width=w)
   else:self.d.point(points[0],fill=self.pal[c])
  GEOMETRY_AUDIT.append(dict(species=self.species,pose=POSES[self.n],parts=[dict(part=k[0],anchor=v[1],scale=v[0],nominalBounds=bounds[k],transformedBounds=transformed[k],paintBounds=final[k])for k,v in self._fits.items()]))
  self._done=True;return self._im
 def eye(self,x,y,big=False):
  if self.n in(7,8):self.line([(x-1,y),(x,y+1),(x+2,y)],'o');return
  self.cluster(x-1,y-1,['oo..','oeEo','oao.'] if big else ['ooo','oeo'])
 def mouth(self,x,y,width=9):
  amount=[3,4,2,1,3,7,3,1,1][self.n]
  self.poly([(x,y),(x+width,y-1),(x+width-1,y+amount),(x+2,y+amount+1)],'b')
  for i in range(1,width-1,3):self.poly([(x+i,y),(x+i+2,y),(x+i+1,y+min(3,amount))],'w',False)
  if amount>3:self.line([(x+3,y+amount-1),(x+width-2,y+amount-1)],'r')
 def capsule(self,pts,width=4,c='m',far=False):
  self.line(pts,'o',width+2);self.line(pts,'d'if far else c,width)
  if not far:self.line([(x-1,y-1) for x,y in pts],'g',max(1,width//3))
 def facets(self,x,y,cols=3,rows=3):
  for j in range(rows):
   for i in range(cols):
    xx=x+i*5+j%2*2;yy=y+j*4
    self.cluster(xx,yy,['gmm.','.msd','..sd'])
 def partof(self,name):self.part=name

"""Hand authored silhouettes and independent joint poses, painted on final native grids.
No input bitmap, image rotation, resampling, or pose translation is used.
"""
import sys, math, json
from pathlib import Path
sys.dont_write_bytecode=True
sys.path.insert(0,str(Path(__file__).resolve().parent))
from common import Canvas,POSES,run_group,entries

BASE=dict(o='1d2534',s='354551',b='55746e',l='85aa8d',h='bdd1ad',
          t='795d4c',u='b18b67',v='e1c697',w='f5e4b8',
          c='493848',r='88484f',p='c16b68',q='e4a38a',
          a='4d4257',m='6f7b8b',n='aab8ba',i='dce5d6',
          g='896f43',y='c5a460',e='ecd68a',f='313345',z='edb547')
TINT={
'goblin-scout':('365848','5b8c62','99b976'), 'goblin-brute':('3a584b','719b68','b0bf82'),
'orc-warrior':('405b56','6d9471','aabc83'), 'orc-01':('594552','956766','c79981'),
'orc-shaman':('3f5c55','759978','acc59a'), 'ogre-club':('57464d','99796d','ccac8b'),
'zombie-01':('3c5458','68857b','a6af89'), 'kobold-digger':('574154','986c67','ca9a81'),
'lizardman-spear':('354b66','547e91','90afaf'), 'kappa-01':('375c53','648d6e','9dbc83'),
'bandit-mask':('544354','8a6b68','bc9282'), 'mage-rogue':('47495f','797190','b39cbb'),
'knight-fallen':('394252','65788a','a0aeb7'), 'harpy-cliff':('594e60','978494','c6aeaa'),
'harpy-01':('414c5c','778f9b','adbcb7'), 'angel-fallen':('393d53','6c7188','a1abc0'),
'imp-mischief':('663b4e','a65a62','d28a7d'), 'gargoyle-stone':('3e505b','788b8e','b1bba9'),
'leafling-01':('345945','658e57','acc680'), 'sparkit-01':('654745','b1794b','e6b76f'),
'aqualing-01':('31526e','578aa2','9ac3cd'),
'salamander-01':('654653','a86e62','daa580'), 'salamander-flame':('643547','b45c4e','e49b66'),
'dragon-whelp':('3d5266','6f93a2','abc5bd'), 'behemoth-horn':('4e415f','806681','baa3a7'),
'griffin-sky':('5a4b50','977d60','c8b082'), 'centaur-plains':('5b434a','946958','c9a27e'),
'roc-giant':('3a4b59','617a8c','9aaeba'), 'phoenix-rebirth':('733d4c','bc6656','e9a168')}

# Independent local coordinates, never an image shift. Feet stay on y=60 (native cell-4).
R={
'idle_a':(0,0,0,0,0),'idle_b':(0,1,1,2,1),'idle_c':(0,0,-1,-2,-1),
'windup':(-2,2,-3,-7,-2),'move':(1,-1,2,5,3),'attack':(3,1,5,9,5),
'recover':(1,2,1,3,2),'hit':(-3,3,-3,-4,-3),'dead':(0,0,0,0,0)}

class Pen:
 def __init__(self,cell,slug):
  pal=BASE.copy();pal['s'],pal['b'],pal['l']=TINT[slug]
  pal['h']=''.join(format(round(int(pal['l'][i:i+2],16)*.7+int(BASE['w'][i:i+2],16)*.3),'02x') for i in (0,2,4))
  self.c=Canvas(cell,pal);self.im=self.c.im;self.k=(cell-4)/60;self.cell=cell
 def xy(self,p):return (round(2+p[0]*self.k),round(p[1]*self.k))
 def poly(self,ps,col,edge='o'):self.c.poly([self.xy(p) for p in ps],col,edge)
 def line(self,ps,col,width=1):self.c.line([self.xy(p) for p in ps],col,max(1,round(width*self.k)))
 def oval(self,r,col,edge='o'):self.c.oval((*self.xy(r[:2]),*self.xy(r[2:])),col,edge)
 def box(self,r,col,edge=None):self.c.box((*self.xy(r[:2]),*self.xy(r[2:])),col,edge)
 def dot(self,x,y,col):self.c.pixel(*self.xy((x,y)),col)

def limb(p,a,b,w,col='b',light='l'):
 # Tapered muscle/cloth volume, with a lit ridge and darker underside.
 vx=b[0]-a[0];vy=b[1]-a[1];ln=max(1,math.hypot(vx,vy));nx=-vy/ln;ny=vx/ln
 ps=[(a[0]+nx*w,a[1]+ny*w),(b[0]+nx*w*.65,b[1]+ny*w*.65),
     (b[0]-nx*w*.65,b[1]-ny*w*.65),(a[0]-nx*w,a[1]-ny*w)]
 p.poly(ps,col);p.line([(a[0]+nx*w*.5,a[1]+ny*w*.5),(b[0]+nx*w*.3,b[1]+ny*w*.3)],light)

def claw(p,x,y,n=3,size=2):
 for i in range(n):p.poly([(x+i*size,y),(x+i*size+size,y),(x+i*size+size+1,y+2),(x+i*size,y+2)],'v')

def eye(p,x,y,state,size=2):
 p.line([(x-1,y-1),(x+size,y-1)],'o')
 if state in ('hit','dead') or state=='idle_c':p.line([(x,y),(x+size,y+1)],'o')
 else:p.box((x,y,x+size-1,y),'z');p.dot(x+size-1,y,'o')

def face(p,x,y,state,kind='human',big=1):
 # Three quarter skull: forehead, eye socket, projecting nose, lit cheek and jaw.
 w=10*big;h=12*big
 p.poly([(x+2,y),(x+w-3,y),(x+w,y+3),(x+w,y+5),(x+w+3,y+7),
         (x+w+2,y+9),(x+w,y+9),(x+w-1,y+h),(x+3,y+h),(x,y+h-4),(x,y+3)],'b')
 p.poly([(x+3,y+2),(x+w-4,y+1),(x+w-3,y+4),(x+w-5,y+7),(x+2,y+7)],'l',None)
 p.poly([(x+w-4,y+6),(x+w-1,y+5),(x+w+2,y+7),(x+w-1,y+8)],'h',None)
 p.line([(x+w-3,y+9),(x+w,y+9)],'s')
 if kind in ('goblin','orc','ogre','kobold','lizard'):
  p.poly([(x+1,y+3),(x-5,y+1),(x-3,y+6),(x+1,y+7)],'b');p.line([(x-3,y+3),(x,y+5)],'l')
  p.poly([(x+w-3,y+h-1),(x+w-3,y+h-4),(x+w-1,y+h-2)],'w')
 if kind in ('orc','ogre'):
  p.poly([(x+w-4,y+7),(x+w+4,y+7),(x+w+5,y+10),(x+w+2,y+13),(x+w-5,y+12)],'b')
  p.line([(x+w-2,y+8),(x+w+3,y+8)],'l');p.line([(x+w-3,y+11),(x+w+3,y+11)],'s')
  for xx in (x+w-2,x+w+2):p.poly([(xx,y+12),(xx-1,y+7),(xx+2,y+9),(xx+1,y+12)],'w')
  p.line([(x+w-6,y+2),(x+w-1,y+2)],'l',2)
 if kind=='kobold':
  p.poly([(x+w-2,y+6),(x+w+7,y+6),(x+w+7,y+9),(x+w+1,y+11),(x+w-3,y+10)],'b')
  p.line([(x+w,y+7),(x+w+5,y+7)],'l');p.dot(x+w+5,y+8,'o')
 if kind=='lizard':
  p.poly([(x+w-3,y+5),(x+w+7,y+6),(x+w+6,y+10),(x+w-2,y+11)],'b')
  p.line([(x+w,y+7),(x+w+5,y+7)],'h');p.line([(x+w-1,y+9),(x+w+5,y+9)],'o')
 eye(p,x+w-3,y+4,state)
 if state in ('attack','windup'):
  p.line([(x+w-4,y+h-3),(x+w,y+h-3)],'o',2);p.dot(x+w-3,y+h-3,'w')
 if kind=='zombie':
  p.poly([(x+1,y+5),(x+4,y+6),(x+3,y+10),(x+1,y+9)],'c',None)
  p.line([(x+w-4,y+h-2),(x+w,y+h-3)],'r');p.dot(x+w-1,y+h-3,'w')

def featherwing(p,root,tip,spread=12,stone=False,far=False):
 sx,sy=root;tx,ty=tip;mid=((sx+tx)*.5-2,(sy+ty)*.5-3)
 pts=[root,mid,tip]
 for j in range(6):
  u=j/6;bx=tx+(sx-tx)*u;by=ty+(sy-ty)*u
  pts.extend([(bx-3,by+spread*(1-u*.55)),(bx+1,by+spread*(1-u*.55)-3)])
 pts.append((sx-3,sy+8));p.poly(pts,'s' if far else 'b')
 if not far:
  p.poly([root,mid,tip,(tx+1,ty+spread*.32),((sx+tx)*.5-2,(sy+ty)*.5+spread*.22),(sx-2,sy+5)],'l',None)
 p.line([root,mid,tip],'b' if far else 'h',2)
 for j in range(5):
  u=j/6;bx=tx+(sx-tx)*u;by=ty+(sy-ty)*u
  p.line([(bx,by+2),(bx-2,by+spread*(1-u*.55)-2)],'b' if far else 'l')
 if not far:
  for j in range(5):
   u=(j+.7)/6;bx=tx+(sx-tx)*u;by=ty+(sy-ty)*u+spread*.15
   p.poly([(bx-2,by-1),(bx+1,by-2),(bx+3,by+1),(bx+1,by+4),(bx-1,by+3)],'b',None)
   p.line([(bx-1,by),(bx+1,by+2)],'h')
  p.line([(sx-3,sy+3),((sx+tx)*.5-2,(sy+ty)*.5+spread*.3)],'s')
 if stone:p.line([(sx-2,sy+3),(tx+1,ty+spread*.5)],'s')

def batwing(p,root,tip,span=12,far=False):
 sx,sy=root;tx,ty=tip;mx=(sx+tx)*.5;my=min(sy,ty)-4
 p.poly([root,(mx,my),tip,(tx+3,ty+span),(mx+2,my+span),(sx-4,sy+10)],'s' if far else 'r')
 p.line([root,(mx,my),tip],'l',2)
 p.line([(mx,my),(tx+3,ty+span)],'p');p.line([(mx,my),(mx+2,my+span)],'p')

def weapon(p,hand,pose,kind):
 x,y=hand
 if pose=='dead':
  a=(x,y);b=(min(55,x+17),min(59,y+1))
 elif pose=='windup':a=(x,y);b=(max(10,x-10),max(7,y-20))
 elif pose=='attack':a=(x,y);b=(min(49,x+15),y+4)
 elif pose=='hit':a=(x,y);b=(max(10,x-7),max(8,y-15))
 else:a=(x,y);b=(min(50,x+4),max(9,y-22))
 if kind=='axe':b=(min(47,b[0]),b[1])
 vx=b[0]-a[0];vy=b[1]-a[1];ln=max(1,math.hypot(vx,vy));nx=-vy/ln;ny=vx/ln
 if kind in ('sword','knife'):
  p.poly([(x-ny*2,y+nx*2),(x+ny*2,y-nx*2),(b[0]+nx*2,b[1]+ny*2),b,(b[0]-nx*2,b[1]-ny*2)],'m')
  p.line([(x+nx,y+ny),b],'i');p.line([(x-nx*4,y-ny*4),(x+nx*4,y+ny*4)],'y',2)
  limb(p,(x-vx/ln*4,y-vy/ln*4),(x,y),1,'t','u')
 elif kind=='spear':
  limb(p,(x-vx/ln*8,y-vy/ln*8),b,1,'t','u')
  p.poly([(b[0]-nx*2,b[1]-ny*2),(b[0]+vx/ln*6,b[1]+vy/ln*6),(b[0]+nx*2,b[1]+ny*2)],'m');p.line([b,(b[0]+vx/ln*5,b[1]+vy/ln*5)],'i')
 elif kind=='staff':
  limb(p,(x-vx/ln*8,y-vy/ln*8),b,1,'t','u')
  p.oval((b[0]-4,b[1]-4,b[0]+4,b[1]+4),'g');p.poly([(b[0],b[1]-3),(b[0]+2,b[1]),(b[0],b[1]+2),(b[0]-2,b[1])],'q');p.dot(b[0]-1,b[1]-1,'w')
 elif kind=='pick':
  limb(p,(x-vx/ln*5,y-vy/ln*5),b,1,'t','u')
  p.poly([(b[0]-8,b[1]+4),(b[0]-6,b[1]-1),(b[0]-1,b[1]-3),(b[0]+5,b[1]-2),(b[0]+9,b[1]+3),(b[0]+3,b[1]),(b[0]-2,b[1])],'m');p.line([(b[0]-5,b[1]-1),(b[0]+3,b[1]-1)],'n')
 elif kind=='axe':
  limb(p,(x-vx/ln*5,y-vy/ln*5),b,1,'t','u')
  ux=vx/ln;uy=vy/ln
  def ab(side,along):return (b[0]+nx*side+ux*along,b[1]+ny*side+uy*along)
  p.poly([ab(-3,-4),ab(7,-6),ab(10,-3),ab(10,4),ab(6,6),ab(-3,3)],'m')
  p.line([ab(9,-3),ab(9,3)],'i',2);p.line([ab(2,-4),ab(2,4)],'n')
 else:
  limb(p,a,b,2,'t','u');end=(b[0]-vx/ln*7,b[1]-vy/ln*7)
  limb(p,end,b,4,'t','u');p.line([(b[0]-1,b[1]-2),(end[0]-1,end[1]-2)],'v');p.dot(b[0]+2,b[1],'m')

HUM={
 'goblin-scout':dict(kind='goblin',width=8,height=20,head=(22,17),weapon='knife',cloth='t'),
 'goblin-brute':dict(kind='goblin',width=17,height=23,head=(25,12),weapon='club',cloth='r'),
 'orc-warrior':dict(kind='orc',width=22,height=24,head=(25,10),weapon='axe',cloth='m',armor=True),
 'orc-01':dict(kind='orc',width=20,height=25,head=(25,10),weapon='club',cloth='r'),
 'orc-shaman':dict(kind='orc',width=9,height=24,head=(23,12),weapon='staff',cloth='r',robe=True),
 'ogre-club':dict(kind='ogre',width=17,height=25,head=(23,9),weapon='club',cloth='t'),
 'bandit-mask':dict(kind='human',width=8,height=26,head=(24,9),weapon='sword',cloth='a',cape=True),
 'lizardman-spear':dict(kind='lizard',width=9,height=23,head=(24,12),weapon='spear',cloth='m',tail=True),
 'zombie-01':dict(kind='zombie',width=10,height=24,head=(25,12),weapon=None,cloth='a'),
 'kobold-digger':dict(kind='kobold',width=9,height=22,head=(23,14),weapon='pick',cloth='t'),
 'mage-rogue':dict(kind='human',width=8,height=26,head=(24,10),weapon='staff',cloth='a',robe=True,cape=True),
 'knight-fallen':dict(kind='human',width=11,height=26,head=(25,9),weapon='sword',cloth='m',armor=True,cape=True),
 'kappa-01':dict(kind='kappa',width=12,height=22,head=(25,16),weapon=None,cloth='t')}

def fallenhuman(p,cfg):
 k=cfg['kind'];wide=cfg['width'];cloth=cfg['cloth']
 # Collapse at the waist and knees; shoulder/face lie sidewards, separate dropped weapon.
 limb(p,(18,53),(10,58),4,cloth,'u');limb(p,(25,53),(21,58),4,cloth,'u')
 p.poly([(17,49),(31,44),(41,48),(38,56),(25,58),(14,55)],cloth)
 p.poly([(21,49),(31,46),(36,49),(27,53)],'l' if k!='human' else 'n',None)
 limb(p,(36,50),(45,58),3);p.oval((42,55,48,60),'b')
 face(p,39,45,'dead',k,big=1)
 if cfg.get('armor'):p.poly([(30,45),(38,46),(37,51),(31,52)],'m');p.line([(31,46),(36,47)],'i')
 if cfg.get('cape'):p.poly([(15,46),(30,47),(28,54),(6,57),(10,51)],'r')
 if cfg.get('weapon'):weapon(p,(28,48 if cfg['weapon']=='axe' else 54),'dead',cfg['weapon'])

def humanoid(slug,pose,cell):
 p=Pen(cell,slug);cfg=HUM[slug];k=cfg['kind'];W=cfg['width'];H=cfg['height'];cloth=cfg['cloth']
 if pose=='dead':fallenhuman(p,cfg);return p.im
 dx,dy,hd,arm,stride=R[pose];cx=28+dx;top=29+dy;hip=(cx,top+H-12)
 hx,hy=cfg['head'];hx+=dx+hd*.45;hy+=dy
 if cfg.get('tail'):
  p.poly([(cx-6,hip[1]-3),(18,48+dy),(8,47+stride),(5,40+stride),(9,46+stride),(18,43+dy),(cx-3,hip[1]-7)],'b');p.line([(8,44+stride),(18,45+dy)],'l')
 if k=='kappa':
  p.oval((cx-18,top-2,cx+1,top+21),'s');p.oval((cx-17,top,cx-3,top+18),'t');p.line([(cx-14,top+2),(cx-8,top+8),(cx-15,top+14)],'u');p.line([(cx-8,top+8),(cx-4,top+9)],'u')
 if cfg.get('cape'):
  p.poly([(cx-5,top-5),(cx-13,top+2),(cx-15-arm*.3,51),(cx-7,49),(cx-5,53),(cx+2,47)],'r');p.line([(cx-10,top+4),(cx-12-arm*.3,46)],'p')
 if slug=='orc-warrior':
  sx=cx-15-arm*.15;sy=top+8
  p.poly([(sx-4,sy-8),(sx+3,sy-10),(sx+7,sy-6),(sx+6,sy+6),(sx+1,sy+10),(sx-5,sy+4)],'t')
  p.poly([(sx-2,sy-7),(sx+2,sy-8),(sx+4,sy-5),(sx+3,sy+5),(sx,sy+7),(sx-3,sy+3)],'m')
  p.line([(sx-2,sy-6),(sx+1,sy-7),(sx+2,sy+4)],'n');p.oval((sx-1,sy-1,sx+2,sy+2),'y');p.dot(sx,sy,'e')
 # Far arm and leg, then torso/front leg, leaving readable joint overlap.
 limb(p,(cx-6,top+1),(cx-11-arm*.25,top+10),3,'s','b')
 limb(p,hip,(cx-8-stride*.5,53),4,cloth,'m' if cloth=='m' else 'u')
 limb(p,(cx-8-stride*.5,53),(cx-10-stride,58),3,cloth,'u');p.poly([(cx-13-stride,57),(cx-7-stride,57),(cx-4-stride,60),(cx-13-stride,60)],'t')
 p.poly([(cx-W/2,top-6),(cx+W/2,top-7),(cx+W*.6,top+6),(cx+W*.45,hip[1]+3),(cx-W*.65,hip[1]+2),(cx-W*.75,top+5)],'b')
 p.poly([(cx-W*.45,top-4),(cx+W*.25,top-5),(cx+W*.4,top+1),(cx+W*.15,top+8),(cx-W*.5,top+7)],'l',None)
 p.poly([(cx-W*.6,top+1),(cx-W*.4,top+6),(cx-W*.45,hip[1]),(cx-W*.65,hip[1]),(cx-W*.7,top+5)],'s',None)
 if k in ('orc','ogre','goblin'):
  p.poly([(cx-W*.3,top+1),(cx+W*.25,top),(cx+W*.35,top+3),(cx+W*.15,top+5),(cx-W*.3,top+5)],'h',None)
  p.line([(cx-W*.2,top+7),(cx+W*.3,top+7)],'b');p.line([(cx,top+9),(cx+3,top+10)],'s')
 if cfg.get('robe'):
  p.poly([(cx-7,top+5),(cx+7,top+5),(cx+13+stride*.3,57),(cx+4,59),(cx-1,56),(cx-12,59)],cloth)
  p.line([(cx-4,top+11),(cx-7,55)],'m' if cloth=='a' else 'p');p.line([(cx+3,top+9),(cx+7,56)],'n' if cloth=='a' else 'q')
 else:
  p.poly([(cx-8,hip[1]-3),(cx+7,hip[1]-3),(cx+9,hip[1]+7),(cx-8,hip[1]+7)],cloth)
  p.poly([(cx-6,hip[1]-1),(cx+1,hip[1]-1),(cx+2,hip[1]+4),(cx-4,hip[1]+4)],'n' if cloth=='m' else 'u',None)
  p.line([(cx+3,hip[1]),(cx+6,hip[1]+5)],'s' if cloth=='m' else 't')
  limb(p,(cx+3,hip[1]+3),(cx+6+stride*.7,53-(2 if pose=='move' else 0)),4,cloth,'n' if cloth=='m' else 'u')
  limb(p,(cx+6+stride*.7,53-(2 if pose=='move' else 0)),(cx+6+stride,58),3,cloth,'n' if cloth=='m' else 'u')
  p.poly([(cx+3+stride,57),(cx+10+stride,57),(cx+13+stride,60),(cx+3+stride,60)],'t');p.line([(cx+6+stride,58),(cx+10+stride,58)],'u')
 p.line([(cx-8,hip[1]-2),(cx+7,hip[1]-2)],'t',2);p.box((cx-1,hip[1]-3,cx+2,hip[1]-1),'y')
 if cfg.get('armor'):
  p.poly([(cx-7,top-6),(cx+6,top-7),(cx+7,top+4),(cx+2,top+10),(cx-6,top+8)],'m');p.line([(cx-4,top-4),(cx+4,top-5),(cx+4,top+2)],'i');p.line([(cx,top-2),(cx,top+7)],'n')
  p.poly([(cx-9,top),(cx-12,top+3),(cx-10,top+7),(cx-6,top+5)],'m');p.line([(cx-10,top+2),(cx-8,top+2)],'i')
  p.poly([(cx+3,top+3),(cx+7,top+2),(cx+7,top+7),(cx+3,top+9)],'s');p.line([(cx+4,top+4),(cx+6,top+4)],'n')
  for px,py in [(cx-5,top-3),(cx+4,top-4),(cx-4,top+6)]:p.dot(px,py,'y')
  p.line([(cx-8,hip[1]+2),(cx+7,hip[1]+2)],'n')
  p.oval((cx-9,top-7,cx-1,top),'m');p.line([(cx-7,top-6),(cx-3,top-6)],'n')
 elif slug=='ogre-club':
  p.line([(cx-5,top+5),(cx+4,top+5)],'s');p.line([(cx-3,top+8),(cx+3,top+8)],'s');p.dot(cx,top+11,'s')
 elif k in ('orc','goblin','kobold'):
  p.line([(cx-6,top-5),(cx+4,hip[1]-3)],'t',3);p.line([(cx-6,top-5),(cx+4,hip[1]-3)],'u')
 # Forward elbow is displaced, wrist follows independently.
 shoulder=(cx+W*.35,top-3);elbow=(cx+W*.55+arm*.4,top+7-arm*.6)
 hand=(min(46,cx+W*.6+arm*.8),top+11-arm*.65)
 limb(p,shoulder,elbow,4 if k in ('orc','ogre') else 3);limb(p,elbow,hand,3 if k in ('orc','ogre') else 2);p.oval((hand[0]-2,hand[1]-2,hand[0]+2,hand[1]+2),'b')
 p.line([(elbow[0]-2,elbow[1]+1),(elbow[0]+1,elbow[1]+2)],'s')
 if k in ('orc','goblin','ogre'):
  p.line([(shoulder[0]-2,shoulder[1]+1),(shoulder[0]+1,shoulder[1]+2)],'h');p.line([(elbow[0]-1,elbow[1]-1),(elbow[0]+1,elbow[1]-1)],'l')
 if cfg.get('armor'):
  limb(p,(elbow[0]+1,elbow[1]),hand,2,'m','i')
 if cfg.get('weapon'):weapon(p,hand,pose,cfg['weapon'])
 elif k=='zombie':
  limb(p,elbow,(min(53,hand[0]+8),hand[1]-3),2);claw(p,min(52,hand[0]+6),hand[1]-3)
 elif k=='kappa':claw(p,hand[0],hand[1],3,1)
 # Neck connects into shoulder; face painted over rear collar.
 p.poly([(hx+3,hy+8),(hx+10,hy+9),(cx+5,top-4),(cx-3,top-3)],'s')
 face(p,hx,hy,pose,k,big=1.2 if k in ('orc','ogre') else 1)
 if slug=='bandit-mask':
  p.poly([(hx,hy),(hx+7,hy-3),(hx+12,hy+1),(hx+9,hy+4),(hx+1,hy+4)],'a');p.line([(hx+2,hy+1),(hx+8,hy+1)],'m')
  p.poly([(hx+5,hy+7),(hx+12,hy+7),(hx+10,hy+12),(hx+5,hy+11)],'a');p.line([(hx+7,hy+8),(hx+11,hy+8)],'m')
 elif slug=='mage-rogue':
  p.poly([(hx-2,hy+5),(hx,hy-2),(hx+5,hy-7),(hx+11,hy-3),(hx+12,hy+5),(hx+7,hy+1),(hx+2,hy+3)],'a');p.line([(hx+1,hy-1),(hx+5,hy-5),(hx+9,hy-2)],'m')
 elif slug=='knight-fallen':
  p.poly([(hx-1,hy+7),(hx-1,hy+1),(hx+3,hy-3),(hx+9,hy-2),(hx+12,hy+3),(hx+11,hy+7)],'m');p.line([(hx+2,hy),(hx+8,hy)],'i');p.line([(hx+5,hy+4),(hx+11,hy+4)],'o');p.dot(hx+10,hy+4,'q');p.line([(hx+5,hy+6),(hx+7,hy+11)],'n')
  p.poly([(hx+2,hy-3),(hx-1,hy-7),(hx+3,hy-6),(hx+6,hy-3)],'r')
 elif k=='kappa':
  p.poly([(hx-2,hy+2),(hx-1,hy-2),(hx+5,hy-4),(hx+11,hy-2),(hx+13,hy+2)],'b');p.oval((hx+1,hy-3,hx+10,hy),'v');p.line([(hx+3,hy-2),(hx+8,hy-2)],'i')
  p.poly([(hx+8,hy+7),(hx+17,hy+7),(hx+15,hy+10),(hx+9,hy+11)],'y');p.line([(hx+10,hy+9),(hx+15,hy+9)],'t')
 elif k=='kobold':
  p.poly([(hx-2,hy+2),(hx-1,hy-1),(hx+7,hy-2),(hx+11,hy+2)],'t');p.box((hx+7,hy-1,hx+9,hy+1),'y');p.dot(hx+8,hy,'w')
 elif slug=='orc-shaman':
  p.poly([(hx-2,hy+1),(hx-3,hy-5),(hx+2,hy-1),(hx+4,hy-5),(hx+6,hy)],'v');p.line([(hx+1,hy+6),(hx+7,hy+8)],'q');p.line([(cx-4,top+1),(cx+2,top+3)],'v')
 elif k!='zombie':
  p.poly([(hx+1,hy+1),(hx+1,hy-2),(hx+6,hy-4),(hx+9,hy),(hx+5,hy)],'s');p.line([(hx+3,hy-1),(hx+6,hy-2)],'l')
 return p.im

WINGED={'harpy-cliff','harpy-01','gargoyle-stone','imp-mischief','angel-fallen'}

def winged(slug,pose,cell):
 p=Pen(cell,slug);stone=slug=='gargoyle-stone';imp=slug=='imp-mischief';angel=slug=='angel-fallen'
 if stone:p.c.palette['r']=p.c.palette['s'];p.c.palette['p']=p.c.palette['l']
 dx,dy,hd,arm,stride=R[pose];cx=32+dx*.5;hy=13+dy
 if pose=='dead':
  if stone:
   p.poly([(9,55),(14,49),(22,46),(31,49),(40,53),(36,59),(15,60)],'b');p.line([(16,52),(21,49),(29,52)],'l');p.line([(25,50),(24,55),(29,58)],'s')
  else:
   featherwing(p,(35,48),(11,49),9);p.poly([(22,52),(29,48),(40,51),(38,57),(23,59)],'b');p.line([(25,53),(33,52)],'l')
  limb(p,(34,54),(42,59),2);claw(p,41,58,3,2)
  face(p,40,46,'dead','goblin' if imp or stone else 'human')
  p.line([(41,46),(37,44),(28,46),(25,48)],'m' if angel else 't',3)
  return p.im
 tips={'idle_a':(5,12),'idle_b':(6,8),'idle_c':(4,18),'windup':(10,6),'move':(5,10),'attack':(5,29),'recover':(4,22),'hit':(8,32)}
 tx,ty=tips[pose]
 if imp or stone:batwing(p,(cx+1,29+dy),(50,ty+1),11,True)
 else:featherwing(p,(cx+1,27+dy),(50,ty+3),10,far=True)
 # Tail/body taper distinguishes demon, winged woman, and stone gargoyle.
 if imp:
  p.line([(cx-5,42+dy),(cx-15,49+stride),(cx-23,43),(cx-22,38)],'o',3)
  p.line([(cx-5,42+dy),(cx-15,49+stride),(cx-23,43),(cx-22,38)],'b')
  p.poly([(cx-24,38),(cx-24,34),(cx-19,37),(cx-22,40)],'r')
 elif not angel and not stone:
  p.poly([(cx-5,40+dy),(cx-17,44+stride),(cx-22,53),(cx-17,50),(cx-14,55),(cx-9,48),(cx-5,47)],'s')
  p.line([(cx-8,43+dy),(cx-17,49)],'l')
 if angel:
  p.poly([(cx-5,27+dy),(cx-12,36+dy),(cx-14,52),(cx-8,49),(cx-3,55),(cx+5,48)],'r');p.line([(cx-9,34+dy),(cx-10,47)],'p')
 torso=[(cx-5,25+dy),(cx+4,24+dy),(cx+7,30+dy),(cx+5,43+dy),(cx-4,46+dy),(cx-8,33+dy)]
 p.poly(torso,'b');p.poly([(cx-4,27+dy),(cx+2,26+dy),(cx+3,32+dy),(cx-3,36+dy)],'l',None)
 p.line([(cx-3,38+dy),(cx+3,38+dy)],'s')
 if angel:
  p.poly([(cx-5,31+dy),(cx+4,30+dy),(cx+5,38+dy),(cx-4,39+dy)],'m');p.line([(cx-2,32+dy),(cx+2,32+dy)],'n')
 elif not imp and not stone:
  p.poly([(cx-6,32+dy),(cx+4,32+dy),(cx+5,37+dy),(cx-4,37+dy)],'t');p.line([(cx-3,33+dy),(cx+2,34+dy)],'v')
 feet=60 if stone else (56 if pose!='move' else 52)
 for side in (-1,1):
  hip=(cx+side*3,43+dy);knee=(cx+side*(4+stride*.45),49+dy)
  ankle=(cx+side*(6+stride*.65),feet-2)
  limb(p,hip,knee,3,'s' if side==-1 else 'b','b' if side==-1 else 'l');limb(p,knee,ankle,2)
  if angel:p.poly([(ankle[0]-2,ankle[1]-1),(ankle[0]+3,ankle[1]-1),(ankle[0]+5,feet),(ankle[0]-2,feet)],'m')
  else:claw(p,ankle[0]-1,feet-2,3,2)
 # Neck overlaps clavicle, preventing floating head appearance.
 p.poly([(cx-2,hy+9),(cx+5,hy+8),(cx+4,27+dy),(cx-4,28+dy)],'b')
 face(p,cx-2+hd*.25,hy,pose,'goblin' if imp or stone else 'human')
 if stone or imp:
  for x in (cx-3,cx+4):p.poly([(x,hy+2),(x-2,hy-5),(x+2,hy-1),(x+2,hy+3)],'v')
  if stone:
   p.line([(cx,31+dy),(cx-2,34+dy),(cx,38+dy)],'s');p.line([(cx+2,hy+1),(cx+1,hy+3)],'s')
 else:
  hair='m' if angel else 't'
  p.poly([(cx-4,hy+5),(cx-5,hy),(cx-1,hy-3),(cx+4,hy-3),(cx+9,hy+1),(cx+3,hy+1),(cx+1,hy+6),(cx-1,hy+12),(cx-7-arm*.2,hy+20),(cx-6,hy+9)],hair)
  p.line([(cx-2,hy-1),(cx+4,hy-1)],'n' if angel else 'u');p.line([(cx-3,hy+4),(cx-4,hy+11),(cx-8-arm*.2,hy+17)],'n' if angel else 'u')
  eye(p,cx+5+hd*.25,hy+4,pose)
 if angel:
  p.line([(cx-5,hy-5),(cx+6,hy-5)],'y');p.dot(cx+8,hy-5,'e')
  hand=(cx+10+arm*.5,35+dy-arm*.35)
  limb(p,(cx+4,29+dy),(cx+7,35+dy),2,'m','n');limb(p,(cx+7,35+dy),hand,2,'m','n')
  weapon(p,hand,pose,'sword')
 if imp or stone:batwing(p,(cx-4,29+dy),(tx,ty),16)
 else:featherwing(p,(cx-4,29+dy),(tx,ty),15)
 return p.im

SPIRITS={'leafling-01','sparkit-01','aqualing-01'}
def spirit(slug,pose,cell):
 p=Pen(cell,slug);dx,dy,hd,arm,stride=R[pose];cx=30+dx;cy=29+dy;leaf=slug=='leafling-01';water=slug=='aqualing-01'
 if pose=='dead':
  p.oval((16,48,46,60),'s');p.oval((20,50,42,58),'b');p.line([(24,53),(33,52),(38,54)],'l')
  if leaf:
   p.poly([(27,53),(10,47),(7,50),(18,57),(27,55)],'l');p.line([(10,50),(24,55)],'b')
  elif water:
   p.oval((8,56,14,59),'b');p.dot(18,55,'h');p.line([(23,58),(36,58)],'h')
  else:
   p.poly([(23,54),(17,47),(22,49),(23,45),(26,52)],'l');p.dot(31,51,'e')
  eye(p,37,54,'dead');return p.im
 # Underbody is an authored tapered spiral, feet absent by design.
 p.poly([(cx-8,cy+8),(cx+10,cy+6),(cx+7,cy+17),(cx,cy+21),(cx-9-stride,cy+23),(cx-4,cy+17)],'s')
 p.poly([(cx-3,cy+10),(cx+7,cy+9),(cx+4,cy+17),(cx-4,cy+20)],'b',None)
 if leaf:
  for i,(tx,ty) in enumerate([(cx-15,cy-13-arm*.3),(cx+3,cy-21),(cx+17,cy-12+arm*.5)]):
   rt=(cx+(i-1)*4,cy-2);p.poly([rt,(tx-3,ty+4),(tx,ty),(tx+4,ty+4),(rt[0]+2,rt[1]+1)],'b');p.line([rt,(tx,ty+2)],'l')
 elif water:
  p.poly([(cx-9,cy-4),(cx-6,cy-14),(cx+1,cy-22+hd),(cx+7,cy-14),(cx+10,cy-5)],'b');p.line([(cx-4,cy-12),(cx,cy-18+hd)],'l',2)
 else:
  p.poly([(cx-10,cy-4),(cx-12,cy-14),(cx-6,cy-10),(cx-3,cy-24-hd),(cx+1,cy-13),(cx+8,cy-18),(cx+5,cy-8),(cx+12,cy-12),(cx+10,cy-2)],'b');p.poly([(cx-6,cy-6),(cx-3,cy-14),(cx,cy-8),(cx+5,cy-11),(cx+3,cy-3)],'l',None);p.line([(cx-2,cy-7),(cx,cy-4)],'e')
 if leaf:
  p.poly([(cx-11,cy-5),(cx-8,cy-9),(cx-3,cy-8),(cx,cy-11),(cx+8,cy-7),(cx+12,cy-2),(cx+10,cy+7),(cx+5,cy+13),(cx-3,cy+11),(cx-9,cy+6)],'b')
  p.line([(cx-7,cy+1),(cx-3,cy+4),(cx-6,cy+8)],'s');p.line([(cx-3,cy+4),(cx+1,cy+6)],'l')
 elif water:p.oval((cx-12,cy-9,cx+12,cy+12),'b')
 else:
  p.poly([(cx-9,cy-7),(cx-6,cy-10),(cx+4,cy-9),(cx+8,cy-5),(cx+12,cy),(cx+10,cy+10),(cx+6,cy+12),(cx+2,cy+17),(cx-3,cy+12),(cx-9,cy+8),(cx-11,cy)],'b')
  p.poly([(cx-7,cy+2),(cx-3,cy),(cx-4,cy+5),(cx+1,cy+5),(cx-2,cy+10),(cx-3,cy+6),(cx-8,cy+6)],'y',None)
 p.poly([(cx-7,cy-6),(cx+2,cy-8),(cx+6,cy-4),(cx-1,cy),(cx-8,cy-1)],'l',None)
 p.poly([(cx+7,cy-1),(cx+14,cy+2),(cx+12,cy+5),(cx+6,cy+5)],'l');p.dot(cx+12,cy+3,'h')
 eye(p,cx+5,cy-1,pose);p.line([(cx+5,cy+7),(cx+10,cy+7)],'s')
 if pose=='attack':p.line([(cx+5,cy+7),(cx+9,cy+7)],'o',2)
 for side in (-1,1):
  hand=(cx+side*(15+arm*.25),cy+6-arm*.25)
  limb(p,(cx+side*9,cy+3),hand,2,'s' if side==-1 else 'b','b' if side==-1 else 'l')
  p.oval((hand[0]-2,hand[1]-2,hand[0]+2,hand[1]+2),'b')
 if water:
  p.line([(cx-7,cy+2),(cx-8,cy+6)],'h');p.dot(cx-5,cy-4,'i');p.oval((8,30+stride,11,34+stride),'l')
 elif leaf:p.line([(cx-8,cy+10),(cx-3,cy+14),(cx+2,cy+12)],'l')
 else:p.dot(cx-6,cy-3,'e');p.poly([(11,26+stride),(9,22+stride),(13,24+stride)],'y')
 return p.im

def beasthead(p,x,y,pose,kind='behemoth'):
 if kind=='griffin':
  # Low sloping eagle crown, cheek feather notches and ruffed neck silhouette.
  p.poly([(x-4,y+3),(x-3,y),(x+2,y-3),(x+7,y-2),(x+11,y),
          (x+13,y+3),(x+12,y+6),(x+9,y+10),(x+7,y+13),
          (x+4,y+11),(x+2,y+15),(x,y+12),(x-4,y+13),
          (x-3,y+9),(x-6,y+8),(x-3,y+5)],'v')
  p.poly([(x-2,y+2),(x+2,y),(x+6,y),(x+10,y+2),(x+6,y+4),(x+1,y+5)],'w',None)
  p.poly([(x+1,y+7),(x+5,y+5),(x+8,y+6),(x+6,y+10),(x+3,y+12),(x+1,y+10)],'u',None)
  p.line([(x-1,y+6),(x+2,y+8),(x+1,y+10)],'w')
  p.line([(x-3,y+9),(x,y+10),(x-1,y+12)],'u')
  # Upper bill slopes into a clearly downturned hook; lower bill articulates.
  p.poly([(x+10,y+3),(x+15,y+4),(x+18,y+6),(x+17,y+9),
          (x+15,y+11),(x+15,y+7),(x+10,y+7)],'y')
  p.line([(x+11,y+4),(x+15,y+5)],'e');p.dot(x+14,y+6,'g')
  if pose in ('attack','windup'):
   p.poly([(x+9,y+7),(x+14,y+8),(x+14,y+11),(x+9,y+11)],'c')
   p.poly([(x+9,y+10),(x+14,y+11),(x+13,y+13),(x+9,y+12)],'y');p.line([(x+10,y+11),(x+12,y+12)],'e')
  else:p.poly([(x+9,y+8),(x+14,y+8),(x+12,y+10),(x+9,y+10)],'y')
  eye(p,x+9,y+2,pose)
  p.line([(x+6,y),(x+9,y),(x+12,y+1)],'u',2)
  p.line([(x+4,y+5),(x+7,y+7),(x+5,y+9)],'w')

 else:
  p.poly([(x,y+2),(x+6,y-2),(x+13,y),(x+16,y+5),(x+18,y+7),(x+18,y+13),(x+13,y+16),(x+3,y+15),(x-3,y+9)],'b')
  p.poly([(x+3,y+1),(x+8,y),(x+11,y+2),(x+5,y+5),(x+1,y+5)],'l',None)
  p.poly([(x+9,y+7),(x+16,y+6),(x+17,y+9),(x+12,y+11),(x+6,y+10)],'l',None)
  p.poly([(x+2,y+7),(x+5,y+6),(x+7,y+9),(x+5,y+12),(x+2,y+11)],'s',None)
  p.line([(x+6,y+2),(x+9,y+2)],'h')
  p.line([(x+11,y+12),(x+17,y+12)],'s');p.dot(x+16,y+8,'o');eye(p,x+9,y+5,pose)
  p.poly([(x+1,y+2),(x-5,y-1),(x-6,y-11),(x-2,y-8),(x+2,y-1)],'v');p.line([(x-4,y-8),(x-2,y-3)],'w')
  p.poly([(x+10,y+2),(x+8,y-5),(x+11,y-11),(x+12,y-5),(x+14,y-1)],'v');p.line([(x+11,y-8),(x+11,y-3)],'w')
  p.poly([(x+11,y+14),(x+15,y+16),(x+19,y+13),(x+20,y+8),(x+18,y+5),(x+18,y+10),(x+16,y+12),(x+12,y+12)],'v')
  p.line([(x+14,y+14),(x+17,y+13),(x+18,y+10)],'w')
  p.poly([(x+3,y+14),(x+5,y+11),(x+8,y+12),(x+7,y+15)],'s',None)
  if pose=='attack':p.line([(x+9,y+12),(x+17,y+12)],'c',3);p.line([(x+10,y+11),(x+16,y+11)],'w')

def quadruped(slug,pose,cell):
 p=Pen(cell,slug);griff=slug=='griffin-sky';dx,dy,hd,arm,stride=R[pose]
 if pose=='dead':
  p.poly([(13,50),(24,43),(34,45),(42,51),(44,57),(35,60),(19,60),(9,56)],'b')
  p.poly([(17,51),(25,46),(31,48),(32,53),(20,55)],'l',None)
  limb(p,(25,53),(15,57),4);limb(p,(34,55),(41,57),4)
  if griff:featherwing(p,(33,48),(8,46),12)
  beasthead(p,39,43,'dead','griffin' if griff else 'behemoth')
  p.line([(11,54),(6,51),(6,43),(10,42)],'o',3);p.line([(11,54),(6,51),(6,43),(10,42)],'b')
  return p.im
 # Long tail is anatomically rooted behind pelvis; tuft is griffin specific.
 p.poly([(20+dx,38+dy),(11,37+stride*.4),(6,32),(5,23),(9,18),(14,20),(11,22),(8,23),(9,30),(15,32+stride*.4),(22+dx,33+dy)],'b')
 p.line([(10,32),(14,34+stride*.4),(20+dx,35+dy)],'l')
 if griff:p.poly([(10,19),(12,16),(17,16),(17,20),(13,23),(9,22)],'t');p.line([(13,18),(16,18)],'u')
 if griff:featherwing(p,(36+dx,33+dy),(18,9+arm*.3),17,far=True)
 # Far legs, barrel, massive shoulder, foreground limbs.
 for x in (21,39):
  root=(x+dx,42+dy);knee=(x+dx-stride*.45,51);foot=(x-3-stride*.4,58)
  limb(p,root,knee,4,'s','b');limb(p,knee,foot,3,'s','b');p.poly([(foot[0]-3,57),(foot[0]+4,57),(foot[0]+6,60),(foot[0]-3,60)],'s')
 p.poly([(14+dx,30+dy),(24+dx,25+dy),(37+dx,25+dy),(45+dx,31+dy),(44+dx,44+dy),(35+dx,49+dy),(20+dx,48+dy),(12+dx,41+dy)],'b')
 p.poly([(18+dx,30+dy),(26+dx,27+dy),(36+dx,28+dy),(35+dx,33+dy),(23+dx,36+dy),(15+dx,34+dy)],'l',None)
 p.poly([(19+dx,41+dy),(26+dx,39+dy),(37+dx,40+dy),(35+dx,46+dy),(26+dx,47+dy)],'s',None)
 p.line([(26+dx,34+dy),(27+dx,38+dy)],'h');p.line([(30+dx,37+dy),(37+dx,37+dy)],'l')
 p.poly([(15+dx,36+dy),(18+dx,38+dy),(21+dx,42+dy),(19+dx,46+dy),(15+dx,43+dy)],'s',None)
 p.poly([(23+dx,28+dy),(28+dx,28+dy),(30+dx,30+dy),(28+dx,32+dy),(23+dx,32+dy)],'h',None)
 p.line([(22+dx,37+dy),(25+dx,38+dy),(28+dx,37+dy)],'b')
 p.line([(31+dx,44+dy),(36+dx,43+dy)],'b')
 for x in (19,40):
  root=(x+dx,40+dy);knee=(x+dx+stride*.6,49-(2 if pose=='move' and x==40 else 0));foot=(x+stride*.55+(2 if x==19 else 0),58)
  # Rounded broad thigh overlapping torso, bent hock, compressed ankle and padded paw.
  p.poly([(root[0]-6,root[1]-3),(root[0]+3,root[1]-4),(root[0]+7,root[1]+1),(knee[0]+4,knee[1]+2),(knee[0]-1,knee[1]+5),(knee[0]-5,knee[1]+2),(root[0]-7,root[1]+4)],'b')
  p.poly([(root[0]-4,root[1]-2),(root[0]+2,root[1]-2),(root[0]+4,root[1]+1),(knee[0]+1,knee[1]),(knee[0]-2,knee[1]+1),(root[0]-4,root[1]+2)],'l',None)
  p.poly([(knee[0]-3,knee[1]+1),(knee[0]+3,knee[1]+1),(foot[0]+3,57),(foot[0]+5,58),(foot[0]+5,60),(foot[0]-4,60),(foot[0]-4,57),(foot[0]-2,55)],'b')
  p.line([(knee[0]-1,knee[1]+3),(foot[0]-1,56)],'l',2)
  p.poly([(foot[0]-3,57),(foot[0]+3,56),(foot[0]+7,58),(foot[0]+6,60),(foot[0]-4,60)],'b')
  p.line([(foot[0]-1,57),(foot[0]+3,57)],'h');claw(p,foot[0]+1,58,3,2)
  p.line([(root[0]-2,root[1]+1),(root[0]+1,root[1]+3)],'h')
 # Massive hunched neck and coherent dorsal ridge.
 p.poly([(31+dx,29+dy),(34+dx,21+dy),(40+dx,19+dy),(46+dx,27+dy),(47+dx,39+dy),(39+dx,42+dy)],'b')
 p.poly([(34+dx,28+dy),(38+dx,23+dy),(40+dx,24+dy),(40+dx,34+dy),(36+dx,37+dy)],'l',None)
 if griff:
  featherwing(p,(35+dx,32+dy),(9,8+arm*.5),19)
  p.line([(38+dx,28+dy),(41+dx,33+dy),(40+dx,37+dy)],'v',3)
 else:
  p.poly([(28+dx,30+dy),(28+dx,22+dy),(31+dx,15+dy),(36+dx,17+dy),(41+dx,23+dy),(43+dx,34+dy),(38+dx,42+dy),(30+dx,41+dy)],'b')
  p.poly([(31+dx,22+dy),(33+dx,18+dy),(36+dx,20+dy),(38+dx,26+dy),(36+dx,34+dy),(32+dx,34+dy)],'l',None)
  p.poly([(28+dx,24+dy),(31+dx,27+dy),(30+dx,32+dy),(33+dx,36+dy),(31+dx,40+dy),(28+dx,36+dy),(26+dx,30+dy)],'s',None)
  p.poly([(32+dx,27+dy),(37+dx,25+dy),(42+dx,29+dy),(42+dx,35+dy),(38+dx,39+dy),(32+dx,36+dy),(30+dx,32+dy)],'t')
  p.poly([(33+dx,28+dy),(37+dx,27+dy),(40+dx,30+dy),(36+dx,32+dy),(32+dx,31+dy)],'u',None)
  p.line([(32+dx,32+dy),(36+dx,34+dy),(40+dx,32+dy)],'v');p.line([(34+dx,36+dy),(38+dx,37+dy),(41+dx,34+dy)],'u')
  for x,y in [(18,29),(25,26),(32,26)]:
   p.poly([(x+dx-2,y+dy),(x+dx-3,y+dy-7),(x+dx+1,y+dy-3),(x+dx+3,y+dy)],'t');p.line([(x+dx-2,y+dy-3),(x+dx+1,y+dy-1)],'v')
  p.line([(39+dx,27+dy),(43+dx,29+dy),(44+dx,35+dy)],'s',3)
 hx=35+dx+hd*.2;hy=18+dy+hd*.25
 beasthead(p,hx,hy,pose,'griffin' if griff else 'behemoth')
 return p.im

def phoenix_head(p,x,y,pose):
 # Skull is a compact wedge, leading directly into the avian cere and bill.
 p.poly([(x-5,y+3),(x-3,y-1),(x+2,y-3),(x+7,y-2),(x+10,y+1),
         (x+11,y+5),(x+8,y+9),(x+5,y+13),(x+2,y+11),
         (x-1,y+15),(x-2,y+11),(x-6,y+12),(x-4,y+8),(x-7,y+7)],'b')
 p.poly([(x-2,y+1),(x+2,y-1),(x+6,y),(x+8,y+2),(x+4,y+4),(x,y+5)],'l',None)
 # Broad stepped crest feathers overlap backwards instead of projecting horns.
 p.poly([(x+3,y-2),(x-1,y-5),(x-7,y-7),(x-12,y-7),(x-12,y-5),
         (x-8,y-4),(x-7,y-2),(x-3,y-1),(x-1,y+1)],'r')
 p.poly([(x,y-1),(x-4,y-3),(x-10,y-4),(x-13,y-4),(x-13,y-2),
         (x-9,y-1),(x-9,y+1),(x-5,y+2),(x-2,y+3)],'p')
 p.poly([(x-1,y+3),(x-5,y+1),(x-11,y),(x-13,y+1),(x-11,y+3),
         (x-7,y+3),(x-7,y+5),(x-3,y+6)],'r')
 p.line([(x-10,y-5),(x-6,y-4),(x-2,y-2)],'q')
 p.line([(x-10,y-2),(x-6,y-1),(x-3,y+1)],'l')
 # Feather fan on cheek and throat identifies the bird below its eye.
 p.poly([(x-1,y+6),(x+4,y+5),(x+7,y+7),(x+4,y+10),(x+1,y+9),
         (x-1,y+12),(x-3,y+9),(x-5,y+10),(x-4,y+7)],'r',None)
 p.line([(x,y+7),(x+3,y+8),(x+1,y+10)],'q')
 p.line([(x-3,y+7),(x-1,y+8)],'p')
 p.poly([(x+8,y+4),(x+12,y+5),(x+16,y+7),(x+15,y+10),
         (x+13,y+12),(x+13,y+8),(x+8,y+8)],'y')
 p.line([(x+9,y+5),(x+13,y+6)],'e');p.dot(x+12,y+7,'g')
 if pose=='attack':
  p.poly([(x+7,y+8),(x+12,y+8),(x+12,y+11),(x+8,y+12)],'c')
  p.poly([(x+8,y+11),(x+12,y+12),(x+10,y+14),(x+7,y+12)],'y')
 else:p.poly([(x+7,y+9),(x+12,y+9),(x+10,y+11),(x+7,y+11)],'y')
 eye(p,x+6,y+3,pose)
 p.line([(x+3,y+1),(x+6,y+1),(x+9,y+2)],'y')

BIRDS={'roc-giant','phoenix-rebirth'}
def bird(slug,pose,cell):
 p=Pen(cell,slug);fire=slug=='phoenix-rebirth';dx,dy,hd,arm,stride=R[pose];cx=34+dx*.3;cy=31+dy
 if pose=='dead':
  p.poly([(21,51),(30,47),(40,50),(42,56),(34,60),(17,58)],'b');featherwing(p,(35,52),(7,48),10)
  if fire:phoenix_head(p,38,45,'dead')
  else:
   p.poly([(39,48),(47,48),(49,52),(46,56),(40,56)],'l');p.poly([(47,51),(53,52),(51,56),(47,55)],'y');eye(p,46,51,'dead')
  p.line([(18,56),(6,57),(4,53)],'r' if fire else 'b',3);return p.im
 tip={'idle_a':(5,12),'idle_b':(6,7),'idle_c':(5,20),'windup':(10,5),'move':(4,14),'attack':(6,30),'recover':(5,23),'hit':(9,32)}[pose]
 # Keep the far wing below the phoenix cheek; a tip at crown height read as a horn.
 far_tip=(50,max(cy+2,tip[1]+5)) if fire else (52,tip[1]+3)
 featherwing(p,(cx+2,cy),far_tip,11,far=True)
 # Long layered fan feathers; phoenix has ember pointed tips.
 for i in range(3):
  tx=5+i*4;ty=47+i*3+stride*.25
  p.poly([(cx-6,cy+7),(tx+3,ty-5),(tx,ty),(tx+5,ty-1),(cx-1,cy+12)],'r' if fire else 's')
  p.line([(cx-5,cy+10),(tx+4,ty-2)],'p' if fire else 'l')
 p.poly([(cx-8,cy-4),(cx+4,cy-6),(cx+10,cy),(cx+7,cy+14),(cx-2,cy+19),(cx-11,cy+9)],'b')
 p.poly([(cx+1,cy-2),(cx+7,cy+1),(cx+4,cy+10),(cx-1,cy+13),(cx-5,cy+5)],'l',None)
 for j in range(4):p.line([(cx-1,cy+3+j*3),(cx+3,cy+5+j*3)],'h')
 for side in (-1,1):
  knee=(cx+side*4,cy+18);toe=(cx+side*(5+stride*.3),56-(3 if pose=='move' else 0))
  limb(p,(cx+side*3,cy+11),knee,2,'s','b');limb(p,knee,toe,1,'y','e');claw(p,toe[0]-2,toe[1],3,2)
 # Phoenix crown consists of stepped overlapping feather clumps, no horns.
 hx=cx+1+hd*.2;hy=cy-18
 if fire:phoenix_head(p,hx,hy,pose)
 else:
  p.poly([(hx-4,hy+3),(hx-1,hy-3),(hx+7,hy-4),(hx+11,hy+1),(hx+10,hy+10),(hx+4,hy+13),(hx-3,hy+10)],'b')
  p.poly([(hx-1,hy),(hx+5,hy-2),(hx+7,hy+1),(hx+2,hy+4),(hx-2,hy+4)],'l',None)
  p.poly([(hx+7,hy+5),(hx+15,hy+6),(hx+15,hy+9),(hx+12,hy+12),(hx+11,hy+8),(hx+7,hy+9)],'y');p.line([(hx+10,hy+6),(hx+14,hy+7)],'e')
  eye(p,hx+7,hy+3,pose)
  for i in range(3):
   p.poly([(hx-2+i*3,hy-1),(hx-10+i*3,hy-7+i),(hx-6+i*3,hy),(hx+i*3,hy+2)],'s')
   p.line([(hx-7+i*3,hy-4+i),(hx-3+i*3,hy-1)],'l')
 featherwing(p,(cx-4,cy),(tip[0],tip[1]),18)
 if fire:
  for j in range(5):
   u=j/6;wx=tip[0]+(cx-4-tip[0])*u;wy=tip[1]+(cy-tip[1])*u
   p.line([(wx,wy+4),(wx-1,wy+11)],'y');p.dot(wx-1,wy+12,'e')
 return p.im

def centaur(pose,cell):
 p=Pen(cell,'centaur-plains');dx,dy,hd,arm,stride=R[pose]
 if pose=='dead':
  p.poly([(12,51),(19,45),(33,45),(40,50),(42,58),(31,60),(17,59),(9,56)],'b');p.poly([(16,50),(23,47),(30,47),(28,53),(19,55)],'l',None)
  for a,b in [((17,54),(8,58)),((30,54),(23,58)),((36,52),(44,58))]:limb(p,a,b,3,'t','u')
  p.poly([(34,49),(38,42),(45,43),(49,49),(45,55),(38,53)],'b');face(p,44,45,'dead')
  p.line([(45,45),(39,43),(32,45)],'t',3);weapon(p,(17,56),'dead','spear');return p.im
 # Horse tail, far leg cycle and barrel, before upright human torso.
 p.poly([(16+dx,36+dy),(8,38+stride*.3),(6,47),(8,53),(11,48),(11,40),(18+dx,41+dy)],'t');p.line([(8,42),(8,49)],'u')
 for x in (18,39):
  root=(x+dx,43+dy);knee=(x-stride*.55,51);foot=(x-3-stride*.7,60)
  limb(p,root,knee,3,'s','b');limb(p,knee,(foot[0],58),2,'s','b');p.box((foot[0]-2,58,foot[0]+2,60),'o')
 p.poly([(14+dx,34+dy),(23+dx,31+dy),(37+dx,32+dy),(45+dx,36+dy),(43+dx,46+dy),(33+dx,49+dy),(18+dx,47+dy),(12+dx,40+dy)],'b')
 p.poly([(18+dx,35+dy),(26+dx,33+dy),(35+dx,34+dy),(31+dx,38+dy),(18+dx,40+dy)],'l',None)
 p.line([(18+dx,42+dy),(23+dx,44+dy),(31+dx,45+dy)],'s')
 for x in (18,41):
  root=(x+dx,44+dy);knee=(x+stride*.6,51-(2 if pose=='move' and x==41 else 0));foot=(x+stride*.75,58)
  limb(p,root,knee,4);limb(p,knee,foot,2);p.poly([(foot[0]-2,57),(foot[0]+2,57),(foot[0]+4,60),(foot[0]-2,60)],'o');p.line([(knee[0]-1,knee[1]),(foot[0]-1,foot[1]-1)],'l')
 cx=37+dx*.6;top=24+dy
 # Human pelvis becomes the broad chest of horse; no horse head remains.
 p.poly([(cx-4,top-3),(cx+5,top-4),(cx+8,top+6),(cx+6,top+16),(cx-5,top+16),(cx-7,top+5)],'b')
 p.poly([(cx-2,top-1),(cx+3,top-2),(cx+5,top+3),(cx+1,top+7),(cx-3,top+6)],'l',None)
 p.poly([(cx-5,top+3),(cx+6,top+2),(cx+6,top+10),(cx-4,top+11)],'t');p.line([(cx-3,top+4),(cx+4,top+4)],'u');p.line([(cx-4,top+11),(cx+6,top+10)],'y',2)
 shoulder=(cx+4,top-1);elbow=(cx+8,top+5-arm*.3);hand=(min(48,cx+11+arm*.2),top+9-arm*.6)
 limb(p,shoulder,elbow,2);limb(p,elbow,hand,2);weapon(p,hand,pose,'spear')
 limb(p,(cx-4,top),(cx-10,top+8),2,'s','b');limb(p,(cx-10,top+8),(cx-7,top+12),2,'s','b')
 hx=cx-2+hd*.2;hy=8+dy;face(p,hx,hy,pose)
 p.poly([(hx-2,hy+5),(hx-2,hy),(hx+2,hy-3),(hx+8,hy-2),(hx+10,hy+1),(hx+4,hy+1),(hx+2,hy+5),(hx+1,hy+12),(hx-6-arm*.2,hy+20),(hx-4,hy+8)],'t');p.line([(hx+1,hy-1),(hx+6,hy-1)],'u');p.line([(hx-1,hy+4),(hx-2,hy+10),(hx-5-arm*.2,hy+16)],'u')
 p.line([(hx+4,hy+10),(hx+7,hy+10)],'c');p.dot(hx+5,hy+12,'u')
 return p.im

REPTILES={'salamander-01','salamander-flame','dragon-whelp'}
def reptile(slug,pose,cell):
 p=Pen(cell,slug);baby=slug=='dragon-whelp';fire=slug=='salamander-flame';dx,dy,hd,arm,stride=R[pose]
 if pose=='dead':
  p.poly([(10,52),(17,46),(29,47),(36,52),(34,58),(19,60),(10,58)],'b');p.poly([(16,50),(22,48),(27,50),(22,54)],'l',None)
  p.poly([(12,54),(6,52),(4,44),(7,40),(9,43),(7,47),(10,50),(16,53)],'b');p.line([(6,45),(7,49),(10,52)],'l')
  if baby:batwing(p,(27,49),(14,45),9)
  limb(p,(25,54),(35,58),3);claw(p,34,58,3,2)
  hx=36;hy=44;p.poly([(hx,hy+3),(hx+5,hy),(hx+14,hy+2),(hx+18,hy+7),(hx+16,hy+12),(hx+7,hy+15),(hx,hy+12)],'b');eye(p,hx+9,hy+6,'dead');p.line([(hx+9,hy+11),(hx+16,hy+11)],'s')
  return p.im
 # Native curved tail silhouette with brighter upper scale ridge.
 p.poly([(20+dx,40+dy),(10,41+stride*.3),(4,36),(3,27),(6,21),(10,20),(12,24),(8,24),(6,28),(7,33),(12,35+stride*.3),(21+dx,34+dy)],'b');p.line([(6,27),(6,33),(11,38+stride*.3),(17+dx,38+dy)],'l')
 if baby:batwing(p,(31+dx,30+dy),(19,9+arm*.3),13,True)
 # Reptile hind legs splay laterally; baby dragon has more vertical haunches.
 for x in (18,37):
  limb(p,(x+dx,42+dy),(x-4-stride*.3,49),3,'s','b');limb(p,(x-4-stride*.3,49),(x-2-stride*.4,57),2,'s','b');claw(p,x-3-stride*.4,58,3,2)
 p.poly([(13+dx,31+dy),(24+dx,25+dy),(35+dx,26+dy),(42+dx,32+dy),(42+dx,43+dy),(32+dx,49+dy),(18+dx,46+dy),(11+dx,40+dy)],'b')
 p.poly([(16+dx,31+dy),(24+dx,28+dy),(31+dx,29+dy),(30+dx,33+dy),(20+dx,36+dy),(14+dx,35+dy)],'l',None)
 if baby:
  p.poly([(28+dx,34+dy),(37+dx,31+dy),(40+dx,35+dy),(38+dx,44+dy),(32+dx,47+dy),(28+dx,42+dy)],'t');p.line([(30+dx,36+dy),(37+dx,36+dy)],'u');p.line([(31+dx,40+dy),(37+dx,40+dy)],'v');p.line([(32+dx,44+dy),(35+dx,44+dy)],'u')
 else:
  for x,y in [(18,31),(25,29),(31,30),(19,38),(26,37)]:
   p.poly([(x+dx,y+dy),(x+dx+2,y+dy-1),(x+dx+4,y+dy),(x+dx+3,y+dy+2),(x+dx+1,y+dy+2)],'l',None)
   p.line([(x+dx+1,y+dy),(x+dx+2,y+dy-1)],'h')
  p.poly([(17+dx,42+dy),(25+dx,40+dy),(34+dx,41+dy),(31+dx,45+dy),(23+dx,46+dy)],'s',None)
 for x in (17,38):
  knee=(x+dx+stride*.45,50-(2 if pose=='move' and x==38 else 0));foot=(x+2+stride*.5,58)
  limb(p,(x+dx,40+dy),knee,5);limb(p,knee,foot,3)
  p.poly([(foot[0]-3,56),(foot[0]+1,56),(foot[0]+6,58),(foot[0]+5,60),(foot[0]-2,60)],'b');claw(p,foot[0]-1,58,3,2)
  p.poly([(x+dx-2,41+dy),(x+dx+2,42+dy),(knee[0]+1,knee[1]-1),(knee[0]-1,knee[1])],'l',None)
  p.line([(knee[0]-1,knee[1]-1),(knee[0]+1,knee[1]-1)],'l')
 if baby:batwing(p,(29+dx,31+dy),(9,12+arm*.5),14)
 elif fire:
  for j in range(3):
   xx=15+j*7+dx;yy=26+dy-(2 if j==1 else 0)
   p.poly([(xx-3,yy+4),(xx-5,yy-3),(xx-3,yy-8-arm*.2),(xx-1,yy-4),(xx+1,yy-12+arm*.2),(xx+2,yy-5),(xx+6,yy-7),(xx+4,yy+3)],'r')
   p.poly([(xx-2,yy+2),(xx-2,yy-3),(xx+1,yy-7),(xx+2,yy-2),(xx+4,yy),(xx+2,yy+3)],'y',None)
   p.line([(xx,yy),(xx+1,yy-3)],'e')
 else:
  for x,y in [(13,29),(20,27),(27,25),(33,26)]:
   p.poly([(x+dx-1,y+dy+2),(x+dx-3,y+dy-5-arm*.15),(x+dx+1,y+dy-2),(x+dx+4,y+dy+2)],'r' if fire else 't');p.line([(x+dx-1,y+dy-2),(x+dx+1,y+dy)],'y' if fire else 'v')
 hx=34+dx+hd*.2;hy=19+dy+hd*.2
 # Broad snout and recessed cheek, not a disconnected head ellipse.
 p.poly([(hx-5,hy+11),(hx-2,hy+2),(hx+3,hy-2),(hx+11,hy),(hx+15,hy+6),(hx+18,hy+7),(hx+18,hy+13),(hx+10,hy+18),(hx+1,hy+17),(hx-6,hy+13)],'b')
 p.poly([(hx,hy+2),(hx+5,hy),(hx+9,hy+2),(hx+4,hy+6),(hx-1,hy+6)],'l',None)
 p.poly([(hx+7,hy+8),(hx+16,hy+7),(hx+17,hy+10),(hx+12,hy+12),(hx+5,hy+11)],'l',None)
 p.dot(hx+15,hy+9,'o');eye(p,hx+8,hy+5,pose,3 if baby else 2)
 if pose in ('attack','windup'):
  p.poly([(hx+6,hy+13),(hx+17,hy+12),(hx+14,hy+16),(hx+8,hy+16)],'c');p.line([(hx+8,hy+13),(hx+15,hy+13)],'w');p.line([(hx+9,hy+16),(hx+13,hy+16)],'p')
 else:p.line([(hx+7,hy+14),(hx+16,hy+13)],'s');p.dot(hx+10,hy+14,'v')
 if baby:
  p.poly([(hx-1,hy+3),(hx-4,hy-6),(hx-1,hy-4),(hx+2,hy+1)],'v');p.poly([(hx+7,hy+1),(hx+8,hy-6),(hx+10,hy-4),(hx+10,hy+2)],'v');p.line([(hx-3,hy-4),(hx,hy)],'w')
 else:
  p.poly([(hx-4,hy+4),(hx-12,hy-3),(hx-9,hy+5),(hx-13,hy+7),(hx-8,hy+10),(hx-9,hy+15),(hx-3,hy+13)],'r' if fire else 't')
  for off in (0,4,8):p.line([(hx-8,hy+off),(hx-4,hy+off+3)],'q' if fire else 'v')
 p.poly([(hx+1,hy+9),(hx+5,hy+8),(hx+7,hy+11),(hx+5,hy+14),(hx+1,hy+12)],'s',None)
 p.line([(hx+4,hy+2),(hx+8,hy+2)],'h')
 return p.im


def draw(slug,pose,cell):
 if pose not in POSES:raise ValueError(pose)
 if slug in HUM:return humanoid(slug,pose,cell)
 if slug in WINGED:return winged(slug,pose,cell)
 if slug in SPIRITS:return spirit(slug,pose,cell)
 if slug in ('behemoth-horn','griffin-sky'):return quadruped(slug,pose,cell)
 if slug in BIRDS:return bird(slug,pose,cell)
 if slug=='centaur-plains':return centaur(pose,cell)
 if slug in REPTILES:return reptile(slug,pose,cell)
 raise ValueError(slug)

def inspection_pages():
 from PIL import Image,ImageDraw
 from common import review_board,BG,ROOT
 E=entries('humanoid');out=ROOT/'verify-shots/monster-refresh/humanoid'
 for k in range(0,len(E),9):
  im=Image.new('RGB',(960,1100),BG);d=ImageDraw.Draw(im)
  for j,e in enumerate(E[k:k+9]):
   board=review_board([draw(e['slug'],n,e['cell']) for n in POSES],e['cell'],1)
   xx=j%3*320;yy=j//3*365
   d.text((xx+5,yy+3),e['slug'],fill='#e0dfcb');im.paste(board,(xx+(320-board.width)//2,yy+22))
  im.save(out/('all-poses-'+str(k//9+1)+'.png'))

# Earlier rejected anatomy remains below this module's historical helpers only.
# Every public draw/command now delegates to the canonical fresh source.
_rejected_draw = draw

def draw(slug, pose, cell=None):
    from registry import draw_entry
    return draw_entry(slug, pose)

if __name__ == '__main__':
    from registry import helper
    helper.run_group('humanoid', lambda slug, pose, cell: draw(slug, pose, cell))

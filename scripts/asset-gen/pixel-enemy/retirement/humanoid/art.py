"""Original final-grid enemy designs. All coordinates are editable final pixel decisions."""
import sys, math
from pathlib import Path
sys.dont_write_bytecode=True
sys.path.insert(0,str(Path(__file__).resolve().parents[2]))
from pe_lib import Pen,NAMES
from pe_rig import cap,clean

BASE=dict(o='20202c',s='384344',b='657760',l='a0ad79',h='d0d4a3',a='644431',c='a27548',g='d4b36d',w='ece1c2',e='eed25b',r='a34846',v='65446e',m='626776',n='a0a6b3',f='3c3039')
COLORS={
'zombie-01':('526456','86947a','b5b89a'), 'orc-01':('42664c','709255','abbc78'),
'goblin-brute':('3b6850','73a66b','bdd490'),'ogre-club':('446346','73945c','abc482'),
'kobold-digger':('535d38','89946a','b0c18a'),'kappa-01':('466d52','7fa568','b2c281'),
'imp-mischief':('763138','bd4d43','ec8770'),'harpy-01':('654a34','a77d4f','d1aa71'),
'angel-fallen':('34333f','575769','9697a5'),'knight-fallen':('34353f','555764','8b91a0'),
'mage-rogue':('373342','605071','9b80ad'),'leafling-01':('386147','67a24f','accc76'),
'sparkit-01':('325a9b','5c97cb','b5ddeb'),'aqualing-01':('286783','50a5bb','9bdddf'),
'salamander-01':('903f31','d3753e','edaf64'),'salamander-flame':('7e2a30','ba4b2f','f18b45'),
'centaur-plains':('5b3c31','936644','ca9d6e'),'griffin-sky':('4d382e','8f6340','c3a06a'),
'roc-giant':('45362e','765438','b48f57'),'phoenix-rebirth':('852c3b','d75139','fa9b43'),
'wyvern-cliff':('566339','9da649','d4d678'),'dragon-whelp':('736044','b19554','e3c685'),
'dragon-red':('7b3040','bb4d48','eb8267'),'dragon-blue':('2e456f','537fa1','a0bcc5'),
'dragon-bone':('626467','9d9e92','dddbc7'),'hydra-three':('335344','5e8056','9bbd75'),
'behemoth-horn':('46342f','795440','b58b5e')}

def palette(slug):
 p=BASE.copy(); p['s'],p['b'],p['l']=COLORS[slug]
 if slug=='knight-fallen':p['m']='363844';p['n']='7d8491'
 return p

# Pose inputs affect separate joints. Idle breaths keep feet planted and flex elbows/tails.
P={
'idle_a':(0,0,0,0,0),'idle_b':(0,1,2,1,1),'idle_c':(0,2,-2,-1,2),
'windup':(-3,-2,-8,-5,-2),'move':(2,-1,3,6,3),'attack':(5,2,8,10,4),
'recover':(1,1,-1,4,1),'hit':(-4,3,-5,-3,3),'dead':(0,0,0,0,0)}

def ell(p,rect,col,edge='o'):
 p.d.ellipse(rect,fill=p.pal[col],outline=p.pal[edge] if edge else None)

def horn(p,x,y,size=5):
 p.poly([(x,y),(x-3,y-size),(x+2,y-size//2),(x+3,y+2)],'g','o'); p.line([(x-2,y-size+2),(x,y-1)],'w')

def face(p,x,y,w=11,h=11,kind='human',state='idle_a'):
 # Forehead, lit cheek, projecting right-facing nose/jaw, eye on right.
 p.poly([(x+2,y),(x+w-3,y),(x+w-1,y+3),(x+w+2,y+h//2),(x+w,y+h-2),(x+4,y+h),(x,y+h-3),(x,y+3)],'b','o')
 p.poly([(x+2,y+1),(x+w-4,y+1),(x+w-5,y+5),(x+2,y+h-3)],'l')
 if kind in ('orc','goblin','ogre','kobold'):
  p.poly([(x+2,y+2),(x-5,y),(x,y+6)],'b','o')
  p.poly([(x+w-3,y+h-1),(x+w-3,y+h-5),(x+w,y+h-1)],'w')
 if kind=='kobold': p.poly([(x+w-1,y+4),(x+w+7,y+5),(x+w+6,y+9),(x+w-2,y+9)],'b','o')
 eye=(x+w-3,y+4)
 p.line([eye,(eye[0]+2,eye[1]+(1 if state=='hit' else 0))],'o')
 if state!='hit': p.box((eye[0],eye[1]+1,eye[0]+1,eye[1]+1),'e')
 p.line([(x+w-4,y+h-3),(x+w+1,y+h-3)],'o')
 if state in ('attack','windup'): p.box((x+w-4,y+h-3,x+w,y+h-2),'f'); p.line([(x+w-4,y+h-3),(x+w-1,y+h-3)],'w')

def wing(p,sh,tip,feather=False,far=False,width=16):
 sx,sy=sh; tx,ty=tip; wx=round((sx+tx)/2)-3; wy=round((sy+ty)/2)-4
 pts=[sh,(wx,wy),tip]
 if feather:
  for i in range(7):
   u=i/6; bx=tx+(sx-tx)*u; by=ty+(sy-ty)*u
   pts.extend([(round(bx-5+u*3),round(by+width*(1-u*.65))),(round(bx+1),round(by+width*.35))])
 else:
  pts.extend([(tx+3,ty+width),(wx-1,wy+width-1),(wx+5,wy+width+4),(sx-4,sy+9)])
 p.poly(pts,'s' if far else 'b','o'); p.line([sh,(wx,wy),tip],'b' if far else 'l',2)
 for i in (1,2,3):
  u=i/4; p.line([(round(tx+(sx-tx)*u),round(ty+(sy-ty)*u)),(round(tx+(sx-tx)*u-2),round(ty+(sy-ty)*u+width*(1-u*.6)))],'l' if not far else 'b')

def weapon(p,hand,state,kind='club',size=1):
 hx,hy=hand
 dx,dy={'windup':(-12,-16),'attack':(17,7),'recover':(10,-7),'hit':(-8,-13)}.get(state,(4,-19))
 tx,ty=min(p.im.width-13,max(10,hx+dx)),max(15 if kind=='axe' else 9,hy+dy)
 cap(p,[(hx-2,hy+3),(tx,ty)],2,'a',lit='c')
 if kind=='axe':
  # Two opposed blades, aligned to the pole axis.
  vx,vy=-dy/19,dx/19
  for sign in (-1,1):
   pts=[(tx-2,ty-2),(round(tx+sign*vx*9),round(ty+sign*vy*9)-3),(round(tx+sign*vx*10),round(ty+sign*vy*10)+4),(tx+2,ty+4)]
   p.poly(pts,'m','o'); p.line(pts[1:3],'w')
 elif kind=='pick':
  p.poly([(tx-10,ty+4),(tx-5,ty-3),(tx+2,ty-4),(tx+11,ty+2),(tx+4,ty),(tx-3,ty)],'m','o'); p.line([(tx-5,ty-2),(tx+2,ty-3)],'n')
 elif kind=='staff':
  ell(p,(tx-4,ty-5,tx+4,ty+3),'v'); p.box((tx-1,ty-3,tx+1,ty),'l')
 elif kind=='sword':
  cap(p,[(hx-4,hy+2),(hx+4,hy-2)],1,'r'); p.poly([(hx,hy-1),(tx-1,ty-10),(tx+2,ty-12),(tx+4,ty-8),(hx+3,hy)],'m','o'); p.line([(hx+1,hy-2),(tx+2,ty-10)],'w')
 else:
  cap(p,[(tx-dx*.28,ty-dy*.28),(tx,ty)],7 if size==1 else 9,'a',lit='c')
  for dd in (-3,3): p.poly([(tx+dd,ty-3),(tx+dd-1,ty-7),(tx+dd+2,ty-4)],'m','o')

def humanoid(slug,n):
 cell=96 if slug=='ogre-club' else (64 if slug!='imp-mischief' else 48)
 p=Pen(cell,palette(slug)); large=slug=='ogre-club'; shift=(cell-64)//2
 dx,dy,arm,stride,flap=P[n]; base=cell-4
 kind=slug.split('-')[0]; flying=kind in ('harpy','angel','imp')
 nx=31+shift+dx; ny=25+dy+(-9 if cell==48 else 0); hp=(nx-1,ny+17)
 bw=15 if large else (7 if kind=='goblin' else 8)
 if large: ny+=7;hp=(nx-1,ny+24)
 if kind=='goblin': ny+=8;hp=(nx-3,ny+10)
 if kind=='knight': nx-=5;ny+=7;hp=(nx+7,ny+11)
 if n=='dead':
  if large:
   p.poly([(14,base-12),(26,base-19),(51,base-18),(65,base-8),(77,base-5),(79,base),(20,base)],'b','o');p.line([(24,base-16),(49,base-15)],'l',3)
   face(p,64,base-14,16,12,kind,n);cap(p,[(29,base-7),(20,base-6),(13,base-5)],7,'a');cap(p,[(14,base-2),(47,base-2)],2,'a',lit='c');return clean(p)
  p.poly([(8,base-7),(17,base-11),(33,base-9),(44,base-3),(min(cell-3,46),base),(13,base)],'b','o'); p.line([(13,base-8),(30,base-7)],'l',2)
  face(p,32 if cell==64 else 27,base-9,10,7,kind,n)
  cap(p,[(19,base-6),(13,base-2),(8,base-2)],4,'a')
  if kind in ('angel','harpy','imp'): wing(p,(23,base-10),(10,base-13),kind!='imp',width=7)
  if kind in ('orc','goblin','ogre','kobold','mage','angel'): cap(p,[(12,base-2),(30,base-2)],2,'a',lit='c')
  return clean(p)
 if flying:
  wing(p,(nx-2,ny+3),(max(9,nx-23),max(3,ny-13+flap*2)),kind!='imp',far=True,width=13 if kind!='angel' else 18)
 if kind=='kappa':
  ell(p,(nx-15,ny-1,nx+2,ny+25),'s'); p.line([(nx-10,ny+2),(nx-2,ny+2),(nx+1,ny+15),(nx-8,ny+22)],'g'); p.line([(nx-12,ny+11),(nx-3,ny+12)],'b')
 if kind=='kobold': cap(p,[(nx-2,ny+18),(nx-15,ny+21),(nx-20,ny+15+flap)],3,'b',lit='l')
 if kind in ('knight','angel','mage'):
  p.poly([(nx-7,ny-1),(nx-13,ny+15),(nx-17,base-2-(5 if flying else 0)),(nx-8,base-5),(nx-5,base-1-(6 if flying else 0)),(nx+2,ny+18)],'f','o'); p.line([(nx-8,ny+3),(nx-12,ny+21)],'s')
 # Feet, bent knees, controlled stride and talon rake.
 sole=base-7 if flying else base
 for i,near in enumerate((False,True)):
  fx=nx+(-7 if i==0 else 5)+(stride if near else -stride//2)
  fy=sole-(4 if n=='move' and near else 0)-(3 if kind=='imp' and near else 0)
  if flying and n=='attack': fx+=7; fy-=3
  fx=min(cell-9,fx)
  knee=(nx+(-8 if i==0 else 8),min(sole-5,hp[1]+(14 if large else 7)))
  cap(p,[(hp[0]+(-4 if i==0 else 4),hp[1]),knee,(fx,fy-(6 if large else 3))],4 if not large else 8,'s' if not near else 'b',lit='l' if near else None)
  p.poly([(fx-3,fy-3),(fx+3,fy-3),(fx+5,fy),(fx-3,fy)],'g' if kind=='harpy' else 'a','o')
  if kind=='harpy': p.line([(fx,fy-1),(fx+7,fy)],'w')
 # Narrow/broad torso unique widths and clothing.
 p.poly([(nx-bw,ny),(nx+bw,ny+1),(hp[0]+bw-1,hp[1]),(hp[0]-bw+1,hp[1]),(nx-bw-1,ny+5)],'b','o')
 p.poly([(nx-bw+1,ny+1),(nx-1,ny+2),(nx-3,ny+10),(hp[0]-bw+2,hp[1]-1)],'l')
 if kind in ('orc','goblin','ogre','kobold'):
  p.poly([(nx-bw-1,ny-1),(nx-1,ny-3),(nx+6,ny+3),(nx+4,ny+9),(nx-6,ny+7)],'a','o'); p.line([(nx-bw,ny),(nx-1,ny-2)],'c')
  p.line([(nx-5,ny+3),(hp[0]+5,hp[1]-1)],'c',2)
  for xx in range(nx-bw+2,nx+3,4): p.box((xx,ny,xx+1,ny+1),'n')
 if kind=='zombie':
  p.poly([(nx-9,ny),(nx-5,ny+1),(nx-5,ny+9),(nx-8,ny+13),(nx-10,ny+9)],'a','o');p.line([(nx-8,ny+1),(nx-7,ny+6)],'c')
  p.poly([(nx+5,ny+2),(nx+8,ny+2),(nx+6,ny+13),(nx+3,ny+11)],'a','o')
  p.poly([(nx-6,ny+4),(nx+5,ny+3),(nx+3,ny+13),(nx-5,ny+10)],'f','o')
  for yy in (ny+5,ny+8,ny+11): p.line([(nx-4,yy),(nx+3,yy+1)],'w')
  p.line([(nx-5,ny+14),(nx+4,ny+16)],'a',3)
 if kind in ('knight','angel'):
  p.poly([(nx-7,ny),(nx+6,ny),(nx+4,ny+13),(nx-4,ny+15)],'m','o'); p.line([(nx-5,ny+1),(nx+2,ny+2),(nx+3,ny+10)],'n')
  p.poly([(nx-9,ny-2),(nx-1,ny-3),(nx+1,ny+3),(nx-9,ny+4)],'m','o')
 if kind=='mage':
  p.poly([(nx-6,ny),(nx+6,ny),(nx+10,base),(nx+5,base-2),(nx+1,base),(nx-5,base-1),(nx-9,base)],'b','o'); p.line([(nx-5,ny+4),(nx-7,base-2)],'l'); p.line([(nx+3,ny+7),(nx+6,base-2)],'s')
 if kind=='kappa':
  p.poly([(nx-8,ny+13),(nx+8,ny+13),(nx+9,ny+23),(nx+4,ny+21),(nx-1,ny+24),(nx-8,ny+21)],'g','o')
  for xx in range(nx-6,nx+8,3): p.line([(xx,ny+15),(xx-1,ny+21)],'a')
 if kind=='imp': p.poly([(nx-5,ny+13),(nx+6,ny+13),(nx+3,ny+21),(nx-4,ny+20)],'a','o'); horn(p,nx-3,ny-8,5); horn(p,nx+5,ny-9,5)
 headX=nx-5; headY=ny-12
 face(p,headX,headY,16 if large else 10,15 if large else 11,kind,n)
 if kind=='goblin':
  p.poly([(nx+3,headY+4),(nx+11,headY+7),(nx+7,headY+9)],'b','o');p.line([(nx-2,headY+2),(nx+4,headY+3)],'s',2)
 if kind=='ogre':
  p.line([(nx-3,headY+3),(nx+6,headY+4)],'s',2);p.line([(nx-1,headY+7),(nx+4,headY+8)],'l',2)
 if kind=='kappa':
  p.poly([(nx+3,headY+5),(nx+13,headY+6),(nx+4,headY+9)],'g','o'); ell(p,(nx-7,headY-2,nx+7,headY+2),'g'); p.line([(nx-4,headY),(nx+5,headY)],'n',2)
 if kind=='harpy':
  p.poly([(headX-3,headY+1),(headX+2,headY-4),(headX+8,headY-2),(headX+8,headY+1),(headX-1,headY+5),(headX-3,headY+12)],'a','o'); p.line([(headX,headY),(headX+4,headY-2)],'c')
 if kind=='mage':
  p.poly([(nx-8,ny-5),(nx-7,ny-15),(nx,ny-20),(nx+7,ny-12),(nx+9,ny-4),(nx+4,ny-6),(nx+2,ny-13),(nx-4,ny-9)],'b','o'); p.line([(nx-6,ny-13),(nx,ny-18),(nx+4,ny-13)],'l'); p.box((nx+1,ny-8,nx+5,ny-7),'e')
 if kind=='knight':
  p.poly([(nx-7,ny-11),(nx-4,ny-16),(nx+5,ny-15),(nx+8,ny-10),(nx+7,ny-3),(nx-6,ny-4)],'m','o'); p.line([(nx-4,ny-14),(nx+3,ny-14)],'n'); p.line([(nx+1,ny-9),(nx+7,ny-9)],'o',2); cap(p,[(nx-2,ny-16),(nx-5,max(3,ny-20)),(nx-10,max(3,ny-20+flap))],2,'r')
 if kind=='angel':
  p.poly([(nx-7,ny-12),(nx-2,ny-16),(nx+5,ny-13),(nx+5,ny-10),(nx,ny-12),(nx-6,ny-3)],'n','o'); p.line([(nx-3,ny-14),(nx+2,ny-13)],'w')
 # Arm goals pivot independently from shoulder; zombie claws both reach forward.
 targets=[(nx-12,ny+13-arm//3),(min(cell-12,nx+15+arm),ny+12-arm//2)]
 if kind=='knight': targets=[(nx-9,base-3),(nx+17+arm//2,ny-4-arm//3)]
 if kind=='zombie': targets=[(min(cell-14,nx+10+arm//2),ny+7),(min(cell-8,nx+17+arm),ny+9)]
 if kind in ('orc','kobold') and n in ('windup','attack'): targets=[(nx+arm+4,ny+arm//2),(nx+arm+9,ny+arm//2+2)]
 if kind=='mage': targets=[(min(cell-8,nx+7+arm),ny+6-arm//3),(nx+15,ny+18)]
 for j,t in enumerate(targets):
  shoulder=(nx+(-bw if j==0 else bw),ny+3); elbow=((shoulder[0]+t[0])//2-3,ny+11)
  cap(p,[shoulder,elbow,t],4 if not large else 8,'s' if j==0 else 'b',lit='l' if j==1 else None)
  p.line([(t[0]-2,t[1]+1),(t[0]+3,t[1]+1)],'a' if kind=='imp' else 'l')
  if kind=='imp':
   p.box((t[0]-2,t[1],t[0]-1,t[1]+1),'n');p.box((t[0]+2,t[1],t[0]+3,t[1]+1),'n')
 if kind in ('harpy','angel','imp'): wing(p,(nx-4,ny+3),(max(9,nx-24),max(3,ny-12+flap*3)),kind!='imp',width=14 if kind!='angel' else 21)
 wk={'orc':'axe','goblin':'club','ogre':'club','kobold':'pick','mage':'staff','angel':'sword'}.get(kind)
 if wk: weapon(p,targets[1],n,wk,2 if large else 1)
 if kind=='mage':
  tx,ty=targets[0]; p.poly([(tx-3,ty-3),(tx-5,ty-8-flap),(tx,ty-6),(tx+3,ty-11+flap),(tx+5,ty-3)],'v'); p.line([(tx,ty-4),(tx+1,ty-8)],'l')
 return clean(p)

def small_spirit(slug,n):
 p=Pen(48,palette(slug)); dx,dy,arm,stride,f=P[n]
 if n=='dead':
  if slug=='leafling-01':
   for x in (11,18,27,34): p.poly([(x,43),(x-3,39),(x+4,40),(x+5,44)],'b','o'); p.line([(10,44),(36,44)],'a')
  elif slug=='sparkit-01': p.poly([(9,43),(17,39),(22,42),(31,38),(28,43),(36,44),(15,44)],'e','o')
  else: p.poly([(7,43),(11,40),(20,41),(27,39),(37,42),(39,44),(8,44)],'b','o'); p.line([(12,42),(28,41)],'l')
  return clean(p)
 x=23+dx//2;y=19+dy
 if slug=='leafling-01':
  # Leaf hood, seed-shaped vine body, two branching woody arms.
  for side in (-1,1):
   hx=x+side*(13+arm//3);hy=y+6+f
   cap(p,[(x+side*4,y+8),(x+side*9,y+5),(hx,hy)],2,'a',lit='c')
   p.line([(hx,hy),(hx+side*3,hy-4)],'c',2)
  p.poly([(x-8,y-7),(x-1,y-15),(x+9,y-9),(x+8,y+1),(x+2,y+8),(x-6,y+4)],'b','o'); p.line([(x-1,y-12),(x+1,y+2)],'l')
  p.poly([(x-5,y+4),(x+6,y+5),(x+3,y+17),(x,y+20),(x-4,y+13)],'b','o')
  p.line([(x-3,y+8),(x+2,y+15),(x,y+18)],'l'); p.line([(x+2,y+6),(x-2,y+11)],'a')
  p.box((x+2,y-2,x+3,y-1),'o'); p.box((x+6,y-2,x+7,y-1),'o')
  for yy in (8,14): p.poly([(x-2,y+yy),(x-8,y+yy-2-f),(x-6,y+yy+4)],'l','o')
 elif slug=='sparkit-01':
  p.poly([(x-6,y-10),(x+2,y-15),(x+9,y-7),(x+5,y+3),(x-3,y+4),(x-7,y-1)],'b','o')
  p.poly([(x-4,y+2),(x+5,y+1),(x+2,y+8),(x+7+f,y+8),(x-1,y+21),(x+1,y+12),(x-6,y+12),(x-2,y+7)],'e','o')
  for side in (-1,1):
   p.poly([(x+side*4,y),(x+side*(12+arm//3),y-5),(x+side*9,y+2),(x+side*17,y+3+f),(x+side*11,y+9),(x+side*6,y+6)],'e','o')
  p.line([(x-3,y-9),(x+1,y-12),(x+6,y-7)],'l',2); p.line([(x+3,y-3),(x+6,y-3)],'o'); p.box((x+5,y-2,x+6,y-2),'w')
 else:
  # Right-facing water fish: independently beating tail and pelvic/dorsal fins.
  p.poly([(x-6,y+3),(x-15,y-5-f),(x-17,y+1),(x-15,y+11+f),(x-6,y+8)],'b','o'); p.line([(x-14,y),(x-9,y+4)],'l')
  ell(p,(x-8,y-5,x+12,y+12),'b'); p.poly([(x-4,y-4),(x+3,y-10-f),(x+5,y-4)],'l','o')
  p.poly([(x-1,y+7),(x+7,y+9),(x+2+arm//3,y+17),(x-3,y+10)],'l','o')
  p.line([(x-5,y-2),(x+4,y-3)],'l',2); ell(p,(x+4,y-2,x+10,y+4),'w'); p.box((x+8,y,x+9,y+2),'o')
  p.line([(x+9,y+7),(x+13,y+6+(1 if n=='attack' else 0))],'o')
 return clean(p)

def quadlegs(p,body,state,base,w=5,length=16):
 bx,by=body; dx,dy,arm,stride,f=P[state]
 for i in (0,1,2,3):
  far=i<2; front=i%2; hip=(bx+(15 if front else -14),by+4)
  goal=(hip[0]+(stride if front else -stride)//(2 if far else 1)+(3 if far else 0),base-(4 if state=='move' and i%2==0 else 0))
  knee=(hip[0]+(-3 if front else 4),round((by+base)/2)+2)
  cap(p,[hip,knee,(goal[0],goal[1]-max(3,w//2+2))],w,'s' if far else 'b',lit='l' if not far else None)
  p.poly([(goal[0]-3,goal[1]-3),(goal[0]+3,goal[1]-3),(goal[0]+5,goal[1]),(goal[0]-3,goal[1])],'s' if far else 'b','o')
  if not far: p.line([(goal[0]+1,goal[1]-1),(goal[0]+4,goal[1]-1)],'w')

def lizard(slug,n):
 cell=64;p=Pen(cell,palette(slug));dx,dy,arm,stride,f=P[n];base=60
 if n=='dead':
  p.poly([(7,base-3),(14,base-8),(30,base-8),(37,base-6),(50,base-7),(57,base-2),(55,base),(19,base)],'b','o');p.line([(17,base-6),(35,base-6)],'l');p.line([(49,base-5),(53,base-3)],'o');return clean(p)
 x=29+dx//2;y=41+dy
 cap(p,[(x-8,y+3),(x-18,y+4),(6,y-2+f)],3,'b',lit='l')
 quadlegs(p,(x,y),n,base,w=3)
 p.poly([(x-15,y+1),(x-10,y-7),(x+6,y-5),(x+14,y+1),(x+9,y+9),(x-9,y+9)],'b','o');p.line([(x-11,y-4),(x-3,y-5),(x+4,y-3)],'l',2)
 hx=x+12+arm//4;hy=y-6+(2 if n=='attack' else 0)
 p.poly([(hx-5,hy+5),(hx-3,hy-2),(hx+5,hy-4),(hx+16,hy),(hx+17,hy+5),(hx+11,hy+8),(hx,hy+9)],'b','o');p.line([(hx,hy-2),(hx+7,hy-2)],'l')
 p.box((hx+5,hy+1,hx+7,hy+2),'e');p.line([(hx+7,hy+1),(hx+8,hy+1)],'o')
 p.line([(hx+7,hy+5),(hx+16,hy+5)],'o',2)
 if n in ('attack','windup'): p.line([(hx+9,hy+6),(hx+15,hy+7)],'w')
 else:p.line([(hx+11,hy+6),(hx+12,hy+6)],'w')
 for i in range(5):
  xx=x-10+i*5; yy=y-5+abs(i-2)//2;p.poly([(xx,yy),(xx+1,yy-5-(2 if slug.endswith('flame') else 0)),(xx+4,yy)],'s','o')
 for xx,yy in [(x-9,y),(x-3,y+4),(x+5,y+1),(hx+2,hy+4)]: p.poly([(xx-2,yy),(xx+2,yy-1),(xx+3,yy+2),(xx,yy+3)],'o')
 return clean(p)

def beast(slug,n):
 p=Pen(96,palette(slug));dx,dy,arm,stride,f=P[n];base=92
 if n=='dead':
  p.poly([(9,88),(22,79),(53,78),(65,84),(81,85),(86,92),(15,92)],'b','o');p.line([(24,80),(48,81)],'l',3);horn(p,76,85,10);return clean(p)
 x=44+dx//2;y=64+dy
 cap(p,[(x-17,y+3),(x-28,y+6),(9,y+f)],4,'b',lit='l')
 quadlegs(p,(x,y),n,base,w=8)
 p.poly([(x-22,y+2),(x-20,y-12),(x-11,y-17),(x+6,y-20),(x+20,y-10),(x+20,y+10),(x+3,y+15),(x-16,y+10)],'b','o');p.line([(x-19,y-10),(x-9,y-15),(x+5,y-17)],'l',3)
 for i in range(5):
  xx=x-14+i*6;yy=y-13-((i+1)%3);p.poly([(xx,yy),(xx+1,yy-8),(xx+6,yy+1)],'s','o')
 hx=x+21+arm//5;hy=y-12
 p.poly([(hx-7,hy-4),(hx+5,hy-7),(hx+12,hy-2),(hx+16,hy+6),(hx+14,hy+15),(hx+3,hy+20),(hx-8,hy+13)],'b','o');p.line([(hx-4,hy-3),(hx+4,hy-5)],'l',3)
 horn(p,hx-2,hy-3,17);horn(p,hx+8,hy-2,13)
 p.box((hx+7,hy+2,hx+10,hy+4),'e');p.line([(hx+7,hy+1),(hx+11,hy+2)],'o')
 gape=3 if n=='attack' else (-3 if n=='hit' else 0)
 p.poly([(hx+6,hy+9),(hx+15,hy+9),(hx+13,hy+16+gape),(hx+4,hy+15+gape)],'f','o');p.line([(hx+7,hy+9),(hx+13,hy+10)],'w',2);p.line([(hx+5,hy+15+gape),(hx+12,hy+16+gape)],'l')
 for yy in (y-9,y-1,y+7): p.line([(x-13,yy),(x-10,yy+3),(x-7,yy+1)],'s')
 return clean(p)

def centaur(n):
 p=Pen(96,palette('centaur-plains'));dx,dy,arm,stride,f=P[n];base=92
 if n=='dead':
  p.poly([(12,88),(24,78),(53,78),(62,84),(72,86),(80,92),(18,92)],'b','o');p.poly([(52,85),(58,76),(67,78),(69,87)],'c','o');face(p,65,82,11,9,'human',n);cap(p,[(15,90),(86,86)],2,'a',lit='c');return clean(p)
 x=44+dx//2;y=67+dy
 cap(p,[(x-20,y),(x-31,y+7),(x-34,y+16+f)],3,'a',lit='c')
 quadlegs(p,(x,y),n,base,w=4)
 ell(p,(x-23,y-10,x+24,y+11),'b');p.line([(x-15,y-7),(x+10,y-7)],'l',2)
 nx=x+16;ny=y-27
 p.poly([(nx-8,ny),(nx+8,ny),(nx+6,y+1),(nx-7,y+2)],'c','o');p.line([(nx-6,ny+1),(nx+2,ny+2),(nx+4,ny+14)],'g',2)
 face(p,nx-4,ny-14,10,12,'human',n);p.poly([(nx-6,ny-12),(nx-4,ny-17),(nx+5,ny-16),(nx+6,ny-12)],'a','o')
 for sh,t in [((nx-7,ny+3),(nx-13,ny+12-arm//2)),((nx+7,ny+3),(nx+13+arm//3,ny+12))]:cap(p,[sh,(sh[0]-2,ny+10),t],4,'b',lit='l')
 hx=nx+13+arm//3;hy=ny+12
 if n=='attack': tail=(hx-21,hy+2);tip=(91,hy-1)
 else: tail=(hx-17,hy+23);tip=(min(89,hx+8),max(3,hy-28-arm//4))
 cap(p,[tail,tip],1,'a',lit='c');p.poly([(tip[0]-3,tip[1]+4),(tip[0],tip[1]-5),(tip[0]+3,tip[1]+3)],'n','o');p.line([(tip[0],tip[1]-3),(tip[0],tip[1]+2)],'w')
 return clean(p)

def bird(slug,n):
 griff=slug=='griffin-sky';cell=96 if griff or slug=='phoenix-rebirth' else 64
 p=Pen(cell,palette(slug));dx,dy,arm,stride,f=P[n];base=cell-4
 if n=='dead':
  x=cell//2;wing(p,(x-5,base-5),(9,base-9),True,width=7);p.poly([(x-10,base-8),(x+8,base-9),(x+18,base-3),(x+12,base),(x-8,base)],'b','o');p.poly([(x+10,base-7),(x+18,base-8),(x+23,base-5),(x+18,base-2)],'g','o');return clean(p)
 x=cell//2+dx//2;y=(61 if griff else (32 if cell==64 else cell//2+6))+dy
 # Separate eagle neck for griffin; birds are narrow upright with talons.
 wing(p,(x-2,y-3),(8,max(4,y-35+f*4)),True,far=True,width=24 if cell==96 else 15)
 if griff:
  cap(p,[(x-13,y+8),(x-30,y+6),(x-33,y-2+f)],3,'b',lit='l');cap(p,[(x-33,y-2+f),(x-35,y-5+f)],5,'a')
  quadlegs(p,(x,y+3),n,base,w=5)
  p.poly([(x-23,y+3),(x-17,y-9),(x+13,y-6),(x+21,y+10),(x+11,y+20),(x-14,y+16)],'b','o');p.line([(x-17,y-7),(x-4,y-6)],'l',3)
  cap(p,[(x+11,y+3),(x+15,y-12),(x+21,y-20)],10,'l',dark='b')
  for xx,yy in [(x-14,y+1),(x-7,y+7),(x+1,y+3)]:p.line([(xx-2,yy),(xx,yy+3),(xx+3,yy+1)],'s')
  hx=x+22+arm//5;hy=y-24
 else:
  # Long flaming tail for phoenix; fan-shaped short rectrices for roc.
  if slug=='phoenix-rebirth':
   for off in (-5,0,5): p.poly([(x+off,y+5),(x-20+off,y+16),(x-29+off,y+24+f),(x-19+off,y+19),(x-9+off,y+14)],'r' if off else 'e','o')
  else:p.poly([(x-3,y+6),(x-18,y+13+f),(x-16,y+4),(x-21,y+3),(x-7,y-1)],'b','o')
  p.poly([(x-10,y-9),(x-2,y-16),(x+6,y-12),(x+12,y+2),(x+3,y+13),(x-8,y+7)],'b','o');p.line([(x-6,y-9),(x-3,y-11),(x+1,y-8)],'l',3)
  hx=x+6+arm//5;hy=y-22
  for off in (-4,4):
   foot=(x+off+stride,y+22-(4 if n=='attack' else 0));cap(p,[(x+off,y+9),(x+off+3,y+15),(foot[0],foot[1])],2,'g');p.line([foot,(foot[0]+6,foot[1]+2)],'w');p.line([foot,(foot[0]+4,foot[1]-2)],'g')
 ell(p,(hx-7,hy-4,hx+7,hy+9),'l');p.poly([(hx+4,hy+2),(hx+15,hy+4),(hx+6,hy+9)],'g','o');p.box((hx+2,hy,hx+4,hy+1),'o');p.box((hx+3,hy+1,hx+4,hy+2),'e')
 if griff:p.line([(hx-4,hy-1),(hx+1,hy-2),(hx+4,hy)],'w',2)
 if not griff:
  for i in range(4):p.poly([(hx-7+i*3,hy+7),(hx-8+i*3,hy+14),(hx-4+i*3,hy+9)],'g','o')
 if slug=='phoenix-rebirth':p.poly([(hx-4,hy-3),(hx-9,hy-12+f),(hx-1,hy-7),(hx+3,hy-15-f),(hx+4,hy-3)],'e','o')
 wing(p,(x-2,y-1),(7,max(4,y-34+f*6)),True,width=26 if cell==96 else 17)
 return clean(p)

DRAGONS={
 'wyvern-cliff':dict(cell=96,body=(43,57),torso=(22,12),neck=[(60,57),(65,42),(73,40)],head=(73,35),tail=[(24,62),(12,66),(5,54)],wing=(12,16),horn=6),
 'dragon-whelp':dict(cell=64,body=(28,35),torso=(12,10),neck=[(36,35),(40,26),(42,23)],head=(42,19),tail=[(17,43),(10,46),(5,39)],wing=(9,12),horn=4),
 'dragon-red':dict(cell=96,body=(44,60),torso=(18,17),neck=[(57,59),(59,38),(64,26)],head=(64,22),tail=[(27,69),(14,73),(7,61)],wing=(11,11),horn=9),
 'dragon-blue':dict(cell=96,body=(39,62),torso=(20,10),neck=[(54,58),(65,42),(63,27),(69,19)],head=(69,15),tail=[(22,63),(12,54),(7,41)],wing=(9,21),horn=7),
 'dragon-bone':dict(cell=96,body=(45,62),torso=(23,15),neck=[(61,61),(64,46),(72,39)],head=(72,34),tail=[(24,69),(13,72),(6,69)],wing=(13,14),horn=11)}

def dragon_head(p,hx,hy,n,width=15,hornsize=7):
 p.poly([(hx-5,hy),(hx+3,hy-3),(hx+width-5,hy),(hx+width,hy+4),(hx+width,hy+9),(hx+4,hy+12),(hx-6,hy+7)],'b','o');p.line([(hx-3,hy),(hx+3,hy-1),(hx+8,hy+2)],'l',2)
 horn(p,hx-1,hy, hornsize);horn(p,hx+5,hy,hornsize-2)
 p.line([(hx+4,hy+3),(hx+8,hy+4)],'o');p.box((hx+5,hy+4,hx+7,hy+5),'e')
 if n in ('attack','windup'):
  p.poly([(hx+6,hy+7),(hx+width,hy+7),(hx+width-2,hy+14),(hx+5,hy+12)],'f','o');p.line([(hx+6,hy+7),(hx+width-2,hy+8)],'w');p.line([(hx+7,hy+12),(hx+width-3,hy+13)],'l')
 else:p.line([(hx+6,hy+9),(hx+width-1,hy+9)],'o')

def dragon(slug,n):
 q=DRAGONS[slug];cell=q['cell'];p=Pen(cell,palette(slug));dx,dy,arm,stride,f=P[n];base=cell-4
 if n=='dead':
  y=base;p.poly([(6,y-2),(17,y-7),(34,y-10),(48,y-8),(cell-21,y-6),(cell-8,y-2),(cell-8,y),(18,y)],'b','o');wing(p,(cell//2,y-10),(16,y-15),False,width=6);dragon_head(p,cell-23,y-14,n,13,5);return clean(p)
 x,y=q['body'];x+=dx//2;y+=dy
 tip=(q['wing'][0],max(3,q['wing'][1]+f*4));wing(p,(x+5,y-7),(tip[0]+15,max(3,tip[1]-5)),False,True,width=22 if cell==96 else 12)
 tail=[(tx,ty+(f if i==2 else dy)) for i,(tx,ty) in enumerate(q['tail'])];cap(p,[(x-8,y+5)]+tail,5 if cell==96 else 3,'b',lit='l')
 # Four visible articulated legs, deliberately matching metadata even for wyvern label.
 for i in (0,1,2,3):
  front=i%2;far=i<2;hx=x+(12 if front else -11);hy=y+6
  fx=hx+(stride if front else -stride//2)+(3 if far else 0)
  sole=min(cell-7,y+23-(3 if n=='move' and not far else 0))
  cap(p,[(hx,hy),(hx-4 if front else hx+5,hy+9),(fx,sole-2)],4 if cell==96 else 3,'s' if far else 'b',lit='l' if not far else None)
  p.poly([(fx-2,sole-3),(fx+3,sole-2),(fx+5,sole),(fx-3,sole)],'b','o');p.line([(fx+1,sole-1),(fx+4,sole-1)],'w')
 a,b=q['torso'];ell(p,(x-a,y-b,x+a,y+b),'b');p.poly([(x-a+4,y-b+4),(x-2,y-b+2),(x-6,y+5),(x-a+4,y+2)],'l')
 for xx,yy in [(x-9,y-3),(x-3,y+2),(x-11,y+5),(x+1,y-5)]:
  p.line([(xx-2,yy),(xx,yy-2),(xx+2,yy)],'s');p.line([(xx-1,yy-2),(xx,yy-2)],'l')
 p.poly([(x+7,y-b+5),(x+a-2,y-4),(x+a-3,y+9),(x+6,y+b-1)],'c','o')
 for yy in range(y-3,y+b,5):p.line([(x+8,yy),(x+a-3,yy+2)],'a')
 neck=[(tx+dx//3,ty+dy+(arm//3 if i==len(q['neck'])-1 else 0)) for i,(tx,ty) in enumerate(q['neck'])]
 cap(p,neck,9 if slug=='dragon-red' else (7 if cell==96 else 6),'b',lit='l',dark='s')
 hx,hy=q['head'];hx+=dx//3+(arm//4);hy+=dy+arm//3
 dragon_head(p,hx,hy,n,14 if cell==96 else 13,q['horn'])
 for i in range(5):
  xx=x-a+3+i*6; yy=y-b+2+abs(i-2);p.poly([(xx,yy),(xx+2,yy-5),(xx+5,yy)],'s','o')
 wing(p,(x,y-4),tip,False,width=24 if cell==96 else 15)
 if slug=='dragon-bone':
  for off in (-13,-5,3):p.poly([(x+off,y-9),(x+off+7,y-6),(x+off+5,y+3),(x+off-2,y)],'l','o');p.line([(x+off,y-7),(x+off+4,y-5)],'w')
 if slug=='dragon-blue':
  for off in (-8,0,8):p.poly([(x+off,y+7),(x+off+3,y+3),(x+off+6,y+8)],'n','o')
 # Opaque wisps, from snout, no alpha blending. Color is characteristic per species.
 smoke='v' if slug=='dragon-blue' else ('w' if slug=='dragon-bone' else 'l')
 sx=min(cell-6,hx+16);sy=hy+8
 for i in range(2 if n!='attack' else 3):
  xx=min(cell-4,sx+i*3);yy=sy-i*3-f//2;ell(p,(xx-2,yy-2,xx+1,yy+1),smoke,None)
 return clean(p)

# The detailed hydra source is shared with its standalone authoring command.
_HAND_HYDRA = None

def hydra(n):
 global _HAND_HYDRA
 if _HAND_HYDRA is None:
  import importlib.util
  source = Path(__file__).resolve().parents[2] / 'hydra-three.py'
  spec = importlib.util.spec_from_file_location('hand_hydra_three', source)
  _HAND_HYDRA = importlib.util.module_from_spec(spec)
  spec.loader.exec_module(_HAND_HYDRA)
 from types import SimpleNamespace
 return SimpleNamespace(im=_HAND_HYDRA.draw(n))

HUMANS={'zombie-01','orc-01','harpy-01','kappa-01','goblin-brute','kobold-digger','mage-rogue','knight-fallen','ogre-club','imp-mischief','angel-fallen'}

def draw(slug,n):
 if slug in HUMANS:return humanoid(slug,n)
 if slug in ('leafling-01','sparkit-01','aqualing-01'):return small_spirit(slug,n)
 if slug.startswith('salamander'):return lizard(slug,n)
 if slug=='behemoth-horn':return beast(slug,n)
 if slug=='centaur-plains':return centaur(n)
 if slug in ('roc-giant','phoenix-rebirth','griffin-sky'):return bird(slug,n)
 if slug=='hydra-three':return hydra(n)
 return dragon(slug,n)

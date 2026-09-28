"""원본 왼쪽 칩의 머리·의복을 보존하고 관절별 도트를 다시 찍는 전투 원화.
실행: python3 scripts/asset-gen/charset-battler/art/rpg-zzu-cb-art5/draw.py [담당 id...]
"""
import sys, math, json
from pathlib import Path
from PIL import Image, ImageDraw
sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent.parent))
from cb_lib import walk_frame, palette, blank, place, POSES, SRC_DIR

IDS = ['actor4-0', 'actor3-4', 'actor3-5', 'actor3-6', 'actor3-7', 'actor4-1']
# 추가색은 모든 포즈를 합쳐 여섯 색으로 제한한다. 윤곽은 캐릭터 원색이다.
EXTRA = [(106,139,153), (192,220,226), (227,184,84), (133,84,43), (101,223,192), (239,255,211)]
STEEL, SHINE, GOLD, WOOD, LIGHT, CORE = EXTRA
STYLE = {
 'actor4-0': dict(weapon='sword', cloth=(34,57,73), shade=(25,38,47), trim=(207,185,165), pants=(13,100,15), boot=(90,32,0), toe=(191,100,61)),
 'actor3-4': dict(weapon='staff', cloth=(24,122,3), shade=(19,42,13), trim=(100,163,14), pants=(18,85,3), boot=(63,56,50), toe=(209,205,198)),
 'actor3-5': dict(weapon='fist', cloth=(67,65,70), shade=(42,40,45), trim=(206,207,195), pants=(136,56,88), boot=(95,54,17), toe=(216,173,80)),
 'actor3-6': dict(weapon='dagger', cloth=(67,65,70), shade=(42,40,45), trim=(253,199,48), pants=(169,152,142), boot=(61,16,35), toe=(150,0,37)),
 'actor3-7': dict(weapon='dagger', cloth=(166,66,30), shade=(97,39,18), trim=(253,199,48), pants=(166,66,30), boot=(100,77,103), toe=(209,205,198)),
 'actor4-1': dict(weapon='sword', cloth=(75,101,115), shade=(14,43,91), trim=(163,223,216), pants=(95,168,164), boot=(5,6,14), toe=(84,82,95)),
}

def pixel(im, xy, color):
 x,y = map(int, xy)
 if 0 <= x < 48 and 0 <= y <= 44:
  im.putpixel((x,y), tuple(color[:3]) + (255,))

def line(im, a, b, color, width=1):
 # 정수 브레젠험 선: 반투명이나 보간을 만들지 않는다.
 x,y=map(int,a); x1,y1=map(int,b)
 dx=abs(x1-x); sx=1 if x<x1 else -1; dy=-abs(y1-y); sy=1 if y<y1 else -1; err=dx+dy
 while True:
  for oy in range(-(width//2), width-width//2):
   for ox in range(-(width//2), width-width//2):
    if width < 4 or abs(ox)+abs(oy) <= width//2+1: pixel(im,(x+ox,y+oy),color)
  if (x,y)==(x1,y1):break
  e2=2*err
  if e2>=dy:err+=dy;x+=sx
  if e2<=dx:err+=dx;y+=sy

def polyline(im, points, color, width=1):
 for a,b in zip(points,points[1:]):line(im,a,b,color,width)

def rect(im, box, color):
 x0,y0,x1,y1=box
 for y in range(y0,y1+1):
  for x in range(x0,x1+1):pixel(im,(x,y),color)

def limb(im, points, colors, width=3):
 outline, shade, fill=colors
 polyline(im,points,outline,width+2)
 polyline(im,points,shade,width)
 polyline(im,[(x-1,y) for x,y in points],fill,1)

class Painter:
 def __init__(self,cid):
  self.cid=cid; self.s=STYLE[cid]; self.src=walk_frame(cid,'left',1)
  self.colors=set(palette(cid)); self.out=min(self.colors,key=lambda c:sum(c))
  self.skin=min(self.colors,key=lambda c:sum((a-b)**2 for a,b in zip(c,(249,193,157))))
  self.skinshade=min(self.colors,key=lambda c:sum((a-b)**2 for a,b in zip(c,(191,100,61))))
  self.head=self.src.crop((0,0,24,19))
  self.torso=self.src.crop((0,19,24,26))
  # 오른팔의 원래 손을 지운 뒤 옷감 색으로 봉합하여 중복 팔을 없앤다.
  for y in range(3,7):
   for x in range(13,24):
    old=self.torso.getpixel((x,y))
    if not old[3]:continue
    if x<=15:self.torso.putpixel((x,y),self.s['shade']+(255,))
    else:self.torso.putpixel((x,y),(0,0,0,0))
  assert all(c in self.colors for k,c in self.s.items() if k!='weapon')

 def hand(self,im,xy):
  x,y=xy
  rect(im,(x-1,y-1,x+1,y+1),self.skinshade)
  pixel(im,(x,y-1),self.skin);pixel(im,(x-1,y),self.skin);pixel(im,(x,y),self.skin)

 def arm(self,im,points):
  limb(im,points,(self.out,self.s['shade'],self.s['cloth']),3)
  x,y=points[-1]
  if self.s['weapon']=='fist':
   limb(im,points[-2:],(self.out,self.skinshade,self.skin),3)
   pixel(im,(x+1,y+1),GOLD)
  # 소매 끝/손등은 캐릭터 고유 색과 폭을 유지한다.
  line(im,(x+1,y),(x+1,y+1),self.s['trim'])
  self.hand(im,(x,y))

 def leg(self,im,hip,knee,foot,back=False):
  c=self.s
  limb(im,[hip,knee,(foot[0],foot[1]-2)],(self.out,c['shade'],c['pants']),3)
  x,y=foot
  rect(im,(x-3,y-3,x+1,y),self.out)
  rect(im,(x-2,y-2,x,y-1),c['boot'])
  line(im,(x-2,y-2),(x,y-2),c['toe'] if not back else c['boot'])

 def weapon(self,im,hand,tip,kind=None):
  kind=kind or self.s['weapon']
  if kind=='fist':return
  x,y=hand; tx,ty=tip; dx,dy=tx-x,ty-y; length=max(1,math.hypot(dx,dy)); ux,uy=dx/length,dy/length
  pt=lambda n:(round(x+ux*n),round(y+uy*n))
  if kind=='staff':
   end=pt(-7);line(im,end,tip,self.out,3);line(im,end,tip,WOOD)
   # 가지는 원본 크기의 한 픽셀 선, 끝에는 녹색 잎을 붙인다.
   line(im,(tx-3,ty+1),(tx+2,ty-2),self.out,3)
   line(im,(tx-3,ty+1),(tx+2,ty-2),self.s['pants'],1)
   pixel(im,(tx-2,ty),LIGHT);pixel(im,(tx+2,ty-2),GOLD)
   return
  blade_len=9 if kind=='dagger' else 13
  end=pt(min(length,blade_len));start=pt(3)
  line(im,pt(-2),pt(3),self.out,3);line(im,pt(-2),pt(2),WOOD)
  line(im,start,end,self.out,3);line(im,start,end,STEEL)
  line(im,(start[0],start[1]-1),(end[0],end[1]-1),SHINE)
  g=pt(2); perp=(-uy,ux)
  ga=(round(g[0]+perp[0]*2),round(g[1]+perp[1]*2));gb=(round(g[0]-perp[0]*2),round(g[1]-perp[1]*2))
  line(im,ga,gb,self.out,3);line(im,ga,gb,GOLD)

 def glow(self,im,power,xy):
  x,y=xy
  for dx,dy in [(0,0),(-1,0),(1,0)]:pixel(im,(x+dx,y+dy),CORE if dx==0 else LIGHT)
  if power>1:
   for dx,dy in [(0,-2),(0,-1),(0,1),(0,2),(-2,0),(2,0)]:pixel(im,(x+dx,y+dy),LIGHT)
   pixel(im,(x,y),CORE)
  if power>2:
   for dx,dy in [(-4,0),(0,-4),(0,4),(-3,-3),(-3,3)]:pixel(im,(x+dx,y+dy),GOLD)

 def face(self,closed=False):
  head=self.head.copy()
  if closed:
   # 눈동자(원본 9~10열)를 피부로 덮고 감은 눈을 두 도트로 쓴다.
   for y in range(14,18):
    for x in range(8,11):
     if head.getpixel((x,y))[3]:head.putpixel((x,y),self.skin+(255,))
   for x in (8,9,10):head.putpixel((x,15),self.out+(255,))
  return head

 def head_at(self,im,dx,dy,closed=False):
  im.alpha_composite(self.face(closed),(12+dx,14+dy))

 def lute(self,im,xy,strum=0):
  x,y=xy
  # 단검을 거둔 음유시인의 소형 류트: 몸통·울림구멍·목·세 줄.
  for yy,w in [(-3,2),(-2,3),(-1,4),(0,4),(1,4),(2,3),(3,2)]:
   line(im,(x-w,y+yy),(x+w,y+yy),self.out)
   line(im,(x-w+1,y+yy),(x+w-1,y+yy),GOLD)
   pixel(im,(x-w+1,y+yy),WOOD)
  line(im,(x-1,y-1),(x-7,y-9),self.out,4)
  line(im,(x-1,y-1),(x-7,y-9),GOLD,2)
  rect(im,(x-1,y-1,x,y+1),self.out)
  line(im,(x-6,y-8),(x+1,y+2),SHINE)

 def lyre(self,im,xy):
  x,y=xy
  frame=[(x-5,y-8),(x-5,y),(x-3,y+3),(x+3,y+3),(x+5,y),(x+5,y-8)]
  polyline(im,frame,self.out,3);polyline(im,frame,GOLD)
  line(im,(x-5,y-7),(x+5,y-7),self.out,3)
  line(im,(x-5,y-7),(x+5,y-7),WOOD)
  for dx in (-2,0,2):line(im,(x+dx,y-6),(x+dx,y+1),SHINE)
  line(im,(x-3,y+2),(x+3,y+2),GOLD)

 def dead(self):
  im=blank()
  # 머리·몸통·다리를 따로 눕혀 접는다. 머리는 오른쪽, 발은 왼쪽.
  h=self.face(True).crop(self.head.getbbox()).transpose(Image.Transpose.ROTATE_270)
  t=self.torso.crop(self.torso.getbbox()).transpose(Image.Transpose.ROTATE_270)
  self.leg(im,(20,39),(14,39),(10,44),True)
  self.leg(im,(21,41),(15,41),(12,44))
  im.alpha_composite(t,(18,45-t.height))
  im.alpha_composite(h,(25,44-h.height+1))
  self.arm(im,[(23,37),(23,41),(27,42)])
  if self.s['weapon']!='fist':self.weapon(im,(15,43),(5,43))
  return im

 def pose(self,pid):
  if pid=='front':return place(walk_frame(self.cid,'down',1))
  if pid.startswith('walk_'):return place(walk_frame(self.cid,'left',{'walk_a':0,'walk_b':1,'walk_c':2}[pid]))
  if pid=='dead':return self.dead()
  # 좌표는 관절: 머리 이동, 몸통 이동, 무릎/발, 앞팔/뒷팔, 무기 끝.
  cfg=dict(h=(0,0),t=(0,0),knees=((22,40),(28,40)),feet=((19,44),(29,44)),
           arm=((27,35),(24,36),(19,33)),back=((22,35),(20,36),(18,34)),tip=(13,20))
  variants={
   'attack_windup':dict(h=(2,-1),t=(1,0),knees=((23,40),(29,39)),feet=((20,44),(31,44)),arm=((28,34),(32,33),(33,28)),back=((23,34),(26,32),(30,29)),tip=(41,15)),
   'attack_strike':dict(h=(-1,-1),t=(-1,-1),knees=((19,39),(29,40)),feet=((16,44),(32,44)),arm=((26,33),(22,29),(18,25)),back=((21,33),(19,31),(17,28)),tip=(8,13)),
   'attack':dict(h=(-3,1),t=(-2,1),knees=((18,40),(28,40)),feet=((14,44),(32,44)),arm=((25,35),(20,35),(14,34)),back=((21,35),(18,37),(15,35)),tip=(1,32)),
   'attack_follow':dict(h=(-2,2),t=(-1,1),knees=((19,40),(29,40)),feet=((16,44),(32,44)),arm=((26,35),(21,38),(16,38)),back=((21,35),(20,38),(17,39)),tip=(5,43)),
   'defend':dict(h=(0,5),t=(0,4),knees=((20,42),(28,42)),feet=((19,44),(30,44)),arm=((27,38),(22,38),(19,34)),back=((22,39),(19,39),(17,36)),tip=(17,23)),
   'guard_hit':dict(h=(2,5),t=(2,4),knees=((22,42),(30,42)),feet=((21,44),(32,44)),arm=((29,38),(24,38),(21,34)),back=((24,39),(21,39),(19,36)),tip=(19,23)),
   'hit':dict(h=(4,-1),t=(2,1),knees=((23,40),(30,39)),feet=((22,44),(32,44)),arm=((29,35),(32,38),(35,35)),back=((24,35),(20,35),(18,32)),tip=(41,25)),
   'evade':dict(h=(4,1),t=(3,2),knees=((23,41),(31,40)),feet=((19,44),(33,44)),arm=((30,36),(32,39),(35,37)),back=((25,36),(23,39),(20,39)),tip=(40,27)),
   'cast_charge':dict(h=(-1,1),t=(0,1),arm=((27,35),(23,37),(19,34)),back=((22,35),(19,37),(17,34)),tip=(12,24)),
   'cast_raise':dict(h=(0,-1),t=(0,0),arm=((27,34),(29,29),(27,23)),back=((22,34),(18,29),(19,24)),tip=(22,9)),
   'cast_release':dict(h=(-2,0),t=(-1,0),knees=((20,40),(28,40)),feet=((17,44),(30,44)),arm=((26,34),(20,34),(15,32)),back=((21,34),(18,35),(16,33)),tip=(4,24)),
   'item':dict(h=(0,0),t=(0,0),arm=((27,35),(22,30),(19,26)),back=((22,35),(21,38),(24,38)),tip=(15,14)),
   'weak':dict(h=(-2,7),t=(-1,5),knees=((19,41),(28,44)),feet=((17,44),(31,44)),arm=((26,39),(23,41),(19,40)),back=((21,39),(17,42),(16,43)),tip=(8,42)),
   'dying':dict(h=(2,9),t=(1,5),knees=((23,44),(28,42)),feet=((21,44),(32,44)),arm=((28,40),(32,41),(33,43)),back=((23,40),(20,42),(18,43)),tip=(42,42)),
   'revive':dict(h=(-1,4),t=(0,3),knees=((21,40),(29,44)),feet=((18,44),(32,44)),arm=((27,37),(25,40),(21,40)),back=((22,37),(18,39),(18,41)),tip=(11,42)),
   'victory':dict(h=(0,-1),t=(0,-1),arm=((27,33),(29,28),(28,22)),back=((22,33),(18,31),(17,27)),tip=(28,8)),
   'victory_b':dict(h=(0,1),t=(0,1),knees=((22,41),(28,41)),arm=((27,35),(29,30),(28,24)),back=((22,35),(18,32),(17,28)),tip=(30,10)),
   'skill':dict(h=(-2,-1),t=(-1,0),knees=((19,40),(30,40)),feet=((15,44),(33,44)),arm=((26,34),(21,30),(16,27)),back=((21,34),(29,33),(33,28)),tip=(4,18)),
  }
  cfg.update(variants.get(pid,{})); im=blank(); tx,ty=cfg['t'];hx,hy=cfg['h']
  if self.s['weapon']=='fist' and pid in ('attack_windup','attack_strike','attack','attack_follow','skill','idle'):
   # 무도가는 관절 회전이 보이는 뒤손 가드와 짧은 잽·긴 정권을 구분한다.
   fists={
    'idle':([(27,35),(24,37),(19,33)],[(22,35),(19,34),(17,31)]),
    'attack_windup':([(29,35),(33,37),(32,33)],[(24,34),(21,35),(19,32)]),
    'attack_strike':([(26,34),(22,32),(16,30)],[(21,34),(20,37),(23,37)]),
    'attack':([(25,35),(19,33),(12,32)],[(20,35),(21,38),(24,37)]),
    'attack_follow':([(26,35),(23,36),(18,34)],[(21,35),(21,38),(24,37)]),
    'skill':([(26,34),(20,31),(12,28)],[(21,34),(23,37),(27,37)]),
   }
   cfg['arm'],cfg['back']=fists[pid]
  bard=self.cid in ('actor3-6','actor3-7')
  musical=bard and pid in ('cast_charge','cast_raise','cast_release','skill')
  if musical:
   pos={'cast_charge':(19,36),'cast_raise':(24,19),'cast_release':(17,33),'skill':(18,32)}[pid]
   cfg['arm']=((27+tx,35+ty),(25,pos[1]+1),(pos[0]+3,pos[1]))
   cfg['back']=((22+tx,35+ty),(17,pos[1]-2),(pos[0]-5,pos[1]-7))
   if pid=='cast_raise':
    cfg['arm']=((27+tx,35+ty),(31,28),(pos[0]+3,pos[1]+2))
    cfg['back']=((22+tx,35+ty),(18,28),(pos[0]-3,pos[1]+2))
  self.leg(im,(26+tx,39+ty),cfg['knees'][1],cfg['feet'][1],True)
  self.leg(im,(23+tx,39+ty),cfg['knees'][0],cfg['feet'][0])
  self.arm(im,list(cfg['back']))
  im.alpha_composite(self.torso,(12+tx,33+ty))
  # 긴 머리는 독립 조각으로 의복 뒤에 보존한다.
  if self.cid in ('actor3-4','actor3-6'):
   hair=self.src.crop((17,19,21,min(28,31-ty))); im.alpha_composite(hair,(29+tx,33+ty))
  self.head_at(im,hx,hy,pid in ('hit','guard_hit','weak','dying'))
  arm=list(cfg['arm']); hand=arm[-1]
  self.arm(im,arm)
  if musical:
   # 류트/리라 몸통과 줄을 가리는 팔을 제거하고 양손 접점을 마지막에 찍는다.
   if self.cid=='actor3-6':self.lute(im,pos,1 if pid=='cast_release' else 0)
   else:self.lyre(im,pos)
   self.hand(im,cfg['arm'][-1])
   self.hand(im,cfg['back'][-1])
   self.glow(im,2 if pid=='cast_raise' else 1,(pos[0]-8,pos[1]-11))
  elif pid.startswith('cast_'):
   if self.s['weapon']=='staff' and pid!='cast_charge':
    self.weapon(im,hand,cfg['tip']);self.hand(im,hand)
    self.glow(im,2 if pid=='cast_raise' else 3,cfg['tip'])
   else:self.glow(im,{'cast_charge':1,'cast_raise':2,'cast_release':3}[pid],(hand[0]-3,hand[1]-2))
  elif pid=='item':
   x,y=hand;rect(im,(x-2,y-6,x+2,y-2),self.out);rect(im,(x-1,y-5,x+1,y-3),LIGHT)
   line(im,(x-1,y-7),(x+1,y-7),WOOD);pixel(im,(x-1,y-5),CORE)
  else:
   self.weapon(im,hand,cfg['tip']);self.hand(im,hand)
   if pid=='skill':self.glow(im,3,(8,20))
  return im

SEQUENCES=[['walk_a','walk_b','walk_c','walk_b'],['attack_windup','attack_strike','attack','attack_follow'],['cast_charge','cast_raise','cast_release'],['idle','hit','idle'],['victory','victory_b']]

def motion(cid,poses):
 path=Path(SRC_DIR)/cid
 order=sum(SEQUENCES,[])
 strip=Image.new('RGB',(192*len(order),216),(38,42,51));d=ImageDraw.Draw(strip)
 frames=[]
 for i,pid in enumerate(order):
  pic=poses[pid].resize((192,192),Image.Resampling.NEAREST)
  strip.paste(pic,(i*192,24),pic);d.text((i*192+4,4),pid,fill=(240,240,240))
  frame=Image.new('RGB',(192,192),(38,42,51));frame.paste(pic,(0,0),pic);frames.append(frame)
 strip.save(path/'_motion.png')
 frames[0].save(path/'_motion.gif',save_all=True,append_images=frames[1:],duration=120,loop=0,disposal=2,optimize=False)
 # 검토용은 움직임별 줄로 접되 최종 _motion.png는 요구한 가로 한 줄이다.
 grid=Image.new('RGB',(768,216*5),(38,42,51));d=ImageDraw.Draw(grid)
 for row,seq in enumerate(SEQUENCES):
  for col,pid in enumerate(seq):
   pic=poses[pid].resize((192,192),Image.Resampling.NEAREST)
   grid.paste(pic,(col*192,row*216+24),pic);d.text((col*192+4,row*216+4),pid,fill=(240,240,240))
 grid.save(path/'_motion-review.png')

def main():
 for cid in sys.argv[1:] or IDS:
  assert cid in IDS
  painter=Painter(cid);poses={pid:painter.pose(pid) for pid,_,_,_ in POSES}
  path=Path(SRC_DIR)/cid;path.mkdir(parents=True,exist_ok=True)
  used=set()
  for pid,im in poses.items():
   assert im.getbbox()[3]==45,(cid,pid,im.getbbox())
   assert {p[3] for p in im.getdata()} <= {0,255}
   used.update(p[:3] for p in im.getdata() if p[3])
   im.save(path/f'{pid}.png')
  assert len(used-painter.colors)<=6,(cid,used-painter.colors)
  motion(cid,poses)
  print(cid,'24 poses; extra colors:',len(used-painter.colors))

if __name__=='__main__':main()

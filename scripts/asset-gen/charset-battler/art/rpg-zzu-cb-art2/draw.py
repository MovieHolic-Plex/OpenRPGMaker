"""원본 왼쪽 칩의 머리·옷을 보존하고 사지를 픽셀 단위로 다시 저작한다."""
from pathlib import Path
import sys, math
sys.dont_write_bytecode = True
LIB = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(LIB))
from PIL import Image, ImageDraw
from cb_lib import walk_frame, palette, place, blank, POSES, SRC_DIR

OWNED = ['actor2-0', 'actor1-5', 'actor1-6', 'actor1-7', 'actor2-1']
# 칩마다 직접 판독한 의복·피부·외곽선 색. 문자표는 원본 팔레트 순서다.
PROFILES = {
 'actor2-0': dict(kind='dagger', outline='B', cloth='G', light='K', shade='D', skin='S', skinshade='Q', boot='I', bootlight='R', core=(8,19,13,27), hair=(17,18,20,23), eye=(8,15)),
 'actor1-5': dict(kind='staff', outline='A', cloth='J', light='O', shade='F', skin=']', skinshade='W', boot='P', bootlight='U', core=(8,19,13,27), hair=(15,18,21,22), eye=(8,16)),
 'actor1-6': dict(kind='staff', outline='A', cloth='F', light='J', shade='C', skin='W', skinshade='R', boot='K', bootlight='Q', core=(7,19,12,28), hair=(16,18,18,19), eye=(8,16)),
 'actor1-7': dict(kind='staff', outline='A', cloth='H', light='I', shade='C', skin='V', skinshade='R', boot='J', bootlight='O', core=(7,19,12,29), hair=(16,18,20,24), eye=(8,16)),
 'actor2-1': dict(kind='dagger', outline='B', cloth='E', light='L', shade='C', skin='S', skinshade='P', boot='J', bootlight='R', core=(7,19,13,27), hair=(16,18,19,21), eye=(8,16)),
}
# 추가 색은 무기와 빛을 위한 정확히 여섯 가지다.
EXTRA = [(190,213,223), (242,250,246), (113,69,39), (209,158,71), (96,217,232), (172,248,236)]
MOTIONS = [('walk',['walk_a','walk_b','walk_c','walk_b']),
 ('attack',['attack_windup','attack_strike','attack','attack_follow']),
 ('cast',['cast_charge','cast_raise','cast_release']),
 ('hit',['idle','hit','idle']),('victory',['victory','victory_b'])]


def rgba(c): return tuple(c)+(255,) if len(c)==3 else tuple(c)
def dot(im,x,y,c):
 x,y=round(x),round(y)
 if 0<=x<48 and 0<=y<48: im.putpixel((x,y),rgba(c))

def points(a,b):
 x,y=a; dx=b[0]-x; dy=b[1]-y; n=max(abs(dx),abs(dy))
 return [(round(x+dx*i/max(1,n)),round(y+dy*i/max(1,n))) for i in range(n+1)]

def stroke(im, ps, color, width=1):
 # 모든 선은 정수 격자 putpixel로만 찍는다.
 for a,b in zip(ps,ps[1:]):
  for x,y in points(a,b):
   for oy in range(-(width//2),width-width//2):
    for ox in range(-(width//2),width-width//2): dot(im,x+ox,y+oy,color)

def poly(im, ps, color):
 # 오목 다각형도 픽셀 중심의 홀짝 교차 판정으로 채운다.
 for y in range(min(p[1] for p in ps),max(p[1] for p in ps)+1):
  for x in range(min(p[0] for p in ps),max(p[0] for p in ps)+1):
   inside=False
   for a,b in zip(ps,ps[1:]+ps[:1]):
    if (a[1]>y+.5)!=(b[1]>y+.5) and x+.5<(b[0]-a[0])*(y+.5-a[1])/(b[1]-a[1])+a[0]: inside=not inside
   if inside: dot(im,x,y,color)
 stroke(im,ps+[ps[0]],color)

class Painter:
 def __init__(self,cid):
  self.cid=cid; self.f=walk_frame(cid,'left',1); self.cfg=PROFILES[cid]
  self.palette=palette(cid)
  colors={chr(65+i):v for i,v in enumerate(self.palette)}
  self.c={key:colors[v] for key,v in self.cfg.items() if key in ['outline','cloth','light','shade','skin','skinshade','boot','bootlight']}
  self.o=self.c['outline']; self.kind=self.cfg['kind']
  self.sleeve={key:self.c[key] for key in ['cloth','light','shade']}
  if cid=='actor1-5':
   # 마녀의 검정 몸통과 갈색·주황 소매를 분리해 원본 배색을 유지한다.
   self.sleeve=dict(cloth=colors['U'],light=colors['Y'],shade=colors['K'])
 def close_eyes(self,head):
  # 원본 눈 흰자·동공 영역을 피부색으로 메우고 감은 눈을 두 픽셀로 찍는다.
  boxes={'actor2-0':(8,13,11,17),'actor2-1':(8,14,11,17),
   'actor1-5':(8,15,11,18),'actor1-6':(8,15,11,18),'actor1-7':(8,15,11,18)}
  x0,y0,x1,y1=boxes[self.cid]
  for y in range(y0,y1):
   for x in range(x0,x1):head.putpixel((x,y),rgba(self.c['skin']))
  for x,y in [(x0,y0+1),(x0+1,y0+2),(x0+2,y0+1)]:head.putpixel((x,y),rgba(self.o))
 def hand(self,im,p):
  x,y=p
  stroke(im,[(x,y),(x+1,y)],self.o,3)
  dot(im,x,y,self.c['skin']); dot(im,x+1,y,self.c['skinshade']); dot(im,x,y-1,self.c['skin'])
 def arm(self,im,ps,back=False):
  stroke(im,ps,self.o,4)
  stroke(im,ps,self.sleeve['shade'] if back else self.sleeve['cloth'],2)
  a,b=ps[0],ps[1]
  stroke(im,[(a[0]-1,a[1]-1),(b[0]-1,b[1]-1)],self.sleeve['light'])
  # 두 푸른 마법사의 흰 소맷단은 원본 의상 특징이다.
  if self.cid in ['actor1-6','actor1-7']:
   ps1=points(ps[-2],ps[-1]); x,y=ps1[max(0,len(ps1)-3)]
   stroke(im,[(x-1,y),(x+1,y)],self.palette[-1],2)
  self.hand(im,ps[-1])
 def leg(self,im,hip,knee,foot,back=False):
  stroke(im,[hip,knee,(foot[0]+1,foot[1]-2)],self.o,4)
  stroke(im,[hip,knee,(foot[0]+1,foot[1]-2)],self.c['shade'] if back else self.c['cloth'],2)
  dot(im,knee[0]-1,knee[1],self.c['light'])
  x,y=foot
  poly(im,[(x-2,y-1),(x,y-3),(x+3,y-2),(x+3,y),(x-3,y)],self.o)
  stroke(im,[(x-1,y-1),(x+2,y-1)],self.c['boot'])
  dot(im,x,y-2,self.c['bootlight'])
 def body(self,im,dx=0,dy=0,lean=0,closed=False,legs='stance'):
  # 몸통과 머리의 이동량을 따로 잡아 실제 관절 자세를 만든다.
  hx,hy=24+dx,39+dy
  if legs=='stance':
   self.leg(im,(hx+1,hy),(hx+4,41),(hx+6,44),True)
   self.leg(im,(hx-1,hy),(hx-3,41),(hx-5,44))
  elif legs=='lunge':
   self.leg(im,(hx+1,hy),(hx+5,41),(hx+9,44),True)
   self.leg(im,(hx-1,hy),(hx-7,40),(hx-9,44))
  elif legs=='kneel':
   self.leg(im,(hx,hy),(hx+5,43),(hx+8,44),True)
   self.leg(im,(hx-1,hy),(hx-5,41),(hx-6,44))
  elif legs=='collapse':
   self.leg(im,(hx,hy),(hx-1,43),(hx+5,44),True)
   self.leg(im,(hx,hy),(hx-6,43),(hx-3,44))
  elif legs=='together':
   self.leg(im,(hx+1,hy),(hx+2,41),(hx+3,44),True)
   self.leg(im,(hx-1,hy),(hx-2,41),(hx-3,44))
  bx=11+dx; by=14+dy
  x0,y0,x1,y1=self.cfg['core']
  core=self.f.crop((x0,y0,x1,y1))
  # 무릎을 굽힐 때는 로브 밑단을 접어서 무릎 위에 둔다.
  if dy>=2:
   height=max(4,43-(by+y0))
   if height<core.height:core=core.resize((core.width,height),Image.Resampling.NEAREST)
  # 원본 옷 무늬를 한 줄씩 보존, 몸통만 제한적으로 회전감을 낸다.
  for y in range(core.height):
   ox=round(lean*(1-y/max(1,core.height-1))*.5)
   im.alpha_composite(core.crop((0,y,core.width,y+1)),(bx+x0+ox,by+y0+y))
  hair=self.cfg['hair']; im.alpha_composite(self.f.crop(hair),(bx+hair[0]+lean,by+hair[1]))
  head=self.f.crop((0,0,24,19))
  if closed:self.close_eyes(head)
  im.alpha_composite(head,(bx+lean,by))
  return (24+dx+round(lean*.5),35+dy)
 def weapon(self,im,hand,tip,kind=None):
  kind=kind or self.kind; hx,hy=hand; tx,ty=tip
  dx,dy=tx-hx,ty-hy; length=math.hypot(dx,dy); ux,uy=dx/length,dy/length
  def p(t,n=0):return (round(hx+ux*t-uy*n),round(hy+uy*t+ux*n))
  if kind=='dagger':
   stroke(im,[p(-3),p(0)],self.o,3); stroke(im,[p(-2),p(0)],EXTRA[2])
   poly(im,[p(2,-2),p(length,0),p(2,2)],self.o)
   stroke(im,[p(3),p(length-1)],EXTRA[0],2)
   stroke(im,[p(3,-1),p(length-2,0)],EXTRA[1])
   stroke(im,[p(1,-3),p(1,3)],self.o)
   stroke(im,[p(1,-2),p(1,2)],EXTRA[3])
  else:
   # 지팡이 몸체와 끝 장식을 손을 기준으로 회전시킨다.
   stroke(im,[p(-7),p(length)],self.o,3)
   stroke(im,[p(-6),p(length)],EXTRA[2])
   stroke(im,[p(0),p(length-1)],EXTRA[3])
   orb=p(length)
   radius=2 if self.cid=='actor1-5' else 1
   poly(im,[(orb[0]-radius-1,orb[1]),(orb[0],orb[1]-radius-1),(orb[0]+radius+1,orb[1]),(orb[0],orb[1]+radius+1)],self.o)
   poly(im,[(orb[0]-radius,orb[1]),(orb[0],orb[1]-radius),(orb[0]+radius,orb[1]),(orb[0],orb[1]+radius)],EXTRA[4])
   dot(im,orb[0],orb[1]-1,EXTRA[5])
 def light(self,im,p,size=1):
  x,y=p
  if size==1:
   dot(im,x,y,EXTRA[5]);dot(im,x-1,y,EXTRA[4]);dot(im,x,y-1,EXTRA[4])
  else:
   stroke(im,[(x-size,y),(x+size,y)],EXTRA[4]);stroke(im,[(x,y-size),(x,y+size)],EXTRA[4])
   dot(im,x,y,EXTRA[1]);dot(im,x-1,y,EXTRA[5]);dot(im,x,y-1,EXTRA[5])
   for xx,yy in [(x-4,y-3),(x+3,y-4),(x-3,y+4)]:dot(im,xx,yy,EXTRA[4])
 def pose(self,pid):
  im=blank()
  if pid=='front':return place(walk_frame(self.cid,'down',1))
  if pid.startswith('walk_'):
   # 걷기 세 칸은 원본을 그대로 유지한다.
   return place(walk_frame(self.cid,'left',{'walk_a':0,'walk_b':1,'walk_c':2}[pid]))
  if pid=='dead':return self.dead()
  # (몸 위치, 기울기, 하체, 팔꿈치, 쥔손, 무기 끝). 앞 손은 항상 같은 손이다.
  data={
   'idle':(0,0,-1,'stance',(22,37),(17,34),(8,27)),
   'attack_windup':(2,0,2,'stance',(32,33),(34,26),(42,18)),
   'attack_strike':(-1,0,-2,'lunge',(22,28),(17,24),(8,15)),
   'attack':(-2,0,-2,'lunge',(17,34),(12,33),(2,33)),
   'attack_follow':(-1,1,-2,'lunge',(20,39),(15,38),(6,42)),
   'hit':(3,0,4,'stance',(32,35),(35,31),(41,25)),
   'defend':(0,3,-2,'kneel',(20,40),(16,35),(14,25)),
   'guard_hit':(3,3,0,'kneel',(23,40),(19,35),(17,25)),
   'cast_charge':(0,0,-1,'stance',(21,37),(17,33),None),
   'cast_raise':(0,0,0,'stance',(21,28),(17,22),(13,12)),
   'cast_release':(-1,0,-2,'lunge',(19,34),(13,32),(5,23)),
   'item':(0,0,0,'stance',(22,31),(18,26),None),
   'weak':(0,4,-3,'kneel',(22,40),(17,41),(7,41)),
   'evade':(5,0,4,'lunge',(31,38),(32,34),(37,26)),
   'skill':(-2,0,-3,'lunge',(19,29),(13,27),(3,19)),
   'victory':(0,0,0,'together',(30,28),(30,21),(32,11)),
   'victory_b':(0,-1,-1,'stance',(29,26),(27,19),(26,9)),
   'dying':(2,4,3,'collapse',(30,39),(34,40),(41,35)),
   'revive':(0,2,-1,'kneel',(23,39),(18,39),(12,30)),
  }
  dx,dy,lean,legs,elbow,hand,tip=data[pid]
  # 지팡이는 단검보다 넓은 호를 그리며 움직인다.
  if self.kind=='staff':
   tip={'idle':(12,21),'attack_windup':(40,13),'attack_strike':(7,13),'attack':(2,30),
    'attack_follow':(5,41),'defend':(15,23),'guard_hit':(18,23),'weak':(5,41),
    'cast_raise':(14,10),'cast_release':(5,20),'skill':(5,15),
    'victory':(32,9),'victory_b':(26,8)}.get(pid,tip)
  if self.kind=='staff' and pid=='dying':elbow,hand,tip=(29,40),(32,38),(41,30)
  if self.kind=='staff' and pid=='revive':elbow,hand,tip=(22,38),(18,36),(13,24)
  closed=pid in ['hit','guard_hit','weak','dying']
  shoulder=self.body(im,dx,dy,lean,closed,legs)
  sx,sy=shoulder
  # 반대 팔은 준비·충격·환호에 맞춰 별도로 그린다.
  back_hand=(sx-3,sy+4); back_elbow=(sx-1,sy+4)
  if pid=='attack_windup':back_elbow=(sx-6,sy+1);back_hand=(sx-8,sy-2)
  elif pid in ['attack','attack_strike','attack_follow','skill']:back_elbow=(sx+5,sy);back_hand=(sx+7,sy-3)
  elif pid in ['cast_charge','cast_raise','cast_release']:
   back_elbow=(sx-4,sy+1 if pid=='cast_charge' else sy-5)
   back_hand=(hand[0]-2,hand[1]+2)
  elif pid in ['defend','guard_hit']:back_elbow=(sx-6,sy+1);back_hand=(hand[0]-1,hand[1]+3)
  elif pid in ['victory','victory_b']:back_elbow=(sx-7,sy-2);back_hand=(sx-10,sy-6)
  elif pid=='hit':back_elbow=(sx-2,sy-2);back_hand=(sx-7,sy-5)
  elif pid=='dying':back_elbow=(sx-5,sy+1);back_hand=(sx-9,43)
  self.arm(im,[(sx-2,sy),back_elbow,back_hand],True)
  # 팔이 얼굴을 침범하지 않도록 손목은 머리 바깥쪽으로 뻗는다.
  self.arm(im,[shoulder,elbow,hand])
  if tip:
   self.weapon(im,hand,tip);self.hand(im,hand)
  if pid=='cast_charge':self.light(im,(hand[0]-2,hand[1]-2))
  elif pid=='cast_raise':self.light(im,(tip[0]-2,tip[1]-3),2)
  elif pid=='cast_release':self.light(im,(tip[0]-1,tip[1]-2),3)
  elif pid=='skill':self.light(im,(tip[0]+1,tip[1]-3),2)
  elif pid=='item':
   x,y=hand
   poly(im,[(x-1,y-8),(x+1,y-8),(x+1,y-6),(x+3,y-4),(x+3,y-1),(x-2,y-1),(x-2,y-4),(x-1,y-6)],self.o)
   stroke(im,[(x-1,y-4),(x+1,y-4)],EXTRA[4],2)
   dot(im,x-1,y-5,EXTRA[1]);stroke(im,[(x-1,y-7),(x+1,y-7)],EXTRA[3])
  return im
 def dead(self):
  im=blank()
  # 머리·몸통을 따로 눕히고 무릎·팔을 다시 찍는다. 통짜 회전 금지.
  head=self.f.crop((0,0,24,19)).copy()
  self.close_eyes(head)
  head=head.crop(head.getbbox()).transpose(Image.Transpose.ROTATE_270)
  # 얼굴은 위쪽, 머리는 오른쪽, 머리카락의 최하단은 44행.
  im.alpha_composite(head,(29,45-head.height))
  core=self.f.crop(self.cfg['core']).transpose(Image.Transpose.ROTATE_270)
  im.alpha_composite(core,(22,42-core.height))
  self.leg(im,(23,39),(18,37),(12,39),True)
  self.leg(im,(23,41),(17,42),(10,44))
  self.arm(im,[(27,39),(23,42),(19,43)])
  if self.kind=='dagger':self.weapon(im,(10,41),(2,41))
  else:self.weapon(im,(12,41),(4,41))
  return im


def evidence(cid,poses):
 out=Path(SRC_DIR)/cid
 sequence=[p for _,names in MOTIONS for p in names]
 # 전체 동작을 요청 순서대로 한 줄에 두며 별도 줄바꿈판도 만든다.
 strip=Image.new('RGB',(192*len(sequence),212),(39,43,55));d=ImageDraw.Draw(strip)
 frames=[]
 for i,pid in enumerate(sequence):
  frame=Image.new('RGB',(192,212),(39,43,55));fd=ImageDraw.Draw(frame)
  fd.text((6,3),pid,fill=(235,235,235))
  fd.line((0,200,191,200),fill=(105,74,77))
  sprite=poses[pid].resize((192,192),Image.Resampling.NEAREST);frame.paste(sprite,(0,20),sprite)
  strip.paste(frame,(i*192,0));frames.append(frame)
 strip.save(out/'_motion.png')
 frames[0].save(out/'_motion.gif',save_all=True,append_images=frames[1:],duration=120,loop=0,disposal=2,optimize=False)
 folded=Image.new('RGB',(192*4,212*5),(39,43,55))
 start=0
 for row,(_,names) in enumerate(MOTIONS):
  for col in range(len(names)):folded.paste(frames[start+col],(col*192,row*212))
  start+=len(names)
 folded.save(out/'_motion_rows.png')

def run(cid):
 painter=Painter(cid); poses={pid:painter.pose(pid) for pid,*_ in POSES}
 dest=Path(SRC_DIR)/cid;dest.mkdir(parents=True,exist_ok=True)
 for pid,im in poses.items():im.save(dest/f'{pid}.png')
 evidence(cid,poses)
 print(cid,'24포즈와 동작 증거 저장')

if __name__=='__main__':
 ids=sys.argv[1:] or OWNED
 for cid in ids:
  if cid not in OWNED:raise SystemExit('담당 범위 밖: '+cid)
  run(cid)

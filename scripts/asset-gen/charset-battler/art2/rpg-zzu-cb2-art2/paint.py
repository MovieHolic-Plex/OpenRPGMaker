"""다섯 캐릭터의 관절별 시전 원화와 무기 보유 걷기를 재현한다."""
from pathlib import Path
import importlib.util
import sys
sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
LIB = HERE.parents[1]
sys.path.insert(0, str(LIB))
from PIL import Image, ImageDraw
from cb_lib import CAST_TYPES, POSES, SRC_DIR, blank, cast_path, palette, walk_frame, place
spec = importlib.util.spec_from_file_location('first_art', LIB / 'art/rpg-zzu-cb-art2/draw.py')
first = importlib.util.module_from_spec(spec)
spec.loader.exec_module(first)
OWNED = first.OWNED
BASE_EXTRA = list(first.EXTRA)
# 몸통·무릎, 앞팔(팔꿈치/손), 뒷팔(팔꿈치/손), 지팡이 끝을 각 칸 별도 설계한다.
# 무기는 뒤 손에 쥐고 앞 손은 마법의 실루엣을 만든다. 손을 포갤 때도 무기는 유지한다.
GESTURES = {
 'fire': [
  (0,1,1,'stance',(29,38),(32,36),(30,39),(34,37),(40,24)),
  (0,0,-1,'stance',(20,37),(16,33),(23,35),(18,34),(12,22)),
  (-1,1,-2,'lunge',(15,34),(9,32),(17,37),(11,35),(5,23))],
 'ice': [
  (0,0,0,'together',(18,37),(29,30),(30,37),(17,31),(12,19)),
  (0,0,-1,'stance',(17,27),(13,21),(31,38),(36,37),(43,25)),
  (-1,0,-1,'stance',(16,32),(9,29),(27,23),(24,16),(34,8))],
 'thunder': [
  (0,3,0,'kneel',(32,39),(37,34),(20,40),(17,36),(11,25)),
  (0,-1,0,'stance',(28,23),(28,14),(19,38),(15,35),(9,24)),
  (-2,2,-2,'lunge',(15,36),(9,41),(28,34),(32,29),(39,20))],
 'heal': [
  (0,1,-2,'together',(20,38),(17,34),(20,36),(18,33),(14,21)),
  (0,0,0,'together',(16,30),(11,24),(31,30),(36,23),(38,10)),
  (-1,0,-1,'together',(17,36),(10,34),(29,36),(32,33),(34,20))],
 'dark': [
  (0,3,-3,'kneel',(17,40),(14,32),(29,39),(33,37),(39,26)),
  (1,1,2,'stance',(34,33),(38,25),(20,38),(15,37),(10,25)),
  (-2,2,-3,'lunge',(14,32),(8,30),(29,37),(34,35),(40,24))],
 'arcane': [
  (0,0,0,'together',(19,36),(15,32),(20,38),(14,36),(13,21)),
  (0,0,0,'stance',(16,25),(17,18),(29,26),(29,18),(15,10)),
  (-1,0,-2,'stance',(17,35),(10,32),(19,37),(13,35),(3,30))],
 'support': [
  (0,0,-1,'together',(20,36),(14,29),(29,38),(33,36),(39,25)),
  (0,0,-1,'stance',(16,36),(7,37),(30,36),(34,32),(40,21)),
  (0,1,-2,'together',(17,39),(13,32),(29,38),(32,35),(37,24))],
}
LIGHT = {
 'fire': ((244,94,32),(255,190,68)),
 'ice': ((108,202,255),(242,250,246)),
 'thunder': ((255,221,54),(242,250,246)),
 'heal': ((160,235,104),(242,250,246)),
 'dark': ((158,81,199),(59,29,77)),
 'arcane': ((96,217,232),(242,250,246)),
 'support': ((238,151,213),(215,190,247)),
}

class Painter(first.Painter):
 def fingers(self, im, hand, kind):
  x,y=hand
  # 원본 피부색으로 펼친 손·갈퀴·기도 손끝을 찍는다.
  if kind=='claw':
   for oy in (-2,0,2):
    first.stroke(im,[(x,y+oy),(x-3,y+oy-1)],self.o)
    first.dot(im,x-2,y+oy-1,self.c['skin'])
  elif kind=='open':
   for oy in (-2,0,2):first.dot(im,x-1,y+oy,self.c['skin'])
  elif kind=='palm':
   first.stroke(im,[(x-2,y),(x+1,y)],self.c['skin'])
   first.dot(im,x-2,y-1,self.c['skin'])

 def glow(self, im, hand, ct, step):
  x,y=hand; a,b=LIGHT[ct]
  # 불빛은 손 가장자리 3×3 안에만 둔다. 최종 칸도 총 9픽셀 이하다.
  layouts={
   'fire': [(-2,-2),(-3,-3),(-2,-4),(-1,-3),(-3,-1),(0,-2),(-1,-5)],
   'ice': [(-3,-2),(-4,-2),(-2,-2),(-3,-3),(-3,-1),(-4,-3),(-2,-1)],
   'thunder': [(-2,-4),(-3,-3),(-2,-3),(-3,-2),(-4,-1),(-3,0),(-4,1)],
   'heal': [(-3,-2),(-4,-2),(-2,-2),(-3,-3),(-3,-1),(-5,-1),(-1,-1)],
   'dark': [(-4,-2),(-5,-1),(-4,0),(-3,1),(-2,0),(-2,-2),(-3,-3)],
   'arcane': [(-3,-3),(-4,-2),(-3,-1),(-2,-2),(-3,-2),(-5,-2),(-1,-2)],
   'support': [(-3,-1),(-4,-3),(-2,-4),(-5,-2),(-3,-3),(-1,-2),(-4,0)],
  }
  for i,(dx,dy) in enumerate(layouts[ct][:3 if step==1 else 5 if step==2 else 7]):
   first.dot(im,x+dx,y+dy,b if i==0 else a)

 def cast(self,ct,step):
  # 무기 네 색 + 해당 마법 두 색. 고정 장식도 이 두 색으로 재사용한다.
  first.EXTRA = BASE_EXTRA[:4]+list(LIGHT[ct])
  dx,dy,lean,legs,fe,fh,be,bh,tip=GESTURES[ct][step-1]
  im=blank()
  shoulder=self.body(im,dx,dy,lean,ct=='heal' and step==1,legs)
  sx,sy=shoulder
  self.arm(im,[(sx-2,sy),be,bh],True)
  # 단검은 짧고 시전 손과 떨어뜨려 든다. 지팡이는 원을 그리고 겨눈다.
  if self.kind=='dagger':
   vx,vy=tip[0]-bh[0],tip[1]-bh[1]
   factor=8/max(abs(vx),abs(vy))
   tip=(round(bh[0]+vx*factor),round(bh[1]+vy*factor))
  if self.kind=='staff':
   # 나무 장식은 무기색, 발광은 지팡이 끝 두 점과 손 주변 최대 일곱 점이다.
   first.EXTRA=BASE_EXTRA[:4]+BASE_EXTRA[2:4]
   self.weapon(im,bh,tip)
   first.dot(im,tip[0],tip[1],LIGHT[ct][0])
   first.dot(im,tip[0],tip[1]-1,LIGHT[ct][1])
  else:self.weapon(im,bh,tip)
  self.hand(im,bh)
  self.arm(im,[shoulder,fe,fh])
  if ct=='dark' and step==3:self.fingers(im,fh,'claw')
  elif ct=='heal' and step==3:self.fingers(im,fh,'palm')
  elif ct in ('fire','ice','support'):self.fingers(im,fh,'open')
  # 치유는 전투 자세의 주먹 대신 펼친 손으로 기도와 건네기를 표현한다.
  if ct=='heal' and step==1:
   first.stroke(im,[(16,32),(16,35)],self.c['skin'])
   first.stroke(im,[(18,32),(18,35)],self.c['skinshade'])
  self.glow(im,fh,ct,step)
  first.EXTRA = BASE_EXTRA
  return im

 def armed_walk(self,pattern):
  im=place(walk_frame(self.cid,'left',pattern))
  # 원본 머리와 보행 하체를 그대로 두고, 원본의 늘어진 앞팔을 지운 뒤 새 팔을 찍는다.
  # 팔 영역은 몸통 바깥 26..29열에 있다. 몸통 중심과 발은 전혀 옮기지 않는다.
  d=ImageDraw.Draw(im)
  d.rectangle((26,34,30,39),fill=(0,0,0,0))
  bob=(0,-1,0)[pattern]
  shoulder=(25,34+bob); hand=(17,35+bob)
  self.arm(im,[shoulder,(22,37+bob),hand])
  tip=(11,23+bob) if self.kind=='staff' else (9,29+bob)
  self.weapon(im,hand,tip);self.hand(im,hand)
  return im

 def pose(self,pid):
  if pid.startswith('walk_'):return self.armed_walk({'walk_a':0,'walk_b':1,'walk_c':2}[pid])
  # 옛 공통 영창도 무기를 놓지 않는 비전 세 칸으로 맞춘다.
  if pid in ('cast_charge','cast_raise','cast_release'):
   return self.cast('arcane',('cast_charge','cast_raise','cast_release').index(pid)+1)
  return super().pose(pid)


def evidence(cid, casts):
 out=Path(SRC_DIR)/cid
 # 확인판은 가로 3칸씩 7줄, GIF는 같은 7마법을 가로로 두고 단계별로 움직인다.
 frames=[]
 for step in (1,2,3):
  frame=Image.new('RGB',(192*7,208),(43,47,61)); dr=ImageDraw.Draw(frame)
  for col,(ct,_) in enumerate(CAST_TYPES):
   dr.text((col*192+8,2),f'{ct} {step}',fill=(235,235,241))
   im=casts[ct,step].resize((192,192),Image.Resampling.NEAREST)
   frame.paste(im,(col*192,16),im)
  frames.append(frame)
 frames[0].save(out/'_cast.gif',save_all=True,append_images=frames[1:],duration=160,loop=0,disposal=2,optimize=False)


def run(cid):
 if cid not in OWNED:raise SystemExit('담당 범위 밖: '+cid)
 p=Painter(cid); casts={}
 for ct,_ in CAST_TYPES:
  for step in (1,2,3):
   im=p.cast(ct,step); im.save(cast_path(cid,ct,step));casts[ct,step]=im
 # 모든 전투 칸은 같은 원본과 무기로 다시 만들고 걷기·공통 영창 수정을 반영한다.
 poses={pid:p.pose(pid) for pid,*_ in POSES}
 for pid,im in poses.items():im.save(Path(SRC_DIR)/cid/f'{pid}.png')
 first.evidence(cid,poses)
 evidence(cid,casts)
 print(cid,'시전 21칸, 전투 24칸, 동작 GIF 저장')

if __name__=='__main__':
 for cid in sys.argv[1:] or OWNED:run(cid)

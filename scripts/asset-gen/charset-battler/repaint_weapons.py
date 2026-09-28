"""Repaint all battle/cast equipment from the original hand-pixel body layers.

python3 scripts/asset-gen/charset-battler/repaint_weapons.py [actor1-0 ...]
Then build.py/build_cast.py with the same IDs, WITHOUT --manifest.
Evidence and immutable first-run backups live under .omo/weapons only.
"""
import sys
sys.dont_write_bytecode=True
import inspect, json, types
from contextlib import contextmanager
from pathlib import Path
from PIL import Image, ImageDraw
import weapon_sources as sources
from weapons import POSE_ANGLES, stamp, fitting_hand
from cb_lib import ALL_IDS, SRC_DIR, ROOT

BASIC=['actor1-0','actor2-0','actor3-0','actor4-0','actor1-7','actor2-3']
# art4/heroes6.py 가 소유한 출력 id. actor3-0 은 마도사(기본 배우) 시트라 여기서 계속 지팡이로 칠한다 —
# 사무라이는 actor3-0-samurai 로 따로 있다.
HEROES6={'actor3-2','actor3-5','actor3-6','actor3-4','actor4-7'}
KINDS={
 'actor1':('sword','staff','sword','sword','staff','staff','staff','staff'),
 'actor2':('sword','dagger','bow','bow','sword','dagger','bow','bow'),
 'actor3':('staff','sword','dagger','dagger','staff','fist','dagger','dagger'),
 'actor4':('dagger','sword','sword','staff','staff','sword','staff','staff'),
}
EVIDENCE=Path(ROOT)/'.omo/weapons'
WEAPON_METHODS={'weapon','gear','blade','bow','held','held_bow'}


def source_modules():
 seen=set();found=[]
 def visit(m):
  if id(m) in seen:return
  seen.add(id(m));found.append(m)
  for obj in vars(m).values():
   if isinstance(obj,types.ModuleType) and str(getattr(obj,"__file__","")).startswith(str(sources.LIB)):visit(obj)
 for m in sources.mods+sources.stands:visit(m)
 return found


def classes():
 seen=set();found=set()
 def visit(m):
  if id(m) in seen:return
  seen.add(id(m))
  for obj in vars(m).values():
   if isinstance(obj,types.ModuleType) and str(getattr(obj,'__file__','')).startswith(str(sources.LIB)):visit(obj)
   elif isinstance(obj,type) and obj.__module__ not in ('builtins','pathlib'):
    for cls in obj.__mro__:
     if any(k in cls.__dict__ for k in WEAPON_METHODS):found.add(cls)
 for m in sources.mods+sources.stands:visit(m)
 return found


@contextmanager
def equipment_pass(mode,records,positions=None):
 """Suppress old equipment, preserving the separately drawn fingers and arms."""
 patches=[];depth=0
 def wrap(original,name):
  owns_hand='self.hand(' in inspect.getsource(original)
  def call(self,im,hand,*args,**kwargs):
   nonlocal depth
   pid=sources.CURRENT
   if mode=='record':
    if depth==0:records.setdefault(pid,[]).append(tuple(hand))
    depth+=1
    try:return original(self,im,hand,*args,**kwargs)
    finally:depth-=1
   if owns_hand and hasattr(self,'hand'):self.hand(im,hand)
  return call
 def limb(original):
  def call(self,im,*args,**kwargs):
   mapping=(positions or {}).get(sources.CURRENT,{})
   def move(v):
    if isinstance(v,(tuple,list)):
     if len(v)==2 and all(isinstance(n,(int,float)) for n in v):return mapping.get(tuple(v),v)
     return type(v)(move(n) for n in v)
    return v
   return original(self,im,*[move(v) for v in args],**{k:move(v) for k,v in kwargs.items()})
  return call
 for cls in classes():
  for name,fn in list(cls.__dict__.items()):
   if name in WEAPON_METHODS:
    patches.append((cls,name,fn));setattr(cls,name,wrap(fn,name))
   elif mode!='record' and name in ('arm','hand'):
    patches.append((cls,name,fn));setattr(cls,name,limb(fn))
 # These exact old corpse strokes were authored inline. Suppress just these
 # calls before they can overwrite legs/body; never erase their shared colors.
 corpse_strokes={
  ((6,43),(10,40),(17,40),(22,43)), ((6,44),(22,44)),
  ((17,44),(20,42),(25,42),(29,44)),
  ((17,43),(20,41),(25,41),(29,43)), ((17,44),(29,44)),
  ((22,44),(36,44)), ((22,44),(31,44)), ((26,43),(36,43)),
  ((26,43),(31,43)), ((24,42),(24,44)), ((21,43),(23,43)),
 }
 def primitive(fn,name):
  def call(im,*args,**kwargs):
   points=tuple(map(tuple,args[0])) if name=='polyline' else tuple(args[:2])
   if sources.CURRENT=='dead' and points in corpse_strokes:return
   return fn(im,*args,**kwargs)
  return call
 if mode!='record':
  for m in source_modules():
   if '/art/' not in str(getattr(m,'__file__','')):continue
   for name in ('polyline','line'):
    if hasattr(m,name):
     fn=getattr(m,name);patches.append((m,name,fn));setattr(m,name,primitive(fn,name))
 try:yield
 finally:
  for cls,name,fn in reversed(patches):setattr(cls,name,fn)


def angle_for(kind,pid):
 # Bow angles describe shooting direction: upright in the hand, flat on death.
 if kind=='bow':return 90 if pid=='dead' else 0
 # QA 2026-09-28: a collapsing body's hand is at the floor (y≈42). The 315° blade
 # cannot fit below it, so fitting_hand lifted the grip 8px above the fist and
 # the sword floated. Lay blades flat (0°) while falling, as on the corpse.
 if pid=='dying' and kind in ('sword','dagger'):return 0
 if pid.startswith('cast_'):
  step={'charge':1,'raise':2,'release':3}.get(pid.split('_')[-1])
  if step is None:step=int(pid.split('_')[-1])
  return (45,90,45)[step-1] if kind=='staff' else 90
 return POSE_ANGLES[pid]


def shield(im,center):
 x,y=center
 # Hand-pixel shield: narrow rim, steel bevel, blue face and brass boss.
 rows=[' DDDDD ','DLLLLLD','DMMMMMD','DMLgMMD','DMMgMMD',' DMMM D','  DLD  ','   D   ']
 pal={'D':(35,43,59,255),'L':(187,208,217,255),'M':(55,83,117,255),'g':(217,169,87,255)}
 for yy,row in enumerate(rows):
  for xx,c in enumerate(row):
   if c!=' ':im.putpixel((x+xx-3,y+yy-3),pal[c])


def repaint(cid):
 # 새 주인공 6명은 art4/heroes6.py 가 직업 장비(카타나·쿠나이·류트 등)까지 소유한다. 여기서 옛 공용 무기로 덮지 않는다.
 if cid in HEROES6:return {'kind':'art4/heroes6.py','poses':0}
 records={}
 with equipment_pass('record',records):original=sources.render(cid)
 group,index=cid.split('-');kind=KINDS[group][int(index)]
 if kind=='fist':return {'kind':kind,'poses':0}
 positions={};placements={};missing=set()
 # Cached common casting cells must use the same hands as the arcane row.
 for n,pid in enumerate(('cast_charge','cast_raise','cast_release'),1):
  records[pid]=records.get(f'cast_arcane_{n}',[])
 if cid in ('actor3-6','actor3-7'):records['skill']=records.get('cast_support_3',[])
 for pid,im in original.items():
  oldhands=list(dict.fromkeys(records.get(pid,[])))
  # Upright poses supersede the earlier art2 call in the same record.
  if pid in ('idle','walk_a','walk_b','walk_c','defend','guard_hit','weak'):oldhands=oldhands[-1:]
  if not oldhands:
   # Legacy item/front cells were empty-handed, and some corpses used inline
   # equipment primitives instead of a weapon method. Author their off-hand.
   oldhands=[(32,36)] if pid!='dead' else [(20,41)]
   missing.add(pid)
  # The scout may hold two knives. Retain both original hands.
  oldhands=oldhands[-2:] if cid=='actor4-0' else oldhands[-1:]
  angle=angle_for(kind,pid)
  for old in oldhands:
   # Low casting hands hold the staff outside the face. Raised hands point
   # upward; a right off-hand leans to the right rather than across the eyes.
   if kind=='staff' and pid.startswith('cast_'):
    angle=90 if old[1]<28 else 135 if old[0]>=24 else 45
   h=fitting_hand(kind,angle,old)
   # Keep the bow string ahead of the eyes when its wooden grip is raised.
   if kind=='bow' and pid in ('idle','walk_a','walk_b','walk_c','defend','guard_hit'):
    h=(min(h[0],13),h[1])
   if pid=='dead':h=(21,42) if kind!='bow' else (12,40)
   positions.setdefault(pid,{})[old]=h
   placements.setdefault(pid,[]).append((angle,h))
 with equipment_pass('clean',{},positions):clean=sources.render(cid)
 report={}
 for pid,body in clean.items():
  before=EVIDENCE/'before'/cid/(pid+'.png');before.parent.mkdir(parents=True,exist_ok=True)
  if not before.exists():Image.open(Path(SRC_DIR)/cid/(pid+'.png')).save(before)
  if pid in missing and pid!='dead':
   hx,hy=placements[pid][0][1]
   d=ImageDraw.Draw(body)
   pal=sources.cb_lib.palette(cid)
   skin=min(pal,key=lambda c:sum((c[i]-v)**2 for i,v in enumerate((231,160,109))))+(255,)
   d.line([(26,34),(29,38),(hx,hy)],fill=(35,43,59,255),width=3)
   d.rectangle((hx-1,hy-1,hx+1,hy+1),fill=skin)
  im=body.copy();placed=[]
  for angle,hand in placements.get(pid,[]):
   # Recoil is applied by art3 after arm painting.
   h=(hand[0]+2,hand[1]) if pid=='guard_hit' else hand
   h=fitting_hand(kind,angle,h)
   contact=any(body.getpixel((x,y))[3] for y in range(h[1]-1,h[1]+2) for x in range(h[0]-1,h[0]+2))
   repaired_hand=False
   if not contact and pid!='dead':
    # Some first-pass item cells drew a floating weapon with no off-hand.
    # Author a connected forearm rather than accepting a transparent grip.
    pal=sources.cb_lib.palette(cid)
    skin=min(pal,key=lambda c:sum((c[i]-v)**2 for i,v in enumerate((231,160,109))))+(255,)
    d=ImageDraw.Draw(body)
    shoulder=(27,34) if h[0]>=24 else (23,34)
    elbow=((shoulder[0]+h[0])//2,max(35,h[1]))
    d.line([shoulder,elbow,h],fill=(35,43,59,255),width=3)
    d.line([elbow,h],fill=skin,width=1)
    d.rectangle((h[0]-1,h[1]-1,h[0]+1,h[1]+1),fill=skin)
    im=body.copy();contact=True;repaired_hand=True
   points=stamp(im,kind,angle,h)
   assert pid=='dead' or contact,(cid,pid,h,'no hand at grip')
   # Restore only the 3x3 authored fist so fingers visibly wrap the handle.
   if pid!='dead':
    for y in range(h[1]-1,h[1]+2):
     for x in range(h[0]-1,h[0]+2):
      c=body.getpixel((x,y))
      if c[3]:im.putpixel((x,y),c)
   placed.append({'angle':angle,'grip':h,'hand_contact':contact,'repaired_hand':repaired_hand,'bounds':[min(x for x,y,c in points),min(y for x,y,c in points),max(x for x,y,c in points),max(y for x,y,c in points)]})
  if pid=='attack' and kind in ('sword','dagger') and placed:
   # A short broken arc trails ABOVE the edge; never a second floating blade.
   hx,hy=placed[0]['grip']
   for dx,dy in ((-3,-4),(-5,-5),(-7,-5),(-9,-4)):
    if hx+dx>0 and hy+dy>0 and not body.getpixel((hx+dx,hy+dy))[3]:
     im.putpixel((hx+dx,hy+dy),(99,124,145,255))
  if cid=='actor2-0':
   center=(19,36) if pid in ('defend','guard_hit') else (30,36)
   if pid=='dead':center=(35,41)
   else:
    # Connect the off-hand shield to the actual shoulder with a bent forearm.
    d=ImageDraw.Draw(im)
    d.line([(26,34),(28,36),center],fill=(35,43,59,255),width=3)
    d.line([(26,34),(28,36),center],fill=(55,83,117,255),width=1)
   shield(im,center)
  im.save(Path(SRC_DIR)/cid/(pid+'.png'),optimize=True)
  report[pid]=placed
 return {'kind':kind,'poses':report}


def comparison(name='before-after.png'):
 poses=['idle','attack_windup','attack_strike','attack','attack_follow','defend','victory']
 out=Image.new('RGB',(7*384,6*214),(38,42,53));d=ImageDraw.Draw(out)
 for row,cid in enumerate(BASIC):
  for col,pid in enumerate(poses):
   for side,base in enumerate((EVIDENCE/'before',Path(SRC_DIR))):
    x,y=col*384+side*192,row*214
    for yy in range(0,192,16):
     for xx in range(0,192,16):
      c=(45,49,61) if (xx//16+yy//16)%2 else (38,42,53)
      d.rectangle((x+xx,y+22+yy,x+xx+15,y+22+yy+15),fill=c)
    im=Image.open(base/cid/(pid+'.png')).resize((192,192),Image.Resampling.NEAREST)
    out.paste(im,(x,y+22),im)
    d.text((x+3,y+4),f'{cid} {pid} '+('AFTER' if side else 'BEFORE'),fill=(230,230,238))
 out.save(EVIDENCE/name)
 # A compact second sheet keeps every pixel readable in image viewers.
 after=Image.new('RGB',(7*192,6*214),(38,42,53))
 for row in range(6):
  for col in range(7):after.paste(out.crop((col*384+192,row*214,(col+1)*384,(row+1)*214)),(col*192,row*214))
 after.save(EVIDENCE/'after.png')


def main():
 EVIDENCE.mkdir(parents=True,exist_ok=True)
 report={}
 for cid in sys.argv[1:] or BASIC+[i for i in ALL_IDS if i not in BASIC]:
  report[cid]=repaint(cid);print(cid,report[cid]['kind'],flush=True)
 (EVIDENCE/'placements.json').write_text(json.dumps(report,indent=2)+'\n')
 if all((EVIDENCE/'before'/cid/'idle.png').exists() for cid in BASIC):comparison()

if __name__=='__main__':main()

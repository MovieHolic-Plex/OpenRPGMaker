"""Replay the checked-in hand-pixel source layers; never erase by global color.

art2 owns action/casting limbs; art3 owns the seven upright poses. This adapter
replays both without running their main() or changing their audit/manifest files.
The weapon pass intercepts equipment painters to recover the exact body behind
the old metal/wood pixels, including pixels with the same color as clothes.
"""
import sys, importlib.util
from pathlib import Path
sys.dont_write_bytecode=True
LIB=Path(__file__).resolve().parent; ROOT=LIB.parents[2];sys.path.insert(0,str(LIB))
import cb_lib
from functools import lru_cache
cb_lib.load_sheet=lru_cache(None)(cb_lib.load_sheet)
cb_lib.palette=lru_cache(None)(cb_lib.palette)
from cb_lib import POSES, CAST_TYPES

def module(n,p):
 s=importlib.util.spec_from_file_location(n,LIB/p);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
mods=[module(f'replay{i}',f'art2/rpg-zzu-cb2-art{i}/'+('paint.py' if i in (2,3) else 'draw.py')) for i in range(1,7)]
stands=[module(f'standing{i}',f'art3/actor{i}.py') for i in range(1,5)]

def artist(cid):
 for g,m in enumerate(mods,1):
  ids=getattr(m,'IDS',getattr(m,'OWNED',[f'actor4-{n}' for n in range(2,8)]))
  if cid in ids:
   cls=(m.Mage if cid=='actor3-0' else m.Actor1) if g==1 else m.Painter if g==2 else m.Artist
   return g,m,cls(int(cid[-1]) if g==6 else cid)

CURRENT = None

def render(cid):
 global CURRENT
 g,m,a=artist(cid)
 def cast(ct,n):
  global CURRENT
  CURRENT=f'cast_{ct}_{n}'
  im=m.cast(a,ct,n) if g==1 else a.cast(ct,n)
  return im[0] if isinstance(im,tuple) else im
 casts={(ct,n):cast(ct,n) for ct,_ in CAST_TYPES for n in (1,2,3)}
 poses={}
 for pid,*_ in POSES:
  CURRENT=pid
  if g==1:im=a.make(pid)
  elif g==2:im=a.pose(pid)
  elif g==3:im=a.combat(pid)
  elif g==4:im=a.battle(pid,casts)
  elif g==5:
   im=m.localize(a.pose(pid),a.colors)
   if pid.startswith('walk_'):im=a.walk(pid)
   if pid in ('cast_charge','cast_raise','cast_release'):im=casts['arcane',('cast_charge','cast_raise','cast_release').index(pid)+1]
   if cid in ('actor3-6','actor3-7') and pid=='skill':im=casts['support',3]
   if pid=='item' and a.s['weapon']!='fist':a.weapon(im,(25,38),(32,26));a.hand(im,(25,38))
  else:
   im=a.native(a.pose(pid))
   if pid.startswith('walk_'):im=a.walking('abc'.index(pid[-1]))
   if pid in ('cast_charge','cast_raise','cast_release'):im=casts['arcane',('cast_charge','cast_raise','cast_release').index(pid)+1]
  poses[pid]=im
 sn=int(cid[5]);sm=stands[sn-1]
 s=(sm.Artist(cid) if sn<3 else sm.Upright(cid) if sn==3 else sm.Standing(int(cid[-1])))
 for pid in ('idle','walk_a','walk_b','walk_c','defend','guard_hit','weak'):
  CURRENT=pid
  if sn<3:im=s.make(pid)
  elif pid=='weak':im=s.weak()
  else:
   pattern='abc'.index(pid[-1]) if pid.startswith('walk_') else 1
   guard=pid in ('defend','guard_hit')
   im=s.ready(pattern,guard) if sn==3 else s.ready(pattern,guard,pid=='guard_hit')
   if pid=='guard_hit':
    if sn==3:s.close_eyes(im)
    moved=cb_lib.blank();moved.alpha_composite(im,(2,0));im=moved
  poses[pid]=im
 poses.update({f'cast_{ct}_{n}':im for (ct,n),im in casts.items()})
 return poses

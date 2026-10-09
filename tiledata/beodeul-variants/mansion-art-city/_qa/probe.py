import sys,os,time
ROOT=os.path.abspath('../../..'); sys.path.insert(0,os.path.join(ROOT,'scripts/content/lib/city_v6'))
import palette; palette.apply()
from PIL import Image
import v6pieces, roman, pz, pf, ph2, pi, pe, pv2
def I(x):
    if isinstance(x,Image.Image): return x
    if isinstance(x,dict): return I(x['im'])
    if hasattr(x,'img'): return x.img()
    return x
items=[]
def t(n,f):
    t0=time.time(); r=f(); im=I(r); items.append((n,im)); print(n,type(r).__name__,im.size, (list(r.keys()) if isinstance(r,dict) else ''), round(time.time()-t0,2))
t('manor6',v6pieces.manor6)
t('temple6',lambda: v6pieces.temple6(7))
t('stoa6',lambda: v6pieces.stoa6(5,seed=2))
t('forum_gate6',v6pieces.forum_gate6)
t('gate_pier6',v6pieces.gate_pier6)
t('iron_gate',lambda: roman.iron_gate(2,True))
t('fountain',lambda: pf.fountain(0))
t('statue',lambda: roman.statue_plinth(0,1))
t('cafe_table',lambda: roman.cafe_table(0))
t('parasol',lambda: roman.cafe_parasol('leaf',2))
t('menu',roman.menu_board)
t('planter',lambda: roman.planter_box(1,1))
t('topiary',lambda: roman.topiary(1))
t('cypress',lambda: roman.cypress(3,1))
t('hedge',lambda: pz.hedge(2))
t('lamp',pz.lamp_double)
t('house',lambda: ph2.house('tim',6,1,shop=True,seed=31,door=2))
t('housesto',lambda: ph2.house('sto',6,2,gs='sto',seed=5))
t('carriage',roman.carriage)
t('tile_house',lambda: v6pieces.tile_house(3,1,door=1,Rh=40,chim=True,seed=7))
t('fsmall',pz.fountain_small)
t('statue_sage',pz.statue_sage)
t('bench',pz.bench_park)
t('flowerbox',pz.flowerbox_long)
x=0;H=max(i.height for n,i in items)
sheet=Image.new('RGBA',(sum(i.width+8 for n,i in items),H),(70,120,60,255))
for n,i in items: sheet.alpha_composite(i,(x,H-i.height)); x+=i.width+8
sheet.save('_qa/probe.png'); print(sheet.size)

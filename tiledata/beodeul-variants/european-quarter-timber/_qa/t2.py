import sys; sys.path.insert(0,'.')
from eq_base import *
import pi, pf, pl, pd, pe
def toim(r):
    if isinstance(r, Image.Image): return r
    if isinstance(r, dict) and 'im' in r: return r['im']
    if isinstance(r, tuple): return toim(r[0])
    if hasattr(r,'img_') and r.img_ is not None: return r.img_
    if hasattr(r,'img'):
        try: return fin(r)
        except Exception: return r.img()
    return None
cands=[('pz.lamp_double',lambda:pz.lamp_double()),('pz.lamp_crook',pz.lamp_crook),('pz.bench_park',pz.bench_park),('pz.table_mugs',pz.table_mugs),
('pz.parasol_table',pz.parasol_table),('pz.fountain_small',pz.fountain_small),('pz.flowerbox_long',pz.flowerbox_long),('pz.planter_round',pz.planter_round),
('pz.door_pots',pz.door_pots),('pz.tree_planter',pz.tree_planter),('pz.hedge',pz.hedge),('pz.sandwich_board',pz.sandwich_board),
('pz.stall2',lambda:pz.stall2(3,'red','fruit')),('pz.flower_cart',pz.flower_cart),('pz.veg_cart',pz.veg_cart),('pz.goods_pile',pz.goods_pile),
('pz.bracket_sign',lambda:pz.bracket_sign('bread')),('pz.bread_rack',pz.bread_rack),('pz.herb_rack',pz.herb_rack),('pz.cloth_stand',pz.cloth_stand),('pz.sword_barrel',pz.sword_barrel),
('pz.open_crate',lambda:pz.open_crate('apple')),('pz.flagpole',pz.flagpole),
('pi.crates',pi.crates),('pi.sacks',pi.sacks),('pi.woodpile',pi.woodpile),('pi.bench',pi.bench),('pi.planter',pi.planter),('pi.trough',pi.trough),('pi.noticeboard',pi.noticeboard),('pi.haystack',pi.haystack),
('pf.fountain',pf.fountain),('pf.lamppost',pf.lamppost),('pf.cart',pf.cart),('pf.anvil',pf.anvil),('pf.barrels',pf.barrels),('pf.banner_pole',pf.banner_pole),('pf.shop_sign',lambda:pf.shop_sign('inn')),
('pl.signpost',pl.signpost),('pl.rainbarrel',pl.rainbarrel),('pl.flowerbed',pl.flowerbed),('pl.gardentable',pl.gardentable),('pe.well',pe.well),('pd.well',pd.well)]
ims=[]
for n,f in cands:
    try:
        im=toim(f()); ims.append((n,im)); print(n, im.size)
    except Exception as e: print('ERR',n,repr(e)[:120])
from PIL import ImageDraw
cols=8; cw=max(i.width for _,i in ims)+8; ch=max(i.height for _,i in ims)+14
rows=-(-len(ims)//cols); c=Image.new('RGBA',(cols*cw,rows*ch),(110,100,90,255)); d=ImageDraw.Draw(c)
for k,(n,im) in enumerate(ims):
    x=(k%cols)*cw; y=(k//cols)*ch; c.alpha_composite(im,(x+4,y+ch-im.height-2)); d.text((x+1,y),n[3:15],fill=(255,255,255,255))
c.resize((c.width*2,c.height*2),Image.NEAREST).save('_qa/t2.png'); print(c.size)

# renders every form of the house study after the view fix (one projection: front-top, left-right symmetric)
import sys; sys.path.insert(0,'/tmp/j8city')
import palette; palette.apply()
import pv, pj, shapes
from PIL import Image
from sheet2 import lawn
from pj_demo import roofrows as RR, storeyrows as SR
L=pv.L()
def row(ims,gap=12,pad=8):
    ims=[pj.outlined(i) for i in ims]
    W=sum(i.width for i in ims)+gap*(len(ims)-1)+pad*2; H=max(i.height for i in ims)+pad*2
    o=Image.new('RGBA',(W,H))
    for x in range(0,W,16):
        for y in range(0,H,16): o.paste(lawn,(x,y))
    x=pad
    for i in ims: o.alpha_composite(i,(x,H-pad-i.height)); x+=i.width+gap
    return o
def comp(parts,W,H):
    o=Image.new('RGBA',(W,H))
    for im,x,y in parts: o.alpha_composite(im,(x,y))
    return o
out={}
out['gfront']=row([pv.gfront('tim',3),pv.gfront('tim',5),pv.gfront('tim',5,2,gs='sto'),pv.gfront('sto',3),pv.gfront('sto',4,2,gs='sto')])
out['cross']=row([pv.crossgable('tim',9,1,gables=(1,5)),pv.crossgable('sto',11,2,gables=(0,4,8),gs='sto'),pv.crossgable('tim',8,2,gables=(5,),gs='sto')])
out['forms']=row([pv.hip('tim',6,4),pv.hip('sto',7,4,2),pv.round_tower(),pv.round_tower('sto',4,4,4),pv.windmill(),pv.market_hall()])
# add-ons (attached: porch under the eave, balcony + stair down toward the viewer, lean-to against the east side)
import addons2
out['addons']=row([addons2.porch_house(),addons2.dormer_house(),addons2.balcony_house(),addons2.lean_house()])
out['shapes']=row([shapes.image(shapes.plan(**v)).crop((1,1,None,None)) if False else pj.assemble(*shapes.plan(**v)[:1],L,shapes.plan(**v)[1]) for v in shapes.SHAPES.values()])
for k,v in out.items(): v.save(f'/tmp/j8city/v_{k}.png'); print(k,v.size)

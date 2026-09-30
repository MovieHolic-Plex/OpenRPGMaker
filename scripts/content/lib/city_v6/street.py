# one street, many house forms: the same kit used with variety (study)
import sys; sys.path.insert(0,'/tmp/j8city')
import palette; palette.apply()
import pv, pj, pk, shapes, pi, pl, pf
from PIL import Image
from sheet2 import lawn
from pj_demo import roofrows as RR, storeyrows as SR
L=pv.L()
def comp(parts,W,H):
    o=Image.new('RGBA',(W,H))
    for im,x,y in parts: o.alpha_composite(im,(x,y))
    return o
W,H=52,15; street_y=12
houses=[]   # (image, x cells, bottom cell)
houses.append((pv.gfront('tim',5,2,gs='sto'),1,11))
m=pj.assemble(RR('tim',6,None,3)+SR('tim','lwpdwr','eave','base'),L); houses.append((comp([(m,0,0),(pv.porch('tim',3),40,m.height-34+10)],96,m.height+10),6,11+0))
houses.append((pv.hip('sto',7,4,2),13,11))
houses.append((shapes.image(shapes.plan(st='tim',w=7,s=1,wings=[(4,'S',2)])),21,11))
houses.append((pv.gfront('sto',3,1),28,11))
m3=pj.assemble(RR('sto',7,None,4)+SR('sto','lwpdpwr','eave','base'),L); d=pv.dormer('sto')
houses.append((comp([(m3,0,0),(d,15,26),(d,79,26)],112,m3.height),31,11))
mm=pj.assemble(RR('tim',5,None,3)+SR('tim','lwdwr','eave','base'),L); lt=pv.leanto('tim',3,'lpr')
houses.append((comp([(lt,80,mm.height-lt.height),(mm,0,0)],128,mm.height),38,11))
houses.append((pv.round_tower(),46,11))
img=Image.new('RGBA',(W*16,H*16))
for x in range(W):
    for y in range(H): img.paste(lawn,(x*16,y*16))
mask=[[y in (street_y,street_y+1) for x in range(W)] for y in range(H)]
img.alpha_composite(pk.road(mask).img())
objs=[]
for im,x,yb in houses:
    im=pj.outlined(im); objs.append((im,x*16-1,(yb+1)*16-im.height+1))
sh=Image.new('L',img.size,0)
for im,x,y in objs:
    a=im.split()[3].point(lambda v:255 if v>128 else 0); sh.paste(255,(x+6,y+3),a)
px=img.load(); mp=sh.load()
for yy in range(img.height):
    for xx in range(img.width):
        if mp[xx,yy]: r,g,b,a=px[xx,yy]; px[xx,yy]=(int(r*0.52),int(g*0.58),int(b*0.74),a)
for im,x,y in sorted(objs,key=lambda o:o[2]+o[0].height): img.alpha_composite(im,(x,y))
img.save('/tmp/j8city/street.png')

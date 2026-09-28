import sys; sys.path.insert(0,'/tmp/j8city')
import palette; palette.apply()
import pv, pj
from PIL import Image
from pj_demo import roofrows as RR, storeyrows as SR
L=pv.L()
def comp(parts,W,H):
    o=Image.new('RGBA',(W,H))
    for im,x,y in parts: o.alpha_composite(im,(x,y))
    return o
def porch_house():
    m=pj.assemble(RR('tim',6,None,3)+SR('tim','lwpdwr','eave','base'),L); base=m.height-1; p=pv.porch('tim',3)
    return comp([(m,0,0),(p,40,base-30)],96,base+1+p.height-31)
def dormer_house():
    m3=pj.assemble(RR('sto',7,None,4)+SR('sto','lwpdpwr','eave','base'),L); d=pv.dormer('sto')
    return comp([(m3,0,0),(d,15,24),(d,79,24)],112,m3.height)
def balcony_house():
    # user verdict 2026-09-28: the stair climbing ALONG the wall (this version) reads better than one coming toward us
    m=pj.assemble(RR('tim',8,None,4)+SR('tim','lwwwwwwr','eave','jetty')+SR('sto','lwpdpppr','plain','base'),L)
    base=m.height-1; st=pv.stair_side(rise=32,depth=7,run=6,up='L'); bal=pv.balcony_side(48)
    return comp([(m,0,0),(bal,24,base-32-6),(st,72,base+4-st.height)],128,m.height+6)
def lean_house():
    m=pj.assemble(RR('tim',5,None,3)+SR('tim','lwdwr','eave','base'),L); base=m.height-1; l=pv.leanto_side('tim',2)
    return comp([(m,0,0),(l,80,base+1-l.height)],112,m.height)
if __name__=='__main__':
    import vstudy; im=Image.open('/tmp/j8city/v_addons.png'); im.resize((im.width*3,im.height*3),Image.NEAREST).save('/tmp/j8city/z_addons.png')

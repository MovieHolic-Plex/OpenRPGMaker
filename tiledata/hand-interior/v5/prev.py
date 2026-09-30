import sys; sys.path.insert(0,'tiledata/hand-interior/v5')
import kit4
from kit4 import *
from PIL import Image
def sheet(items,out,sc=4,bg=(120,96,70)):
    W=sum(f.im.width+8 for f in items)+8; Hh=max(f.im.height for f in items)+16
    im=Image.new('RGBA',(W,Hh),bg+(255,)); x=8
    for f in items: im.alpha_composite(f.im,(x,Hh-8-f.im.height)); x+=f.im.width+8
    im.resize((W*sc,Hh*sc),Image.NEAREST).save(out)
if __name__=='__main__':
    print('selfcheck',kit4.selfcheck())
    sheet([assemble(s,w,h) for s,w,h in (('dining',2,1),('dining',3,2),('work',2,1),('desk',2,1),('display',3,1),('display',2,2),('counter',3,1),('kcounter',3,1),('sideboard',2,1))],'tiledata/hand-interior/v5/p_kit.png',3)
    sheet([firewood_rack(1),firewood_rack(2),firewood_bundle(),kitchen_range(0),proofing_rack(),bread_shelf(),peel_rack(),coal_bin(),broom_bucket(),towel_rail()],'tiledata/hand-interior/v5/p_new.png',5)
    sheet([stairwell_down(),tall_window(),runner2()],'tiledata/hand-interior/v5/p_new2.png',4)

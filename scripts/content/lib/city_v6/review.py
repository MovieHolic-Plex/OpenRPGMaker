# Visual view-angle / quality review: the target chipset's own props next to the new pieces, same zoom, on lawn.
# The AI must LOOK at this sheet (Read the PNG) and judge each piece by eye. There is no numeric pass/fail.
# usage: python3 review.py out.png module "name1,name2,..." [scale]   (PX_CHIPSET overrides the chipset)
import os, sys, importlib
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from PIL import Image
from sheet2 import card, lawn
CHIP=os.environ.get('PX_CHIPSET','/home/main/z-project/rpg-zzu/public/assets/atlas-biomes/jungle-chipset.png')
# chipset crops that show the view: barrel / round table / pots / chairs, and signs / tombstone / stone pot / fence
BOXES=[(396,396,480,448),(288,128,400,208)]
def onlawn(im):
    bg=Image.new('RGBA',im.size)
    for x in range(0,im.width,16):
        for y in range(0,im.height,16): bg.paste(lawn,(x,y))
    bg.alpha_composite(im); return bg
def sheet(out,mod,names,S=6):
    chip=Image.open(CHIP).convert('RGBA'); m=importlib.import_module(mod)
    ims=[onlawn(chip.crop(b)) for b in BOXES]+[card(m.P[n]().img(),wat=n in m.WATER,S=1)[1] for n in names]
    H=max(i.height for i in ims); W=sum(i.width for i in ims)+4*len(ims)
    o=Image.new('RGBA',(W,H),(27,28,31,255)); x=0
    for i in ims: o.paste(i,(x,H-i.height)); x+=i.width+4
    o.resize((W*S,H*S),Image.NEAREST).save(out)
if __name__=='__main__':
    sheet(sys.argv[1],sys.argv[2],sys.argv[3].split(','),int(sys.argv[4]) if len(sys.argv)>4 else 6)

import os
import sys; sys.path.insert(0,__import__('os').path.dirname(__import__('os').path.abspath(__file__)))
from PIL import Image
HERE=os.path.dirname(os.path.abspath(__file__)); ASSETS='/home/main/.claude/skills/pixel-object-authoring/assets'
# backgrounds for preview cards: a lawn tile and a water tile from the target chipset (override with PX_LAWN / PX_WATER)
lawn=Image.open(os.environ.get('PX_LAWN',os.path.join(ASSETS,'lawn16.png'))).convert('RGBA')
water=Image.open(os.environ.get('PX_WATER',os.path.join(ASSETS,'water16.png'))).convert('RGBA')
def card(im,wat=False,S=4,pad=8):
    w,h=im.size; bg=Image.new('RGBA',(w+2*pad,h+2*pad)); t=water if wat else lawn
    for x in range(0,bg.width,16):
        for y in range(0,bg.height,16): bg.paste(t,(x,y))
    bg.alpha_composite(im,(pad,pad)); return bg.resize((bg.width*S,bg.height*S),Image.NEAREST),bg
def row(ims,out,gap=8):
    W=sum(i.width for i in ims)+gap*(len(ims)-1); H=max(i.height for i in ims)
    r=Image.new('RGBA',(W,H),(27,28,31,255)); x=0
    for i in ims: r.paste(i,(x,0)); x+=i.width+gap
    r.save(out)

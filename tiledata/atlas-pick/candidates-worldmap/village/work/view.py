import sys
from PIL import Image
base='/home/main/.t3/worktrees/rpg-zzu/t3code-8b4b09de-jp-pick/tiledata/atlas-pick/candidates-worldmap'
def view(slugs, z=10, out=None):
    ims=[]
    for s in slugs:
        for k in 'ABC':
            im=Image.open(f'{base}/{s}/w5-{k}.png').convert('RGBA'); bg=Image.new('RGBA',im.size,(70,110,60,255)); bg.alpha_composite(im); ims.append(bg.resize((im.width*z,im.height*z),Image.NEAREST))
    W=sum(i.width for i in ims)+10*len(ims); H=max(i.height for i in ims)
    o=Image.new('RGB',(W,H),(30,30,30)); x=0
    for i in ims: o.paste(i,(x,0)); x+=i.width+10
    o.save(out or f'{base}/village/work/view.png')
view(sys.argv[1:])

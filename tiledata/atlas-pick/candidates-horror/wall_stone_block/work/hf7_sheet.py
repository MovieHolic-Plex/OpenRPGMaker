import sys
from PIL import Image
R='/home/main/.t3/worktrees/rpg-zzu/t3code-8b4b09de-jp-pick/tiledata/atlas-pick/candidates-horror/'
slug=sys.argv[1]; out=sys.argv[2]
ims=[Image.open(f'{R}{slug}/hf7-{c}-x4.png').convert('RGBA') for c in 'ABC']
w=sum(i.width for i in ims)+40;h=max(i.height for i in ims)
o=Image.new('RGBA',(w,h),(60,60,60,255));x=0
for i in ims:o.paste(i,(x,0),i);x+=i.width+20
o.save(out)

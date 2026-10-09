import sys
from PIL import Image
slug=sys.argv[1]; d='/home/main/.t3/worktrees/rpg-zzu/t3code-8b4b09de-jp-pick/tiledata/atlas-pick/candidates-school/'+slug+'/'
ims=[Image.open(d+'s5-%s-x4.png'%x).convert('RGBA') for x in 'ABC']
w=sum(i.width for i in ims)+20;h=max(i.height for i in ims)
o=Image.new('RGBA',(w,h),(90,90,90,255));x=0
for i in ims: o.paste(i,(x,0),i);x+=i.width+10
o.save('/tmp/s5-%s.png'%slug)

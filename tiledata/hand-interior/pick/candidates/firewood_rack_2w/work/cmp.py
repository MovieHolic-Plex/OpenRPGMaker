import sys
from PIL import Image
slug=sys.argv[1]; names=sys.argv[2:]; z=8
D='/home/main/.t3/worktrees/rpg-zzu/t3code-8b4b09de-i16-pick/tiledata/hand-interior/pick/candidates/'+slug+'/'
ims=[Image.open(D+n+'.png').convert('RGBA') for n in names]
ims=[i.resize((i.width*z,i.height*z),Image.NEAREST) for i in ims]
W=sum(i.width for i in ims)+10*len(ims);H=max(i.height for i in ims)
c=Image.new('RGBA',(W,H),(96,88,104,255));x=0
for i in ims: c.paste(i,(x,0),i);x+=i.width+10
c.save('/tmp/w10/cmp_%s.png'%slug)

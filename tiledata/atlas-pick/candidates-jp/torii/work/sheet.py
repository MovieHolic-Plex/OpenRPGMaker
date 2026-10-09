import sys
from PIL import Image
d=sys.argv[1]; names=sys.argv[2:]; sc=3
ims=[Image.open(f'{d}/{n}-x4.png').convert('RGBA') for n in names]
W=sum(i.width for i in ims)+10*len(ims); H=max(i.height for i in ims)
o=Image.new('RGBA',(W,H),(120,120,120,255)); x=0
for i in ims: o.paste(i,(x,0),i); x+=i.width+10
o=o.resize((int(o.width*sc*0.75),int(o.height*sc*0.75)),Image.NEAREST) if o.width<300 else o
o.save(f'{d}/work/j3-sheet.png')

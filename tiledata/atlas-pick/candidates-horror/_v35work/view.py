import sys
from PIL import Image
files=sys.argv[2:]; out=sys.argv[1]; S=8
ims=[Image.open(f).convert('RGBA') for f in files]
h=max(i.height for i in ims)*S+20; w=sum(i.width*S+20 for i in ims)+20
s=Image.new('RGBA',(w,h),(70,70,80,255)); x=20
for i in ims:
    s.alpha_composite(i.resize((i.width*S,i.height*S),0),(x,10)); x+=i.width*S+20
s.save(out)

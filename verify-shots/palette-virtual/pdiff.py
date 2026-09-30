import sys
from PIL import Image, ImageChops
a=Image.open(sys.argv[1]).convert("RGB"); b=Image.open(sys.argv[2]).convert("RGB")
print(a.size,b.size)
w=min(a.width,b.width); h=min(a.height,b.height)
a=a.crop((0,0,w,h)); b=b.crop((0,0,w,h))
d=ImageChops.difference(a,b); bb=d.getbbox()
px=sum(1 for p in d.getdata() if max(p)>8)
print("bbox",bb,"diffpx>8:",px,"of",w*h, "%.3f%%"%(100*px/(w*h)))

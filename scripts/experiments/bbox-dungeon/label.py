import json,sys
from PIL import Image, ImageDraw, ImageFont
R=sys.argv[1]; K=2
im=Image.open(f"{R}/palette-raw.png").convert("RGB"); im=im.resize((im.width*K,im.height*K),Image.NEAREST)
d=ImageDraw.Draw(im); F=ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",11)
for b in json.load(open(f"{R}/palette.json")):
    x,y,w,h=b["x"]*32,b["y"]*32,b["w"]*32,b["h"]*32
    d.rectangle([x,y,x+w-1,y+h-1],outline=(255,220,60))
    t=b["name"]; tw=d.textlength(t,font=F); tx=x; ty=y+h+2
    d.rectangle([tx-1,ty-1,tx+tw+1,ty+12],fill=(0,0,0)); d.text((tx,ty),t,fill=(255,255,255),font=F)
im.save(f"{R}/palette.png"); print(im.size)

"""Read existing PNG/GIF frame strips; diagnostic backgrounds and labels only."""
from pathlib import Path
from PIL import Image, ImageDraw
ROOT=Path(__file__).resolve().parent
old=Image.open(ROOT/'repair-before/attack.png').convert('RGBA')
new=Image.open(ROOT/'png/attack.png').convert('RGBA')
out=Image.new('RGB',(912,840))
draw=ImageDraw.Draw(out)
for col,(label,bg) in enumerate([('light',(234,229,214)),('dark',(32,34,44)),('checker',(81,86,99))]):
 x=col*304
 draw.rectangle((x,0,x+303,839),fill=bg)
 for row,(version,im) in enumerate([('before',old),('after',new)]):
  y=row*420
  if label=='checker':
   for yy in range(y+24,y+420,12):
    for xx in range(x,x+304,12):
     draw.rectangle((xx,yy,xx+11,yy+11),fill=(81,86,99) if ((xx-x)//12+(yy-y)//12)%2 else (116,120,128))
  draw.text((x+8,y+4),label+' / '+version+' / 1x + 3x',fill=(25,26,33) if label=='light' else (244,230,206))
  out.paste(im,(x+8,y+26),im)
  big=im.resize((288,288),Image.Resampling.NEAREST)
  out.paste(big,(x+8,y+124),big)
out.save(ROOT/'attack-thread-comparison.png')
seq=['idle','attack','hit','dead','skill','poison','stun','sleep']
out=Image.new('RGB',(592,8*120),(233,227,211))
draw=ImageDraw.Draw(out)
for i,name in enumerate(seq):
 draw.text((8,i*120+4),name+' / decoded GIF frames, native 1x',fill=(25,26,33))
 strip=Image.open(ROOT/'gif-frames'/(name+'-native.png'))
 out.paste(strip,(8,i*120+20))
out.save(ROOT/'gif-native-review.png')

"""세 후보의 ctx.png 를 세로로 붙여 work/trio.png 에 (보기용)"""
import sys
from PIL import Image
d=sys.argv[1]; pre=sys.argv[2] if len(sys.argv)>2 else 'w2'
ims=[Image.open(f'{d}/{pre}-{x}.ctx.png').convert('RGB') for x in 'ABC']
half=[i.crop((0,0,i.width,i.height)) for i in ims]
c=Image.new('RGB',(ims[0].width, sum(i.height+6 for i in ims)),(20,20,20)); y=0
for i in ims: c.paste(i,(0,y)); y+=i.height+6
c.save(f'{d}/work/trio.png')

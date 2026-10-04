#!/usr/bin/env python3
"""j5 확인용: slug 의 j5-A/B/C.png 를 배율 확대해 한 장(.j5sheet.png, work/ 아래)으로. 사용: j5-sheet.py slug [배율]"""
import sys
from PIL import Image
slug=sys.argv[1]; z=int(sys.argv[2]) if len(sys.argv)>2 else 8
base=f'tiledata/atlas-pick/candidates-jp/{slug}'
ims=[]
for x in 'ABC':
    try: ims.append(Image.open(f'{base}/j5-{x}.png').convert('RGBA'))
    except Exception: pass
w=sum(i.width*z+8 for i in ims)+8; h=max(i.height*z for i in ims)+16
sh=Image.new('RGBA',(w,h),(96,140,96,255)); x=8
for i in ims:
    b=i.resize((i.width*z,i.height*z),Image.NEAREST); sh.alpha_composite(b,(x,8)); x+=b.width+8
sh.save(f'{base}/work/j5-sheet.png')

import sys,time; sys.path.insert(0,__import__('os').path.dirname(__import__('os').path.abspath(__file__)))
import palette; palette.apply()
from PIL import Image
import city6_anim as A, json
base=Image.open('/tmp/j8city6/city6_base.png').convert('RGBA'); meta=json.load(open('/tmp/j8city6/city6_anim.json'))
for f in range(A.LOOP): A.FR.append(A.frame(base,f,meta))
boxes={'g5_forum':((864,528,1216,768),2),'g5_bridge':((470,420,700,640),2),'g5_harbour':((620,1180,1060,1500),1),'g5_castle':((0,130,540,450),1),
       'g5_mills':((0,520,220,780),2),'g5_estate':((600,20,880,380),1),'g5_pond':((20,1260,220,1420),2),'g5_lake':((1150,1380,1450,1600),2)}
d=[s for s in meta['smoke'] if s[2]=='dark']
for i,s in enumerate(d[:2]):
    x,y=s[0],s[1]; boxes[f'g5_smoke{i}']=((max(0,x-150),max(0,y-80),min(1600,x+150),y+60),2)
for k,(b,sc) in boxes.items(): A.gif(base,b,f'/tmp/j8city6/{k}.gif',scale=sc)
print('ok',list(boxes))

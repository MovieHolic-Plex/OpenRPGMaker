from pathlib import Path
import json
from PIL import Image, ImageDraw

SOURCE = Path(__file__).resolve().parents[1]
# Literal native runs selected individually. No calculated art or pose transforms.
WINDUP = [
 (37,34,'cso.....ohho'),
 (37,35,'cloo..opuhko'),
 (36,36,'ccllcopuutho'),
 (35,37,'ccllccluuupoho..'),
 (34,38,'cclcsoopthhho...'),
 (34,39,'ccsso..wmvho....'),
 (34,40,'csso..wmv.......'),
 (33,41,'idd..wmv.........'),
 (33,42,'RRrr.wmv.........'),
 (33,43,'Rrptwmmvo........'),
 (33,44,'irpuhhuto........'),
 (33,45,'irohkptpo........'),
 (33,46,'iohkkosso........'),
 (33,47,'ohkkocso.........'),
 (32,48,'ohkkoccso.........'),
 (31,49,'ohkkocccso.........'),
 (30,50,'ohkkocclccso'),
 (29,51,'ohkkoccllcso'),
 (28,52,'ohkko'),
 (28,53,'oko'),
 (28,54,'oo'),
]
MOVE = [
 (62,15,'w'), (61,16,'wv'), (60,17,'wmv'), (60,18,'wmv'),
 (59,19,'wmmv'), (58,20,'wmmv'), (57,21,'wmmv'), (57,22,'wmmv'),
 (56,23,'wmmv'), (55,24,'wmmv'), (54,25,'wmmv'), (54,26,'wmmv'),
 (53,27,'wmmv'), (52,28,'wmmv'), (51,29,'wmmv'), (51,30,'wmmv'),
 (50,31,'wmmv'), (49,32,'wmmv'), (49,33,'wmmv'),
 (48,34,'wmmv.'), (47,35,'wmmv.'), (46,36,'wmmv'),
 (43,37,'..wmmv'), (43,38,'hwmv'),
]

def apply():
 for name,runs in [('windup',WINDUP),('move',MOVE)]:
  path=SOURCE/'poses'/f'{name}.pxgrid'
  rows=[list(row) for row in path.read_text().splitlines()]
  for x,y,pixels in runs: rows[y][x:x+len(pixels)]=pixels
  path.write_text('\n'.join(''.join(row) for row in rows)+'\n')

def render():
 palette=json.loads((SOURCE/'palette.json').read_text())
 colors={key:tuple(bytes.fromhex(value[1:]))+(255,) for key,value in palette.items()}
 names=['windup','move','idle_a','recover']
 backgrounds=[('light',(226,222,207)),('dark',(24,27,36)),('checker',None)]
 review=Image.new('RGB',(4*216,3*304),(112,112,112))
 draw=ImageDraw.Draw(review)
 for col,name in enumerate(names):
  rows=(SOURCE/'poses'/f'{name}.pxgrid').read_text().splitlines()
  sprite=Image.new('RGBA',(64,64),(0,0,0,0))
  for y,row in enumerate(rows):
   for x,symbol in enumerate(row):
    if symbol!='.': sprite.putpixel((x,y),colors[symbol])
  if name in ['windup','move']: sprite.save(SOURCE/'inspection'/f'{name}-weapon-repaired.png')
  for band,(label,color) in enumerate(backgrounds):
   bg=Image.new('RGBA',(64,64),color+(255,) if color else (0,0,0,255))
   if color is None:
    for y in range(64):
     for x in range(64):
      v=132 if (x//8+y//8)%2 else 160
      bg.putpixel((x,y),(v,v,v,255))
   bg.alpha_composite(sprite)
   left=col*216+12; top=band*304
   draw.text((left,top+4),f'{name} / {label} 1x + 3x',fill=(245,245,245))
   review.paste(bg.convert('RGB'),(left,top+24))
   enlarged=bg.resize((192,192),Image.Resampling.NEAREST)
   review.paste(enlarged.convert('RGB'),(left,top+100))
   if name in ['windup','move']:
    bg.save(SOURCE/'inspection'/f'{name}-weapon-{label}-1x.png')
    enlarged.save(SOURCE/'inspection'/f'{name}-weapon-{label}-3x.png')
 review.save(SOURCE/'inspection'/'weapon-repair-review.png')

if __name__=='__main__':
 import sys
 if '--apply' in sys.argv: apply()
 render()

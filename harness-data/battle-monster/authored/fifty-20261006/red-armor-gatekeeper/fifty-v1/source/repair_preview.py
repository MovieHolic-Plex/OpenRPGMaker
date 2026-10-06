"""Read saved PNG/GIF bytes into diagnostic enlargements only.
No source authoring, interpolated motion or new palette colors in native assets.
"""
from pathlib import Path
from PIL import Image, ImageDraw
ROOT=Path(__file__).resolve().parent
for name in ['move','attack','dead','skill_a']:
 im=Image.open(ROOT/'png'/(name+'.png')).convert('RGBA')
 bg=Image.new('RGBA',im.size,'#ece3d0');bg.alpha_composite(im)
 bg.resize((512,512),Image.Resampling.NEAREST).save(ROOT/'png'/('after-'+name+'-4x.png'))
frames=[('idle',0),('idle',1),('idle',2),('attack',1),('attack',2),('attack',3),('dead',1),('skill',0),('stun',1)]
sheet=Image.new('RGB',(1152,1206),'#ece3d0')
for index,(name,frame) in enumerate(frames):
 im=Image.open(ROOT/'gif'/(name+'.gif'));im.seek(frame);im=im.convert('RGBA')
 art=im.resize((384,384),Image.Resampling.NEAREST)
 x=index%3*384;y=index//3*402
 sheet.paste(art,(x,y),art)
 ImageDraw.Draw(sheet).text((x+4,y+386),f'{name} saved GIF frame {frame}',fill='#242534')
sheet.save(ROOT/'png'/'repair-gif-readback-3x.png')

"""Inspection layouts only: PNG compositing, exact integer zooms and labels.
The pxgrid files are never modified by this module.
"""
from pathlib import Path
from PIL import Image, ImageDraw
s=Path(__file__).resolve().parent
p=s/'previews'

def tile(name,kind):
    bg=Image.new('RGBA',(128,128),{'light':'#E6DECE','dark':'#19202A','checker':'#A9AAA9'}[kind])
    if kind=='checker':
        d=ImageDraw.Draw(bg)
        for y in range(0,128,8):
            for x in range(0,128,8):
                if (x//8+y//8)%2==0:d.rectangle((x,y,x+7,y+7),fill='#D6D4CB')
    bg.alpha_composite(Image.open(p/(name+'.png')))
    return bg.convert('RGB')

for title,names in [('review-motion',['idle_a','windup','move','attack','skill_b']),('review-tail',['hit','poison_a','poison_b','stun_a','stun_b'])]:
    im=Image.new('RGB',(816,734),'#343940');d=ImageDraw.Draw(im)
    for i,n in enumerate(names):
        im.paste(tile(n,'light'),(i*144+8,22));d.text((i*144+8,5),n,fill='white')
        x,y=(i%3)*272+8,178+(i//3)*278
        im.paste(tile(n,'dark').resize((256,256),Image.Resampling.NEAREST),(x,y))
        d.text((x,y-16),n,fill='white')
    im.save(p/(title+'.png'))
for n in ['attack','move','hit','stun_b']:
    tile(n,'light').resize((512,512),Image.Resampling.NEAREST).save(p/(n+'-review-4x.png'))
tile('attack','light').resize((640,640),Image.Resampling.NEAREST).save(p/'attack-detail-5x.png')
# Replace earlier diagnostic summaries so every file points at the current literal grids.
Image.open(p/'review-motion.png').save(p/'motion-detail.png')
Image.open(p/'review-tail.png').save(p/'status-detail.png')

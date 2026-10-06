from pathlib import Path
from PIL import Image, ImageDraw
ROOT=Path(__file__).resolve().parent
names=['idle_a','attack','poison_a','poison_b','sleep_a','sleep_b','stun_a','stun_b','dead']
regions=[(42,18,64,31),(45,19,67,32),(40,23,65,37),(40,23,65,37),(44,41,65,54),(44,41,65,54),(40,30,65,44),(40,30,65,44),(29,64,53,76)]
canvas=Image.new('RGB',(800,650),(227,224,207)); d=ImageDraw.Draw(canvas)
for i,(name,region) in enumerate(zip(names,regions)):
    im=Image.open(ROOT/'previews'/(name+'.png')).crop(region)
    x=(i%3)*264;y=(i//3)*215
    tile=Image.new('RGB',im.size,(227,224,207));tile.paste(im,mask=im)
    canvas.paste(tile.resize((im.width*8,im.height*8),Image.Resampling.NEAREST),(x+10,y+40))
    d.text((x+10,y+10),name+' face at '+str(region[:2]),fill='black')
canvas.save(ROOT/'previews'/'face-check.png')

from PIL import Image, ImageDraw, ImageFont
from pathlib import Path
import json
root=Path('tiledata/forest-villages/villages')
entries=json.load(open(root/'manifest.json'))['entries']
image=Image.new('RGB',(1320,3260),'#15271e')
draw=ImageDraw.Draw(image)
font=ImageFont.truetype('/usr/share/fonts/truetype/nanum/NanumBarunGothicBold.ttf',25)
for i,e in enumerate(entries):
    x=10+(i%2)*660;y=10+(i//2)*650
    draw.text((x,y),f"{i+1}. {e['name']}",font=font,fill='#eeeecc')
    image.paste(Image.open(root/e['image']).resize((640,576),Image.Resampling.NEAREST),(x,y+40))
image.save(root/'contact-sheet.jpg',quality=95)

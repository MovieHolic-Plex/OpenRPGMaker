from pathlib import Path
import json
from PIL import Image, ImageDraw
ROOT=Path(__file__).parent
PAL=json.loads((ROOT/'palette.json').read_text())
ORDER=['idle_a','idle_b','idle_c','windup','move','attack','recover','hit','dead','skill_a','skill_b','skill_c','poison_a','poison_b','stun_a','stun_b','sleep_a','sleep_b']
sheet=Image.new('RGB',(720,6*292),(232,229,214))
draw=ImageDraw.Draw(sheet)
for k,name in enumerate(ORDER):
    path=ROOT/('poses' if k<9 else 'actions')/(name+'.pxgrid')
    if not path.exists():continue
    rows=path.read_text().splitlines()
    im=Image.new('RGBA',(64,64),(0,0,0,0))
    for y,row in enumerate(rows):
        for x,ch in enumerate(row):
            if ch!='.': im.putpixel((x,y),tuple(bytes.fromhex(PAL[ch][1:]))+(255,))
    im.save(ROOT/'progress'/(name+'.png'))
    sx=(k%3)*240;sy=(k//3)*292
    draw.text((sx+8,sy+4),name,fill=(30,36,42))
    sheet.paste(im,(sx+8,sy+22),im)
    enlarged=im.resize((192,192),Image.Resampling.NEAREST)
    sheet.paste(enlarged,(sx+24,sy+92),enlarged)
sheet.save(ROOT/'progress/suite.png')

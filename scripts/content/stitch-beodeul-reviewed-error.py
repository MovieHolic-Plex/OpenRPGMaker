"""normal-error.png: left = normal street, right = the mutated street, cropped around the blocked entrance."""
import json,sys
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
root=Path(__file__).resolve().parents[2];pub=root/'public/assets/beodeul-reviewed'
err=json.loads((root/'tiledata/beodeul-reviewed/errors.json').read_text())
a=Image.open(pub/'street.png').convert('RGB');b=Image.open(pub/'error-street.png').convert('RGB')
cx=err['x']*16+8;box=(max(0,cx-120),max(0,err['y']*16-120),min(a.width,cx+120),min(a.height,err['y']*16+60))
S=3;ca=a.crop(box).resize(((box[2]-box[0])*S,(box[3]-box[1])*S),Image.NEAREST);cb=b.crop(box).resize(ca.size,Image.NEAREST)
out=Image.new('RGB',(ca.width*2+30,ca.height+28),(30,36,30));out.paste(ca,(10,24));out.paste(cb,(ca.width+20,24))
d=ImageDraw.Draw(out);f=ImageFont.truetype('/usr/share/fonts/truetype/nanum/NanumSquareB.ttf',15);d.text((12,4),'정상: 문 앞이 열려 있음',font=f,fill=(220,240,210));d.text((ca.width+22,4),'오류: 문 앞 3층에 anvil, canMove=false',font=f,fill=(255,200,180))
out.quantize(128).save(pub/'normal-error.png',optimize=True)
for n in ('street','error-street'):Image.open(pub/f'{n}.png').convert('RGB').quantize(128).save(pub/f'{n}.png',optimize=True)
print('ok',out.size)

from pathlib import Path
import json
from PIL import Image, ImageDraw
root=Path(__file__).parent
p=json.loads((root/'palette.json').read_text()); colors={k:tuple(bytes.fromhex(v[1:]))+(255,) for k,v in p.items()}
files=list((root/'poses').glob('*.pxgrid'))+list((root/'actions').glob('*.pxgrid'))
order=['idle_a','idle_b','idle_c','windup','move','attack','recover','hit','dead','skill_a','skill_b','skill_c','poison_a','poison_b','stun_a','stun_b','sleep_a','sleep_b']
files.sort(key=lambda f:order.index(f.stem))
sheet=Image.new('RGB',(720,((len(files)+2)//3)*258),(232,230,218)); draw=ImageDraw.Draw(sheet)
report=[]
for i,f in enumerate(files):
    data=f.read_text().splitlines()
    if len(data)!=64 or any(len(r)!=64 for r in data):raise ValueError(f'wrong canvas {f}')
    bad=set(''.join(data))-set(p)-{'.'}
    if bad:raise ValueError((f,bad))
    ink=[(x,y) for y,r in enumerate(data) for x,c in enumerate(r) if c!='.']
    if any(x<1 or x>62 or y<1 or y>60 for x,y in ink):raise ValueError(f'margin {f}')
    if f.stem=='idle_a' and max(y for x,y in ink)!=60:raise ValueError('idle sole')
    im=Image.new('RGBA',(64,64));im.putdata([colors.get(c,(0,0,0,0)) for r in data for c in r])
    im.save(root/'progress'/(f.stem+'.png'))
    x=(i%3)*240;y=(i//3)*258
    draw.text((x+8,y+6),f.stem,fill=(42,55,54))
    sheet.paste(im,(x+166,y+1),im)
    enlarged=im.resize((192,192),Image.Resampling.NEAREST)
    sheet.paste(enlarged,(x+24,y+64),enlarged)
    report.append(f'{f.stem}: {len(ink)} ink pixels; bounds {min(x for x,y in ink)},{min(y for x,y in ink)}..{max(x for x,y in ink)},{max(y for x,y in ink)}')
sheet.save(root/'progress/contact-sheet.png')
(root/'progress/format.txt').write_text('\n'.join(report)+'\n')
print('\n'.join(report))

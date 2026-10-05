from pathlib import Path
from PIL import Image, ImageDraw
import json
ROOT=Path(__file__).parent
pal=json.loads((ROOT/'palette.json').read_text())
paths=list((ROOT/'poses').glob('*.pxgrid'))+list((ROOT/'actions').glob('*.pxgrid'))
order=['idle_a','idle_b','idle_c','windup','move','attack','recover','hit','dead','skill_a','skill_b','skill_c','poison_a','poison_b','stun_a','stun_b','sleep_a','sleep_b']
paths.sort(key=lambda p:order.index(p.stem))
w=3*276; h=((len(paths)+2)//3)*358
sheet=Image.new('RGB',(w,h),'#b8b6ac'); d=ImageDraw.Draw(sheet)
for i,p in enumerate(paths):
    grid=p.read_text().splitlines()
    assert len(grid)==64 and all(len(r)==64 for r in grid)
    assert all(c=='.' or c in pal for r in grid for c in r)
    assert set(grid[0]+grid[61]+grid[62]+grid[63])=={'.'}
    assert all(r[0]==r[63]=='.' for r in grid)
    im=Image.new('RGBA',(64,64))
    for y,r in enumerate(grid):
        for x,c in enumerate(r):
            if c!='.': im.putpixel((x,y),tuple(bytes.fromhex(pal[c][1:]))+(255,))
    im.save(ROOT/'progress'/(p.stem+'.png'))
    sx=(i%3)*276+10; sy=(i//3)*358+24
    d.text((sx,sy-18),p.stem,fill='#282a31')
    bg=Image.new('RGBA',(256,256),'#ddd8c8'); bg.alpha_composite(im.resize((256,256),Image.Resampling.NEAREST))
    sheet.paste(bg.convert('RGB'),(sx,sy))
    sheet.paste(im,(sx+192,sy+260),im)
sheet.save(ROOT/'progress/contact-sheet.png')
sheet.crop((0,0,w,1074)).save(ROOT/'progress/poses-sheet.png')
sheet.crop((0,1074,w,h)).save(ROOT/'progress/actions-sheet.png')
print('Source canvases:',len(paths),'Palette:',len(pal))

from pathlib import Path
import json
from PIL import Image, ImageDraw

root=Path(__file__).parent
palette=json.loads((root/'palette.json').read_text())
colors={c:tuple(bytes.fromhex(v[1:]))+(255,) for c,v in palette.items()}
names=['idle_a','idle_b','idle_c','windup','move','attack','recover','hit','dead',
       'skill_a','skill_b','skill_c','poison_a','poison_b','stun_a','stun_b','sleep_a','sleep_b']
sheet=Image.new('RGB',(864,600 if not (root/'actions/skill_a.pxgrid').exists() else 1200),'#c6c6be')
draw=ImageDraw.Draw(sheet)
for i,name in enumerate(names):
    path=root/('poses' if i<9 else 'actions')/(name+'.pxgrid')
    if not path.exists(): continue
    grid=path.read_text().splitlines()
    assert len(grid)==64 and all(len(row)==64 for row in grid),name
    assert set(''.join(grid)) <= set(palette)|{'.'},name
    assert all(c=='.' for c in grid[0]+grid[61]+grid[62]+grid[63]),name
    assert all(row[0]==row[63]=='.' for row in grid),name
    im=Image.new('RGBA',(64,64))
    im.putdata([colors.get(c,(0,0,0,0)) for row in grid for c in row])
    im.save(root/'progress'/f'{name}.png')
    x,y=(i%3)*288,(i//3)*200
    draw.text((x+10,y+5),name,fill='#282837')
    sheet.paste(im,(x+12,y+23),im)
    zoom=im.resize((160,160),Image.Resampling.NEAREST)
    sheet.paste(zoom,(x+92,y+25),zoom)
sheet.save(root/'progress/contact-sheet.png')
print(f'Wrote inspection sheet; palette {len(palette)} exact colors.')

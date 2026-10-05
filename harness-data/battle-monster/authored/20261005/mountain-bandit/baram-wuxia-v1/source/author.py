"""Only literal row/run placement and inspection rendering. No pose synthesis."""
from pathlib import Path
import json
from PIL import Image, ImageDraw
ROOT=Path(__file__).resolve().parent
PAL=json.loads((ROOT/'palette.json').read_text())
def write(name, block, category='poses'):
    rows=[list('.'*64) for _ in range(64)]
    for line in block.strip().splitlines():
        if not line.strip() or line.startswith('#'): continue
        y,x,run=line.split()
        y,x=int(y),int(x)
        assert 0<=y<64 and 0<=x and x+len(run)<=64, (name,y,x,run)
        assert all(c=='.' or c in PAL for c in run), (name,run)
        rows[y][x:x+len(run)]=run
    text='\n'.join(''.join(row) for row in rows)+'\n'
    (ROOT/category/f'{name}.pxgrid').write_text(text)
    (ROOT/'literals'/f'{name}.txt').write_text(block.strip()+'\n')
    return rows
def decode(path):
    rows=path.read_text().splitlines()
    assert len(rows)==64 and all(len(r)==64 for r in rows), path
    im=Image.new('RGBA',(64,64))
    for y,row in enumerate(rows):
        for x,k in enumerate(row):
            if k!='.':
                assert k in PAL, (path,k)
                assert 1<=x<=62 and 1<=y<=60,(path,x,y)
                h=PAL[k].lstrip('#')
                im.putpixel((x,y),tuple(int(h[i:i+2],16) for i in (0,2,4))+(255,))
    return im
def render():
    paths=[ROOT/'poses'/f'{n}.pxgrid' for n in ['idle_a','idle_b','idle_c','windup','move','attack','recover','hit','dead']]
    paths += [ROOT/'actions'/f'{n}.pxgrid' for n in ['skill_a','skill_b','skill_c','poison_a','poison_b','stun_a','stun_b','sleep_a','sleep_b']]
    paths=[p for p in paths if p.exists()]
    sheet=Image.new('RGB',(6*276,3*326),'#d8dbd2')
    draw=ImageDraw.Draw(sheet)
    for i,p in enumerate(paths):
        im=decode(p)
        im.save(ROOT/'progress'/f'{p.stem}.png')
        x=(i%6)*276;y=(i//6)*326
        draw.text((x+10,y+5),p.stem,fill='#24282d')
        sheet.paste(im,(x+12,y+25),im)
        sheet.paste(im.resize((256,256),Image.Resampling.NEAREST),(x+10,y+69),im.resize((256,256),Image.Resampling.NEAREST))
    sheet.save(ROOT/'progress'/'suite.png')
    if (ROOT/'poses'/'idle_a.pxgrid').exists():
        im=decode(ROOT/'poses'/'idle_a.pxgrid')
        im.save(ROOT/'progress'/'idle.png')
        im.resize((512,512),Image.Resampling.NEAREST).save(ROOT/'progress'/'idle-8x.png')
        im.crop((20,7,47,32)).resize((216,200),Image.Resampling.NEAREST).save(ROOT/'progress'/'face.png')
if __name__=='__main__': render()

def patch(name, changes, category='poses'):
    path=ROOT/category/f'{name}.pxgrid'
    rows=[list(r) for r in path.read_text().splitlines()]
    for y,x,run in changes:
        assert all(k=='.' or k in PAL for k in run)
        rows[y][x:x+len(run)]=run
    path.write_text('\n'.join(''.join(r) for r in rows)+'\n')

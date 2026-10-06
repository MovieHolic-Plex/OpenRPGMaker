"""Render literal native pxgrids. No artistic geometry or frame transforms."""
from pathlib import Path
import json
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
PAL = json.loads((ROOT / 'palette.json').read_text())
RGB = {s: tuple(bytes.fromhex(c[1:])) for s, c in PAL.items()}
ORDER = ['idle_a','idle_b','idle_c','windup','move','attack','recover','hit','dead',
         'skill_a','skill_b','skill_c','poison_a','poison_b','stun_a','stun_b','sleep_a','sleep_b']
MOTIONS = {
 'idle': [('idle_a',240),('idle_b',240),('idle_c',240),('idle_b',240)],
 'attack': [('idle_a',240),('windup',180),('move',100),('attack',140),('recover',180),('idle_a',260)],
 'hit': [('idle_a',300),('hit',220),('recover',180),('idle_a',300)],
 'dead': [('idle_a',320),('hit',180),('dead',1000)],
 'skill': [('idle_a',240),('skill_a',260),('skill_b',200),('skill_c',260),('idle_a',320)],
 'poison': [('poison_a',400),('poison_b',400)],
 'stun': [('stun_a',440),('stun_b',440)],
 'sleep': [('sleep_a',640),('sleep_b',640)],
}

def write_literals():
    # Each record supplies an explicitly authored x, y and native row string.
    # Dots initialize empty canvas. No body/effect pixel is inferred.
    name = None
    frames = {}
    for line in (ROOT / 'author_clusters.txt').read_text().splitlines():
        if not line or line.startswith('#'):
            continue
        if line.startswith('@ '):
            name = line[2:]
            frames[name] = [['.'] * 64 for _ in range(64)]
            continue
        y, x, row = line.split()
        y, x = int(y), int(x)
        if len(row)+x > 63 or not 1 <= x or not 1 <= y <= 60:
            raise ValueError((name, x, y, len(row)))
        for dx, s in enumerate(row):
            if s != '.' and s not in PAL:
                raise ValueError((name, s))
            frames[name][y][x+dx] = s
    patch = ROOT / 'author_corrections.txt'
    if patch.exists():
        for line in patch.read_text().splitlines():
            if not line or line.startswith('#'):
                continue
            if line.startswith('@ '):
                name = line[2:]
                continue
            y, x, row = line.split()
            y, x = int(y), int(x)
            if x+len(row) > 63 or not 1 <= x or not 1 <= y <= 60:
                raise ValueError((name, x, y, len(row)))
            for dx, s in enumerate(row):
                frames[name][y][x+dx] = s
    for name, rows in frames.items():
        folder = 'poses' if name in ORDER[:9] else 'actions'
        out = ROOT / folder / f'{name}.pxgrid'
        out.parent.mkdir(exist_ok=True)
        out.write_text('\n'.join(''.join(r) for r in rows)+'\n')

def read_frames():
    result = {}
    for name in ORDER:
        path = ROOT / ('poses' if name in ORDER[:9] else 'actions') / f'{name}.pxgrid'
        if not path.exists():
            continue
        rows = path.read_text().splitlines()
        if len(rows) != 64 or any(len(r) != 64 for r in rows):
            raise ValueError(path)
        im = Image.new('RGBA', (64,64))
        im.putdata([(0,0,0,0) if s == '.' else (*RGB[s],255) for row in rows for s in row])
        result[name] = im
    return result

def board(frames):
    keys = [n for n in ORDER if n in frames]
    cols, tw, th = 6, 276, 286
    out = Image.new('RGB', (cols*tw, ((len(keys)+cols-1)//cols)*th),(40,43,49))
    draw = ImageDraw.Draw(out)
    for i,n in enumerate(keys):
        x,y = (i%cols)*tw,(i//cols)*th
        draw.text((x+8,y+5),n,fill=(236,236,225))
        for yy in range(64):
            for xx in range(64):
                c = (76,80,88) if (xx//8+yy//8)%2 else (108,112,116)
                draw.rectangle((x+8+xx*4,y+24+yy*4,x+11+xx*4,y+27+yy*4),fill=c)
        out.paste(frames[n].resize((256,256),Image.Resampling.NEAREST),(x+8,y+24),frames[n].resize((256,256),Image.Resampling.NEAREST))
    out.save(ROOT/'preview'/'contact-checker.png')
    for label,c in [('light',(233,225,206)),('dark',(24,28,36))]:
        out = Image.new('RGB',(cols*tw,((len(keys)+cols-1)//cols)*th),c)
        draw=ImageDraw.Draw(out)
        for i,n in enumerate(keys):
            x,y=(i%cols)*tw,(i//cols)*th
            draw.text((x+8,y+5),n,fill=(130,120,110) if label=='light' else (225,225,216))
            big=frames[n].resize((256,256),Image.Resampling.NEAREST)
            out.paste(big,(x+8,y+24),big)
            out.paste(frames[n],(x+204,y+6),frames[n])
        out.save(ROOT/'preview'/f'contact-{label}.png')
    native=Image.new('RGBA',(6*64,3*64))
    for i,n in enumerate(keys):
        native.paste(frames[n],((i%6)*64,(i//6)*64))
    native.save(ROOT/'preview'/'native-sheet.png')
    for label, group in [('poses',ORDER[:9]),('actions',ORDER[9:])]:
        sheet=Image.new('RGBA',(192,192))
        for i,n in enumerate(group):
            if n in frames:
                sheet.paste(frames[n],((i%3)*64,(i//3)*64))
        sheet.save(ROOT/'preview'/f'{label}-sheet.png')

def render():
    frames=read_frames()
    (ROOT/'preview').mkdir(exist_ok=True)
    (ROOT/'preview'/'png').mkdir(exist_ok=True)
    for n,im in frames.items():
        im.save(ROOT/'preview'/'png'/f'{n}.png')
    board(frames)
    fixed_palette=[0,0,0]+[v for c in RGB.values() for v in c]
    fixed_palette += [0]*(768-len(fixed_palette))
    symbols=['.']+list(PAL)
    for motion,seq in MOTIONS.items():
        if any(n not in frames for n,_ in seq):
            continue
        images=[]
        for n,ms in seq:
            rows=(ROOT/('poses' if n in ORDER[:9] else 'actions')/f'{n}.pxgrid').read_text().splitlines()
            p=Image.new('P',(64,64))
            p.putpalette(fixed_palette)
            p.putdata([symbols.index(s) for row in rows for s in row])
            p.info['transparency']=0
            images.append(p)
        out=ROOT/'preview'/f'{motion}.gif'
        images[0].save(out,save_all=True,append_images=images[1:],duration=[ms for _,ms in seq],loop=0,transparency=0,disposal=2,optimize=False)
    summary={n:{'bbox':im.getbbox(),'ink_pixels':sum(a==255 for *_,a in im.get_flattened_data())} for n,im in frames.items()}
    (ROOT/'preview'/'geometry.json').write_text(json.dumps(summary,indent=2)+'\n')
    print(json.dumps(summary))

if __name__=='__main__':
    import sys
    if '--write-literals' in sys.argv:
        write_literals()
    render()

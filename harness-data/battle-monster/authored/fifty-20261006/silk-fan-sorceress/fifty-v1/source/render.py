"""Transcribe literal authored rows and render their exact indexed pixels.
Only transparent padding is added. No geometry, shading or pose generation.
"""
from pathlib import Path
import json
from PIL import Image, ImageDraw, ImageFont
ROOT = Path(__file__).resolve().parent
P = json.loads((ROOT/'palette.json').read_text())
POSES = ['idle_a','idle_b','idle_c','windup','move','attack','recover','hit','dead']
ACTIONS = ['skill_a','skill_b','skill_c','poison_a','poison_b','stun_a','stun_b','sleep_a','sleep_b']
def transcribe():
    sections = (ROOT/'authored-rows.txt').read_text().split('@')[1:]
    for section in sections:
        lines = section.strip('\n').splitlines()
        name, start = lines[0].split()
        start = int(start)
        rows = ['.'*64 for _ in range(64)]
        for y, row in enumerate(lines[1:], start):
            if ' ' in row:
                raise ValueError(f'{name} y={y}: space at x={row.index(" ")}')
            if len(row)!=64 or y>=64:
                raise ValueError((name,y,len(row)))
            if set(row)-set(P)-{'.'}:
                raise ValueError((name,y,set(row)-set(P)-{'.'}))
            rows[y]=row
        directory = 'poses' if name in POSES else 'actions'
        (ROOT/directory/f'{name}.pxgrid').write_text('\n'.join(rows)+'\n')
def load(name):
    directory = 'poses' if name in POSES else 'actions'
    path = ROOT/directory/f'{name}.pxgrid'
    rows=path.read_text().splitlines()
    if len(rows)!=64 or any(len(r)!=64 for r in rows):
        raise ValueError(f'{name}: not 64 square')
    ink=[(x,y) for y,r in enumerate(rows) for x,s in enumerate(r) if s!='.']
    if any(x<1 or x>62 or y<1 or y>60 for x,y in ink):
        raise ValueError(f'{name}: margin')
    if name=='idle_a' and max(y for x,y in ink)!=60:
        raise ValueError('idle_a: baseline')
    im=Image.new('RGBA',(64,64))
    im.putdata([(0,0,0,0) if s=='.' else tuple(bytes.fromhex(P[s][1:]))+(255,) for row in rows for s in row])
    im.save(ROOT/'previews'/f'{name}.png')
    return im

def backgrounds(im,kind):
    bg=Image.new('RGBA',(64,64),(239,232,217,255) if kind=='light' else (37,38,49,255))
    if kind=='checker':
        bg.putdata([(174,180,186,255) if (x//8+y//8)%2 else (211,215,218,255) for y in range(64) for x in range(64)])
    bg.alpha_composite(im)
    return bg.convert('RGB')

def render():
    frames={n:load(n) for n in POSES+ACTIONS if (ROOT/('poses' if n in POSES else 'actions')/f'{n}.pxgrid').exists()}
    for kind in ['light','dark','checker']:
        sheet=Image.new('RGB',(6*264,3*292),(220,220,220) if kind!='dark' else (30,30,38))
        draw=ImageDraw.Draw(sheet)
        native=Image.new('RGB',(6*80,3*90),(220,220,220) if kind!='dark' else (30,30,38))
        nd=ImageDraw.Draw(native)
        for idx,(n,im) in enumerate(frames.items()):
            x,y=idx%6*264,idx//6*292
            tile=backgrounds(im,kind)
            sheet.paste(tile.resize((256,256),Image.Resampling.NEAREST),(x+4,y+24))
            draw.text((x+4,y+5),n,fill='white' if kind=='dark' else 'black')
            nx,ny=idx%6*80,idx//6*90
            native.paste(tile,(nx+8,ny+19))
            nd.text((nx+2,ny+3),n,fill='white' if kind=='dark' else 'black')
        sheet.save(ROOT/'previews'/f'sheet-{kind}-4x.png')
        native.save(ROOT/'previews'/f'sheet-{kind}-1x.png')
    sequences={
        'idle':(['idle_a','idle_b','idle_c','idle_b'],[240,240,240,240]),
        'attack':(['idle_a','windup','move','attack','recover','idle_a'],[300,200,100,170,220,300]),
        'hit':(['idle_a','hit','recover','idle_a'],[350,260,200,400]),
        'dead':(['hit','dead'],[180,1100]),
        'skill':(['idle_a','skill_a','skill_b','skill_c','idle_a'],[300,330,250,320,300]),
        'poison':(['poison_a','poison_b'],[400,400]),
        'stun':(['stun_a','stun_b'],[380,380]),
        'sleep':(['sleep_a','sleep_b'],[650,750])
    }
    # Fixed exact palette; no color quantization. Preview GIF has a dark backdrop.
    palette=[37,38,49]+[v for color in P.values() for v in bytes.fromhex(color[1:])]
    palette += [0]*(768-len(palette))
    symbols=['.']+list(P)
    for motion,(names,holds) in sequences.items():
        if any(n not in frames for n in names): continue
        gifs=[]
        for name in names:
            directory='poses' if name in POSES else 'actions'
            rows=(ROOT/directory/f'{name}.pxgrid').read_text().splitlines()
            gif=Image.new('P',(64,64))
            gif.putpalette(palette)
            gif.putdata([symbols.index(s) for row in rows for s in row])
            gifs.append(gif)
        gifs[0].save(ROOT/'previews'/f'{motion}.gif',save_all=True,append_images=gifs[1:],duration=holds,loop=0,optimize=False,disposal=2,transparency=0)
    print('Rendered:', ', '.join(frames))
if __name__=='__main__':
    transcribe()
    render()

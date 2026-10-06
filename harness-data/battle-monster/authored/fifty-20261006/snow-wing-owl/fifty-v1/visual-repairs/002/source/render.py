"""Literal row writer and PNG/GIF inspection renderer. No pose synthesis.

Each authored line is y, x, and the final palette-index run at that coordinate.
Only unmarked canvas pixels are initialized to transparent. No fill or transform.
"""
from pathlib import Path
import json
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent
PALETTE = json.loads((ROOT / 'palette.json').read_text())
COLORS = {k: tuple(bytes.fromhex(v[1:])) + (255,) for k, v in PALETTE.items()}
POSES = ['idle_a', 'idle_b', 'idle_c', 'windup', 'move', 'attack', 'recover', 'hit', 'dead']
ACTIONS = ['skill_a', 'skill_b', 'skill_c', 'poison_a', 'poison_b', 'stun_a', 'stun_b', 'sleep_a', 'sleep_b']

def write_literals():
    frames = {}
    name = None
    occupied = set()
    for line in (ROOT / 'authored-rows.txt').read_text().splitlines():
        if not line or line.startswith('#'):
            continue
        if line.startswith('['):
            name = line[1:-1]
            if name in frames:
                raise ValueError('Duplicate frame: ' + name)
            frames[name] = [list('.' * 64) for _ in range(64)]
            occupied = set()
            continue
        y, x, pixels = line.split()
        y, x = int(y), int(x)
        if not (1 <= y <= 60 and 1 <= x and x + len(pixels) <= 63):
            raise ValueError((name, y, x, len(pixels)))
        for j, symbol in enumerate(pixels):
            if symbol != '.' and symbol not in COLORS:
                raise ValueError((name, symbol))
            if (x+j, y) in occupied:
                raise ValueError(('overlapping runs', name, x+j, y))
            occupied.add((x+j, y))
            frames[name][y][x+j] = symbol
    for name, rows in frames.items():
        folder = 'poses' if name in POSES else 'actions'
        (ROOT / folder / (name + '.pxgrid')).write_text('\n'.join(''.join(row) for row in rows) + '\n')
    return list(frames)

def read_image(name):
    folder = 'poses' if name in POSES else 'actions'
    rows = (ROOT / folder / (name + '.pxgrid')).read_text().splitlines()
    if len(rows) != 64 or any(len(row) != 64 for row in rows):
        raise ValueError(('not native64', name))
    im = Image.new('RGBA', (64, 64))
    im.putdata([COLORS.get(c, (0, 0, 0, 0)) for row in rows for c in row])
    return im

def background(kind, width, height):
    im = Image.new('RGBA', (width, height), '#eee9df' if kind == 'light' else '#17232c')
    if kind == 'checker':
        draw = ImageDraw.Draw(im)
        for y in range(0, height, 8):
            for x in range(0, width, 8):
                draw.rectangle((x, y, x+7, y+7), fill='#77838a' if (x//8+y//8)%2 else '#a0aab0')
    return im

def inspect(names, images):
    # Labels and nearest enlargement are inspection only; originals stay native.
    for kind in ['light', 'dark', 'checker']:
        sheet = background(kind, 6*208, ((len(names)+5)//6)*240)
        draw = ImageDraw.Draw(sheet)
        for i, name in enumerate(names):
            x, y = (i%6)*208, (i//6)*240
            draw.text((x+5, y+4), name, fill='#202c38' if kind == 'light' else '#ffffff')
            sheet.alpha_composite(images[name].resize((192,192), Image.Resampling.NEAREST), (x+8,y+22))
        sheet.convert('RGB').save(ROOT / 'inspection' / (kind + '.png'))
    native = background('light', 6*100, ((len(names)+5)//6)*88)
    draw = ImageDraw.Draw(native)
    for i, name in enumerate(names):
        x, y = (i%6)*100, (i//6)*88
        draw.text((x+3,y+2), name, fill='#24313f')
        native.alpha_composite(images[name], (x+18,y+19))
    native.convert('RGB').save(ROOT / 'inspection' / 'native.png')

MOTIONS = {
    'idle': [('idle_a',240),('idle_b',240),('idle_c',240),('idle_b',240)],
    'attack': [('idle_a',200),('windup',180),('move',110),('attack',160),('recover',180),('idle_a',220)],
    'hit': [('idle_a',220),('hit',180),('recover',180),('idle_a',260)],
    'dead': [('idle_a',240),('hit',150),('dead',1000)],
    'skill': [('idle_a',180),('skill_a',260),('skill_b',220),('skill_c',220),('idle_a',260)],
    'poison': [('poison_a',340),('poison_b',340)],
    'stun': [('stun_a',380),('stun_b',380)],
    'sleep': [('sleep_a',600),('sleep_b',600)],
}

def make_gifs(images):
    gif_colors = [(0,0,0)] + [COLORS[s][:3] for s in PALETTE]
    lookup = {COLORS[s]: i+1 for i,s in enumerate(PALETTE)}
    flat_palette = [c for rgb in gif_colors for c in rgb]
    flat_palette += [0]*(768-len(flat_palette))
    for name, sequence in MOTIONS.items():
        if any(p not in images for p,_ in sequence):
            continue
        frames = []
        for pose,_ in sequence:
            frame = Image.new('P',(64,64))
            frame.putpalette(flat_palette)
            frame.putdata([lookup.get(p,0) for p in images[pose].get_flattened_data()])
            frames.append(frame)
        frames[0].save(ROOT / 'gifs' / (name+'.gif'), save_all=True, append_images=frames[1:],
            duration=[t for _,t in sequence], loop=0, transparency=0, disposal=2, optimize=False)

def decode_gif_inspection():
    records = {}
    for name, sequence in MOTIONS.items():
        path = ROOT / 'gifs' / (name+'.gif')
        if not path.exists():
            continue
        with Image.open(path) as gif:
            strip = background('checker', gif.n_frames*208, 224)
            draw = ImageDraw.Draw(strip)
            records[name] = []
            for index in range(gif.n_frames):
                gif.seek(index)
                frame = gif.convert('RGBA')
                duration = gif.info.get('duration')
                records[name].append({'frame': index, 'durationMs': duration, 'size': list(frame.size)})
                draw.text((index*208+4,4), f'{sequence[index][0]} {duration}ms', fill='#ffffff')
                strip.alpha_composite(frame.resize((192,192), Image.Resampling.NEAREST), (index*208+8,24))
            strip.convert('RGB').save(ROOT / 'inspection' / (name+'-decoded.png'))
    (ROOT / 'inspection' / 'gif-readback.json').write_text(json.dumps(records, indent=2)+'\n')

if __name__ == '__main__':
    names = write_literals()
    images = {name:read_image(name) for name in names}
    for name, im in images.items():
        im.save(ROOT / 'png' / (name+'.png'))
    packed = Image.new('RGBA',(192,384))
    for i,name in enumerate(POSES+ACTIONS):
        if name in images:
            packed.alpha_composite(images[name],((i%3)*64,(i//3)*64))
    packed.save(ROOT / 'sheet.png')
    inspect(names, images)
    make_gifs(images)
    decode_gif_inspection()
    print('Rendered literal frames:', ', '.join(names))

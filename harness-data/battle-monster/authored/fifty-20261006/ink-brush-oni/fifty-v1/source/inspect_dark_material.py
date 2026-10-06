"""Read-only source/PNG/GIF diagnostics; writes only source/previews.

Nearest enlargement and background compositing are inspection views only.
No generated artwork, automatic corrections or reviewer decisions.
"""
from pathlib import Path
import hashlib
import json
from PIL import Image, ImageDraw, ImageChops

ROOT = Path(__file__).resolve().parent
BEFORE = ROOT / 'originals/before-dark-material-repair'
OUT = ROOT / 'previews'
PAL = json.loads((ROOT / 'palette.json').read_text())
NAMES = ['idle_a', 'idle_b', 'idle_c', 'windup', 'move', 'attack',
         'recover', 'hit', 'dead', 'skill_a', 'skill_b', 'skill_c',
         'poison_a', 'poison_b', 'stun_a', 'stun_b', 'sleep_a', 'sleep_b']


def path(root, name):
    return root / ('poses' if name in NAMES[:9] else 'actions') / (name + '.pxgrid')


def decode(p):
    im = Image.new('RGBA', (96, 96))
    for y, row in enumerate(p.read_text().splitlines()):
        for x, symbol in enumerate(row):
            if symbol != '.':
                im.putpixel((x, y), tuple(bytes.fromhex(PAL[symbol][1:])) + (255,))
    return im


def background(mode):
    bg = Image.new('RGBA', (96, 96), (235, 231, 218, 255)
                   if mode == 'light' else (34, 37, 43, 255))
    if mode == 'checker':
        for y in range(96):
            for x in range(96):
                value = 105 if (x // 8 + y // 8) % 2 else 160
                bg.putpixel((x, y), (value, value, value, 255))
    return bg


for mode in ['light', 'dark', 'checker']:
    native = Image.new('RGB', (720, 360), (45, 47, 52))
    draw = ImageDraw.Draw(native)
    for i, name in enumerate(NAMES):
        bg = background(mode)
        bg.alpha_composite(decode(path(ROOT, name)))
        x, y = i % 6 * 120 + 12, i // 6 * 120 + 20
        native.paste(bg.convert('RGB'), (x, y))
        draw.text((x, y - 15), name, fill=(245, 245, 240))
    native.save(OUT / ('native-' + mode + '.png'))

    board = Image.new('RGB', (840, 4 * 320), (45, 47, 52))
    draw = ImageDraw.Draw(board)
    for i, name in enumerate(['idle_a', 'attack', 'hit', 'skill_b']):
        y = i * 320 + 24
        for col, root in enumerate([BEFORE, ROOT]):
            bg = background(mode)
            bg.alpha_composite(decode(path(root, name)))
            x = col * 420 + 10
            draw.text((x, y - 18), name + (' before' if col == 0 else ' current'),
                      fill=(245, 245, 240))
            board.paste(bg.convert('RGB'), (x, y))
            board.paste(bg.resize((288, 288), Image.Resampling.NEAREST).convert('RGB'),
                        (x + 106, y))
    board.save(OUT / ('dark-material-' + mode + '.png'))

report = {'palette_unchanged': (ROOT / 'palette.json').read_bytes() ==
          (BEFORE / 'palette.json').read_bytes(), 'frames': {}, 'gifs': {}}
for name in NAMES:
    p = path(ROOT, name)
    old, new = path(BEFORE, name).read_text().splitlines(), p.read_text().splitlines()
    changes = [{'x': x, 'y': y, 'before': a, 'after': b}
               for y, (ra, rb) in enumerate(zip(old, new))
               for x, (a, b) in enumerate(zip(ra, rb)) if a != b]
    im = Image.open(OUT / (name + '.png')).convert('RGBA')
    report['frames'][name] = {
        'changed_pixels': len(changes), 'changes': changes,
        'same_transparent_mask': all((a == '.') == (b == '.')
                                     for ra, rb in zip(old, new) for a, b in zip(ra, rb)),
        'alpha_values': sorted(set(im.getchannel('A').getdata())),
        'grid_sha256': hashlib.sha256(p.read_bytes()).hexdigest(),
        'png_sha256': hashlib.sha256((OUT / (name + '.png')).read_bytes()).hexdigest(),
    }
sequences = {
    'idle': ['idle_a', 'idle_b', 'idle_c', 'idle_b'],
    'attack': ['idle_a', 'windup', 'move', 'attack', 'recover', 'idle_a'],
    'hit': ['idle_a', 'hit', 'recover', 'idle_a'],
    'dead': ['idle_a', 'hit', 'dead'],
    'skill': ['idle_a', 'skill_a', 'skill_b', 'skill_c', 'idle_a'],
    'poison': ['poison_a', 'poison_b'],
    'stun': ['stun_a', 'stun_b'],
    'sleep': ['sleep_a', 'sleep_b'],
}
for name, order in sequences.items():
    gif = Image.open(OUT / (name + '.gif'))
    matches, holds = [], []
    for i, frame in enumerate(order):
        gif.seek(i)
        expected = Image.new('RGBA', (96, 96), (220, 217, 205, 255))
        expected.alpha_composite(decode(path(ROOT, frame)))
        matches.append(ImageChops.difference(gif.convert('RGB'),
                                             expected.convert('RGB')).getbbox() is None)
        holds.append(gif.info['duration'])
    report['gifs'][name] = {'order': order, 'holds_ms': holds,
                            'decoded_pixels_match': matches}
(OUT / 'dark-material-report.json').write_text(json.dumps(report, indent=2) + '\n')
print('Changed pixels:', {n: v['changed_pixels'] for n, v in report['frames'].items()})
print('Palette preserved:', report['palette_unchanged'])
print('Transparency preserved:', all(v['same_transparent_mask'] for v in report['frames'].values()))
print('Decoded GIF pixels match:', all(all(v['decoded_pixels_match']) for v in report['gifs'].values()))
